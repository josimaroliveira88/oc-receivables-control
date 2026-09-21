// Purchase-order (COMPRA) write/read operations, extracted from the orders
// controller so the handlers stay thin. `client` is a Prisma client; each
// write function owns its own `$transaction`. Business rejections are thrown
// as HTTP-mapped errors (via utils/httpError.js) which the controller maps to
// the HTTP response.
import { fromCents, lineValueCents, toCents } from '../utils/money.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { computeOrderStatus } from '../utils/receivables.js';
import { applyMovement } from './stockService.js';
import { computeStockDiff } from '../utils/stockDiff.js';
import { findIdsByTextSearch } from '../utils/search.js';
import { parseLocalDate } from '../utils/date.js';
import {
  itemStockMovements,
  reverseOrderStock,
  reverseItemStock,
} from './orderStockIntegration.js';
import {
  validateProducts,
  validateStockItemRules,
  assertNotSaleOrder,
} from '../utils/ordersValidation.js';
import {
  itemCreateData,
  resolveItemDefaults,
  orderLineTotalCents,
} from '../utils/ordersItemTransform.js';
import {
  resolveKitFields,
  resolveEditedKitFields,
  resolveOrderUpdateItems,
} from '../utils/ordersKitResolution.js';
import { syncOrderStatus } from '../utils/ordersStatusSync.js';
import {
  ORDER_SORTABLE_FIELDS,
  sortOrdersInMemory,
} from '../utils/ordersSort.js';
import { syncExpenseFromOrder } from './financeSyncService.js';
import { removeBillForOrder } from './creditCardService.js';

const getOrders = async (client, { userId, query }) => {
  const { q, searchField, status, paymentType, sortBy, sortDir } = query;

  const where = { userId, orderType: 'COMPRA' };

  if (q && q.trim()) {
    let columns;
    switch (searchField) {
      case 'orderNumber':
        columns = ['orderNumber'];
        break;
      case 'accountOwner':
        columns = ['accountOwner'];
        break;
      case 'orderNotes':
        columns = ['orderNotes'];
        break;
      default:
        columns = ['orderNumber', 'accountOwner', 'orderNotes'];
    }
    const matchingIds = await findIdsByTextSearch({
      table: 'Order',
      columns,
      q,
    });
    if (matchingIds !== null) {
      if (matchingIds.length === 0) {
        return [];
      }
      where.id = { in: matchingIds };
    }
  }

  if (status) {
    const statusValues = Array.isArray(status)
      ? status
      : status.includes(',')
        ? status.split(',')
        : [status];
    where.status =
      statusValues.length === 1 ? statusValues[0] : { in: statusValues };
  }

  if (paymentType) {
    where.paymentType = paymentType;
  }

  // The pendingValue column is derived from items and payments, so it is
  // sorted in-memory after fetching the filtered set.
  const COMPUTED_SORT_FIELDS = ['pendingValue'];
  const inMemorySort = COMPUTED_SORT_FIELDS.includes(sortBy);

  const direction = sortDir === 'desc' ? 'desc' : 'asc';
  let orderBy = [{ orderDate: 'desc' }, { createdAt: 'desc' }];
  if (!inMemorySort && ORDER_SORTABLE_FIELDS.includes(sortBy)) {
    orderBy = [{ [sortBy]: direction }];
  }

  const orders = await client.order.findMany({
    where,
    include: {
      items: {
        include: {
          person: true,
          product: true,
        },
      },
      payments: {
        include: {
          person: true,
        },
      },
    },
    orderBy,
  });

  const computedSortField = sortBy === 'pendingValue' ? 'pendingCents' : sortBy;
  return inMemorySort
    ? sortOrdersInMemory(orders, computedSortField, sortDir)
    : orders;
};

const getOrderById = async (client, { id, userId }) => {
  const order = await client.order.findFirst({
    where: { id, userId },
    include: {
      items: {
        include: {
          person: true,
          product: true,
        },
      },
      payments: {
        include: {
          person: true,
        },
      },
    },
  });

  if (!order) {
    throw notFound('Order not found');
  }

  return order;
};

const createOrder = async (client, { userId, payload }) => {
  return client.$transaction(async (tx) => {
    const isTeamOrder = payload.isTeamOrder ?? false;

    // The self person (the logged-in user) owns every non-team order; items
    // without an explicit person are bound to them when the self person
    // exists. Explicitly-provided persons (legacy data) are preserved so
    // records can be migrated gradually.
    const selfPerson = await tx.person.findFirst({
      where: { userId, isSelf: true },
    });
    const selfPersonId = selfPerson?.id ?? null;

    // Verify explicitly-provided persons exist and belong to the user. Team
    // orders and legacy non-team items reference real persons; new non-team
    // items are bound to the self person below, so they need no validation.
    const personIds = [
      ...new Set(payload.items.map((item) => item.personId).filter(Boolean)),
    ];
    if (personIds.length > 0) {
      const persons = await tx.person.findMany({
        where: { id: { in: personIds }, userId },
      });
      if (persons.length !== personIds.length) {
        throw badRequest('One or more persons not found');
      }
    }

    const items = resolveItemDefaults({
      items: payload.items,
      isTeamOrder,
      selfPersonId,
    });

    // Verify all products exist and are available (ATIVO or INDISPONIVEL)
    await validateProducts(tx, items);

    const selfIds = new Set(selfPersonId ? [selfPersonId] : []);
    if (!isTeamOrder) {
      validateStockItemRules(items, selfIds);
    }

    // Attach frozen kit snapshots and validate the stock mode for kit items.
    await resolveKitFields(tx, items);

    const personMap = new Map();
    if (selfPerson) personMap.set(selfPerson.id, selfPerson);

    // Calculate total value in integer cents, honoring price mode × quantity
    // plus the order-level shipping value. The doTERRA value always equals the
    // total (sum of products + shipping), so it is derived, not informed.
    const shippingCents = toCents(payload.shippingValue ?? 0);
    const totalCents = orderLineTotalCents(items) + shippingCents;
    const status = computeOrderStatus({
      items: items.map((item) => ({
        personId: item.personId,
        chargedValue: item.chargedValue,
        quantity: item.quantity,
        chargedValueMode: item.chargedValueMode,
        person: item.personId ? personMap.get(item.personId) : undefined,
      })),
      payments: [],
      shippingCents,
      isTeamOrder,
    });

    // Create order with items
    const order = await tx.order.create({
      data: {
        orderNumber: payload.orderNumber,
        totalValue: fromCents(totalCents).toFixed(2),
        shippingValue: fromCents(shippingCents).toFixed(2),
        orderDate: payload.orderDate
          ? parseLocalDate(payload.orderDate)
          : undefined,
        isTeamOrder,
        accountOwner: payload.accountOwner ?? null,
        paymentType: payload.paymentType ?? null,
        orderNotes: payload.orderNotes ?? null,
        doterraPv:
          payload.doterraPv != null
            ? fromCents(toCents(payload.doterraPv)).toFixed(2)
            : null,
        installments: payload.installments ?? null,
        firstInstallmentAt: payload.firstInstallmentAt
          ? parseLocalDate(payload.firstInstallmentAt)
          : null,
        doterraValue: fromCents(totalCents).toFixed(2),
        status,
        userId,
        items: {
          create: items.map(itemCreateData),
        },
      },
      include: {
        items: {
          include: {
            person: true,
            product: true,
          },
        },
      },
    });

    // Apply stock for self + forStock items (not for team orders)
    if (!isTeamOrder) {
      for (const movement of itemStockMovements(tx, {
        order,
        items: order.items,
      })) {
        await applyMovement(tx, movement);
      }
    }

    // Mirror the purchase order into the financial ledger (expense). Team
    // orders produce no transaction.
    await syncExpenseFromOrder(tx, { userId, order });

    return order;
  });
};

const updateOrder = async (client, { id, userId, payload }) => {
  return client.$transaction(async (tx) => {
    // Check if order exists and belongs to user
    const existingOrder = await tx.order.findFirst({
      where: { id, userId },
      include: { items: { include: { person: true } } },
    });

    if (!existingOrder) {
      throw notFound('Order not found');
    }

    assertNotSaleOrder(existingOrder);

    if (!payload.items) {
      const newShippingCents =
        payload.shippingValue !== undefined
          ? toCents(payload.shippingValue ?? 0)
          : toCents(existingOrder.shippingValue ?? 0);
      const newTotalCents =
        toCents(existingOrder.totalValue) -
        toCents(existingOrder.shippingValue ?? 0) +
        newShippingCents;

      const order = await tx.order.update({
        where: { id },
        data: {
          orderNumber: payload.orderNumber || existingOrder.orderNumber,
          ...(payload.orderDate && {
            orderDate: parseLocalDate(payload.orderDate),
          }),
          ...(payload.isTeamOrder !== undefined && {
            isTeamOrder: payload.isTeamOrder,
          }),
          ...(payload.accountOwner !== undefined && {
            accountOwner: payload.accountOwner,
          }),
          ...(payload.paymentType !== undefined && {
            paymentType: payload.paymentType,
          }),
          ...(payload.orderNotes !== undefined && {
            orderNotes: payload.orderNotes,
          }),
          ...(payload.doterraPv !== undefined && {
            doterraPv:
              payload.doterraPv != null
                ? fromCents(toCents(payload.doterraPv)).toFixed(2)
                : null,
          }),
          ...(payload.installments !== undefined && {
            installments: payload.installments,
          }),
          ...(payload.firstInstallmentAt !== undefined && {
            firstInstallmentAt: parseLocalDate(payload.firstInstallmentAt),
          }),
          ...(payload.paymentType !== undefined &&
            payload.paymentType !== 'CARTAO_CREDITO' && {
              installments: null,
              firstInstallmentAt: null,
            }),
          shippingValue: fromCents(newShippingCents).toFixed(2),
          totalValue: fromCents(newTotalCents).toFixed(2),
          doterraValue: fromCents(newTotalCents).toFixed(2),
        },
        include: {
          items: {
            include: {
              person: true,
              product: true,
            },
          },
        },
      });

      if (
        payload.shippingValue !== undefined ||
        payload.isTeamOrder !== undefined
      ) {
        const { status } = await syncOrderStatus(tx, {
          orderId: id,
          items: order.items,
          shippingCents: newShippingCents,
          isTeamOrder: order.isTeamOrder,
        });
        order.status = status;
      }

      // Re-sync the ledger row (amount/date, or remove it when the order became
      // a team order) inside the same transaction.
      await syncExpenseFromOrder(tx, { userId, order });

      return order;
    }

    const isTeamOrder =
      payload.isTeamOrder ?? existingOrder.isTeamOrder ?? false;

    // The self person owns every non-team order; items without an explicit
    // person (new items added from the UI) are bound to them when the self
    // person exists. Explicitly-provided persons (legacy data) are preserved.
    const selfPerson = await tx.person.findFirst({
      where: { userId, isSelf: true },
    });
    const selfPersonId = selfPerson?.id ?? null;

    // Verify explicitly-provided persons exist and belong to the user. Team
    // orders and legacy non-team items reference real persons; new non-team
    // items are bound to the self person below, so they need no validation.
    const personIds = [
      ...new Set(payload.items.map((item) => item.personId).filter(Boolean)),
    ];
    if (personIds.length > 0) {
      const persons = await tx.person.findMany({
        where: { id: { in: personIds }, userId },
      });
      if (persons.length !== personIds.length) {
        throw badRequest('One or more persons not found');
      }
    }

    const resolvedPayloadItems = resolveItemDefaults({
      items: payload.items,
      isTeamOrder,
      selfPersonId,
    });

    // Verify all products exist and are available (ATIVO or INDISPONIVEL)
    await validateProducts(tx, resolvedPayloadItems);

    // Self ids from old items (their persons) and the resolved self person,
    // so the stock diff handles person reassignment correctly.
    const selfIds = new Set();
    if (selfPersonId) selfIds.add(selfPersonId);
    for (const person of existingOrder.items
      .map((it) => it.person)
      .filter(Boolean)) {
      if (person.isSelf) selfIds.add(person.id);
    }

    validateStockItemRules(resolvedPayloadItems, selfIds);

    const shippingCents = toCents(
      payload.shippingValue ?? existingOrder.shippingValue ?? 0,
    );
    const totalCents =
      orderLineTotalCents(resolvedPayloadItems) + shippingCents;

    // Resolve kit fields (preserving frozen snapshots for unchanged items),
    // then compute the stock diff between old and new items (skipped for
    // team orders, which never affect the user's stock).
    const resolvedItems = await resolveOrderUpdateItems(
      tx,
      existingOrder.items,
      resolvedPayloadItems,
    );
    if (!isTeamOrder) {
      const diff = computeStockDiff(
        existingOrder.items,
        resolvedItems,
        selfIds,
      );
      const effectiveOrderDate = payload.orderDate
        ? parseLocalDate(payload.orderDate)
        : existingOrder.orderDate;
      if (!effectiveOrderDate) {
        throw badRequest(
          'Data do pedido é obrigatória para movimentações de estoque',
        );
      }
      for (const { productId, delta } of diff) {
        if (delta > 0) {
          await applyMovement(tx, {
            userId,
            productId,
            type: 'ENTRADA',
            quantity: delta,
            reason: `Pedido ${payload.orderNumber || existingOrder.orderNumber}`,
            orderId: existingOrder.id,
            effectiveDate: effectiveOrderDate,
          });
        } else {
          await applyMovement(tx, {
            userId,
            productId,
            type: 'SAIDA',
            quantity: -delta,
            reason: `Pedido ${payload.orderNumber || existingOrder.orderNumber}`,
            orderId: existingOrder.id,
            effectiveDate: effectiveOrderDate,
          });
        }
      }
    }

    await tx.order.update({
      where: { id },
      data: {
        orderNumber: payload.orderNumber || existingOrder.orderNumber,
        totalValue: fromCents(totalCents).toFixed(2),
        shippingValue: fromCents(shippingCents).toFixed(2),
        doterraValue: fromCents(totalCents).toFixed(2),
        orderDate: payload.orderDate
          ? parseLocalDate(payload.orderDate)
          : undefined,
        isTeamOrder,
        ...(payload.accountOwner !== undefined && {
          accountOwner: payload.accountOwner,
        }),
        ...(payload.paymentType !== undefined && {
          paymentType: payload.paymentType,
        }),
        ...(payload.orderNotes !== undefined && {
          orderNotes: payload.orderNotes,
        }),
        ...(payload.doterraPv !== undefined && {
          doterraPv:
            payload.doterraPv != null
              ? fromCents(toCents(payload.doterraPv)).toFixed(2)
              : null,
        }),
        ...(payload.installments !== undefined && {
          installments: payload.installments,
        }),
        ...(payload.firstInstallmentAt !== undefined && {
          firstInstallmentAt: parseLocalDate(payload.firstInstallmentAt),
        }),
        ...(payload.paymentType !== undefined &&
          payload.paymentType !== 'CARTAO_CREDITO' && {
            installments: null,
            firstInstallmentAt: null,
          }),
      },
    });

    // Sync items by id: update kept items (preserving their frozen kit
    // snapshots), create new ones, and delete removed ones.
    const keptIds = new Set();
    for (const newItem of resolvedItems) {
      const fields = {
        description: newItem.description ?? null,
        chargedValue: newItem.chargedValue,
        personId: newItem.personId,
        productId: newItem.productId ?? null,
        memberPrice: newItem.memberPrice ?? null,
        details: newItem.details ?? null,
        quantity: newItem.quantity ?? 1,
        forStock: newItem.forStock ?? false,
        useCashback: newItem.useCashback ?? false,
        chargedValueMode: newItem.chargedValueMode ?? 'UNIT',
        kitStockMode: newItem.kitStockMode ?? null,
        ...(newItem.kitSnapshot !== undefined
          ? { kitSnapshot: newItem.kitSnapshot ?? null }
          : {}),
      };
      if (newItem.__existingId) {
        keptIds.add(newItem.__existingId);
        await tx.item.update({
          where: { id: newItem.__existingId },
          data: fields,
        });
      } else {
        await tx.item.create({ data: { ...fields, orderId: id } });
      }
    }
    for (const oldItem of existingOrder.items) {
      if (!keptIds.has(oldItem.id)) {
        await tx.item.delete({ where: { id: oldItem.id } });
      }
    }

    const order = await tx.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            person: true,
            product: true,
          },
        },
      },
    });

    // Recompute status considering the replaced items and existing payments
    const { status } = await syncOrderStatus(tx, {
      orderId: id,
      items: order.items,
      shippingCents,
      isTeamOrder,
    });
    order.status = status;

    await syncExpenseFromOrder(tx, { userId, order });

    return order;
  });
};

const deleteOrder = async (client, { id, userId }) => {
  let attachmentFilename = null;
  const result = await client.$transaction(async (tx) => {
    // Check if order exists and belongs to user
    const existingOrder = await tx.order.findFirst({
      where: { id, userId },
      include: { items: { include: { person: true } } },
    });

    if (!existingOrder) {
      throw notFound('Order not found');
    }

    assertNotSaleOrder(existingOrder);

    attachmentFilename = existingOrder.attachmentFilename;

    // Reverse stock for every self + forStock item before deleting, expanding
    // kit items into their effective stock products. Team orders never
    // affected the user's stock, so nothing is reversed.
    if (!existingOrder.isTeamOrder) {
      if (!existingOrder.orderDate) {
        throw badRequest(
          'Data do pedido é obrigatória para movimentações de estoque',
        );
      }
      await reverseOrderStock(tx, {
        order: existingOrder,
        items: existingOrder.items,
      });
    }

    await removeBillForOrder(tx, { userId, orderId: id });

    await tx.order.delete({ where: { id } });
    return { message: 'Order deleted successfully' };
  });

  return { message: result.message, attachmentFilename };
};

const addItemToOrder = async (client, { orderId, userId, payload }) => {
  return client.$transaction(async (tx) => {
    // Check if order exists and belongs to user
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw notFound('Order not found');
    }

    assertNotSaleOrder(order);

    if (!order.orderDate) {
      throw badRequest(
        'Data do pedido é obrigatória para movimentações de estoque',
      );
    }

    const isTeamOrder = order.isTeamOrder;

    // The self person owns non-team orders; a new item is bound to them unless
    // an explicit person is provided. Team orders require the team member who
    // placed the order.
    const selfPerson = await tx.person.findFirst({
      where: { userId, isSelf: true },
    });
    const selfPersonId = selfPerson?.id ?? null;
    const [resolved] = resolveItemDefaults({
      items: [payload],
      isTeamOrder,
      selfPersonId,
    });

    if (!resolved.personId) {
      throw badRequest('Person is required');
    }
    const person = await tx.person.findFirst({
      where: { id: resolved.personId, userId },
    });
    if (!person) {
      throw badRequest('Person not found');
    }

    // Verify product exists and is available (when provided)
    await validateProducts(tx, [resolved]);

    validateStockItemRules(
      [resolved],
      new Set(selfPersonId ? [selfPersonId] : []),
    );

    // Attach the frozen kit snapshot and validate the stock mode for kit items.
    await resolveKitFields(tx, [resolved]);

    const newTotalCents =
      orderLineTotalCents([
        ...(await tx.item.findMany({ where: { orderId } })),
        resolved,
      ]) + toCents(order.shippingValue ?? 0);

    // Add item to order
    const item = await tx.item.create({
      data: {
        ...itemCreateData(resolved),
        orderId,
      },
      include: {
        person: true,
        product: true,
      },
    });

    // Update order total value (exact cents). The doTERRA value always equals
    // the total (sum of products + shipping), so it is derived, not informed.
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        totalValue: fromCents(newTotalCents).toFixed(2),
        doterraValue: fromCents(newTotalCents).toFixed(2),
      },
      include: {
        items: {
          include: {
            person: true,
            product: true,
          },
        },
      },
    });

    // Apply stock if the item belongs to the self person, expanding kit
    // items into their effective stock products. Team orders never affect
    // the user's stock.
    if (person.isSelf && !order.isTeamOrder) {
      for (const movement of itemStockMovements(tx, {
        order,
        items: [item],
      })) {
        await applyMovement(tx, movement);
      }
    }

    // Recompute order status after adding the item
    const { status } = await syncOrderStatus(tx, {
      orderId,
      items: updatedOrder.items,
      shippingCents: toCents(order.shippingValue ?? 0),
      isTeamOrder: order.isTeamOrder,
    });
    updatedOrder.status = status;

    await syncExpenseFromOrder(tx, { userId, order: updatedOrder });

    return item;
  });
};

const updateItem = async (client, { id: itemId, userId, payload }) => {
  return client.$transaction(async (tx) => {
    // Check if item exists and belongs to user's order
    const existingItem = await tx.item.findUnique({
      where: { id: itemId },
      include: {
        order: true,
        person: true,
      },
    });

    if (!existingItem) {
      throw notFound('Item not found');
    }

    if (existingItem.order.userId !== userId) {
      throw notFound('Item not found');
    }

    assertNotSaleOrder(existingItem.order);

    const newData = { ...existingItem, ...payload };

    // If updating personId, verify person exists and belongs to user
    let newPerson = existingItem.person;
    if (payload.personId) {
      const person = await tx.person.findFirst({
        where: { id: payload.personId, userId },
      });
      if (!person) {
        throw badRequest('Person not found');
      }
      newPerson = person;
    }

    // If updating productId (non-null), verify product exists and is available
    if (payload.productId) {
      await validateProducts(tx, [payload]);
    }

    const selfIds = new Set(
      [existingItem.person, newPerson]
        .filter(Boolean)
        .filter((p) => p.isSelf)
        .map((p) => p.id),
    );
    validateStockItemRules([newData], selfIds);

    // Preserve the frozen snapshot when the product is unchanged; refresh it
    // when the product changes to a different kit.
    await resolveEditedKitFields(tx, existingItem, newData);

    // Compute stock diff between the old and new item state, expanding kit
    // items into their effective stock products. Team orders never affect
    // the user's stock.
    if (!existingItem.order.isTeamOrder) {
      const diff = computeStockDiff([existingItem], [newData], selfIds);

      for (const { productId, delta } of diff) {
        if (delta > 0) {
          await applyMovement(tx, {
            userId,
            productId,
            type: 'ENTRADA',
            quantity: delta,
            reason: `Pedido ${existingItem.order.orderNumber}`,
            orderId: existingItem.orderId,
            itemId,
            effectiveDate: existingItem.order.orderDate,
          });
        } else {
          await applyMovement(tx, {
            userId,
            productId,
            type: 'SAIDA',
            quantity: -delta,
            reason: `Pedido ${existingItem.order.orderNumber}`,
            orderId: existingItem.orderId,
            itemId,
            effectiveDate: existingItem.order.orderDate,
          });
        }
      }
    }

    // Update item (drop helper fields)
    const { person: _person, order: _order, ...itemData } = newData;
    const item = await tx.item.update({
      where: { id: itemId },
      data: {
        description: itemData.description ?? null,
        chargedValue: itemData.chargedValue,
        personId: itemData.personId,
        productId: itemData.productId ?? null,
        memberPrice: itemData.memberPrice ?? null,
        details: itemData.details ?? null,
        quantity: itemData.quantity ?? 1,
        forStock: itemData.forStock ?? false,
        useCashback: itemData.useCashback ?? false,
        chargedValueMode: itemData.chargedValueMode ?? 'UNIT',
        kitStockMode: itemData.kitStockMode ?? null,
        ...(itemData.kitSnapshot !== undefined
          ? { kitSnapshot: itemData.kitSnapshot ?? null }
          : {}),
      },
      include: {
        person: true,
        product: true,
      },
    });

    // Update order total value (exact cents) when line value changed. The
    // doTERRA value always equals the total, so it follows the same change.
    const oldLineCents = lineValueCents(existingItem);
    const newLineCents = lineValueCents(newData);
    if (oldLineCents !== newLineCents) {
      const currentOrder = await tx.order.findUnique({
        where: { id: existingItem.orderId },
      });
      const newTotalCents =
        toCents(currentOrder.totalValue) - oldLineCents + newLineCents;
      await tx.order.update({
        where: { id: existingItem.orderId },
        data: {
          totalValue: fromCents(newTotalCents).toFixed(2),
          doterraValue: fromCents(newTotalCents).toFixed(2),
        },
      });
    }

    // Recompute order status after the item change
    const orderItems = await tx.item.findMany({
      where: { orderId: existingItem.orderId },
      include: { person: true },
    });
    await syncOrderStatus(tx, {
      orderId: existingItem.orderId,
      items: orderItems,
      shippingCents: toCents(existingItem.order.shippingValue ?? 0),
      isTeamOrder: existingItem.order.isTeamOrder,
    });

    const syncedOrder = await tx.order.findUnique({
      where: { id: existingItem.orderId },
    });
    await syncExpenseFromOrder(tx, { userId, order: syncedOrder });

    return item;
  });
};

const deleteItem = async (client, { id: itemId, userId }) => {
  return client.$transaction(async (tx) => {
    // Check if item exists and belongs to user's order
    const existingItem = await tx.item.findUnique({
      where: { id: itemId },
      include: {
        order: true,
        person: true,
      },
    });

    if (!existingItem) {
      throw notFound('Item not found');
    }

    if (existingItem.order.userId !== userId) {
      throw notFound('Item not found');
    }

    assertNotSaleOrder(existingItem.order);

    // Reverse stock if the item belonged to the self person, expanding kit
    // items into their effective stock products. Team orders never affected
    // the user's stock, so nothing is reversed.
    if (
      existingItem.person &&
      existingItem.person.isSelf &&
      !existingItem.order.isTeamOrder
    ) {
      await reverseItemStock(tx, {
        order: existingItem.order,
        item: existingItem,
      });
    }

    // Delete item
    await tx.item.delete({ where: { id: itemId } });

    // Update order total value (exact cents)
    const remainingItems = await tx.item.findMany({
      where: { orderId: existingItem.orderId },
    });
    const newTotalCents =
      orderLineTotalCents(remainingItems) +
      toCents(existingItem.order.shippingValue ?? 0);
    await tx.order.update({
      where: { id: existingItem.orderId },
      data: {
        totalValue: fromCents(newTotalCents).toFixed(2),
        doterraValue: fromCents(newTotalCents).toFixed(2),
      },
    });

    // Recompute order status after removing the item
    const orderItems = await tx.item.findMany({
      where: { orderId: existingItem.orderId },
      include: { person: true },
    });
    await syncOrderStatus(tx, {
      orderId: existingItem.orderId,
      items: orderItems,
      shippingCents: toCents(existingItem.order.shippingValue ?? 0),
      isTeamOrder: existingItem.order.isTeamOrder,
    });

    const syncedOrder = await tx.order.findUnique({
      where: { id: existingItem.orderId },
    });
    await syncExpenseFromOrder(tx, { userId, order: syncedOrder });

    return { message: 'Item deleted successfully' };
  });
};

export {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  addItemToOrder,
  updateItem,
  deleteItem,
};

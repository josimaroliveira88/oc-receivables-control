// Sale (VENDA) order write/read operations, extracted from the sales
// controller so the handlers stay thin. `client` is a Prisma client; each
// write function owns its own `$transaction`. Business rejections are thrown
// as HTTP-mapped errors (via utils/httpError.js) which the controller maps to
// the HTTP response.
import { computeOrderStatus } from '../utils/receivables.js';
import { lineValueCents, fromCents, toCents } from '../utils/money.js';
import { applyMovement } from './stockService.js';
import { computeSaleStockDiff } from '../utils/stockDiff.js';
import {
  resolveKitSnapshot,
  expandSaleItemToStockProducts,
} from '../utils/kitStock.js';
import { findIdsByTextSearch } from '../utils/search.js';
import { parseLocalDate } from '../utils/date.js';
import {
  validateSaleProducts,
  SALES_SORTABLE_FIELDS,
  sortSalesInMemory,
} from '../utils/salesHelpers.js';
import { badRequest, notFound } from '../utils/httpError.js';

const saleLineTotalCents = (items) =>
  items.reduce((sum, item) => sum + lineValueCents(item), 0);

const saleItemCreateData = (item) => ({
  description: item.description || null,
  chargedValue: item.chargedValue,
  personId: item.personId,
  productId: item.productId,
  memberPrice: item.memberPrice ?? null,
  details: item.details || null,
  quantity: item.quantity ?? 1,
  forStock: false,
  chargedValueMode: item.chargedValueMode ?? 'UNIT',
  kitStockMode: item.kitStockMode ?? null,
  ...(item.kitSnapshot !== undefined
    ? { kitSnapshot: item.kitSnapshot ?? null }
    : {}),
});

const saleItemUpdateData = (item) => ({
  description: item.description ?? null,
  chargedValue: item.chargedValue,
  personId: item.personId,
  productId: item.productId,
  memberPrice: item.memberPrice ?? null,
  details: item.details || null,
  quantity: item.quantity ?? 1,
  forStock: false,
  chargedValueMode: item.chargedValueMode ?? 'UNIT',
  kitStockMode: item.kitStockMode ?? null,
  ...(item.kitSnapshot !== undefined
    ? { kitSnapshot: item.kitSnapshot ?? null }
    : {}),
});

// Atomically increments the per-user sale counter and formats the number
// (V-0001, V-0002, ...). Retries on the rare concurrent-create unique race.
// `client` is either the Prisma client or a transaction client (`tx`).
const nextSaleNumber = async (client, userId) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const counter = await client.saleCounter.upsert({
        where: { userId },
        create: { userId, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      return `V-${String(counter.lastNumber).padStart(4, '0')}`;
    } catch (error) {
      if (error.code === 'P2002' && attempt < 2) continue;
      throw error;
    }
  }
  throw badRequest('Não foi possível gerar o número da venda');
};

// Sale items always affect stock, so KIT products require a kitStockMode and
// the current composition is frozen into `kitSnapshot` at creation time.
const resolveSaleKitFields = async (client, items) => {
  const productIds = [
    ...new Set(items.map((item) => item.productId).filter(Boolean)),
  ];
  const products =
    productIds.length === 0
      ? []
      : await client.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, productType: true },
        });
  const typeById = new Map(products.map((p) => [p.id, p.productType]));

  for (const item of items) {
    const type = item.productId ? typeById.get(item.productId) : null;
    if (type === 'KIT') {
      if (!item.kitStockMode) {
        throw badRequest(
          'Itens de venda para produtos KIT exigem um kitStockMode (KIT ou COMPONENTS)',
        );
      }
      item.kitSnapshot = await resolveKitSnapshot(client, item.productId);
    } else {
      item.kitStockMode = null;
      item.kitSnapshot = null;
    }
  }
};

// Resolves kit fields during a bulk sale update, preserving the frozen
// snapshot of unchanged kit items (matched by id) so kit composition changes
// never affect stock control of already-registered sales.
const resolveSaleUpdateItems = async (client, existingItems, payloadItems) => {
  const oldById = new Map(existingItems.map((it) => [it.id, it]));
  const resolved = [];
  for (const item of payloadItems) {
    const existing = item.id ? oldById.get(item.id) : null;
    const productChanged =
      !existing || existing.productId !== (item.productId ?? null);
    if (productChanged) {
      await resolveSaleKitFields(client, [item]);
      resolved.push({ ...item, __existingId: existing ? existing.id : null });
      continue;
    }
    const type = item.productId
      ? (
          await client.product.findUnique({
            where: { id: item.productId },
            select: { productType: true },
          })
        )?.productType
      : null;
    if (type === 'KIT') {
      if (!item.kitStockMode && !existing.kitStockMode) {
        throw badRequest(
          'Itens de venda para produtos KIT exigem um kitStockMode (KIT ou COMPONENTS)',
        );
      }
      item.kitStockMode = item.kitStockMode ?? existing.kitStockMode ?? null;
      item.kitSnapshot = existing.kitSnapshot ?? null;
    } else {
      item.kitStockMode = null;
      item.kitSnapshot = null;
    }
    resolved.push({ ...item, __existingId: existing.id });
  }
  return resolved;
};

const getSales = async (client, { userId, query }) => {
  const { q, searchField, status, delivered, sortBy, sortDir } = query;

  const where = { userId, orderType: 'VENDA' };

  if (q && q.trim()) {
    const field = searchField || 'all';
    const orderIds = new Set();
    if (field === 'all' || field === 'orderNumber') {
      const ids = await findIdsByTextSearch({
        table: 'Order',
        columns: ['orderNumber'],
        q,
      });
      if (ids) ids.forEach((id) => orderIds.add(id));
    }
    if (field === 'all' || field === 'description') {
      const ids = await findIdsByTextSearch({
        table: 'Order',
        columns: ['orderNotes'],
        q,
      });
      if (ids) ids.forEach((id) => orderIds.add(id));
    }
    if (field === 'all' || field === 'client') {
      const ids = await findIdsByTextSearch({
        table: 'Person',
        columns: ['name'],
        q,
      });
      if (ids && ids.length) {
        const items = await client.item.findMany({
          where: {
            personId: { in: ids },
            order: { userId, orderType: 'VENDA' },
          },
          select: { orderId: true },
          distinct: ['orderId'],
        });
        items.forEach((i) => orderIds.add(i.orderId));
      }
    }
    if (orderIds.size === 0) return [];
    where.id = { in: [...orderIds] };
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

  if (delivered === 'true') where.deliveredAt = { not: null };
  else if (delivered === 'false') where.deliveredAt = null;

  const COMPUTED_SORT_FIELDS = ['pendingValue', 'clientName'];
  const inMemorySort = COMPUTED_SORT_FIELDS.includes(sortBy);

  const direction = sortDir === 'desc' ? 'desc' : 'asc';
  let orderBy = [{ orderDate: 'desc' }, { createdAt: 'desc' }];
  if (!inMemorySort && SALES_SORTABLE_FIELDS.includes(sortBy)) {
    orderBy = [{ [sortBy]: direction }];
  }

  const sales = await client.order.findMany({
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

  return inMemorySort ? sortSalesInMemory(sales, sortBy, sortDir) : sales;
};

const getSaleById = async (client, { id, userId }) => {
  const sale = await client.order.findFirst({
    where: { id, userId, orderType: 'VENDA' },
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

  if (!sale) {
    throw notFound('Sale order not found');
  }

  return sale;
};

const createSale = async (client, { userId, payload }) => {
  return client.$transaction(async (tx) => {
    const clientPerson = await tx.person.findFirst({
      where: { id: payload.clientPersonId, userId },
    });
    if (!clientPerson) throw badRequest('Cliente não encontrado');
    if (clientPerson.isSelf) {
      throw badRequest(
        'O cliente do pedido de venda não pode ser o próprio usuário',
      );
    }

    const items = payload.items.map((item) => ({
      ...item,
      personId: clientPerson.id,
    }));
    await validateSaleProducts(tx, items);
    await resolveSaleKitFields(tx, items);

    const shippingCents = toCents(payload.shippingValue ?? 0);
    const additionalCents = toCents(payload.additionalValue ?? 0);
    const totalCents =
      saleLineTotalCents(items) + shippingCents + additionalCents;
    const orderNumber = await nextSaleNumber(tx, userId);

    const status = computeOrderStatus({
      items: items.map((item) => ({
        personId: item.personId,
        chargedValue: item.chargedValue,
        quantity: item.quantity,
        chargedValueMode: item.chargedValueMode,
        person: clientPerson,
      })),
      payments: [],
      shippingCents,
      additionalCents,
    });

    const order = await tx.order.create({
      data: {
        orderNumber,
        orderType: 'VENDA',
        totalValue: fromCents(totalCents).toFixed(2),
        shippingValue: fromCents(shippingCents).toFixed(2),
        additionalValue: fromCents(additionalCents).toFixed(2),
        orderDate: payload.orderDate
          ? parseLocalDate(payload.orderDate)
          : undefined,
        deliveredAt: payload.deliveredAt
          ? parseLocalDate(payload.deliveredAt)
          : null,
        orderNotes: payload.description ?? null,
        status,
        userId,
        items: {
          create: items.map(saleItemCreateData),
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

    if (!order.orderDate) {
      throw badRequest(
        'Data do pedido é obrigatória para movimentações de estoque',
      );
    }
    // Every sale item deducts stock (SAIDA), expanding kit items into their
    // effective stock products.
    for (const item of order.items) {
      for (const { productId, quantity } of expandSaleItemToStockProducts(
        item,
      )) {
        await applyMovement(tx, {
          userId,
          productId,
          type: 'SAIDA',
          quantity,
          reason: `Venda ${orderNumber}`,
          orderId: order.id,
          itemId: item.id,
          effectiveDate: order.orderDate,
        });
      }
    }

    return order;
  });
};

const updateSale = async (client, { id, userId, payload }) => {
  return client.$transaction(async (tx) => {
    const existingOrder = await tx.order.findFirst({
      where: { id, userId },
      include: { items: { include: { person: true } } },
    });

    if (!existingOrder) {
      throw notFound('Sale order not found');
    }
    if (existingOrder.orderType !== 'VENDA') {
      throw badRequest(
        'Este é um pedido de compra; use os endpoints de pedidos (/api/orders)',
      );
    }

    if (!payload.items) {
      if (payload.clientPersonId) {
        const candidate = await tx.person.findFirst({
          where: { id: payload.clientPersonId, userId },
        });
        if (!candidate) throw badRequest('Cliente não encontrado');
        if (candidate.isSelf) {
          throw badRequest(
            'O cliente do pedido de venda não pode ser o próprio usuário',
          );
        }
      }

      const shippingChanged = payload.shippingValue !== undefined;
      const additionalChanged = payload.additionalValue !== undefined;
      const orderData = {
        ...(payload.orderDate && {
          orderDate: parseLocalDate(payload.orderDate),
        }),
        ...(payload.deliveredAt !== undefined && {
          deliveredAt: payload.deliveredAt
            ? parseLocalDate(payload.deliveredAt)
            : null,
        }),
        ...(payload.description !== undefined && {
          orderNotes: payload.description,
        }),
      };
      if (shippingChanged || additionalChanged) {
        const newShipping =
          payload.shippingValue ?? existingOrder.shippingValue ?? 0;
        const newAdditional =
          payload.additionalValue ?? existingOrder.additionalValue ?? 0;
        orderData.shippingValue = fromCents(toCents(newShipping)).toFixed(2);
        orderData.additionalValue = fromCents(toCents(newAdditional)).toFixed(
          2,
        );
        orderData.totalValue = fromCents(
          toCents(existingOrder.totalValue) -
            toCents(existingOrder.shippingValue ?? 0) -
            toCents(existingOrder.additionalValue ?? 0) +
            toCents(newShipping) +
            toCents(newAdditional),
        ).toFixed(2);
      }

      const order = await tx.order.update({
        where: { id },
        data: orderData,
        include: {
          items: {
            include: {
              person: true,
              product: true,
            },
          },
        },
      });

      if (shippingChanged || additionalChanged) {
        const payments = await tx.payment.findMany({ where: { orderId: id } });
        const newStatus = computeOrderStatus({
          items: order.items,
          payments,
          shippingCents: toCents(order.shippingValue ?? 0),
          additionalCents: toCents(order.additionalValue ?? 0),
        });
        if (newStatus !== order.status) {
          await tx.order.update({ where: { id }, data: { status: newStatus } });
          order.status = newStatus;
        }
      }

      return order;
    }

    let clientPerson = existingOrder.items[0]?.person ?? null;
    if (payload.clientPersonId) {
      clientPerson = await tx.person.findFirst({
        where: { id: payload.clientPersonId, userId },
      });
      if (!clientPerson) throw badRequest('Cliente não encontrado');
      if (clientPerson.isSelf) {
        throw badRequest(
          'O cliente do pedido de venda não pode ser o próprio usuário',
        );
      }
    }

    const items = payload.items.map((item) => ({
      ...item,
      personId: clientPerson.id,
    }));
    await validateSaleProducts(tx, items);
    const resolvedItems = await resolveSaleUpdateItems(
      tx,
      existingOrder.items,
      items,
    );

    const shippingCents = toCents(
      payload.shippingValue ?? existingOrder.shippingValue ?? 0,
    );
    const additionalCents = toCents(
      payload.additionalValue ?? existingOrder.additionalValue ?? 0,
    );
    const totalCents =
      saleLineTotalCents(resolvedItems) + shippingCents + additionalCents;

    const effectiveOrderDate = payload.orderDate
      ? parseLocalDate(payload.orderDate)
      : existingOrder.orderDate;
    if (!effectiveOrderDate) {
      throw badRequest(
        'Data do pedido é obrigatória para movimentações de estoque',
      );
    }

    // Stock diff: increasing the sold quantity deducts more (SAIDA), reducing
    // it restores stock (ENTRADA).
    const diff = computeSaleStockDiff(existingOrder.items, resolvedItems);
    for (const { productId, delta } of diff) {
      await applyMovement(tx, {
        userId,
        productId,
        type: delta > 0 ? 'SAIDA' : 'ENTRADA',
        quantity: Math.abs(delta),
        reason: `Venda ${existingOrder.orderNumber}`,
        orderId: existingOrder.id,
        effectiveDate: effectiveOrderDate,
      });
    }

    await tx.order.update({
      where: { id },
      data: {
        orderNumber: existingOrder.orderNumber,
        totalValue: fromCents(totalCents).toFixed(2),
        shippingValue: fromCents(shippingCents).toFixed(2),
        additionalValue: fromCents(additionalCents).toFixed(2),
        orderDate: payload.orderDate
          ? parseLocalDate(payload.orderDate)
          : undefined,
        deliveredAt:
          payload.deliveredAt !== undefined
            ? payload.deliveredAt
              ? parseLocalDate(payload.deliveredAt)
              : null
            : undefined,
        ...(payload.description !== undefined && {
          orderNotes: payload.description,
        }),
      },
    });

    // Sync items by id: update kept items (preserving frozen kit snapshots),
    // create new ones, and delete removed ones.
    const keptIds = new Set();
    for (const newItem of resolvedItems) {
      const fields = saleItemUpdateData(newItem);
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

    const payments = await tx.payment.findMany({ where: { orderId: id } });
    const newStatus = computeOrderStatus({
      items: order.items,
      payments,
      shippingCents: toCents(order.shippingValue ?? 0),
      additionalCents: toCents(order.additionalValue ?? 0),
    });
    if (newStatus !== order.status) {
      const updated = await tx.order.update({
        where: { id },
        data: { status: newStatus },
      });
      order.status = updated.status;
    }

    return order;
  });
};

const deleteSale = async (client, { id, userId }) => {
  return client.$transaction(async (tx) => {
    const existingOrder = await tx.order.findFirst({
      where: { id, userId },
      include: { items: { include: { person: true } } },
    });

    if (!existingOrder) {
      throw notFound('Sale order not found');
    }
    if (existingOrder.orderType !== 'VENDA') {
      throw badRequest(
        'Este é um pedido de compra; use os endpoints de pedidos (/api/orders)',
      );
    }

    if (!existingOrder.orderDate) {
      throw badRequest(
        'Data do pedido é obrigatória para movimentações de estoque',
      );
    }

    // Reverse the sale: restore stock (ENTRADA) for every item sold.
    for (const item of existingOrder.items) {
      for (const { productId, quantity } of expandSaleItemToStockProducts(
        item,
      )) {
        await applyMovement(tx, {
          userId,
          productId,
          type: 'ENTRADA',
          quantity,
          reason: `Venda ${existingOrder.orderNumber}`,
          orderId: existingOrder.id,
          effectiveDate: existingOrder.orderDate,
        });
      }
    }

    await tx.order.delete({ where: { id } });
    return { message: 'Sale order deleted successfully' };
  });
};

export {
  nextSaleNumber,
  resolveSaleKitFields,
  resolveSaleUpdateItems,
  getSales,
  getSaleById,
  createSale,
  updateSale,
  deleteSale,
};

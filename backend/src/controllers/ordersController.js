const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();
const {
  computeOrderStatus,
  syncOrderStatuses,
} = require('../utils/receivables');
const { lineValueCents, fromCents, toCents } = require('../utils/money');
const { applyMovement } = require('../services/stockService');
const { computeStockDiff } = require('../utils/stockDiff');
const {
  resolveKitSnapshot,
  expandItemToStockProducts,
} = require('../utils/kitStock');
const { findIdsByTextSearch } = require('../utils/search');
const { parseLocalDate } = require('../utils/date');
const { removeAttachmentFile } = require('./orderAttachmentsController');
const { paymentTypeSchema } = require('../utils/paymentTypes');

const itemSchema = z.object({
  id: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  chargedValue: z
    .number()
    .min(0, 'Charged value must not be negative')
    .default(0),
  personId: z.string().uuid('Person ID must be a valid UUID'),
  productId: z
    .string()
    .uuid('Product ID must be a valid UUID')
    .optional()
    .nullable(),
  memberPrice: z
    .number()
    .nonnegative('Member price must not be negative')
    .optional()
    .nullable(),
  details: z
    .string()
    .max(500, 'Details must be at most 500 characters')
    .optional()
    .nullable(),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be greater than zero')
    .default(1),
  forStock: z.boolean().default(false),
  chargedValueMode: z.enum(['UNIT', 'TOTAL']).default('UNIT'),
  kitStockMode: z.enum(['KIT', 'COMPONENTS']).optional().nullable(),
});

const orderDescriptiveSchema = {
  isTeamOrder: z.boolean().optional(),
  accountOwner: z
    .string()
    .max(120, 'Account owner must be at most 120 characters')
    .optional()
    .nullable(),
  paymentType: paymentTypeSchema.optional().nullable(),
  orderNotes: z
    .string()
    .max(500, 'Order notes must be at most 500 characters')
    .optional()
    .nullable(),
  doterraPv: z
    .number()
    .nonnegative('PV doTERRA must not be negative')
    .optional()
    .nullable(),
  doterraValue: z
    .number()
    .nonnegative('Valor doTERRA must not be negative')
    .optional()
    .nullable(),
};

const createOrderSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required'),
  orderDate: z.string().optional(),
  shippingValue: z
    .number()
    .min(0, 'Shipping value must not be negative')
    .optional()
    .nullable()
    .default(0),
  ...orderDescriptiveSchema,
  items: z.array(itemSchema).min(1, 'At least one item is required'),
});

const updateOrderSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required').optional(),
  orderDate: z.string().optional(),
  shippingValue: z
    .number()
    .min(0, 'Shipping value must not be negative')
    .optional()
    .nullable(),
  ...orderDescriptiveSchema,
  items: z.array(itemSchema).min(1, 'At least one item is required').optional(),
});

// Verify all products exist and are available (ATIVO or INDISPONIVEL; INATIVO is rejected)
const validateProducts = async (client, items) => {
  const productIds = [
    ...new Set(items.map((item) => item.productId).filter(Boolean)),
  ];
  if (productIds.length === 0) return;

  const products = await client.product.findMany({
    where: {
      id: { in: productIds },
      status: { in: ['ATIVO', 'INDISPONIVEL'] },
    },
  });

  if (products.length !== productIds.length) {
    const error = new Error(
      'One or more products are inactive or do not exist',
    );
    error.status = 400;
    throw error;
  }
};

// Items flagged `forStock` are only meaningful for the self person and must
// reference a catalog product (stock is tracked per product).
const validateStockItemRules = (items, selfPersonIds) => {
  for (const item of items) {
    if (!item.forStock) continue;
    if (!selfPersonIds.has(item.personId)) {
      const error = new Error(
        'Stock items are only allowed for the user themselves',
      );
      error.status = 400;
      throw error;
    }
    if (!item.productId) {
      const error = new Error('Stock items require a catalog product');
      error.status = 400;
      throw error;
    }
  }
};

const selfPersonIdSet = (persons) =>
  new Set(persons.filter((p) => p.isSelf).map((p) => p.id));

// Purchase-order endpoints must reject sale orders so their inverted stock
// semantics are never accidentally triggered through the /api/orders routes.
const assertNotSaleOrder = (order) => {
  if (order.orderType === 'VENDA') {
    const error = new Error(
      'Este é um pedido de venda; use os endpoints de vendas (/api/sales)',
    );
    error.status = 400;
    throw error;
  }
};

const itemCreateData = (item) => ({
  description: item.description || null,
  chargedValue: item.chargedValue,
  personId: item.personId,
  productId: item.productId || null,
  memberPrice: item.memberPrice ?? null,
  details: item.details || null,
  quantity: item.quantity ?? 1,
  forStock: item.forStock ?? false,
  chargedValueMode: item.chargedValueMode ?? 'UNIT',
  kitStockMode: item.kitStockMode ?? null,
  ...(item.kitSnapshot !== undefined
    ? { kitSnapshot: item.kitSnapshot ?? null }
    : {}),
});

// Attaches the frozen kit snapshot (and validates the stock mode) to each item
// based on its product type. For KIT products the current composition is
// snapshotted into `kitSnapshot`; for non-kit products the kit fields are
// cleared. A forStock item referencing a KIT product must provide a
// `kitStockMode` (KIT or COMPONENTS).
const resolveKitFields = async (client, items) => {
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
      if (item.forStock && !item.kitStockMode) {
        const error = new Error(
          'Stock items for KIT products require a kitStockMode (KIT or COMPONENTS)',
        );
        error.status = 400;
        throw error;
      }
      item.kitStockMode = item.kitStockMode ?? null;
      item.kitSnapshot = await resolveKitSnapshot(client, item.productId);
    } else {
      item.kitStockMode = null;
      item.kitSnapshot = null;
    }
  }
};

// Resolves the kit fields of a single edited item, preserving the frozen
// snapshot whenever the product (kit) is unchanged so kit composition changes
// never affect stock control of already-registered orders (requirement 5).
const resolveEditedKitFields = async (client, oldItem, newItem) => {
  if (newItem.productId !== oldItem.productId) {
    await resolveKitFields(client, [newItem]);
    return;
  }
  const type = newItem.productId
    ? (
        await client.product.findUnique({
          where: { id: newItem.productId },
          select: { productType: true },
        })
      )?.productType
    : null;
  if (type === 'KIT') {
    if (newItem.forStock && !newItem.kitStockMode && !oldItem.kitStockMode) {
      const error = new Error(
        'Stock items for KIT products require a kitStockMode (KIT or COMPONENTS)',
      );
      error.status = 400;
      throw error;
    }
    newItem.kitStockMode = newItem.kitStockMode ?? oldItem.kitStockMode ?? null;
    newItem.kitSnapshot = oldItem.kitSnapshot ?? null;
  } else {
    newItem.kitStockMode = null;
    newItem.kitSnapshot = null;
  }
};

// Resolves the frozen kit snapshot per payload item during a bulk order update,
// preserving the snapshot of unchanged kit items (matched by id) so kit
// composition changes never affect stock control of already-registered orders.
// Items without a matching id are created fresh (current composition snapshot).
const resolveOrderUpdateItems = async (client, existingItems, payloadItems) => {
  const oldById = new Map(existingItems.map((it) => [it.id, it]));
  const resolved = [];
  for (const item of payloadItems) {
    const existing = item.id ? oldById.get(item.id) : null;
    const productChanged =
      !existing || existing.productId !== (item.productId ?? null);
    if (productChanged) {
      await resolveKitFields(client, [item]);
      resolved.push({ ...item, __existingId: existing ? existing.id : null });
      continue;
    }
    // Same product: preserve the frozen snapshot.
    const type = item.productId
      ? (
          await client.product.findUnique({
            where: { id: item.productId },
            select: { productType: true },
          })
        )?.productType
      : null;
    if (type === 'KIT') {
      if (item.forStock && !item.kitStockMode && !existing.kitStockMode) {
        const error = new Error(
          'Stock items for KIT products require a kitStockMode (KIT or COMPONENTS)',
        );
        error.status = 400;
        throw error;
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

const orderLineTotalCents = (items) =>
  items.reduce((sum, item) => sum + lineValueCents(item), 0);

// Shape used by computeOrderStatus (which needs quantity/chargedValueMode for
// line-value math in addition to personId/chargedValue/person).
const statusItemFromItem = (item) => ({
  personId: item.personId,
  chargedValue: item.chargedValue,
  quantity: item.quantity,
  chargedValueMode: item.chargedValueMode,
  person: item.person,
});

const itemStockMovements = async (client, order, orderNumber, items) => {
  if (!order.orderDate) {
    const error = new Error(
      'Data do pedido é obrigatória para movimentações de estoque',
    );
    error.status = 400;
    throw error;
  }
  // Apply ENTRADA movements for every self + forStock item, expanding kit
  // items into their effective stock products (the kit itself or its frozen
  // components, depending on the chosen mode).
  for (const item of items) {
    if (!item.person || !item.person.isSelf) continue;
    for (const { productId, quantity } of expandItemToStockProducts(item)) {
      await applyMovement(client, {
        userId: order.userId,
        productId,
        type: 'ENTRADA',
        quantity,
        reason: `Pedido ${orderNumber}`,
        orderId: order.id,
        itemId: item.id,
        effectiveDate: order.orderDate,
      });
    }
  }
};

const ORDER_SORTABLE_FIELDS = [
  'orderNumber',
  'orderDate',
  'totalValue',
  'status',
  'paymentType',
  'accountOwner',
  'orderNotes',
  'doterraPv',
  'doterraValue',
  'createdAt',
];

// Computed value used to sort orders that have no direct DB column:
// - pendingCents: totalValue - (self person items) - (payments)
const orderSortValue = (order, field) => {
  if (field === 'pendingCents') {
    if (order.isTeamOrder) return 0;
    const selfCents = (order.items || [])
      .filter((item) => item.person && item.person.isSelf)
      .reduce((sum, item) => sum + lineValueCents(item), 0);
    const paidCents = (order.payments || []).reduce(
      (sum, p) => sum + toCents(parseFloat(p.amount)),
      0,
    );
    return Math.max(
      0,
      toCents(parseFloat(order.totalValue)) - selfCents - paidCents,
    );
  }
  return undefined;
};

const sortOrdersInMemory = (orders, sortBy, sortDir) => {
  const direction = sortDir === 'desc' ? -1 : 1;
  const numericFields = ['pendingCents', 'totalValue'];
  return [...orders].sort((a, b) => {
    if (numericFields.includes(sortBy)) {
      const aComputed = orderSortValue(a, sortBy);
      const bComputed = orderSortValue(b, sortBy);
      const aValue =
        aComputed !== undefined ? aComputed : Number(a[sortBy]) || 0;
      const bValue =
        bComputed !== undefined ? bComputed : Number(b[sortBy]) || 0;
      return (aValue - bValue) * direction;
    }
    return (
      String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? ''), 'pt-BR') *
      direction
    );
  });
};

// Get all orders with items
const getOrders = async (req, res) => {
  try {
    const { q, searchField, status, paymentType, sortBy, sortDir } = req.query;

    const where = { userId: req.user.userId, orderType: 'COMPRA' };

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
          return res.status(200).json([]);
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

    const orders = await prisma.order.findMany({
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

    const computedSortField =
      sortBy === 'pendingValue' ? 'pendingCents' : sortBy;
    const result = inMemorySort
      ? sortOrdersInMemory(orders, computedSortField, sortDir)
      : orders;

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get order by ID with items
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findFirst({
      where: { id, userId: req.user.userId },
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
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create new order with items
const createOrder = async (req, res) => {
  try {
    const validatedData = createOrderSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // Verify all persons exist and belong to user
      const personIds = [
        ...new Set(validatedData.items.map((item) => item.personId)),
      ];
      const persons = await tx.person.findMany({
        where: { id: { in: personIds }, userId: req.user.userId },
      });

      if (persons.length !== personIds.length) {
        const error = new Error('One or more persons not found');
        error.status = 400;
        throw error;
      }

      // Verify all products exist and are available (ATIVO or INDISPONIVEL)
      await validateProducts(tx, validatedData.items);

      const selfIds = selfPersonIdSet(persons);
      const isTeamOrder = validatedData.isTeamOrder ?? false;
      if (!isTeamOrder) {
        validateStockItemRules(validatedData.items, selfIds);
      }

      // Attach frozen kit snapshots and validate the stock mode for kit items.
      await resolveKitFields(tx, validatedData.items);

      const personMap = new Map(persons.map((p) => [p.id, p]));

      // Calculate total value in integer cents, honoring price mode × quantity
      // plus the order-level shipping value.
      const shippingCents = toCents(validatedData.shippingValue ?? 0);
      const totalCents =
        orderLineTotalCents(validatedData.items) + shippingCents;
      const status = computeOrderStatus({
        items: validatedData.items.map((item) => ({
          personId: item.personId,
          chargedValue: item.chargedValue,
          quantity: item.quantity,
          chargedValueMode: item.chargedValueMode,
          person: personMap.get(item.personId),
        })),
        payments: [],
        shippingCents,
        isTeamOrder,
      });

      // Create order with items
      const order = await tx.order.create({
        data: {
          orderNumber: validatedData.orderNumber,
          totalValue: fromCents(totalCents).toFixed(2),
          shippingValue: fromCents(shippingCents).toFixed(2),
          orderDate: validatedData.orderDate
            ? parseLocalDate(validatedData.orderDate)
            : undefined,
          isTeamOrder,
          accountOwner: validatedData.accountOwner ?? null,
          paymentType: validatedData.paymentType ?? null,
          orderNotes: validatedData.orderNotes ?? null,
          doterraPv:
            validatedData.doterraPv != null
              ? fromCents(toCents(validatedData.doterraPv)).toFixed(2)
              : null,
          doterraValue:
            validatedData.doterraValue != null
              ? fromCents(toCents(validatedData.doterraValue)).toFixed(2)
              : null,
          status,
          userId: req.user.userId,
          items: {
            create: validatedData.items.map(itemCreateData),
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
        await itemStockMovements(tx, order, order.orderNumber, order.items);
      }

      return order;
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update order
const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateOrderSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // Check if order exists and belongs to user
      const existingOrder = await tx.order.findFirst({
        where: { id, userId: req.user.userId },
        include: { items: { include: { person: true } } },
      });

      if (!existingOrder) {
        const error = new Error('Order not found');
        error.status = 404;
        throw error;
      }

      assertNotSaleOrder(existingOrder);

      if (!validatedData.items) {
        const order = await tx.order.update({
          where: { id },
          data: {
            orderNumber: validatedData.orderNumber || existingOrder.orderNumber,
            ...(validatedData.orderDate && {
              orderDate: parseLocalDate(validatedData.orderDate),
            }),
            ...(validatedData.isTeamOrder !== undefined && {
              isTeamOrder: validatedData.isTeamOrder,
            }),
            ...(validatedData.accountOwner !== undefined && {
              accountOwner: validatedData.accountOwner,
            }),
            ...(validatedData.paymentType !== undefined && {
              paymentType: validatedData.paymentType,
            }),
            ...(validatedData.orderNotes !== undefined && {
              orderNotes: validatedData.orderNotes,
            }),
            ...(validatedData.doterraPv !== undefined && {
              doterraPv:
                validatedData.doterraPv != null
                  ? fromCents(toCents(validatedData.doterraPv)).toFixed(2)
                  : null,
            }),
            ...(validatedData.doterraValue !== undefined && {
              doterraValue:
                validatedData.doterraValue != null
                  ? fromCents(toCents(validatedData.doterraValue)).toFixed(2)
                  : null,
            }),
            ...(validatedData.shippingValue !== undefined && {
              shippingValue: fromCents(
                toCents(validatedData.shippingValue ?? 0),
              ).toFixed(2),
              totalValue: fromCents(
                toCents(existingOrder.totalValue) -
                  toCents(existingOrder.shippingValue ?? 0) +
                  toCents(validatedData.shippingValue ?? 0),
              ).toFixed(2),
            }),
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
          validatedData.shippingValue !== undefined ||
          validatedData.isTeamOrder !== undefined
        ) {
          const payments = await tx.payment.findMany({
            where: { orderId: id },
          });
          const newStatus = computeOrderStatus({
            items: order.items,
            payments,
            shippingCents: toCents(validatedData.shippingValue ?? 0),
            isTeamOrder: order.isTeamOrder,
          });
          if (newStatus !== order.status) {
            await tx.order.update({
              where: { id },
              data: { status: newStatus },
            });
            order.status = newStatus;
          }
        }

        return order;
      }

      const personIds = [
        ...new Set(validatedData.items.map((item) => item.personId)),
      ];
      const persons = await tx.person.findMany({
        where: { id: { in: personIds }, userId: req.user.userId },
      });

      if (persons.length !== personIds.length) {
        const error = new Error('One or more persons not found');
        error.status = 400;
        throw error;
      }

      // Verify all products exist and are available (ATIVO or INDISPONIVEL)
      await validateProducts(tx, validatedData.items);

      // Self ids from old items (their persons) and new items' persons
      const newSelfIds = selfPersonIdSet(persons);
      const oldSelfIds = selfPersonIdSet(
        existingOrder.items.map((it) => it.person).filter(Boolean),
      );
      const selfIds = new Set([...newSelfIds, ...oldSelfIds]);

      validateStockItemRules(validatedData.items, selfIds);

      const shippingCents = toCents(
        validatedData.shippingValue ?? existingOrder.shippingValue ?? 0,
      );
      const totalCents =
        orderLineTotalCents(validatedData.items) + shippingCents;

      // Resolve kit fields (preserving frozen snapshots for unchanged items),
      // then compute the stock diff between old and new items (skipped for
      // team orders, which never affect the user's stock).
      const resolvedItems = await resolveOrderUpdateItems(
        tx,
        existingOrder.items,
        validatedData.items,
      );
      const isTeamOrder =
        validatedData.isTeamOrder ?? existingOrder.isTeamOrder ?? false;
      if (!isTeamOrder) {
        const diff = computeStockDiff(
          existingOrder.items,
          resolvedItems,
          selfIds,
        );
        const effectiveOrderDate = validatedData.orderDate
          ? parseLocalDate(validatedData.orderDate)
          : existingOrder.orderDate;
        if (!effectiveOrderDate) {
          const error = new Error(
            'Data do pedido é obrigatória para movimentações de estoque',
          );
          error.status = 400;
          throw error;
        }
        for (const { productId, delta } of diff) {
          if (delta > 0) {
            await applyMovement(tx, {
              userId: req.user.userId,
              productId,
              type: 'ENTRADA',
              quantity: delta,
              reason: `Pedido ${validatedData.orderNumber || existingOrder.orderNumber}`,
              orderId: existingOrder.id,
              effectiveDate: effectiveOrderDate,
            });
          } else {
            await applyMovement(tx, {
              userId: req.user.userId,
              productId,
              type: 'SAIDA',
              quantity: -delta,
              reason: `Pedido ${validatedData.orderNumber || existingOrder.orderNumber}`,
              orderId: existingOrder.id,
              effectiveDate: effectiveOrderDate,
            });
          }
        }
      }

      await tx.order.update({
        where: { id },
        data: {
          orderNumber: validatedData.orderNumber || existingOrder.orderNumber,
          totalValue: fromCents(totalCents).toFixed(2),
          shippingValue: fromCents(shippingCents).toFixed(2),
          orderDate: validatedData.orderDate
            ? parseLocalDate(validatedData.orderDate)
            : undefined,
          isTeamOrder,
          ...(validatedData.accountOwner !== undefined && {
            accountOwner: validatedData.accountOwner,
          }),
          ...(validatedData.paymentType !== undefined && {
            paymentType: validatedData.paymentType,
          }),
          ...(validatedData.orderNotes !== undefined && {
            orderNotes: validatedData.orderNotes,
          }),
          ...(validatedData.doterraPv !== undefined && {
            doterraPv:
              validatedData.doterraPv != null
                ? fromCents(toCents(validatedData.doterraPv)).toFixed(2)
                : null,
          }),
          ...(validatedData.doterraValue !== undefined && {
            doterraValue:
              validatedData.doterraValue != null
                ? fromCents(toCents(validatedData.doterraValue)).toFixed(2)
                : null,
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
      const payments = await tx.payment.findMany({
        where: { orderId: id },
      });
      const newStatus = computeOrderStatus({
        items: order.items,
        payments,
        shippingCents,
        isTeamOrder,
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

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete order
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    let attachmentFilename = null;
    const result = await prisma.$transaction(async (tx) => {
      // Check if order exists and belongs to user
      const existingOrder = await tx.order.findFirst({
        where: { id, userId: req.user.userId },
        include: { items: { include: { person: true } } },
      });

      if (!existingOrder) {
        const error = new Error('Order not found');
        error.status = 404;
        throw error;
      }

      assertNotSaleOrder(existingOrder);

      attachmentFilename = existingOrder.attachmentFilename;

      // Reverse stock for every self + forStock item before deleting, expanding
      // kit items into their effective stock products. Team orders never
      // affected the user's stock, so nothing is reversed.
      if (!existingOrder.isTeamOrder) {
        if (!existingOrder.orderDate) {
          const error = new Error(
            'Data do pedido é obrigatória para movimentações de estoque',
          );
          error.status = 400;
          throw error;
        }
        for (const item of existingOrder.items) {
          if (!item.person || !item.person.isSelf) continue;
          for (const { productId, quantity } of expandItemToStockProducts(
            item,
          )) {
            await applyMovement(tx, {
              userId: req.user.userId,
              productId,
              type: 'SAIDA',
              quantity,
              reason: `Pedido ${existingOrder.orderNumber}`,
              orderId: existingOrder.id,
              effectiveDate: existingOrder.orderDate,
            });
          }
        }
      }

      await tx.order.delete({ where: { id } });
      return { message: 'Order deleted successfully' };
    });

    if (attachmentFilename) {
      removeAttachmentFile(attachmentFilename);
    }

    res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add item to order
const addItemToOrder = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const validatedData = itemSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // Check if order exists and belongs to user
      const order = await tx.order.findFirst({
        where: { id: orderId, userId: req.user.userId },
      });

      if (!order) {
        const error = new Error('Order not found');
        error.status = 404;
        throw error;
      }

      assertNotSaleOrder(order);

      if (!order.orderDate) {
        const error = new Error(
          'Data do pedido é obrigatória para movimentações de estoque',
        );
        error.status = 400;
        throw error;
      }

      // Check if person exists and belongs to user
      const person = await tx.person.findFirst({
        where: { id: validatedData.personId, userId: req.user.userId },
      });

      if (!person) {
        const error = new Error('Person not found');
        error.status = 400;
        throw error;
      }

      // Verify product exists and is available (when provided)
      await validateProducts(tx, [validatedData]);

      validateStockItemRules(
        [validatedData],
        new Set(person.isSelf ? [person.id] : []),
      );

      // Attach the frozen kit snapshot and validate the stock mode for kit items.
      await resolveKitFields(tx, [validatedData]);

      const lineCents = lineValueCents(validatedData);
      const newTotalCents =
        orderLineTotalCents([
          ...(await tx.item.findMany({ where: { orderId } })),
          validatedData,
        ]) + toCents(order.shippingValue ?? 0);

      // Add item to order
      const item = await tx.item.create({
        data: {
          ...itemCreateData(validatedData),
          orderId,
        },
        include: {
          person: true,
          product: true,
        },
      });

      // Update order total value (exact cents)
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          totalValue: fromCents(newTotalCents).toFixed(2),
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
        for (const { productId, quantity } of expandItemToStockProducts(item)) {
          await applyMovement(tx, {
            userId: req.user.userId,
            productId,
            type: 'ENTRADA',
            quantity,
            reason: `Pedido ${order.orderNumber}`,
            orderId,
            itemId: item.id,
            effectiveDate: order.orderDate,
          });
        }
      }

      // Recompute order status after adding the item
      const payments = await tx.payment.findMany({
        where: { orderId },
      });
      const newStatus = computeOrderStatus({
        items: updatedOrder.items,
        payments,
        shippingCents: toCents(order.shippingValue ?? 0),
        isTeamOrder: order.isTeamOrder,
      });
      if (newStatus !== updatedOrder.status) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: newStatus },
        });
      }

      return item;
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error adding item to order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update item
const updateItem = async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const validatedData = itemSchema.partial().parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // Check if item exists and belongs to user's order
      const existingItem = await tx.item.findUnique({
        where: { id: itemId },
        include: {
          order: true,
          person: true,
        },
      });

      if (!existingItem) {
        const error = new Error('Item not found');
        error.status = 404;
        throw error;
      }

      if (existingItem.order.userId !== req.user.userId) {
        const error = new Error('Item not found');
        error.status = 404;
        throw error;
      }

      assertNotSaleOrder(existingItem.order);

      const newData = { ...existingItem, ...validatedData };

      // If updating personId, verify person exists and belongs to user
      let newPerson = existingItem.person;
      if (validatedData.personId) {
        const person = await tx.person.findFirst({
          where: { id: validatedData.personId, userId: req.user.userId },
        });
        if (!person) {
          const error = new Error('Person not found');
          error.status = 400;
          throw error;
        }
        newPerson = person;
      }

      // If updating productId (non-null), verify product exists and is available
      if (validatedData.productId) {
        await validateProducts(tx, [validatedData]);
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
              userId: req.user.userId,
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
              userId: req.user.userId,
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
      const { person, order, ...itemData } = newData;
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

      // Update order total value (exact cents) when line value changed
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
          data: { totalValue: fromCents(newTotalCents).toFixed(2) },
        });
      }

      // Recompute order status after the item change
      const orderItems = await tx.item.findMany({
        where: { orderId: existingItem.orderId },
        include: { person: true },
      });
      const payments = await tx.payment.findMany({
        where: { orderId: existingItem.orderId },
      });
      const newStatus = computeOrderStatus({
        items: orderItems,
        payments,
        shippingCents: toCents(existingItem.order.shippingValue ?? 0),
        isTeamOrder: existingItem.order.isTeamOrder,
      });
      if (newStatus !== existingItem.order.status) {
        await tx.order.update({
          where: { id: existingItem.orderId },
          data: { status: newStatus },
        });
      }

      return item;
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete item
const deleteItem = async (req, res) => {
  try {
    const { id: itemId } = req.params;

    const result = await prisma.$transaction(async (tx) => {
      // Check if item exists and belongs to user's order
      const existingItem = await tx.item.findUnique({
        where: { id: itemId },
        include: {
          order: true,
          person: true,
        },
      });

      if (!existingItem) {
        const error = new Error('Item not found');
        error.status = 404;
        throw error;
      }

      if (existingItem.order.userId !== req.user.userId) {
        const error = new Error('Item not found');
        error.status = 404;
        throw error;
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
        for (const { productId, quantity } of expandItemToStockProducts(
          existingItem,
        )) {
          await applyMovement(tx, {
            userId: req.user.userId,
            productId,
            type: 'SAIDA',
            quantity,
            reason: `Pedido ${existingItem.order.orderNumber}`,
            orderId: existingItem.orderId,
            itemId,
            effectiveDate: existingItem.order.orderDate,
          });
        }
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
        data: { totalValue: fromCents(newTotalCents).toFixed(2) },
      });

      // Recompute order status after removing the item
      const orderItems = await tx.item.findMany({
        where: { orderId: existingItem.orderId },
        include: { person: true },
      });
      const payments = await tx.payment.findMany({
        where: { orderId: existingItem.orderId },
      });
      const newStatus = computeOrderStatus({
        items: orderItems,
        payments,
        shippingCents: toCents(existingItem.order.shippingValue ?? 0),
        isTeamOrder: existingItem.order.isTeamOrder,
      });
      if (newStatus !== existingItem.order.status) {
        await tx.order.update({
          where: { id: existingItem.orderId },
          data: { status: newStatus },
        });
      }

      return { message: 'Item deleted successfully' };
    });

    res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  addItemToOrder,
  updateItem,
  deleteItem,
};

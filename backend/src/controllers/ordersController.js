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
const { findIdsByTextSearch } = require('../utils/search');

const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const itemSchema = z.object({
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
  pv: z.number().nonnegative('PV must not be negative').optional().nullable(),
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
});

const paymentTypeSchema = z.enum(['PIX', 'BOLETO', 'CARTAO_CREDITO']);

const orderDescriptiveSchema = {
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
};

const createOrderSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required'),
  orderDate: z.string().optional(),
  ...orderDescriptiveSchema,
  items: z.array(itemSchema).min(1, 'At least one item is required'),
});

const updateOrderSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required').optional(),
  orderDate: z.string().optional(),
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

const itemCreateData = (item) => ({
  description: item.description || null,
  chargedValue: item.chargedValue,
  personId: item.personId,
  productId: item.productId || null,
  memberPrice: item.memberPrice ?? null,
  pv: item.pv ?? null,
  details: item.details || null,
  quantity: item.quantity ?? 1,
  forStock: item.forStock ?? false,
  chargedValueMode: item.chargedValueMode ?? 'UNIT',
});

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
  // Apply ENTRADA movements for every self + forStock + product item.
  for (const item of items) {
    if (!item.forStock || !item.productId) continue;
    if (!item.person || !item.person.isSelf) continue;
    await applyMovement(client, {
      userId: order.userId,
      productId: item.productId,
      type: 'ENTRADA',
      quantity: item.quantity ?? 1,
      reason: `Pedido ${orderNumber}`,
      orderId: order.id,
      itemId: item.id,
    });
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
  'createdAt',
];

// Computed values used to sort orders that have no direct DB column:
// - pendingCents: totalValue - (self person items) - (payments)
// - totalPv: sum of (item.pv * item.quantity)
const orderSortValue = (order, field) => {
  if (field === 'pendingCents') {
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
  if (field === 'totalPv') {
    return (order.items || []).reduce((sum, item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      return sum + (parseFloat(item.pv) || 0) * qty;
    }, 0);
  }
  return undefined;
};

const sortOrdersInMemory = (orders, sortBy, sortDir) => {
  const direction = sortDir === 'desc' ? -1 : 1;
  const numericFields = ['pendingCents', 'totalPv', 'totalValue'];
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

    const where = { userId: req.user.userId };

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

    // The pendingValue / totalPv columns are derived from items and payments,
    // so they are sorted in-memory after fetching the filtered set.
    const COMPUTED_SORT_FIELDS = ['pendingValue', 'totalPv'];
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
      sortBy === 'pendingValue' ? 'pendingCents' : 'totalPv';
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
      validateStockItemRules(validatedData.items, selfIds);

      const personMap = new Map(persons.map((p) => [p.id, p]));

      // Calculate total value in integer cents, honoring price mode × quantity
      const totalCents = orderLineTotalCents(validatedData.items);
      const status = computeOrderStatus({
        items: validatedData.items.map((item) => ({
          personId: item.personId,
          chargedValue: item.chargedValue,
          quantity: item.quantity,
          chargedValueMode: item.chargedValueMode,
          person: personMap.get(item.personId),
        })),
        payments: [],
      });

      // Create order with items
      const order = await tx.order.create({
        data: {
          orderNumber: validatedData.orderNumber,
          totalValue: fromCents(totalCents).toFixed(2),
          orderDate: validatedData.orderDate
            ? parseLocalDate(validatedData.orderDate)
            : undefined,
          accountOwner: validatedData.accountOwner ?? null,
          paymentType: validatedData.paymentType ?? null,
          orderNotes: validatedData.orderNotes ?? null,
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

      // Apply stock for self + forStock items
      await itemStockMovements(tx, order, order.orderNumber, order.items);

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

      if (!validatedData.items) {
        const order = await tx.order.update({
          where: { id },
          data: {
            orderNumber: validatedData.orderNumber || existingOrder.orderNumber,
            ...(validatedData.orderDate && {
              orderDate: parseLocalDate(validatedData.orderDate),
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

      const totalCents = orderLineTotalCents(validatedData.items);

      // Compute stock diff (self + forStock) between old and new items, then
      // apply before replacing items (old items are destroyed afterwards).
      const diff = computeStockDiff(
        existingOrder.items,
        validatedData.items,
        selfIds,
      );
      for (const { productId, delta } of diff) {
        if (delta > 0) {
          await applyMovement(tx, {
            userId: req.user.userId,
            productId,
            type: 'ENTRADA',
            quantity: delta,
            reason: `Pedido ${validatedData.orderNumber || existingOrder.orderNumber}`,
            orderId: existingOrder.id,
          });
        } else {
          await applyMovement(tx, {
            userId: req.user.userId,
            productId,
            type: 'SAIDA',
            quantity: -delta,
            reason: `Pedido ${validatedData.orderNumber || existingOrder.orderNumber}`,
            orderId: existingOrder.id,
          });
        }
      }

      const order = await tx.order.update({
        where: { id },
        data: {
          orderNumber: validatedData.orderNumber || existingOrder.orderNumber,
          totalValue: fromCents(totalCents).toFixed(2),
          orderDate: validatedData.orderDate
            ? parseLocalDate(validatedData.orderDate)
            : undefined,
          ...(validatedData.accountOwner !== undefined && {
            accountOwner: validatedData.accountOwner,
          }),
          ...(validatedData.paymentType !== undefined && {
            paymentType: validatedData.paymentType,
          }),
          ...(validatedData.orderNotes !== undefined && {
            orderNotes: validatedData.orderNotes,
          }),
          items: {
            deleteMany: {},
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

      // Recompute status considering the replaced items and existing payments
      const payments = await tx.payment.findMany({
        where: { orderId: id },
      });
      const newStatus = computeOrderStatus({ items: order.items, payments });
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

      // Reverse stock for every self + forStock + product item before deleting
      for (const item of existingOrder.items) {
        if (!item.forStock || !item.productId) continue;
        if (!item.person || !item.person.isSelf) continue;
        await applyMovement(tx, {
          userId: req.user.userId,
          productId: item.productId,
          type: 'SAIDA',
          quantity: item.quantity ?? 1,
          reason: `Pedido ${existingOrder.orderNumber}`,
          orderId: existingOrder.id,
        });
      }

      await tx.order.delete({ where: { id } });
      return { message: 'Order deleted successfully' };
    });

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

      const lineCents = lineValueCents(validatedData);
      const newTotalCents = orderLineTotalCents([
        ...(await tx.item.findMany({ where: { orderId } })),
        validatedData,
      ]);

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

      // Apply stock if self + forStock
      if (item.forStock && item.productId && person.isSelf) {
        await applyMovement(tx, {
          userId: req.user.userId,
          productId: item.productId,
          type: 'ENTRADA',
          quantity: item.quantity ?? 1,
          reason: `Pedido ${order.orderNumber}`,
          orderId,
          itemId: item.id,
        });
      }

      // Recompute order status after adding the item
      const payments = await tx.payment.findMany({
        where: { orderId },
      });
      const newStatus = computeOrderStatus({
        items: updatedOrder.items,
        payments,
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

      // Compute stock diff between the old and new item state
      const diff = computeStockDiff(
        [
          {
            productId: existingItem.productId,
            quantity: existingItem.quantity,
            forStock: existingItem.forStock,
            personId: existingItem.personId,
          },
        ],
        [
          {
            productId: newData.productId,
            quantity: newData.quantity,
            forStock: newData.forStock,
            personId: newData.personId,
          },
        ],
        selfIds,
      );

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
          });
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
          pv: itemData.pv ?? null,
          details: itemData.details ?? null,
          quantity: itemData.quantity ?? 1,
          forStock: itemData.forStock ?? false,
          chargedValueMode: itemData.chargedValueMode ?? 'UNIT',
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
      const newStatus = computeOrderStatus({ items: orderItems, payments });
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

      // Reverse stock if the item was self + forStock
      if (
        existingItem.forStock &&
        existingItem.productId &&
        existingItem.person &&
        existingItem.person.isSelf
      ) {
        await applyMovement(tx, {
          userId: req.user.userId,
          productId: existingItem.productId,
          type: 'SAIDA',
          quantity: existingItem.quantity ?? 1,
          reason: `Pedido ${existingItem.order.orderNumber}`,
          orderId: existingItem.orderId,
          itemId,
        });
      }

      // Delete item
      await tx.item.delete({ where: { id: itemId } });

      // Update order total value (exact cents)
      const remainingItems = await tx.item.findMany({
        where: { orderId: existingItem.orderId },
      });
      const newTotalCents = orderLineTotalCents(remainingItems);
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
      const newStatus = computeOrderStatus({ items: orderItems, payments });
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

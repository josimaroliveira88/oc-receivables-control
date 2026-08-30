const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();
const { computeOrderStatus } = require('../utils/receivables');
const { lineValueCents, fromCents, toCents } = require('../utils/money');
const { applyMovement } = require('../services/stockService');
const { computeSaleStockDiff } = require('../utils/stockDiff');
const {
  resolveKitSnapshot,
  expandSaleItemToStockProducts,
} = require('../utils/kitStock');
const { findIdsByTextSearch } = require('../utils/search');
const { parseLocalDate } = require('../utils/date');

const saleItemSchema = z.object({
  id: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  chargedValue: z
    .number()
    .min(0, 'Charged value must not be negative')
    .default(0),
  productId: z.string().uuid('Product ID must be a valid UUID'),
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
  chargedValueMode: z.enum(['UNIT', 'TOTAL']).default('UNIT'),
  kitStockMode: z.enum(['KIT', 'COMPONENTS']).optional().nullable(),
});

const createSaleSchema = z.object({
  clientPersonId: z.string().uuid('Person ID must be a valid UUID'),
  orderDate: z.string().optional(),
  shippingValue: z
    .number()
    .min(0, 'Shipping value must not be negative')
    .optional()
    .nullable()
    .default(0),
  additionalValue: z
    .number()
    .min(0, 'Additional value must not be negative')
    .optional()
    .nullable()
    .default(0),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .nullable(),
  deliveredAt: z.string().optional().nullable(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
});

const updateSaleSchema = z.object({
  clientPersonId: z.string().uuid('Person ID must be a valid UUID').optional(),
  orderDate: z.string().optional(),
  shippingValue: z
    .number()
    .min(0, 'Shipping value must not be negative')
    .optional()
    .nullable(),
  additionalValue: z
    .number()
    .min(0, 'Additional value must not be negative')
    .optional()
    .nullable(),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .nullable(),
  deliveredAt: z.string().optional().nullable(),
  items: z
    .array(saleItemSchema)
    .min(1, 'At least one item is required')
    .optional(),
});

const badRequest = (message) => {
  const error = new Error(message);
  error.status = 400;
  throw error;
};

// Atomically increments the per-user sale counter and formats the number
// (V-0001, V-0002, ...). Retries on the rare concurrent-create unique race.
const nextSaleNumber = async (tx, userId) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const counter = await tx.saleCounter.upsert({
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
  badRequest('Não foi possível gerar o número da venda');
};

// Verifies all products exist and are available (ATIVO or INDISPONIVEL).
const validateSaleProducts = async (client, items) => {
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
    badRequest('One or more products are inactive or do not exist');
  }
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
        badRequest(
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
        badRequest(
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
  details: item.details ?? null,
  quantity: item.quantity ?? 1,
  forStock: false,
  chargedValueMode: item.chargedValueMode ?? 'UNIT',
  kitStockMode: item.kitStockMode ?? null,
  ...(item.kitSnapshot !== undefined
    ? { kitSnapshot: item.kitSnapshot ?? null }
    : {}),
});

const getSales = async (req, res) => {
  try {
    const { q, searchField, status, delivered, sortBy, sortDir } = req.query;

    const where = { userId: req.user.userId, orderType: 'VENDA' };

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
          const items = await prisma.item.findMany({
            where: {
              personId: { in: ids },
              order: { userId: req.user.userId, orderType: 'VENDA' },
            },
            select: { orderId: true },
            distinct: ['orderId'],
          });
          items.forEach((i) => orderIds.add(i.orderId));
        }
      }
      if (orderIds.size === 0) return res.status(200).json([]);
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

    const sales = await prisma.order.findMany({
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

    const result = inMemorySort
      ? sortSalesInMemory(sales, sortBy, sortDir)
      : sales;
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const SALES_SORTABLE_FIELDS = [
  'orderNumber',
  'orderDate',
  'totalValue',
  'status',
  'deliveredAt',
  'createdAt',
];

const sortSalesInMemory = (orders, sortBy, sortDir) => {
  const direction = sortDir === 'desc' ? -1 : 1;
  return [...orders].sort((a, b) => {
    if (sortBy === 'pendingValue') {
      const pending = (o) =>
        Math.max(
          0,
          toCents(parseFloat(o.totalValue)) -
            (o.payments || []).reduce(
              (sum, p) => sum + toCents(parseFloat(p.amount)),
              0,
            ),
        );
      return (pending(a) - pending(b)) * direction;
    }
    if (sortBy === 'clientName') {
      const name = (o) => o.items?.[0]?.person?.name ?? '';
      return (
        String(name(a)).localeCompare(String(name(b)), 'pt-BR') * direction
      );
    }
    return (
      String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? ''), 'pt-BR') *
      direction
    );
  });
};

const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await prisma.order.findFirst({
      where: { id, userId: req.user.userId, orderType: 'VENDA' },
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
      return res.status(404).json({ error: 'Sale order not found' });
    }

    res.status(200).json(sale);
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createSale = async (req, res) => {
  try {
    const validatedData = createSaleSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.person.findFirst({
        where: { id: validatedData.clientPersonId, userId: req.user.userId },
      });
      if (!client) badRequest('Cliente não encontrado');
      if (client.isSelf) {
        badRequest(
          'O cliente do pedido de venda não pode ser o próprio usuário',
        );
      }

      const items = validatedData.items.map((item) => ({
        ...item,
        personId: client.id,
      }));
      await validateSaleProducts(tx, items);
      await resolveSaleKitFields(tx, items);

      const shippingCents = toCents(validatedData.shippingValue ?? 0);
      const additionalCents = toCents(validatedData.additionalValue ?? 0);
      const totalCents =
        saleLineTotalCents(items) + shippingCents + additionalCents;
      const orderNumber = await nextSaleNumber(tx, req.user.userId);

      const status = computeOrderStatus({
        items: items.map((item) => ({
          personId: item.personId,
          chargedValue: item.chargedValue,
          quantity: item.quantity,
          chargedValueMode: item.chargedValueMode,
          person: client,
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
          orderDate: validatedData.orderDate
            ? parseLocalDate(validatedData.orderDate)
            : undefined,
          deliveredAt: validatedData.deliveredAt
            ? parseLocalDate(validatedData.deliveredAt)
            : null,
          orderNotes: validatedData.description ?? null,
          status,
          userId: req.user.userId,
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
        badRequest(
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
            userId: req.user.userId,
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

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateSale = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateSaleSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: { id, userId: req.user.userId },
        include: { items: { include: { person: true } } },
      });

      if (!existingOrder) {
        const error = new Error('Sale order not found');
        error.status = 404;
        throw error;
      }
      if (existingOrder.orderType !== 'VENDA') {
        const error = new Error(
          'Este é um pedido de compra; use os endpoints de pedidos (/api/orders)',
        );
        error.status = 400;
        throw error;
      }

      if (!validatedData.items) {
        if (validatedData.clientPersonId) {
          const candidate = await tx.person.findFirst({
            where: {
              id: validatedData.clientPersonId,
              userId: req.user.userId,
            },
          });
          if (!candidate) badRequest('Cliente não encontrado');
          if (candidate.isSelf) {
            badRequest(
              'O cliente do pedido de venda não pode ser o próprio usuário',
            );
          }
        }

        const shippingChanged = validatedData.shippingValue !== undefined;
        const additionalChanged = validatedData.additionalValue !== undefined;
        const orderData = {
          ...(validatedData.orderDate && {
            orderDate: parseLocalDate(validatedData.orderDate),
          }),
          ...(validatedData.deliveredAt !== undefined && {
            deliveredAt: validatedData.deliveredAt
              ? parseLocalDate(validatedData.deliveredAt)
              : null,
          }),
          ...(validatedData.description !== undefined && {
            orderNotes: validatedData.description,
          }),
        };
        if (shippingChanged || additionalChanged) {
          const newShipping =
            validatedData.shippingValue ?? existingOrder.shippingValue ?? 0;
          const newAdditional =
            validatedData.additionalValue ?? existingOrder.additionalValue ?? 0;
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
          const payments = await tx.payment.findMany({
            where: { orderId: id },
          });
          const newStatus = computeOrderStatus({
            items: order.items,
            payments,
            shippingCents: toCents(order.shippingValue ?? 0),
            additionalCents: toCents(order.additionalValue ?? 0),
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

      let client = existingOrder.items[0]?.person ?? null;
      if (validatedData.clientPersonId) {
        client = await tx.person.findFirst({
          where: {
            id: validatedData.clientPersonId,
            userId: req.user.userId,
          },
        });
        if (!client) badRequest('Cliente não encontrado');
        if (client.isSelf) {
          badRequest(
            'O cliente do pedido de venda não pode ser o próprio usuário',
          );
        }
      }

      const items = validatedData.items.map((item) => ({
        ...item,
        personId: client.id,
      }));
      await validateSaleProducts(tx, items);
      const resolvedItems = await resolveSaleUpdateItems(
        tx,
        existingOrder.items,
        items,
      );

      const shippingCents = toCents(
        validatedData.shippingValue ?? existingOrder.shippingValue ?? 0,
      );
      const additionalCents = toCents(
        validatedData.additionalValue ?? existingOrder.additionalValue ?? 0,
      );
      const totalCents =
        saleLineTotalCents(resolvedItems) + shippingCents + additionalCents;

      const effectiveOrderDate = validatedData.orderDate
        ? parseLocalDate(validatedData.orderDate)
        : existingOrder.orderDate;
      if (!effectiveOrderDate) {
        badRequest(
          'Data do pedido é obrigatória para movimentações de estoque',
        );
      }

      // Stock diff: increasing the sold quantity deducts more (SAIDA), reducing
      // it restores stock (ENTRADA).
      const diff = computeSaleStockDiff(existingOrder.items, resolvedItems);
      for (const { productId, delta } of diff) {
        await applyMovement(tx, {
          userId: req.user.userId,
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
          orderDate: validatedData.orderDate
            ? parseLocalDate(validatedData.orderDate)
            : undefined,
          deliveredAt:
            validatedData.deliveredAt !== undefined
              ? validatedData.deliveredAt
                ? parseLocalDate(validatedData.deliveredAt)
                : null
              : undefined,
          ...(validatedData.description !== undefined && {
            orderNotes: validatedData.description,
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

      const payments = await tx.payment.findMany({
        where: { orderId: id },
      });
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

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error updating sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: { id, userId: req.user.userId },
        include: { items: { include: { person: true } } },
      });

      if (!existingOrder) {
        const error = new Error('Sale order not found');
        error.status = 404;
        throw error;
      }
      if (existingOrder.orderType !== 'VENDA') {
        const error = new Error(
          'Este é um pedido de compra; use os endpoints de pedidos (/api/orders)',
        );
        error.status = 400;
        throw error;
      }

      if (!existingOrder.orderDate) {
        badRequest(
          'Data do pedido é obrigatória para movimentações de estoque',
        );
      }

      // Reverse the sale: restore stock (ENTRADA) for every item sold.
      for (const item of existingOrder.items) {
        for (const { productId, quantity } of expandSaleItemToStockProducts(
          item,
        )) {
          await applyMovement(tx, {
            userId: req.user.userId,
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

    res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error deleting sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getSales,
  getSaleById,
  createSale,
  updateSale,
  deleteSale,
};

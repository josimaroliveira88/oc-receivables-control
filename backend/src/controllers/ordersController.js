const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();
const {
  computeOrderStatus,
  syncOrderStatuses,
} = require('../utils/receivables');

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
const validateProducts = async (items) => {
  const productIds = [
    ...new Set(items.map((item) => item.productId).filter(Boolean)),
  ];
  if (productIds.length === 0) return;

  const products = await prisma.product.findMany({
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

const itemCreateData = (item) => ({
  description: item.description || null,
  chargedValue: item.chargedValue,
  personId: item.personId,
  productId: item.productId || null,
  memberPrice: item.memberPrice ?? null,
  pv: item.pv ?? null,
  details: item.details || null,
});

// Get all orders with items
const getOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.userId },
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
      orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }],
    });
    res.status(200).json(orders);
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

    // Verify all persons exist and belong to user
    const personIds = [
      ...new Set(validatedData.items.map((item) => item.personId)),
    ];
    const persons = await prisma.person.findMany({
      where: { id: { in: personIds }, userId: req.user.userId },
    });

    if (persons.length !== personIds.length) {
      return res.status(400).json({ error: 'One or more persons not found' });
    }

    // Verify all products exist and are available (ATIVO or INDISPONIVEL)
    await validateProducts(validatedData.items);

    // Calculate total value
    const totalValue = validatedData.items.reduce(
      (sum, item) => sum + item.chargedValue,
      0,
    );

    // Initial status considers self-person items as already received
    const personMap = new Map(persons.map((p) => [p.id, p]));
    const status = computeOrderStatus({
      items: validatedData.items.map((item) => ({
        personId: item.personId,
        chargedValue: item.chargedValue,
        person: personMap.get(item.personId),
      })),
      payments: [],
    });

    // Create order with items
    const order = await prisma.order.create({
      data: {
        orderNumber: validatedData.orderNumber,
        totalValue: totalValue,
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

    res.status(201).json(order);
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

    // Check if order exists and belongs to user
    const existingOrder = await prisma.order.findFirst({
      where: { id, userId: req.user.userId },
      include: { items: true },
    });

    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (validatedData.items) {
      const personIds = [
        ...new Set(validatedData.items.map((item) => item.personId)),
      ];
      const persons = await prisma.person.findMany({
        where: { id: { in: personIds }, userId: req.user.userId },
      });

      if (persons.length !== personIds.length) {
        return res.status(400).json({ error: 'One or more persons not found' });
      }

      // Verify all products exist and are available (ATIVO or INDISPONIVEL)
      await validateProducts(validatedData.items);

      const totalValue = validatedData.items.reduce(
        (sum, item) => sum + item.chargedValue,
        0,
      );

      const order = await prisma.order.update({
        where: { id },
        data: {
          orderNumber: validatedData.orderNumber || existingOrder.orderNumber,
          totalValue: totalValue,
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
      const payments = await prisma.payment.findMany({
        where: { orderId: id },
      });
      const newStatus = computeOrderStatus({
        items: order.items,
        payments,
      });
      if (newStatus !== order.status) {
        await prisma.order.update({
          where: { id },
          data: { status: newStatus },
        });
        order.status = newStatus;
      }

      res.status(200).json(order);
    } else {
      const order = await prisma.order.update({
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

      res.status(200).json(order);
    }
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

    // Check if order exists and belongs to user
    const existingOrder = await prisma.order.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await prisma.order.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add item to order
const addItemToOrder = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const validatedData = itemSchema.parse(req.body);

    // Check if order exists and belongs to user
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user.userId },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if person exists and belongs to user
    const person = await prisma.person.findFirst({
      where: { id: validatedData.personId, userId: req.user.userId },
    });

    if (!person) {
      return res.status(400).json({ error: 'Person not found' });
    }

    // Verify product exists and is available (when provided)
    await validateProducts([validatedData]);

    // Add item to order
    const item = await prisma.item.create({
      data: {
        ...itemCreateData(validatedData),
        orderId: orderId,
      },
      include: {
        person: true,
        product: true,
      },
    });

    // Update order total value
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        totalValue: {
          increment: validatedData.chargedValue,
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

    // Recompute order status after adding the item
    const payments = await prisma.payment.findMany({
      where: { orderId },
    });
    const newStatus = computeOrderStatus({
      items: updatedOrder.items,
      payments,
    });
    if (newStatus !== updatedOrder.status) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      });
    }

    res.status(201).json(item);
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

    // Check if item exists and belongs to user's order
    const existingItem = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        order: true,
      },
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (existingItem.order.userId !== req.user.userId) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // If updating personId, verify person exists and belongs to user
    if (validatedData.personId) {
      const person = await prisma.person.findFirst({
        where: { id: validatedData.personId, userId: req.user.userId },
      });

      if (!person) {
        return res.status(400).json({ error: 'Person not found' });
      }
    }

    // If updating productId (non-null), verify product exists and is available
    if (validatedData.productId) {
      await validateProducts([validatedData]);
    }

    // Update item
    const item = await prisma.item.update({
      where: { id: itemId },
      data: validatedData,
      include: {
        person: true,
        product: true,
      },
    });

    // Update order total value if charged value changed
    if (validatedData.chargedValue !== undefined) {
      const valueChange =
        validatedData.chargedValue - existingItem.chargedValue;
      await prisma.order.update({
        where: { id: existingItem.orderId },
        data: {
          totalValue: {
            increment: valueChange,
          },
        },
      });
    }

    // Recompute order status after the item change
    const orderItems = await prisma.item.findMany({
      where: { orderId: existingItem.orderId },
      include: { person: true },
    });
    const payments = await prisma.payment.findMany({
      where: { orderId: existingItem.orderId },
    });
    const newStatus = computeOrderStatus({ items: orderItems, payments });
    if (newStatus !== existingItem.order.status) {
      await prisma.order.update({
        where: { id: existingItem.orderId },
        data: { status: newStatus },
      });
    }

    res.status(200).json(item);
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

    // Check if item exists and belongs to user's order
    const existingItem = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        order: true,
      },
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (existingItem.order.userId !== req.user.userId) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Delete item
    await prisma.item.delete({
      where: { id: itemId },
    });

    // Update order total value
    await prisma.order.update({
      where: { id: existingItem.orderId },
      data: {
        totalValue: {
          decrement: existingItem.chargedValue,
        },
      },
    });

    // Recompute order status after removing the item
    const orderItems = await prisma.item.findMany({
      where: { orderId: existingItem.orderId },
      include: { person: true },
    });
    const payments = await prisma.payment.findMany({
      where: { orderId: existingItem.orderId },
    });
    const newStatus = computeOrderStatus({ items: orderItems, payments });
    if (newStatus !== existingItem.order.status) {
      await prisma.order.update({
        where: { id: existingItem.orderId },
        data: { status: newStatus },
      });
    }

    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
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

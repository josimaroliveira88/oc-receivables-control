const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();

const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const itemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  value: z.number().positive('Value must be greater than zero'),
  personId: z.string().uuid('Person ID must be a valid UUID'),
});

const createOrderSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required'),
  orderDate: z.string().optional(),
  items: z.array(itemSchema).min(1, 'At least one item is required'),
});

const updateOrderSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required').optional(),
  orderDate: z.string().optional(),
  items: z.array(itemSchema).min(1, 'At least one item is required').optional(),
});

// Get all orders with items
const getOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            person: true,
          },
        },
        payments: true,
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
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            person: true,
          },
        },
        payments: true,
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
    
    // Verify all persons exist
    const personIds = [...new Set(validatedData.items.map(item => item.personId))];
    const persons = await prisma.person.findMany({
      where: { id: { in: personIds } },
    });
    
    if (persons.length !== personIds.length) {
      return res.status(400).json({ error: 'One or more persons not found' });
    }
    
    // Calculate total value
    const totalValue = validatedData.items.reduce((sum, item) => sum + item.value, 0);
    
    // Create order with items
    const order = await prisma.order.create({
      data: {
        orderNumber: validatedData.orderNumber,
        totalValue: totalValue,
        orderDate: validatedData.orderDate ? parseLocalDate(validatedData.orderDate) : undefined,
        status: 'PENDENTE',
        items: {
          create: validatedData.items.map(item => ({
            description: item.description,
            value: item.value,
            personId: item.personId,
          })),
        },
      },
      include: {
        items: {
          include: {
            person: true,
          },
        },
      },
    });
    
    res.status(201).json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
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

  // Check if order exists
  const existingOrder = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existingOrder) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (validatedData.items) {
    const personIds = [...new Set(validatedData.items.map(item => item.personId))];
    const persons = await prisma.person.findMany({
      where: { id: { in: personIds } },
    });

    if (persons.length !== personIds.length) {
      return res.status(400).json({ error: 'One or more persons not found' });
    }

    const totalValue = validatedData.items.reduce((sum, item) => sum + item.value, 0);

    const order = await prisma.order.update({
      where: { id },
      data: {
        orderNumber: validatedData.orderNumber || existingOrder.orderNumber,
        totalValue: totalValue,
        orderDate: validatedData.orderDate ? parseLocalDate(validatedData.orderDate) : undefined,
        items: {
          deleteMany: {},
          create: validatedData.items.map(item => ({
            description: item.description,
            value: item.value,
            personId: item.personId,
          })),
        },
      },
      include: {
        items: {
          include: {
            person: true,
          },
        },
      },
    });

    res.status(200).json(order);
  } else {
    const order = await prisma.order.update({
      where: { id },
      data: {
        orderNumber: validatedData.orderNumber || existingOrder.orderNumber,
        ...(validatedData.orderDate && { orderDate: parseLocalDate(validatedData.orderDate) }),
      },
      include: {
        items: {
          include: {
            person: true,
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
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete order
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
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
    
    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check if person exists
    const person = await prisma.person.findUnique({
      where: { id: validatedData.personId },
    });
    
    if (!person) {
      return res.status(400).json({ error: 'Person not found' });
    }
    
    // Add item to order
    const item = await prisma.item.create({
      data: {
        description: validatedData.description,
        value: validatedData.value,
        orderId: orderId,
        personId: validatedData.personId,
      },
      include: {
        person: true,
      },
    });
    
    // Update order total value
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        totalValue: {
          increment: validatedData.value,
        },
      },
      include: {
        items: {
          include: {
            person: true,
          },
        },
      },
    });
    
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
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
    
    // Check if item exists
    const existingItem = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        order: true,
      },
    });
    
    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // If updating personId, verify person exists
    if (validatedData.personId) {
      const person = await prisma.person.findUnique({
        where: { id: validatedData.personId },
      });
      
      if (!person) {
        return res.status(400).json({ error: 'Person not found' });
      }
    }
    
    // Update item
    const item = await prisma.item.update({
      where: { id: itemId },
      data: validatedData,
      include: {
        person: true,
      },
    });
    
    // Update order total value if value changed
    if (validatedData.value !== undefined) {
      const valueChange = validatedData.value - existingItem.value;
      await prisma.order.update({
        where: { id: existingItem.orderId },
        data: {
          totalValue: {
            increment: valueChange,
          },
        },
      });
    }
    
    res.status(200).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete item
const deleteItem = async (req, res) => {
  try {
    const { id: itemId } = req.params;
    
    // Check if item exists
    const existingItem = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        order: true,
      },
    });
    
    if (!existingItem) {
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
          decrement: existingItem.value,
        },
      },
    });
    
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
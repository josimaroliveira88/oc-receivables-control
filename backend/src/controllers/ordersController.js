const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();
const ordersService = require('../services/ordersService');
const { removeAttachmentFile } = require('../utils/attachmentStorage');
const {
  itemSchema,
  createOrderSchema,
  updateOrderSchema,
} = require('../validators/ordersValidator');

// Get all orders with items
const getOrders = async (req, res) => {
  try {
    const result = await ordersService.getOrders(prisma, {
      userId: req.user.userId,
      query: req.query,
    });
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
    const result = await ordersService.getOrderById(prisma, {
      id,
      userId: req.user.userId,
    });
    res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create new order with items
const createOrder = async (req, res) => {
  try {
    const validatedData = createOrderSchema.parse(req.body);

    const result = await ordersService.createOrder(prisma, {
      userId: req.user.userId,
      payload: validatedData,
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

    const result = await ordersService.updateOrder(prisma, {
      id,
      userId: req.user.userId,
      payload: validatedData,
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

    const { message, attachmentFilename } = await ordersService.deleteOrder(
      prisma,
      { id, userId: req.user.userId },
    );

    if (attachmentFilename) {
      removeAttachmentFile(attachmentFilename);
    }

    res.status(200).json({ message });
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

    const result = await ordersService.addItemToOrder(prisma, {
      orderId,
      userId: req.user.userId,
      payload: validatedData,
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

    const result = await ordersService.updateItem(prisma, {
      id: itemId,
      userId: req.user.userId,
      payload: validatedData,
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

    const result = await ordersService.deleteItem(prisma, {
      id: itemId,
      userId: req.user.userId,
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

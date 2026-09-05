const prisma = require('../config/database');
const { handleError } = require('../middlewares/errorResponse');
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
    handleError(res, error, { label: 'Error fetching orders' });
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
    handleError(res, error, { label: 'Error fetching order' });
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
    handleError(res, error, { label: 'Error creating order' });
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
    handleError(res, error, { label: 'Error updating order' });
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
    handleError(res, error, { label: 'Error deleting order' });
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
    handleError(res, error, { label: 'Error adding item to order' });
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
    handleError(res, error, { label: 'Error updating item' });
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
    handleError(res, error, { label: 'Error deleting item' });
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

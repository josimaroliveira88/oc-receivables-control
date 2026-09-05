const prisma = require('../config/database');
const { z } = require('zod');
const { applyMovement } = require('../services/stockService');
const stockUndoService = require('../services/stockUndoService');
const { movementSchema } = require('../validators/stockValidator');
const { findIdsByTextSearch } = require('../utils/search');
const { parseLocalDate } = require('../utils/date');

const listInventory = async (req, res) => {
  try {
    const { q, sortBy, sortDir } = req.query;

    const where = { userId: req.user.userId };
    if (q && q.trim()) {
      const matchingProductIds = await findIdsByTextSearch({
        table: 'Product',
        columns: ['code', 'name'],
        q,
      });
      if (matchingProductIds !== null) {
        if (matchingProductIds.length === 0) {
          return res.status(200).json([]);
        }
        where.productId = { in: matchingProductIds };
      }
    }

    const direction = sortDir === 'desc' ? 'desc' : 'asc';
    let orderBy;
    switch (sortBy) {
      case 'quantity':
        orderBy = { quantity: direction };
        break;
      case 'name':
      case 'size':
        orderBy = { product: { [sortBy]: direction } };
        break;
      case 'code':
        orderBy = { product: { code: direction } };
        break;
      default:
        orderBy = { product: { name: direction } };
    }

    const inventory = await prisma.inventory.findMany({
      where,
      include: { product: true },
      orderBy,
    });

    const data = inventory.map((item) => ({
      productId: item.productId,
      code: item.product.code,
      name: item.product.name,
      size: item.product.size,
      quantity: item.quantity,
    }));

    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProductHistory = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const movements = await prisma.stockMovement.findMany({
      where: { userId: req.user.userId, productId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { id: true, orderNumber: true, orderType: true } },
      },
    });

    if (movements.length === 0) {
      const inventory = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: req.user.userId, productId },
        },
      });
      if (!inventory) {
        return res.status(404).json({ error: 'Product not found' });
      }
    }

    res.status(200).json(movements);
  } catch (error) {
    console.error('Error fetching stock history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const registerMovement = async (req, res) => {
  try {
    const validatedData = movementSchema.parse(req.body);
    const { productId, type, reason } = validatedData;
    const quantity = validatedData.quantity;
    const effectiveDate = validatedData.effectiveDate
      ? parseLocalDate(validatedData.effectiveDate)
      : undefined;

    if ((type === 'ENTRADA' || type === 'SAIDA') && quantity <= 0) {
      return res.status(400).json({
        error: 'Quantity must be greater than zero for ENTRADA and SAIDA',
      });
    }

    if (type === 'AJUSTE' && quantity < 0) {
      return res.status(400).json({
        error: 'Quantity must be greater than or equal to zero for AJUSTE',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      return applyMovement(tx, {
        userId: req.user.userId,
        productId,
        type,
        quantity,
        reason,
        effectiveDate,
      });
    });

    res.status(201).json({
      movement: result.movement,
      inventory: result.inventory,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error registering movement:', error);
    const status = error.status || 400;
    res.status(status).json({ error: error.message });
  }
};

const undoLastMovement = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await prisma.$transaction(async (tx) =>
      stockUndoService.undoLastMovement(tx, { id, userId: req.user.userId }),
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Error undoing movement:', error);
    const status = error.status || 400;
    const body = { error: error.message };
    if (error.orderNumber) body.orderNumber = error.orderNumber;
    if (error.orderId) body.orderId = error.orderId;
    res.status(status).json(body);
  }
};

module.exports = {
  listInventory,
  getProductHistory,
  registerMovement,
  undoLastMovement,
};

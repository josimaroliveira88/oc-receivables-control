import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { applyMovement } from '../services/stockService.js';
import * as stockUndoService from '../services/stockUndoService.js';
import { movementSchema } from '../validators/stockValidator.js';
import { findIdsByTextSearch } from '../utils/search.js';
import { parseLocalDate } from '../utils/date.js';

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
    handleError(res, error, { label: 'Error fetching inventory' });
  }
};

const getProductHistory = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw notFound('Product not found');
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
        throw notFound('Product not found');
      }
    }

    res.status(200).json(movements);
  } catch (error) {
    handleError(res, error, { label: 'Error fetching stock history' });
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
      throw badRequest(
        'Quantity must be greater than zero for ENTRADA and SAIDA',
      );
    }

    if (type === 'AJUSTE' && quantity < 0) {
      throw badRequest(
        'Quantity must be greater than or equal to zero for AJUSTE',
      );
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
    handleError(res, error, {
      label: 'Error registering movement',
      fallback: 400,
    });
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
    handleError(res, error, {
      label: 'Error undoing movement',
      fallback: 400,
    });
  }
};

export { listInventory, getProductHistory, registerMovement, undoLastMovement };

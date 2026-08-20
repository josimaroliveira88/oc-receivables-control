const prisma = require('../config/database');
const { z } = require('zod');

const movementSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE']),
  quantity: z.number().int(),
  reason: z.string().max(255).optional(),
});

const listInventory = async (req, res) => {
  try {
    const inventory = await prisma.inventory.findMany({
      where: { userId: req.user.userId },
      include: { product: true },
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
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        const error = new Error('Product not found');
        error.status = 404;
        throw error;
      }

      const inventory = await tx.inventory.findUnique({
        where: {
          userId_productId: { userId: req.user.userId, productId },
        },
      });

      const currentQuantity = inventory ? inventory.quantity : 0;

      let signedQuantity;
      let newQuantity;

      if (type === 'AJUSTE') {
        signedQuantity = quantity - currentQuantity;
        newQuantity = quantity;
      } else if (type === 'SAIDA') {
        signedQuantity = -quantity;
        newQuantity = currentQuantity - quantity;
        if (newQuantity < 0) {
          const error = new Error(
            'Insufficient stock: movement would make stock negative',
          );
          error.status = 400;
          throw error;
        }
      } else {
        signedQuantity = quantity;
        newQuantity = currentQuantity + quantity;
      }

      const movement = await tx.stockMovement.create({
        data: {
          userId: req.user.userId,
          productId,
          quantity: signedQuantity,
          type,
          reason: reason ?? null,
        },
      });

      const updatedInventory = await tx.inventory.upsert({
        where: {
          userId_productId: { userId: req.user.userId, productId },
        },
        create: {
          userId: req.user.userId,
          productId,
          quantity: newQuantity,
        },
        update: { quantity: newQuantity },
      });

      return {
        movement,
        inventory: {
          productId,
          quantity: updatedInventory.quantity,
        },
      };
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

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.findUnique({ where: { id } });
      if (!movement || movement.userId !== req.user.userId) {
        const error = new Error('Movement not found');
        error.status = 404;
        throw error;
      }

      const newerCount = await tx.stockMovement.count({
        where: {
          userId: req.user.userId,
          productId: movement.productId,
          createdAt: { gt: movement.createdAt },
        },
      });
      if (newerCount > 0) {
        const error = new Error(
          'Apenas a última movimentação pode ser desfeita',
        );
        error.status = 400;
        throw error;
      }

      const inventory = await tx.inventory.findUnique({
        where: {
          userId_productId: {
            userId: req.user.userId,
            productId: movement.productId,
          },
        },
      });

      const newQuantity =
        (inventory ? inventory.quantity : 0) - movement.quantity;
      if (newQuantity < 0) {
        const error = new Error(
          'Não é possível desfazer: resultaria em estoque negativo',
        );
        error.status = 400;
        throw error;
      }

      const totalForPair = await tx.stockMovement.count({
        where: {
          userId: req.user.userId,
          productId: movement.productId,
        },
      });
      const isOnlyMovement = totalForPair === 1;

      const deletedMovement = await tx.stockMovement.delete({
        where: { id },
      });

      if (isOnlyMovement) {
        if (inventory) {
          await tx.inventory.delete({
            where: {
              userId_productId: {
                userId: req.user.userId,
                productId: movement.productId,
              },
            },
          });
        }
        return {
          movement: deletedMovement,
          inventory: null,
        };
      }

      const updatedInventory = await tx.inventory.update({
        where: {
          userId_productId: {
            userId: req.user.userId,
            productId: movement.productId,
          },
        },
        data: { quantity: newQuantity },
      });

      return {
        movement: deletedMovement,
        inventory: {
          productId: updatedInventory.productId,
          quantity: updatedInventory.quantity,
        },
      };
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error undoing movement:', error);
    const status = error.status || 400;
    res.status(status).json({ error: error.message });
  }
};

module.exports = {
  listInventory,
  getProductHistory,
  registerMovement,
  undoLastMovement,
};

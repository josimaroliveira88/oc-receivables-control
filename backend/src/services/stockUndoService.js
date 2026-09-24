// Undo rules for the last manual stock movement, extracted from the Stock
// controller so they can be unit-tested against a stubbed transaction client.
// `client` is either the Prisma client or a transaction client (`tx`).
// Throws HTTP-mapped errors (via utils/httpError.js), plus `.orderNumber`/
// `.orderId` on the order-lock rejection, which the controller translates
// into the HTTP response.
import { notFound, badRequest } from '../utils/httpError.js';

const undoLastMovement = async (client, { id, userId }) => {
  const movement = await client.stockMovement.findUnique({ where: { id } });
  if (!movement || movement.userId !== userId) {
    throw notFound('Movimentação não encontrada');
  }

  if (movement.orderId) {
    const order = await client.order.findUnique({
      where: { id: movement.orderId },
      select: { orderNumber: true, orderType: true },
    });
    const label = order && order.orderType === 'VENDA' ? 'Venda' : 'Pedido';
    const reference = order ? order.orderNumber : movement.orderId;
    const error = badRequest(
      `Esta movimentação está vinculada ao ${label} ${reference} e só pode ser desfeita editando ou removendo o item correspondente no pedido.`,
    );
    error.orderNumber = order ? order.orderNumber : undefined;
    error.orderId = movement.orderId;
    throw error;
  }

  const newerCount = await client.stockMovement.count({
    where: {
      userId,
      productId: movement.productId,
      createdAt: { gt: movement.createdAt },
    },
  });
  if (newerCount > 0) {
    throw badRequest('Apenas a última movimentação pode ser desfeita');
  }

  const inventory = await client.inventory.findUnique({
    where: {
      userId_productId: { userId, productId: movement.productId },
    },
  });

  const newQuantity = (inventory ? inventory.quantity : 0) - movement.quantity;
  if (newQuantity < 0) {
    throw badRequest('Não é possível desfazer: resultaria em estoque negativo');
  }

  const totalForPair = await client.stockMovement.count({
    where: {
      userId,
      productId: movement.productId,
    },
  });
  const isOnlyMovement = totalForPair === 1;

  const deletedMovement = await client.stockMovement.delete({
    where: { id },
  });

  if (isOnlyMovement) {
    if (inventory) {
      await client.inventory.delete({
        where: {
          userId_productId: { userId, productId: movement.productId },
        },
      });
    }
    return {
      movement: deletedMovement,
      inventory: null,
    };
  }

  const updatedInventory = await client.inventory.update({
    where: {
      userId_productId: { userId, productId: movement.productId },
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
};

export { undoLastMovement };

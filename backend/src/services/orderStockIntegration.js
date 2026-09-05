// Order-to-stock integration: translates purchase-order items into the
// per-product stock movements they generate.
//
// - `itemStockMovements` returns the ENTRADA movement descriptors (with
//   reason and effective date) for every self + forStock item, expanding kit
//   items into their effective stock products (the kit itself or its frozen
//   components, depending on the chosen mode); the caller applies each one
//   through `stockService.applyMovement` inside its own transaction.
// - `reverseOrderStock` applies the SAIDA reversal for every self + forStock
//   item of an order, used by the order-delete path.
// - `reverseItemStock` applies the SAIDA reversal for a single item, used by
//   the item-delete path.
//
// `client` is either the Prisma client or a transaction client (`tx`).
const { expandItemToStockProducts } = require('../utils/kitStock');
const { applyMovement } = require('./stockService');

const itemStockMovements = (client, { order, items }) => {
  if (!order.orderDate) {
    const error = new Error(
      'Data do pedido é obrigatória para movimentações de estoque',
    );
    error.status = 400;
    throw error;
  }

  const movements = [];
  for (const item of items) {
    if (!item.person || !item.person.isSelf) continue;
    for (const { productId, quantity } of expandItemToStockProducts(item)) {
      movements.push({
        userId: order.userId,
        productId,
        type: 'ENTRADA',
        quantity,
        reason: `Pedido ${order.orderNumber}`,
        orderId: order.id,
        itemId: item.id,
        effectiveDate: order.orderDate,
      });
    }
  }
  return movements;
};

// Applies the SAIDA reversal for every self + forStock item of an order.
// Team orders never affected the user's stock, so the caller must skip this.
const reverseOrderStock = async (client, { order, items }) => {
  for (const item of items) {
    if (!item.person || !item.person.isSelf) continue;
    for (const { productId, quantity } of expandItemToStockProducts(item)) {
      await applyMovement(client, {
        userId: order.userId,
        productId,
        type: 'SAIDA',
        quantity,
        reason: `Pedido ${order.orderNumber}`,
        orderId: order.id,
        effectiveDate: order.orderDate,
      });
    }
  }
};

// Applies the SAIDA reversal for a single item (item-delete path).
const reverseItemStock = async (client, { order, item }) => {
  for (const { productId, quantity } of expandItemToStockProducts(item)) {
    await applyMovement(client, {
      userId: order.userId,
      productId,
      type: 'SAIDA',
      quantity,
      reason: `Pedido ${order.orderNumber}`,
      orderId: order.id,
      itemId: item.id,
      effectiveDate: order.orderDate,
    });
  }
};

module.exports = {
  itemStockMovements,
  reverseOrderStock,
  reverseItemStock,
};

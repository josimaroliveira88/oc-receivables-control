// Canonical stock movement primitive shared by the manual Stock controller and
// the automatic order-to-stock integration. `client` is either the Prisma
// client or a transaction client (`tx`), so callers can keep consistency
// within their own transaction.
const applyMovement = async (
  client,
  {
    userId,
    productId,
    type,
    quantity,
    reason = null,
    orderId = null,
    itemId = null,
    effectiveDate = null,
  },
) => {
  const product = await client.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    const error = new Error('Product not found');
    error.status = 404;
    throw error;
  }

  const inventory = await client.inventory.findUnique({
    where: {
      userId_productId: { userId, productId },
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
        `Estoque insuficiente para ${
          product.name || product.code
        }: disponível ${currentQuantity}, necessário ${quantity}`,
      );
      error.status = 400;
      throw error;
    }
  } else {
    signedQuantity = quantity;
    newQuantity = currentQuantity + quantity;
  }

  const movement = await client.stockMovement.create({
    data: {
      userId,
      productId,
      quantity: signedQuantity,
      type,
      reason: reason ?? null,
      orderId: orderId ?? null,
      itemId: itemId ?? null,
      effectiveDate: effectiveDate ?? new Date(),
    },
  });

  const updatedInventory = await client.inventory.upsert({
    where: {
      userId_productId: { userId, productId },
    },
    create: {
      userId,
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
};

module.exports = { applyMovement };

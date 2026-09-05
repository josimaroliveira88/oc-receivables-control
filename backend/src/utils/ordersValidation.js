// Purchase-order validation helpers. Throws Errors with `.status` (400)
// which the service/controller map to the HTTP response; R10 replaces these
// with the shared httpError helpers.

// Verify all products exist and are available (ATIVO or INDISPONIVEL; INATIVO is rejected)
const validateProducts = async (client, items) => {
  const productIds = [
    ...new Set(items.map((item) => item.productId).filter(Boolean)),
  ];
  if (productIds.length === 0) return;

  const products = await client.product.findMany({
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

// Items flagged `forStock` are only meaningful for the self person and must
// reference a catalog product (stock is tracked per product).
const validateStockItemRules = (items, selfPersonIds) => {
  for (const item of items) {
    if (!item.forStock) continue;
    if (!selfPersonIds.has(item.personId)) {
      const error = new Error(
        'Stock items are only allowed for the user themselves',
      );
      error.status = 400;
      throw error;
    }
    if (!item.productId) {
      const error = new Error('Stock items require a catalog product');
      error.status = 400;
      throw error;
    }
  }
};

const selfPersonIdSet = (persons) =>
  new Set(persons.filter((p) => p.isSelf).map((p) => p.id));

// Purchase-order endpoints must reject sale orders so their inverted stock
// semantics are never accidentally triggered through the /api/orders routes.
const assertNotSaleOrder = (order) => {
  if (order.orderType === 'VENDA') {
    const error = new Error(
      'Este é um pedido de venda; use os endpoints de vendas (/api/sales)',
    );
    error.status = 400;
    throw error;
  }
};

module.exports = {
  validateProducts,
  validateStockItemRules,
  selfPersonIdSet,
  assertNotSaleOrder,
};

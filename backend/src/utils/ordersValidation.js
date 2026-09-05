// Purchase-order validation helpers. Throws HTTP-mapped errors (via
// utils/httpError.js) which the service/controller translate into the HTTP
// response.
import { badRequest } from './httpError.js';

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
    throw badRequest('One or more products are inactive or do not exist');
  }
};

// Items flagged `forStock` are only meaningful for the self person and must
// reference a catalog product (stock is tracked per product).
const validateStockItemRules = (items, selfPersonIds) => {
  for (const item of items) {
    if (!item.forStock) continue;
    if (!selfPersonIds.has(item.personId)) {
      throw badRequest('Stock items are only allowed for the user themselves');
    }
    if (!item.productId) {
      throw badRequest('Stock items require a catalog product');
    }
  }
};

const selfPersonIdSet = (persons) =>
  new Set(persons.filter((p) => p.isSelf).map((p) => p.id));

// Purchase-order endpoints must reject sale orders so their inverted stock
// semantics are never accidentally triggered through the /api/orders routes.
const assertNotSaleOrder = (order) => {
  if (order.orderType === 'VENDA') {
    throw badRequest(
      'Este é um pedido de venda; use os endpoints de vendas (/api/sales)',
    );
  }
};

export {
  validateProducts,
  validateStockItemRules,
  selfPersonIdSet,
  assertNotSaleOrder,
};

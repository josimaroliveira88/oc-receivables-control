// Validates a kit composition before it is persisted:
// - KIT products require at least one component.
// - SIMPLES products cannot have components.
// - Components must exist, be unique, not be the kit itself, and be SIMPLES
//   (nested kits are forbidden).
// `client` is either the Prisma client or a transaction client (`tx`).
// Throws HTTP-mapped errors (via utils/httpError.js) which the controller
// translates into the HTTP response.
import { badRequest } from '../utils/httpError.js';

const validateKitComponents = async (
  client,
  { productId = null, productType, components },
) => {
  const list = components || [];

  if (productType === 'KIT' && list.length === 0) {
    throw badRequest('A KIT product must have at least one component');
  }
  if (productType === 'SIMPLES' && list.length > 0) {
    throw badRequest('Components are only allowed for KIT products');
  }
  if (list.length === 0) return;

  const ids = list.map((c) => c.componentProductId);
  if (new Set(ids).size !== ids.length) {
    throw badRequest('A kit cannot contain the same component twice');
  }
  if (productId && ids.includes(productId)) {
    throw badRequest('A kit cannot contain itself');
  }

  const products = await client.product.findMany({
    where: { id: { in: ids } },
  });
  if (products.length !== ids.length) {
    throw badRequest('One or more components do not exist');
  }
  const notSimples = products.find((p) => p.productType === 'KIT');
  if (notSimples) {
    throw badRequest('A kit can only contain SIMPLES products');
  }
};

export { validateKitComponents };

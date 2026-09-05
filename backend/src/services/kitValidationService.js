// Validates a kit composition before it is persisted:
// - KIT products require at least one component.
// - SIMPLES products cannot have components.
// - Components must exist, be unique, not be the kit itself, and be SIMPLES
//   (nested kits are forbidden).
// `client` is either the Prisma client or a transaction client (`tx`).
// Throws errors with `.status` which the controller translates into the HTTP
// response.
const validateKitComponents = async (
  client,
  { productId = null, productType, components },
) => {
  const list = components || [];

  if (productType === 'KIT' && list.length === 0) {
    const error = new Error('A KIT product must have at least one component');
    error.status = 400;
    throw error;
  }
  if (productType === 'SIMPLES' && list.length > 0) {
    const error = new Error('Components are only allowed for KIT products');
    error.status = 400;
    throw error;
  }
  if (list.length === 0) return;

  const ids = list.map((c) => c.componentProductId);
  if (new Set(ids).size !== ids.length) {
    const error = new Error('A kit cannot contain the same component twice');
    error.status = 400;
    throw error;
  }
  if (productId && ids.includes(productId)) {
    const error = new Error('A kit cannot contain itself');
    error.status = 400;
    throw error;
  }

  const products = await client.product.findMany({
    where: { id: { in: ids } },
  });
  if (products.length !== ids.length) {
    const error = new Error('One or more components do not exist');
    error.status = 400;
    throw error;
  }
  const notSimples = products.find((p) => p.productType === 'KIT');
  if (notSimples) {
    const error = new Error('A kit can only contain SIMPLES products');
    error.status = 400;
    throw error;
  }
};

module.exports = { validateKitComponents };

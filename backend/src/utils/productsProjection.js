const { toCents, pricePerPv } = require('./money');

const priceFieldsPresent = (data) =>
  data.regularPrice !== undefined ||
  data.memberPrice !== undefined ||
  data.pv !== undefined;

const priceFieldsEqual = (a, b) =>
  toCents(a.regularPrice) === toCents(b.regularPrice) &&
  toCents(a.memberPrice) === toCents(b.memberPrice) &&
  toCents(a.pv) === toCents(b.pv);

// Projects a product row (with its current-price include) into the API shape
// consumed by the product list/detail endpoints and the product form.
const projectCurrentPrice = (product) => {
  const currentPrice = product.prices
    ? product.prices.find((price) => price.validTo === null)
    : null;
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    size: product.size,
    status: product.status,
    productType: product.productType ?? 'SIMPLES',
    doterraUrl: product.doterraUrl,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    regularPrice: currentPrice ? currentPrice.regularPrice : null,
    memberPrice: currentPrice ? currentPrice.memberPrice : null,
    pv: currentPrice ? currentPrice.pv : null,
    pricePerPv: currentPrice
      ? pricePerPv(currentPrice.memberPrice, currentPrice.pv)
      : null,
    components: (product.kitComponents || []).map((c) => ({
      componentProductId: c.componentProductId,
      quantity: c.quantity,
    })),
  };
};

module.exports = { projectCurrentPrice, priceFieldsPresent, priceFieldsEqual };

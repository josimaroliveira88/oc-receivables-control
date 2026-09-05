const { resolveKitSnapshot } = require('./kitStock');
const { lineValueCents } = require('./money');

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

const itemCreateData = (item) => ({
  description: item.description || null,
  chargedValue: item.chargedValue,
  personId: item.personId,
  productId: item.productId || null,
  memberPrice: item.memberPrice ?? null,
  details: item.details || null,
  quantity: item.quantity ?? 1,
  forStock: item.forStock ?? false,
  chargedValueMode: item.chargedValueMode ?? 'UNIT',
  kitStockMode: item.kitStockMode ?? null,
  ...(item.kitSnapshot !== undefined
    ? { kitSnapshot: item.kitSnapshot ?? null }
    : {}),
});

// Attaches the frozen kit snapshot (and validates the stock mode) to each item
// based on its product type. For KIT products the current composition is
// snapshotted into `kitSnapshot`; for non-kit products the kit fields are
// cleared. A forStock item referencing a KIT product must provide a
// `kitStockMode` (KIT or COMPONENTS).
const resolveKitFields = async (client, items) => {
  const productIds = [
    ...new Set(items.map((item) => item.productId).filter(Boolean)),
  ];
  const products =
    productIds.length === 0
      ? []
      : await client.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, productType: true },
        });
  const typeById = new Map(products.map((p) => [p.id, p.productType]));

  for (const item of items) {
    const type = item.productId ? typeById.get(item.productId) : null;
    if (type === 'KIT') {
      if (item.forStock && !item.kitStockMode) {
        const error = new Error(
          'Stock items for KIT products require a kitStockMode (KIT or COMPONENTS)',
        );
        error.status = 400;
        throw error;
      }
      item.kitStockMode = item.kitStockMode ?? null;
      item.kitSnapshot = await resolveKitSnapshot(client, item.productId);
    } else {
      item.kitStockMode = null;
      item.kitSnapshot = null;
    }
  }
};

// Resolves the kit fields of a single edited item, preserving the frozen
// snapshot whenever the product (kit) is unchanged so kit composition changes
// never affect stock control of already-registered orders (requirement 5).
const resolveEditedKitFields = async (client, oldItem, newItem) => {
  if (newItem.productId !== oldItem.productId) {
    await resolveKitFields(client, [newItem]);
    return;
  }
  const type = newItem.productId
    ? (
        await client.product.findUnique({
          where: { id: newItem.productId },
          select: { productType: true },
        })
      )?.productType
    : null;
  if (type === 'KIT') {
    if (newItem.forStock && !newItem.kitStockMode && !oldItem.kitStockMode) {
      const error = new Error(
        'Stock items for KIT products require a kitStockMode (KIT or COMPONENTS)',
      );
      error.status = 400;
      throw error;
    }
    newItem.kitStockMode = newItem.kitStockMode ?? oldItem.kitStockMode ?? null;
    newItem.kitSnapshot = oldItem.kitSnapshot ?? null;
  } else {
    newItem.kitStockMode = null;
    newItem.kitSnapshot = null;
  }
};

// Resolves the frozen kit snapshot per payload item during a bulk order update,
// preserving the snapshot of unchanged kit items (matched by id) so kit
// composition changes never affect stock control of already-registered orders.
// Items without a matching id are created fresh (current composition snapshot).
const resolveOrderUpdateItems = async (client, existingItems, payloadItems) => {
  const oldById = new Map(existingItems.map((it) => [it.id, it]));
  const resolved = [];
  for (const item of payloadItems) {
    const existing = item.id ? oldById.get(item.id) : null;
    const productChanged =
      !existing || existing.productId !== (item.productId ?? null);
    if (productChanged) {
      await resolveKitFields(client, [item]);
      resolved.push({ ...item, __existingId: existing ? existing.id : null });
      continue;
    }
    // Same product: preserve the frozen snapshot.
    const type = item.productId
      ? (
          await client.product.findUnique({
            where: { id: item.productId },
            select: { productType: true },
          })
        )?.productType
      : null;
    if (type === 'KIT') {
      if (item.forStock && !item.kitStockMode && !existing.kitStockMode) {
        const error = new Error(
          'Stock items for KIT products require a kitStockMode (KIT or COMPONENTS)',
        );
        error.status = 400;
        throw error;
      }
      item.kitStockMode = item.kitStockMode ?? existing.kitStockMode ?? null;
      item.kitSnapshot = existing.kitSnapshot ?? null;
    } else {
      item.kitStockMode = null;
      item.kitSnapshot = null;
    }
    resolved.push({ ...item, __existingId: existing.id });
  }
  return resolved;
};

const orderLineTotalCents = (items) =>
  items.reduce((sum, item) => sum + lineValueCents(item), 0);

// Shape used by computeOrderStatus (which needs quantity/chargedValueMode for
// line-value math in addition to personId/chargedValue/person).
const statusItemFromItem = (item) => ({
  personId: item.personId,
  chargedValue: item.chargedValue,
  quantity: item.quantity,
  chargedValueMode: item.chargedValueMode,
  person: item.person,
});

module.exports = {
  validateProducts,
  validateStockItemRules,
  selfPersonIdSet,
  assertNotSaleOrder,
  itemCreateData,
  resolveKitFields,
  resolveEditedKitFields,
  resolveOrderUpdateItems,
  orderLineTotalCents,
  statusItemFromItem,
};

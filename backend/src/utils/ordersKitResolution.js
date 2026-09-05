// Kit-snapshot resolution for the purchase-order write paths. Each helper
// attaches (or preserves) the frozen `kitSnapshot` and `kitStockMode` on each
// item based on its product type, enforcing the "kit composition changes never
// affect stock control of already-registered orders" rule (requirement 5).
import { resolveKitSnapshot } from './kitStock.js';
import { badRequest } from './httpError.js';

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
        throw badRequest(
          'Stock items for KIT products require a kitStockMode (KIT or COMPONENTS)',
        );
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
      throw badRequest(
        'Stock items for KIT products require a kitStockMode (KIT or COMPONENTS)',
      );
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
        throw badRequest(
          'Stock items for KIT products require a kitStockMode (KIT or COMPONENTS)',
        );
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

export { resolveKitFields, resolveEditedKitFields, resolveOrderUpdateItems };

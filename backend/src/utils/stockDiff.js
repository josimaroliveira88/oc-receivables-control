// Computes the net per-product stock delta (in whole units) between two item
// lists, considering only items that belong to the self person AND are flagged
// for stock (forStock). Used by the order update flow (which replaces all items
// destructively) to know how much stock to add or reverse.
//
// Items may come from a DB query (with `forStock`, `quantity`, `productId`,
// `personId`) or from the validated request payload.
// `selfPersonIds` is a Set of person ids that represent the user themselves.
const computeStockDiff = (oldItems, newItems, selfPersonIds) => {
  const stockByProduct = (items) => {
    const map = new Map();
    for (const item of items) {
      if (!item.forStock) continue;
      if (!item.productId) continue;
      if (!selfPersonIds.has(item.personId)) continue;
      const qty = Math.max(1, Number(item.quantity) || 1);
      map.set(item.productId, (map.get(item.productId) || 0) + qty);
    }
    return map;
  };

  const oldMap = stockByProduct(oldItems);
  const newMap = stockByProduct(newItems);

  const productIds = new Set([...oldMap.keys(), ...newMap.keys()]);
  const result = [];
  for (const productId of productIds) {
    const delta = (newMap.get(productId) || 0) - (oldMap.get(productId) || 0);
    if (delta !== 0) result.push({ productId, delta });
  }
  return result;
};

module.exports = { computeStockDiff };

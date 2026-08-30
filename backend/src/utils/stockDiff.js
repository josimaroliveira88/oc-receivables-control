const {
  expandItemToStockProducts,
  expandSaleItemToStockProducts,
} = require('./kitStock');

// Computes the net per-product stock delta (in whole units) between two item
// lists, considering only items that belong to the self person AND are flagged
// for stock (forStock). Used by the order update flow to know how much stock to
// add or reverse.
//
// Items may come from a DB query (with `forStock`, `quantity`, `productId`,
// `personId`, and for kit items `kitStockMode`/`kitSnapshot`) or from the
// validated request payload. Kit items are expanded to their effective stock
// products via `expandItemToStockProducts` so the diff naturally handles kit vs
// components modes and quantity changes.
// `selfPersonIds` is a Set of person ids that represent the user themselves.
const computeStockDiff = (oldItems, newItems, selfPersonIds) => {
  const stockByProduct = (items) => {
    const map = new Map();
    for (const item of items) {
      if (!selfPersonIds.has(item.personId)) continue;
      for (const { productId, quantity } of expandItemToStockProducts(item)) {
        map.set(productId, (map.get(productId) || 0) + quantity);
      }
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

// Computes the net per-product stock delta between two item lists for SALE
// orders, where every item affects stock: there is no self-person/forStock
// filter. A positive delta means the new list sells more units (SAIDA), a
// negative delta restores stock (ENTRADA). Kit items keep expanding through
// the same `expandSaleItemToStockProducts` path as create/delete.
const computeSaleStockDiff = (oldItems, newItems) => {
  const stockByProduct = (items) => {
    const map = new Map();
    for (const item of items) {
      for (const { productId, quantity } of expandSaleItemToStockProducts(
        item,
      )) {
        map.set(productId, (map.get(productId) || 0) + quantity);
      }
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

module.exports = { computeStockDiff, computeSaleStockDiff };

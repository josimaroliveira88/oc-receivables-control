// Kit helpers shared by the order-to-stock integration.
//
// A KIT product stores its live composition in KitComposition. Order items
// freeze that composition into Item.kitSnapshot at creation time so that later
// edits to a kit never affect stock control of already-registered orders
// (requirement 5). `expandItemToStockProducts` translates an order item into
// the concrete per-product stock effect, honoring the user's chosen mode.

// Reads the current composition of a KIT product from the database.
// `client` is either the Prisma client or a transaction client (`tx`).
const resolveKitSnapshot = async (client, productId) => {
  const composition = await client.kitComposition.findMany({
    where: { kitProductId: productId },
  });
  return composition.map((c) => ({
    componentProductId: c.componentProductId,
    quantity: c.quantity,
  }));
};

// Expands an order item into its effective stock products:
// - COMPONENTS mode: each frozen snapshot component, scaled by item quantity
//   (componentQty × itemQty).
// - KIT mode (or non-kit products): the product itself, scaled by item quantity.
// Returns an empty array for non-stock items or items without a product.
const expandItemToStockProducts = (item) => {
  if (!item.forStock) return [];
  if (!item.productId) return [];

  const qty = Math.max(1, Number(item.quantity) || 1);
  if (
    item.kitStockMode === 'COMPONENTS' &&
    Array.isArray(item.kitSnapshot) &&
    item.kitSnapshot.length > 0
  ) {
    return item.kitSnapshot.map((c) => ({
      productId: c.componentProductId,
      quantity: (Number(c.quantity) || 1) * qty,
    }));
  }
  return [{ productId: item.productId, quantity: qty }];
};

module.exports = { resolveKitSnapshot, expandItemToStockProducts };

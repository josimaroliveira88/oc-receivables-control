// Hard-cleanup of the draft products an imported order created, run when the
// order is deleted. A draft (`ProductStatus.PENDENTE_CADASTRO`) is only
// removed when nothing else depends on it: another order item, a stock
// movement from another source, a kit composition, or an inventory row of
// another user. Regular products are never touched here — deleting their
// order keeps today's compensating-movement behavior.
//
// Collection must happen before `tx.order.delete`, because deleting the order
// nulls `StockMovement.orderId`.

// Collects the draft product ids referenced by the order's items and the ids
// of the stock movements the order produced (including the reversal just
// applied). Both are needed after the order is gone.
const collectDraftCleanup = async (tx, { order }) => {
  const candidateProductIds = [
    ...new Set(
      (order.items || [])
        .filter((item) => item.product?.status === 'PENDENTE_CADASTRO')
        .map((item) => item.productId),
    ),
  ];

  const movements =
    candidateProductIds.length === 0
      ? []
      : await tx.stockMovement.findMany({
          where: { orderId: order.id },
          select: { id: true, productId: true },
        });

  return { candidateProductIds, movements };
};

// Deletes each candidate draft that no longer has any dependency. `movements`
// are the order's movement ids collected by `collectDraftCleanup`.
const cleanupDraftProducts = async (
  tx,
  { userId, candidateProductIds, movements },
) => {
  for (const productId of candidateProductIds) {
    const capturedMovementIds = movements
      .filter((movement) => movement.productId === productId)
      .map((movement) => movement.id);

    // The order being deleted owns these movements, so they go with it. Doing
    // it even when the draft survives (it is referenced by another import)
    // avoids leaving stale orphaned history that would block a later cleanup.
    if (capturedMovementIds.length > 0) {
      await tx.stockMovement.deleteMany({
        where: { id: { in: capturedMovementIds } },
      });
    }

    const remainingItems = await tx.item.count({ where: { productId } });
    if (remainingItems > 0) continue;

    const remainingMovements = await tx.stockMovement.count({
      where: { productId },
    });
    if (remainingMovements > 0) continue;

    const kitRefs = await tx.kitComposition.count({
      where: {
        OR: [{ kitProductId: productId }, { componentProductId: productId }],
      },
    });
    if (kitRefs > 0) continue;

    const foreignInventory = await tx.inventory.count({
      where: { productId, userId: { not: userId } },
    });
    if (foreignInventory > 0) continue;

    const ownInventory = await tx.inventory.findFirst({
      where: { productId, userId },
    });
    // The import's ENTRADA + the deletion's SAIDA net to zero; anything else
    // means the user has real stock of this draft, so it must survive.
    if (ownInventory && ownInventory.quantity !== 0) continue;

    if (ownInventory) {
      await tx.inventory.delete({ where: { id: ownInventory.id } });
    }
    await tx.product.delete({ where: { id: productId } });
  }
};

export { collectDraftCleanup, cleanupDraftProducts };

// Product usage tracking: where a catalog product is referenced and what
// prevents a physical deletion. Products cannot be hard-deleted while an
// unrelated row references them through a Restrict foreign key — inventory,
// stock movements, stock-exchange lines, or a kit composition where the
// product is the component. This module reports those references so the UI can
// list them, navigate to each location, remove a reference, and finally delete
// the product once nothing blocks it.
//
// `client` is either the Prisma client or a transaction client (`tx`).
import { badRequest, conflict, notFound } from '../utils/httpError.js';
import { fromCents, lineValueCents, toCents } from '../utils/money.js';
import {
  chargeableAdditionalCents,
  computeOrderStatus,
} from '../utils/receivables.js';
import {
  syncAdditionalExpenseFromSale,
  syncExpenseFromOrder,
} from './financeSyncService.js';

// Stock movements carry no exchange link; the exchange flow prefixes the
// movement reason with `Troca #<id> ...`, which is how we tell them apart from
// order-driven and manual movements.
const EXCHANGE_REASON_PREFIX = 'Troca #';

const isExchangeMovement = (reason) =>
  typeof reason === 'string' && reason.startsWith(EXCHANGE_REASON_PREFIX);

// Reference kinds that can be removed from the product usage panel. Order/sale
// items are not listed here: they are informational (Item.productId is
// SetNull) and are removed through the order/sale editor so the ledger stays
// consistent.
const REFERENCE_KINDS = new Set([
  'inventory',
  'stock-movements',
  'exchange-lines',
  'kit-component',
]);

// Groups the product's order/sale items by order and computes the financial
// impact of removing them (current total -> total after the removal), so the UI
// can warn the user before deleting the product.
const buildAffectedOrders = (orderItems) => {
  const byOrder = new Map();
  for (const item of orderItems) {
    const key = item.order.id;
    if (!byOrder.has(key)) {
      byOrder.set(key, {
        orderId: item.order.id,
        orderNumber: item.order.orderNumber,
        orderType: item.order.orderType,
        isTeamOrder: item.order.isTeamOrder,
        removedItems: 0,
        removedItemsCents: 0,
        oldTotalCents: toCents(item.order.totalValue ?? 0),
      });
    }
    const entry = byOrder.get(key);
    entry.removedItems += 1;
    entry.removedItemsCents += lineValueCents(item);
  }

  return [...byOrder.values()].map((entry) => ({
    ...entry,
    newTotalCents: entry.oldTotalCents - entry.removedItemsCents,
    linkedTransactionOrigin: entry.isTeamOrder
      ? null
      : entry.orderType === 'VENDA'
        ? 'VENDA_ADICIONAL'
        : 'PEDIDO_DOTERRA',
  }));
};

const getProductUsage = async (client, userId, productId) => {
  const product = await client.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      code: true,
      name: true,
      size: true,
      status: true,
      productType: true,
    },
  });

  if (!product) {
    throw notFound('Produto não encontrado');
  }

  const [
    orderItems,
    inventory,
    stockMovements,
    stockExchangeLines,
    kitComponents,
    kitComposition,
  ] = await Promise.all([
    client.item.findMany({
      where: { productId, order: { userId } },
      select: {
        id: true,
        quantity: true,
        chargedValue: true,
        chargedValueMode: true,
        description: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            isTeamOrder: true,
            totalValue: true,
          },
        },
        person: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    client.inventory.findFirst({ where: { userId, productId } }),
    client.stockMovement.findMany({
      where: { userId, productId },
      orderBy: { createdAt: 'desc' },
    }),
    client.stockExchangeLine.findMany({
      where: { productId, exchange: { userId } },
      include: {
        exchange: {
          select: {
            id: true,
            effectiveDate: true,
            observation: true,
            person: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    client.kitComposition.findMany({
      where: { componentProductId: productId },
      select: {
        id: true,
        quantity: true,
        kitProductId: true,
        kitProduct: { select: { code: true, name: true } },
      },
    }),
    client.kitComposition.findMany({
      where: { kitProductId: productId },
      select: {
        id: true,
        quantity: true,
        componentProductId: true,
        componentProduct: { select: { code: true, name: true } },
      },
    }),
  ]);

  // A zero-quantity inventory row is not a business blocker (no stock would be
  // lost) but it still holds the Restrict FK, so the delete path removes it.
  const inventoryQuantity = inventory?.quantity ?? 0;

  const blockers = {
    inventory: inventoryQuantity !== 0,
    stockMovements: stockMovements.length > 0,
    stockExchangeLines: stockExchangeLines.length > 0,
    kitComponent: kitComponents.length > 0,
  };

  const references = {
    orderItems: orderItems.map((item) => ({
      id: item.id,
      orderId: item.order.id,
      orderNumber: item.order.orderNumber,
      orderType: item.order.orderType,
      isTeamOrder: item.order.isTeamOrder,
      quantity: item.quantity,
      chargedValue: item.chargedValue,
      description: item.description,
      personName: item.person?.name ?? null,
    })),
    affectedOrders: buildAffectedOrders(orderItems),
    inventory: inventory
      ? { id: inventory.id, quantity: inventory.quantity }
      : null,
    stockMovements: stockMovements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      orderId: movement.orderId,
      effectiveDate: movement.effectiveDate,
      createdAt: movement.createdAt,
      source: movement.orderId
        ? 'order'
        : isExchangeMovement(movement.reason)
          ? 'exchange'
          : 'manual',
    })),
    stockExchangeLines: stockExchangeLines.map((line) => ({
      id: line.id,
      exchangeId: line.exchangeId,
      direction: line.direction,
      quantity: line.quantity,
      unitValueCents: line.unitValueCents,
      effectiveDate: line.exchange.effectiveDate,
      observation: line.exchange.observation,
      personName: line.exchange.person?.name ?? null,
    })),
    kitComponents: kitComponents.map((composition) => ({
      id: composition.id,
      kitProductId: composition.kitProductId,
      kitCode: composition.kitProduct.code,
      kitName: composition.kitProduct.name,
      quantity: composition.quantity,
    })),
    kitComposition: kitComposition.map((composition) => ({
      id: composition.id,
      componentProductId: composition.componentProductId,
      componentCode: composition.componentProduct.code,
      componentName: composition.componentProduct.name,
      quantity: composition.quantity,
    })),
  };

  const counts = {
    orderItems: references.orderItems.length,
    inventory: inventory ? 1 : 0,
    stockMovements: references.stockMovements.length,
    stockExchangeLines: references.stockExchangeLines.length,
    kitComponents: references.kitComponents.length,
    kitComposition: references.kitComposition.length,
  };

  const deletable = !(
    blockers.inventory ||
    blockers.stockMovements ||
    blockers.stockExchangeLines ||
    blockers.kitComponent
  );

  return { product, references, blockers, counts, deletable };
};

// Physically removes the product once no blocker remains. Runs in a single
// transaction: a concurrent reference added between the check and the delete
// rolls the whole thing back with a P2003, which the caller maps to an error.
const hardDeleteProduct = async (client, { userId, productId }) => {
  return client.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw notFound('Produto não encontrado');
    }

    const usage = await getProductUsage(tx, userId, productId);
    if (!usage.deletable) {
      const error = conflict(
        'Este produto ainda possui referências que impedem a exclusão',
      );
      error.blockers = usage.blockers;
      error.counts = usage.counts;
      throw error;
    }

    // Drop the zero-quantity inventory rows so the Restrict FK does not block.
    // A non-zero row would already have been reported as a blocker.
    await tx.inventory.deleteMany({ where: { productId, quantity: 0 } });

    // KitComposition (as kit), ProductPrice and Item.productId are handled by
    // their onDelete rules (Cascade / SetNull) when the product row goes away.
    await tx.product.delete({ where: { id: productId } });

    return { message: 'Produto excluído com sucesso', counts: usage.counts };
  });
};

// Removes one reference kind so a later hard-delete can proceed. Every call is
// destructive and must be confirmed by the user in the UI.
const removeProductReference = async (client, { userId, productId, kind }) => {
  if (!REFERENCE_KINDS.has(kind)) {
    throw badRequest('Tipo de referência inválido');
  }

  return client.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw notFound('Produto não encontrado');
    }

    let removed = 0;
    if (kind === 'inventory') {
      const result = await tx.inventory.deleteMany({ where: { productId } });
      removed = result.count;
    } else if (kind === 'stock-movements') {
      const result = await tx.stockMovement.deleteMany({
        where: { userId, productId },
      });
      removed = result.count;
    } else if (kind === 'exchange-lines') {
      const result = await tx.stockExchangeLine.deleteMany({
        where: { productId, exchange: { userId } },
      });
      removed = result.count;
    } else if (kind === 'kit-component') {
      const result = await tx.kitComposition.deleteMany({
        where: { componentProductId: productId },
      });
      removed = result.count;
    }

    return { removed };
  });
};

// One-shot physical deletion: clears every reference (including the blocking
// ones) and deletes the product in a single transaction. Used by the
// "Excluir produto" action so the user never has to edit an order/sale — the
// item references are unlinked automatically through the `Item.productId`
// SetNull rule, so no financial or stock recompute is triggered. The blocking
// rows are removed globally (the catalog product is global) to guarantee the
// Restrict FKs do not abort the delete.
// Removes every item that references the product from its orders/sales and
// recomputes the affected order totals, status and linked ledger rows. Stock is
// not reversed here: the product's own movements/inventory are deleted by the
// purge, so any reversal would target the product being removed.
const removeProductItemsFromOrders = async (tx, { userId, productId }) => {
  const items = await tx.item.findMany({
    where: { productId, order: { userId } },
    select: { orderId: true },
  });
  const orderIds = [...new Set(items.map((item) => item.orderId))];
  const summaries = [];

  for (const orderId of orderIds) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { person: true } } },
    });
    if (!order) continue;

    await tx.item.deleteMany({ where: { orderId, productId } });

    const remaining = order.items.filter(
      (item) => item.productId !== productId,
    );
    const payments = await tx.payment.findMany({ where: { orderId } });
    const shippingCents = toCents(order.shippingValue ?? 0);
    const additionalCents =
      order.orderType === 'VENDA' ? chargeableAdditionalCents(order) : 0;
    const itemsCents = remaining.reduce(
      (sum, item) => sum + lineValueCents(item),
      0,
    );
    const totalCents = itemsCents + shippingCents + additionalCents;

    const status = computeOrderStatus({
      items: remaining,
      payments,
      shippingCents,
      additionalCents,
      isTeamOrder: order.isTeamOrder,
    });

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        totalValue: fromCents(totalCents).toFixed(2),
        status,
        ...(order.orderType === 'COMPRA' && {
          doterraValue: fromCents(totalCents).toFixed(2),
        }),
      },
    });

    if (order.orderType === 'COMPRA') {
      await syncExpenseFromOrder(tx, { userId, order: updatedOrder });
    } else {
      await syncAdditionalExpenseFromSale(tx, { userId, order: updatedOrder });
    }

    summaries.push({
      orderId,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      remainingItems: remaining.length,
      totalCents,
    });
  }

  return summaries;
};

const purgeProduct = async (client, { userId, productId }) => {
  return client.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw notFound('Produto não encontrado');
    }

    const usage = await getProductUsage(tx, userId, productId);

    // Remove the order/sale items that reference the product and recompute
    // their totals, status and linked ledger rows (the item values change now).
    const affectedOrders = await removeProductItemsFromOrders(tx, {
      userId,
      productId,
    });

    const inventory = await tx.inventory.deleteMany({ where: { productId } });
    const movements = await tx.stockMovement.deleteMany({
      where: { productId },
    });
    const exchangeLines = await tx.stockExchangeLine.deleteMany({
      where: { productId },
    });
    const kitComponents = await tx.kitComposition.deleteMany({
      where: { componentProductId: productId },
    });

    // KitComposition (as kit), ProductPrice and any remaining Item.productId
    // links are handled by their onDelete rules when the product row goes away.
    await tx.product.delete({ where: { id: productId } });

    return {
      message: 'Produto excluído com sucesso',
      counts: usage.counts,
      affectedOrders,
      removed: {
        inventory: inventory.count,
        stockMovements: movements.count,
        stockExchangeLines: exchangeLines.count,
        kitComponents: kitComponents.count,
      },
    };
  });
};

export {
  getProductUsage,
  hardDeleteProduct,
  removeProductReference,
  purgeProduct,
  REFERENCE_KINDS,
};

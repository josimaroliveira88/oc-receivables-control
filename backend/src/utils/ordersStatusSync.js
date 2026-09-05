// Status sync helpers for the purchase-order write paths. After an item
// mutation the order's status may need to flip (PENDENTE -> PARCIAL ->
// QUITADO), and the helper below centralizes the "fetch payments, recompute,
// persist when changed" sequence used by every handler that mutates items.
const { computeOrderStatus } = require('./receivables');

// Recomputes the order's status from its current items + payments, persisting
// the change when it differs from the stored status. The caller passes the
// already-loaded items so this works for the create path (where the order row
// was just inserted) and for the update paths (where items were reloaded
// after the mutation). `client` is either the Prisma client or a transaction
// client (`tx`).
const syncOrderStatus = async (
  client,
  { orderId, items, shippingCents, isTeamOrder },
) => {
  const payments = await client.payment.findMany({
    where: { orderId },
  });
  const newStatus = computeOrderStatus({
    items,
    payments,
    shippingCents,
    isTeamOrder,
  });
  const current = await client.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (current && current.status !== newStatus) {
    await client.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });
  }
  return { status: newStatus };
};

module.exports = { syncOrderStatus };

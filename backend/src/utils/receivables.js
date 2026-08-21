const { toCents, lineValueCents } = require('./money');

// A person flagged with `isSelf` represents the logged-in user themselves.
// Items owned by the self person are considered already received, so they
// never contribute to the pending balance nor block an order from being QUITADO.

// Builds a Set of personId values whose person has isSelf === true.
const collectSelfPersonIds = (items) =>
  new Set(
    items
      .filter((item) => item.person && item.person.isSelf)
      .map((item) => item.personId)
      .filter(Boolean),
  );

// Pending cents for a single person. Self persons always have 0 pending.
const personPendingCents = ({ itemCents, paymentCents, isSelf }) => {
  if (isSelf) return 0;
  return Math.max(0, itemCents - paymentCents);
};

// Computes the order status from its items and payments.
// - items: [{ personId, chargedValue, person?: { isSelf } }]
// - payments: [{ personId, amount }]
// Items without a person are ignored (existing behavior).
const computeOrderStatus = ({ items, payments = [] }) => {
  const selfPersonIds = collectSelfPersonIds(items);

  const itemSums = new Map();
  for (const item of items) {
    const pid = item.personId;
    if (!pid) continue;
    itemSums.set(pid, (itemSums.get(pid) || 0) + lineValueCents(item));
  }

  const paymentSums = new Map();
  let hasAnyPayment = false;
  for (const payment of payments) {
    const pid = payment.personId;
    if (!pid) continue;
    const cents = toCents(payment.amount);
    paymentSums.set(pid, (paymentSums.get(pid) || 0) + cents);
    if (cents > 0) hasAnyPayment = true;
  }

  let allPaid = true;
  for (const [pid, itemCents] of itemSums) {
    if (selfPersonIds.has(pid)) continue; // self persons are always settled
    const paymentCents = paymentSums.get(pid) || 0;
    const hasPayment = paymentSums.has(pid);
    if (itemCents > 0) {
      if (paymentCents < itemCents) {
        allPaid = false;
        break;
      }
    } else if (!hasPayment) {
      // Zero-value (gift) item still awaits the "dar baixa" payment
      allPaid = false;
      break;
    }
  }

  if (allPaid) return 'QUITADO';
  return hasAnyPayment ? 'PARCIAL' : 'PENDENTE';
};

// Recomputes and persists the status of the given orders when it changes.
const syncOrderStatuses = async (db, orderIds) => {
  for (const orderId of orderIds) {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { person: true } }, payments: true },
    });
    if (!order) continue;
    const nextStatus = computeOrderStatus({
      items: order.items,
      payments: order.payments,
    });
    if (nextStatus !== order.status) {
      await db.order.update({
        where: { id: orderId },
        data: { status: nextStatus },
      });
    }
  }
};

// Recomputes status for every order of the user that contains an item of any
// of the given persons (used when a person becomes/is no longer `isSelf`).
const syncOrderStatusesForPersons = async (db, userId, personIds) => {
  const ids = [...new Set(personIds.filter(Boolean))];
  if (ids.length === 0) return;

  const items = await db.item.findMany({
    where: { personId: { in: ids }, order: { userId } },
    select: { orderId: true },
    distinct: ['orderId'],
  });

  const orderIds = [...new Set(items.map((i) => i.orderId))];
  await syncOrderStatuses(db, orderIds);
};

module.exports = {
  collectSelfPersonIds,
  personPendingCents,
  computeOrderStatus,
  syncOrderStatuses,
  syncOrderStatusesForPersons,
};

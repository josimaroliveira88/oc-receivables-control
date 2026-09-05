const { toCents, fromCents } = require('./money');
const { personBalanceFromTotals } = require('./orderBalances');

// Pure projection of the dashboard summary. Receives the user's non-team
// orders (with items+person and payments included) and the payments of those
// orders, and returns the KPIs, per-person balances, and yearly breakdown.
// Self-person exclusion (pending 0) and the KPI rules below are preserved
// verbatim from the controller that previously owned this logic:
// - QUITADO orders count their full totalValue as paid;
// - other orders count totalValue minus self items minus payments as
//   pending, clamped at zero;
// - the yearly breakdown does NOT subtract payments from pending.
const buildDashboardSummary = (
  orders,
  allPayments,
  { currentDate = new Date() } = {},
) => {
  let totalPendingCents = 0;
  let totalPaidCents = 0;

  for (const order of orders) {
    const orderPaymentSumCents = order.payments.reduce(
      (sum, p) => sum + toCents(p.amount),
      0,
    );
    const orderTotalCents = toCents(order.totalValue);
    const selfItemsCents = order.items.reduce(
      (sum, i) =>
        sum + (i.person && i.person.isSelf ? toCents(i.chargedValue) : 0),
      0,
    );

    if (order.status === 'QUITADO') {
      totalPaidCents += orderTotalCents;
    } else {
      const orderPendingCents =
        orderTotalCents - selfItemsCents - orderPaymentSumCents;
      totalPendingCents += orderPendingCents > 0 ? orderPendingCents : 0;
    }
  }

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const currentMonthReceiptsCents = allPayments
    .filter((p) => {
      const paidAt = new Date(p.paidAt);
      return (
        paidAt.getFullYear() === currentYear &&
        paidAt.getMonth() === currentMonth
      );
    })
    .reduce((sum, p) => sum + toCents(p.amount), 0);

  const personMap = new Map();

  for (const order of orders) {
    for (const item of order.items) {
      const pid = item.personId || 'unknown';
      const name = item.person ? item.person.name : 'Sem pessoa';

      if (!personMap.has(pid)) {
        personMap.set(pid, {
          personId: pid,
          personName: name,
          isSelf: Boolean(item.person && item.person.isSelf),
          itemTotalCents: 0,
          paymentTotalCents: 0,
        });
      }
      personMap.get(pid).itemTotalCents += toCents(item.chargedValue);
    }

    for (const payment of order.payments) {
      const pid = payment.personId || 'unknown';
      const name = payment.person ? payment.person.name : 'Sem pessoa';

      if (!personMap.has(pid)) {
        personMap.set(pid, {
          personId: pid,
          personName: name,
          isSelf: false,
          itemTotalCents: 0,
          paymentTotalCents: 0,
        });
      }
      personMap.get(pid).paymentTotalCents += toCents(payment.amount);
    }
  }

  const personBalances = Array.from(personMap.values())
    .map(personBalanceFromTotals)
    .sort((a, b) => a.personName.localeCompare(b.personName));

  const yearMap = new Map();

  for (const order of orders) {
    const year = order.orderDate.getFullYear();
    const orderTotalCents = toCents(order.totalValue);
    const selfItemsCents = order.items.reduce(
      (sum, i) =>
        sum + (i.person && i.person.isSelf ? toCents(i.chargedValue) : 0),
      0,
    );

    if (!yearMap.has(year)) {
      yearMap.set(year, { year, totalPendingCents: 0, totalQuitadoCents: 0 });
    }

    const entry = yearMap.get(year);
    if (order.status === 'QUITADO') {
      entry.totalQuitadoCents += orderTotalCents;
    } else {
      entry.totalPendingCents += orderTotalCents - selfItemsCents;
    }
  }

  const yearlyBreakdown = Array.from(yearMap.values())
    .map((entry) => ({
      year: entry.year,
      totalPending: fromCents(entry.totalPendingCents),
      totalQuitado: fromCents(entry.totalQuitadoCents),
    }))
    .sort((a, b) => b.year - a.year);

  return {
    totalPending: fromCents(totalPendingCents),
    totalPaid: fromCents(totalPaidCents),
    currentMonthReceipts: fromCents(currentMonthReceiptsCents),
    personBalances,
    yearlyBreakdown,
  };
};

module.exports = { buildDashboardSummary };

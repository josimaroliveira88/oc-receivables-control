// Pure helpers for matching InfinitePay redemptions (and their source deposits)
// against the user's sales. No Prisma/HTTP dependency so the matching rule stays
// unit-testable and shared by the preview and commit flows.
import { toCents } from './money.js';

// Same tolerance as the statement/sales import (up to 2 cents).
const MATCH_TOLERANCE_CENTS = 2;

// Projects a sale (with `items.person` and `payments` included) into the shape
// the redemption matcher and the API response need. `settledCentsByOrder` maps
// an order id to how much was already redeemed for it, so `rescuableCents`
// never suggests redeeming more than what is still held by InfinitePay.
const decorateSaleForRescue = (sale, settledCentsByOrder = {}) => {
  const totalCents = toCents(sale.totalValue ?? 0);
  const payments = sale.payments || [];
  const paidCents = payments.reduce(
    (sum, payment) => sum + toCents(payment.amount),
    0,
  );

  const infinitePayPayments = payments
    .filter((payment) => payment.paymentType === 'INFINITE_PAY')
    .map((payment) => ({
      id: payment.id,
      grossCents: toCents(payment.amount),
      netCents:
        payment.netAmount != null
          ? toCents(payment.netAmount)
          : toCents(payment.amount),
      paidAt: payment.paidAt,
    }));

  const infinitePayTotalCents = infinitePayPayments.reduce(
    (sum, payment) => sum + payment.netCents,
    0,
  );
  const settledCents = settledCentsByOrder[sale.id] ?? 0;

  return {
    id: sale.id,
    orderNumber: sale.orderNumber,
    clientName: sale.items?.[0]?.person?.name ?? null,
    totalCents,
    paidCents,
    pendingCents: Math.max(0, totalCents - paidCents),
    settledCents,
    rescuableCents: Math.max(0, infinitePayTotalCents - settledCents),
    hasInfinitePay: infinitePayPayments.length > 0,
    infinitePayPayments,
  };
};

// Finds, for a single amount (a redemption or one of its source deposits), the
// user's InfinitePay sales that match it. Each sale is scored against:
// - each InfinitePay payment net amount (`net`);
// - each InfinitePay payment gross amount (`gross`);
// - the sale total (`total`);
// - the sale pending balance (`pending`);
// - the amount still redeemable for the sale (`rescuable`).
// The closest match within the tolerance wins; results are sorted by distance
// and then order number.
const matchAmountToSales = (
  amountCents,
  sales,
  toleranceCents = MATCH_TOLERANCE_CENTS,
) => {
  const matches = [];

  for (const sale of sales) {
    if (!sale.hasInfinitePay) continue;

    const candidates = [];
    for (const payment of sale.infinitePayPayments) {
      candidates.push({
        matchType: 'net',
        matchedCents: payment.netCents,
        paymentId: payment.id,
      });
      candidates.push({
        matchType: 'gross',
        matchedCents: payment.grossCents,
        paymentId: payment.id,
      });
    }
    candidates.push({ matchType: 'total', matchedCents: sale.totalCents });
    candidates.push({ matchType: 'pending', matchedCents: sale.pendingCents });
    candidates.push({
      matchType: 'rescuable',
      matchedCents: sale.rescuableCents,
    });

    let best = null;
    for (const candidate of candidates) {
      const diffCents = Math.abs(amountCents - candidate.matchedCents);
      if (diffCents > toleranceCents) continue;
      if (!best || diffCents < best.diffCents) {
        best = { ...candidate, diffCents };
      }
    }

    if (!best) continue;

    // A whole-amount match settles the full amount for the chosen sale.
    const paymentId = best.paymentId ?? sale.infinitePayPayments[0]?.id ?? null;

    matches.push({
      saleId: sale.id,
      orderNumber: sale.orderNumber,
      clientName: sale.clientName,
      totalCents: sale.totalCents,
      pendingCents: sale.pendingCents,
      rescuableCents: sale.rescuableCents,
      matchType: best.matchType,
      matchedCents: best.matchedCents,
      suggestedCents: amountCents,
      diffCents: best.diffCents,
      paymentId,
    });
  }

  return matches.sort((a, b) => {
    if (a.diffCents !== b.diffCents) return a.diffCents - b.diffCents;
    return String(a.orderNumber).localeCompare(String(b.orderNumber));
  });
};

export { MATCH_TOLERANCE_CENTS, decorateSaleForRescue, matchAmountToSales };

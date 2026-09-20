// Pure helpers for matching an InfinitePay statement row against the user's
// sales. No Prisma/HTTP dependency so the matching rule stays unit-testable.

import { toCents } from './money.js';

// A sale is suggested when its total is within this many cents of the row's
// gross (`valor`) or net (`liquido`) amount.
const MATCH_TOLERANCE_CENTS = 2;

// Projects a sale (with `items.person` and `payments` included) into the
// minimal shape the matcher and the API response need.
const decorateSaleForMatch = (sale) => {
  const totalCents = toCents(sale.totalValue ?? 0);
  const paidCents = (sale.payments || []).reduce(
    (sum, payment) => sum + toCents(payment.amount),
    0,
  );

  return {
    id: sale.id,
    orderNumber: sale.orderNumber,
    totalCents,
    clientName: sale.items?.[0]?.person?.name ?? null,
    pendingCents: Math.max(0, totalCents - paidCents),
  };
};

// Matches a parsed CSV row against the candidate sales. Returns the matching
// sales, closest first, each tagged with how it matched:
// - `gross`: the sale total equals what the client was charged (fee absorbed by
//   the seller, so `passesGatewayFeeToClient` is false);
// - `net`: the sale total equals what the seller received (fee passed on to the
//   client, so `passesGatewayFeeToClient` is true).
// Gross wins ties because `valor` is the amount actually charged to the client.
const matchRowToSales = (
  row,
  sales,
  toleranceCents = MATCH_TOLERANCE_CENTS,
) => {
  const matches = [];

  for (const sale of sales) {
    const grossDiff = Math.abs(row.valorCents - sale.totalCents);
    const netDiff = Math.abs(row.liquidoCents - sale.totalCents);
    const grossMatch = grossDiff <= toleranceCents;
    const netMatch = netDiff <= toleranceCents;

    if (!grossMatch && !netMatch) continue;

    matches.push({
      saleId: sale.id,
      orderNumber: sale.orderNumber,
      totalCents: sale.totalCents,
      clientName: sale.clientName,
      pendingCents: sale.pendingCents,
      matchType: grossMatch && grossDiff <= netDiff ? 'gross' : 'net',
    });
  }

  const diffOf = (match) =>
    Math.abs(
      (match.matchType === 'gross' ? row.valorCents : row.liquidoCents) -
        match.totalCents,
    );

  return matches.sort((a, b) => {
    const diffA = diffOf(a);
    const diffB = diffOf(b);
    if (diffA !== diffB) return diffA - diffB;
    return String(a.orderNumber).localeCompare(String(b.orderNumber));
  });
};

export { MATCH_TOLERANCE_CENTS, decorateSaleForMatch, matchRowToSales };

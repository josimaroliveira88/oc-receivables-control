// Pure helpers for suggesting the ledger rows a ride may already represent in
// Finanças. The match is by exact value: a ride only suggests rows whose amount
// equals its own (normalized to integer cents). Kept free of Prisma so the
// rules stay unit-testable.
import { toCents } from './money.js';

// Origins whose rows may be reconciled with an imported ride. Manual rows are
// the ones the user typed by hand; VENDA_ADICIONAL rows are a sale's "Valores
// Adicionais", which are often the delivery cost the ride actually represents.
// Other automatic origins belong to their source (order, card bill) and are
// re-synced from it, so they are never suggested.
export const MATCHABLE_ORIGINS = ['MANUAL', 'VENDA_ADICIONAL'];

// Only completed rides without a ledger row can be reconciled.
export const selectMatchableRides = (rides = []) =>
  rides.filter((ride) => ride.status === 'COMPLETED' && !ride.launched);

const toMatch = (transaction) => ({
  transactionId: transaction.id,
  origin: transaction.origin,
  description: transaction.description,
  transactionDate: transaction.transactionDate,
  amountCents: toCents(transaction.amount),
  orderId: transaction.orderId ?? null,
  orderNumber: transaction.order?.orderNumber ?? null,
  clientName: transaction.order?.items?.[0]?.person?.name ?? null,
  saleTotalValue: transaction.order?.totalValue ?? null,
});

// Groups the candidate rows by amount and attaches the matches to the rides
// that share the value. Newest first, so the UI can pre-select the most recent.
export const buildRideMatches = (rides = [], transactions = []) => {
  const byAmount = new Map();
  for (const transaction of transactions) {
    const cents = toCents(transaction.amount);
    const bucket = byAmount.get(cents);
    if (bucket) bucket.push(transaction);
    else byAmount.set(cents, [transaction]);
  }

  return new Map(
    rides.map((ride) => [
      ride.id,
      (byAmount.get(ride.amountCents) ?? [])
        .map(toMatch)
        .sort(
          (a, b) =>
            new Date(b.transactionDate).getTime() -
            new Date(a.transactionDate).getTime(),
        ),
    ]),
  );
};

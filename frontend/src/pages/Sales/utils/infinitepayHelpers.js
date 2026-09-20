import { fromCents, formatBRL } from '../../../utils/money';

// Presentation + payload helpers for the InfinitePay statement import.

// Human label for how a suggested sale matched the statement row.
export const matchTypeLabel = (matchType) =>
  matchType === 'net' ? 'Igual ao líquido' : 'Igual ao valor';

// Which statement column matched the sale total.
export const matchTypeColumnLabel = (matchType) =>
  matchType === 'net' ? 'Líquido' : 'Valor';

export const formatStatementCents = (cents) => formatBRL(fromCents(cents));

// Payment-form prefill derived from a statement row and the chosen sale match:
// - the charged amount is always the gross `valor`;
// - the net received is always `liquido`;
// - `passesGatewayFeeToClient` is true only when the sale total matched the net
//   (the client paid the fee on top of the sale total).
export const buildPaymentPrefill = (row, match) => ({
  paymentType: 'INFINITE_PAY',
  paymentAmount: fromCents(row.valorCents).toFixed(2),
  paymentNetAmount: fromCents(row.liquidoCents).toFixed(2),
  paymentDate: row.date,
  paymentNotes: `InfinitePay · NSU ${row.nsu}`,
  passesGatewayFeeToClient: match.matchType === 'net',
});

// Edit-form prefill used when the matched sale already has an InfinitePay
// payment that needs correcting (e.g. only the net was registered and the
// pending balance is the gateway fee). It reuses the create prefill for the
// statement-derived fields and appends the NSU to the notes the payment already
// carries, so the original annotation is preserved.
export const buildEditPaymentPrefill = (row, match, existingPayment = {}) => {
  const baseNotes =
    typeof existingPayment.notes === 'string'
      ? existingPayment.notes.trim()
      : '';
  const nsuNote = `InfinitePay · NSU ${row.nsu}`;

  return {
    ...buildPaymentPrefill(row, match),
    paymentNotes: baseNotes ? `${baseNotes} · ${nsuNote}` : nsuNote,
  };
};

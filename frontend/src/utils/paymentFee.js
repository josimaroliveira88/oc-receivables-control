import { toCents } from './money';

// Whether a payment informed the net amount received after the gateway fee.
// Empty/null means no fee, so the net equals the charged amount.
export const hasNetAmount = (netAmount) =>
  netAmount !== null && netAmount !== undefined && netAmount !== '';

// Gateway fee in cents: charged amount minus net received. Zero without a net.
export const paymentFeeCents = ({ amount, netAmount }) => {
  if (!hasNetAmount(netAmount)) return 0;
  return toCents(parseFloat(amount) || 0) - toCents(parseFloat(netAmount) || 0);
};

// Net amount in cents (falls back to the charged amount when no fee).
export const paymentNetCents = ({ amount, netAmount }) => {
  const chargedCents = toCents(parseFloat(amount) || 0);
  return chargedCents - paymentFeeCents({ amount, netAmount });
};

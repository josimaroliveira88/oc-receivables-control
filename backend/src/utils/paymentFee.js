import { toCents } from './money.js';

// A payment may register a payment-gateway fee (e.g. InfinitePay) by informing
// the net amount the user actually received. `netAmount` null/undefined means
// "no fee" (or not informed), so the net equals the charged `amount`. The fee
// is always derived (`amount - netAmount`) and never persisted.
const hasNetAmount = (netAmount) =>
  netAmount !== null && netAmount !== undefined && netAmount !== '';

// Fee in integer cents. Zero when no net amount was informed.
const paymentFeeCents = ({ amount, netAmount }) => {
  if (!hasNetAmount(netAmount)) return 0;
  return toCents(amount) - toCents(netAmount);
};

export { hasNetAmount, paymentFeeCents };

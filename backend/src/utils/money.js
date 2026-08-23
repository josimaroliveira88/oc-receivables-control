function toCents(decimalString) {
  return Math.round(parseFloat(decimalString) * 100);
}

function fromCents(cents) {
  return cents / 100;
}

function decimalToCents(value) {
  const normalized = String(value).trim();
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0') || 0);
}

// Calculates the displayed R$/PV value without floating-point arithmetic.
function pricePerPv(memberPrice, pv) {
  if (memberPrice === null || memberPrice === undefined) return null;

  const memberPriceCents = decimalToCents(memberPrice);
  const pvCents = decimalToCents(pv);
  if (memberPriceCents === null || pvCents === null || pvCents === 0n) {
    return null;
  }

  const numerator = memberPriceCents * 100n;
  const roundedCents = (numerator + pvCents / 2n) / pvCents;
  return (
    (roundedCents / 100n).toString().padStart(1, '0') +
    '.' +
    (roundedCents % 100n).toString().padStart(2, '0')
  );
}

// Line value in cents for an order item, honoring the per-item price mode:
// - 'UNIT' (default): chargedValue is the unit price, so line = unit * quantity.
// - 'TOTAL': chargedValue already is the full line value.
function lineValueCents(item) {
  const baseCents = toCents(item.chargedValue ?? 0);
  if (item.chargedValueMode === 'TOTAL') return baseCents;
  const quantity = Math.max(1, Number(item.quantity) || 1);
  return baseCents * quantity;
}

function formatBRL(cents) {
  return fromCents(cents).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

module.exports = {
  toCents,
  fromCents,
  formatBRL,
  lineValueCents,
  pricePerPv,
};

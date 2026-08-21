function toCents(decimalString) {
  return Math.round(parseFloat(decimalString) * 100);
}

function fromCents(cents) {
  return cents / 100;
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

module.exports = { toCents, fromCents, formatBRL, lineValueCents };

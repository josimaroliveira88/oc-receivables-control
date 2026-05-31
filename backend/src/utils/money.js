function toCents(decimalString) {
  return Math.round(parseFloat(decimalString) * 100);
}

function fromCents(cents) {
  return cents / 100;
}

function formatBRL(cents) {
  return fromCents(cents).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

module.exports = { toCents, fromCents, formatBRL };

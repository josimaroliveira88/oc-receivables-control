export function toCents(value) {
  return Math.round(value * 100);
}

export function fromCents(cents) {
  return cents / 100;
}

export function formatBRL(value) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

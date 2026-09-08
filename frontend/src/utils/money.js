export function toCents(value) {
  return Math.round(value * 100);
}

export function fromCents(cents) {
  return cents / 100;
}

export function formatBRL(value) {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof num !== 'number' || Number.isNaN(num) || !Number.isFinite(num))
    return '—';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

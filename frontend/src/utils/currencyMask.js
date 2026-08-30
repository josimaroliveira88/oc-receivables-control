import { toCents } from './money';

export const MAX_CURRENCY_DIGITS = 10;

export function currencyDigitsFromRaw(raw) {
  return String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, MAX_CURRENCY_DIGITS);
}

function paddedCentsParts(digits) {
  const clean = currencyDigitsFromRaw(digits);
  if (!clean) return null;
  const padded = clean.padStart(3, '0');
  return {
    int: padded.slice(0, -2).replace(/^0+/, '') || '0',
    frac: padded.slice(-2),
  };
}

export function maskedCurrencyFromDigits(digits) {
  const parts = paddedCentsParts(digits);
  if (!parts) return '';
  const grouped = parts.int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped},${parts.frac}`;
}

export function canonicalCurrencyFromDigits(digits) {
  const parts = paddedCentsParts(digits);
  if (!parts) return '';
  if (parts.frac === '00') return parts.int;
  const trimmedFrac = parts.frac.replace(/0+$/, '');
  return trimmedFrac ? `${parts.int}.${trimmedFrac}` : parts.int;
}

export function digitsFromCurrencyValue(value) {
  if (value === '' || value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(num)) return '';
  return String(toCents(num)).slice(0, MAX_CURRENCY_DIGITS);
}

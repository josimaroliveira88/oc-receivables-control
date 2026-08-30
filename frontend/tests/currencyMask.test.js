import { describe, it, expect } from 'vitest';
import {
  MAX_CURRENCY_DIGITS,
  currencyDigitsFromRaw,
  maskedCurrencyFromDigits,
  canonicalCurrencyFromDigits,
  digitsFromCurrencyValue,
} from '../src/utils/currencyMask';

describe('currencyDigitsFromRaw', () => {
  it('extracts digits and drops everything else', () => {
    expect(currencyDigitsFromRaw('R$ 1.234,56')).toBe('123456');
    expect(currencyDigitsFromRaw('-5')).toBe('5');
    expect(currencyDigitsFromRaw('12,34')).toBe('1234');
    expect(currencyDigitsFromRaw('abc')).toBe('');
  });

  it('returns empty string for empty, null and undefined', () => {
    expect(currencyDigitsFromRaw('')).toBe('');
    expect(currencyDigitsFromRaw(null)).toBe('');
    expect(currencyDigitsFromRaw(undefined)).toBe('');
  });

  it(`caps at ${MAX_CURRENCY_DIGITS} digits`, () => {
    expect(currencyDigitsFromRaw('12345678901')).toBe('1234567890');
  });
});

describe('maskedCurrencyFromDigits', () => {
  it('formats digits as cents (ATM style)', () => {
    expect(maskedCurrencyFromDigits('1234')).toBe('12,34');
    expect(maskedCurrencyFromDigits('5')).toBe('0,05');
    expect(maskedCurrencyFromDigits('50')).toBe('0,50');
    expect(maskedCurrencyFromDigits('123456')).toBe('1.234,56');
    expect(maskedCurrencyFromDigits('10000')).toBe('100,00');
    expect(maskedCurrencyFromDigits('0')).toBe('0,00');
  });

  it('returns empty string for empty input', () => {
    expect(maskedCurrencyFromDigits('')).toBe('');
  });

  it('ignores non-digit characters defensively', () => {
    expect(maskedCurrencyFromDigits('a1b2c3d4')).toBe('12,34');
  });
});

describe('canonicalCurrencyFromDigits', () => {
  it('converts digits to normalized dot-decimal strings', () => {
    expect(canonicalCurrencyFromDigits('1234')).toBe('12.34');
    expect(canonicalCurrencyFromDigits('105')).toBe('1.05');
    expect(canonicalCurrencyFromDigits('150')).toBe('1.5');
    expect(canonicalCurrencyFromDigits('10000')).toBe('100');
    expect(canonicalCurrencyFromDigits('5')).toBe('0.05');
    expect(canonicalCurrencyFromDigits('0')).toBe('0');
  });

  it('returns empty string for empty input', () => {
    expect(canonicalCurrencyFromDigits('')).toBe('');
  });
});

describe('digitsFromCurrencyValue', () => {
  it('converts canonical dot-decimal values to cents digits', () => {
    expect(digitsFromCurrencyValue('12.34')).toBe('1234');
    expect(digitsFromCurrencyValue('100')).toBe('10000');
    expect(digitsFromCurrencyValue('1.5')).toBe('150');
    expect(digitsFromCurrencyValue('0.01')).toBe('1');
    expect(digitsFromCurrencyValue('0')).toBe('0');
  });

  it('accepts numbers as well', () => {
    expect(digitsFromCurrencyValue(12.34)).toBe('1234');
    expect(digitsFromCurrencyValue(100)).toBe('10000');
  });

  it('returns empty string for empty, null and undefined values', () => {
    expect(digitsFromCurrencyValue('')).toBe('');
    expect(digitsFromCurrencyValue(null)).toBe('');
    expect(digitsFromCurrencyValue(undefined)).toBe('');
  });

  it('roundtrips digits through canonical and back', () => {
    for (const digits of [
      '1234',
      '10000',
      '105',
      '150',
      '5',
      '0',
      '1234567890',
    ]) {
      expect(digitsFromCurrencyValue(canonicalCurrencyFromDigits(digits))).toBe(
        digits,
      );
    }
  });
});

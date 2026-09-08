import { describe, it, expect } from 'vitest';
import { formatBRL } from '../src/utils/money';

describe('formatBRL', () => {
  it('should format numeric values as BRL', () => {
    expect(formatBRL(308)).toContain('308,00');
    expect(formatBRL('231.25')).toContain('231,25');
  });

  it('should return a placeholder instead of throwing for null/undefined/NaN', () => {
    expect(formatBRL(null)).toBe('—');
    expect(formatBRL(undefined)).toBe('—');
    expect(formatBRL(NaN)).toBe('—');
    expect(formatBRL('')).toBe('—');
  });
});

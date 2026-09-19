import { describe, it, expect } from 'vitest';
import {
  createEmptyRow,
  normalizeDiscountPercent,
  rowTotals,
  totalsFor,
  shippingCentsFromValue,
  formatPv,
  formatMemberCents,
} from '../src/pages/Orders/utils/simulatorHelpers';

const products = [
  {
    id: 'p1',
    code: '60226006',
    name: 'Adaptiv Pastilhas',
    memberPrice: '231.25',
    pv: '31',
    productType: 'SIMPLES',
  },
  {
    id: 'kit1',
    code: 'KIT001',
    name: 'Kit Início',
    memberPrice: '300.00',
    pv: '50',
    productType: 'KIT',
  },
  {
    id: 'noprice',
    code: '0',
    name: 'Sem Preço',
    memberPrice: null,
    pv: null,
  },
];

describe('createEmptyRow', () => {
  it('creates an unselected row with quantity 1', () => {
    const row = createEmptyRow();
    expect(row.productId).toBe('');
    expect(row.quantity).toBe(1);
    expect(typeof row.id).toBe('string');
    expect(row.id.length).toBeGreaterThan(0);
  });

  it('generates unique ids across calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createEmptyRow().id));
    expect(ids.size).toBe(50);
  });

  it('starts with no promotion discount', () => {
    expect(createEmptyRow().discountPercent).toBe(0);
  });
});

describe('normalizeDiscountPercent', () => {
  it('keeps percentages within 0 and 100', () => {
    expect(normalizeDiscountPercent(0)).toBe(0);
    expect(normalizeDiscountPercent(15)).toBe(15);
    expect(normalizeDiscountPercent(100)).toBe(100);
  });

  it('clamps values above 100 to 100', () => {
    expect(normalizeDiscountPercent(150)).toBe(100);
    expect(normalizeDiscountPercent('250')).toBe(100);
  });

  it('treats invalid, empty or negative values as 0', () => {
    expect(normalizeDiscountPercent('')).toBe(0);
    expect(normalizeDiscountPercent('abc')).toBe(0);
    expect(normalizeDiscountPercent(-10)).toBe(0);
    expect(normalizeDiscountPercent(null)).toBe(0);
    expect(normalizeDiscountPercent(undefined)).toBe(0);
  });
});

describe('rowTotals', () => {
  it('multiplies the unit PV and member price by the quantity', () => {
    const result = rowTotals({ productId: 'p1', quantity: 2 }, products);
    expect(result.hasProduct).toBe(true);
    expect(result.pvUnit).toBe(31);
    expect(result.pvTotal).toBe(62);
    expect(result.memberUnitCents).toBe(23125);
    expect(result.memberTotalCents).toBe(46250);
  });

  it('uses the kit own PV and member price without expanding components', () => {
    const result = rowTotals({ productId: 'kit1', quantity: 2 }, products);
    expect(result.pvTotal).toBe(100);
    expect(result.memberTotalCents).toBe(60000);
  });

  it('returns zeros and no product flag when nothing is selected', () => {
    const result = rowTotals({ productId: '', quantity: 3 }, products);
    expect(result.hasProduct).toBe(false);
    expect(result.pvTotal).toBe(0);
    expect(result.memberTotalCents).toBe(0);
  });

  it('treats a product without prices as zero', () => {
    const result = rowTotals({ productId: 'noprice', quantity: 2 }, products);
    expect(result.hasProduct).toBe(true);
    expect(result.pvTotal).toBe(0);
    expect(result.memberUnitCents).toBeNull();
    expect(result.memberTotalCents).toBe(0);
  });

  it('treats invalid or negative quantities as 1', () => {
    expect(rowTotals({ productId: 'p1', quantity: '' }, products).pvTotal).toBe(
      31,
    );
    expect(
      rowTotals({ productId: 'p1', quantity: 'abc' }, products).pvTotal,
    ).toBe(31);
    expect(rowTotals({ productId: 'p1', quantity: 0 }, products).pvTotal).toBe(
      31,
    );
    expect(rowTotals({ productId: 'p1', quantity: -4 }, products).pvTotal).toBe(
      31,
    );
  });

  it('avoids floating point drift on decimal PV', () => {
    const withDecimal = [{ id: 'x', memberPrice: '0.10', pv: '0.10' }];
    const result = rowTotals({ productId: 'x', quantity: 3 }, withDecimal);
    expect(result.pvTotal).toBe(0.3);
    expect(result.memberTotalCents).toBe(30);
  });

  it('applies the promotion discount to the PV and member values', () => {
    const result = rowTotals(
      { productId: 'p1', quantity: 2, discountPercent: 10 },
      products,
    );
    expect(result.pvUnit).toBe(27.9);
    expect(result.pvTotal).toBe(55.8);
    expect(result.memberUnitCents).toBe(20813);
    expect(result.memberTotalCents).toBe(41626);
  });

  it('zeroes the values when the discount reaches 100%', () => {
    const result = rowTotals(
      { productId: 'p1', quantity: 4, discountPercent: 100 },
      products,
    );
    expect(result.pvTotal).toBe(0);
    expect(result.memberUnitCents).toBe(0);
    expect(result.memberTotalCents).toBe(0);
  });

  it('ignores invalid discounts and clamps values above 100', () => {
    const invalid = rowTotals(
      { productId: 'p1', quantity: 1, discountPercent: 'abc' },
      products,
    );
    expect(invalid.pvTotal).toBe(31);
    expect(invalid.memberTotalCents).toBe(23125);

    const clamped = rowTotals(
      { productId: 'p1', quantity: 1, discountPercent: 150 },
      products,
    );
    expect(clamped.pvTotal).toBe(0);
    expect(clamped.memberTotalCents).toBe(0);
  });
});

describe('totalsFor', () => {
  it('returns zeros for an empty list', () => {
    expect(totalsFor([], products)).toEqual({
      totalPv: 0,
      totalMemberCents: 0,
    });
  });

  it('sums PV and member totals across independent rows', () => {
    const rows = [
      { productId: 'p1', quantity: 2 },
      { productId: 'kit1', quantity: 1 },
      { productId: '', quantity: 5 },
    ];
    const result = totalsFor(rows, products);
    expect(result.totalPv).toBe(112);
    expect(result.totalMemberCents).toBe(76250);
  });

  it('sums duplicate rows of the same product independently', () => {
    const rows = [
      { productId: 'p1', quantity: 1 },
      { productId: 'p1', quantity: 1 },
    ];
    const result = totalsFor(rows, products);
    expect(result.totalPv).toBe(62);
    expect(result.totalMemberCents).toBe(46250);
  });

  it('combines discounted and non-discounted rows', () => {
    const rows = [
      { productId: 'p1', quantity: 1, discountPercent: 10 },
      { productId: 'kit1', quantity: 1 },
    ];
    const result = totalsFor(rows, products);
    expect(result.totalPv).toBe(77.9);
    expect(result.totalMemberCents).toBe(50813);
  });
});

describe('shippingCentsFromValue', () => {
  it('returns zero for empty or invalid values', () => {
    expect(shippingCentsFromValue('')).toBe(0);
    expect(shippingCentsFromValue(null)).toBe(0);
    expect(shippingCentsFromValue(undefined)).toBe(0);
    expect(shippingCentsFromValue('abc')).toBe(0);
  });

  it('converts a BRL value to integer cents', () => {
    expect(shippingCentsFromValue('25.5')).toBe(2550);
    expect(shippingCentsFromValue(12)).toBe(1200);
    expect(shippingCentsFromValue('0')).toBe(0);
  });
});

describe('formatPv', () => {
  it('returns an em dash for missing values', () => {
    expect(formatPv(null)).toBe('—');
    expect(formatPv(undefined)).toBe('—');
    expect(formatPv('')).toBe('—');
    expect(formatPv('abc')).toBe('—');
  });

  it('formats numbers with two decimals in pt-BR', () => {
    expect(formatPv(0)).toBe('0,00');
    expect(formatPv(31)).toBe('31,00');
    expect(formatPv(12.345)).toBe('12,35');
  });
});

describe('formatMemberCents', () => {
  it('returns an em dash for missing cents', () => {
    expect(formatMemberCents(null)).toBe('—');
    expect(formatMemberCents(undefined)).toBe('—');
  });

  it('formats integer cents as BRL', () => {
    expect(formatMemberCents(0)).toMatch(/R\$\s*0,00/);
    expect(formatMemberCents(23125)).toMatch(/R\$\s*231,25/);
  });
});

const { effectivePvCents } = require('../src/utils/money');

describe('effectivePvCents', () => {
  it('returns 0 when the charged line value is zero (UNIT mode)', () => {
    expect(
      effectivePvCents({
        chargedValue: 0,
        quantity: 2,
        pv: 15.5,
        chargedValueMode: 'UNIT',
      }),
    ).toBe(0);
  });

  it('returns 0 when the charged line value is zero (TOTAL mode)', () => {
    expect(
      effectivePvCents({
        chargedValue: 0,
        quantity: 3,
        pv: 10,
        chargedValueMode: 'TOTAL',
      }),
    ).toBe(0);
  });

  it('computes pv * quantity in cents when there is a charge (UNIT mode)', () => {
    expect(
      effectivePvCents({
        chargedValue: 25,
        quantity: 2,
        pv: 15.5,
        chargedValueMode: 'UNIT',
      }),
    ).toBe(3100);
  });

  it('multiplies by quantity in TOTAL mode too (pv is per unit)', () => {
    expect(
      effectivePvCents({
        chargedValue: 40,
        quantity: 3,
        pv: 10,
        chargedValueMode: 'TOTAL',
      }),
    ).toBe(3000);
  });

  it('returns 0 when the item has no pv', () => {
    expect(
      effectivePvCents({
        chargedValue: 10,
        quantity: 1,
        pv: null,
        chargedValueMode: 'UNIT',
      }),
    ).toBe(0);
  });
});

import { hasFormChanges } from '../src/utils/formChanges';

describe('hasFormChanges', () => {
  it('returns false when there is no initial snapshot (modal not opened yet)', () => {
    expect(hasFormChanges({ name: 'Ana' }, null)).toBe(false);
    expect(hasFormChanges({ name: 'Ana' }, undefined)).toBe(false);
  });

  it('returns false when current and initial are the same primitive', () => {
    expect(hasFormChanges('Ana', 'Ana')).toBe(false);
    expect(hasFormChanges(5, 5)).toBe(false);
  });

  it('returns true when primitives differ', () => {
    expect(hasFormChanges('Ana', 'Bia')).toBe(true);
    expect(hasFormChanges(5, 6)).toBe(true);
  });

  it('returns false when objects are structurally equal', () => {
    const a = { name: 'Ana', phone: '11999999999' };
    const b = { name: 'Ana', phone: '11999999999' };
    expect(hasFormChanges(a, b)).toBe(false);
  });

  it('returns true when a single field differs', () => {
    const a = { name: 'Ana', phone: '11999999999' };
    const b = { name: 'Bia', phone: '11999999999' };
    expect(hasFormChanges(a, b)).toBe(true);
  });

  it('returns true when key counts differ', () => {
    expect(hasFormChanges({ a: 1, b: 2 }, { a: 1 })).toBe(true);
  });

  it('returns true when an array length changes (item added/removed)', () => {
    expect(hasFormChanges([{ id: 1 }], [{ id: 1 }, { id: 2 }])).toBe(true);
  });

  it('returns false for equal arrays of objects', () => {
    const a = [
      { id: 1, quantity: 2 },
      { id: 2, quantity: 3 },
    ];
    const b = [
      { id: 1, quantity: 2 },
      { id: 2, quantity: 3 },
    ];
    expect(hasFormChanges(a, b)).toBe(false);
  });

  it('returns true when an item inside an array changes', () => {
    const a = [{ id: 1, quantity: 2 }];
    const b = [{ id: 1, quantity: 3 }];
    expect(hasFormChanges(a, b)).toBe(true);
  });

  it('returns true when an array becomes an object (shape mismatch)', () => {
    expect(hasFormChanges([1], { 0: 1 })).toBe(true);
  });

  it('returns true when a nested object differs', () => {
    const a = { order: { items: [{ id: 'x', qty: 1 }] } };
    const b = { order: { items: [{ id: 'x', qty: 2 }] } };
    expect(hasFormChanges(a, b)).toBe(true);
  });

  it('returns false when current is null and initial is null', () => {
    expect(hasFormChanges(null, null)).toBe(false);
  });

  it('returns true when current becomes null but initial had a value', () => {
    expect(hasFormChanges(null, { a: 1 })).toBe(true);
  });
});

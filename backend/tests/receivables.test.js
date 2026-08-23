const {
  computeOrderStatus,
  personPendingCents,
} = require('../src/utils/receivables');

const toCents = (value) => Math.round(value * 100);

describe('receivables util', () => {
  describe('computeOrderStatus', () => {
    const item = (personId, chargedValue, isSelf = false) => ({
      personId,
      chargedValue,
      person: isSelf ? { isSelf: true } : { isSelf: false },
    });

    it('returns QUITADO when all items belong to self persons (no pending)', () => {
      const items = [item('p1', 100.0, true), item('p1', 50.0, true)];
      expect(computeOrderStatus({ items, payments: [] })).toBe('QUITADO');
    });

    it('returns PENDENTE when a non-self person still owes and there are no payments', () => {
      const items = [item('p1', 100.0, false)];
      expect(computeOrderStatus({ items, payments: [] })).toBe('PENDENTE');
    });

    it('returns PENDENTE when a self item plus an unpaid non-self item exist', () => {
      const items = [item('self', 200.0, true), item('other', 300.0, false)];
      expect(computeOrderStatus({ items, payments: [] })).toBe('PENDENTE');
    });

    it('returns QUITADO when self item exists and the non-self item is fully paid', () => {
      const items = [item('self', 200.0, true), item('other', 300.0, false)];
      const payments = [{ personId: 'other', amount: 300.0 }];
      expect(computeOrderStatus({ items, payments })).toBe('QUITADO');
    });

    it('returns PARCIAL when self item exists, a payment was made, and non-self still owes', () => {
      const items = [item('self', 200.0, true), item('other', 300.0, false)];
      const payments = [{ personId: 'other', amount: 100.0 }];
      expect(computeOrderStatus({ items, payments })).toBe('PARCIAL');
    });

    it('ignores items without a person when computing status', () => {
      const items = [
        { personId: null, chargedValue: 999.0, person: null },
        item('other', 300.0, false),
      ];
      const payments = [{ personId: 'other', amount: 300.0 }];
      expect(computeOrderStatus({ items, payments })).toBe('QUITADO');
    });

    it('returns PENDENTE for a zero-total order with no payments', () => {
      const items = [item('p1', 0.0, false)];
      expect(computeOrderStatus({ items, payments: [] })).toBe('PENDENTE');
    });

    it('returns PENDENTE when chargeable items are paid but shipping is not', () => {
      const items = [item('p1', 100.0, false)];
      const payments = [{ personId: 'p1', amount: 100.0 }];
      expect(
        computeOrderStatus({ items, payments, shippingCents: toCents(50) }),
      ).toBe('PARCIAL');
    });

    it('returns QUITADO when shipping is covered by total payments', () => {
      const items = [item('p1', 100.0, false)];
      const payments = [{ personId: 'p1', amount: 150.0 }];
      expect(
        computeOrderStatus({ items, payments, shippingCents: toCents(50) }),
      ).toBe('QUITADO');
    });

    it('does not block QUITADO by shipping when there are no chargeable items', () => {
      const items = [item('p1', 0.0, false)];
      const payments = [{ personId: 'p1', amount: 0.0 }];
      expect(
        computeOrderStatus({ items, payments, shippingCents: toCents(50) }),
      ).toBe('QUITADO');
    });

    it('does not block QUITADO by shipping for a self-only order', () => {
      const items = [item('p1', 200.0, true)];
      expect(
        computeOrderStatus({ items, payments: [], shippingCents: toCents(30) }),
      ).toBe('QUITADO');
    });
  });

  describe('personPendingCents', () => {
    it('returns 0 for a self person regardless of unpaid balance', () => {
      expect(
        personPendingCents({
          itemCents: toCents(100),
          paymentCents: 0,
          isSelf: true,
        }),
      ).toBe(0);
    });

    it('returns the difference for a non-self person', () => {
      expect(
        personPendingCents({
          itemCents: toCents(100),
          paymentCents: toCents(40),
          isSelf: false,
        }),
      ).toBe(toCents(60));
    });

    it('returns 0 for a non-self person fully paid', () => {
      expect(
        personPendingCents({
          itemCents: toCents(100),
          paymentCents: toCents(100),
          isSelf: false,
        }),
      ).toBe(0);
    });

    it('does not return a negative pending for a non-self overpaid person', () => {
      expect(
        personPendingCents({
          itemCents: toCents(100),
          paymentCents: toCents(120),
          isSelf: false,
        }),
      ).toBe(0);
    });
  });
});

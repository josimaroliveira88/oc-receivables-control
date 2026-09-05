import {
  computeOrderStatus,
  personPendingCents,
  personFinancialSummary,
} from '../src/utils/receivables.js';

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

    it('returns EQUIPE when isTeamOrder is true regardless of items and payments', () => {
      const items = [
        { personId: 'other', chargedValue: 500.0, person: { isSelf: false } },
      ];
      expect(
        computeOrderStatus({ items, payments: [], isTeamOrder: true }),
      ).toBe('EQUIPE');
    });

    it('returns EQUIPE for a team order even with partial payments and shipping', () => {
      const items = [
        { personId: 'other', chargedValue: 500.0, person: { isSelf: false } },
      ];
      const payments = [{ personId: 'other', amount: 100.0 }];
      expect(
        computeOrderStatus({
          items,
          payments,
          shippingCents: toCents(50),
          isTeamOrder: true,
        }),
      ).toBe('EQUIPE');
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

  describe('personFinancialSummary', () => {
    it('returns zeroed totals for empty items and payments', () => {
      expect(personFinancialSummary([], [], { isSelf: false })).toEqual({
        ordersCount: 0,
        totalItemsCents: 0,
        totalPaidCents: 0,
        totalOpenCents: 0,
      });
    });

    it('sums item line values and counts distinct orders', () => {
      const items = [
        { chargedValue: 100.0, orderId: 'order-1' },
        { chargedValue: 50.0, orderId: 'order-2' },
        { chargedValue: 25.0, orderId: 'order-1' },
      ];
      expect(personFinancialSummary(items, [], { isSelf: false })).toEqual({
        ordersCount: 2,
        totalItemsCents: toCents(175),
        totalPaidCents: 0,
        totalOpenCents: toCents(175),
      });
    });

    it('honors quantity and TOTAL mode when computing item totals', () => {
      const items = [
        {
          chargedValue: 10.0,
          quantity: 2,
          chargedValueMode: 'UNIT',
          orderId: 'o1',
        },
        {
          chargedValue: 5.0,
          quantity: 3,
          chargedValueMode: 'TOTAL',
          orderId: 'o1',
        },
      ];
      const summary = personFinancialSummary(items, [], { isSelf: false });
      expect(summary.totalItemsCents).toBe(toCents(25));
    });

    it('sums payment amounts', () => {
      const payments = [{ amount: 40.0 }, { amount: 35.5 }, { amount: 24.5 }];
      const summary = personFinancialSummary([], payments, { isSelf: false });
      expect(summary.totalPaidCents).toBe(toCents(100));
    });

    it('returns open as items minus paid for a non-self person', () => {
      const items = [{ chargedValue: 150.0, orderId: 'o1' }];
      const payments = [{ amount: 40.0 }];
      expect(
        personFinancialSummary(items, payments, { isSelf: false }),
      ).toEqual({
        ordersCount: 1,
        totalItemsCents: toCents(150),
        totalPaidCents: toCents(40),
        totalOpenCents: toCents(110),
      });
    });

    it('clamps open at zero when paid exceeds the items total', () => {
      const items = [{ chargedValue: 20.0, orderId: 'o1' }];
      const payments = [{ amount: 25.0 }];
      const summary = personFinancialSummary(items, payments, {
        isSelf: false,
      });
      expect(summary.totalPaidCents).toBe(toCents(25));
      expect(summary.totalOpenCents).toBe(0);
    });

    it('returns open zero for a self person even with chargeable items', () => {
      const items = [{ chargedValue: 80.0, orderId: 'o1' }];
      expect(personFinancialSummary(items, [], { isSelf: true })).toEqual({
        ordersCount: 1,
        totalItemsCents: toCents(80),
        totalPaidCents: 0,
        totalOpenCents: 0,
      });
    });
  });
});

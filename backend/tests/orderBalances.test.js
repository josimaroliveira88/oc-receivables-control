const { buildOrderBalances } = require('../src/utils/orderBalances');

const item = (personId, chargedValue, extra = {}) => ({
  personId,
  chargedValue,
  chargedValueMode: 'UNIT',
  quantity: 1,
  ...extra,
});

const payment = (personId, amount, extra = {}) => ({
  personId,
  amount,
  ...extra,
});

describe('orderBalances util', () => {
  describe('buildOrderBalances', () => {
    it('returns an empty array for an order without items or payments', () => {
      const order = { items: [], payments: [] };
      expect(buildOrderBalances(order)).toEqual([]);
    });

    it('aggregates item totals per person', () => {
      const order = {
        items: [
          item('p1', '10.00', { person: { name: 'Alice', isSelf: false } }),
          item('p1', '5.50', { person: { name: 'Alice', isSelf: false } }),
          item('p2', '7.25', { person: { name: 'Bob', isSelf: false } }),
        ],
        payments: [],
      };

      const balances = buildOrderBalances(order);

      expect(balances).toHaveLength(2);
      const alice = balances.find((b) => b.personId === 'p1');
      expect(alice).toEqual({
        personId: 'p1',
        personName: 'Alice',
        isSelf: false,
        itemTotal: 15.5,
        paymentTotal: 0,
        pending: 15.5,
      });
    });

    it('honors chargedValueMode TOTAL and quantity for line values', () => {
      const order = {
        items: [
          item('p1', '10.00', {
            chargedValueMode: 'TOTAL',
            quantity: 3,
            person: { name: 'Alice', isSelf: false },
          }),
          item('p2', '2.00', {
            quantity: 4,
            person: { name: 'Bob', isSelf: false },
          }),
        ],
        payments: [],
      };

      const balances = buildOrderBalances(order);

      expect(balances.find((b) => b.personId === 'p1').itemTotal).toBe(10);
      expect(balances.find((b) => b.personId === 'p2').itemTotal).toBe(8);
    });

    it('aggregates payment totals per person', () => {
      const order = {
        items: [
          item('p1', '10.00', { person: { name: 'Alice', isSelf: false } }),
        ],
        payments: [
          payment('p1', '4.00', { person: { name: 'Alice', isSelf: false } }),
          payment('p1', '3.50', { person: { name: 'Alice', isSelf: false } }),
        ],
      };

      const balances = buildOrderBalances(order);

      expect(balances[0].paymentTotal).toBe(7.5);
      expect(balances[0].pending).toBe(2.5);
    });

    it('returns pending 0 for a self person regardless of payments', () => {
      const order = {
        items: [
          item('self', '50.00', { person: { name: 'Me', isSelf: true } }),
        ],
        payments: [],
      };

      const balances = buildOrderBalances(order);

      expect(balances[0]).toEqual({
        personId: 'self',
        personName: 'Me',
        isSelf: true,
        itemTotal: 50,
        paymentTotal: 0,
        pending: 0,
      });
    });

    it('clamps negative pending to zero (overpayment)', () => {
      const order = {
        items: [
          item('p1', '10.00', { person: { name: 'Alice', isSelf: false } }),
        ],
        payments: [
          payment('p1', '12.00', { person: { name: 'Alice', isSelf: false } }),
        ],
      };

      const balances = buildOrderBalances(order);

      expect(balances[0].pending).toBe(0);
    });

    it('creates a person entry from a payment alone, deriving isSelf from the payment person', () => {
      const order = {
        items: [],
        payments: [
          payment('p1', '5.00', { person: { name: 'Alice', isSelf: false } }),
        ],
      };

      const balances = buildOrderBalances(order);

      expect(balances[0]).toEqual({
        personId: 'p1',
        personName: 'Alice',
        isSelf: false,
        itemTotal: 0,
        paymentTotal: 5,
        pending: 0,
      });
    });

    it('skips items and payments without a personId', () => {
      const order = {
        items: [
          { personId: null, chargedValue: '99.00', person: null },
          item('p1', '10.00', { person: { name: 'Alice', isSelf: false } }),
        ],
        payments: [{ personId: null, amount: '5.00', person: null }],
      };

      const balances = buildOrderBalances(order);

      expect(balances).toHaveLength(1);
      expect(balances[0].personId).toBe('p1');
    });

    it('uses the "Unknown" fallback name when the item has no person object', () => {
      const order = {
        items: [item('p1', '10.00', { person: null })],
        payments: [],
      };

      const balances = buildOrderBalances(order);

      expect(balances[0].personName).toBe('Unknown');
      expect(balances[0].isSelf).toBe(false);
    });

    it('sorts balances by person name', () => {
      const order = {
        items: [
          item('p1', '10.00', { person: { name: 'Zeca', isSelf: false } }),
          item('p2', '10.00', { person: { name: 'Ana', isSelf: false } }),
        ],
        payments: [],
      };

      const balances = buildOrderBalances(order);

      expect(balances.map((b) => b.personName)).toEqual(['Ana', 'Zeca']);
    });
  });
});

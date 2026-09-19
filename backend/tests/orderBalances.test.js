import { buildOrderBalances } from '../src/utils/orderBalances.js';

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

  describe('buildOrderBalances for sales (VENDA)', () => {
    const saleOrder = (overrides) => ({
      orderType: 'VENDA',
      shippingValue: '0',
      additionalValue: '0',
      items: [],
      payments: [],
      ...overrides,
    });

    it('adds shipping and additional charges to the client pending without changing itemTotal', () => {
      const order = saleOrder({
        shippingValue: '14.70',
        additionalValue: '5.30',
        items: [
          item('client', '100.00', {
            person: { name: 'Cliente', isSelf: false },
          }),
        ],
      });

      const balances = buildOrderBalances(order);

      expect(balances).toHaveLength(1);
      expect(balances[0].itemTotal).toBe(100);
      expect(balances[0].pending).toBe(120);
    });

    it('subtracts payments from the total including the charges', () => {
      const order = saleOrder({
        shippingValue: '10.00',
        items: [
          item('client', '200.00', {
            person: { name: 'Cliente', isSelf: false },
          }),
        ],
        payments: [
          payment('client', '150.00', {
            person: { name: 'Cliente', isSelf: false },
          }),
        ],
      });

      const balances = buildOrderBalances(order);

      expect(balances[0].itemTotal).toBe(200);
      expect(balances[0].paymentTotal).toBe(150);
      expect(balances[0].pending).toBe(60);
    });

    it('distributes the charges proportionally across non-self persons', () => {
      const order = saleOrder({
        shippingValue: '10.00',
        items: [
          item('p1', '100.00', { person: { name: 'Ana', isSelf: false } }),
          item('p2', '300.00', { person: { name: 'Bruno', isSelf: false } }),
        ],
      });

      const balances = buildOrderBalances(order);

      expect(balances.find((b) => b.personId === 'p1').pending).toBe(102.5);
      expect(balances.find((b) => b.personId === 'p2').pending).toBe(307.5);
    });

    it('does not add the charges to self persons', () => {
      const order = saleOrder({
        shippingValue: '10.00',
        items: [
          item('self', '100.00', { person: { name: 'Me', isSelf: true } }),
        ],
      });

      const balances = buildOrderBalances(order);

      expect(balances[0].pending).toBe(0);
    });

    it('ignores shipping on purchase orders (COMPRA)', () => {
      const order = {
        orderType: 'COMPRA',
        shippingValue: '10.00',
        additionalValue: '5.00',
        items: [
          item('p1', '100.00', { person: { name: 'Alice', isSelf: false } }),
        ],
        payments: [],
      };

      const balances = buildOrderBalances(order);

      expect(balances[0].pending).toBe(100);
    });
  });
});

const { buildDashboardSummary } = require('../src/utils/dashboardProjection');

const person = (id, name, isSelf = false) => ({
  id,
  name,
  isSelf,
});

const item = (personId, chargedValue, extra = {}) => ({
  personId,
  chargedValue,
  person: extra.person ?? null,
  ...extra,
});

const order = (overrides = {}) => ({
  id: 'order-1',
  totalValue: '0.00',
  status: 'PENDENTE',
  orderDate: new Date(2026, 0, 15),
  items: [],
  payments: [],
  ...overrides,
});

const payment = (personId, amount, paidAt, extra = {}) => ({
  personId,
  amount,
  paidAt,
  person: extra.person ?? null,
  ...extra,
});

describe('dashboardProjection util', () => {
  const currentDate = new Date(2026, 2, 20); // March 2026

  describe('buildDashboardSummary', () => {
    it('returns zeroed summary for empty inputs', () => {
      const summary = buildDashboardSummary([], [], { currentDate });

      expect(summary).toEqual({
        totalPending: 0,
        totalPaid: 0,
        currentMonthReceipts: 0,
        personBalances: [],
        yearlyBreakdown: [],
      });
    });

    it('counts the full totalValue as paid for QUITADO orders', () => {
      const orders = [
        order({
          status: 'QUITADO',
          totalValue: '150.00',
          items: [item('p1', '150.00', { person: person('p1', 'Alice') })],
        }),
      ];

      const summary = buildDashboardSummary(orders, [], { currentDate });

      expect(summary.totalPaid).toBe(150);
      expect(summary.totalPending).toBe(0);
    });

    it('computes pending as totalValue minus self items minus payments', () => {
      const orders = [
        order({
          status: 'PARCIAL',
          totalValue: '100.00',
          items: [
            item('self', '30.00', { person: person('self', 'Me', true) }),
            item('p1', '70.00', { person: person('p1', 'Alice') }),
          ],
          payments: [payment('p1', '20.00')],
        }),
      ];

      const summary = buildDashboardSummary(orders, orders[0].payments, {
        currentDate,
      });

      expect(summary.totalPending).toBe(50);
      expect(summary.totalPaid).toBe(0);
    });

    it('clamps negative pending to zero', () => {
      const orders = [
        order({
          status: 'PARCIAL',
          totalValue: '50.00',
          items: [item('p1', '50.00', { person: person('p1', 'Alice') })],
          payments: [payment('p1', '60.00')],
        }),
      ];

      const summary = buildDashboardSummary(orders, orders[0].payments, {
        currentDate,
      });

      expect(summary.totalPending).toBe(0);
    });

    it('sums receipts from the current month of currentDate only', () => {
      const payments = [
        payment('p1', '10.00', new Date(2026, 2, 5)),
        payment('p1', '5.50', new Date(2026, 2, 28)),
        payment('p1', '7.00', new Date(2026, 1, 15)), // February
        payment('p1', '3.00', new Date(2025, 2, 15)), // previous year
      ];

      const summary = buildDashboardSummary([], payments, { currentDate });

      expect(summary.currentMonthReceipts).toBe(15.5);
    });

    it('aggregates person balances across orders and uses "Sem pessoa" for personless items', () => {
      const orders = [
        order({
          items: [
            item('p1', '10.00', { person: person('p1', 'Alice') }),
            item('p1', '5.00', { person: person('p1', 'Alice') }),
            item(null, '9.99'),
          ],
          payments: [
            payment('p1', '3.00', undefined, { person: person('p1', 'Alice') }),
          ],
        }),
        order({
          items: [item('p2', '8.00', { person: person('p2', 'Bob') })],
        }),
      ];

      const summary = buildDashboardSummary(orders, orders[0].payments, {
        currentDate,
      });

      expect(summary.personBalances).toEqual([
        {
          personId: 'p1',
          personName: 'Alice',
          isSelf: false,
          itemTotal: 15,
          paymentTotal: 3,
          pending: 12,
        },
        {
          personId: 'p2',
          personName: 'Bob',
          isSelf: false,
          itemTotal: 8,
          paymentTotal: 0,
          pending: 8,
        },
        {
          personId: 'unknown',
          personName: 'Sem pessoa',
          isSelf: false,
          itemTotal: 9.99,
          paymentTotal: 0,
          pending: 9.99,
        },
      ]);
    });

    it('keeps pending 0 for self persons in the balance list', () => {
      const orders = [
        order({
          items: [
            item('self', '40.00', { person: person('self', 'Me', true) }),
          ],
        }),
      ];

      const summary = buildDashboardSummary(orders, [], { currentDate });

      expect(summary.personBalances[0].isSelf).toBe(true);
      expect(summary.personBalances[0].pending).toBe(0);
    });

    it('sorts person balances by name', () => {
      const orders = [
        order({
          items: [
            item('p1', '10.00', { person: person('p1', 'Zeca') }),
            item('p2', '10.00', { person: person('p2', 'Ana') }),
          ],
        }),
      ];

      const summary = buildDashboardSummary(orders, [], { currentDate });

      expect(summary.personBalances.map((b) => b.personName)).toEqual([
        'Ana',
        'Zeca',
      ]);
    });

    it('splits yearly breakdown between quitado and pending and sorts years descending', () => {
      const orders = [
        order({
          orderDate: new Date(2025, 5, 10),
          status: 'QUITADO',
          totalValue: '200.00',
        }),
        order({
          orderDate: new Date(2026, 0, 10),
          status: 'PENDENTE',
          totalValue: '100.00',
          items: [item('p1', '100.00', { person: person('p1', 'Alice') })],
        }),
        order({
          orderDate: new Date(2026, 1, 10),
          status: 'QUITADO',
          totalValue: '60.00',
        }),
      ];

      const summary = buildDashboardSummary(orders, [], { currentDate });

      expect(summary.yearlyBreakdown).toEqual([
        { year: 2026, totalPending: 100, totalQuitado: 60 },
        { year: 2025, totalPending: 0, totalQuitado: 200 },
      ]);
    });

    it('does not subtract payments from the yearly pending entry', () => {
      const orders = [
        order({
          orderDate: new Date(2026, 0, 10),
          status: 'PARCIAL',
          totalValue: '100.00',
          items: [item('p1', '100.00', { person: person('p1', 'Alice') })],
          payments: [payment('p1', '40.00')],
        }),
      ];

      const summary = buildDashboardSummary(orders, orders[0].payments, {
        currentDate,
      });

      expect(summary.yearlyBreakdown[0].totalPending).toBe(100);
    });
  });
});

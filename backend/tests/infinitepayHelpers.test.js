import {
  decorateSaleForMatch,
  matchRowToSales,
} from '../src/utils/infinitepayHelpers.js';

const sale = (overrides = {}) => ({
  id: 'sale-1',
  orderNumber: 'V-0001',
  totalValue: '100.00',
  items: [{ person: { name: 'Maria Souza' } }],
  payments: [],
  ...overrides,
});

describe('decorateSaleForMatch', () => {
  it('projects the sale into total/paid/pending cents and client name', () => {
    const decorated = decorateSaleForMatch(
      sale({ payments: [{ amount: '40.00' }] }),
    );

    expect(decorated).toEqual({
      id: 'sale-1',
      orderNumber: 'V-0001',
      totalCents: 10000,
      clientName: 'Maria Souza',
      pendingCents: 6000,
    });
  });

  it('never reports a negative pending when overpaid', () => {
    const decorated = decorateSaleForMatch(
      sale({ payments: [{ amount: '150.00' }] }),
    );
    expect(decorated.pendingCents).toBe(0);
  });

  it('falls back to null client name without items', () => {
    const decorated = decorateSaleForMatch(sale({ items: [] }));
    expect(decorated.clientName).toBeNull();
  });
});

describe('matchRowToSales', () => {
  const row = { valorCents: 10000, liquidoCents: 9500 };

  it('matches a sale whose total equals the gross value (fee not passed)', () => {
    const matches = matchRowToSales(row, [
      {
        id: 's1',
        orderNumber: 'V-1',
        totalCents: 10000,
        clientName: 'A',
        pendingCents: 10000,
      },
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0].matchType).toBe('gross');
  });

  it('matches a sale whose total equals the net value (fee passed)', () => {
    const matches = matchRowToSales(row, [
      {
        id: 's1',
        orderNumber: 'V-1',
        totalCents: 9500,
        clientName: 'A',
        pendingCents: 9500,
      },
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0].matchType).toBe('net');
  });

  it('accepts a difference of exactly 2 cents', () => {
    const matches = matchRowToSales(row, [
      {
        id: 's1',
        orderNumber: 'V-1',
        totalCents: 10002,
        clientName: 'A',
        pendingCents: 10002,
      },
      {
        id: 's2',
        orderNumber: 'V-2',
        totalCents: 9498,
        clientName: 'B',
        pendingCents: 9498,
      },
    ]);

    expect(matches.map((m) => m.matchType)).toEqual(['gross', 'net']);
  });

  it('rejects a difference of 3 cents', () => {
    const matches = matchRowToSales(row, [
      {
        id: 's1',
        orderNumber: 'V-1',
        totalCents: 10003,
        clientName: 'A',
        pendingCents: 10003,
      },
    ]);
    expect(matches).toEqual([]);
  });

  it('chooses the net match when the net difference is smaller', () => {
    // Both within 2 cents; net is closer (diff 1) than gross (diff 2).
    const matches = matchRowToSales(row, [
      {
        id: 's1',
        orderNumber: 'V-1',
        totalCents: 9499,
        clientName: 'A',
        pendingCents: 9499,
      },
    ]);
    expect(matches[0].matchType).toBe('net');
  });

  it('prefers gross on an exact tie', () => {
    const matches = matchRowToSales(row, [
      {
        id: 's1',
        orderNumber: 'V-1',
        totalCents: 10000,
        clientName: 'A',
        pendingCents: 10000,
      },
    ]);
    expect(matches[0].matchType).toBe('gross');
  });

  it('sorts the closest matches first', () => {
    const matches = matchRowToSales(row, [
      {
        id: 'far',
        orderNumber: 'V-3',
        totalCents: 10002,
        clientName: 'C',
        pendingCents: 10002,
      },
      {
        id: 'exact',
        orderNumber: 'V-1',
        totalCents: 10000,
        clientName: 'A',
        pendingCents: 10000,
      },
    ]);
    expect(matches.map((m) => m.saleId)).toEqual(['exact', 'far']);
  });

  it('returns an empty list when there are no sales', () => {
    expect(matchRowToSales(row, [])).toEqual([]);
  });

  it('honors a custom tolerance', () => {
    const matches = matchRowToSales(
      row,
      [
        {
          id: 's1',
          orderNumber: 'V-1',
          totalCents: 10050,
          clientName: 'A',
          pendingCents: 10050,
        },
      ],
      100,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].matchType).toBe('gross');
  });
});

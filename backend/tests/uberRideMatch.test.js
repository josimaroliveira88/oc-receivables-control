import { describe, it, expect } from 'vitest';
import {
  buildRideMatches,
  MATCHABLE_ORIGINS,
  selectMatchableRides,
} from '../src/utils/uberRideMatch.js';

const ride = (overrides = {}) => ({
  id: 'ride-1',
  status: 'COMPLETED',
  launched: false,
  amountCents: 3293,
  ...overrides,
});

const transaction = (overrides = {}) => ({
  id: 'tx-1',
  origin: 'MANUAL',
  description: 'Custo entrega',
  transactionDate: new Date('2026-09-20T00:00:00.000Z'),
  amount: '32.93',
  orderId: null,
  order: null,
  ...overrides,
});

describe('uberRideMatch', () => {
  it('exposes only manual and sale-additional rows as matchable origins', () => {
    expect(MATCHABLE_ORIGINS).toEqual(['MANUAL', 'VENDA_ADICIONAL']);
  });

  it('selects only completed, not-launched rides', () => {
    const rides = [
      ride({ id: 'ok' }),
      ride({ id: 'launched', launched: true }),
      ride({ id: 'cancelled', status: 'CANCELLED' }),
    ];

    expect(selectMatchableRides(rides).map((r) => r.id)).toEqual(['ok']);
  });

  it('matches rows by exact value and normalizes decimals to cents', () => {
    const matches = buildRideMatches(
      [
        ride({ id: 'a', amountCents: 3293 }),
        ride({ id: 'b', amountCents: 1000 }),
      ],
      [
        transaction({ id: 'tx-hi', amount: '32.93' }),
        transaction({ id: 'tx-lo', amount: '10.00' }),
        transaction({ id: 'tx-other', amount: '99.99' }),
      ],
    );

    expect(matches.get('a').map((m) => m.transactionId)).toEqual(['tx-hi']);
    expect(matches.get('b').map((m) => m.transactionId)).toEqual(['tx-lo']);
  });

  it('returns an empty match list when no row shares the value', () => {
    const matches = buildRideMatches(
      [ride()],
      [transaction({ amount: '1.00' })],
    );
    expect(matches.get('ride-1')).toEqual([]);
  });

  it('orders matches newest first', () => {
    const matches = buildRideMatches(
      [ride()],
      [
        transaction({
          id: 'old',
          transactionDate: new Date('2026-09-01T00:00:00.000Z'),
        }),
        transaction({
          id: 'new',
          transactionDate: new Date('2026-09-25T00:00:00.000Z'),
        }),
      ],
    );

    expect(matches.get('ride-1').map((m) => m.transactionId)).toEqual([
      'new',
      'old',
    ]);
  });

  it('exposes the linked sale data of the matched row', () => {
    const matches = buildRideMatches(
      [ride()],
      [
        transaction({
          id: 'tx-sale',
          orderId: 'sale-1',
          order: {
            orderNumber: 'V-0007',
            totalValue: '100.00',
            items: [{ person: { name: 'Maria' } }],
          },
        }),
      ],
    );

    expect(matches.get('ride-1')[0]).toMatchObject({
      transactionId: 'tx-sale',
      orderId: 'sale-1',
      orderNumber: 'V-0007',
      clientName: 'Maria',
      saleTotalValue: '100.00',
      amountCents: 3293,
    });
  });
});

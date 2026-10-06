import { describe, it, expect } from 'vitest';
import {
  buildRideLaunchItem,
  defaultRideDescription,
  filterRides,
  formatRideDateTime,
  formatRideMatchLabel,
  formatSaleOptionLabel,
  isRideSelectable,
  makeSelection,
  matchOriginLabel,
  pickDefaultMatch,
  profileTypeLabel,
  rideStatusLabel,
  rideTypeLabel,
  saleLabelFromMatch,
  summarizeRides,
} from '../src/pages/UberRides/utils/uberRideHelpers';

const ride = (overrides = {}) => ({
  id: 'ride-1',
  externalId: 'ext-1',
  status: 'COMPLETED',
  amountCents: 3293,
  destination: 'Duo Residence Mall',
  riderName: 'Cássia',
  profileType: 'FAMILY',
  rideType: 'RIDE',
  launched: false,
  transactionId: null,
  requestedAt: '2026-09-26T16:02:00.000Z',
  matches: [],
  ...overrides,
});

const match = (overrides = {}) => ({
  transactionId: 'tx-1',
  origin: 'MANUAL',
  description: 'Custo entrega',
  transactionDate: '2026-09-20T00:00:00.000Z',
  amountCents: 3293,
  orderId: null,
  orderNumber: null,
  clientName: null,
  saleTotalValue: null,
  ...overrides,
});

describe('uberRideHelpers', () => {
  it('formats the ride wall-clock without a timezone shift', () => {
    expect(formatRideDateTime('2026-09-25T07:43:00.000Z')).toBe(
      '25/09/2026 07:43',
    );
    expect(formatRideDateTime(null)).toBe('');
    expect(formatRideDateTime('not-a-date')).toBe('');
  });

  it('builds the default ledger description', () => {
    expect(defaultRideDescription(ride())).toBe(
      'Uber — Duo Residence Mall (Cássia)',
    );
    expect(defaultRideDescription({ destination: 'Mall' })).toBe('Uber — Mall');
    expect(defaultRideDescription({})).toBe('Uber');
  });

  it('labels status and profile', () => {
    expect(rideStatusLabel('COMPLETED')).toBe('Concluída');
    expect(rideStatusLabel('CANCELLED')).toBe('Cancelada');
    expect(profileTypeLabel('FAMILY')).toBe('Família');
    expect(profileTypeLabel(null)).toBe('—');
  });

  it('labels the ride type', () => {
    expect(rideTypeLabel('RIDE')).toBe('Passageiro');
    expect(rideTypeLabel('DELIVERY')).toBe('Entrega');
    expect(rideTypeLabel('UNKNOWN')).toBe('Não identificado');
    expect(rideTypeLabel(undefined)).toBe('—');
  });

  it('only treats completed, not-launched rides as launchable', () => {
    expect(isRideSelectable(ride())).toBe(true);
    expect(isRideSelectable(ride({ launched: true }))).toBe(false);
    expect(isRideSelectable(ride({ status: 'CANCELLED' }))).toBe(false);
  });

  it('builds a selection with the create defaults', () => {
    expect(
      makeSelection(ride(), { defaultCategoryId: 'cat-transporte' }),
    ).toEqual({
      categoryId: 'cat-transporte',
      description: 'Uber — Duo Residence Mall (Cássia)',
      orderId: null,
      orderLabel: '',
      matchTransactionId: null,
      card: true,
      effectiveDate: '',
    });
  });

  it('pre-selects the matched row and its sale', () => {
    const selection = makeSelection(ride(), {
      defaultCategoryId: 'cat-transporte',
      defaultMatch: match({
        transactionId: 'tx-9',
        orderId: 'sale-9',
        orderNumber: 'V-0009',
        clientName: 'João',
        saleTotalValue: '100.00',
      }),
      defaultEffectiveDate: '2026-10-05',
    });

    expect(selection).toMatchObject({
      matchTransactionId: 'tx-9',
      orderId: 'sale-9',
      effectiveDate: '2026-10-05',
    });
    expect(selection.orderLabel).toBe('V-0009 — João — R$\u00a0100,00');
  });

  it('picks the first suggested match as the default', () => {
    const withMatches = ride({ matches: [match({ transactionId: 'a' })] });
    expect(pickDefaultMatch(withMatches).transactionId).toBe('a');
    expect(pickDefaultMatch(ride())).toBeNull();
  });

  it('formats a match label and its origin', () => {
    expect(
      formatRideMatchLabel(
        match({
          transactionDate: '2026-09-20T00:00:00.000Z',
          description: 'Custo entrega',
        }),
      ),
    ).toBe('20/09/2026 — Custo entrega');
    expect(matchOriginLabel('MANUAL')).toBe('Manual');
    expect(matchOriginLabel('VENDA_ADICIONAL')).toBe('Venda adicional');
  });

  it('builds the sale label from a matched row', () => {
    expect(
      saleLabelFromMatch({
        orderNumber: 'V-0007',
        clientName: 'Maria',
        saleTotalValue: '100.00',
      }),
    ).toBe('V-0007 — Maria — R$\u00a0100,00');
    expect(saleLabelFromMatch(match())).toBe('');
  });

  it('builds a create payload, ignoring a selected match', () => {
    const selection = {
      ...makeSelection(ride(), { defaultCategoryId: 'cat-transporte' }),
      matchTransactionId: 'tx-1',
      orderId: 'sale-9',
    };

    expect(buildRideLaunchItem(ride(), selection)).toEqual({
      rideId: 'ride-1',
      categoryId: 'cat-transporte',
      description: 'Uber — Duo Residence Mall (Cássia)',
      orderId: 'sale-9',
    });
  });

  it('builds a reconcile payload with the matched transaction and no category', () => {
    const selection = {
      ...makeSelection(ride(), { defaultCategoryId: 'cat-transporte' }),
      matchTransactionId: 'tx-1',
      orderId: 'sale-9',
    };

    expect(buildRideLaunchItem(ride(), selection, { reconcile: true })).toEqual(
      {
        rideId: 'ride-1',
        categoryId: null,
        description: 'Uber — Duo Residence Mall (Cássia)',
        orderId: 'sale-9',
        matchTransactionId: 'tx-1',
      },
    );
  });

  it('sends null category and description when cleared', () => {
    const selection = { categoryId: '', description: '   ', orderId: null };
    expect(buildRideLaunchItem(ride(), selection)).toEqual({
      rideId: 'ride-1',
      categoryId: null,
      description: null,
      orderId: null,
    });
  });

  it('formats a sale option label with client name and value', () => {
    expect(
      formatSaleOptionLabel({
        orderNumber: 'V-0001',
        clientName: 'Ana',
        totalValue: '100.00',
      }),
    ).toBe('V-0001 — Ana — R$\u00a0100,00');
    expect(
      formatSaleOptionLabel({ orderNumber: 'V-0002', totalValue: '50' }),
    ).toBe('V-0002 — R$\u00a050,00');
    expect(formatSaleOptionLabel({ orderNumber: 'V-0003' })).toBe('V-0003');
    expect(formatSaleOptionLabel(null)).toBe('');
  });

  it('summarizes the rides and the pending amount', () => {
    const rides = [
      ride(),
      ride({ id: 'r2', status: 'CANCELLED', amountCents: 1200 }),
      ride({ id: 'r3', launched: true, amountCents: 500 }),
    ];

    expect(summarizeRides(rides)).toEqual({
      total: 3,
      completed: 2,
      cancelled: 1,
      launched: 1,
      totalCents: 4993,
      pendingCents: 3293,
    });
  });

  it('filters rides by status, profile, type, pending and accent-insensitive search', () => {
    const rides = [
      ride(),
      ride({ id: 'r2', status: 'CANCELLED' }),
      ride({ id: 'r3', profileType: 'PERSONAL' }),
      ride({ id: 'r4', rideType: 'DELIVERY' }),
    ];

    expect(
      filterRides(rides, { status: 'CANCELLED' }).map((r) => r.id),
    ).toEqual(['r2']);
    expect(
      filterRides(rides, { profileType: 'PERSONAL' }).map((r) => r.id),
    ).toEqual(['r3']);
    expect(
      filterRides(rides, { rideType: 'DELIVERY' }).map((r) => r.id),
    ).toEqual(['r4']);
    expect(filterRides(rides, { search: 'cassia' }).map((r) => r.id)).toEqual([
      'ride-1',
      'r2',
      'r3',
      'r4',
    ]);
    expect(filterRides(rides, { launched: 'no' }).length).toBe(4);
  });
});

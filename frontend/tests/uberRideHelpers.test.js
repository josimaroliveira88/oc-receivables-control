import { describe, it, expect } from 'vitest';
import {
  buildExpenseItems,
  defaultRideDescription,
  filterRides,
  formatRideDateTime,
  isRideSelectable,
  makeSelection,
  profileTypeLabel,
  rideStatusLabel,
  rideTypeLabel,
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

  it('only treats completed, not-launched rides as selectable', () => {
    expect(isRideSelectable(ride())).toBe(true);
    expect(isRideSelectable(ride({ launched: true }))).toBe(false);
    expect(isRideSelectable(ride({ status: 'CANCELLED' }))).toBe(false);
  });

  it('builds expense items from selections, ignoring blank descriptions', () => {
    const rides = [ride(), ride({ id: 'ride-2', launched: true })];
    const selections = {
      'ride-1': makeSelection(ride(), 'cat-transporte'),
      'ride-2': makeSelection(rides[1], 'cat-transporte'),
    };

    expect(buildExpenseItems(rides, selections)).toEqual([
      {
        rideId: 'ride-1',
        categoryId: 'cat-transporte',
        description: 'Uber — Duo Residence Mall (Cássia)',
      },
    ]);
  });

  it('sends null category and description when cleared', () => {
    const rides = [ride()];
    const selections = {
      'ride-1': { selected: true, categoryId: '', description: '   ' },
    };

    expect(buildExpenseItems(rides, selections)).toEqual([
      { rideId: 'ride-1', categoryId: null, description: null },
    ]);
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

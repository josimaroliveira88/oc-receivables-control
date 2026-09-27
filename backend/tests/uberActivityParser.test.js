import { describe, it, expect } from 'vitest';
import {
  UberActivityError,
  parseUberActivities,
  classifyRideType,
} from '../src/utils/uberActivityParser.js';

const activity = (overrides = {}) => ({
  uuid: '0a6ea135-cb1c-48ac-9b53-82315bf1935b',
  cardURL: 'https://riders.uber.com/trips/0a6ea135-cb1c-48ac-9b53-82315bf1935b',
  description: 'R$32,93 • Cássia',
  subtitle: '26 de set. • 13:02',
  title: 'Duo Residence Mall',
  ...overrides,
});

const envelope = (atividades, overrides = {}) => ({
  source: 'UBER_SESSION',
  windowStart: '2026-08-28T00:00:00.000Z',
  windowEnd: '2026-09-28T00:00:00.000Z',
  profiles: {
    FAMILY: {
      total: atividades.length,
      corridas: atividades.length,
      canceladas: 0,
      atividades,
    },
  },
  ...overrides,
});

const parse = (atividades, overrides = {}) =>
  parseUberActivities(JSON.stringify(envelope(atividades, overrides)));

describe('parseUberActivities', () => {
  it('parses amount in integer cents and the rider as the last segment', () => {
    const { rides, warnings } = parse([activity()]);

    expect(warnings).toEqual([]);
    expect(rides).toHaveLength(1);
    expect(rides[0]).toMatchObject({
      externalId: '0a6ea135-cb1c-48ac-9b53-82315bf1935b',
      amountCents: 3293,
      currency: 'BRL',
      riderName: 'Cássia',
      destination: 'Duo Residence Mall',
      status: 'COMPLETED',
      profileType: 'FAMILY',
    });
    expect(rides[0].requestedAt.toISOString()).toBe('2026-09-26T13:02:00.000Z');
  });

  it('marks a cancelled ride and keeps the rider after the status segment', () => {
    const { rides } = parse([
      activity({ description: 'R$12,00 • Cancelada • Cássia' }),
    ]);

    expect(rides).toHaveLength(1);
    expect(rides[0].status).toBe('CANCELLED');
    expect(rides[0].riderName).toBe('Cássia');
    expect(rides[0].amountCents).toBe(1200);
  });

  it('handles the thousands separator without float math', () => {
    const { rides } = parse([
      activity({ description: 'R$ 1.234,56 • Cássia' }),
    ]);

    expect(rides[0].amountCents).toBe(123456);
  });

  it('classifies the ride type from the vehicle asset', () => {
    const { rides } = parse([
      activity({
        uuid: 'delivery',
        imageURL:
          'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/MotorcycleCourier-037-0.png',
      }),
      activity({
        uuid: 'passenger',
        imageURL:
          'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/UberX.png',
      }),
      activity({
        uuid: 'map',
        imageURL: 'https://static-maps.uber.com/map?width=540&height=200',
      }),
      activity({ uuid: 'none', imageURL: null }),
    ]);

    const byId = Object.fromEntries(
      rides.map((ride) => [ride.externalId, ride]),
    );
    expect(byId.delivery.rideType).toBe('DELIVERY');
    expect(byId.passenger.rideType).toBe('RIDE');
    expect(byId.map.rideType).toBe('UNKNOWN');
    expect(byId.none.rideType).toBe('UNKNOWN');
  });

  it('accepts the full month name', () => {
    const { rides } = parse([activity({ subtitle: '3 de setembro • 08:15' })]);

    expect(rides[0].requestedAt.toISOString()).toBe('2026-09-03T08:15:00.000Z');
  });

  it('infers the year across a window crossing December into January', () => {
    const { rides } = parseUberActivities(
      JSON.stringify(
        envelope(
          [
            activity({ uuid: 'dec', subtitle: '30 de dez. • 10:00' }),
            activity({ uuid: 'jan', subtitle: '2 de jan. • 09:00' }),
          ],
          {
            windowStart: '2025-12-25T00:00:00.000Z',
            windowEnd: '2026-01-05T00:00:00.000Z',
          },
        ),
      ),
    );

    const dec = rides.find((ride) => ride.externalId === 'dec');
    const jan = rides.find((ride) => ride.externalId === 'jan');
    expect(dec.requestedAt.toISOString()).toBe('2025-12-30T10:00:00.000Z');
    expect(jan.requestedAt.toISOString()).toBe('2026-01-02T09:00:00.000Z');
  });

  it('shifts the absolute window into the capture offset before matching', () => {
    // Window is the Brasília calendar day 26 (03:00Z → 03:00Z). With the default
    // -180 offset a 00:30 ride is inside; without it (offset 0) it is not.
    const build = (extra) =>
      JSON.stringify({
        windowStart: '2026-09-26T03:00:00.000Z',
        windowEnd: '2026-09-27T03:00:00.000Z',
        profiles: {
          FAMILY: {
            atividades: [activity({ subtitle: '26 de set. • 00:30' })],
          },
        },
        ...extra,
      });

    expect(parseUberActivities(build({})).rides).toHaveLength(1);
    expect(
      parseUberActivities(build({ utcOffsetMinutes: 0 })).rides,
    ).toHaveLength(0);
  });

  it('warns and drops an activity whose cardURL is not a trip', () => {
    const { rides, warnings } = parse([
      activity({ cardURL: 'https://riders.uber.com/other' }),
    ]);

    expect(rides).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/cardURL sem \/trips\//);
  });

  it('warns and drops an activity without uuid', () => {
    const { rides, warnings } = parse([activity({ uuid: null })]);

    expect(rides).toEqual([]);
    expect(warnings[0]).toMatch(/sem uuid/);
  });

  it('warns and drops an activity with an invalid amount', () => {
    const { rides, warnings } = parse([
      activity({ description: 'Valor indisponível' }),
    ]);

    expect(rides).toEqual([]);
    expect(warnings[0]).toMatch(/valor inválido/);
  });

  it('warns and drops a subtitle outside the window', () => {
    const { rides, warnings } = parse([
      activity({ subtitle: '10 de jan. • 10:00' }),
    ]);

    expect(rides).toEqual([]);
    expect(warnings[0]).toMatch(/fora da janela/);
  });

  it('keeps a single ride when the same uuid appears twice', () => {
    const { rides, warnings } = parse([activity(), activity()]);

    expect(rides).toHaveLength(1);
    expect(warnings.some((warning) => /duplicada/.test(warning))).toBe(true);
  });

  it('accepts the raw GraphQL activities shape', () => {
    const { rides } = parseUberActivities(
      JSON.stringify({
        windowStart: '2026-08-28T00:00:00.000Z',
        windowEnd: '2026-09-28T00:00:00.000Z',
        data: {
          activities: { past: { activities: [activity()] } },
        },
      }),
    );

    expect(rides).toHaveLength(1);
    expect(rides[0].amountCents).toBe(3293);
  });

  it('accepts both PERSONAL and FAMILY top-level profile keys', () => {
    const { rides } = parseUberActivities(
      JSON.stringify({
        windowStart: '2026-08-28T00:00:00.000Z',
        windowEnd: '2026-09-28T00:00:00.000Z',
        PERSONAL: { atividades: [activity({ uuid: 'p1' })] },
        FAMILY: { atividades: [activity({ uuid: 'f1' })] },
      }),
    );

    expect(rides.map((ride) => ride.externalId).sort()).toEqual(['f1', 'p1']);
    expect(rides.find((ride) => ride.externalId === 'p1').profileType).toBe(
      'PERSONAL',
    );
  });

  it('rejects a file without a resolvable window', () => {
    expect(() =>
      parseUberActivities(JSON.stringify({ profiles: { FAMILY: {} } })),
    ).toThrow(UberActivityError);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseUberActivities('{ not json')).toThrow(UberActivityError);
  });
});

describe('classifyRideType', () => {
  it('flags courier and motorcycle assets as deliveries', () => {
    expect(
      classifyRideType(
        'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/MotorcycleCourier-037-0.png',
      ),
    ).toBe('DELIVERY');
    expect(classifyRideType({ light: 'https://x/.../MotoCourier.png' })).toBe(
      'DELIVERY',
    );
  });

  it('flags car assets as passenger rides', () => {
    expect(
      classifyRideType(
        'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/UberX-1.png',
      ),
    ).toBe('RIDE');
  });

  it('returns UNKNOWN for the route map, empty or unrecognized values', () => {
    expect(classifyRideType('https://static-maps.uber.com/map?width=540')).toBe(
      'UNKNOWN',
    );
    expect(classifyRideType(null)).toBe('UNKNOWN');
    expect(classifyRideType(undefined)).toBe('UNKNOWN');
    expect(classifyRideType('https://example.com/whatever.png')).toBe(
      'UNKNOWN',
    );
  });
});

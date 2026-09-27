import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { createTestUser } from './helpers/createTestUser.js';

const activity = (overrides = {}) => ({
  uuid: overrides.uuid ?? randomUUID(),
  cardURL: `https://riders.uber.com/trips/${overrides.uuid ?? 'x'}`,
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

describe('Uber ride import', () => {
  let user;

  beforeAll(async () => {
    await prisma.$connect();
    user = await createTestUser('uber_import');
  });

  // Each test imports its own rides, so the accumulated rows of one test would
  // otherwise show up in the next one's list assertions. The suite only passes
  // in declaration order without this.
  afterEach(async () => {
    if (!user) return;
    await prisma.financialTransaction.deleteMany({
      where: { userId: user.user.id },
    });
    await prisma.rideRecord.deleteMany({ where: { userId: user.user.id } });
  });

  afterAll(async () => {
    if (user) {
      await prisma.financialTransaction.deleteMany({
        where: { userId: user.user.id },
      });
      await prisma.rideRecord.deleteMany({ where: { userId: user.user.id } });
      await prisma.user.delete({ where: { id: user.user.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  const importRides = (body, token = user.token) =>
    request(app)
      .post('/api/uber/rides/import')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const listRides = (token = user.token, query = '') =>
    request(app)
      .get(`/api/uber/rides${query}`)
      .set('Authorization', `Bearer ${token}`);

  it('imports rides with rider, amount, date and status', async () => {
    const response = await importRides({
      json: JSON.stringify(
        envelope([
          activity({
            uuid: 'ride-1',
            imageURL:
              'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/MotorcycleCourier-037-0.png',
          }),
          activity({ uuid: 'ride-2', description: 'R$12,00 • Cancelada' }),
        ]),
      ),
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      total: 2,
      created: 2,
      updated: 0,
      cancelled: 1,
    });
    expect(response.body.batchId).toBeTruthy();
    expect(response.body.warnings).toEqual([]);

    const rides = await listRides();
    expect(rides.status).toBe(200);
    expect(rides.body).toHaveLength(2);
    const ride = rides.body.find((row) => row.externalId === 'ride-1');
    expect(ride).toMatchObject({
      amountCents: 3293,
      riderName: 'Cássia',
      destination: 'Duo Residence Mall',
      status: 'COMPLETED',
      rideType: 'DELIVERY',
      launched: false,
    });
  });

  it('rejects an invalid JSON with 400', async () => {
    const response = await importRides({ json: 'nao-e-json' });
    expect(response.status).toBe(400);
  });

  it('requires the json field', async () => {
    const response = await importRides({});
    expect(response.status).toBe(400);
  });

  it('is idempotent: re-importing the same JSON updates instead of duplicating', async () => {
    const json = JSON.stringify(envelope([activity({ uuid: 'ride-idem' })]));

    const first = await importRides({ json });
    const second = await importRides({ json });

    expect(first.body.created).toBe(1);
    expect(second.body).toMatchObject({ created: 0, updated: 1 });

    const count = await prisma.rideRecord.count({
      where: { userId: user.user.id, externalId: 'ride-idem' },
    });
    expect(count).toBe(1);
  });

  it('does not expose rides of another user', async () => {
    const other = await createTestUser('uber_import_other');
    await importRides({
      json: JSON.stringify(envelope([activity({ uuid: 'other-ride' })])),
    });

    const response = await listRides(other.token);
    expect(response.status).toBe(200);
    expect(
      response.body.find((row) => row.externalId === 'other-ride'),
    ).toBeUndefined();

    await prisma.rideRecord.deleteMany({ where: { userId: other.user.id } });
    await prisma.user.delete({ where: { id: other.user.id } }).catch(() => {});
  });

  it('filters rides by status and launch state', async () => {
    // Bring its own data: asserting `every(...)` on an empty list would pass
    // without exercising the filter at all.
    await importRides({
      json: JSON.stringify(
        envelope([
          activity({ uuid: 'filter-completed', description: 'R$32,93 • Ana' }),
          activity({
            uuid: 'filter-cancelled',
            description: 'R$12,00 • Cancelada',
          }),
        ]),
      ),
    });

    const completed = await listRides(user.token, '?status=COMPLETED');
    expect(completed.body).toHaveLength(1);
    expect(completed.body[0].externalId).toBe('filter-completed');
    expect(completed.body.every((row) => row.status === 'COMPLETED')).toBe(
      true,
    );

    const pending = await listRides(user.token, '?launched=no');
    expect(pending.body).toHaveLength(2);
    expect(pending.body.every((row) => row.launched === false)).toBe(true);
  });

  it('undoes an import batch, keeping launched rides', async () => {
    const importResponse = await importRides({
      json: JSON.stringify(envelope([activity({ uuid: 'ride-undo' })])),
    });
    const { batchId } = importResponse.body;

    const undo = await request(app)
      .delete(`/api/uber/rides/batch/${batchId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(undo.status).toBe(200);
    expect(undo.body.removed).toBe(1);

    const remaining = await prisma.rideRecord.count({
      where: { userId: user.user.id, externalId: 'ride-undo' },
    });
    expect(remaining).toBe(0);
  });
});

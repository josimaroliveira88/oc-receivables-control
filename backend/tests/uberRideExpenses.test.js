import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { createTestUser } from './helpers/createTestUser.js';

const activity = (uuid, overrides = {}) => ({
  uuid,
  cardURL: `https://riders.uber.com/trips/${uuid}`,
  description: 'R$32,93 • Cássia',
  subtitle: '26 de set. • 13:02',
  title: 'Duo Residence Mall',
  ...overrides,
});

const envelope = (atividades) => ({
  windowStart: '2026-08-28T00:00:00.000Z',
  windowEnd: '2026-09-28T00:00:00.000Z',
  profiles: {
    FAMILY: { atividades },
  },
});

describe('Uber ride expenses', () => {
  let user;
  let category;

  beforeAll(async () => {
    await prisma.$connect();
    user = await createTestUser('uber_expenses');
    category = await prisma.financialCategory.findFirst({
      where: { userId: user.user.id, name: 'Transporte', type: 'DESPESA' },
    });
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

  const importRides = (atividades) =>
    request(app)
      .post('/api/uber/rides/import')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ json: JSON.stringify(envelope(atividades)) });

  const createExpenses = (items, token = user.token) =>
    request(app)
      .post('/api/uber/rides/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ items });

  const createExpensesWithPayment = (items, payment, token = user.token) =>
    request(app)
      .post('/api/uber/rides/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ items, payment });

  const rideIdByExternalId = async (externalId) => {
    const ride = await prisma.rideRecord.findFirst({
      where: { userId: user.user.id, externalId },
    });
    return ride.id;
  };

  it('creates a Transporte expense linked to the ride', async () => {
    await importRides([activity('ride-exp-1')]);
    const rideId = await rideIdByExternalId('ride-exp-1');

    const response = await createExpenses([{ rideId }]);

    expect(response.status).toBe(201);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      type: 'DESPESA',
      origin: 'UBER',
      amount: '32.93',
      description: 'Uber — Duo Residence Mall (Cássia)',
      paymentType: null,
      isEffective: true,
    });
    expect(response.body[0].categoryId).toBe(category.id);

    const stored = await prisma.financialTransaction.findUnique({
      where: { rideId },
    });
    expect(stored.origin).toBe('UBER');
    expect(stored.amount.toFixed(2)).toBe('32.93');
  });

  it('launches rides as pending credit-card purchases with the invoice date', async () => {
    await importRides([activity('ride-card-1')]);
    const rideId = await rideIdByExternalId('ride-card-1');

    const response = await createExpensesWithPayment([{ rideId }], {
      type: 'CARTAO_CREDITO',
      effectiveDate: '2026-10-05',
    });

    expect(response.status).toBe(201);
    expect(response.body[0]).toMatchObject({
      origin: 'UBER',
      paymentType: 'CARTAO_CREDITO',
      isEffective: false,
    });
    expect(response.body[0].effectiveDate).toBeTruthy();

    const stored = await prisma.financialTransaction.findUnique({
      where: { rideId },
    });
    expect(stored.isEffective).toBe(false);
    expect(stored.effectiveDate.toISOString().slice(0, 10)).toBe('2026-10-05');
    expect(stored.transactionDate.toISOString().slice(0, 10)).toBe(
      '2026-09-26',
    );
  });

  it('rejects a payment whose invoice date precedes a ride in the batch', async () => {
    await importRides([activity('ride-card-past')]);
    const rideId = await rideIdByExternalId('ride-card-past');

    const response = await createExpensesWithPayment([{ rideId }], {
      type: 'CARTAO_CREDITO',
      effectiveDate: '2026-08-01',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/fatura/i);
    expect(await prisma.financialTransaction.count({ where: { rideId } })).toBe(
      0,
    );
  });

  it('rejects a payment block without the invoice date', async () => {
    await importRides([activity('ride-card-nodate')]);
    const rideId = await rideIdByExternalId('ride-card-nodate');

    const response = await createExpensesWithPayment([{ rideId }], {
      type: 'CARTAO_CREDITO',
    });

    expect(response.status).toBe(400);
  });

  it('marks the ride as launched in the listing', async () => {
    await importRides([activity('ride-launched')]);
    const rideId = await rideIdByExternalId('ride-launched');
    await createExpenses([{ rideId }]);

    const response = await request(app)
      .get('/api/uber/rides')
      .set('Authorization', `Bearer ${user.token}`);

    const ride = response.body.find(
      (row) => row.externalId === 'ride-launched',
    );
    expect(ride.launched).toBe(true);
    expect(ride.transactionId).toBeTruthy();
  });

  it('rejects launching the same ride twice', async () => {
    await importRides([activity('ride-dup')]);
    const rideId = await rideIdByExternalId('ride-dup');

    const first = await createExpenses([{ rideId }]);
    const second = await createExpenses([{ rideId }]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(400);
    expect(second.body.error).toMatch(/já foi lançada/);
  });

  it('rejects a cancelled ride', async () => {
    await importRides([
      activity('ride-cancel', { description: 'R$12,00 • Cancelada' }),
    ]);
    const rideId = await rideIdByExternalId('ride-cancel');

    const response = await createExpenses([{ rideId }]);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/canceladas/);
  });

  it('accepts a custom category and description', async () => {
    await importRides([activity('ride-custom')]);
    const rideId = await rideIdByExternalId('ride-custom');
    const custom = await prisma.financialCategory.create({
      data: {
        userId: user.user.id,
        name: 'Viagens',
        type: 'DESPESA',
      },
    });

    const response = await createExpenses([
      { rideId, categoryId: custom.id, description: 'Corrida cliente' },
    ]);

    expect(response.status).toBe(201);
    expect(response.body[0].categoryId).toBe(custom.id);
    expect(response.body[0].description).toBe('Corrida cliente');
  });

  it('does not let another user launch a ride they do not own', async () => {
    await importRides([activity('ride-foreign')]);
    const rideId = await rideIdByExternalId('ride-foreign');
    const other = await createTestUser('uber_expenses_other');

    const response = await createExpenses([{ rideId }], other.token);

    expect(response.status).toBe(404);
    expect(await prisma.financialTransaction.count({ where: { rideId } })).toBe(
      0,
    );

    await prisma.user.delete({ where: { id: other.user.id } }).catch(() => {});
  });

  it('keeps launched rides when undoing the import batch', async () => {
    const imported = await importRides([activity('ride-keep')]);
    const rideId = await rideIdByExternalId('ride-keep');
    await createExpenses([{ rideId }]);

    const undo = await request(app)
      .delete(`/api/uber/rides/batch/${imported.body.batchId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(undo.status).toBe(200);
    expect(undo.body).toMatchObject({ removed: 0, kept: 1 });
  });

  it('rejects deleting a ride that has already been launched', async () => {
    await importRides([activity('ride-delete-launched')]);
    const rideId = await rideIdByExternalId('ride-delete-launched');
    await createExpenses([{ rideId }]);

    const response = await request(app)
      .delete(`/api/uber/rides/${rideId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/já foi lançada/i);

    // Neither the ride nor its ledger link is removed.
    expect(
      await prisma.rideRecord.findUnique({ where: { id: rideId } }),
    ).not.toBeNull();
    expect(
      await prisma.financialTransaction.findUnique({ where: { rideId } }),
    ).not.toBeNull();
  });
});

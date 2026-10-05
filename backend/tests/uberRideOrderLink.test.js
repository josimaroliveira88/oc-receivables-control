import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { createTestUser } from './helpers/createTestUser.js';

const activity = (uuid) => ({
  uuid,
  cardURL: `https://riders.uber.com/trips/${uuid}`,
  description: 'R$32,93 • Cássia',
  subtitle: '26 de set. • 13:02',
  title: 'Duo Residence Mall',
});

const envelope = (atividades) => ({
  windowStart: '2026-08-28T00:00:00.000Z',
  windowEnd: '2026-09-28T00:00:00.000Z',
  profiles: { FAMILY: { atividades } },
});

// Launching a ride as an expense can optionally reference the sale it
// delivered. The link only accepts the caller's own VENDA rows.
describe('Uber ride expense order link', () => {
  let user;
  let other;
  let saleA;
  let saleB;

  beforeAll(async () => {
    await prisma.$connect();
    user = await createTestUser('uber_order_link');
    other = await createTestUser('uber_order_link_other');
    saleA = await prisma.order.create({
      data: {
        orderNumber: 'V-7001',
        orderType: 'VENDA',
        totalValue: '100.00',
        userId: user.user.id,
      },
    });
    saleB = await prisma.order.create({
      data: {
        orderNumber: 'V-7002',
        orderType: 'VENDA',
        totalValue: '50.00',
        userId: user.user.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: user.user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: other.user.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  const importRide = async (externalId) => {
    await request(app)
      .post('/api/uber/rides/import')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ json: JSON.stringify(envelope([activity(externalId)])) });

    const ride = await prisma.rideRecord.findFirst({
      where: { userId: user.user.id, externalId },
    });
    return ride.id;
  };

  const launch = (items, token = user.token) =>
    request(app)
      .post('/api/uber/rides/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ items });

  it('links the expense to the informed sale', async () => {
    const rideId = await importRide('order-link-1');

    const response = await launch([{ rideId, orderId: saleA.id }]);

    expect(response.status).toBe(201);
    expect(response.body[0].orderId).toBe(saleA.id);
    expect(response.body[0].description).toBe(
      'Uber — Duo Residence Mall (Cássia) — Venda V-7001',
    );

    const stored = await prisma.financialTransaction.findUnique({
      where: { rideId },
    });
    expect(stored.orderId).toBe(saleA.id);
  });

  it('keeps the sale reference when a custom description is sent', async () => {
    const rideId = await importRide('order-link-custom');

    const response = await launch([
      { rideId, orderId: saleA.id, description: 'Entrega cliente' },
    ]);

    expect(response.status).toBe(201);
    expect(response.body[0].description).toBe('Entrega cliente — Venda V-7001');
  });

  it('trims the description so the sale reference fits the column', async () => {
    const rideId = await importRide('order-link-long');
    const longDescription = 'x'.repeat(255);

    const response = await launch([
      { rideId, orderId: saleA.id, description: longDescription },
    ]);

    expect(response.status).toBe(201);
    expect(response.body[0].description.endsWith('— Venda V-7001')).toBe(true);
    expect(response.body[0].description.length).toBeLessThanOrEqual(255);
  });

  it('launches without a sale when orderId is omitted (regression)', async () => {
    const rideId = await importRide('order-link-none');

    const response = await launch([{ rideId }]);

    expect(response.status).toBe(201);
    expect(response.body[0].orderId).toBeNull();
    expect(response.body[0].description).toBe(
      'Uber — Duo Residence Mall (Cássia)',
    );
  });

  it('rejects linking a purchase order', async () => {
    const rideId = await importRide('order-link-compra');
    const purchase = await prisma.order.create({
      data: {
        orderNumber: 'C-7001',
        orderType: 'COMPRA',
        totalValue: '10.00',
        userId: user.user.id,
      },
    });

    const response = await launch([{ rideId, orderId: purchase.id }]);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/venda/i);
    expect(await prisma.financialTransaction.count({ where: { rideId } })).toBe(
      0,
    );
  });

  it('rejects a sale owned by another user', async () => {
    const foreign = await prisma.order.create({
      data: {
        orderNumber: 'V-7001',
        orderType: 'VENDA',
        totalValue: '10.00',
        userId: other.user.id,
      },
    });
    const rideId = await importRide('order-link-foreign');

    const response = await launch([{ rideId, orderId: foreign.id }]);

    expect(response.status).toBe(404);
    expect(await prisma.financialTransaction.count({ where: { rideId } })).toBe(
      0,
    );
  });

  it('rejects a malformed orderId', async () => {
    const rideId = await importRide('order-link-bad');

    const response = await launch([{ rideId, orderId: 'not-a-uuid' }]);

    expect(response.status).toBe(400);
    expect(await prisma.financialTransaction.count({ where: { rideId } })).toBe(
      0,
    );
  });

  it('links different rides of one batch to different sales', async () => {
    const ride1 = await importRide('order-link-batch-1');
    const ride2 = await importRide('order-link-batch-2');

    const response = await launch([
      { rideId: ride1, orderId: saleA.id },
      { rideId: ride2, orderId: saleB.id },
    ]);

    expect(response.status).toBe(201);
    const stored1 = await prisma.financialTransaction.findUnique({
      where: { rideId: ride1 },
    });
    const stored2 = await prisma.financialTransaction.findUnique({
      where: { rideId: ride2 },
    });
    expect(stored1.orderId).toBe(saleA.id);
    expect(stored2.orderId).toBe(saleB.id);
  });

  it('exposes the linked ride in the sale ledger query', async () => {
    const rideId = await importRide('order-link-ledger');
    await launch([{ rideId, orderId: saleA.id }]);

    const response = await request(app)
      .get('/api/finances/transactions')
      .query({ orderId: saleA.id })
      .set('Authorization', `Bearer ${user.token}`);

    expect(response.status).toBe(200);
    expect(
      response.body.some(
        (row) => row.origin === 'UBER' && row.rideId === rideId,
      ),
    ).toBe(true);
  });
});

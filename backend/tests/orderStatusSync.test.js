import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { syncOrderStatuses } from '../src/utils/receivables.js';

describe('order status backfill', () => {
  let userId;
  let createdOrderIds = [];
  let createdPersonIds = [];

  beforeAll(async () => {
    await prisma.$connect();
    const username = `status_sync_${Date.now()}`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'testpass123' });
    userId = regRes.body.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  afterEach(async () => {
    for (const id of createdOrderIds) {
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    createdOrderIds = [];
    for (const id of createdPersonIds) {
      await prisma.person.delete({ where: { id } }).catch(() => {});
    }
    createdPersonIds = [];
  });

  const makePerson = async () => {
    const person = await prisma.person.create({
      data: { name: 'Sync Person', whatsapp: 'sync@test.com', userId },
    });
    createdPersonIds.push(person.id);
    return person.id;
  };

  // Creates a VENDA order in a deliberately stale status so the backfill can be
  // exercised without going through the (now fixed) payment endpoints.
  const makeStaleOrder = async ({
    status,
    itemCents,
    additionalCents = 0,
    paymentCents = null,
  }) => {
    const personId = await makePerson();
    const order = await prisma.order.create({
      data: {
        orderNumber: `SYNC-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        orderType: 'VENDA',
        totalValue: itemCents + additionalCents,
        additionalValue: additionalCents,
        status,
        userId,
        items: {
          create: [{ description: 'Item', chargedValue: itemCents, personId }],
        },
        ...(paymentCents != null && {
          payments: {
            create: [{ amount: paymentCents, personId }],
          },
        }),
      },
    });
    createdOrderIds.push(order.id);
    return order;
  };

  it('corrects a stale QUITADO to PARCIAL when the additional value is unpaid', async () => {
    const order = await makeStaleOrder({
      status: 'QUITADO',
      itemCents: 304.76,
      additionalCents: 2.0,
      paymentCents: 304.76,
    });

    const changes = await syncOrderStatuses(prisma, [order.id]);

    expect(changes).toEqual([{ id: order.id, from: 'QUITADO', to: 'PARCIAL' }]);
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.status).toBe('PARCIAL');
  });

  it('reports divergences without persisting when dryRun is true', async () => {
    const order = await makeStaleOrder({
      status: 'QUITADO',
      itemCents: 100,
      additionalCents: 10,
      paymentCents: 100,
    });

    const changes = await syncOrderStatuses(prisma, [order.id], {
      dryRun: true,
    });

    expect(changes).toEqual([{ id: order.id, from: 'QUITADO', to: 'PARCIAL' }]);
    const unchanged = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(unchanged.status).toBe('QUITADO');
  });

  it('returns no changes when the stored status is already correct', async () => {
    const order = await makeStaleOrder({
      status: 'PENDENTE',
      itemCents: 100,
    });

    const changes = await syncOrderStatuses(prisma, [order.id]);

    expect(changes).toEqual([]);
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.status).toBe('PENDENTE');
  });

  it('corrects a stale PENDENTE to QUITADO when the order is fully paid', async () => {
    const order = await makeStaleOrder({
      status: 'PENDENTE',
      itemCents: 100,
      paymentCents: 100,
    });

    const changes = await syncOrderStatuses(prisma, [order.id]);

    expect(changes).toEqual([
      { id: order.id, from: 'PENDENTE', to: 'QUITADO' },
    ]);
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.status).toBe('QUITADO');
  });
});

import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { createTestUser } from './helpers/createTestUser.js';

// Amounts are unique per test so the shared, value-based match pool never
// bleeds between cases.
const activity = (uuid, amount) => ({
  uuid,
  cardURL: `https://riders.uber.com/trips/${uuid}`,
  description: `R$${amount} • Cássia`,
  subtitle: '26 de set. • 13:02',
  title: 'Duo Residence Mall',
});

const envelope = (atividades) => ({
  windowStart: '2026-08-28T00:00:00.000Z',
  windowEnd: '2026-09-28T00:00:00.000Z',
  profiles: { FAMILY: { atividades } },
});

describe('Uber ride reconciliation', () => {
  let user;
  let other;
  let saleA;
  let saleB;

  beforeAll(async () => {
    await prisma.$connect();
    user = await createTestUser('uber_reconcile');
    other = await createTestUser('uber_reconcile_other');

    saleA = await prisma.order.create({
      data: {
        orderNumber: 'V-8001',
        orderType: 'VENDA',
        totalValue: '100.00',
        userId: user.user.id,
      },
    });
    saleB = await prisma.order.create({
      data: {
        orderNumber: 'V-8002',
        orderType: 'VENDA',
        totalValue: '50.00',
        userId: user.user.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.financialTransaction.deleteMany({
      where: { userId: { in: [user.user.id, other.user.id] } },
    });
    await prisma.rideRecord.deleteMany({
      where: { userId: { in: [user.user.id, other.user.id] } },
    });
    await prisma.user.delete({ where: { id: user.user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: other.user.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  const importRide = async (externalId, amount) => {
    await request(app)
      .post('/api/uber/rides/import')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ json: JSON.stringify(envelope([activity(externalId, amount)])) });

    const ride = await prisma.rideRecord.findFirst({
      where: { userId: user.user.id, externalId },
    });
    return ride.id;
  };

  const createTransaction = ({
    origin = 'MANUAL',
    type = 'DESPESA',
    amount,
    orderId = null,
    rideId = null,
    categoryId = null,
    transactionDate = new Date('2026-09-15T00:00:00.000Z'),
    notes = null,
    userId = user.user.id,
  }) =>
    prisma.financialTransaction.create({
      data: {
        userId,
        type,
        origin,
        amount,
        description: 'Lançamento existente',
        transactionDate,
        orderId,
        rideId,
        categoryId,
        notes,
      },
    });

  const listRides = () =>
    request(app)
      .get('/api/uber/rides')
      .set('Authorization', `Bearer ${user.token}`);

  const launch = (items, token = user.token) =>
    request(app)
      .post('/api/uber/rides/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ items });

  it('suggests equal-value manual and sale-additional rows, ignoring other origins, values and owners', async () => {
    const rideId = await importRide('rec-list', '11,11');

    await createTransaction({ amount: '11.11' });
    await createTransaction({
      origin: 'VENDA_ADICIONAL',
      amount: '11.11',
      orderId: saleA.id,
    });
    await createTransaction({ amount: '22.22' });
    await createTransaction({
      amount: '11.11',
      type: 'RECEITA',
      origin: 'VENDA',
    });
    await createTransaction({ amount: '11.11', origin: 'PEDIDO_DOTERRA' });
    await createTransaction({ amount: '11.11', userId: other.user.id });

    const response = await listRides();
    const ride = response.body.find((row) => row.id === rideId);

    expect(ride.matches).toHaveLength(2);
    expect(ride.matches.map((m) => m.origin).sort()).toEqual([
      'MANUAL',
      'VENDA_ADICIONAL',
    ]);
    const saleMatch = ride.matches.find((m) => m.origin === 'VENDA_ADICIONAL');
    expect(saleMatch.orderId).toBe(saleA.id);
    expect(saleMatch.orderNumber).toBe('V-8001');
  });

  it('returns no matches for an already launched ride', async () => {
    const rideId = await importRide('rec-launched', '33,33');
    await createTransaction({ amount: '33.33' });
    await launch([{ rideId }]);

    const response = await listRides();
    const ride = response.body.find((row) => row.id === rideId);

    expect(ride.launched).toBe(true);
    expect(ride.matches).toEqual([]);
  });

  it('reconciles a manual row in place, preserving amount, date, category and notes', async () => {
    const rideId = await importRide('rec-manual', '44,44');
    const category = await prisma.financialCategory.create({
      data: { userId: user.user.id, name: 'Entrega', type: 'DESPESA' },
    });
    const transaction = await createTransaction({
      amount: '44.44',
      categoryId: category.id,
      notes: 'pago no pix',
      transactionDate: new Date('2026-09-01T00:00:00.000Z'),
    });

    const response = await launch([
      {
        rideId,
        matchTransactionId: transaction.id,
        description: 'Corrida do cliente',
      },
    ]);

    expect(response.status).toBe(201);
    expect(response.body[0]).toMatchObject({
      id: transaction.id,
      origin: 'UBER',
      type: 'DESPESA',
      description: 'Corrida do cliente',
    });
    expect(response.body[0].amount).toBe('44.44');

    const stored = await prisma.financialTransaction.findUnique({
      where: { id: transaction.id },
    });
    expect(stored.origin).toBe('UBER');
    expect(stored.rideId).toBe(rideId);
    expect(stored.categoryId).toBe(category.id);
    expect(stored.notes).toBe('pago no pix');
    expect(stored.transactionDate.toISOString().slice(0, 10)).toBe(
      '2026-09-01',
    );
    expect(stored.paymentType).toBeNull();
  });

  it('links the sale informed for a manual row without one, suffixing the description', async () => {
    const rideId = await importRide('rec-manual-sale', '55,55');
    const transaction = await createTransaction({ amount: '55.55' });

    const response = await launch([
      {
        rideId,
        matchTransactionId: transaction.id,
        orderId: saleA.id,
      },
    ]);

    expect(response.status).toBe(201);
    expect(response.body[0].orderId).toBe(saleA.id);
    expect(response.body[0].description).toBe(
      'Uber — Duo Residence Mall (Cássia) — Venda V-8001',
    );
  });

  it('keeps the sale already linked to the reconciled row over the payload', async () => {
    const rideId = await importRide('rec-adicional', '66,66');
    const transaction = await createTransaction({
      origin: 'VENDA_ADICIONAL',
      amount: '66.66',
      orderId: saleA.id,
    });

    const response = await launch([
      {
        rideId,
        matchTransactionId: transaction.id,
        orderId: saleB.id,
      },
    ]);

    expect(response.status).toBe(201);
    expect(response.body[0].orderId).toBe(saleA.id);
    expect(response.body[0].description).toBe(
      'Uber — Duo Residence Mall (Cássia) — Venda V-8001',
    );
  });

  it('rejects a row whose value does not match the ride', async () => {
    const rideId = await importRide('rec-mismatch', '77,77');
    const transaction = await createTransaction({ amount: '88.88' });

    const response = await launch([
      { rideId, matchTransactionId: transaction.id },
    ]);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/valor/i);
    const stored = await prisma.financialTransaction.findUnique({
      where: { id: transaction.id },
    });
    expect(stored.origin).toBe('MANUAL');
  });

  it('rejects a row that is not an expense', async () => {
    const rideId = await importRide('rec-receita', '99,99');
    const transaction = await createTransaction({
      type: 'RECEITA',
      origin: 'VENDA',
      amount: '99.99',
    });

    const response = await launch([
      { rideId, matchTransactionId: transaction.id },
    ]);

    expect(response.status).toBe(400);
    expect(
      await prisma.rideRecord.findUnique({ where: { id: rideId } }),
    ).not.toBeNull();
  });

  it('rejects a row whose origin is not reconcilable', async () => {
    const rideId = await importRide('rec-origin', '12,34');
    const transaction = await createTransaction({
      origin: 'PEDIDO_DOTERRA',
      amount: '12.34',
    });

    const response = await launch([
      { rideId, matchTransactionId: transaction.id },
    ]);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/não pode ser conciliado/i);
  });

  it('rejects a row owned by another user', async () => {
    const rideId = await importRide('rec-foreign', '23,45');
    const transaction = await createTransaction({
      amount: '23.45',
      userId: other.user.id,
    });

    const response = await launch([
      { rideId, matchTransactionId: transaction.id },
    ]);

    expect(response.status).toBe(404);
  });

  it('rejects a row already linked to another ride', async () => {
    const owner = await importRide('rec-linked-owner', '45,67');
    const rideId = await importRide('rec-linked-ride', '45,67');
    const transaction = await createTransaction({
      amount: '45.67',
      rideId: owner,
    });

    const response = await launch([
      { rideId, matchTransactionId: transaction.id },
    ]);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/já está vinculado/i);
  });

  it('rejects reconciling the same ride twice', async () => {
    const rideId = await importRide('rec-twice', '56,78');
    const transaction = await createTransaction({ amount: '56.78' });

    const first = await launch([
      { rideId, matchTransactionId: transaction.id },
    ]);
    const second = await launch([
      { rideId, matchTransactionId: transaction.id },
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(400);
    expect(second.body.error).toMatch(/já foi lançada/i);
  });
});

import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { parseLocalDate } from '../src/utils/date.js';

describe('Finances effectiveness filtering', () => {
  let userId;
  let authToken;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      userId = null;
      authToken = null;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const createUser = async () => {
    const username = `fin_eff_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'testpass123' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'testpass123' });
    userId = registerRes.body.id;
    authToken = loginRes.body.token;
  };

  const seed = (data) =>
    prisma.financialTransaction.create({
      data: {
        userId,
        type: data.type ?? 'DESPESA',
        origin: data.origin ?? 'MANUAL',
        amount: data.amount ?? '10.00',
        description: data.description ?? 'Lançamento',
        transactionDate: parseLocalDate(data.transactionDate ?? '2026-09-19'),
        isEffective: data.isEffective ?? true,
        effectiveDate:
          data.isEffective === false
            ? null
            : parseLocalDate(data.transactionDate ?? '2026-09-19'),
      },
    });

  const listTransactions = (query = '') =>
    request(app)
      .get(`/api/finances/transactions${query}`)
      .set('Authorization', `Bearer ${authToken}`);

  const getSummary = (query = '') =>
    request(app)
      .get(`/api/finances/summary${query}`)
      .set('Authorization', `Bearer ${authToken}`);

  it('totals income, expense and balance from effective rows only', async () => {
    await createUser();
    await seed({ type: 'RECEITA', amount: '1000.00', isEffective: true });
    await seed({ type: 'DESPESA', amount: '300.25', isEffective: true });
    await seed({
      type: 'DESPESA',
      amount: '500.00',
      isEffective: false,
      transactionDate: '2026-10-15',
    });

    const response = await getSummary();

    expect(response.status).toBe(200);
    expect(response.body.totalIncome).toBe('1000.00');
    expect(response.body.totalExpense).toBe('300.25');
    expect(response.body.balance).toBe('699.75');
  });

  it('exposes pendingTotal summing the pending rows of the date range', async () => {
    await createUser();
    await seed({
      type: 'DESPESA',
      amount: '300.00',
      isEffective: true,
      transactionDate: '2026-10-05',
    });
    await seed({
      type: 'DESPESA',
      amount: '500.00',
      isEffective: false,
      transactionDate: '2026-10-15',
    });
    await seed({
      type: 'DESPESA',
      amount: '200.00',
      isEffective: false,
      transactionDate: '2026-12-15',
    });

    const response = await getSummary('?from=2026-10-01&to=2026-10-31');

    expect(response.body.pendingTotal).toBe('500.00');
    expect(response.body.totalExpense).toBe('300.00');
  });

  it('returns a zero pendingTotal when there are no pending rows', async () => {
    await createUser();
    await seed({ type: 'RECEITA', amount: '100.00', isEffective: true });

    const response = await getSummary();

    expect(response.body.pendingTotal).toBe('0.00');
  });

  it('filters the listing by effectiveness', async () => {
    await createUser();
    await seed({ description: 'Efetiva', isEffective: true });
    await seed({ description: 'Pendente', isEffective: false });

    const pending = await listTransactions('?effective=no');
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0].description).toBe('Pendente');

    const effective = await listTransactions('?effective=yes');
    expect(effective.body).toHaveLength(1);
    expect(effective.body[0].description).toBe('Efetiva');

    const all = await listTransactions();
    expect(all.body).toHaveLength(2);

    const explicitAll = await listTransactions('?effective=all');
    expect(explicitAll.body).toHaveLength(2);
  });

  it('never flips isEffective when editing a manual transaction', async () => {
    await createUser();
    const created = await request(app)
      .post('/api/finances/transactions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'DESPESA',
        amount: 100,
        description: 'Manual',
        transactionDate: '2026-09-19',
      });
    expect(created.status).toBe(201);
    expect(created.body.isEffective).toBe(true);

    const updated = await request(app)
      .put(`/api/finances/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 120, description: 'Manual editado' });
    expect(updated.status).toBe(200);

    const persisted = await prisma.financialTransaction.findUnique({
      where: { id: created.body.id },
    });
    expect(persisted.isEffective).toBe(true);
  });
});

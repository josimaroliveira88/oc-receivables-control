import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';

const registerUser = async (prefix) => {
  const username = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'testpass123' });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'testpass123' });
  return { userId: regRes.body.id, token: loginRes.body.token };
};

const isoDate = (value) => value.toISOString().slice(0, 10);

describe('Credit-card bills CRUD', () => {
  let user;
  let otherUser;
  let category;
  let otherCategory;

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('ccbills');
    otherUser = await registerUser('ccbills2');

    await request(app)
      .get('/api/finances/categories')
      .set('Authorization', `Bearer ${user.token}`);
    await request(app)
      .get('/api/finances/categories')
      .set('Authorization', `Bearer ${otherUser.token}`);
    category = await prisma.financialCategory.findFirst({
      where: { userId: user.userId, type: 'DESPESA' },
    });
    otherCategory = await prisma.financialCategory.findFirst({
      where: { userId: otherUser.userId, type: 'DESPESA' },
    });
  });

  afterEach(async () => {
    for (const owner of [user, otherUser]) {
      if (!owner) continue;
      await prisma.creditCardBill.deleteMany({
        where: { userId: owner.userId },
      });
      await prisma.financialTransaction.deleteMany({
        where: { userId: owner.userId },
      });
    }
  });

  afterAll(async () => {
    for (const owner of [user, otherUser]) {
      if (owner) {
        await prisma.user
          .delete({ where: { id: owner.userId } })
          .catch(() => {});
      }
    }
    await prisma.$disconnect();
  });

  const createBill = (body, authUser = user) =>
    request(app)
      .post('/api/credit-cards/bills')
      .set('Authorization', `Bearer ${authUser.token}`)
      .send(body);

  const baseBody = (overrides = {}) => ({
    description: 'Fatura manual',
    totalAmount: 438.64,
    installments: 3,
    firstInstallmentAt: '2026-08-17',
    categoryId: category.id,
    ...overrides,
  });

  const listBills = (authUser = user) =>
    request(app)
      .get('/api/credit-cards/bills')
      .set('Authorization', `Bearer ${authUser.token}`);

  it('requires authentication', async () => {
    const response = await request(app).get('/api/credit-cards/bills');
    expect(response.status).toBe(401);
  });

  it('lists only the authenticated user bills', async () => {
    const mine = await createBill(baseBody());
    expect(mine.status).toBe(201);

    const theirs = await createBill(
      baseBody({ categoryId: otherCategory.id }),
      otherUser,
    );
    expect(theirs.status).toBe(201);

    const response = await listBills();
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(mine.body.id);
  });

  it('creates one bill and N pending installments', async () => {
    const response = await createBill(baseBody());
    expect(response.status).toBe(201);
    expect(response.body.totalCents).toBe(43864);
    expect(response.body.installments).toBe(3);

    const rows = await prisma.financialTransaction.findMany({
      where: { creditCardBillId: response.body.id, userId: user.userId },
      orderBy: { installmentNumber: 'asc' },
    });
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.origin)).toEqual([
      'CARTAO_CREDITO',
      'CARTAO_CREDITO',
      'CARTAO_CREDITO',
    ]);
    expect(rows.every((row) => row.isEffective === false)).toBe(true);
    expect(rows.map((row) => row.installmentNumber)).toEqual([1, 2, 3]);
    expect(rows.map((row) => isoDate(row.effectiveDate))).toEqual([
      '2026-08-17',
      '2026-09-17',
      '2026-10-17',
    ]);
    const amounts = rows.map((row) => Number(row.amount));
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBeCloseTo(
      438.64,
      2,
    );
  });

  it('rejects zero installments', async () => {
    const response = await createBill(baseBody({ installments: 0 }));
    expect(response.status).toBe(400);
  });

  it('rejects more than 24 installments', async () => {
    const response = await createBill(baseBody({ installments: 25 }));
    expect(response.status).toBe(400);
  });

  it('rejects a missing description, amount or first installment date', async () => {
    const missingDescription = await createBill(
      baseBody({ description: undefined }),
    );
    expect(missingDescription.status).toBe(400);

    const missingAmount = await createBill(
      baseBody({ totalAmount: undefined }),
    );
    expect(missingAmount.status).toBe(400);

    const missingDate = await createBill(
      baseBody({ firstInstallmentAt: undefined }),
    );
    expect(missingDate.status).toBe(400);
  });

  it('rejects a category owned by another user', async () => {
    const foreignCategory = await prisma.financialCategory.create({
      data: { userId: otherUser.userId, name: 'Alheia', type: 'DESPESA' },
    });

    const response = await createBill(
      baseBody({ categoryId: foreignCategory.id }),
    );
    expect(response.status).toBe(400);

    await prisma.financialCategory.delete({
      where: { id: foreignCategory.id },
    });
  });

  it('returns the bill detail with its installments', async () => {
    const created = await createBill(baseBody());
    const response = await request(app)
      .get(`/api/credit-cards/bills/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(response.status).toBe(200);
    expect(response.body.description).toBe('Fatura manual');
    expect(response.body.transactions).toHaveLength(3);
    const [first] = response.body.transactions;
    expect(first.installmentNumber).toBe(1);
    expect(first.installmentsTotal).toBe(3);
    expect(first.isEffective).toBe(false);
    expect(first.effectiveDate.slice(0, 10)).toBe('2026-08-17');
  });

  it('returns 404 for another user bill', async () => {
    const theirs = await createBill(
      baseBody({ categoryId: otherCategory.id }),
      otherUser,
    );

    const response = await request(app)
      .get(`/api/credit-cards/bills/${theirs.body.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(response.status).toBe(404);
  });

  it('regenerates pending installments when metadata changes', async () => {
    const created = await createBill(baseBody());

    const response = await request(app)
      .put(`/api/credit-cards/bills/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ installments: 6, description: 'Fatura editada' });
    expect(response.status).toBe(200);
    expect(response.body.installments).toBe(6);
    expect(response.body.description).toBe('Fatura editada');

    const rows = await prisma.financialTransaction.findMany({
      where: { creditCardBillId: created.body.id, userId: user.userId },
      orderBy: { installmentNumber: 'asc' },
    });
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.isEffective === false)).toBe(true);
  });

  it('returns 409 when editing a bill with an effective installment', async () => {
    const created = await createBill(baseBody());
    const paid = await prisma.financialTransaction.findFirst({
      where: { creditCardBillId: created.body.id, installmentNumber: 1 },
    });
    await prisma.financialTransaction.update({
      where: { id: paid.id },
      data: { isEffective: true, effectiveDate: new Date('2026-08-17') },
    });

    const response = await request(app)
      .put(`/api/credit-cards/bills/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ installments: 6 });
    expect(response.status).toBe(409);
    expect(response.body.paidInstallmentIds).toEqual([paid.id]);
  });

  it('deletes a bill with no effective installment', async () => {
    const created = await createBill(baseBody());

    const response = await request(app)
      .delete(`/api/credit-cards/bills/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(response.status).toBe(200);

    expect(
      await prisma.creditCardBill.findUnique({
        where: { id: created.body.id },
      }),
    ).toBeNull();
    expect(
      await prisma.financialTransaction.count({
        where: { creditCardBillId: created.body.id },
      }),
    ).toBe(0);
  });

  it('returns 409 when deleting a bill with an effective installment', async () => {
    const created = await createBill(baseBody());
    const paid = await prisma.financialTransaction.findFirst({
      where: { creditCardBillId: created.body.id, installmentNumber: 1 },
    });
    await prisma.financialTransaction.update({
      where: { id: paid.id },
      data: { isEffective: true, effectiveDate: new Date('2026-08-17') },
    });

    const response = await request(app)
      .delete(`/api/credit-cards/bills/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(response.status).toBe(409);
    expect(response.body.paidInstallmentIds).toEqual([paid.id]);

    expect(
      await prisma.creditCardBill.findUnique({
        where: { id: created.body.id },
      }),
    ).not.toBeNull();
  });
});

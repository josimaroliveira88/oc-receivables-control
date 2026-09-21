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

describe('Credit-card installment pay/unpay', () => {
  let user;
  let otherUser;
  let bill;

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('ccinst');
    otherUser = await registerUser('ccinst2');

    await request(app)
      .get('/api/finances/categories')
      .set('Authorization', `Bearer ${user.token}`);
    await request(app)
      .get('/api/finances/categories')
      .set('Authorization', `Bearer ${otherUser.token}`);
  });

  beforeEach(async () => {
    const category = await prisma.financialCategory.findFirst({
      where: { userId: user.userId, type: 'DESPESA' },
    });
    const response = await request(app)
      .post('/api/credit-cards/bills')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        description: 'Fatura parcelada',
        totalAmount: 300,
        installments: 3,
        firstInstallmentAt: '2026-09-15',
        categoryId: category.id,
      });
    bill = response.body;

    const otherCategory = await prisma.financialCategory.findFirst({
      where: { userId: otherUser.userId, type: 'DESPESA' },
    });
    await request(app)
      .post('/api/credit-cards/bills')
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({
        description: 'Fatura alheia',
        totalAmount: 100,
        installments: 1,
        firstInstallmentAt: '2026-09-15',
        categoryId: otherCategory.id,
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

  const firstInstallmentId = () =>
    prisma.financialTransaction
      .findFirst({
        where: { creditCardBillId: bill.id, installmentNumber: 1 },
      })
      .then((row) => row.id);

  it('marks an installment as effective with the paid date', async () => {
    const id = await firstInstallmentId();

    const response = await request(app)
      .post(`/api/credit-cards/installments/${id}/pay`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ paidAt: '2026-09-15' });

    expect(response.status).toBe(200);
    expect(response.body.isEffective).toBe(true);
    expect(isoDate(new Date(response.body.effectiveDate))).toBe('2026-09-15');

    const persisted = await prisma.financialTransaction.findUnique({
      where: { id },
    });
    expect(persisted.isEffective).toBe(true);
    expect(isoDate(persisted.effectiveDate)).toBe('2026-09-15');
  });

  it('is idempotent when paying twice with the same date', async () => {
    const id = await firstInstallmentId();

    await request(app)
      .post(`/api/credit-cards/installments/${id}/pay`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ paidAt: '2026-09-15' });

    const second = await request(app)
      .post(`/api/credit-cards/installments/${id}/pay`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ paidAt: '2026-09-15' });

    expect(second.status).toBe(200);
    expect(second.body.isEffective).toBe(true);

    const count = await prisma.financialTransaction.count({
      where: { creditCardBillId: bill.id },
    });
    expect(count).toBe(3);
  });

  it('returns 404 when paying another user installment', async () => {
    const foreign = await prisma.financialTransaction.findFirst({
      where: { userId: otherUser.userId, creditCardBillId: { not: null } },
    });

    const response = await request(app)
      .post(`/api/credit-cards/installments/${foreign.id}/pay`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ paidAt: '2026-09-15' });

    expect(response.status).toBe(404);
  });

  it('unpays an effective installment restoring the pending state', async () => {
    const id = await firstInstallmentId();
    await request(app)
      .post(`/api/credit-cards/installments/${id}/pay`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ paidAt: '2026-09-15' });

    const response = await request(app)
      .post(`/api/credit-cards/installments/${id}/unpay`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(response.status).toBe(200);
    expect(response.body.isEffective).toBe(false);

    const persisted = await prisma.financialTransaction.findUnique({
      where: { id },
    });
    expect(persisted.isEffective).toBe(false);
    expect(persisted.effectiveDate).toBeNull();
  });

  it('is a no-op when unpaying an already pending installment', async () => {
    const id = await firstInstallmentId();

    const response = await request(app)
      .post(`/api/credit-cards/installments/${id}/unpay`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(response.status).toBe(200);
    expect(response.body.isEffective).toBe(false);

    const persisted = await prisma.financialTransaction.findUnique({
      where: { id },
    });
    expect(persisted.isEffective).toBe(false);
  });
});

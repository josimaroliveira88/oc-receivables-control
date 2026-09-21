import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { parseLocalDate } from '../src/utils/date.js';

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

const uniqueOrderNumber = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const isoDate = (value) => value.toISOString().slice(0, 10);

describe('Finances credit-card sync', () => {
  let user;

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('fincard');
  });

  afterEach(async () => {
    await prisma.creditCardBill.deleteMany({ where: { userId: user.userId } });
    await prisma.order.deleteMany({ where: { userId: user.userId } });
    await prisma.financialTransaction.deleteMany({
      where: { userId: user.userId },
    });
    await prisma.stockMovement.deleteMany({ where: { userId: user.userId } });
  });

  afterAll(async () => {
    if (user) {
      await prisma.user.delete({ where: { id: user.userId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  const createCardOrder = (overrides = {}) =>
    request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        orderNumber: uniqueOrderNumber('CARD'),
        orderDate: '2026-09-20',
        paymentType: 'CARTAO_CREDITO',
        installments: 3,
        firstInstallmentAt: '2026-10-15',
        items: [{ description: 'Óleo', chargedValue: 300 }],
        ...overrides,
      });

  const getBill = (orderId) =>
    prisma.creditCardBill.findFirst({
      where: { orderId, userId: user.userId },
    });

  const getInstallments = (billId) =>
    prisma.financialTransaction.findMany({
      where: { creditCardBillId: billId, userId: user.userId },
      orderBy: { installmentNumber: 'asc' },
    });

  it('creates a bill matching the order total and installments', async () => {
    const order = await createCardOrder();
    expect(order.status).toBe(201);

    const bill = await getBill(order.body.id);
    expect(bill).not.toBeNull();
    expect(bill.totalCents).toBe(30000);
    expect(bill.installments).toBe(3);
    expect(bill.userId).toBe(user.userId);
    expect(bill.paymentType).toBe('CARTAO_CREDITO');
    expect(isoDate(bill.firstInstallmentAt)).toBe('2026-10-15');
  });

  it('creates one pending installment per parcel with monthly effective dates', async () => {
    const order = await createCardOrder();
    const bill = await getBill(order.body.id);

    const rows = await getInstallments(bill.id);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.installmentNumber)).toEqual([1, 2, 3]);
    expect(rows.map((row) => row.installmentsTotal)).toEqual([3, 3, 3]);
    expect(rows.every((row) => row.isEffective === false)).toBe(true);
    expect(rows.every((row) => row.origin === 'PEDIDO_DOTERRA')).toBe(true);
    expect(rows.map((row) => isoDate(row.effectiveDate))).toEqual([
      '2026-10-15',
      '2026-11-15',
      '2026-12-15',
    ]);
    expect(rows.map((row) => isoDate(row.transactionDate))).toEqual([
      '2026-10-15',
      '2026-11-15',
      '2026-12-15',
    ]);
    expect(rows.map((row) => Number(row.amount))).toEqual([100, 100, 100]);
  });

  it('splits a non-divisible total with the last installment absorbing the remainder', async () => {
    const order = await createCardOrder({
      installments: 3,
      items: [{ description: 'Óleo', chargedValue: 100.01 }],
    });
    const bill = await getBill(order.body.id);

    const rows = await getInstallments(bill.id);
    const amounts = rows.map((row) => Number(row.amount));
    expect(amounts).toEqual([33.33, 33.33, 33.35]);
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBeCloseTo(
      100.01,
      2,
    );
  });

  it('creates a single installment for a one-off purchase', async () => {
    const order = await createCardOrder({ installments: 1 });
    const bill = await getBill(order.body.id);

    const rows = await getInstallments(bill.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].installmentNumber).toBe(1);
    expect(rows[0].installmentsTotal).toBe(1);
    expect(rows[0].isEffective).toBe(false);
    expect(isoDate(rows[0].effectiveDate)).toBe('2026-10-15');
  });

  it('regenerates pending installments when the order installment count changes', async () => {
    const order = await createCardOrder();
    const bill = await getBill(order.body.id);
    expect(await getInstallments(bill.id)).toHaveLength(3);

    const updated = await request(app)
      .put(`/api/orders/${order.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ installments: 6, firstInstallmentAt: '2026-10-15' });
    expect(updated.status).toBe(200);

    const refreshedBill = await getBill(order.body.id);
    expect(refreshedBill.installments).toBe(6);
    const rows = await getInstallments(refreshedBill.id);
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.installmentNumber)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(rows.every((row) => row.isEffective === false)).toBe(true);
    expect(rows.map((row) => Number(row.amount))).toEqual([
      50, 50, 50, 50, 50, 50,
    ]);
  });

  it('removes the bill and its installments when the payment type changes away', async () => {
    const order = await createCardOrder();
    const bill = await getBill(order.body.id);
    expect(await getInstallments(bill.id)).toHaveLength(3);

    const updated = await request(app)
      .put(`/api/orders/${order.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ paymentType: 'PIX' });
    expect(updated.status).toBe(200);

    expect(await getBill(order.body.id)).toBeNull();

    const rows = await prisma.financialTransaction.findMany({
      where: { orderId: order.body.id, userId: user.userId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].origin).toBe('PEDIDO_DOTERRA');
    expect(rows[0].isEffective).toBe(true);
    expect(rows[0].creditCardBillId).toBeNull();
  });

  it('keeps pre-migration rows effective because isEffective defaults to true', async () => {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "FinancialTransaction"
        ("id","userId","type","origin","amount","description","transactionDate","updatedAt")
      VALUES
        (${id}, ${user.userId}, 'DESPESA'::"FinancialTransactionType", 'MANUAL'::"FinancialOrigin", 10.00, 'Pré-migração', ${parseLocalDate('2026-01-01')}, NOW())
    `;

    const row = await prisma.financialTransaction.findUnique({
      where: { id },
    });
    expect(row.isEffective).toBe(true);
    expect(row.effectiveDate).toBeNull();
  });
});

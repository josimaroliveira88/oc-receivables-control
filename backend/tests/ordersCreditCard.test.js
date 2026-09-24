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

const uniqueOrderNumber = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

describe('Orders credit-card fields', () => {
  let user;
  let clientPerson;

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('ordcard');
    clientPerson = await prisma.person.create({
      data: { name: 'Cliente Cartão', userId: user.userId },
    });
    await prisma.person.create({
      data: { name: 'Eu Mesmo', isSelf: true, userId: user.userId },
    });
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

  const createOrder = (body) =>
    request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${user.token}`)
      .send(body);

  const baseBody = (overrides = {}) => ({
    orderNumber: uniqueOrderNumber('CARD'),
    orderDate: '2026-09-20',
    paymentType: 'CARTAO_CREDITO',
    installments: 3,
    firstInstallmentAt: '2026-09-15',
    items: [{ description: 'Óleo', chargedValue: 300 }],
    ...overrides,
  });

  it('rejects a credit-card order without installments', async () => {
    const response = await createOrder(
      baseBody({ installments: undefined, firstInstallmentAt: undefined }),
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message:
            'A quantidade de parcelas é obrigatória para pedidos com cartão de crédito',
        }),
      ]),
    );
  });

  it('rejects a credit-card order without the first installment date', async () => {
    const response = await createOrder(
      baseBody({ firstInstallmentAt: undefined }),
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message:
            'A data da primeira parcela é obrigatória para pedidos com cartão de crédito',
        }),
      ]),
    );
  });

  it('rejects more than 24 installments', async () => {
    const response = await createOrder(baseBody({ installments: 25 }));

    expect(response.status).toBe(400);
  });

  it('creates a credit-card order with installments and first installment date', async () => {
    const response = await createOrder(baseBody());

    expect(response.status).toBe(201);
    expect(response.body.installments).toBe(3);
    expect(response.body.firstInstallmentAt.slice(0, 10)).toBe('2026-09-15');
  });

  it('updates installments and first installment date with validation', async () => {
    const created = await createOrder(baseBody());

    const invalid = await request(app)
      .put(`/api/orders/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ installments: 25 });
    expect(invalid.status).toBe(400);

    const valid = await request(app)
      .put(`/api/orders/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ installments: 4, firstInstallmentAt: '2026-11-01' });
    expect(valid.status).toBe(200);
    expect(valid.body.installments).toBe(4);
    expect(valid.body.firstInstallmentAt.slice(0, 10)).toBe('2026-11-01');
  });

  it('does not feed the ledger with income when a credit-card order is paid', async () => {
    const created = await createOrder(baseBody());

    const payment = await request(app)
      .post(`/api/orders/${created.body.id}/payments`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        amount: 300,
        personId: clientPerson.id,
        paymentType: 'PIX',
        paidAt: '2026-09-20',
      });
    expect(payment.status).toBe(201);

    const income = await prisma.financialTransaction.findMany({
      where: { userId: user.userId, origin: 'VENDA' },
    });
    expect(income).toHaveLength(0);
  });
});

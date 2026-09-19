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

const createProduct = async (suffix) =>
  prisma.product.create({
    data: {
      code: `TESTFINSET${suffix}`,
      name: 'Produto Settlement',
      size: '30 ml',
      status: 'ATIVO',
      prices: { create: { regularPrice: 100, memberPrice: 75, pv: 10 } },
    },
  });

const seedStock = async (userId, productId, quantity) => {
  await prisma.inventory.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, quantity },
    update: { quantity },
  });
};

describe('Finances InfinitePay settlements', () => {
  let user;
  let otherUser;
  let clientPerson;
  let otherClientPerson;
  let product;

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('finset');
    otherUser = await registerUser('finset2');
    product = await createProduct(Math.floor(Math.random() * 100000));
    await seedStock(user.userId, product.id, 1000);
    await seedStock(otherUser.userId, product.id, 1000);
    clientPerson = await prisma.person.create({
      data: { name: 'Cliente Resgate', userId: user.userId },
    });
    otherClientPerson = await prisma.person.create({
      data: { name: 'Cliente Outro', userId: otherUser.userId },
    });
  });

  afterEach(async () => {
    await prisma.order.deleteMany({ where: { userId: user.userId } });
    await prisma.financialTransaction.deleteMany({
      where: { userId: user.userId },
    });
    await prisma.order.deleteMany({ where: { userId: otherUser.userId } });
    await prisma.financialTransaction.deleteMany({
      where: { userId: otherUser.userId },
    });
    await prisma.stockMovement.deleteMany({ where: { userId: user.userId } });
    await prisma.stockMovement.deleteMany({
      where: { userId: otherUser.userId },
    });
    await seedStock(user.userId, product.id, 1000);
    await seedStock(otherUser.userId, product.id, 1000);
  });

  afterAll(async () => {
    if (user) {
      await prisma.user.delete({ where: { id: user.userId } }).catch(() => {});
    }
    if (otherUser) {
      await prisma.user
        .delete({ where: { id: otherUser.userId } })
        .catch(() => {});
    }
    await prisma.product
      .deleteMany({ where: { id: product.id } })
      .catch(() => {});
    await prisma.product
      .deleteMany({ where: { code: { startsWith: 'TESTFINSET' } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  const createSale = async ({
    items,
    token = user.token,
    personId = clientPerson.id,
    extra = {},
  }) =>
    request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientPersonId: personId,
        orderDate: '2026-03-15',
        ...extra,
        items,
      });

  const pay = (orderId, body, token = user.token) =>
    request(app)
      .post(`/api/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const settle = (body, token = user.token) =>
    request(app)
      .post('/api/finances/settlements')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const getRows = (userId, where = {}) =>
    prisma.financialTransaction.findMany({
      where: { userId, ...where },
      orderBy: { createdAt: 'asc' },
    });

  const createInfinitePaySale = async () => {
    const sale = await createSale({
      items: [{ productId: product.id, chargedValue: 100, quantity: 1 }],
    });
    await pay(sale.body.id, {
      amount: 100,
      personId: clientPerson.id,
      paymentType: 'INFINITE_PAY',
    });
    return sale;
  };

  it('requires authentication', async () => {
    const response = await request(app)
      .post('/api/finances/settlements')
      .send({ orderId: '00000000-0000-0000-0000-000000000000', amount: 10 });
    expect(response.status).toBe(401);
  });

  it('creates a linked redemption income row for a sale', async () => {
    const sale = await createInfinitePaySale();

    const response = await settle({
      orderId: sale.body.id,
      amount: 80,
      transactionDate: '2026-03-20',
      notes: 'Resgate parcial',
    });

    expect(response.status).toBe(201);
    expect(response.body.type).toBe('RECEITA');
    expect(response.body.origin).toBe('RESGATE_INFINITEPAY');
    expect(Number(response.body.amount)).toBe(80);
    expect(response.body.orderId).toBe(sale.body.id);
    expect(response.body.paymentId).toBeNull();
    expect(response.body.notes).toBe('Resgate parcial');
    expect(response.body.description).toBe(
      `Resgate InfinitePay — Venda ${sale.body.orderNumber}`,
    );
    expect(response.body.transactionDate.slice(0, 10)).toBe('2026-03-20');

    const category = await prisma.financialCategory.findFirst({
      where: { userId: user.userId, type: 'RECEITA', name: 'Vendas' },
    });
    expect(response.body.categoryId).toBe(category.id);
  });

  it('allows multiple partial redemptions for the same sale', async () => {
    const sale = await createInfinitePaySale();

    await settle({
      orderId: sale.body.id,
      amount: 60,
      transactionDate: '2026-03-20',
    });
    await settle({
      orderId: sale.body.id,
      amount: 40,
      transactionDate: '2026-03-25',
    });

    const rows = await getRows(user.userId, { origin: 'RESGATE_INFINITEPAY' });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => Number(row.amount))).toEqual([60, 40]);
  });

  it('returns 404 for an unknown order', async () => {
    const response = await settle({
      orderId: '00000000-0000-0000-0000-000000000000',
      amount: 10,
      transactionDate: '2026-03-20',
    });
    expect(response.status).toBe(404);
  });

  it('returns 404 for another user order', async () => {
    const sale = await createSale({
      token: otherUser.token,
      personId: otherClientPerson.id,
      items: [{ productId: product.id, chargedValue: 100, quantity: 1 }],
    });
    await pay(
      sale.body.id,
      {
        amount: 100,
        personId: otherClientPerson.id,
        paymentType: 'INFINITE_PAY',
      },
      otherUser.token,
    );

    const response = await settle({
      orderId: sale.body.id,
      amount: 10,
      transactionDate: '2026-03-20',
    });
    expect(response.status).toBe(404);
  });

  it('rejects a dōTERRA order', async () => {
    const purchase = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        orderNumber: `CMP-${Date.now()}`,
        orderDate: '2026-03-10',
        items: [{ description: 'Óleo', chargedValue: 100 }],
      });

    const response = await settle({
      orderId: purchase.body.id,
      amount: 10,
      transactionDate: '2026-03-20',
    });
    expect(response.status).toBe(400);
  });

  it('rejects a team order', async () => {
    const sale = await createInfinitePaySale();
    await prisma.order.update({
      where: { id: sale.body.id },
      data: { isTeamOrder: true },
    });

    const response = await settle({
      orderId: sale.body.id,
      amount: 10,
      transactionDate: '2026-03-20',
    });
    expect(response.status).toBe(400);
  });

  it('rejects a sale without an InfinitePay payment', async () => {
    const sale = await createSale({
      items: [{ productId: product.id, chargedValue: 100, quantity: 1 }],
    });
    await pay(sale.body.id, {
      amount: 100,
      personId: clientPerson.id,
      paymentType: 'PIX',
    });

    const response = await settle({
      orderId: sale.body.id,
      amount: 10,
      transactionDate: '2026-03-20',
    });
    expect(response.status).toBe(400);
  });

  it('rejects a zero amount', async () => {
    const sale = await createInfinitePaySale();
    const response = await settle({
      orderId: sale.body.id,
      amount: 0,
      transactionDate: '2026-03-20',
    });
    expect(response.status).toBe(400);
  });

  it('rejects a negative amount', async () => {
    const sale = await createInfinitePaySale();
    const response = await settle({
      orderId: sale.body.id,
      amount: -5,
      transactionDate: '2026-03-20',
    });
    expect(response.status).toBe(400);
  });

  it('rejects a missing orderId', async () => {
    const response = await settle({
      amount: 10,
      transactionDate: '2026-03-20',
    });
    expect(response.status).toBe(400);
  });

  it('rejects an invalid transaction date', async () => {
    const sale = await createInfinitePaySale();
    const response = await settle({
      orderId: sale.body.id,
      amount: 10,
      transactionDate: '20/03/2026',
    });
    expect(response.status).toBe(400);
  });
});

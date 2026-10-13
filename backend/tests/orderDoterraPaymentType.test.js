import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { toCents } from '../src/utils/money.js';
import {
  ZERO_TOTAL_PAYMENT_TYPE_MESSAGE,
  paymentTypeSchema,
} from '../src/utils/paymentTypes.js';

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

describe('Order dōTERRA payment type (zero total only)', () => {
  let user;

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('orddot');
    await prisma.person.create({
      data: { name: 'Eu Mesmo dōTERRA', isSelf: true, userId: user.userId },
    });
  });

  afterEach(async () => {
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
    orderNumber: uniqueOrderNumber('DOT'),
    orderDate: '2026-10-12',
    paymentType: 'DOTERRA',
    items: [{ description: 'Amostra', chargedValue: 0 }],
    ...overrides,
  });

  it('accepts the DOTERRA value in the payment type schema', () => {
    expect(paymentTypeSchema.safeParse('DOTERRA').success).toBe(true);
  });

  it('creates a zero-total order paid with dōTERRA', async () => {
    const response = await createOrder(baseBody());

    expect(response.status).toBe(201);
    expect(response.body.paymentType).toBe('DOTERRA');
    expect(toCents(response.body.totalValue)).toBe(0);
  });

  it('accepts a zero-total dōTERRA order whose only value is the shipping', async () => {
    // Shipping is part of the order total, so a dōTERRA order cannot carry one.
    const response = await createOrder(
      baseBody({ shippingValue: 19.9, items: [{ chargedValue: 0 }] }),
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(ZERO_TOTAL_PAYMENT_TYPE_MESSAGE);
  });

  it('rejects a dōTERRA order with a non-zero total', async () => {
    const response = await createOrder(
      baseBody({ items: [{ description: 'Óleo', chargedValue: 300 }] }),
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(ZERO_TOTAL_PAYMENT_TYPE_MESSAGE);
  });

  it('still creates a non-dōTERRA order with a non-zero total', async () => {
    const response = await createOrder(
      baseBody({
        paymentType: 'PIX',
        items: [{ description: 'Óleo', chargedValue: 300 }],
      }),
    );

    expect(response.status).toBe(201);
    expect(toCents(response.body.totalValue)).toBe(30000);
  });

  it('rejects an update that turns a non-zero order into a dōTERRA one', async () => {
    const created = await createOrder(
      baseBody({
        paymentType: 'PIX',
        items: [{ description: 'Óleo', chargedValue: 300 }],
      }),
    );

    const response = await request(app)
      .put(`/api/orders/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ paymentType: 'DOTERRA' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(ZERO_TOTAL_PAYMENT_TYPE_MESSAGE);

    const persisted = await prisma.order.findUnique({
      where: { id: created.body.id },
    });
    expect(persisted.paymentType).toBe('PIX');
    expect(toCents(persisted.totalValue)).toBe(30000);
  });

  it('rejects editing the items of a dōTERRA order to a non-zero total', async () => {
    const created = await createOrder(baseBody());

    const response = await request(app)
      .put(`/api/orders/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ items: [{ description: 'Amostra', chargedValue: 150 }] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(ZERO_TOTAL_PAYMENT_TYPE_MESSAGE);

    const persisted = await prisma.order.findUnique({
      where: { id: created.body.id },
      include: { items: true },
    });
    expect(toCents(persisted.totalValue)).toBe(0);
    expect(persisted.items[0].chargedValue.toString()).toBe('0');
  });

  it('rejects adding a valued item to a dōTERRA order', async () => {
    const created = await createOrder(baseBody());

    const response = await request(app)
      .post(`/api/orders/${created.body.id}/items`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ description: 'Óleo', chargedValue: 75, quantity: 1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(ZERO_TOTAL_PAYMENT_TYPE_MESSAGE);

    const persisted = await prisma.order.findUnique({
      where: { id: created.body.id },
      include: { items: true },
    });
    expect(persisted.items).toHaveLength(1);
    expect(toCents(persisted.totalValue)).toBe(0);
  });

  it('rejects updating an item of a dōTERRA order to a non-zero value', async () => {
    const created = await createOrder(baseBody());
    const itemId = created.body.items[0].id;

    const response = await request(app)
      .put(`/api/orders/items/${itemId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ chargedValue: 90 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(ZERO_TOTAL_PAYMENT_TYPE_MESSAGE);

    const persisted = await prisma.item.findUnique({ where: { id: itemId } });
    expect(persisted.chargedValue.toString()).toBe('0');
    const order = await prisma.order.findUnique({
      where: { id: created.body.id },
    });
    expect(toCents(order.totalValue)).toBe(0);
  });

  it('keeps a dōTERRA order editable while the total stays zero', async () => {
    const created = await createOrder(baseBody());

    const response = await request(app)
      .put(`/api/orders/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ orderNotes: 'Amostra de boas-vindas' });

    expect(response.status).toBe(200);
    expect(response.body.orderNotes).toBe('Amostra de boas-vindas');
  });

  it('allows changing a non-zero order to dōTERRA once the total is zeroed', async () => {
    const created = await createOrder(
      baseBody({
        paymentType: 'PIX',
        items: [{ description: 'Óleo', chargedValue: 300 }],
      }),
    );

    const response = await request(app)
      .put(`/api/orders/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        paymentType: 'DOTERRA',
        items: [{ id: created.body.items[0].id, chargedValue: 0 }],
      });

    expect(response.status).toBe(200);
    expect(response.body.paymentType).toBe('DOTERRA');
    expect(toCents(response.body.totalValue)).toBe(0);
  });
});

import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { createTestUser } from './helpers/createTestUser.js';

const createPerson = (userId, name) =>
  prisma.person.create({ data: { name, userId } });

const createOrder = (
  userId,
  { orderNumber, orderType = 'VENDA', totalValue = '100.00', personId = null },
) =>
  prisma.order.create({
    data: {
      orderNumber,
      orderType,
      totalValue,
      userId,
      items: personId
        ? { create: { chargedValue: totalValue, personId } }
        : undefined,
    },
  });

// `GET /api/sales/options` powers the autocomplete that links an Uber ride to
// the sale it delivered. It must return only the caller's VENDA rows, with the
// client name derived from the first item (sales do not use `accountOwner`).
describe('GET /api/sales/options', () => {
  let user;
  let other;
  let orderAlpha;
  let orderBeta;

  beforeAll(async () => {
    await prisma.$connect();
    user = await createTestUser('sale_options');
    other = await createTestUser('sale_options_other');

    const alpha = await createPerson(user.user.id, 'Cliente Alpha');
    const beta = await createPerson(user.user.id, 'Cliente Beta');

    orderAlpha = await createOrder(user.user.id, {
      orderNumber: 'V-9001',
      personId: alpha.id,
    });
    orderBeta = await createOrder(user.user.id, {
      orderNumber: 'V-9002',
      totalValue: '50.00',
      personId: beta.id,
    });
    await createOrder(user.user.id, {
      orderNumber: 'C-9001',
      orderType: 'COMPRA',
    });
    await createOrder(other.user.id, { orderNumber: 'V-8001' });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: user.user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: other.user.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  const list = (query = {}, token = user.token) =>
    request(app)
      .get('/api/sales/options')
      .query(query)
      .set('Authorization', `Bearer ${token}`);

  it('lists only the caller VENDA orders with the client name', async () => {
    const response = await list();

    expect(response.status).toBe(200);
    const numbers = response.body.map((option) => option.orderNumber);
    expect(numbers).toEqual(expect.arrayContaining(['V-9001', 'V-9002']));
    expect(numbers).not.toContain('C-9001');
    expect(numbers).not.toContain('V-8001');

    const alphaOption = response.body.find(
      (option) => option.orderNumber === 'V-9001',
    );
    expect(alphaOption).toMatchObject({
      id: orderAlpha.id,
      clientName: 'Cliente Alpha',
    });
    expect(Number(alphaOption.totalValue)).toBe(100);
  });

  it('searches by order number', async () => {
    const response = await list({ q: 'V-9001' });

    expect(response.body.map((option) => option.orderNumber)).toEqual([
      'V-9001',
    ]);
  });

  it('searches by client name', async () => {
    const response = await list({ q: 'Beta' });

    expect(response.body.map((option) => option.orderNumber)).toEqual([
      'V-9002',
    ]);
  });

  it('returns an empty list when nothing matches', async () => {
    const response = await list({ q: 'inexistente' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('respects the limit', async () => {
    const response = await list({ limit: 1 });

    expect(response.body).toHaveLength(1);
  });

  it('rejects an invalid limit', async () => {
    const response = await list({ limit: 'abc' });

    expect(response.status).toBe(400);
  });

  it('never leaks another user options', async () => {
    const response = await list({}, other.token);

    expect(response.body.map((option) => option.orderNumber)).toEqual([
      'V-8001',
    ]);
    expect(response.body[0].id).not.toBe(orderBeta.id);
  });
});

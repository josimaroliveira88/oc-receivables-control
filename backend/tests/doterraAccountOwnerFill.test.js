import request from 'supertest';
import { createHash, randomBytes } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { createTestUser } from './helpers/createTestUser.js';

// Recovering the "Conta ID" of orders that were imported while the capture
// could not name the person. The flow only ever fills an empty field: it never
// creates an order and never overwrites a value the user already has.
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

let orderCounter = 0;
const uniqueOrderNumber = () =>
  `DTFILL${Date.now() % 100000}${(orderCounter += 1)}`;

describe('dōTERRA account owner fill', () => {
  let user;
  let other;

  beforeAll(async () => {
    await prisma.$connect();
    user = await createTestUser('doterra_fill');
    other = await createTestUser('doterra_fill_other');
  });

  const cleanupUser = async (ownerId) => {
    await prisma.stockMovement.deleteMany({ where: { userId: ownerId } });
    await prisma.inventory.deleteMany({ where: { userId: ownerId } });
    await prisma.order.deleteMany({ where: { userId: ownerId } });
    await prisma.creditCardBill.deleteMany({ where: { userId: ownerId } });
    await prisma.financialTransaction.deleteMany({
      where: { userId: ownerId },
    });
    await prisma.apiToken.deleteMany({ where: { userId: ownerId } });
  };

  afterEach(async () => {
    await cleanupUser(user.user.id);
    await cleanupUser(other.user.id);
  });

  afterAll(async () => {
    await cleanupUser(user.user.id);
    await cleanupUser(other.user.id);
    await prisma.user.delete({ where: { id: user.user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: other.user.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  const auth = (token = user.token) => ({ Authorization: `Bearer ${token}` });

  const lookup = (body, token) =>
    request(app).post('/api/doterra/orders/lookup').set(auth(token)).send(body);

  const fill = (body, token) =>
    request(app)
      .post('/api/doterra/orders/fill-account-owner')
      .set(auth(token))
      .send(body);

  const createApiTokenRow = async (ownerId, scope) => {
    const token = `cr_${randomBytes(24).toString('base64url')}`;
    await prisma.apiToken.create({
      data: {
        userId: ownerId,
        name: 'Token de teste',
        scope,
        tokenHash: hashToken(token),
        lastFour: token.slice(-4),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return token;
  };

  const createOrder = (ownerId, overrides = {}) =>
    prisma.order.create({
      data: {
        orderNumber: uniqueOrderNumber(),
        totalValue: 300,
        userId: ownerId,
        orderType: 'COMPRA',
        ...overrides,
      },
    });

  describe('lookup — surfacing the orders that still need a value', () => {
    it('reports the existing orders whose account owner is blank', async () => {
      const blank = await createOrder(user.user.id, { accountOwner: null });
      const filled = await createOrder(user.user.id, {
        accountOwner: 'Gouveia Lima, Cássia',
      });
      const whitespace = await createOrder(user.user.id, {
        accountOwner: '   ',
      });

      const response = await lookup({
        numbers: [
          blank.orderNumber,
          filled.orderNumber,
          whitespace.orderNumber,
        ],
      });

      expect(response.status).toBe(200);
      expect(response.body.existing).toEqual(
        expect.arrayContaining([
          blank.orderNumber,
          filled.orderNumber,
          whitespace.orderNumber,
        ]),
      );
      expect(response.body.existingWithoutAccountOwner.sort()).toEqual(
        [blank.orderNumber, whitespace.orderNumber].sort(),
      );
    });

    it('never lists a missing order as needing a value', async () => {
      const response = await lookup({ numbers: ['nao-existe-9'] });
      expect(response.body.missing).toEqual(['nao-existe-9']);
      expect(response.body.existingWithoutAccountOwner).toEqual([]);
    });

    it("does not expose another user's order", async () => {
      const foreign = await createOrder(other.user.id, { accountOwner: null });
      const response = await lookup({ numbers: [foreign.orderNumber] });
      expect(response.body.existing).toEqual([]);
      expect(response.body.existingWithoutAccountOwner).toEqual([]);
    });
  });

  describe('fill — authentication', () => {
    it('requires authentication', async () => {
      const response = await request(app)
        .post('/api/doterra/orders/fill-account-owner')
        .send({ updates: [] });
      expect(response.status).toBe(401);
    });

    it('rejects a token without the doterra:import scope with 403', async () => {
      const token = await createApiTokenRow(user.user.id, 'uber:import');
      const response = await fill({ updates: [] }, token);
      expect(response.status).toBe(403);
    });

    it('accepts an API token carrying the doterra:import scope', async () => {
      const order = await createOrder(user.user.id, { accountOwner: null });
      const token = await createApiTokenRow(user.user.id, 'doterra:import');

      const response = await fill(
        {
          updates: [
            { orderNumber: order.orderNumber, accountOwner: '15837743' },
          ],
        },
        token,
      );

      expect(response.status).toBe(200);
      expect(response.body.updated).toHaveLength(1);
    });
  });

  describe('fill — the empty field is filled', () => {
    it('writes the account owner on an order imported without one', async () => {
      const order = await createOrder(user.user.id, { accountOwner: null });

      const response = await fill({
        updates: [{ orderNumber: order.orderNumber, accountOwner: '15837743' }],
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        updated: [{ orderNumber: order.orderNumber, accountOwner: '15837743' }],
        unchanged: [],
        notFound: [],
        failed: [],
      });

      const stored = await prisma.order.findUnique({ where: { id: order.id } });
      expect(stored.accountOwner).toBe('15837743');
    });

    it('fills a field holding only whitespace', async () => {
      const order = await createOrder(user.user.id, { accountOwner: '   ' });

      const response = await fill({
        updates: [
          { orderNumber: order.orderNumber, accountOwner: 'Gouveia, Cássia' },
        ],
      });

      expect(response.body.updated).toHaveLength(1);
      const stored = await prisma.order.findUnique({ where: { id: order.id } });
      expect(stored.accountOwner).toBe('Gouveia, Cássia');
    });

    it('trims the value before storing it', async () => {
      const order = await createOrder(user.user.id, { accountOwner: null });

      await fill({
        updates: [
          { orderNumber: order.orderNumber, accountOwner: '  Cássia  ' },
        ],
      });

      const stored = await prisma.order.findUnique({ where: { id: order.id } });
      expect(stored.accountOwner).toBe('Cássia');
    });
  });

  describe('fill — an order that already has a value is never touched', () => {
    it('reports it as unchanged and keeps the stored value', async () => {
      const order = await createOrder(user.user.id, {
        accountOwner: 'Gouveia Lima, Cássia',
      });

      const response = await fill({
        updates: [{ orderNumber: order.orderNumber, accountOwner: '15837743' }],
      });

      expect(response.body).toEqual({
        updated: [],
        unchanged: [order.orderNumber],
        notFound: [],
        failed: [],
      });

      const stored = await prisma.order.findUnique({ where: { id: order.id } });
      expect(stored.accountOwner).toBe('Gouveia Lima, Cássia');
    });

    it('is idempotent: a second run reports everything as unchanged', async () => {
      const order = await createOrder(user.user.id, { accountOwner: null });
      const body = {
        updates: [{ orderNumber: order.orderNumber, accountOwner: '15837743' }],
      };

      const first = await fill(body);
      expect(first.body.updated).toHaveLength(1);

      const second = await fill(body);
      expect(second.status).toBe(200);
      expect(second.body.updated).toEqual([]);
      expect(second.body.unchanged).toEqual([order.orderNumber]);
    });
  });

  describe('fill — an order is never created', () => {
    it('reports an unknown order number as not found', async () => {
      const before = await prisma.order.count({
        where: { userId: user.user.id },
      });

      const response = await fill({
        updates: [{ orderNumber: 'nao-existe-42', accountOwner: '15837743' }],
      });

      expect(response.status).toBe(200);
      expect(response.body.notFound).toEqual(['nao-existe-42']);
      expect(response.body.updated).toEqual([]);
      expect(
        await prisma.order.count({ where: { userId: user.user.id } }),
      ).toBe(before);
    });

    it("does not fill another user's order", async () => {
      const foreign = await createOrder(other.user.id, { accountOwner: null });

      const response = await fill({
        updates: [
          { orderNumber: foreign.orderNumber, accountOwner: '15837743' },
        ],
      });

      expect(response.body.notFound).toEqual([foreign.orderNumber]);
      expect(response.body.updated).toEqual([]);

      const stored = await prisma.order.findUnique({
        where: { id: foreign.id },
      });
      expect(stored.accountOwner).toBeNull();
    });
  });

  describe('fill — partial success', () => {
    it('reports one malformed entry as failed and still fills the others', async () => {
      const valid = await createOrder(user.user.id, { accountOwner: null });

      const response = await fill({
        updates: [
          { orderNumber: valid.orderNumber, accountOwner: '15837743' },
          { orderNumber: '', accountOwner: 'qualquer' },
          { orderNumber: valid.orderNumber, accountOwner: 'x'.repeat(121) },
        ],
      });

      expect(response.status).toBe(200);
      expect(response.body.updated).toHaveLength(1);
      expect(response.body.failed.map((entry) => entry.orderNumber)).toEqual([
        '',
        valid.orderNumber,
      ]);
      expect(response.body.failed[0].error).toEqual(expect.any(String));

      const stored = await prisma.order.findUnique({
        where: { id: valid.id },
      });
      expect(stored.accountOwner).toBe('15837743');
    });

    it('rejects an empty batch with 400', async () => {
      const response = await fill({ updates: [] });
      expect(response.status).toBe(400);
    });
  });

  describe('fill — the correction stays purely descriptive', () => {
    it('does not touch the review flag, the total or the ledger entry', async () => {
      const order = await createOrder(user.user.id, {
        accountOwner: null,
        pendingReview: true,
        totalValue: 300,
        doterraPv: 40,
      });
      await prisma.item.create({
        data: {
          orderId: order.id,
          description: 'Calmer Touch',
          quantity: 1,
          chargedValue: 300,
          chargedValueMode: 'UNIT',
        },
      });
      await prisma.financialTransaction.create({
        data: {
          userId: user.user.id,
          type: 'DESPESA',
          origin: 'PEDIDO_DOTERRA',
          amount: 300,
          description: `Pedido dōTERRA ${order.orderNumber}`,
          transactionDate: new Date('2026-09-02T12:00:00'),
          orderId: order.id,
        },
      });

      const response = await fill({
        updates: [{ orderNumber: order.orderNumber, accountOwner: '15837743' }],
      });
      expect(response.body.updated).toHaveLength(1);

      const stored = await prisma.order.findUnique({
        where: { id: order.id },
        include: { financialTransactions: true },
      });
      expect(stored.accountOwner).toBe('15837743');
      expect(stored.pendingReview).toBe(true);
      expect(stored.totalValue.toString()).toBe('300');
      expect(stored.doterraPv.toString()).toBe('40');
      expect(stored.financialTransactions).toHaveLength(1);
      expect(stored.financialTransactions[0].amount.toString()).toBe('300');
    });
  });
});

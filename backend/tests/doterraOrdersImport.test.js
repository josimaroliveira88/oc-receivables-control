import request from 'supertest';
import { createHash, randomBytes } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { createTestUser } from './helpers/createTestUser.js';

// Product codes are globally unique, so every suite/test uses its own prefix
// and cleans its own rows. The `DTIMPORT` prefix is exclusive to this suite.
const PREFIX = 'DTIMPORT';
let codeCounter = 0;
const uniqueCode = () => `${PREFIX}${(codeCounter += 1)}`;
let orderCounter = 0;
const uniqueOrderNumber = () =>
  `DTIMP${Date.now() % 100000}${(orderCounter += 1)}`;

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

describe('dōTERRA orders import and lookup', () => {
  let user;
  let other;

  beforeAll(async () => {
    await prisma.$connect();
    user = await createTestUser('doterra_import');
    await prisma.person.create({
      data: { name: 'Eu Mesmo', isSelf: true, userId: user.user.id },
    });
    other = await createTestUser('doterra_import_other');
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

  const cleanupProducts = async () => {
    const where = { code: { startsWith: PREFIX } };
    await prisma.stockMovement.deleteMany({ where: { product: where } });
    await prisma.inventory.deleteMany({ where: { product: where } });
    await prisma.item.deleteMany({ where: { product: where } });
    await prisma.kitComposition.deleteMany({
      where: {
        OR: [{ kitProduct: where }, { componentProduct: where }],
      },
    });
    await prisma.productPrice.deleteMany({ where: { product: where } });
    await prisma.product.deleteMany({ where: where });
  };

  afterEach(async () => {
    await cleanupUser(user.user.id);
    await cleanupUser(other.user.id);
    await cleanupProducts();
  });

  afterAll(async () => {
    await cleanupUser(user.user.id);
    await cleanupUser(other.user.id);
    await cleanupProducts();
    await prisma.user.delete({ where: { id: user.user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: other.user.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  const auth = (token = user.token) => ({ Authorization: `Bearer ${token}` });

  const lookup = (body, token) =>
    request(app).post('/api/doterra/orders/lookup').set(auth(token)).send(body);

  const importOrders = (body, token) =>
    request(app).post('/api/doterra/orders/import').set(auth(token)).send(body);

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

  const createCatalogProduct = (code, overrides = {}) =>
    prisma.product.create({
      data: {
        code,
        name: `Produto ${code}`,
        size: '10ml',
        status: 'ATIVO',
        ...overrides,
        prices: {
          create: { regularPrice: 100, memberPrice: 150, pv: 20 },
        },
      },
    });

  // A purchase order with two item lines whose unit prices sum to 300, so the
  // computed total matches `listValue` unless a test overrides it. Any
  // override key wins over the default (including `items`).
  const orderFixture = (overrides = {}) => {
    const knownCode = overrides.knownCode ?? uniqueCode();
    const draftCode = overrides.draftCode ?? uniqueCode();
    return {
      orderNumber: uniqueOrderNumber(),
      orderDate: '2026-09-02',
      accountOwner: 'Gouveia Lima, Cássia',
      listTypeCode: 'I',
      listOriginCode: 'AS',
      pvMonth: '2026-09',
      doterraPv: 40,
      listValue: 300,
      paymentType: 'BOLETO',
      shippingValue: 0,
      items: [
        {
          code: knownCode,
          description: 'Calmer Touch',
          quantity: 1,
          unitPrice: 150,
          unitPv: 20,
        },
        {
          code: draftCode,
          description: 'Produto novo',
          quantity: 1,
          unitPrice: 150,
          unitPv: 20,
        },
      ],
      ...overrides,
    };
  };

  describe('lookup', () => {
    it('requires authentication', async () => {
      const response = await request(app)
        .post('/api/doterra/orders/lookup')
        .send({ numbers: ['1'] });
      expect(response.status).toBe(401);
    });

    it('rejects a token without the doterra:import scope with 403', async () => {
      const token = await createApiTokenRow(user.user.id, 'uber:import');
      const response = await lookup({ numbers: ['1'] }, token);
      expect(response.status).toBe(403);
    });

    it('accepts a session JWT and partitions existing/missing numbers', async () => {
      const existingNumber = uniqueOrderNumber();
      await prisma.order.create({
        data: {
          orderNumber: existingNumber,
          totalValue: 10,
          userId: user.user.id,
          orderType: 'COMPRA',
        },
      });

      const response = await lookup({
        numbers: [existingNumber, 'nao-existe-1'],
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        existing: [existingNumber],
        missing: ['nao-existe-1'],
      });
    });
  });

  describe('import — dedup', () => {
    it('reports an already registered purchase order as existing and never touches it', async () => {
      const orderNumber = uniqueOrderNumber();
      await prisma.order.create({
        data: {
          orderNumber,
          totalValue: 42.5,
          orderNotes: 'manual',
          userId: user.user.id,
          orderType: 'COMPRA',
        },
      });

      const response = await importOrders({
        orders: [orderFixture({ orderNumber })],
      });

      expect(response.status).toBe(200);
      expect(response.body.existing).toEqual([orderNumber]);
      expect(response.body.created).toEqual([]);

      const order = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber },
      });
      expect(order.totalValue.toString()).toBe('42.5');
      expect(order.orderNotes).toBe('manual');
      expect(order.pendingReview).toBe(false);
      const ledger = await prisma.financialTransaction.count({
        where: { orderId: order.id },
      });
      expect(ledger).toBe(0);
      const movements = await prisma.stockMovement.count({
        where: { orderId: order.id },
      });
      expect(movements).toBe(0);
    });

    it('reports a number that matches a VENDA order as existing (no P2002)', async () => {
      const orderNumber = uniqueOrderNumber();
      await prisma.order.create({
        data: {
          orderNumber,
          totalValue: 10,
          orderType: 'VENDA',
          userId: user.user.id,
        },
      });

      const response = await importOrders({
        orders: [orderFixture({ orderNumber })],
      });

      expect(response.status).toBe(200);
      expect(response.body.existing).toEqual([orderNumber]);
      expect(response.body.failed).toEqual([]);
    });
  });

  describe('import — creation', () => {
    it('creates a pending-review purchase order with stock and ledger entries', async () => {
      const knownCode = uniqueCode();
      const draftCode = uniqueCode();
      await createCatalogProduct(knownCode);
      const orderNumber = uniqueOrderNumber();

      const response = await importOrders({
        orders: [orderFixture({ orderNumber, knownCode, draftCode })],
      });

      expect(response.status).toBe(200);
      expect(response.body.created).toHaveLength(1);
      expect(response.body.created[0].orderNumber).toBe(orderNumber);
      expect(response.body.createdProducts).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: draftCode })]),
      );

      const order = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber },
        include: { items: true },
      });
      expect(order.orderType).toBe('COMPRA');
      expect(order.pendingReview).toBe(true);
      expect(order.totalValue.toString()).toBe('300');
      expect(order.doterraPv.toString()).toBe('40');
      expect(order.shippingValue.toString()).toBe('0');
      expect(order.items).toHaveLength(2);
      expect(order.items.every((item) => item.forStock)).toBe(true);
      expect(order.items.every((item) => item.personId)).toBeTruthy();

      const movements = await prisma.stockMovement.findMany({
        where: { orderId: order.id },
      });
      expect(movements).toHaveLength(2);
      expect(movements.every((movement) => movement.type === 'ENTRADA')).toBe(
        true,
      );

      const ledger = await prisma.financialTransaction.findFirst({
        where: { orderId: order.id, origin: 'PEDIDO_DOTERRA' },
      });
      expect(ledger.amount.toString()).toBe('300');
      expect(ledger.description).toBe(`Pedido dōTERRA ${orderNumber}`);
    });

    it('links a known ATIVO product and creates a draft for the unknown code', async () => {
      const knownCode = uniqueCode();
      const draftCode = uniqueCode();
      const known = await createCatalogProduct(knownCode);

      const response = await importOrders({
        orders: [orderFixture({ knownCode, draftCode })],
      });
      expect(response.status).toBe(200);

      const order = await prisma.order.findFirst({
        where: {
          userId: user.user.id,
          orderNumber: response.body.created[0].orderNumber,
        },
        include: { items: true },
      });
      const linkedKnown = order.items.find(
        (item) => item.productId === known.id,
      );
      expect(linkedKnown).toBeTruthy();

      const draft = await prisma.product.findUnique({
        where: { code: draftCode },
        include: { prices: true },
      });
      expect(draft.status).toBe('PENDENTE_CADASTRO');
      expect(draft.productType).toBe('SIMPLES');
      expect(draft.size).toBe('');
      expect(draft.prices).toHaveLength(1);
      expect(draft.prices[0].regularPrice.toString()).toBe('0');
      expect(draft.prices[0].memberPrice.toString()).toBe('150');
      expect(draft.prices[0].pv.toString()).toBe('20');

      const linkedDraft = order.items.find(
        (item) => item.productId === draft.id,
      );
      expect(linkedDraft).toBeTruthy();
    });

    it('creates a single draft when the same unknown code appears twice', async () => {
      const draftCode = uniqueCode();
      const response = await importOrders({
        orders: [
          orderFixture({
            listValue: 300,
            items: [
              {
                code: draftCode,
                description: 'Linha 1',
                quantity: 1,
                unitPrice: 150,
                unitPv: 20,
              },
              {
                code: draftCode,
                description: 'Linha 2',
                quantity: 1,
                unitPrice: 150,
                unitPv: 20,
              },
            ],
          }),
        ],
      });

      expect(response.status).toBe(200);
      expect(response.body.createdProducts).toHaveLength(1);

      const products = await prisma.product.findMany({
        where: { code: draftCode },
      });
      expect(products).toHaveLength(1);

      const order = await prisma.order.findFirst({
        where: {
          userId: user.user.id,
          orderNumber: response.body.created[0].orderNumber,
        },
        include: { items: true },
      });
      expect(order.items).toHaveLength(2);
      expect(order.items[0].productId).toBe(order.items[1].productId);
    });

    it('links an INATIVO existing code and records a warning', async () => {
      const inactiveCode = uniqueCode();
      await createCatalogProduct(inactiveCode, { status: 'INATIVO' });
      const draftCode = uniqueCode();
      const orderNumber = uniqueOrderNumber();

      const response = await importOrders({
        orders: [
          orderFixture({ orderNumber, knownCode: inactiveCode, draftCode }),
        ],
      });

      expect(response.status).toBe(200);
      expect(response.body.created[0].warnings.join(' ')).toContain(
        inactiveCode,
      );
    });

    it('adds a warning when the computed total differs from the informed value', async () => {
      const response = await importOrders({
        orders: [orderFixture({ listValue: 999 })],
      });

      expect(response.status).toBe(200);
      expect(response.body.created[0].warnings.join(' ')).toMatch(/difere/i);
      expect(response.body.created).toHaveLength(1);
    });

    it('imports zero-price promo items at zero', async () => {
      const promoCode = uniqueCode();
      const orderNumber = uniqueOrderNumber();
      const response = await importOrders({
        orders: [
          orderFixture({
            orderNumber,
            listValue: 0,
            items: [
              {
                code: promoCode,
                description: 'Produto do Mês',
                quantity: 1,
                unitPrice: 0,
                unitPv: 0,
              },
            ],
          }),
        ],
      });

      expect(response.status).toBe(200);
      const order = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber },
        include: { items: true },
      });
      expect(order.totalValue.toString()).toBe('0');
      expect(order.items[0].chargedValue.toString()).toBe('0');
    });
  });

  describe('import — credit card', () => {
    it('creates a bill with installments and defaults the first installment to the order date', async () => {
      const orderNumber = uniqueOrderNumber();
      const cardCode = uniqueCode();

      const response = await importOrders({
        orders: [
          orderFixture({
            orderNumber,
            listValue: 300,
            paymentType: 'CARTAO_CREDITO',
            installments: 4,
            installmentValue: 75,
            items: [
              {
                code: cardCode,
                description: 'Kit',
                quantity: 1,
                unitPrice: 300,
                unitPv: 40,
              },
            ],
          }),
        ],
      });

      expect(response.status).toBe(200);
      expect(response.body.created).toHaveLength(1);

      const order = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber },
      });
      const bill = await prisma.creditCardBill.findFirst({
        where: { userId: user.user.id, orderId: order.id },
        include: { transactions: true },
      });
      expect(bill.installments).toBe(4);
      expect(bill.totalCents).toBe(30000);
      expect(bill.firstInstallmentAt.toISOString().slice(0, 10)).toBe(
        '2026-09-02',
      );
      expect(bill.transactions).toHaveLength(4);
      const sum = bill.transactions.reduce(
        (acc, row) => acc + Math.round(parseFloat(row.amount) * 100),
        0,
      );
      expect(sum).toBe(30000);

      const standalone = await prisma.financialTransaction.count({
        where: { orderId: order.id, creditCardBillId: null },
      });
      expect(standalone).toBe(0);
    });

    it('creates no bill for non-card payment types', async () => {
      const orderNumber = uniqueOrderNumber();
      const response = await importOrders({
        orders: [orderFixture({ orderNumber, paymentType: 'PIX' })],
      });
      expect(response.status).toBe(200);
      const order = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber },
      });
      const bills = await prisma.creditCardBill.count({
        where: { orderId: order.id },
      });
      expect(bills).toBe(0);
    });
  });

  describe('import — partial failure and idempotency', () => {
    it('commits the valid order and reports the invalid one as failed', async () => {
      const validNumber = uniqueOrderNumber();
      const invalidNumber = uniqueOrderNumber();

      const response = await importOrders({
        orders: [
          orderFixture({ orderNumber: validNumber }),
          {
            orderNumber: invalidNumber,
            orderDate: '2026-09-02',
            listValue: 0,
            items: [],
          },
        ],
      });

      expect(response.status).toBe(200);
      expect(response.body.created).toHaveLength(1);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].orderNumber).toBe(invalidNumber);

      const committed = await prisma.order.count({
        where: { userId: user.user.id, orderNumber: validNumber },
      });
      expect(committed).toBe(1);
      const missing = await prisma.order.count({
        where: { userId: user.user.id, orderNumber: invalidNumber },
      });
      expect(missing).toBe(0);
    });

    it('is idempotent: re-importing the same payload creates nothing new', async () => {
      const payload = { orders: [orderFixture()] };
      const first = await importOrders(payload);
      expect(first.body.created).toHaveLength(1);

      const second = await importOrders(payload);
      expect(second.status).toBe(200);
      expect(second.body.created).toEqual([]);
      expect(second.body.existing).toEqual(
        payload.orders.map((o) => o.orderNumber),
      );

      const count = await prisma.order.count({
        where: { userId: user.user.id },
      });
      expect(count).toBe(1);
    });
  });

  describe('review endpoint and filter', () => {
    it('clears the review flag through PATCH /api/orders/:id/review', async () => {
      const orderNumber = uniqueOrderNumber();
      await importOrders({ orders: [orderFixture({ orderNumber })] });
      const order = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber },
      });

      const response = await request(app)
        .patch(`/api/orders/${order.id}/review`)
        .set(auth());

      expect(response.status).toBe(200);
      expect(response.body.pendingReview).toBe(false);
    });

    it('filters the list by pendingReview', async () => {
      const pendingNumber = uniqueOrderNumber();
      const clearNumber = uniqueOrderNumber();
      await importOrders({
        orders: [
          orderFixture({ orderNumber: pendingNumber }),
          orderFixture({ orderNumber: clearNumber }),
        ],
      });
      const clearOrder = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber: clearNumber },
      });
      await request(app)
        .patch(`/api/orders/${clearOrder.id}/review`)
        .set(auth());

      const pending = await request(app)
        .get('/api/orders?pendingReview=yes')
        .set(auth());
      expect(pending.status).toBe(200);
      expect(pending.body.map((o) => o.orderNumber)).toEqual([pendingNumber]);

      const reviewed = await request(app)
        .get('/api/orders?pendingReview=no')
        .set(auth());
      expect(reviewed.body.map((o) => o.orderNumber)).toEqual([clearNumber]);
    });

    it('clears the review flag when the order is saved', async () => {
      const orderNumber = uniqueOrderNumber();
      await importOrders({ orders: [orderFixture({ orderNumber })] });
      const order = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber },
      });

      const response = await request(app)
        .put(`/api/orders/${order.id}`)
        .set(auth())
        .send({ orderNotes: 'revisado' });

      expect(response.status).toBe(200);
      expect(response.body.pendingReview).toBe(false);
    });
  });

  describe('cascade cleanup on deletion', () => {
    it('removes everything an imported order created, including draft products', async () => {
      const draftCode = uniqueCode();
      const orderNumber = uniqueOrderNumber();
      await importOrders({
        orders: [
          orderFixture({
            orderNumber,
            listValue: 150,
            items: [
              {
                code: draftCode,
                description: 'Rascunho',
                quantity: 1,
                unitPrice: 150,
                unitPv: 20,
              },
            ],
          }),
        ],
      });

      const order = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber },
      });
      const product = await prisma.product.findUnique({
        where: { code: draftCode },
      });

      const response = await request(app)
        .delete(`/api/orders/${order.id}`)
        .set(auth());
      expect(response.status).toBe(200);

      expect(
        await prisma.order.findUnique({ where: { id: order.id } }),
      ).toBeNull();
      expect(
        await prisma.product.findUnique({ where: { id: product.id } }),
      ).toBeNull();
      expect(
        await prisma.productPrice.count({ where: { productId: product.id } }),
      ).toBe(0);
      expect(
        await prisma.inventory.count({ where: { productId: product.id } }),
      ).toBe(0);
      expect(
        await prisma.stockMovement.count({ where: { productId: product.id } }),
      ).toBe(0);
      expect(
        await prisma.financialTransaction.count({
          where: { orderId: order.id },
        }),
      ).toBe(0);
    });

    it('keeps a draft that a second imported order still references', async () => {
      const draftCode = uniqueCode();
      const firstNumber = uniqueOrderNumber();
      const secondNumber = uniqueOrderNumber();
      const singleItem = (orderNumber) =>
        orderFixture({
          orderNumber,
          listValue: 150,
          items: [
            {
              code: draftCode,
              description: 'Compartilhado',
              quantity: 1,
              unitPrice: 150,
              unitPv: 20,
            },
          ],
        });

      await importOrders({ orders: [singleItem(firstNumber)] });
      await importOrders({ orders: [singleItem(secondNumber)] });

      const first = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber: firstNumber },
      });
      const product = await prisma.product.findUnique({
        where: { code: draftCode },
      });

      await request(app).delete(`/api/orders/${first.id}`).set(auth());

      expect(
        await prisma.product.findUnique({ where: { id: product.id } }),
      ).not.toBeNull();

      const second = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber: secondNumber },
      });
      await request(app).delete(`/api/orders/${second.id}`).set(auth());

      expect(
        await prisma.product.findUnique({ where: { id: product.id } }),
      ).toBeNull();
    });

    it('keeps a draft the user already activated', async () => {
      const draftCode = uniqueCode();
      const orderNumber = uniqueOrderNumber();
      await importOrders({
        orders: [
          orderFixture({
            orderNumber,
            listValue: 150,
            items: [
              {
                code: draftCode,
                description: 'Ativado',
                quantity: 1,
                unitPrice: 150,
                unitPv: 20,
              },
            ],
          }),
        ],
      });

      const product = await prisma.product.findUnique({
        where: { code: draftCode },
      });
      await prisma.product.update({
        where: { id: product.id },
        data: { status: 'ATIVO' },
      });
      const order = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber },
      });

      await request(app).delete(`/api/orders/${order.id}`).set(auth());

      expect(
        await prisma.product.findUnique({ where: { id: product.id } }),
      ).not.toBeNull();
    });

    it('keeps a draft with an inventory row of another user', async () => {
      const draftCode = uniqueCode();
      const orderNumber = uniqueOrderNumber();
      await importOrders({
        orders: [
          orderFixture({
            orderNumber,
            listValue: 150,
            items: [
              {
                code: draftCode,
                description: 'Estoque alheio',
                quantity: 1,
                unitPrice: 150,
                unitPv: 20,
              },
            ],
          }),
        ],
      });

      const product = await prisma.product.findUnique({
        where: { code: draftCode },
      });
      await prisma.inventory.create({
        data: { userId: other.user.id, productId: product.id, quantity: 5 },
      });
      const order = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber },
      });

      await request(app).delete(`/api/orders/${order.id}`).set(auth());

      expect(
        await prisma.product.findUnique({ where: { id: product.id } }),
      ).not.toBeNull();
    });

    it('keeps a regular product and only reverses its stock', async () => {
      const knownCode = uniqueCode();
      await createCatalogProduct(knownCode);
      const orderNumber = uniqueOrderNumber();
      await importOrders({
        orders: [
          orderFixture({
            orderNumber,
            listValue: 150,
            items: [
              {
                code: knownCode,
                description: 'Produto comum',
                quantity: 1,
                unitPrice: 150,
                unitPv: 20,
              },
            ],
          }),
        ],
      });

      const product = await prisma.product.findUnique({
        where: { code: knownCode },
      });
      const order = await prisma.order.findFirst({
        where: { userId: user.user.id, orderNumber },
      });

      await request(app).delete(`/api/orders/${order.id}`).set(auth());

      expect(
        await prisma.product.findUnique({ where: { id: product.id } }),
      ).not.toBeNull();
      const movements = await prisma.stockMovement.findMany({
        where: { userId: user.user.id, productId: product.id },
        orderBy: { type: 'asc' },
      });
      expect(movements).toHaveLength(2);
      const inventory = await prisma.inventory.findFirst({
        where: { userId: user.user.id, productId: product.id },
      });
      expect(inventory.quantity).toBe(0);
    });
  });
});

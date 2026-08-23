const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

const registerUser = async (prefix) => {
  const username = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'testpass123' });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'testpass123' });
  return {
    userId: regRes.body.id,
    token: loginRes.body.token,
    username,
  };
};

const createTestProduct = async (codeSuffix) => {
  return prisma.product.create({
    data: {
      code: `TESTORDSTK${codeSuffix}`,
      name: 'Óleo de Teste',
      size: '15 ml',
      status: 'ATIVO',
      prices: {
        create: { regularPrice: 100, memberPrice: 75, pv: 10 },
      },
    },
  });
};

describe('Orders <-> Stock integration', () => {
  let user;
  let product;
  let selfPersonId;
  let regularPersonId;
  let orderId;

  const uniqueOrder = () =>
    `ORDSTK-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const createSelfPerson = async () => {
    const p = await prisma.person.create({
      data: { name: 'Eu Mesmo', isSelf: true, userId: user.userId },
    });
    selfPersonId = p.id;
  };

  const createRegularPerson = async () => {
    const p = await prisma.person.create({
      data: { name: 'Cliente Teste', userId: user.userId },
    });
    regularPersonId = p.id;
  };

  const getInventory = async (productId) =>
    prisma.inventory.findUnique({
      where: {
        userId_productId: { userId: user.userId, productId },
      },
    });

  const getMovements = async (productId) =>
    prisma.stockMovement.findMany({
      where: { userId: user.userId, productId },
      orderBy: { createdAt: 'asc' },
    });

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('ordstk');
    product = await createTestProduct(Math.floor(Math.random() * 100000));
    await createSelfPerson();
    await createRegularPerson();
  });

  afterAll(async () => {
    if (orderId) {
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    }
    await prisma.stockMovement
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    await prisma.inventory
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    await prisma.person
      .deleteMany({ where: { id: { in: [selfPersonId, regularPersonId] } } })
      .catch(() => {});
    if (user) {
      await prisma.user.delete({ where: { id: user.userId } }).catch(() => {});
    }
    await prisma.product
      .deleteMany({ where: { id: product.id } })
      .catch(() => {});
    await prisma.product
      .deleteMany({ where: { code: { startsWith: 'TESTORDSTK' } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (orderId) {
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
      orderId = null;
    }
    await prisma.stockMovement
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    await prisma.inventory
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
  });

  const createOrder = async (items, extra = {}) => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ orderNumber: uniqueOrder(), ...extra, items });
    if (res.status === 201) orderId = res.body.id;
    return res;
  };

  describe('createOrder with stock items', () => {
    it('adds self stock item to inventory and links the movement to the order/item', async () => {
      const res = await createOrder([
        {
          description: 'Meu estoque',
          chargedValue: 50,
          quantity: 4,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);

      expect(res.status).toBe(201);
      const inv = await getInventory(product.id);
      expect(inv.quantity).toBe(4);

      const movements = await getMovements(product.id);
      expect(movements).toHaveLength(1);
      expect(movements[0].type).toBe('ENTRADA');
      expect(movements[0].quantity).toBe(4);
      expect(movements[0].orderId).toBe(res.body.id);
      expect(movements[0].itemId).toBe(res.body.items[0].id);
      expect(movements[0].reason).toContain('Pedido');
    });

    it('sets effectiveDate from the order date', async () => {
      const res = await createOrder(
        [
          {
            description: 'Meu estoque',
            chargedValue: 50,
            quantity: 3,
            forStock: true,
            personId: selfPersonId,
            productId: product.id,
          },
        ],
        { orderDate: '2026-08-10' },
      );

      expect(res.status).toBe(201);
      const movements = await getMovements(product.id);
      expect(movements).toHaveLength(1);
      const effective = new Date(movements[0].effectiveDate);
      expect(effective.getFullYear()).toBe(2026);
      expect(effective.getMonth()).toBe(7);
      expect(effective.getDate()).toBe(10);
      expect(effective.getHours()).toBe(0);
    });

    it('defaults effectiveDate to the order creation time when orderDate is absent', async () => {
      const before = Date.now();
      const res = await createOrder([
        {
          description: 'Meu estoque',
          chargedValue: 50,
          quantity: 2,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);

      expect(res.status).toBe(201);
      const movements = await getMovements(product.id);
      expect(movements).toHaveLength(1);
      const effectiveTime = new Date(movements[0].effectiveDate).getTime();
      expect(effectiveTime).toBeGreaterThanOrEqual(before - 5000);
      expect(effectiveTime).toBeLessThanOrEqual(Date.now() + 5000);
    });

    it('propagates a changed order date to the diff movements on update', async () => {
      await createOrder([
        {
          description: 'Meu estoque',
          chargedValue: 50,
          quantity: 3,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      expect((await getMovements(product.id))[0]).toBeDefined();

      const res = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          orderDate: '2026-09-01',
          items: [
            {
              description: 'Meu estoque',
              chargedValue: 50,
              quantity: 5,
              forStock: true,
              personId: selfPersonId,
              productId: product.id,
            },
          ],
        });

      expect(res.status).toBe(200);
      const movements = await getMovements(product.id);
      const diffMovement = movements[movements.length - 1];
      const effective = new Date(diffMovement.effectiveDate);
      expect(effective.getFullYear()).toBe(2026);
      expect(effective.getMonth()).toBe(8);
      expect(effective.getDate()).toBe(1);
    });

    it('does not touch stock for a self item not flagged forStock', async () => {
      const res = await createOrder([
        {
          description: 'Uso pessoal',
          chargedValue: 50,
          quantity: 2,
          forStock: false,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      expect(res.status).toBe(201);
      const movements = await getMovements(product.id);
      expect(movements).toHaveLength(0);
    });

    it('rejects forStock on a non-self person', async () => {
      const res = await createOrder([
        {
          description: 'Item cliente',
          chargedValue: 50,
          forStock: true,
          personId: regularPersonId,
          productId: product.id,
        },
      ]);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('user themselves');
    });

    it('rejects forStock without a product', async () => {
      const res = await createOrder([
        {
          description: 'Sem produto',
          chargedValue: 50,
          forStock: true,
          personId: selfPersonId,
        },
      ]);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('require a catalog product');
    });

    it('rejects quantity zero or negative', async () => {
      const res = await createOrder([
        {
          description: 'Qtd inválida',
          chargedValue: 50,
          quantity: 0,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      expect(res.status).toBe(400);
    });

    it('computes total respecting UNIT mode (chargedValue x quantity)', async () => {
      const res = await createOrder([
        {
          description: 'Unidade',
          chargedValue: 10.5,
          quantity: 3,
          chargedValueMode: 'UNIT',
          personId: regularPersonId,
          productId: product.id,
        },
      ]);
      expect(res.status).toBe(201);
      expect(parseFloat(res.body.totalValue)).toBe(31.5);
    });

    it('computes total respecting TOTAL mode (just chargedValue)', async () => {
      const res = await createOrder([
        {
          description: 'Total',
          chargedValue: 40,
          quantity: 3,
          chargedValueMode: 'TOTAL',
          personId: regularPersonId,
          productId: product.id,
        },
      ]);
      expect(res.status).toBe(201);
      expect(parseFloat(res.body.totalValue)).toBe(40);
    });

    it('does not affect another user stock', async () => {
      const other = await registerUser('ordstk_b');
      const res = await createOrder([
        {
          description: 'Estoque A',
          chargedValue: 50,
          quantity: 7,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      expect(res.status).toBe(201);
      const otherInv = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: other.userId, productId: product.id },
        },
      });
      expect(otherInv).toBeNull();
      await prisma.user.delete({ where: { id: other.userId } }).catch(() => {});
    });
  });

  describe('updateOrder stock diff', () => {
    it('deducts the difference when reducing a self stock quantity', async () => {
      await createOrder([
        {
          chargedValue: 50,
          quantity: 5,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      const invBefore = await getInventory(product.id);
      expect(invBefore.quantity).toBe(5);

      const res = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [
            {
              chargedValue: 50,
              quantity: 3,
              forStock: true,
              personId: selfPersonId,
              productId: product.id,
            },
          ],
        });

      expect(res.status).toBe(200);
      const invAfter = await getInventory(product.id);
      expect(invAfter.quantity).toBe(3);
    });

    it('adds the difference when increasing a self stock quantity', async () => {
      await createOrder([
        {
          chargedValue: 50,
          quantity: 3,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      const res = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [
            {
              chargedValue: 50,
              quantity: 8,
              forStock: true,
              personId: selfPersonId,
              productId: product.id,
            },
          ],
        });
      expect(res.status).toBe(200);
      const invAfter = await getInventory(product.id);
      expect(invAfter.quantity).toBe(8);
    });

    it('reverses old product and adds new product on product change', async () => {
      const product2 = await createTestProduct(
        `B${Math.floor(Math.random() * 100000)}`,
      );
      await createOrder([
        {
          chargedValue: 50,
          quantity: 4,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      const res = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [
            {
              chargedValue: 50,
              quantity: 6,
              forStock: true,
              personId: selfPersonId,
              productId: product2.id,
            },
          ],
        });
      expect(res.status).toBe(200);
      const invOld = await getInventory(product.id);
      expect(invOld.quantity).toBe(0);
      const invNew = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: user.userId, productId: product2.id },
        },
      });
      expect(invNew.quantity).toBe(6);
      await prisma.inventory
        .deleteMany({ where: { productId: product2.id } })
        .catch(() => {});
      await prisma.stockMovement
        .deleteMany({ where: { productId: product2.id } })
        .catch(() => {});
      await prisma.product
        .deleteMany({ where: { id: product2.id } })
        .catch(() => {});
    });

    it('deducts stock when removing the self stock item', async () => {
      await createOrder([
        {
          chargedValue: 50,
          quantity: 5,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      const res = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [
            {
              description: 'Item sem estoque',
              chargedValue: 10,
              personId: regularPersonId,
            },
          ],
        });
      expect(res.status).toBe(200);
      const invAfter = await getInventory(product.id);
      expect(invAfter.quantity).toBe(0);
    });

    it('blocks update when reversal would make stock negative', async () => {
      await createOrder([
        {
          chargedValue: 50,
          quantity: 5,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      // Manual SAIDA reduces stock to 1
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ productId: product.id, type: 'SAIDA', quantity: 4 });

      const res = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [
            {
              chargedValue: 50,
              quantity: 1,
              forStock: true,
              personId: selfPersonId,
              productId: product.id,
            },
          ],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('stock negative');
    });
  });

  describe('deleteItem / deleteOrder stock reversal', () => {
    it('deducts stock when deleting a self stock item', async () => {
      await createOrder([
        {
          chargedValue: 50,
          quantity: 4,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      const itemId = (await prisma.item.findFirst({ where: { orderId } })).id;

      const res = await request(app)
        .delete(`/api/orders/items/${itemId}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      const invAfter = await getInventory(product.id);
      expect(invAfter.quantity).toBe(0);
    });

    it('blocks deleteItem when reversal would make stock negative', async () => {
      await createOrder([
        {
          chargedValue: 50,
          quantity: 2,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      const itemId = (await prisma.item.findFirst({ where: { orderId } })).id;
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ productId: product.id, type: 'SAIDA', quantity: 2 });

      const res = await request(app)
        .delete(`/api/orders/items/${itemId}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('stock negative');
    });

    it('deducts stock when deleting the whole order', async () => {
      await createOrder([
        {
          chargedValue: 50,
          quantity: 6,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      const res = await request(app)
        .delete(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      const invAfter = await getInventory(product.id);
      expect(invAfter.quantity).toBe(0);
      orderId = null;
    });
  });

  describe('addItemToOrder stock', () => {
    it('adds stock when adding a self stock item', async () => {
      await createOrder([{ chargedValue: 10, personId: regularPersonId }]);
      const res = await request(app)
        .post(`/api/orders/${orderId}/items`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          chargedValue: 50,
          quantity: 3,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        });
      expect(res.status).toBe(201);
      const invAfter = await getInventory(product.id);
      expect(invAfter.quantity).toBe(3);
    });
  });

  describe('updateItem stock', () => {
    it('deducts stock difference when reducing a self stock quantity', async () => {
      await createOrder([
        {
          chargedValue: 50,
          quantity: 5,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      const itemId = (await prisma.item.findFirst({ where: { orderId } })).id;

      const res = await request(app)
        .put(`/api/orders/items/${itemId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ quantity: 2 });
      expect(res.status).toBe(200);
      const invAfter = await getInventory(product.id);
      expect(invAfter.quantity).toBe(2);
    });
  });

  describe('undo guard for order-generated movements', () => {
    it('rejects undoing an order-generated movement with the order number', async () => {
      await createOrder([
        {
          chargedValue: 50,
          quantity: 3,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      const movements = await getMovements(product.id);
      expect(movements).toHaveLength(1);
      const mvId = movements[0].id;

      const res = await request(app)
        .post(`/api/stock/movements/${mvId}/undo`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Pedido');
      expect(res.body.orderNumber).toBeDefined();
      expect(res.body.orderId).toBeDefined();
    });

    it('exposes the linked order in the product history', async () => {
      await createOrder([
        {
          chargedValue: 50,
          quantity: 3,
          forStock: true,
          personId: selfPersonId,
          productId: product.id,
        },
      ]);
      const orderNumber = (
        await prisma.order.findUnique({
          where: { id: orderId },
          select: { orderNumber: true },
        })
      ).orderNumber;

      const res = await request(app)
        .get(`/api/stock/${product.id}/history`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].order).toEqual(
        expect.objectContaining({ id: orderId, orderNumber }),
      );
    });
  });
});

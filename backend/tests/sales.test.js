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

const createPerson = async (userId, name, extra = {}) => {
  const p = await prisma.person.create({
    data: { name, userId, ...extra },
  });
  return p;
};

const createTestProduct = async (codeSuffix, extra = {}) => {
  return prisma.product.create({
    data: {
      code: `TESTSALE${codeSuffix}`,
      name: 'Produto de Venda',
      size: '60 ml',
      status: 'ATIVO',
      prices: {
        create: { regularPrice: 100, memberPrice: 75, pv: 10 },
      },
      ...extra,
    },
  });
};

const seedStock = async (userId, productId, quantity) => {
  await prisma.inventory.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, quantity },
    update: { quantity },
  });
};

describe('Sales orders CRUD', () => {
  let user;
  let user2;
  let client;
  let selfPerson;
  let product;
  let createdSaleIds = [];

  const salePayload = (overrides = {}) => ({
    clientPersonId: client.id,
    items: [
      {
        productId: product.id,
        chargedValue: 100,
        quantity: 2,
      },
    ],
    ...overrides,
  });

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('sale');
    user2 = await registerUser('sale2');
    client = await createPerson(user.userId, 'Cliente da Venda');
    selfPerson = await createPerson(user.userId, 'Eu Mesmo', { isSelf: true });
    product = await createTestProduct(Math.floor(Math.random() * 100000));
    await seedStock(user.userId, product.id, 1000);
    await seedStock(user2.userId, product.id, 1000);
  });

  afterAll(async () => {
    await prisma.stockMovement
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    await prisma.inventory
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    if (user) {
      await prisma.user.delete({ where: { id: user.userId } }).catch(() => {});
    }
    if (user2) {
      await prisma.user.delete({ where: { id: user2.userId } }).catch(() => {});
    }
    await prisma.product
      .deleteMany({ where: { id: product.id } })
      .catch(() => {});
    await prisma.product
      .deleteMany({ where: { code: { startsWith: 'TESTSALE' } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  afterEach(async () => {
    for (const id of createdSaleIds) {
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    createdSaleIds = [];
    await prisma.stockMovement
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    await prisma.inventory
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    await seedStock(user.userId, product.id, 1000);
    await seedStock(user2.userId, product.id, 1000);
  });

  describe('POST /api/sales', () => {
    it('creates a sale with generated number, totals and PENDENTE status', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(
          salePayload({
            shippingValue: 15,
            additionalValue: 5,
            description: 'Venda de teste',
          }),
        );

      expect(res.status).toBe(201);
      expect(res.body.orderType).toBe('VENDA');
      expect(res.body.orderNumber).toMatch(/^V-\d{4}$/);
      expect(parseFloat(res.body.totalValue)).toBe(220);
      expect(parseFloat(res.body.shippingValue)).toBe(15);
      expect(parseFloat(res.body.additionalValue)).toBe(5);
      expect(res.body.orderNotes).toBe('Venda de teste');
      expect(res.body.status).toBe('PENDENTE');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].personId).toBe(client.id);
      expect(res.body.items[0].forStock).toBe(false);
      createdSaleIds.push(res.body.id);
    });

    it('increments the per-user counter and isolates numbers between users', async () => {
      const first = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const second = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const firstNum = Number(first.body.orderNumber.slice(2));
      const secondNum = Number(second.body.orderNumber.slice(2));
      expect(first.body.orderNumber).toMatch(/^V-\d{4}$/);
      expect(secondNum).toBe(firstNum + 1);
      createdSaleIds.push(first.body.id, second.body.id);

      const otherUser = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user2.token}`)
        .send({ ...salePayload(), clientPersonId: client.id });
      // user2 has no client with that id
      expect(otherUser.status).toBe(400);
      const otherClient = await createPerson(user2.userId, 'Cliente 2');
      const otherSale = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user2.token}`)
        .send({
          clientPersonId: otherClient.id,
          items: [{ productId: product.id, chargedValue: 10 }],
        });
      expect(otherSale.body.orderNumber).toBe('V-0001');
      await prisma.order
        .delete({ where: { id: otherSale.body.id } })
        .catch(() => {});
    });

    it('defaults shipping and additional to 0 when omitted', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      expect(res.status).toBe(201);
      expect(parseFloat(res.body.shippingValue)).toBe(0);
      expect(parseFloat(res.body.additionalValue)).toBe(0);
      expect(parseFloat(res.body.totalValue)).toBe(200);
      createdSaleIds.push(res.body.id);
    });

    it('rejects missing clientPersonId', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ items: [{ productId: product.id, chargedValue: 10 }] });
      expect(res.status).toBe(400);
    });

    it('rejects a self person as the client', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload({ clientPersonId: selfPerson.id }));
      expect(res.status).toBe(400);
    });

    it('rejects items without a catalog product', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          clientPersonId: client.id,
          items: [{ description: 'Sem produto', chargedValue: 10 }],
        });
      expect(res.status).toBe(400);
    });

    it('rejects an inactive product', async () => {
      const inactive = await createTestProduct(
        `INACT${Math.floor(Math.random() * 100000)}`,
        { status: 'INATIVO' },
      );
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          clientPersonId: client.id,
          items: [{ productId: inactive.id, chargedValue: 10 }],
        });
      expect(res.status).toBe(400);
    });

    it('rejects negative shipping and additional values', async () => {
      const negShipping = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload({ shippingValue: -1 }));
      expect(negShipping.status).toBe(400);
      const negAdditional = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload({ additionalValue: -1 }));
      expect(negAdditional.status).toBe(400);
    });

    it('rejects an empty items array', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ clientPersonId: client.id, items: [] });
      expect(res.status).toBe(400);
    });

    it('sets deliveredAt when provided and null otherwise', async () => {
      const withDelivery = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload({ deliveredAt: '2026-08-30' }));
      expect(withDelivery.status).toBe(201);
      const delivered = new Date(withDelivery.body.deliveredAt);
      expect(delivered.getFullYear()).toBe(2026);
      expect(delivered.getMonth()).toBe(7);
      expect(delivered.getDate()).toBe(30);
      createdSaleIds.push(withDelivery.body.id);

      const withoutDelivery = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      expect(withoutDelivery.status).toBe(201);
      expect(withoutDelivery.body.deliveredAt).toBeNull();
      createdSaleIds.push(withoutDelivery.body.id);
    });

    it('honors UNIT and TOTAL chargedValueMode in the total', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          clientPersonId: client.id,
          items: [
            { productId: product.id, chargedValue: 25, quantity: 2 },
            {
              productId: product.id,
              chargedValue: 40,
              quantity: 5,
              chargedValueMode: 'TOTAL',
            },
          ],
        });
      expect(res.status).toBe(201);
      expect(parseFloat(res.body.totalValue)).toBe(90);
      createdSaleIds.push(res.body.id);
    });
  });

  describe('GET /api/sales', () => {
    it('returns only sale orders (never purchase orders)', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      createdSaleIds.push(created.body.id);
      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          orderNumber: `COMPRA-${Date.now()}`,
          items: [
            { description: 'Compra', chargedValue: 10, personId: client.id },
          ],
        });
      const res = await request(app)
        .get('/api/sales')
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.every((s) => s.orderType === 'VENDA')).toBe(true);
    });

    it('searches by client name', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      createdSaleIds.push(created.body.id);
      const res = await request(app)
        .get(`/api/sales?q=${encodeURIComponent('Cliente da Venda')}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].items[0].person.name).toBe('Cliente da Venda');
    });

    it('searches by generated order number', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const res = await request(app)
        .get(`/api/sales?q=${created.body.orderNumber}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      expect(res.body.some((s) => s.id === created.body.id)).toBe(true);
      createdSaleIds.push(created.body.id);
    });

    it('searches by description', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload({ description: 'Venda única descrição' }));
      createdSaleIds.push(created.body.id);
      const res = await request(app)
        .get(`/api/sales?q=${encodeURIComponent('única descrição')}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].orderNotes).toBe('Venda única descrição');
    });

    it('filters by status and delivered flag', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload({ deliveredAt: '2026-08-30' }));
      createdSaleIds.push(created.body.id);
      const pendingRes = await request(app)
        .get('/api/sales?status=PENDENTE')
        .set('Authorization', `Bearer ${user.token}`);
      expect(pendingRes.body.length).toBeGreaterThan(0);
      const deliveredRes = await request(app)
        .get('/api/sales?delivered=true')
        .set('Authorization', `Bearer ${user.token}`);
      expect(deliveredRes.body.length).toBeGreaterThan(0);
      expect(deliveredRes.body.every((s) => s.deliveredAt !== null)).toBe(true);
      const notDeliveredRes = await request(app)
        .get('/api/sales?delivered=false')
        .set('Authorization', `Bearer ${user.token}`);
      expect(notDeliveredRes.body.every((s) => s.deliveredAt === null)).toBe(
        true,
      );
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/api/sales');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/sales/:id', () => {
    it('returns a sale with items and payments', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const res = await request(app)
        .get(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      expect(res.body.orderType).toBe('VENDA');
      expect(res.body.items).toHaveLength(1);
      createdSaleIds.push(created.body.id);
    });

    it('returns 404 for a purchase order', async () => {
      const order = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          orderNumber: `COMPRA-${Date.now()}`,
          items: [
            { description: 'Compra', chargedValue: 10, personId: client.id },
          ],
        });
      const res = await request(app)
        .get(`/api/sales/${order.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(404);
      await prisma.order
        .delete({ where: { id: order.body.id } })
        .catch(() => {});
    });

    it('returns 404 for another user sale', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const res = await request(app)
        .get(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user2.token}`);
      expect(res.status).toBe(404);
      createdSaleIds.push(created.body.id);
    });
  });

  describe('PUT /api/sales/:id', () => {
    it('updates scalar fields without items', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload({ shippingValue: 10, additionalValue: 2 }));
      const res = await request(app)
        .put(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ shippingValue: 20, additionalValue: 4, description: 'Nova' });
      expect(res.status).toBe(200);
      expect(parseFloat(res.body.totalValue)).toBe(224);
      expect(parseFloat(res.body.shippingValue)).toBe(20);
      expect(parseFloat(res.body.additionalValue)).toBe(4);
      expect(res.body.orderNotes).toBe('Nova');
      createdSaleIds.push(created.body.id);
    });

    it('updates deliveredAt and clears it with null', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const set = await request(app)
        .put(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ deliveredAt: '2026-08-31' });
      expect(set.body.deliveredAt).toBeDefined();
      const clear = await request(app)
        .put(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ deliveredAt: null });
      expect(clear.body.deliveredAt).toBeNull();
      createdSaleIds.push(created.body.id);
    });

    it('recomputes the total when items change', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const itemId = created.body.items[0].id;
      const res = await request(app)
        .put(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [
            {
              id: itemId,
              productId: product.id,
              chargedValue: 50,
              quantity: 3,
            },
          ],
        });
      expect(res.status).toBe(200);
      expect(parseFloat(res.body.totalValue)).toBe(150);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(3);
      createdSaleIds.push(created.body.id);
    });

    it('changes the client person', async () => {
      const other = await createPerson(user.userId, 'Outro Cliente');
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const res = await request(app)
        .put(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          clientPersonId: other.id,
          items: [{ productId: product.id, chargedValue: 10, quantity: 1 }],
        });
      expect(res.status).toBe(200);
      expect(res.body.items.every((i) => i.personId === other.id)).toBe(true);
      createdSaleIds.push(created.body.id);
    });

    it('rejects changing to a self person', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const res = await request(app)
        .put(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ clientPersonId: selfPerson.id });
      expect(res.status).toBe(400);
      createdSaleIds.push(created.body.id);
    });

    it('rejects a purchase order via the sales endpoint', async () => {
      const order = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          orderNumber: `COMPRA-${Date.now()}`,
          items: [
            { description: 'Compra', chargedValue: 10, personId: client.id },
          ],
        });
      const res = await request(app)
        .put(`/api/sales/${order.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ description: 'x' });
      expect(res.status).toBe(400);
      await prisma.order
        .delete({ where: { id: order.body.id } })
        .catch(() => {});
    });

    it('returns 404 for a nonexistent sale', async () => {
      const res = await request(app)
        .put(`/api/sales/${'00000000-0000-0000-0000-000000000000'}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ description: 'x' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/sales/:id', () => {
    it('deletes a sale order', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const res = await request(app)
        .delete(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      const gone = await prisma.order.findUnique({
        where: { id: created.body.id },
      });
      expect(gone).toBeNull();
    });

    it('rejects a purchase order', async () => {
      const order = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          orderNumber: `COMPRA-${Date.now()}`,
          items: [
            { description: 'Compra', chargedValue: 10, personId: client.id },
          ],
        });
      const res = await request(app)
        .delete(`/api/sales/${order.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(400);
      await prisma.order
        .delete({ where: { id: order.body.id } })
        .catch(() => {});
    });
  });

  describe('Type guards on purchase endpoints', () => {
    it('excludes sales from GET /api/orders', async () => {
      await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.body.every((o) => o.orderType === 'COMPRA')).toBe(true);
    });

    it('rejects updating a sale through /api/orders', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const res = await request(app)
        .put(`/api/orders/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ orderNotes: 'x' });
      expect(res.status).toBe(400);
      createdSaleIds.push(created.body.id);
    });

    it('rejects deleting a sale through /api/orders', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const res = await request(app)
        .delete(`/api/orders/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(400);
      createdSaleIds.push(created.body.id);
    });

    it('rejects adding an item to a sale through /api/orders', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const res = await request(app)
        .post(`/api/orders/${created.body.id}/items`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ description: 'x', chargedValue: 1, personId: client.id });
      expect(res.status).toBe(400);
      createdSaleIds.push(created.body.id);
    });

    it('rejects updating a sale item through /api/orders/items', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const itemId = created.body.items[0].id;
      const res = await request(app)
        .put(`/api/orders/items/${itemId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ quantity: 5 });
      expect(res.status).toBe(400);
      createdSaleIds.push(created.body.id);
    });

    it('rejects deleting a sale item through /api/orders/items', async () => {
      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send(salePayload());
      const itemId = created.body.items[0].id;
      const res = await request(app)
        .delete(`/api/orders/items/${itemId}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(400);
      createdSaleIds.push(created.body.id);
    });
  });
});

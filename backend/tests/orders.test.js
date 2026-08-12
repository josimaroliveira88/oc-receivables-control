const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

function uniqueOrderNumber(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

describe('Orders CRUD with Items', () => {
  let authToken;
  let userId;
  let createdOrderId;
  let testPersonId;

  beforeAll(async () => {
    await prisma.$connect();
    const username = `orders_test_${Date.now()}`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'testpass123' });
    userId = regRes.body.id;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'testpass123' });
    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (createdOrderId) {
      await prisma.order.delete({ where: { id: createdOrderId } }).catch(() => {});
      createdOrderId = null;
    }
    if (testPersonId) {
      await prisma.person.delete({ where: { id: testPersonId } }).catch(() => {});
      testPersonId = null;
    }
  });

  describe('POST /api/orders', () => {
    beforeEach(async () => {
      const person = await prisma.person.create({
        data: { name: 'Test Person for Order', whatsapp: 'person@test.com', userId },
      });
      testPersonId = person.id;
    });

    it('should create a new order with items', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [
            { description: 'Item 1', chargedValue: 100.00, personId: testPersonId },
            { description: 'Item 2', chargedValue: 200.00, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.orderNumber).toBeDefined();
      expect(parseFloat(response.body.totalValue)).toBe(300.00);
      expect(response.body.status).toBe('PENDENTE');
      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0].description).toBe('Item 1');
      createdOrderId = response.body.id;
    });

    it('should create an order with single item', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [
            { description: 'Single Item', chargedValue: 500.00, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(201);
      expect(parseFloat(response.body.totalValue)).toBe(500.00);
      expect(response.body.items).toHaveLength(1);
      createdOrderId = response.body.id;
    });

    it('should reject order with missing orderNumber', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{ description: 'Item', chargedValue: 100, personId: testPersonId }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject order with invalid item value (negative)', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [{ description: 'Item', chargedValue: -100, personId: testPersonId }],
        });

      expect(response.status).toBe(400);
    });

    it('should allow order with zero charged value (free item / gift)', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-GIFT'),
          items: [{ description: 'Brinde', chargedValue: 0, personId: testPersonId }],
        });

      expect(response.status).toBe(201);
      expect(parseFloat(response.body.items[0].chargedValue)).toBe(0);
      expect(parseFloat(response.body.totalValue)).toBe(0);
      createdOrderId = response.body.id;
    });

    it('should default missing chargedValue to zero', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-NOVAL'),
          items: [{ description: 'Item sem valor', personId: testPersonId }],
        });

      expect(response.status).toBe(201);
      expect(parseFloat(response.body.items[0].chargedValue)).toBe(0);
      expect(parseFloat(response.body.totalValue)).toBe(0);
      createdOrderId = response.body.id;
    });

    it('should create item without description (product provides the name)', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [{ chargedValue: 100, personId: testPersonId }],
        });

      expect(response.status).toBe(201);
      expect(response.body.items[0].description).toBeNull();
      createdOrderId = response.body.id;
    });

    it('should reject order with non-existent personId', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [{ description: 'Item', chargedValue: 100, personId: '00000000-0000-0000-0000-000000000000' }],
        });

      expect(response.status).toBe(400);
    });

    it('should create an order with custom orderDate', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          orderDate: '2026-05-15',
          items: [
            { description: 'Item 1', chargedValue: 100.00, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.orderDate).toBeDefined();
      const returnedDate = new Date(response.body.orderDate);
      expect(returnedDate.getFullYear()).toBe(2026);
      expect(returnedDate.getMonth()).toBe(4);
      expect(returnedDate.getDate()).toBe(15);
      createdOrderId = response.body.id;
    });

    it('should create an order without orderDate (defaults to now)', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [
            { description: 'Item 1', chargedValue: 100.00, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.orderDate).toBeDefined();
      const returnedDate = new Date(response.body.orderDate);
      const now = new Date();
      expect(returnedDate.getFullYear()).toBe(now.getFullYear());
      expect(returnedDate.getMonth()).toBe(now.getMonth());
      expect(returnedDate.getDate()).toBe(now.getDate());
      createdOrderId = response.body.id;
    });

    it('should return 401 when no authentication token is provided', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [{ description: 'Item', chargedValue: 100, personId: testPersonId }],
        });

      expect(response.status).toBe(401);
    });

    it('should return 403 when invalid token is provided', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [{ description: 'Item', chargedValue: 100, personId: testPersonId }],
        });

      expect(response.status).toBe(403);
    });
  });

    describe('GET /api/orders', () => {
      beforeEach(async () => {
        const person = await prisma.person.create({
          data: { name: 'Test Person', whatsapp: 'test@test.com', userId },
        });
        testPersonId = person.id;

        const order = await prisma.order.create({
          data: {
            orderNumber: `ORD-TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            totalValue: 150.00,
            status: 'PENDENTE',
            userId,
            items: {
              create: [
                { description: 'Test Item', chargedValue: 150.00, personId: testPersonId },
              ],
            },
          },
          include: { items: true },
        });
        createdOrderId = order.id;
      });

    it('should return all orders with items', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return a single order with items by ID', async () => {
      const response = await request(app)
        .get(`/api/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(createdOrderId);
      expect(response.body.items).toBeDefined();
      expect(response.body.items).toHaveLength(1);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .get('/api/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 401 when no authentication token is provided', async () => {
      const response = await request(app).get('/api/orders');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/orders/:id', () => {
    beforeEach(async () => {
      const person = await prisma.person.create({
        data: { name: 'Test Person', whatsapp: 'test@test.com', userId },
      });
      testPersonId = person.id;

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-PUT'),
          totalValue: 100.00,
          status: 'PENDENTE',
          userId,
          items: {
            create: [
              { description: 'Original Item', chargedValue: 100.00, personId: testPersonId },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderId = order.id;
    });

    it('should update order with new items (replacing all)', async () => {
      const response = await request(app)
        .put(`/api/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: 'ORD-UPDATED',
          items: [
            { description: 'New Item 1', chargedValue: 200.00, personId: testPersonId },
            { description: 'New Item 2', chargedValue: 300.00, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.orderNumber).toBe('ORD-UPDATED');
      expect(parseFloat(response.body.totalValue)).toBe(500.00);
      expect(response.body.items).toHaveLength(2);
    });

    it('should update order without changing items', async () => {
      const response = await request(app)
        .put(`/api/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ orderNumber: 'ORD-UPDATED-ONLY-NUMBER' });

      expect(response.status).toBe(200);
      expect(response.body.orderNumber).toBe('ORD-UPDATED-ONLY-NUMBER');
      expect(response.body.items).toHaveLength(1);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .put('/api/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ orderNumber: 'ORD-NOT-FOUND' });

      expect(response.status).toBe(404);
    });

    it('should reject update with invalid item values', async () => {
      const response = await request(app)
        .put(`/api/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: 'ORD-INVALID',
          items: [{ description: 'Item', chargedValue: -50, personId: testPersonId }],
        });

      expect(response.status).toBe(400);
    });

    it('should update order with new orderDate', async () => {
      const response = await request(app)
        .put(`/api/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ orderDate: '2026-01-20' });

      expect(response.status).toBe(200);
      const returnedDate = new Date(response.body.orderDate);
      expect(returnedDate.getFullYear()).toBe(2026);
      expect(returnedDate.getMonth()).toBe(0);
      expect(returnedDate.getDate()).toBe(20);
    });
  });

  describe('DELETE /api/orders/:id', () => {
    beforeEach(async () => {
      const person = await prisma.person.create({
        data: { name: 'Test Person', whatsapp: 'test@test.com', userId },
      });
      testPersonId = person.id;

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-DEL'),
          totalValue: 100.00,
          status: 'PENDENTE',
          userId,
          items: {
            create: [
              { description: 'Item to Delete', chargedValue: 100.00, personId: testPersonId },
            ],
          },
        },
      });
      createdOrderId = order.id;
    });

    it('should delete an order and its items (cascade)', async () => {
      const response = await request(app)
        .delete(`/api/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Order deleted successfully');

      const getResponse = await request(app)
        .get(`/api/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(getResponse.status).toBe(404);
      createdOrderId = null;
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .delete('/api/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Items CRUD', () => {
    let createdItemId;

    beforeEach(async () => {
      const person = await prisma.person.create({
        data: { name: 'Test Person', whatsapp: 'test@test.com', userId },
      });
      testPersonId = person.id;

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-ITEM'),
          totalValue: 100.00,
          status: 'PENDENTE',
          userId,
          items: {
            create: [
              { description: 'Original Item', chargedValue: 100.00, personId: testPersonId },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderId = order.id;
      createdItemId = order.items[0].id;
    });

    afterEach(async () => {
      if (createdItemId) {
        await prisma.item.delete({ where: { id: createdItemId } }).catch(() => {});
      }
    });

    it('should add an item to an existing order', async () => {
      const response = await request(app)
        .post(`/api/orders/${createdOrderId}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'New Item',
          chargedValue: 50.00,
          personId: testPersonId,
        });

      expect(response.status).toBe(201);
      expect(response.body.description).toBe('New Item');
      expect(parseFloat(response.body.chargedValue)).toBe(50.00);
      expect(response.body.orderId).toBe(createdOrderId);

      const orderResponse = await request(app)
        .get(`/api/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(parseFloat(orderResponse.body.totalValue)).toBe(150.00);
    });

    it('should update an item', async () => {
      const response = await request(app)
        .put(`/api/orders/items/${createdItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated Item',
          chargedValue: 200.00,
        });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('Updated Item');
      expect(parseFloat(response.body.chargedValue)).toBe(200.00);
    });

    it('should delete an item from an order', async () => {
      const response = await request(app)
        .delete(`/api/orders/items/${createdItemId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Item deleted successfully');

      const orderResponse = await request(app)
        .get(`/api/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(orderResponse.body.items).toHaveLength(0);
      createdItemId = null;
    });

    it('should reject adding item with non-existent order', async () => {
      const response = await request(app)
        .post('/api/orders/00000000-0000-0000-0000-000000000000/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Orphan Item',
          chargedValue: 50.00,
          personId: testPersonId,
        });

      expect(response.status).toBe(404);
    });

    it('should reject item with negative value', async () => {
      const response = await request(app)
        .post(`/api/orders/${createdOrderId}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Negative Item',
          chargedValue: -100,
          personId: testPersonId,
        });

      expect(response.status).toBe(400);
    });

    it('should reject adding item to another user\'s order', async () => {
      const otherUser = `other_items_${Date.now()}`;
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({ username: otherUser, password: 'testpass123' });
      const otherUserId = regRes.body.id;

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: otherUser, password: 'testpass123' });
      const otherToken = loginRes.body.token;

      const response = await request(app)
        .post(`/api/orders/${createdOrderId}/items`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          description: 'Sneaky Item',
          chargedValue: 10.00,
          personId: testPersonId,
        });

      expect(response.status).toBe(404);

      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    });
  });

  describe('Enhanced item fields (product, snapshot, details)', () => {
    let testProductId;

    beforeEach(async () => {
      const person = await prisma.person.create({
        data: { name: 'Test Person Enhanced', whatsapp: 'enhanced@test.com', userId },
      });
      testPersonId = person.id;

      const productCode = `TESTITEM-${Date.now()}`;
      const product = await prisma.product.create({
        data: {
          code: productCode,
          name: 'Test Enhanced Product',
          size: '1',
          prices: {
            create: {
              regularPrice: 300.00,
              memberPrice: 231.25,
              pv: 31,
            },
          },
        },
      });
      testProductId = product.id;
    });

    afterEach(async () => {
      if (testProductId) {
        await prisma.product.delete({ where: { id: testProductId } }).catch(() => {});
        testProductId = null;
      }
    });

    it('should create order with product, snapshot fields and details', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-ENH'),
          items: [
            {
              description: 'Adaptiv Pastilhas',
              chargedValue: 231.25,
              personId: testPersonId,
              productId: testProductId,
              memberPrice: 231.25,
              pv: 31,
              details: 'Cliente pediu 2 unid.',
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.items).toHaveLength(1);
      const item = response.body.items[0];
      expect(item.productId).toBe(testProductId);
      expect(parseFloat(item.chargedValue)).toBe(231.25);
      expect(parseFloat(item.memberPrice)).toBe(231.25);
      expect(parseFloat(item.pv)).toBe(31);
      expect(item.details).toBe('Cliente pediu 2 unid.');
      expect(parseFloat(response.body.totalValue)).toBe(231.25);
      createdOrderId = response.body.id;
    });

    it('should allow item without productId (standalone)', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-STANDALONE'),
          items: [
            {
              description: 'Frete',
              chargedValue: 15.00,
              personId: testPersonId,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.items[0].productId).toBeNull();
      expect(parseFloat(response.body.totalValue)).toBe(15.00);
      createdOrderId = response.body.id;
    });

    it('should reject order with non-existent productId', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-BADPROD'),
          items: [
            {
              description: 'Item',
              chargedValue: 50.00,
              personId: testPersonId,
              productId: '00000000-0000-0000-0000-000000000000',
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('One or more products not found');
    });

    it('should reject order with inactive productId', async () => {
      await prisma.product.update({
        where: { id: testProductId },
        data: { active: false },
      });

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-INACTIVE'),
          items: [
            {
              description: 'Item',
              chargedValue: 50.00,
              personId: testPersonId,
              productId: testProductId,
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('One or more products not found');
    });

    it('should reject item with details longer than 500 characters', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-LONG'),
          items: [
            {
              description: 'Item',
              chargedValue: 50.00,
              personId: testPersonId,
              details: 'x'.repeat(501),
            },
          ],
        });

      expect(response.status).toBe(400);
    });

    it('should update item selling productId, snapshot and details', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-UPD-ENH'),
          totalValue: 100.00,
          status: 'PENDENTE',
          userId,
          items: {
            create: [
              {
                description: 'Original',
                chargedValue: 100.00,
                personId: testPersonId,
              },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderId = order.id;
      const itemId = order.items[0].id;

      const response = await request(app)
        .put(`/api/orders/items/${itemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId,
          memberPrice: 231.25,
          pv: 31,
          details: 'Atualizado com produto',
        });

      expect(response.status).toBe(200);
      expect(response.body.productId).toBe(testProductId);
      expect(parseFloat(response.body.memberPrice)).toBe(231.25);
      expect(parseFloat(response.body.pv)).toBe(31);
      expect(response.body.details).toBe('Atualizado com produto');
    });
  });

  describe('Order descriptive fields (account owner, payment type, notes)', () => {
    beforeEach(async () => {
      const person = await prisma.person.create({
        data: { name: 'Test Person Desc', whatsapp: 'desc@test.com', userId },
      });
      testPersonId = person.id;
    });

    it('should create order with payment type and descriptive fields', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-DESC'),
          orderDate: '2026-07-20',
          accountOwner: '6254862 - Ana Silva',
          paymentType: 'PIX',
          orderNotes: 'Pedido de promoção de março',
          items: [
            { description: 'Item', chargedValue: 100.00, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.accountOwner).toBe('6254862 - Ana Silva');
      expect(response.body.paymentType).toBe('PIX');
      expect(response.body.orderNotes).toBe('Pedido de promoção de março');
      expect(parseFloat(response.body.totalValue)).toBe(100.00);
      createdOrderId = response.body.id;
    });

    it('should create order without payment type (nullable)', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-NOPGTO'),
          items: [
            { description: 'Item', chargedValue: 50.00, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.paymentType).toBeNull();
      expect(response.body.accountOwner).toBeNull();
      expect(response.body.orderNotes).toBeNull();
      createdOrderId = response.body.id;
    });

    it('should accept each valid payment type', async () => {
      for (const paymentType of ['PIX', 'BOLETO', 'CARTAO_CREDITO']) {
        const response = await request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            orderNumber: uniqueOrderNumber('ORD-PGTO'),
            paymentType,
            items: [
              { description: 'Item', chargedValue: 50.00, personId: testPersonId },
            ],
          });
        expect(response.status).toBe(201);
        expect(response.body.paymentType).toBe(paymentType);
        createdOrderId = response.body.id;
      }
    });

    it('should reject order with invalid payment type', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-BADPGTO'),
          paymentType: 'DINHEIRO',
          items: [
            { description: 'Item', chargedValue: 50.00, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(400);
      expect(Array.isArray(response.body.error)).toBe(true);
      expect(response.body.error[0].path).toEqual(['paymentType']);
    });

    it('should reject order with accountOwner longer than 120 characters', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-LONGOWN'),
          accountOwner: 'x'.repeat(121),
          items: [
            { description: 'Item', chargedValue: 50.00, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error[0].path).toEqual(['accountOwner']);
    });

    it('should reject order with orderNotes longer than 500 characters', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-LONGNOTES'),
          orderNotes: 'y'.repeat(501),
          items: [
            { description: 'Item', chargedValue: 50.00, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error[0].path).toEqual(['orderNotes']);
    });

    it('should update order descriptive fields', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-UPD-DESC'),
          totalValue: 100.00,
          status: 'PENDENTE',
          userId,
          items: {
            create: [
              { description: 'Item', chargedValue: 100.00, personId: testPersonId },
            ],
          },
        },
      });
      createdOrderId = order.id;

      const response = await request(app)
        .put(`/api/orders/${order.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          accountOwner: 'João Pereira',
          paymentType: 'BOLETO',
          orderNotes: 'Encomenda para revenda',
        });

      expect(response.status).toBe(200);
      expect(response.body.accountOwner).toBe('João Pereira');
      expect(response.body.paymentType).toBe('BOLETO');
      expect(response.body.orderNotes).toBe('Encomenda para revenda');
      expect(parseFloat(response.body.totalValue)).toBe(100.00);
    });

    it('should update order clearing payment type with explicit null', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-CLEAR-PGTO'),
          totalValue: 100.00,
          status: 'PENDENTE',
          paymentType: 'PIX',
          userId,
          items: {
            create: [
              { description: 'Item', chargedValue: 100.00, personId: testPersonId },
            ],
          },
        },
      });
      createdOrderId = order.id;

      const response = await request(app)
        .put(`/api/orders/${order.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ paymentType: null });

      expect(response.status).toBe(200);
      expect(response.body.paymentType).toBeNull();
    });

    it('should update order items preserving descriptive fields', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-UPD-ITEMS-DESC'),
          totalValue: 100.00,
          status: 'PENDENTE',
          accountOwner: 'Maria',
          paymentType: 'CARTAO_CREDITO',
          orderNotes: 'Original',
          userId,
          items: {
            create: [
              { description: 'Item 1', chargedValue: 100.00, personId: testPersonId },
            ],
          },
        },
      });
      createdOrderId = order.id;

      const response = await request(app)
        .put(`/api/orders/${order.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            { description: 'Item 1', chargedValue: 60.00, personId: testPersonId },
            { description: 'Item 2', chargedValue: 40.00, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(2);
      expect(response.body.accountOwner).toBe('Maria');
      expect(response.body.paymentType).toBe('CARTAO_CREDITO');
      expect(response.body.orderNotes).toBe('Original');
      expect(parseFloat(response.body.totalValue)).toBe(100.00);
    });
  });
});

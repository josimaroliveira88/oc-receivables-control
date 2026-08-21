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
      await prisma.order
        .delete({ where: { id: createdOrderId } })
        .catch(() => {});
      createdOrderId = null;
    }
    if (testPersonId) {
      await prisma.person
        .delete({ where: { id: testPersonId } })
        .catch(() => {});
      testPersonId = null;
    }
  });

  describe('POST /api/orders', () => {
    beforeEach(async () => {
      const person = await prisma.person.create({
        data: {
          name: 'Test Person for Order',
          whatsapp: 'person@test.com',
          userId,
        },
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
            {
              description: 'Item 1',
              chargedValue: 100.0,
              personId: testPersonId,
            },
            {
              description: 'Item 2',
              chargedValue: 200.0,
              personId: testPersonId,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.orderNumber).toBeDefined();
      expect(parseFloat(response.body.totalValue)).toBe(300.0);
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
            {
              description: 'Single Item',
              chargedValue: 500.0,
              personId: testPersonId,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(parseFloat(response.body.totalValue)).toBe(500.0);
      expect(response.body.items).toHaveLength(1);
      createdOrderId = response.body.id;
    });

    it('should reject order with missing orderNumber', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            { description: 'Item', chargedValue: 100, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(400);
    });

    it('should reject order with invalid item value (negative)', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [
            { description: 'Item', chargedValue: -100, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(400);
    });

    it('should allow order with zero charged value (free item / gift)', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-GIFT'),
          items: [
            { description: 'Brinde', chargedValue: 0, personId: testPersonId },
          ],
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
          items: [
            {
              description: 'Item',
              chargedValue: 100,
              personId: '00000000-0000-0000-0000-000000000000',
            },
          ],
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
            {
              description: 'Item 1',
              chargedValue: 100.0,
              personId: testPersonId,
            },
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
            {
              description: 'Item 1',
              chargedValue: 100.0,
              personId: testPersonId,
            },
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
          items: [
            { description: 'Item', chargedValue: 100, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(401);
    });

    it('should return 403 when invalid token is provided', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [
            { description: 'Item', chargedValue: 100, personId: testPersonId },
          ],
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
          totalValue: 150.0,
          status: 'PENDENTE',
          userId,
          items: {
            create: [
              {
                description: 'Test Item',
                chargedValue: 150.0,
                personId: testPersonId,
              },
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
          totalValue: 100.0,
          status: 'PENDENTE',
          userId,
          items: {
            create: [
              {
                description: 'Original Item',
                chargedValue: 100.0,
                personId: testPersonId,
              },
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
            {
              description: 'New Item 1',
              chargedValue: 200.0,
              personId: testPersonId,
            },
            {
              description: 'New Item 2',
              chargedValue: 300.0,
              personId: testPersonId,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.orderNumber).toBe('ORD-UPDATED');
      expect(parseFloat(response.body.totalValue)).toBe(500.0);
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
          items: [
            { description: 'Item', chargedValue: -50, personId: testPersonId },
          ],
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
          totalValue: 100.0,
          status: 'PENDENTE',
          userId,
          items: {
            create: [
              {
                description: 'Item to Delete',
                chargedValue: 100.0,
                personId: testPersonId,
              },
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
          totalValue: 100.0,
          status: 'PENDENTE',
          userId,
          items: {
            create: [
              {
                description: 'Original Item',
                chargedValue: 100.0,
                personId: testPersonId,
              },
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
        await prisma.item
          .delete({ where: { id: createdItemId } })
          .catch(() => {});
      }
    });

    it('should add an item to an existing order', async () => {
      const response = await request(app)
        .post(`/api/orders/${createdOrderId}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'New Item',
          chargedValue: 50.0,
          personId: testPersonId,
        });

      expect(response.status).toBe(201);
      expect(response.body.description).toBe('New Item');
      expect(parseFloat(response.body.chargedValue)).toBe(50.0);
      expect(response.body.orderId).toBe(createdOrderId);

      const orderResponse = await request(app)
        .get(`/api/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(parseFloat(orderResponse.body.totalValue)).toBe(150.0);
    });

    it('should update an item', async () => {
      const response = await request(app)
        .put(`/api/orders/items/${createdItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated Item',
          chargedValue: 200.0,
        });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('Updated Item');
      expect(parseFloat(response.body.chargedValue)).toBe(200.0);
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
          chargedValue: 50.0,
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

    it("should reject adding item to another user's order", async () => {
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
          chargedValue: 10.0,
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
        data: {
          name: 'Test Person Enhanced',
          whatsapp: 'enhanced@test.com',
          userId,
        },
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
              regularPrice: 300.0,
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
        await prisma.product
          .delete({ where: { id: testProductId } })
          .catch(() => {});
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
              chargedValue: 15.0,
              personId: testPersonId,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.items[0].productId).toBeNull();
      expect(parseFloat(response.body.totalValue)).toBe(15.0);
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
              chargedValue: 50.0,
              personId: testPersonId,
              productId: '00000000-0000-0000-0000-000000000000',
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'One or more products are inactive or do not exist',
      );
    });

    it('should reject order with inactive productId', async () => {
      await prisma.product.update({
        where: { id: testProductId },
        data: { status: 'INATIVO' },
      });

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-INACTIVE'),
          items: [
            {
              description: 'Item',
              chargedValue: 50.0,
              personId: testPersonId,
              productId: testProductId,
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        'One or more products are inactive or do not exist',
      );
    });

    it('should accept order with an INDISPONIVEL productId', async () => {
      await prisma.product.update({
        where: { id: testProductId },
        data: { status: 'INDISPONIVEL' },
      });

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-INDISPONIVEL'),
          items: [
            {
              description: 'Item',
              chargedValue: 50.0,
              personId: testPersonId,
              productId: testProductId,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.items[0].productId).toBe(testProductId);
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
              chargedValue: 50.0,
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
          totalValue: 100.0,
          status: 'PENDENTE',
          userId,
          items: {
            create: [
              {
                description: 'Original',
                chargedValue: 100.0,
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
            {
              description: 'Item',
              chargedValue: 100.0,
              personId: testPersonId,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.accountOwner).toBe('6254862 - Ana Silva');
      expect(response.body.paymentType).toBe('PIX');
      expect(response.body.orderNotes).toBe('Pedido de promoção de março');
      expect(parseFloat(response.body.totalValue)).toBe(100.0);
      createdOrderId = response.body.id;
    });

    it('should create order without payment type (nullable)', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-NOPGTO'),
          items: [
            { description: 'Item', chargedValue: 50.0, personId: testPersonId },
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
              {
                description: 'Item',
                chargedValue: 50.0,
                personId: testPersonId,
              },
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
            { description: 'Item', chargedValue: 50.0, personId: testPersonId },
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
            { description: 'Item', chargedValue: 50.0, personId: testPersonId },
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
            { description: 'Item', chargedValue: 50.0, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error[0].path).toEqual(['orderNotes']);
    });

    it('should update order descriptive fields', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-UPD-DESC'),
          totalValue: 100.0,
          status: 'PENDENTE',
          userId,
          items: {
            create: [
              {
                description: 'Item',
                chargedValue: 100.0,
                personId: testPersonId,
              },
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
      expect(parseFloat(response.body.totalValue)).toBe(100.0);
    });

    it('should update order clearing payment type with explicit null', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-CLEAR-PGTO'),
          totalValue: 100.0,
          status: 'PENDENTE',
          paymentType: 'PIX',
          userId,
          items: {
            create: [
              {
                description: 'Item',
                chargedValue: 100.0,
                personId: testPersonId,
              },
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
          totalValue: 100.0,
          status: 'PENDENTE',
          accountOwner: 'Maria',
          paymentType: 'CARTAO_CREDITO',
          orderNotes: 'Original',
          userId,
          items: {
            create: [
              {
                description: 'Item 1',
                chargedValue: 100.0,
                personId: testPersonId,
              },
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
            {
              description: 'Item 1',
              chargedValue: 60.0,
              personId: testPersonId,
            },
            {
              description: 'Item 2',
              chargedValue: 40.0,
              personId: testPersonId,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(2);
      expect(response.body.accountOwner).toBe('Maria');
      expect(response.body.paymentType).toBe('CARTAO_CREDITO');
      expect(response.body.orderNotes).toBe('Original');
      expect(parseFloat(response.body.totalValue)).toBe(100.0);
    });
  });

  describe('Orders with self person items', () => {
    let selfOrderIds = [];
    let selfPersonIds = [];

    afterEach(async () => {
      for (const oid of selfOrderIds) {
        await prisma.order.delete({ where: { id: oid } }).catch(() => {});
      }
      selfOrderIds = [];
      for (const pid of selfPersonIds) {
        await prisma.person.delete({ where: { id: pid } }).catch(() => {});
      }
      selfPersonIds = [];
    });

    const createSelfPerson = async (name) => {
      const person = await prisma.person.create({
        data: { name, isSelf: true, userId },
      });
      selfPersonIds.push(person.id);
      return person.id;
    };

    const createRegularPerson = async (name) => {
      const person = await prisma.person.create({
        data: { name, userId },
      });
      selfPersonIds.push(person.id);
      return person.id;
    };

    it('should create an order containing only self items as QUITADO', async () => {
      const selfId = await createSelfPerson('Eu Mesmo');

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-SELF'),
          items: [
            { description: 'Meu Item', chargedValue: 150.0, personId: selfId },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('QUITADO');
      expect(parseFloat(response.body.totalValue)).toBe(150.0);
      selfOrderIds.push(response.body.id);
    });

    it('should create an order with a self item and a regular person as PENDENTE', async () => {
      const selfId = await createSelfPerson('Eu');
      const otherId = await createRegularPerson('Cliente');

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-MIX'),
          items: [
            { description: 'Meu Item', chargedValue: 200.0, personId: selfId },
            {
              description: 'Item Cliente',
              chargedValue: 300.0,
              personId: otherId,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('PENDENTE');
      expect(parseFloat(response.body.totalValue)).toBe(500.0);
      selfOrderIds.push(response.body.id);
    });

    it('should recompute status to QUITADO when updating an order to only self items', async () => {
      const selfId = await createSelfPerson('Eu');
      const otherId = await createRegularPerson('Cliente');

      const created = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-EDIT'),
          items: [
            {
              description: 'Item Cliente',
              chargedValue: 100.0,
              personId: otherId,
            },
          ],
        });
      selfOrderIds.push(created.body.id);
      expect(created.body.status).toBe('PENDENTE');

      const updated = await request(app)
        .put(`/api/orders/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            { description: 'Meu Item', chargedValue: 100.0, personId: selfId },
          ],
        });

      expect(updated.status).toBe(200);
      expect(updated.body.status).toBe('QUITADO');
    });

    it('should recompute status to PENDENTE when updating an only-self order to include a regular person', async () => {
      const selfId = await createSelfPerson('Eu');
      const otherId = await createRegularPerson('Cliente');

      const created = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-EDIT2'),
          items: [
            { description: 'Meu Item', chargedValue: 100.0, personId: selfId },
          ],
        });
      selfOrderIds.push(created.body.id);
      expect(created.body.status).toBe('QUITADO');

      const updated = await request(app)
        .put(`/api/orders/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            { description: 'Meu Item', chargedValue: 100.0, personId: selfId },
            {
              description: 'Item Cliente',
              chargedValue: 50.0,
              personId: otherId,
            },
          ],
        });

      expect(updated.status).toBe(200);
      expect(updated.body.status).toBe('PENDENTE');
    });

    it('should recompute status to PENDENTE after removing the last self item from a QUITADO order', async () => {
      const selfId = await createSelfPerson('Eu');
      const otherId = await createRegularPerson('Cliente');

      const created = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-EDIT3'),
          items: [
            { description: 'Meu Item', chargedValue: 100.0, personId: selfId },
          ],
        });
      selfOrderIds.push(created.body.id);
      expect(created.body.status).toBe('QUITADO');

      const updated = await request(app)
        .put(`/api/orders/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              description: 'Item Cliente',
              chargedValue: 100.0,
              personId: otherId,
            },
          ],
        });

      expect(updated.status).toBe(200);
      expect(updated.body.status).toBe('PENDENTE');
    });
  });

  describe('GET /api/orders — search, filters and sorting', () => {
    let alphaOrderId;
    let betaOrderId;
    let searchPersonId;

    beforeEach(async () => {
      searchPersonId = (
        await prisma.person.create({
          data: { name: 'Search Person', userId },
        })
      ).id;

      const alpha = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: `ALFA-${Date.now()}`,
          accountOwner: 'Ana Silva',
          paymentType: 'PIX',
          orderNotes: 'Pedido alfa',
          items: [
            {
              description: 'Item A',
              chargedValue: 100.0,
              personId: searchPersonId,
            },
          ],
        });
      alphaOrderId = alpha.body.id;

      const beta = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: `BETA-${Date.now()}`,
          accountOwner: 'Bruno Costa',
          paymentType: 'BOLETO',
          orderNotes: 'Pedido beta',
          items: [
            {
              description: 'Item B',
              chargedValue: 300.0,
              personId: searchPersonId,
            },
          ],
        });
      betaOrderId = beta.body.id;
    });

    afterEach(async () => {
      await prisma.order
        .deleteMany({ where: { id: { in: [alphaOrderId, betaOrderId] } } })
        .catch(() => {});
      await prisma.person
        .delete({ where: { id: searchPersonId } })
        .catch(() => {});
    });

    it('should search by order number using searchField=orderNumber', async () => {
      const response = await request(app)
        .get(`/api/orders?q=ALFA&searchField=orderNumber`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((o) => o.id);
      expect(ids).toContain(alphaOrderId);
      expect(ids).not.toContain(betaOrderId);
    });

    it('should search by account owner using searchField=accountOwner', async () => {
      const response = await request(app)
        .get(`/api/orders?q=Ana&searchField=accountOwner`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((o) => o.id);
      expect(ids).toContain(alphaOrderId);
      expect(ids).not.toContain(betaOrderId);
    });

    it('should search by order notes using searchField=orderNotes', async () => {
      const response = await request(app)
        .get(`/api/orders?q=beta&searchField=orderNotes`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((o) => o.id);
      expect(ids).toContain(betaOrderId);
      expect(ids).not.toContain(alphaOrderId);
    });

    it('should search across all columns when searchField=all', async () => {
      const response = await request(app)
        .get(`/api/orders?q=Bruno&searchField=all`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((o) => o.id);
      expect(ids).toContain(betaOrderId);
      expect(ids).not.toContain(alphaOrderId);
    });

    it('should default to searching across all columns when searchField is omitted', async () => {
      const response = await request(app)
        .get(`/api/orders?q=alfa`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((o) => o.id);
      expect(ids).toContain(alphaOrderId);
      expect(ids).not.toContain(betaOrderId);
    });

    it('should filter by status=PENDENTE', async () => {
      const response = await request(app)
        .get(`/api/orders?status=PENDENTE`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.every((o) => o.status === 'PENDENTE')).toBe(true);
    });

    it('should filter by paymentType=PIX', async () => {
      const response = await request(app)
        .get(`/api/orders?paymentType=PIX`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((o) => o.id);
      expect(ids).toContain(alphaOrderId);
      expect(ids).not.toContain(betaOrderId);
    });

    it('should combine a filter with sorting by totalValue descending', async () => {
      const response = await request(app)
        .get(`/api/orders?paymentType=BOLETO&sortBy=totalValue&sortDir=desc`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((o) => o.id);
      expect(ids).toContain(betaOrderId);
      const values = response.body.map((o) => Number(o.totalValue));
      expect(values).toEqual([...values].sort((a, b) => b - a));
    });

    it('should sort by orderNumber ascending', async () => {
      const response = await request(app)
        .get(`/api/orders?sortBy=orderNumber&sortDir=asc`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const numbers = response.body
        .map((o) => o.orderNumber)
        .filter((n) => n.startsWith('ALFA-') || n.startsWith('BETA-'));
      const sorted = [...numbers].sort((a, b) => a.localeCompare(b));
      expect(numbers).toEqual(sorted);
    });

    it('should sort by pending value (computed) with a filter applied', async () => {
      const response = await request(app)
        .get(`/api/orders?sortBy=pendingValue&sortDir=desc`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((o) => o.id);
      expect(ids[0]).toBe(betaOrderId);
    });

    it('should keep user isolation when filtering', async () => {
      const otherReg = await request(app)
        .post('/api/auth/register')
        .send({
          username: `orders_other_${Date.now()}`,
          password: 'testpass123',
        });
      const otherLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: otherReg.body.username, password: 'testpass123' });
      const otherPerson = await prisma.person.create({
        data: { name: 'Other Person', userId: otherReg.body.id },
      });
      const otherOrder = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${otherLogin.body.token}`)
        .send({
          orderNumber: `OTHER-${Date.now()}`,
          items: [
            {
              description: 'Other Item',
              chargedValue: 50.0,
              personId: otherPerson.id,
            },
          ],
        });

      const response = await request(app)
        .get(`/api/orders?q=OTHER`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(
        response.body.find((o) => o.id === otherOrder.body.id),
      ).toBeUndefined();
    });

    it('should match an accented accountOwner when searching with an unaccented term', async () => {
      const accentedOwnerId = (
        await request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            orderNumber: `ACC-${Date.now()}`,
            accountOwner: 'Cássia',
            items: [
              {
                description: 'Item',
                chargedValue: 100.0,
                personId: searchPersonId,
              },
            ],
          })
      ).body.id;

      const response = await request(app)
        .get(`/api/orders?q=cassia&searchField=accountOwner`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((o) => o.id);
      expect(ids).toContain(accentedOwnerId);
    });

    it('should match an unaccented accountOwner when searching with an accented term', async () => {
      const plainOwnerId = (
        await request(app)
          .post('/api/orders')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            orderNumber: `PLAIN-${Date.now()}`,
            accountOwner: 'Cassia',
            items: [
              {
                description: 'Item',
                chargedValue: 100.0,
                personId: searchPersonId,
              },
            ],
          })
      ).body.id;

      const response = await request(app)
        .get(`/api/orders?q=C%C3%A1ssia&searchField=accountOwner`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((o) => o.id);
      expect(ids).toContain(plainOwnerId);
    });
  });
});

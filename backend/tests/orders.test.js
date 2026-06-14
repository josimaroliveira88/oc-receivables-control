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
        data: { name: 'Test Person for Order', contact: 'person@test.com', userId },
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
            { description: 'Item 1', value: 100.00, personId: testPersonId },
            { description: 'Item 2', value: 200.00, personId: testPersonId },
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
            { description: 'Single Item', value: 500.00, personId: testPersonId },
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
          items: [{ description: 'Item', value: 100, personId: testPersonId }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject order with invalid item value (negative)', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [{ description: 'Item', value: -100, personId: testPersonId }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject order with missing item description', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [{ value: 100, personId: testPersonId }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject order with non-existent personId', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [{ description: 'Item', value: 100, personId: '00000000-0000-0000-0000-000000000000' }],
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
            { description: 'Item 1', value: 100.00, personId: testPersonId },
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
            { description: 'Item 1', value: 100.00, personId: testPersonId },
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
          items: [{ description: 'Item', value: 100, personId: testPersonId }],
        });

      expect(response.status).toBe(401);
    });

    it('should return 403 when invalid token is provided', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          orderNumber: uniqueOrderNumber('ORD'),
          items: [{ description: 'Item', value: 100, personId: testPersonId }],
        });

      expect(response.status).toBe(403);
    });
  });

    describe('GET /api/orders', () => {
      beforeEach(async () => {
        const person = await prisma.person.create({
          data: { name: 'Test Person', contact: 'test@test.com', userId },
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
                { description: 'Test Item', value: 150.00, personId: testPersonId },
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
        data: { name: 'Test Person', contact: 'test@test.com', userId },
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
              { description: 'Original Item', value: 100.00, personId: testPersonId },
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
            { description: 'New Item 1', value: 200.00, personId: testPersonId },
            { description: 'New Item 2', value: 300.00, personId: testPersonId },
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
          items: [{ description: 'Item', value: -50, personId: testPersonId }],
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
        data: { name: 'Test Person', contact: 'test@test.com', userId },
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
              { description: 'Item to Delete', value: 100.00, personId: testPersonId },
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
        data: { name: 'Test Person', contact: 'test@test.com', userId },
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
              { description: 'Original Item', value: 100.00, personId: testPersonId },
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
          value: 50.00,
          personId: testPersonId,
        });

      expect(response.status).toBe(201);
      expect(response.body.description).toBe('New Item');
      expect(parseFloat(response.body.value)).toBe(50.00);
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
          value: 200.00,
        });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('Updated Item');
      expect(parseFloat(response.body.value)).toBe(200.00);
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
          value: 50.00,
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
          value: -100,
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
          value: 10.00,
          personId: testPersonId,
        });

      expect(response.status).toBe(404);

      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    });
  });
});

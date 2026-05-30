const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

describe('Orders CRUD with Items', () => {
  let createdOrderId;
  let testPersonId;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
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
        data: { name: 'Test Person for Order', contact: 'person@test.com' },
      });
      testPersonId = person.id;
    });

    it('should create a new order with items', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          orderNumber: 'ORD-001',
          items: [
            { description: 'Item 1', value: 100.00, personId: testPersonId },
            { description: 'Item 2', value: 200.00, personId: testPersonId },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.orderNumber).toBe('ORD-001');
      expect(parseFloat(response.body.totalValue)).toBe(300.00);
      expect(response.body.status).toBe('PENDENTE');
      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0].description).toBe('Item 1');
      createdOrderId = response.body.id;
    });

    it('should create an order with single item', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          orderNumber: 'ORD-002',
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
        .send({
          items: [{ description: 'Item', value: 100, personId: testPersonId }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject order with invalid item value (negative)', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          orderNumber: 'ORD-004',
          items: [{ description: 'Item', value: -100, personId: testPersonId }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject order with missing item description', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          orderNumber: 'ORD-005',
          items: [{ value: 100, personId: testPersonId }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject order with non-existent personId', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          orderNumber: 'ORD-006',
          items: [{ description: 'Item', value: 100, personId: '00000000-0000-0000-0000-000000000000' }],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/orders', () => {
    beforeEach(async () => {
      const person = await prisma.person.create({
        data: { name: 'Test Person', contact: 'test@test.com' },
      });
      testPersonId = person.id;

      const order = await prisma.order.create({
        data: {
          orderNumber: 'ORD-TEST-001',
          totalValue: 150.00,
          status: 'PENDENTE',
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
      const response = await request(app).get('/api/orders');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return a single order with items by ID', async () => {
      const response = await request(app).get(`/api/orders/${createdOrderId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(createdOrderId);
      expect(response.body.orderNumber).toBe('ORD-TEST-001');
      expect(response.body.items).toBeDefined();
      expect(response.body.items).toHaveLength(1);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app).get('/api/orders/00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/orders/:id', () => {
    beforeEach(async () => {
      const person = await prisma.person.create({
        data: { name: 'Test Person', contact: 'test@test.com' },
      });
      testPersonId = person.id;

      const order = await prisma.order.create({
        data: {
          orderNumber: 'ORD-TEST-002',
          totalValue: 100.00,
          status: 'PENDENTE',
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
        .send({ orderNumber: 'ORD-UPDATED-ONLY-NUMBER' });

      expect(response.status).toBe(200);
      expect(response.body.orderNumber).toBe('ORD-UPDATED-ONLY-NUMBER');
      expect(response.body.items).toHaveLength(1);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .put('/api/orders/00000000-0000-0000-0000-000000000000')
        .send({ orderNumber: 'ORD-NOT-FOUND' });

      expect(response.status).toBe(404);
    });

    it('should reject update with invalid item values', async () => {
      const response = await request(app)
        .put(`/api/orders/${createdOrderId}`)
        .send({
          orderNumber: 'ORD-INVALID',
          items: [{ description: 'Item', value: -50, personId: testPersonId }],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/orders/:id', () => {
    beforeEach(async () => {
      const person = await prisma.person.create({
        data: { name: 'Test Person', contact: 'test@test.com' },
      });
      testPersonId = person.id;

      const order = await prisma.order.create({
        data: {
          orderNumber: 'ORD-TO-DELETE',
          totalValue: 100.00,
          status: 'PENDENTE',
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
      const response = await request(app).delete(`/api/orders/${createdOrderId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Order deleted successfully');

      const getResponse = await request(app).get(`/api/orders/${createdOrderId}`);
      expect(getResponse.status).toBe(404);
      createdOrderId = null;
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app).delete('/api/orders/00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(404);
    });
  });

  describe('Items CRUD', () => {
    let createdItemId;

    beforeEach(async () => {
      const person = await prisma.person.create({
        data: { name: 'Test Person', contact: 'test@test.com' },
      });
      testPersonId = person.id;

      const order = await prisma.order.create({
        data: {
          orderNumber: 'ORD-ITEMS-TEST',
          totalValue: 100.00,
          status: 'PENDENTE',
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
        .send({
          description: 'New Item',
          value: 50.00,
          personId: testPersonId,
        });

      expect(response.status).toBe(201);
      expect(response.body.description).toBe('New Item');
      expect(parseFloat(response.body.value)).toBe(50.00);
      expect(response.body.orderId).toBe(createdOrderId);

      const orderResponse = await request(app).get(`/api/orders/${createdOrderId}`);
      expect(parseFloat(orderResponse.body.totalValue)).toBe(150.00);
    });

    it('should update an item', async () => {
      const response = await request(app)
        .put(`/api/orders/items/${createdItemId}`)
        .send({
          description: 'Updated Item',
          value: 200.00,
        });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('Updated Item');
      expect(parseFloat(response.body.value)).toBe(200.00);
    });

    it('should delete an item from an order', async () => {
      const response = await request(app).delete(`/api/orders/items/${createdItemId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Item deleted successfully');

      const orderResponse = await request(app).get(`/api/orders/${createdOrderId}`);
      expect(orderResponse.body.items).toHaveLength(0);
      createdItemId = null;
    });

    it('should reject adding item with non-existent order', async () => {
      const response = await request(app)
        .post('/api/orders/00000000-0000-0000-0000-000000000000/items')
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
        .send({
          description: 'Negative Item',
          value: -100,
          personId: testPersonId,
        });

      expect(response.status).toBe(400);
    });
  });
});

const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

function uniqueOrderNumber(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

describe('Payments & Balance', () => {
  let authToken;

  let createdOrderIds = [];
  let createdPersonIds = [];

  beforeAll(async () => {
    await prisma.$connect();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    authToken = loginRes.body.token;
    expect(authToken).toBeDefined();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    for (const id of createdOrderIds) {
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    createdOrderIds = [];

    for (const id of createdPersonIds) {
      await prisma.person.delete({ where: { id } }).catch(() => {});
    }
    createdPersonIds = [];
  });

  describe('POST /api/orders/:orderId/payments', () => {
    let testOrderId;
    let testPersonId;
    let testPerson2Id;

    beforeEach(async () => {
      const person1 = await prisma.person.create({
        data: { name: 'Payment Person 1', contact: 'pay1@test.com' },
      });
      testPersonId = person1.id;
      createdPersonIds.push(person1.id);

      const person2 = await prisma.person.create({
        data: { name: 'Payment Person 2', contact: 'pay2@test.com' },
      });
      testPerson2Id = person2.id;
      createdPersonIds.push(person2.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-PAY'),
          totalValue: 400.00,
          items: {
            create: [
              { description: 'Item for Person 1', value: 150.00, personId: testPersonId },
              { description: 'Item for Person 2', value: 250.00, personId: testPerson2Id },
            ],
          },
        },
        include: { items: true },
      });
      testOrderId = order.id;
      createdOrderIds.push(order.id);
    });

    it('should create a partial payment and update status to PARCIAL', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100.00, personId: testPersonId, notes: 'Partial payment' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Payment created successfully');
      expect(parseFloat(response.body.payment.amount)).toBe(100.00);
      expect(response.body.payment.personId).toBe(testPersonId);
      expect(response.body.payment.notes).toBe('Partial payment');
      expect(response.body.order.status).toBe('PARCIAL');
    });

    it('should create a full payment for a single-person order and update status to QUITADO', async () => {
      const person = await prisma.person.create({
        data: { name: 'Single Person', contact: 'single@test.com' },
      });
      createdPersonIds.push(person.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-SINGLE'),
          totalValue: 300.00,
          items: {
            create: [
              { description: 'Item for Single Person', value: 300.00, personId: person.id },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderIds.push(order.id);

      const response = await request(app)
        .post(`/api/orders/${order.id}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 300.00, personId: person.id });

      expect(response.status).toBe(201);
      expect(response.body.order.status).toBe('QUITADO');
    });

    it('should reject payment with amount exceeding pending balance', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 500.00, personId: testPersonId });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Amount exceeds pending balance');
    });

    it('should reject payment with zero amount (Zod validation)', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 0, personId: testPersonId });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject payment with negative amount (Zod validation)', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: -50, personId: testPersonId });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject payment with invalid personId format (Zod validation)', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100, personId: 'not-a-uuid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject payment for non-existent person', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100, personId: '00000000-0000-0000-0000-000000000000' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Person not found');
    });

    it('should reject payment for non-existent order', async () => {
      const response = await request(app)
        .post('/api/orders/00000000-0000-0000-0000-000000000000/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100, personId: testPersonId });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Order not found');
    });

    it('should return 401 when no authentication token is provided', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .send({ amount: 100, personId: testPersonId });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should return 403 when invalid authentication token is provided', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', 'Bearer invalid-token')
        .send({ amount: 100, personId: testPersonId });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should transition status from PENDENTE to PARCIAL after first partial payment', async () => {
      const orderBefore = await prisma.order.findUnique({ where: { id: testOrderId } });
      expect(orderBefore.status).toBe('PENDENTE');

      await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 150.00, personId: testPersonId });

      const orderAfter = await prisma.order.findUnique({ where: { id: testOrderId } });
      expect(orderAfter.status).toBe('PARCIAL');
    });

    it('should transition status from PARCIAL to QUITADO after full payment', async () => {
      await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 150, personId: testPersonId });

      let order = await prisma.order.findUnique({ where: { id: testOrderId } });
      expect(order.status).toBe('PARCIAL');

      await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 250, personId: testPerson2Id });

      order = await prisma.order.findUnique({ where: { id: testOrderId } });
      expect(order.status).toBe('QUITADO');
    });

    it('should accept payment with optional notes field', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100, personId: testPersonId, notes: 'Payment for materials' });

      expect(response.status).toBe(201);
      expect(response.body.payment.notes).toBe('Payment for materials');
    });

    it('should handle order with two persons where only one pays partially', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100, personId: testPersonId });

      expect(response.status).toBe(201);
      expect(response.body.order.status).toBe('PARCIAL');
    });

    it('should handle order with two persons where both are fully paid', async () => {
      await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 150, personId: testPersonId });

      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 250, personId: testPerson2Id });

      expect(response.status).toBe(201);
      expect(response.body.order.status).toBe('QUITADO');
    });
  });

  describe('GET /api/orders/:orderId/balance', () => {
    let balanceOrderId;
    let balancePersonId;
    let balancePerson2Id;

    beforeEach(async () => {
      const person1 = await prisma.person.create({
        data: { name: 'Balance Person 1', contact: 'bal1@test.com' },
      });
      balancePersonId = person1.id;
      createdPersonIds.push(person1.id);

      const person2 = await prisma.person.create({
        data: { name: 'Balance Person 2', contact: 'bal2@test.com' },
      });
      balancePerson2Id = person2.id;
      createdPersonIds.push(person2.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-BAL'),
          totalValue: 500.00,
          items: {
            create: [
              { description: 'Item 1', value: 300.00, personId: balancePersonId },
              { description: 'Item 2', value: 200.00, personId: balancePerson2Id },
            ],
          },
        },
        include: { items: true },
      });
      balanceOrderId = order.id;
      createdOrderIds.push(order.id);
    });

    it('should return correct balance breakdown for persons with no payments', async () => {
      const response = await request(app)
        .get(`/api/orders/${balanceOrderId}/balance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.balances).toHaveLength(2);

      const balance1 = response.body.balances.find(b => b.personId === balancePersonId);
      const balance2 = response.body.balances.find(b => b.personId === balancePerson2Id);

      expect(balance1).toBeDefined();
      expect(balance1.personName).toBe('Balance Person 1');
      expect(parseFloat(balance1.itemTotal)).toBe(300.00);
      expect(parseFloat(balance1.paymentTotal)).toBe(0);
      expect(parseFloat(balance1.pending)).toBe(300.00);

      expect(balance2).toBeDefined();
      expect(balance2.personName).toBe('Balance Person 2');
      expect(parseFloat(balance2.itemTotal)).toBe(200.00);
      expect(parseFloat(balance2.paymentTotal)).toBe(0);
      expect(parseFloat(balance2.pending)).toBe(200.00);
    });

    it('should return correct balance after partial payments', async () => {
      await prisma.payment.create({
        data: {
          amount: 100.00,
          orderId: balanceOrderId,
          personId: balancePersonId,
        },
      });

      const response = await request(app)
        .get(`/api/orders/${balanceOrderId}/balance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.balances).toHaveLength(2);

      const balance1 = response.body.balances.find(b => b.personId === balancePersonId);
      const balance2 = response.body.balances.find(b => b.personId === balancePerson2Id);

      expect(parseFloat(balance1.itemTotal)).toBe(300.00);
      expect(parseFloat(balance1.paymentTotal)).toBe(100.00);
      expect(parseFloat(balance1.pending)).toBe(200.00);

      expect(parseFloat(balance2.itemTotal)).toBe(200.00);
      expect(parseFloat(balance2.paymentTotal)).toBe(0);
      expect(parseFloat(balance2.pending)).toBe(200.00);
    });

    it('should return zero pending for fully paid order', async () => {
      await request(app)
        .post(`/api/orders/${balanceOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 300.00, personId: balancePersonId });

      await request(app)
        .post(`/api/orders/${balanceOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 200.00, personId: balancePerson2Id });

      const response = await request(app)
        .get(`/api/orders/${balanceOrderId}/balance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.balances).toHaveLength(2);

      const balance1 = response.body.balances.find(b => b.personId === balancePersonId);
      const balance2 = response.body.balances.find(b => b.personId === balancePerson2Id);

      expect(parseFloat(balance1.pending)).toBe(0);
      expect(parseFloat(balance2.pending)).toBe(0);
      expect(response.body.orderStatus).toBe('QUITADO');
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .get('/api/orders/00000000-0000-0000-0000-000000000000/balance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Order not found');
    });

    it('should return 401 when no authentication token is provided', async () => {
      const response = await request(app)
        .get(`/api/orders/${balanceOrderId}/balance`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should return 403 when invalid authentication token is provided', async () => {
      const response = await request(app)
        .get(`/api/orders/${balanceOrderId}/balance`)
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('Transactional consistency', () => {
    it('should update order status atomically within the payment transaction', async () => {
      const person = await prisma.person.create({
        data: { name: 'Transactional Test', contact: 'trans@test.com' },
      });
      createdPersonIds.push(person.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-TRANS'),
          totalValue: 100.00,
          items: {
            create: [
              { description: 'Test Item', value: 100.00, personId: person.id },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderIds.push(order.id);

      const currentOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(currentOrder.status).toBe('PENDENTE');

      const paymentRes = await request(app)
        .post(`/api/orders/${order.id}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100, personId: person.id });

      expect(paymentRes.status).toBe(201);
      expect(paymentRes.body.order.status).toBe('QUITADO');

      const balanceRes = await request(app)
        .get(`/api/orders/${order.id}/balance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(balanceRes.status).toBe(200);
      expect(balanceRes.body.orderStatus).toBe('QUITADO');
      expect(parseFloat(balanceRes.body.balances[0].pending)).toBe(0);
    });

    it('should not persist payment when validation fails inside transaction', async () => {
      const person = await prisma.person.create({
        data: { name: 'Rollback Test', contact: 'rollback@test.com' },
      });
      createdPersonIds.push(person.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-ROLLBACK'),
          totalValue: 50.00,
          items: {
            create: [
              { description: 'Cheap Item', value: 50.00, personId: person.id },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderIds.push(order.id);

      const overpaymentRes = await request(app)
        .post(`/api/orders/${order.id}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 200, personId: person.id });

      expect(overpaymentRes.status).toBe(400);

      const payments = await prisma.payment.findMany({
        where: { orderId: order.id },
      });
      expect(payments).toHaveLength(0);

      const orderAfter = await prisma.order.findUnique({ where: { id: order.id } });
      expect(orderAfter.status).toBe('PENDENTE');
    });
  });
});

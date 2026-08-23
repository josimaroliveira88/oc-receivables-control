const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

function uniqueOrderNumber(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

describe('Payments & Balance', () => {
  let authToken;
  let userId;

  let createdOrderIds = [];
  let createdPersonIds = [];

  beforeAll(async () => {
    await prisma.$connect();

    const username = `payments_test_${Date.now()}`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'testpass123' });
    userId = regRes.body.id;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'testpass123' });

    authToken = loginRes.body.token;
    expect(authToken).toBeDefined();
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
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
        data: { name: 'Payment Person 1', whatsapp: 'pay1@test.com', userId },
      });
      testPersonId = person1.id;
      createdPersonIds.push(person1.id);

      const person2 = await prisma.person.create({
        data: { name: 'Payment Person 2', whatsapp: 'pay2@test.com', userId },
      });
      testPerson2Id = person2.id;
      createdPersonIds.push(person2.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-PAY'),
          totalValue: 400.0,
          userId,
          items: {
            create: [
              {
                description: 'Item for Person 1',
                chargedValue: 150.0,
                personId: testPersonId,
              },
              {
                description: 'Item for Person 2',
                chargedValue: 250.0,
                personId: testPerson2Id,
              },
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
        .send({
          amount: 100.0,
          personId: testPersonId,
          notes: 'Partial payment',
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Payment created successfully');
      expect(parseFloat(response.body.payment.amount)).toBe(100.0);
      expect(response.body.payment.personId).toBe(testPersonId);
      expect(response.body.payment.notes).toBe('Partial payment');
      expect(response.body.order.status).toBe('PARCIAL');
    });

    it('should create a full payment for a single-person order and update status to QUITADO', async () => {
      const person = await prisma.person.create({
        data: { name: 'Single Person', whatsapp: 'single@test.com', userId },
      });
      createdPersonIds.push(person.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-SINGLE'),
          totalValue: 300.0,
          userId,
          items: {
            create: [
              {
                description: 'Item for Single Person',
                chargedValue: 300.0,
                personId: person.id,
              },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderIds.push(order.id);

      const response = await request(app)
        .post(`/api/orders/${order.id}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 300.0, personId: person.id });

      expect(response.status).toBe(201);
      expect(response.body.order.status).toBe('QUITADO');
    });

    it('should accept overpayment and mark single-person order as QUITADO', async () => {
      const person = await prisma.person.create({
        data: { name: 'Overpay Person', whatsapp: 'overpay@test.com', userId },
      });
      createdPersonIds.push(person.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-OVERPAY'),
          totalValue: 19.9,
          userId,
          items: {
            create: [
              {
                description: 'Produto negociado',
                chargedValue: 19.9,
                personId: person.id,
              },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderIds.push(order.id);

      const response = await request(app)
        .post(`/api/orders/${order.id}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 20.0, personId: person.id });

      expect(response.status).toBe(201);
      expect(response.body.order.status).toBe('QUITADO');

      const balanceRes = await request(app)
        .get(`/api/orders/${order.id}/balance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(balanceRes.status).toBe(200);
      const balance = balanceRes.body.balances.find(
        (b) => b.personId === person.id,
      );
      expect(parseFloat(balance.pending)).toBe(0);
      expect(parseFloat(balance.paymentTotal)).toBe(20.0);
    });

    it('should reject zero payment when the person has chargeable items', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 0, personId: testPersonId });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('greater than zero');
    });

    it('should accept overpayment for a multi-person order and keep status PARCIAL while others owe', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 500.0, personId: testPersonId });

      expect(response.status).toBe(201);
      expect(response.body.order.status).toBe('PARCIAL');

      const balanceRes = await request(app)
        .get(`/api/orders/${testOrderId}/balance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(balanceRes.status).toBe(200);
      const paidPerson = balanceRes.body.balances.find(
        (b) => b.personId === testPersonId,
      );
      const otherPerson = balanceRes.body.balances.find(
        (b) => b.personId === testPerson2Id,
      );
      expect(parseFloat(paidPerson.pending)).toBe(0);
      expect(parseFloat(otherPerson.pending)).toBe(250.0);
    });

    it('should accept zero amount payment for a zero-value item and mark order as QUITADO', async () => {
      const person = await prisma.person.create({
        data: { name: 'Freebie Person', whatsapp: 'freebie@test.com', userId },
      });
      createdPersonIds.push(person.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-FREE'),
          totalValue: 0.0,
          userId,
          items: {
            create: [
              { description: 'Brinde', chargedValue: 0.0, personId: person.id },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderIds.push(order.id);

      const response = await request(app)
        .post(`/api/orders/${order.id}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 0, personId: person.id });

      expect(response.status).toBe(201);
      expect(response.body.order.status).toBe('QUITADO');

      const balanceRes = await request(app)
        .get(`/api/orders/${order.id}/balance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(balanceRes.status).toBe(200);
      expect(parseFloat(balanceRes.body.balances[0].pending)).toBe(0);
    });

    it('should register zero payment for a zero-value person without affecting other persons', async () => {
      const zeroPerson = await prisma.person.create({
        data: { name: 'Zero Person', whatsapp: 'zero@test.com', userId },
      });
      createdPersonIds.push(zeroPerson.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-MIXED'),
          totalValue: 100.0,
          userId,
          items: {
            create: [
              {
                description: 'Brinde para Zero',
                chargedValue: 0.0,
                personId: zeroPerson.id,
              },
              {
                description: 'Item real',
                chargedValue: 100.0,
                personId: testPersonId,
              },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderIds.push(order.id);

      const zeroPayRes = await request(app)
        .post(`/api/orders/${order.id}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 0, personId: zeroPerson.id });

      expect(zeroPayRes.status).toBe(201);
      expect(zeroPayRes.body.order.status).toBe('PENDENTE');

      const balanceRes = await request(app)
        .get(`/api/orders/${order.id}/balance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(balanceRes.status).toBe(200);
      expect(balanceRes.body.orderStatus).toBe('PENDENTE');

      const zeroBalance = balanceRes.body.balances.find(
        (b) => b.personId === zeroPerson.id,
      );
      const realBalance = balanceRes.body.balances.find(
        (b) => b.personId === testPersonId,
      );
      expect(parseFloat(zeroBalance.pending)).toBe(0);
      expect(parseFloat(realBalance.pending)).toBe(100.0);
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
        .send({
          amount: 100,
          personId: '00000000-0000-0000-0000-000000000000',
        });

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
      const orderBefore = await prisma.order.findUnique({
        where: { id: testOrderId },
      });
      expect(orderBefore.status).toBe('PENDENTE');

      await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 150.0, personId: testPersonId });

      const orderAfter = await prisma.order.findUnique({
        where: { id: testOrderId },
      });
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
        .send({
          amount: 100,
          personId: testPersonId,
          notes: 'Payment for materials',
        });

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

    it('should create payment with custom paidAt date', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100.0, personId: testPersonId, paidAt: '2025-03-15' });

      expect(response.status).toBe(201);
      const paidAt = new Date(response.body.payment.paidAt);
      expect(paidAt.getFullYear()).toBe(2025);
      expect(paidAt.getMonth()).toBe(2);
      expect(paidAt.getDate()).toBe(15);
    });

    it('should create payment without paidAt and default to now', async () => {
      const before = new Date();
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 50.0, personId: testPersonId });

      expect(response.status).toBe(201);
      const paidAt = new Date(response.body.payment.paidAt);
      const after = new Date();
      expect(paidAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(paidAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should reject payment for another user's order", async () => {
      const otherUser = `other_pay_${Date.now()}`;
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({ username: otherUser, password: 'testpass123' });
      const otherUserId = regRes.body.id;

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: otherUser, password: 'testpass123' });
      const otherToken = loginRes.body.token;

      const response = await request(app)
        .post(`/api/orders/${testOrderId}/payments`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ amount: 50, personId: testPersonId });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Order not found');

      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    });
  });

  describe('PUT /api/payments/:id', () => {
    let editOrderId;
    let editPersonId;
    let editPerson2Id;

    const createPayment = async (orderId, amount, personId, extra = {}) => {
      const res = await request(app)
        .post(`/api/orders/${orderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount, personId, ...extra });
      expect(res.status).toBe(201);
      return res.body.payment;
    };

    beforeEach(async () => {
      const person1 = await prisma.person.create({
        data: { name: 'Edit Person 1', whatsapp: 'edit1@test.com', userId },
      });
      editPersonId = person1.id;
      createdPersonIds.push(person1.id);

      const person2 = await prisma.person.create({
        data: { name: 'Edit Person 2', whatsapp: 'edit2@test.com', userId },
      });
      editPerson2Id = person2.id;
      createdPersonIds.push(person2.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-EDIT'),
          totalValue: 400.0,
          userId,
          items: {
            create: [
              {
                description: 'Edit Item 1',
                chargedValue: 150.0,
                personId: editPersonId,
              },
              {
                description: 'Edit Item 2',
                chargedValue: 250.0,
                personId: editPerson2Id,
              },
            ],
          },
        },
        include: { items: true },
      });
      editOrderId = order.id;
      createdOrderIds.push(order.id);
    });

    it('should update amount, paidAt and notes of an existing payment', async () => {
      const payment = await createPayment(editOrderId, 100.0, editPersonId, {
        paidAt: '2025-01-10',
        notes: 'Primeira parcela',
      });

      const response = await request(app)
        .put(`/api/orders/payments/${payment.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 120.5,
          paidAt: '2025-03-15',
          notes: 'Parcela corrigida',
        });

      expect(response.status).toBe(200);
      expect(parseFloat(response.body.payment.amount)).toBe(120.5);
      expect(response.body.payment.notes).toBe('Parcela corrigida');
      expect(response.body.payment.personId).toBe(editPersonId);
      expect(response.body.payment.orderId).toBe(editOrderId);
      expect(response.body.payment.createdAt).toBe(payment.createdAt);

      const paidAt = new Date(response.body.payment.paidAt);
      expect(paidAt.getFullYear()).toBe(2025);
      expect(paidAt.getMonth()).toBe(2);
      expect(paidAt.getDate()).toBe(15);

      const updated = await prisma.payment.findUnique({
        where: { id: payment.id },
      });
      expect(parseFloat(updated.amount)).toBe(120.5);
      expect(updated.notes).toBe('Parcela corrigida');
    });

    it('should ignore an attempt to change the personId', async () => {
      const payment = await createPayment(editOrderId, 100.0, editPersonId);

      const response = await request(app)
        .put(`/api/orders/payments/${payment.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100.0, personId: editPerson2Id });

      expect(response.status).toBe(200);
      expect(response.body.payment.personId).toBe(editPersonId);
    });

    it('should clear notes when null is sent', async () => {
      const payment = await createPayment(editOrderId, 100.0, editPersonId, {
        notes: 'Alguma observação',
      });

      const response = await request(app)
        .put(`/api/orders/payments/${payment.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100.0, notes: null });

      expect(response.status).toBe(200);
      expect(response.body.payment.notes).toBeNull();
    });

    it('should transition status from QUITADO back to PARCIAL when a payment is reduced', async () => {
      const pay1 = await createPayment(editOrderId, 150.0, editPersonId);
      await createPayment(editOrderId, 250.0, editPerson2Id);

      let order = await prisma.order.findUnique({ where: { id: editOrderId } });
      expect(order.status).toBe('QUITADO');

      const response = await request(app)
        .put(`/api/orders/payments/${pay1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 50.0 });

      expect(response.status).toBe(200);
      expect(response.body.order.status).toBe('PARCIAL');

      order = await prisma.order.findUnique({ where: { id: editOrderId } });
      expect(order.status).toBe('PARCIAL');

      const balanceRes = await request(app)
        .get(`/api/orders/${editOrderId}/balance`)
        .set('Authorization', `Bearer ${authToken}`);
      const balance = balanceRes.body.balances.find(
        (b) => b.personId === editPersonId,
      );
      expect(parseFloat(balance.pending)).toBe(100.0);
    });

    it('should transition status from PARCIAL to QUITADO when a payment completes the balance', async () => {
      const solo = await prisma.person.create({
        data: { name: 'Solo Edit', whatsapp: 'soloedit@test.com', userId },
      });
      createdPersonIds.push(solo.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-EDIT-SOLO'),
          totalValue: 150.0,
          userId,
          items: {
            create: [
              {
                description: 'Item Solo',
                chargedValue: 150.0,
                personId: solo.id,
              },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderIds.push(order.id);

      const payment = await createPayment(order.id, 100.0, solo.id);

      let orderRecord = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(orderRecord.status).toBe('PARCIAL');

      const response = await request(app)
        .put(`/api/orders/payments/${payment.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 150.0 });

      expect(response.status).toBe(200);
      expect(response.body.order.status).toBe('QUITADO');

      orderRecord = await prisma.order.findUnique({ where: { id: order.id } });
      expect(orderRecord.status).toBe('QUITADO');
    });

    it('should accept an overpayment edit and mark the order as QUITADO', async () => {
      const solo = await prisma.person.create({
        data: { name: 'Solo Overpay', whatsapp: 'soloover@test.com', userId },
      });
      createdPersonIds.push(solo.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-EDIT-OVER'),
          totalValue: 150.0,
          userId,
          items: {
            create: [
              {
                description: 'Item Solo Overpay',
                chargedValue: 150.0,
                personId: solo.id,
              },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderIds.push(order.id);

      const payment = await createPayment(order.id, 100.0, solo.id);

      const response = await request(app)
        .put(`/api/orders/payments/${payment.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 200.0 });

      expect(response.status).toBe(200);
      expect(response.body.order.status).toBe('QUITADO');
    });

    it('should reject a zero amount edit when the person has chargeable items', async () => {
      const payment = await createPayment(editOrderId, 100.0, editPersonId);

      const response = await request(app)
        .put(`/api/orders/payments/${payment.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('greater than zero');

      const stored = await prisma.payment.findUnique({
        where: { id: payment.id },
      });
      expect(parseFloat(stored.amount)).toBe(100.0);
    });

    it('should accept a zero amount edit for a person with only zero-value items', async () => {
      const freebie = await prisma.person.create({
        data: { name: 'Freebie Edit', whatsapp: 'freeedit@test.com', userId },
      });
      createdPersonIds.push(freebie.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-FREE-EDIT'),
          totalValue: 0.0,
          userId,
          items: {
            create: [
              {
                description: 'Brinde',
                chargedValue: 0.0,
                personId: freebie.id,
              },
            ],
          },
        },
        include: { items: true },
      });
      createdOrderIds.push(order.id);

      const payment = await createPayment(order.id, 5.0, freebie.id);

      const response = await request(app)
        .put(`/api/orders/payments/${payment.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 0 });

      expect(response.status).toBe(200);
      expect(parseFloat(response.body.payment.amount)).toBe(0);
      expect(response.body.order.status).toBe('QUITADO');
    });

    it('should reject a negative amount edit (Zod validation)', async () => {
      const payment = await createPayment(editOrderId, 100.0, editPersonId);

      const response = await request(app)
        .put(`/api/orders/payments/${payment.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: -10 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject an invalid paidAt format', async () => {
      const payment = await createPayment(editOrderId, 100.0, editPersonId);

      const response = await request(app)
        .put(`/api/orders/payments/${payment.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100.0, paidAt: 'not-a-date' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for a non-existent payment', async () => {
      const response = await request(app)
        .put('/api/orders/payments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 100.0 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Payment not found');
    });

    it("should return 404 when editing another user's payment", async () => {
      const payment = await createPayment(editOrderId, 100.0, editPersonId);

      const otherUser = `other_edit_${Date.now()}`;
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({ username: otherUser, password: 'testpass123' });
      const otherUserId = regRes.body.id;

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: otherUser, password: 'testpass123' });
      const otherToken = loginRes.body.token;

      const response = await request(app)
        .put(`/api/orders/payments/${payment.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ amount: 200.0 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Payment not found');

      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    });

    it('should return 401 when no authentication token is provided', async () => {
      const payment = await createPayment(editOrderId, 100.0, editPersonId);

      const response = await request(app)
        .put(`/api/orders/payments/${payment.id}`)
        .send({ amount: 100.0 });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should return 403 when an invalid authentication token is provided', async () => {
      const payment = await createPayment(editOrderId, 100.0, editPersonId);

      const response = await request(app)
        .put(`/api/orders/payments/${payment.id}`)
        .set('Authorization', 'Bearer invalid-token')
        .send({ amount: 100.0 });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('GET /api/orders/:orderId/balance', () => {
    let balanceOrderId;
    let balancePersonId;
    let balancePerson2Id;

    beforeEach(async () => {
      const person1 = await prisma.person.create({
        data: { name: 'Balance Person 1', whatsapp: 'bal1@test.com', userId },
      });
      balancePersonId = person1.id;
      createdPersonIds.push(person1.id);

      const person2 = await prisma.person.create({
        data: { name: 'Balance Person 2', whatsapp: 'bal2@test.com', userId },
      });
      balancePerson2Id = person2.id;
      createdPersonIds.push(person2.id);

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-BAL'),
          totalValue: 500.0,
          userId,
          items: {
            create: [
              {
                description: 'Item 1',
                chargedValue: 300.0,
                personId: balancePersonId,
              },
              {
                description: 'Item 2',
                chargedValue: 200.0,
                personId: balancePerson2Id,
              },
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

      const balance1 = response.body.balances.find(
        (b) => b.personId === balancePersonId,
      );
      const balance2 = response.body.balances.find(
        (b) => b.personId === balancePerson2Id,
      );

      expect(balance1).toBeDefined();
      expect(balance1.personName).toBe('Balance Person 1');
      expect(parseFloat(balance1.itemTotal)).toBe(300.0);
      expect(parseFloat(balance1.paymentTotal)).toBe(0);
      expect(parseFloat(balance1.pending)).toBe(300.0);

      expect(balance2).toBeDefined();
      expect(balance2.personName).toBe('Balance Person 2');
      expect(parseFloat(balance2.itemTotal)).toBe(200.0);
      expect(parseFloat(balance2.paymentTotal)).toBe(0);
      expect(parseFloat(balance2.pending)).toBe(200.0);
    });

    it('should return correct balance after partial payments', async () => {
      await prisma.payment.create({
        data: {
          amount: 100.0,
          orderId: balanceOrderId,
          personId: balancePersonId,
        },
      });

      const response = await request(app)
        .get(`/api/orders/${balanceOrderId}/balance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.balances).toHaveLength(2);

      const balance1 = response.body.balances.find(
        (b) => b.personId === balancePersonId,
      );
      const balance2 = response.body.balances.find(
        (b) => b.personId === balancePerson2Id,
      );

      expect(parseFloat(balance1.itemTotal)).toBe(300.0);
      expect(parseFloat(balance1.paymentTotal)).toBe(100.0);
      expect(parseFloat(balance1.pending)).toBe(200.0);

      expect(parseFloat(balance2.itemTotal)).toBe(200.0);
      expect(parseFloat(balance2.paymentTotal)).toBe(0);
      expect(parseFloat(balance2.pending)).toBe(200.0);
    });

    it('should return zero pending for fully paid order', async () => {
      await request(app)
        .post(`/api/orders/${balanceOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 300.0, personId: balancePersonId });

      await request(app)
        .post(`/api/orders/${balanceOrderId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 200.0, personId: balancePerson2Id });

      const response = await request(app)
        .get(`/api/orders/${balanceOrderId}/balance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.balances).toHaveLength(2);

      const balance1 = response.body.balances.find(
        (b) => b.personId === balancePersonId,
      );
      const balance2 = response.body.balances.find(
        (b) => b.personId === balancePerson2Id,
      );

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
      const response = await request(app).get(
        `/api/orders/${balanceOrderId}/balance`,
      );

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
});

describe('Floating point precision (cents)', () => {
  let authToken;
  let userId;
  let createdOrderIds = [];
  let createdPersonIds = [];

  beforeAll(async () => {
    await prisma.$connect();
    const username = `cents_test_${Date.now()}`;
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

  it('should accept exact remaining balance without floating point errors', async () => {
    const person = await prisma.person.create({
      data: { name: 'Cents Test', whatsapp: 'cents@test.com', userId },
    });
    createdPersonIds.push(person.id);

    const order = await prisma.order.create({
      data: {
        orderNumber: uniqueOrderNumber('ORD-CENTS'),
        totalValue: 1234.56,
        userId,
        items: {
          create: [
            {
              description: 'Item 1234.56',
              chargedValue: 1234.56,
              personId: person.id,
            },
          ],
        },
      },
      include: { items: true },
    });
    createdOrderIds.push(order.id);

    const firstPayment = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 1233.0, personId: person.id });

    expect(firstPayment.status).toBe(201);
    expect(firstPayment.body.order.status).toBe('PARCIAL');

    const finalPayment = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 1.56, personId: person.id });

    expect(finalPayment.status).toBe(201);
    expect(finalPayment.body.order.status).toBe('QUITADO');

    const balanceRes = await request(app)
      .get(`/api/orders/${order.id}/balance`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(balanceRes.status).toBe(200);
    expect(parseFloat(balanceRes.body.balances[0].pending)).toBe(0);
  });

  it('should accept overpayment and keep balance pending at zero with cents-based calculation', async () => {
    const person = await prisma.person.create({
      data: { name: 'Cents Over Test', whatsapp: 'centsover@test.com', userId },
    });
    createdPersonIds.push(person.id);

    const order = await prisma.order.create({
      data: {
        orderNumber: uniqueOrderNumber('ORD-CENTS-OVER'),
        totalValue: 1234.56,
        userId,
        items: {
          create: [
            {
              description: 'Item 1234.56',
              chargedValue: 1234.56,
              personId: person.id,
            },
          ],
        },
      },
      include: { items: true },
    });
    createdOrderIds.push(order.id);

    await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 1233.0, personId: person.id });

    const overpaymentRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 1.57, personId: person.id });

    expect(overpaymentRes.status).toBe(201);
    expect(overpaymentRes.body.order.status).toBe('QUITADO');

    const balanceRes = await request(app)
      .get(`/api/orders/${order.id}/balance`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(balanceRes.status).toBe(200);
    const balance = balanceRes.body.balances.find(
      (b) => b.personId === person.id,
    );
    expect(parseFloat(balance.pending)).toBe(0);
    expect(parseFloat(balance.paymentTotal)).toBe(1234.57);
  });
});

describe('Transactional consistency', () => {
  let tAuthToken;
  let tUserId;
  let tCreatedOrderIds = [];
  let tCreatedPersonIds = [];

  beforeAll(async () => {
    const username = `trans_test_${Date.now()}`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'testpass123' });
    tUserId = regRes.body.id;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'testpass123' });
    tAuthToken = loginRes.body.token;
  });

  afterAll(async () => {
    if (tUserId) {
      await prisma.user.delete({ where: { id: tUserId } }).catch(() => {});
    }
  });

  afterEach(async () => {
    for (const id of tCreatedOrderIds) {
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    tCreatedOrderIds = [];

    for (const id of tCreatedPersonIds) {
      await prisma.person.delete({ where: { id } }).catch(() => {});
    }
    tCreatedPersonIds = [];
  });

  it('should update order status atomically within the payment transaction', async () => {
    const person = await prisma.person.create({
      data: {
        name: 'Transactional Test',
        whatsapp: 'trans@test.com',
        userId: tUserId,
      },
    });
    tCreatedPersonIds.push(person.id);

    const order = await prisma.order.create({
      data: {
        orderNumber: uniqueOrderNumber('ORD-TRANS'),
        totalValue: 100.0,
        userId: tUserId,
        items: {
          create: [
            {
              description: 'Test Item',
              chargedValue: 100.0,
              personId: person.id,
            },
          ],
        },
      },
      include: { items: true },
    });
    tCreatedOrderIds.push(order.id);

    const currentOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(currentOrder.status).toBe('PENDENTE');

    const paymentRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${tAuthToken}`)
      .send({ amount: 100, personId: person.id });

    expect(paymentRes.status).toBe(201);
    expect(paymentRes.body.order.status).toBe('QUITADO');

    const balanceRes = await request(app)
      .get(`/api/orders/${order.id}/balance`)
      .set('Authorization', `Bearer ${tAuthToken}`);

    expect(balanceRes.status).toBe(200);
    expect(balanceRes.body.orderStatus).toBe('QUITADO');
    expect(parseFloat(balanceRes.body.balances[0].pending)).toBe(0);
  });

  it('should persist overpayment and update order status inside the transaction', async () => {
    const person = await prisma.person.create({
      data: {
        name: 'Rollback Test',
        whatsapp: 'rollback@test.com',
        userId: tUserId,
      },
    });
    tCreatedPersonIds.push(person.id);

    const order = await prisma.order.create({
      data: {
        orderNumber: uniqueOrderNumber('ORD-ROLLBACK'),
        totalValue: 50.0,
        userId: tUserId,
        items: {
          create: [
            {
              description: 'Cheap Item',
              chargedValue: 50.0,
              personId: person.id,
            },
          ],
        },
      },
      include: { items: true },
    });
    tCreatedOrderIds.push(order.id);

    const overpaymentRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${tAuthToken}`)
      .send({ amount: 200, personId: person.id });

    expect(overpaymentRes.status).toBe(201);
    expect(overpaymentRes.body.order.status).toBe('QUITADO');

    const payments = await prisma.payment.findMany({
      where: { orderId: order.id },
    });
    expect(payments).toHaveLength(1);
    expect(parseFloat(payments[0].amount)).toBe(200.0);

    const orderAfter = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(orderAfter.status).toBe('QUITADO');
  });
});

describe('Self person payments & balance', () => {
  let authToken;
  let userId;
  let createdOrderIds = [];
  let createdPersonIds = [];

  beforeAll(async () => {
    await prisma.$connect();
    const username = `payments_self_${Date.now()}`;
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
    for (const id of createdOrderIds) {
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    createdOrderIds = [];
    for (const id of createdPersonIds) {
      await prisma.person.delete({ where: { id } }).catch(() => {});
    }
    createdPersonIds = [];
  });

  const makeSelfPerson = async (name) => {
    const person = await prisma.person.create({
      data: { name, isSelf: true, userId },
    });
    createdPersonIds.push(person.id);
    return person.id;
  };

  const makePerson = async (name) => {
    const person = await prisma.person.create({
      data: { name, userId },
    });
    createdPersonIds.push(person.id);
    return person.id;
  };

  const makeOrder = async (orderNumber, items) => {
    const order = await prisma.order.create({
      data: {
        orderNumber,
        totalValue: items.reduce((s, i) => s + i.chargedValue, 0),
        status: 'PENDENTE',
        userId,
        items: { create: items },
      },
      include: { items: true },
    });
    createdOrderIds.push(order.id);
    return order;
  };

  it('should reach QUITADO when the non-self person pays and the order also has self items', async () => {
    const selfId = await makeSelfPerson('Eu');
    const otherId = await makePerson('Cliente');
    const order = await makeOrder(uniqueOrderNumber('SELF-PAY'), [
      { description: 'Meu Item', chargedValue: 200.0, personId: selfId },
      { description: 'Item Cliente', chargedValue: 300.0, personId: otherId },
    ]);

    const response = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 300.0, personId: otherId });

    expect(response.status).toBe(201);
    expect(response.body.order.status).toBe('QUITADO');
  });

  it('should reach PARCIAL when the non-self person pays partially and self items remain', async () => {
    const selfId = await makeSelfPerson('Eu');
    const otherId = await makePerson('Cliente');
    const order = await makeOrder(uniqueOrderNumber('SELF-PARC'), [
      { description: 'Meu Item', chargedValue: 200.0, personId: selfId },
      { description: 'Item Cliente', chargedValue: 300.0, personId: otherId },
    ]);

    const response = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 100.0, personId: otherId });

    expect(response.status).toBe(201);
    expect(response.body.order.status).toBe('PARCIAL');
  });

  it('should expose isSelf and pending 0 for the self person in the balance', async () => {
    const selfId = await makeSelfPerson('Eu Mesmo');
    const otherId = await makePerson('Cliente');
    const order = await makeOrder(uniqueOrderNumber('SELF-BAL'), [
      { description: 'Meu Item', chargedValue: 200.0, personId: selfId },
      { description: 'Item Cliente', chargedValue: 300.0, personId: otherId },
    ]);

    const response = await request(app)
      .get(`/api/orders/${order.id}/balance`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    const selfBalance = response.body.balances.find(
      (b) => b.personId === selfId,
    );
    expect(selfBalance).toBeDefined();
    expect(selfBalance.isSelf).toBe(true);
    expect(parseFloat(selfBalance.itemTotal)).toBe(200.0);
    expect(parseFloat(selfBalance.pending)).toBe(0);

    const otherBalance = response.body.balances.find(
      (b) => b.personId === otherId,
    );
    expect(otherBalance.isSelf).toBe(false);
    expect(parseFloat(otherBalance.pending)).toBe(300.0);
  });
});

import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';

const registerUser = async (prefix) => {
  const username = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'testpass123' });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'testpass123' });
  return { userId: regRes.body.id, token: loginRes.body.token };
};

const createProduct = async (codeSuffix) => {
  return prisma.product.create({
    data: {
      code: `TESTSALEPAY${codeSuffix}`,
      name: 'Produto Venda Pagamento',
      size: '30 ml',
      status: 'ATIVO',
      prices: { create: { regularPrice: 100, memberPrice: 75, pv: 10 } },
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

describe('Sales <-> Payments', () => {
  let user;
  let user2;
  let client;
  let product;
  let saleId;

  const createSale = async (items, extra = {}) => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ clientPersonId: client.id, ...extra, items });
    if (res.status === 201) saleId = res.body.id;
    return res;
  };

  const pay = async (sale, amount, personId, extra = {}) => {
    return request(app)
      .post(`/api/orders/${sale}/payments`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ amount, personId, ...extra });
  };

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('salepay');
    user2 = await registerUser('salepay2');
    client = await prisma.person.create({
      data: { name: 'Cliente Pagamento', userId: user.userId },
    });
    product = await createProduct(Math.floor(Math.random() * 100000));
    await seedStock(user.userId, product.id, 1000);
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
      .deleteMany({ where: { code: { startsWith: 'TESTSALEPAY' } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (saleId) {
      await prisma.order.delete({ where: { id: saleId } }).catch(() => {});
      saleId = null;
    }
    await prisma.stockMovement
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    await prisma.inventory
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    await seedStock(user.userId, product.id, 1000);
  });

  describe('POST /api/orders/:orderId/payments on a sale', () => {
    it('moves the sale from PENDENTE to PARCIAL and QUITADO', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      expect(created.body.status).toBe('PENDENTE');

      const partial = await pay(created.body.id, 40, client.id);
      expect(partial.status).toBe(201);
      expect(partial.body.order.status).toBe('PARCIAL');

      const full = await pay(created.body.id, 60, client.id);
      expect(full.status).toBe(201);
      expect(full.body.order.status).toBe('QUITADO');
    });

    it('requires payments to cover shipping + additional for QUITADO', async () => {
      const created = await createSale(
        [{ productId: product.id, chargedValue: 100, quantity: 1 }],
        { shippingValue: 10, additionalValue: 5 },
      );
      const partial = await pay(created.body.id, 100, client.id);
      expect(partial.body.order.status).toBe('PARCIAL');
      const full = await pay(created.body.id, 15, client.id);
      expect(full.body.order.status).toBe('QUITADO');
    });

    it('accepts overpayments and clamps pending to zero in the balance', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 50, quantity: 1 },
      ]);
      const res = await pay(created.body.id, 80, client.id);
      expect(res.status).toBe(201);
      expect(res.body.order.status).toBe('QUITADO');

      const balance = await request(app)
        .get(`/api/orders/${created.body.id}/balance`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(balance.status).toBe(200);
      expect(balance.body.balances[0].pending).toBe(0);
      expect(balance.body.balances[0].paymentTotal).toBe(80);
    });

    it('rejects a zero payment against chargeable items', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 30, quantity: 1 },
      ]);
      const res = await pay(created.body.id, 0, client.id);
      expect(res.status).toBe(400);
    });

    it('accepts a zero "dar baixa" payment for a gift sale', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 0, quantity: 1 },
      ]);
      const res = await pay(created.body.id, 0, client.id);
      expect(res.status).toBe(201);
      expect(res.body.order.status).toBe('QUITADO');
    });

    it('records an optional paymentType', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      const res = await pay(created.body.id, 50, client.id, {
        paymentType: 'PIX',
      });
      expect(res.status).toBe(201);
      expect(res.body.payment.paymentType).toBe('PIX');
    });

    it('defaults paymentType to null when omitted', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      const res = await pay(created.body.id, 50, client.id);
      expect(res.status).toBe(201);
      expect(res.body.payment.paymentType).toBeNull();
    });

    it('records DINHEIRO as a paymentType', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      const res = await pay(created.body.id, 50, client.id, {
        paymentType: 'DINHEIRO',
      });
      expect(res.status).toBe(201);
      expect(res.body.payment.paymentType).toBe('DINHEIRO');
    });

    it('rejects an invalid paymentType', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      const res = await pay(created.body.id, 50, client.id, {
        paymentType: 'CHEQUE',
      });
      expect(res.status).toBe(400);
    });

    it('rejects a payment from another user', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      const res = await request(app)
        .post(`/api/orders/${created.body.id}/payments`)
        .set('Authorization', `Bearer ${user2.token}`)
        .send({ amount: 10, personId: client.id });
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/orders/payments/:id on a sale payment', () => {
    it('updates the amount and the paymentType', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      const paid = await pay(created.body.id, 50, client.id, {
        paymentType: 'PIX',
      });

      const res = await request(app)
        .put(`/api/orders/payments/${paid.body.payment.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ amount: 100, paymentType: 'CARTAO_CREDITO' });
      expect(res.status).toBe(200);
      expect(res.body.payment.paymentType).toBe('CARTAO_CREDITO');
      expect(res.body.order.status).toBe('QUITADO');
    });

    it('clears paymentType with null', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      const paid = await pay(created.body.id, 100, client.id, {
        paymentType: 'BOLETO',
      });
      const res = await request(app)
        .put(`/api/orders/payments/${paid.body.payment.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ amount: 100, paymentType: null });
      expect(res.status).toBe(200);
      expect(res.body.payment.paymentType).toBeNull();
    });
  });

  describe('InfinitePay gateway fee', () => {
    it('persists the passesGatewayFeeToClient flag on the sale', async () => {
      const created = await createSale(
        [{ productId: product.id, chargedValue: 100, quantity: 1 }],
        { passesGatewayFeeToClient: true },
      );
      expect(created.status).toBe(201);
      expect(created.body.passesGatewayFeeToClient).toBe(true);
    });

    it('defaults passesGatewayFeeToClient to false', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      expect(created.status).toBe(201);
      expect(created.body.passesGatewayFeeToClient).toBe(false);
    });

    it('records the charged amount, the net received and the derived fee', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 220, quantity: 1 },
      ]);
      const res = await pay(created.body.id, 234.02, client.id, {
        paymentType: 'INFINITE_PAY',
        netAmount: 220,
      });

      expect(res.status).toBe(201);
      expect(res.body.order.status).toBe('QUITADO');
      expect(parseFloat(res.body.payment.amount)).toBe(234.02);
      expect(parseFloat(res.body.payment.netAmount)).toBe(220);
      expect(parseFloat(res.body.payment.feeAmount)).toBe(14.02);

      const balance = await request(app)
        .get(`/api/orders/${created.body.id}/balance`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(balance.status).toBe(200);
      expect(balance.body.balances[0].pending).toBe(0);
      expect(balance.body.balances[0].paymentTotal).toBe(234.02);
    });

    it('keeps pending zero when the fee was not passed on to the client', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 640, quantity: 1 },
      ]);
      const res = await pay(created.body.id, 640, client.id, {
        paymentType: 'INFINITE_PAY',
        netAmount: 613.12,
      });

      expect(res.status).toBe(201);
      expect(res.body.order.status).toBe('QUITADO');
      expect(parseFloat(res.body.payment.netAmount)).toBe(613.12);
      expect(parseFloat(res.body.payment.feeAmount)).toBe(26.88);

      const balance = await request(app)
        .get(`/api/orders/${created.body.id}/balance`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(balance.body.balances[0].pending).toBe(0);
    });

    it('defaults netAmount to null and fee to zero when omitted', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      const res = await pay(created.body.id, 50, client.id);
      expect(res.status).toBe(201);
      expect(res.body.payment.netAmount).toBeNull();
      expect(parseFloat(res.body.payment.feeAmount)).toBe(0);
    });

    it('rejects a net amount greater than the charged amount', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      const res = await pay(created.body.id, 100, client.id, {
        netAmount: 150,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Net amount cannot be greater');
    });

    it('updates the net amount and recomputes the fee on edit', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 220, quantity: 1 },
      ]);
      const paid = await pay(created.body.id, 234.02, client.id, {
        paymentType: 'INFINITE_PAY',
        netAmount: 220,
      });

      const res = await request(app)
        .put(`/api/orders/payments/${paid.body.payment.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ amount: 234.02, netAmount: 225 });

      expect(res.status).toBe(200);
      expect(parseFloat(res.body.payment.netAmount)).toBe(225);
      expect(parseFloat(res.body.payment.feeAmount)).toBe(9.02);
    });

    it('clears the net amount with null on edit', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 220, quantity: 1 },
      ]);
      const paid = await pay(created.body.id, 220, client.id, {
        paymentType: 'INFINITE_PAY',
        netAmount: 210,
      });
      const res = await request(app)
        .put(`/api/orders/payments/${paid.body.payment.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ amount: 220, netAmount: null });
      expect(res.status).toBe(200);
      expect(res.body.payment.netAmount).toBeNull();
      expect(parseFloat(res.body.payment.feeAmount)).toBe(0);
    });

    it('rejects a net amount greater than the charged amount on edit', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 220, quantity: 1 },
      ]);
      const paid = await pay(created.body.id, 220, client.id);
      const res = await request(app)
        .put(`/api/orders/payments/${paid.body.payment.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ amount: 100, netAmount: 120 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Net amount cannot be greater');
    });

    it('persists the fee-passthrough flag on the order via the payment', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 220, quantity: 1 },
      ]);
      expect(created.body.passesGatewayFeeToClient).toBe(false);

      const res = await pay(created.body.id, 220, client.id, {
        paymentType: 'INFINITE_PAY',
        netAmount: 210,
        passesGatewayFeeToClient: true,
      });

      expect(res.status).toBe(201);
      expect(res.body.order.passesGatewayFeeToClient).toBe(true);

      const stored = await prisma.order.findUnique({
        where: { id: created.body.id },
      });
      expect(stored.passesGatewayFeeToClient).toBe(true);
    });

    it('leaves the order flag unchanged when the payment omits it', async () => {
      const created = await createSale(
        [{ productId: product.id, chargedValue: 220, quantity: 1 }],
        { passesGatewayFeeToClient: true },
      );

      const res = await pay(created.body.id, 220, client.id, {
        paymentType: 'INFINITE_PAY',
        netAmount: 210,
      });

      expect(res.status).toBe(201);
      expect(res.body.order.passesGatewayFeeToClient).toBe(true);

      const stored = await prisma.order.findUnique({
        where: { id: created.body.id },
      });
      expect(stored.passesGatewayFeeToClient).toBe(true);
    });

    it('updates the order flag when editing a payment', async () => {
      const created = await createSale([
        { productId: product.id, chargedValue: 220, quantity: 1 },
      ]);
      const paid = await pay(created.body.id, 220, client.id, {
        paymentType: 'INFINITE_PAY',
      });

      const res = await request(app)
        .put(`/api/orders/payments/${paid.body.payment.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          amount: 220,
          paymentType: 'INFINITE_PAY',
          passesGatewayFeeToClient: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.order.passesGatewayFeeToClient).toBe(true);

      const stored = await prisma.order.findUnique({
        where: { id: created.body.id },
      });
      expect(stored.passesGatewayFeeToClient).toBe(true);
    });
  });

  describe('GET /api/orders/:orderId/balance on a sale', () => {
    it('includes shipping and additional charges in the client pending', async () => {
      const created = await createSale(
        [{ productId: product.id, chargedValue: 100, quantity: 2 }],
        { shippingValue: 10, additionalValue: 5 },
      );
      await pay(created.body.id, 150, client.id);
      const res = await request(app)
        .get(`/api/orders/${created.body.id}/balance`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      expect(res.body.balances).toHaveLength(1);
      expect(res.body.balances[0].personId).toBe(client.id);
      expect(res.body.balances[0].itemTotal).toBe(200);
      expect(res.body.balances[0].paymentTotal).toBe(150);
      expect(res.body.balances[0].pending).toBe(65);
    });

    it('reaches pending zero only after the client pays the charges too', async () => {
      const created = await createSale(
        [{ productId: product.id, chargedValue: 100, quantity: 1 }],
        { shippingValue: 14.7 },
      );
      await pay(created.body.id, 100, client.id);
      const afterItems = await request(app)
        .get(`/api/orders/${created.body.id}/balance`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(afterItems.body.balances[0].pending).toBe(14.7);

      await pay(created.body.id, 14.7, client.id);
      const settled = await request(app)
        .get(`/api/orders/${created.body.id}/balance`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(settled.body.balances[0].pending).toBe(0);
    });
  });
});

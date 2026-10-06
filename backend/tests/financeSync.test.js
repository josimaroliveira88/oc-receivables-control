import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { syncExpenseFromOrder } from '../src/services/financeSyncService.js';

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

const createProduct = async (suffix) =>
  prisma.product.create({
    data: {
      code: `TESTFINSYNC${suffix}`,
      name: 'Produto Finance Sync',
      size: '30 ml',
      status: 'ATIVO',
      prices: { create: { regularPrice: 100, memberPrice: 75, pv: 10 } },
    },
  });

const seedStock = async (userId, productId, quantity) => {
  await prisma.inventory.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, quantity },
    update: { quantity },
  });
};

describe('Finances automatic sync', () => {
  let user;
  let clientPerson;
  let product;

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('finsync');
    product = await createProduct(Math.floor(Math.random() * 100000));
    await seedStock(user.userId, product.id, 1000);
    clientPerson = await prisma.person.create({
      data: { name: 'Cliente Sync', userId: user.userId },
    });
    await prisma.person.create({
      data: { name: 'Eu Mesmo', isSelf: true, userId: user.userId },
    });
  });

  afterEach(async () => {
    // Cascades to payments and their derived financial transactions.
    await prisma.order.deleteMany({ where: { userId: user.userId } });
    await prisma.financialTransaction.deleteMany({
      where: { userId: user.userId },
    });
    await prisma.stockMovement.deleteMany({ where: { userId: user.userId } });
    await seedStock(user.userId, product.id, 1000);
  });

  afterAll(async () => {
    if (user) {
      await prisma.user.delete({ where: { id: user.userId } }).catch(() => {});
    }
    await prisma.product
      .deleteMany({ where: { id: product.id } })
      .catch(() => {});
    await prisma.product
      .deleteMany({ where: { code: { startsWith: 'TESTFINSYNC' } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  const createSale = (items, extra = {}) =>
    request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        clientPersonId: clientPerson.id,
        orderDate: '2026-03-15',
        ...extra,
        items,
      });

  const createPurchase = (body) =>
    request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${user.token}`)
      .send(body);

  const pay = (orderId, body) =>
    request(app)
      .post(`/api/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${user.token}`)
      .send(body);

  const updatePayment = (paymentId, body) =>
    request(app)
      .put(`/api/orders/payments/${paymentId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send(body);

  const getRows = (where = {}) =>
    prisma.financialTransaction.findMany({
      where: { userId: user.userId, ...where },
      orderBy: { createdAt: 'asc' },
    });

  const getCategory = (type, name) =>
    prisma.financialCategory.findFirst({
      where: { userId: user.userId, type, name },
    });

  describe('sale payments -> income', () => {
    it('creates exactly one income row for a non-InfinitePay payment', async () => {
      const sale = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);

      const payment = await pay(sale.body.id, {
        amount: 100,
        personId: clientPerson.id,
        paymentType: 'PIX',
        paidAt: '2026-03-15',
      });
      expect(payment.status).toBe(201);

      const rows = await getRows({ origin: 'VENDA' });
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('RECEITA');
      expect(rows[0].origin).toBe('VENDA');
      expect(Number(rows[0].amount)).toBe(100);
      expect(rows[0].orderId).toBe(sale.body.id);
      expect(rows[0].paymentId).toBe(payment.body.payment.id);
      expect(rows[0].description).toBe(
        `Venda ${sale.body.orderNumber} — Cliente Sync`,
      );
      expect(rows[0].transactionDate.toISOString().slice(0, 10)).toBe(
        '2026-03-15',
      );

      const category = await getCategory('RECEITA', 'Vendas');
      expect(rows[0].categoryId).toBe(category.id);
    });

    it('creates one income row per payment of the same sale', async () => {
      const sale = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);

      await pay(sale.body.id, {
        amount: 40,
        personId: clientPerson.id,
        paymentType: 'PIX',
      });
      await pay(sale.body.id, {
        amount: 60,
        personId: clientPerson.id,
        paymentType: 'DINHEIRO',
      });

      const rows = await getRows({ origin: 'VENDA' });
      expect(rows).toHaveLength(2);
      expect(
        rows.map((row) => Number(row.amount)).sort((a, b) => a - b),
      ).toEqual([40, 60]);
    });

    it('creates no row for an InfinitePay payment', async () => {
      const sale = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);

      const payment = await pay(sale.body.id, {
        amount: 100,
        personId: clientPerson.id,
        paymentType: 'INFINITE_PAY',
      });
      expect(payment.status).toBe(201);

      expect(await getRows({ origin: 'VENDA' })).toHaveLength(0);
    });

    it('re-syncs the row when the payment is edited', async () => {
      const sale = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      const payment = await pay(sale.body.id, {
        amount: 100,
        personId: clientPerson.id,
        paymentType: 'PIX',
        paidAt: '2026-03-15',
      });

      const updated = await updatePayment(payment.body.payment.id, {
        amount: 120,
        paymentType: 'PIX',
        paidAt: '2026-04-01',
      });
      expect(updated.status).toBe(200);

      const rows = await getRows({ origin: 'VENDA' });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].amount)).toBe(120);
      expect(rows[0].paymentId).toBe(payment.body.payment.id);
      expect(rows[0].transactionDate.toISOString().slice(0, 10)).toBe(
        '2026-04-01',
      );
    });

    it('removes the row when the payment becomes InfinitePay and restores it when it changes back', async () => {
      const sale = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      const payment = await pay(sale.body.id, {
        amount: 100,
        personId: clientPerson.id,
        paymentType: 'PIX',
      });
      expect(await getRows({ origin: 'VENDA' })).toHaveLength(1);

      await updatePayment(payment.body.payment.id, {
        amount: 100,
        paymentType: 'INFINITE_PAY',
      });
      expect(await getRows({ origin: 'VENDA' })).toHaveLength(0);

      await updatePayment(payment.body.payment.id, {
        amount: 100,
        paymentType: 'PIX',
      });
      const rows = await getRows({ origin: 'VENDA' });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].amount)).toBe(100);
    });

    it('creates no row for a payment on a dōTERRA order', async () => {
      const purchase = await createPurchase({
        orderNumber: `CMP-${Date.now()}`,
        orderDate: '2026-03-10',
        items: [{ description: 'Óleo', chargedValue: 100 }],
      });
      expect(purchase.status).toBe(201);

      const payment = await pay(purchase.body.id, {
        amount: 100,
        personId: clientPerson.id,
        paymentType: 'PIX',
      });
      expect(payment.status).toBe(201);

      expect(await getRows({ origin: 'VENDA' })).toHaveLength(0);
    });

    it('removes the income rows when the sale is deleted', async () => {
      const sale = await createSale([
        { productId: product.id, chargedValue: 100, quantity: 1 },
      ]);
      await pay(sale.body.id, {
        amount: 100,
        personId: clientPerson.id,
        paymentType: 'PIX',
      });
      expect(await getRows({ origin: 'VENDA' })).toHaveLength(1);

      const deleted = await request(app)
        .delete(`/api/sales/${sale.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(deleted.status).toBe(200);

      expect(await getRows({ origin: 'VENDA' })).toHaveLength(0);
    });
  });

  describe('dōTERRA orders -> expense', () => {
    it('creates one expense row for a purchase order', async () => {
      const res = await createPurchase({
        orderNumber: `CMP-${Date.now()}`,
        orderDate: '2026-03-10',
        shippingValue: 5,
        items: [{ description: 'Óleo', chargedValue: 95 }],
      });
      expect(res.status).toBe(201);

      const rows = await getRows({ origin: 'PEDIDO_DOTERRA' });
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('DESPESA');
      expect(Number(rows[0].amount)).toBe(100);
      expect(rows[0].orderId).toBe(res.body.id);
      expect(rows[0].paymentId).toBeNull();
      expect(rows[0].description).toBe(
        `Pedido dōTERRA ${res.body.orderNumber}`,
      );
      expect(rows[0].transactionDate.toISOString().slice(0, 10)).toBe(
        '2026-03-10',
      );

      const category = await getCategory(
        'DESPESA',
        'Compra de produtos dōTERRA',
      );
      expect(rows[0].categoryId).toBe(category.id);
    });

    it('uses totalValue for a purchase order shared by multiple clients', async () => {
      const secondClient = await prisma.person.create({
        data: { name: 'Segundo Cliente', userId: user.userId },
      });

      const order = await prisma.order.create({
        data: {
          orderNumber: `CMP-MULTI-${Date.now()}`,
          orderDate: new Date('2026-03-10T00:00:00Z'),
          orderType: 'COMPRA',
          totalValue: 150,
          doterraValue: 100,
          userId: user.userId,
          items: {
            create: [
              {
                description: 'Óleo A',
                chargedValue: 100,
                personId: clientPerson.id,
              },
              {
                description: 'Óleo B',
                chargedValue: 50,
                personId: secondClient.id,
              },
            ],
          },
        },
      });

      await syncExpenseFromOrder(prisma, { userId: user.userId, order });

      const rows = await getRows({ origin: 'PEDIDO_DOTERRA' });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].amount)).toBe(150);
    });

    it('uses doterraValue for a purchase order with a single client', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: `CMP-SINGLE-${Date.now()}`,
          orderDate: new Date('2026-03-10T00:00:00Z'),
          orderType: 'COMPRA',
          totalValue: 150,
          doterraValue: 100,
          userId: user.userId,
          items: {
            create: [
              {
                description: 'Óleo',
                chargedValue: 150,
                personId: clientPerson.id,
              },
            ],
          },
        },
      });

      await syncExpenseFromOrder(prisma, { userId: user.userId, order });

      const rows = await getRows({ origin: 'PEDIDO_DOTERRA' });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].amount)).toBe(100);
    });

    it('creates no expense row for a team order', async () => {
      const res = await createPurchase({
        orderNumber: `CMP-${Date.now()}`,
        orderDate: '2026-03-10',
        isTeamOrder: true,
        items: [{ description: 'Óleo', chargedValue: 100 }],
      });
      expect(res.status).toBe(201);

      expect(await getRows({ origin: 'PEDIDO_DOTERRA' })).toHaveLength(0);
    });

    it('keeps a single row in sync when the order is updated', async () => {
      const res = await createPurchase({
        orderNumber: `CMP-${Date.now()}`,
        orderDate: '2026-03-10',
        shippingValue: 5,
        items: [{ description: 'Óleo', chargedValue: 95 }],
      });

      const updated = await request(app)
        .put(`/api/orders/${res.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ shippingValue: 10 });
      expect(updated.status).toBe(200);

      const rows = await getRows({ origin: 'PEDIDO_DOTERRA' });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].amount)).toBe(105);
      expect(rows[0].orderId).toBe(res.body.id);
    });

    it('removes the row when the order becomes a team order', async () => {
      const res = await createPurchase({
        orderNumber: `CMP-${Date.now()}`,
        orderDate: '2026-03-10',
        items: [{ description: 'Óleo', chargedValue: 100 }],
      });
      expect(await getRows({ origin: 'PEDIDO_DOTERRA' })).toHaveLength(1);

      const updated = await request(app)
        .put(`/api/orders/${res.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ isTeamOrder: true });
      expect(updated.status).toBe(200);

      expect(await getRows({ origin: 'PEDIDO_DOTERRA' })).toHaveLength(0);
    });

    it('keeps the row in sync when an item is added, edited and removed', async () => {
      const res = await createPurchase({
        orderNumber: `CMP-${Date.now()}`,
        orderDate: '2026-03-10',
        items: [{ description: 'Óleo', chargedValue: 100 }],
      });

      const added = await request(app)
        .post(`/api/orders/${res.body.id}/items`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ description: 'Extra', chargedValue: 50 });
      expect(added.status).toBe(201);

      let rows = await getRows({ origin: 'PEDIDO_DOTERRA' });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].amount)).toBe(150);

      const edited = await request(app)
        .put(`/api/orders/items/${added.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ chargedValue: 80 });
      expect(edited.status).toBe(200);

      rows = await getRows({ origin: 'PEDIDO_DOTERRA' });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].amount)).toBe(180);

      const removed = await request(app)
        .delete(`/api/orders/items/${added.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(removed.status).toBe(200);

      rows = await getRows({ origin: 'PEDIDO_DOTERRA' });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].amount)).toBe(100);
    });

    it('removes the expense row when the order is deleted', async () => {
      const res = await createPurchase({
        orderNumber: `CMP-${Date.now()}`,
        orderDate: '2026-03-10',
        items: [{ description: 'Óleo', chargedValue: 100 }],
      });
      expect(await getRows({ origin: 'PEDIDO_DOTERRA' })).toHaveLength(1);

      const deleted = await request(app)
        .delete(`/api/orders/${res.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(deleted.status).toBe(200);

      expect(await getRows({ origin: 'PEDIDO_DOTERRA' })).toHaveLength(0);
    });
  });

  describe('sale additional value -> expense', () => {
    let expenseCategory;
    let receitaCategory;

    beforeAll(async () => {
      expenseCategory = await getCategory('DESPESA', 'Frete');
      receitaCategory = await getCategory('RECEITA', 'Vendas');
    });

    const saleWithAdditional = (extra = {}) =>
      createSale([{ productId: product.id, chargedValue: 100, quantity: 1 }], {
        additionalValue: 20,
        additionalExpenseCategoryId: expenseCategory.id,
        additionalExpenseDescription: 'Frete extra',
        ...extra,
      });

    const updateSale = (saleId, body) =>
      request(app)
        .put(`/api/sales/${saleId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send(body);

    it('creates one DESPESA row linked to the sale', async () => {
      const sale = await saleWithAdditional();
      expect(sale.status).toBe(201);

      const rows = await getRows({ origin: 'VENDA_ADICIONAL' });
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('DESPESA');
      expect(Number(rows[0].amount)).toBe(20);
      expect(rows[0].orderId).toBe(sale.body.id);
      expect(rows[0].paymentId).toBeNull();
      expect(rows[0].description).toBe('Frete extra');
      expect(rows[0].categoryId).toBe(expenseCategory.id);
      expect(rows[0].transactionDate.toISOString().slice(0, 10)).toBe(
        '2026-03-15',
      );
    });

    it('creates the DESPESA row even when the additional is not charged to the client', async () => {
      const sale = await saleWithAdditional({
        additionalValueChargedToClient: false,
      });
      expect(sale.status).toBe(201);

      const rows = await getRows({ origin: 'VENDA_ADICIONAL' });
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('DESPESA');
      expect(Number(rows[0].amount)).toBe(20);
      expect(rows[0].orderId).toBe(sale.body.id);
    });

    it('rejects a sale with additional value and no category', async () => {
      const res = await createSale(
        [{ productId: product.id, chargedValue: 100, quantity: 1 }],
        { additionalValue: 20, additionalExpenseDescription: 'Frete extra' },
      );
      expect(res.status).toBe(400);
      expect(await getRows({ origin: 'VENDA_ADICIONAL' })).toHaveLength(0);
    });

    it('rejects a sale with additional value and no description', async () => {
      const res = await createSale(
        [{ productId: product.id, chargedValue: 100, quantity: 1 }],
        {
          additionalValue: 20,
          additionalExpenseCategoryId: expenseCategory.id,
        },
      );
      expect(res.status).toBe(400);
      expect(await getRows({ origin: 'VENDA_ADICIONAL' })).toHaveLength(0);
    });

    it('rejects a category that is not a DESPESA', async () => {
      const res = await createSale(
        [{ productId: product.id, chargedValue: 100, quantity: 1 }],
        {
          additionalValue: 20,
          additionalExpenseCategoryId: receitaCategory.id,
          additionalExpenseDescription: 'Frete extra',
        },
      );
      expect(res.status).toBe(400);
      expect(await getRows({ origin: 'VENDA_ADICIONAL' })).toHaveLength(0);
    });

    it('creates no row when the additional value is zero', async () => {
      const res = await createSale(
        [{ productId: product.id, chargedValue: 100, quantity: 1 }],
        { additionalValue: 0 },
      );
      expect(res.status).toBe(201);
      expect(await getRows({ origin: 'VENDA_ADICIONAL' })).toHaveLength(0);
    });

    it('keeps the row in sync when the sale is updated', async () => {
      const sale = await saleWithAdditional();
      const updated = await updateSale(sale.body.id, {
        additionalValue: 35,
        additionalExpenseCategoryId: expenseCategory.id,
        additionalExpenseDescription: 'Frete corrigido',
      });
      expect(updated.status).toBe(200);

      const rows = await getRows({ origin: 'VENDA_ADICIONAL' });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].amount)).toBe(35);
      expect(rows[0].description).toBe('Frete corrigido');
    });

    it('keeps the row when toggling delivery without touching the expense', async () => {
      const sale = await saleWithAdditional();
      const updated = await updateSale(sale.body.id, {
        deliveredAt: '2026-03-20',
      });
      expect(updated.status).toBe(200);

      const rows = await getRows({ origin: 'VENDA_ADICIONAL' });
      expect(rows).toHaveLength(1);
      expect(rows[0].description).toBe('Frete extra');
      expect(Number(rows[0].amount)).toBe(20);
    });

    it('does not recreate the additional expense once a ride represents it', async () => {
      const sale = await saleWithAdditional();
      const [row] = await getRows({
        origin: 'VENDA_ADICIONAL',
        orderId: sale.body.id,
      });

      // Simulates the outcome of reconciling the row with an Uber ride.
      const ride = await prisma.rideRecord.create({
        data: {
          userId: user.userId,
          source: 'MANUAL',
          externalId: `guard-${sale.body.id}`,
          requestedAt: new Date('2026-09-15T00:00:00.000Z'),
          amountCents: 2000,
          status: 'COMPLETED',
          rideType: 'RIDE',
        },
      });
      await prisma.financialTransaction.update({
        where: { id: row.id },
        data: { origin: 'UBER', rideId: ride.id },
      });

      const updated = await updateSale(sale.body.id, {
        additionalExpenseDescription: 'Frete revisado',
      });
      expect(updated.status).toBe(200);

      expect(
        await getRows({ origin: 'VENDA_ADICIONAL', orderId: sale.body.id }),
      ).toHaveLength(0);
      const rows = await getRows({ orderId: sale.body.id });
      expect(rows).toHaveLength(1);
      expect(rows[0].origin).toBe('UBER');
    });

    it('recreates the additional expense when the additional value diverges from the ride', async () => {
      const sale = await saleWithAdditional();
      const [row] = await getRows({
        origin: 'VENDA_ADICIONAL',
        orderId: sale.body.id,
      });

      const ride = await prisma.rideRecord.create({
        data: {
          userId: user.userId,
          source: 'MANUAL',
          externalId: `guard-diverge-${sale.body.id}`,
          requestedAt: new Date('2026-09-15T00:00:00.000Z'),
          amountCents: 2000,
          status: 'COMPLETED',
          rideType: 'RIDE',
        },
      });
      await prisma.financialTransaction.update({
        where: { id: row.id },
        data: { origin: 'UBER', rideId: ride.id },
      });

      const updated = await updateSale(sale.body.id, {
        additionalValue: 35,
        additionalExpenseCategoryId: expenseCategory.id,
        additionalExpenseDescription: 'Frete corrigido',
      });
      expect(updated.status).toBe(200);

      const rows = await getRows({
        origin: 'VENDA_ADICIONAL',
        orderId: sale.body.id,
      });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].amount)).toBe(35);
    });

    it('updates the row when editing through the full items payload', async () => {
      const sale = await saleWithAdditional();
      const updated = await updateSale(sale.body.id, {
        items: [{ productId: product.id, chargedValue: 100, quantity: 1 }],
        additionalValue: 20,
        additionalExpenseCategoryId: expenseCategory.id,
        additionalExpenseDescription: 'Frete via edição completa',
      });
      expect(updated.status).toBe(200);

      const rows = await getRows({ origin: 'VENDA_ADICIONAL' });
      expect(rows).toHaveLength(1);
      expect(rows[0].description).toBe('Frete via edição completa');
    });

    it('removes the row when the additional value is zeroed', async () => {
      const sale = await saleWithAdditional();
      expect(await getRows({ origin: 'VENDA_ADICIONAL' })).toHaveLength(1);

      const updated = await updateSale(sale.body.id, { additionalValue: 0 });
      expect(updated.status).toBe(200);
      expect(await getRows({ origin: 'VENDA_ADICIONAL' })).toHaveLength(0);
    });

    it('removes the row when the sale is deleted', async () => {
      const sale = await saleWithAdditional();
      expect(await getRows({ origin: 'VENDA_ADICIONAL' })).toHaveLength(1);

      const deleted = await request(app)
        .delete(`/api/sales/${sale.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(deleted.status).toBe(200);
      expect(await getRows({ origin: 'VENDA_ADICIONAL' })).toHaveLength(0);
    });

    it('exposes the expense fields on the sale read endpoints', async () => {
      const sale = await saleWithAdditional();

      const list = await request(app)
        .get('/api/sales')
        .set('Authorization', `Bearer ${user.token}`);
      const fromList = list.body.find((row) => row.id === sale.body.id);
      expect(fromList.additionalExpenseCategoryId).toBe(expenseCategory.id);
      expect(fromList.additionalExpenseDescription).toBe('Frete extra');

      const detail = await request(app)
        .get(`/api/sales/${sale.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(detail.body.additionalExpenseCategoryId).toBe(expenseCategory.id);
      expect(detail.body.additionalExpenseDescription).toBe('Frete extra');
    });
  });
});

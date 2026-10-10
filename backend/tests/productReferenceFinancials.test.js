import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';

const uniqueOrderNumber = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

// Guarantees that editing an order/sale to remove an item keeps the linked
// financial transaction consistent: the ledger row follows the new order
// total, and deleting the order removes the row entirely.
describe('Product reference removal keeps finances consistent', () => {
  let authToken;
  let userId;
  const createdOrderIds = [];
  const createdProductIds = [];

  const createProduct = async (suffix) => {
    const product = await prisma.product.create({
      data: {
        code: `TESTFIN${Date.now()}${suffix}`,
        name: `Produto Fin ${suffix}`,
        size: '15 ml',
        prices: {
          create: { regularPrice: 100, memberPrice: 75, pv: 10 },
        },
      },
    });
    createdProductIds.push(product.id);
    return product;
  };

  beforeAll(async () => {
    await prisma.$connect();
    const username = `fin_refs_${Date.now()}`;
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
    await prisma.product
      .deleteMany({ where: { code: { startsWith: 'TESTFIN' } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  afterEach(async () => {
    for (const id of createdOrderIds) {
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    createdOrderIds.length = 0;
    for (const id of createdProductIds) {
      await prisma.item
        .deleteMany({ where: { productId: id } })
        .catch(() => {});
      await prisma.product.delete({ where: { id } }).catch(() => {});
    }
    createdProductIds.length = 0;
  });

  it('updates the PEDIDO_DOTERRA expense when an order item is removed and the order saved', async () => {
    const product = await createProduct('A');

    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orderNumber: uniqueOrderNumber('FINORD'),
        items: [
          { productId: product.id, chargedValue: 100, quantity: 2 },
          { productId: product.id, chargedValue: 50, quantity: 1 },
        ],
      });

    expect(created.status).toBe(201);
    const orderId = created.body.id;
    createdOrderIds.push(orderId);
    // 100 (unit) * 2 + 50 (unit) * 1 = 250.
    expect(Number(created.body.totalValue)).toBe(250);

    const firstTx = await prisma.financialTransaction.findFirst({
      where: { orderId, origin: 'PEDIDO_DOTERRA' },
    });
    expect(firstTx).not.toBeNull();
    expect(Number(firstTx.amount)).toBe(250);

    // Remove the second item and save: the item (and its reference) is gone and
    // the expense follows the new total.
    const keptItem = created.body.items[0];
    const updated = await request(app)
      .put(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orderNumber: created.body.orderNumber,
        items: [
          {
            id: keptItem.id,
            productId: product.id,
            chargedValue: 100,
            quantity: 2,
          },
        ],
      });

    expect(updated.status).toBe(200);
    expect(Number(updated.body.totalValue)).toBe(200);

    const txs = await prisma.financialTransaction.findMany({
      where: { orderId, origin: 'PEDIDO_DOTERRA' },
    });
    expect(txs).toHaveLength(1);
    expect(Number(txs[0].amount)).toBe(200);
    expect(Number(txs[0].amount)).toBe(Number(updated.body.totalValue));

    const remainingItems = await prisma.item.count({ where: { orderId } });
    expect(remainingItems).toBe(1);
  });

  it('removes the linked expense when the order is deleted', async () => {
    const product = await createProduct('B');

    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orderNumber: uniqueOrderNumber('FINDEL'),
        items: [{ productId: product.id, chargedValue: 80, quantity: 1 }],
      });

    expect(created.status).toBe(201);
    const orderId = created.body.id;
    createdOrderIds.push(orderId);

    const deleted = await request(app)
      .delete(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(deleted.status).toBe(200);

    const txs = await prisma.financialTransaction.findMany({
      where: { orderId },
    });
    expect(txs).toHaveLength(0);
  });

  it('keeps the sale consistent when an item is removed and the sale is saved', async () => {
    const product = await createProduct('C');
    await prisma.inventory.upsert({
      where: { userId_productId: { userId, productId: product.id } },
      create: { userId, productId: product.id, quantity: 10 },
      update: { quantity: 10 },
    });
    const client = await prisma.person.create({
      data: { name: 'Cliente Fin Venda', userId },
    });
    const category = await prisma.financialCategory.findFirst({
      where: { userId, type: 'DESPESA' },
    });

    const created = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        clientPersonId: client.id,
        items: [
          { productId: product.id, chargedValue: 100, quantity: 2 },
          { productId: product.id, chargedValue: 50, quantity: 1 },
        ],
        additionalValue: 30,
        additionalExpenseCategoryId: category.id,
        additionalExpenseDescription: 'Frete adicional',
      });

    expect(created.status).toBe(201);
    const saleId = created.body.id;
    createdOrderIds.push(saleId);

    const before = await prisma.financialTransaction.findFirst({
      where: { orderId: saleId, origin: 'VENDA_ADICIONAL' },
    });
    expect(before).not.toBeNull();
    expect(Number(before.amount)).toBe(30);

    const keptItem = created.body.items[0];
    const updated = await request(app)
      .put(`/api/sales/${saleId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        clientPersonId: client.id,
        items: [
          {
            id: keptItem.id,
            productId: product.id,
            chargedValue: 100,
            quantity: 2,
          },
        ],
      });

    expect(updated.status).toBe(200);
    expect(await prisma.item.count({ where: { orderId: saleId } })).toBe(1);

    // The additional-value expense is a sale-level value: removing an item
    // does not change it, so the ledger row keeps its amount.
    const after = await prisma.financialTransaction.findMany({
      where: { orderId: saleId, origin: 'VENDA_ADICIONAL' },
    });
    expect(after).toHaveLength(1);
    expect(Number(after[0].amount)).toBe(30);
  });
});

import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { createTestUser } from './helpers/createTestUser.js';

const uniqueCode = (suffix) => `TESTUSAGE${Date.now()}${suffix}`;

describe('Product usage & hard delete', () => {
  let token;
  let userId;
  const createdProductIds = [];

  const createProduct = async (suffix, overrides = {}) => {
    const product = await prisma.product.create({
      data: {
        code: uniqueCode(suffix),
        name: `Produto ${suffix}`,
        size: '15 ml',
        ...overrides,
        prices: {
          create: { regularPrice: 10, memberPrice: 7.5, pv: 1 },
        },
      },
    });
    createdProductIds.push(product.id);
    return product;
  };

  beforeAll(async () => {
    const { user, token: userToken } = await createTestUser('usage');
    userId = user.id;
    token = userToken;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await prisma.product
      .deleteMany({ where: { code: { startsWith: 'TESTUSAGE' } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Best-effort cleanup of dependents created by each test.
    for (const productId of createdProductIds) {
      await prisma.stockMovement
        .deleteMany({ where: { productId } })
        .catch(() => {});
      await prisma.stockExchangeLine
        .deleteMany({ where: { productId } })
        .catch(() => {});
      await prisma.inventory
        .deleteMany({ where: { productId } })
        .catch(() => {});
      await prisma.kitComposition
        .deleteMany({
          where: {
            OR: [{ kitProductId: productId, componentProductId: productId }],
          },
        })
        .catch(() => {});
      await prisma.item.deleteMany({ where: { productId } }).catch(() => {});
    }
    createdProductIds.length = 0;
  });

  describe('GET /api/products/:id/usage', () => {
    it('returns an empty, deletable snapshot for an unused product', async () => {
      const product = await createProduct('A');

      const response = await request(app)
        .get(`/api/products/${product.id}/usage`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.product.id).toBe(product.id);
      expect(response.body.deletable).toBe(true);
      expect(response.body.references.orderItems).toEqual([]);
      expect(response.body.references.inventory).toBeNull();
      expect(response.body.references.stockMovements).toEqual([]);
      expect(response.body.references.stockExchangeLines).toEqual([]);
      expect(response.body.references.kitComponents).toEqual([]);
      expect(response.body.references.kitComposition).toEqual([]);
    });

    it('returns 404 for a non-existent product', async () => {
      const response = await request(app)
        .get('/api/products/00000000-0000-0000-0000-000000000000/usage')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });

    it('lists order items (purchases and sales) and flags stock references', async () => {
      const product = await createProduct('B');

      const person = await prisma.person.create({
        data: { name: 'Cliente Usage', userId },
      });

      await prisma.order.create({
        data: {
          orderNumber: `USAGE-${Date.now()}-1`,
          totalValue: 100,
          orderDate: new Date(),
          userId,
          items: {
            create: {
              chargedValue: 100,
              productId: product.id,
              quantity: 2,
              personId: person.id,
            },
          },
        },
      });

      await prisma.order.create({
        data: {
          orderNumber: `USAGE-${Date.now()}-2`,
          totalValue: 50,
          orderDate: new Date(),
          orderType: 'VENDA',
          userId,
          items: {
            create: { chargedValue: 50, productId: product.id, quantity: 1 },
          },
        },
      });

      await prisma.inventory.create({
        data: { userId, productId: product.id, quantity: 4 },
      });
      await prisma.stockMovement.create({
        data: { userId, productId: product.id, quantity: 4, type: 'ENTRADA' },
      });

      const promise = request(app)
        .get(`/api/products/${product.id}/usage`)
        .set('Authorization', `Bearer ${token}`);
      const response = await promise;

      expect(response.status).toBe(200);
      expect(response.body.references.orderItems).toHaveLength(2);
      const types = response.body.references.orderItems
        .map((i) => i.orderType)
        .sort();
      expect(types).toEqual(['COMPRA', 'VENDA']);
      expect(response.body.references.inventory.quantity).toBe(4);
      expect(response.body.references.stockMovements).toHaveLength(1);
      expect(response.body.references.stockMovements[0].source).toBe('manual');

      expect(response.body.blockers.inventory).toBe(true);
      expect(response.body.blockers.stockMovements).toBe(true);
      expect(response.body.deletable).toBe(false);
      expect(response.body.counts.orderItems).toBe(2);
    });

    it('includes stock-exchange lines and kit composition references', async () => {
      const component = await createProduct('C-COMP');
      const kit = await createProduct('C-KIT', { productType: 'KIT' });
      const person = await prisma.person.create({
        data: { name: 'Parceiro Usage', userId },
      });

      await prisma.kitComposition.create({
        data: {
          kitProductId: kit.id,
          componentProductId: component.id,
          quantity: 3,
        },
      });

      const exchange = await prisma.stockExchange.create({
        data: {
          userId,
          personId: person.id,
          lines: {
            create: {
              productId: component.id,
              quantity: 2,
              direction: 'OUT',
            },
          },
        },
      });
      expect(exchange.id).toBeTruthy();

      const response = await request(app)
        .get(`/api/products/${component.id}/usage`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.references.kitComponents).toHaveLength(1);
      expect(response.body.references.kitComponents[0].kitName).toBe(
        `Produto C-KIT`,
      );
      expect(response.body.blockers.kitComponent).toBe(true);
      expect(response.body.references.stockExchangeLines).toHaveLength(1);
      expect(response.body.blockers.stockExchangeLines).toBe(true);

      const kitUsage = await request(app)
        .get(`/api/products/${kit.id}/usage`)
        .set('Authorization', `Bearer ${token}`);
      expect(kitUsage.body.references.kitComposition).toHaveLength(1);
      expect(kitUsage.body.references.kitComposition[0].componentName).toBe(
        'Produto C-COMP',
      );
      // A kit's own composition is informational (Cascade), not a blocker.
      expect(kitUsage.body.deletable).toBe(true);
    });

    it('excludes order items from other users', async () => {
      const product = await createProduct('D');
      const { user: otherUser } = await createTestUser('usage_other');

      await prisma.order.create({
        data: {
          orderNumber: `USAGE-${Date.now()}-other`,
          totalValue: 10,
          orderDate: new Date(),
          userId: otherUser.id,
          items: {
            create: { chargedValue: 10, productId: product.id, quantity: 1 },
          },
        },
      });

      const response = await request(app)
        .get(`/api/products/${product.id}/usage`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.references.orderItems).toEqual([]);
      expect(response.body.deletable).toBe(true);

      await prisma.user.delete({ where: { id: otherUser.id } }).catch(() => {});
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('physically deletes a product with no blocking references', async () => {
      const product = await createProduct('E');

      const response = await request(app)
        .delete(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const found = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(found).toBeNull();
    });

    it('removes a zero-quantity inventory row and deletes the product', async () => {
      const product = await createProduct('F');
      await prisma.inventory.create({
        data: { userId, productId: product.id, quantity: 0 },
      });

      const response = await request(app)
        .delete(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(
        await prisma.product.findUnique({ where: { id: product.id } }),
      ).toBeNull();
      expect(
        await prisma.inventory.findFirst({ where: { productId: product.id } }),
      ).toBeNull();
    });

    it('returns 409 with blockers when stock movements exist', async () => {
      const product = await createProduct('G');
      await prisma.stockMovement.create({
        data: { userId, productId: product.id, quantity: 3, type: 'SAIDA' },
      });

      const response = await request(app)
        .delete(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(409);
      expect(response.body.blockers.stockMovements).toBe(true);
      expect(response.body.counts.stockMovements).toBe(1);
      expect(
        await prisma.product.findUnique({ where: { id: product.id } }),
      ).not.toBeNull();
    });

    it('returns 409 when the product holds stock', async () => {
      const product = await createProduct('H');
      await prisma.inventory.create({
        data: { userId, productId: product.id, quantity: 5 },
      });

      const response = await request(app)
        .delete(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(409);
      expect(response.body.blockers.inventory).toBe(true);
    });

    it('returns 409 when the product is a component of another kit', async () => {
      const component = await createProduct('I-COMP');
      const kit = await createProduct('I-KIT', { productType: 'KIT' });
      await prisma.kitComposition.create({
        data: {
          kitProductId: kit.id,
          componentProductId: component.id,
          quantity: 1,
        },
      });

      const response = await request(app)
        .delete(`/api/products/${component.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(409);
      expect(response.body.blockers.kitComponent).toBe(true);
    });

    it('cascades the kit composition when the kit itself is deleted', async () => {
      const component = await createProduct('J-COMP');
      const kit = await createProduct('J-KIT', { productType: 'KIT' });
      await prisma.kitComposition.create({
        data: {
          kitProductId: kit.id,
          componentProductId: component.id,
          quantity: 1,
        },
      });

      const response = await request(app)
        .delete(`/api/products/${kit.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(
        await prisma.kitComposition.count({ where: { kitProductId: kit.id } }),
      ).toBe(0);
    });

    it('returns 404 for a non-existent product', async () => {
      const response = await request(app)
        .delete('/api/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/products/:id/references/:kind', () => {
    it('removes stock movements and then allows the hard delete', async () => {
      const product = await createProduct('K');
      await prisma.stockMovement.create({
        data: { userId, productId: product.id, quantity: 3, type: 'ENTRADA' },
      });

      const removed = await request(app)
        .delete(`/api/products/${product.id}/references/stock-movements`)
        .set('Authorization', `Bearer ${token}`);
      expect(removed.status).toBe(200);
      expect(removed.body.removed).toBe(1);

      const deleted = await request(app)
        .delete(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleted.status).toBe(200);
    });

    it('removes the inventory row even when it holds stock', async () => {
      const product = await createProduct('L');
      await prisma.inventory.create({
        data: { userId, productId: product.id, quantity: 9 },
      });

      const removed = await request(app)
        .delete(`/api/products/${product.id}/references/inventory`)
        .set('Authorization', `Bearer ${token}`);
      expect(removed.status).toBe(200);
      expect(removed.body.removed).toBe(1);

      const deleted = await request(app)
        .delete(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleted.status).toBe(200);
    });

    it('removes exchange lines and kit composition references', async () => {
      const component = await createProduct('M-COMP');
      const kit = await createProduct('M-KIT', { productType: 'KIT' });
      const person = await prisma.person.create({
        data: { name: 'Parceiro M', userId },
      });
      await prisma.kitComposition.create({
        data: {
          kitProductId: kit.id,
          componentProductId: component.id,
          quantity: 1,
        },
      });
      await prisma.stockExchange.create({
        data: {
          userId,
          personId: person.id,
          lines: {
            create: { productId: component.id, quantity: 1, direction: 'IN' },
          },
        },
      });

      const exchange = await request(app)
        .delete(`/api/products/${component.id}/references/exchange-lines`)
        .set('Authorization', `Bearer ${token}`);
      expect(exchange.status).toBe(200);
      expect(exchange.body.removed).toBe(1);

      const kitRemoved = await request(app)
        .delete(`/api/products/${component.id}/references/kit-component`)
        .set('Authorization', `Bearer ${token}`);
      expect(kitRemoved.status).toBe(200);
      expect(kitRemoved.body.removed).toBe(1);

      const deleted = await request(app)
        .delete(`/api/products/${component.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleted.status).toBe(200);
    });

    it('rejects an unknown reference kind with 400', async () => {
      const product = await createProduct('N');

      const response = await request(app)
        .delete(`/api/products/${product.id}/references/unknown`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/products/:id/purge', () => {
    it('removes every reference and the product in one transaction', async () => {
      const component = await createProduct('P-COMP');
      const kit = await createProduct('P-KIT', { productType: 'KIT' });
      const person = await prisma.person.create({
        data: { name: 'Parceiro P', userId },
      });

      await prisma.kitComposition.create({
        data: {
          kitProductId: kit.id,
          componentProductId: component.id,
          quantity: 1,
        },
      });
      await prisma.inventory.create({
        data: { userId, productId: component.id, quantity: 7 },
      });
      await prisma.stockMovement.create({
        data: { userId, productId: component.id, quantity: 7, type: 'ENTRADA' },
      });
      await prisma.stockExchange.create({
        data: {
          userId,
          personId: person.id,
          lines: {
            create: { productId: component.id, quantity: 2, direction: 'OUT' },
          },
        },
      });
      const order = await prisma.order.create({
        data: {
          orderNumber: `USAGE-${Date.now()}-purge`,
          totalValue: 30,
          orderDate: new Date(),
          userId,
          items: {
            create: {
              chargedValue: 30,
              productId: component.id,
              quantity: 1,
            },
          },
        },
      });

      const response = await request(app)
        .post(`/api/products/${component.id}/purge`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.removed.inventory).toBe(1);
      expect(response.body.removed.stockMovements).toBe(1);
      expect(response.body.removed.stockExchangeLines).toBe(1);
      expect(response.body.removed.kitComponents).toBe(1);

      expect(
        await prisma.product.findUnique({ where: { id: component.id } }),
      ).toBeNull();
      expect(
        await prisma.inventory.count({ where: { productId: component.id } }),
      ).toBe(0);
      expect(
        await prisma.stockMovement.count({
          where: { productId: component.id },
        }),
      ).toBe(0);

      // The order item is removed and the order total is recalculated.
      const item = await prisma.item.findFirst({
        where: { orderId: order.id },
      });
      expect(item).toBeNull();
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(Number(updatedOrder.totalValue)).toBe(0);
    });

    it('recalculates the affected order total and its linked expense', async () => {
      const productA = await createProduct('Q-A');
      const productB = await createProduct('Q-B');

      const created = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          orderNumber: `USAGE-${Date.now()}-recalc`,
          items: [
            { productId: productA.id, chargedValue: 100, quantity: 1 },
            { productId: productB.id, chargedValue: 60, quantity: 1 },
          ],
        });

      expect(created.status).toBe(201);
      const orderId = created.body.id;
      expect(Number(created.body.totalValue)).toBe(160);

      const before = await prisma.financialTransaction.findFirst({
        where: { orderId, origin: 'PEDIDO_DOTERRA' },
      });
      expect(Number(before.amount)).toBe(160);

      const response = await request(app)
        .post(`/api/products/${productA.id}/purge`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);

      const updatedOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });
      expect(Number(updatedOrder.totalValue)).toBe(60);

      const after = await prisma.financialTransaction.findMany({
        where: { orderId, origin: 'PEDIDO_DOTERRA' },
      });
      expect(after).toHaveLength(1);
      expect(Number(after[0].amount)).toBe(60);

      // Only the item of the deleted product was removed.
      const remaining = await prisma.item.findMany({ where: { orderId } });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].productId).toBe(productB.id);

      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    });

    it('recalculates the affected sale total', async () => {
      const productA = await createProduct('R-A');
      const productB = await createProduct('R-B');
      const client = await prisma.person.create({
        data: { name: 'Cliente R', userId },
      });
      for (const product of [productA, productB]) {
        await prisma.inventory.upsert({
          where: { userId_productId: { userId, productId: product.id } },
          create: { userId, productId: product.id, quantity: 5 },
          update: { quantity: 5 },
        });
      }

      const created = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientPersonId: client.id,
          items: [
            { productId: productA.id, chargedValue: 100, quantity: 1 },
            { productId: productB.id, chargedValue: 60, quantity: 1 },
          ],
        });
      expect(created.status).toBe(201);
      const saleId = created.body.id;

      const response = await request(app)
        .post(`/api/products/${productA.id}/purge`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);

      const updatedSale = await prisma.order.findUnique({
        where: { id: saleId },
      });
      expect(Number(updatedSale.totalValue)).toBe(60);
      const remaining = await prisma.item.findMany({
        where: { orderId: saleId },
      });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].productId).toBe(productB.id);

      await prisma.order.delete({ where: { id: saleId } }).catch(() => {});
    });

    it('returns 404 for a non-existent product', async () => {
      const response = await request(app)
        .post('/api/products/00000000-0000-0000-0000-000000000000/purge')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });
});

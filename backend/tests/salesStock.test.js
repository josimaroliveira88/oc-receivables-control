const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

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

const createProduct = async (codeSuffix, extra = {}) => {
  return prisma.product.create({
    data: {
      code: `TESTSALESTK${codeSuffix}`,
      name: 'Produto Venda Estoque',
      size: '15 ml',
      status: 'ATIVO',
      productType: extra.productType || 'SIMPLES',
      prices: { create: { regularPrice: 100, memberPrice: 75, pv: 10 } },
      ...extra,
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

describe('Sales <-> Stock integration', () => {
  let user;
  let user2;
  let client;
  let selfPerson;
  let product;
  let component;
  let kit;
  let saleId;

  const uniqueSale = () => `V-${Date.now()}`;

  const createClient = async (userId) => {
    return prisma.person.create({
      data: { name: 'Cliente Estoque', userId },
    });
  };

  const getInventory = async (productId) =>
    prisma.inventory.findUnique({
      where: { userId_productId: { userId: user.userId, productId } },
    });

  const getMovements = async (productId) =>
    prisma.stockMovement.findMany({
      where: { userId: user.userId, productId },
      orderBy: { createdAt: 'asc' },
    });

  const createSale = async (items, extra = {}) => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ clientPersonId: client.id, ...extra, items });
    if (res.status === 201) saleId = res.body.id;
    return res;
  };

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('salestk');
    user2 = await registerUser('salestk2');
    client = await createClient(user.userId);
    selfPerson = await prisma.person.create({
      data: { name: 'Eu', isSelf: true, userId: user.userId },
    });
    product = await createProduct(Math.floor(Math.random() * 100000));
    component = await createProduct(Math.floor(Math.random() * 100000));
    kit = await createProduct(Math.floor(Math.random() * 100000), {
      productType: 'KIT',
    });
    await prisma.kitComposition.create({
      data: {
        kitProductId: kit.id,
        componentProductId: component.id,
        quantity: 2,
      },
    });
  });

  afterAll(async () => {
    await prisma.stockMovement
      .deleteMany({ where: { userId: user.userId } })
      .catch(() => {});
    await prisma.inventory
      .deleteMany({ where: { userId: user.userId } })
      .catch(() => {});
    if (user) {
      await prisma.user.delete({ where: { id: user.userId } }).catch(() => {});
    }
    if (user2) {
      await prisma.user.delete({ where: { id: user2.userId } }).catch(() => {});
    }
    await prisma.kitComposition
      .deleteMany({ where: { kitProductId: kit.id } })
      .catch(() => {});
    await prisma.product
      .deleteMany({ where: { id: { in: [product.id, component.id, kit.id] } } })
      .catch(() => {});
    await prisma.product
      .deleteMany({ where: { code: { startsWith: 'TESTSALESTK' } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (saleId) {
      await prisma.order.delete({ where: { id: saleId } }).catch(() => {});
      saleId = null;
    }
    await prisma.stockMovement
      .deleteMany({ where: { userId: user.userId } })
      .catch(() => {});
    await prisma.inventory
      .deleteMany({ where: { userId: user.userId } })
      .catch(() => {});
  });

  describe('createSale stock deduction', () => {
    it('deducts stock (SAIDA) and links the movement to the sale/item', async () => {
      await seedStock(user.userId, product.id, 10);
      const res = await createSale([
        { productId: product.id, chargedValue: 50, quantity: 4 },
      ]);

      expect(res.status).toBe(201);
      const inv = await getInventory(product.id);
      expect(inv.quantity).toBe(6);

      const movements = await getMovements(product.id);
      expect(movements).toHaveLength(1);
      expect(movements[0].type).toBe('SAIDA');
      expect(movements[0].quantity).toBe(-4);
      expect(movements[0].orderId).toBe(res.body.id);
      expect(movements[0].itemId).toBe(res.body.items[0].id);
      expect(movements[0].reason).toContain('Venda');
      expect(movements[0].orderType).toBeUndefined();
    });

    it('sets effectiveDate from the sale date', async () => {
      await seedStock(user.userId, product.id, 10);
      const res = await createSale(
        [{ productId: product.id, chargedValue: 50, quantity: 3 }],
        { orderDate: '2026-08-12' },
      );

      expect(res.status).toBe(201);
      const movements = await getMovements(product.id);
      const effective = new Date(movements[0].effectiveDate);
      expect(effective.getFullYear()).toBe(2026);
      expect(effective.getMonth()).toBe(7);
      expect(effective.getDate()).toBe(12);
      expect(effective.getHours()).toBe(0);
    });

    it('deducts each product of a multi-item sale', async () => {
      await seedStock(user.userId, product.id, 10);
      await seedStock(user.userId, component.id, 10);
      const res = await createSale([
        { productId: product.id, chargedValue: 10, quantity: 2 },
        { productId: component.id, chargedValue: 20, quantity: 3 },
      ]);
      expect(res.status).toBe(201);
      expect((await getInventory(product.id)).quantity).toBe(8);
      expect((await getInventory(component.id)).quantity).toBe(7);
      expect(res.body.items).toHaveLength(2);
    });

    it('rejects a sale that exceeds available stock and rolls back the order', async () => {
      await seedStock(user.userId, product.id, 2);
      const res = await createSale([
        { productId: product.id, chargedValue: 50, quantity: 3 },
      ]);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Estoque insuficiente');
      const created = await prisma.order.findFirst({
        where: { orderNumber: uniqueSale() },
      });
      expect(created).toBeNull();
      expect((await getInventory(product.id)).quantity).toBe(2);
      expect((await getMovements(product.id)).length).toBe(0);
      saleId = null;
    });

    it('does not deduct stock for a self person sale item (self rejected anyway)', async () => {
      await seedStock(user.userId, product.id, 5);
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          clientPersonId: selfPerson.id,
          items: [{ productId: product.id, chargedValue: 10, quantity: 1 }],
        });
      expect(res.status).toBe(400);
      expect((await getInventory(product.id)).quantity).toBe(5);
    });

    it('deducts kit components in COMPONENTS mode', async () => {
      await seedStock(user.userId, component.id, 10);
      const res = await createSale([
        {
          productId: kit.id,
          chargedValue: 100,
          quantity: 2,
          kitStockMode: 'COMPONENTS',
        },
      ]);
      expect(res.status).toBe(201);
      const inv = await getInventory(component.id);
      // 2 kits × 2 components per kit = 4 components
      expect(inv.quantity).toBe(6);
      const movements = await getMovements(component.id);
      expect(movements).toHaveLength(1);
      expect(movements[0].quantity).toBe(-4);
    });

    it('deducts the kit product itself in KIT mode', async () => {
      await seedStock(user.userId, kit.id, 5);
      await seedStock(user.userId, component.id, 100);
      const res = await createSale([
        {
          productId: kit.id,
          chargedValue: 100,
          quantity: 2,
          kitStockMode: 'KIT',
        },
      ]);
      expect(res.status).toBe(201);
      expect((await getInventory(kit.id)).quantity).toBe(3);
      // components untouched
      expect((await getInventory(component.id)).quantity).toBe(100);
    });

    it('requires a kitStockMode when selling a KIT product', async () => {
      await seedStock(user.userId, kit.id, 5);
      const res = await createSale([
        { productId: kit.id, chargedValue: 100, quantity: 1 },
      ]);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('kitStockMode');
      saleId = null;
    });
  });

  describe('updateSale stock diff', () => {
    it('deducts the difference when increasing quantity', async () => {
      await seedStock(user.userId, product.id, 10);
      const created = await createSale([
        { productId: product.id, chargedValue: 50, quantity: 2 },
      ]);
      const itemId = created.body.items[0].id;

      const res = await request(app)
        .put(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [
            {
              id: itemId,
              productId: product.id,
              chargedValue: 50,
              quantity: 5,
            },
          ],
        });
      expect(res.status).toBe(200);
      expect((await getInventory(product.id)).quantity).toBe(5);
      const movements = await getMovements(product.id);
      expect(movements.map((m) => m.quantity)).toEqual([-2, -3]);
    });

    it('restores stock when reducing quantity (ENTRADA)', async () => {
      await seedStock(user.userId, product.id, 10);
      const created = await createSale([
        { productId: product.id, chargedValue: 50, quantity: 5 },
      ]);
      const itemId = created.body.items[0].id;

      const res = await request(app)
        .put(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [
            {
              id: itemId,
              productId: product.id,
              chargedValue: 50,
              quantity: 2,
            },
          ],
        });
      expect(res.status).toBe(200);
      expect((await getInventory(product.id)).quantity).toBe(8);
      const movements = await getMovements(product.id);
      expect(movements.map((m) => m.quantity)).toEqual([-5, 3]);
    });

    it('rejects an update that would exceed stock', async () => {
      await seedStock(user.userId, product.id, 4);
      const created = await createSale([
        { productId: product.id, chargedValue: 50, quantity: 3 },
      ]);
      const itemId = created.body.items[0].id;

      const res = await request(app)
        .put(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [
            {
              id: itemId,
              productId: product.id,
              chargedValue: 50,
              quantity: 5,
            },
          ],
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Estoque insuficiente');
      expect((await getInventory(product.id)).quantity).toBe(1);
    });

    it('restores the old product and deducts the new one on product change', async () => {
      await seedStock(user.userId, product.id, 10);
      await seedStock(user.userId, component.id, 10);
      const created = await createSale([
        { productId: product.id, chargedValue: 50, quantity: 2 },
      ]);
      const itemId = created.body.items[0].id;

      const res = await request(app)
        .put(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [
            {
              id: itemId,
              productId: component.id,
              chargedValue: 50,
              quantity: 3,
            },
          ],
        });
      expect(res.status).toBe(200);
      expect((await getInventory(product.id)).quantity).toBe(10);
      expect((await getInventory(component.id)).quantity).toBe(7);
    });

    it('restores stock when an item is removed', async () => {
      await seedStock(user.userId, product.id, 10);
      await seedStock(user.userId, component.id, 10);
      const created = await createSale([
        { productId: product.id, chargedValue: 50, quantity: 4 },
        { productId: component.id, chargedValue: 10, quantity: 1 },
      ]);
      const keepId = created.body.items[0].id;

      const res = await request(app)
        .put(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [
            {
              id: keepId,
              productId: product.id,
              chargedValue: 50,
              quantity: 4,
            },
          ],
        });
      expect(res.status).toBe(200);
      expect((await getInventory(component.id)).quantity).toBe(10);
      expect((await getInventory(product.id)).quantity).toBe(6);
    });
  });

  describe('deleteSale stock restoration', () => {
    it('restores all sold stock (ENTRADA)', async () => {
      await seedStock(user.userId, product.id, 10);
      const created = await createSale([
        { productId: product.id, chargedValue: 50, quantity: 4 },
      ]);
      const res = await request(app)
        .delete(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      expect((await getInventory(product.id)).quantity).toBe(10);
      const movements = await getMovements(product.id);
      expect(movements.map((m) => m.quantity)).toEqual([-4, 4]);
      saleId = null;
    });

    it('restores kit components in COMPONENTS mode', async () => {
      await seedStock(user.userId, component.id, 10);
      const created = await createSale([
        {
          productId: kit.id,
          chargedValue: 100,
          quantity: 2,
          kitStockMode: 'COMPONENTS',
        },
      ]);
      const res = await request(app)
        .delete(`/api/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      expect((await getInventory(component.id)).quantity).toBe(10);
      saleId = null;
    });
  });

  describe('undo guard and history for sale movements', () => {
    it('rejects undoing a sale-generated movement with a Venda label', async () => {
      await seedStock(user.userId, product.id, 10);
      await createSale([
        { productId: product.id, chargedValue: 50, quantity: 3 },
      ]);
      const movements = await getMovements(product.id);
      expect(movements).toHaveLength(1);

      const res = await request(app)
        .post(`/api/stock/movements/${movements[0].id}/undo`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Venda');
      expect(res.body.orderId).toBeDefined();
    });

    it('exposes the linked sale order with orderType in the history', async () => {
      await seedStock(user.userId, product.id, 10);
      const created = await createSale([
        { productId: product.id, chargedValue: 50, quantity: 3 },
      ]);
      const res = await request(app)
        .get(`/api/stock/${product.id}/history`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      expect(res.body[0].order).toEqual(
        expect.objectContaining({
          id: created.body.id,
          orderNumber: created.body.orderNumber,
          orderType: 'VENDA',
        }),
      );
    });

    it('does not expose another user stock movements', async () => {
      await seedStock(user.userId, product.id, 5);
      await createSale([
        { productId: product.id, chargedValue: 50, quantity: 1 },
      ]);
      const res = await request(app)
        .get(`/api/stock/${product.id}/history`)
        .set('Authorization', `Bearer ${user2.token}`);
      expect(res.status).toBe(404);
    });
  });
});

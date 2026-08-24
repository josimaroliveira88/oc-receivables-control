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
  return {
    userId: regRes.body.id,
    token: loginRes.body.token,
  };
};

const createSimpleProduct = async (code) => {
  const product = await prisma.product.create({
    data: {
      code,
      name: `Componente ${code}`,
      size: '15 ml',
      status: 'ATIVO',
      prices: {
        create: { regularPrice: 10, memberPrice: 7.5, pv: 1 },
      },
    },
  });
  return product;
};

// Kit "TESTKITORDERS-K" is composed of compA (qty 2) and compB (qty 1).
describe('Orders <-> Stock integration for kits', () => {
  let user;
  let compA;
  let compB;
  let compC;
  let kit;
  let selfPersonId;
  let regularPersonId;
  let orderId;

  const uniqueOrder = () =>
    `ORDKIT-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const getInventory = async (productId) =>
    prisma.inventory.findUnique({
      where: {
        userId_productId: { userId: user.userId, productId },
      },
    });

  const getMovements = async (productId) =>
    prisma.stockMovement.findMany({
      where: { userId: user.userId, productId },
      orderBy: { createdAt: 'asc' },
    });

  const createOrder = async (items, extra = {}) => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ orderNumber: uniqueOrder(), ...extra, items });
    if (res.status === 201) orderId = res.body.id;
    return res;
  };

  const kitStockItem = (overrides = {}) => ({
    description: 'Kit para estoque',
    chargedValue: 120,
    quantity: 1,
    forStock: true,
    personId: selfPersonId,
    productId: kit.id,
    kitStockMode: 'COMPONENTS',
    ...overrides,
  });

  const updateKitComposition = async (components) => {
    const res = await request(app)
      .put(`/api/products/${kit.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ components });
    expect(res.status).toBe(200);
  };

  const firstItemId = async () =>
    (await prisma.item.findFirst({ where: { orderId } })).id;

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('ordkit');
    const self = await prisma.person.create({
      data: { name: 'Eu Mesmo', isSelf: true, userId: user.userId },
    });
    selfPersonId = self.id;
    const regular = await prisma.person.create({
      data: { name: 'Cliente Kit', userId: user.userId },
    });
    regularPersonId = regular.id;

    const stamp = Math.floor(Math.random() * 100000);
    compA = await createSimpleProduct(`TESTKITORDERS-A-${stamp}`);
    compB = await createSimpleProduct(`TESTKITORDERS-B-${stamp}`);
    compC = await createSimpleProduct(`TESTKITORDERS-C-${stamp}`);
    kit = await prisma.product.create({
      data: {
        code: `TESTKITORDERS-K-${stamp}`,
        name: 'Kit Pedido',
        size: 'kit',
        status: 'ATIVO',
        productType: 'KIT',
        prices: {
          create: { regularPrice: 150, memberPrice: 120, pv: 15 },
        },
        kitComponents: {
          create: [
            { componentProductId: compA.id, quantity: 2 },
            { componentProductId: compB.id, quantity: 1 },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    if (orderId) {
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    }
    const productIds = [kit.id, compA.id, compB.id, compC.id];
    await prisma.kitComposition
      .deleteMany({
        where: {
          OR: [
            { kitProductId: { in: productIds } },
            { componentProductId: { in: productIds } },
          ],
        },
      })
      .catch(() => {});
    if (user) {
      await prisma.user.delete({ where: { id: user.userId } }).catch(() => {});
    }
    await prisma.product
      .deleteMany({ where: { id: { in: productIds } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (orderId) {
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
      orderId = null;
    }
    const productIds = [kit.id, compA.id, compB.id, compC.id];
    await prisma.stockMovement
      .deleteMany({ where: { productId: { in: productIds } } })
      .catch(() => {});
    await prisma.inventory
      .deleteMany({ where: { productId: { in: productIds } } })
      .catch(() => {});
    // Restore the kit composition, since snapshot tests mutate it.
    await prisma.kitComposition
      .deleteMany({ where: { kitProductId: kit.id } })
      .catch(() => {});
    await prisma.kitComposition
      .createMany({
        data: [
          { kitProductId: kit.id, componentProductId: compA.id, quantity: 2 },
          { kitProductId: kit.id, componentProductId: compB.id, quantity: 1 },
        ],
      })
      .catch(() => {});
  });

  describe('createOrder with kit stock items', () => {
    it('stocks the kit product in KIT mode', async () => {
      const res = await createOrder([
        kitStockItem({ quantity: 3, kitStockMode: 'KIT' }),
      ]);
      expect(res.status).toBe(201);

      const kitInv = await getInventory(kit.id);
      expect(kitInv.quantity).toBe(3);
      expect(await getInventory(compA.id)).toBeNull();
      expect(await getInventory(compB.id)).toBeNull();
    });

    it('stocks each component times quantity in COMPONENTS mode', async () => {
      const res = await createOrder([kitStockItem({ quantity: 2 })]);
      expect(res.status).toBe(201);

      const a = await getInventory(compA.id);
      const b = await getInventory(compB.id);
      expect(a.quantity).toBe(4); // 2 × 2
      expect(b.quantity).toBe(2); // 1 × 2
      expect(await getInventory(kit.id)).toBeNull();
    });

    it('records the frozen snapshot and mode on the item', async () => {
      const res = await createOrder([kitStockItem({})]);
      expect(res.status).toBe(201);

      const item = await prisma.item.findUnique({
        where: { id: res.body.items[0].id },
      });
      expect(item.kitStockMode).toBe('COMPONENTS');
      expect(item.kitSnapshot).toEqual([
        { componentProductId: compA.id, quantity: 2 },
        { componentProductId: compB.id, quantity: 1 },
      ]);
    });

    it('rejects a forStock kit item without a kitStockMode', async () => {
      const res = await createOrder([kitStockItem({ kitStockMode: null })]);
      expect(res.status).toBe(400);
    });

    it('normalizes kitStockMode to null for a non-kit product', async () => {
      const res = await createOrder([
        {
          description: 'Simples',
          chargedValue: 50,
          quantity: 3,
          forStock: true,
          personId: selfPersonId,
          productId: compA.id,
          kitStockMode: 'COMPONENTS',
        },
      ]);
      expect(res.status).toBe(201);

      const item = await prisma.item.findUnique({
        where: { id: res.body.items[0].id },
      });
      expect(item.kitStockMode).toBeNull();
      expect(await getInventory(compA.id)).toEqual(
        expect.objectContaining({ quantity: 3 }),
      );
    });

    it('does not create stock movements for a non-forStock kit item', async () => {
      const res = await createOrder([
        kitStockItem({ forStock: false, kitStockMode: null }),
      ]);
      expect(res.status).toBe(201);
      expect(await getMovements(kit.id)).toHaveLength(0);
      expect(await getMovements(compA.id)).toHaveLength(0);
    });
  });

  describe('frozen snapshot (requirement 5)', () => {
    it('keeps the creation-time composition when the kit changes and the order item is edited via updateOrder', async () => {
      await createOrder([kitStockItem({ quantity: 1 })]);
      const itemId = await firstItemId();

      // Kit composition changes: compC added. Must not affect the existing order.
      await updateKitComposition([
        { componentProductId: compA.id, quantity: 2 },
        { componentProductId: compB.id, quantity: 1 },
        { componentProductId: compC.id, quantity: 3 },
      ]);

      const res = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [
            {
              id: itemId,
              description: 'Kit para estoque',
              chargedValue: 120,
              quantity: 2,
              forStock: true,
              personId: selfPersonId,
              productId: kit.id,
              kitStockMode: 'COMPONENTS',
            },
          ],
        });

      expect(res.status).toBe(200);
      const a = await getInventory(compA.id);
      const b = await getInventory(compB.id);
      expect(a.quantity).toBe(4); // 2 × 2 using the frozen snapshot
      expect(b.quantity).toBe(2); // 1 × 2
      expect(await getInventory(compC.id)).toBeNull(); // never touched
    });

    it('keeps the frozen snapshot when the item quantity changes via updateItem', async () => {
      await createOrder([kitStockItem({ quantity: 1 })]);
      const itemId = await firstItemId();

      await updateKitComposition([
        { componentProductId: compA.id, quantity: 2 },
        { componentProductId: compC.id, quantity: 1 },
      ]);

      const res = await request(app)
        .put(`/api/orders/items/${itemId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ quantity: 3 });

      expect(res.status).toBe(200);
      const a = await getInventory(compA.id);
      const b = await getInventory(compB.id);
      expect(a.quantity).toBe(6); // 2 × 3 from the frozen snapshot
      expect(b.quantity).toBe(3); // 1 × 3 from the frozen snapshot
      expect(await getInventory(compC.id)).toBeNull();
    });
  });

  describe('updateItem stock adjustments for kits', () => {
    it('adjusts components when the quantity changes in COMPONENTS mode', async () => {
      await createOrder([kitStockItem({ quantity: 1 })]);
      const itemId = await firstItemId();

      const res = await request(app)
        .put(`/api/orders/items/${itemId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ quantity: 3 });

      expect(res.status).toBe(200);
      expect((await getInventory(compA.id)).quantity).toBe(6);
      expect((await getInventory(compB.id)).quantity).toBe(3);
    });

    it('moves stock from the kit to components when switching KIT -> COMPONENTS', async () => {
      await createOrder([kitStockItem({ quantity: 2, kitStockMode: 'KIT' })]);
      const itemId = await firstItemId();
      expect((await getInventory(kit.id)).quantity).toBe(2);

      const res = await request(app)
        .put(`/api/orders/items/${itemId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ kitStockMode: 'COMPONENTS' });

      expect(res.status).toBe(200);
      expect((await getInventory(kit.id)).quantity).toBe(0);
      expect((await getInventory(compA.id)).quantity).toBe(4);
      expect((await getInventory(compB.id)).quantity).toBe(2);
    });

    it('moves stock from components to the kit when switching COMPONENTS -> KIT', async () => {
      await createOrder([kitStockItem({ quantity: 2 })]);
      const itemId = await firstItemId();
      expect((await getInventory(compA.id)).quantity).toBe(4);

      const res = await request(app)
        .put(`/api/orders/items/${itemId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ kitStockMode: 'KIT' });

      expect(res.status).toBe(200);
      expect((await getInventory(kit.id)).quantity).toBe(2);
      expect((await getInventory(compA.id)).quantity).toBe(0);
      expect((await getInventory(compB.id)).quantity).toBe(0);
    });

    it('rejects turning the item into a forStock kit item without a mode', async () => {
      await createOrder([
        {
          description: 'Kit não estoque',
          chargedValue: 120,
          quantity: 1,
          forStock: false,
          personId: selfPersonId,
          productId: kit.id,
        },
      ]);
      const itemId = await firstItemId();

      const res = await request(app)
        .put(`/api/orders/items/${itemId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ forStock: true, kitStockMode: null });

      expect(res.status).toBe(400);
    });
  });

  describe('deleteItem / deleteOrder reversal for kits', () => {
    it('reverses each component when deleting a COMPONENTS-mode item', async () => {
      await createOrder([kitStockItem({ quantity: 2 })]);
      const itemId = await firstItemId();
      expect((await getInventory(compA.id)).quantity).toBe(4);

      const res = await request(app)
        .delete(`/api/orders/items/${itemId}`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(200);
      expect((await getInventory(compA.id)).quantity).toBe(0);
      expect((await getInventory(compB.id)).quantity).toBe(0);
    });

    it('reverses only the kit when deleting a KIT-mode item', async () => {
      await createOrder([kitStockItem({ quantity: 3, kitStockMode: 'KIT' })]);
      const itemId = await firstItemId();

      const res = await request(app)
        .delete(`/api/orders/items/${itemId}`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(200);
      expect((await getInventory(kit.id)).quantity).toBe(0);
      expect(await getInventory(compA.id)).toBeNull();
    });

    it('reverses each component when deleting an order with a COMPONENTS-mode item', async () => {
      await createOrder([kitStockItem({ quantity: 2 })]);
      expect((await getInventory(compA.id)).quantity).toBe(4);

      const res = await request(app)
        .delete(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(200);
      orderId = null;
      expect((await getInventory(compA.id)).quantity).toBe(0);
      expect((await getInventory(compB.id)).quantity).toBe(0);
    });
  });

  describe('addItemToOrder for kits', () => {
    it('adds each component when adding a COMPONENTS-mode kit item', async () => {
      await createOrder([
        {
          description: 'Item base',
          chargedValue: 10,
          personId: regularPersonId,
        },
      ]);

      const res = await request(app)
        .post(`/api/orders/${orderId}/items`)
        .set('Authorization', `Bearer ${user.token}`)
        .send(kitStockItem({ quantity: 2 }));

      expect(res.status).toBe(201);
      expect((await getInventory(compA.id)).quantity).toBe(4);
      expect((await getInventory(compB.id)).quantity).toBe(2);
      expect(await getInventory(kit.id)).toBeNull();
    });
  });
});

const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');
const {
  resolveKitSnapshot,
  expandItemToStockProducts,
} = require('../src/utils/kitStock');

const selfPersonId = 'self-person';

const stockItem = (overrides = {}) => ({
  productId: 'kit-1',
  quantity: 1,
  forStock: true,
  personId: selfPersonId,
  kitStockMode: 'KIT',
  kitSnapshot: null,
  ...overrides,
});

describe('expandItemToStockProducts', () => {
  it('returns an empty list when the item is not forStock', () => {
    expect(expandItemToStockProducts(stockItem({ forStock: false }))).toEqual(
      [],
    );
  });

  it('returns an empty list when the item has no productId', () => {
    expect(expandItemToStockProducts(stockItem({ productId: null }))).toEqual(
      [],
    );
  });

  it('expands a non-kit item to its own product', () => {
    expect(
      expandItemToStockProducts(
        stockItem({ productId: 'p1', quantity: 4, kitStockMode: null }),
      ),
    ).toEqual([{ productId: 'p1', quantity: 4 }]);
  });

  it('expands a KIT-mode item to the kit product itself', () => {
    expect(
      expandItemToStockProducts(
        stockItem({ quantity: 3, kitStockMode: 'KIT' }),
      ),
    ).toEqual([{ productId: 'kit-1', quantity: 3 }]);
  });

  it('expands a COMPONENTS-mode item to each snapshot component times quantity', () => {
    const item = stockItem({
      quantity: 2,
      kitStockMode: 'COMPONENTS',
      kitSnapshot: [
        { componentProductId: 'comp-a', quantity: 3 },
        { componentProductId: 'comp-b', quantity: 1 },
      ],
    });
    expect(expandItemToStockProducts(item)).toEqual([
      { productId: 'comp-a', quantity: 6 },
      { productId: 'comp-b', quantity: 2 },
    ]);
  });

  it('falls back to the kit product when COMPONENTS mode has no snapshot', () => {
    expect(
      expandItemToStockProducts(
        stockItem({ kitStockMode: 'COMPONENTS', kitSnapshot: [] }),
      ),
    ).toEqual([{ productId: 'kit-1', quantity: 1 }]);
  });

  it('defaults quantity to 1 when missing', () => {
    expect(
      expandItemToStockProducts(
        stockItem({ quantity: undefined, kitStockMode: null }),
      ),
    ).toEqual([{ productId: 'kit-1', quantity: 1 }]);
  });
});

describe('resolveKitSnapshot', () => {
  let authToken;
  let userId;
  let compA;
  let compB;

  beforeAll(async () => {
    await prisma.$connect();
    const username = `kit_stock_test_${Date.now()}`;
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
    const kits = await prisma.product.findMany({
      where: { code: { startsWith: 'TESTKITSTOCK' } },
      select: { id: true },
    });
    const ids = kits.map((k) => k.id);
    await prisma.kitComposition
      .deleteMany({
        where: {
          OR: [
            { kitProductId: { in: ids } },
            { componentProductId: { in: ids } },
          ],
        },
      })
      .catch(() => {});
    await prisma.product
      .deleteMany({ where: { code: { startsWith: 'TESTKITSTOCK' } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    compA = await prisma.product.create({
      data: {
        code: `TESTKITSTOCK-A-${Date.now()}`,
        name: 'Componente A',
        size: '15 ml',
        status: 'ATIVO',
        prices: {
          create: { regularPrice: 10, memberPrice: 7.5, pv: 1 },
        },
      },
    });
    compB = await prisma.product.create({
      data: {
        code: `TESTKITSTOCK-B-${Date.now()}`,
        name: 'Componente B',
        size: '15 ml',
        status: 'ATIVO',
        prices: {
          create: { regularPrice: 10, memberPrice: 7.5, pv: 1 },
        },
      },
    });
  });

  it('returns the current composition of a kit', async () => {
    const kit = await prisma.product.create({
      data: {
        code: `TESTKITSTOCK-K-${Date.now()}`,
        name: 'Kit',
        size: 'kit',
        status: 'ATIVO',
        productType: 'KIT',
        prices: {
          create: { regularPrice: 100, memberPrice: 80, pv: 10 },
        },
        kitComponents: {
          create: [
            { componentProductId: compA.id, quantity: 2 },
            { componentProductId: compB.id, quantity: 1 },
          ],
        },
      },
    });

    const snapshot = await resolveKitSnapshot(prisma, kit.id);
    expect(snapshot).toEqual([
      { componentProductId: compA.id, quantity: 2 },
      { componentProductId: compB.id, quantity: 1 },
    ]);
  });

  it('returns an empty array for a product with no composition', async () => {
    const simple = await prisma.product.create({
      data: {
        code: `TESTKITSTOCK-S-${Date.now()}`,
        name: 'Simples',
        size: '15 ml',
        status: 'ATIVO',
        prices: {
          create: { regularPrice: 10, memberPrice: 7.5, pv: 1 },
        },
      },
    });

    const snapshot = await resolveKitSnapshot(prisma, simple.id);
    expect(snapshot).toEqual([]);
  });
});

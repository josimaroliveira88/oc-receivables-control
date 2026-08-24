const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

describe('Kit products', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    await prisma.$connect();
    const username = `kit_products_test_${Date.now()}`;
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
      .deleteMany({ where: { code: { startsWith: 'TESTKIT' } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  const cleanupKitProducts = async () => {
    const kits = await prisma.product.findMany({
      where: { code: { startsWith: 'TESTKIT' } },
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
      .deleteMany({ where: { code: { startsWith: 'TESTKIT' } } })
      .catch(() => {});
  };

  afterEach(cleanupKitProducts);

  const simpleProduct = async (code) => {
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

  const baseKit = {
    code: 'TESTKIT001',
    name: 'Kit Bem-estar',
    size: 'kit',
    regularPrice: 150,
    memberPrice: 120,
    pv: 15,
    productType: 'KIT',
  };

  describe('POST /api/products with kit type', () => {
    it('should create a KIT product with its composition', async () => {
      const compA = await simpleProduct('TESTKIT-COMP-A');
      const compB = await simpleProduct('TESTKIT-COMP-B');

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...baseKit,
          components: [
            { componentProductId: compA.id, quantity: 2 },
            { componentProductId: compB.id, quantity: 1 },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.productType).toBe('KIT');
      expect(response.body.components).toHaveLength(2);
      expect(response.body.components).toEqual(
        expect.arrayContaining([
          { componentProductId: compA.id, quantity: 2 },
          { componentProductId: compB.id, quantity: 1 },
        ]),
      );

      const composition = await prisma.kitComposition.findMany({
        where: { kitProductId: response.body.id },
      });
      expect(composition).toHaveLength(2);
    });

    it('should default to SIMPLES when productType is omitted', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'TESTKIT-SIMPLES',
          name: 'Produto simples',
          size: '15 ml',
          regularPrice: 10,
          memberPrice: 7.5,
          pv: 1,
        });

      expect(response.status).toBe(201);
      expect(response.body.productType).toBe('SIMPLES');
      expect(response.body.components).toEqual([]);
    });

    it('should reject a KIT without any component', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...baseKit, components: [] });

      expect(response.status).toBe(400);
    });

    it('should reject a KIT with a non-existent component', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...baseKit,
          components: [
            {
              componentProductId: '00000000-0000-0000-0000-000000000000',
              quantity: 1,
            },
          ],
        });

      expect(response.status).toBe(400);
    });

    it('should reject a KIT that uses another KIT as a component', async () => {
      const comp = await simpleProduct('TESTKIT-COMP-K');
      await prisma.product.update({
        where: { id: comp.id },
        data: { productType: 'KIT' },
      });

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...baseKit,
          components: [{ componentProductId: comp.id, quantity: 1 }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject a malformed component UUID', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...baseKit,
          components: [{ componentProductId: 'not-a-uuid', quantity: 1 }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject a component with quantity zero or negative', async () => {
      const comp = await simpleProduct('TESTKIT-COMP-Z');

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...baseKit,
          components: [{ componentProductId: comp.id, quantity: 0 }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject duplicate components in the same kit', async () => {
      const comp = await simpleProduct('TESTKIT-COMP-D');

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...baseKit,
          components: [
            { componentProductId: comp.id, quantity: 1 },
            { componentProductId: comp.id, quantity: 2 },
          ],
        });

      expect(response.status).toBe(400);
    });

    it('should reject components when productType is SIMPLES', async () => {
      const comp = await simpleProduct('TESTKIT-COMP-S');

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'TESTKIT-WRONGTYPE',
          name: 'Simples com componentes',
          size: '15 ml',
          regularPrice: 10,
          memberPrice: 7.5,
          pv: 1,
          productType: 'SIMPLES',
          components: [{ componentProductId: comp.id, quantity: 1 }],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/products with kit type', () => {
    it('should list kits with productType and components', async () => {
      const comp = await simpleProduct('TESTKIT-COMP-L');
      const kit = await prisma.product.create({
        data: {
          code: 'TESTKIT-LIST',
          name: 'Kit Listagem',
          size: 'kit',
          status: 'ATIVO',
          productType: 'KIT',
          prices: {
            create: { regularPrice: 100, memberPrice: 80, pv: 10 },
          },
          kitComponents: {
            create: [{ componentProductId: comp.id, quantity: 3 }],
          },
        },
      });

      const response = await request(app)
        .get('/api/products?pageSize=all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const found = response.body.data.find((p) => p.id === kit.id);
      expect(found).toBeDefined();
      expect(found.productType).toBe('KIT');
      expect(found.components).toEqual([
        { componentProductId: comp.id, quantity: 3 },
      ]);
    });

    it('should return the composition on GET by id', async () => {
      const comp = await simpleProduct('TESTKIT-COMP-G');
      const kit = await prisma.product.create({
        data: {
          code: 'TESTKIT-GET',
          name: 'Kit Detalhe',
          size: 'kit',
          status: 'ATIVO',
          productType: 'KIT',
          prices: {
            create: { regularPrice: 100, memberPrice: 80, pv: 10 },
          },
          kitComponents: {
            create: [{ componentProductId: comp.id, quantity: 1 }],
          },
        },
      });

      const response = await request(app)
        .get(`/api/products/${kit.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.productType).toBe('KIT');
      expect(response.body.components).toEqual([
        { componentProductId: comp.id, quantity: 1 },
      ]);
    });
  });

  describe('PUT /api/products/:id with kit type', () => {
    let compA;
    let compB;

    beforeEach(async () => {
      compA = await simpleProduct('TESTKIT-COMP-U1');
      compB = await simpleProduct('TESTKIT-COMP-U2');
    });

    it('should convert a SIMPLES product into a KIT with components', async () => {
      const product = await prisma.product.create({
        data: {
          code: 'TESTKIT-TOKIT',
          name: 'Antes Simples',
          size: '15 ml',
          status: 'ATIVO',
          prices: {
            create: { regularPrice: 10, memberPrice: 7.5, pv: 1 },
          },
        },
      });

      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productType: 'KIT',
          components: [
            { componentProductId: compA.id, quantity: 1 },
            { componentProductId: compB.id, quantity: 2 },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.productType).toBe('KIT');
      expect(response.body.components).toHaveLength(2);
    });

    it('should replace the composition on update', async () => {
      const kit = await prisma.product.create({
        data: {
          code: 'TESTKIT-REPLACE',
          name: 'Kit Substituição',
          size: 'kit',
          status: 'ATIVO',
          productType: 'KIT',
          prices: {
            create: { regularPrice: 100, memberPrice: 80, pv: 10 },
          },
          kitComponents: {
            create: [{ componentProductId: compA.id, quantity: 1 }],
          },
        },
      });

      const response = await request(app)
        .put(`/api/products/${kit.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          components: [{ componentProductId: compB.id, quantity: 5 }],
        });

      expect(response.status).toBe(200);
      expect(response.body.components).toEqual([
        { componentProductId: compB.id, quantity: 5 },
      ]);

      const composition = await prisma.kitComposition.findMany({
        where: { kitProductId: kit.id },
      });
      expect(composition).toHaveLength(1);
      expect(composition[0].componentProductId).toBe(compB.id);
      expect(composition[0].quantity).toBe(5);
    });

    it('should clear the composition when converting back to SIMPLES', async () => {
      const kit = await prisma.product.create({
        data: {
          code: 'TESTKIT-TOSIMPLES',
          name: 'Kit para Simples',
          size: 'kit',
          status: 'ATIVO',
          productType: 'KIT',
          prices: {
            create: { regularPrice: 100, memberPrice: 80, pv: 10 },
          },
          kitComponents: {
            create: [{ componentProductId: compA.id, quantity: 1 }],
          },
        },
      });

      const response = await request(app)
        .put(`/api/products/${kit.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productType: 'SIMPLES' });

      expect(response.status).toBe(200);
      expect(response.body.productType).toBe('SIMPLES');
      expect(response.body.components).toEqual([]);

      const composition = await prisma.kitComposition.findMany({
        where: { kitProductId: kit.id },
      });
      expect(composition).toHaveLength(0);
    });

    it('should reject converting a KIT to SIMPLES while components remain', async () => {
      const kit = await prisma.product.create({
        data: {
          code: 'TESTKIT-BADMIX',
          name: 'Kit Inconsistente',
          size: 'kit',
          status: 'ATIVO',
          productType: 'KIT',
          prices: {
            create: { regularPrice: 100, memberPrice: 80, pv: 10 },
          },
          kitComponents: {
            create: [{ componentProductId: compA.id, quantity: 1 }],
          },
        },
      });

      const response = await request(app)
        .put(`/api/products/${kit.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productType: 'SIMPLES',
          components: [{ componentProductId: compA.id, quantity: 1 }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject a KIT that references itself as a component', async () => {
      const kit = await prisma.product.create({
        data: {
          code: 'TESTKIT-SELFU',
          name: 'Kit Autorreferente',
          size: 'kit',
          status: 'ATIVO',
          productType: 'KIT',
          prices: {
            create: { regularPrice: 100, memberPrice: 80, pv: 10 },
          },
          kitComponents: {
            create: [{ componentProductId: compA.id, quantity: 1 }],
          },
        },
      });

      const response = await request(app)
        .put(`/api/products/${kit.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          components: [{ componentProductId: kit.id, quantity: 1 }],
        });

      expect(response.status).toBe(400);
    });

    it('should reject update to KIT without any component', async () => {
      const product = await prisma.product.create({
        data: {
          code: 'TESTKIT-EMPTY',
          name: 'Kit Vazio',
          size: 'kit',
          status: 'ATIVO',
          prices: {
            create: { regularPrice: 10, memberPrice: 7.5, pv: 1 },
          },
        },
      });

      const response = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productType: 'KIT', components: [] });

      expect(response.status).toBe(400);
    });
  });
});

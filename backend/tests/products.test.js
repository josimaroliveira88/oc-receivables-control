const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

describe('Products CRUD', () => {
  let authToken;
  let userId;
  const createdProductCodes = [];

  beforeAll(async () => {
    await prisma.$connect();
    const username = `products_test_${Date.now()}`;
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
    await prisma.product.deleteMany({ where: { code: { startsWith: 'TESTCRUD' } } }).catch(() => {});
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.product
      .deleteMany({ where: { code: { startsWith: 'TESTCRUD' } } })
      .catch(() => {});
    createdProductCodes.length = 0;
  });

  describe('POST /api/products', () => {
    it('should create a new product with an initial active price', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'TESTCRUD001',
          name: 'Óleo Essencial de Lavanda',
          size: '15 ml',
          regularPrice: 103.0,
          memberPrice: 77.5,
          pv: 9,
        });

      expect(response.status).toBe(201);
      expect(response.body.code).toBe('TESTCRUD001');
      expect(response.body.name).toBe('Óleo Essencial de Lavanda');
      expect(response.body.size).toBe('15 ml');
      expect(response.body.active).toBe(true);
      expect(parseFloat(response.body.regularPrice)).toBe(103.0);
      expect(parseFloat(response.body.memberPrice)).toBe(77.5);
      expect(parseFloat(response.body.pv)).toBe(9.0);

      const product = await prisma.product.findUnique({
        where: { code: 'TESTCRUD001' },
        include: { prices: true },
      });
      expect(product).not.toBeNull();
      expect(product.prices).toHaveLength(1);
      expect(product.prices[0].validTo).toBeNull();
    });

    it('should reject request with missing code', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Produto Sem Código',
          size: '15 ml',
          regularPrice: 10,
          memberPrice: 7.5,
          pv: 1,
        });

      expect(response.status).toBe(400);
    });

    it('should reject request with empty name', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'TESTCRUD002',
          name: '',
          size: '15 ml',
          regularPrice: 10,
          memberPrice: 7.5,
          pv: 1,
        });

      expect(response.status).toBe(400);
    });

    it('should reject request with negative price', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'TESTCRUD003',
          name: 'Produto Inválido',
          size: '15 ml',
          regularPrice: -5,
          memberPrice: 7.5,
          pv: 1,
        });

      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate code', async () => {
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'TESTCRUD004',
          name: 'Primeiro Produto',
          size: '15 ml',
          regularPrice: 10,
          memberPrice: 7.5,
          pv: 1,
        });

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'TESTCRUD004',
          name: 'Segundo Produto',
          size: '15 ml',
          regularPrice: 12,
          memberPrice: 9,
          pv: 2,
        });

      expect(response.status).toBe(409);
    });

    it('should return 401 when no authentication token is provided', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({
          code: 'TESTCRUD005',
          name: 'Sem Auth',
          size: '15 ml',
          regularPrice: 10,
          memberPrice: 7.5,
          pv: 1,
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should return 403 when invalid authentication token is provided', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          code: 'TESTCRUD006',
          name: 'Token Inválido',
          size: '15 ml',
          regularPrice: 10,
          memberPrice: 7.5,
          pv: 1,
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('GET /api/products', () => {
    beforeEach(async () => {
      await prisma.product.create({
        data: {
          code: 'TESTCRUD100',
          name: 'Lavanda',
          size: '15 ml',
          active: true,
          prices: {
            create: {
              regularPrice: 103,
              memberPrice: 77.5,
              pv: 9,
            },
          },
        },
      });
      await prisma.product.create({
        data: {
          code: 'TESTCRUD101',
          name: 'Hortelã-Pimenta',
          size: '15 ml',
          active: false,
          prices: {
            create: {
              regularPrice: 99,
              memberPrice: 74.25,
              pv: 9,
            },
          },
        },
      });
    });

    it('should return products with current price projected', async () => {
      const response = await request(app)
        .get('/api/products?q=TESTCRUD')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);

      const created = response.body.data;
      expect(created).toHaveLength(2);
      const lavanda = created.find((p) => p.code === 'TESTCRUD100');
      expect(lavanda).toBeDefined();
      expect(lavanda.name).toBe('Lavanda');
      expect(parseFloat(lavanda.regularPrice)).toBe(103);
      expect(parseFloat(lavanda.memberPrice)).toBe(77.5);
      expect(parseFloat(lavanda.pv)).toBe(9);
    });

    it('should filter by active=true', async () => {
      const response = await request(app)
        .get('/api/products?active=true')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      for (const product of response.body.data) {
        expect(product.active).toBe(true);
      }
    });

    it('should search products by partial name (case-insensitive)', async () => {
      const response = await request(app)
        .get('/api/products?q=HORTEL')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const testProducts = response.body.data.filter((p) => p.code.startsWith('TESTCRUD'));
      expect(testProducts).toHaveLength(1);
      expect(testProducts[0].code).toBe('TESTCRUD101');
      expect(testProducts[0].name).toBe('Hortelã-Pimenta');
    });

    it('should search products by code', async () => {
      const response = await request(app)
        .get('/api/products?q=TESTCRUD100')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const testProducts = response.body.data.filter((p) => p.code.startsWith('TESTCRUD'));
      expect(testProducts).toHaveLength(1);
      expect(testProducts[0].code).toBe('TESTCRUD100');
    });

    it('should combine search and active filter', async () => {
      const response = await request(app)
        .get('/api/products?q=Hortel&active=true')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const testProducts = response.body.data.filter((p) => p.code.startsWith('TESTCRUD'));
      expect(testProducts).toHaveLength(0);
    });

    it('should return 401 when no authentication token is provided', async () => {
      const response = await request(app).get('/api/products');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/products sorting & pagination', () => {
    beforeEach(async () => {
      const products = [
        { code: 'TESTCRUD110', name: 'Óleo de Lavanda', size: '15 ml', regularPrice: 103, memberPrice: 77.5, pv: 9 },
        { code: 'TESTCRUD111', name: 'Óleo de Hortelã', size: '15 ml', regularPrice: 140, memberPrice: 105, pv: 15 },
        { code: 'TESTCRUD112', name: 'Óleo de Olíbano', size: '15 ml', regularPrice: 250, memberPrice: 187.5, pv: 30 },
        { code: 'TESTCRUD113', name: 'Óleo de Limão', size: '15 ml', regularPrice: 120, memberPrice: 90, pv: 12 },
      ];
      for (const product of products) {
        await prisma.product.create({
          data: {
            code: product.code,
            name: product.name,
            size: product.size,
            active: true,
            prices: {
              create: {
                regularPrice: product.regularPrice,
                memberPrice: product.memberPrice,
                pv: product.pv,
              },
            },
          },
        });
      }
    });

    it('should default to sorting by name ascending', async () => {
      const response = await request(app)
        .get('/api/products?q=TESTCRUD11')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.map((p) => p.code)).toEqual([
        'TESTCRUD111',
        'TESTCRUD110',
        'TESTCRUD113',
        'TESTCRUD112',
      ]);
    });

    it('should sort by pv descending', async () => {
      const response = await request(app)
        .get('/api/products?q=TESTCRUD11&sortBy=pv&sortDir=desc')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.map((p) => p.code)).toEqual([
        'TESTCRUD112',
        'TESTCRUD111',
        'TESTCRUD113',
        'TESTCRUD110',
      ]);
    });

    it('should sort by regularPrice ascending', async () => {
      const response = await request(app)
        .get('/api/products?q=TESTCRUD11&sortBy=regularPrice&sortDir=asc')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.map((p) => p.code)).toEqual([
        'TESTCRUD110',
        'TESTCRUD113',
        'TESTCRUD111',
        'TESTCRUD112',
      ]);
    });

    it('should sort by memberPrice descending', async () => {
      const response = await request(app)
        .get('/api/products?q=TESTCRUD11&sortBy=memberPrice&sortDir=desc')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.map((p) => p.code)).toEqual([
        'TESTCRUD112',
        'TESTCRUD111',
        'TESTCRUD113',
        'TESTCRUD110',
      ]);
    });

    it('should paginate results with page and pageSize', async () => {
      const page1 = await request(app)
        .get('/api/products?q=TESTCRUD11&page=1&pageSize=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(page1.status).toBe(200);
      expect(page1.body.pagination.total).toBe(4);
      expect(page1.body.pagination.totalPages).toBe(2);
      expect(page1.body.pagination.hasMore).toBe(true);
      expect(page1.body.data.map((p) => p.code)).toEqual(['TESTCRUD111', 'TESTCRUD110']);

      const page2 = await request(app)
        .get('/api/products?q=TESTCRUD11&page=2&pageSize=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(page2.status).toBe(200);
      expect(page2.body.pagination.page).toBe(2);
      expect(page2.body.pagination.hasMore).toBe(false);
      expect(page2.body.data.map((p) => p.code)).toEqual(['TESTCRUD113', 'TESTCRUD112']);
    });

    it('should clamp pageSize to the maximum allowed', async () => {
      const response = await request(app)
        .get('/api/products?q=TESTCRUD11&pageSize=1000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.pageSize).toBe(100);
      expect(response.body.pagination.hasMore).toBe(false);
    });

    it('should return the full list when pageSize is all', async () => {
      const response = await request(app)
        .get('/api/products?q=TESTCRUD11&pageSize=all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(4);
      expect(response.body.pagination.pageSize).toBe(4);
      expect(response.body.pagination.total).toBe(4);
      expect(response.body.pagination.totalPages).toBe(1);
      expect(response.body.pagination.hasMore).toBe(false);
    });
  });

  describe('GET /api/products/:id', () => {
    let productId;

    beforeEach(async () => {
      const product = await prisma.product.create({
        data: {
          code: 'TESTCRUD200',
          name: 'Olíbano',
          size: '5 ml',
          active: true,
          prices: {
            create: {
              regularPrice: 250,
              memberPrice: 187.5,
              pv: 30,
            },
          },
        },
      });
      productId = product.id;
    });

    it('should return a single product with current price', async () => {
      const response = await request(app)
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(productId);
      expect(response.body.name).toBe('Olíbano');
      expect(parseFloat(response.body.regularPrice)).toBe(250);
      expect(response.body.active).toBe(true);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/products/:id', () => {
    let productId;

    beforeEach(async () => {
      const product = await prisma.product.create({
        data: {
          code: 'TESTCRUD300',
          name: 'Nome Original',
          size: '15 ml',
          active: true,
          prices: {
            create: {
              regularPrice: 100,
              memberPrice: 75,
              pv: 10,
            },
          },
        },
      });
      productId = product.id;
    });

    it('should update name and size', async () => {
      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Nome Atualizado', size: '30 ml' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Nome Atualizado');
      expect(response.body.size).toBe('30 ml');
      expect(response.body.code).toBe('TESTCRUD300');
    });

    it('should not allow the code to be changed', async () => {
      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Nome Atualizado', code: 'HACKEDCODE' });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe('TESTCRUD300');

      const product = await prisma.product.findUnique({ where: { id: productId } });
      expect(product.code).toBe('TESTCRUD300');
    });

    it('should toggle active flag', async () => {
      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ active: false });

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(false);
    });

    it('should create a new price record and close the old one when price changes', async () => {
      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ regularPrice: 120, memberPrice: 90, pv: 12 });

      expect(response.status).toBe(200);
      expect(parseFloat(response.body.regularPrice)).toBe(120);

      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { prices: { orderBy: { validFrom: 'asc' } } },
      });
      expect(product.prices).toHaveLength(2);
      expect(parseFloat(product.prices[0].regularPrice)).toBe(100);
      expect(product.prices[0].validTo).not.toBeNull();
      expect(parseFloat(product.prices[1].regularPrice)).toBe(120);
      expect(product.prices[1].validTo).toBeNull();
    });

    it('should not create a new price record when price is unchanged', async () => {
      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ regularPrice: 100, memberPrice: 75, pv: 10 });

      expect(response.status).toBe(200);

      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { prices: true },
      });
      expect(product.prices).toHaveLength(1);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .put('/api/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Novo Nome' });

      expect(response.status).toBe(404);
    });

    it('should reject update with invalid data', async () => {
      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/products/:id', () => {
    let productId;

    beforeEach(async () => {
      const product = await prisma.product.create({
        data: {
          code: 'TESTCRUD400',
          name: 'Produto para Deletar',
          size: '15 ml',
          active: true,
          prices: {
            create: {
              regularPrice: 50,
              memberPrice: 37.5,
              pv: 5,
            },
          },
        },
      });
      productId = product.id;
    });

    it('should soft-delete a product by setting active to false', async () => {
      const response = await request(app)
        .delete(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Product deactivated successfully');

      const product = await prisma.product.findUnique({ where: { id: productId } });
      expect(product.active).toBe(false);
      expect(product).not.toBeNull();
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .delete('/api/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});

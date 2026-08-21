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
    username,
  };
};

const createTestProduct = async (codeSuffix) => {
  const product = await prisma.product.create({
    data: {
      code: `TESTSTOCK${codeSuffix}`,
      name: 'Óleo de Teste',
      size: '15 ml',
      status: 'ATIVO',
      prices: {
        create: {
          regularPrice: 100,
          memberPrice: 75,
          pv: 10,
        },
      },
    },
  });
  return product;
};

describe('Stock API', () => {
  let userA;
  let userB;

  beforeAll(async () => {
    await prisma.$connect();
    userA = await registerUser('stock_a');
    userB = await registerUser('stock_b');
  });

  afterAll(async () => {
    if (userA) {
      await prisma.user.delete({ where: { id: userA.userId } }).catch(() => {});
    }
    if (userB) {
      await prisma.user.delete({ where: { id: userB.userId } }).catch(() => {});
    }
    await prisma.product
      .deleteMany({ where: { code: { startsWith: 'TESTSTOCK' } } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  describe('Authentication', () => {
    it('should return 401 for GET /api/stock without token', async () => {
      const response = await request(app).get('/api/stock');
      expect(response.status).toBe(401);
    });

    it('should return 401 for GET /api/stock/:productId/history without token', async () => {
      const response = await request(app).get(
        '/api/stock/00000000-0000-0000-0000-000000000000/history',
      );
      expect(response.status).toBe(401);
    });

    it('should return 401 for POST /api/stock/movements without token', async () => {
      const response = await request(app).post('/api/stock/movements').send({});
      expect(response.status).toBe(401);
    });

    it('should return 403 for GET /api/stock with invalid token', async () => {
      const response = await request(app)
        .get('/api/stock')
        .set('Authorization', 'Bearer invalid-token');
      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/stock/movements', () => {
    let product;

    beforeEach(async () => {
      product = await createTestProduct(
        `M${Math.floor(Math.random() * 100000)}`,
      );
    });

    afterEach(async () => {
      await prisma.stockMovement
        .deleteMany({ where: { productId: product.id } })
        .catch(() => {});
      await prisma.inventory
        .deleteMany({ where: { productId: product.id } })
        .catch(() => {});
      await prisma.product
        .deleteMany({ where: { id: product.id } })
        .catch(() => {});
    });

    it('should register an ENTRADA movement and increment inventory', async () => {
      const response = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          productId: product.id,
          type: 'ENTRADA',
          quantity: 5,
          reason: 'Compra inicial',
        });

      expect(response.status).toBe(201);
      expect(response.body.movement.type).toBe('ENTRADA');
      expect(response.body.movement.quantity).toBe(5);
      expect(response.body.movement.reason).toBe('Compra inicial');
      expect(response.body.movement.orderId).toBeNull();
      expect(response.body.movement.itemId).toBeNull();
      expect(response.body.inventory.quantity).toBe(5);

      const inventory = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: userA.userId, productId: product.id },
        },
      });
      expect(inventory).not.toBeNull();
      expect(inventory.quantity).toBe(5);
    });

    it('should register a SAIDA movement and decrement inventory', async () => {
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 10 });

      const response = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          productId: product.id,
          type: 'SAIDA',
          quantity: 4,
          reason: 'Uso pessoal',
        });

      expect(response.status).toBe(201);
      expect(response.body.movement.type).toBe('SAIDA');
      expect(response.body.movement.quantity).toBe(-4);
      expect(response.body.inventory.quantity).toBe(6);
    });

    it('should reject a SAIDA that would make stock negative', async () => {
      const response = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'SAIDA', quantity: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/negative/i);

      const inventory = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: userA.userId, productId: product.id },
        },
      });
      expect(inventory).toBeNull();
    });

    it('should register an AJUSTE that sets an absolute balance', async () => {
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 8 });

      const response = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          productId: product.id,
          type: 'AJUSTE',
          quantity: 3,
          reason: 'Contagem',
        });

      expect(response.status).toBe(201);
      expect(response.body.movement.type).toBe('AJUSTE');
      expect(response.body.movement.quantity).toBe(-5);
      expect(response.body.inventory.quantity).toBe(3);
    });

    it('should register an AJUSTE that increases the balance with positive delta', async () => {
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 2 });

      const response = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'AJUSTE', quantity: 9 });

      expect(response.status).toBe(201);
      expect(response.body.movement.quantity).toBe(7);
      expect(response.body.inventory.quantity).toBe(9);
    });

    it('should reject quantity 0 for ENTRADA', async () => {
      const response = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 0 });

      expect(response.status).toBe(400);
    });

    it('should reject quantity 0 for SAIDA', async () => {
      const response = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'SAIDA', quantity: 0 });

      expect(response.status).toBe(400);
    });

    it('should reject non-integer quantity', async () => {
      const response = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 2.5 });

      expect(response.status).toBe(400);
    });

    it('should reject missing quantity', async () => {
      const response = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA' });

      expect(response.status).toBe(400);
    });

    it('should reject an invalid type', async () => {
      const response = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'INVALIDO', quantity: 5 });

      expect(response.status).toBe(400);
    });

    it('should reject a non-existent product', async () => {
      const response = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          productId: '00000000-0000-0000-0000-000000000000',
          type: 'ENTRADA',
          quantity: 5,
        });

      expect(response.status).toBe(404);
    });

    it('should reject a too-long reason', async () => {
      const response = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          productId: product.id,
          type: 'ENTRADA',
          quantity: 5,
          reason: 'x'.repeat(256),
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/stock', () => {
    let product;

    beforeEach(async () => {
      product = await createTestProduct(
        `L${Math.floor(Math.random() * 100000)}`,
      );
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 7 });
    });

    afterEach(async () => {
      await prisma.stockMovement
        .deleteMany({ where: { productId: product.id } })
        .catch(() => {});
      await prisma.inventory
        .deleteMany({ where: { productId: product.id } })
        .catch(() => {});
      await prisma.product
        .deleteMany({ where: { id: product.id } })
        .catch(() => {});
    });

    it('should return only the logged-in user inventory with product info', async () => {
      const response = await request(app)
        .get('/api/stock')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      const entry = response.body.find((i) => i.productId === product.id);
      expect(entry).toBeDefined();
      expect(entry.code).toBe(product.code);
      expect(entry.name).toBe(product.name);
      expect(entry.size).toBe(product.size);
      expect(entry.quantity).toBe(7);
    });

    it('should not expose other users inventory', async () => {
      const response = await request(app)
        .get('/api/stock')
        .set('Authorization', `Bearer ${userB.token}`);

      expect(response.status).toBe(200);
      expect(
        response.body.find((i) => i.productId === product.id),
      ).toBeUndefined();
    });
  });

  describe('GET /api/stock — search and sorting', () => {
    let productA;
    let productB;

    beforeEach(async () => {
      productA = await prisma.product.create({
        data: {
          code: `TESTSTOCKA${Math.floor(Math.random() * 100000)}`,
          name: 'Alfa Óleo Essencial',
          size: '15 ml',
          status: 'ATIVO',
          prices: {
            create: { regularPrice: 100, memberPrice: 75, pv: 10 },
          },
        },
      });
      productB = await prisma.product.create({
        data: {
          code: `TESTSTOCKB${Math.floor(Math.random() * 100000)}`,
          name: 'Beta Lavanda',
          size: '5 ml',
          status: 'ATIVO',
          prices: {
            create: { regularPrice: 50, memberPrice: 40, pv: 5 },
          },
        },
      });
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: productA.id, type: 'ENTRADA', quantity: 3 });
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: productB.id, type: 'ENTRADA', quantity: 10 });
    });

    afterEach(async () => {
      await prisma.stockMovement
        .deleteMany({
          where: { productId: { in: [productA.id, productB.id] } },
        })
        .catch(() => {});
      await prisma.inventory
        .deleteMany({
          where: { productId: { in: [productA.id, productB.id] } },
        })
        .catch(() => {});
      await prisma.product
        .deleteMany({ where: { id: { in: [productA.id, productB.id] } } })
        .catch(() => {});
    });

    it('should search inventory by product name (case-insensitive)', async () => {
      const response = await request(app)
        .get('/api/stock?q=lavanda')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(response.status).toBe(200);
      const codes = response.body.map((i) => i.code);
      expect(codes).toContain(productB.code);
      expect(codes).not.toContain(productA.code);
    });

    it('should search inventory by product code', async () => {
      const response = await request(app)
        .get(`/api/stock?q=${productA.code}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(response.status).toBe(200);
      const codes = response.body.map((i) => i.code);
      expect(codes).toContain(productA.code);
      expect(codes).not.toContain(productB.code);
    });

    it('should sort by quantity descending', async () => {
      const response = await request(app)
        .get('/api/stock?sortBy=quantity&sortDir=desc')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(response.status).toBe(200);
      const quantities = response.body.map((i) => i.quantity);
      expect(quantities).toEqual([10, 3]);
    });

    it('should sort by product name ascending', async () => {
      const response = await request(app)
        .get('/api/stock?sortBy=name&sortDir=asc')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(response.status).toBe(200);
      const names = response.body.map((i) => i.name);
      expect(names).toEqual(['Alfa Óleo Essencial', 'Beta Lavanda']);
    });

    it('should not expose other users inventory when searching', async () => {
      const response = await request(app)
        .get('/api/stock?q=lavanda')
        .set('Authorization', `Bearer ${userB.token}`);

      expect(response.status).toBe(200);
      expect(
        response.body.find((i) => i.productId === productB.id),
      ).toBeUndefined();
    });

    it('should match an accented product name when searching with an unaccented term', async () => {
      // productA is "Alfa Óleo Essencial" (accented). Search with unaccented
      // "oleo" should still match it.
      const response = await request(app)
        .get('/api/stock?q=oleo')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(response.status).toBe(200);
      const codes = response.body.map((i) => i.code);
      expect(codes).toContain(productA.code);
      expect(codes).not.toContain(productB.code);
    });

    it('should match an unaccented product name when searching with an accented term', async () => {
      const plainProduct = await prisma.product.create({
        data: {
          code: `TESTSTOCKPLAIN${Math.floor(Math.random() * 100000)}`,
          name: 'Oleo de Manha',
          size: '10 ml',
          status: 'ATIVO',
          prices: {
            create: { regularPrice: 80, memberPrice: 60, pv: 8 },
          },
        },
      });
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: plainProduct.id, type: 'ENTRADA', quantity: 2 });

      try {
        const response = await request(app)
          .get(`/api/stock?q=${encodeURIComponent('Óleo')}`)
          .set('Authorization', `Bearer ${userA.token}`);

        expect(response.status).toBe(200);
        const codes = response.body.map((i) => i.code);
        expect(codes).toContain(plainProduct.code);
      } finally {
        await prisma.stockMovement
          .deleteMany({ where: { productId: plainProduct.id } })
          .catch(() => {});
        await prisma.inventory
          .deleteMany({ where: { productId: plainProduct.id } })
          .catch(() => {});
        await prisma.product
          .delete({ where: { id: plainProduct.id } })
          .catch(() => {});
      }
    });
  });

  describe('GET /api/stock/:productId/history', () => {
    let product;

    beforeEach(async () => {
      product = await createTestProduct(
        `H${Math.floor(Math.random() * 100000)}`,
      );
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          productId: product.id,
          type: 'ENTRADA',
          quantity: 5,
          reason: 'Primeira',
        });
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          productId: product.id,
          type: 'SAIDA',
          quantity: 2,
          reason: 'Segunda',
        });
    });

    afterEach(async () => {
      await prisma.stockMovement
        .deleteMany({ where: { productId: product.id } })
        .catch(() => {});
      await prisma.inventory
        .deleteMany({ where: { productId: product.id } })
        .catch(() => {});
      await prisma.product
        .deleteMany({ where: { id: product.id } })
        .catch(() => {});
    });

    it('should return the history for the product of the logged-in user', async () => {
      const response = await request(app)
        .get(`/api/stock/${product.id}/history`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);

      const saida = response.body.find((m) => m.type === 'SAIDA');
      expect(saida.quantity).toBe(-2);
      const entrada = response.body.find((m) => m.type === 'ENTRADA');
      expect(entrada.quantity).toBe(5);
    });

    it('should not return history of another user for the same product', async () => {
      const response = await request(app)
        .get(`/api/stock/${product.id}/history`)
        .set('Authorization', `Bearer ${userB.token}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for a non-existent product', async () => {
      const response = await request(app)
        .get('/api/stock/00000000-0000-0000-0000-000000000000/history')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('User isolation', () => {
    let product;

    beforeEach(async () => {
      product = await createTestProduct(
        `I${Math.floor(Math.random() * 100000)}`,
      );
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 4 });
    });

    afterEach(async () => {
      await prisma.stockMovement
        .deleteMany({ where: { productId: product.id } })
        .catch(() => {});
      await prisma.inventory
        .deleteMany({ where: { productId: product.id } })
        .catch(() => {});
      await prisma.product
        .deleteMany({ where: { id: product.id } })
        .catch(() => {});
    });

    it('should let user B register its own movement without touching user A stock', async () => {
      const response = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 2 });

      expect(response.status).toBe(201);
      expect(response.body.inventory.quantity).toBe(2);

      const inventoryA = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: userA.userId, productId: product.id },
        },
      });
      expect(inventoryA.quantity).toBe(4);

      const inventoryB = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: userB.userId, productId: product.id },
        },
      });
      expect(inventoryB.quantity).toBe(2);
    });
  });

  describe('POST /api/stock/movements/:id/undo', () => {
    let product;

    beforeEach(async () => {
      product = await createTestProduct(
        `U${Math.floor(Math.random() * 100000)}`,
      );
    });

    afterEach(async () => {
      await prisma.stockMovement
        .deleteMany({ where: { productId: product.id } })
        .catch(() => {});
      await prisma.inventory
        .deleteMany({ where: { productId: product.id } })
        .catch(() => {});
      await prisma.product
        .deleteMany({ where: { id: product.id } })
        .catch(() => {});
    });

    it('should return 401 without a token', async () => {
      const response = await request(app).post(
        `/api/stock/movements/00000000-0000-0000-0000-000000000000/undo`,
      );
      expect(response.status).toBe(401);
    });

    it('should undo the last ENTRADA and decrement the inventory', async () => {
      const entradaRes = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 10 });

      const saidaRes = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'SAIDA', quantity: 3 });
      expect(saidaRes.body.inventory.quantity).toBe(7);

      const undoRes = await request(app)
        .post(`/api/stock/movements/${saidaRes.body.movement.id}/undo`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(undoRes.status).toBe(200);
      expect(undoRes.body.movement.type).toBe('SAIDA');
      expect(undoRes.body.inventory.quantity).toBe(10);

      const inventory = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: userA.userId, productId: product.id },
        },
      });
      expect(inventory.quantity).toBe(10);

      const remaining = await prisma.stockMovement.count({
        where: { productId: product.id },
      });
      expect(remaining).toBe(1);

      void entradaRes;
    });

    it('should undo the last SAIDA and increment the inventory', async () => {
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 10 });

      const saidaRes = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'SAIDA', quantity: 4 });

      const undoRes = await request(app)
        .post(`/api/stock/movements/${saidaRes.body.movement.id}/undo`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(undoRes.status).toBe(200);
      expect(undoRes.body.movement.type).toBe('SAIDA');
      expect(undoRes.body.inventory.quantity).toBe(10);
    });

    it('should undo the last AJUSTE and revert the inventory to the previous value', async () => {
      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 8 });

      const ajusteRes = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'AJUSTE', quantity: 3 });

      const undoRes = await request(app)
        .post(`/api/stock/movements/${ajusteRes.body.movement.id}/undo`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(undoRes.status).toBe(200);
      expect(undoRes.body.inventory.quantity).toBe(8);
    });

    it('should delete the inventory row when undoing the only movement', async () => {
      const entradaRes = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 5 });

      const undoRes = await request(app)
        .post(`/api/stock/movements/${entradaRes.body.movement.id}/undo`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(undoRes.status).toBe(200);
      expect(undoRes.body.inventory).toBeNull();

      const inventory = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: userA.userId, productId: product.id },
        },
      });
      expect(inventory).toBeNull();

      const remaining = await prisma.stockMovement.count({
        where: { productId: product.id },
      });
      expect(remaining).toBe(0);
    });

    it('should reject undoing a non-last movement', async () => {
      const entradaRes = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 5 });

      await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'SAIDA', quantity: 2 });

      const undoRes = await request(app)
        .post(`/api/stock/movements/${entradaRes.body.movement.id}/undo`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(undoRes.status).toBe(400);
      expect(undoRes.body.error).toMatch(/última/i);

      const inventory = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: userA.userId, productId: product.id },
        },
      });
      expect(inventory.quantity).toBe(3);

      const remaining = await prisma.stockMovement.count({
        where: { productId: product.id },
      });
      expect(remaining).toBe(2);
    });

    it('should allow sequential undo (each time undoing the new last)', async () => {
      const entradaRes = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 5 });

      const saidaRes = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'SAIDA', quantity: 2 });

      const firstUndo = await request(app)
        .post(`/api/stock/movements/${saidaRes.body.movement.id}/undo`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(firstUndo.status).toBe(200);
      expect(firstUndo.body.inventory.quantity).toBe(5);

      const secondUndo = await request(app)
        .post(`/api/stock/movements/${entradaRes.body.movement.id}/undo`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(secondUndo.status).toBe(200);
      expect(secondUndo.body.inventory).toBeNull();

      const inventory = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: userA.userId, productId: product.id },
        },
      });
      expect(inventory).toBeNull();
    });

    it('should return 404 for a non-existent movement', async () => {
      const response = await request(app)
        .post('/api/stock/movements/00000000-0000-0000-0000-000000000000/undo')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 when the movement belongs to another user', async () => {
      const entradaRes = await request(app)
        .post('/api/stock/movements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ productId: product.id, type: 'ENTRADA', quantity: 5 });

      const response = await request(app)
        .post(`/api/stock/movements/${entradaRes.body.movement.id}/undo`)
        .set('Authorization', `Bearer ${userB.token}`);

      expect(response.status).toBe(404);

      const inventory = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: userA.userId, productId: product.id },
        },
      });
      expect(inventory.quantity).toBe(5);
    });
  });
});

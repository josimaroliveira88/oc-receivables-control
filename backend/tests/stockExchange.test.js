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
  return {
    userId: regRes.body.id,
    token: loginRes.body.token,
    username,
  };
};

const createProduct = async (codeSuffix, price = 100) => {
  const product = await prisma.product.create({
    data: {
      code: `TESTEXCH${codeSuffix}`,
      name: 'Produto de Teste',
      size: '15 ml',
      status: 'ATIVO',
      prices: {
        create: {
          regularPrice: price,
          memberPrice: Math.round(price * 0.75),
          pv: 10,
        },
      },
    },
  });
  return product;
};

const createPerson = async (userId, suffix) => {
  const person = await prisma.person.create({
    data: {
      userId,
      name: `Pessoa Troca ${suffix}`,
    },
  });
  return person;
};

describe('Stock Exchange API', () => {
  let userA;
  let userB;
  let productOut;
  let productIn;
  let person;

  beforeAll(async () => {
    await prisma.$connect();
    userA = await registerUser('exch_a');
    userB = await registerUser('exch_b');
  });

  beforeEach(async () => {
    productOut = await createProduct(
      `O${Math.floor(Math.random() * 100000)}`,
      50,
    );
    productIn = await createProduct(
      `I${Math.floor(Math.random() * 100000)}`,
      120,
    );
    person = await createPerson(
      userA.userId,
      `P${Math.floor(Math.random() * 100000)}`,
    );

    // Seed inventory so the SAIDA has stock to consume.
    await request(app)
      .post('/api/stock/movements')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ productId: productOut.id, type: 'ENTRADA', quantity: 5 });
  });

  afterEach(async () => {
    await prisma.stockExchangeLine
      .deleteMany({
        where: { productId: { in: [productOut.id, productIn.id] } },
      })
      .catch(() => {});
    await prisma.stockExchange
      .deleteMany({ where: { userId: { in: [userA.userId, userB.userId] } } })
      .catch(() => {});
    await prisma.stockMovement
      .deleteMany({
        where: { productId: { in: [productOut.id, productIn.id] } },
      })
      .catch(() => {});
    await prisma.inventory
      .deleteMany({
        where: { productId: { in: [productOut.id, productIn.id] } },
      })
      .catch(() => {});
    await prisma.person
      .deleteMany({ where: { userId: { in: [userA.userId, userB.userId] } } })
      .catch(() => {});
    await prisma.product
      .deleteMany({ where: { code: { startsWith: 'TESTEXCH' } } })
      .catch(() => {});
  });

  afterAll(async () => {
    if (userA) {
      await prisma.user.delete({ where: { id: userA.userId } }).catch(() => {});
    }
    if (userB) {
      await prisma.user.delete({ where: { id: userB.userId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('Authentication', () => {
    it('returns 401 for POST without token', async () => {
      const response = await request(app).post('/api/stock/exchanges').send({});
      expect(response.status).toBe(401);
    });

    it('returns 401 for GET without token', async () => {
      const response = await request(app).get(
        '/api/stock/exchanges/00000000-0000-0000-0000-000000000000',
      );
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/stock/exchanges — validation', () => {
    it('rejects a payload missing the person', async () => {
      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          effectiveDate: '2026-10-10',
          outgoingLines: [{ productId: productOut.id, quantity: 1 }],
          incomingLines: [{ productId: productIn.id, quantity: 1 }],
        });

      expect(response.status).toBe(400);
    });

    it('rejects empty outgoingLines', async () => {
      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: person.id,
          effectiveDate: '2026-10-10',
          outgoingLines: [],
          incomingLines: [{ productId: productIn.id, quantity: 1 }],
        });

      expect(response.status).toBe(400);
    });

    it('rejects empty incomingLines', async () => {
      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: person.id,
          effectiveDate: '2026-10-10',
          outgoingLines: [{ productId: productOut.id, quantity: 1 }],
          incomingLines: [],
        });

      expect(response.status).toBe(400);
    });

    it('rejects a quantity <= 0', async () => {
      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: person.id,
          effectiveDate: '2026-10-10',
          outgoingLines: [{ productId: productOut.id, quantity: 0 }],
          incomingLines: [{ productId: productIn.id, quantity: 1 }],
        });

      expect(response.status).toBe(400);
    });

    it('rejects a too-long observation', async () => {
      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: person.id,
          effectiveDate: '2026-10-10',
          observation: 'x'.repeat(1001),
          outgoingLines: [{ productId: productOut.id, quantity: 1 }],
          incomingLines: [{ productId: productIn.id, quantity: 1 }],
        });

      expect(response.status).toBe(400);
    });

    it('rejects a malformed effectiveDate', async () => {
      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: person.id,
          effectiveDate: '10/10/2026',
          outgoingLines: [{ productId: productOut.id, quantity: 1 }],
          incomingLines: [{ productId: productIn.id, quantity: 1 }],
        });

      expect(response.status).toBe(400);
    });

    it('returns 404 when the person belongs to a different user', async () => {
      const otherPerson = await createPerson(
        userB.userId,
        `X${Math.floor(Math.random() * 100000)}`,
      );

      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: otherPerson.id,
          effectiveDate: '2026-10-10',
          outgoingLines: [{ productId: productOut.id, quantity: 1 }],
          incomingLines: [{ productId: productIn.id, quantity: 1 }],
        });

      expect(response.status).toBe(404);

      await prisma.person
        .delete({ where: { id: otherPerson.id } })
        .catch(() => {});
    });

    it('returns 404 when the person does not exist', async () => {
      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: '00000000-0000-0000-0000-000000000000',
          effectiveDate: '2026-10-10',
          outgoingLines: [{ productId: productOut.id, quantity: 1 }],
          incomingLines: [{ productId: productIn.id, quantity: 1 }],
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/stock/exchanges — happy path', () => {
    it('records the exchange, returns the header with lines and reloads stock', async () => {
      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: person.id,
          effectiveDate: '2026-10-10',
          observation: 'Troca combinada no escritório',
          outgoingLines: [
            { productId: productOut.id, quantity: 2, unitValueCents: 5000 },
          ],
          incomingLines: [
            { productId: productIn.id, quantity: 1, unitValueCents: 12000 },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.exchange).toBeDefined();
      expect(response.body.exchange.personId).toBe(person.id);
      expect(response.body.exchange.userId).toBe(userA.userId);
      expect(response.body.exchange.observation).toBe(
        'Troca combinada no escritório',
      );
      expect(response.body.exchange.outgoingLines).toHaveLength(1);
      expect(response.body.exchange.incomingLines).toHaveLength(1);
      expect(response.body.exchange.outgoingLines[0].productId).toBe(
        productOut.id,
      );
      expect(response.body.exchange.outgoingLines[0].quantity).toBe(2);
      expect(response.body.exchange.outgoingLines[0].unitValueCents).toBe(5000);
      expect(response.body.exchange.incomingLines[0].unitValueCents).toBe(
        12000,
      );

      // Inventory decreased for outgoing product and increased for incoming product.
      const invOut = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: userA.userId, productId: productOut.id },
        },
      });
      expect(invOut.quantity).toBe(3);

      const invIn = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: userA.userId, productId: productIn.id },
        },
      });
      expect(invIn.quantity).toBe(1);

      // Two StockMovements created with the standardized reason.
      const movements = await prisma.stockMovement.findMany({
        where: {
          productId: { in: [productOut.id, productIn.id] },
          reason: { contains: 'Troca #' },
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(movements).toHaveLength(2);
      const outMovement = movements.find((m) => m.productId === productOut.id);
      const inMovement = movements.find((m) => m.productId === productIn.id);
      expect(outMovement.type).toBe('SAIDA');
      expect(outMovement.quantity).toBe(-2);
      expect(outMovement.reason).toContain(
        `Troca #${response.body.exchange.id}`,
      );
      expect(outMovement.reason).toContain(person.name);
      expect(outMovement.reason).toContain('Troca combinada no escritório');
      expect(inMovement.type).toBe('ENTRADA');
      expect(inMovement.quantity).toBe(1);
      expect(inMovement.reason).toContain(person.name);
    });

    it('omits unitValueCents in the payload when the user did not provide one', async () => {
      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: person.id,
          effectiveDate: '2026-10-10',
          outgoingLines: [{ productId: productOut.id, quantity: 1 }],
          incomingLines: [{ productId: productIn.id, quantity: 1 }],
        });

      expect(response.status).toBe(201);
      expect(response.body.exchange.outgoingLines[0].unitValueCents).toBeNull();
      expect(response.body.exchange.incomingLines[0].unitValueCents).toBeNull();
    });

    it('persists the effectiveDate as a local calendar date', async () => {
      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: person.id,
          effectiveDate: '2026-10-10',
          outgoingLines: [{ productId: productOut.id, quantity: 1 }],
          incomingLines: [{ productId: productIn.id, quantity: 1 }],
        });

      expect(response.status).toBe(201);
      const stored = await prisma.stockExchange.findUnique({
        where: { id: response.body.exchange.id },
      });
      const effective = new Date(stored.effectiveDate);
      expect(effective.getFullYear()).toBe(2026);
      expect(effective.getMonth()).toBe(9);
      expect(effective.getDate()).toBe(10);
      expect(effective.getHours()).toBe(0);
    });

    it('supports multiple lines on each side', async () => {
      const productIn2 = await createProduct(
        `I2${Math.floor(Math.random() * 100000)}`,
        80,
      );

      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: person.id,
          effectiveDate: '2026-10-10',
          outgoingLines: [{ productId: productOut.id, quantity: 1 }],
          incomingLines: [
            { productId: productIn.id, quantity: 1 },
            { productId: productIn2.id, quantity: 2 },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.exchange.incomingLines).toHaveLength(2);

      const movements = await prisma.stockMovement.findMany({
        where: { reason: { contains: 'Troca #' } },
      });
      expect(movements).toHaveLength(3);

      const invIn2 = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: userA.userId, productId: productIn2.id },
        },
      });
      expect(invIn2.quantity).toBe(2);
    });
  });

  describe('POST /api/stock/exchanges — stock guards', () => {
    it('rejects a SAIDA that would make the stock go negative', async () => {
      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: person.id,
          effectiveDate: '2026-10-10',
          outgoingLines: [{ productId: productOut.id, quantity: 99 }],
          incomingLines: [{ productId: productIn.id, quantity: 1 }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Estoque insuficiente/);

      // No exchange persisted, no movements persisted.
      const exchanges = await prisma.stockExchange.findMany({
        where: { userId: userA.userId },
      });
      expect(exchanges).toHaveLength(0);

      const movements = await prisma.stockMovement.findMany({
        where: {
          productId: { in: [productOut.id, productIn.id] },
          reason: { contains: 'Troca #' },
        },
      });
      expect(movements).toHaveLength(0);

      const invIn = await prisma.inventory.findUnique({
        where: {
          userId_productId: { userId: userA.userId, productId: productIn.id },
        },
      });
      expect(invIn).toBeNull();
    });
  });

  describe('GET /api/stock/exchanges/:id', () => {
    let exchangeId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: person.id,
          effectiveDate: '2026-10-10',
          observation: 'Observação completa',
          outgoingLines: [
            { productId: productOut.id, quantity: 1, unitValueCents: 5000 },
          ],
          incomingLines: [
            { productId: productIn.id, quantity: 1, unitValueCents: 12000 },
          ],
        });
      exchangeId = response.body.exchange.id;
    });

    it('returns the exchange with person, lines and product info', async () => {
      const response = await request(app)
        .get(`/api/stock/exchanges/${exchangeId}`)
        .set('Authorization', `Bearer ${userA.token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(exchangeId);
      expect(response.body.observation).toBe('Observação completa');
      expect(response.body.person.id).toBe(person.id);
      expect(response.body.person.name).toBe(person.name);
      expect(response.body.lines).toHaveLength(2);
    });

    it('returns 404 for an unknown exchange id', async () => {
      const response = await request(app)
        .get('/api/stock/exchanges/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userA.token}`);
      expect(response.status).toBe(404);
    });

    it('returns 404 for an exchange that belongs to a different user', async () => {
      const response = await request(app)
        .get(`/api/stock/exchanges/${exchangeId}`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(response.status).toBe(404);
    });
  });

  describe('Isolation between users', () => {
    it("does not allow a user to use another user's person", async () => {
      const otherPerson = await createPerson(
        userB.userId,
        `Y${Math.floor(Math.random() * 100000)}`,
      );

      const response = await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: otherPerson.id,
          effectiveDate: '2026-10-10',
          outgoingLines: [{ productId: productOut.id, quantity: 1 }],
          incomingLines: [{ productId: productIn.id, quantity: 1 }],
        });

      expect(response.status).toBe(404);

      await prisma.person
        .delete({ where: { id: otherPerson.id } })
        .catch(() => {});
    });

    it('does not list exchanges from other users', async () => {
      // Create an exchange for userA.
      await request(app)
        .post('/api/stock/exchanges')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          personId: person.id,
          effectiveDate: '2026-10-10',
          outgoingLines: [{ productId: productOut.id, quantity: 1 }],
          incomingLines: [{ productId: productIn.id, quantity: 1 }],
        });

      // Verify userB cannot read it.
      const exchanges = await prisma.stockExchange.findMany({
        where: { userId: userA.userId },
      });
      expect(exchanges).toHaveLength(1);

      const myId = exchanges[0].id;
      const response = await request(app)
        .get(`/api/stock/exchanges/${myId}`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(response.status).toBe(404);
    });
  });
});

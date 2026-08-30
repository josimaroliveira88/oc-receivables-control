const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

function uniqueOrderNumber(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

describe('Dashboard Yearly Breakdown', () => {
  let authToken;
  let userId;
  let testPersonId;
  let createdOrderIds = [];

  beforeAll(async () => {
    await prisma.$connect();
    const username = `dashboard_test_${Date.now()}`;
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
    await prisma.$disconnect();
  });

  afterEach(async () => {
    for (const oid of createdOrderIds) {
      await prisma.order.delete({ where: { id: oid } }).catch(() => {});
    }
    createdOrderIds = [];
    if (testPersonId) {
      await prisma.person
        .delete({ where: { id: testPersonId } })
        .catch(() => {});
      testPersonId = null;
    }
  });

  beforeEach(async () => {
    const person = await prisma.person.create({
      data: {
        name: 'Dashboard Year Test Person',
        whatsapp: 'year@test.com',
        userId,
      },
    });
    testPersonId = person.id;
  });

  it('should return yearlyBreakdown as an array with year, totalPending, and totalQuitado fields', async () => {
    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.yearlyBreakdown).toBeDefined();
    expect(Array.isArray(response.body.yearlyBreakdown)).toBe(true);

    for (const entry of response.body.yearlyBreakdown) {
      expect(entry).toHaveProperty('year');
      expect(entry).toHaveProperty('totalPending');
      expect(entry).toHaveProperty('totalQuitado');
      expect(typeof entry.year).toBe('number');
      expect(typeof entry.totalPending).toBe('number');
      expect(typeof entry.totalQuitado).toBe('number');
    }
  });

  it('should include QUITADO orders in totalQuitado for their year', async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: uniqueOrderNumber('YR-QUIT'),
        totalValue: 777.0,
        orderDate: parseLocalDate('2022-06-15'),
        status: 'QUITADO',
        userId,
        items: {
          create: [
            {
              description: 'Item Quitado',
              chargedValue: 777.0,
              personId: testPersonId,
            },
          ],
        },
      },
    });

    createdOrderIds.push(order.id);

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    const breakdown2022 = response.body.yearlyBreakdown.find(
      (y) => y.year === 2022,
    );
    expect(breakdown2022).toBeDefined();
    expect(parseFloat(breakdown2022.totalQuitado)).toBeGreaterThanOrEqual(
      777.0,
    );
  });

  it('should include PENDENTE and PARCIAL orders in totalPending for their year', async () => {
    const orderPendente = await prisma.order.create({
      data: {
        orderNumber: uniqueOrderNumber('YR-PEND'),
        totalValue: 555.0,
        orderDate: parseLocalDate('2021-03-10'),
        status: 'PENDENTE',
        userId,
        items: {
          create: [
            {
              description: 'Item Pendente',
              chargedValue: 555.0,
              personId: testPersonId,
            },
          ],
        },
      },
    });

    const orderParcial = await prisma.order.create({
      data: {
        orderNumber: uniqueOrderNumber('YR-PARC2'),
        totalValue: 444.0,
        orderDate: parseLocalDate('2021-07-20'),
        status: 'PARCIAL',
        userId,
        items: {
          create: [
            {
              description: 'Item Parcial',
              chargedValue: 444.0,
              personId: testPersonId,
            },
          ],
        },
      },
    });

    createdOrderIds.push(orderPendente.id, orderParcial.id);

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    const breakdown2021 = response.body.yearlyBreakdown.find(
      (y) => y.year === 2021,
    );
    expect(breakdown2021).toBeDefined();
    expect(parseFloat(breakdown2021.totalPending)).toBeGreaterThanOrEqual(
      555.0 + 444.0,
    );
    expect(parseFloat(breakdown2021.totalQuitado)).toBe(0);
  });

  it('should be sorted by year descending', async () => {
    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    const years = response.body.yearlyBreakdown.map((y) => y.year);
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i]).toBeGreaterThan(years[i + 1]);
    }
  });

  it('should group orders by year based on orderDate, not payment date', async () => {
    const order2023 = await prisma.order.create({
      data: {
        orderNumber: uniqueOrderNumber('YR-2023-PAY'),
        totalValue: 666.0,
        orderDate: parseLocalDate('2023-12-01'),
        status: 'QUITADO',
        userId,
        items: {
          create: [
            {
              description: 'Item Dec 2023',
              chargedValue: 666.0,
              personId: testPersonId,
            },
          ],
        },
        payments: {
          create: [
            {
              amount: 666.0,
              personId: testPersonId,
              paidAt: parseLocalDate('2027-01-15'),
            },
          ],
        },
      },
    });

    createdOrderIds.push(order2023.id);

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    const breakdown2023 = response.body.yearlyBreakdown.find(
      (y) => y.year === 2023,
    );
    const breakdown2027 = response.body.yearlyBreakdown.find(
      (y) => y.year === 2027,
    );

    expect(breakdown2023).toBeDefined();
    expect(parseFloat(breakdown2023.totalQuitado)).toBeGreaterThanOrEqual(
      666.0,
    );

    expect(breakdown2027).toBeUndefined();
  });

  it('should return 401 when no authentication token is provided', async () => {
    const response = await request(app).get('/api/dashboard');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Access token required');
  });
});

describe('Dashboard self person exclusion', () => {
  let authToken;
  let userId;
  let createdOrderIds = [];
  let createdPersonIds = [];

  beforeAll(async () => {
    await prisma.$connect();
    const username = `dashboard_self_${Date.now()}`;
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
    await prisma.$disconnect();
  });

  afterEach(async () => {
    for (const id of createdOrderIds) {
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    createdOrderIds = [];
    for (const id of createdPersonIds) {
      await prisma.person.delete({ where: { id } }).catch(() => {});
    }
    createdPersonIds = [];
  });

  const makePerson = async (name, isSelf = false) => {
    const person = await prisma.person.create({
      data: { name, isSelf, userId },
    });
    createdPersonIds.push(person.id);
    return person.id;
  };

  const makeOrder = async (
    orderNumber,
    totalValue,
    items,
    status = 'PENDENTE',
  ) => {
    const order = await prisma.order.create({
      data: {
        orderNumber,
        totalValue,
        status,
        userId,
        items: { create: items },
      },
    });
    createdOrderIds.push(order.id);
    return order;
  };

  it('should exclude self item values from totalPending', async () => {
    const selfId = await makePerson('Eu', true);
    const otherId = await makePerson('Cliente');
    await makeOrder(uniqueOrderNumber('DS-SELF'), 500.0, [
      { description: 'Meu Item', chargedValue: 200.0, personId: selfId },
      { description: 'Item Cliente', chargedValue: 300.0, personId: otherId },
    ]);

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(parseFloat(response.body.totalPending)).toBe(300.0);
  });

  it('should report pending 0 for a self person in personBalances and expose isSelf', async () => {
    const selfId = await makePerson('Eu', true);
    const otherId = await makePerson('Cliente');
    await makeOrder(uniqueOrderNumber('DS-BAL'), 500.0, [
      { description: 'Meu Item', chargedValue: 200.0, personId: selfId },
      { description: 'Item Cliente', chargedValue: 300.0, personId: otherId },
    ]);

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    const selfBalance = response.body.personBalances.find(
      (b) => b.personId === selfId,
    );
    expect(selfBalance).toBeDefined();
    expect(selfBalance.isSelf).toBe(true);
    expect(parseFloat(selfBalance.itemTotal)).toBe(200.0);
    expect(parseFloat(selfBalance.pending)).toBe(0);

    const otherBalance = response.body.personBalances.find(
      (b) => b.personId === otherId,
    );
    expect(otherBalance.isSelf).toBe(false);
    expect(parseFloat(otherBalance.pending)).toBe(300.0);
  });

  it('should exclude self item values from yearly totalPending', async () => {
    const selfId = await makePerson('Eu', true);
    const otherId = await makePerson('Cliente');
    const year = new Date().getFullYear();
    await makeOrder(uniqueOrderNumber('DS-YEAR'), 500.0, [
      { description: 'Meu Item', chargedValue: 200.0, personId: selfId },
      { description: 'Item Cliente', chargedValue: 300.0, personId: otherId },
    ]);

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    const entry = response.body.yearlyBreakdown.find((y) => y.year === year);
    expect(entry).toBeDefined();
    expect(parseFloat(entry.totalPending)).toBe(300.0);
  });

  it('should not count self item values in currentMonthReceipts (no payments registered)', async () => {
    const selfId = await makePerson('Eu', true);
    await makeOrder(uniqueOrderNumber('DS-RECEIPTS'), 200.0, [
      { description: 'Meu Item', chargedValue: 200.0, personId: selfId },
    ]);

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(parseFloat(response.body.currentMonthReceipts)).toBe(0);
  });
});

describe('Dashboard team order exclusion', () => {
  let authToken;
  let userId;
  let createdOrderIds = [];
  let createdPersonIds = [];

  beforeAll(async () => {
    await prisma.$connect();
    const username = `dashboard_team_${Date.now()}`;
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
    await prisma.$disconnect();
  });

  afterEach(async () => {
    for (const id of createdOrderIds) {
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    createdOrderIds = [];
    for (const id of createdPersonIds) {
      await prisma.person.delete({ where: { id } }).catch(() => {});
    }
    createdPersonIds = [];
  });

  const makePerson = async (name) => {
    const person = await prisma.person.create({
      data: { name, userId },
    });
    createdPersonIds.push(person.id);
    return person.id;
  };

  const makeOrder = async (
    orderNumber,
    totalValue,
    items,
    status = 'PENDENTE',
    isTeamOrder = false,
  ) => {
    const order = await prisma.order.create({
      data: {
        orderNumber,
        totalValue,
        status,
        isTeamOrder,
        userId,
        items: { create: items },
      },
    });
    createdOrderIds.push(order.id);
    return order;
  };

  const getDashboard = async () => {
    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(200);
    return response.body;
  };

  it('should exclude team orders from totalPending and totalPaid', async () => {
    const personId = await makePerson('Cliente');
    const normalId = await makePerson('Outro Cliente');
    await makeOrder(
      uniqueOrderNumber('DT-TEAM'),
      500.0,
      [{ description: 'Item Equipe', chargedValue: 500.0, personId }],
      'PENDENTE',
      true,
    );
    await makeOrder(uniqueOrderNumber('DT-NORM'), 300.0, [
      { description: 'Item Normal', chargedValue: 300.0, personId: normalId },
    ]);

    const dashboard = await getDashboard();
    expect(parseFloat(dashboard.totalPending)).toBe(300.0);
    expect(parseFloat(dashboard.totalPaid)).toBe(0);
  });

  it('should exclude a QUITADO team order from totalPaid and yearlyBreakdown', async () => {
    const personId = await makePerson('Cliente');
    const year = new Date().getFullYear();
    await makeOrder(
      uniqueOrderNumber('DT-QUIT'),
      400.0,
      [{ description: 'Item Equipe', chargedValue: 400.0, personId }],
      'QUITADO',
      true,
    );

    const dashboard = await getDashboard();
    expect(parseFloat(dashboard.totalPaid)).toBe(0);

    const entry = dashboard.yearlyBreakdown.find((y) => y.year === year);
    expect(entry).toBeUndefined();
  });

  it('should exclude team order payments from currentMonthReceipts', async () => {
    const personId = await makePerson('Cliente');
    const order = await prisma.order.create({
      data: {
        orderNumber: uniqueOrderNumber('DT-RECEIPTS'),
        totalValue: 250.0,
        status: 'EQUIPE',
        isTeamOrder: true,
        userId,
        items: {
          create: [
            { description: 'Item Equipe', chargedValue: 250.0, personId },
          ],
        },
        payments: {
          create: [{ amount: 250.0, personId }],
        },
      },
    });
    createdOrderIds.push(order.id);

    const dashboard = await getDashboard();
    expect(parseFloat(dashboard.currentMonthReceipts)).toBe(0);
  });

  it('should exclude team order items and payments from personBalances', async () => {
    const personId = await makePerson('Cliente');
    await makeOrder(
      uniqueOrderNumber('DT-BAL'),
      300.0,
      [{ description: 'Item Equipe', chargedValue: 300.0, personId }],
      'PENDENTE',
      true,
    );

    const dashboard = await getDashboard();
    const balance = dashboard.personBalances.find(
      (b) => b.personId === personId,
    );
    expect(balance).toBeUndefined();
  });
});

describe('Dashboard sale orders inclusion', () => {
  let authToken;
  let userId;
  let createdOrderIds = [];
  let createdPersonIds = [];
  let product;

  beforeAll(async () => {
    await prisma.$connect();
    const username = `dashboard_sale_${Date.now()}`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'testpass123' });
    userId = regRes.body.id;
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'testpass123' });
    authToken = loginRes.body.token;

    product = await prisma.product.create({
      data: {
        code: `DASHSALE${Math.floor(Math.random() * 100000)}`,
        name: 'Produto Dashboard Venda',
        size: '30 ml',
        status: 'ATIVO',
        prices: { create: { regularPrice: 100, memberPrice: 75, pv: 10 } },
      },
    });
    await prisma.inventory.upsert({
      where: { userId_productId: { userId, productId: product.id } },
      create: { userId, productId: product.id, quantity: 1000 },
      update: { quantity: 1000 },
    });
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    if (product) {
      await prisma.product
        .delete({ where: { id: product.id } })
        .catch(() => {});
    }
    await prisma.$disconnect();
  });

  afterEach(async () => {
    for (const id of createdOrderIds) {
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    createdOrderIds = [];
    for (const id of createdPersonIds) {
      await prisma.person.delete({ where: { id } }).catch(() => {});
    }
    createdPersonIds = [];
    await prisma.stockMovement
      .deleteMany({ where: { userId } })
      .catch(() => {});
    await prisma.inventory.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.inventory.upsert({
      where: { userId_productId: { userId, productId: product.id } },
      create: { userId, productId: product.id, quantity: 1000 },
      update: { quantity: 1000 },
    });
  });

  const makeSale = async (chargedValue, extra = {}) => {
    const person = await prisma.person.create({
      data: { name: 'Cliente Venda Dashboard', userId },
    });
    createdPersonIds.push(person.id);
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        clientPersonId: person.id,
        items: [{ productId: product.id, chargedValue, quantity: 1 }],
        ...extra,
      });
    createdOrderIds.push(res.body.id);
    return res.body;
  };

  it('includes pending sale orders in totalPending', async () => {
    await makeSale(200);
    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(200);
    expect(parseFloat(response.body.totalPending)).toBe(200);
  });

  it('includes QUITADO sale orders in totalPaid', async () => {
    const sale = await makeSale(150);
    await request(app)
      .post(`/api/orders/${sale.id}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 150, personId: sale.items[0].personId });
    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);
    expect(parseFloat(response.body.totalPaid)).toBe(150);
  });

  it('includes sale payments in currentMonthReceipts', async () => {
    const sale = await makeSale(80);
    await request(app)
      .post(`/api/orders/${sale.id}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 80, personId: sale.items[0].personId });
    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);
    expect(parseFloat(response.body.currentMonthReceipts)).toBe(80);
  });

  it('includes sale items in personBalances', async () => {
    const sale = await makeSale(120);
    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);
    const balance = response.body.personBalances.find(
      (b) => b.personId === sale.items[0].personId,
    );
    expect(balance).toBeDefined();
    expect(balance.itemTotal).toBe(120);
    expect(balance.pending).toBe(120);
  });
});

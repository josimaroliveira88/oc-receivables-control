const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/config');

function generateToken() {
  return jwt.sign({ userId: 'test-user', username: 'admin' }, JWT_SECRET);
}

function uniqueOrderNumber(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

describe('Dashboard Yearly Breakdown', () => {
  let token;
  let testPersonId;
  let createdOrderIds = [];

  beforeAll(async () => {
    await prisma.$connect();
    token = generateToken();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    for (const oid of createdOrderIds) {
      await prisma.order.delete({ where: { id: oid } }).catch(() => {});
    }
    createdOrderIds = [];
    if (testPersonId) {
      await prisma.person.delete({ where: { id: testPersonId } }).catch(() => {});
      testPersonId = null;
    }
  });

  beforeEach(async () => {
    const person = await prisma.person.create({
      data: { name: 'Dashboard Year Test Person', contact: 'year@test.com' },
    });
    testPersonId = person.id;
  });

  it('should return yearlyBreakdown as an array with year, totalPending, and totalQuitado fields', async () => {
    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`);

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
        totalValue: 777.00,
        orderDate: parseLocalDate('2022-06-15'),
        status: 'QUITADO',
        items: {
          create: [{ description: 'Item Quitado', value: 777.00, personId: testPersonId }],
        },
      },
    });

    createdOrderIds.push(order.id);

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const breakdown2022 = response.body.yearlyBreakdown.find((y) => y.year === 2022);
    expect(breakdown2022).toBeDefined();
    expect(parseFloat(breakdown2022.totalQuitado)).toBeGreaterThanOrEqual(777.00);
  });

  it('should include PENDENTE and PARCIAL orders in totalPending for their year', async () => {
    const orderPendente = await prisma.order.create({
      data: {
        orderNumber: uniqueOrderNumber('YR-PEND'),
        totalValue: 555.00,
        orderDate: parseLocalDate('2021-03-10'),
        status: 'PENDENTE',
        items: {
          create: [{ description: 'Item Pendente', value: 555.00, personId: testPersonId }],
        },
      },
    });

    const orderParcial = await prisma.order.create({
      data: {
        orderNumber: uniqueOrderNumber('YR-PARC2'),
        totalValue: 444.00,
        orderDate: parseLocalDate('2021-07-20'),
        status: 'PARCIAL',
        items: {
          create: [{ description: 'Item Parcial', value: 444.00, personId: testPersonId }],
        },
      },
    });

    createdOrderIds.push(orderPendente.id, orderParcial.id);

    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const breakdown2021 = response.body.yearlyBreakdown.find((y) => y.year === 2021);
    expect(breakdown2021).toBeDefined();
    expect(parseFloat(breakdown2021.totalPending)).toBeGreaterThanOrEqual(555.00 + 444.00);
    expect(parseFloat(breakdown2021.totalQuitado)).toBe(0);
  });

  it('should be sorted by year descending', async () => {
    const response = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`);

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
        totalValue: 666.00,
        orderDate: parseLocalDate('2023-12-01'),
        status: 'QUITADO',
        items: {
          create: [{ description: 'Item Dec 2023', value: 666.00, personId: testPersonId }],
        },
        payments: {
          create: [
            {
              amount: 666.00,
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
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const breakdown2023 = response.body.yearlyBreakdown.find((y) => y.year === 2023);
    const breakdown2027 = response.body.yearlyBreakdown.find((y) => y.year === 2027);

    expect(breakdown2023).toBeDefined();
    expect(parseFloat(breakdown2023.totalQuitado)).toBeGreaterThanOrEqual(666.00);

    expect(breakdown2027).toBeUndefined();
  });
});

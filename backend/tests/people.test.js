const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

describe('People CRUD', () => {
  let authToken;
  let userId;
  let createdPersonId;

  beforeAll(async () => {
    await prisma.$connect();
    const username = `people_test_${Date.now()}`;
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
    if (createdPersonId) {
      await prisma.person
        .delete({ where: { id: createdPersonId } })
        .catch(() => {});
      createdPersonId = null;
    }
  });

  describe('POST /api/people', () => {
    it('should create a new person with valid data', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'João Silva', whatsapp: '5511999998888' });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('João Silva');
      expect(response.body.whatsapp).toBe('5511999998888');
      expect(response.body.id).toBeDefined();
      createdPersonId = response.body.id;
    });

    it('should create a person with all client fields', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Maria Santos',
          whatsapp: '5511988887777',
          commonGroups: 'Grupo do WhatsApp',
          instagram: 'https://instagram.com/maria',
          address: 'Rua das Flores, 123 - São Paulo/SP',
          isVip: true,
          isDoterraMember: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.whatsapp).toBe('5511988887777');
      expect(response.body.commonGroups).toBe('Grupo do WhatsApp');
      expect(response.body.instagram).toBe('https://instagram.com/maria');
      expect(response.body.address).toBe('Rua das Flores, 123 - São Paulo/SP');
      expect(response.body.isVip).toBe(true);
      expect(response.body.isDoterraMember).toBe(true);
      createdPersonId = response.body.id;
    });

    it('should default optional fields to null/false when omitted', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Maria Santos' });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Maria Santos');
      expect(response.body.whatsapp).toBeNull();
      expect(response.body.commonGroups).toBeNull();
      expect(response.body.instagram).toBeNull();
      expect(response.body.address).toBeNull();
      expect(response.body.observacao).toBeNull();
      expect(response.body.birthday).toBeNull();
      expect(response.body.isVip).toBe(false);
      expect(response.body.isDoterraMember).toBe(false);
      createdPersonId = response.body.id;
    });

    it('should create a person with observacao', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Cliente com Observação',
          observacao:
            'Cliente prefere atendimento por WhatsApp no período da tarde.',
        });

      expect(response.status).toBe(201);
      expect(response.body.observacao).toBe(
        'Cliente prefere atendimento por WhatsApp no período da tarde.',
      );
      createdPersonId = response.body.id;
    });

    it('should preserve a legacy non-digit whatsapp value (migrated contact)', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cliente Legado', whatsapp: 'joao@email.com' });

      expect(response.status).toBe(201);
      expect(response.body.whatsapp).toBe('joao@email.com');
      createdPersonId = response.body.id;
    });

    it('should create a person with a valid birthday in DD/MM format', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cliente com Aniversário', birthday: '15/08' });

      expect(response.status).toBe(201);
      expect(response.body.birthday).toBe('15/08');
      createdPersonId = response.body.id;
    });

    it('should accept 29/02 as birthday (year unknown, leap day allowed)', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cliente Leap Day', birthday: '29/02' });

      expect(response.status).toBe(201);
      expect(response.body.birthday).toBe('29/02');
      createdPersonId = response.body.id;
    });

    it('should reject a birthday with an invalid day/month (31/02)', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cliente Inválido', birthday: '31/02' });

      expect(response.status).toBe(400);
    });

    it('should reject a birthday with month 13', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cliente Inválido', birthday: '01/13' });

      expect(response.status).toBe(400);
    });

    it('should reject a birthday with day 00', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cliente Inválido', birthday: '00/05' });

      expect(response.status).toBe(400);
    });

    it('should reject a birthday not in DD/MM format', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cliente Inválido', birthday: '15-08-1990' });

      expect(response.status).toBe(400);
    });

    it('should reject request with missing name', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ whatsapp: '5511999998888' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject request with empty name', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' });

      expect(response.status).toBe(400);
    });

    it('should reject request with invalid data types', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 12345, whatsapp: true });

      expect(response.status).toBe(400);
    });

    it('should reject commonGroups longer than 255 chars', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Too Long Group', commonGroups: 'a'.repeat(256) });

      expect(response.status).toBe(400);
    });

    it('should reject instagram longer than 255 chars', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Too Long Insta',
          instagram: `https://instagram.com/${'a'.repeat(250)}`,
        });

      expect(response.status).toBe(400);
    });

    it('should reject address longer than 500 chars', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Too Long Address', address: 'a'.repeat(501) });

      expect(response.status).toBe(400);
    });

    it('should reject observacao longer than 2000 chars', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Too Long Observacao', observacao: 'a'.repeat(2001) });

      expect(response.status).toBe(400);
    });

    it('should reject non-boolean isVip', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Bad Vip', isVip: 'sim' });

      expect(response.status).toBe(400);
    });

    it('should return 401 when no authentication token is provided', async () => {
      const response = await request(app)
        .post('/api/people')
        .send({ name: 'No Auth' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should return 403 when invalid authentication token is provided', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', 'Bearer invalid-token')
        .send({ name: 'Invalid Auth' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('GET /api/people', () => {
    beforeEach(async () => {
      const person = await prisma.person.create({
        data: {
          name: 'Test Person',
          whatsapp: '5511999998888',
          commonGroups: 'Vizinho',
          instagram: 'https://instagram.com/test',
          address: 'Av. Teste, 10',
          observacao: 'Cliente prefere retirar as compras pessoalmente.',
          isVip: true,
          isDoterraMember: false,
          userId,
        },
      });
      createdPersonId = person.id;
    });

    it('should return all people for the authenticated user', async () => {
      const response = await request(app)
        .get('/api/people')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return a single person by ID with all fields', async () => {
      const response = await request(app)
        .get(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(createdPersonId);
      expect(response.body.name).toBe('Test Person');
      expect(response.body.whatsapp).toBe('5511999998888');
      expect(response.body.commonGroups).toBe('Vizinho');
      expect(response.body.observacao).toBe(
        'Cliente prefere retirar as compras pessoalmente.',
      );
      expect(response.body.isVip).toBe(true);
      expect(response.body.isDoterraMember).toBe(false);
    });

    it('should return 404 for non-existent person', async () => {
      const response = await request(app)
        .get('/api/people/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 401 when no authentication token is provided', async () => {
      const response = await request(app).get('/api/people');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('GET /api/people/:id/summary', () => {
    let summaryPersonId;
    let createdOrderIds = [];

    const uniqueOrderNumber = (prefix) =>
      `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    beforeEach(async () => {
      summaryPersonId = (
        await prisma.person.create({
          data: { name: 'Summary Person', whatsapp: '5511999997777', userId },
        })
      ).id;
      createdOrderIds = [];
    });

    afterEach(async () => {
      await prisma.order
        .deleteMany({ where: { id: { in: createdOrderIds } } })
        .catch(() => {});
      await prisma.person
        .delete({ where: { id: summaryPersonId } })
        .catch(() => {});
      summaryPersonId = null;
      createdOrderIds = [];
    });

    it('should return zeroed summary when the person has no orders', async () => {
      const response = await request(app)
        .get(`/api/people/${summaryPersonId}/summary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.ordersCount).toBe(0);
      expect(response.body.totalItemsCents).toBe(0);
      expect(response.body.totalPaidCents).toBe(0);
      expect(response.body.totalOpenCents).toBe(0);
    });

    it('should compute items, paid and open totals in cents', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-SUM'),
          totalValue: 150.0,
          userId,
          items: {
            create: {
              description: 'Item do cliente',
              chargedValue: 150.0,
              personId: summaryPersonId,
            },
          },
        },
      });
      createdOrderIds.push(order.id);

      await prisma.payment.create({
        data: {
          amount: 40.0,
          personId: summaryPersonId,
          orderId: order.id,
        },
      });

      const response = await request(app)
        .get(`/api/people/${summaryPersonId}/summary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.ordersCount).toBe(1);
      expect(response.body.totalItemsCents).toBe(15000);
      expect(response.body.totalPaidCents).toBe(4000);
      expect(response.body.totalOpenCents).toBe(11000);
    });

    it('should count distinct orders containing items of the person', async () => {
      const orderA = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-SUM-A'),
          totalValue: 100.0,
          userId,
          items: {
            create: {
              description: 'Item A',
              chargedValue: 100.0,
              personId: summaryPersonId,
            },
          },
        },
      });
      const orderB = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-SUM-B'),
          totalValue: 50.0,
          userId,
          items: {
            create: {
              description: 'Item B',
              chargedValue: 50.0,
              personId: summaryPersonId,
            },
          },
        },
      });
      createdOrderIds.push(orderA.id, orderB.id);

      const response = await request(app)
        .get(`/api/people/${summaryPersonId}/summary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.ordersCount).toBe(2);
      expect(response.body.totalItemsCents).toBe(15000);
    });

    it('should honor quantity and TOTAL mode when computing item totals', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-SUM-QTY'),
          totalValue: 25.0,
          userId,
          items: {
            create: [
              {
                description: '2x de 10',
                chargedValue: 10.0,
                quantity: 2,
                personId: summaryPersonId,
              },
              {
                description: 'Total mode',
                chargedValue: 5.0,
                chargedValueMode: 'TOTAL',
                personId: summaryPersonId,
              },
            ],
          },
        },
      });
      createdOrderIds.push(order.id);

      const response = await request(app)
        .get(`/api/people/${summaryPersonId}/summary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body.totalItemsCents).toBe(2500);
    });

    it('should exclude team orders from the summary', async () => {
      const normalOrder = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-SUM-NORMAL'),
          totalValue: 30.0,
          userId,
          items: {
            create: {
              description: 'Item normal',
              chargedValue: 30.0,
              personId: summaryPersonId,
            },
          },
        },
      });
      const teamOrder = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-SUM-TEAM'),
          totalValue: 500.0,
          isTeamOrder: true,
          userId,
          items: {
            create: {
              description: 'Item de equipe',
              chargedValue: 500.0,
              personId: summaryPersonId,
            },
          },
        },
      });
      createdOrderIds.push(normalOrder.id, teamOrder.id);

      const response = await request(app)
        .get(`/api/people/${summaryPersonId}/summary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.ordersCount).toBe(1);
      expect(response.body.totalItemsCents).toBe(3000);
      expect(response.body.totalOpenCents).toBe(3000);
    });

    it('should return open 0 when paid exceeds the items total', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-SUM-OVER'),
          totalValue: 20.0,
          userId,
          items: {
            create: {
              description: 'Item com overpayment',
              chargedValue: 20.0,
              personId: summaryPersonId,
            },
          },
        },
      });
      createdOrderIds.push(order.id);

      await prisma.payment.create({
        data: {
          amount: 25.0,
          personId: summaryPersonId,
          orderId: order.id,
        },
      });

      const response = await request(app)
        .get(`/api/people/${summaryPersonId}/summary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body.totalPaidCents).toBe(2500);
      expect(response.body.totalOpenCents).toBe(0);
    });

    it('should return open 0 for a self person even with chargeable items', async () => {
      await prisma.person.update({
        where: { id: summaryPersonId },
        data: { isSelf: true },
      });

      const order = await prisma.order.create({
        data: {
          orderNumber: uniqueOrderNumber('ORD-SUM-SELF'),
          totalValue: 80.0,
          userId,
          items: {
            create: {
              description: 'Item do self',
              chargedValue: 80.0,
              personId: summaryPersonId,
            },
          },
        },
      });
      createdOrderIds.push(order.id);

      const response = await request(app)
        .get(`/api/people/${summaryPersonId}/summary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body.totalItemsCents).toBe(8000);
      expect(response.body.totalOpenCents).toBe(0);
    });

    it('should return 404 for a person of another user', async () => {
      const other = await request(app)
        .post('/api/auth/register')
        .send({ username: `other_summary_${Date.now()}`, password: 'x123456' });
      const otherPersonId = (
        await prisma.person.create({
          data: { name: 'Outro User Person', userId: other.body.id },
        })
      ).id;

      const response = await request(app)
        .get(`/api/people/${otherPersonId}/summary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);

      await prisma.person
        .delete({ where: { id: otherPersonId } })
        .catch(() => {});
    });

    it('should return 404 for a non-existent person', async () => {
      const response = await request(app)
        .get('/api/people/00000000-0000-0000-0000-000000000000/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/people — search, classification and sorting', () => {
    let vipPersonId;
    let memberPersonId;
    let nonePersonId;

    beforeEach(async () => {
      vipPersonId = (
        await prisma.person.create({
          data: {
            name: 'Vip Cliente',
            whatsapp: '5511911110000',
            commonGroups: 'Grupo VIP',
            isVip: true,
            isDoterraMember: false,
            userId,
          },
        })
      ).id;
      memberPersonId = (
        await prisma.person.create({
          data: {
            name: 'Membro Cliente',
            whatsapp: '5511922220000',
            isVip: false,
            isDoterraMember: true,
            userId,
          },
        })
      ).id;
      nonePersonId = (
        await prisma.person.create({
          data: {
            name: 'Comum Cliente',
            whatsapp: '5511933330000',
            isVip: false,
            isDoterraMember: false,
            userId,
          },
        })
      ).id;
    });

    afterEach(async () => {
      await prisma.person
        .deleteMany({
          where: { id: { in: [vipPersonId, memberPersonId, nonePersonId] } },
        })
        .catch(() => {});
      vipPersonId = null;
      memberPersonId = null;
      nonePersonId = null;
    });

    it('should search people by name (case-insensitive)', async () => {
      const response = await request(app)
        .get('/api/people?q=vip')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const names = response.body.map((p) => p.name);
      expect(names).toContain('Vip Cliente');
      expect(names).not.toContain('Membro Cliente');
    });

    it('should search people by whatsapp (case-insensitive)', async () => {
      const response = await request(app)
        .get('/api/people?q=551192222')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((p) => p.id);
      expect(ids).toContain(memberPersonId);
      expect(ids).not.toContain(vipPersonId);
    });

    it('should search people by observacao', async () => {
      await prisma.person.update({
        where: { id: memberPersonId },
        data: { observacao: 'Cliente solicita nota fiscal eletrônica.' },
      });
      const response = await request(app)
        .get('/api/people?q=nota%20fiscal')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((p) => p.id);
      expect(ids).toContain(memberPersonId);
      expect(ids).not.toContain(vipPersonId);
      expect(ids).not.toContain(nonePersonId);
    });

    it('should filter by classification=member', async () => {
      const response = await request(app)
        .get('/api/people?classification=member')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((p) => p.id);
      expect(ids).toContain(memberPersonId);
      expect(ids).not.toContain(vipPersonId);
      expect(ids).not.toContain(nonePersonId);
    });

    it('should filter by classification=vip_member', async () => {
      await prisma.person.update({
        where: { id: vipPersonId },
        data: { isDoterraMember: true },
      });
      const response = await request(app)
        .get('/api/people?classification=vip_member')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((p) => p.id);
      expect(ids).toContain(vipPersonId);
      expect(ids).not.toContain(memberPersonId);
      expect(ids).not.toContain(nonePersonId);
    });

    it('should filter by classification=none', async () => {
      const response = await request(app)
        .get('/api/people?classification=none')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const ids = response.body.map((p) => p.id);
      expect(ids).toContain(nonePersonId);
      expect(ids).not.toContain(vipPersonId);
      expect(ids).not.toContain(memberPersonId);
    });

    it('should sort by whatsapp descending', async () => {
      const response = await request(app)
        .get('/api/people?sortBy=whatsapp&sortDir=desc')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const whatsapps = response.body
        .map((p) => p.whatsapp)
        .filter(Boolean)
        .map(String);
      const sorted = [...whatsapps].sort((a, b) => b.localeCompare(a));
      expect(whatsapps).toEqual(sorted);
    });

    it('should fall back to name asc when sortBy is invalid', async () => {
      const response = await request(app)
        .get('/api/people?sortBy=invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const names = response.body.map((p) => p.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });

    it('should combine q, classification and sort', async () => {
      const response = await request(app)
        .get('/api/people?q=cliente&classification=vip&sortBy=name&sortDir=asc')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const names = response.body.map((p) => p.name);
      expect(names).toEqual(['Vip Cliente']);
    });

    it('should not leak other users people when filters are applied', async () => {
      const other = await request(app)
        .post('/api/auth/register')
        .send({ username: `other_${Date.now()}`, password: 'testpass123' });
      const otherLogin = await request(app)
        .post('/api/auth/login')
        .send({ username: other.body.username, password: 'testpass123' });
      await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${otherLogin.body.token}`)
        .send({ name: 'Outro Cliente', whatsapp: '5511999990000' });

      const response = await request(app)
        .get('/api/people?q=cliente')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const names = response.body.map((p) => p.name);
      expect(names).not.toContain('Outro Cliente');
    });

    it('should search people by accented name using an unaccented term', async () => {
      const accentedPersonId = (
        await prisma.person.create({
          data: {
            name: 'Cássia Silva',
            whatsapp: '5511955554444',
            userId,
          },
        })
      ).id;
      try {
        const response = await request(app)
          .get('/api/people?q=cassia')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        const ids = response.body.map((p) => p.id);
        expect(ids).toContain(accentedPersonId);
      } finally {
        await prisma.person
          .delete({ where: { id: accentedPersonId } })
          .catch(() => {});
      }
    });

    it('should search people by unaccented name using an accented term', async () => {
      const plainPersonId = (
        await prisma.person.create({
          data: {
            name: 'Cassia Souza',
            whatsapp: '5511955553333',
            userId,
          },
        })
      ).id;
      try {
        const response = await request(app)
          .get('/api/people?q=C%C3%A1ssia')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        const ids = response.body.map((p) => p.id);
        expect(ids).toContain(plainPersonId);
      } finally {
        await prisma.person
          .delete({ where: { id: plainPersonId } })
          .catch(() => {});
      }
    });
  });

  describe('PUT /api/people/:id', () => {
    beforeEach(async () => {
      const person = await prisma.person.create({
        data: {
          name: 'Original Name',
          whatsapp: '5511999998888',
          commonGroups: 'Grupo Original',
          instagram: 'https://instagram.com/original',
          address: 'Endereço Original',
          isVip: false,
          isDoterraMember: false,
          userId,
        },
      });
      createdPersonId = person.id;
    });

    it('should update person with valid data', async () => {
      const response = await request(app)
        .put(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name', whatsapp: '5511977776666' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.whatsapp).toBe('5511977776666');
    });

    it('should update all client fields', async () => {
      const response = await request(app)
        .put(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name',
          whatsapp: '5511966665555',
          commonGroups: 'Família',
          instagram: 'https://instagram.com/updated',
          address: 'Rua Atualizada, 99',
          observacao: 'Cliente migrou de plano em 2026.',
          isVip: true,
          isDoterraMember: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.commonGroups).toBe('Família');
      expect(response.body.instagram).toBe('https://instagram.com/updated');
      expect(response.body.address).toBe('Rua Atualizada, 99');
      expect(response.body.observacao).toBe('Cliente migrou de plano em 2026.');
      expect(response.body.isVip).toBe(true);
      expect(response.body.isDoterraMember).toBe(true);
    });

    it('should update only name', async () => {
      const response = await request(app)
        .put(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Name Only' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Name Only');
      expect(response.body.whatsapp).toBe('5511999998888');
    });

    it('should update the birthday field', async () => {
      const response = await request(app)
        .put(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Birthday Updated', birthday: '03/11' });

      expect(response.status).toBe(200);
      expect(response.body.birthday).toBe('03/11');
    });

    it('should clear the birthday with explicit null', async () => {
      await prisma.person.update({
        where: { id: createdPersonId },
        data: { birthday: '15/08' },
      });
      const response = await request(app)
        .put(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Birthday Cleared', birthday: null });

      expect(response.status).toBe(200);
      expect(response.body.birthday).toBeNull();
    });

    it('should clear whatsapp with explicit null', async () => {
      const response = await request(app)
        .put(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cleared Contact', whatsapp: null });

      expect(response.status).toBe(200);
      expect(response.body.whatsapp).toBeNull();
    });

    it('should clear observacao with explicit null', async () => {
      await prisma.person.update({
        where: { id: createdPersonId },
        data: { observacao: 'Texto temporário' },
      });
      const response = await request(app)
        .put(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cleared Observacao', observacao: null });

      expect(response.status).toBe(200);
      expect(response.body.observacao).toBeNull();
    });

    it('should return 404 for non-existent person', async () => {
      const response = await request(app)
        .put('/api/people/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(404);
    });

    it('should reject update with invalid data', async () => {
      const response = await request(app)
        .put(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' });

      expect(response.status).toBe(400);
    });

    it('should reject update with non-boolean isDoterraMember', async () => {
      const response = await request(app)
        .put(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Bad Member', isDoterraMember: 'yes' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/people/:id', () => {
    beforeEach(async () => {
      const person = await prisma.person.create({
        data: { name: 'Person to Delete', whatsapp: '5511999998888', userId },
      });
      createdPersonId = person.id;
    });

    it('should delete a person', async () => {
      const response = await request(app)
        .delete(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Person deleted successfully');

      const getResponse = await request(app)
        .get(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(getResponse.status).toBe(404);
      createdPersonId = null;
    });

    it('should return 404 for non-existent person', async () => {
      const response = await request(app)
        .delete('/api/people/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Self person (isSelf)', () => {
    let createdSelfIds = [];

    afterEach(async () => {
      for (const id of createdSelfIds) {
        await prisma.person.delete({ where: { id } }).catch(() => {});
      }
      createdSelfIds = [];
    });

    it('should create a person with isSelf defaulting to false', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Self Default' });

      expect(response.status).toBe(201);
      expect(response.body.isSelf).toBe(false);
      createdSelfIds.push(response.body.id);
    });

    it('should create a person with isSelf true', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Self Person', isSelf: true });

      expect(response.status).toBe(201);
      expect(response.body.isSelf).toBe(true);
      createdSelfIds.push(response.body.id);
    });

    it('should reject non-boolean isSelf', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Bad Self', isSelf: 'yes' });

      expect(response.status).toBe(400);
    });

    it('should allow updating a person to isSelf true', async () => {
      const createRes = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Become Self' });
      const personId = createRes.body.id;
      createdSelfIds.push(personId);

      const response = await request(app)
        .put(`/api/people/${personId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Become Self', isSelf: true });

      expect(response.status).toBe(200);
      expect(response.body.isSelf).toBe(true);
    });

    it('should keep only one self person per user (creating a new self unsets the previous)', async () => {
      const first = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Self One', isSelf: true });
      createdSelfIds.push(first.body.id);

      const second = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Self Two', isSelf: true });
      createdSelfIds.push(second.body.id);

      expect(second.body.isSelf).toBe(true);

      const list = await request(app)
        .get('/api/people')
        .set('Authorization', `Bearer ${authToken}`);
      const selfPeople = list.body.filter((p) => p.isSelf);
      expect(selfPeople).toHaveLength(1);
      expect(selfPeople[0].id).toBe(second.body.id);
    });

    it('should keep only one self person per user (updating an existing person unsets the previous)', async () => {
      const first = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Self Keep One', isSelf: true });
      createdSelfIds.push(first.body.id);

      const second = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Other Keep Two' });
      createdSelfIds.push(second.body.id);

      const updateRes = await request(app)
        .put(`/api/people/${second.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Other Keep Two', isSelf: true });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.isSelf).toBe(true);

      const list = await request(app)
        .get('/api/people')
        .set('Authorization', `Bearer ${authToken}`);
      const selfPeople = list.body.filter((p) => p.isSelf);
      expect(selfPeople).toHaveLength(1);
      expect(selfPeople[0].id).toBe(second.body.id);
    });

    it('should unset isSelf when explicitly set to false', async () => {
      const createRes = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Unset Self', isSelf: true });
      createdSelfIds.push(createRes.body.id);

      const response = await request(app)
        .put(`/api/people/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Unset Self', isSelf: false });

      expect(response.status).toBe(200);
      expect(response.body.isSelf).toBe(false);
    });
  });

  describe('POST /api/people/self', () => {
    let createdSelfIds = [];

    afterEach(async () => {
      for (const id of createdSelfIds) {
        await prisma.person.delete({ where: { id } }).catch(() => {});
      }
      createdSelfIds = [];
    });

    it('should create the self person on first call', async () => {
      const response = await request(app)
        .post('/api/people/self')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(201);
      expect(response.body.isSelf).toBe(true);
      expect(response.body.name).toBeDefined();
      createdSelfIds.push(response.body.id);
    });

    it('should return the existing self person on subsequent calls', async () => {
      const first = await request(app)
        .post('/api/people/self')
        .set('Authorization', `Bearer ${authToken}`);
      createdSelfIds.push(first.body.id);

      const second = await request(app)
        .post('/api/people/self')
        .set('Authorization', `Bearer ${authToken}`);

      expect(second.status).toBe(200);
      expect(second.body.id).toBe(first.body.id);
      expect(second.body.isSelf).toBe(true);
    });

    it('should return 401 when no authentication token is provided', async () => {
      const response = await request(app).post('/api/people/self');
      expect(response.status).toBe(401);
    });
  });
});

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
      expect(response.body.isVip).toBe(false);
      expect(response.body.isDoterraMember).toBe(false);
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
          isVip: true,
          isDoterraMember: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.commonGroups).toBe('Família');
      expect(response.body.instagram).toBe('https://instagram.com/updated');
      expect(response.body.address).toBe('Rua Atualizada, 99');
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

    it('should clear whatsapp with explicit null', async () => {
      const response = await request(app)
        .put(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cleared Contact', whatsapp: null });

      expect(response.status).toBe(200);
      expect(response.body.whatsapp).toBeNull();
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
});

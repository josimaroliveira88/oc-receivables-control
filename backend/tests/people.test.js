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
      await prisma.person.delete({ where: { id: createdPersonId } }).catch(() => {});
      createdPersonId = null;
    }
  });

  describe('POST /api/people', () => {
    it('should create a new person with valid data', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'João Silva', contact: 'joao@email.com' });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('João Silva');
      expect(response.body.contact).toBe('joao@email.com');
      expect(response.body.id).toBeDefined();
      createdPersonId = response.body.id;
    });

    it('should create a person without contact (optional field)', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Maria Santos' });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Maria Santos');
      expect(response.body.contact).toBeNull();
      createdPersonId = response.body.id;
    });

    it('should reject request with missing name', async () => {
      const response = await request(app)
        .post('/api/people')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contact: 'email@test.com' });

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
        .send({ name: 12345, contact: true });

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
        data: { name: 'Test Person', contact: 'test@email.com', userId },
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

    it('should return a single person by ID', async () => {
      const response = await request(app)
        .get(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(createdPersonId);
      expect(response.body.name).toBe('Test Person');
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
        data: { name: 'Original Name', contact: 'original@email.com', userId },
      });
      createdPersonId = person.id;
    });

    it('should update person with valid data', async () => {
      const response = await request(app)
        .put(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name', contact: 'updated@email.com' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.contact).toBe('updated@email.com');
    });

    it('should update only name', async () => {
      const response = await request(app)
        .put(`/api/people/${createdPersonId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Name Only' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Name Only');
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
  });

  describe('DELETE /api/people/:id', () => {
    beforeEach(async () => {
      const person = await prisma.person.create({
        data: { name: 'Person to Delete', contact: 'delete@email.com', userId },
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

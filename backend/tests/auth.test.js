const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');
const bcrypt = require('bcryptjs');

describe('User Registration', () => {
  let createdUserId;
  const testUsername = 'testuser_' + Date.now();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (createdUserId) {
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
      createdUserId = null;
    }
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: testUsername, password: 'senha123' });

      expect(response.status).toBe(201);
      expect(response.body.username).toBe(testUsername);
      expect(response.body.id).toBeDefined();
      expect(response.body.password).toBeUndefined();
      createdUserId = response.body.id;
    });

    it('should reject duplicate username', async () => {
      const hashedPassword = await bcrypt.hash('senha123', 10);
      const existing = await prisma.user.create({
        data: { username: 'duplicado', password: hashedPassword },
      });
      createdUserId = existing.id;

      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'duplicado', password: 'senha123' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Username already exists');
    });

    it('should reject registration with short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'outrousuario', password: '123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject registration with short username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'ab', password: 'senha123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });
});

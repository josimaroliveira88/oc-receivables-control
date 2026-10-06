import request from 'supertest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { createTestUser } from './helpers/createTestUser.js';

// The SHA-256 hex of a token is what the service stores, so tests that forge
// rows directly (expiration, wrong scope) reuse the same derivation.
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

const activity = (overrides = {}) => ({
  uuid: overrides.uuid ?? randomUUID(),
  cardURL: `https://riders.uber.com/trips/${overrides.uuid ?? 'x'}`,
  description: 'R$32,93 • Cássia',
  subtitle: '26 de set. • 13:02',
  title: 'Duo Residence Mall',
  ...overrides,
});

const envelope = (atividades) => ({
  source: 'UBER_SESSION',
  windowStart: '2026-08-28T00:00:00.000Z',
  windowEnd: '2026-09-28T00:00:00.000Z',
  profiles: {
    FAMILY: {
      total: atividades.length,
      corridas: atividades.length,
      canceladas: 0,
      atividades,
    },
  },
});

describe('API tokens for the Uber rides extension', () => {
  let user;

  beforeAll(async () => {
    await prisma.$connect();
    user = await createTestUser('api_token');
  });

  afterEach(async () => {
    if (!user) return;
    await prisma.financialTransaction.deleteMany({
      where: { userId: user.user.id },
    });
    await prisma.rideRecord.deleteMany({ where: { userId: user.user.id } });
    await prisma.apiToken.deleteMany({ where: { userId: user.user.id } });
  });

  afterAll(async () => {
    if (user) {
      await prisma.financialTransaction.deleteMany({
        where: { userId: user.user.id },
      });
      await prisma.rideRecord.deleteMany({ where: { userId: user.user.id } });
      await prisma.apiToken.deleteMany({ where: { userId: user.user.id } });
      await prisma.user.delete({ where: { id: user.user.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  const post = (url, body, token) =>
    request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);

  describe('lifecycle', () => {
    it('creates a token and returns the cleartext once, with lastFour and expiry', async () => {
      const response = await post(
        '/api/api-tokens',
        { name: 'Extensão' },
        user.token,
      );

      expect(response.status).toBe(201);
      expect(response.body.token).toMatch(/^cr_[A-Za-z0-9_-]{40,}$/);
      expect(response.body.lastFour).toBe(response.body.token.slice(-4));
      expect(response.body.scope).toBe('uber:import');
      expect(response.body.name).toBe('Extensão');
      const ttlMs = new Date(response.body.expiresAt) - new Date();
      expect(ttlMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
      expect(ttlMs).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000);

      // The stored row only carries the hash: the cleartext can never be
      // recovered from the database.
      const row = await prisma.apiToken.findUnique({
        where: { id: response.body.id },
      });
      expect(row.tokenHash).not.toBe(response.body.token);

      const list = await request(app)
        .get('/api/api-tokens')
        .set('Authorization', `Bearer ${user.token}`);
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({
        id: response.body.id,
        lastFour: response.body.lastFour,
        scope: 'uber:import',
      });
      expect(list.body[0].token).toBeUndefined();
      expect(list.body[0].tokenHash).toBeUndefined();
    });

    it('honours a shorter TTL when requested', async () => {
      const response = await post(
        '/api/api-tokens',
        { name: 'Curto', ttlDays: 7 },
        user.token,
      );
      const ttlMs = new Date(response.body.expiresAt) - new Date();
      expect(ttlMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
      expect(ttlMs).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
    });

    it('rejects an invalid payload with 400', async () => {
      const response = await post('/api/api-tokens', { name: '' }, user.token);
      expect(response.status).toBe(400);
    });

    it('requires authentication', async () => {
      const response = await request(app).get('/api/api-tokens');
      expect(response.status).toBe(401);
    });

    it('revokes a token, which then stops authorizing the extension', async () => {
      const created = await post(
        '/api/api-tokens',
        { name: 'Extensão' },
        user.token,
      );
      const revoke = await request(app)
        .delete(`/api/api-tokens/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(revoke.status).toBe(200);

      const importRides = await request(app)
        .post('/api/uber/rides/import')
        .set('Authorization', `Bearer ${created.body.token}`)
        .send({ json: JSON.stringify(envelope([activity()])) });
      expect(importRides.status).toBe(401);

      const revoked = await prisma.apiToken.findUnique({
        where: { id: created.body.id },
      });
      expect(revoked.revokedAt).not.toBeNull();
    });

    it("does not expose or revoke another user's tokens", async () => {
      const other = await createTestUser('api_token_other');
      const created = await post(
        '/api/api-tokens',
        { name: 'Extensão' },
        user.token,
      );

      const otherList = await request(app)
        .get('/api/api-tokens')
        .set('Authorization', `Bearer ${other.token}`);
      expect(otherList.status).toBe(200);
      expect(otherList.body).toHaveLength(0);

      const subtleRevoke = await request(app)
        .delete(`/api/api-tokens/${created.body.id}`)
        .set('Authorization', `Bearer ${other.token}`);
      expect(subtleRevoke.status).toBe(404);

      const stillListed = await request(app)
        .get('/api/api-tokens')
        .set('Authorization', `Bearer ${user.token}`);
      expect(stillListed.body).toHaveLength(1);

      await prisma.apiToken.deleteMany({ where: { userId: other.user.id } });
      await prisma.user
        .delete({ where: { id: other.user.id } })
        .catch(() => {});
    });
  });

  describe('extension-style import authorization', () => {
    it('authorizes POST /api/uber/rides/import with an API token', async () => {
      const created = await post(
        '/api/api-tokens',
        { name: 'Extensão' },
        user.token,
      );

      const response = await request(app)
        .post('/api/uber/rides/import')
        .set('Authorization', `Bearer ${created.body.token}`)
        .send({
          json: JSON.stringify(envelope([activity({ uuid: 'token-ride' })])),
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ total: 1, created: 1 });

      // The token belongs to the same user: scope by userId still applies.
      const rides = await prisma.rideRecord.findMany({
        where: { externalId: 'token-ride' },
      });
      expect(rides).toHaveLength(1);
      expect(rides[0].userId).toBe(user.user.id);
    });

    it('rejects an unknown token with 401', async () => {
      const response = await request(app)
        .post('/api/uber/rides/import')
        .set(
          'Authorization',
          `Bearer cr_${randomBytes(24).toString('base64url')}`,
        )
        .send({ json: JSON.stringify(envelope([activity()])) });
      expect(response.status).toBe(401);
    });

    it('rejects an expired token with 401', async () => {
      const token = `cr_${randomBytes(24).toString('base64url')}`;
      await prisma.apiToken.create({
        data: {
          userId: user.user.id,
          name: 'Expirado',
          scope: 'uber:import',
          tokenHash: hashToken(token),
          lastFour: token.slice(-4),
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      const response = await request(app)
        .post('/api/uber/rides/import')
        .set('Authorization', `Bearer ${token}`)
        .send({ json: JSON.stringify(envelope([activity()])) });
      expect(response.status).toBe(401);
    });

    it('rejects a token of a different scope with 403', async () => {
      const token = `cr_${randomBytes(24).toString('base64url')}`;
      await prisma.apiToken.create({
        data: {
          userId: user.user.id,
          name: 'Escopo errado',
          scope: 'outra:coisa',
          tokenHash: hashToken(token),
          lastFour: token.slice(-4),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const response = await request(app)
        .post('/api/uber/rides/import')
        .set('Authorization', `Bearer ${token}`)
        .send({ json: JSON.stringify(envelope([activity()])) });
      expect(response.status).toBe(403);
    });

    it('still accepts a session JWT on the import route', async () => {
      const response = await request(app)
        .post('/api/uber/rides/import')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          json: JSON.stringify(envelope([activity({ uuid: 'jwt-ride' })])),
        });
      expect(response.status).toBe(200);
    });

    it('does not accept an API token on JWT-only routes', async () => {
      const created = await post(
        '/api/api-tokens',
        { name: 'Extensão' },
        user.token,
      );
      const response = await request(app)
        .get('/api/uber/rides')
        .set('Authorization', `Bearer ${created.body.token}`);
      // The composed auth only guards the import route; `GET /rides` keeps the
      // strict JWT middleware, which rejects a non-JWT string with 403.
      expect(response.status).toBe(403);
    });
  });

  describe('multi-scope tokens', () => {
    it('creates a token carrying both scopes and authorizes both imports', async () => {
      const created = await post(
        '/api/api-tokens',
        { name: 'Ambos', scopes: ['uber:import', 'doterra:import'] },
        user.token,
      );

      expect(created.status).toBe(201);
      expect(created.body.scope).toBe('uber:import,doterra:import');
      const token = created.body.token;

      const lookup = await request(app)
        .post('/api/doterra/orders/lookup')
        .set('Authorization', `Bearer ${token}`)
        .send({ numbers: ['nao-existe'] });
      expect(lookup.status).toBe(200);

      const rides = await request(app)
        .post('/api/uber/rides/import')
        .set('Authorization', `Bearer ${token}`)
        .send({
          json: JSON.stringify(
            envelope([activity({ uuid: 'multi-scope-ride' })]),
          ),
        });
      expect(rides.status).toBe(200);
    });

    it('rejects an unknown scope in the scopes array', async () => {
      const response = await post(
        '/api/api-tokens',
        { name: 'Ruim', scopes: ['outra:coisa'] },
        user.token,
      );
      expect(response.status).toBe(400);
    });
  });
});

import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { DEFAULT_CATEGORIES } from '../src/utils/financeDefaults.js';

describe('Finances categories API', () => {
  let userId;
  let authToken;
  let otherUserId;
  let otherToken;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      userId = null;
      authToken = null;
    }
    if (otherUserId) {
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
      otherUserId = null;
      otherToken = null;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const register = async (prefix) => {
    const username = `${prefix}_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'testpass123' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'testpass123' });

    return { userId: registerRes.body.id, token: loginRes.body.token };
  };

  const createUser = async () => {
    const user = await register('fin_cat');
    userId = user.userId;
    authToken = user.token;
    return user;
  };

  const createOtherUser = async () => {
    const user = await register('fin_cat_other');
    otherUserId = user.userId;
    otherToken = user.token;
    return user;
  };

  const getCategories = (token = authToken) =>
    request(app)
      .get('/api/finances/categories')
      .set('Authorization', `Bearer ${token}`);

  const postCategory = (body, token = authToken) =>
    request(app)
      .post('/api/finances/categories')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const putCategory = (id, body, token = authToken) =>
    request(app)
      .put(`/api/finances/categories/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const deleteCategory = (id, token = authToken) =>
    request(app)
      .delete(`/api/finances/categories/${id}`)
      .set('Authorization', `Bearer ${token}`);

  const findCategory = async (uid, type, name) =>
    prisma.financialCategory.findFirst({ where: { userId: uid, type, name } });

  describe('authentication', () => {
    it('rejects listing without a token', async () => {
      const response = await request(app).get('/api/finances/categories');
      expect(response.status).toBe(401);
    });

    it('rejects creation without a token', async () => {
      const response = await request(app)
        .post('/api/finances/categories')
        .send({ name: 'Frete expresso', type: 'DESPESA' });
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/finances/categories', () => {
    it('returns the default categories for the user', async () => {
      await createUser();

      const response = await getCategories();

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(DEFAULT_CATEGORIES.length);
      expect(response.body.every((c) => c.isDefault)).toBe(true);
      expect(response.body.every((c) => c.active)).toBe(true);
    });

    it('seeds the defaults on first access when the user has none', async () => {
      const user = await createUser();
      await prisma.financialCategory.deleteMany({
        where: { userId: user.userId },
      });

      const response = await getCategories();

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(DEFAULT_CATEGORIES.length);
      expect(response.body.every((c) => c.isDefault)).toBe(true);
    });

    it('does not duplicate the defaults on repeated access', async () => {
      await createUser();

      const first = await getCategories();
      const second = await getCategories();

      expect(second.status).toBe(200);
      expect(second.body).toHaveLength(first.body.length);
      expect(second.body).toHaveLength(DEFAULT_CATEGORIES.length);
    });

    it('does not reseed a renamed default category', async () => {
      const user = await createUser();
      const vendas = await findCategory(user.userId, 'RECEITA', 'Vendas');

      const renamed = await putCategory(vendas.id, { name: 'Vendas online' });
      expect(renamed.status).toBe(200);

      const response = await getCategories();

      const names = response.body.map((c) => c.name);
      expect(names).toContain('Vendas online');
      expect(names).not.toContain('Vendas');
    });

    it('only returns categories that belong to the user', async () => {
      await createUser();
      await createOtherUser();

      const created = await postCategory(
        { name: 'Exclusiva do outro', type: 'DESPESA' },
        otherToken,
      );
      expect(created.status).toBe(201);

      const response = await getCategories(authToken);
      const names = response.body.map((c) => c.name);
      expect(names).not.toContain('Exclusiva do outro');

      const otherResponse = await getCategories(otherToken);
      expect(otherResponse.body.map((c) => c.name)).toContain(
        'Exclusiva do outro',
      );
    });
  });

  describe('POST /api/finances/categories', () => {
    it('creates a custom RECEITA category', async () => {
      await createUser();

      const response = await postCategory({
        name: 'Reembolso de eventos',
        type: 'RECEITA',
      });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Reembolso de eventos');
      expect(response.body.type).toBe('RECEITA');
      expect(response.body.isDefault).toBe(false);
      expect(response.body.active).toBe(true);
      expect(response.body.id).toBeDefined();
    });

    it('creates a custom DESPESA category', async () => {
      await createUser();

      const response = await postCategory({
        name: 'Viagens',
        type: 'DESPESA',
      });

      expect(response.status).toBe(201);
      expect(response.body.type).toBe('DESPESA');
      expect(response.body.isDefault).toBe(false);
    });

    it('trims the category name', async () => {
      await createUser();

      const response = await postCategory({
        name: '  Viagens  ',
        type: 'DESPESA',
      });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Viagens');
    });

    it('rejects a duplicate (type, name) for the same user with 409', async () => {
      await createUser();
      const first = await postCategory({ name: 'Viagens', type: 'DESPESA' });
      expect(first.status).toBe(201);

      const duplicate = await postCategory({
        name: 'Viagens',
        type: 'DESPESA',
      });

      expect(duplicate.status).toBe(409);
    });

    it('rejects a name that duplicates a default category', async () => {
      await createUser();

      const response = await postCategory({ name: 'Vendas', type: 'RECEITA' });

      expect(response.status).toBe(409);
    });

    it('allows the same name for a different type', async () => {
      await createUser();

      const response = await postCategory({ name: 'Ajuste', type: 'RECEITA' });
      expect(response.status).toBe(201);

      const expense = await postCategory({ name: 'Ajuste', type: 'DESPESA' });
      expect(expense.status).toBe(201);
    });

    it('rejects an empty name', async () => {
      await createUser();

      const response = await postCategory({ name: '   ', type: 'DESPESA' });

      expect(response.status).toBe(400);
    });

    it('rejects an invalid type', async () => {
      await createUser();

      const response = await postCategory({ name: 'Viagens', type: 'OUTRO' });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/finances/categories/:id', () => {
    it('renames a custom category', async () => {
      await createUser();
      const created = await postCategory({ name: 'Viagens', type: 'DESPESA' });

      const response = await putCategory(created.body.id, {
        name: 'Viagens e eventos',
      });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Viagens e eventos');
      expect(response.body.type).toBe('DESPESA');
    });

    it('soft-deactivates and reactivates a category', async () => {
      await createUser();
      const created = await postCategory({ name: 'Viagens', type: 'DESPESA' });

      const deactivated = await putCategory(created.body.id, { active: false });
      expect(deactivated.status).toBe(200);
      expect(deactivated.body.active).toBe(false);

      const stillThere = await prisma.financialCategory.findUnique({
        where: { id: created.body.id },
      });
      expect(stillThere).not.toBeNull();

      const reactivated = await putCategory(created.body.id, { active: true });
      expect(reactivated.status).toBe(200);
      expect(reactivated.body.active).toBe(true);
    });

    it('rejects renaming to an existing name of the same type with 409', async () => {
      await createUser();
      await postCategory({ name: 'Viagens', type: 'DESPESA' });
      const second = await postCategory({ name: 'Feiras', type: 'DESPESA' });

      const response = await putCategory(second.body.id, { name: 'Viagens' });

      expect(response.status).toBe(409);
    });

    it('returns 404 for a category from another user', async () => {
      await createUser();
      await createOtherUser();
      const other = await postCategory(
        { name: 'Do outro', type: 'DESPESA' },
        otherToken,
      );

      const response = await putCategory(other.body.id, { name: 'Invadida' });

      expect(response.status).toBe(404);
    });

    it('returns 404 for an unknown category', async () => {
      await createUser();

      const response = await putCategory(
        '00000000-0000-0000-0000-000000000000',
        {
          name: 'Inexistente',
        },
      );

      expect(response.status).toBe(404);
    });

    it('rejects an invalid active value', async () => {
      await createUser();
      const created = await postCategory({ name: 'Viagens', type: 'DESPESA' });

      const response = await putCategory(created.body.id, { active: 'não' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/finances/categories/:id', () => {
    it('soft-deactivates the category and keeps it in the list', async () => {
      await createUser();
      const created = await postCategory({ name: 'Viagens', type: 'DESPESA' });

      const response = await deleteCategory(created.body.id);

      expect(response.status).toBe(200);
      expect(response.body.message).toBeDefined();

      const persisted = await prisma.financialCategory.findUnique({
        where: { id: created.body.id },
      });
      expect(persisted).not.toBeNull();
      expect(persisted.active).toBe(false);

      const list = await getCategories();
      const listed = list.body.find((c) => c.id === created.body.id);
      expect(listed).toBeDefined();
      expect(listed.active).toBe(false);
    });

    it('returns 404 for a category from another user', async () => {
      await createUser();
      await createOtherUser();
      const other = await postCategory(
        { name: 'Do outro', type: 'DESPESA' },
        otherToken,
      );

      const response = await deleteCategory(other.body.id);

      expect(response.status).toBe(404);

      const persisted = await prisma.financialCategory.findUnique({
        where: { id: other.body.id },
      });
      expect(persisted.active).toBe(true);
    });

    it('returns 404 for an unknown category', async () => {
      await createUser();

      const response = await deleteCategory(
        '00000000-0000-0000-0000-000000000000',
      );

      expect(response.status).toBe(404);
    });
  });
});

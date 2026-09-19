import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import {
  DEFAULT_CATEGORIES,
  ORIGIN_CATEGORY_NAMES,
  ensureDefaultCategories,
  getDefaultCategoryName,
} from '../src/utils/financeDefaults.js';

describe('financeDefaults', () => {
  let userId;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    if (userId) {
      await prisma.financialCategory.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
      userId = null;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const createUser = async () => {
    const user = await prisma.user.create({
      data: {
        username: `fin_defaults_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        password: 'hash',
      },
    });
    userId = user.id;
    return user;
  };

  describe('DEFAULT_CATEGORIES', () => {
    it('covers both transaction types without duplicate (type, name) pairs', () => {
      const receitas = DEFAULT_CATEGORIES.filter((c) => c.type === 'RECEITA');
      const despesas = DEFAULT_CATEGORIES.filter((c) => c.type === 'DESPESA');

      expect(receitas.map((c) => c.name)).toEqual([
        'Vendas',
        'Bônus dōTERRA',
        'Reembolso',
        'Outras receitas',
      ]);
      expect(despesas.map((c) => c.name)).toEqual([
        'Compra de produtos dōTERRA',
        'Frete',
        'Taxas de gateway',
        'Material de escritório',
        'Eventos',
        'Marketing',
        'Outras despesas',
      ]);

      const keys = DEFAULT_CATEGORIES.map((c) => `${c.type}:${c.name}`);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe('getDefaultCategoryName', () => {
    it('maps automatic origins to their default category', () => {
      expect(getDefaultCategoryName('VENDA')).toBe('Vendas');
      expect(getDefaultCategoryName('RESGATE_INFINITEPAY')).toBe('Vendas');
      expect(getDefaultCategoryName('PEDIDO_DOTERRA')).toBe(
        'Compra de produtos dōTERRA',
      );
    });

    it('returns null for manual entries and unknown origins', () => {
      expect(getDefaultCategoryName('MANUAL')).toBeNull();
      expect(getDefaultCategoryName('UNKNOWN')).toBeNull();
    });

    it('exposes the same mapping through ORIGIN_CATEGORY_NAMES', () => {
      expect(ORIGIN_CATEGORY_NAMES.MANUAL).toBeNull();
      expect(Object.keys(ORIGIN_CATEGORY_NAMES)).toEqual([
        'VENDA',
        'RESGATE_INFINITEPAY',
        'PEDIDO_DOTERRA',
        'MANUAL',
      ]);
    });
  });

  describe('ensureDefaultCategories', () => {
    it('creates the full default set for a new user as default and active', async () => {
      const user = await createUser();

      await ensureDefaultCategories(user.id, prisma);

      const categories = await prisma.financialCategory.findMany({
        where: { userId: user.id },
      });

      expect(categories).toHaveLength(DEFAULT_CATEGORIES.length);
      expect(categories.every((c) => c.isDefault)).toBe(true);
      expect(categories.every((c) => c.active)).toBe(true);

      const persisted = categories.map((c) => `${c.type}:${c.name}`).sort();
      const expected = DEFAULT_CATEGORIES.map(
        (c) => `${c.type}:${c.name}`,
      ).sort();
      expect(persisted).toEqual(expected);
    });

    it('is idempotent and does not duplicate on a second call', async () => {
      const user = await createUser();

      await ensureDefaultCategories(user.id, prisma);
      await ensureDefaultCategories(user.id, prisma);

      const count = await prisma.financialCategory.count({
        where: { userId: user.id },
      });
      expect(count).toBe(DEFAULT_CATEGORIES.length);
    });

    it('does not touch categories belonging to another user', async () => {
      const user = await createUser();
      const other = await prisma.user.create({
        data: {
          username: `fin_defaults_other_${Date.now()}`,
          password: 'hash',
        },
      });

      try {
        await ensureDefaultCategories(user.id, prisma);

        const otherCount = await prisma.financialCategory.count({
          where: { userId: other.id },
        });
        expect(otherCount).toBe(0);
      } finally {
        await prisma.user.delete({ where: { id: other.id } }).catch(() => {});
      }
    });

    it('runs inside a caller-provided transaction client', async () => {
      const user = await createUser();

      await prisma.$transaction(async (tx) => {
        await ensureDefaultCategories(user.id, tx);
      });

      const count = await prisma.financialCategory.count({
        where: { userId: user.id },
      });
      expect(count).toBe(DEFAULT_CATEGORIES.length);
    });
  });

  describe('registration integration', () => {
    it('gives a newly registered user the default categories', async () => {
      const username = `fin_register_${Date.now()}`;

      const response = await request(app)
        .post('/api/auth/register')
        .send({ username, password: 'senha123' });

      expect(response.status).toBe(201);
      userId = response.body.id;

      const categories = await prisma.financialCategory.findMany({
        where: { userId },
      });

      expect(categories).toHaveLength(DEFAULT_CATEGORIES.length);
      expect(categories.every((c) => c.isDefault)).toBe(true);
    });
  });
});

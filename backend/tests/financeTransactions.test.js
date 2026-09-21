import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { parseLocalDate } from '../src/utils/date.js';

describe('Finances transactions API', () => {
  let userId;
  let authToken;
  let otherUserId;

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
    const user = await register('fin_tx');
    userId = user.userId;
    authToken = user.token;
    return user;
  };

  const createOtherUser = async () => {
    const user = await register('fin_tx_other');
    otherUserId = user.userId;
    return user;
  };

  const getCategory = (type, name) =>
    prisma.financialCategory.findFirst({ where: { userId, type, name } });

  const makeTransaction = (overrides = {}) => ({
    type: 'DESPESA',
    amount: 123.45,
    description: 'Material de escritório',
    transactionDate: '2026-09-19',
    ...overrides,
  });

  const listTransactions = (query = '', token = authToken) =>
    request(app)
      .get(`/api/finances/transactions${query}`)
      .set('Authorization', `Bearer ${token}`);

  const postTransaction = (body, token = authToken) =>
    request(app)
      .post('/api/finances/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const putTransaction = (id, body, token = authToken) =>
    request(app)
      .put(`/api/finances/transactions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const deleteTransaction = (id, token = authToken) =>
    request(app)
      .delete(`/api/finances/transactions/${id}`)
      .set('Authorization', `Bearer ${token}`);

  const getSummary = (query = '', token = authToken) =>
    request(app)
      .get(`/api/finances/summary${query}`)
      .set('Authorization', `Bearer ${token}`);

  const seedManual = (data) =>
    prisma.financialTransaction.create({
      data: {
        userId,
        type: data.type ?? 'DESPESA',
        origin: 'MANUAL',
        amount: data.amount ?? '10.00',
        description: data.description ?? 'Lançamento',
        transactionDate: parseLocalDate(data.transactionDate ?? '2026-09-19'),
        notes: data.notes ?? null,
        categoryId: data.categoryId ?? null,
      },
    });

  const seedAutomatic = (data = {}) =>
    prisma.financialTransaction.create({
      data: {
        userId,
        type: data.type ?? 'DESPESA',
        origin: data.origin ?? 'PEDIDO_DOTERRA',
        amount: data.amount ?? '100.00',
        description: data.description ?? 'Pedido dōTERRA 1',
        transactionDate: parseLocalDate(data.transactionDate ?? '2026-09-19'),
      },
    });

  describe('authentication', () => {
    it('rejects listing without a token', async () => {
      const response = await request(app).get('/api/finances/transactions');
      expect(response.status).toBe(401);
    });

    it('rejects creation without a token', async () => {
      const response = await request(app)
        .post('/api/finances/transactions')
        .send(makeTransaction());
      expect(response.status).toBe(401);
    });

    it('rejects the summary without a token', async () => {
      const response = await request(app).get('/api/finances/summary');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/finances/transactions', () => {
    it('creates a manual RECEITA with a matching category', async () => {
      await createUser();
      const category = await getCategory('RECEITA', 'Vendas');

      const response = await postTransaction(
        makeTransaction({
          type: 'RECEITA',
          amount: 200,
          description: 'Recebimento',
          categoryId: category.id,
        }),
      );

      expect(response.status).toBe(201);
      expect(response.body.origin).toBe('MANUAL');
      expect(response.body.type).toBe('RECEITA');
      expect(Number(response.body.amount)).toBe(200);
      expect(response.body.description).toBe('Recebimento');
      expect(response.body.categoryId).toBe(category.id);
      expect(response.body.orderId).toBeNull();
      expect(response.body.paymentId).toBeNull();
      expect(response.body.id).toBeDefined();
    });

    it('creates a manual DESPESA without a category', async () => {
      await createUser();

      const response = await postTransaction(makeTransaction());

      expect(response.status).toBe(201);
      expect(response.body.origin).toBe('MANUAL');
      expect(response.body.categoryId).toBeNull();
    });

    it('ignores a client-provided origin and forces MANUAL', async () => {
      await createUser();

      const response = await postTransaction(
        makeTransaction({ origin: 'PEDIDO_DOTERRA' }),
      );

      expect(response.status).toBe(201);
      expect(response.body.origin).toBe('MANUAL');
    });

    it('trims the description', async () => {
      await createUser();

      const response = await postTransaction(
        makeTransaction({ description: '  Material  ' }),
      );

      expect(response.status).toBe(201);
      expect(response.body.description).toBe('Material');
    });

    it('rejects a zero amount', async () => {
      await createUser();

      const response = await postTransaction(makeTransaction({ amount: 0 }));

      expect(response.status).toBe(400);
    });

    it('rejects a negative amount', async () => {
      await createUser();

      const response = await postTransaction(makeTransaction({ amount: -5 }));

      expect(response.status).toBe(400);
    });

    it('rejects a missing description', async () => {
      await createUser();

      const response = await postTransaction(
        makeTransaction({ description: undefined }),
      );

      expect(response.status).toBe(400);
    });

    it('rejects an invalid transaction date', async () => {
      await createUser();

      const response = await postTransaction(
        makeTransaction({ transactionDate: '19/09/2026' }),
      );

      expect(response.status).toBe(400);
    });

    it('rejects an invalid type', async () => {
      await createUser();

      const response = await postTransaction(
        makeTransaction({ type: 'OUTRO' }),
      );

      expect(response.status).toBe(400);
    });

    it('rejects a category that does not match the transaction type', async () => {
      await createUser();
      const expenseCategory = await getCategory(
        'DESPESA',
        'Material de escritório',
      );

      const response = await postTransaction(
        makeTransaction({ type: 'RECEITA', categoryId: expenseCategory.id }),
      );

      expect(response.status).toBe(400);
    });

    it('rejects a category from another user', async () => {
      await createUser();
      await createOtherUser();
      const otherCategory = await prisma.financialCategory.findFirst({
        where: { userId: otherUserId, type: 'DESPESA' },
      });

      const response = await postTransaction(
        makeTransaction({ categoryId: otherCategory.id }),
      );

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/finances/transactions', () => {
    it('returns only the transactions of the user', async () => {
      await createUser();
      await createOtherUser();

      await seedManual({ description: 'Minha despesa' });
      await prisma.financialTransaction.create({
        data: {
          userId: otherUserId,
          type: 'DESPESA',
          origin: 'MANUAL',
          amount: '50.00',
          description: 'Despesa do outro',
          transactionDate: parseLocalDate('2026-09-19'),
        },
      });

      const response = await listTransactions();

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].description).toBe('Minha despesa');
    });

    it('orders by transaction date desc then creation desc', async () => {
      await createUser();
      await seedManual({
        description: 'Antiga',
        transactionDate: '2026-01-01',
      });
      await seedManual({
        description: 'Recente',
        transactionDate: '2026-09-19',
      });

      const response = await listTransactions();

      expect(response.body.map((t) => t.description)).toEqual([
        'Recente',
        'Antiga',
      ]);
    });

    it('filters by type', async () => {
      await createUser();
      await seedManual({ type: 'RECEITA', description: 'Entrada' });
      await seedManual({ type: 'DESPESA', description: 'Saída' });

      const response = await listTransactions('?type=RECEITA');

      expect(response.body).toHaveLength(1);
      expect(response.body[0].description).toBe('Entrada');
    });

    it('filters by origin', async () => {
      await createUser();
      await seedManual({ description: 'Manual' });
      await seedAutomatic({ description: 'Pedido' });

      const response = await listTransactions('?origin=PEDIDO_DOTERRA');

      expect(response.body).toHaveLength(1);
      expect(response.body[0].description).toBe('Pedido');
    });

    it('filters by the sale additional expense origin', async () => {
      await createUser();
      await seedManual({ description: 'Manual' });
      await seedAutomatic({ description: 'Adicional' });
      await seedAutomatic({
        origin: 'VENDA_ADICIONAL',
        description: 'Adicional de venda',
      });

      const response = await listTransactions('?origin=VENDA_ADICIONAL');

      expect(response.body).toHaveLength(1);
      expect(response.body[0].description).toBe('Adicional de venda');
    });

    it('filters by category', async () => {
      await createUser();
      const category = await getCategory('DESPESA', 'Eventos');
      await seedManual({
        description: 'Com categoria',
        categoryId: category.id,
      });
      await seedManual({ description: 'Sem categoria' });

      const response = await listTransactions(`?categoryId=${category.id}`);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].description).toBe('Com categoria');
    });

    it('filters by an inclusive date range', async () => {
      await createUser();
      await seedManual({ description: 'Fora', transactionDate: '2026-08-31' });
      await seedManual({
        description: 'Início',
        transactionDate: '2026-09-01',
      });
      await seedManual({ description: 'Fim', transactionDate: '2026-09-30' });
      await seedManual({
        description: 'Depois',
        transactionDate: '2026-10-01',
      });

      const response = await listTransactions('?from=2026-09-01&to=2026-09-30');

      expect(response.body.map((t) => t.description).sort()).toEqual([
        'Fim',
        'Início',
      ]);
    });

    it('searches description and notes', async () => {
      await createUser();
      await seedManual({ description: 'Curso de aromaterapia' });
      await seedManual({ description: 'Outra', notes: 'material de curso' });
      await seedManual({ description: 'Nada a ver' });

      const response = await listTransactions('?q=curso');

      expect(response.body).toHaveLength(2);
    });

    it('includes the category and the derived fee of a linked payment', async () => {
      await createUser();
      const category = await getCategory('RECEITA', 'Vendas');

      const order = await prisma.order.create({
        data: {
          orderNumber: 'V-0001',
          totalValue: '100.00',
          orderType: 'VENDA',
          userId,
        },
      });
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: '100.00',
          netAmount: '97.00',
          paymentType: 'PIX',
        },
      });
      await prisma.financialTransaction.create({
        data: {
          userId,
          type: 'RECEITA',
          origin: 'VENDA',
          amount: '100.00',
          description: 'Venda V-0001',
          transactionDate: parseLocalDate('2026-09-19'),
          categoryId: category.id,
          orderId: order.id,
          paymentId: payment.id,
        },
      });

      const response = await listTransactions();

      expect(response.body).toHaveLength(1);
      expect(response.body[0].category.name).toBe('Vendas');
      expect(response.body[0].feeAmount).toBe('3.00');
    });
  });

  describe('PUT /api/finances/transactions/:id', () => {
    it('updates a manual transaction', async () => {
      await createUser();
      const created = await postTransaction(makeTransaction());

      const response = await putTransaction(created.body.id, {
        amount: 99.9,
        description: 'Atualizado',
        transactionDate: '2026-10-05',
      });

      expect(response.status).toBe(200);
      expect(Number(response.body.amount)).toBe(99.9);
      expect(response.body.description).toBe('Atualizado');
    });

    it('allows clearing the category with null', async () => {
      await createUser();
      const category = await getCategory('DESPESA', 'Eventos');
      const created = await postTransaction(
        makeTransaction({ categoryId: category.id }),
      );

      const response = await putTransaction(created.body.id, {
        categoryId: null,
      });

      expect(response.status).toBe(200);
      expect(response.body.categoryId).toBeNull();
    });

    it('rejects a category that does not match the effective type', async () => {
      await createUser();
      const expenseCategory = await getCategory('DESPESA', 'Eventos');
      const created = await postTransaction(makeTransaction());

      const response = await putTransaction(created.body.id, {
        type: 'RECEITA',
        categoryId: expenseCategory.id,
      });

      expect(response.status).toBe(400);
    });

    it('rejects a zero amount', async () => {
      await createUser();
      const created = await postTransaction(makeTransaction());

      const response = await putTransaction(created.body.id, { amount: 0 });

      expect(response.status).toBe(400);
    });

    it('rejects editing an automatic transaction', async () => {
      await createUser();
      const automatic = await seedAutomatic();

      const response = await putTransaction(automatic.id, { amount: 50 });

      expect(response.status).toBe(400);
    });

    it('returns 404 for a transaction from another user', async () => {
      await createUser();
      await createOtherUser();
      const other = await prisma.financialTransaction.create({
        data: {
          userId: otherUserId,
          type: 'DESPESA',
          origin: 'MANUAL',
          amount: '10.00',
          description: 'Do outro',
          transactionDate: parseLocalDate('2026-09-19'),
        },
      });

      const response = await putTransaction(other.id, { amount: 20 });

      expect(response.status).toBe(404);
    });

    it('returns 404 for an unknown transaction', async () => {
      await createUser();

      const response = await putTransaction(
        '00000000-0000-0000-0000-000000000000',
        { amount: 20 },
      );

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/finances/transactions/:id', () => {
    it('deletes a manual transaction', async () => {
      await createUser();
      const created = await postTransaction(makeTransaction());

      const response = await deleteTransaction(created.body.id);

      expect(response.status).toBe(200);
      expect(response.body.message).toBeDefined();

      const persisted = await prisma.financialTransaction.findUnique({
        where: { id: created.body.id },
      });
      expect(persisted).toBeNull();
    });

    it('rejects deleting an automatic transaction', async () => {
      await createUser();
      const automatic = await seedAutomatic();

      const response = await deleteTransaction(automatic.id);

      expect(response.status).toBe(400);

      const persisted = await prisma.financialTransaction.findUnique({
        where: { id: automatic.id },
      });
      expect(persisted).not.toBeNull();
    });

    it('returns 404 for a transaction from another user', async () => {
      await createUser();
      await createOtherUser();
      const other = await prisma.financialTransaction.create({
        data: {
          userId: otherUserId,
          type: 'DESPESA',
          origin: 'MANUAL',
          amount: '10.00',
          description: 'Do outro',
          transactionDate: parseLocalDate('2026-09-19'),
        },
      });

      const response = await deleteTransaction(other.id);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/finances/summary', () => {
    it('returns zeros when there are no transactions', async () => {
      await createUser();

      const response = await getSummary();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        totalIncome: '0.00',
        totalExpense: '0.00',
        balance: '0.00',
        pendingTotal: '0.00',
      });
    });

    it('totals income, expense and balance', async () => {
      await createUser();
      await seedManual({ type: 'RECEITA', amount: '1000.00' });
      await seedManual({ type: 'RECEITA', amount: '200.50' });
      await seedManual({ type: 'DESPESA', amount: '300.25' });

      const response = await getSummary();

      expect(response.body).toEqual({
        totalIncome: '1200.50',
        totalExpense: '300.25',
        balance: '900.25',
        pendingTotal: '0.00',
      });
    });

    it('returns a negative balance when expenses exceed income', async () => {
      await createUser();
      await seedManual({ type: 'RECEITA', amount: '10.00' });
      await seedManual({ type: 'DESPESA', amount: '25.00' });

      const response = await getSummary();

      expect(response.body.balance).toBe('-15.00');
    });

    it('applies the same filters as the listing', async () => {
      await createUser();
      await seedManual({ type: 'RECEITA', amount: '100.00' });
      await seedManual({
        type: 'DESPESA',
        amount: '40.00',
        transactionDate: '2026-01-01',
      });

      const response = await getSummary('?from=2026-09-01');

      expect(response.body).toEqual({
        totalIncome: '100.00',
        totalExpense: '0.00',
        balance: '100.00',
        pendingTotal: '0.00',
      });
    });

    it('ignores transactions from other users', async () => {
      await createUser();
      await createOtherUser();
      await prisma.financialTransaction.create({
        data: {
          userId: otherUserId,
          type: 'RECEITA',
          origin: 'MANUAL',
          amount: '999.00',
          description: 'Do outro',
          transactionDate: parseLocalDate('2026-09-19'),
        },
      });

      const response = await getSummary();

      expect(response.body.totalIncome).toBe('0.00');
    });
  });
});

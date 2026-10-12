import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';

const registerUser = async (prefix) => {
  const username = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'testpass123' });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'testpass123' });
  return { userId: regRes.body.id, token: loginRes.body.token };
};

const uniqueOrderNumber = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

describe('Orders credit-card fields', () => {
  let user;
  let clientPerson;

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('ordcard');
    clientPerson = await prisma.person.create({
      data: { name: 'Cliente Cartão', userId: user.userId },
    });
    await prisma.person.create({
      data: { name: 'Eu Mesmo', isSelf: true, userId: user.userId },
    });
  });

  afterEach(async () => {
    await prisma.creditCardBill.deleteMany({ where: { userId: user.userId } });
    await prisma.order.deleteMany({ where: { userId: user.userId } });
    await prisma.financialTransaction.deleteMany({
      where: { userId: user.userId },
    });
    await prisma.stockMovement.deleteMany({ where: { userId: user.userId } });
  });

  afterAll(async () => {
    if (user) {
      await prisma.user.delete({ where: { id: user.userId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  const createOrder = (body) =>
    request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${user.token}`)
      .send(body);

  const baseBody = (overrides = {}) => ({
    orderNumber: uniqueOrderNumber('CARD'),
    orderDate: '2026-09-20',
    paymentType: 'CARTAO_CREDITO',
    installments: 3,
    firstInstallmentAt: '2026-09-15',
    items: [{ description: 'Óleo', chargedValue: 300 }],
    ...overrides,
  });

  it('rejects a credit-card order without installments', async () => {
    const response = await createOrder(
      baseBody({ installments: undefined, firstInstallmentAt: undefined }),
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message:
            'A quantidade de parcelas é obrigatória para pedidos com cartão de crédito',
        }),
      ]),
    );
  });

  it('rejects a credit-card order without the first installment date', async () => {
    const response = await createOrder(
      baseBody({ firstInstallmentAt: undefined }),
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message:
            'A data da primeira parcela é obrigatória para pedidos com cartão de crédito',
        }),
      ]),
    );
  });

  it('rejects more than 24 installments', async () => {
    const response = await createOrder(baseBody({ installments: 25 }));

    expect(response.status).toBe(400);
  });

  it('creates a credit-card order with installments and first installment date', async () => {
    const response = await createOrder(baseBody());

    expect(response.status).toBe(201);
    expect(response.body.installments).toBe(3);
    expect(response.body.firstInstallmentAt.slice(0, 10)).toBe('2026-09-15');
  });

  it('updates installments and first installment date with validation', async () => {
    const created = await createOrder(baseBody());

    const invalid = await request(app)
      .put(`/api/orders/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ installments: 25 });
    expect(invalid.status).toBe(400);

    const valid = await request(app)
      .put(`/api/orders/${created.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ installments: 4, firstInstallmentAt: '2026-11-01' });
    expect(valid.status).toBe(200);
    expect(valid.body.installments).toBe(4);
    expect(valid.body.firstInstallmentAt.slice(0, 10)).toBe('2026-11-01');
  });

  it('does not feed the ledger with income when a credit-card order is paid', async () => {
    const created = await createOrder(baseBody());

    const payment = await request(app)
      .post(`/api/orders/${created.body.id}/payments`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        amount: 300,
        personId: clientPerson.id,
        paymentType: 'PIX',
        paidAt: '2026-09-20',
      });
    expect(payment.status).toBe(201);

    const income = await prisma.financialTransaction.findMany({
      where: { userId: user.userId, origin: 'VENDA' },
    });
    expect(income).toHaveLength(0);
  });

  // A team order is only a record: another person placed it and paid for it, so
  // it must never reach the finances. That covers the card bill and its pending
  // installments too, which makes the installment fields optional there.
  describe('team orders vs. credit-card installments', () => {
    const billFor = (orderId) =>
      prisma.creditCardBill.findFirst({
        where: { orderId, userId: user.userId },
      });

    const installmentsOf = (billId) =>
      prisma.financialTransaction.findMany({
        where: { creditCardBillId: billId, userId: user.userId },
        orderBy: { installmentNumber: 'asc' },
      });

    const ledgerRowsFor = (orderId) =>
      prisma.financialTransaction.findMany({
        where: { orderId, userId: user.userId },
      });

    const storedOrder = (orderId) =>
      prisma.order.findUnique({ where: { id: orderId } });

    const updateOrder = (orderId, body) =>
      request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send(body);

    it('accepts a team credit-card order without installments', async () => {
      const response = await createOrder(
        baseBody({
          isTeamOrder: true,
          installments: undefined,
          firstInstallmentAt: undefined,
        }),
      );

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('EQUIPE');
      expect(response.body.installments).toBeNull();
      expect(response.body.firstInstallmentAt).toBeNull();
    });

    it('creates no bill and no pending installments for a team order', async () => {
      const response = await createOrder(baseBody({ isTeamOrder: true }));
      expect(response.status).toBe(201);

      expect(await billFor(response.body.id)).toBeNull();
      expect(await ledgerRowsFor(response.body.id)).toHaveLength(0);
    });

    it('keeps the installments on the team order as an annotation', async () => {
      const response = await createOrder(baseBody({ isTeamOrder: true }));
      expect(response.status).toBe(201);

      // Stored on the order so the user can consult it, but never turned into
      // pending parcels in the card bill control.
      const stored = await storedOrder(response.body.id);
      expect(stored.installments).toBe(3);
      expect(stored.firstInstallmentAt).not.toBeNull();
      expect(await billFor(response.body.id)).toBeNull();
    });

    it('removes the bill and its installments when an order becomes a team order', async () => {
      const created = await createOrder(baseBody());
      const bill = await billFor(created.body.id);
      expect(bill).not.toBeNull();
      expect(await installmentsOf(bill.id)).toHaveLength(3);

      const updated = await updateOrder(created.body.id, { isTeamOrder: true });
      expect(updated.status).toBe(200);
      expect(updated.body.status).toBe('EQUIPE');

      expect(await billFor(created.body.id)).toBeNull();
      expect(await ledgerRowsFor(created.body.id)).toHaveLength(0);

      const stored = await storedOrder(created.body.id);
      expect(stored.installments).toBe(3);
    });

    it('rebuilds the bill when a team order is unflagged', async () => {
      const created = await createOrder(baseBody({ isTeamOrder: true }));
      expect(await billFor(created.body.id)).toBeNull();

      const updated = await updateOrder(created.body.id, {
        isTeamOrder: false,
      });
      expect(updated.status).toBe(200);
      expect(updated.body.status).not.toBe('EQUIPE');

      const bill = await billFor(created.body.id);
      expect(bill).not.toBeNull();
      expect(bill.installments).toBe(3);

      const rows = await installmentsOf(bill.id);
      expect(rows).toHaveLength(3);
      expect(rows.every((row) => row.isEffective === false)).toBe(true);
    });

    it('still requires installments for a non-team credit-card order', async () => {
      const response = await createOrder(
        baseBody({
          isTeamOrder: false,
          installments: undefined,
          firstInstallmentAt: undefined,
        }),
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message:
              'A quantidade de parcelas é obrigatória para pedidos com cartão de crédito',
          }),
        ]),
      );
    });

    it('still creates the bill and the pending installments for a non-team order', async () => {
      const response = await createOrder(baseBody({ isTeamOrder: false }));
      expect(response.status).toBe(201);

      const bill = await billFor(response.body.id);
      expect(bill).not.toBeNull();
      expect(bill.installments).toBe(3);

      const rows = await installmentsOf(bill.id);
      expect(rows).toHaveLength(3);
      expect(rows.every((row) => row.isEffective === false)).toBe(true);
      expect(rows.every((row) => row.origin === 'PEDIDO_DOTERRA')).toBe(true);
    });
  });
});

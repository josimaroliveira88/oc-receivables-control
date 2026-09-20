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

const HEADER = 'Data,Hora,Tipo de transação,Nome,Detalhe,Valor';

const rescueRow = (date, time, value) =>
  `${date},${time},Pix,Pix CASSIA GOUVEIA LIMA,Enviado,"${value}"`;

const depositRow = (date, time, value, name = 'Vendas') =>
  `${date},${time},Depósito de vendas,${name},Depósito InfinitePay,"${value}"`;

const csv = (...lines) => [HEADER, ...lines].join('\n');

describe('InfinitePay rescue import and undo', () => {
  let user;
  let otherUser;
  let client;
  let otherClient;
  let product;
  const createdOrderIds = [];

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  const createSale = async ({
    chargedValue,
    token = user.token,
    personId = client.id,
  }) => {
    const res = await request(app)
      .post('/api/sales')
      .set(auth(token))
      .send({
        clientPersonId: personId,
        orderDate: '2026-09-01',
        items: [{ productId: product.id, chargedValue, quantity: 1 }],
      });
    if (res.body?.id) createdOrderIds.push(res.body.id);
    return res;
  };

  const payInfinitePay = async ({
    orderId,
    amount,
    netAmount = null,
    token = user.token,
    personId = client.id,
  }) =>
    request(app)
      .post(`/api/orders/${orderId}/payments`)
      .set(auth(token))
      .send({ amount, netAmount, personId, paymentType: 'INFINITE_PAY' });

  const createInfinitePaySale = async ({
    chargedValue,
    netAmount = null,
    token = user.token,
    personId = client.id,
  }) => {
    const sale = await createSale({ chargedValue, token, personId });
    await payInfinitePay({
      orderId: sale.body.id,
      amount: chargedValue,
      netAmount,
      token,
      personId,
    });
    return sale;
  };

  const importCsv = (content, token = user.token) =>
    request(app)
      .post('/api/sales/infinitepay-rescues/import')
      .set(auth(token))
      .attach('file', Buffer.from(content), {
        filename: 'extrato.csv',
        contentType: 'text/csv',
      });

  const commitRescues = (body, token = user.token) =>
    request(app)
      .post('/api/sales/infinitepay-rescues/commit')
      .set(auth(token))
      .send(body);

  const undoSettlement = (id, token = user.token) =>
    request(app).delete(`/api/finances/settlements/${id}`).set(auth(token));

  const undoBatch = (batchId, token = user.token) =>
    request(app)
      .delete(`/api/finances/settlements/batch/${batchId}`)
      .set(auth(token));

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('rescue');
    otherUser = await registerUser('rescue2');
    client = await prisma.person.create({
      data: { name: 'Cliente Resgate', userId: user.userId },
    });
    otherClient = await prisma.person.create({
      data: { name: 'Cliente Outro', userId: otherUser.userId },
    });
    product = await prisma.product.create({
      data: {
        code: `TESTRESCUE${Date.now()}`,
        name: 'Produto Resgate',
        size: '30 ml',
        status: 'ATIVO',
        prices: { create: { regularPrice: 100, memberPrice: 75, pv: 10 } },
      },
    });
    for (const owner of [user, otherUser]) {
      await prisma.inventory.create({
        data: {
          userId: owner.userId,
          productId: product.id,
          quantity: 100000,
        },
      });
    }
  });

  afterEach(async () => {
    for (const owner of [user, otherUser]) {
      await prisma.financialTransaction.deleteMany({
        where: { userId: owner.userId },
      });
      await prisma.order.deleteMany({ where: { userId: owner.userId } });
      await prisma.stockMovement.deleteMany({
        where: { userId: owner.userId },
      });
    }
    createdOrderIds.length = 0;
    await prisma.inventory.updateMany({
      where: { productId: product.id },
      data: { quantity: 100000 },
    });
  });

  afterAll(async () => {
    for (const owner of [user, otherUser]) {
      if (owner) {
        await prisma.user
          .delete({ where: { id: owner.userId } })
          .catch(() => {});
      }
    }
    await prisma.stockMovement
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    await prisma.inventory
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('requires authentication', async () => {
    const res = await request(app).post(
      '/api/sales/infinitepay-rescues/import',
    );
    expect(res.status).toBe(401);
  });

  it('rejects a request without a file', async () => {
    const res = await request(app)
      .post('/api/sales/infinitepay-rescues/import')
      .set(auth(user.token));
    expect(res.status).toBe(400);
  });

  it('rejects a file whose header diverges', async () => {
    const res = await importCsv(
      [
        HEADER.replace('Valor', 'Montante'),
        rescueRow('2026-09-16', '08:50:45', '-R$ 1,00'),
      ].join('\n'),
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cabeçalho fora do padrão/);
  });

  it('previews a rescue matched to a sale and includes fully paid sales', async () => {
    const sale = await createInfinitePaySale({ chargedValue: 220.01 });
    expect(sale.status).toBe(201);

    const res = await importCsv(
      csv(
        rescueRow('2026-09-16', '08:50:45', '-R$ 220,01'),
        depositRow('2026-09-16', '08:47:16', '+R$ 220,01', 'Venda Nitro'),
      ),
    );

    expect(res.status).toBe(200);
    expect(res.body.batchId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.rescues).toHaveLength(1);

    const [rescued] = res.body.rescues;
    expect(rescued.amountCents).toBe(22001);
    expect(rescued.paired).toBe(true);
    expect(rescued.matches.map((m) => m.saleId)).toContain(sale.body.id);
    expect(rescued.sourceDeposits[0].matches.map((m) => m.saleId)).toContain(
      sale.body.id,
    );

    const pending = await prisma.financialTransaction.count({
      where: { userId: user.userId, origin: 'RESGATE_INFINITEPAY' },
    });
    expect(pending).toBe(0);
  });

  it('matches each source deposit of a bundled rescue', async () => {
    const first = await createInfinitePaySale({ chargedValue: 334.15 });
    const second = await createInfinitePaySale({ chargedValue: 161.17 });

    const res = await importCsv(
      csv(
        rescueRow('2026-08-31', '07:43:37', '-R$ 495,32'),
        depositRow('2026-08-31', '02:16:50', '+R$ 334,15'),
        depositRow('2026-08-31', '02:16:50', '+R$ 161,17'),
      ),
    );

    expect(res.status).toBe(200);
    const [rescued] = res.body.rescues;
    expect(rescued.matches).toEqual([]);
    expect(rescued.sourceDeposits).toHaveLength(2);
    expect(rescued.sourceDeposits[0].matches.map((m) => m.saleId)).toContain(
      first.body.id,
    );
    expect(rescued.sourceDeposits[1].matches.map((m) => m.saleId)).toContain(
      second.body.id,
    );
  });

  it('does not match another user sale', async () => {
    await createInfinitePaySale({
      chargedValue: 220.01,
      token: otherUser.token,
      personId: otherClient.id,
    });

    const res = await importCsv(
      csv(rescueRow('2026-09-16', '08:50:45', '-R$ 220,01')),
    );

    expect(res.status).toBe(200);
    expect(res.body.rescues[0].matches).toEqual([]);
    expect(res.body.candidateSales).toEqual([]);
  });

  it('commits a rescue for one sale with the batch id', async () => {
    const sale = await createInfinitePaySale({ chargedValue: 220.01 });
    const preview = await importCsv(
      csv(rescueRow('2026-09-16', '08:50:45', '-R$ 220,01')),
    );
    const { batchId } = preview.body;

    const res = await commitRescues({
      batchId,
      rescues: [
        {
          line: preview.body.rescues[0].line,
          rescueAmountCents: 22001,
          transactionDate: '2026-09-16',
          assignments: [{ orderId: sale.body.id, amountCents: 22001 }],
        },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.batchId).toBe(batchId);
    expect(res.body.created).toHaveLength(1);

    const rows = await prisma.financialTransaction.findMany({
      where: { userId: user.userId, origin: 'RESGATE_INFINITEPAY' },
    });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amount)).toBe(220.01);
    expect(rows[0].importBatchId).toBe(batchId);
    expect(rows[0].orderId).toBe(sale.body.id);
  });

  it('commits a bundled rescue across multiple sales', async () => {
    const first = await createInfinitePaySale({ chargedValue: 334.15 });
    const second = await createInfinitePaySale({ chargedValue: 161.17 });
    const preview = await importCsv(
      csv(rescueRow('2026-08-31', '07:43:37', '-R$ 495,32')),
    );

    const res = await commitRescues({
      batchId: preview.body.batchId,
      rescues: [
        {
          line: 2,
          rescueAmountCents: 49532,
          transactionDate: '2026-08-31',
          assignments: [
            { orderId: first.body.id, amountCents: 33415 },
            { orderId: second.body.id, amountCents: 16117 },
          ],
        },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(2);
    const rows = await prisma.financialTransaction.findMany({
      where: { userId: user.userId, origin: 'RESGATE_INFINITEPAY' },
    });
    expect(rows).toHaveLength(2);
  });

  it('rejects a rescue whose assignments do not sum to the redeemed amount', async () => {
    const sale = await createInfinitePaySale({ chargedValue: 220.01 });

    const res = await commitRescues({
      batchId: '11111111-1111-4111-8111-111111111111',
      rescues: [
        {
          line: 2,
          rescueAmountCents: 22001,
          transactionDate: '2026-09-16',
          assignments: [{ orderId: sale.body.id, amountCents: 20000 }],
        },
      ],
    });

    expect(res.status).toBe(400);

    const count = await prisma.financialTransaction.count({
      where: { userId: user.userId },
    });
    expect(count).toBe(0);
  });

  it('rejects a sale without an InfinitePay payment', async () => {
    const sale = await createSale({ chargedValue: 220.01 });
    await request(app)
      .post(`/api/orders/${sale.body.id}/payments`)
      .set(auth(user.token))
      .send({ amount: 220.01, personId: client.id, paymentType: 'PIX' });

    const res = await commitRescues({
      batchId: '22222222-2222-4222-8222-222222222222',
      rescues: [
        {
          line: 2,
          rescueAmountCents: 22001,
          transactionDate: '2026-09-16',
          assignments: [{ orderId: sale.body.id, amountCents: 22001 }],
        },
      ],
    });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown sale', async () => {
    const res = await commitRescues({
      batchId: '33333333-3333-4333-8333-333333333333',
      rescues: [
        {
          line: 2,
          rescueAmountCents: 22001,
          transactionDate: '2026-09-16',
          assignments: [
            {
              orderId: '00000000-0000-4000-8000-000000000000',
              amountCents: 22001,
            },
          ],
        },
      ],
    });

    expect(res.status).toBe(404);
  });

  it('rejects a duplicate redemption of the same sale on the same date', async () => {
    const sale = await createInfinitePaySale({ chargedValue: 220.01 });
    const reservation = {
      line: 2,
      rescueAmountCents: 22001,
      transactionDate: '2026-09-16',
      assignments: [{ orderId: sale.body.id, amountCents: 22001 }],
    };

    await commitRescues({
      batchId: '44444444-4444-4444-8444-444444444444',
      rescues: [reservation],
    });
    const res = await commitRescues({
      batchId: '55555555-5555-4555-8555-555555555555',
      rescues: [reservation],
    });

    expect(res.status).toBe(400);
    const count = await prisma.financialTransaction.count({
      where: { userId: user.userId, origin: 'RESGATE_INFINITEPAY' },
    });
    expect(count).toBe(1);
  });

  it('undoes a single redemption by id', async () => {
    const sale = await createInfinitePaySale({ chargedValue: 220.01 });
    const preview = await importCsv(
      csv(rescueRow('2026-09-16', '08:50:45', '-R$ 220,01')),
    );
    const commit = await commitRescues({
      batchId: preview.body.batchId,
      rescues: [
        {
          line: 2,
          rescueAmountCents: 22001,
          transactionDate: '2026-09-16',
          assignments: [{ orderId: sale.body.id, amountCents: 22001 }],
        },
      ],
    });

    const id = commit.body.created[0].id;
    const res = await undoSettlement(id);
    expect(res.status).toBe(200);

    const count = await prisma.financialTransaction.count({
      where: { userId: user.userId, importBatchId: preview.body.batchId },
    });
    expect(count).toBe(0);
  });

  it('refuses to undo a manual transaction through the settlement route', async () => {
    const manual = await request(app)
      .post('/api/finances/transactions')
      .set(auth(user.token))
      .send({
        type: 'RECEITA',
        amount: 100,
        description: 'Manual',
        transactionDate: '2026-09-16',
      });

    const res = await undoSettlement(manual.body.id);
    expect(res.status).toBe(400);
  });

  it('does not undo another user redemption', async () => {
    const otherSale = await createInfinitePaySale({
      chargedValue: 220.01,
      token: otherUser.token,
      personId: otherClient.id,
    });
    const otherPreview = await importCsv(
      csv(rescueRow('2026-09-16', '08:50:45', '-R$ 220,01')),
      otherUser.token,
    );
    const otherCommit = await commitRescues(
      {
        batchId: otherPreview.body.batchId,
        rescues: [
          {
            line: 2,
            rescueAmountCents: 22001,
            transactionDate: '2026-09-16',
            assignments: [{ orderId: otherSale.body.id, amountCents: 22001 }],
          },
        ],
      },
      otherUser.token,
    );

    const res = await undoSettlement(otherCommit.body.created[0].id);
    expect(res.status).toBe(404);
  });

  it('undoes a whole import batch and is idempotent', async () => {
    const first = await createInfinitePaySale({ chargedValue: 334.15 });
    const second = await createInfinitePaySale({ chargedValue: 161.17 });
    const preview = await importCsv(
      csv(rescueRow('2026-08-31', '07:43:37', '-R$ 495,32')),
    );
    await commitRescues({
      batchId: preview.body.batchId,
      rescues: [
        {
          line: 2,
          rescueAmountCents: 49532,
          transactionDate: '2026-08-31',
          assignments: [
            { orderId: first.body.id, amountCents: 33415 },
            { orderId: second.body.id, amountCents: 16117 },
          ],
        },
      ],
    });

    const res = await undoBatch(preview.body.batchId);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(2);

    const again = await undoBatch(preview.body.batchId);
    expect(again.status).toBe(200);
    expect(again.body.deleted).toBe(0);
  });
});

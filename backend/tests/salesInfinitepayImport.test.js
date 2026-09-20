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

const HEADER = [
  'Data e hora',
  'Meio - Meio',
  'Meio - Bandeira',
  'Meio - Parcelas',
  'Tipo - Origem',
  'Tipo - Dados adicionais',
  'Identificador',
  'Status',
  'Valor (R$)',
  'Líquido (R$)',
  'Taxa Aplicada - Valor(R$)',
  'Taxa Aplicada - Aplicada(%)',
  'Plano',
  'NSU',
  'Origem - Nome',
].join(',');

const row = ({ valor, liquido, status = 'Aprovada', name = 'Cliente CSV' }) =>
  `16/09/2026 08:47,Crédito,mastercard,À Vista,Gestão de Cobrança,'-,397720,${status},"${valor}","${liquido}","'- 14,01",5.98,Nitro,1ae51a8f-9931-4f46-9370-9a9c4c3f5987,${name}`;

const csv = (...rows) => [HEADER, ...rows].join('\n');

describe('POST /api/sales/infinitepay/import', () => {
  let user;
  let user2;
  let client;
  let product;
  const createdOrderIds = [];

  const createSale = async (chargedValue, authUser = user) => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${authUser.token}`)
      .send({
        clientPersonId: client.id,
        orderDate: '2026-09-01',
        items: [{ productId: product.id, chargedValue, quantity: 1 }],
      });
    if (res.body?.id) createdOrderIds.push(res.body.id);
    return res;
  };

  const importCsv = (content, authUser = user) =>
    request(app)
      .post('/api/sales/infinitepay/import')
      .set('Authorization', `Bearer ${authUser.token}`)
      .attach('file', Buffer.from(content), {
        filename: 'extrato.csv',
        contentType: 'text/csv',
      });

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('ipimport');
    user2 = await registerUser('ipimport2');
    client = await prisma.person.create({
      data: { name: 'Cliente Import', userId: user.userId },
    });
    product = await prisma.product.create({
      data: {
        code: `TESTIPIMPORT${Date.now()}`,
        name: 'Produto Import',
        size: '30 ml',
        status: 'ATIVO',
        prices: { create: { regularPrice: 100, memberPrice: 75, pv: 10 } },
      },
    });
    for (const owner of [user, user2]) {
      await prisma.inventory.upsert({
        where: {
          userId_productId: { userId: owner.userId, productId: product.id },
        },
        create: { userId: owner.userId, productId: product.id, quantity: 1000 },
        update: { quantity: 1000 },
      });
    }
  });

  afterEach(async () => {
    if (createdOrderIds.length > 0) {
      await prisma.order
        .deleteMany({ where: { id: { in: createdOrderIds } } })
        .catch(() => {});
      createdOrderIds.length = 0;
    }
    await prisma.stockMovement
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    await prisma.inventory
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    for (const owner of [user, user2]) {
      await prisma.inventory
        .create({
          data: { userId: owner.userId, productId: product.id, quantity: 1000 },
        })
        .catch(() => {});
    }
  });

  afterAll(async () => {
    for (const owner of [user, user2]) {
      if (owner) {
        await prisma.user
          .delete({ where: { id: owner.userId } })
          .catch(() => {});
      }
    }
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/sales/infinitepay/import')
      .attach(
        'file',
        Buffer.from(csv(row({ valor: '100,00', liquido: '95,00' }))),
        {
          filename: 'extrato.csv',
          contentType: 'text/csv',
        },
      );
    expect(res.status).toBe(401);
  });

  it('rejects a request without a file', async () => {
    const res = await request(app)
      .post('/api/sales/infinitepay/import')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(400);
  });

  it('rejects an unsupported file type', async () => {
    const res = await request(app)
      .post('/api/sales/infinitepay/import')
      .set('Authorization', `Bearer ${user.token}`)
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'extrato.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Tipo de arquivo inválido/);
  });

  it('matches gross and net sales and discards denied rows', async () => {
    const grossSale = await createSale(234.02);
    const netSale = await createSale(220.01);
    expect(grossSale.status).toBe(201);
    expect(netSale.status).toBe(201);

    const denied = row({
      valor: '999,99',
      liquido: '999,99',
      status: 'Negada',
    });
    const res = await importCsv(
      csv(row({ valor: '234,02', liquido: '220,01' }), denied),
    );

    expect(res.status).toBe(200);
    expect(res.body.ignoredCount).toBe(1);
    expect(res.body.rows).toHaveLength(1);

    const matches = res.body.rows[0].matches;
    expect(matches).toHaveLength(2);
    const byNumber = Object.fromEntries(matches.map((m) => [m.orderNumber, m]));
    expect(byNumber[grossSale.body.orderNumber].matchType).toBe('gross');
    expect(byNumber[netSale.body.orderNumber].matchType).toBe('net');
  });

  it('matches within the 2-cent tolerance', async () => {
    const sale = await createSale(100.0);
    const res = await importCsv(
      csv(row({ valor: '100,02', liquido: '90,00' })),
    );

    expect(res.status).toBe(200);
    const matches = res.body.rows[0].matches;
    expect(matches.some((m) => m.orderNumber === sale.body.orderNumber)).toBe(
      true,
    );
  });

  it('does not match a sale whose value differs by more than 2 cents', async () => {
    const sale = await createSale(100.0);
    const res = await importCsv(
      csv(row({ valor: '100,03', liquido: '50,00' })),
    );

    expect(res.status).toBe(200);
    const matches = res.body.rows[0].matches;
    expect(matches.some((m) => m.orderNumber === sale.body.orderNumber)).toBe(
      false,
    );
  });

  it('rejects a malformed row with the line number', async () => {
    const badRow = row({ valor: '234,02', liquido: '220,01' }).replace(
      '16/09/2026 08:47',
      '31/02/2026 08:47',
    );
    const res = await importCsv(
      csv(row({ valor: '1,00', liquido: '1,00' }), badRow),
    );

    expect(res.status).toBe(400);
    expect(res.body.line).toBe(3);
    expect(res.body.error).toMatch(/Linha 3/);
  });

  it('rejects a file whose header diverges', async () => {
    const badHeader = HEADER.replace('Valor (R$)', 'Valor');
    const res = await importCsv(
      [badHeader, row({ valor: '234,02', liquido: '220,01' })].join('\n'),
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cabeçalho fora do padrão/);
  });

  it('does not match another user sale', async () => {
    const otherClient = await prisma.person.create({
      data: { name: 'Cliente Outro', userId: user2.userId },
    });
    const otherSale = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${user2.token}`)
      .send({
        clientPersonId: otherClient.id,
        orderDate: '2026-09-01',
        items: [{ productId: product.id, chargedValue: 234.02, quantity: 1 }],
      });
    createdOrderIds.push(otherSale.body.id);

    const res = await importCsv(
      csv(row({ valor: '234,02', liquido: '220,01' })),
    );

    expect(res.status).toBe(200);
    expect(res.body.rows[0].matches).toEqual([]);
  });

  it('does not match a fully paid (QUITADO) sale', async () => {
    const sale = await createSale(234.02);
    const payment = await request(app)
      .post(`/api/orders/${sale.body.id}/payments`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ amount: 234.02, personId: client.id });
    expect(payment.status).toBe(201);

    const res = await importCsv(
      csv(row({ valor: '234,02', liquido: '220,01' })),
    );

    expect(res.status).toBe(200);
    expect(res.body.rows[0].matches).toEqual([]);
  });
});

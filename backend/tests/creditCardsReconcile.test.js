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

const block = ({ type = 'PAYMENT', date, amount, fitid, memo }) =>
  `<STMTTRN><TRNTYPE>${type}</TRNTYPE>
<DTPOSTED>${date}</DTPOSTED>
<TRNAMT>${amount}</TRNAMT>
<FITID>${fitid}</FITID>
<MEMO>${memo}</MEMO>
</STMTTRN>`;

const ofx = (...blocks) => `<OFX>
<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
<BANKTRANLIST>
<DTSTART>20250101</DTSTART>
<DTEND>20260907</DTEND>
${blocks.join('\n')}
</BANKTRANLIST>
</CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>
</OFX>`;

describe('Credit-card OFX reconciliation', () => {
  let user;
  let category;

  beforeAll(async () => {
    await prisma.$connect();
    user = await registerUser('ccrecon');
    await request(app)
      .get('/api/finances/categories')
      .set('Authorization', `Bearer ${user.token}`);
    category = await prisma.financialCategory.findFirst({
      where: { userId: user.userId, type: 'DESPESA' },
    });
  });

  afterEach(async () => {
    await prisma.creditCardBill.deleteMany({ where: { userId: user.userId } });
    await prisma.financialTransaction.deleteMany({
      where: { userId: user.userId },
    });
  });

  afterAll(async () => {
    if (user) {
      await prisma.user.delete({ where: { id: user.userId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  const createBill = async (overrides = {}) => {
    const response = await request(app)
      .post('/api/credit-cards/bills')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        description: 'DOTERRA PARC',
        totalAmount: 438.64,
        installments: 4,
        firstInstallmentAt: '2026-08-17',
        categoryId: category.id,
        ...overrides,
      });
    return response.body;
  };

  const preview = (ofxText) =>
    request(app)
      .post('/api/credit-cards/reconcile/preview')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ ofxText });

  const commit = (body) =>
    request(app)
      .post('/api/credit-cards/reconcile/commit')
      .set('Authorization', `Bearer ${user.token}`)
      .send(body);

  it('previews matching statement lines with a suggested installment', async () => {
    const bill = await createBill();

    const response = await preview(
      ofx(
        block({
          date: '20260817',
          amount: '-438.64',
          fitid: '2026081749840000000017480000000048',
          memo: 'DOTERRA PARC 01/04',
        }),
        block({
          date: '20260825',
          amount: '-99.99',
          fitid: '2026082549840000000017480000000049',
          memo: 'LOJA QUALQUER',
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(response.body.batchId).toBeTruthy();
    expect(response.body.statementLines).toHaveLength(2);

    const [matched, unmatched] = response.body.statementLines;
    expect(matched.suggestedInstallmentId).toBeTruthy();

    const installment = await prisma.financialTransaction.findFirst({
      where: { creditCardBillId: bill.id, installmentNumber: 1 },
    });
    expect(matched.suggestedInstallmentId).toBe(installment.id);
    expect(unmatched.suggestedInstallmentId).toBeNull();
  });

  it('matches the bank-rounded first installment declared in the PARC memo', async () => {
    const bill = await createBill({
      description: 'Pedido dōTERRA 183973238',
      totalAmount: 1113.75,
      installments: 6,
      firstInstallmentAt: '2026-09-20',
    });

    const response = await preview(
      ofx(
        block({
          date: '20260828',
          amount: '-185.65',
          fitid: 'FIT-PARC-01-06',
          memo: 'DOTERRA PARC 01/06 BARUERI BR',
        }),
      ),
    );

    const [line] = response.body.statementLines;
    const first = await prisma.financialTransaction.findFirst({
      where: { creditCardBillId: bill.id, installmentNumber: 1 },
    });

    expect(Number(first.amount)).toBe(185.65);
    expect(line.suggestedInstallmentId).toBe(first.id);
  });

  it('absorbs a rounding remainder up to the installment count', async () => {
    const bill = await createBill({
      description: 'Pedido dōTERRA com resto',
      totalAmount: 400.03,
      installments: 4,
      firstInstallmentAt: '2026-08-17',
    });

    const response = await preview(
      ofx(
        block({
          date: '20260817',
          amount: '-100.00',
          fitid: 'FIT-PARC-ROUNDING',
          memo: 'DOTERRA PARC 01/04',
        }),
      ),
    );

    const [line] = response.body.statementLines;
    const first = await prisma.financialTransaction.findFirst({
      where: { creditCardBillId: bill.id, installmentNumber: 1 },
    });

    expect(Number(first.amount)).toBe(100.03);
    expect(line.suggestedInstallmentId).toBe(first.id);
  });

  it('does not match a line whose PARC count differs from the bill', async () => {
    await createBill();

    const response = await preview(
      ofx(
        block({
          date: '20260817',
          amount: '-438.64',
          fitid: 'FIT-PARC-MISMATCH',
          memo: 'DOTERRA PARC 01/06',
        }),
      ),
    );

    expect(response.body.statementLines[0].suggestedInstallmentId).toBeNull();
  });

  it('assigns an ambiguous amount to the closest installment by date', async () => {
    const near = await createBill({
      installments: 1,
      firstInstallmentAt: '2026-08-17',
    });
    await createBill({ installments: 1, firstInstallmentAt: '2026-08-20' });

    const response = await preview(
      ofx(
        block({
          date: '20260818',
          amount: '-438.64',
          fitid: 'FIT-CLOSEST',
          memo: 'DOTERRA PARC',
        }),
      ),
    );

    const [line] = response.body.statementLines;
    const nearest = await prisma.financialTransaction.findFirst({
      where: { creditCardBillId: near.id, installmentNumber: 1 },
    });

    expect(line.matches).toHaveLength(2);
    expect(line.suggestedInstallmentId).toBe(nearest.id);
  });

  it('commits the chosen matches and marks the installments effective', async () => {
    const bill = await createBill();

    const previewResponse = await preview(
      ofx(
        block({
          date: '20260817',
          amount: '-438.64',
          fitid: '2026081749840000000017480000000048',
          memo: 'DOTERRA PARC 01/04',
        }),
      ),
    );
    const { batchId, statementLines } = previewResponse.body;
    const installmentId = statementLines[0].suggestedInstallmentId;

    const response = await commit({
      batchId,
      matches: [
        {
          statementFitid: '2026081749840000000017480000000048',
          statementDate: '2026-08-17',
          installmentId,
        },
      ],
    });

    expect(response.status).toBe(200);

    const installment = await prisma.financialTransaction.findUnique({
      where: { id: installmentId },
    });
    expect(installment.isEffective).toBe(true);
    expect(installment.importBatchId).toBe(batchId);
    expect(installment.statementFitid).toBe(
      '2026081749840000000017480000000048',
    );
    expect(installment.effectiveDate.toISOString().slice(0, 10)).toBe(
      '2026-08-17',
    );
    expect(installment.creditCardBillId).toBe(bill.id);
  });

  it('produces a fresh batch without rematching an already-paid FITID', async () => {
    await createBill({ installments: 1 });

    const firstPreview = await preview(
      ofx(
        block({
          date: '20260817',
          amount: '-438.64',
          fitid: 'FIT-REPEAT',
          memo: 'DOTERRA PARC 01/04',
        }),
      ),
    );
    await commit({
      batchId: firstPreview.body.batchId,
      matches: [
        {
          statementFitid: 'FIT-REPEAT',
          statementDate: '2026-08-17',
          installmentId:
            firstPreview.body.statementLines[0].suggestedInstallmentId,
        },
      ],
    });

    const secondPreview = await preview(
      ofx(
        block({
          date: '20260817',
          amount: '-438.64',
          fitid: 'FIT-REPEAT',
          memo: 'DOTERRA PARC 01/04',
        }),
      ),
    );

    expect(secondPreview.body.batchId).not.toBe(firstPreview.body.batchId);
    expect(
      secondPreview.body.statementLines[0].suggestedInstallmentId,
    ).toBeNull();
  });

  it('undoes a batch restoring the installments', async () => {
    await createBill();

    const previewResponse = await preview(
      ofx(
        block({
          date: '20260817',
          amount: '-438.64',
          fitid: 'FIT-BATCH',
          memo: 'DOTERRA PARC 01/04',
        }),
      ),
    );
    const { batchId, statementLines } = previewResponse.body;
    await commit({
      batchId,
      matches: [
        {
          statementFitid: 'FIT-BATCH',
          statementDate: '2026-08-17',
          installmentId: statementLines[0].suggestedInstallmentId,
        },
      ],
    });

    const first = await request(app)
      .delete(`/api/credit-cards/reconcile/batch/${batchId}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(first.status).toBe(200);
    expect(first.body.restored).toBe(1);

    const installment = await prisma.financialTransaction.findUnique({
      where: { id: statementLines[0].suggestedInstallmentId },
    });
    expect(installment.isEffective).toBe(false);
    expect(installment.importBatchId).toBeNull();
    expect(installment.statementFitid).toBeNull();

    const second = await request(app)
      .delete(`/api/credit-cards/reconcile/batch/${batchId}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(second.status).toBe(200);
    expect(second.body.restored).toBe(0);
  });

  it('rejects malformed OFX', async () => {
    const noRoot = await preview('não é um ofx');
    expect(noRoot.status).toBe(400);

    const noList = await preview(
      '<OFX><SIGNONMSGSRSV1></SIGNONMSGSRSV1></OFX>',
    );
    expect(noList.status).toBe(400);
  });
});

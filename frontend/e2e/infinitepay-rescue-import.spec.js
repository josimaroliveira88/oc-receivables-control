import { expect, test } from '@playwright/test';
import {
  generateE2EUser,
  createUserViaApi,
  login,
  createPersonViaApi,
  createSaleProductViaApi,
  stockInViaApi,
  createSaleViaApi,
  createPaymentViaApi,
  loginAndGetToken,
  apiRequest,
  listFinanceTransactionsViaApi,
  saveScreenshot,
} from './helpers.js';

const tag = () => Math.random().toString(36).slice(2, 8);

// A two-line bank statement whose single redemption (220.01) matches one sale.
const buildStatement = (date, amountBR) =>
  [
    'Data,Hora,Tipo de transação,Nome,Detalhe,Valor',
    `${date},08:50:45,Pix,Pix CASSIA GOUVEIA LIMA,Enviado,"-R$ ${amountBR}"`,
    `${date},08:47:16,Depósito de vendas,Venda Nitro,Depósito InfinitePay,"+R$ ${amountBR}"`,
  ].join('\n');

test.describe('Importação de resgates InfinitePay (e2e)', () => {
  test.describe.configure({ mode: 'serial' });

  let testUser;
  let token;
  let client;
  let product;

  test.beforeAll(async ({ request, playwright }) => {
    testUser = generateE2EUser();
    await createUserViaApi(request, testUser);

    const api = await playwright.request.newContext({ baseURL: undefined });
    token = await loginAndGetToken(api, testUser.username, testUser.password);
    client = await createPersonViaApi(api, token, `Cliente Resgate ${tag()}`);
    product = await createSaleProductViaApi(api, token);
    await stockInViaApi(api, token, product.id, 100);
  });

  test('CT1 - escolher um depósito de origem não duplica o valor conciliado', async ({
    page,
  }) => {
    // An InfinitePay sale whose rescuable amount (net) is the statement value.
    const statementAmount = 220.01;
    const sale = await createSaleViaApi(page.request, token, {
      clientPersonId: client.id,
      orderDate: '2026-09-01',
      items: [
        { productId: product.id, chargedValue: statementAmount, quantity: 1 },
      ],
    });
    await createPaymentViaApi(page.request, token, sale.id, {
      amount: statementAmount,
      personId: client.id,
      paidAt: '2026-09-16',
      paymentType: 'INFINITE_PAY',
    });

    await login(
      page,
      'http://localhost:3000',
      testUser.username,
      testUser.password,
    );
    await page.goto('/sales');
    await expect(
      page.getByRole('heading', { name: 'Gestão de Vendas' }),
    ).toBeVisible({ timeout: 15_000 });

    // Upload the statement through the hidden file input of the rescue import.
    await page.getByTestId('infinitepay-rescue-file-input').setInputFiles({
      name: 'extrato.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(buildStatement('2026-09-16', '220,01')),
    });

    const modal = page.getByTestId('infinitepay-rescue-import-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });

    // Expand the single rescue.
    await page.getByTestId('rescue-expand-2').click();
    const details = page.getByTestId('rescue-details-2');
    await expect(details).toBeVisible();

    // The whole rescue is pre-assigned to the sale (value suggestion), so the
    // running total starts balanced: R$ 220,01 de R$ 220,01.
    const total = page.getByTestId('rescue-total-2');
    await expect(total).toContainText('R$ 220,01');
    await expect(total).toContainText('Conciliado');

    // Clicking the sale match of the source deposit must RE-SCOPE the existing
    // assignment, never stack a second amount on top of it.
    await page.getByTestId(`rescue-deposit-2-0-${sale.id}`).click();

    // The running total must stay exactly R$ 220,01 (the reported bug showed
    // R$ 880,04 after repeated clicks).
    await expect(page.getByTestId('rescue-total-2')).toContainText(
      'R$ 220,01 de',
    );
    await expect(page.getByTestId('rescue-total-2')).toContainText('R$ 220,01');
    await expect(page.getByTestId('rescue-total-2')).not.toContainText(
      'R$ 880,04',
    );

    // Clicking it several more times stays idempotent.
    await page.getByTestId(`rescue-deposit-2-0-${sale.id}`).click();
    await page.getByTestId(`rescue-deposit-2-0-${sale.id}`).click();
    await expect(page.getByTestId('rescue-total-2')).toContainText(
      'R$ 220,01 de',
    );

    await saveScreenshot(page, 'rescue-import-ct1-balanced');

    // Commit and verify the ledger got exactly one redemption of 220.01.
    await page.getByTestId('infinitepay-rescue-confirm').click();
    await expect(
      page.getByTestId('infinitepay-rescue-import-success'),
    ).toBeVisible({ timeout: 10_000 });

    const rows = await listFinanceTransactionsViaApi(page.request, token, {
      origin: 'RESGATE_INFINITEPAY',
    });
    const forSale = rows.filter((row) => row.orderId === sale.id);
    expect(forSale).toHaveLength(1);
    expect(Number(forSale[0].amount)).toBe(220.01);

    await saveScreenshot(page, 'rescue-import-ct1-committed');
  });

  test('CT2 - desfazer a importação remove os resgates do lote', async ({
    page,
  }) => {
    // Create another matched sale so the import has something to commit.
    const statementAmount = 240.01;
    const sale = await createSaleViaApi(page.request, token, {
      clientPersonId: client.id,
      orderDate: '2026-09-01',
      items: [
        { productId: product.id, chargedValue: statementAmount, quantity: 1 },
      ],
    });
    await createPaymentViaApi(page.request, token, sale.id, {
      amount: statementAmount,
      personId: client.id,
      paidAt: '2026-09-16',
      paymentType: 'INFINITE_PAY',
    });

    await login(
      page,
      'http://localhost:3000',
      testUser.username,
      testUser.password,
    );
    await page.goto('/sales');
    await expect(
      page.getByRole('heading', { name: 'Gestão de Vendas' }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('infinitepay-rescue-file-input').setInputFiles({
      name: 'extrato.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(buildStatement('2026-09-16', '240,01')),
    });

    const modal = page.getByTestId('infinitepay-rescue-import-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('infinitepay-rescue-confirm').click();
    await expect(
      page.getByTestId('infinitepay-rescue-import-success'),
    ).toBeVisible({ timeout: 10_000 });

    const before = await listFinanceTransactionsViaApi(page.request, token, {
      origin: 'RESGATE_INFINITEPAY',
    });
    const beforeBatch = before.filter((row) => row.orderId === sale.id);
    expect(beforeBatch).toHaveLength(1);
    const batchId = beforeBatch[0].importBatchId;
    expect(batchId).toBeTruthy();

    await page.getByTestId('infinitepay-rescue-undo').click();
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    const after = await listFinanceTransactionsViaApi(page.request, token, {
      origin: 'RESGATE_INFINITEPAY',
    });
    expect(after.filter((row) => row.orderId === sale.id)).toHaveLength(0);
  });
});

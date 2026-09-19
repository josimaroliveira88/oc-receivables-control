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
  createFinanceTransactionViaApi,
  listFinanceTransactionsViaApi,
  getFinanceSummaryViaApi,
  createPurchaseOrderViaApi,
  listOrdersViaApi,
  loginAndGetToken,
  saveScreenshot,
  uniqueOrderNumber,
} from './helpers.js';

// Unique tag so every run works on its own freshly registered user. The suite
// never deletes or mutates pre-existing data: it only creates new records.
const tag = () => Math.random().toString(36).slice(2, 8);

const rowFor = (page, text) => page.getByRole('row').filter({ hasText: text });

test.describe('Módulo Financeiro F6 - fluxo de caixa (e2e)', () => {
  test.describe.configure({ mode: 'serial' });

  let testUser;
  let token;
  let client;
  let product;
  let pixSale;
  let infiniteSale;
  let infiniteSaleNote;
  let manualDescription;
  let doterraOrderNumber;
  let doterraOrderTotal;

  test.beforeAll(async ({ request, playwright }) => {
    testUser = generateE2EUser();
    await createUserViaApi(request, testUser);

    const api = await playwright.request.newContext({ baseURL: undefined });
    token = await loginAndGetToken(api, testUser.username, testUser.password);

    const suffix = tag();
    client = await createPersonViaApi(api, token, `Cliente Fin ${suffix}`);
    product = await createSaleProductViaApi(api, token);
    await stockInViaApi(api, token, product.id, 100);

    // A settled PIX sale → one automatic income row.
    pixSale = await createSaleViaApi(api, token, {
      clientPersonId: client.id,
      orderDate: '2026-09-10',
      items: [{ productId: product.id, chargedValue: 200, quantity: 1 }],
    });
    await createPaymentViaApi(api, token, pixSale.id, {
      amount: 200,
      personId: client.id,
      paidAt: '2026-09-10',
      paymentType: 'PIX',
    });

    // An InfinitePay sale → no automatic row until a redemption is registered.
    // The description is the row locator (the Sales table omits the number).
    infiniteSaleNote = `Venda InfinitePay ${suffix}`;
    infiniteSale = await createSaleViaApi(api, token, {
      clientPersonId: client.id,
      orderDate: '2026-09-12',
      description: infiniteSaleNote,
      items: [{ productId: product.id, chargedValue: 300, quantity: 1 }],
    });
    await createPaymentViaApi(api, token, infiniteSale.id, {
      amount: 300,
      netAmount: 291,
      personId: client.id,
      paidAt: '2026-09-12',
      paymentType: 'INFINITE_PAY',
    });

    // A dōTERRA purchase order (COMPRA) → one automatic expense row.
    doterraOrderTotal = 250;
    doterraOrderNumber = uniqueOrderNumber('FIN-CMP');
    await createPurchaseOrderViaApi(api, token, {
      orderNumber: doterraOrderNumber,
      orderDate: '2026-09-11',
      orderNotes: 'Pedido dōTERRA seed F6',
      items: [{ description: 'Óleo E2E', chargedValue: doterraOrderTotal }],
    });

    // A manual income row created via API, asserted in the UI list.
    manualDescription = `Bônus E2E ${suffix}`;
    await createFinanceTransactionViaApi(api, token, {
      type: 'RECEITA',
      amount: 80,
      description: manualDescription,
      transactionDate: '2026-09-13',
    });
  });

  test.beforeEach(async ({ page, baseURL }) => {
    await login(page, baseURL, testUser.username, testUser.password);
  });

  test('CT1 - lista os lançamentos e os totais do período', async ({
    page,
  }) => {
    await page.goto('/finances');
    await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible({
      timeout: 15_000,
    });

    // Automatic PIX income, dōTERRA expense and the manual income all show.
    await expect(rowFor(page, 'Bônus E2E').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(rowFor(page, doterraOrderNumber)).toBeVisible();
    await expect(rowFor(page, 'Venda').first()).toBeVisible();

    // Receitas = 200 (PIX) + 80 (manual) = 280; InfinitePay adds no income yet.
    await expect(page.getByTestId('finances-summary-income')).toContainText(
      /280,00/,
    );
    // Despesas = 250 (dōTERRA purchase order).
    await expect(page.getByTestId('finances-summary-expense')).toContainText(
      /250,00/,
    );

    await saveScreenshot(page, 'f6-ct1-finances-ledger');
  });

  test('CT2 - cria um lançamento manual pela interface com máscara de moeda', async ({
    page,
  }) => {
    await page.goto('/finances');
    await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Novo lançamento' }).click();
    const modal = page.getByTestId('transaction-form-modal');
    await expect(modal).toBeVisible();

    const description = `Material E2E ${tag()}`;
    await modal.getByLabel('Descrição').fill(description);
    await modal.getByTestId('transaction-amount').fill('3550');
    await modal.getByLabel('Data').fill('2026-09-18');
    await modal.getByLabel('Categoria').selectOption({ label: 'Frete' });

    await saveScreenshot(page, 'f6-ct2-manual-form');

    await modal.getByRole('button', { name: 'Salvar' }).click();
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
    await expect(rowFor(page, description)).toBeVisible({ timeout: 10_000 });
    await expect(rowFor(page, description).first()).toContainText(/35,50/);

    // Despesas = 250 (dōTERRA) + 35,50 (manual) = 285,50.
    await expect(page.getByTestId('finances-summary-expense')).toContainText(
      /285,50/,
    );

    await saveScreenshot(page, 'f6-ct2-manual-created');
  });

  test('CT3 - filtra por tipo e atualiza a tabela e o resumo', async ({
    page,
  }) => {
    await page.goto('/finances');
    await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(rowFor(page, 'Bônus E2E').first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel('Tipo').selectOption('DESPESA');
    await expect(page.getByTestId('finances-summary-income')).toContainText(
      /0,00/,
    );
    await expect(page.getByTestId('finances-summary-expense')).toContainText(
      /285,50/,
    );
    await saveScreenshot(page, 'f6-ct3-filter-expense');

    await page.getByLabel('Tipo').selectOption('RECEITA');
    await expect(page.getByTestId('finances-summary-income')).toContainText(
      /280,00/,
    );
    await saveScreenshot(page, 'f6-ct3-filter-income');
  });

  test('CT4 - o modal de categorias mostra o nome completo (layout largo)', async ({
    page,
  }) => {
    await page.goto('/finances');
    await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Categorias' }).click();
    const modal = page.getByTestId('finance-category-modal');
    await expect(modal).toBeVisible();

    // The longest default name must be rendered fully, not clipped.
    const longName = 'Compra de produtos dōTERRA';
    const nameEl = modal.getByText(longName, { exact: true });
    await expect(nameEl).toBeVisible();
    await expect(nameEl).toHaveAttribute('title', longName);

    // Wrapped/expanded element: its full text is not visually truncated.
    const overflow = await nameEl.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

    await saveScreenshot(page, 'f6-ct4-category-modal-wide');

    await modal.getByRole('button', { name: 'Fechar' }).click();
    await expect(modal).not.toBeVisible();
  });

  test('CT5 - pedido dōTERRA gera a despesa automática no fluxo de caixa', async ({
    page,
    request,
  }) => {
    // The purchase order created in beforeAll produced one expense row.
    const orders = await listOrdersViaApi(request, token, {
      q: doterraOrderNumber,
      searchField: 'orderNumber',
    });
    const order = orders.find((o) => o.orderNumber === doterraOrderNumber);
    expect(order).toBeTruthy();

    const doterraRows = await listFinanceTransactionsViaApi(request, token, {
      origin: 'PEDIDO_DOTERRA',
    });
    expect(doterraRows.length).toBe(1);
    expect(doterraRows[0].orderId).toBe(order.id);
    expect(Number(doterraRows[0].amount)).toBe(doterraOrderTotal);
    expect(doterraRows[0].paymentId).toBeNull();

    await page.goto('/finances');
    await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible({
      timeout: 15_000,
    });
    const expenseRow = rowFor(page, doterraOrderNumber);
    await expect(expenseRow).toBeVisible({ timeout: 15_000 });
    await expect(expenseRow).toContainText(/250,00/);
    await expect(expenseRow).toContainText('Pedido dōTERRA');
    // Automatic rows are read-only: no edit/delete kebab.
    await expect(
      expenseRow.locator('[data-testid^="transaction-actions-"]'),
    ).toHaveCount(0);

    await saveScreenshot(page, 'f6-ct5-doterra-expense');
  });

  test('CT6 - resgate InfinitePay cria a receita vinculada e atualiza a lista', async ({
    page,
    request,
  }) => {
    // Before redeeming: the InfinitePay sale produced no ledger row.
    const before = await listFinanceTransactionsViaApi(request, token, {
      origin: 'RESGATE_INFINITEPAY',
    });
    expect(before.length).toBe(0);

    await page.goto('/sales');
    await expect(
      page.getByRole('heading', { name: 'Gestão de Vendas' }),
    ).toBeVisible({ timeout: 15_000 });

    const saleRow = rowFor(page, infiniteSaleNote);
    await expect(saleRow).toBeVisible({ timeout: 15_000 });
    await saleRow
      .locator('[data-testid^="sale-actions-"][data-testid$="-trigger"]')
      .click();
    await saveScreenshot(page, 'f6-ct6-sales-actions-menu');

    await page
      .getByTestId(
        `sale-actions-${infiniteSale.id}-item-Registrar-resgate-InfinitePay`,
      )
      .click();

    const settlement = page.getByTestId('settlement-modal');
    await expect(settlement).toBeVisible();
    await settlement.getByTestId('settlement-amount').fill('30000');
    await settlement.getByLabel('Data do resgate').fill('2026-09-19');
    await settlement
      .getByLabel('Observações (opcional)')
      .fill('resgate total e2e');
    await saveScreenshot(page, 'f6-ct6-settlement-modal');

    await settlement.getByRole('button', { name: 'Registrar resgate' }).click();
    await expect(settlement).not.toBeVisible({ timeout: 10_000 });

    // The linked income row is now persisted and linked to the sale.
    const after = await listFinanceTransactionsViaApi(request, token, {
      origin: 'RESGATE_INFINITEPAY',
    });
    expect(after.length).toBe(1);
    expect(after[0].orderId).toBe(infiniteSale.id);
    expect(Number(after[0].amount)).toBe(300);
    expect(after[0].paymentId).toBeNull();

    // Receitas = 280 + 300 = 580.
    const summary = await getFinanceSummaryViaApi(request, token);
    expect(Number(summary.totalIncome)).toBe(580);

    await page.goto('/finances');
    await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(rowFor(page, 'Resgate InfinitePay').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('finances-summary-income')).toContainText(
      /580,00/,
    );

    await saveScreenshot(page, 'f6-ct6-finances-after-settlement');
  });

  test('CT7 - edita e exclui um lançamento manual pela interface', async ({
    page,
  }) => {
    await page.goto('/finances');
    await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible({
      timeout: 15_000,
    });

    const description = `Ajuste E2E ${tag()}`;
    const created = await createFinanceTransactionViaApi(page.request, token, {
      type: 'DESPESA',
      amount: 10,
      description,
      transactionDate: '2026-09-14',
    });

    // Reload to pick up the new row, then edit it.
    await page.reload();
    const row = rowFor(page, description);
    await expect(row).toBeVisible({ timeout: 15_000 });

    await page.getByTestId(`transaction-actions-${created.id}-trigger`).click();
    await page
      .getByTestId(`transaction-actions-${created.id}-item-Editar`)
      .click();

    const modal = page.getByTestId('transaction-form-modal');
    await expect(modal).toBeVisible();
    const updated = `${description} editado`;
    await modal.getByLabel('Descrição').fill(updated);
    await saveScreenshot(page, 'f6-ct7-edit-manual');
    await modal.getByRole('button', { name: 'Salvar' }).click();
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
    await expect(rowFor(page, updated)).toBeVisible({ timeout: 10_000 });

    // Delete it.
    await page.getByTestId(`transaction-actions-${created.id}-trigger`).click();
    await page
      .getByTestId(`transaction-actions-${created.id}-item-Excluir`)
      .click();
    await expect(page.getByText('Excluir lançamento')).toBeVisible();
    await saveScreenshot(page, 'f6-ct7-delete-manual-confirm');
    await page.getByRole('button', { name: 'Excluir' }).click();
    await expect(rowFor(page, updated)).toHaveCount(0, { timeout: 10_000 });
  });
});

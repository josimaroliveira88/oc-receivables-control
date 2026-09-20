import { expect, test } from '@playwright/test';
import {
  generateE2EUser,
  createUserViaApi,
  login,
  loginAndGetToken,
  createPersonViaApi,
  createSaleProductViaApi,
  stockInViaApi,
  createSaleViaApi,
  updateSaleViaApi,
  getSaleViaApi,
  listSalesViaApi,
  deleteSaleViaApi,
  listFinanceCategoriesViaApi,
  listFinanceTransactionsViaApi,
  getFinanceSummaryViaApi,
  API_URL,
  saveScreenshot,
} from './helpers.js';

// E2E for the automatic expense derived from a sale's "Valores Adicionais".
// Two layers run against the live stack:
//   1. API-only tests that exercise the extended sale endpoints and the linked
//      ledger row (create/update/zero/delete, validation, isolation, summary).
//   2. Browser tests that drive the real sale form and the finances table.
// Every run registers its own user, so no pre-existing data is touched.
test.describe('Valores Adicionais da venda geram despesa automática (e2e)', () => {
  test.describe.configure({ mode: 'serial' });

  let testUser;
  let token;
  let client;
  let product;
  let despesaCategory;
  let receitaCategory;

  const ORDER_DATE = '2026-09-20';

  const salePayload = (overrides = {}) => ({
    clientPersonId: client.id,
    orderDate: ORDER_DATE,
    items: [{ productId: product.id, chargedValue: 100, quantity: 1 }],
    ...overrides,
  });

  const rowsForSale = async (request, saleId) => {
    const rows = await listFinanceTransactionsViaApi(request, token, {
      origin: 'VENDA_ADICIONAL',
    });
    return rows.filter((row) => row.orderId === saleId);
  };

  test.beforeAll(async ({ request, playwright }) => {
    testUser = generateE2EUser();
    await createUserViaApi(request, testUser);

    const api = await playwright.request.newContext({ baseURL: undefined });
    token = await loginAndGetToken(api, testUser.username, testUser.password);
    client = await createPersonViaApi(
      api,
      token,
      `Cliente Adicional ${testUser.username.slice(-6)}`,
    );
    product = await createSaleProductViaApi(api, token);
    await stockInViaApi(api, token, product.id, 50);

    const categories = await listFinanceCategoriesViaApi(api, token);
    despesaCategory = categories.find(
      (category) => category.type === 'DESPESA' && category.active,
    );
    receitaCategory = categories.find(
      (category) => category.type === 'RECEITA' && category.active,
    );
    expect(
      despesaCategory,
      'a default DESPESA category must exist',
    ).toBeTruthy();
    expect(
      receitaCategory,
      'a default RECEITA category must exist',
    ).toBeTruthy();
  });

  test.describe('API ao vivo', () => {
    test('CT1 - cria a venda com valor adicional e gera a despesa vinculada', async ({
      request,
    }) => {
      const sale = await createSaleViaApi(
        request,
        token,
        salePayload({
          additionalValue: 25,
          additionalExpenseCategoryId: despesaCategory.id,
          additionalExpenseDescription: 'Frete da venda live',
        }),
      );

      expect(sale.status).toBe('PENDENTE');
      expect(sale.additionalExpenseCategoryId).toBe(despesaCategory.id);
      expect(sale.additionalExpenseDescription).toBe('Frete da venda live');

      const rows = await rowsForSale(request, sale.id);
      expect(rows.length).toBe(1);
      expect(rows[0].type).toBe('DESPESA');
      expect(Number(rows[0].amount)).toBe(25);
      expect(rows[0].paymentId).toBeNull();
      expect(rows[0].categoryId).toBe(despesaCategory.id);
      expect(rows[0].category.name).toBe(despesaCategory.name);
      expect(rows[0].description).toBe('Frete da venda live');
      expect(rows[0].transactionDate.slice(0, 10)).toBe(ORDER_DATE);
    });

    test('CT2 - rejeita valor adicional sem categoria ou descrição', async ({
      request,
    }) => {
      const noCategory = await request.post(`${API_URL}/api/sales`, {
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
        data: salePayload({
          additionalValue: 10,
          additionalExpenseDescription: 'Sem categoria',
        }),
      });
      expect(noCategory.status()).toBe(400);
      expect((await noCategory.json()).error).toContain('categoria');

      const noDescription = await request.post(`${API_URL}/api/sales`, {
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
        data: salePayload({
          additionalValue: 10,
          additionalExpenseCategoryId: despesaCategory.id,
        }),
      });
      expect(noDescription.status()).toBe(400);
      expect((await noDescription.json()).error).toContain('descrição');
    });

    test('CT3 - rejeita uma categoria que não é DESPESA', async ({
      request,
    }) => {
      const res = await request.post(`${API_URL}/api/sales`, {
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
        data: salePayload({
          additionalValue: 10,
          additionalExpenseCategoryId: receitaCategory.id,
          additionalExpenseDescription: 'Categoria errada',
        }),
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toContain('Category type');
    });

    test('CT4 - atualizar a venda mantém uma única despesa em sincronia', async ({
      request,
    }) => {
      const sale = await createSaleViaApi(
        request,
        token,
        salePayload({
          additionalValue: 25,
          additionalExpenseCategoryId: despesaCategory.id,
          additionalExpenseDescription: 'Antes',
        }),
      );

      await updateSaleViaApi(request, token, sale.id, {
        additionalValue: 40,
        additionalExpenseCategoryId: despesaCategory.id,
        additionalExpenseDescription: 'Depois',
      });

      const rows = await rowsForSale(request, sale.id);
      expect(rows.length).toBe(1);
      expect(Number(rows[0].amount)).toBe(40);
      expect(rows[0].description).toBe('Depois');
    });

    test('CT5 - os endpoints de leitura expõem os campos da despesa', async ({
      request,
    }) => {
      const sale = await createSaleViaApi(
        request,
        token,
        salePayload({
          additionalValue: 15,
          additionalExpenseCategoryId: despesaCategory.id,
          additionalExpenseDescription: 'Leitura',
        }),
      );

      const detail = await getSaleViaApi(request, token, sale.id);
      expect(detail.additionalExpenseCategoryId).toBe(despesaCategory.id);
      expect(detail.additionalExpenseDescription).toBe('Leitura');

      const list = await listSalesViaApi(request, token);
      const found = list.find((row) => row.id === sale.id);
      expect(found.additionalExpenseCategoryId).toBe(despesaCategory.id);
      expect(found.additionalExpenseDescription).toBe('Leitura');
    });

    test('CT6 - zerar o valor adicional remove a despesa', async ({
      request,
    }) => {
      const sale = await createSaleViaApi(
        request,
        token,
        salePayload({
          additionalValue: 30,
          additionalExpenseCategoryId: despesaCategory.id,
          additionalExpenseDescription: 'Vai sumir',
        }),
      );
      expect((await rowsForSale(request, sale.id)).length).toBe(1);

      await updateSaleViaApi(request, token, sale.id, { additionalValue: 0 });

      expect((await rowsForSale(request, sale.id)).length).toBe(0);
    });

    test('CT7 - excluir a venda remove a despesa em cascata', async ({
      request,
    }) => {
      const sale = await createSaleViaApi(
        request,
        token,
        salePayload({
          additionalValue: 18,
          additionalExpenseCategoryId: despesaCategory.id,
          additionalExpenseDescription: 'Cascade',
        }),
      );
      expect((await rowsForSale(request, sale.id)).length).toBe(1);

      await deleteSaleViaApi(request, token, sale.id);

      expect((await rowsForSale(request, sale.id)).length).toBe(0);
    });

    test('CT8 - o filtro por origem e o resumo batem com as despesas gravadas', async ({
      request,
    }) => {
      const rows = await listFinanceTransactionsViaApi(request, token, {
        origin: 'VENDA_ADICIONAL',
      });
      const expectedExpense = rows.reduce(
        (sum, row) => sum + Number(row.amount),
        0,
      );

      const summary = await getFinanceSummaryViaApi(request, token, {
        origin: 'VENDA_ADICIONAL',
      });
      expect(Number(summary.totalExpense)).toBeCloseTo(expectedExpense, 2);
      expect(Number(summary.totalIncome)).toBe(0);
      expect(Number(summary.balance)).toBeCloseTo(-expectedExpense, 2);
    });

    test('CT9 - outro usuário não enxerga a despesa (isolamento)', async ({
      request,
      playwright,
    }) => {
      const other = generateE2EUser();
      await createUserViaApi(request, other);
      const api = await playwright.request.newContext({ baseURL: undefined });
      const otherToken = await loginAndGetToken(
        api,
        other.username,
        other.password,
      );

      const rows = await listFinanceTransactionsViaApi(api, otherToken, {
        origin: 'VENDA_ADICIONAL',
      });
      expect(rows.length).toBe(0);
    });
  });

  test.describe('Fluxo na interface', () => {
    test.beforeEach(async ({ page, baseURL }) => {
      await login(page, baseURL, testUser.username, testUser.password);
    });

    test('CT10 - os campos de despesa aparecem só com valor e são obrigatórios', async ({
      page,
    }) => {
      await page.goto('/sales');
      await expect(
        page.getByRole('heading', { name: 'Gestão de Vendas' }),
      ).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: 'Nova Venda' }).click();
      const modal = page.getByTestId('modal-backdrop');
      await expect(modal.getByText('Itens da Venda')).toBeVisible();

      await expect(
        modal.getByTestId('sale-additional-expense-category'),
      ).toHaveCount(0);

      await modal.getByTestId('sale-additional').fill('25,00');
      await expect(
        modal.getByTestId('sale-additional-expense-category'),
      ).toBeVisible();
      await expect(
        modal.getByTestId('sale-additional-expense-description'),
      ).toBeVisible();

      // The category select only offers active DESPESA categories.
      const optionLabels = await modal
        .getByTestId('sale-additional-expense-category')
        .locator('option')
        .allTextContents();
      expect(optionLabels).toContain(despesaCategory.name);
      expect(optionLabels).not.toContain(receitaCategory.name);

      await saveScreenshot(page, 'f-additional-ct10-fields');

      // Missing category/description blocks the save.
      await modal.getByLabel('Cliente').selectOption({ label: client.name });
      await modal.getByLabel('Produto', { exact: true }).fill(product.name);
      await page
        .getByTestId('product-combobox-list')
        .getByText(product.name, { exact: false })
        .first()
        .click();
      await modal.getByPlaceholder('0,00').fill('100,00');
      await modal.getByRole('button', { name: 'Salvar' }).click();

      await expect(
        modal.getByTestId('sale-additional-expense-category-error'),
      ).toHaveText('Categoria da despesa é obrigatória');
      await expect(
        modal.getByTestId('sale-additional-expense-description-error'),
      ).toHaveText('Descrição da despesa é obrigatória');
      await expect(modal).toBeVisible();
    });

    test('CT11 - criar pela interface grava a venda e a despesa', async ({
      page,
      request,
    }) => {
      const description = `Frete UI ${Date.now()}`;
      await page.goto('/sales');
      await expect(
        page.getByRole('heading', { name: 'Gestão de Vendas' }),
      ).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: 'Nova Venda' }).click();
      const modal = page.getByTestId('modal-backdrop');

      await modal.getByLabel('Cliente').selectOption({ label: client.name });
      await modal.getByLabel('Produto', { exact: true }).fill(product.name);
      await page
        .getByTestId('product-combobox-list')
        .getByText(product.name, { exact: false })
        .first()
        .click();
      await modal.getByPlaceholder('0,00').fill('100,00');
      await modal.getByTestId('sale-additional').fill('12,50');
      await modal
        .getByTestId('sale-additional-expense-category')
        .selectOption({ label: despesaCategory.name });
      await modal
        .getByTestId('sale-additional-expense-description')
        .fill(description);

      await saveScreenshot(page, 'f-additional-ct11-form');
      await modal.getByRole('button', { name: 'Salvar' }).click();
      await expect(modal).toHaveCount(0, { timeout: 10_000 });

      // The linked expense is persisted with the amount and description.
      await expect
        .poll(async () => {
          const rows = await listFinanceTransactionsViaApi(request, token, {
            origin: 'VENDA_ADICIONAL',
          });
          return rows.some(
            (row) =>
              row.description === description && Number(row.amount) === 12.5,
          );
        })
        .toBe(true);
    });

    test('CT12 - a despesa aparece em Finanças e linka de volta à venda', async ({
      page,
      request,
    }) => {
      const description = `Frete Finanças ${Date.now()}`;
      const sale = await createSaleViaApi(request, token, {
        clientPersonId: client.id,
        orderDate: ORDER_DATE,
        description,
        additionalValue: 20,
        additionalExpenseCategoryId: despesaCategory.id,
        additionalExpenseDescription: description,
        items: [{ productId: product.id, chargedValue: 100, quantity: 1 }],
      });

      await page.goto('/finances');
      await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible(
        {
          timeout: 15_000,
        },
      );

      const row = page.getByRole('row').filter({ hasText: description });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(row).toContainText('Adicional de venda');
      await expect(row).toContainText('Despesa');
      await expect(row).toContainText(/20,00/);

      await saveScreenshot(page, 'f-additional-ct12-finances-row');

      // The origin links back to the sale edit form (deep-link).
      const originLink = row.locator('[data-testid^="transaction-link-"]');
      await expect(originLink).toHaveAttribute(
        'href',
        `/sales?editSale=${sale.id}`,
      );
      await originLink.click();
      const modal = page.getByTestId('modal-backdrop');
      await expect(modal.getByText('Editar Venda')).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        modal.getByTestId('sale-additional-expense-category'),
      ).toHaveValue(despesaCategory.id);
      await expect(
        modal.getByTestId('sale-additional-expense-description'),
      ).toHaveValue(description);

      await saveScreenshot(page, 'f-additional-ct12-edit-prefill');
    });
  });
});

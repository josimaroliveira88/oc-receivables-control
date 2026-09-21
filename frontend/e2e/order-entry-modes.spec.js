import { expect, test } from '@playwright/test';
import {
  generateE2EUser,
  createUserViaApi,
  login,
  loginAndGetToken,
  createSaleProductViaApi,
  listOrdersViaApi,
  uniqueOrderNumber,
  saveScreenshot,
  apiRequest,
  API_URL,
} from './helpers.js';

// Validates that every order field available in the detailed form is also
// available in the spreadsheet ("Planilha") entry mode, and that the
// spreadsheet still creates a valid purchase order.
test.describe('Modos de inclusão de pedido (Formulário detalhado / Planilha) - e2e', () => {
  test.describe.configure({ mode: 'serial' });

  let testUser;
  let token;
  let product;
  let orderNumber;

  test.beforeAll(async ({ request, playwright }) => {
    testUser = generateE2EUser();
    await createUserViaApi(request, testUser);

    const api = await playwright.request.newContext({
      baseURL: API_URL,
    });
    token = await loginAndGetToken(api, testUser.username, testUser.password);
    // Stock-bound items require the user's self person to exist.
    await apiRequest(api, 'post', '/api/people/self', token);
    product = await createSaleProductViaApi(api, token, {
      name: `Produto Modo E2E ${testUser.username.slice(-6)}`,
    });
    orderNumber = uniqueOrderNumber('MODO');
  });

  test.beforeEach(async ({ page, baseURL }) => {
    await login(page, baseURL, testUser.username, testUser.password);
  });

  const openCreateModal = async (page) => {
    await page.goto('/orders');
    await expect(
      page.getByRole('heading', { name: 'Pedidos dōTERRA' }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Novo Pedido' }).click();
    const modal = page.getByTestId('modal-backdrop');
    await expect(
      modal.getByPlaceholder('Informe o número do pedido da dōTERRA'),
    ).toBeVisible({ timeout: 10_000 });
    return modal;
  };

  const orderLevelLabels = [
    'Conta ID (ID dōTERRA ou nome)',
    'Data do Pedido',
    'Tipo de Pagamento',
    'PV doTERRA',
    'Anexo (print do pedido doTERRA)',
    'Descrição do Pedido',
  ];

  const expectOrderLevelFields = async (modal) => {
    await expect(
      modal.getByPlaceholder('Informe o número do pedido da dōTERRA'),
    ).toBeVisible();
    for (const label of orderLevelLabels) {
      await expect(modal.getByLabel(label)).toBeVisible();
    }
    await expect(modal.getByTestId('order-is-team-order')).toBeVisible();
  };

  const switchToSpreadsheet = async (page, modal) => {
    await modal.getByTestId('order-entry-mode-spreadsheet').check();
    await expect(page.getByText('Manter como padrão?')).toBeVisible();
    await page.getByRole('button', { name: 'Só desta vez' }).click();
    await expect(modal.getByTestId('order-spreadsheet-add-row')).toBeVisible();
  };

  test('CT1 - campos do formulário detalhado existem no modo planilha', async ({
    page,
  }) => {
    const modal = await openCreateModal(page);

    // Detailed form: order-level and item-level fields.
    await expectOrderLevelFields(modal);
    await expect(
      modal.getByText('Itens do Pedido', { exact: true }),
    ).toBeVisible();
    await expect(modal.getByPlaceholder('Busque um produto...')).toBeVisible();
    await expect(modal.getByText('% Promoção')).toBeVisible();
    await expect(modal.getByText('Valor Pago (R$)')).toBeVisible();
    await expect(modal.getByText('Valor Pago (total)')).toBeVisible();
    await expect(modal.getByText('Quantidade')).toBeVisible();
    await expect(modal.getByText(/Este item é para meu estoque/)).toBeVisible();
    await expect(modal.getByText('Detalhes do Item')).toBeVisible();

    await saveScreenshot(page, 'order-mode-detailed-fields');

    await switchToSpreadsheet(page, modal);

    // The order-level fields survive the mode switch.
    await expectOrderLevelFields(modal);

    // Spreadsheet item-level fields mirror the detailed item card.
    await expect(
      modal.getByTestId('order-spreadsheet-quantity-0'),
    ).toBeVisible();
    await expect(
      modal.getByTestId('order-spreadsheet-discount-0'),
    ).toBeVisible();
    await expect(
      modal.getByTestId('order-spreadsheet-charged-0'),
    ).toBeVisible();
    await expect(
      modal.getByTestId('order-spreadsheet-charged-total-0'),
    ).toBeVisible();
    await expect(
      modal.getByTestId('order-spreadsheet-member-unit-0'),
    ).toBeVisible();
    await expect(
      modal.getByTestId('order-spreadsheet-member-total-0'),
    ).toBeVisible();
    await expect(modal.getByTestId('order-spreadsheet-stock-0')).toBeVisible();
    await expect(
      modal.getByTestId('order-spreadsheet-details-0'),
    ).toBeVisible();

    for (const header of [
      'Produto',
      'Qtd',
      '% Promo',
      'Valor Pago',
      'V. Pago total',
      'V. Membro unit.',
      'V. Membro total',
      'PV total',
      'Estoque',
      'Detalhes',
    ]) {
      await expect(
        modal.getByRole('columnheader', { name: header }),
      ).toBeVisible();
    }

    await saveScreenshot(page, 'order-mode-spreadsheet-fields');

    // Team orders still hide the stock control (no checkbox to mark).
    await modal.getByTestId('order-is-team-order').check();
    await expect(modal.getByTestId('order-spreadsheet-stock-0')).toHaveCount(0);
    await modal.getByTestId('order-is-team-order').uncheck();
    await expect(modal.getByTestId('order-spreadsheet-stock-0')).toBeVisible();
  });

  test('CT2 - cria o pedido pelo modo planilha com os valores e o estoque', async ({
    page,
    request,
  }) => {
    const modal = await openCreateModal(page);
    await switchToSpreadsheet(page, modal);

    await modal
      .getByPlaceholder('Informe o número do pedido da dōTERRA')
      .fill(orderNumber);

    await modal.getByPlaceholder('Busque um produto...').fill(product.name);
    await page
      .getByTestId('product-combobox-list')
      .getByText(new RegExp(product.name))
      .click();

    // The paid value is prefilled from the member price and the stock flag is
    // enabled by default for a regular order.
    await expect(modal.getByTestId('order-spreadsheet-charged-0')).toHaveValue(
      '100,00',
    );
    await expect(modal.getByTestId('order-spreadsheet-stock-0')).toBeChecked();

    await modal
      .getByTestId('order-spreadsheet-details-0')
      .fill('Detalhe do modo planilha');
    await modal.getByTestId('order-spreadsheet-quantity-0').fill('2');

    await saveScreenshot(page, 'order-mode-spreadsheet-filled');

    await modal.getByRole('button', { name: 'Salvar' }).click();
    await expect(
      page.getByRole('row').filter({ hasText: orderNumber }),
    ).toBeVisible({ timeout: 15_000 });

    const orders = await listOrdersViaApi(request, token, {
      q: orderNumber,
      searchField: 'orderNumber',
    });
    const order = orders.find((o) => o.orderNumber === orderNumber);
    expect(order).toBeTruthy();
    expect(order.items).toHaveLength(1);
    expect(order.items[0].productId).toBe(product.id);
    expect(parseFloat(order.items[0].chargedValue)).toBe(100);
    expect(order.items[0].chargedValueMode).toBe('UNIT');
    expect(order.items[0].quantity).toBe(2);
    expect(order.items[0].forStock).toBe(true);
    expect(order.items[0].details).toBe('Detalhe do modo planilha');
  });

  test('CT3 - edita um pedido no modo planilha hidratando os itens', async ({
    page,
  }) => {
    const modal = await openCreateModal(page);
    await switchToSpreadsheet(page, modal);

    const editNumber = uniqueOrderNumber('MODO-EDIT');
    await modal
      .getByPlaceholder('Informe o número do pedido da dōTERRA')
      .fill(editNumber);
    await modal.getByPlaceholder('Busque um produto...').fill(product.name);
    await page
      .getByTestId('product-combobox-list')
      .getByText(new RegExp(product.name))
      .click();
    await modal.getByRole('button', { name: 'Salvar' }).click();
    await expect(
      page.getByRole('row').filter({ hasText: editNumber }),
    ).toBeVisible({ timeout: 15_000 });

    const row = page.getByRole('row').filter({ hasText: editNumber });
    await row.locator('[data-testid$="-trigger"]').click();
    await page.getByTestId(/order-actions-.*-item-Editar/).click();

    await expect(page.getByText('Editar Pedido')).toBeVisible();
    await switchToSpreadsheet(page, modal);
    await expect(modal.getByTestId('order-spreadsheet-row-0')).toBeVisible({
      timeout: 10_000,
    });
    await expect(modal.getByTestId('order-spreadsheet-charged-0')).toHaveValue(
      '100,00',
    );
    await expect(modal.getByTestId('order-spreadsheet-stock-0')).toBeChecked();

    await saveScreenshot(page, 'order-mode-spreadsheet-edit');
  });
});

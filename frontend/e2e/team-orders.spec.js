import { expect, test } from '@playwright/test';
import {
  generateE2EUser,
  createUserViaApi,
  login,
  createPersonViaApi,
  loginAndGetToken,
  uniqueOrderNumber,
  listOrdersViaApi,
  listFinanceTransactionsViaApi,
  saveScreenshot,
} from './helpers.js';

const orderNumberInput = (page) =>
  page
    .getByTestId('modal-backdrop')
    .getByPlaceholder('Informe o número do pedido da dōTERRA');
const formScope = (page) => page.getByTestId('modal-backdrop');
const waitFormOpen = async (page) => {
  await expect(
    page
      .getByTestId('modal-backdrop')
      .getByPlaceholder('Informe o número do pedido da dōTERRA'),
  ).toBeVisible({ timeout: 10_000 });
};
const waitFormClose = async (page) => {
  await expect(page.getByTestId('modal-backdrop')).not.toBeVisible({
    timeout: 10_000,
  });
};
const rowByNumber = (page, num) =>
  page.getByRole('row').filter({ hasText: num });
const triggerFor = (page, num) =>
  rowByNumber(page, num).locator(
    '[data-testid^="order-actions-"][data-testid$="-trigger"]',
  );

test.describe('Pedidos da equipe (status EQUIPE) - e2e', () => {
  test.describe.configure({ mode: 'serial' });

  let testUser;
  let personName;
  let teamOrderNumber;
  let token;
  const teamOrderCharged = 250;

  test.beforeAll(async ({ request, playwright }) => {
    testUser = generateE2EUser();
    await createUserViaApi(request, testUser);

    const api = await playwright.request.newContext({
      baseURL: 'http://localhost:4000',
    });
    token = await loginAndGetToken(api, testUser.username, testUser.password);

    personName = `Cliente E2E ${testUser.username.slice(-6)}`;
    await createPersonViaApi(api, token, personName);

    teamOrderNumber = uniqueOrderNumber('EQT');
  });

  const fetchOrderStatus = async (request, orderNumber) => {
    const res = await request.get('http://localhost:4000/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
      params: { q: orderNumber, searchField: 'orderNumber' },
    });
    expect(res.ok()).toBeTruthy();
    const orders = await res.json();
    return orders.find((order) => order.orderNumber === orderNumber)?.status;
  };

  test.beforeEach(async ({ page, baseURL }) => {
    await login(page, baseURL, testUser.username, testUser.password);
  });

  test('CT1 - criar um pedido da equipe pelo formulário', async ({
    page,
    request,
  }, testInfo) => {
    await page.goto('/orders');
    await expect(
      page.getByRole('heading', { name: 'Pedidos dōTERRA' }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Novo Pedido' }).click();
    await waitFormOpen(page);

    const form = formScope(page);
    await form.getByTestId('order-is-team-order').check();
    await expect(form.getByTestId('order-team-notice')).toBeVisible();
    await expect(form.getByTestId('order-team-person')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('team-order-form.png'),
      fullPage: true,
    });

    await orderNumberInput(page).fill(teamOrderNumber);
    await form
      .getByLabel('Conta ID (ID dōTERRA ou nome)')
      .fill('Membro Equipe E2E');
    await form.getByLabel('Tipo de Pagamento').selectOption('PIX');
    await form
      .getByLabel('Descrição do Pedido')
      .fill('Pedido da equipe - registro');

    await form.getByPlaceholder('0,00').fill(String(teamOrderCharged) + '00');
    await form
      .getByTestId('order-team-person')
      .selectOption({ label: personName });

    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(rowByNumber(page, teamOrderNumber)).toBeVisible({
      timeout: 15_000,
    });
    await waitFormClose(page).catch(() => {});

    const row = rowByNumber(page, teamOrderNumber);
    await expect(row).toBeVisible();
    await expect(row.locator('td[data-label="Status"]')).toHaveCount(0);
    await expect(row.locator('td[data-label="Valor Pendente"]')).toHaveCount(0);
    await expect(row.locator('td[data-label="Cliente"]')).toContainText(
      personName,
    );

    expect(await fetchOrderStatus(request, teamOrderNumber)).toBe('EQUIPE');

    await triggerFor(page, teamOrderNumber).click();
    await expect(page.getByText('Registrar Pagamento')).toHaveCount(0);
    await expect(page.getByText('Detalhar Pagamentos')).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('team-order-row.png'),
      fullPage: true,
    });
  });

  test('CT3 - detalhes do pedido da equipe (somente leitura)', async ({
    page,
  }, testInfo) => {
    await page.goto('/orders');
    await expect(
      page.getByRole('heading', { name: 'Pedidos dōTERRA' }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await triggerFor(page, teamOrderNumber).click();
    await page.getByText('Detalhar Pagamentos').click();

    const details = page.getByTestId('details-modal');
    await expect(details).toBeVisible({ timeout: 10_000 });
    await expect(details).toContainText(`Detalhamento — ${teamOrderNumber}`);
    await expect(details).toContainText(personName);
    await expect(details.getByTestId('details-summary-pending')).toContainText(
      /R\$\s*0,00|0/,
    );

    await page.screenshot({
      path: testInfo.outputPath('team-order-details.png'),
      fullPage: true,
    });
  });

  test('CT4 - pedido da equipe não gera lançamento no fluxo de caixa', async ({
    page,
    request,
  }) => {
    // Team orders are excluded from financial tracking, so the ledger must not
    // contain any row linked to this team order.
    const orders = await listOrdersViaApi(request, token, {
      q: teamOrderNumber,
      searchField: 'orderNumber',
    });
    const order = orders.find((o) => o.orderNumber === teamOrderNumber);
    expect(order).toBeTruthy();

    const transactions = await listFinanceTransactionsViaApi(request, token);
    expect(transactions.some((t) => t.orderId === order.id)).toBe(false);

    await page.goto('/finances');
    await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(rowByNumber(page, teamOrderNumber)).toHaveCount(0);

    await saveScreenshot(page, 'f7-ct4-team-order-excluded-from-finances');
  });

  test('CT5 - alternar para pedido normal recalcula status', async ({
    page,
    request,
  }, testInfo) => {
    await page.goto('/orders');
    await expect(
      page.getByRole('heading', { name: 'Pedidos dōTERRA' }),
    ).toBeVisible({
      timeout: 15_000,
    });

    const row = rowByNumber(page, teamOrderNumber);
    await expect(row).toBeVisible();

    await triggerFor(page, teamOrderNumber).click();
    await page.getByText('Editar').click();
    await waitFormOpen(page);

    const editForm = formScope(page);
    await expect(editForm.getByTestId('order-is-team-order')).toBeChecked();
    // A single-client team order hydrates the order-level client select.
    await expect(
      editForm.getByTestId('order-team-person').locator('option:checked'),
    ).toHaveText(personName);
    await page.screenshot({
      path: testInfo.outputPath('edit-team-form.png'),
      fullPage: true,
    });
    await editForm.getByTestId('order-is-team-order').uncheck();
    await expect(editForm.getByTestId('order-team-notice')).toHaveCount(0);
    await expect(editForm.getByTestId('order-team-person')).toHaveCount(0);

    await editForm.getByRole('button', { name: 'Atualizar' }).click();
    await waitFormClose(page);

    const updated = rowByNumber(page, teamOrderNumber);
    await expect(updated).toBeVisible();
    await expect(updated.locator('td[data-label="Status"]')).toHaveCount(0);
    await expect(
      updated.locator('td[data-label="Valor Pendente"]'),
    ).toHaveCount(0);

    expect(await fetchOrderStatus(request, teamOrderNumber)).toBe('PENDENTE');

    await page.screenshot({
      path: testInfo.outputPath('order-toggled-to-normal.png'),
      fullPage: true,
    });
  });
});

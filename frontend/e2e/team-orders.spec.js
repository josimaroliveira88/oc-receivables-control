import { expect, test } from '@playwright/test';
import {
  generateE2EUser,
  createUserViaApi,
  login,
  createPersonViaApi,
  loginAndGetToken,
  uniqueOrderNumber,
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
  const teamOrderCharged = 250;

  test.beforeAll(async ({ request, playwright }) => {
    testUser = generateE2EUser();
    await createUserViaApi(request, testUser);

    const api = await playwright.request.newContext({
      baseURL: 'http://localhost:4000',
    });
    const token = await loginAndGetToken(
      api,
      testUser.username,
      testUser.password,
    );

    personName = `Cliente E2E ${testUser.username.slice(-6)}`;
    await createPersonViaApi(api, token, personName);

    teamOrderNumber = uniqueOrderNumber('EQT');
  });

  test.beforeEach(async ({ page, baseURL }) => {
    await login(page, baseURL, testUser.username, testUser.password);
  });

  test('CT1 - criar um pedido da equipe pelo formulário', async ({
    page,
  }, testInfo) => {
    await page.goto('/orders');
    await expect(page.getByText('Gestão de Pedidos')).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Novo Pedido' }).click();
    await waitFormOpen(page);

    const form = formScope(page);
    await form.getByTestId('order-is-team-order').check();
    await expect(form.getByTestId('order-team-notice')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('team-order-form.png'),
      fullPage: true,
    });

    await orderNumberInput(page).fill(teamOrderNumber);
    await form
      .getByLabel('Responsável pela conta (ID dōTERRA ou nome)')
      .fill('Membro Equipe E2E');
    await form.getByLabel('Tipo de Pagamento').selectOption('PIX');
    await form
      .getByLabel('Descrição do Pedido')
      .fill('Pedido da equipe - registro');

    await form.getByPlaceholder('0,00').fill(String(teamOrderCharged) + '00');
    await form
      .getByTestId('order-item-0')
      .locator('select')
      .first()
      .selectOption({ label: personName });

    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(rowByNumber(page, teamOrderNumber)).toBeVisible({
      timeout: 15_000,
    });
    await waitFormClose(page).catch(() => {});

    const row = rowByNumber(page, teamOrderNumber);
    await expect(row).toBeVisible();
    await expect(row).toContainText('Equipe');
    await expect(row.locator('td[data-label="Valor Pendente"]')).toHaveText(
      '—',
    );

    await triggerFor(page, teamOrderNumber).click();
    await expect(page.getByText('Registrar Pagamento')).toHaveCount(0);
    await expect(page.getByText('Detalhar Pagamentos')).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('team-order-row.png'),
      fullPage: true,
    });
  });

  test('CT2 - filtro "Somente da equipe"', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByText('Gestão de Pedidos')).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel('Status').selectOption('EQUIPE');

    await expect(page.getByText(teamOrderNumber)).toBeVisible();

    const orderNumbers = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows
        .map((r) => r.querySelector('a[title="Ver pedido no site"]'))
        .filter(Boolean)
        .map((a) => a.innerText.trim());
    });

    expect(orderNumbers).toContain(teamOrderNumber);
  });

  test('CT3 - detalhes do pedido da equipe (somente leitura)', async ({
    page,
  }, testInfo) => {
    await page.goto('/orders');
    await expect(page.getByText('Gestão de Pedidos')).toBeVisible({
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

  test('CT4 - dashboard não inclui pedido da equipe', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(page.getByText('Total Pendente')).toBeVisible({
      timeout: 15_000,
    });

    const dashText = await page.locator('body').innerText();
    expect(dashText).not.toMatch(/R\$\s*250,00[^\d]/);
    expect(dashText).not.toMatch(/1\.300,00|1300,00/);

    await page.screenshot({
      path: testInfo.outputPath('dashboard-with-team-order.png'),
      fullPage: true,
    });
  });

  test('CT5 - alternar para pedido normal recalcula status', async ({
    page,
  }, testInfo) => {
    await page.goto('/orders');
    await expect(page.getByText('Gestão de Pedidos')).toBeVisible({
      timeout: 15_000,
    });

    const row = rowByNumber(page, teamOrderNumber);
    await expect(row).toContainText('Equipe');

    await triggerFor(page, teamOrderNumber).click();
    await page.getByText('Editar').click();
    await waitFormOpen(page);

    const editForm = formScope(page);
    await expect(editForm.getByTestId('order-is-team-order')).toBeChecked();
    await page.screenshot({
      path: testInfo.outputPath('edit-team-form.png'),
      fullPage: true,
    });
    await editForm.getByTestId('order-is-team-order').uncheck();
    await expect(editForm.getByTestId('order-team-notice')).toHaveCount(0);

    await editForm.getByRole('button', { name: 'Atualizar' }).click();
    await waitFormClose(page);

    const updated = rowByNumber(page, teamOrderNumber);
    const statusCell = updated.locator('td[data-label="Status"]');
    await expect(statusCell).toContainText('Pendente');
    await expect(statusCell).not.toContainText('Equipe');

    const pendingCell = updated.locator('td[data-label="Valor Pendente"]');
    await expect(pendingCell).not.toHaveText('—');
    await expect(pendingCell).toContainText('R$ 250,00');

    await page.screenshot({
      path: testInfo.outputPath('order-toggled-to-normal.png'),
      fullPage: true,
    });
  });
});

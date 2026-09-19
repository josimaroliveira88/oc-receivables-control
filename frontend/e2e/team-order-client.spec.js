import { expect, test } from '@playwright/test';
import {
  generateE2EUser,
  createUserViaApi,
  login,
  createPersonViaApi,
  createOrderViaApi,
  loginAndGetToken,
  uniqueOrderNumber,
} from './helpers.js';

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
const clientCell = (page, num) =>
  rowByNumber(page, num).locator('td[data-label="Cliente"]');

test.describe('Cliente no nível do pedido de equipe - e2e', () => {
  test.describe.configure({ mode: 'serial' });

  let testUser;
  let token;
  let clientA;
  let clientB;
  let uiOrderNumber;
  let legacyReadNumber;
  let legacyMigrateNumber;

  test.beforeAll(async ({ request, playwright }) => {
    testUser = generateE2EUser();
    await createUserViaApi(request, testUser);

    const api = await playwright.request.newContext({
      baseURL: 'http://localhost:4000',
    });
    token = await loginAndGetToken(api, testUser.username, testUser.password);

    const suffix = testUser.username.slice(-6);
    clientA = await createPersonViaApi(api, token, `Cliente A ${suffix}`);
    clientB = await createPersonViaApi(api, token, `Cliente B ${suffix}`);

    uiOrderNumber = uniqueOrderNumber('EQ-CLI');
    legacyReadNumber = uniqueOrderNumber('EQ-LEG-R');
    legacyMigrateNumber = uniqueOrderNumber('EQ-LEG-M');

    // Legacy team order: items already bound to different clients, as created
    // before the order-level client existed.
    await createOrderViaApi(api, token, {
      orderNumber: legacyReadNumber,
      isTeamOrder: true,
      items: [
        { description: 'Legado A', chargedValue: 100, personId: clientA.id },
        { description: 'Legado B', chargedValue: 200, personId: clientB.id },
      ],
    });
    await createOrderViaApi(api, token, {
      orderNumber: legacyMigrateNumber,
      isTeamOrder: true,
      items: [
        { description: 'Migrar A', chargedValue: 100, personId: clientA.id },
        { description: 'Migrar B', chargedValue: 200, personId: clientB.id },
      ],
    });
  });

  const fetchOrder = async (request, orderNumber) => {
    const res = await request.get('http://localhost:4000/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
      params: { q: orderNumber, searchField: 'orderNumber' },
    });
    expect(res.ok()).toBeTruthy();
    const orders = await res.json();
    return orders.find((order) => order.orderNumber === orderNumber);
  };

  test.beforeEach(async ({ page, baseURL }) => {
    await login(page, baseURL, testUser.username, testUser.password);
  });

  test('CT1 - cria pedido da equipe com cliente no nível do pedido e propaga aos itens', async ({
    page,
    request,
  }) => {
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
    await form
      .getByPlaceholder('Informe o número do pedido da dōTERRA')
      .fill(uiOrderNumber);

    await form.getByPlaceholder('0,00').nth(0).fill('10000');
    await form.getByRole('button', { name: 'Adicionar Item' }).click();
    await form.getByPlaceholder('0,00').nth(1).fill('15000');

    // Selecting the client at the order level binds every item.
    await form
      .getByTestId('order-team-person')
      .selectOption({ label: clientA.name });

    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(rowByNumber(page, uiOrderNumber)).toBeVisible({
      timeout: 15_000,
    });
    await waitFormClose(page).catch(() => {});

    await expect(clientCell(page, uiOrderNumber)).toContainText(clientA.name);

    const created = await fetchOrder(request, uiOrderNumber);
    expect(created.status).toBe('EQUIPE');
    expect(created.items).toHaveLength(2);
    expect(created.items.every((item) => item.personId === clientA.id)).toBe(
      true,
    );
  });

  test('CT2 - editar pedido de cliente único hidrata o cliente do pedido sem seletor por item', async ({
    page,
  }) => {
    await page.goto('/orders');
    await expect(
      page.getByRole('heading', { name: 'Pedidos dōTERRA' }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await triggerFor(page, uiOrderNumber).click();
    await page.getByText('Editar', { exact: true }).click();
    await waitFormOpen(page);

    const form = formScope(page);
    await expect(
      form.getByTestId('order-team-person').locator('option:checked'),
    ).toHaveText(clientA.name);
    await expect(form.getByTestId('order-item-person-0')).toHaveCount(0);
    await expect(form.getByTestId('order-item-person-1')).toHaveCount(0);

    await form.getByRole('button', { name: 'Cancelar' }).click();
    await waitFormClose(page);
  });

  test('CT3 - pedido legado com clientes diferentes mantém o seletor por item', async ({
    page,
  }) => {
    await page.goto('/orders');
    await expect(
      page.getByRole('heading', { name: 'Pedidos dōTERRA' }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await expect(clientCell(page, legacyReadNumber)).toContainText('Vários');

    await triggerFor(page, legacyReadNumber).click();
    await page.getByText('Editar', { exact: true }).click();
    await waitFormOpen(page);

    const form = formScope(page);
    await expect(form.getByTestId('order-item-person-0')).toBeVisible();
    await expect(form.getByTestId('order-item-person-1')).toBeVisible();
    await expect(
      form.getByTestId('order-team-person').locator('option:checked'),
    ).toHaveText('Selecione uma pessoa');

    await form.getByRole('button', { name: 'Cancelar' }).click();
    await waitFormClose(page);
  });

  test('CT4 - unificar pedido legado pede confirmação e grava o cliente em todos os itens', async ({
    page,
    request,
  }) => {
    await page.goto('/orders');
    await expect(
      page.getByRole('heading', { name: 'Pedidos dōTERRA' }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await triggerFor(page, legacyMigrateNumber).click();
    await page.getByText('Editar', { exact: true }).click();
    await waitFormOpen(page);

    const form = formScope(page);
    await form
      .getByTestId('order-team-person')
      .selectOption({ label: clientA.name });

    await expect(
      page.getByText(
        'Ao escolher um cliente para todo o pedido, todos os itens serão vinculados a essa pessoa. Deseja continuar?',
      ),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(form.getByTestId('order-item-person-0')).toHaveCount(0);
    await expect(
      form.getByTestId('order-team-person').locator('option:checked'),
    ).toHaveText(clientA.name);

    await form.getByRole('button', { name: 'Atualizar' }).click();
    await waitFormClose(page);

    const migrated = await fetchOrder(request, legacyMigrateNumber);
    expect(migrated.items.every((item) => item.personId === clientA.id)).toBe(
      true,
    );
    await expect(clientCell(page, legacyMigrateNumber)).toContainText(
      clientA.name,
    );
  });
});

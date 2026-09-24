import { expect, test } from '@playwright/test';
import {
  API_URL,
  createOrderViaApi,
  createPersonViaApi,
  createSaleProductViaApi,
  createSaleViaApi,
  createUserViaApi,
  generateE2EUser,
  login,
  loginAndGetToken,
  stockInViaApi,
  uniqueOrderNumber,
} from './helpers.js';

const trackListRequests = (page, pathname) => {
  const requests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === pathname) requests.push(url.searchParams);
  });
  return requests;
};

const waitForInitialRequest = async (requests) => {
  await expect.poll(() => requests.length).toBeGreaterThan(0);
};

const waitForRequestCount = async (requests, expectedCount) => {
  await expect.poll(() => requests.length).toBe(expectedCount);
};

test.describe('Regressões dos hooks de pedidos e vendas - e2e', () => {
  test.describe.configure({ mode: 'serial' });

  let testUser;
  let token;
  let client;
  let product;
  let order;
  let sale;

  test.beforeAll(async ({ request, playwright }) => {
    testUser = generateE2EUser();
    await createUserViaApi(request, testUser);

    const api = await playwright.request.newContext({ baseURL: API_URL });
    token = await loginAndGetToken(api, testUser.username, testUser.password);

    const suffix = testUser.username.slice(-6);
    client = await createPersonViaApi(
      api,
      token,
      `Cliente Regressão Hooks ${suffix}`,
    );
    product = await createSaleProductViaApi(api, token, {
      name: `Produto Regressão Hooks ${suffix}`,
    });
    await stockInViaApi(api, token, product.id, 20);

    order = await createOrderViaApi(api, token, {
      orderNumber: uniqueOrderNumber('HOOK'),
      orderDate: '2026-09-23',
      orderNotes: 'Pedido para validar regressão dos hooks',
      items: [
        {
          description: 'Item de regressão',
          chargedValue: 120,
          quantity: 1,
        },
      ],
    });
    sale = await createSaleViaApi(api, token, {
      clientPersonId: client.id,
      orderDate: '2026-09-23',
      description: 'Venda para validar regressão dos hooks',
      items: [{ productId: product.id, chargedValue: 120, quantity: 1 }],
    });
  });

  test.beforeEach(async ({ page, baseURL }) => {
    await login(page, baseURL, testUser.username, testUser.password);
  });

  test('mantém os deep links e a refetch automática de pedidos', async ({
    page,
  }) => {
    await page.goto(`/orders?editOrder=${order.id}`);
    const editModal = page.getByTestId('modal-backdrop');
    await expect(editModal.getByText('Editar Pedido')).toBeVisible();
    await expect(
      editModal.getByPlaceholder('Informe o número do pedido da dōTERRA'),
    ).toHaveValue(order.orderNumber);
    await editModal.getByRole('button', { name: 'Fechar' }).click();

    await page.goto(`/orders?detailsOrder=${order.id}`);
    const detailsModal = page.getByTestId('details-modal');
    await expect(detailsModal).toBeVisible();
    await expect(
      detailsModal.getByText(`Detalhamento — ${order.orderNumber}`),
    ).toBeVisible();
    await detailsModal
      .getByRole('button', { name: 'Fechar detalhamento' })
      .click();

    const requests = trackListRequests(page, '/api/orders');
    await page.goto('/orders');
    await expect(
      page.getByRole('heading', { name: 'Pedidos dōTERRA' }),
    ).toBeVisible({ timeout: 15_000 });
    await waitForInitialRequest(requests);

    const beforeSearchField = requests.length;
    await page.getByLabel('Coluna de busca').selectOption('orderNumber');
    await waitForRequestCount(requests, beforeSearchField + 1);
    expect(requests.at(-1).get('searchField')).toBe('orderNumber');

    const beforeSearchText = requests.length;
    await page.getByLabel('Buscar pedidos').fill(order.orderNumber);
    await page.waitForTimeout(300);
    expect(requests).toHaveLength(beforeSearchText);

    await page.getByRole('button', { name: 'Pesquisar pedidos' }).click();
    await waitForRequestCount(requests, beforeSearchText + 1);
    expect(requests.at(-1).get('q')).toBe(order.orderNumber);
    expect(requests.at(-1).get('searchField')).toBe('orderNumber');
  });

  test('mantém os deep links e a refetch automática de vendas', async ({
    page,
  }) => {
    await page.goto(`/sales?editSale=${sale.id}`);
    const editModal = page.getByTestId('modal-backdrop');
    await expect(editModal.getByText('Editar Venda')).toBeVisible();
    await expect(editModal.getByLabel('Descrição da Venda')).toHaveValue(
      'Venda para validar regressão dos hooks',
    );
    await editModal.getByRole('button', { name: 'Fechar' }).click();

    await page.goto(`/sales?detailsSale=${sale.id}`);
    const detailsModal = page.getByTestId('sale-details-modal');
    await expect(detailsModal).toBeVisible();
    await expect(
      detailsModal.getByText(`Detalhamento — ${sale.orderNumber}`),
    ).toBeVisible();
    await detailsModal
      .getByRole('button', { name: 'Fechar detalhamento' })
      .click();

    const requests = trackListRequests(page, '/api/sales');
    await page.goto('/sales');
    await expect(
      page.getByRole('heading', { name: 'Gestão de Vendas' }),
    ).toBeVisible({ timeout: 15_000 });
    await waitForInitialRequest(requests);

    const beforeStatus = requests.length;
    await page.getByLabel('Status').selectOption('PENDENTE');
    await waitForRequestCount(requests, beforeStatus + 1);
    expect(requests.at(-1).get('status')).toBe('PENDENTE');

    const beforeSearchText = requests.length;
    await page.getByLabel('Buscar vendas').fill(client.name);
    await page.waitForTimeout(300);
    expect(requests).toHaveLength(beforeSearchText);

    await page.getByRole('button', { name: 'Pesquisar vendas' }).click();
    await waitForRequestCount(requests, beforeSearchText + 1);
    expect(requests.at(-1).get('q')).toBe(client.name);
    expect(requests.at(-1).get('status')).toBe('PENDENTE');
  });
});

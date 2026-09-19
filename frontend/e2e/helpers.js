import { randomUUID } from 'node:crypto';

export function generateE2EUser() {
  const tag = randomUUID().slice(0, 8);
  return {
    username: `e2e_team_${tag}`,
    password: 'E2EPass!1234',
  };
}

export async function createUserViaApi(api, user) {
  const res = await api.post('http://localhost:4000/api/auth/register', {
    data: { username: user.username, password: user.password },
    failOnStatusCode: false,
  });
  if (res.status() !== 201 && res.status() !== 409) {
    throw new Error(
      `Failed to create test user: ${res.status()} ${await res.text()}`,
    );
  }
  return res;
}

export async function login(page, baseURL, username, password) {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel('Usuário').fill(username);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Acessar' }).click();
  await page.waitForURL((url) => !/\/login$/.test(url.toString()), {
    timeout: 15_000,
  });
}

export async function createPersonViaApi(api, token, name) {
  const res = await api.post('http://localhost:4000/api/people', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name },
    failOnStatusCode: false,
  });
  if (!res.ok()) {
    throw new Error(`createPerson failed: ${res.status()} ${await res.text()}`);
  }
  return await res.json();
}

export async function createOrderViaApi(api, token, payload) {
  const res = await api.post('http://localhost:4000/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: payload,
    failOnStatusCode: false,
  });
  if (!res.ok()) {
    throw new Error(`createOrder failed: ${res.status()} ${await res.text()}`);
  }
  return await res.json();
}

export async function loginAndGetToken(api, username, password) {
  const res = await api.post('http://localhost:4000/api/auth/login', {
    data: { username, password },
  });
  if (!res.ok()) {
    throw new Error(`login failed: ${res.status()}`);
  }
  return (await res.json()).token;
}

export function uniqueOrderNumber(prefix) {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 6)}`;
}

export const API_URL = 'http://localhost:4000';

// Thin authenticated request wrapper for the E2E API seeding helpers below.
// Every call carries the caller's JWT so the backend scopes the data by user.
export async function apiRequest(api, method, path, token, data) {
  const res = await api[method](`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...(data !== undefined ? { data } : {}),
    failOnStatusCode: false,
  });
  if (!res.ok()) {
    throw new Error(
      `${method.toUpperCase()} ${path} failed: ${res.status()} ${await res.text()}`,
    );
  }
  return res;
}

export async function createProductViaApi(api, token, payload) {
  const res = await apiRequest(api, 'post', '/api/products', token, payload);
  return await res.json();
}

// A product ready for the sales flow. The code is unique per call so repeated
// E2E runs never collide with manually created catalog products.
export async function createSaleProductViaApi(api, token, overrides = {}) {
  const suffix = randomUUID().slice(0, 6).toUpperCase();
  return createProductViaApi(api, token, {
    code: `E2EF6${suffix}`,
    name: `Produto E2E ${suffix}`,
    size: '10ml',
    regularPrice: 120,
    memberPrice: 100,
    pv: 20,
    productType: 'SIMPLES',
    ...overrides,
  });
}

// Makes the product sellable (sales only accept ATIVO/INDISPONIVEL products
// that exist in stock), then initializes stock so the sale write succeeds.
export async function stockInViaApi(api, token, productId, quantity = 100) {
  await apiRequest(api, 'post', '/api/stock/movements', token, {
    productId,
    type: 'ENTRADA',
    quantity,
    reason: 'E2E F6 seed',
  });
}

export async function createSaleViaApi(api, token, payload) {
  const res = await apiRequest(api, 'post', '/api/sales', token, payload);
  return await res.json();
}

export async function createPaymentViaApi(api, token, orderId, payload) {
  const res = await apiRequest(
    api,
    'post',
    `/api/orders/${orderId}/payments`,
    token,
    payload,
  );
  return await res.json();
}

export async function createFinanceTransactionViaApi(api, token, payload) {
  const res = await apiRequest(
    api,
    'post',
    '/api/finances/transactions',
    token,
    payload,
  );
  return await res.json();
}

export async function createSettlementViaApi(api, token, payload) {
  const res = await apiRequest(
    api,
    'post',
    '/api/finances/settlements',
    token,
    payload,
  );
  return await res.json();
}

export async function listFinanceTransactionsViaApi(api, token, params = {}) {
  const query = new URLSearchParams(params).toString();
  const path = `/api/finances/transactions${query ? `?${query}` : ''}`;
  const res = await apiRequest(api, 'get', path, token);
  return await res.json();
}

export async function getFinanceSummaryViaApi(api, token, params = {}) {
  const query = new URLSearchParams(params).toString();
  const path = `/api/finances/summary${query ? `?${query}` : ''}`;
  const res = await apiRequest(api, 'get', path, token);
  return await res.json();
}

// Order helper for the finances-from-orders flow. Purchase orders default to
// `orderType COMPRA` on the backend and feed the ledger with one expense row
// each (team orders excluded).
export async function createPurchaseOrderViaApi(api, token, payload) {
  const res = await apiRequest(api, 'post', '/api/orders', token, payload);
  return await res.json();
}

export async function listOrdersViaApi(api, token, params = {}) {
  const query = new URLSearchParams(params).toString();
  const path = `/api/orders${query ? `?${query}` : ''}`;
  const res = await apiRequest(api, 'get', path, token);
  return await res.json();
}

// Saves a full-page PNG under the tracked, gitignored `e2e/screenshots/`
// folder with a stable, human-readable name so the screenshots are easy to
// find (instead of the encoded per-run test-results path).
export async function saveScreenshot(page, name) {
  const dir = new URL('./screenshots/', import.meta.url).pathname;
  await page.screenshot({
    path: `${dir}${name}.png`,
    fullPage: true,
  });
}

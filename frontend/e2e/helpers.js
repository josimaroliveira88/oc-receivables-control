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

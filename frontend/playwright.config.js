import { defineConfig, devices } from '@playwright/test';

// The production stack serves SPA + API together on :3000; the dev stack serves
// the SPA on :3000 with a Vite proxy to the API. Override E2E_BASE_URL when
// running against a different host/port.
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    apiURL: process.env.E2E_API_URL || BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

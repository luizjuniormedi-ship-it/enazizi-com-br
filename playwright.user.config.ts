import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

// Vite already owns environment loading in this project. Reuse it here so the
// test runner supports .env.e2e.local without copying credentials into code.
const fileEnv = loadEnv('e2e', process.cwd(), '');
for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const baseURL =
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
  process.env.E2E_BASE_URL ||
  'http://127.0.0.1:4173';

const targetURL = new URL(baseURL);
const shouldStartLocalServer = ['localhost', '127.0.0.1'].includes(targetURL.hostname);
const localPort = targetURL.port || (targetURL.protocol === 'https:' ? '443' : '80');

export default defineConfig({
  testDir: './tests/user',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report/user-simulation', open: 'never' }],
  ],
  outputDir: 'test-results/user-simulation',
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    // Auth is intentionally exercised through the UI. Traces persist DOM input
    // values, so keep them disabled to avoid leaking the E2E password.
    trace: 'off',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: shouldStartLocalServer
    ? {
        command: `npm run dev -- --host 127.0.0.1 --port ${localPort}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});

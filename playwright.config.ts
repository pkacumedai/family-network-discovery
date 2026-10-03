import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) throw new Error('Browser tests require a disposable TEST_DATABASE_URL ending in _test');
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1,
  globalSetup: './tests/browser/setup.ts',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: { command: 'npm run dev -- --port 3100', url: 'http://127.0.0.1:3100', reuseExistingServer: false,
    env: { PLAYWRIGHT_TEST_SERVER: 'true', DATABASE_URL: databaseUrl, BETTER_AUTH_URL: 'http://127.0.0.1:3100', BETTER_AUTH_SECRET: 'browser-test-secret-only-01234567890123456789', MAIL_TRANSPORT: 'mailpit', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025' }, timeout: 120000 },
});

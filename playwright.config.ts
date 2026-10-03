import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'demo/recordings/playwright-report', open: 'never' }]],
  outputDir: 'demo/recordings/e2e-results',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:13000',
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    launchOptions: process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : undefined,
  },
});

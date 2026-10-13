import { defineConfig, devices } from '@playwright/test';

const port = process.env.WILD_MUSTANG_TEST_PORT || '4173';
const baseURL = `http://127.0.0.1:${port}/wild-mustang/`;

const sandboxArgs = process.env.PLAYWRIGHT_SINGLE_PROCESS === '1'
  ? ['--no-sandbox', '--no-zygote', '--single-process', '--enable-unsafe-swiftshader']
  : ['--enable-unsafe-swiftshader'];

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 180_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: process.env.PLAYWRIGHT_SINGLE_PROCESS === '1' ? 'off' : 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, launchOptions: { args: sandboxArgs } },
    },
    {
      name: 'chromium-ipad',
      use: { ...devices['iPad Pro 11 landscape'], browserName: 'chromium', launchOptions: { args: sandboxArgs } },
    },
    {
      name: 'webkit-ipad',
      use: { ...devices['iPad Pro 11 landscape'], browserName: 'webkit' },
    },
  ],
  webServer: {
    command: `VITE_TEST_MODE=true npm run build && npm run preview -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    cwd: process.env.WILD_MUSTANG_REPO || process.cwd(),
    timeout: 60_000,
  },
});

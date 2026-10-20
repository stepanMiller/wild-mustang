import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// Opt-in frozen-build runner: deliberately has no webServer/build command.
export default defineConfig({
  testDir: path.resolve(process.cwd(), 'tests'),
  testMatch: 'graphics-polish.spec.js',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: path.resolve(process.env.WILD_MUSTANG_GRAPHICS_RUN_DIR || '/tmp/wild-mustang-graphics-polish-04', 'test-results'),
  use: { baseURL: process.env.WILD_MUSTANG_GRAPHICS_URL, trace: 'off', screenshot: 'only-on-failure', video: 'off' },
  projects: [{ name: 'chromium-ipad', use: {
    ...devices['iPad Pro 11 landscape'], browserName: 'chromium',
    launchOptions: { args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
      ...(process.env.WILD_MUSTANG_CHROMIUM_EXECUTABLE ? { executablePath: process.env.WILD_MUSTANG_CHROMIUM_EXECUTABLE } : {}) },
  } }],
});

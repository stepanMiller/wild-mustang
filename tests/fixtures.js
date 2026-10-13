import { test as base } from '@playwright/test';

// The restricted local runner requires Chromium single-process mode, which cannot
// safely reuse a browser after disposing a context. CI uses the standard fixture.
export const test = process.env.PLAYWRIGHT_SINGLE_PROCESS === '1'
  ? base.extend({
    context: async ({ playwright, browserName, launchOptions }, use, testInfo) => {
      const browser = await playwright[browserName].launch(launchOptions);
      const project = testInfo.project.use;
      const context = await browser.newContext({
        baseURL: project.baseURL,
        viewport: project.viewport,
        deviceScaleFactor: project.deviceScaleFactor,
        isMobile: project.isMobile,
        hasTouch: project.hasTouch,
        userAgent: project.userAgent,
      });
      await use(context);
      await context.close();
      await browser.close();
    },
  })
  : base;

import { expect } from '@playwright/test';
import { test } from './fixtures.js';
import { openGame, startChapterOne, state } from './helpers.js';

test('Rendering records repeatable frame and draw metrics without a hardware FPS claim', async ({ page }, testInfo) => {
  await openGame(page);
  await startChapterOne(page);
  const metrics = await page.evaluate(async () => {
    const times = [];
    let previous = performance.now();
    const end = previous + 3000;
    await new Promise(resolve => {
      function frame(now) {
        times.push(now - previous);
        previous = now;
        if (now >= end) resolve();
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    const sorted = times.slice().sort((a, b) => a - b);
    return {
      browser: navigator.userAgent,
      viewport: [innerWidth, innerHeight],
      devicePixelRatio,
      samples: times.length,
      meanFrameMs: times.reduce((a, b) => a + b, 0) / times.length,
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
      renderer: window.__WILD_MUSTANG_TEST__.snapshot().render,
    };
  });
  expect(metrics.samples).toBeGreaterThan(0);
  expect(metrics.renderer.calls).toBeGreaterThan(0);
  expect(metrics.renderer.triangles).toBeGreaterThan(0);
  await testInfo.attach('software-browser-render-metrics', {
    body: JSON.stringify({ ...metrics, note: 'Desktop automated runner, not physical iPad performance.' }, null, 2),
    contentType: 'application/json',
  });
});

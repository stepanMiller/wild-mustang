import { expect } from '@playwright/test';
import { test } from './fixtures.js';
import { finishCurrentChapter, meetAlex, openGame, skipTutorial, startChapterOne, state } from './helpers.js';

test('Story all three chapters unlock, save, reunite and replay without losing completion', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openGame(page);
  await page.locator('#btnChapters').click();
  await expect(page.locator('[data-chapter="1"]')).toBeEnabled();
  await expect(page.locator('[data-chapter="2"]')).toBeDisabled();
  await expect(page.locator('[data-chapter="3"]')).toBeDisabled();
  await page.locator('#btnCloseChapters').click();
  await startChapterOne(page);
  await skipTutorial(page);
  await meetAlex(page);
  for (const chapter of [1, 2, 3]) {
    expect((await state(page)).chapter).toBe(chapter);
    await finishCurrentChapter(page);
    expect((await state(page)).completedChapters).toContain(chapter);
    await expect(page.locator('#finish')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: testInfo.outputPath(`chapter-${chapter}-complete.png`) });
    if (chapter < 3) {
      await page.locator('#btnNextChapter').click();
      await expect.poll(async () => (await state(page)).chapter).toBe(chapter + 1);
      await expect.poll(async () => (await state(page)).phase).toBe('quests');
    }
  }
  await expect(page.locator('#finish')).toContainText(/Мы дома/);
  const completed = (await state(page)).completedChapters;
  expect(completed).toEqual([1, 2, 3]);
  await page.locator('#btnEpilogue').click();
  await expect.poll(async () => (await state(page)).phase).toBe('epilogue');
  const home = (await state(page)).position;
  await page.keyboard.down('w');
  await expect.poll(async () => {
    const p = (await state(page)).position;
    return Math.hypot(p.x - home.x, p.z - home.z);
  }).toBeGreaterThan(0.3);
  await page.keyboard.up('w');
  await page.locator('#btnPause').click();
  await page.locator('#btnToMenu').click();
  await page.reload();
  await expect(page.locator('#loading')).toHaveCount(0, { timeout: 20_000 });
  await page.locator('#btnContinue').click();
  await expect.poll(async () => (await state(page)).phase).toBe('epilogue');
  expect((await state(page)).completedChapters).toEqual(completed);
  await page.locator('#btnPause').click();
  await page.locator('#btnToMenu').click();
  await page.locator('#btnChapters').click();
  for (const chapter of [1, 2, 3]) await expect(page.locator(`[data-chapter="${chapter}"]`)).toBeEnabled();
  await page.locator('[data-chapter="2"]').click();
  await expect.poll(async () => (await state(page)).chapter).toBe(2);
  expect((await state(page)).quest).toBe(0);
  expect((await state(page)).completedChapters).toEqual(completed);
  await finishCurrentChapter(page);
  expect((await state(page)).completedChapters).toEqual(completed);
  expect(errors).toEqual([]);
});

test('Story restart resets the current chapter and preserves unlocked chapters', async ({ page }) => {
  test.setTimeout(100_000);
  await openGame(page);
  await startChapterOne(page);
  await skipTutorial(page);
  await meetAlex(page);
  await finishCurrentChapter(page);
  await page.locator('#btnAgain').click();
  await expect.poll(async () => (await state(page)).phase).toBe('tutorial');
  const restarted = await state(page);
  expect(restarted.chapter).toBe(1);
  expect(restarted.quest).toBe(0);
  expect(restarted.apples).toBe(0);
  expect(restarted.freeProgress).toBe(0);
  expect(restarted.foalFreed).toBe(false);
  expect(restarted.completedChapters).toContain(1);
});

// Ensure diagnostics cannot be used accidentally by a normal player.
test('Release gameplay hooks require explicit localhost QA opt-in', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#loading')).toHaveCount(0, { timeout: 20_000 });
  expect(await page.evaluate(() => typeof window.__WILD_MUSTANG_TEST__)).toBe('undefined');
  await page.locator('#btnPlay').click();
  await expect(page.locator('#hud')).toHaveClass(/on/);
});

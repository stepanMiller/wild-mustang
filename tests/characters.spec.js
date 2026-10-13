import { expect } from '@playwright/test';
import { test } from './fixtures.js';
import { openGame, startChapterOne, state, teleport } from './helpers.js';

test('Characters ship rigged local assets and react to movement and jumping', async ({ page }, testInfo) => {
  await openGame(page);
  await expect.poll(async () => (await state(page)).characters, { timeout: 30_000 }).toMatchObject({
    horse: 'rigged', foal: 'rigged', herd: 'rigged', alex: 'rigged', error: null,
  });
  await startChapterOne(page);
  await teleport(page, 35, 35);
  await page.keyboard.down('w');
  await expect.poll(async () => (await state(page)).gaits[0]).toMatch(/Walk|Trot/);
  await page.keyboard.down('Shift');
  await expect.poll(async () => (await state(page)).gaits[0]).toBe('Gallop');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).gaits[0]).toMatch(/Jump/);
  await page.keyboard.up('Shift');
  await page.keyboard.up('w');
  await expect.poll(async () => (await state(page)).grounded).toBe(true);
  await expect.poll(async () => (await state(page)).gaits[0]).toMatch(/^Idle/);
  await page.screenshot({ path: testInfo.outputPath('rigged-characters.png') });
});

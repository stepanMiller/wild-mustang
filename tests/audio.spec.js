import { expect } from '@playwright/test';
import { test } from './fixtures.js';
import { openGame, pointer, position, skipTutorial, startChapterOne, state } from './helpers.js';

const audioState = async page => (await state(page)).audio;
const closeSettings = async page => page.locator('#btnCloseSettings').click();
const reloadToMenu = async page => {
  await page.reload();
  await expect(page.locator('#loading')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('#start')).toHaveClass(/on/);
};
const setSlider = async (page, id, value) => page.locator(id).evaluate((element, next) => {
  element.value = String(next);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}, value);

test.beforeEach(async ({ page }) => {
  page.__audioTest = { errors: [], expectedFailures: [], aborted: new Set() };
  page.on('pageerror', error => page.__audioTest.errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const data = page.__audioTest;
    // Only network diagnostics for the exact URLs intentionally aborted in
    // the third test are expected; application errors remain failures.
    if (data.aborted.has(message.location().url) && /^Failed to load resource:/.test(message.text())) {
      data.expectedFailures.push(message.text());
    } else data.errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(page.__audioTest.errors, 'No uncaught, unhandled-promise, or unexpected console errors').toEqual([]);
});

test('Local Russian guidance unlocks, ducks background, repeats, and survives pause/resume', async ({ page, baseURL }) => {
  const foreignAudio = [];
  page.on('request', request => {
    if (request.url().includes('/assets/audio/') && new URL(request.url()).origin !== new URL(baseURL).origin) {
      foreignAudio.push(request.url());
    }
  });
  await openGame(page);
  await startChapterOne(page);
  await expect.poll(async () => (await audioState(page)).context).toBe('running');
  await expect.poll(async () => (await audioState(page)).cueStarts).toBeGreaterThan(0);
  const listen = page.locator('#btnListen');
  await expect(listen).toBeVisible();
  const box = await listen.boundingBox();
  expect(box.width, 'Listen touch width').toBeGreaterThanOrEqual(44);
  expect(box.height, 'Listen touch height').toBeGreaterThanOrEqual(44);

  const initial = await audioState(page);
  expect(initial.decodeCount).toBeGreaterThan(0);
  const beforeRepeat = initial.cueStarts;
  await listen.click();
  let spoken;
  await expect.poll(async () => {
    spoken = await audioState(page);
    return spoken.cueStarts > beforeRepeat && spoken.musicDucked;
  }).toBe(true);
  expect(spoken.cue).toBe('tutorial-move');
  expect(spoken.cueDuration, 'Decoded recorded cue lasts several seconds').toBeGreaterThan(2);
  expect(spoken.sampleRate).toBeGreaterThanOrEqual(24000);
  await expect.poll(async () => (await audioState(page)).cue).toBeNull();
  expect((await audioState(page)).musicDucked).toBe(false);
  await expect.poll(async () => (await audioState(page)).streams.wind.time).toBeGreaterThan(0);

  await listen.click();
  await page.locator('#btnPause').click();
  await expect.poll(async () => (await audioState(page)).context).toBe('suspended');
  const paused = await audioState(page);
  expect(paused.context).toBe('suspended');
  expect(paused.cue).toBeNull();
  expect(paused.pendingCue).toBeNull();
  expect(paused.activeEffects).toBe(0);
  expect(Object.values(paused.streams).every(stream => !stream.playing)).toBe(true);
  await page.locator('#btnResume').click();
  await expect.poll(async () => (await audioState(page)).context).toBe('running');
  await expect.poll(async () => (await audioState(page)).cueStarts).toBeGreaterThan(paused.cueStarts);
  const resumed = await audioState(page);
  expect(resumed.voiceCacheEntries).toBeLessThanOrEqual(3);
  expect(resumed.voiceCacheBytes).toBeLessThanOrEqual(3 * 1024 * 1024);
  expect(resumed.effectCacheBytes).toBeLessThanOrEqual(1024 * 1024);
  expect(resumed.unavailable).toEqual([]);
  expect(foreignAudio).toEqual([]);
});

test('Voice mute persists through reload independently of music and effects volume', async ({ page }) => {
  await openGame(page);
  await page.locator('#btnSettings1').click();
  await expect(page.locator('#tgVoice')).toHaveClass(/on/);
  await page.locator('#tgVoice').click();
  await closeSettings(page);
  await startChapterOne(page);
  await expect.poll(async () => (await audioState(page)).context).toBe('running');
  expect((await state(page)).settings.voice).toBe(false);
  expect((await audioState(page)).cueStarts).toBe(0);
  expect((await audioState(page)).cue).toBeNull();
  await page.locator('#btnPause').click();
  await page.locator('#btnToMenu').click();
  await reloadToMenu(page);
  await page.locator('#btnContinue').click();
  await expect.poll(async () => (await audioState(page)).context).toBe('running');
  expect((await state(page)).settings.voice).toBe(false);
  expect((await audioState(page)).settings.voice).toBe(false);
  expect((await audioState(page)).cueStarts).toBe(0);

  await page.locator('#btnPause').click();
  await page.locator('#btnSettings2').click();
  await page.locator('#tgVoice').click();
  await setSlider(page, '#volMusic', 0);
  await setSlider(page, '#volSfx', 0);
  await closeSettings(page);
  await page.locator('#btnResume').click();
  await expect.poll(async () => (await audioState(page)).cueStarts).toBeGreaterThan(0);
  const narrated = await audioState(page);
  expect(narrated.settings).toMatchObject({ voice: true, music: 0, sfx: 0 });
  expect(Object.values(narrated.streams).every(stream => !stream.playing)).toBe(true);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('veter-save')));
  expect(saved.settings).toMatchObject({ voice: true, music: 0, sfx: 0 });
});

test('Unavailable local audio stays silent while movement, save, and Continue remain usable', async ({ page }) => {
  const blocked = page.__audioTest.aborted;
  await page.route('**/assets/audio/**', route => {
    blocked.add(route.request().url());
    return route.abort('failed');
  });
  await openGame(page);
  await startChapterOne(page);
  await expect.poll(async () => (await audioState(page)).unavailable.length).toBeGreaterThan(0);
  expect((await audioState(page)).cueStarts).toBe(0);
  expect(blocked.size).toBeGreaterThan(0);
  const joy = await page.locator('#joyBase').boundingBox();
  const x = joy.x + joy.width / 2, y = joy.y + joy.height / 2;
  const before = position(await state(page));
  await pointer(page, '#joyBase', 'pointerdown', 83, x, y);
  await pointer(page, '#joyBase', 'pointermove', 83, x + 45, y - 40);
  await expect.poll(async () => {
    const after = position(await state(page));
    return Math.hypot(after.x - before.x, after.z - before.z);
  }).toBeGreaterThan(.5);
  await pointer(page, '#joyBase', 'pointercancel', 83, x, y);
  await skipTutorial(page);
  await page.locator('#btnPause').click();
  const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem('veter-save')).checkpoint);
  expect(checkpoint.phase).toBe('meet');
  expect(Number.isFinite(checkpoint.x) && Number.isFinite(checkpoint.z)).toBe(true);
  await page.locator('#btnToMenu').click();
  await reloadToMenu(page);
  await expect(page.locator('#btnContinue')).toBeEnabled();
  await page.locator('#btnContinue').click();
  await expect.poll(async () => (await state(page)).phase).toBe('meet');
  expect((await state(page)).position.x).toBeCloseTo(checkpoint.x, 2);
  expect((await state(page)).position.z).toBeCloseTo(checkpoint.z, 2);
});

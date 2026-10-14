import { expect } from '@playwright/test';
import { test } from './fixtures.js';
import { openGame, pointer, skipTutorial, startChapterOne, state, teleport } from './helpers.js';

test.beforeEach(async ({ page }) => {
  page.__errors = [];
  page.on('pageerror', error => page.__errors.push(error.message));
  await openGame(page);
  await startChapterOne(page);
});
test.afterEach(async ({ page }) => expect(page.__errors).toEqual([]));

test('Camera snaps to the current hero on start and positional reset', async ({ page }) => {
  const assertFraming = async () => {
    const s = await state(page), p = s.position, c = s.camera;
    expect(c.look.x).toBeCloseTo(p.x, 4);
    expect(c.look.z).toBeCloseTo(p.z, 4);
    const distance = Math.hypot(c.position.x - c.look.x, c.position.y - c.look.y, c.position.z - c.look.z);
    expect(distance, 'Horse stays outside the near plane').toBeGreaterThanOrEqual(5.4);
    expect(distance, 'Camera cannot interpolate from another chapter').toBeLessThan(24);
    const ground = await page.evaluate(c => window.__WILD_MUSTANG_TEST__.terrain(c.x, c.z), c.position);
    expect(c.position.y).toBeGreaterThanOrEqual(ground + 1.99);
  };
  await assertFraming();
  for (const [x, z] of [[-72, -64], [48, 58], [86, -78]]) {
    await teleport(page, x, z);
    await assertFraming();
  }
});

test('Simultaneous joystick and camera touches rotate independently in every engine', async ({ page }) => {
  await skipTutorial(page);
  const box = await page.locator('#joyBase').boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await pointer(page, '#joyBase', 'pointerdown', 31, x, y);
  await pointer(page, '#joyBase', 'pointermove', 31, x, y - 30);
  await pointer(page, '#scene', 'pointerdown', 32, 800, 350);
  const before = (await state(page)).camera;
  await pointer(page, '#scene', 'pointermove', 32, 900, 320);
  const after = await state(page);
  expect(after.camera.yaw - before.yaw).toBeGreaterThan(.4);
  expect(after.camera.pitch - before.pitch).toBeGreaterThan(.08);
  expect(after.inputs.y).toBeLessThan(-.2);
  await pointer(page, '#scene', 'pointercancel', 32, 900, 320);
  expect((await state(page)).inputs.y).toBeLessThan(-.2);
  await pointer(page, '#joyBase', 'lostpointercapture', 31, x, y);
  expect((await state(page)).inputs).toMatchObject({ x: 0, y: 0, gallop: false });
});

test('Only the touch holding gallop can release it; cancellation never sticks', async ({ page }) => {
  await pointer(page, '#btnGallop', 'pointerdown', 41, 1000, 700);
  expect((await state(page)).inputs.gallop).toBe(true);
  await pointer(page, '#btnGallop', 'pointerdown', 42, 1010, 710);
  await pointer(page, '#btnGallop', 'pointerup', 42, 1010, 710);
  expect((await state(page)).inputs.gallop).toBe(true);
  await pointer(page, '#btnGallop', 'lostpointercapture', 41, 1000, 700);
  expect((await state(page)).inputs.gallop).toBe(false);
  await pointer(page, '#btnGallop', 'pointerdown', 43, 1000, 700);
  await pointer(page, '#btnGallop', 'pointercancel', 43, 1000, 700);
  expect((await state(page)).inputs.gallop).toBe(false);
});

test('Orientation and background interruption clear all held controls and allow resume', async ({ page }) => {
  const hold = async () => {
    const b = await page.locator('#joyBase').boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await pointer(page, '#joyBase', 'pointerdown', 51, x, y);
    await pointer(page, '#joyBase', 'pointermove', 51, x, y - 40);
    await pointer(page, '#btnGallop', 'pointerdown', 52, 1000, 700);
  };
  const landscape = page.viewportSize();
  await hold();
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator('#orientation')).toBeVisible();
  await expect.poll(async () => (await state(page)).inputs).toMatchObject({ x: 0, y: 0, gallop: false });
  await page.setViewportSize(landscape);
  await expect(page.locator('#orientation')).not.toBeVisible();
  await hold();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#pause')).toHaveClass(/on/);
  expect((await state(page)).inputs).toMatchObject({ x: 0, y: 0, gallop: false });
  await page.locator('#btnResume').click();
  await hold();
  expect((await state(page)).inputs.gallop).toBe(true);
  await page.locator('#btnPause').click();
  expect((await state(page)).inputs).toMatchObject({ x: 0, y: 0, gallop: false });
});

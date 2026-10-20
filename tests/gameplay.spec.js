import { expect } from '@playwright/test';
import { test } from './fixtures.js';
import { action, meetAlex, openGame, pointer, position, skipTutorial, startChapterOne, state, teleport } from './helpers.js';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.__gameErrors = errors;
});

test.afterEach(async ({ page }) => {
  expect(page.__gameErrors, 'Uncaught browser/console errors').toEqual([]);
});

test('P1 new game renders locally and landscape controls are usable', async ({ page, baseURL }, testInfo) => {
  const foreignRequests = [];
  page.on('request', request => {
    if (new URL(request.url()).origin !== new URL(baseURL).origin) foreignRequests.push(request.url());
  });
  await openGame(page);
  await startChapterOne(page);
  await expect(page.locator('#hud')).toHaveClass(/on/);
  const render = (await state(page)).render;
  expect(render.calls).toBeGreaterThan(0);
  expect(render.triangles).toBeGreaterThan(500);
  for (const id of ['#btnJump', '#btnGallop', '#btnPause']) {
    const box = await page.locator(id).boundingBox();
    expect(box.width, `${id} touch width`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${id} touch height`).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
  }
  expect(foreignRequests, 'Core game must not require CDN/font requests').toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('chapter-one-landscape.png') });
});

test('P1 keyboard can finish every tutorial step and Shift release stops galloping', async ({ page }) => {
  await openGame(page);
  await startChapterOne(page);
  await teleport(page, 35, 35);
  await page.keyboard.down('w');
  await expect.poll(async () => (await state(page)).tutStep).toBeGreaterThanOrEqual(1);
  await page.keyboard.up('w');
  await pointer(page, '#scene', 'pointerdown', 20, 700, 380);
  await pointer(page, '#scene', 'pointermove', 20, 780, 380);
  await pointer(page, '#scene', 'pointerup', 20, 780, 380);
  await expect.poll(async () => (await state(page)).tutStep).toBeGreaterThanOrEqual(2);
  await page.keyboard.down('w');
  await page.keyboard.down('Shift');
  await expect.poll(async () => (await state(page)).tutStep).toBeGreaterThanOrEqual(3);
  await page.keyboard.up('Shift');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).tutStep).toBeGreaterThanOrEqual(4);
  await page.keyboard.up('w');
  await expect.poll(async () => (await state(page)).phase, { timeout: 90_000 }).toBe('meet');
  expect((await state(page)).inputs.gallop).toBe(false);
});

test('P1 touch joystick moves the hero and pointer cancellation clears controls', async ({ page }) => {
  await openGame(page);
  await startChapterOne(page);
  const joy = await page.locator('#joyBase').boundingBox();
  const cx = joy.x + joy.width / 2, cy = joy.y + joy.height / 2;
  const before = position(await state(page));
  await pointer(page, '#joyBase', 'pointerdown', 3, cx, cy);
  await pointer(page, '#joyBase', 'pointermove', 3, cx + 50, cy - 40);
  await expect.poll(async () => {
    const p = position(await state(page));
    return Math.hypot(p.x - before.x, p.z - before.z);
  }).toBeGreaterThan(0.5);
  const gallop = await page.locator('#btnGallop').boundingBox();
  await page.mouse.move(gallop.x + 25, gallop.y + 25);
  await page.mouse.down();
  expect((await state(page)).inputs.gallop).toBe(true);
  await pointer(page, '#btnGallop', 'pointercancel', 1, gallop.x + 25, gallop.y + 25);
  await page.mouse.up();
  await pointer(page, '#joyBase', 'pointercancel', 3, cx, cy);
  await expect.poll(async () => (await state(page)).inputs).toMatchObject({ x: 0, y: 0, gallop: false });
});

test('P1 pause freezes airborne movement and restores safely', async ({ page }) => {
  await openGame(page);
  await startChapterOne(page);
  await page.locator('#btnJump').click();
  await expect.poll(async () => (await state(page)).grounded).toBe(false);
  await page.locator('#btnPause').click();
  const frozen = await state(page);
  await page.waitForTimeout(400);
  expect((await state(page)).position).toEqual(frozen.position);
  expect((await state(page)).paused).toBe(true);
  await page.locator('#btnResume').click();
  await expect.poll(async () => (await state(page)).grounded).toBe(true);
});

test('P1 required quest interaction wins over optional companion petting', async ({ page }) => {
  await openGame(page);
  await startChapterOne(page);
  await skipTutorial(page);
  await meetAlex(page);
  const target = await page.evaluate(() => window.__WILD_MUSTANG_TEST__.target());
  await teleport(page, target[0], target[1]);
  await page.waitForTimeout(900);
  await action(page, /Осмотреть следы/);
  await expect.poll(async () => (await state(page)).quest).toBe(1);
});

test('P1 early apple collection does not softlock the apple objective', async ({ page }) => {
  await openGame(page);
  await startChapterOne(page);
  await skipTutorial(page);
  await meetAlex(page);
  const apples = await page.evaluate(() => window.__WILD_MUSTANG_TEST__.objects().apples);
  for (const apple of apples) {
    await teleport(page, apple.x, apple.z);
    await action(page, /Взять яблоко/);
  }
  expect((await state(page)).apples).toBe(3);
  // This regression concerns advancing past an already satisfied apple task.
  // The separate story scenario verifies the remaining chapter and its ending.
  const quests = await page.evaluate(() => window.__WILD_MUSTANG_TEST__.objects().quests);
  await teleport(page, quests[0].target[0], quests[0].target[1]);
  await action(page, quests[0].label);
  await expect.poll(async () => (await state(page)).quest).toBe(1);
  await teleport(page, quests[1].target[0], quests[1].target[1]);
  await expect.poll(async () => (await state(page)).quest).toBe(3);
  expect((await state(page)).phase).toBe('quests');
  expect((await state(page)).apples).toBe(3);
});

test('P1 save and reload preserve partially rescued foal and world state', async ({ page }) => {
  await openGame(page);
  await startChapterOne(page);
  await skipTutorial(page);
  await meetAlex(page);
  // Read progression and destination together, as automatic completion may
  // happen between browser round-trips after an early apple collection.
  for (let attempts = 0; attempts < 12; attempts++) {
    const { s, target, q, allTaken } = await page.evaluate(() => {
      const api = window.__WILD_MUSTANG_TEST__;
      const s = api.snapshot(), objects = api.objects();
      return { s, target: api.target(), q: objects.quests[s.quest],
        allTaken: objects.apples.every(a => a.taken) };
    });
    if (s.quest >= 3) break;
    if (q.kind === 'apples' && allTaken) {
      await expect.poll(async () => (await state(page)).quest).not.toBe(s.quest);
      continue;
    }
    const travel = q.kind === 'zone' ? q.target : target;
    await teleport(page, travel[0], travel[1]);
    if (q.kind === 'zone') await expect.poll(async () => (await state(page)).quest).not.toBe(s.quest);
    else await action(page, q.kind === 'apples' ? /Взять яблоко/ : q.label);
  }
  expect((await state(page)).quest).toBe(3);
  const target = await page.evaluate(() => window.__WILD_MUSTANG_TEST__.target());
  await teleport(page, target[0], target[1]);
  await action(page, /Отодвинуть ветк/);
  await expect.poll(async () => (await state(page)).freeProgress).toBe(1);
  const visibleRescuePieces = (await state(page)).world.rescuePieces;
  await page.reload();
  await expect(page.locator('#loading')).toHaveCount(0, { timeout: 20_000 });
  await page.locator('#btnContinue').click();
  const loaded = await state(page);
  expect(loaded.quest).toBe(3);
  expect(loaded.freeProgress).toBe(1);
  expect(loaded.apples).toBe(3);
  expect(loaded.world.rescuePieces).toBe(visibleRescuePieces);
  // Complete the remaining rescue actions after reload. The full story test
  // owns hill navigation and the chapter ending, avoiding a duplicate playthrough.
  for (let attempts = 0; attempts < 3 && (await state(page)).quest === 3; attempts++) {
    await action(page, /Отодвинуть ветк/);
  }
  await expect.poll(async () => (await state(page)).quest).toBe(4);
  expect((await state(page)).phase).toBe('quests');
  expect((await state(page)).foalFreed).toBe(true);
  expect((await state(page)).freeProgress).toBe(3);
});

test('P1 corrupted saved data recovers to a playable new game', async ({ page }) => {
  await openGame(page, { save: '{broken json' });
  await startChapterOne(page);
  await skipTutorial(page);
  await meetAlex(page);
  expect((await state(page)).quest).toBe(0);
});

test('P1 return to the trail moves an off-route save without losing quest progress', async ({ page }) => {
  await openGame(page);
  await startChapterOne(page);
  await skipTutorial(page);
  await meetAlex(page);
  const progress = await state(page);
  await teleport(page, 80, 80);
  await page.locator('#btnPause').click();
  const offRoute = position(await state(page));
  expect(offRoute.x).toBe(80);
  expect(offRoute.z).toBe(80);
  await page.locator('#btnUnstuck').click();
  await expect.poll(async () => {
    const p = position(await state(page));
    return Math.hypot(p.x - offRoute.x, p.z - offRoute.z);
  }).toBeGreaterThan(10);
  const returned = await state(page);
  expect(returned.grounded).toBe(true);
  expect(returned.paused).toBe(false);
  expect(returned.speed).toBeLessThan(0.1);
  expect(returned.quest).toBe(progress.quest);
  expect(returned.trust).toBe(progress.trust);
  const savedPosition = position(returned);
  await page.reload();
  await expect(page.locator('#loading')).toHaveCount(0, { timeout: 20_000 });
  await page.locator('#btnContinue').click();
  const resumed = await state(page);
  expect(resumed.quest).toBe(progress.quest);
  expect(resumed.trust).toBe(progress.trust);
  expect(resumed.grounded).toBe(true);
  expect(resumed.paused).toBe(false);
  expect(position(resumed).x).toBeCloseTo(savedPosition.x, 4);
  expect(position(resumed).z).toBeCloseTo(savedPosition.z, 4);
});

import { expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { test } from './fixtures.js';
import { finishCurrentChapter, meetAlex, openGame, skipTutorial, startChapterOne, state, teleport } from './helpers.js';
import { BrowserTouches } from './natural-route.helpers.js';

const EVIDENCE = 'tests/evidence/prairie-polish-02';
const mode = process.env.WILD_MUSTANG_SCENE_MODE || 'polish';
const prefix = mode === 'baseline' ? 'before' : 'after';
const enabled = process.env.WILD_MUSTANG_SCENE_VISUAL === '1';
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const viewAngle = snapshot => wrap(Math.atan2(snapshot.camera.position.x - snapshot.camera.look.x,
  snapshot.camera.position.z - snapshot.camera.look.z) - snapshot.heading - Math.PI);

async function orbit(page, offset) {
  // resetTo follows the hero again; every diagnostic pose needs its own real drag.
  const before = await state(page);
  const x = page.viewportSize().width * .61, y = page.viewportSize().height * .45;
  if (offset) {
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + offset / (.0055 * before.settings.camSens), y, { steps: 8 });
    await page.mouse.up();
  }
  const after = await state(page);
  expect(wrap(after.camera.yaw - before.camera.yaw), 'Real camera drag produces the requested angle').toBeCloseTo(offset, 2);
  // Assert the rendered camera, not only the commanded yaw: the lens lerps.
  await expect.poll(async () => Math.abs(wrap(viewAngle(await state(page)) - offset)),
    { timeout: 60_000, message: 'Displayed camera view settles at the requested angle' }).toBeLessThan(.06);
  return after.heading;
}

async function mediumQuality(page) {
  await page.locator('#btnPause').click();
  await page.locator('#btnSettings2').click();
  await page.locator('[data-q="1"]').click();
  await page.locator('#btnCloseSettings').click();
  await page.locator('#btnResume').click();
  expect((await state(page)).settings.quality).toBe(1);
}

async function provenance(page, baseURL) {
  const html = await (await page.request.get(baseURL)).text();
  const script = html.match(/src="([^"]+index-[^"]+\.js)"/)?.[1];
  expect(script, 'Served Vite entry exists').toBeTruthy();
  const entryURL = new URL(script, baseURL).href;
  const entry = await (await page.request.get(entryURL)).body();
  const game = entry.toString().match(/\.\/(game-[\w-]+\.js)/)?.[1];
  expect(game, 'Served dynamic game bundle exists').toBeTruthy();
  const gameURL = new URL(game, entryURL).href;
  const bytes = await (await page.request.get(gameURL)).body();
  return { entryURL, entrySha256: createHash('sha256').update(entry).digest('hex'),
    gameURL, gameSha256: createHash('sha256').update(bytes).digest('hex') };
}

async function measure(page, label) {
  // Let a real rendered frame follow the diagnostic positioning or UI action.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const snapshot = await state(page);
  expect(snapshot.render.calls, `${label}: scene renders`).toBeGreaterThan(10);
  expect(snapshot.render.triangles, `${label}: rigged world renders`).toBeGreaterThan(50_000);
  if (mode !== 'baseline') expect(snapshot.render.triangles, `${label}: medium-quality triangle budget`).toBeLessThanOrEqual(150_000);
  // Issue #14 specifies a triangle budget; retain actual calls and catch large
  // draw-call regressions without inventing a stricter acceptance threshold.
  expect(snapshot.render.calls, `${label}: broad draw-call regression guard`).toBeLessThanOrEqual(240);
  return { label, ...snapshot, upAlignment: snapshot.world ? dot(snapshot.world.heroUp, snapshot.world.terrainUp) : null,
    displayedCameraAngle: snapshot.camera ? viewAngle(snapshot) : null };
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${EVIDENCE}/${prefix}-${name}.png`, scale: 'css' });
}

test('Scene polish: three chapter scenery and visible family finale (scripted visual QA)', async ({ page, browserName, baseURL }, testInfo) => {
  test.skip(!enabled || browserName !== 'chromium' || !testInfo.project.use.hasTouch,
    'Explicit tablet visual run; diagnostic travel is separate from natural-route gameplay');
  test.setTimeout(900_000);
  await mkdir(EVIDENCE, { recursive: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const report = { method: 'Scripted chapter/pose visual comparison using existing localhost travel and cinematic diagnostics',
    naturalRoute: false, physicalIPad: false, independentChildNavigation: false, quality: 1,
    viewport: page.viewportSize(), browserVersion: page.context().browser().version(), began: new Date().toISOString(), frames: [] };
  try {
    await openGame(page);
    report.runtime = await provenance(page, baseURL);
    if (mode === 'baseline') {
      expect(process.env.WILD_MUSTANG_SCENE_BASELINE_URL, 'Before-labelled evidence requires an explicit Stage A URL').toBe(baseURL);
      expect(report.runtime.gameSha256, 'Before-labelled evidence must use the frozen Stage A game').toBe('95b3501f574fee74fc68eacf4a95669a7c2a87cd03f1aac1df1b035dd9a447e2');
    }
    await startChapterOne(page);
    await expect.poll(async () => (await state(page)).characters, { timeout: 60_000 }).toMatchObject({
      horse: 'rigged', foal: 'rigged', herd: 'rigged', alex: 'rigged', error: null,
    });
    await mediumQuality(page);
    report.frames.push(await measure(page, 'chapter-1-valley-spawn'));
    await screenshot(page, '01-valley');
    console.log(`First scene evidence: ${EVIDENCE}/${prefix}-01-valley.png`);
    await skipTutorial(page);
    await meetAlex(page);
    for (const chapter of [1, 2, 3]) {
      if (chapter > 1) {
        const pose = chapter === 2 ? [-55, 36] : [75, 26];
        await teleport(page, ...pose);
        if (mode !== 'baseline') await expect.poll(async () => {
          const s = await state(page); return dot(s.world.heroUp, s.world.terrainUp);
        }, { timeout: 60_000 }).toBeGreaterThan(.995);
        report.frames.push(await measure(page, `chapter-${chapter}-landmark`));
        await screenshot(page, chapter === 2 ? '02-willow-ford' : '03-pine-trail');
      }
      await finishCurrentChapter(page);
      await expect(page.locator('#finish')).toHaveCSS('opacity', '1');
      report.frames.push(await measure(page, `chapter-${chapter}-finish`));
      await screenshot(page, `chapter-${chapter}-finish`);
      if (chapter < 3) await page.locator('#btnNextChapter').click();
    }
    await expect(page.locator('#finish')).toContainText(/Мы дома/);
    const card = await page.locator('#finish .panel').boundingBox(), viewport = page.viewportSize();
    report.finish = await page.locator('#finish').evaluate(element => ({
      backdropFilter: getComputedStyle(element).backdropFilter,
      webkitBackdropFilter: getComputedStyle(element).webkitBackdropFilter,
      statisticsCollapsed: document.querySelector('#finishDetails') ? !document.querySelector('#finishDetails').open : null,
    }));
    report.finish.card = card;
    report.finish.coverage = card.width * card.height / (viewport.width * viewport.height);
    if (mode !== 'baseline') {
      expect(card.x, 'Family scene centre stays free of the finish card').toBeGreaterThan(viewport.width * .60);
      expect(report.finish.coverage, 'Finish card covers under one quarter of landscape').toBeLessThan(.25);
      expect(report.finish.backdropFilter || report.finish.webkitBackdropFilter).toBe('none');
      expect(report.finish.statisticsCollapsed).toBe(true);
      await page.locator('#finishDetails summary').click();
      await expect(page.locator('#finishDetails')).toHaveAttribute('open', '');
      await page.locator('#finishDetails summary').click();
    }
    await page.locator('#btnEpilogue').click();
    await expect.poll(async () => (await state(page)).phase).toBe('epilogue');
    await screenshot(page, 'family-epilogue');
    expect(errors).toEqual([]);
    report.result = 'passed';
  } catch (error) { report.result = 'failed'; report.failure = error.message; throw error; }
  finally {
    report.errors = errors; report.ended = new Date().toISOString();
    await writeFile(`${EVIDENCE}/${prefix}-scenes.json`, JSON.stringify(report, null, 2));
  }
});

test('Scene polish: real movement gaits and slope alignment at three camera angles', async ({ page, browserName, baseURL }, testInfo) => {
  test.skip(!enabled || mode === 'baseline' || browserName !== 'chromium' || !testInfo.project.use.hasTouch,
    'Explicit tablet visual gait run on the polished hero');
  test.setTimeout(900_000);
  await mkdir(EVIDENCE, { recursive: true });
  const errors = [], report = { method: 'QA position-only setup, real pointer camera drags, browser touch joystick and second camera contact; keyboard Shift for gallop',
    injectedInput: 0, physicalIPad: false, naturalRoute: false, quality: 1,
    viewport: page.viewportSize(), browserVersion: page.context().browser().version(), frames: [] };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const touches = await BrowserTouches.create(page);
  try {
    await openGame(page);
    report.runtime = await provenance(page, baseURL);
    await startChapterOne(page);
    await expect.poll(async () => (await state(page)).characters, { timeout: 60_000 }).toMatchObject({ horse: 'rigged', error: null });
    await mediumQuality(page);
    for (const angle of [0, 1, 2]) {
      const offset = angle * .99;
      await teleport(page, -64, -52);
      await expect.poll(async () => {
        const s = await state(page); return dot(s.world.heroUp, s.world.terrainUp);
      }, { timeout: 60_000 }).toBeGreaterThan(.998);
      await orbit(page, offset);
      const slope = await measure(page, `slope-angle-${angle}`);
      slope.relativeCameraAngle = wrap(slope.camera.yaw - slope.heading - Math.PI);
      expect(slope.relativeCameraAngle, 'Three distinct slope views').toBeCloseTo(offset, 2);
      report.frames.push(slope);
      await screenshot(page, `slope-angle-${angle}`);
      for (const gait of ['Walk', 'Trot', 'Gallop']) {
        await teleport(page, 35, 35);
        const heading = await orbit(page, offset);
        try {
          const joy = await page.locator('#joyBase').boundingBox();
          const x = page.viewportSize().width * .17, y = page.viewportSize().height * .8;
          const current = await state(page), relative = wrap(heading - current.camera.yaw - Math.PI);
          const magnitude = gait === 'Walk' ? .28 : .8, radius = joy.width * .45;
          // Keep a world direction while orbiting; forward-only input would turn
          // the hero toward each new camera and produce three identical rear views.
          await touches.down(1, x, y);
          await touches.move(1, x - Math.sin(relative) * magnitude * radius,
            y - Math.cos(relative) * magnitude * radius);
          const cameraX = page.viewportSize().width * .61, cameraY = page.viewportSize().height * .45;
          await touches.down(2, cameraX, cameraY);
          if (gait === 'Gallop') await page.keyboard.down('Shift');
          let nudge = 1;
          await expect.poll(async () => {
            // A real second finger keeps manual orbit active while the animation
            // accelerates; otherwise normal camera auto-follow erases side views.
            await touches.move(2, cameraX + nudge, cameraY); nudge *= -1;
            return (await state(page)).gaits[0];
          }, { timeout: 60_000 }).toBe(gait);
          const frame = await measure(page, `${gait}-angle-${angle}`);
          expect(frame.speed, `${gait} produces physical movement`).toBeGreaterThan(.2);
          expect(frame.upAlignment, `${gait} stays aligned to terrain`).toBeGreaterThan(.985);
          frame.relativeCameraAngle = wrap(frame.camera.yaw - frame.heading - Math.PI);
          expect(Math.abs(wrap(frame.relativeCameraAngle - offset)), `${gait}: requested camera angle remains visible`).toBeLessThan(.18);
          expect(Math.abs(wrap(frame.displayedCameraAngle - offset)), `${gait}: rendered camera angle remains distinct`).toBeLessThan(.18);
          report.frames.push(frame);
          await screenshot(page, `${gait.toLowerCase()}-angle-${angle}`);
        } finally {
          await touches.release(); await page.keyboard.up('Shift');
        }
      }
    }
    expect(errors).toEqual([]);
    report.result = 'passed';
  } catch (error) { report.result = 'failed'; report.failure = error.message; throw error; }
  finally { report.errors = errors; report.ended = new Date().toISOString();
    await writeFile(`${EVIDENCE}/after-gaits.json`, JSON.stringify(report, null, 2)); }
});

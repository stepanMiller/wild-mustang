import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { test } from './fixtures.js';
import { CHAPTERS } from '../src/story/chapters.js';
import { openGame, skipTutorial, startChapterOne, state } from './helpers.js';
import { BrowserTouches, followVisibleTrail, observeRoute, touchAction, touchGeometry, visibleDetour, walkTrailPoint } from './natural-route.helpers.js';

const evidenceDirectory = () => process.env.WILD_MUSTANG_EVIDENCE_DIR || 'tests/evidence/ipad-polish-01';

test('P1 browser multi-touch rotates camera while the joystick remains held', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || !testInfo.project.use.hasTouch, 'CDP multi-touch requires Chromium touch context');
  await openGame(page);
  await startChapterOne(page);
  const prefix = process.env.WILD_MUSTANG_EVIDENCE_PREFIX;
  if (prefix) {
    await mkdir(evidenceDirectory(), { recursive: true });
    await page.screenshot({ path: `${evidenceDirectory()}/${prefix}-camera-start.png`, scale: 'css' });
  }
  await skipTutorial(page);
  const touches = await BrowserTouches.create(page), geometry = await touchGeometry(page);
  const before = await observeRoute(page);
  try {
    await touches.down(1, geometry.x, geometry.y);
    await touches.move(1, geometry.x, geometry.y - geometry.radius * .4);
    await touches.down(2, geometry.cameraX, geometry.cameraY);
    // Verify the simultaneous touch actually reached the joystick handler.
    expect((await state(page)).inputs.y).toBeLessThan(-.2);
    const held = await observeRoute(page);
    await touches.move(2, geometry.cameraX + 100, geometry.cameraY - 30);
    await page.waitForTimeout(500);
    const after = await observeRoute(page);
    if (prefix) await page.screenshot({ path: `${evidenceDirectory()}/${prefix}-camera-two-fingers.png`, scale: 'css' });
    expect(Math.abs(after.yaw - held.yaw), 'Right touch must rotate while left joystick is active').toBeGreaterThan(.3);
    expect(after.current.inputs.y, 'Camera drag must retain held joystick input').toBeLessThan(-.2);
    if (after.current.camera) expect(after.current.camera.pitch).toBeGreaterThan(held.current.camera.pitch);
  } finally { await touches.release(); }
  await expect.poll(async () => (await state(page)).inputs).toMatchObject({ x: 0, y: 0, gallop: false });
  expect(before.current.chapter).toBe(1);
});

test('P1 browser touch cancellation and viewport rotation release held movement and gallop', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || !testInfo.project.use.hasTouch, 'CDP multi-touch requires Chromium touch context');
  await openGame(page);
  await startChapterOne(page);
  await skipTutorial(page);
  const touches = await BrowserTouches.create(page);
  const holdControls = async () => {
    const geometry = await touchGeometry(page), gallop = await page.locator('#btnGallop').boundingBox();
    await touches.down(1, geometry.x, geometry.y);
    await touches.move(1, geometry.x + geometry.radius * .5, geometry.y - geometry.radius * .5);
    await touches.down(2, gallop.x + gallop.width / 2, gallop.y + gallop.height / 2);
    expect((await state(page)).inputs).toMatchObject({ gallop: true });
    expect((await state(page)).inputs.x).toBeGreaterThan(.2);
  };
  try {
    await holdControls();
    await touches.release();
    await expect.poll(async () => (await state(page)).inputs).toMatchObject({ x: 0, y: 0, gallop: false });
    await holdControls();
    await page.setViewportSize({ width: 834, height: 1194 });
    await expect.poll(async () => (await state(page)).inputs).toMatchObject({ x: 0, y: 0, gallop: false });
    await page.setViewportSize({ width: 1194, height: 834 });
    await touches.release();
    await holdControls();
    await expect.poll(async () => (await state(page)).speed).toBeGreaterThan(.4);
  } finally { await touches.release(); }
  await expect.poll(async () => (await state(page)).inputs).toMatchObject({ x: 0, y: 0, gallop: false });
});

test('Natural route: real touch movement completes all three chapters, reload and epilogue', async ({ page, browserName }, testInfo) => {
  test.skip(process.env.WILD_MUSTANG_NATURAL_ROUTE !== '1', 'Run explicitly with WILD_MUSTANG_NATURAL_ROUTE=1; this is a full adventure without time shortcuts');
  test.skip(browserName !== 'chromium' || !testInfo.project.use.hasTouch, 'Native CDP touch driver requires Chromium tablet project');
  test.setTimeout(3_600_000);
  const errors = [], evidence = process.env.WILD_MUSTANG_EVIDENCE_PREFIX || 'after';
  const evidenceDir = evidenceDirectory(), storyTrace = process.env.WILD_MUSTANG_STORY_TRACE === '1';
  await mkdir(evidenceDir, { recursive: true });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const log = { driver: 'Chromium browser native multi-touch protocol', viewport: page.viewportSize(),
    browserVersion: page.context().browser().version(), route: 'Authored trail with visible obstacle detours',
    tutorial: 'Skipped through public UI; tutorial coverage remains in dedicated input tests',
    physicalIPad: false, independentChildNavigation: false, teleports: 0, injectedInput: 0,
    injectedCheckpoints: 0, acceleratedCinematics: 0, checkpoints: [], storyEvents: [],
    audioSession: 0, began: new Date().toISOString() };
  const capture = async name => page.screenshot({ path: `${evidenceDir}/${evidence}-${name}.png`, scale: 'css' });
  const trace = async (label, extra = {}) => {
    if (!storyTrace) return;
    const snapshot = await page.evaluate(() => ({ ...window.__WILD_MUSTANG_TEST__.snapshot(), ui: {
      dialogue: { who: document.querySelector('#dlgWho')?.textContent, text: document.querySelector('#dlgText')?.textContent,
        visible: document.querySelector('#dialog')?.classList.contains('on') },
      voiceCaption: { text: document.querySelector('#voiceCaption')?.textContent,
        visible: Boolean(document.querySelector('#voiceCaption') && !document.querySelector('#voiceCaption').hidden) },
    } }));
    log.storyEvents.push({ label, audioSession: log.audioSession, wallTime: new Date().toISOString(), ...extra, ...snapshot });
  };
  const reaction = async (effect, label) => {
    if (!storyTrace) return;
    const minimumElapsed = effect === 'pet-hero' ? 3.2 : effect === 'meadow-rest' ? 4.5 : 2.6;
    await trace(`reaction-${effect}-start`);
    await expect.poll(async () => (await state(page)).presentation?.effect, { timeout: 30_000 }).toBe(effect);
    // Stand naturally while friends react. No pause, forced movement or time shortcut.
    await expect.poll(async () => {
      const presentation = (await state(page)).presentation;
      return !presentation || presentation.effect !== effect || presentation.elapsed >= minimumElapsed;
    }, { timeout: 90_000 }).toBe(true);
    const presentation = (await state(page)).presentation;
    const observed = presentation?.effect === effect && presentation.elapsed >= minimumElapsed;
    await trace(`reaction-${effect}-${observed ? 'observed' : 'ended-before-observation'}`, {
      reactionDisposition: observed ? 'active-at-observation' : 'ended-or-cancelled-before-observation', minimumElapsed,
    });
    await capture(observed ? label : `${label}-ended`);
  };
  let touches;
  try {
    await openGame(page);
    await capture('00-menu');
    await startChapterOne(page);
    await capture('01-start');
    if (storyTrace) await expect(page.locator('#dlgText')).toHaveText(CHAPTERS[1].opening[0].text);
    await trace('chapter-1-opening');
    await page.locator('#btnPause').tap();
    await page.locator('#btnSettings2').tap();
    await page.locator('[data-q="0"]').tap();
    await page.locator('#btnCloseSettings').tap();
    await page.locator('#btnResume').tap();
    log.quality = (await state(page)).settings.quality;
    expect(log.quality, 'Low render quality selected with public settings for software-render throughput').toBe(0);
    await skipTutorial(page);
    await trace('tutorial-skipped');
    const obstacles = (await observeRoute(page)).objects.obstacles;
    expect(Array.isArray(obstacles), 'Read-only obstacle geometry required for walking automation').toBe(true);
    await writeFile(`${evidenceDir}/${evidence}-visible-obstacles.json`, JSON.stringify(obstacles, null, 2));
    const unsafeTerrain = await page.evaluate(() => {
      const cells = [], api = window.__WILD_MUSTANG_TEST__;
      for (let x = -105; x <= 105; x++) for (let z = -105; z <= 105; z++) {
        if (api.terrain(x, z) < .75) cells.push(`${x},${z}`);
      }
      return cells;
    });
    const unsafeCells = new Set(unsafeTerrain);
    await writeFile(`${evidenceDir}/${evidence}-water-cells.json`, JSON.stringify(unsafeTerrain));
    const terrainSafe = ([x, z]) => Math.abs(x) <= 105 && Math.abs(z) <= 105 && !unsafeCells.has(`${Math.round(x)},${Math.round(z)}`);
    log.navigationObservation = { minimumGroundHeight: .75, sampledCellSpacing: 1, unsafeCells: unsafeTerrain.length };
    // Validate the automation's walking paths before spending minutes on the
    // adventure. A failed planner is a harness diagnosis, never a game softlock.
    const planned = [], planningFailures = [];
    for (const definition of Object.values(CHAPTERS)) {
      let from = definition.route[0];
      for (let index = 1; index < definition.route.length; index++) {
        const to = definition.route[index];
        try {
          const path = visibleDetour(from, to, obstacles, terrainSafe);
          planned.push({ chapter: definition.id, from, to, path });
          from = path.at(-1);
        }
        catch (error) { planningFailures.push({ chapter: definition.id, from, to, error: error.message }); }
      }
    }
    await writeFile(`${evidenceDir}/${evidence}-driver-preflight.json`, JSON.stringify({ planned, planningFailures }, null, 2));
    if (planningFailures.length) throw new Error(`Route driver preflight could not plan: ${JSON.stringify(planningFailures)}`);
    touches = await BrowserTouches.create(page);
    touches.terrainSafe = terrainSafe;
    // Alex is approached through normal movement, with real trust accumulation.
    const alex = (await observeRoute(page)).objects.alex;
    await followVisibleTrail(page, touches, [alex.x + 1, alex.z]);
    await expect.poll(async () => (await state(page)).trust, { timeout: 120_000 }).toBeGreaterThanOrEqual(35);
    await touchAction(page, /яблоко из руки/);
    await expect.poll(async () => (await state(page)).phase).toBe('quests');
    await trace('alex-met');
    if (storyTrace) {
      await expect.poll(async () => (await state(page)).audio.context, { timeout: 45_000 }).toBe('running');
      await expect.poll(async () => (await state(page)).audio.cueStarts, { timeout: 45_000 }).toBeGreaterThan(0);
      await touchAction(page, 'Погладить Ветра');
      await reaction('pet-hero', 'reaction-pet-hero');
    }
    let reloaded = false;
    for (const chapter of [1, 2, 3]) {
      expect((await state(page)).chapter).toBe(chapter);
      if (chapter > 1) {
        if (storyTrace) await expect(page.locator('#dlgText')).toHaveText(CHAPTERS[chapter].opening[0].text);
        await capture(`chapter-${chapter}-start`);
        await trace(`chapter-${chapter}-opening`);
      }
      const definition = CHAPTERS[chapter];
      // Follow the visible authored trail, rather than cutting directly between
      // targets across water/rocks. Observation chooses only visible actions.
      for (const point of definition.route.slice(chapter === 1 ? 2 : 1)) {
        const beforePoint = await state(page);
        await followVisibleTrail(page, touches, point);
        let arrival = await observeRoute(page);
        // The real child can wait at the light stone while both friends finish
        // crossing. Leaving this zone early would be a driver error.
        if (arrival.quest?.id === 'willow-crossing' && Math.hypot(point[0] - 17, point[1] - 60) < .1) {
          await trace('ford-wait-on-east-bank');
          const crossingQuest = arrival.current.quest;
          await expect.poll(async () => (await state(page)).quest,
            { timeout: 90_000, message: 'Both friends cross naturally while the hero waits at the light stone' }).not.toBe(crossingQuest);
          arrival = await observeRoute(page);
        }
        if (arrival.current.quest !== beforePoint.quest) {
          await trace('zone-objective-completed', { previousQuest: definition.quests[beforePoint.quest]?.id, point });
          if (definition.quests[beforePoint.quest]?.id === 'willow-crossing') {
            log.fordCrossing = await page.evaluate(() => {
              const api = window.__WILD_MUSTANG_TEST__, s = api.snapshot();
              const actors = Object.fromEntries(['foal', 'alex'].map(id => {
                const p = s.companions[id], z = p.z;
                // Fixed authored river geography, independent of quest flags.
                const eastBankX = -18 + Math.sin(z * .035) * 16 + Math.cos(z * .012) * 8
                  + Math.sin(z * .082 + 1.1) * 4.5 + 5.2 + Math.sin(z * .045 + .7) * 1.1 + Math.cos(z * .018) * .9;
                return [id, { ...p, groundHeight: api.terrain(p.x, p.z), eastBankX, eastBankClearance: p.x - eastBankX }];
              }));
              return { hero: s.position, actors, quest: s.quest, presentation: s.presentation };
            });
            for (const actor of Object.values(log.fordCrossing.actors)) {
              expect(actor.eastBankClearance, 'Friend visibly reached the authored east bank').toBeGreaterThanOrEqual(.59);
              expect(actor.groundHeight, 'Friend stands on dry terrain beyond the ford').toBeGreaterThanOrEqual(1.25);
            }
            await capture('friends-crossed-ford');
          }
        }
        for (let repeat = 0; repeat < 4; repeat++) {
          const { current, quest } = await observeRoute(page);
          console.log(`Natural route chapter=${chapter} point=${point} quest=${current.quest} action=${current.action || '-'} position=${current.position.x.toFixed(1)},${current.position.z.toFixed(1)}`);
          if (current.phase !== 'quests') break;
          const expected = quest.kind === 'apples' ? 'Взять яблоко' : quest.kind === 'interact' ? quest.label : null;
          if (!expected || current.action !== expected) break;
          const originalQuest = current.quest, originalApples = current.apples, originalRescue = current.freeProgress,
            originalSteps = current.questSteps, originalPhase = current.phase;
          await touchAction(page, expected);
          await expect.poll(async () => {
            const { current: s } = await observeRoute(page);
            return s.quest !== originalQuest || s.phase !== originalPhase || s.apples !== originalApples ||
              s.freeProgress !== originalRescue || s.questSteps !== originalSteps;
          }).toBe(true);
          await expect(page.locator('#btnAct')).toBeEnabled({ timeout: 90_000 });
          await trace('public-objective-action', { questId: quest.id, effect: quest.effect, action: expected });
          if (storyTrace && (await state(page)).presentation?.effect === quest.effect
            && ['foal-freed', 'meadow-rest', 'mountain-obstacle'].includes(quest.effect)) {
            await reaction(quest.effect, `reaction-${quest.effect}`);
          }
          if (chapter === 1 && !reloaded && (await state(page)).quest === 1) {
            await capture('02-first-goal');
            // Saving comes from public pause/menu controls, never a test hook.
            await page.locator('#btnPause').tap();
            const saved = await state(page);
            await trace('public-pause-save');
            await touches.release();
            await touches.session.detach();
            await page.reload();
            await expect(page.locator('#loading')).toHaveCount(0, { timeout: 30_000 });
            await page.locator('#btnContinue').tap();
            const loaded = await state(page);
            log.audioSession++;
            expect(loaded.quest).toBe(saved.quest);
            expect(loaded.position.x).toBeCloseTo(saved.position.x, 3);
            expect(loaded.position.z).toBeCloseTo(saved.position.z, 3);
            expect(loaded.apples).toBe(saved.apples);
            expect(loaded.freeProgress).toBe(saved.freeProgress);
            expect(loaded.chapter).toBe(saved.chapter);
            expect(loaded.phase).toBe(saved.phase);
            expect(loaded.trust).toBeCloseTo(saved.trust, 3);
            for (const id of ['#pause', '#map', '#log', '#settings']) await expect(page.locator(id)).not.toHaveClass(/on/);
            await capture('03-reload-continue');
            await trace('public-reload-continue');
            touches = await BrowserTouches.create(page);
            touches.terrainSafe = terrainSafe;
            reloaded = true;
          }
        }
        log.checkpoints.push({ chapter, point, ...await state(page), wallTime: new Date().toISOString() });
      }
      await expect.poll(async () => (await state(page)).phase, { timeout: 90_000 }).toMatch(/cine|done/);
      await capture(`chapter-${chapter}-cinematic`);
      await trace(`chapter-${chapter}-cinematic-start`);
      // Wait for the production animation/text sequence in real simulation time.
      await expect.poll(async () => (await state(page)).phase, { timeout: 600_000 }).toBe('done');
      expect((await state(page)).completedChapters).toContain(chapter);
      await capture(`chapter-${chapter}-complete`);
      await trace(`chapter-${chapter}-completed`);
      if (chapter < 3) await page.locator('#btnNextChapter').tap();
    }
    expect(reloaded, 'First objective included a save/reload/Continue').toBe(true);
    await expect(page.locator('#finish')).toContainText(/Мы дома/);
    expect((await state(page)).completedChapters).toEqual([1, 2, 3]);
    await page.locator('#btnEpilogue').tap();
    await expect.poll(async () => (await state(page)).phase).toBe('epilogue');
    // The read-only camera observation supports touch movement even after the
    // objective arrow is hidden in epilogue.
    const home = (await state(page)).position;
    await walkTrailPoint(page, touches, [home.x - 3, home.z + 4], { tolerance: 1 });
    const epiloguePosition = (await state(page)).position;
    expect(Math.hypot(epiloguePosition.x - home.x, epiloguePosition.z - home.z)).toBeGreaterThan(.4);
    await capture('epilogue');
    await trace('epilogue-touch-movement');
    if (storyTrace) {
      const audio = (await state(page)).audio;
      expect(audio.context).toBe('running');
      expect(audio.cueStarts).toBeGreaterThan(0);
      expect(audio.effectStarts).toBeGreaterThan(0);
      expect(audio.unavailable).toEqual([]);
    }
    expect(errors).toEqual([]);
    log.result = 'passed';
  } catch (error) {
    log.result = 'failed'; log.failure = error.message;
    log.lastObservedState = await observeRoute(page).catch(() => null);
    await capture('failure').catch(() => {});
    throw error;
  } finally {
    await touches?.release().catch(() => {});
    log.errors = errors; log.ended = new Date().toISOString();
    await writeFile(`${evidenceDir}/${evidence}-natural-route.json`, JSON.stringify(log, null, 2));
  }
});

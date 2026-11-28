import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { test } from './fixtures.js';
import { openGame, state } from './helpers.js';
import { BrowserTouches, walkTrailPoint, touchAction } from './natural-route.helpers.js';
import { RESCUE_LAYOUT } from '../src/adventures/rescue-state.js';

test('Herd adventure is walkable with browser touch from the camp to freedom', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || !testInfo.project.use.hasTouch, 'Real browser multi-touch uses the Chromium input protocol');
  test.setTimeout(240_000);
  // An existing completed story is the public unlock condition. No bonus state,
  // position or progress is injected after launching the new adventure.
  await page.addInitScript(() => localStorage.setItem('veter-save', JSON.stringify({
    version: 2, completedChapters: [1, 2, 3], settings: { quality: 0, music: 0, sfx: 0, voice: false },
    checkpoint: { chapter: 3, x: 86, z: -78, heading: Math.PI, quest: 5, trust: 90,
      apples: 0, taken: [true, true, true], phase: 'epilogue', foalFreed: true, alexFollows: true },
  })));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openGame(page);
  await page.locator('#btnRescueStart').tap();
  await expect.poll(async () => (await state(page)).phase).toBe('rescue');

  const touches = await BrowserTouches.create(page);
  let recorder, frameWork = Promise.resolve();
  const frames = [], evidence = [];
  if (process.env.WILD_MUSTANG_RECORD_RESCUE === '1') {
    const folder = testInfo.outputPath('recording');
    await mkdir(folder, { recursive: true });
    recorder = await page.context().newCDPSession(page);
    recorder.on('Page.screencastFrame', frame => {
      recorder.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
      const time = frame.metadata.timestamp;
      if (frames.length && time - frames.at(-1).time < .16) return;
      const file = `frame-${String(frames.length).padStart(5, '0')}.jpg`;
      frames.push({ file, time });
      frameWork = frameWork.then(() => writeFile(`${folder}/${file}`, Buffer.from(frame.data, 'base64')));
    });
    await recorder.send('Page.startScreencast', { format: 'jpeg', quality: 70,
      maxWidth: 1194, maxHeight: 834, everyNthFrame: 2 });
  }
  const capture = async name => {
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), scale: 'css' });
    evidence.push({ name, snapshot: await state(page) });
  };
  try {
    await walkTrailPoint(page, touches, RESCUE_LAYOUT.watch, { tolerance: 2, timeout: 30_000 });
    await expect.poll(async () => (await state(page)).rescue.horses.some(h => h.state === 'caught'),
      { timeout: 45_000, intervals: [200, 500] }).toBe(true);
    await capture('touch-visible-capture');
    await expect.poll(async () => (await state(page)).rescue.stage, { timeout: 70_000 }).toBe('captive');
    // Stop just outside the physical closed gate, inside the interaction radius.
    // This exercises movement collision instead of teleporting into the gate.
    await walkTrailPoint(page, touches, [61, 20.2], { tolerance: .22, timeout: 45_000 });
    await capture('touch-closed-corral');
    await touchAction(page, 'Открыть загон');
    await expect.poll(async () => (await state(page)).rescue.stage).toBe('escape');
    await capture('touch-open-gate');
    for (const [index, point] of RESCUE_LAYOUT.escape.entries()) {
      // Follow the actual clear trail with normal touch movement. A horse need
      // not circle a waypoint to land within centimetres of its exact centre.
      // The meadow completes and pauses the episode before reaching its centre.
      await walkTrailPoint(page, touches, point,
        { tolerance: index === RESCUE_LAYOUT.escape.length - 1 ? 3 : 2, timeout: 35_000 });
    }
    await expect.poll(async () => (await state(page)).rescue.stage, { timeout: 35_000 }).toBe('complete');
    await expect(page.locator('#rescueFinish')).toHaveClass(/on/);
    const complete = await state(page);
    expect(complete.completedChapters).toEqual([1, 2, 3]);
    expect(complete.rescue.horses.every(h => h.state === 'safe')).toBe(true);
    await capture('touch-free-herd');
    expect(errors).toEqual([]);
  } finally {
    await touches.release();
    if (recorder) { await recorder.send('Page.stopScreencast'); await frameWork;
      await writeFile(testInfo.outputPath('recording/frames.json'), JSON.stringify(frames)); }
    await writeFile(testInfo.outputPath('natural-rescue-route.json'), JSON.stringify({ errors, evidence }, null, 2));
  }
});

import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test } from './fixtures.js';
import { finishCurrentChapter, meetAlex, openGame, skipTutorial, startChapterOne, state } from './helpers.js';

// This captures visual comparison frames from the untouched release using the
// older deterministic diagnostics. It is explicitly separate from the natural
// route evidence and cannot establish navigation or cinematic timing.
test('Scripted baseline screenshot comparison (teleport diagnostics, not natural route)', async ({ page, browserName, baseURL }, testInfo) => {
  test.skip(process.env.WILD_MUSTANG_SCRIPTED_BASELINE !== '1', 'Optional baseline screenshot capture only');
  test.skip(browserName !== 'chromium' || !testInfo.project.use.hasTouch, 'Capture matching Chromium tablet frames once');
  test.setTimeout(600_000);
  const explicitURL = process.env.WILD_MUSTANG_BASELINE_URL;
  expect(explicitURL, 'Explicit untouched baseline URL required before labelling screenshots').toBeTruthy();
  expect(baseURL, 'Configured server must match the explicitly requested baseline').toBe(explicitURL);
  const knownUntouchedAssets = {
    'assets/index-nID7_dDJ.js': '74887082ad606538025b6d0b9fbf9d03d088e5fce7aab49e5674969703aa8597',
    'assets/game-Cbn5Hv0z.js': '3ff9cdae3c0ff39454266af7b962dee748565e28824c8129731f44a398831aee',
  };
  for (const [asset, expectedHash] of Object.entries(knownUntouchedAssets)) {
    const response = await page.request.get(new URL(asset, explicitURL).href);
    expect(response.ok(), `Untouched baseline asset ${asset}`).toBe(true);
    const sha256 = createHash('sha256').update(await response.body()).digest('hex');
    expect(sha256, `Known untouched baseline SHA-256: ${asset}`).toBe(expectedHash);
  }
  const directory = 'tests/evidence/ipad-polish-01';
  await mkdir(directory, { recursive: true });
  const capture = async name => page.screenshot({ path: `${directory}/before-scripted-${name}.png`, scale: 'css' });
  await openGame(page);
  await startChapterOne(page);
  await skipTutorial(page);
  await meetAlex(page);
  for (const chapter of [1, 2, 3]) {
    await finishCurrentChapter(page);
    await capture(`chapter-${chapter}-complete`);
    expect((await state(page)).completedChapters).toContain(chapter);
    if (chapter < 3) {
      await page.locator('#btnNextChapter').tap();
      await capture(`chapter-${chapter + 1}-start`);
    }
  }
  await page.locator('#btnEpilogue').tap();
  await capture('epilogue');
  await writeFile(`${directory}/before-scripted-method.json`, JSON.stringify({
    method: 'Existing localhost QA teleportation and cinematic fast-forward',
    purpose: 'Untouched visual screenshot comparison only',
    naturalRoute: false, physicalIPad: false, independentChildNavigation: false,
    browserVersion: page.context().browser().version(), viewport: page.viewportSize(),
    verifiedUntouchedAssets: knownUntouchedAssets, baselineURL: explicitURL,
    finalState: await state(page),
  }, null, 2));
});

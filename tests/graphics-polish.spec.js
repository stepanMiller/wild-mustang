import { expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from './fixtures.js';

const enabled = process.env.WILD_MUSTANG_GRAPHICS_VISUAL === '1';
const folder = process.env.WILD_MUSTANG_GRAPHICS_EVIDENCE_DIR || 'tests/evidence/graphics-polish-04';
const prefix = process.env.WILD_MUSTANG_GRAPHICS_PREFIX || 'before';
const targetURL = process.env.WILD_MUSTANG_GRAPHICS_URL;
const expectedGameHash = process.env.WILD_MUSTANG_GRAPHICS_GAME_SHA256;
const sourceManifest = process.env.WILD_MUSTANG_GRAPHICS_SOURCE_MANIFEST;
const sourceCommit = process.env.WILD_MUSTANG_GRAPHICS_SOURCE_COMMIT;
const frozenDist = process.env.WILD_MUSTANG_GRAPHICS_DIST;
const checkBudget = process.env.WILD_MUSTANG_GRAPHICS_CHECK_BUDGET === '1';
const comparePath = process.env.WILD_MUSTANG_GRAPHICS_COMPARE;
const poseSet = process.env.WILD_MUSTANG_GRAPHICS_POSES || 'core';
const poseIDs = process.env.WILD_MUSTANG_GRAPHICS_POSE_IDS?.split(',').filter(Boolean) || [];
const SEED = 0x47524134;
const STEP = 1 / 30;
const SETTLE_FRAMES = 6;
const SAMPLE_FRAMES = 8;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const corePoses = [
  { id: '01-start', chapter: 1, quest: 0, x: 20, z: 24, heading: Math.PI, phase: 'tutorial' },
  { id: '02-ford', chapter: 2, quest: 2, x: -14, z: 60, heading: Math.PI / 2, phase: 'quests' },
  { id: '03-clearing', chapter: 2, quest: 4, x: 27, z: 75, heading: Math.PI / 2, phase: 'quests' },
  { id: '04-ascent', chapter: 3, quest: 1, x: 75, z: 26, heading: Math.PI, phase: 'quests' },
  { id: '05-family', chapter: 3, quest: 5, x: 97, z: -94, heading: Math.atan2(11, -16), phase: 'epilogue' },
];
const availablePoses = poseSet === 'water'
  ? [{ id: '06-water-bank', chapter: 2, quest: 2, x: -8, z: 48, heading: Math.PI / 2, phase: 'quests' }]
  : poseSet === 'river'
    ? [{ id: '07-river-look', chapter: 1, quest: 0, x: -3, z: 48, heading: 0, phase: 'tutorial' }]
    : corePoses;
const poses = poseIDs.length ? availablePoses.filter(pose => poseIDs.includes(pose.id)) : availablePoses;

function saveFor(pose) {
  return { version: 2, completedChapters: pose.phase === 'epilogue' ? [1, 2, 3] : pose.chapter === 1 ? [] : pose.chapter === 2 ? [1] : [1, 2],
    settings: { quality: 1, voice: false, music: 0, sfx: 0 }, checkpoint: {
      chapter: pose.chapter, x: pose.x, z: pose.z, heading: pose.heading, quest: pose.quest,
      phase: pose.phase, trust: pose.chapter === 1 ? 0 : 80, apples: 0,
      taken: pose.chapter === 1 ? [false, false, false] : [true, true, true],
      alexFollows: pose.chapter > 1, foalFreed: pose.chapter > 1,
      freeProgress: 0, questSteps: 0, tutStep: 0, playTime: 0,
    } };
}

async function filesUnder(directory, prefixPath = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefixPath, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path.join(directory, entry.name), relative));
    else if (!relative.endsWith('.map')) files.push(relative);
  }
  return files.sort();
}

async function provenance(request) {
  const sourceBytes = await readFile(sourceManifest);
  const source = JSON.parse(sourceBytes);
  expect(source.commit, 'Archived source commit is explicit').toBe(sourceCommit);
  const assets = [];
  for (const relative of await filesUnder(frozenDist)) {
    const bytes = await readFile(path.join(frozenDist, relative));
    const response = await request.get(new URL(relative, targetURL).href);
    expect(response.ok(), `${relative}: frozen asset is served`).toBe(true);
    const served = await response.body();
    expect(hash(served), `${relative}: HTTP bytes match frozen build`).toBe(hash(bytes));
    assets.push({ path: relative, bytes: bytes.length, sha256: hash(bytes) });
  }
  const entryPath = assets.find(asset => /^assets\/index-.*\.js$/.test(asset.path))?.path;
  const game = assets.find(asset => /^assets\/game-.*\.js$/.test(asset.path));
  const threePath = assets.find(asset => /^assets\/three-.*\.js$/.test(asset.path))?.path;
  expect(entryPath, 'Vite entry exists').toBeTruthy();
  expect(threePath, 'Local Three chunk exists').toBeTruthy();
  expect(game?.sha256, 'Explicit expected game hash prevents mislabeled comparisons').toBe(expectedGameHash);
  const sourceFiles = Object.fromEntries(Object.entries(source.files).filter(([name]) =>
    name === 'index.html' || name.startsWith('src/') || name === 'package-lock.json' || name === 'vite.config.js'));
  return { sourceCommit, runtimeSourceCommit: source.runtimeSourceCommit || sourceCommit,
    contentIdenticalParent: process.env.WILD_MUSTANG_GRAPHICS_CONTENT_PARENT || null,
    sourceManifest, sourceManifestSha256: hash(sourceBytes), sourceArchiveSha256: source.archiveSha256,
    sourceFiles, frozenDist, url: targetURL, assets, gameSha256: game.sha256,
    threeURL: new URL(threePath, targetURL).href };
}

// Only this opt-in visual diagnostic changes the clock. Until models load, game
// time stays zero. Thereafter only an explicit number of real rendered frames
// receives a fixed delta. Browser timers/RAF and the performance sampler are real.
async function installFixture(page, pose, threeURL) {
  await page.addInitScript(({ save, seed }) => {
    localStorage.setItem('veter-save', JSON.stringify(save));
    let randomState = seed >>> 0;
    Math.random = () => {
      randomState += 0x6D2B79F5;
      let value = Math.imul(randomState ^ randomState >>> 15, 1 | randomState);
      value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
    const nativeNow = performance.now.bind(performance);
    Object.defineProperty(performance, 'now', { configurable: true, value: () => 0 });
    window.__GRAPHICS_POLISH_QA__ = { nativeNow, budget: 0, steps: 0 };
  }, { save: saveFor(pose), seed: SEED });
  await page.goto(new URL('?qa=1', targetURL).href);
  await page.evaluate(async ({ threeURL, delta }) => {
    const module = await import(threeURL);
    const THREE = Object.values(module).find(value => value?.WebGLRenderer && value?.Clock);
    if (!THREE) throw new Error('Served Three namespace not found');
    const fixture = window.__GRAPHICS_POLISH_QA__;
    THREE.Clock.prototype.getDelta = function () {
      if (fixture.budget <= 0) return 0;
      fixture.budget--; fixture.steps++; return delta;
    };
    Object.defineProperty(performance, 'now', { configurable: true, value: fixture.nativeNow });
  }, { threeURL, delta: STEP });
  await expect(page.locator('#loading')).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => window.__WILD_MUSTANG_TEST__?.snapshot().characters),
    { timeout: 60_000 }).toMatchObject({ horse: 'rigged', foal: 'rigged', herd: 'rigged', alex: 'rigged', error: null });
  // Scripted public Continue handler; these are visual fixtures, not touch tests.
  await page.locator('#btnContinue').evaluate(button => button.click());
}

async function stepFrames(page, frames) {
  await page.evaluate(count => { window.__GRAPHICS_POLISH_QA__.budget = count; }, frames);
  const began = Date.now();
  await expect.poll(async () => {
    const status = await page.evaluate(() => {
      const fixture = window.__GRAPHICS_POLISH_QA__;
      return { budget: fixture.budget, steps: fixture.steps, state: window.__WILD_MUSTANG_TEST__.snapshot().phase };
    });
    console.log(`Graphics stepping: ${JSON.stringify(status)} (${Math.round((Date.now() - began) / 1000)} real seconds)`);
    return status.budget;
  }, { timeout: 240_000, intervals: [1000, 5000, 10000] }).toBe(0);
}

async function inspectRenderer(page, threeURL) {
  const cdp = await page.context().newCDPSession(page);
  const prototype = await cdp.send('Runtime.evaluate', {
    expression: `import(${JSON.stringify(threeURL)}).then(module => Object.values(module).find(value => value?.WebGLRenderer)?.WebGLRenderer.prototype)`,
    awaitPromise: true, objectGroup: 'graphics-polish-readonly',
  });
  expect(prototype.exceptionDetails, 'Read-only renderer prototype is available').toBeUndefined();
  const queried = await cdp.send('Runtime.queryObjects', { prototypeObjectId: prototype.result.objectId,
    objectGroup: 'graphics-polish-readonly' });
  const read = async () => {
    const result = await cdp.send('Runtime.callFunctionOn', { objectId: queried.objects.objectId,
      functionDeclaration: `function () {
        const matches = this.filter(renderer => renderer.domElement === document.querySelector('#scene'));
        if (matches.length !== 1) throw new Error('Expected exactly one existing scene renderer; got ' + matches.length);
        const renderer = matches[0], gl = renderer.getContext();
        const extension = gl.getExtension('WEBGL_debug_renderer_info');
        return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
          frame: renderer.info.render.frame, programs: renderer.info.programs.length,
          textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries,
          pixelRatio: renderer.getPixelRatio(), buffer: { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight },
          outputEncoding: renderer.outputEncoding, toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure,
          glRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          glVendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR) };
      }`, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  return { read, close: () => cdp.detach() };
}

async function nativeFrameTimes(page) {
  return page.evaluate(async ({ warmup, samples }) => {
    const now = window.__GRAPHICS_POLISH_QA__.nativeNow;
    const intervals = [], callbackTimes = [];
    let previous, previousNow;
    await new Promise(resolve => {
      let count = 0;
      function sample(timestamp) {
        const actual = now();
        if (count > warmup) { intervals.push(timestamp - previous); callbackTimes.push(actual - previousNow); }
        previous = timestamp; previousNow = actual;
        if (++count > warmup + samples) resolve(); else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    return { rafIntervalsMs: intervals, nativeCallbackIntervalsMs: callbackTimes };
  }, { warmup: 2, samples: SAMPLE_FRAMES });
}

function statistics(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { count: values.length, medianMs: median,
    p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], meanMs: values.reduce((sum, value) => sum + value, 0) / values.length,
    minMs: sorted[0], maxMs: sorted.at(-1) };
}

test('Graphics polish: matched medium iPad frames and native software-renderer timing (scripted)', async ({ context, browserName }, testInfo) => {
  test.skip(!enabled || browserName !== 'chromium' || !testInfo.project.use.hasTouch,
    'Opt-in matched visual fixtures; separate from natural-route and physical iPad QA');
  test.setTimeout(600_000);
  expect(prefix).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  expect(['core', 'water', 'river']).toContain(poseSet);
  expect(poses.length, 'Explicit pose filter must select an existing fixture').toBeGreaterThan(0);
  expect(poseIDs.every(id => availablePoses.some(pose => pose.id === id)), 'Explicit pose IDs must be known').toBe(true);
  expect(targetURL, 'Explicit local frozen URL required').toBeTruthy();
  expect(['127.0.0.1', 'localhost']).toContain(new URL(targetURL).hostname);
  expect(expectedGameHash).toMatch(/^[a-f0-9]{64}$/);
  expect(sourceCommit).toMatch(/^[a-f0-9]{40}$/);
  expect(sourceManifest, 'Explicit source provenance required').toBeTruthy();
  expect(frozenDist, 'Explicit immutable dist directory required').toBeTruthy();
  await mkdir(folder, { recursive: true });
  const reportPath = path.join(folder, `${prefix}-report.json`);
  for (const name of [`${prefix}-report.json`, ...poses.map(pose => `${prefix}-${pose.id}.png`)]) {
    let exists = true; try { await access(path.join(folder, name)); } catch { exists = false; }
    expect(exists, `Refusing to overwrite evidence ${name}; use a new explicit prefix`).toBe(false);
  }
  const report = { method: 'Scripted V2 Continue fixtures, seeded random, fixed 1/30 game delta for explicit frames; no shipping edits',
    timingMethod: 'Real native RAF and monotonic-clock intervals while game simulation delta is zero; software GPU comparison only',
    medianDefinition: 'Arithmetic mean of the two central samples when sample count is even',
    limitations: ['No physical iPad FPS or child play claim', 'Seed is repeatable per build; new Three UUID allocations can shift later random placement',
      'Resource values are allocated counts, not GPU memory bytes', 'No narrative or natural-route validation in this visual test',
      'Family frame is a scripted valid completed epilogue save, not a captured natural reunion',
      'Low sample count: eight frames per pose; timing is exploratory and excludes active animation/physics CPU'],
    prefix, poseSet, poseIDs, checkBudget, comparePath: comparePath || null, seed: SEED, fixedDelta: STEP, settleFrames: SETTLE_FRAMES, sampleFrames: SAMPLE_FRAMES,
    launchOptions: testInfo.project.use.launchOptions || {},
    quality: 1, browserVersion: context.browser().version(), began: new Date().toISOString(), frames: [], errors: [] };
  let reportWritten = false;
  const saveReport = async () => {
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: reportWritten ? 'w' : 'wx' });
    reportWritten = true;
  };
  try {
    const comparison = comparePath ? JSON.parse(await readFile(comparePath, 'utf8')) : null;
    if (checkBudget) expect(comparison, 'Candidate budget run requires a matched baseline report').toBeTruthy();
    if (comparison) {
      expect(comparison.result).toBe('passed');
      expect(comparison.browserVersion).toBe(report.browserVersion);
      expect(comparison.launchOptions).toEqual(report.launchOptions);
      expect(comparison.seed).toBe(SEED);
      expect(comparison.fixedDelta).toBe(STEP);
      expect(comparison.settleFrames).toBe(SETTLE_FRAMES);
      expect(comparison.sampleFrames).toBe(SAMPLE_FRAMES);
    }
    console.log(`Graphics ${prefix}: validating frozen HTTP/source provenance`);
    report.provenance = await provenance(context.request);
    for (const pose of poses) {
      console.log(`Graphics ${prefix} ${pose.id}: loading scripted fixture`);
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push({ pose: pose.id, type: 'pageerror', message: error.message }));
      page.on('console', message => { if (message.type() === 'error') report.errors.push({ pose: pose.id, type: 'console', message: message.text() }); });
      let inspector;
      try {
        await installFixture(page, pose, report.provenance.threeURL);
        console.log(`Graphics ${prefix} ${pose.id}: stepping ${SETTLE_FRAMES} deterministic frames`);
        expect(page.viewportSize()).toEqual({ width: 1194, height: 834 });
        await stepFrames(page, SETTLE_FRAMES);
        const snapshot = await page.evaluate(() => window.__WILD_MUSTANG_TEST__.snapshot());
        expect(snapshot.chapter).toBe(pose.chapter);
        expect(snapshot.phase).toBe(pose.phase);
        expect(snapshot.settings.quality).toBe(1);
        expect(snapshot.inputs).toMatchObject({ x: 0, y: 0, gallop: false, jump: false });
        expect(snapshot.position.x).toBeCloseTo(pose.x, 6);
        expect(snapshot.position.z).toBeCloseTo(pose.z, 6);
        expect(snapshot.heading).toBeCloseTo(pose.heading, 6);
        await page.screenshot({ path: path.join(folder, `${prefix}-${pose.id}.png`), scale: 'css' });
        console.log(`Graphics evidence ready: ${path.join(folder, `${prefix}-${pose.id}.png`)}`);
        inspector = await inspectRenderer(page, report.provenance.threeURL);
        console.log(`Graphics ${prefix} ${pose.id}: renderer inspector ready`);
        const renderBefore = await inspector.read();
        const timings = await nativeFrameTimes(page);
        const render = await inspector.read();
        expect(render.frame - renderBefore.frame, 'Sampler observes genuinely rendered browser frames').toBeGreaterThanOrEqual(SAMPLE_FRAMES);
        expect(render.calls).toBeGreaterThan(20);
        expect(render.triangles).toBeGreaterThan(50_000);
        if (checkBudget) {
          expect(render.calls, `${pose.id}: candidate draw-call budget`).toBeLessThanOrEqual(240);
          expect(render.triangles, `${pose.id}: candidate medium triangle budget`).toBeLessThanOrEqual(150_000);
        }
        const steps = await page.evaluate(() => window.__GRAPHICS_POLISH_QA__.steps);
        const frame = { id: pose.id, fixture: pose, snapshot, viewport: page.viewportSize(),
          devicePixelRatio: await page.evaluate(() => devicePixelRatio), simulationSteps: steps, simulationSeconds: steps * STEP,
          render, timings: { ...timings, raf: statistics(timings.rafIntervalsMs), native: statistics(timings.nativeCallbackIntervalsMs) } };
        report.frames.push(frame);
        if (comparison) {
          const baseline = comparison.frames.find(value => value.id === pose.id);
          expect(baseline.fixture).toEqual(pose);
          expect(frame.viewport).toEqual(baseline.viewport);
          expect(frame.devicePixelRatio).toBe(baseline.devicePixelRatio);
          expect(frame.render.pixelRatio).toBe(baseline.render.pixelRatio);
          expect(frame.render.buffer).toEqual(baseline.render.buffer);
          expect(frame.simulationSteps).toBe(baseline.simulationSteps);
          for (const name of ['yaw', 'pitch', 'dist']) expect(snapshot.camera[name], `${pose.id}: matched camera ${name}`).toBeCloseTo(baseline.snapshot.camera[name], 4);
          for (const vector of ['position', 'look']) for (const axis of ['x', 'y', 'z'])
            expect(snapshot.camera[vector][axis], `${pose.id}: matched camera ${vector}.${axis}`).toBeCloseTo(baseline.snapshot.camera[vector][axis], 3);
          frame.comparison = { callsChangePercent: (render.calls / baseline.render.calls - 1) * 100,
            trianglesChangePercent: (render.triangles / baseline.render.triangles - 1) * 100,
            // Recompute older baseline statistics from raw intervals as well.
            nativeMedianChangePercent: (frame.timings.native.medianMs / statistics(baseline.timings.nativeCallbackIntervalsMs).medianMs - 1) * 100 };
        }
        report.result = 'capturing';
        await saveReport();
        console.log(`Graphics ${prefix} ${pose.id}: ${render.calls} calls, ${render.triangles} triangles, ${render.programs} programs, ${render.textures} textures, ${render.geometries} geometries; native median ${frame.timings.native.medianMs.toFixed(2)} ms`);
      } finally { if (inspector) await inspector.close(); await page.close(); }
    }
    expect(report.errors).toEqual([]);
    report.result = 'passed';
  } catch (error) { report.result = 'failed'; report.failure = error.message; throw error; }
  finally { report.ended = new Date().toISOString(); await saveReport(); }
});

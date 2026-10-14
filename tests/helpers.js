import { expect } from '@playwright/test';

export const HOOK = '__WILD_MUSTANG_TEST__';

export async function state(page) {
  return page.evaluate(() => window.__WILD_MUSTANG_TEST__.snapshot());
}

export async function openGame(page, { save } = {}) {
  if (save !== undefined) {
    await page.addInitScript(value => localStorage.setItem('veter-save', value), save);
  }
  await page.goto('?qa=1');
  await expect(page.locator('#loading')).toHaveCount(0, { timeout: 20_000 });
  await page.waitForFunction(() => !!window.__WILD_MUSTANG_TEST__);
  await expect(page.locator('#start')).toHaveClass(/on/);
}

export async function startChapterOne(page) {
  await page.locator('#btnPlay').click();
  await expect.poll(async () => (await state(page)).phase).toBe('tutorial');
}

export async function skipTutorial(page) {
  await page.locator('#btnSkipTutorial').click();
  await expect.poll(async () => (await state(page)).phase).toBe('meet');
}

export async function teleport(page, x, z) {
  await page.evaluate(([x, z]) => window.__WILD_MUSTANG_TEST__.teleport(x, z), [x, z]);
}

export async function action(page, label) {
  const button = page.locator('#btnAct');
  await expect(button).toHaveClass(/on/);
  if (label) await expect(button).toHaveText(label);
  await button.click();
}

export async function meetAlex(page) {
  const objects = await page.evaluate(() => window.__WILD_MUSTANG_TEST__.objects());
  const alex = objects.alex;
  await teleport(page, alex.x + 2, alex.z);
  await expect.poll(async () => (await state(page)).trust, { timeout: 90_000 }).toBeGreaterThanOrEqual(35);
  await action(page, /яблоко из руки/);
  await expect.poll(async () => (await state(page)).phase).toBe('quests');
}

export function position(snapshot) {
  return snapshot.position || snapshot.player || { x: snapshot.x, z: snapshot.z };
}

export async function finishCurrentChapter(page) {
  const initial = await state(page);
  for (let attempts = 0; attempts < 30; attempts++) {
    // Read related values together. Early apple collection can advance a quest
    // automatically between two browser round-trips.
    const { current, quest, target, allApplesTaken } = await page.evaluate(() => {
      const api = window.__WILD_MUSTANG_TEST__;
      const current = api.snapshot();
      const objects = api.objects();
      return { current, quest: objects.quests[current.quest], target: api.target(),
        allApplesTaken: objects.apples.every(apple => apple.taken) };
    });
    console.log(`Story progress: chapter ${current.chapter}, quest ${current.quest}, phase ${current.phase}, apples ${current.apples}, rescue ${current.freeProgress}`);
    if (current.phase === 'cine' || current.phase === 'done') break;
    if (!quest || !target) throw new Error(`No quest target: ${JSON.stringify(current)}`);
    if (quest.kind === 'apples' && allApplesTaken) {
      await expect.poll(async () => (await state(page)).quest).not.toBe(current.quest);
      continue;
    }
    const travel = quest.kind === 'zone' ? quest.target : target;
    if (quest.id === 'willow-crossing') {
      // This scripted helper jumps the hero between distant objectives. Restore
      // the real west-bank checkpoint through public controls so companions do
      // not start a 150 m catch-up behind a teleported hero. Only the hero moves
      // to the next target; the friends still cross through ordinary game code.
      await page.locator('#btnPause').click();
      await page.locator('#btnToMenu').click();
      await page.locator('#btnContinue').click();
      const continued = await state(page);
      expect(continued.phase).toBe(current.phase);
      expect(continued.chapter).toBe(current.chapter);
      expect(continued.quest).toBe(current.quest);
      expect(continued.completedChapters).toEqual(current.completedChapters);
      expect(continued.trust).toBe(current.trust);
      expect(continued.apples).toBe(current.apples);
      expect(continued.freeProgress).toBe(current.freeProgress);
      expect(continued.foalFreed).toBe(true);
      expect(continued.heading).toBeCloseTo(current.heading, 5);
      expect(continued.position.x).toBeCloseTo(current.position.x, 2);
      expect(continued.position.z).toBeCloseTo(current.position.z, 2);
    }
    await teleport(page, travel[0], travel[1]);
    if (quest.kind === 'zone') {
      await expect.poll(async () => (await state(page)).quest,{timeout:quest.id==='willow-crossing'?90_000:12_000}).not.toBe(current.quest);
    } else {
      await action(page);
      // Some tasks have several visible actions (apples / moving branches).
      await page.waitForTimeout(100);
    }
  }
  await expect.poll(async () => (await state(page)).phase).toMatch(/cine|done/);
  await page.evaluate(() => window.__WILD_MUSTANG_TEST__.finishCinematic());
  await expect(page.locator('#finish')).toHaveClass(/on/);
  await expect.poll(async () => (await state(page)).phase).toBe('done');
  return initial.chapter;
}

// Synthetic PointerEvent dispatch exercises the game's pointer handlers, including
// multi-pointer cancellation, while browser contexts still emulate touch devices.
// Physical iPad touch hardware remains a separate manual gate.
export async function pointer(page, selector, type, id, x, y) {
  await page.locator(selector).evaluate((element, value) => {
    element.dispatchEvent(new PointerEvent(value.type, {
      pointerId: value.id,
      pointerType: 'touch',
      clientX: value.x,
      clientY: value.y,
      bubbles: true,
      cancelable: true,
      buttons: value.type === 'pointerup' || value.type === 'pointercancel' ? 0 : 1,
    }));
  }, { type, id, x, y });
}

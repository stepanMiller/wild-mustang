import { expect } from '@playwright/test';
import { test } from './fixtures.js';
import { openGame, state, teleport, action } from './helpers.js';
import { RESCUE_LAYOUT } from '../src/adventures/rescue-state.js';

const finishedStory={
  version:2,completedChapters:[1,2,3],settings:{quality:0,music:0,sfx:0,voice:false},
  checkpoint:{chapter:3,x:86,z:-78,heading:Math.PI,quest:5,trust:88,apples:0,
    taken:[true,true,true],phase:'epilogue',tutStep:4,alexFollows:true,
    questSteps:0,freeProgress:3,foalFreed:true,playTime:312},
};

async function openFinishedStory(page) {
  // Seed once. addInitScript alone would overwrite the real checkpoint on every
  // reload and turn a broken resume path into a passing fixture-reload test.
  await page.addInitScript(value=>{
    if(sessionStorage.getItem('herd-rescue-fixture')!=='seeded') {
      localStorage.setItem('veter-save',value);
      sessionStorage.setItem('herd-rescue-fixture','seeded');
    }
  },JSON.stringify(finishedStory));
  await openGame(page);
}

async function reloadAndContinue(page) {
  await page.reload();
  await expect(page.locator('#loading')).toHaveCount(0,{timeout:20_000});
  await expect(page.locator('#btnContinue')).toBeEnabled();
  await page.locator('#btnContinue').click();
  await expect.poll(async()=>(await state(page)).phase).toBe('rescue');
}

function checkpointActors(snapshot) {
  const {stage,elapsed,stageTime,gateOpen,horses,guards}=snapshot;
  return {stage,elapsed,stageTime,gateOpen,horses,guards};
}

test.beforeEach(async({page})=>{
  page.__rescueErrors=[];
  page.on('pageerror',error=>page.__rescueErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')page.__rescueErrors.push(message.text());});
});

test.afterEach(async({page})=>{
  expect(page.__rescueErrors,'Browser errors during the herd adventure').toEqual([]);
});

test('Herd adventure unlock requires the original ending and keeps its touch target visible',async({page})=>{
  await openGame(page);
  await page.locator('#btnChapters').click();
  await expect(page.locator('#btnRescue')).toBeDisabled();
  await expect(page.locator('#btnRescue')).toContainText(/табун/i);
  await page.locator('#btnCloseChapters').click();
  await page.locator('#btnPlay').click();
  const fresh=await state(page);
  expect(fresh.phase).toBe('tutorial');
  expect(fresh.activeAdventure).toBeNull();
  expect(fresh.rescueVisible).toBe(false);
  expect(fresh.completedChapters).toEqual([]);
});

test('Herd adventure captures, pauses, resumes, frees and replays without losing the main story',async({page},testInfo)=>{
  test.setTimeout(240_000);
  await openFinishedStory(page);
  expect((await state(page)).completedChapters).toEqual([1,2,3]);
  await page.locator('#btnChapters').click();
  const launch=page.locator('#btnRescue');
  await expect(launch).toBeEnabled();
  await launch.scrollIntoViewIfNeeded();
  const box=await launch.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y+box.height).toBeLessThanOrEqual(page.viewportSize().height+1);
  await launch.click();
  await expect.poll(async()=>(await state(page)).phase).toBe('rescue');
  expect((await state(page)).activeAdventure).toBe('herd-rescue');
  await teleport(page,...RESCUE_LAYOUT.watch);

  // No quest/horse state is injected. The actual mounted guards approach,
  // throw their ropes and start escorting while the player only watches.
  await expect.poll(async()=>(await state(page)).rescue.horses.some(h=>h.state==='caught'),
    {timeout:75_000,intervals:[100,250,500]}).toBe(true);
  await page.locator('#btnPause').click();
  const paused=await state(page),frozen=checkpointActors(paused.rescue);
  expect(paused.paused).toBe(true);
  await page.waitForTimeout(350);
  expect(checkpointActors((await state(page)).rescue)).toEqual(frozen);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('veter-save')));
  expect(saved.version).toBe(3);
  expect(saved.activeAdventure).toBe('herd-rescue');
  expect(saved.checkpoint).toMatchObject({chapter:3,phase:'epilogue',x:86,z:-78,playTime:312});
  expect(saved.completedChapters).toEqual([1,2,3]);
  expect(saved.adventures.herdRescue.horses.some(h=>h.state==='caught')).toBe(true);
  await reloadAndContinue(page);
  const resumed=await state(page);
  expect(['roundup','captive']).toContain(resumed.rescue.stage);
  expect(resumed.rescue.horses.some(h=>['caught','corral'].includes(h.state))).toBe(true);
  expect(resumed.rescue.elapsed).toBeGreaterThanOrEqual(frozen.elapsed);
  expect(resumed.completedChapters).toEqual([1,2,3]);

  await expect.poll(async()=>(await state(page)).rescue.stage,{timeout:75_000}).toBe('captive');
  const captive=await state(page);
  expect(captive.rescue.horses.map(h=>h.state)).toEqual(['corral','corral','corral']);
  expect(captive.rescue.gateOpen).toBe(false);
  await page.screenshot({path:testInfo.outputPath('herd-rescue-captive.png')});
  await teleport(page,...RESCUE_LAYOUT.gate);
  await action(page,/Открыть|засов/i);
  await expect.poll(async()=>(await state(page)).rescue.stage).toBe('escape');

  for(const [index,point] of RESCUE_LAYOUT.escape.entries()) {
    // Focused integration test moves only the player between route waypoints.
    // Every companion walks out of the gate and follows ordinary runtime code.
    await teleport(page,...point);
    await expect.poll(async()=>{
      const horses=(await state(page)).rescue.horses;
      return horses.every(h=>h.state==='safe'||Math.hypot(h.x-point[0],h.z-point[1])<12);
    },{timeout:30_000}).toBe(true);
    if(index===1) {
      await page.locator('#btnPause').click();
      const escapeSave=await page.evaluate(()=>JSON.parse(localStorage.getItem('veter-save')));
      expect(escapeSave.adventures.herdRescue.stage).toBe('escape');
      expect(escapeSave.adventures.herdRescue.gateOpen).toBe(true);
      await reloadAndContinue(page);
      expect((await state(page)).rescue.stage).toBe('escape');
    }
  }
  await expect.poll(async()=>(await state(page)).rescue.stage,{timeout:45_000}).toBe('complete');
  await expect(page.locator('#rescueFinish')).toHaveClass(/on/);
  const complete=await state(page);
  expect(complete.rescue.horses.map(h=>h.state)).toEqual(['safe','safe','safe']);
  expect(complete.completedChapters).toEqual([1,2,3]);
  expect(complete.paused).toBe(true);
  await page.screenshot({path:testInfo.outputPath('herd-rescue-free.png')});
  await testInfo.attach('herd-rescue-result',{body:JSON.stringify(complete,null,2),contentType:'application/json'});

  await page.locator('#btnRescueAgain').click();
  const replay=await state(page);
  expect(replay.phase).toBe('rescue');
  expect(['watch','roundup']).toContain(replay.rescue.stage);
  expect(replay.rescue.horses.every(h=>['grazing','fleeing'].includes(h.state))).toBe(true);
  expect(replay.completedChapters).toEqual([1,2,3]);
  await expect(page.locator('#rescueFinish')).not.toHaveClass(/on/);
  await page.locator('#btnPause').click();
  await page.locator('#btnToMenu').click();
  await page.locator('#btnChapters').click();
  await page.locator('[data-chapter="1"]').click();
  const story=await state(page);
  expect(story.phase).toBe('tutorial');
  expect(story.activeAdventure).toBeNull();
  expect(story.rescueVisible).toBe(false);
  expect(story.completedChapters).toEqual([1,2,3]);
  await expect(page.locator('#rescueFinish')).not.toHaveClass(/on/);
});

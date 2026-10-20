import { expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { test } from './fixtures.js';
import { action, openGame, state, teleport } from './helpers.js';

function savedChapterTwo(quest,x,z){
  return JSON.stringify({version:2,completedChapters:[1],settings:{quality:1},checkpoint:{
    chapter:2,x,z,heading:Math.PI/2,quest,trust:80,apples:0,taken:[true,true,true],phase:'quests',
    alexFollows:true,foalFreed:true,freeProgress:0,questSteps:0,tutStep:0,playTime:0,
  }});
}
async function openCheckpoint(page,save){
  await page.addInitScript(value=>{
    if(sessionStorage.getItem('companion-fixture-seeded'))return;
    localStorage.setItem('veter-save',value);sessionStorage.setItem('companion-fixture-seeded','yes');
  },save);
  await openGame(page);
}
const bank=z=>-18+Math.sin(z*.035)*16+Math.cos(z*.012)*8+Math.sin(z*.082+1.1)*4.5
  +5.2+Math.sin(z*.045+.7)*1.1+Math.cos(z*.018)*.9;

test('Friends actually cross the ford while the player waits at the first edge of the goal',async({page})=>{
  await openCheckpoint(page,savedChapterTwo(2,-14,60));
  await page.locator('#btnContinue').click();
  for(let i=0;i<3;i++)await action(page,/Подвинуть камень/);
  await expect.poll(async()=>(await state(page)).quest).toBe(3);
  await teleport(page,10.2,60);
  const entered=await state(page);
  expect(entered.quest).toBe(3);
  expect(entered.companions.foal.x).toBeLessThan(bank(entered.companions.foal.z));
  // QA setup moves only the hero; companions must walk across through game code.
  await expect.poll(async()=>(await state(page)).quest,{timeout:90_000}).toBe(4);
  const crossed=await state(page);
  for(const actor of [crossed.companions.foal,crossed.companions.alex])expect(actor.x).toBeGreaterThanOrEqual(bank(actor.z)+.6);
  expect(crossed.position.x).toBeCloseTo(10.2,2);
  expect(crossed.position.z).toBeCloseTo(60,2);
});

test('Sharing starts real reactions after the action, and Continue preserves progress without replaying the scene',async({page,browserName},testInfo)=>{
  await openCheckpoint(page,savedChapterTwo(4,27,75));
  await page.locator('#btnContinue').click();
  await expect.poll(async()=>(await state(page)).gaits[0]).toMatch(/^Idle/);
  const capture=process.env.WILD_MUSTANG_COMPANION_EVIDENCE==='1'&&testInfo.project.use.hasTouch;
  const folder='tests/evidence/audio-story-polish-03';
  if(capture){await mkdir(folder,{recursive:true});await page.screenshot({path:`${folder}/${browserName}-before-sharing.png`,scale:'css'});}
  await action(page,/Поделиться яблоком/);
  await expect.poll(async()=>(await state(page)).quest).toBe(5);
  await expect.poll(async()=>(await state(page)).gaits[0]).toBe('Eating');
  await expect.poll(async()=>(await state(page)).companions.alex.animation,{timeout:30_000}).toMatch(/OfferApple|Pet/);
  if(capture)await page.screenshot({path:`${folder}/${browserName}-after-sharing.png`,scale:'css'});
  await expect.poll(async()=>(await state(page)).companions.foal.animation,{timeout:30_000}).toBe('Eating');
  await page.locator('#btnPause').click();
  await page.locator('#btnToMenu').click();
  await page.reload();
  await expect(page.locator('#loading')).toHaveCount(0,{timeout:20_000});
  await page.locator('#btnContinue').click();
  const continued=await state(page);
  expect(continued.quest).toBe(5);
  expect(continued.presentation).toBeNull();
  await expect.poll(async()=>(await state(page)).gaits[0]).toMatch(/^Idle/);
});

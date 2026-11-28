import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSave, writeSave, readSave, validateCheckpoint, SAVE_VERSION } from '../src/persistence.js';
import { createRescueSave } from '../src/adventures/rescue-state.js';

const legacy = {x:-52,z:-36,quest:3,trust:75,apples:1,phase:'quests',alexFollows:true,taken:[true,false,false]};
test('legacy progress migrates with correctly derived abilities and partial rescue',()=>{
  const result=decodeSave(JSON.stringify({...legacy,freeProgress:2}));
  assert.equal(result.version,3); assert.equal(result.version,SAVE_VERSION); assert.equal(result.checkpoint.chapter,1);
  assert.equal(result.checkpoint.freeProgress,2); assert.equal(result.checkpoint.trust,75);
  assert.equal(result.checkpoint.apples,1);
});
test('legacy completed rescue survives migration',()=>{
  assert.equal(decodeSave({...legacy,quest:4}).checkpoint.foalFreed,true);
});
test('invalid and unsupported saves are rejected without exceptions',()=>{
  for(const value of ['broken','null','[]',JSON.stringify({...legacy,x:Infinity}),JSON.stringify({...legacy,quest:-1}),JSON.stringify({version:99})]) assert.equal(decodeSave(value),null);
  assert.equal(validateCheckpoint({...legacy,z:106}),null);
});
test('future chapter cannot be resumed before unlock',()=>{
  const checkpoint={...legacy,chapter:3};
  assert.equal(decodeSave({version:2,checkpoint,completedChapters:[1]}),null);
  assert.equal(decodeSave({version:2,checkpoint,completedChapters:[1,2]}).checkpoint.chapter,3);
});
test('saved data round-trips and private storage failures are graceful',()=>{
  let value;const storage={setItem:(_key,x)=>value=x,getItem:()=>value};
  assert.equal(writeSave(storage,{checkpoint:legacy,completedChapters:[1],settings:{music:0}}),true);
  assert.equal(readSave(storage).settings.music,0);
  const blocked={setItem(){throw new Error('blocked');},getItem(){throw new Error('blocked');}};
  assert.equal(writeSave(blocked,{}),false);assert.equal(readSave(blocked),null);
});

const epilogue = {
  ...legacy, chapter:3, x:86, z:-78, quest:5, phase:'epilogue',
  apples:0, taken:[true,true,true], foalFreed:true, playTime:312,
};

test('version 2 ending migrates without losing completed chapters, checkpoint or settings',()=>{
  const result=decodeSave({version:2,checkpoint:epilogue,completedChapters:[1,2,3],settings:{quality:0,voice:false}});
  assert.equal(result.version,3);
  assert.deepEqual(result.completedChapters,[1,2,3]);
  assert.equal(result.checkpoint.phase,'epilogue');
  assert.equal(result.checkpoint.playTime,312);
  assert.deepEqual(result.settings,{quality:0,voice:false});
  assert.equal(result.activeAdventure ?? null,null);
  assert.equal(result.adventures?.herdRescue ?? null,null);
});

test('bonus save keeps the original story checkpoint and progress intact',()=>{
  const rescue=createRescueSave();
  rescue.player={x:56,z:36,heading:.25};
  const source={checkpoint:epilogue,completedChapters:[1,2,3],settings:{music:.3},
    activeAdventure:'herd-rescue',adventures:{herdRescue:rescue}};
  let value;
  const storage={setItem:(_key,text)=>value=text,getItem:()=>value};
  assert.equal(writeSave(storage,source),true);
  const restored=readSave(storage);
  assert.equal(JSON.parse(value).version,3);
  assert.equal(restored.activeAdventure,'herd-rescue');
  assert.deepEqual(restored.completedChapters,[1,2,3]);
  assert.deepEqual(restored.checkpoint,validateCheckpoint(epilogue));
  assert.equal(restored.settings.music,.3);
  assert.equal(restored.adventures.herdRescue.stage,rescue.stage);
  assert.deepEqual(restored.adventures.herdRescue.player,rescue.player);
});

test('malformed bonus progress cannot discard a valid main-story save',()=>{
  const result=decodeSave({version:3,checkpoint:epilogue,completedChapters:[1,2,3],settings:{sfx:.2},
    activeAdventure:'herd-rescue',adventures:{herdRescue:{stage:'not-a-real-stage'}}});
  assert.ok(result);
  assert.deepEqual(result.completedChapters,[1,2,3]);
  assert.deepEqual(result.checkpoint,validateCheckpoint(epilogue));
  assert.equal(result.settings.sfx,.2);
  assert.equal(result.activeAdventure ?? null,null);
  assert.equal(result.adventures?.herdRescue ?? null,null);
});

test('bonus cannot bypass the main-story unlock or become a fourth completed chapter',()=>{
  const result=decodeSave({version:3,checkpoint:legacy,completedChapters:[1,4],settings:{},
    activeAdventure:'herd-rescue',adventures:{herdRescue:createRescueSave()}});
  assert.ok(result);
  assert.deepEqual(result.completedChapters,[1]);
  assert.equal(result.activeAdventure ?? null,null);
});

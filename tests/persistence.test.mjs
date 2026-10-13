import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSave, writeSave, readSave, validateCheckpoint } from '../src/persistence.js';

const legacy = {x:-52,z:-36,quest:3,trust:75,apples:1,phase:'quests',alexFollows:true,taken:[true,false,false]};
test('legacy progress migrates with correctly derived abilities and partial rescue',()=>{
  const result=decodeSave(JSON.stringify({...legacy,freeProgress:2}));
  assert.equal(result.version,2); assert.equal(result.checkpoint.chapter,1);
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

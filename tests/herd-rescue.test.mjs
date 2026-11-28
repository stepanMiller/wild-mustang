import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRescueSave, validateRescueSave, RESCUE_LAYOUT } from '../src/adventures/rescue-state.js';
import { createHerdRescue } from '../src/adventures/herd-rescue.js';

const clone = value => JSON.parse(JSON.stringify(value));
const playerAt = ([x,z]) => ({x,z,heading:0});

function makeScene() {
  const events=[];
  const episode=createHerdRescue({
    THREE,scene:new THREE.Scene(),hAt:()=>0,normalAt:()=>new THREE.Vector3(0,1,0),
    makeHorse:()=>new THREE.Group(),loadModels:false,onEvent:event=>events.push(event),
  });
  episode.start();
  return {episode,events};
}

function advanceUntil(episode,predicate,player,{seconds=120,onFrame}={}) {
  const dt=.05;
  for(let n=0;n<seconds/dt;n++) {
    episode.update(dt,player);
    const snapshot=episode.snapshot();
    onFrame?.(snapshot,dt);
    if(predicate(snapshot)) return snapshot;
  }
  assert.fail(`Episode did not reach expected state in ${seconds} seconds: ${JSON.stringify(episode.snapshot())}`);
}

function reachCorral(episode,onFrame) {
  return advanceUntil(episode,s=>s.stage==='captive',playerAt(RESCUE_LAYOUT.watch),{onFrame});
}

test('rescue checkpoint validates a deep copy without mutating source or sharing actor arrays',()=>{
  const source=createRescueSave();
  source.player={x:56,z:36,heading:.2};
  const before=clone(source);
  const result=validateRescueSave(source);
  assert.deepEqual(result,before);
  result.horses[0].x=0;
  result.guards[0].mode='return';
  result.player.x=0;
  assert.deepEqual(source,before);
  assert.equal(createRescueSave().horses[0].x,RESCUE_LAYOUT.wild[0][0]);
});

test('rescue checkpoint rejects invalid coordinates, actor identities and impossible stage relationships',()=>{
  const cases=[null,[],{}, {...createRescueSave(),stage:'missing'}, {...createRescueSave(),elapsed:NaN},
    {...createRescueSave(),version:99}, {...createRescueSave(),player:{x:200,z:0,heading:0}},
    {...createRescueSave(),stage:'captive'}, {...createRescueSave(),stage:'complete'},
    {...createRescueSave(),stage:'escape'}];
  const badHorse=createRescueSave();badHorse.horses[0].id=1;cases.push(badHorse);
  const badPosition=createRescueSave();badPosition.horses[2].z=Infinity;cases.push(badPosition);
  const badGuard=createRescueSave();badGuard.guards[0].mode='escort';badGuard.guards[0].target=-1;cases.push(badGuard);
  const unpairedRope=createRescueSave();unpairedRope.stage='roundup';unpairedRope.horses[0].state='caught';cases.push(unpairedRope);
  const strandedHorse=createRescueSave();strandedHorse.stage='roundup';strandedHorse.horses[0].state='following';cases.push(strandedHorse);
  const strandedAssignment=createRescueSave();strandedAssignment.stage='roundup';strandedAssignment.horses[0].guard=0;cases.push(strandedAssignment);
  const routeOverflow=createRescueSave();routeOverflow.stage='roundup';
  routeOverflow.horses[0].state='caught';routeOverflow.horses[0].guard=0;
  Object.assign(routeOverflow.guards[0],{mode:'escort',target:0,routeIndex:8});cases.push(routeOverflow);
  const duplicateTarget=createRescueSave();duplicateTarget.stage='roundup';duplicateTarget.horses[0].guard=0;
  duplicateTarget.guards.forEach(g=>Object.assign(g,{mode:'approach',target:0}));cases.push(duplicateTarget);
  for(const value of cases) assert.equal(validateRescueSave(value),null);
});

test('cavalry autonomously catch each horse and visibly escort them into the corral',()=>{
  const {episode}=makeScene();
  const observed=Array.from({length:3},()=>new Set());
  const guardModes=new Set();
  const visibleRopeModes=new Set();
  let previous=episode.snapshot();
  assert.equal(episode.action(playerAt(RESCUE_LAYOUT.gate)),null,'Gate cannot release horses before the roundup');
  const captive=reachCorral(episode,(current,dt)=>{
    current.horses.forEach((horse,index)=>{
      observed[index].add(horse.state);
      assert.ok(Math.hypot(horse.x-previous.horses[index].x,horse.z-previous.horses[index].z)<2,
        `Horse ${index} must travel through the world instead of teleporting during ${dt}s`);
    });
    current.guards.forEach(g=>guardModes.add(g.mode));
    current.ropes.filter(rope=>rope.visible).forEach(rope=>{
      visibleRopeModes.add(rope.mode);
      for(const end of [rope.from,rope.to]) assert.ok(['x','y','z'].every(axis=>Number.isFinite(end[axis])));
      if(rope.mode==='escort') assert.equal(current.horses[rope.horse].state,'caught');
    });
    assert.ok(validateRescueSave(current),`Every active frame must remain resumable: ${current.stage}`);
    previous=current;
  });
  for(const states of observed) {
    assert.ok(states.has('caught'));
    assert.ok(states.has('corral'));
  }
  assert.ok(guardModes.has('throw'));
  assert.ok(guardModes.has('escort'));
  assert.ok(visibleRopeModes.has('throw'));
  assert.ok(visibleRopeModes.has('escort'));
  assert.equal(captive.gateOpen,false);
  assert.ok(captive.horses.every(h=>h.state==='corral'));
  assert.equal(episode.action(playerAt(RESCUE_LAYOUT.refuge)),null,'Gate must be opened nearby');
  episode.stop();
});

test('the gate action survives normal stopping distance without permitting remote or out-of-stage opening',()=>{
  const {episode}=makeScene();
  const [x,z]=RESCUE_LAYOUT.gate;
  const stopped={x,z:z+6.2,heading:Math.PI};
  assert.equal(episode.action(stopped),null,'The watch stage must not expose the release action');
  reachCorral(episode);
  // Natural touch travel left the hero about 6.2 m from the gate after the
  // joystick was released. The fence collider prevents approaching its center.
  assert.equal(episode.action({x,z:z+7,heading:Math.PI}),null,'The gate cannot be opened remotely');
  const action=episode.action(stopped);
  assert.ok(action,'Opening must remain reachable after the hero settles outside the fence collider');
  assert.match(action.label,/Открыть|засов/i);
  action.fn();
  assert.equal(episode.snapshot().stage,'escape');
  assert.equal(episode.snapshot().gateOpen,true);
  assert.equal(episode.action(stopped),null,'An already opened gate must not offer another release action');
  episode.stop();
});

test('a live caught-horse checkpoint resumes the same guard, rope assignment and route',()=>{
  const {episode}=makeScene();
  const player=playerAt(RESCUE_LAYOUT.watch);
  const caught=advanceUntil(episode,s=>s.horses.some(h=>h.state==='caught'),player);
  const checkpoint=validateRescueSave(clone(caught));
  assert.ok(checkpoint);
  const {episode:resumed}=makeScene();
  resumed.start(checkpoint);
  assert.deepEqual(validateRescueSave(resumed.snapshot()),checkpoint);
  for(let n=0;n<20;n++) {
    episode.update(.05,player);
    resumed.update(.05,player);
  }
  assert.deepEqual(validateRescueSave(resumed.snapshot()),validateRescueSave(episode.snapshot()));
  assert.equal(reachCorral(resumed).stage,'captive');
  episode.stop();resumed.stop();
});

test('opening the gate and leading every horse to safety completes once, then replay resets the scene',()=>{
  const {episode,events}=makeScene();
  reachCorral(episode);
  const action=episode.action(playerAt(RESCUE_LAYOUT.gate));
  assert.ok(action);
  assert.match(action.label,/Открыть|засов/i);
  action.fn();
  assert.equal(episode.snapshot().stage,'escape');
  assert.equal(episode.snapshot().gateOpen,true);
  let player=playerAt(RESCUE_LAYOUT.gate);
  for(const point of RESCUE_LAYOUT.escape) {
    while(Math.hypot(player.x-point[0],player.z-point[1])>.05) {
      const distance=Math.hypot(point[0]-player.x,point[1]-player.z),step=Math.min(.2,distance);
      player={x:player.x+(point[0]-player.x)*step/distance,z:player.z+(point[1]-player.z)*step/distance,heading:0};
      episode.update(.05,player);
    }
    for(let n=0;n<40;n++)episode.update(.05,player);
  }
  const done=advanceUntil(episode,s=>s.stage==='complete',player,{seconds:45});
  assert.ok(done.horses.every(h=>h.state==='safe'));
  assert.equal(episode.isComplete(),true);
  for(let n=0;n<30;n++)episode.update(.05,player);
  assert.equal(events.filter(e=>e.type==='complete').length,1);
  episode.start();
  const replay=episode.snapshot();
  assert.equal(replay.stage,'watch');
  assert.ok(replay.horses.every(h=>h.state==='grazing'));
  assert.ok(replay.guards.every(g=>g.mode==='waiting'));
  assert.equal(episode.isComplete(),false);
  assert.equal(episode.group.visible,true);
  episode.stop();
  const frozen=validateRescueSave(episode.snapshot());
  episode.update(5,player);
  assert.equal(episode.group.visible,false);
  assert.deepEqual(validateRescueSave(episode.snapshot()),frozen);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createCompanionScenes } from '../src/story/companion-scenes.js';

function fixture(options={}){
  const horse=new THREE.Group(),foal=new THREE.Group(),alex=new THREE.Group(),herd=new THREE.Group();
  horse.position.set(30,3,40);foal.position.set(26,3,43);alex.position.set(33,3,42);
  for(let i=0;i<5;i++){const actor=new THREE.Group();actor.position.set(97+i,3,-94);actor.userData.familyRole=i===0?'parent':'member';herd.add(actor);}
  const hAt=options.hAt||((x,z)=>3+(x-z)*.001);
  const controller=createCompanionScenes({THREE,horse,foal,alex,herd,hAt,...options});
  const state={chapter:2,phase:'quests',player:{x:30,z:40,heading:0,speed:0},foalFreed:true};
  return {horse,foal,alex,herd,hAt,controller,state};
}
function pose(f){return [f.horse,f.foal,f.alex,...f.herd.children].map(actor=>({position:actor.position.toArray(),quaternion:actor.quaternion.toArray(),visible:actor.visible,userData:{...actor.userData}}));}
function applyGoal(actor,goal){if(goal)actor.position.set(goal.x,goal.y,goal.z);}

test('Every presentation is advisory and never changes actors, player, quests or progression',()=>{
  const f=fixture(),initial=pose(f),state=structuredClone({...f.state,quest:4,questSteps:2,finished:false,stamina:15});
  const before=structuredClone(state);
  for(const effect of ['foal-freed','meadow-rest','ford-restored','ford-walk','foal-crossed','mountain-obstacle','mountain-call']){
    assert.equal(f.controller.trigger(effect,2),true);
    const frame=f.controller.update(.05,state);assert.equal(frame.active,true);
    assert.ok(frame.goals.foal);assert.ok(frame.goals.alex);
    for(const target of Object.values(frame.goals)){assert.ok([target.x,target.y,target.z,target.maxSpeed].every(Number.isFinite));assert.equal(target.y,f.hAt(target.x,target.z));}
    assert.deepEqual(pose(f),initial);assert.deepEqual(state,before);
  }
});
test('Apple offer and foal sniff happen after arrival, then petting/grazing follow',()=>{
  const f=fixture();f.controller.trigger('meadow-rest',2);
  let frame=f.controller.update(.05,f.state);
  assert.equal(frame.gestures.alex,undefined);assert.equal(frame.gestures.foal,undefined);
  applyGoal(f.alex,frame.goals.alex);applyGoal(f.foal,frame.goals.foal);
  frame=f.controller.update(.05,f.state);
  assert.equal(frame.gestures.alex,'offer');assert.equal(frame.gestures.foal,'sniff');assert.equal(frame.gestures.hero,'graze');
  for(let i=0;i<35;i++)frame=f.controller.update(.1,f.state);
  assert.equal(frame.gestures.alex,'pet');assert.equal(frame.gestures.foal,'graze');
  for(let i=0;i<30;i++)frame=f.controller.update(.1,f.state);
  assert.equal(frame.active,false);assert.equal(f.controller.inspect(),null);
});
test('Rescue gives a bounded cheerful arc, supports immediate departure, and never targets a trapped foal',()=>{
  const f=fixture();f.controller.trigger('foal-freed',2);
  const first=f.controller.update(.01,f.state),last=(function(){let frame;for(let i=0;i<24;i++)frame=f.controller.update(.1,f.state);return frame;})();
  assert.ok(Math.hypot(first.goals.foal.x-f.state.player.x,first.goals.foal.z-f.state.player.z)<=2.901);
  assert.ok(Math.hypot(last.goals.foal.x-first.goals.foal.x,last.goals.foal.z-first.goals.foal.z)>2,'a real arc rather than a static pose');
  f.state.player.speed=8;assert.equal(f.controller.update(.05,f.state).active,false);
  f.state.player.speed=0;f.controller.trigger('foal-freed',2);f.state.foalFreed=false;
  assert.equal(f.controller.update(.05,f.state).goals.foal,undefined);
});
test('Pause freezes time, chapter changes clear reactions, and invalid frame times do not advance them',()=>{
  const f=fixture();f.controller.trigger('mountain-call',2);f.controller.update(.1,f.state);
  const elapsed=f.controller.inspect().elapsed;
  assert.equal(f.controller.update(.1,{...f.state,paused:true}).active,false);
  assert.equal(f.controller.inspect().elapsed,elapsed);
  f.controller.update(NaN,f.state);f.controller.update(-2,f.state);assert.equal(f.controller.inspect().elapsed,elapsed);
  assert.equal(f.controller.update(.1,{...f.state,chapter:3}).active,false);assert.equal(f.controller.inspect(),null);
  f.controller.trigger('meadow-rest',2);f.controller.trigger('chapter',2);assert.equal(f.controller.inspect(),null);
});
test('Unsafe terrain or collision rejection falls back to normal following; hidden actors receive no targets',()=>{
  const wet=fixture({hAt:()=>.3});wet.controller.trigger('meadow-rest',2);
  assert.deepEqual(wet.controller.update(.05,wet.state).goals,{});
  const blocked=fixture({isSafeGoal:()=>false});blocked.controller.trigger('meadow-rest',2);
  assert.deepEqual(blocked.controller.update(.05,blocked.state).goals,{});
  const f=fixture();f.foal.visible=false;f.alex.visible=false;f.controller.trigger('meadow-rest',2);
  assert.deepEqual(f.controller.update(.05,f.state).goals,{});
});
test('Reunion finds the role-marked parent, places the child nearby, brings Alex into frame, and releases epilogue control',()=>{
  const f=fixture();f.herd.children[0].userData.familyRole='member';f.herd.children[3].userData.familyRole='parent';
  const state={...f.state,chapter:3,phase:'cine'};f.controller.trigger('reunion',3);
  let frame=f.controller.update(.05,state),formation=frame.formation;
  assert.equal(formation.parent,f.herd.children[3]);
  assert.deepEqual(formation.hero,{x:97,y:f.hAt(97,-94),z:-94});
  const parent=formation.herd.find(target=>target.actor===formation.parent);
  const separation=Math.hypot(parent.x-formation.foal.x,parent.z-formation.foal.z);
  assert.ok(separation>1.9&&separation<3,'parent and child share a clear side-by-side composition');
  assert.ok(Math.hypot(formation.alex.x-97,formation.alex.z+94)<4,'Alex joins the reunion rather than waving from the previous quest');
  assert.equal(frame.gestures.alex,undefined,'walk toward the tableau before waving');
  applyGoal(f.alex,formation.alex);applyGoal(f.foal,formation.foal);applyGoal(formation.parent,parent);
  frame=f.controller.update(.05,state);assert.equal(frame.gestures.alex,'wave');assert.equal(frame.gestures.foal,'sniff');assert.equal(frame.gestures.parent,'sniff');
  assert.equal(f.controller.update(.05,{...state,phase:'epilogue'}).active,false);
  assert.deepEqual(f.controller.update(.05,{...state,phase:'epilogue'}).goals,{});
});
test('Alex keeps locomotion until the actual stop radius and never pets a missing or distant foal',()=>{
  const f=fixture();f.controller.trigger('meadow-rest',2);
  let frame=f.controller.update(.05,f.state);
  f.alex.position.set(frame.goals.alex.x+.6,frame.goals.alex.y,frame.goals.alex.z);
  applyGoal(f.foal,frame.goals.foal);
  assert.equal(f.controller.update(.05,f.state).gestures.alex,undefined,'do not offer while still approaching');
  applyGoal(f.alex,frame.goals.alex);f.foal.position.set(1,3,1);
  for(let i=0;i<36;i++)frame=f.controller.update(.1,f.state);
  assert.equal(frame.gestures.alex,undefined,'do not pet a distant foal');
  f.foal.visible=false;assert.equal(f.controller.update(.05,f.state).gestures.alex,undefined,'do not pet an absent foal');
  f.foal.visible=true;f.controller.trigger('reunion',3);
  const cine={...f.state,chapter:3,phase:'cine'};frame=f.controller.update(.05,cine);
  f.alex.position.set(frame.goals.alex.x+.85,frame.goals.alex.y,frame.goals.alex.z);
  assert.equal(f.controller.update(.05,cine).gestures.alex,undefined,'do not wave-slide during reunion approach');
});
test('Public hero pet has a real Alex pet gesture after arrival, with no foal or player movement',()=>{
  const f=fixture(),before=pose(f);f.controller.trigger('pet-hero',2);
  let frame=f.controller.update(.05,f.state);
  assert.equal(frame.goals.foal,undefined);assert.equal(frame.gestures.alex,undefined);
  assert.equal(frame.gestures.hero,'sniff');assert.deepEqual(pose(f),before);
  applyGoal(f.alex,frame.goals.alex);frame=f.controller.update(.05,f.state);
  assert.equal(frame.gestures.alex,'pet');assert.equal(frame.gestures.foal,undefined);
  assert.ok(Math.hypot(frame.goals.alex.x-f.horse.position.x,frame.goals.alex.z-f.horse.position.z)<3);
  for(let i=0;i<30;i++)frame=f.controller.update(.1,f.state);
  assert.equal(frame.gestures.alex,'pet','the stationary pet remains visible for three seconds');
  f.state.player.speed=2;assert.equal(f.controller.update(.05,f.state).active,false,'walking away immediately releases the pet');
  assert.equal(f.controller.inspect(),null);
});
test('Hero pet is safe for epilogue, hidden/distant actors, and a changed hero position',()=>{
  const f=fixture();f.controller.trigger('pet-hero',3);
  const epilogue={...f.state,chapter:3,phase:'epilogue'};
  assert.equal(f.controller.update(.05,epilogue).active,true,'the public epilogue pet works');
  f.horse.visible=false;assert.equal(f.controller.update(.05,epilogue).active,false);
  f.horse.visible=true;f.alex.position.set(100,3,100);f.controller.trigger('pet-hero',3);
  assert.equal(f.controller.update(.05,epilogue).active,false,'a distant Alex does not get summoned to pet');
  f.alex.position.set(33,3,42);f.controller.trigger('pet-hero',3);
  assert.equal(f.controller.update(.05,{...epilogue,player:{...epilogue.player,x:50}}).active,false,'a stale trigger cannot move Alex toward an absent hero');
});

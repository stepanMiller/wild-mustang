import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createStoryEnvironment } from '../src/story/environment.js';
import { CHAPTERS } from '../src/story/chapters.js';

// These checks cover chapter replay and incremental quests, the state most likely
// to regress when independent decorative meshes are converted to static batches.
function create(){return createStoryEnvironment(THREE,new THREE.Scene(),(x,z)=>(x-z)*.02);}

test('Each chapter exposes only its current landmark, including shared final targets',()=>{
  const world=create();
  for(const id of [1,2,3,1]){
    world.setChapter(id);
    assert.deepEqual(Object.values(world.groups.chapters).map(group=>group.visible),[1,2,3].map(chapter=>chapter===id));
    for(let quest=0;quest<CHAPTERS[id].quests.length;quest++){
      world.setQuest(quest);
      const visible=world.groups.landmarks[id].filter(marker=>marker.visible);
      assert.equal(visible.length,1);assert.equal(visible[0].name,CHAPTERS[id].quests[quest].id);
      assert.equal(visible[0].position.x,CHAPTERS[id].quests[quest].target[0]);
      assert.equal(visible[0].position.z,CHAPTERS[id].quests[quest].target[1]);
    }
  }
});
test('The three ford stones move one at a time and reset when replaying the chapter',()=>{
  const world=create();world.setChapter(2);
  const stones=world.groups.fordStones;
  assert.equal(stones.length,3);
  assert.ok(stones.every(item=>item.isMesh&&!item.isInstancedMesh));
  for(const progress of [0,1,2,3]){
    world.applyEffect('ford-restored',progress);
    stones.forEach((item,i)=>{
      const rest=item.userData.rest;
      assert.deepEqual(item.position.toArray(),[rest.x,rest.y,rest.z+(i<progress?0:3.3)]);
    });
  }
  world.setChapter(3);world.setChapter(2);
  stones.forEach(item=>{assert.equal(item.position.z,item.userData.rest.z+3.3);});
});
test('Mountain branches and meadow ripples retain independent effects and reset on replay',()=>{
  const world=create();world.setChapter(3);
  const branches=world.groups.mountainBranches;
  assert.equal(branches.length,2);assert.ok(branches.every(item=>!item.isInstancedMesh));
  for(const progress of [0,1,2]){
    world.applyEffect('mountain-obstacle',progress);
    assert.deepEqual(branches.map(item=>item.visible),[0,1].map(index=>index>=progress));
  }
  world.setChapter(2);
  const ripples=world.groups.chapters[2].children.filter(item=>item.geometry?.type==='RingGeometry');
  assert.equal(ripples.length,3);assert.ok(ripples.every(item=>item.material.opacity===0));
  world.applyEffect('meadow-rest');world.update(.1);
  assert.ok(ripples.every(item=>item.material.opacity>0&&item.userData.active));
  world.setChapter(3);world.setChapter(2);
  assert.ok(ripples.every(item=>item.material.opacity===0&&!item.userData.active));
  assert.ok(branches.every(item=>item.visible));
});

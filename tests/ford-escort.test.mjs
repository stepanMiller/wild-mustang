import assert from 'node:assert/strict';
import test from 'node:test';
import {fordEscort} from '../src/story/ford-escort.js';

const riverX=z=>-18+Math.sin(z*.035)*16+Math.cos(z*.012)*8+Math.sin(z*.082+1.1)*4.5;
const riverWidth=z=>5.2+Math.sin(z*.045+.7)*1.1+Math.cos(z*.018)*.9;
const helpers={questId:'willow-crossing',phase:'quests',chapter:2,riverX,riverWidth,hAt:()=>3,waterY:1.15};
function fixture(){return {player:{x:10,z:60,heading:Math.PI/2,speed:0},friends:{foal:{position:{x:4,y:3,z:60},visible:true},alex:{position:{x:5,y:3,z:61.4},visible:true}}};}

test('Player alone entering the crossing zone is insufficient; actual east-bank friends make it ready',()=>{
  const {player,friends}=fixture();
  assert.equal(fordEscort(player,friends,helpers).ready,false);
  friends.foal.position.x=8;assert.equal(fordEscort(player,friends,helpers).ready,false);
  friends.alex.position.x=7.5;assert.equal(fordEscort(player,friends,helpers).ready,true);
  friends.foal.position.x=riverX(60)+riverWidth(60)+.59;
  assert.equal(fordEscort(player,friends,helpers).ready,false);
});
test('A stationary player at the earliest x=10 zone entry can bring both friends across',()=>{
  const {player,friends}=fixture(),initial=structuredClone({player,friends});
  const escort=fordEscort(player,friends,helpers);
  assert.equal(escort.goals.foal.x,8);assert.equal(escort.goals.foal.z,58.6);
  assert.equal(escort.goals.alex.x,7.5);assert.equal(escort.goals.alex.z,61.4);
  for(const goal of Object.values(escort.goals)){
    assert.ok(goal.x>=riverX(goal.z)+riverWidth(goal.z)+1);
    assert.ok(goal.x<=player.x);assert.equal(goal.arrivalRadius,.5);
    assert.ok([goal.x,goal.y,goal.z,goal.heading].every(Number.isFinite));
  }
  assert.deepEqual({player,friends},initial,'pure advice leaves actors and player unchanged');
  // The runtime moves actors normally; merely letting them reach their target is
  // enough. No player movement, timer, quest write or artificial progress needed.
  Object.entries(escort.goals).forEach(([role,goal])=>{friends[role].position={x:goal.x,y:goal.y,z:goal.z};});
  assert.equal(fordEscort(player,friends,helpers).ready,true);
});
test('Other quests, phases, chapters and non-ford positions preserve normal follow goals',()=>{
  const {player,friends}=fixture();
  for(const override of [{questId:'willow-rest'},{phase:'cine'},{phase:'epilogue'},{chapter:1}]){
    assert.deepEqual(fordEscort(player,friends,{...helpers,...override}),{goals:{},ready:false});
  }
  assert.deepEqual(fordEscort({...player,z:71},friends,helpers),{goals:{},ready:false});
  assert.deepEqual(fordEscort({...player,x:0},friends,helpers),{goals:{},ready:false});
});
test('Fixed obstacle rejection selects a safe alternative without moving actors or crossing in front of the player',()=>{
  const {player,friends}=fixture(),before=structuredClone({player,friends});
  const obstacle={x:8,z:58.6,r:.9};
  const isSafeGoal=goal=>Math.hypot(goal.x-obstacle.x,goal.z-obstacle.z)>obstacle.r+goal.radius+.2;
  const result=fordEscort(player,friends,{...helpers,isSafeGoal});
  assert.ok(result.goals.foal);assert.notEqual(result.goals.foal.z,58.6);
  assert.ok(isSafeGoal(result.goals.foal));assert.ok(result.goals.foal.x<=player.x);
  assert.ok(result.goals.foal.x>=riverX(result.goals.foal.z)+riverWidth(result.goals.foal.z)+1);
  assert.deepEqual({player,friends},before);
  assert.deepEqual(fordEscort(player,friends,{...helpers,isSafeGoal:()=>false}).goals,{});
});
test('Invalid/wet terrain and hidden friends cannot satisfy completion; goals respect world x limit',()=>{
  const {player,friends}=fixture();friends.foal.visible=false;
  assert.equal(fordEscort(player,friends,helpers).ready,false);
  assert.equal(fordEscort(player,friends,helpers).goals.foal,undefined);
  friends.foal.visible=true;
  assert.deepEqual(fordEscort(player,friends,{...helpers,hAt:()=>1.2}).goals,{});
  assert.deepEqual(fordEscort(player,friends,{...helpers,hAt:()=>NaN}).goals,{});
  const result=fordEscort({...player,x:110},friends,helpers);
  assert.ok(Object.values(result.goals).every(goal=>goal.x<=105));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { directionAngle, nearestSafeTrailPoint } from '../src/navigation.js';

const normalized=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const near=(a,b)=>assert.ok(Math.abs(normalized(a-b))<1e-8);
test('wayfinding agrees with visible screen directions behind a north-facing horse',()=>{
  near(directionAngle(0,0,0,-10,0),0);       // ahead
  near(directionAngle(0,0,10,0,0),Math.PI/2); // screen right
  near(directionAngle(0,0,-10,0,0),-Math.PI/2);// screen left
  near(directionAngle(0,0,0,10,0),Math.PI);   // behind
});
test('orbiting the camera changes the arrow to match the new screen right',()=>{
  near(directionAngle(5,7,-5,7,Math.PI/2),0); // west is ahead
  near(directionAngle(5,7,5,-3,Math.PI/2),Math.PI/2); // north is right
});
test('trail rescue returns to the nearby route without losing progress to a distant spawn',()=>{
  assert.deepEqual(nearestSafeTrailPoint([[0,0],[20,0],[20,20]],12,8),[12,0]);
  const recovered=nearestSafeTrailPoint([[0,0],[20,0]],10,8,(x,z)=>x<7 || x>13);
  assert.ok(recovered && (recovered[0]<7 || recovered[0]>13));
  assert.equal(recovered[1],0);
  assert.equal(nearestSafeTrailPoint([[0,0],[20,0]],10,8,()=>false),null);
});

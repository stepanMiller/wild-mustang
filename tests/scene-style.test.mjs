import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LANDSCAPE_STYLES, paintLandscape } from '../src/scene-style.js';

test('Chapter painting preserves the physical terrain and keeps a high flat meadow grassy', () => {
  const geometry=new THREE.BufferGeometry();
  // Identical locations/heights isolate the difference between meadow and cliff.
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([30,21.4,0,30,21.4,0],3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute([0,1,0,.8,.6,0],3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(6),3));
  const physical=Array.from(geometry.attributes.position.array),normals=Array.from(geometry.attributes.normal.array);
  paintLandscape(THREE,geometry,3,()=>-20,()=>6,1.15);
  const color=geometry.attributes.color;
  const meadow=new THREE.Color().fromBufferAttribute(color,0),cliff=new THREE.Color().fromBufferAttribute(color,1);
  const rock=new THREE.Color(LANDSCAPE_STYLES[3].rock).convertSRGBToLinear();
  const distance=(a,b)=>Math.hypot(a.r-b.r,a.g-b.g,a.b-b.b);
  assert.ok(distance(cliff,rock)<distance(meadow,rock),'rocky colour belongs on the cliff');
  assert.ok(meadow.r>meadow.b*1.5,'the reunion meadow retains warm grass');
  assert.deepEqual(Array.from(geometry.attributes.position.array),physical);
  assert.deepEqual(Array.from(geometry.attributes.normal.array),normals);
  for(const chapter of [1,2,3]){
    paintLandscape(THREE,geometry,chapter,()=>-20,()=>6,1.15);
    assert.ok(Array.from(color.array).every(value=>Number.isFinite(value)&&value>=0&&value<=1));
  }
  geometry.dispose();
});

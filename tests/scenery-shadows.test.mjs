import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createSceneryShadows} from '../src/story/scenery-shadows.js';

function groundGeometry(rugged=false){
  const geometry=new THREE.PlaneGeometry(10.5,10.5,4,4);
  geometry.rotateX(-Math.PI/2);
  if(rugged){
    const positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i);
      positions.setY(i,1.3*Math.sin(x*1.1)+.8*Math.cos(z*.9)+((i%3)-1)*.7);
    }
    positions.needsUpdate=true;geometry.computeVertexNormals();
  }
  return geometry;
}
function projectedArea(geometry){
  const positions=geometry.attributes.position,index=geometry.index;let area=0;
  for(let i=0;i<index.count;i+=3){
    const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
    area+=Math.abs((positions.getX(b)-positions.getX(a))*(positions.getZ(c)-positions.getZ(a))
      -(positions.getZ(b)-positions.getZ(a))*(positions.getX(c)-positions.getX(a)))*.5;
  }
  return area;
}

test('A tiny soft shadow rasterizes only its oval instead of whole 2.625m ground tiles',()=>{
  const geometry=groundGeometry(),group=new THREE.Group();group.name='tiny-shadow';
  const patch={x:.31,z:.27,width:.6,length:.45,angle:.43};
  const shadows=createSceneryShadows(THREE,()=>0,geometry)(group,[patch]);
  assert.ok(shadows?.isMesh);assert.equal(group.children.length,1);
  const area=projectedArea(shadows.geometry),nominalOvalArea=Math.PI*patch.width*patch.length/4;
  assert.ok(area>nominalOvalArea*.75,'the shadow remains visible after clipping');
  assert.ok(area<=nominalOvalArea+1e-5,`shadow covers ${area}m² for a ${nominalOvalArea}m² oval`);
  const uv=shadows.geometry.attributes.uv;
  for(let i=0;i<uv.count;i++){
    assert.ok(uv.getX(i)>=-1e-6&&uv.getX(i)<=1+1e-6,'no transparent expanded U region');
    assert.ok(uv.getY(i)>=-1e-6&&uv.getY(i)<=1+1e-6,'no transparent expanded V region');
  }
});

test('Clipped shadow vertices and interiors match raycast rendered terrain despite different analytic height',()=>{
  const geometry=groundGeometry(true),ground=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  ground.updateMatrixWorld(true);
  // Deliberately wrong: a shadow that samples analytic hAt instead of actual
  // renderer triangles must fail even if all of its own heights are consistent.
  const group=new THREE.Group(),patch={x:.35,z:-.4,width:4.8,length:3.6,angle:.37};
  const shadows=createSceneryShadows(THREE,()=>-100,geometry)(group,[patch]);
  const positions=shadows.geometry.attributes.position,index=shadows.geometry.index;
  assert.ok(index.count>6,'the patch crosses several rugged rendered triangles');
  const raycaster=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),origin=new THREE.Vector3();
  let checked=0;
  function verify(x,y,z){
    origin.set(x,100,z);raycaster.set(origin,down);
    const hit=raycaster.intersectObject(ground,false)[0];
    assert.ok(hit,'shadow sample stays over rendered ground');
    assert.ok(Math.abs(y-hit.point.y-.035)<1e-4,`shadow height ${y} differs from raycast surface ${hit.point.y}`);
    checked++;
  }
  for(let i=0;i<positions.count;i++)verify(positions.getX(i),positions.getY(i),positions.getZ(i));
  for(let i=0;i<index.count;i+=3)for(const weights of [[1/3,1/3,1/3],[.1,.2,.7],[.8,.1,.1]]){
    let x=0,y=0,z=0;
    for(let k=0;k<3;k++){const vertex=index.getX(i+k);x+=positions.getX(vertex)*weights[k];y+=positions.getY(vertex)*weights[k];z+=positions.getZ(vertex)*weights[k];}
    verify(x,y,z);
  }
  assert.ok(checked>30,'oracle checks vertices and actual triangle interiors');
});

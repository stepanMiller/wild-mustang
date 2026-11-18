// Original meshes. Folded surfaces keep their silhouette at gameplay scale
// without texture alpha tests or a separate draw for each leaf.
import * as THREE from 'three';

function coloredGeometry(positions, colors) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function crownGeometry() {
  const shape = new THREE.IcosahedronGeometry(1, 1);
  const positions = shape.attributes.position;
  const colors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const edge = 1 + .16 * Math.sin(6*x - 9*z) * Math.cos(3*y + 5*z);
    positions.setXYZ(i, x*edge + .12*y, y*edge + .09*Math.sin(7*x+z), z*edge);
    const light = .64 + .28*y + .07*Math.sin(11*x+7*z);
    colors.push(light, light*.96+.04, light*.72+.18);
  }
  shape.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  shape.computeVertexNormals();
  return shape;
}

export function coniferWhorlGeometry() {
  const positions = [], colors = [];
  // Seven boughs fan down and then flick up at the tip. The V-shaped
  // notches between them break up the outline even against a bright sky.
  const point = (angle, radius, y) => [Math.cos(angle)*radius, y, Math.sin(angle)*radius];
  for (let i=0; i<7; i++) {
    const a = i*2*Math.PI/7, radius = .88 + .12*Math.sin(i*8.3);
    const tip = point(a, radius, -.32 + .09*Math.cos(3*i));
    const ridge = point(a, radius*.69, -.05);
    const left = point(a-.44,.50,-.25), right = point(a+.44,.50,-.25);
    for (const [p,q,r,tone] of [
      [[0,.54,0],ridge,left,.85], [[0,.54,0],right,ridge,1],
      [ridge,tip,left,.76], [ridge,right,tip,.9], [[0,-.16,0],left,tip,.53],
      [[0,-.16,0],tip,right,.61]
    ]) {
      positions.push(...p,...q,...r);
      for (let v=0; v<3; v++) colors.push(tone*.96,tone,tone*.93);
    }
  }
  return coloredGeometry(positions,colors);
}

export function willowSprayGeometry() {
  const positions=[], colors=[];
  for(let i=0;i<8;i++) {
    const a=i*2.4, x=.75*Math.cos(a), z=.64*Math.sin(a), drop=.65+.35*Math.sin(a*2);
    const sideX=.14*Math.sin(a), sideZ=-.14*Math.cos(a);
    const top=[x*.18,.8,z*.18], elbow=[x,.35,z], tip=[x*.91,-drop,z*.91];
    const left=[x-sideX,.24,z-sideZ],right=[x+sideX,.24,z+sideZ];
    for(const [p,q,r,light] of [[top,left,elbow,.87],[top,elbow,right,1],
      [left,tip,elbow,.72],[elbow,tip,right,.91]]) {
      positions.push(...p,...q,...r);
      for(let v=0;v<3;v++)colors.push(light*.96,light,light*.78);
    }
  }
  return coloredGeometry(positions,colors);
}

export function grassTuftGeometry() {
  const positions = [];
  for (let i=0; i<6; i++) {
    const a=i*2.40, sideX=Math.cos(a), sideZ=Math.sin(a);
    const lean=.25+.22*Math.sin(i*3.2+.5), height=.80+.32*Math.cos(i*2);
    const width=.047+.025*(i%3), bx=.14*sideZ, bz=-.14*sideX;
    const point=(r,y,f)=>[bx+r*sideX+f*sideZ,y,bz+r*sideZ-f*sideX];
    const left=point(-width,0,0), right=point(width,0,0);
    const ml=point(-width*.69,height*.61,lean*.32), mr=point(width*.69,height*.61,lean*.32);
    const tip=point(0,height,lean);
    positions.push(...left,...right,...ml,...right,...mr,...ml,...ml,...mr,...tip);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  return geometry;
}

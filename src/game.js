import * as THREE from 'three';
import { directionAngle, nearestSafeTrailPoint } from './navigation.js';
import { followCameraPosition, constrainCameraPosition } from './camera.js';
import { LANDSCAPE_STYLES, paintLandscape, ridgeGeometry, prairieFlowerGeometry } from './scene-style.js';
import { applyIcons } from './ui-icons.js';
import { createContactShadows } from './contact-shadows.js';
import { attachCharacters } from './characters/characters.js';
import { CHAPTERS, createStoryEnvironment } from './story/index.js';
import { readSave, writeSave, validateCheckpoint } from './persistence.js';
(function(){
'use strict';
const $ = s => document.querySelector(s);
applyIcons();
const clamp = (v,a,b) => v<a?a:(v>b?b:v);
const lerp = (a,b,t) => a+(b-a)*t;
const TAU = Math.PI*2;
function hashRand(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const valleyRand = hashRand(0x57A1C0DE);

/* ================================================================
   1. НАСТРОЙКИ И СОСТОЯНИЕ
   ================================================================ */
const S = {
  music:0.55, sfx:0.75, camSens:1.0, hints:true, subs:true, easy:false, quality:1
};
const G = {
  chapter:1, completedChapters:[], finished:false,
  questSteps:0, phase:'menu',        // menu | tutorial | meet | quests | cine | done
  tutStep:0,
  quest:0,             // индекс текущего задания
  trust:0, stamina:100, staminaMax:100,
  apples:0, applesNeeded:3,
  jumpPower:8.2, timeOfDay:0.30, playTime:0,
  paused:true, alexFollows:false, foalFreed:false, freeProgress:0,
  checkpoint:null, hasSave:false
};

/* ================================================================
   2. ЛАНДШАФТ
   ================================================================ */
const WATER_Y = 1.15;
function riverX(z){
  return -18 + Math.sin(z*0.035)*16 + Math.cos(z*0.012)*8 + Math.sin(z*0.082+1.1)*4.5;
}
function riverWidth(z){ return 5.2 + Math.sin(z*0.045+0.7)*1.1 + Math.cos(z*0.018)*0.9; }
function baseH(x,z){
  const ridgeA = Math.sin((x*0.038-z*0.022)+1.6)*2.0;
  const ridgeB = Math.sin((x*0.075+z*0.041)-0.8)*0.9;
  const longSlope = (z+GSIZE*0.18)*0.012 + Math.max(0,-x-35)*0.035;
  return Math.sin(x*0.045)*1.8 + Math.cos(z*0.038)*1.55
       + Math.sin((x+z)*0.021)*2.15 + ridgeA + ridgeB + longSlope
       + Math.sin(x*0.11+1.3)*0.55 + Math.cos(z*0.127)*0.35;
}
function hollow(x,z,cx,cz,rx,rz,depth){
  const q=((x-cx)*(x-cx))/(rx*rx)+((z-cz)*(z-cz))/(rz*rz);
  return -depth*Math.exp(-q);
}
function hAt(x,z){
  let h = baseH(x,z) + 7.6;
  h += hollow(x,z,36,-54,30,18,3.0) + hollow(x,z,-12,48,24,36,2.4);
  const rx = riverX(z), d = Math.abs(x - rx), w = riverWidth(z);
  const blend = Math.exp(-(d*d)/(w*w*4.8));
  const bed = 0.08 + Math.min(d*0.44, 3.8) + Math.sin(z*0.18)*0.10;
  h = h*(1-blend) + bed*blend;
  const bank = Math.exp(-((d-w*1.15)*(d-w*1.15))/(w*w*0.55));
  h += bank*0.9;
  // холм обзора стал выше и читается как путь к дальнему плану
  const dx = x+72, dz = z+64;
  h += 20*Math.exp(-(dx*dx+dz*dz)/720) + 4*Math.exp(-((x+95)*(x+95)+(z+72)*(z+72))/1800);
  // Two broad shallow fords: walking is enough, no mandatory jump.
  const ford = Math.max(Math.exp(-Math.pow(Math.max(0,Math.abs(z+6)-4)/6,4)), Math.exp(-Math.pow(Math.max(0,Math.abs(z-60)-4)/7,4)));
  h = Math.max(h, WATER_Y + 0.16*ford - 20*(1-ford));
  h += 12*Math.exp(-((x-88)*(x-88)+(z+76)*(z+76))/650);
  const reunion=Math.exp(-Math.pow(Math.hypot(x-96,z+92)/17,4));
  h=lerp(h,21.4,reunion);
  return h;
}
function normalAt(x,z){
  const e=0.9;
  const hl=hAt(x-e,z), hr=hAt(x+e,z), hd=hAt(x,z-e), hu=hAt(x,z+e);
  return new THREE.Vector3(hl-hr, 2*e, hd-hu).normalize();
}

/* ================================================================
   3. THREE.JS СЦЕНА
   ================================================================ */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setClearColor(0x2b1a0d);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .92;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xE9A65C, 0.004);
const camera = new THREE.PerspectiveCamera(56, 4/3, 0.5, 900);

const sun = new THREE.DirectionalLight(0xffd9a0, 2.0);
sun.position.set(-60, 40, 40);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xc6d9ed, 0x39432b, 0.42);
scene.add(hemi);
const fill = new THREE.DirectionalLight(0x9ec4ff, 0.16);
fill.position.set(50, 25, -40); scene.add(fill);
// A soft, warm rim separates the characters from the valley without the cost of shadows.
const rim = new THREE.DirectionalLight(0xff9a52, 0.22);
rim.position.set(-35, 12, -55); scene.add(rim);

/* --- небо --- */
const skyMat = new THREE.ShaderMaterial({
  side:THREE.BackSide, depthWrite:false,
  uniforms:{ top:{value:new THREE.Color(0x3E6FA8).convertSRGBToLinear()}, mid:{value:new THREE.Color(0xF0A24E).convertSRGBToLinear()},
             bot:{value:new THREE.Color(0xFBE0A0).convertSRGBToLinear()}, sunDir:{value:new THREE.Vector3(-1,.2,.4)} },
  vertexShader:`varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`
   uniform vec3 top,mid,bot,sunDir; varying vec3 vP;
   void main(){
     float y = clamp(vP.y*1.15+0.06,-1.,1.);
     vec3 c = y>0.0 ? mix(mid,top,pow(y,0.72)) : mix(mid,bot,pow(-y,0.55));
     float s = max(dot(normalize(vP), normalize(sunDir)),0.0);
     c += vec3(1.0,0.72,0.32)*pow(s,7.0)*0.85;
     c += vec3(1.0,0.85,0.55)*pow(s,120.0)*2.2;
     gl_FragColor = vec4(c,1.0);
     #include <tonemapping_fragment>
     #include <encodings_fragment>
   }`
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(600,32,20), skyMat));

/* --- земля --- */
const GSEG = 160, GSIZE = 420;
const groundGeo = new THREE.PlaneGeometry(GSIZE,GSIZE,GSEG,GSEG);
groundGeo.rotateX(-Math.PI/2);
(function(){
  const p = groundGeo.attributes.position, cols = [];
  const cGold = new THREE.Color(0xC9A24E).convertSRGBToLinear(), cGreen = new THREE.Color(0x7E9A50).convertSRGBToLinear(),
        cDry = new THREE.Color(0xA98A44).convertSRGBToLinear(), cRock = new THREE.Color(0x8B7960).convertSRGBToLinear(),
        cSand = new THREE.Color(0xC7B285).convertSRGBToLinear();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i), z=p.getZ(i), h=hAt(x,z);
    p.setY(i,h);
    const d = Math.abs(x - riverX(z));
    let c = cGold.clone().lerp(cDry, (Math.sin(x*0.07)*Math.cos(z*0.09)*0.5+0.5));
    if(d<26) c.lerp(cGreen, clamp(1-(d-4)/22,0,1)*0.85);
    if(d<5)  c.lerp(cSand, clamp(1-d/5,0,1));
    if(h>15) c.lerp(cRock, clamp((h-15)/8,0,1)*0.7);
    const scree = Math.max(0, Math.sin(x*0.19+z*0.11)*Math.cos(z*0.17));
    if(scree>0.72 && h>9 && d>riverWidth(z)+8) c.lerp(cRock, (scree-0.72)*1.4);
    cols.push(c.r,c.g,c.b);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols,3));
  groundGeo.computeVertexNormals();
})();
const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({vertexColors:true}));
scene.add(ground);

/* --- вода --- */
const waterMat = new THREE.MeshPhongMaterial({color:0x3F91A0, transparent:true, opacity:0.82,
  shininess:150, specular:0xffe6a8, side:THREE.DoubleSide});
waterMat.onBeforeCompile = sh => {
  sh.uniforms.uWaterTime = windU;
  sh.vertexShader = 'uniform float uWaterTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
    #include <begin_vertex>
    transformed.y += sin(position.z*.34 + uWaterTime*1.7)*.055;
    transformed.y += sin(position.z*.91 - uWaterTime*2.2)*.022;
  `);
  sh.fragmentShader = 'uniform float uWaterTime;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `
    float glint = pow(.5 + .5*sin(vViewPosition.z*1.7 + uWaterTime*2.4), 12.0);
    gl_FragColor.rgb += vec3(1.0,.72,.38)*glint*.13;
    #include <dithering_fragment>
  `);
};
function buildRiverGeometry(){
  const seg=96, verts=[], uvs=[], idx=[];
  for(let i=0;i<=seg;i++){
    const z=-GSIZE/2 + (i/seg)*GSIZE, x=riverX(z), w=riverWidth(z);
    verts.push(x-w, 0, z, x+w, 0, z);
    uvs.push(0,i/seg, 1,i/seg);
    if(i<seg){ const a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts,3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
const water = new THREE.Mesh(buildRiverGeometry(), waterMat);
water.position.y = WATER_Y;
scene.add(water);

/* --- горы: shared instanced silhouettes --- */
(function(){
  const rockM=new THREE.MeshLambertMaterial({color:new THREE.Color(0x7a6b7e).convertSRGBToLinear()});
  const snowM=new THREE.MeshLambertMaterial({color:new THREE.Color(0xf2e4d6).convertSRGBToLinear()});
  const peaks=new THREE.InstancedMesh(ridgeGeometry(THREE),rockM,30);
  const snowGeometry=ridgeGeometry(THREE,true),snowPeaks=[];
  const dummy=new THREE.Object3D();
  for(let i=0;i<30;i++){
    const a=i/30*TAU+valleyRand()*.12,r=210+valleyRand()*80;
    const height=40+valleyRand()*70,radius=24+valleyRand()*30,rotation=valleyRand()*TAU;
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    dummy.position.set(x,height*.42,z);dummy.rotation.set(0,rotation,0);dummy.scale.set(radius,height,radius);dummy.updateMatrix();peaks.setMatrixAt(i,dummy.matrix);
    if(height>78)snowPeaks.push(dummy.matrix.clone());
  }
  const caps=new THREE.InstancedMesh(snowGeometry,snowM,snowPeaks.length);
  snowPeaks.forEach((matrix,i)=>caps.setMatrixAt(i,matrix));
  scene.add(peaks,caps);
})();

/* --- облака --- */
const clouds = [];
(function(){
  const cv = document.createElement('canvas'); cv.width=cv.height=256;
  const g = cv.getContext('2d');
  for(let i=0;i<26;i++){
    const x=40+Math.random()*176, y=90+Math.random()*70, r=22+Math.random()*44;
    const rad=g.createRadialGradient(x,y,0,x,y,r);
    rad.addColorStop(0,'rgba(255,246,232,0.95)'); rad.addColorStop(1,'rgba(255,235,210,0)');
    g.fillStyle=rad; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  for(let i=0;i<16;i++){
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true,
      opacity:0.45+Math.random()*0.35, depthWrite:false, color:i%3?0xffe9cd:0xffd0a8}));
    const a=Math.random()*TAU, r=90+Math.random()*160;
    sp.position.set(Math.cos(a)*r, 48+Math.random()*46, Math.sin(a)*r);
    const s = 60+Math.random()*80; sp.scale.set(s, s*0.5, 1);
    clouds.push(sp); scene.add(sp);
  }
})();

/* --- трава (инстансы с ветром) --- */
let grass=null, grassCount=0, grassBase=[], grassAnchor=new THREE.Vector3(9999,0,9999);
const windU = {value:0};
function buildGrass(){
  if(grass){ scene.remove(grass); grass.geometry.dispose(); grass.material.dispose(); grass=null; }
  grassCount = [2200, 4000, 8000][S.quality];
  // Two crossed, tapered ribbons read as fine blades from every camera angle.
  // Unlike PlaneGeometry they finish in a point, removing the old card-like silhouette.
  const verts=[], indices=[];
  function blade(angle, height, width){
    const ca=Math.cos(angle), sa=Math.sin(angle), base=verts.length/3;
    const levels=[[0,width*.62],[height*.42,width*.48],[height*.78,width*.27],[height,0]];
    levels.forEach(v=>{ verts.push(-v[1]*ca,v[0],-v[1]*sa, v[1]*ca,v[0],v[1]*sa); });
    for(let j=0;j<3;j++){ const a=base+j*2; indices.push(a,a+1,a+2,a+1,a+3,a+2); }
  }
  blade(0,1.55,.23); blade(Math.PI/2,1.18,.17);
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position',new THREE.Float32BufferAttribute(verts,3)); bg.setIndex(indices);
  bg.computeVertexNormals();
  const cols=[]; const pos=bg.attributes.position;
  const grassStyle=LANDSCAPE_STYLES[G.chapter];
  const dark=new THREE.Color(grassStyle.grassDark).convertSRGBToLinear(), lite=new THREE.Color(grassStyle.grassLight).convertSRGBToLinear();
  for(let i=0;i<pos.count;i++){ const t=clamp(pos.getY(i)/1.5,0,1);
    const c=dark.clone().lerp(lite,t*t); cols.push(c.r,c.g,c.b); }
  bg.setAttribute('color', new THREE.Float32BufferAttribute(cols,3));
  const mat = new THREE.MeshLambertMaterial({vertexColors:true, side:THREE.DoubleSide});
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = windU;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0],instanceMatrix[3][1],instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float w = sin(uTime*1.5 + ip.x*0.32 + ip.z*0.27) + 0.4*sin(uTime*3.1 + ip.x*0.12);
      float k = pow(max(position.y,0.0)/1.5, 1.7);
      transformed.x += w*0.42*k;
      transformed.z += w*0.22*k;
    `);
  };
  grass = new THREE.InstancedMesh(bg, mat, grassCount);
  grass.frustumCulled = false;
  grassBase = [];
  for(let i=0;i<grassCount;i++)
    grassBase.push({x:(Math.random()-0.5)*110, z:(Math.random()-0.5)*110,
                    r:Math.random()*TAU, s:0.75+Math.random()*0.7});
  scene.add(grass);
  grassAnchor.set(9999,0,9999);
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(),
      _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
function refreshGrass(px,pz){
  const F = 110;
  for(let i=0;i<grassCount;i++){
    const b = grassBase[i];
    let x = ((b.x - px + F*0.5) % F + F) % F - F*0.5 + px;
    let z = ((b.z - pz + F*0.5) % F + F) % F - F*0.5 + pz;
    const y = hAt(x,z);
    const route=CHAPTERS[G.chapter].route;
    let routeDistance=Infinity;
    for(let j=1;j<route.length;j++){
      const a=route[j-1],b=route[j],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz || 1),0,1);
      routeDistance=Math.min(routeDistance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
    }
    const hide = y < WATER_Y+0.25 || routeDistance<2;
    const short=routeDistance<4 || Math.hypot(x-px,z-pz)<4;
    _p.set(x, y, z); _e.set(0,b.r,0); _q.setFromEuler(_e);
    _s.set(b.s, hide?0.01:b.s*(short?.25:.68)*(0.8+0.35*Math.sin(x*0.4+z*0.3)), b.s);
    _m.compose(_p,_q,_s); grass.setMatrixAt(i,_m);
  }
  grass.instanceMatrix.needsUpdate = true;
  grassAnchor.set(px,0,pz);
}

/* --- цветы (люпины из референса) --- */
(function(){
  const g = prairieFlowerGeometry(THREE);
  const m = new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  const im = new THREE.InstancedMesh(g,m,420);
  for(let i=0;i<420;i++){
    const cluster = i%3;
    const cx = cluster===0 ? -34 : (cluster===1 ? -55 : 20);
    const cz = cluster===0 ? -20 : (cluster===1 ? -40 : 18);
    const x=cx+(valleyRand()-0.5)*44, z=cz+(valleyRand()-0.5)*36, y=hAt(x,z);
    _p.set(x,y,z); _e.set(0,valleyRand()*TAU,0); _q.setFromEuler(_e);
    const k = y<WATER_Y+0.4?0.01:(0.65+valleyRand()*0.8);
    _s.set(k,k,k); _m.compose(_p,_q,_s); im.setMatrixAt(i,_m);
  }
  scene.add(im);
})();

/* ================================================================
   4. МОДЕЛИ ПЕРСОНАЖЕЙ
   ================================================================ */
const M = {
  coat:  new THREE.MeshLambertMaterial({color:0xC98A3E}),
  coatL: new THREE.MeshLambertMaterial({color:0xE0A860}),
  hair:  new THREE.MeshLambertMaterial({color:0x33231A}),
  hoof:  new THREE.MeshLambertMaterial({color:0x241A14}),
  white: new THREE.MeshLambertMaterial({color:0xF6EEDC}),
  eye:   new THREE.MeshLambertMaterial({color:0x1A1008}),
  skin:  new THREE.MeshLambertMaterial({color:0xE0AC82}),
  shirt: new THREE.MeshLambertMaterial({color:0xF2E4C8}),
  vest:  new THREE.MeshLambertMaterial({color:0x8A5A32}),
  pants: new THREE.MeshLambertMaterial({color:0xA8945F}),
  scarf: new THREE.MeshLambertMaterial({color:0xB2402E}),
  wood:  new THREE.MeshLambertMaterial({color:0x6B4A2E}),
  leaf:  new THREE.MeshLambertMaterial({color:0x5E7C3E}),
  leafLight: new THREE.MeshLambertMaterial({color:0x83994B}),
  rock:  new THREE.MeshLambertMaterial({color:0x8B8071, }),
  paleRock: new THREE.MeshLambertMaterial({color:0xE8E0C8, }),
  apple: new THREE.MeshLambertMaterial({color:0xC63A2E}),
  dark:  new THREE.MeshLambertMaterial({color:0x2A1C10, transparent:true, opacity:0.5})
};
Object.values(M).forEach(m=>m.color.convertSRGBToLinear());
function box(w,h,d,m){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m); }
function sph(r,m,sx,sy,sz){ const s=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),m);
  s.scale.set(sx||1,sy||1,sz||1); return s; }
function cyl(r1,r2,h,m){ return new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,8), m); }

function makeHorse(scale, coatMat){
  const g = new THREE.Group();
  const coat = coatMat || M.coat;
  const body = sph(1.05, coat, 1.0, 0.92, 1.65); body.position.set(0,1.55,0); g.add(body);
  const chest = sph(0.85, coat, 1.0, 1.0, 0.85); chest.position.set(0,1.62,0.9); g.add(chest);
  const rump = sph(0.9, coat, 1.0, 1.0, 0.9); rump.position.set(0,1.6,-1.0); g.add(rump);
  // Overlapping muscle masses keep the low-poly construction but give the horse
  // the proud chest and powerful hind-quarter silhouette of the key art.
  const shoulder = sph(.62,coat,1.02,1.22,.72); shoulder.position.set(0,1.72,.72); g.add(shoulder);
  const haunch = sph(.68,coat,1.03,1.18,.78); haunch.position.set(0,1.72,-.9); g.add(haunch);

  const neck = new THREE.Group(); neck.position.set(0,2.05,1.25); g.add(neck);
  const nk = cyl(0.42,0.6,1.5,coat); nk.position.set(0,0.6,0.2); nk.rotation.x=-0.42; neck.add(nk);
  const head = new THREE.Group(); head.position.set(0,1.22,0.68); neck.add(head);
  const skull = sph(0.36,coat,1,1.05,1.25); skull.position.set(0,0,0); head.add(skull);
  const muzzle = sph(0.26,coat,0.85,0.8,1.1); muzzle.position.set(0,-0.16,0.6); head.add(muzzle);
  const nose = sph(0.19,M.hoof,0.9,0.8,0.7); nose.position.set(0,-0.2,0.95); head.add(nose);
  const blaze = sph(0.11,M.white,0.9,0.5,0.6); blaze.position.set(0,0.2,0.4); head.add(blaze);
  [-1,1].forEach(s=>{
    const eyeWhite = sph(.105,M.white,1,.82,.55); eyeWhite.position.set(s*.265,.1,.31); head.add(eyeWhite);
    const eye = sph(0.072,M.eye); eye.position.set(s*0.285,0.1,0.34); head.add(eye);
    const shine = sph(.018,M.white); shine.position.set(s*.31,.125,.385); head.add(shine);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11,0.36,5), coat);
    ear.position.set(s*0.19,0.42,-0.06); ear.rotation.z=-s*0.18; head.add(ear);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.05,0.2,5), M.hair);
    fl.position.set(s*0.19,0.44,-0.03); head.add(fl);
  });
  [-1,1].forEach(s=>{ const nostril=sph(.035,M.eye,1,.55,.45); nostril.position.set(s*.11,-.22,.112); nose.add(nostril); });
  // грива
  const mane = new THREE.Group(); neck.add(mane);
  for(let i=0;i<9;i++){
    const t=i/8;
    const seg = box(0.16, 0.9-0.35*t, 0.5+0.35*(1-t), M.hair);
    seg.position.set(0, 0.15+t*1.28, 0.06+t*0.5);
    seg.rotation.x = -0.42 + t*0.25;
    seg.userData.ph = i*0.42; mane.add(seg);
  }
  const forelock = box(0.14,0.42,0.3,M.hair); forelock.position.set(0,1.62,0.72);
  forelock.rotation.x=0.3; neck.add(forelock);

  // хвост
  const tail = new THREE.Group(); tail.position.set(0,1.85,-1.75); g.add(tail);
  for(let i=0;i<5;i++){
    const t=i/4, seg = box(0.3-0.05*t, 0.62, 0.24, M.hair);
    seg.position.set(0,-0.28-i*0.5, -0.06-i*0.13); tail.add(seg);
  }

  // ноги
  const legs = [];
  const conf = [[-0.55,1.0,'f'],[0.55,1.0,'f'],[-0.6,-1.05,'b'],[0.6,-1.05,'b']];
  conf.forEach((c,i)=>{
    const hip = new THREE.Group(); hip.position.set(c[0], 1.42, c[1]); g.add(hip);
    const up = cyl(0.24,0.19,1.0,coat); up.position.y=-0.5; hip.add(up);
    const knee = new THREE.Group(); knee.position.y=-0.95; hip.add(knee);
    const lo = cyl(0.15,0.11,0.85,coat); lo.position.y=-0.42; knee.add(lo);
    const hf = cyl(0.15,0.17,0.22,M.hoof); hf.position.y=-0.92; knee.add(hf);
    legs.push({hip, knee, phase:[0,0.5,0.55,0.05][i], back:c[2]==='b'});
  });
  g.scale.setScalar(scale||1);
  g.userData = {legs, neck, head, mane, tail, body};
  return g;
}

function makeAlex(){
  const g = new THREE.Group();
  const torso = box(0.46,0.6,0.28,M.shirt); torso.position.y=1.12; g.add(torso);
  const vest = box(0.5,0.44,0.32,M.vest); vest.position.y=1.14; g.add(vest);
  const scarf = box(0.42,0.13,0.3,M.scarf); scarf.position.y=1.43; g.add(scarf);
  const neck = cyl(0.08,0.08,0.12,M.skin); neck.position.y=1.5; g.add(neck);
  const head = new THREE.Group(); head.position.y=1.72; g.add(head);
  const sk = sph(0.21,M.skin,1,1.08,0.95); head.add(sk);
  const hair = sph(0.225,M.hair,1.02,0.9,1.02); hair.position.set(0,0.07,-0.02); head.add(hair);
  const fringe = sph(.16,M.hair,1.25,.42,.72); fringe.position.set(-.035,.15,.15); fringe.rotation.z=-.16; head.add(fringe);
  [-1,1].forEach(s=>{
    const ear=sph(.04,M.skin,.58,1,.45); ear.position.set(s*.215,0,.0); head.add(ear);
    const ew=sph(.041,M.white,1,.82,.45); ew.position.set(s*.082,.005,.195); head.add(ew);
    const e=sph(.027,M.eye); e.position.set(s*.083,.005,.215); head.add(e);
    const brow=box(.075,.018,.018,M.hair); brow.position.set(s*.085,.072,.208); brow.rotation.z=s*.12; head.add(brow);
  });
  const nose=sph(.035,M.skin,.72,.9,.7); nose.position.set(0,-.025,.225); head.add(nose);
  const smile=new THREE.Mesh(new THREE.TorusGeometry(.055,.009,4,10,Math.PI),M.scarf);
  smile.position.set(0,-.09,.205); smile.rotation.z=Math.PI; head.add(smile);
  // A few asymmetric locks make Alex feel hand-drawn rather than assembled from boxes.
  for(let i=0;i<5;i++){
    const lock=new THREE.Mesh(new THREE.ConeGeometry(.045,.17,5),M.hair);
    lock.position.set((i-2)*.065,.22-Math.abs(i-2)*.018,.0); lock.rotation.z=(i-2)*.14; head.add(lock);
  }
  const arms=[], legs=[];
  [-1,1].forEach(s=>{
    const sh = new THREE.Group(); sh.position.set(s*0.28,1.35,0); g.add(sh);
    const a = cyl(0.07,0.06,0.52,M.shirt); a.position.y=-0.26; sh.add(a);
    const h = sph(0.075,M.skin); h.position.y=-0.55; sh.add(h);
    arms.push(sh);
    const hp = new THREE.Group(); hp.position.set(s*0.13,0.86,0); g.add(hp);
    const l = cyl(0.1,0.08,0.62,M.pants); l.position.y=-0.31; hp.add(l);
    const bt = box(0.16,0.2,0.26,M.vest); bt.position.set(0,-0.68,0.03); hp.add(bt);
    legs.push(hp);
  });
  const bag = box(0.2,0.24,0.12,M.vest); bag.position.set(0.24,1.0,0.04); g.add(bag);
  g.userData={arms,legs,head};
  return g;
}

const horse = makeHorse(1.0);
horse.position.set(20, hAt(20,24), 24);
scene.add(horse);

const alex = makeAlex();
alex.position.set(13, hAt(13,10), 10);
alex.visible = false;
scene.add(alex);

const foal = makeHorse(0.52, M.coatL);
foal.position.set(-52, hAt(-52,-36), -36);
scene.add(foal);

/* --- ветки над жеребёнком --- */
const branchGroup = new THREE.Group();
for(let i=0;i<5;i++){
  const b = cyl(0.14,0.1, 4.6+Math.random()*1.6, M.wood);
  b.position.set(-52+(Math.random()-0.5)*2, hAt(-52,-36)+1.1+i*0.25, -36+(Math.random()-0.5)*2);
  b.rotation.set(Math.PI/2*0.92 + (Math.random()-0.5)*0.35, Math.random()*TAU, (Math.random()-0.5)*0.5);
  branchGroup.add(b);
  const lf = sph(0.7,M.leaf,1,0.5,1); lf.position.copy(b.position); lf.position.y+=0.2;
  branchGroup.add(lf);
}
scene.add(branchGroup);
const originalBranches = branchGroup.children.slice();

/* --- препятствия: брёвна, камни, деревья --- */
const obstacles = [], cameraCanopies = [];
function addLog(x,z,rot){
  const y = hAt(x,z);
  const l = cyl(0.55,0.5,5.4,M.wood);
  l.rotation.set(Math.PI/2, rot||0, 0); l.position.set(x,y+0.5,z);
  scene.add(l); obstacles.push({x,z,r:1.5,top:y+1.1});
}
function addRock(x,z,s){
  const y=hAt(x,z);
  const r = sph(1.1*s, M.rock, 1, 0.75, 1.1);
  r.position.set(x,y+0.5*s,z); r.rotation.y=valleyRand()*TAU;
  scene.add(r); obstacles.push({x,z,r:1.1*s,top:y+1.1*s});
}
function addTree(x,z){
  const y=hAt(x,z);
  const t = cyl(0.27,0.48,4.1,M.wood); t.position.set(x,y+2.05,z); t.rotation.z=(valleyRand()-.5)*.1; scene.add(t);
  // Open, irregular prairie crowns let sunset light through instead of reading as snowmen.
  for(let i=0;i<7;i++){
    const a=valleyRand()*TAU, reach=.3+valleyRand()*1.25;
    const f = sph(.8+valleyRand()*.55, i%3?M.leaf:M.leafLight,
      1.25+valleyRand()*.35,.55+valleyRand()*.28,1.0+valleyRand()*.3);
    f.position.set(x+Math.cos(a)*reach, y+3.65+valleyRand()*1.65, z+Math.sin(a)*reach);
    f.rotation.y=a; scene.add(f);f.updateMatrix();
    f.geometry.computeBoundingBox();
    const bounds=f.geometry.boundingBox.clone().applyMatrix4(f.matrix);
    cameraCanopies.push({x:(bounds.min.x+bounds.max.x)/2,z:(bounds.min.z+bounds.max.z)/2,
      r:Math.hypot(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)/2,bottom:bounds.min.y,top:bounds.max.y});
  }
  obstacles.push({x,z,r:0.9,top:y+3.5});
}
function addWhiteRock(x,z,s){
  const y=hAt(x,z);
  const r = sph(1.0*s, M.paleRock, 1.15, 0.55, 0.9);
  r.position.set(x,y+0.35*s,z); r.rotation.y=valleyRand()*TAU;
  scene.add(r); obstacles.push({x,z,r:0.95*s,top:y+0.8*s});
}
function addBush(x,z,s){
  const y=hAt(x,z), g=new THREE.Group();
  for(let i=0;i<3;i++){
    const b=sph(0.55*s,M.leaf,1.25,0.55,1.0);
    b.position.set((valleyRand()-0.5)*0.7,y+0.32*s,(valleyRand()-0.5)*0.7); g.add(b);
  }
  g.position.set(x,0,z); scene.add(g);
}
addLog(14,14,0.2); addLog(2,-14,1.1); addLog(-40,-24,0.5);
[[-18,-6,0.9],[-24,-16,0.7],[-33,-25,0.8],[-47,-29,0.75],[-62,-45,1.1],[-78,-61,1.25],[10,5,0.65],[32,-46,1.0],[-10,60,0.9],[38,42,0.8]].forEach(p=>addRock(p[0],p[1],p[2]));
[[-30,12],[-56,-8],[-68,-58],[-90,-70],[22,34],[48,-20],[-6,74]].forEach(p=>addTree(p[0],p[1]));
[[-6,-18,0.8],[-42,-12,0.9],[-58,-34,0.7],[16,25,0.7],[50,30,0.8],[-84,-52,0.8]].forEach(p=>addBush(p[0],p[1],p[2]));
// Белые камни обозначают будущий брод: это только визуальный ориентир первой главы.
for(let i=0;i<9;i++){
  const z=52+i*2.2, x=riverX(z)+(i%2?-1:1)*(1.2+valleyRand()*2.2);
  addWhiteRock(x,z,0.34+valleyRand()*0.22);
}
for(let i=0;i<18;i++){
  const x=-95+valleyRand()*180, z=-88+valleyRand()*176;
  if(Math.abs(x-riverX(z))<riverWidth(z)+8) continue;
  if(valleyRand()<0.55) addRock(x,z,0.45+valleyRand()*0.55); else addBush(x,z,0.55+valleyRand()*0.35);
}

/* --- следы копыт --- */
const trackPool=[];
(function(){
  const g = new THREE.CircleGeometry(0.19,7); g.rotateX(-Math.PI/2);
  for(let i=0;i<48;i++){
    const m = new THREE.Mesh(g, M.dark.clone());
    m.visible=false; scene.add(m); trackPool.push(m);
  }
})();
let trackIdx=0, trackTimer=0;
function dropTrack(x,z,side){
  const m = trackPool[trackIdx=(trackIdx+1)%trackPool.length];
  m.position.set(x+side*0.5, hAt(x,z)+0.05, z);
  m.material.opacity=0.55; m.visible=true; m.userData.life=8;
}

/* --- след табуна (задание 1) --- */
const herdTrail = new THREE.Group();
for(let i=0;i<26;i++){
  const t=i/25;
  const x = 8 - t*10 + Math.sin(i)*1.2, z = -2 - t*16;
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.22,7), M.dark.clone());
  m.rotation.x=-Math.PI/2; m.position.set(x, hAt(x,z)+0.06, z);
  m.material.opacity=0.45; herdTrail.add(m);
}
scene.add(herdTrail);

/* --- яблоки --- */
const APPLE_POS = [[-40,-18],[-49,4],[-42,-30]];
const apples = APPLE_POS.map(p=>{
  const g = new THREE.Group();
  const a = sph(0.34,M.apple); g.add(a);
  const st = cyl(0.04,0.04,0.2,M.wood); st.position.y=0.3; g.add(st);
  const lf = sph(0.16,M.leaf,1,0.35,0.6); lf.position.set(0.13,0.33,0); g.add(lf);
  g.position.set(p[0], hAt(p[0],p[1])+1.1, p[1]);
  g.userData={taken:false, bx:p[0], bz:p[1]};
  scene.add(g); return g;
});

/* --- дальний табун --- */
const herd = new THREE.Group();
for(let i=0;i<5;i++){
  const h = makeHorse(0.9, i%2?M.coat:M.coatL);
  h.position.set(-95 - Math.random()*25, 0, -95 - Math.random()*30);
  h.position.y = hAt(h.position.x, h.position.z);
  h.rotation.y = Math.PI*0.75;
  herd.add(h);
}
herd.visible=false; scene.add(herd);

/* --- птицы --- */
const birds=[];
(function(){
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1,0,0, 0,0.28,0, 1,0,0],3));
  const m = new THREE.MeshBasicMaterial({color:0x3A2A1E, side:THREE.DoubleSide});
  for(let i=0;i<9;i++){
    const b = new THREE.Mesh(g,m); b.scale.setScalar(0.7+Math.random()*0.6);
    b.userData={a:Math.random()*TAU, r:40+Math.random()*70, y:24+Math.random()*20, sp:0.12+Math.random()*0.14};
    birds.push(b); scene.add(b);
  }
})();

/* ================================================================
   5. АУДИО
   ================================================================ */
const A = { ctx:null, master:null, mus:null, sfx:null, ready:false };
function initAudio(){
  if(A.ready) return;
  try{
    const C = window.AudioContext || window.webkitAudioContext;
    A.ctx = new C();
    A.master = A.ctx.createGain(); A.master.gain.value=1; A.master.connect(A.ctx.destination);
    A.mus = A.ctx.createGain(); A.mus.gain.value=S.music*0.5; A.mus.connect(A.master);
    A.sfx = A.ctx.createGain(); A.sfx.gain.value=S.sfx; A.sfx.connect(A.master);
    // шум ветра
    const len = A.ctx.sampleRate*2, buf = A.ctx.createBuffer(1,len,A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
    const src = A.ctx.createBufferSource(); src.buffer=buf; src.loop=true;
    const bp = A.ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=440; bp.Q.value=0.7;
    A.windGain = A.ctx.createGain(); A.windGain.gain.value=0.10;
    src.connect(bp); bp.connect(A.windGain); A.windGain.connect(A.sfx); src.start();
    // вода
    const src2 = A.ctx.createBufferSource(); src2.buffer=buf; src2.loop=true;
    const hp = A.ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=1800;
    A.waterGain = A.ctx.createGain(); A.waterGain.gain.value=0;
    src2.connect(hp); hp.connect(A.waterGain); A.waterGain.connect(A.sfx); src2.start();
    A.noiseBuf = buf;
    A.ready=true;
    scheduleMusic(); scheduleBirds();
  }catch(e){ console.warn('audio off', e); }
}
function tone(f,dur,type,gain,slide){
  if(!A.ready) return;
  const o=A.ctx.createOscillator(), g=A.ctx.createGain(), t=A.ctx.currentTime;
  o.type=type||'sine'; o.frequency.setValueAtTime(f,t);
  if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(40,slide), t+dur);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain||0.2,t+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(A.sfx); o.start(t); o.stop(t+dur+0.05);
}
function noiseHit(dur,freq,gain){
  if(!A.ready) return;
  const s=A.ctx.createBufferSource(); s.buffer=A.noiseBuf;
  const f=A.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=freq||300;
  const g=A.ctx.createGain(); const t=A.ctx.currentTime;
  g.gain.setValueAtTime(gain||0.16,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  s.connect(f); f.connect(g); g.connect(A.sfx);
  s.start(t); s.stop(t+dur+0.02);
}
const SCALE = [0,2,4,7,9,12,14,16];
function scheduleMusic(){
  if(!A.ready) return;
  const root = 174.6; // F3
  const play = ()=>{
    if(!A.ready) return;
    if(A.ctx.state==='suspended'){setTimeout(play,1000);return;}
    const t=A.ctx.currentTime;
    // мягкий аккорд-подушка
    [0,7,12,16].forEach((iv,i)=>{
      const o=A.ctx.createOscillator(), g=A.ctx.createGain();
      o.type = i<2?'sine':'triangle';
      o.frequency.value = root*Math.pow(2,iv/12)*(1+ (Math.random()-0.5)*0.004);
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(0.055,t+2.2);
      g.gain.linearRampToValueAtTime(0.0001,t+7.5);
      o.connect(g); g.connect(A.mus); o.start(t); o.stop(t+7.8);
    });
    // короткая мелодия
    for(let i=0;i<4;i++){
      const n = SCALE[(Math.random()*SCALE.length)|0];
      const o=A.ctx.createOscillator(), g=A.ctx.createGain();
      o.type='triangle'; o.frequency.value = root*2*Math.pow(2,n/12);
      const st = t+1.2+i*1.15;
      g.gain.setValueAtTime(0,st); g.gain.linearRampToValueAtTime(0.05,st+0.08);
      g.gain.exponentialRampToValueAtTime(0.0001,st+1.1);
      o.connect(g); g.connect(A.mus); o.start(st); o.stop(st+1.2);
    }
    setTimeout(play, 8600);
  };
  play();
}
function scheduleBirds(){
  const go = ()=>{
    if(A.ready && !G.paused && Math.random()<0.75){
      const f = 1500+Math.random()*1400;
      tone(f,0.09,'sine',0.05,f*1.6);
      setTimeout(()=>tone(f*1.2,0.07,'sine',0.04,f*0.8), 130);
    }
    setTimeout(go, 2600+Math.random()*5200);
  };
  setTimeout(go, 2400);
}
const SFX = {
  pick(){ tone(880,0.12,'sine',0.16,1320); setTimeout(()=>tone(1320,0.16,'sine',0.13),90); },
  quest(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,0.3,'triangle',0.13),i*110)); },
  jump(){ noiseHit(0.12,600,0.12); tone(320,0.14,'sine',0.07,520); },
  land(){ noiseHit(0.16,220,0.2); },
  step(){ noiseHit(0.09,260,0.13); },
  neigh(){ tone(420,0.5,'sawtooth',0.06,180); setTimeout(()=>tone(360,0.4,'sawtooth',0.05,150),160); },
  trust(){ [659,880,1174].forEach((f,i)=>setTimeout(()=>tone(f,0.4,'sine',0.1),i*130)); },
  snap(){ noiseHit(0.2,900,0.2); }
};

/* ================================================================
   6. УПРАВЛЕНИЕ (сенсор)
   ================================================================ */
const IN = { move:new THREE.Vector2(), gallop:false, jump:false, act:false };
const joyBase=$('#joyBase'), joyKnob=$('#joyKnob');
let joyId=null, joyHome={x:0,y:0}, joyOrigin={x:0,y:0}, joyR=68;
const pointers = new Map();
const heldButtons = new Map();
let camPointer=null, pinch=null;

function joyLayout(){
  const r = joyBase.getBoundingClientRect();
  joyHome = {x:r.left+r.width/2, y:r.top+r.height/2};
  joyR = r.width*0.45;
}
window.addEventListener('resize', ()=>{ clearInput(); joyLayout(); resize(); });

function onDown(e){
  if(G.paused) return;
  const t = e.target;
  if(t.closest && t.closest('.btn')) return;
  if(e.pointerType==='mouse' && e.button!==0) return;
  e.preventDefault();
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  try{ e.currentTarget.setPointerCapture(e.pointerId); }catch{}
  const leftZone = e.clientX < window.innerWidth*0.45;
  if(joyId===null && leftZone){
    joyId=e.pointerId;
    joyOrigin={x:e.clientX,y:e.clientY};
    joyBase.style.left = (e.clientX - joyBase.offsetWidth/2)+'px';
    joyBase.style.top  = (e.clientY - joyBase.offsetHeight/2)+'px';
    joyBase.style.bottom='auto'; joyBase.classList.add('active');
  } else if(camPointer===null && !leftZone){
    camPointer=e.pointerId;
  }
  if(pointers.size===2 && joyId===null){
    const p=[...pointers.values()];
    pinch = Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y);
  }
}
function onMove(e){
  if(!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(e.pointerId===joyId){
    let dx=e.clientX-joyOrigin.x, dy=e.clientY-joyOrigin.y;
    const d=Math.hypot(dx,dy), max=joyR;
    if(d>max){ dx=dx/d*max; dy=dy/d*max; }
    joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
    IN.move.set(dx/max, dy/max);
  } else if(e.pointerId===camPointer && (joyId!==null || pointers.size===1)){
    cam.yaw   += (e.clientX-prev.x)*0.0055*S.camSens;
    cam.pitch  = clamp(cam.pitch - (e.clientY-prev.y)*0.004*S.camSens, -0.25, 0.85);
    cam.manual = 1.4;
  }
  if(pointers.size===2 && joyId===null && pinch!==null){
    const p=[...pointers.values()];
    const d=Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y);
    cam.dist = clamp(cam.dist - (d-pinch)*0.035, 5.5, 22);
    pinch = d;
  }
}
function onUp(e){
  pointers.delete(e.pointerId);
  if(e.pointerId===joyId){
    joyId=null; IN.move.set(0,0);
    joyKnob.style.transform='translate(0,0)';
    joyBase.classList.remove('active');
    joyBase.style.left=''; joyBase.style.top=''; joyBase.style.bottom='';
  }
  if(e.pointerId===camPointer) camPointer=null;
  if(pointers.size<2) pinch=null;
}
canvas.addEventListener('pointerdown',onDown);
joyBase.addEventListener('pointerdown',onDown);
[canvas,joyBase].forEach(el=>el.addEventListener('lostpointercapture',onUp));
window.addEventListener('pointermove',onMove);
window.addEventListener('pointerup',onUp);
window.addEventListener('pointercancel',onUp);

function hold(el, on, off){
  el.addEventListener('pointerdown', e=>{
    if(G.paused || heldButtons.has(el)) return;
    e.stopPropagation(); e.preventDefault();
    heldButtons.set(el,e.pointerId);
    try{el.setPointerCapture(e.pointerId);}catch{}
    on();
  });
  ['pointerup','lostpointercapture','pointercancel'].forEach(ev=>
    el.addEventListener(ev, e=>{
      e.stopPropagation();
      if(heldButtons.get(el)!==e.pointerId) return;
      heldButtons.delete(el); off && off();
    }));
}
hold($('#btnGallop'), ()=>IN.gallop=true, ()=>IN.gallop=false);
hold($('#btnJump'),   ()=>{ IN.jump=true; }, ()=>{});
$('#btnAct').addEventListener('pointerdown', e=>{ e.stopPropagation(); doInteract(); });

// клавиатура — только запасной вариант для отладки на компьютере
const keys={};
window.addEventListener('keydown',e=>{
  if(G.paused || e.repeat) return;
  keys[e.code]=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if(e.code==='Space'){ IN.jump=true; e.preventDefault(); }
  if(e.code==='KeyE') doInteract();
});
window.addEventListener('keyup',e=>{ keys[e.code]=false; });

/* ================================================================
   7. КАМЕРА
   ================================================================ */
const cam = { yaw:Math.PI, pitch:0.22, dist:11.5, manual:0, pos:new THREE.Vector3(), look:new THREE.Vector3() };

/* ================================================================
   8. ЛОГИКА ГЕРОЯ
   ================================================================ */
const P = {
  x:20, z:24, y:hAt(20,24), heading:Math.PI, speed:0, vy:0, grounded:true,
  gait:0, gaitPhase:0, lastStep:0
};
function resetTo(x,z){
  P.x=x; P.z=z; P.y=hAt(x,z); P.vy=0; P.speed=0; P.grounded=true;
  horse.position.set(x,P.y,z);
  slopeQ.setFromUnitVectors(slopeUp,normalAt(x,z));
  headingQ.setFromAxisAngle(slopeUp,P.heading);slopeQ.multiply(headingQ);horse.quaternion.copy(slopeQ);
  cam.yaw=P.heading+Math.PI; cam.manual=0;
  cameraLookPoint();
  cam.pos.copy(constrainCameraPosition(cam.look,followCameraPosition(P,cam.yaw,cam.pitch,cam.dist),hAt,cameraBlocks));
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
}
function cameraLookPoint(){
  cam.look.set(P.x,P.y+2.4,P.z);
  if(G.phase==='done'){
    cam.look.x+=Math.cos(cam.yaw)*3.5;
    cam.look.z-=Math.sin(cam.yaw)*3.5;
  }
}

/* ================================================================
   9. ЗАДАНИЯ
   ================================================================ */
let QUESTS=CHAPTERS[1].quests;
const storyWorld=createStoryEnvironment(THREE,scene,hAt);
const cameraBlocks=[...obstacles,...cameraCanopies,...storyWorld.cameraObstacles()];
const convertedStoryMats=new Set();
Object.values(storyWorld.groups.chapters).forEach(g=>g.traverse(o=>{if(o.material?.color && !convertedStoryMats.has(o.material)){o.material.color.convertSRGBToLinear();convertedStoryMats.add(o.material);}}));
function questTarget(){
  if(G.phase==='meet') return [alex.position.x,alex.position.z];
  if(['tutorial','done','epilogue','cine','menu'].includes(G.phase)) return null;
  const q = QUESTS[G.quest];
  if(!q) return null;
  if(q.kind==='apples'){
    const a = apples.filter(x=>!x.userData.taken).sort((a,b)=>Math.hypot(P.x-a.userData.bx,P.z-a.userData.bz)-Math.hypot(P.x-b.userData.bx,P.z-b.userData.bz))[0];
    return a ? [a.userData.bx, a.userData.bz] : q.target;
  }
  if(q.id==='storm-ford' && P.x>riverX(-6)+7 && Math.abs(P.z+6)>4) return [riverX(-6)+9,-6];
  return q.target;
}
function updateTracker(){
  storyWorld.setQuest(['quests'].includes(G.phase)?G.quest:-1);
  $('#chapterTag').textContent='Глава '+G.chapter+' · '+CHAPTERS[G.chapter].title;
  $('#log .sub').textContent=CHAPTERS[G.chapter].title;
  const q = QUESTS[G.quest];
  if(G.phase==='tutorial'){ $('#trackTitle').textContent='Обучение';
    $('#trackSub').textContent=TUT[G.tutStep]?TUT[G.tutStep].s:''; return; }
  if(G.phase==='meet'){ $('#trackTitle').textContent='Познакомиться с Алексом';
    $('#trackSub').textContent='Подходи медленно. Не беги.'; return; }
  if(G.phase==='epilogue'){ $('#trackTitle').textContent='Мы дома'; $('#trackSub').textContent='Гуляй с семьёй. В меню можно повторить любую главу.'; return; }
  if(!q){ $('#trackTitle').textContent='Путешествие'; $('#trackSub').textContent=''; return; }
  let extra = q.s;
  if(q.kind==='apples') extra = `Собрано ${G.apples} из ${G.applesNeeded}. ${q.s}`;
  $('#trackTitle').textContent = q.t;
  $('#trackSub').textContent = extra;
}
function renderLog(){
  const el = $('#questList'); el.innerHTML='';
  QUESTS.forEach((q,i)=>{
    const done = i<G.quest, now = i===G.quest;
    const d = document.createElement('div');
    d.className='quest'+(done?' done':'')+(now?' now':'');
    d.innerHTML = `<div class="mk">${done?'✓':(i+1)}</div>
      <div class="tx"><b>${q.t}</b><span>${q.kind==='apples'?`Собрано ${G.apples} из ${G.applesNeeded}`:q.s}</span></div>`;
    el.appendChild(d);
  });
}
let questCooldown=0;
function completeQuest(){
  if(G.paused || G.phase!=='quests' || questCooldown>0) return;
  questCooldown=0.4;
  SFX.quest(); toast('Задание выполнено'); addTrust(6);
  const completed=QUESTS[G.quest];
  if(completed?.effect) storyWorld.applyEffect(completed.effect);
  completed?.lines?.forEach(line=>say(line.who,line.text));
  G.questSteps=0; G.quest++;
  if(G.quest>=QUESTS.length){ startFinale(); return; }
  saveCheckpoint(); updateTracker(); hint(QUESTS[G.quest].s);
}

/* --- обучение --- */
const TUT = [
  {s:'Проведи пальцем по джойстику слева — Ветер пойдёт шагом.', check:()=>P.speed>0.4},
  {s:'Проведи пальцем по правой половине экрана — осмотрись вокруг.', check:()=>cam.manual>0},
  {s:'Держи кнопку «Галоп» и беги по равнине.', check:()=>P.speed>7},
  {s:'Перепрыгни бревно: нажми большую кнопку прыжка.', check:()=>!P.grounded},
  {s:'Отлично. Впереди кто-то стоит в траве…', check:()=>true, delay:2.2}
];

/* ================================================================
   10. ВЗАИМОДЕЙСТВИЕ
   ================================================================ */
let actTarget=null;
function nearestAction(){
  if(G.paused) return null;
  if(G.phase==='meet'){
    const d=Math.hypot(P.x-alex.position.x,P.z-alex.position.z);
    return d<4.5 && G.trust>=35 ? {label:'Взять яблоко из руки',fn:acceptApple}:null;
  }
  if(G.phase!=='quests' && G.phase!=='epilogue') return null;
  const q=QUESTS[G.quest];
  if(G.phase==='quests' && q && q.kind==='interact' && Math.hypot(P.x-q.target[0],P.z-q.target[1])<(q.radius || 5.2))
    return {label:q.label,fn:questInteract};
  for(const a of apples){
    if(!a.userData.taken && Math.hypot(P.x-a.userData.bx,P.z-a.userData.bz)<3.4)
      return {label:'Взять яблоко',fn:()=>takeApple(a)};
  }
  if(G.alexFollows && Math.hypot(P.x-alex.position.x,P.z-alex.position.z)<3.4 && P.speed<1.2)
    return {label:'Погладить Ветра',fn:pet};
  return null;
}
function doInteract(){
  if(G.paused || questCooldown>0) return;
  const action=nearestAction();
  if(action) action.fn();
}
function takeApple(a){
  if(a.userData.taken || G.paused) return;
  a.userData.taken=true; a.visible=false;
  G.apples++; SFX.pick(); addTrust(5);
  toast('Яблоко +1');
  if(QUESTS[G.quest] && QUESTS[G.quest].kind==='apples' && G.apples>=G.applesNeeded) completeQuest();
  else { updateTracker(); saveCheckpoint(); }
}
function questInteract(){
  const q=QUESTS[G.quest]; if(!q || q.kind!=='interact' || G.phase!=='quests') return;
  G.questSteps++;
  if(q.effect==='foal-freed'){
    G.freeProgress=G.questSteps; SFX.snap();
    originalBranches.slice(0,G.freeProgress*2).forEach(b=>branchGroup.remove(b));
    if(G.questSteps>=(q.steps || 1)){G.foalFreed=true;branchGroup.clear();addTrust(14);SFX.neigh();}
  }
  if(q.effect==='ford-restored' || q.effect==='mountain-obstacle'){
    SFX.snap(); storyWorld.applyEffect(q.effect,G.questSteps);
  }
  if(q.effect==='meadow-rest'){G.stamina=G.staminaMax;SFX.trust();}
  if(q.effect==='reunion' || q.effect==='mountain-call') SFX.neigh();
  if(G.questSteps<(q.steps || 1)){
    hint(q.stepHints?.[G.questSteps-1] || 'Ещё немного, ты помогаешь друзьям.');
    questCooldown=.4;saveCheckpoint(); return;
  }
  completeQuest();
}
function pet(){
  addTrust(4); SFX.trust();
  say('Алекс', ['Ты уже совсем не боишься.','Хороший мальчик, Ветер.','Мы найдём твой табун. Обещаю.'][(Math.random()*3)|0]);
}
function acceptApple(){
  if(G.phase!=='meet' || G.paused) return;
  G.phase='quests';
  addTrust(30);
  alex.visible=true; G.alexFollows=true;
  SFX.trust();
  say('Алекс','Держи. Меня зовут Алекс. Пойдём искать твой табун вместе?');
  updateTracker(); hint(QUESTS[0].s);
  saveCheckpoint();
}
function addTrust(v){
  const before = G.trust;
  G.trust = clamp(G.trust+v, 0, 100);
  if(before<40 && G.trust>=40){ G.staminaMax=140; toast('Новая способность: долгий галоп'); SFX.trust(); }
  if(before<70 && G.trust>=70){ G.jumpPower=9.8; toast('Новая способность: высокий прыжок'); SFX.trust(); }
  if(before<100 && G.trust>=100){ toast('Полное доверие: Ветер бежит рядом сам'); SFX.trust(); }
}

/* ================================================================
   11. ИНТЕРФЕЙС
   ================================================================ */
let hintT=0, toastT=0, dlgT=0;
function hint(t){ if(!S.hints) return; $('#hint').textContent=t; $('#hint').classList.add('on'); hintT=5.5; }
function toast(t){ $('#toast').textContent=t; $('#toast').classList.add('on'); toastT=2.2; }
function say(who,text){
  if(!S.subs) return;
  $('#dlgWho').textContent=who; $('#dlgText').textContent=text;
  $('#dialog').classList.add('on'); dlgT=4.5;
}
function screen(id,on){ $(id).classList[on?'add':'remove']('on'); }
function pauseGame(p){
  G.paused=p;
  if(p){ clearInput(); if(A.ctx?.state==='running') A.ctx.suspend(); }
  else if(A.ctx?.state==='suspended') A.ctx.resume().catch(()=>{});
}

/* --- кнопки меню --- */
$('#btnPlay').onclick = ()=>startGame(false);
$('#btnContinue').onclick = ()=>{ if(G.hasSave||G.checkpoint) startGame(true); else startGame(false); };
$('#btnChapters').onclick = ()=>{renderChapters();screen('#chapters',true);};
$('#btnCloseChapters').onclick = ()=>screen('#chapters',false);
$('#btnSettings1').onclick = ()=>screen('#settings',true);
$('#btnSettings2').onclick = ()=>screen('#settings',true);
$('#btnCloseSettings').onclick = ()=>{screen('#settings',false);persist();};
$('#btnPause').onclick = ()=>{ saveCheckpoint(); pauseGame(true); screen('#pause',true); };
$('#btnResume').onclick = ()=>{ screen('#pause',false); pauseGame(false); };
$('#btnToMenu').onclick = ()=>{ screen('#pause',false); toMenu(); };
$('#btnUnstuck').onclick = ()=>{
  const chapter = CHAPTERS[G.chapter];
  const point = nearestSafeTrailPoint(chapter.route,P.x,P.z,(x,z)=>{
    const ground = hAt(x,z);
    return ground >= WATER_Y+.1 && !obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+1.5 && ground<o.top+.25);
  }) || chapter.spawn;
  resetTo(...point);
  saveCheckpoint();
  screen('#pause',false); pauseGame(false); toast('Ветер вернулся на тропу');
};
$('#btnMap').onclick = ()=>{ drawMap(); pauseGame(true); screen('#map',true); };
$('#btnCloseMap').onclick = ()=>{ screen('#map',false); pauseGame(false); };
$('#btnLog').onclick = ()=>{ renderLog(); pauseGame(true); screen('#log',true); };
$('#btnCloseLog').onclick = ()=>{ screen('#log',false); pauseGame(false); };
$('#btnAgain').onclick = ()=>startGame(false,G.chapter);
$('#btnNextChapter').onclick=()=>startGame(false,G.chapter+1);
$('#btnEpilogue').onclick=()=>{screen('#finish',false);G.phase='epilogue';G.finished=true;$('#hud').classList.add('on');pauseGame(false);storyWorld.setQuest(-1);updateTracker();saveCheckpoint();say('Алекс',CHAPTERS[3].epilogue[0].text);};
$('#btnFinMenu').onclick = ()=>{ screen('#finish',false); toMenu(); };

/* --- настройки --- */
$('#volMusic').oninput = e=>{ S.music=e.target.value/100; if(A.mus) A.mus.gain.value=S.music*0.5; };
$('#volSfx').oninput = e=>{ S.sfx=e.target.value/100; if(A.sfx) A.sfx.gain.value=S.sfx; };
$('#camSens').oninput = e=>{ S.camSens=e.target.value/100; };
function tg(id,key,after){
  $(id).addEventListener('pointerdown',e=>{ e.stopPropagation();
    S[key]=!S[key]; $(id).classList.toggle('on',S[key]); after&&after(); });
}
tg('#tgHints','hints',()=>{ if(!S.hints) $('#hint').classList.remove('on'); });
tg('#tgSubs','subs');
tg('#tgEasy','easy',()=>{ toast(S.easy?'Упрощённое управление включено':'Обычное управление'); });
document.querySelectorAll('.seg button').forEach(b=>{
  b.addEventListener('pointerdown',e=>{ e.stopPropagation();
    document.querySelectorAll('.seg button').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel'); S.quality=+b.dataset.q; applyQuality(); });
});
function applyQuality(){
  const mobileCap = /iPad|iPhone|Android|Mobile/.test(navigator.userAgent) ? 1.35 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, [1,1.35,Math.min(1.75,mobileCap)][S.quality]));
  buildGrass(); refreshGrass(P.x,P.z);
  clouds.forEach((c,i)=>c.visible = S.quality>0 || i<6);
}

/* --- сохранения --- */
const storage={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)};
function persist(){
  const ok=writeSave(storage,{checkpoint:G.checkpoint,completedChapters:G.completedChapters,settings:S});
  if(!ok) hint('Сохранение недоступно. Путешествие можно продолжить в этой вкладке.');
  $('#btnContinue').disabled=!G.checkpoint;
}
function saveCheckpoint(){
  if(!['tutorial','meet','quests','epilogue'].includes(G.phase)) return;
  const quest=G.phase==='epilogue'?QUESTS.length-1:G.quest;
  G.checkpoint={chapter:G.chapter,x:P.x,z:P.z,heading:P.heading,quest,trust:G.trust,
    apples:G.apples,phase:G.phase,tutStep:G.tutStep,
    alexFollows:G.alexFollows,taken:apples.map(a=>a.userData.taken),
    freeProgress:G.freeProgress,questSteps:G.questSteps,foalFreed:G.foalFreed,playTime:G.playTime};
  G.hasSave=true; persist();
}
function loadSave(){
  const saved=readSave(storage);
  if(!saved){ $('#btnContinue').disabled=true; return; }
  G.checkpoint=saved.checkpoint; G.hasSave=!!saved.checkpoint;
  G.completedChapters=saved.completedChapters;
  for(const key of ['music','sfx','camSens','quality']) if(Number.isFinite(saved.settings[key]))
    S[key]=clamp(saved.settings[key],key==='camSens'?0.2:0,key==='quality'?2:key==='camSens'?2:1);
  for(const key of ['hints','subs','easy']) if(typeof saved.settings[key]==='boolean') S[key]=saved.settings[key];
  $('#volMusic').value=S.music*100; $('#volSfx').value=S.sfx*100; $('#camSens').value=S.camSens*100;
  for(const [id,key] of [['#tgHints','hints'],['#tgSubs','subs'],['#tgEasy','easy']]) $(id).classList.toggle('on',S[key]);
  document.querySelectorAll('[data-q]').forEach(b=>b.classList.toggle('sel',+b.dataset.q===S.quality));
  $('#btnContinue').disabled=!G.checkpoint; applyQuality();
}
function resetWorld(){
  clearInput(); questCooldown=0; G.quest=0; G.trust=0; G.apples=0; G.freeProgress=0; G.questSteps=0;
  G.foalFreed=false; G.alexFollows=false; G.finished=false; G.playTime=0;
  G.stamina=100; G.staminaMax=100; G.jumpPower=8.2; G.tutStep=0;
  TUT[TUT.length-1].delay=2.2; alex._offered=false;
  alex.visible=false; alex.position.set(13,hAt(13,10),10);
  alex.userData.arms.forEach(a=>a.rotation.x=0);
  foal.visible=true; foal.userData.runAway=false; foal.position.set(-52,hAt(-52,-36),-36);
  originalBranches.forEach(b=>branchGroup.add(b)); branchGroup.visible=true;
  apples.forEach((a,i)=>{a.userData.taken=!CHAPTERS[G.chapter].apples[i];a.visible=!a.userData.taken;});
  herd.visible=false; trackPool.forEach(t=>t.visible=false);
  ['#dialog','#hint','#toast','#cine','#fadeOut'].forEach(id=>$(id).classList.remove('on'));
  G.timeOfDay=CHAPTERS[G.chapter].timeOfDay; cam.pitch=0.22; cam.dist=11.5; cam.manual=0;
}
function applyCheckpoint(checkpoint){
  const c=validateCheckpoint(checkpoint); if(!c) return false;
  configureChapter(c.chapter); resetWorld();
  G.chapter=c.chapter; G.quest=Math.min(c.quest,QUESTS.length-1); G.trust=c.trust;
  G.apples=c.apples; G.phase=c.phase; G.tutStep=c.tutStep;
  G.alexFollows=c.alexFollows; G.freeProgress=c.freeProgress; G.questSteps=c.questSteps; G.foalFreed=c.foalFreed;
  G.playTime=c.playTime;
  G.staminaMax=G.trust>=40?140:100; G.stamina=G.staminaMax; G.jumpPower=G.trust>=70?9.8:8.2;
  apples.forEach((a,i)=>{a.userData.taken=c.taken[i] || !CHAPTERS[c.chapter].apples[i];a.visible=!a.userData.taken;});
  alex.visible=G.alexFollows || G.phase==='meet';
  if(G.alexFollows) alex.position.set(c.x+3,hAt(c.x+3,c.z+2),c.z+2);
  if(G.foalFreed){ branchGroup.clear(); foal.position.set(c.x-4,hAt(c.x-4,c.z+3),c.z+3); }
  else originalBranches.slice(0,G.freeProgress*2).forEach(b=>branchGroup.remove(b));
  for(let i=0;i<G.quest;i++) if(QUESTS[i].effect) storyWorld.applyEffect(QUESTS[i].effect);
  if(G.questSteps && QUESTS[G.quest]?.effect) storyWorld.applyEffect(QUESTS[G.quest].effect,G.questSteps);
  branchGroup.visible=G.chapter===1 && !G.foalFreed; herd.visible=G.chapter===3;
  P.heading=c.heading; resetTo(c.x,c.z); cam.yaw=P.heading+Math.PI;
  return true;
}
function startGame(cont,chapter=1){
  if(!cont && chapter>1 && !G.completedChapters.includes(chapter-1)) return;
  initAudio();
  ['#start','#finish','#chapters','#pause','#map','#log','#settings'].forEach(id=>screen(id,false));
  $('#hud').classList.add('on'); joyLayout();
  if(cont && G.checkpoint && applyCheckpoint(G.checkpoint)) toast('Продолжаем путь');
  else {
    configureChapter(chapter);resetWorld();
    G.phase=chapter===1?'tutorial':'quests'; G.alexFollows=chapter>1; G.foalFreed=chapter>1;
    G.trust=chapter>1?80:0; G.staminaMax=chapter>1?140:100;G.stamina=G.staminaMax;G.jumpPower=chapter>1?9.8:8.2;
    const [x,z]=CHAPTERS[chapter].spawn; P.heading=chapter===3?Math.PI:chapter===2?0:Math.PI;resetTo(x,z);cam.yaw=P.heading+Math.PI;
    alex.visible=chapter>1;alex.position.set(x+3,hAt(x+3,z),z);
    if(chapter>1) foal.position.set(x-4,hAt(x-4,z+3),z+3);
    branchGroup.visible=chapter===1;herd.visible=chapter===3;
    CHAPTERS[chapter].opening.forEach(line=>say(line.who,line.text));
  }
  pauseGame(false); updateTracker(); saveCheckpoint();
  $('#btnSkipTutorial').hidden=G.phase!=='tutorial';
  hint(G.phase==='tutorial'?TUT[G.tutStep].s:QUESTS[G.quest]?.s || 'Подойди к Алексу.');
}
function toMenu(){
  saveCheckpoint(); pauseGame(true); $('#hud').classList.remove('on');
  ['#pause','#map','#log','#settings','#finish','#chapters'].forEach(id=>screen(id,false));
  screen('#start',true); $('#cine').classList.remove('on'); G.phase='menu'; renderChapters();
}
function finishTutorial(){
  if(G.phase!=='tutorial') return;
  G.phase='meet'; $('#btnSkipTutorial').hidden=true;
  alex.visible=true; alex.position.set(13,hAt(13,10),10);
  say('Алекс','Эй, ты один? Не бойся, я не обижу.');
  hint('Подойди к Алексу. Постой рядом и возьми яблоко из руки.');
  updateTracker(); saveCheckpoint();
}
$('#btnSkipTutorial').onclick=finishTutorial;
function clearInput(){
  IN.move.set(0,0); IN.gallop=false; IN.jump=false;
  Object.keys(keys).forEach(k=>delete keys[k]);
  pointers.clear(); joyId=null; camPointer=null; pinch=null;
  for(const [el,id] of heldButtons){
    try{el.releasePointerCapture(id);}catch{}
  }
  heldButtons.clear();
  joyKnob.style.transform='translate(0,0)'; joyBase.classList.remove('active');
  joyBase.style.left=''; joyBase.style.top=''; joyBase.style.bottom='';
}
window.addEventListener('blur',()=>{ if(!G.paused && G.phase!=='menu'){saveCheckpoint();pauseGame(true);screen('#pause',true);} clearInput(); });
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden) return;
  saveCheckpoint();
  if(!G.paused && G.phase!=='menu'){pauseGame(true);screen('#pause',true);}
  clearInput();
});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();saveCheckpoint();pauseGame(true);$('#errorText').textContent='Графика остановилась. Перезагрузи игру, чтобы продолжить с сохранённого места.';screen('#error',true);});

/* --- карта --- */
function drawMap(){
  const cv=$('#mapCanvas'), g=cv.getContext('2d'), R=110;
  const W=140;
  const off=document.createElement('canvas'); off.width=off.height=W;
  const og=off.getContext('2d');
  const img=og.createImageData(W,W);
  for(let py=0;py<W;py++) for(let px=0;px<W;px++){
    const x=(px/W-0.5)*2*R, z=(py/W-0.5)*2*R, h=hAt(x,z);
    let r,gg,b;
    if(h<WATER_Y+0.25){ r=78; gg=143; b=168; }
    else{
      const t=clamp((h-1.5)/16,0,1);
      r=lerp(126,190,t); gg=lerp(140,170,t); b=lerp(72,140,t);
      const d=Math.abs(x-riverX(z)), rw=riverWidth(z); if(d<rw){ r=78; gg=143; b=168; }
      else if(d<rw+16){ const k=1-(d-rw)/16; r=lerp(r,110,k*0.5); gg=lerp(gg,150,k*0.5); b=lerp(b,80,k*0.5); }
    }
    const i=(py*W+px)*4; img.data[i]=r; img.data[i+1]=gg; img.data[i+2]=b; img.data[i+3]=255;
  }
  og.putImageData(img,0,0);
  const FW=cv.width;
  g.imageSmoothingEnabled=true;
  g.clearRect(0,0,FW,FW);
  g.drawImage(off,0,0,FW,FW);
  const toPx = (x,z)=>[ (x/(2*R)+0.5)*FW, (z/(2*R)+0.5)*FW ];
  // цель
  const tp = questTarget();
  if(tp){ const [mx,my]=toPx(tp[0],tp[1]);
    g.fillStyle='#F2A93B'; g.beginPath(); g.arc(mx,my,11,0,TAU); g.fill();
    g.strokeStyle='#FBF0D9'; g.lineWidth=3; g.stroke(); }
  // игрок
  const [hx,hy]=toPx(P.x,P.z);
  g.save(); g.translate(hx,hy); g.rotate(-P.heading);
  g.fillStyle='#FBF0D9'; g.beginPath(); g.moveTo(0,-13); g.lineTo(9,10); g.lineTo(0,5); g.lineTo(-9,10);
  g.closePath(); g.fill(); g.restore();
}

/* ================================================================
   12. ФИНАЛЬНАЯ СЦЕНА
   ================================================================ */
let cineT=0, cineStep=0;
let CINE=CHAPTERS[1].cinematic;
function startFinale(){
  G.quest=QUESTS.length-1; saveCheckpoint();
  G.phase='cine'; cineT=0; cineStep=-1;
  cineStart.set(P.x,P.y,P.z);
  cineRunDuration=Math.max(1.2,Math.hypot(97-P.x,-94-P.z)/10);
  if(G.chapter===3){P.heading=Math.atan2(97-P.x,-94-P.z);}
  $('#cine').classList.add('on');
  herd.visible=true;
  IN.move.set(0,0); IN.gallop=false;
  P.speed=0;
  SFX.neigh();
}

/* ================================================================
   13. ГЛАВНЫЙ ЦИКЛ
   ================================================================ */
function resize(){
  const w=window.innerWidth, h=window.innerHeight;
  renderer.setSize(w,h,false);
  camera.aspect=w/h; camera.updateProjectionMatrix();
}
applyQuality(); resize(); joyLayout();
refreshGrass(P.x,P.z);

const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const frameDt=Math.min(clock.getDelta(),0.05);
  const dt=G.paused && G.phase!=='menu'?0:frameDt;
  questCooldown=Math.max(0,questCooldown-dt);
  windU.value += dt;

  if(!G.paused) G.playTime += dt;

  /* --- время суток --- */
  if(G.phase==='cine') G.timeOfDay = Math.min(0.72, G.timeOfDay + dt*0.005);
  else if(!G.paused) G.timeOfDay += dt*0.0016;
  const tod = G.timeOfDay % 1;
  const sunAng = (tod*0.82 + 0.09)*Math.PI;
  sun.position.set(Math.cos(sunAng)*130, Math.max(Math.sin(sunAng)*90, 6), 40+Math.sin(tod*3)*40);
  const low = clamp(1 - Math.sin(sunAng), 0, 1);
  const style=LANDSCAPE_STYLES[G.chapter];
  sun.color.setHex(style.light).convertSRGBToLinear();
  sun.intensity = lerp(1.05,.85,low);
  hemi.intensity = lerp(.60,.46,low);
  fill.color.setHex(style.fill).convertSRGBToLinear();
  rim.color.setHex(style.rim).convertSRGBToLinear();
  skyMat.uniforms.sunDir.value.copy(sun.position).normalize();
  skyMat.uniforms.top.value.setHex(style.sky).convertSRGBToLinear();
  skyMat.uniforms.mid.value.setHex(style.horizon).convertSRGBToLinear();
  skyMat.uniforms.bot.value.setHex(style.fog).convertSRGBToLinear();
  scene.fog.color.setHex(style.fog).convertSRGBToLinear();
  renderer.setClearColor(scene.fog.color);

  /* --- ввод --- */
  let mvx = IN.move.x, mvy = IN.move.y;
  if(keys['KeyW']||keys['ArrowUp']) mvy=-1;
  if(keys['KeyS']||keys['ArrowDown']) mvy=1;
  if(keys['KeyA']||keys['ArrowLeft']) mvx=-1;
  if(keys['KeyD']||keys['ArrowRight']) mvx=1;
  const galloping=IN.gallop || keys['ShiftLeft'] || keys['ShiftRight'];
  const mag = clamp(Math.hypot(mvx,mvy),0,1);

  const canMove = !G.paused && (G.phase==='tutorial'||G.phase==='meet'||G.phase==='quests'||G.phase==='epilogue');

  /* --- скорость и направление --- */
  let target = 0;
  if(canMove && mag>0.12){
    const wantGallop = (galloping || (S.easy && mag>0.92)) && G.stamina>1;
    target = wantGallop ? 12.0 : (mag>0.62 ? 6.0 : 3.0*mag/0.62);
    if(G.phase==='meet' && Math.hypot(P.x-alex.position.x,P.z-alex.position.z)<14) target=Math.min(target,3.0);
    const camDir = Math.atan2(-mvx, -mvy);
    const want = cam.yaw + Math.PI + camDir;
    let diff = ((want - P.heading + Math.PI*3) % TAU) - Math.PI;
    const turnRate = lerp(3.4, 1.7, clamp(P.speed/12,0,1));
    P.heading += clamp(diff, -turnRate*dt, turnRate*dt);
    if(wantGallop) G.stamina = Math.max(0, G.stamina - 20*dt);
  }
  if(target < 7) G.stamina = Math.min(G.staminaMax, G.stamina + (target<0.5?26:13)*dt);
  P.speed = lerp(P.speed, target, dt*(target>P.speed?3.2:5.0));

  /* --- прыжок --- */
  if(IN.jump){
    IN.jump=false;
    if(P.grounded && canMove){
      P.vy = G.jumpPower*(0.82+0.25*clamp(P.speed/12,0,1));
      P.grounded=false; SFX.jump();
    }
  }
  if(canMove && S.easy && P.grounded && P.speed>5){
    for(const o of obstacles){
      const fx = P.x + Math.sin(P.heading)*3.2, fz = P.z + Math.cos(P.heading)*3.2;
      if(Math.hypot(fx-o.x, fz-o.z) < o.r+0.6){ P.vy=G.jumpPower; P.grounded=false; SFX.jump(); break; }
    }
  }

  /* --- перемещение --- */
  if(canMove || !P.grounded){
    const nx = P.x + Math.sin(P.heading)*P.speed*dt;
    const nz = P.z + Math.cos(P.heading)*P.speed*dt;
    let blocked=false;
    for(const o of obstacles){
      const d = Math.hypot(nx-o.x, nz-o.z);
      if(d < o.r+1.1 && P.y < o.top){ blocked=true; break; }
    }
    if(!blocked){ P.x = clamp(nx,-105,105); P.z = clamp(nz,-105,105); }
    else P.speed *= 0.35;
  }
  const gh = hAt(P.x,P.z);
  if(!P.grounded){
    P.vy -= 22*dt; P.y += P.vy*dt;
    if(P.y <= gh){ P.y=gh; P.vy=0; P.grounded=true; SFX.land(); }
  } else {
    P.y = lerp(P.y, gh, clamp(dt*14,0,1));
  }
  // глубокая вода — мягкий возврат
  if(gh < WATER_Y-0.55 && P.grounded){
    const dir = P.x < riverX(P.z) ? -1 : 1;
    P.x += dir*3.2*dt*6; P.speed*=0.6;
    if(Math.random()<0.02) hint('Ищи белые камни у брода. Там мелко, можно идти шагом.');
  }

  horse.position.set(P.x,P.y,P.z);
  horse.userData.travelHeading=P.heading;
  slopeQ.setFromUnitVectors(slopeUp,normalAt(P.x,P.z));
  headingQ.setFromAxisAngle(slopeUp,P.heading);slopeQ.multiply(headingQ);
  horse.quaternion.slerp(slopeQ,clamp(dt*8,0,1));

  /* --- анимация лошади --- */
  const sp = P.speed;
  const gaitFreq = sp<0.2 ? 0 : lerp(1.5, 2.4, clamp(sp/12,0,1));
  P.gaitPhase += dt*gaitFreq*(0.6+sp*0.16);
  const hu = horse.userData;
  const amp = clamp(sp/6,0,1.25);
  hu.legs.forEach(l=>{
    const ph = (P.gaitPhase + l.phase)*TAU;
    if(P.grounded){
      l.hip.rotation.x = Math.sin(ph)*0.62*amp + (sp<0.2?Math.sin(windU.value*0.6+l.phase)*0.02:0);
      l.knee.rotation.x = Math.max(0, -Math.cos(ph))*0.85*amp;
    } else {
      l.hip.rotation.x = lerp(l.hip.rotation.x, l.back?0.7:-0.75, dt*8);
      l.knee.rotation.x = lerp(l.knee.rotation.x, 1.1, dt*8);
    }
  });
  const bob = Math.sin(P.gaitPhase*TAU*2)*0.09*amp;
  hu.body.position.y = 1.55 + bob;
  hu.neck.rotation.x = -0.06 + Math.sin(P.gaitPhase*TAU)*0.09*amp + (sp>9?-0.14:0);
  hu.head.rotation.x = Math.sin(P.gaitPhase*TAU+1.1)*0.07*amp;
  hu.mane.children.forEach(m=>{
    m.rotation.z = Math.sin(windU.value*3 + m.userData.ph)*0.1*(0.4+amp*0.9);
    m.rotation.x = -0.42 + Math.sin(windU.value*2.4 + m.userData.ph)*0.08*(0.3+amp);
  });
  hu.tail.rotation.x = 0.2 + Math.sin(windU.value*1.8)*0.09 + amp*0.24;
  hu.tail.rotation.z = Math.sin(windU.value*1.3)*0.12;

  /* --- шаги и следы --- */
  if(P.grounded && sp>0.6){
    const step = Math.floor(P.gaitPhase*2);
    if(step!==P.lastStep){
      P.lastStep=step; SFX.step();
      dropTrack(P.x - Math.sin(P.heading)*1.4, P.z - Math.cos(P.heading)*1.4, (step%2)?0.4:-0.4);
    }
  }
  trackPool.forEach(t=>{ if(t.visible){ t.userData.life-=dt;
    t.material.opacity = clamp(t.userData.life/8,0,1)*0.55;
    if(t.userData.life<=0) t.visible=false; } });

  /* --- Алекс --- */
  if(G.phase==='meet'){
    const d = Math.hypot(P.x-alex.position.x, P.z-alex.position.z);
    alex.rotation.y = Math.atan2(P.x-alex.position.x, P.z-alex.position.z);
    if(d<14){
      if(sp<3.4){ addTrust(dt*(d<7?9:5)); }
      else if(d<9 && sp>7){
        G.trust = Math.max(0, G.trust - dt*16);
        if(Math.random()<0.02) hint('Ветер пугается резких движений. Иди шагом.');
      }
    }
    if(G.trust>=35 && !alex._offered){
      alex._offered=true;
      say('Алекс','Тихо-тихо… Смотри, у меня яблоко. Подойди ближе.');
      const ua = alex.userData; ua.arms[1].rotation.x = -1.5;
    }
  }
  if(G.alexFollows && G.phase!=='cine'){
    const tx = P.x - Math.sin(P.heading)*3.6 - Math.cos(P.heading)*1.4;
    const tz = P.z - Math.cos(P.heading)*3.6 + Math.sin(P.heading)*1.4;
    const dx = tx-alex.position.x, dz = tz-alex.position.z;
    const d = Math.hypot(dx,dz);
    const asp = clamp(d*1.5, 0, Math.max(3.5, sp*1.05));
    if(d>0.5){
      alex.position.x += dx/d*asp*dt; alex.position.z += dz/d*asp*dt;
      alex.rotation.y = Math.atan2(dx,dz);
    }
    alex.position.y = lerp(alex.position.y, hAt(alex.position.x,alex.position.z), dt*10);
    const ua = alex.userData, w = windU.value*asp*2.2;
    ua.legs[0].rotation.x = Math.sin(w)*0.5*clamp(asp/3,0,1);
    ua.legs[1].rotation.x = -Math.sin(w)*0.5*clamp(asp/3,0,1);
    ua.arms[0].rotation.x = -Math.sin(w)*0.4*clamp(asp/3,0,1);
    ua.arms[1].rotation.x = Math.sin(w)*0.4*clamp(asp/3,0,1);
  }

  /* --- жеребёнок --- */
  if(G.foalFreed && G.phase!=='cine'){
    const tx=P.x-Math.sin(P.heading)*5, tz=P.z-Math.cos(P.heading)*5;
    const dx=tx-foal.position.x,dz=tz-foal.position.z,d=Math.hypot(dx,dz);
    const v=Math.min(12,Math.max(0,d-1)*1.6);
    if(d>1){foal.position.x+=dx/d*v*dt;foal.position.z+=dz/d*v*dt;foal.userData.travelHeading=Math.atan2(dx,dz);}
    foal.position.y=hAt(foal.position.x,foal.position.z);
    foal.userData.legs.forEach(l=>l.hip.rotation.x=Math.sin(windU.value*6+l.phase*TAU)*Math.min(v/6,1)*.6);
  } else if(foal.userData.runAway){
    foal.position.x -= 6*dt; foal.position.z -= 5*dt;
    foal.position.y = hAt(foal.position.x, foal.position.z);
    foal.userData.travelHeading = Math.atan2(-6,-5);
    foal.userData.legs.forEach(l=>{ l.hip.rotation.x=Math.sin((windU.value*7+l.phase*6))*0.7; });
    if(foal.position.x<-100) foal.visible=false;
  } else {
    foal.userData.head.rotation.x = Math.sin(windU.value*1.2)*0.1;
  }

  /* --- яблоки крутятся --- */
  apples.forEach((a,i)=>{ if(!a.userData.taken){
    a.rotation.y += dt*1.4;
    a.position.y = hAt(a.userData.bx,a.userData.bz)+1.0+Math.sin(windU.value*2+i)*0.14; }});

  /* --- птицы --- */
  birds.forEach(b=>{
    const u=b.userData; u.a += dt*u.sp;
    b.position.set(Math.cos(u.a)*u.r + P.x*0.3, u.y, Math.sin(u.a)*u.r + P.z*0.3);
    b.rotation.set(0, -u.a, Math.sin(windU.value*7+u.r)*0.5);
  });
  clouds.forEach(c=>{ c.position.x += dt*0.55; if(c.position.x>240) c.position.x=-240; });

  /* --- трава --- */
  if(grass && Math.hypot(P.x-grassAnchor.x, P.z-grassAnchor.z) > 10) refreshGrass(P.x,P.z);

  /* --- вода --- */
  water.position.y = WATER_Y + Math.sin(windU.value*0.9)*0.035;

  /* --- камера --- */
  if(G.phase==='menu') cam.yaw += dt*0.055;
  if(cam.manual>0) cam.manual -= dt;
  else if(sp>1.2){
    let diff = ((P.heading + Math.PI - cam.yaw + Math.PI*3)%TAU)-Math.PI;
    cam.yaw += diff*clamp(dt*1.5*clamp(sp/6,0,1),0,0.2);
  }
  cameraLookPoint();
  cam.pos.copy(constrainCameraPosition(cam.look,followCameraPosition(P,cam.yaw,cam.pitch,cam.dist,sp),hAt,cameraBlocks));
  camera.position.lerp(cam.pos, clamp(dt*7,0,1));
  camera.position.copy(constrainCameraPosition(cam.look,camera.position,hAt,cameraBlocks));
  camera.lookAt(cam.look);

  /* --- аудио позиционно --- */
  if(A.ready){
    const dRiver = Math.abs(P.x - riverX(P.z));
    A.waterGain.gain.value = clamp((1 - dRiver/26),0,1)*0.10*S.sfx;
    A.windGain.gain.value = (0.055 + clamp(sp/12,0,1)*0.1)*S.sfx;
  }

  /* --- прогресс сценария --- */
  if(G.phase==='tutorial' && !G.paused){
    const st = TUT[G.tutStep];
    if(st && st.check()){
      if(st.delay){ st.delay-=dt; if(st.delay>0){} }
      if(!st.delay || st.delay<=0){
        G.tutStep++;
        if(G.tutStep>=TUT.length){
          finishTutorial();
        } else {
          SFX.pick(); hint(TUT[G.tutStep].s); updateTracker();
        }
      }
    }
  }
  if(G.phase==='meet' && G.trust>=35 && Math.hypot(P.x-alex.position.x,P.z-alex.position.z)<4.2){
    // взаимодействие доступно через кнопку
  }
  if(G.phase==='quests' && !G.paused){
    const q = QUESTS[G.quest];
    if(q && q.kind==='zone'){
      if(Math.hypot(P.x-q.target[0], P.z-q.target[1]) < q.radius) completeQuest();
    }
    if(q && q.kind==='apples' && G.apples>=G.applesNeeded) completeQuest();
  }

  /* --- финал --- */
  if(G.phase==='cine'){
    cineT += dt;
    const step = Math.floor(cineT/4.2);
    if(step!==cineStep && step<CINE.length){
      cineStep=step;
      const el=$('#cineText'); el.classList.remove('on');
      setTimeout(()=>{ if(G.phase==='cine' && !G.paused){el.textContent=CINE[step]; el.classList.add('on');} }, 500);
    }
    cam.yaw+=dt*(G.chapter===3?.08:.12); cam.pitch=lerp(cam.pitch,.19,dt);
    cam.dist=lerp(cam.dist,G.chapter===3?14:13,dt*.8);
    if(G.chapter===3){
      const t=clamp(cineT/cineRunDuration,0,1);
      P.x=lerp(cineStart.x,97,t); P.z=lerp(cineStart.z,-94,t); P.y=hAt(P.x,P.z);
      P.speed=t<1?10:0; horse.position.set(P.x,P.y,P.z);horse.userData.travelHeading=P.heading;
      slopeQ.setFromUnitVectors(slopeUp,normalAt(P.x,P.z));
      headingQ.setFromAxisAngle(slopeUp,P.heading);slopeQ.multiply(headingQ);
      horse.quaternion.slerp(slopeQ,clamp(dt*8,0,1));
      foal.userData.travelHeading=Math.atan2(102-foal.position.x,-96-foal.position.z);
      foal.position.x=lerp(foal.position.x,102,dt*.6);foal.position.z=lerp(foal.position.z,-96,dt*.6);
      foal.position.y=hAt(foal.position.x,foal.position.z);
      alex.rotation.y=Math.atan2(P.x-alex.position.x,P.z-alex.position.z);
      alex.userData.arms[1].rotation.x=-2.4+Math.sin(cineT*4)*.12;
      herd.children.forEach((h,i)=>{
        const tx=97+Math.cos(i*TAU/5)*4.5,tz=-94+Math.sin(i*TAU/5)*4.5;
        h.position.x=lerp(h.position.x,tx,dt*.5); h.position.z=lerp(h.position.z,tz,dt*.5);
        h.position.y=hAt(h.position.x,h.position.z);h.userData.travelHeading=Math.atan2(P.x-h.position.x,P.z-h.position.z);
      });
    }else if(G.chapter===1){
      herd.children.forEach((h,i)=>{h.position.x-=dt*(1+i*.07);h.position.z-=dt*.5;h.position.y=hAt(h.position.x,h.position.z);});
    }
    if(cineT>CINE.length*4.2+2.5 && !G.finished && !G.paused) finishChapter();
  }

  /* --- UI обновления --- */
  $('#staminaFill').style.width = (G.stamina/G.staminaMax*100)+'%';
  $('#trustFill').style.width = G.trust+'%';
  $('#trustPct').textContent = Math.round(G.trust)+'%';
  $('#btnGallop').classList.toggle('dim', G.stamina<2);

  actTarget = G.paused ? null : nearestAction();
  const ab=$('#btnAct'); ab.disabled=questCooldown>0;
  if(actTarget){ ab.textContent=actTarget.label; ab.classList.add('on'); }
  else ab.classList.remove('on');

  if(hintT>0){ hintT-=dt; if(hintT<=0) $('#hint').classList.remove('on'); }
  if(toastT>0){ toastT-=dt; if(toastT<=0) $('#toast').classList.remove('on'); }
  if(dlgT>0){ dlgT-=dt; if(dlgT<=0) $('#dialog').classList.remove('on'); }

  alignCompanion(foal,dt); herd.children.forEach(h=>alignCompanion(h,dt));
  contactShadows.update();
  storyWorld.update(dt);
  cast.update(dt,{speed:P.speed,grounded:P.grounded,phase:G.phase,
    gesture:QUESTS[G.quest]?.effect==='meadow-rest' && G.phase==='quests'?'graze':undefined,
    herdGesture:G.phase==='cine' && G.chapter===3?'sniff':'graze',
    alexGesture:G.phase==='cine' && G.chapter===3?'wave':G.phase==='meet' && G.trust>=35?'offer':G.phase==='epilogue'?'wave':undefined});
  updateGuidance();
  renderer.render(scene,camera);
}

/* --- фон главного меню: живая сцена как на референсе --- */
(function menuPose(){
  camera.position.set(26, hAt(26,32)+4.4, 33);
  cam.yaw = Math.PI*0.86; cam.pitch=0.16; cam.dist=10;
  alex.visible=true; alex.position.set(17.6, hAt(17.6,22.6), 22.6);
  alex.rotation.y = Math.PI*0.75;
  alex.userData.arms[1].rotation.x = -1.3;
  G.timeOfDay = 0.30;
})();

const beacon=new THREE.Group();
const ring=new THREE.Mesh(new THREE.RingGeometry(1.8,2.1,32),new THREE.MeshBasicMaterial({color:0xf2c65b,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false}));
ring.rotation.x=-Math.PI/2; beacon.add(ring);
const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(.5),new THREE.MeshBasicMaterial({color:0xffde8b}));
diamond.position.y=3.2; beacon.add(diamond);scene.add(beacon);
function updateGuidance(){
  const t=questTarget(); beacon.visible=!!t && !G.paused && ['meet','quests'].includes(G.phase);
  const el=$('#direction'); el.hidden=!beacon.visible;
  if(!beacon.visible) return;
  beacon.position.set(t[0],hAt(...t)+.15,t[1]);diamond.rotation.y=windU.value;
  diamond.position.y=3.1+Math.sin(windU.value*2)*.3;
  const angle=directionAngle(P.x,P.z,t[0],t[1],cam.yaw);
  $('#directionArrow').style.transform=`rotate(${angle}rad)`;
  $('#directionDistance').textContent=Math.hypot(t[0]-P.x,t[1]-P.z)<10?'Рядом':'По тропе';
}
if((import.meta.env.DEV || __TEST_MODE__) && ['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('qa')){
  window.__WILD_MUSTANG_TEST__={
    snapshot:()=>({phase:G.phase,chapter:G.chapter,quest:G.quest,tutStep:G.tutStep,
      trust:G.trust,apples:G.apples,freeProgress:G.freeProgress,foalFreed:G.foalFreed,
      position:{x:P.x,y:P.y,z:P.z},grounded:P.grounded,speed:P.speed,paused:G.paused,
      heading:P.heading,camera:{yaw:cam.yaw,pitch:cam.pitch,dist:cam.dist,
        position:{x:camera.position.x,y:camera.position.y,z:camera.position.z},
        look:{x:cam.look.x,y:cam.look.y,z:cam.look.z}},
      characters:{...cast.status},gaits:cast.horses.map(h=>h.state),
      world:{rescuePieces:branchGroup.children.length,
        heroUp:new THREE.Vector3(0,1,0).applyQuaternion(horse.quaternion).toArray(),
        terrainUp:normalAt(P.x,P.z).toArray()},
      inputs:{x:IN.move.x,y:IN.move.y,gallop:IN.gallop,jump:IN.jump},completedChapters:G.completedChapters.slice(),
      action:nearestAction()?.label,render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles},settings:{...S}}),
    teleport:resetTo,target:questTarget,terrain:hAt,
    setInput:({x=0,y=0,gallop=false,jump=false})=>{IN.move.set(x,y);IN.gallop=gallop;IN.jump=jump;},
    cameraLook:()=>cam.manual=2,interact:doInteract,save:saveCheckpoint,
    finishCinematic:()=>cineT=CINE.length*4.2+3,
    objects:()=>({alex:{x:alex.position.x,z:alex.position.z},apples:apples.map(a=>({x:a.userData.bx,z:a.userData.bz,taken:a.userData.taken})),quests:QUESTS.map(q=>({...q})),obstacles:obstacles.map(o=>({...o}))})
  };
}

const cineStart=new THREE.Vector3();
let cineRunDuration=2;
const cast=attachCharacters({THREE,horse,foal,herd,alex});
const slopeUp=new THREE.Vector3(0,1,0),slopeQ=new THREE.Quaternion(),headingQ=new THREE.Quaternion();
function alignCompanion(actor,dt){
  if(!dt || !actor.visible) return;
  slopeQ.setFromUnitVectors(slopeUp,normalAt(actor.position.x,actor.position.z));
  headingQ.setFromAxisAngle(slopeUp,actor.userData.travelHeading ?? actor.rotation.y);
  slopeQ.multiply(headingQ);actor.quaternion.slerp(slopeQ,Math.min(1,dt*8));
}
const contactShadows=createContactShadows(THREE,scene,[{actor:horse,width:2.8,length:4.2},{actor:foal,width:1.5,length:2.3},{actor:alex,width:1.1,length:1.1},...herd.children.map(actor=>({actor,width:2.6,length:3.8}))],hAt,normalAt);
function configureChapter(id){
  G.chapter=id; QUESTS=CHAPTERS[id].quests; CINE=CHAPTERS[id].cinematic;
  cameraBlocks.splice(0,cameraBlocks.length,...obstacles,...cameraCanopies,...storyWorld.cameraObstacles(id));
  paintLandscape(THREE,groundGeo,id,riverX);
  if(grass){
    const tones=LANDSCAPE_STYLES[id],dark=new THREE.Color(tones.grassDark).convertSRGBToLinear(),light=new THREE.Color(tones.grassLight).convertSRGBToLinear();
    const p=grass.geometry.attributes.position,c=grass.geometry.attributes.color,tint=new THREE.Color();
    for(let i=0;i<p.count;i++){const t=clamp(p.getY(i)/1.5,0,1);tint.copy(dark).lerp(light,t*t);c.setXYZ(i,tint.r,tint.g,tint.b);}
    c.needsUpdate=true;
  }
  storyWorld.setChapter(id);
  const positions=CHAPTERS[id].apples;
  apples.forEach((a,i)=>{const p=positions[i]; a.visible=!!p; a.userData.taken=!p;
    if(p){a.userData.bx=p[0];a.userData.bz=p[1];a.position.set(p[0],hAt(...p)+1,p[1]);}});
  G.applesNeeded=positions.length;
  herd.children.forEach((h,i)=>{
    const x=id===3?97+Math.cos(i*TAU/5)*8:-95-i*2;
    const z=id===3?-94+Math.sin(i*TAU/5)*8:-95-i*3;
    h.position.set(x,hAt(x,z),z);h.rotation.y=id===3?Math.PI:.75*Math.PI;h.userData.travelHeading=h.rotation.y;
  });
}
function renderChapters(){
  document.querySelectorAll('[data-chapter]').forEach(b=>{
    const id=+b.dataset.chapter,done=G.completedChapters.includes(id),unlocked=id===1||G.completedChapters.includes(id-1);
    b.disabled=!unlocked;b.classList.toggle('done',done);b.classList.toggle('now',id===G.chapter);
    b.querySelector('span').textContent=done?'Пройдено. Можно повторить.':unlocked?'Можно начать.':'Сначала пройди главу '+(id-1)+'.';
  });
}
document.querySelectorAll('[data-chapter]').forEach(b=>b.onclick=()=>startGame(false,+b.dataset.chapter));
function finishChapter(){
  G.finished=true;
  if(!G.completedChapters.includes(G.chapter)) G.completedChapters.push(G.chapter);
  if(G.chapter<3){
    const [x,z]=CHAPTERS[G.chapter+1].spawn;
    G.checkpoint={chapter:G.chapter+1,x,z,heading:0,quest:0,trust:80,apples:0,taken:[false,false,false],
      phase:'quests',alexFollows:true,foalFreed:true,freeProgress:0,questSteps:0,tutStep:0,playTime:0};
  } else {G.phase='epilogue';saveCheckpoint();}
  persist();renderChapters();
  $('#cine').classList.remove('on');$('#hud').classList.remove('on');
  $('#finish h2').textContent=G.chapter===3?'Мы дома':G.chapter===1?'Мы идём вместе':'Малыш снова смелый';
  $('#finish .sub').textContent=CHAPTERS[G.chapter].ending;
  $('#finTrust').textContent=Math.round(G.trust)+'%';$('#finApples').textContent=G.chapter===1?G.apples+' из 3':'Друзья сыты';
  $('#finTime').textContent=Math.floor(G.playTime/60)+' мин '+Math.floor(G.playTime%60)+' сек';
  $('#btnNextChapter').hidden=G.chapter===3; $('#btnNextChapter').textContent=G.chapter===1?'К белым камням →':'К дальним горам →';
  $('#finishDetails').open=false;
  $('#btnEpilogue').hidden=G.chapter!==3; screen('#finish',true);G.phase='done';pauseGame(true);
  cam.dist=G.chapter===3?19:16;cam.pitch=.32;cameraLookPoint();
  cam.pos.copy(constrainCameraPosition(cam.look,followCameraPosition(P,cam.yaw,cam.pitch,cam.dist),hAt,cameraBlocks));
  camera.position.copy(cam.pos);camera.lookAt(cam.look);
}

/* --- старт --- */
let loaded=0;
const li=setInterval(()=>{loaded=Math.min(90,loaded+8);$('#loadBar').style.width=loaded+'%';},110);
let loadingDone=false;
function revealGame(){
  if(loadingDone) return;loadingDone=true;clearInterval(li);$('#loadBar').style.width='100%';
  const loading=$('#loading');if(loading){loading.style.opacity=0;setTimeout(()=>loading.remove(),500);}
}
cast.ready.then(revealGame);
// If the network stalls, the original playable models remain available.
setTimeout(revealGame,15000);
loadSave();
renderChapters();
updateTracker();
animate();
})();

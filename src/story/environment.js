import { CHAPTERS, chapterDefinition } from './chapters.js';

/** Original, deterministic scenery. Static pieces share geometry and draw batches. */
export const SCENERY_PALETTES = {
  1: { stone:0xe2d2ac, shade:0xa8947c, bark:0x70503b, leaf:0x849353, leafLight:0xaab56b, flowers:0xd5bb73, trail:0xc6ad74 },
  2: { stone:0xe8e0c9, shade:0xb4b3a0, bark:0x6b5544, leaf:0x78956b, leafLight:0xa7ba79, flowers:0xb09ec4, trail:0xd6c898 },
  3: { stone:0xa7afb4, shade:0x75868e, bark:0x665344, leaf:0x43675d, leafLight:0x698779, flowers:0xe7c888, trail:0xc9b58b }
};

export function createStoryEnvironment(THREE, scene, hAt) {
  const root = new THREE.Group();
  root.name = 'story-landmarks';
  scene.add(root);
  const chapters = {}, routes = {}, landmarks = {}, staticBatches = {}, routeSamples = {}, cameraBounds = {1:[],2:[],3:[]};
  const white = new THREE.MeshLambertMaterial({ color:0xe8dec9 });
  const bark = new THREE.MeshLambertMaterial({ color:0x62503a });
  const gold = new THREE.MeshLambertMaterial({ color:0xeabd56, emissive:0x4d310c });
  // Instance colors provide natural variation without a material/draw for every shade.
  const natural = new THREE.MeshLambertMaterial({ color:0xffffff });
  const flowerMat = new THREE.MeshLambertMaterial({ color:0xffffff, vertexColors:true, side:THREE.DoubleSide });
  const rockGeo = new THREE.DodecahedronGeometry(1,0);
  const trunkGeo = new THREE.CylinderGeometry(.2,.34,1,7);
  const leafGeo = new THREE.IcosahedronGeometry(1,0);
  const coneGeo = new THREE.ConeGeometry(1,1,7);
  const peakGeo = new THREE.ConeGeometry(1,1,5);
  const reedGeo = new THREE.CylinderGeometry(.028,.045,1,4);
  const fruitGeo = new THREE.SphereGeometry(.24,7,5);
  const postSignGeo = new THREE.TorusGeometry(.35,.065,5,11,Math.PI*1.5);
  const markerSignGeo = new THREE.TorusGeometry(.52,.085,6,16,Math.PI*1.5);
  const markerRingGeo = new THREE.RingGeometry(1.8,2.08,30);
  const markerBeaconGeo = new THREE.OctahedronGeometry(.30,0);
  const flowerGeo = flowerGeometry();
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  let chapterId = 1, questIndex = 0, elapsed = 0;
  const fordStones = [], mountainBranches = [], restRipples = [];

  function flowerGeometry() {
    const vertices=[],colors=[];
    function tri(a,b,c,color){
      for(const point of [a,b,c]){vertices.push(...point);colors.push(...color);}
    }
    // Five tiny folded petals and two crossed stems, all in one shared geometry.
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5, b=a+.45, c=a-.45;
      const tip=[Math.cos(a)*.19,.53,Math.sin(a)*.19];
      tri([0,.46,0],[Math.cos(b)*.10,.44,Math.sin(b)*.10],tip,[1,1,1]);
      tri([0,.46,0],tip,[Math.cos(c)*.10,.44,Math.sin(c)*.10],[.82,.87,.73]);
    }
    tri([-.018,0,0],[.018,0,0],[.015,.47,0],[.34,.49,.24]);
    tri([-.018,0,0],[.015,.47,0],[-.015,.47,0],[.34,.49,.24]);
    tri([0,0,-.018],[0,0,.018],[0,.47,.015],[.34,.49,.24]);
    tri([0,0,-.018],[0,.47,.015],[0,.47,-.015],[.34,.49,.24]);
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geo.computeVertexNormals();return geo;
  }
  function mesh(geo,mat,x,y,z,sx=1,sy=sx,sz=sx) {
    const item=new THREE.Mesh(geo,mat);
    item.position.set(x,y,z);item.scale.set(sx,sy,sz);return item;
  }
  function seeded(seed) {
    let value=seed>>>0;
    return ()=>{
      value+=0x6D2B79F5;
      let t=Math.imul(value^(value>>>15),value|1);
      t^=t+Math.imul(t^(t>>>7),t|61);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }
  function staticPiece(group,geo,color,x,y,z,sx=1,sy=sx,sz=sx,rx=0,ry=0,rz=0,material=natural) {
    const batches=staticBatches[group.userData.chapter];
    let batch=batches.find(item=>item.geometry===geo&&item.material===material);
    if(!batch){batch={geometry:geo,material,items:[]};batches.push(batch);}
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();
    batch.items.push({matrix:dummy.matrix.clone(),color});
    if(geo===leafGeo || geo===coneGeo){
      if(!geo.boundingBox)geo.computeBoundingBox();
      const bounds=geo.boundingBox.clone().applyMatrix4(dummy.matrix);
      cameraBounds[group.userData.chapter].push({x:(bounds.min.x+bounds.max.x)/2,z:(bounds.min.z+bounds.max.z)/2,
        r:Math.hypot(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)/2,bottom:bounds.min.y,top:bounds.max.y});
    }
  }
  function finishBatches(group) {
    const batches=staticBatches[group.userData.chapter];
    batches.forEach((batch,index)=>{
      const item=new THREE.InstancedMesh(batch.geometry,batch.material,batch.items.length);
      item.name=`chapter-${group.userData.chapter}-static-${index}`;
      batch.items.forEach((piece,i)=>{
        item.setMatrixAt(i,piece.matrix);
        if(batch.material===natural||batch.material===flowerMat)item.setColorAt(i,tint.setHex(piece.color).convertSRGBToLinear());
      });
      item.instanceMatrix.needsUpdate=true;
      if(item.instanceColor)item.instanceColor.needsUpdate=true;
      group.add(item);
    });
  }
  function stone(group,x,z,size=1,color=SCENERY_PALETTES[group.userData.chapter].stone) {
    staticPiece(group,rockGeo,color,x,hAt(x,z)+size*.28,z,size*1.14,size*.70,size*.84,.14,Math.sin(x*1.8+z)*2,.1);
  }
  function movingStone(group,x,z,size=.75) {
    const item=mesh(rockGeo,white,x,hAt(x,z)+size*.28,z,size*1.14,size*.70,size*.84);
    item.rotation.set(.14,Math.sin(x*1.8+z)*2,.1);group.add(item);return item;
  }
  function pointCurve(points) {
    return new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
  }
  function buildTrail(group,definition) {
    const curve=pointCurve(definition.route),samples=180,vertices=[],indices=[];
    routeSamples[definition.id]=curve.getPoints(samples);
    for(let i=0;i<=samples;i++){
      const t=i/samples,p=curve.getPoint(t),tangent=curve.getTangent(t),width=definition.id===3?2.7:2.4;
      const nx=-tangent.z*width*.5,nz=tangent.x*width*.5;
      for(const side of [-1,1]){const x=p.x+nx*side,z=p.z+nz*side;vertices.push(x,hAt(x,z)+.065,z);}
      if(i<samples){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
    const mat=new THREE.MeshLambertMaterial({color:SCENERY_PALETTES[definition.id].trail,transparent:true,opacity:.54,side:THREE.DoubleSide,depthWrite:false});
    const trail=new THREE.Mesh(geo,mat);trail.renderOrder=1;group.add(trail);routes[definition.id]=trail;
    const footprintGeo=new THREE.CircleGeometry(.16,7);footprintGeo.rotateX(-Math.PI/2);
    const footMat=new THREE.MeshBasicMaterial({color:0x5c4a2d,transparent:true,opacity:.48,depthWrite:false});
    const count=150,prints=new THREE.InstancedMesh(footprintGeo,footMat,count*2);
    prints.name=`chapter-${definition.id}-hoofprints`;
    for(let i=0;i<count;i++){
      const t=i/(count-1),p=curve.getPoint(t),a=curve.getTangent(t);
      for(let k=0;k<2;k++){
        const side=k===0?-.26:.26,x=p.x-a.z*side,z=p.z+a.x*side;
        dummy.position.set(x,hAt(x,z)+.082,z);dummy.rotation.set(0,Math.atan2(a.x,a.z),0);dummy.scale.set(.86,1,1.25);dummy.updateMatrix();prints.setMatrixAt(i*2+k,dummy.matrix);
      }
    }
    group.add(prints);
    for(let i=1;i<definition.route.length-1;i+=2){
      const [x,z]=definition.route[i],before=definition.route[i-1],after=definition.route[i+1];
      const yaw=Math.atan2(after[0]-before[0],after[1]-before[1]),ox=x+Math.cos(yaw)*3.2,oz=z-Math.sin(yaw)*3.2,y=hAt(ox,oz);
      staticPiece(group,trunkGeo,SCENERY_PALETTES[definition.id].bark,ox,y+1.1,oz,.75,2.2,.75);
      staticPiece(group,postSignGeo,0xffffff,ox,y+1.9,oz,1,1,1,0,yaw,Math.PI*1.25,gold);
    }
  }
  function landmark(group,q,index,id) {
    const [x,z]=q.target,y=hAt(x,z),marker=new THREE.Group();marker.name=q.id;marker.position.set(x,y,z);
    marker.add(mesh(rockGeo,white,0,.25,0,1.2,.50,1));
    const sign=mesh(markerSignGeo,gold,0,1.25,0);sign.rotation.z=Math.PI*1.25;marker.add(sign);
    const glow=new THREE.Mesh(markerRingGeo,new THREE.MeshBasicMaterial({color:0xffd681,transparent:true,opacity:.48,side:THREE.DoubleSide,depthWrite:false}));
    glow.rotation.x=-Math.PI/2;glow.position.y=.11;marker.add(glow);
    const beacon=mesh(markerBeaconGeo,gold,0,3.1,0);marker.add(beacon);marker.userData={index,id,sign,glow,beacon};group.add(marker);return marker;
  }
  function willow(group,x,z,scale=1,seed=1) {
    const y=hAt(x,z),p=SCENERY_PALETTES[group.userData.chapter],random=seeded(seed),lean=(random()-.5)*.16;
    staticPiece(group,trunkGeo,p.bark,x,y+2.5*scale,z,1.05*scale,5*scale,.90*scale,0,0,lean);
    // Open crowns with irregular spreading boughs and pendant leaf clusters.
    // The center stays lighter than the outer, falling tips: no solid green ball.
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3+random()*.45,r=.65*scale;
      staticPiece(group,leafGeo,i%2?p.leaf:p.leafLight,x+Math.cos(a)*r,y+(5.2+random()*.5)*scale,z+Math.sin(a)*r,1.8*scale,.8*scale,1.35*scale,.10,a,.14);
    }
    for(let i=0;i<7;i++){
      const a=i*Math.PI*2/7+random()*.35,reach=(1.6+random()*.75)*scale;
      staticPiece(group,leafGeo,i%3?p.leaf:p.leafLight,x+Math.cos(a)*reach,y+(4.2+random()*.4)*scale,z+Math.sin(a)*reach,(.78+random()*.3)*scale,1.7*scale,.60*scale,.14,a,.12);
      if(i===1||i===4){
        staticPiece(group,trunkGeo,p.bark,x+Math.cos(a)*reach*.45,y+4.0*scale,z+Math.sin(a)*reach*.45,.38*scale,2.6*scale,.38*scale,Math.sin(a)*.85,0,-Math.cos(a)*.85);
      }
    }
  }
  function pine(group,x,z,scale=1,seed=1) {
    const y=hAt(x,z),p=SCENERY_PALETTES[3],random=seeded(seed),lean=(random()-.5)*.08;
    staticPiece(group,trunkGeo,p.bark,x,y+2.7*scale,z,.82*scale,5.4*scale,.82*scale,0,0,lean);
    for(let i=0;i<4;i++){
      const spread=(2.25-i*.45)*scale,ox=(random()-.5)*.34*scale,oz=(random()-.5)*.34*scale;
      staticPiece(group,coneGeo,i%2?p.leaf:p.leafLight,x+ox,y+(2.7+i*1.22)*scale,z+oz,spread,2.5*scale,spread*(.84+random()*.12),lean,random()*Math.PI*2,lean*.5);
    }
  }
  function appleTree(group,x,z) {
    willow(group,x,z,.9,759);
    for(let i=0;i<11;i++){
      const a=i*2.4;staticPiece(group,fruitGeo,0xc54836,x+Math.cos(a)*1.9,hAt(x,z)+4+Math.sin(i*.6)*.8,z+Math.sin(a)*1.9);
    }
  }
  function reeds(group,x,z,seed) {
    const p=SCENERY_PALETTES[2],random=seeded(seed);
    for(let i=0;i<18;i++){
      const ox=x+(random()-.5)*2.6,oz=z+(random()-.5)*2.0,height=.9+random()*.7,y=hAt(ox,oz);
      staticPiece(group,reedGeo,p.leaf,ox,y+height*.5,oz,1,height,1,(random()-.5)*.2,0,(random()-.5)*.2);
      if(i%3===0)staticPiece(group,reedGeo,p.bark,ox,y+height*.9,oz,2.0,height*.22,2.0,0,0,.08);
    }
  }
  function routeDistance(id,x,z) {
    let nearest=Infinity;const route=routeSamples[id];
    for(let i=1;i<route.length;i++){
      const {x:ax,z:az}=route[i-1],{x:bx,z:bz}=route[i],dx=bx-ax,dz=bz-az;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));
      nearest=Math.min(nearest,Math.hypot(x-ax-t*dx,z-az-t*dz));
    }
    return nearest;
  }
  function flowerPatch(group,x,z,count,seed,radius=4) {
    const id=group.userData.chapter,p=SCENERY_PALETTES[id],random=seeded(seed);
    for(let i=0;i<count;i++){
      const a=random()*Math.PI*2,r=Math.sqrt(random())*radius,ox=x+Math.cos(a)*r,oz=z+Math.sin(a)*r;
      // Keep the route readable and leave the shallow crossing clear for the child.
      if(routeDistance(id,ox,oz)<2.2||hAt(ox,oz)<1.6)continue;
      const scale=.75+random()*.6;
      staticPiece(group,flowerGeo,i%5===0?0xf0e2c2:p.flowers,ox,hAt(ox,oz)+.02,oz,scale,scale,scale,0,random()*Math.PI*2,0,flowerMat);
    }
  }
  function rockCluster(group,x,z,scale,seed) {
    const p=SCENERY_PALETTES[group.userData.chapter],random=seeded(seed);
    stone(group,x,z,scale,p.stone);
    for(let i=0;i<2;i++){
      const a=random()*Math.PI*2,r=scale*(.8+random()*.45),size=scale*(.25+random()*.25);
      const ox=x+Math.cos(a)*r,oz=z+Math.sin(a)*r;
      if(routeDistance(group.userData.chapter,ox,oz)>2.2+size*1.14)stone(group,ox,oz,size,i===0?p.shade:p.stone);
    }
  }

  for(const id of [1,2,3]){
    const group=new THREE.Group();group.name=`chapter-${id}-scenery`;group.userData.chapter=id;
    root.add(group);chapters[id]=group;staticBatches[id]=[];buildTrail(group,CHAPTERS[id]);
    landmarks[id]=CHAPTERS[id].quests.map((q,i)=>landmark(group,q,i,id));
  }
  // Chapter one retains the original valley, branch rescue and orchard in game.js.
  const c1=chapters[1];
  for(const [x,z,s] of [[-9,-9,.7],[-12,-4,.8],[-17,-6,.72],[-22,-6,.68],[-28,-5,.8]])stone(c1,x,z,s);
  rockCluster(c1,-76,-66,2,11);rockCluster(c1,-71,-68,1.2,12);
  for(const [x,z,s] of [[28,33,.88],[4,17,.72],[-21,4,.86],[-63,-15,.86]])willow(c1,x,z,s,Math.round(x*z));
  for(const [x,z,seed] of [[27,30,101],[-28,-1,102],[-55,-27,103],[-68,-61,104]])flowerPatch(c1,x,z,18,seed);

  const c2=chapters[2];
  for(const [x,z,s] of [[-82,-14,2.1],[-73,-20,1.4],[-61,31,1.9],[-50,39,1.5],[-29,55,2.1],[-18,68,1.8],[20,57,1.7],[33,80,1.5],[44,62,2.1]])rockCluster(c2,x,z,s,Math.round(x*17+z*11));
  for(const [x,z,s] of [[-59,40,1.18],[-47,43,1],[-23,70,.85],[14,70,.9],[-68,19,.84],[-38,58,.82],[22,82,.78],[38,67,.85]])willow(c2,x,z,s,Math.round(x*z));
  appleTree(c2,30,79);
  reeds(c2,-14,68,201);reeds(c2,11,50,202);reeds(c2,-19,55,203);
  for(const [x,z,seed] of [[-60,33,211],[-32,56,212],[22,74,213],[38,80,214]])flowerPatch(c2,x,z,18,seed);
  // Exactly the original three moving stones. Other stones can safely be batched.
  for(let i=0;i<11;i++){
    const x=-14+i*2.6,z=60+Math.sin(i*.5)*.45;
    if(i===3||i===5||i===7){
      const item=movingStone(c2,x,z);item.scale.y=.27;item.position.y=hAt(x,z)+.23;
      item.userData.rest={x:item.position.x,y:item.position.y,z:item.position.z};item.userData.shift=3.3;fordStones.push(item);
    }else staticPiece(c2,rockGeo,SCENERY_PALETTES[2].stone,x,hAt(x,z)+.23,z,.75*1.14,.27,.75*.84,.14,Math.sin(x*1.8+z)*2,.1);
  }
  const picnicGeo=new THREE.CylinderGeometry(1.4,1.5,.18,10);
  staticPiece(c2,picnicGeo,SCENERY_PALETTES[2].stone,27,hAt(27,75)+.13,75);
  for(let i=0;i<3;i++)staticPiece(c2,fruitGeo,0xc54836,26.7+i*.3,hAt(27,75)+.42,75.05,.22/.24);
  for(let i=0;i<3;i++){
    const ripple=new THREE.Mesh(new THREE.RingGeometry(1.4+i*.3,1.45+i*.3,24),new THREE.MeshBasicMaterial({color:0xffdb91,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
    ripple.rotation.x=-Math.PI/2;ripple.position.set(27,hAt(27,75)+.25,75);c2.add(ripple);restRipples.push(ripple);
  }

  const c3=chapters[3];
  for(const [x,z,s] of [[80,30,1.8],[69,20,1.2],[48,3,2.2],[80,-32,2],[69,-47,1.4],[42,-61,2.6],[55,-69,1.5],[81,-67,2],[91,-80,1.7],[103,-82,2.3]])rockCluster(c3,x,z,s,Math.round(x*19+z*7));
  for(const [x,z,s] of [[78,35,1.25],[83,23,1.1],[47,0,1.05],[58,-24,1.1],[78,-36,1.15],[44,-57,1.2],[74,-71,1.15],[55,44,.94],[73,43,.78],[86,15,.91],[62,0,.78],[68,-6,.88],[53,-32,.91],[87,-41,.88],[39,-49,.98],[59,-56,.81],[75,-83,.74]])pine(c3,x,z,s,Math.round(x*z));
  for(const [x,z,seed] of [[70,33,311],[46,-9,312],[68,-69,313],[95,-95,314]])flowerPatch(c3,x,z,18,seed);
  for(let i=0;i<2;i++){
    const branch=mesh(new THREE.CylinderGeometry(.12,.18,3.2,7),bark,74.5+i,hAt(75,-30)+.45,-30+i*.5);
    branch.rotation.set(Math.PI/2,.3+i*.7,.2);c3.add(branch);mountainBranches.push(branch);
  }
  // Irregular distant crags retain the east-ridge frame beyond playable bounds.
  for(let i=0;i<5;i++){
    const x=114+i*8,z=-89-i*6,color=i%2?SCENERY_PALETTES[3].shade:SCENERY_PALETTES[3].stone;
    staticPiece(c3,peakGeo,color,x,15+i%3*3,z,14,22+i%3*9,16,0,i*.71,0);
    staticPiece(c3,rockGeo,color,x-3,11+i%3*2,z+7,12,15+i%3*3,10,.12,i*.63,.18);
  }
  stone(c3,88,-94,1.4,0xe8dec9);
  for(const id of [1,2,3])finishBatches(chapters[id]);

  function setChapter(id) {
    chapterId=chapterDefinition(id).id;questIndex=0;
    for(const key of [1,2,3])chapters[key].visible=key===chapterId;
    fordStones.forEach(item=>{const p=item.userData.rest;item.position.set(p.x,p.y,p.z+item.userData.shift);});
    mountainBranches.forEach(item=>{item.visible=true;});
    restRipples.forEach(item=>{item.userData.active=false;item.material.opacity=0;});setQuest(0);
  }
  function setQuest(index) {
    questIndex=Math.max(0,Number(index)||0);
    landmarks[chapterId].forEach((marker,i)=>{marker.visible=i===questIndex;});
  }
  function applyEffect(effect,progress=Infinity) {
    if(effect==='ford-restored')fordStones.forEach((item,i)=>{const p=item.userData.rest;item.position.set(p.x,p.y,p.z+(i<progress?0:item.userData.shift));});
    if(effect==='mountain-obstacle')mountainBranches.forEach((item,i)=>{item.visible=i>=progress;});
    if(effect==='meadow-rest')restRipples.forEach(item=>{item.userData.active=true;});
  }
  function update(dt) {
    elapsed+=Math.min(dt,.1);const marker=landmarks[chapterId][questIndex];
    if(marker){
      marker.userData.beacon.position.y=3.1+Math.sin(elapsed*2)*.18;marker.userData.beacon.rotation.y=elapsed*.65;
      marker.userData.glow.material.opacity=.40+Math.sin(elapsed*2.6)*.13;
      const pulse=1+Math.sin(elapsed*2)*.06;marker.userData.glow.scale.set(pulse,pulse,pulse);marker.userData.sign.rotation.y=elapsed*.35;
    }
    restRipples.forEach((item,i)=>{
      if(item.userData.active){const t=(elapsed*.35+i*.32)%1,itemScale=1+t*2;item.scale.set(itemScale,itemScale,itemScale);item.material.opacity=(1-t)*.32;}
    });
  }
  setChapter(1);
  return {setChapter,setQuest,applyEffect,update,cameraObstacles:(id=chapterId)=>cameraBounds[id],groups:{root,chapters,routes,landmarks,fordStones,mountainBranches}};
}

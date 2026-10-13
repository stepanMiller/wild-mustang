import { CHAPTERS, chapterDefinition } from './chapters.js';

/** Lightweight original scenery, shared geometry, no network assets or physics engine. */
export function createStoryEnvironment(THREE, scene, hAt) {
  const root = new THREE.Group();
  root.name = 'story-landmarks';
  scene.add(root);
  const chapters = {}, routes = {}, landmarks = {};
  const white = new THREE.MeshLambertMaterial({ color:0xe8dec9 });
  const stone = new THREE.MeshLambertMaterial({ color:0x9d9484 });
  const bark = new THREE.MeshLambertMaterial({ color:0x62503a });
  const leaf = new THREE.MeshLambertMaterial({ color:0x779051 });
  const willowLeaf = new THREE.MeshLambertMaterial({ color:0x9bab65 });
  const pineLeaf = new THREE.MeshLambertMaterial({ color:0x49624c });
  const gold = new THREE.MeshLambertMaterial({ color:0xeabd56, emissive:0x4d310c });
  const appleMat = new THREE.MeshLambertMaterial({ color:0xc54836 });
  const rockGeo = new THREE.DodecahedronGeometry(1,0);
  const trunkGeo = new THREE.CylinderGeometry(0.2,0.34,1,7);
  const leafGeo = new THREE.DodecahedronGeometry(1,0);
  const coneGeo = new THREE.ConeGeometry(1,1,7);
  const dummy = new THREE.Object3D();
  let chapterId = 1, questIndex = 0, elapsed = 0;
  const fordStones = [], mountainBranches = [];
  const restRipples = [];

  function mesh(geo,mat,x,y,z,sx=1,sy=sx,sz=sx) {
    const item=new THREE.Mesh(geo,mat);
    item.position.set(x,y,z); item.scale.set(sx,sy,sz);
    return item;
  }
  function rock(group,x,z,size=1,mat=white) {
    const item=mesh(rockGeo,mat,x,hAt(x,z)+size*.28,z,size*1.14,size*.70,size*.84);
    item.rotation.set(.14,Math.sin(x*1.8+z)*2,.1);
    group.add(item); return item;
  }
  function pointCurve(points) {
    return new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
  }
  function buildTrail(group,definition) {
    const curve=pointCurve(definition.route), samples=180;
    const vertices=[], indices=[];
    for(let i=0;i<=samples;i++){
      const t=i/samples, p=curve.getPoint(t), tangent=curve.getTangent(t);
      const width=definition.id===3?2.7:2.4;
      const nx=-tangent.z*width*.5, nz=tangent.x*width*.5;
      for(const side of [-1,1]){
        const x=p.x+nx*side,z=p.z+nz*side;
        vertices.push(x,hAt(x,z)+.065,z);
      }
      if(i<samples){ const a=i*2; indices.push(a,a+2,a+1,a+1,a+2,a+3); }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setIndex(indices); geo.computeVertexNormals();
    const mat=new THREE.MeshLambertMaterial({color:definition.id===2?0xd6c898:0xc6ad74,transparent:true,opacity:.54,side:THREE.DoubleSide,depthWrite:false});
    const trail=new THREE.Mesh(geo,mat); trail.renderOrder=1; group.add(trail);
    routes[definition.id]=trail;
    // Hoofprints follow the same curve; instancing avoids hundreds of draw calls.
    const footprintGeo=new THREE.CircleGeometry(.16,7); footprintGeo.rotateX(-Math.PI/2);
    const footMat=new THREE.MeshBasicMaterial({color:0x5c4a2d,transparent:true,opacity:.48,depthWrite:false});
    const count=150, prints=new THREE.InstancedMesh(footprintGeo,footMat,count*2);
    for(let i=0;i<count;i++){
      const t=i/(count-1), p=curve.getPoint(t), a=curve.getTangent(t);
      for(let k=0;k<2;k++){
        const side=k===0?-.26:.26, x=p.x-a.z*side,z=p.z+a.x*side;
        dummy.position.set(x,hAt(x,z)+.082,z);
        dummy.rotation.set(0,Math.atan2(a.x,a.z),0); dummy.scale.set(.86,1,1.25);
        dummy.updateMatrix(); prints.setMatrixAt(i*2+k,dummy.matrix);
      }
    }
    group.add(prints);
    for(let i=1;i<definition.route.length-1;i+=2){
      const [x,z]=definition.route[i], before=definition.route[i-1],after=definition.route[i+1];
      const yaw=Math.atan2(after[0]-before[0],after[1]-before[1]);
      const ox=x+Math.cos(yaw)*3.2, oz=z-Math.sin(yaw)*3.2, y=hAt(ox,oz);
      const post=mesh(trunkGeo,bark,ox,y+1.1,oz,.75,2.2,.75);group.add(post);
      const symbol=mesh(new THREE.TorusGeometry(.35,.065,5,11,Math.PI*1.5),gold,ox,y+1.9,oz);
      symbol.rotation.set(0,yaw,Math.PI*1.25);group.add(symbol);
    }
  }
  function landmark(group,q,index,id) {
    const [x,z]=q.target,y=hAt(x,z), marker=new THREE.Group();
    marker.name=q.id;
    marker.position.set(x,y,z);
    const base=mesh(rockGeo,white,0,.25,0,1.2,.50,1);
    marker.add(base);
    const sign=mesh(new THREE.TorusGeometry(.52,.085,6,16,Math.PI*1.5),gold,0,1.25,0);
    sign.rotation.z=Math.PI*1.25;marker.add(sign);
    const glow=new THREE.Mesh(new THREE.RingGeometry(1.8,2.08,30),new THREE.MeshBasicMaterial({color:0xffd681,transparent:true,opacity:.48,side:THREE.DoubleSide,depthWrite:false}));
    glow.rotation.x=-Math.PI/2;glow.position.y=.11;marker.add(glow);
    const beacon=mesh(new THREE.OctahedronGeometry(.30,0),gold,0,3.1,0);marker.add(beacon);
    marker.userData={index,id,sign,glow,beacon};
    group.add(marker);return marker;
  }
  function willow(group,x,z,scale=1) {
    const y=hAt(x,z), tree=new THREE.Group();tree.position.set(x,y,z);
    tree.add(mesh(trunkGeo,bark,0,3*scale,0,scale,6*scale,scale));
    const leafCount=14, leaves=new THREE.InstancedMesh(leafGeo,willowLeaf,leafCount);
    const branches=new THREE.InstancedMesh(trunkGeo,bark,leafCount);
    for(let i=0;i<leafCount;i++){
      const a=i/leafCount*Math.PI*2, radius=(1.7+Math.sin(i*4)*.5)*scale;
      dummy.position.set(Math.cos(a)*radius,(5.7-Math.abs(Math.sin(i*2))*.7)*scale,Math.sin(a)*radius);
      dummy.rotation.set(.15, a,.2);
      dummy.scale.set(1.4*scale,(1.4+Math.sin(i*3)*.5)*scale,.9*scale);
      dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
      dummy.position.set(Math.cos(a)*radius*.6,4.7*scale,Math.sin(a)*radius*.6);
      dummy.rotation.set(Math.sin(a)*.75,0,-Math.cos(a)*.75);
      dummy.scale.set(.32*scale,2.7*scale,.32*scale);dummy.updateMatrix();branches.setMatrixAt(i,dummy.matrix);
    }
    tree.add(leaves,branches);group.add(tree);return tree;
  }
  function pine(group,x,z,scale=1) {
    const y=hAt(x,z), tree=new THREE.Group();tree.position.set(x,y,z);
    tree.add(mesh(trunkGeo,bark,0,2.6*scale,0,scale,5.2*scale,scale));
    for(let i=0;i<3;i++)tree.add(mesh(coneGeo,pineLeaf,0,(3.5+i*1.5)*scale,0,(2.3-i*.5)*scale,3.5*scale,(2.3-i*.5)*scale));
    group.add(tree);
  }
  function appleTree(group,x,z) {
    const tree=willow(group,x,z,.9), fruit=new THREE.InstancedMesh(new THREE.SphereGeometry(.24,8,6),appleMat,11);
    for(let i=0;i<11;i++){
      const a=i*2.4;
      dummy.position.set(x+Math.cos(a)*1.9,hAt(x,z)+4+Math.sin(i*.6)*.8,z+Math.sin(a)*1.9);
      dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();fruit.setMatrixAt(i,dummy.matrix);
    }
    group.add(fruit);return tree;
  }
  function reeds(group,x,z) {
    const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.028,.045,1,4),leaf,18);
    for(let i=0;i<18;i++){
      const ox=x+Math.sin(i*2.1)*1.5, oz=z+Math.cos(i*1.2)*1.2, height=.9+(i%4)*.19;
      dummy.position.set(ox,hAt(ox,oz)+height*.5,oz);
      dummy.rotation.set(Math.sin(i)*.12,0,Math.cos(i)*.12);dummy.scale.set(1,height,1);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);
    }
    group.add(stems);
  }

  for(const id of [1,2,3]){
    const group=new THREE.Group();group.name=`chapter-${id}-scenery`;root.add(group);chapters[id]=group;
    const definition=CHAPTERS[id];buildTrail(group,definition);
    landmarks[id]=definition.quests.map((q,i)=>landmark(group,q,i,id));
  }
  // Chapter one retains the valley, branch rescue and orchard supplied by the base world.
  const c1=chapters[1];
  for(const [x,z,s] of [[-9,-9,.7],[-12,-4,.8],[-17,-6,.72],[-22,-6,.68],[-28,-5,.8]])rock(c1,x,z,s);
  rock(c1,-76,-66,2);rock(c1,-71,-68,1.2,stone);

  const c2=chapters[2];
  for(const [x,z,s] of [[-82,-14,2.1],[-73,-20,1.4],[-61,31,1.9],[-50,39,1.5],[-29,55,2.1],[-18,68,1.8],[20,57,1.7],[33,80,1.5],[44,62,2.1]])rock(c2,x,z,s);
  for(const [x,z,s] of [[-59,40,1.18],[-47,43,1],[-23,70,.85],[14,70,.9]])willow(c2,x,z,s);
  appleTree(c2,30,79);
  reeds(c2,-14,68);reeds(c2,11,50);reeds(c2,-19,55);
  // Three memorable stone moves, followed by one broad safe route across the shallow ford.
  for(let i=0;i<11;i++){
    const x=-14+i*2.6,z=60+Math.sin(i*.5)*.45;
    const item=rock(c2,x,z,.75);
    item.scale.y=.27;item.position.y=hAt(x,z)+.23;
    item.userData.rest={x:item.position.x,y:item.position.y,z:item.position.z};
    item.userData.shift=i===3||i===5||i===7?3.3:0;
    if(item.userData.shift)fordStones.push(item);
  }
  const picnic=mesh(new THREE.CylinderGeometry(1.4,1.5,.18,10),white,27,hAt(27,75)+.13,75);c2.add(picnic);
  for(let i=0;i<3;i++)c2.add(mesh(new THREE.SphereGeometry(.22,8,6),appleMat,26.7+i*.3,hAt(27,75)+.42,75.05));
  for(let i=0;i<3;i++){
    const ripple=new THREE.Mesh(new THREE.RingGeometry(1.4+i*.3,1.45+i*.3,24),new THREE.MeshBasicMaterial({color:0xffdb91,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
    ripple.rotation.x=-Math.PI/2;ripple.position.set(27,hAt(27,75)+.25,75);c2.add(ripple);restRipples.push(ripple);
  }

  const c3=chapters[3];
  for(const [x,z,s] of [[80,30,1.8],[69,20,1.2],[48,3,2.2],[80,-32,2],[69,-47,1.4],[42,-61,2.6],[55,-69,1.5],[81,-67,2],[91,-80,1.7],[103,-82,2.3]])rock(c3,x,z,s,stone);
  for(const [x,z,s] of [[78,35,1.25],[83,23,1.1],[47,0,1.05],[58,-24,1.1],[78,-36,1.15],[44,-57,1.2],[74,-71,1.15]])pine(c3,x,z,s);
  for(let i=0;i<2;i++){
    const branch=mesh(new THREE.CylinderGeometry(.12,.18,3.2,7),bark,74.5+i,hAt(75,-30)+.45,-30+i*.5);
    branch.rotation.set(Math.PI/2,.3+i*.7,.2);c3.add(branch);mountainBranches.push(branch);
  }
  // Distant carved peaks frame the east ridge; decoration stays outside the playable bounds.
  for(let i=0;i<5;i++){
    const peak=mesh(new THREE.ConeGeometry(1,1,5),i%2?stone:white,114+i*8,15+i%3*3,-89-i*6,14,22+i%3*9,16);
    peak.rotation.y=i*.71;c3.add(peak);
  }
  rock(c3,88,-94,1.4,white);

  function setChapter(id) {
    chapterId=chapterDefinition(id).id;questIndex=0;
    for(const key of [1,2,3])chapters[key].visible=key===chapterId;
    fordStones.forEach(item=>{ const p=item.userData.rest;item.position.set(p.x,p.y,p.z+item.userData.shift); });
    mountainBranches.forEach(item=>{item.visible=true;});
    restRipples.forEach(item=>{item.userData.active=false;item.material.opacity=0;});
    setQuest(0);
  }
  function setQuest(index) {
    questIndex=Math.max(0,Number(index)||0);
    landmarks[chapterId].forEach((marker,i)=>{
      // The last two targets can share one physical lookout; only the active marker is visible.
      marker.visible=i===questIndex;
    });
  }
  function applyEffect(effect,progress=Infinity) {
    if(effect==='ford-restored')fordStones.forEach((item,i)=>{
      const p=item.userData.rest;
      item.position.set(p.x,p.y,p.z+(i<progress?0:item.userData.shift));
    });
    if(effect==='mountain-obstacle')mountainBranches.forEach((item,i)=>{item.visible=i>=progress;});
    if(effect==='meadow-rest')restRipples.forEach(item=>{item.userData.active=true;});
  }
  function update(dt) {
    elapsed+=Math.min(dt,.1);
    const marker=landmarks[chapterId][questIndex];
    if(marker){
      marker.userData.beacon.position.y=3.1+Math.sin(elapsed*2)*.18;
      marker.userData.beacon.rotation.y=elapsed*.65;
      marker.userData.glow.material.opacity=.40+Math.sin(elapsed*2.6)*.13;
      const pulse=1+Math.sin(elapsed*2)*.06;marker.userData.glow.scale.set(pulse,pulse,pulse);
      marker.userData.sign.rotation.y=elapsed*.35;
    }
    restRipples.forEach((item,i)=>{
      if(item.userData.active){
        const t=(elapsed*.35+i*.32)%1,itemScale=1+t*2;
        item.scale.set(itemScale,itemScale,itemScale);item.material.opacity=(1-t)*.32;
      }
    });
  }
  setChapter(1);
  return {setChapter,setQuest,applyEffect,update,groups:{root,chapters,routes,landmarks,fordStones,mountainBranches}};
}

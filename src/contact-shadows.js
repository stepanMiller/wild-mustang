/** A single instanced soft-shadow draw, no depth maps or remote textures. */
export function createContactShadows(THREE, scene, actors, hAt, normalAt) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d');
  const gradient=ctx.createRadialGradient(32,32,3,32,32,31);
  gradient.addColorStop(0,'rgba(29,26,17,.38)');gradient.addColorStop(.6,'rgba(29,26,17,.18)');gradient.addColorStop(1,'rgba(29,26,17,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(canvas);
  const geo=new THREE.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2);
  const mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const shadows=new THREE.InstancedMesh(geo,mat,actors.length);shadows.frustumCulled=false;shadows.renderOrder=0;scene.add(shadows);
  const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
  return {
    update(){
      actors.forEach(({actor,width,length},index)=>{
        let visible=true;for(let node=actor;node;node=node.parent) if(!node.visible) visible=false;
        const x=actor.position.x,z=actor.position.z;
        dummy.position.set(x,hAt(x,z)+.05,z);
        dummy.quaternion.setFromUnitVectors(up,normalAt(x,z));dummy.rotateY(actor.userData.travelHeading ?? actor.rotation.y);
        const distance=Math.max(0,actor.position.y-hAt(x,z));const scale=visible?1/(1+distance*.16):0;
        dummy.scale.set(width*scale,1,length*scale);dummy.updateMatrix();shadows.setMatrixAt(index,dummy.matrix);
      });shadows.instanceMatrix.needsUpdate=true;
    },
  };
}

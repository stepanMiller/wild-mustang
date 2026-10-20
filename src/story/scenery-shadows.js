/** One local, terrain-conforming soft-shadow draw per visible chapter. */
export function createSceneryShadows(THREE,hAt,groundGeometry=null) {
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const radius=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1);
    const alpha=Math.pow(Math.max(0,1-radius*radius),2)*.55;
    const offset=(y*size+x)*4;
    data[offset]=data[offset+1]=data[offset+2]=255;data[offset+3]=Math.round(alpha*255);
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
  const material=new THREE.MeshBasicMaterial({map:texture,color:0x27352b,
    transparent:true,opacity:.40,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,side:THREE.DoubleSide});
  const ground=groundGeometry?.attributes.position,index=groundGeometry?.index,parameters=groundGeometry?.parameters;
  const columns=(parameters?.widthSegments||0)+1,rows=(parameters?.heightSegments||0)+1;
  const hasGround=ground&&index&&columns>1&&rows>1&&ground.count===columns*rows;
  return (group,patches)=>{
    if(!patches.length)return null;
    const positions=[],uvs=[],indices=[],sides=8;
    for(const patch of patches){
      const start=positions.length/3,ca=Math.cos(patch.angle||0),sa=Math.sin(patch.angle||0);
      if(hasGround){
        // Copy the renderer's triangles, not only analytical hAt samples. Even
        // vertices on the right height can form a different surface between
        // them near a steep riverbank. UVs project one soft oval onto this grid.
        const x0=ground.getX(0),z0=ground.getZ(0),dx=ground.getX(1)-x0,dz=ground.getZ(columns)-z0;
        const halfX=(Math.abs(ca*patch.width)+Math.abs(sa*patch.length))*.5;
        const halfZ=(Math.abs(sa*patch.width)+Math.abs(ca*patch.length))*.5;
        const minX=Math.max(0,Math.floor((patch.x-halfX-x0)/dx)),maxX=Math.min(columns-2,Math.floor((patch.x+halfX-x0)/dx));
        const minZ=Math.max(0,Math.floor((patch.z-halfZ-z0)/dz)),maxZ=Math.min(rows-2,Math.floor((patch.z+halfZ-z0)/dz));
        const vertices=new Map();
        function vertex(source){
          if(vertices.has(source))return vertices.get(source);
          const target=positions.length/3,x=ground.getX(source),z=ground.getZ(source),ox=x-patch.x,oz=z-patch.z;
          positions.push(x,ground.getY(source)+.035,z);
          uvs.push(.5+(ox*ca+oz*sa)/patch.width,.5+(-ox*sa+oz*ca)/patch.length);
          vertices.set(source,target);return target;
        }
        for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
          const offset=(z*(columns-1)+x)*6;
          for(let k=0;k<6;k++)indices.push(vertex(index.getX(offset+k)));
        }
        continue;
      }
      positions.push(patch.x,hAt(patch.x,patch.z)+.035,patch.z);uvs.push(.5,.5);
      // Two rings follow the actual terrain instead of floating over hill crests.
      for(const radius of [.5,1])for(let i=0;i<sides;i++){
        const angle=i/sides*Math.PI*2,px=Math.cos(angle)*radius,pz=Math.sin(angle)*radius;
        const dx=px*patch.width*.5,dz=pz*patch.length*.5;
        const x=patch.x+dx*ca-dz*sa,z=patch.z+dx*sa+dz*ca;
        positions.push(x,hAt(x,z)+.035,z);uvs.push(.5+px*.5,.5+pz*.5);
      }
      for(let i=0;i<sides;i++){
        const a=start+1+i,b=start+1+(i+1)%sides,c=a+sides,d=b+sides;
        indices.push(start,b,a,a,b,c,b,d,c);
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const shadows=new THREE.Mesh(geometry,material);shadows.name=`${group.name}-soft-shadows`;
    shadows.renderOrder=0;shadows.userData.patchCount=patches.length;group.add(shadows);return shadows;
  };
}

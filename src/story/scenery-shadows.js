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
  const boundary=Array.from({length:8},(_,i)=>({u:.5+Math.cos(i*Math.PI/4)*.5,v:.5+Math.sin(i*Math.PI/4)*.5}));
  function clipToOval(polygon){
    for(let i=0;i<boundary.length&&polygon.length;i++){
      const a=boundary[i],b=boundary[(i+1)%boundary.length],output=[];
      const signed=point=>(b.u-a.u)*(point.v-a.v)-(b.v-a.v)*(point.u-a.u);
      let previous=polygon[polygon.length-1],previousDistance=signed(previous);
      for(const current of polygon){
        const currentDistance=signed(current),inside=currentDistance>=-1e-9,previousInside=previousDistance>=-1e-9;
        if(inside!==previousInside){
          const t=Math.max(0,Math.min(1,previousDistance/(previousDistance-currentDistance)));
          output.push({x:previous.x+(current.x-previous.x)*t,y:previous.y+(current.y-previous.y)*t,
            z:previous.z+(current.z-previous.z)*t,u:previous.u+(current.u-previous.u)*t,v:previous.v+(current.v-previous.v)*t});
        }
        if(inside)output.push(current);
        previous=current;previousDistance=currentDistance;
      }
      polygon=output;
    }
    return polygon;
  }
  return (group,patches)=>{
    if(!patches.length)return null;
    const positions=[],uvs=[],indices=[],sides=8;
    for(const patch of patches){
      const start=positions.length/3,ca=Math.cos(patch.angle||0),sa=Math.sin(patch.angle||0);
      if(hasGround){
        // Clip the renderer's triangles to the visible oval. Interpolation
        // preserves the exact ground plane without rasterizing whole large
        // grid cells for tiny contact patches with mostly transparent texels.
        const x0=ground.getX(0),z0=ground.getZ(0),dx=ground.getX(1)-x0,dz=ground.getZ(columns)-z0;
        const halfX=(Math.abs(ca*patch.width)+Math.abs(sa*patch.length))*.5;
        const halfZ=(Math.abs(sa*patch.width)+Math.abs(ca*patch.length))*.5;
        const minX=Math.max(0,Math.floor((patch.x-halfX-x0)/dx)),maxX=Math.min(columns-2,Math.floor((patch.x+halfX-x0)/dx));
        const minZ=Math.max(0,Math.floor((patch.z-halfZ-z0)/dz)),maxZ=Math.min(rows-2,Math.floor((patch.z+halfZ-z0)/dz));
        function vertex(source){
          const x=ground.getX(source),z=ground.getZ(source),ox=x-patch.x,oz=z-patch.z;
          return {x,y:ground.getY(source)+.035,z,u:.5+(ox*ca+oz*sa)/patch.width,v:.5+(-ox*sa+oz*ca)/patch.length};
        }
        for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
          const offset=(z*(columns-1)+x)*6;
          for(let k=0;k<6;k+=3){
            const polygon=clipToOval([vertex(index.getX(offset+k)),vertex(index.getX(offset+k+1)),vertex(index.getX(offset+k+2))]);
            if(polygon.length<3)continue;
            const first=positions.length/3;
            for(const point of polygon){positions.push(point.x,point.y,point.z);uvs.push(point.u,point.v);}
            for(let i=1;i<polygon.length-1;i++){
              const a=polygon[0],b=polygon[i],c=polygon[i+1];
              if(Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))>1e-8)indices.push(first,first+i,first+i+1);
            }
          }
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

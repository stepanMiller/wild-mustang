import * as THREE from 'three';

export function createCreek({size, riverX, riverWidth, heightAt, waterY, clock}) {
  const positions=[], depth=[], indices=[];
  const rows=240, columns=8;
  for(let i=0;i<=rows;i++) {
    const z=size*(i/rows-.5), center=riverX(z), width=riverWidth(z);
    // A thin sheet of water runs over each raised, walkable ford.
    const fordDistance=Math.min(Math.abs(z+6),Math.abs(z-60));
    const surface=.31*(1-THREE.MathUtils.smoothstep(fordDistance,4,12));
    for(let j=0;j<=columns;j++) {
      const x=center+width*(2*j/columns-1);
      positions.push(x,surface,z);
      depth.push(Math.max(0,waterY+surface-heightAt(x,z)));
      if(i<rows && j<columns) {
        const k=i*(columns+1)+j, next=k+columns+1;
        indices.push(k,next,k+1,k+1,next,next+1);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('channelDepth',new THREE.Float32BufferAttribute(depth,1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material=new THREE.MeshPhongMaterial({
    color:0xffffff, specular:0x829c93, shininess:48, transparent:true, depthWrite:false
  });
  material.onBeforeCompile=shader=>{
    shader.uniforms.uCreekTime=clock;
    const declarations='varying vec2 vFlow; varying float vDepth; uniform float uCreekTime;\n';
    shader.vertexShader=declarations+'attribute float channelDepth;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      vFlow=position.xz;
      vDepth=channelDepth;
      transformed.y+=.018*sin(position.z*1.6+position.x*.65+uCreekTime*.9);
    `);
    shader.fragmentShader=declarations+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      float deep=smoothstep(.06,1.12,vDepth);
      float bend=sin(vFlow.x*1.65 + vFlow.y*.24);
      float wave=sin(vFlow.y*3.6 + bend*1.8 - uCreekTime*1.4);
      float broken=smoothstep(.32,.84,sin(vFlow.x*2.1-vFlow.y*.48+uCreekTime*.4));
      float glint=smoothstep(.88,.995,wave)*broken*(1.0-smoothstep(19.0,68.0,length(vViewPosition)));
      diffuseColor.rgb=mix(vec3(.17,.43,.36),vec3(.045,.22,.27),deep)
                       +vec3(.48,.58,.53)*glint;
      diffuseColor.a=mix(.42,.82,deep);
    `);
  };
  const creek=new THREE.Mesh(geometry,material);
  creek.name='spring-creek';
  creek.position.y=waterY;
  creek.renderOrder=2;
  return creek;
}

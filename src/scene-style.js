// Original prairie art: local geometry and color, no textures or extra passes.
export const LANDSCAPE_STYLES = {
  // Honey-coloured morning, a fresh riverside, then an amber mountain evening.
  1: { gold:0xc2a563, green:0x839654, dry:0xa48b54, rock:0x969182, sand:0xcebd91,
    sky:0x6697bb, horizon:0xc8d9d9, fog:0xd6dfdc, light:0xffe6bb, fill:0xc0d9eb, rim:0xffd295,
    grassDark:0x6c7d49, grassLight:0xc7b870, ambientSky:0xb6cede, ambientGround:0x665637,
    sun:[-90,68,45], fogDensity:.0033, exposure:1.02, water:0x4d8f91, waterEdge:0x96baaa, mountain:0x748ba8 },
  2: { gold:0xa4b37a, green:0x679358, dry:0x8e9c65, rock:0xb4b8a6, sand:0xd2c59f,
    sky:0x71a7c5, horizon:0xc6dee1, fog:0xd3e1e0, light:0xfff5dd, fill:0xb6d8ed, rim:0xf6dfb4,
    grassDark:0x477643, grassLight:0xb0c778, ambientSky:0xbedbe5, ambientGround:0x4c6142,
    sun:[-55,92,50], fogDensity:.0037, exposure:1.00, water:0x317e8b, waterEdge:0x91bcad, mountain:0x809aa4 },
  3: { gold:0xb79e67, green:0x78875a, dry:0x9b855c, rock:0x849098, sand:0xcbb69a,
    sky:0x657e9f, horizon:0xe6bb8b, fog:0xd5c1aa, light:0xffd29c, fill:0xaec9e4, rim:0xffc17c,
    grassDark:0x506046, grassLight:0xb9ad73, ambientSky:0xaac1d6, ambientGround:0x65513d,
    sun:[-100,38,-55], fogDensity:.0039, exposure:1.04, water:0x4c7d85, waterEdge:0xa6b4a0, mountain:0x7e8b9f },
};

export function paintLandscape(THREE, geometry, chapter, riverX, riverWidth, waterY) {
  const style=LANDSCAPE_STYLES[chapter] || LANDSCAPE_STYLES[1];
  const colors=Object.fromEntries(['gold','green','dry','rock','sand'].map(key=>[
    key,new THREE.Color(style[key]).convertSRGBToLinear(),
  ]));
  const positions=geometry.attributes.position, normals=geometry.attributes.normal, output=geometry.attributes.color;
  const color=new THREE.Color();
  const clamp=value=>Math.max(0,Math.min(1,value));
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i),height=positions.getY(i),bank=Math.abs(x-riverX(z));
    const shore=bank-riverWidth(z), aboveWater=height-waterY;
    color.copy(colors.gold).lerp(colors.dry,.5+.5*Math.sin(x*.07)*Math.cos(z*.09));
    color.lerp(colors.green,clamp(1-Math.max(0,shore)/18)*.72);
    // The actual river width and height define the shore; all physical terrain stays intact.
    if(aboveWater<2.6 && shore<5)color.lerp(colors.sand,clamp(1-Math.max(0,aboveWater-.5)/2.1)*.82);
    if(aboveWater<.55)color.multiplyScalar(.72+.28*clamp(aboveWater/.55));
    // A high, flat meadow remains grass. Stone belongs on the steep mountain faces.
    const slope=1-normals.getY(i),stone=clamp((slope-.065)/.22)*clamp((height-8)/9);
    color.lerp(colors.rock,stone*.84);
    // Small patches break up the broad hillside without another texture/draw.
    color.multiplyScalar(.93+.07*Math.sin(x*.37+z*.19)*Math.cos(z*.29));
    output.setXYZ(i,color.r,color.g,color.b);
  }
  output.needsUpdate=true;
  return style;
}

export function ridgeGeometry(THREE, snow=false) {
  // A broad broken crest with several slope layers replaces a single pyramid.
  const geometry=new THREE.CylinderGeometry(.25,snow?.475:1,snow?.3:1,12,snow?2:3,false);
  if(snow)geometry.translate(0,.35,0);
  const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),y=p.getY(i),angle=Math.atan2(z,x),layer=y+.5;
    const variation=.91+.13*Math.sin(angle*2+.9)+.07*Math.cos(angle*5+2);
    p.setXYZ(i,(x*variation+.15*layer*layer)*(snow?1.006:1),y+.14*Math.sin(angle*3+.4)*layer*layer+(snow?.002:0),z*variation*.72*(snow?1.006:1));
  }
  const flat=geometry.toNonIndexed();geometry.dispose();flat.computeVertexNormals();
  const colors=[],positions=flat.attributes.position;
  for(let i=0;i<positions.count;i++){
    const height=Math.max(0,Math.min(1,positions.getY(i)+.5)),shade=.67+height*.33;
    colors.push(shade*.95,shade*.98,shade);
  }
  flat.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  return flat;
}

export function prairieFlowerGeometry(THREE) {
  const vertices=[],colors=[];
  const triangle=(a,b,c,color)=>{for(const point of [a,b,c]){vertices.push(...point);colors.push(...color);}};
  for(let i=0;i<6;i++){
    const angle=i*Math.PI/3,next=angle+.45,prev=angle-.45;
    const tip=[Math.cos(angle)*.14,.64,Math.sin(angle)*.14];
    triangle([0,.56,0],[Math.cos(next)*.06,.57,Math.sin(next)*.06],tip,[.58,.45,.78]);
    triangle([0,.56,0],tip,[Math.cos(prev)*.06,.57,Math.sin(prev)*.06],[.75,.63,.91]);
  }
  triangle([-.014,0,0],[.014,0,0],[.014,.56,0],[.22,.34,.16]);
  triangle([-.014,0,0],[.014,.56,0],[-.014,.56,0],[.22,.34,.16]);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();return geometry;
}

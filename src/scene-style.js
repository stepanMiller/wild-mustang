// Original prairie art: local geometry and color, no textures or extra passes.
export const LANDSCAPE_STYLES = {
  1: { gold:0xc6b079, green:0x879966, dry:0x9b885f, rock:0x8c8f84, sand:0xcbbd96,
    sky:0x779ab6, horizon:0xe3d7bc, fog:0xd8d3bb, light:0xffedcd, fill:0xbdd3df, rim:0xf7d3a0, grassDark:0x6b7c48, grassLight:0xc7bd7c },
  2: { gold:0xb7c08c, green:0x73976e, dry:0x9eab7e, rock:0xa8aaa0, sand:0xd4cab0,
    sky:0x8baebe, horizon:0xd3e1cf, fog:0xd2ddc9, light:0xfff4db, fill:0xbbd4de, rim:0xf9e1b9, grassDark:0x638353, grassLight:0xb9c77b },
  3: { gold:0xa6b099, green:0x6d897b, dry:0x929f8d, rock:0x77858d, sand:0xc7c3a9,
    sky:0x758fa9, horizon:0xe0cfc0, fog:0xbecbca, light:0xffe7bf, fill:0xafc6d6, rim:0xffd3a5, grassDark:0x506d5b, grassLight:0xa7b288 },
};

export function paintLandscape(THREE, geometry, chapter, riverX) {
  const style=LANDSCAPE_STYLES[chapter] || LANDSCAPE_STYLES[1];
  const colors=Object.fromEntries(['gold','green','dry','rock','sand'].map(key=>[
    key,new THREE.Color(style[key]).convertSRGBToLinear(),
  ]));
  const positions=geometry.attributes.position, output=geometry.attributes.color;
  const color=new THREE.Color();
  const clamp=value=>Math.max(0,Math.min(1,value));
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i),height=positions.getY(i),bank=Math.abs(x-riverX(z));
    color.copy(colors.gold).lerp(colors.dry,.5+.5*Math.sin(x*.07)*Math.cos(z*.09));
    if(bank<26)color.lerp(colors.green,clamp(1-(bank-4)/22)*.82);
    if(bank<5)color.lerp(colors.sand,clamp(1-bank/5));
    if(height>15)color.lerp(colors.rock,clamp((height-15)/8)*.72);
    // Small patches break up the broad hillside without another texture/draw.
    color.multiplyScalar(.95+.05*Math.sin(x*.37+z*.19)*Math.cos(z*.29));
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
    p.setXYZ(i,x*variation*(snow?1.006:1),y+.055*Math.sin(angle*3+.4)*layer*layer+(snow?.002:0),z*variation*.88*(snow?1.006:1));
  }
  const flat=geometry.toNonIndexed();geometry.dispose();flat.computeVertexNormals();
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

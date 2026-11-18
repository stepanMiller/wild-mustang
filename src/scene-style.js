// Original prairie palette in sRGB, converted to linear light for vertex paint.
export const LANDSCAPE_STYLES = {
  1: { gold:0xb1b969, green:0x628f67, dry:0xc9a963, rock:0x9c917d, sand:0xd4b58b,
    sky:0x588bb8, horizon:0xe7d6b1, fog:0xbac8c4, density:.0030, light:0xffe0ad, fill:0xb4d9ed, rim:0xffcb8f, grassDark:0x597a45, grassLight:0xb6be6c },
  2: { gold:0x8eaf83, green:0x547f70, dry:0xb5b87c, rock:0xa0a9a0, sand:0xcbc0a5,
    sky:0x609eb4, horizon:0xd1e1d9, fog:0xb1cdcd, density:.0034, light:0xffecd4, fill:0xb7dde9, rim:0xffe1b1, grassDark:0x4a795e, grassLight:0xa1c183 },
  3: { gold:0xabb18c, green:0x668779, dry:0xc4a07d, rock:0x8a8691, sand:0xd8bba0,
    sky:0x738ac0, horizon:0xf4c79d, fog:0xcabdc5, density:.00265, light:0xffdebb, fill:0xc8d8f5, rim:0xffb784, grassDark:0x536f65, grassLight:0xb3b884 },
};

const saturate = value => Math.max(0, Math.min(1, value));

export function paintLandscape(THREE, geometry, chapter, riverX) {
  const style = LANDSCAPE_STYLES[chapter] || LANDSCAPE_STYLES[1];
  const colors = Object.fromEntries(['gold','green','dry','rock','sand'].map(key =>
    [key, new THREE.Color(style[key]).convertSRGBToLinear()]));
  const {position, normal, color: output} = geometry.attributes;
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i), y = position.getY(i);
    const bank = Math.abs(x - riverX(z));
    const slope = 1 - normal.getY(i);
    const fold = Math.sin(x * .092 + Math.sin(z * .08) * 1.8) + Math.cos(z * .12 - x * .055) * .52;
    const moist = saturate(.44 - fold * .33 + (21 - bank) * .018);
    const dry = saturate((y - 7) * .052 + .26 * fold);
    color.copy(colors.gold).lerp(colors.green, moist * .83).lerp(colors.dry, dry * .83);
    const outcrop = saturate((slope - .06) * 2.9 + Math.max(0, y - 16) * .04);
    color.lerp(colors.rock, outcrop * saturate(.6 + .43 * Math.sin(y * 1.7 + z * .13)));
    color.lerp(colors.sand, saturate((5.5 + Math.sin(z * .18) - bank) / 3));
    // Indirect light stays cool on sheltered slopes. The animated sun adds the key light.
    const exposure = saturate(.53 + normal.getX(i) * .78 - normal.getZ(i) * .34 + fold * .15);
    color.r *= .72 + exposure * .32;
    color.g *= .81 + exposure * .21;
    color.b *= .98 + exposure * .07;
    output.setXYZ(i, color.r, color.g, color.b);
  }
  output.needsUpdate = true;
}

// Low-contrast, mipmapped dry-brush marks disappear into the vertex palette at distance.
export function groundTexture(THREE, random) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fafaf7';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 640; i++) {
    const x = random() * 128, y = random() * 128;
    const size = .35 + random() ** 2 * 3;
    ctx.fillStyle = i % 3 ? 'rgba(109,112,95,.19)' : 'rgba(143,115,81,.24)';
    ctx.beginPath();
    ctx.ellipse(x,y,size * 1.35,size * .41,-.45 + random() * .45,0,Math.PI*2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(38,38);
  return texture;
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

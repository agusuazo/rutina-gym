/* Genera los iconos PNG (180, 192, 512) y icons/icon.svg: fondo verde + llama.
   Uso: node make-icons.js   (sin dependencias; escribe PNG con zlib) */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// Llama en un lienzo de 100x100: segmentos Bézier cúbicos [x0,y0, c1x,c1y, c2x,c2y, x1,y1]
const OUTER = [
  [50, 8, 50, 8, 82, 36, 82, 62], [82, 62, 82, 80, 68, 92, 50, 92],
  [50, 92, 32, 92, 18, 80, 18, 62], [18, 62, 18, 46, 28, 38, 34, 30],
  [34, 30, 36, 40, 40, 44, 44, 44], [44, 44, 44, 30, 46, 18, 50, 8]
];
const INNER = [
  [50, 52, 50, 52, 66, 66, 66, 76], [66, 76, 66, 85, 59, 90, 50, 90],
  [50, 90, 41, 90, 34, 85, 34, 76], [34, 76, 34, 66, 44, 62, 50, 52]
];
const BG = [88, 204, 2], ORANGE = [255, 150, 0], YELLOW = [255, 217, 0];

const toPath = (segs) =>
  `M${segs[0][0]} ${segs[0][1]}` + segs.map((s) => ` C${s[2]} ${s[3]} ${s[4]} ${s[5]} ${s[6]} ${s[7]}`).join('') + ' Z';

// Convierte los Bézier en un polígono para la prueba punto-en-polígono
function polygon(segs) {
  const pts = [];
  for (const [x0, y0, a, b, c, d, x1, y1] of segs) {
    for (let i = 0; i < 24; i++) {
      const t = i / 24, u = 1 - t;
      pts.push([
        u * u * u * x0 + 3 * u * u * t * a + 3 * u * t * t * c + t * t * t * x1,
        u * u * u * y0 + 3 * u * u * t * b + 3 * u * t * t * d + t * t * t * y1
      ]);
    }
  }
  return pts;
}
function inside(poly, x, y) {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}

const outer = polygon(OUTER), inner = polygon(INNER);
const SCALE = 0.62; // la llama ocupa ~62% del icono (cabe en la zona segura "maskable")

function colorAt(u, v) { // u,v en 0..1 sobre el icono
  const x = ((u - 0.5) / SCALE + 0.5) * 100, y = ((v - 0.5) / SCALE + 0.5) * 100 - 2;
  if (inside(inner, x, y)) return YELLOW;
  if (inside(outer, x, y)) return ORANGE;
  return BG;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const SS = 3; // supersampling 3x3 para bordes suaves
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filtro: ninguno
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = colorAt((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        r += c[0]; g += c[1]; b += c[2];
      }
      const n = SS * SS;
      raw[p++] = Math.round(r / n); raw[p++] = Math.round(g / n); raw[p++] = Math.round(b / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RGB (sin alfa: iOS no admite transparencia en el icono)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]);
}

const dir = path.join(__dirname, 'icons');
fs.mkdirSync(dir, { recursive: true });
for (const s of [180, 192, 512]) {
  fs.writeFileSync(path.join(dir, `icon-${s}.png`), png(s));
  console.log(`icons/icon-${s}.png`);
}
// SVG equivalente (mismo dibujo)
const t = `translate(${50 - 50 * SCALE} ${50 - 50 * SCALE - 2 * SCALE}) scale(${SCALE})`;
fs.writeFileSync(path.join(dir, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#58cc02"/>` +
  `<g transform="${t}"><path d="${toPath(OUTER)}" fill="#ff9600"/><path d="${toPath(INNER)}" fill="#ffd900"/></g></svg>\n`);
console.log('icons/icon.svg');

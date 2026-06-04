// Genera iconos mínimos válidos para Tauri sin dependencias externas.
// Crea PNGs reales con cabecera válida y un .ico multi-size.

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ICONS_DIR = join(import.meta.dirname, 'src-tauri', 'icons');
mkdirSync(ICONS_DIR, { recursive: true });

// ── Generar PNG desde cero ────────────────────────────────────────────────────
// Crea un PNG válido con un fondo violeta y las letras "AS" en el centro.

function createPNG(size) {
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = size / 2, cy = size / 2;
      const dx = x - cx, dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      const borderR = size * 0.45;

      // Fondo: gradiente violeta-azul
      const t = (x + y) / (size * 2);
      const R = Math.round(100 + t * 24);   // ~7c → 88
      const G = Math.round(20  + t * 20);   // ~3a → 2e
      const B = Math.round(200 + t * 37);   // ~ed → c8

      // Círculo redondeado con radio = 45% del tamaño
      const cornerR = size * 0.22;
      const insideRounded = (
        x >= cornerR && x <= size - cornerR &&
        y >= cornerR && y <= size - cornerR
      ) || (
        Math.sqrt(Math.pow(Math.max(0, Math.abs(x - cx) - (size/2 - cornerR)), 2) +
                  Math.pow(Math.max(0, Math.abs(y - cy) - (size/2 - cornerR)), 2)) <= cornerR
      );

      if (insideRounded) {
        pixels[i]   = R;
        pixels[i+1] = G;
        pixels[i+2] = B;
        pixels[i+3] = 255;
      } else {
        pixels[i] = pixels[i+1] = pixels[i+2] = pixels[i+3] = 0; // transparente
      }
    }
  }

  // Dibujar un punto blanco en el centro (icono simple)
  const dotR = Math.max(2, size * 0.12);
  const cx = size / 2, cy = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      if (Math.sqrt(dx*dx + dy*dy) <= dotR) {
        const i = (y * size + x) * 4;
        pixels[i] = pixels[i+1] = pixels[i+2] = 255;
        pixels[i+3] = 240;
      }
    }
  }

  return encodePNG(size, size, pixels);
}

// Encoder PNG mínimo sin librerías (RFC 2083)
function encodePNG(width, height, rgba) {
  const crc32 = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return (buf) => {
      let c = 0xffffffff;
      for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
  })();

  const adler32 = (buf) => {
    let s1 = 1, s2 = 0;
    for (const b of buf) { s1 = (s1 + b) % 65521; s2 = (s2 + s1) % 65521; }
    return (s2 << 16) | s1;
  };

  const u32be = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

  const chunk = (type, data) => {
    const t = [...type].map(c => c.charCodeAt(0));
    const c = crc32([...t, ...data]);
    return [...u32be(data.length), ...t, ...data, ...u32be(c)];
  };

  // Raw image data with filter byte 0 per scanline
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter type None
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      raw.push(rgba[i], rgba[i+1], rgba[i+2], rgba[i+3]);
    }
  }

  // zlib deflate (non-compressed store method for simplicity)
  const deflate = (data) => {
    const out = [0x78, 0x01]; // zlib header: deflate, low compression
    const CHUNK = 65535;
    for (let i = 0; i < data.length; i += CHUNK) {
      const block = data.slice(i, i + CHUNK);
      const last = i + CHUNK >= data.length ? 1 : 0;
      out.push(last, block.length & 0xff, (block.length >> 8) & 0xff,
               (~block.length & 0xff) & 0xff, (~block.length >> 8 & 0xff) & 0xff);
      out.push(...block);
    }
    const a = adler32(data);
    out.push(...u32be(a));
    return out;
  };

  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  const ihdr = chunk('IHDR', [...u32be(width), ...u32be(height), 8, 6, 0, 0, 0]);
  const idat = chunk('IDAT', deflate(raw));
  const iend = chunk('IEND', []);

  return Buffer.from([...sig, ...ihdr, ...idat, ...iend]);
}

// ── Generar ICO multi-size ─────────────────────────────────────────────────────
function createICO(sizes) {
  const pngBuffers = sizes.map(s => createPNG(s));

  // ICO header
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // type: ICO
  header.writeUInt16LE(sizes.length, 4);

  let offset = 6 + sizes.length * 16;
  const entries = [];

  sizes.forEach((size, i) => {
    const png = pngBuffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);   // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1);   // height
    entry.writeUInt8(0, 2);   // color count
    entry.writeUInt8(0, 3);   // reserved
    entry.writeUInt16LE(1, 4);  // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);  // size of image data
    entry.writeUInt32LE(offset, 12);     // offset of image data
    offset += png.length;
    entries.push(entry);
  });

  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

// ── Escribir todos los archivos ────────────────────────────────────────────────
const sizes = [
  { name: '32x32.png',       size: 32  },
  { name: '128x128.png',     size: 128 },
  { name: '128x128@2x.png',  size: 256 },
  { name: 'icon.png',        size: 512 },
];

for (const { name, size } of sizes) {
  const buf = createPNG(size);
  writeFileSync(join(ICONS_DIR, name), buf);
  console.log(`✓ icons/${name} (${size}x${size})`);
}

// ICO con múltiples tamaños
const icoBuf = createICO([16, 32, 48, 64, 128, 256]);
writeFileSync(join(ICONS_DIR, 'icon.ico'), icoBuf);
console.log('✓ icons/icon.ico (16,32,48,64,128,256)');

// .icns (macOS) — formato mínimo con magic + una entrada PNG
const icnsPng = createPNG(512);
const icnsData = Buffer.alloc(8 + 8 + icnsPng.length);
icnsData.write('icns', 0, 'ascii');
icnsData.writeUInt32BE(icnsData.length, 4);
icnsData.write('ic09', 8, 'ascii');  // 512x512 PNG
icnsData.writeUInt32BE(8 + icnsPng.length, 12);
icnsPng.copy(icnsData, 16);
writeFileSync(join(ICONS_DIR, 'icon.icns'), icnsData);
console.log('✓ icons/icon.icns');

console.log('\nIconos generados en src-tauri/icons/');

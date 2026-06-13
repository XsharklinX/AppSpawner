'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { app, nativeImage } = require('electron');

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const ICON_GENERATOR_VERSION = 2;

function safeFileName(name) {
  return String(name || 'app').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80);
}

function appIconDir() {
  const dir = path.join(app.getPath('userData'), 'app-icons');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function dataUrlToImage(dataUrl) {
  const image = nativeImage.createFromDataURL(dataUrl);
  if (!image || image.isEmpty()) return null;
  return image;
}

function fetchBuffer(targetUrl, timeoutMs = 4500, redirectsLeft = 4) {
  return new Promise(resolve => {
    const req = https.get(targetUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppSpawner/2.6',
        accept: 'image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8',
      },
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        const nextUrl = new URL(res.headers.location, targetUrl).toString();
        res.resume();
        resolve(fetchBuffer(nextUrl, timeoutMs, redirectsLeft - 1));
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        resolve(null);
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
  });
}

async function faviconImage(appConfig) {
  try {
    const hostname = new URL(appConfig.url).hostname;
    const candidates = await faviconCandidates(appConfig.url, hostname);
    for (const url of candidates) {
      const buffer = await fetchBuffer(url);
      const image = imageFromBuffer(buffer);
      if (image) return image;
    }
    return null;
  } catch {
    return null;
  }
}

function imageFromBuffer(buffer) {
  if (!buffer?.length) return null;
  const image = nativeImage.createFromBuffer(buffer);
  return image && !image.isEmpty() ? image : null;
}

function fetchText(targetUrl, timeoutMs = 4500, redirectsLeft = 4) {
  return new Promise(resolve => {
    const req = https.get(targetUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppSpawner/2.6',
        accept: 'text/html,application/manifest+json,application/json,*/*;q=0.8',
      },
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        const nextUrl = new URL(res.headers.location, targetUrl).toString();
        res.resume();
        resolve(fetchText(nextUrl, timeoutMs, redirectsLeft - 1));
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        resolve(null);
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
  });
}

async function faviconCandidates(appUrl, hostname) {
  const baseUrl = new URL(appUrl);
  const candidates = [
    `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
    `https://www.google.com/s2/favicons?sz=256&domain=${encodeURIComponent(hostname)}`,
    new URL('/favicon.ico', baseUrl).toString(),
    new URL('/favicon.png', baseUrl).toString(),
    new URL('/apple-touch-icon.png', baseUrl).toString(),
  ];

  const manifestUrl = await discoverManifestUrl(appUrl);
  if (manifestUrl) {
    const icons = await manifestIconCandidates(manifestUrl);
    candidates.unshift(...icons);
  }

  return [...new Set(candidates)];
}

async function discoverManifestUrl(appUrl) {
  const html = await fetchText(appUrl);
  if (!html) return new URL('/manifest.json', appUrl).toString();
  const manifestMatch = html.match(/<link[^>]+rel=["'][^"']*manifest[^"']*["'][^>]*>/i);
  const hrefMatch = manifestMatch?.[0].match(/\shref=["']([^"']+)["']/i);
  return hrefMatch?.[1] ? new URL(hrefMatch[1], appUrl).toString() : new URL('/manifest.json', appUrl).toString();
}

async function manifestIconCandidates(manifestUrl) {
  const text = await fetchText(manifestUrl);
  if (!text) return [];
  try {
    const manifest = JSON.parse(text);
    return (manifest.icons || [])
      .filter(icon => icon?.src)
      .sort((a, b) => iconSizeScore(b) - iconSizeScore(a))
      .map(icon => new URL(icon.src, manifestUrl).toString());
  } catch {
    return [];
  }
}

function iconSizeScore(icon) {
  const sizes = String(icon.sizes || '').match(/\d+/g)?.map(Number) || [];
  return Math.max(0, ...sizes);
}

function normalizeHex(hex) {
  return /^#[0-9a-fA-F]{6}$/.test(hex || '') ? hex : '#7c3aed';
}

function createFallbackPng(appConfig, size = 256) {
  const hex = normalizeHex(appConfig.iconColor);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const pixels = new Uint8Array(size * size * 4);
  const radius = size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const qx = Math.max(radius, Math.min(size - radius, x));
      const qy = Math.max(radius, Math.min(size - radius, y));
      const rounded = Math.hypot(x - qx, y - qy) <= radius;
      if (!rounded) continue;
      const light = 1 + ((x + y) / (size * 2)) * 0.18;
      pixels[i] = Math.min(255, Math.round(r * light));
      pixels[i + 1] = Math.min(255, Math.round(g * light));
      pixels[i + 2] = Math.min(255, Math.round(b * light));
      pixels[i + 3] = 255;
    }
  }

  drawInitials(pixels, size, fallbackInitials(appConfig));
  return encodePNG(size, size, pixels);
}

function fallbackInitials(appConfig) {
  const raw = appConfig.iconType === 'initials' && appConfig.iconValue
    ? appConfig.iconValue
    : String(appConfig.name || 'APP')
      .trim()
      .split(/\s+/)
      .map(word => word[0])
      .join('');
  return raw.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 2) || 'AS';
}

const GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
};

function drawInitials(pixels, size, text) {
  const glyphs = text.split('').map(char => GLYPHS[char]).filter(Boolean);
  if (!glyphs.length) return;
  const gap = Math.max(1, Math.round(size * 0.035));
  const glyphWidth = 5;
  const glyphHeight = 7;
  const scale = Math.max(1, Math.floor(size * (glyphs.length > 1 ? 0.1 : 0.13)));
  const totalWidth = glyphs.length * glyphWidth * scale + (glyphs.length - 1) * gap;
  const startX = Math.round((size - totalWidth) / 2);
  const startY = Math.round((size - glyphHeight * scale) / 2);

  glyphs.forEach((glyph, glyphIndex) => {
    const offsetX = startX + glyphIndex * (glyphWidth * scale + gap);
    glyph.forEach((row, y) => {
      row.split('').forEach((cell, x) => {
        if (cell !== '1') return;
        fillRect(pixels, size, offsetX + x * scale, startY + y * scale, scale, scale, [255, 255, 255, 242]);
      });
    });
  });
}

function fillRect(pixels, size, x, y, width, height, color) {
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      if (px < 0 || py < 0 || px >= size || py >= size) continue;
      const i = (py * size + px) * 4;
      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
      pixels[i + 3] = color[3];
    }
  }
}

function encodePNG(width, height, rgba) {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  const crc32 = data => {
    let c = 0xffffffff;
    for (const b of data) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const adler32 = data => {
    let a = 1, b = 0;
    for (const byte of data) { a = (a + byte) % 65521; b = (b + a) % 65521; }
    return ((b << 16) | a) >>> 0;
  };
  const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const chunk = (type, data) => {
    const t = [...type].map(ch => ch.charCodeAt(0));
    return Buffer.from([...u32(data.length), ...t, ...data, ...u32(crc32([...t, ...data]))]);
  };
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      raw.push(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]);
    }
  }
  const z = [0x78, 0x01];
  for (let i = 0; i < raw.length; i += 65535) {
    const block = raw.slice(i, i + 65535);
    const final = i + 65535 >= raw.length ? 1 : 0;
    z.push(final, block.length & 255, (block.length >> 8) & 255, (~block.length) & 255, ((~block.length) >> 8) & 255, ...block);
  }
  z.push(...u32(adler32(raw)));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', [...u32(width), ...u32(height), 8, 6, 0, 0, 0]),
    chunk('IDAT', z),
    chunk('IEND', []),
  ]);
}

function iconFingerprint(appConfig) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({
      generator: ICON_GENERATOR_VERSION,
      iconType: appConfig.iconType,
      iconValue: appConfig.iconValue,
      iconColor: appConfig.iconColor,
      url: appConfig.url,
      name: appConfig.name,
    }))
    .digest('hex')
    .slice(0, 10);
}

function pngVariantsFromImage(image) {
  return ICO_SIZES.map(size => ({
    size,
    png: image.resize({ width: size, height: size, quality: 'best' }).toPNG(),
  }));
}

function icoFromPngVariants(variants) {
  const headerSize = 6;
  const directorySize = variants.length * 16;
  const header = Buffer.alloc(headerSize + directorySize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(variants.length, 4);

  let offset = headerSize + directorySize;
  variants.forEach(({ size, png }, index) => {
    const entryOffset = headerSize + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(png.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...variants.map(item => item.png)]);
}

async function ensureAppIcon(appConfig, { force = false } = {}) {
  const dir = appIconDir();
  const base = `${safeFileName(appConfig.name)}-${appConfig.id}-${iconFingerprint(appConfig)}`;
  const pngPath = path.join(dir, `${base}.png`);
  const icoPath = path.join(dir, `${base}.ico`);

  if (force) {
    try { fs.unlinkSync(pngPath); } catch {}
    try { fs.unlinkSync(icoPath); } catch {}
  }

  if (!force && fs.existsSync(pngPath) && fs.existsSync(icoPath)) {
    return { png: pngPath, ico: icoPath, fingerprint: iconFingerprint(appConfig) };
  }

  let image = null;
  if (appConfig.iconType === 'customImage' && appConfig.iconValue?.startsWith('data:')) {
    image = dataUrlToImage(appConfig.iconValue);
  }
  if (!image && appConfig.iconType === 'favicon') {
    image = await faviconImage(appConfig);
  }

  const png = image
    ? image.resize({ width: 256, height: 256, quality: 'best' }).toPNG()
    : createFallbackPng(appConfig);
  const icoVariants = image
    ? pngVariantsFromImage(image)
    : ICO_SIZES.map(size => ({ size, png: createFallbackPng(appConfig, size) }));

  fs.writeFileSync(pngPath, png);
  fs.writeFileSync(icoPath, icoFromPngVariants(icoVariants));
  return { png: pngPath, ico: icoPath, fingerprint: iconFingerprint(appConfig) };
}

module.exports = { ensureAppIcon };

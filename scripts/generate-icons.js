/**
 * generate-icons.js
 * Renderiza assets/icon.svg → PNG, ICO (Windows) y printea instrucciones para ICNS (macOS).
 *
 * Instalar dependencias antes de correr (solo una vez):
 *   npm install --save-dev @resvg/resvg-js png-to-ico
 *
 * Ejecutar:
 *   node scripts/generate-icons.js
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const ASSETS  = path.join(__dirname, '../assets');
const SVG_SRC = path.join(ASSETS, 'icon.svg');

async function renderAt(Resvg, svg, size) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  return Buffer.from(resvg.render().asPng());
}

async function main() {
  if (!fs.existsSync(SVG_SRC)) {
    console.error('✗  assets/icon.svg not found');
    process.exit(1);
  }

  let Resvg, pngToIco;
  try {
    ({ Resvg } = require('@resvg/resvg-js'));
    const _pti = require('png-to-ico');
    // Handles both CommonJS default export and ESM-interop wrapping
    pngToIco   = typeof _pti === 'function' ? _pti : (_pti.default ?? _pti);
  } catch {
    console.error('✗  Missing packages. Run:');
    console.error('   npm install --save-dev @resvg/resvg-js png-to-ico');
    process.exit(1);
  }

  const svg = fs.readFileSync(SVG_SRC, 'utf-8');
  console.log('🎨 Generating AppSpawner icons...\n');

  // ── Linux / electron-builder source ────────────────────────────────────
  const png512 = await renderAt(Resvg, svg, 512);
  fs.writeFileSync(path.join(ASSETS, 'icon.png'), png512);
  console.log('✓  assets/icon.png           (512×512  — Linux + fallback)');

  const png1024 = await renderAt(Resvg, svg, 1024);
  fs.writeFileSync(path.join(ASSETS, 'icon@2x.png'), png1024);
  console.log('✓  assets/icon@2x.png        (1024×1024 — Retina source)');

  // ── Windows ICO (multi-resolution) ─────────────────────────────────────
  const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
  const icoBuffers = await Promise.all(ICO_SIZES.map(s => renderAt(Resvg, svg, s)));
  const ico = await pngToIco(icoBuffers);
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), ico);
  console.log(`✓  assets/icon.ico           (multi-res: ${ICO_SIZES.join(', ')}px — Windows)`);

  // ── Tray icon (small, transparent bg works best) ───────────────────────
  const tray16 = await renderAt(Resvg, svg, 16);
  const tray32 = await renderAt(Resvg, svg, 32);
  fs.writeFileSync(path.join(ASSETS, 'tray-icon.png'), tray16);
  fs.writeFileSync(path.join(ASSETS, 'tray-icon@2x.png'), tray32);
  console.log('✓  assets/tray-icon.png      (16×16 — system tray)');

  // ── macOS ICNS (requires macOS tools) ──────────────────────────────────
  console.log('\n──────────────────────────────────────────────────────────');
  console.log('📦  Para ICNS en macOS, ejecuta esto desde macOS:');
  console.log('');
  console.log('    mkdir -p assets/icon.iconset');
  [16, 32, 64, 128, 256, 512, 1024].forEach(s => {
    const at2x = s / 2;
    if (at2x >= 16) {
      console.log(`    sips -z ${s} ${s} assets/icon.png --out assets/icon.iconset/icon_${at2x}x${at2x}@2x.png`);
    }
    console.log(`    sips -z ${s} ${s} assets/icon.png --out assets/icon.iconset/icon_${s}x${s}.png`);
  });
  console.log('    iconutil -c icns assets/icon.iconset -o assets/icon.icns');
  console.log('    rm -rf assets/icon.iconset');
  console.log('──────────────────────────────────────────────────────────\n');

  console.log('✅  Done. Build with:  npm run build:win');
}

main().catch(err => {
  console.error('✗', err.message);
  process.exit(1);
});

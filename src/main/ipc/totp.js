'use strict';
const { app, safeStorage } = require('electron');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

function getTotpDir() { return path.join(app.getPath('userData'), 'totp'); }
function getTotpFile(appId) { return path.join(getTotpDir(), `${appId}.json`); }

// ── RFC 6238 TOTP (built-in crypto, zero deps) ────────────────────────────────

function base32Decode(input) {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.replace(/\s/g, '').toUpperCase().replace(/=+$/, '');
  let bits = 0, val = 0;
  const bytes = [];
  for (const c of clean) {
    const idx = alpha.indexOf(c);
    if (idx === -1) continue;
    val  = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) { bytes.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(bytes);
}

function computeTotp(secret, timeStep = 30) {
  const key     = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  const msg     = Buffer.alloc(8);
  // Write 64-bit big-endian counter
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const hmac  = crypto.createHmac('sha1', key).update(msg).digest();
  const off   = hmac[hmac.length - 1] & 0x0f;
  const code  = ((hmac[off] & 0x7f) << 24)
              | ((hmac[off+1] & 0xff) << 16)
              | ((hmac[off+2] & 0xff) << 8)
              |  (hmac[off+3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

function timeRemaining(timeStep = 30) {
  return timeStep - (Math.floor(Date.now() / 1000) % timeStep);
}

function parseTotpInput({ name, issuer, secret }) {
  const raw = String(secret || '').trim();
  if (/^otpauth:\/\//i.test(raw)) {
    const parsed = new URL(raw);
    const params = parsed.searchParams;
    const label = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    const [labelIssuer, labelName] = label.includes(':') ? label.split(/:(.+)/) : ['', label];
    return {
      name: String(name || labelName || label || '').trim(),
      issuer: String(issuer || params.get('issuer') || labelIssuer || '').trim(),
      secret: String(params.get('secret') || '').replace(/\s/g, '').toUpperCase(),
    };
  }
  return {
    name: String(name || '').trim(),
    issuer: String(issuer || '').trim(),
    secret: raw.replace(/\s/g, '').toUpperCase(),
  };
}

// ── Encrypt / decrypt seed ────────────────────────────────────────────────────

function encSeed(s) {
  return safeStorage.isEncryptionAvailable()
    ? { d: safeStorage.encryptString(s).toString('base64'), n: true }
    : { d: Buffer.from(s).toString('base64'), n: false };
}

function decSeed(e) {
  return (e.n && safeStorage.isEncryptionAvailable())
    ? safeStorage.decryptString(Buffer.from(e.d, 'base64'))
    : Buffer.from(e.d, 'base64').toString();
}

// ── IPC ───────────────────────────────────────────────────────────────────────

function registerTotpHandlers(ipcMain) {

  ipcMain.handle('totp:list', (_e, appId) => {
    try {
      const f = getTotpFile(appId);
      if (!fs.existsSync(f)) return [];
      return JSON.parse(fs.readFileSync(f, 'utf-8'))
        .map(({ id, name, issuer, createdAt }) => ({ id, name, issuer, createdAt }));
    } catch { return []; }
  });

  ipcMain.handle('totp:add', (_e, appId, { name, issuer, secret }) => {
    try {
      const parsed = parseTotpInput({ name, issuer, secret });
      const clean = parsed.secret;
      // Validate — will throw if secret is invalid
      computeTotp(clean);

      fs.mkdirSync(getTotpDir(), { recursive: true });
      const f       = getTotpFile(appId);
      const entries = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf-8')) : [];
      const entry   = {
        id:        crypto.randomUUID(),
        name:      String(parsed.name || parsed.issuer || '2FA').trim().slice(0, 60),
        issuer:    String(parsed.issuer || '').trim().slice(0, 60),
        seed:      encSeed(clean),
        createdAt: Date.now(),
      };
      entries.push(entry);
      fs.writeFileSync(f, JSON.stringify(entries, null, 2));
      return { success: true, id: entry.id, name: entry.name };
    } catch (err) {
      return { success: false, error: `Secreto inválido: ${err.message}` };
    }
  });

  ipcMain.handle('totp:get-code', (_e, appId, entryId) => {
    try {
      const f = getTotpFile(appId);
      if (!fs.existsSync(f)) return { success: false, error: 'No encontrado' };
      const entry = JSON.parse(fs.readFileSync(f, 'utf-8')).find(e => e.id === entryId);
      if (!entry) return { success: false, error: 'No encontrado' };
      const seed = decSeed(entry.seed);
      return { success: true, code: computeTotp(seed), remaining: timeRemaining() };
    } catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('totp:delete', (_e, appId, entryId) => {
    try {
      const f = getTotpFile(appId);
      if (!fs.existsSync(f)) return { success: true };
      const updated = JSON.parse(fs.readFileSync(f, 'utf-8')).filter(e => e.id !== entryId);
      fs.writeFileSync(f, JSON.stringify(updated, null, 2));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });
}

module.exports = { registerTotpHandlers };

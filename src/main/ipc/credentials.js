'use strict';
const { app, safeStorage } = require('electron');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

function getCredDir()        { return path.join(app.getPath('userData'), 'credentials'); }
function getCredFile(appId)  { return path.join(getCredDir(), `${appId}.json`); }

// ── Encrypt / decrypt ─────────────────────────────────────────────────────────

function enc(text) {
  return safeStorage.isEncryptionAvailable()
    ? { d: safeStorage.encryptString(text).toString('base64'), n: true }
    : { d: Buffer.from(text).toString('base64'), n: false };
}
function dec(e) {
  return (e.n && safeStorage.isEncryptionAvailable())
    ? safeStorage.decryptString(Buffer.from(e.d, 'base64'))
    : Buffer.from(e.d, 'base64').toString();
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function readCreds(appId) {
  try {
    const f = getCredFile(appId);
    if (!fs.existsSync(f)) return [];
    const raw = JSON.parse(fs.readFileSync(f, 'utf-8'));
    // Migrate old single-credential format
    if (raw && !Array.isArray(raw) && raw.username) {
      return [{ id: crypto.randomUUID(), name: 'Principal', username: raw.username, password: raw.password, url: raw.url, createdAt: Date.now() }];
    }
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function writeCreds(appId, creds) {
  fs.mkdirSync(getCredDir(), { recursive: true });
  fs.writeFileSync(getCredFile(appId), JSON.stringify(creds, null, 2));
}

// ── Autofill script builder ───────────────────────────────────────────────────

function buildFillScript(username, password, selectors = {}) {
  const esc = s => s.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
  const userSelector = selectors.username ? `'${esc(String(selectors.username).slice(0, 300))}'` : 'null';
  const passSelector = selectors.password ? `'${esc(String(selectors.password).slice(0, 300))}'` : 'null';
  const submitSelector = selectors.submit ? `'${esc(String(selectors.submit).slice(0, 300))}'` : 'null';
  return `(function(){
    const sets=(el,val)=>{
      const p=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
      if(p)p.set.call(el,val); else el.value=val;
      ['input','change'].forEach(e=>el.dispatchEvent(new Event(e,{bubbles:true})));
    };
    const visible=el=>!!el&&!el.disabled&&!el.readOnly&&el.offsetParent!==null;
    const bySel=sel=>{try{return sel?document.querySelector(sel):null}catch{return null}};
    const pw=[...document.querySelectorAll('input[type="password"]')];
    const us=[...document.querySelectorAll('input[type="email"],input[name*="user" i],input[name*="email" i],input[id*="user" i],input[id*="email" i],input[autocomplete*="email" i],input[autocomplete*="username" i],input[type="text"]')]
              .filter(visible);
    const userEl=bySel(${userSelector})||us[0]||null;
    const passEl=bySel(${passSelector})||pw.find(visible)||pw[0]||null;
    if(userEl)sets(userEl,'${esc(username)}');
    if(passEl)sets(passEl,'${esc(password)}');
    const submitEl=bySel(${submitSelector});
    if(submitEl)submitEl.click();
    return{filledUser:!!userEl,filledPass:!!passEl,clickedSubmit:!!submitEl};
  })();`;
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; }
    else if (line[i] === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += line[i]; }
  }
  result.push(cur.trim());
  return result;
}

// ── IPC ───────────────────────────────────────────────────────────────────────

function registerCredentialHandlers(ipcMain, appWindows) {

  // List all credentials for an app (without passwords)
  ipcMain.handle('credentials:list', (_e, appId) => {
    return readCreds(appId).map(({ id, name, username, url, selectors, createdAt }) =>
      ({ id, name, username, url, selectors: selectors || {}, createdAt }));
  });

  // Backward-compat: get first credential summary
  ipcMain.handle('credentials:get', (_e, appId) => {
    const creds = readCreds(appId);
    if (!creds.length) return null;
    return { username: creds[0].username, url: creds[0].url, hasPassword: !!creds[0].password };
  });

  // Add new credential
  ipcMain.handle('credentials:add', (_e, appId, { name, username, password, url, selectors }) => {
    try {
      const creds = readCreds(appId);
      const entry = {
        id:        crypto.randomUUID(),
        name:      String(name     || '').trim().slice(0, 60) || 'Cuenta',
        username:  String(username || '').trim(),
        password:  enc(password),
        url:       url || '',
        selectors: {
          username: String(selectors?.username || '').trim().slice(0, 300),
          password: String(selectors?.password || '').trim().slice(0, 300),
          submit:   String(selectors?.submit   || '').trim().slice(0, 300),
        },
        createdAt: Date.now(),
      };
      creds.push(entry);
      writeCreds(appId, creds);
      return { success: true, id: entry.id };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // Backward-compat save (upsert first credential)
  ipcMain.handle('credentials:save', (_e, appId, { username, password, url }) => {
    try {
      const creds = readCreds(appId);
      if (creds.length > 0) {
        creds[0] = { ...creds[0], username, password: enc(password), url };
      } else {
        creds.push({ id: crypto.randomUUID(), name: 'Principal', username, password: enc(password), url, createdAt: Date.now() });
      }
      writeCreds(appId, creds);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // Delete a single credential by ID
  ipcMain.handle('credentials:delete-by-id', (_e, appId, credId) => {
    try {
      writeCreds(appId, readCreds(appId).filter(c => c.id !== credId));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // Delete all credentials for app
  ipcMain.handle('credentials:delete', (_e, appId) => {
    try {
      const f = getCredFile(appId);
      if (fs.existsSync(f)) fs.unlinkSync(f);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // Autofill with first credential (backward-compat)
  ipcMain.handle('credentials:autofill', async (_e, appId) => {
    const creds = readCreds(appId);
    if (!creds.length) return { success: false, error: 'Sin credenciales guardadas' };
    return _doAutofill(appWindows, appId, creds[0]);
  });

  // Autofill with a specific credential ID
  ipcMain.handle('credentials:autofill-by-id', async (_e, appId, credId) => {
    const cred = readCreds(appId).find(c => c.id === credId);
    if (!cred) return { success: false, error: 'Credencial no encontrada' };
    return _doAutofill(appWindows, appId, cred);
  });

  // ── Import from CSV (Chrome / Firefox / Bitwarden export) ─────────────────
  ipcMain.handle('credentials:import-csv', (_e, csvText) => {
    try {
      const lines   = csvText.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return { success: false, error: 'CSV vacío' };

      const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g,'').toLowerCase().trim());
      const col     = key => headers.findIndex(h => h.includes(key));
      const nameIdx = Math.max(col('name'), col('title'));
      const urlIdx  = Math.max(col('url'), col('origin'), col('website'));
      const userIdx = Math.max(col('user'), col('login'), col('email'));
      const passIdx = col('pass');

      if (urlIdx < 0 || userIdx < 0 || passIdx < 0) {
        return { success: false, error: 'Formato no reconocido. Columnas mínimas: url, username, password.' };
      }

      const results = [];
      for (const line of lines.slice(1)) {
        try {
          const cols = parseCSVLine(line);
          const url  = cols[urlIdx]?.replace(/"/g,'').trim();
          const user = cols[userIdx]?.replace(/"/g,'').trim();
          const pass = cols[passIdx]?.replace(/"/g,'').trim();
          const name = nameIdx >= 0 ? cols[nameIdx]?.replace(/"/g,'').trim() : '';
          if (!url || !user || !pass) continue;
          results.push({ name: name || user, url, username: user, password: pass });
        } catch {}
      }

      return { success: true, count: results.length, entries: results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Save imported entries to their apps
  ipcMain.handle('credentials:save-imported', (_e, imports) => {
    // imports: [{appId, name, username, password, url}]
    let saved = 0;
    for (const item of imports) {
      if (!item.appId) continue;
      try {
        const creds = readCreds(item.appId);
        // Skip duplicates
        if (creds.some(c => c.username === item.username)) continue;
        creds.push({
          id:        crypto.randomUUID(),
          name:      item.name || item.username,
          username:  item.username,
          password:  enc(item.password),
          url:       item.url,
          createdAt: Date.now(),
        });
        writeCreds(item.appId, creds);
        saved++;
      } catch {}
    }
    return { success: true, saved };
  });
}

async function _doAutofill(appWindows, appId, cred) {
  const win = appWindows.get(appId);
  if (!win || win.isDestroyed()) return { success: false, error: 'La app no está abierta. Ábrela primero.' };
  try {
    const password = dec(cred.password);
    const result   = await win.webContents.executeJavaScript(buildFillScript(cred.username, password, cred.selectors));
    return { success: true, ...result };
  } catch (err) { return { success: false, error: err.message }; }
}

module.exports = { registerCredentialHandlers };

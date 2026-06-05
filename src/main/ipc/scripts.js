'use strict';
const { app } = require('electron');
const fs   = require('fs');
const path = require('path');

function getScriptPath(appId) {
  return path.join(app.getPath('userData'), 'user-scripts', `${appId}.json`);
}

function readScripts(appId) {
  try {
    const file = getScriptPath(appId);
    if (!fs.existsSync(file)) return { css: '', js: '' };
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return { css: '', js: '' };
  }
}

function registerScriptHandlers(ipcMain) {
  ipcMain.handle('scripts:get', (_e, appId) => readScripts(appId));

  ipcMain.handle('scripts:save', (_e, appId, scripts) => {
    try {
      const dir = path.dirname(getScriptPath(appId));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(getScriptPath(appId), JSON.stringify({
        css:     String(scripts.css     || '').slice(0, 100_000),
        js:      String(scripts.js      || '').slice(0, 100_000),
        enabled: scripts.enabled !== false,
        permissions: {
          css: scripts.permissions?.css !== false,
          dom: scripts.permissions?.dom !== false,
          network: scripts.permissions?.network === true,
          storage: scripts.permissions?.storage === true,
        },
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('scripts:delete', (_e, appId) => {
    try {
      const file = getScriptPath(appId);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerScriptHandlers, readScripts };

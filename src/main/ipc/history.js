'use strict';
const { app } = require('electron');
const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function getStoreFile() {
  return path.join(app.getPath('userData'), 'browsing-history.json');
}

const MAX_RECORDS = 2000;
let records = [];
let loaded  = false;
let dirty   = false;
let saveTimer = null;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    records = JSON.parse(fs.readFileSync(getStoreFile(), 'utf-8'));
    if (!Array.isArray(records)) records = [];
  } catch { records = []; }
}

function scheduleSave() {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!dirty) return;
    dirty = false;
    try { fs.writeFileSync(getStoreFile(), JSON.stringify(records.slice(0, MAX_RECORDS), null, 2)); } catch {}
  }, 1500);
}

/**
 * Registra una navegación dentro de una app SSB. Evita duplicar entradas
 * consecutivas a la misma URL (recargas, redirecciones internas en cadena).
 */
function recordNavigation(appId, appName, url, title) {
  load();
  if (!url || !/^https?:\/\//i.test(url)) return;
  const last = records.find(r => r.appId === appId);
  if (last && last.url === url) {
    last.ts = Date.now();
    if (title) last.title = title;
    scheduleSave();
    return;
  }
  records.unshift({
    id: uuidv4(),
    appId,
    appName,
    url,
    title: title || url,
    ts: Date.now(),
  });
  if (records.length > MAX_RECORDS) records.length = MAX_RECORDS;
  scheduleSave();
}

function registerHistoryHandlers(ipcMain) {
  load();

  ipcMain.handle('history:list', (_e, { appId = null, query = '', limit = 200 } = {}) => {
    let list = records;
    if (appId) list = list.filter(r => r.appId === appId);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter(r => r.title.toLowerCase().includes(q) || r.url.toLowerCase().includes(q));
    return list.slice(0, limit);
  });

  ipcMain.handle('history:remove', (_e, id) => {
    records = records.filter(r => r.id !== id);
    scheduleSave();
    return { success: true };
  });

  ipcMain.handle('history:clear', (_e, appId = null) => {
    records = appId ? records.filter(r => r.appId !== appId) : [];
    scheduleSave();
    return { success: true };
  });
}

module.exports = { recordNavigation, registerHistoryHandlers };

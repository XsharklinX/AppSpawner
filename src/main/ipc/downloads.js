'use strict';
const { app, shell } = require('electron');
const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function getStoreFile() {
  return path.join(app.getPath('userData'), 'downloads.json');
}

const MAX_RECORDS = 300;
let records = [];
let loaded  = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    records = JSON.parse(fs.readFileSync(getStoreFile(), 'utf-8'));
    if (!Array.isArray(records)) records = [];
  } catch { records = []; }
}

function persist() {
  try {
    fs.writeFileSync(getStoreFile(), JSON.stringify(records.slice(0, MAX_RECORDS), null, 2));
  } catch {}
}

function broadcast(mainWindow, channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

/**
 * Engancha el manejador de descargas a la sesión de una app SSB.
 * Centraliza todas las descargas de todas las apps en un único panel del dashboard.
 */
function attachDownloadInterceptor(sess, appId, appName, getMainWindow) {
  load();
  sess.on('will-download', (_event, item, _webContents) => {
    const id = uuidv4();
    const record = {
      id,
      appId,
      appName,
      filename:    item.getFilename(),
      url:         item.getURL(),
      savePath:    item.getSavePath(),
      totalBytes:  item.getTotalBytes(),
      receivedBytes: 0,
      state:       'progressing',
      startedAt:   Date.now(),
      finishedAt:  null,
    };
    records.unshift(record);
    if (records.length > MAX_RECORDS) records.length = MAX_RECORDS;

    const win = getMainWindow();
    broadcast(win, 'downloads:started', record);

    item.on('updated', (_e, state) => {
      record.receivedBytes = item.getReceivedBytes();
      record.totalBytes    = item.getTotalBytes();
      record.state         = state === 'interrupted' ? 'interrupted' : 'progressing';
      broadcast(getMainWindow(), 'downloads:progress', {
        id,
        receivedBytes: record.receivedBytes,
        totalBytes:    record.totalBytes,
        state:         record.state,
      });
    });

    item.once('done', (_e, state) => {
      record.state       = state; // 'completed' | 'cancelled' | 'interrupted'
      record.savePath    = item.getSavePath();
      record.receivedBytes = item.getReceivedBytes();
      record.finishedAt  = Date.now();
      persist();
      broadcast(getMainWindow(), 'downloads:done', record);
    });
  });
}

function registerDownloadHandlers(ipcMain, getMainWindow) {
  load();

  ipcMain.handle('downloads:list', () => records);

  ipcMain.handle('downloads:open-file', (_e, id) => {
    const rec = records.find(r => r.id === id);
    if (!rec?.savePath || !fs.existsSync(rec.savePath)) return { success: false, error: 'Archivo no encontrado' };
    shell.openPath(rec.savePath);
    return { success: true };
  });

  ipcMain.handle('downloads:open-folder', (_e, id) => {
    const rec = records.find(r => r.id === id);
    if (!rec?.savePath || !fs.existsSync(rec.savePath)) return { success: false, error: 'Archivo no encontrado' };
    shell.showItemInFolder(rec.savePath);
    return { success: true };
  });

  ipcMain.handle('downloads:remove', (_e, id) => {
    records = records.filter(r => r.id !== id);
    persist();
    return { success: true };
  });

  ipcMain.handle('downloads:clear', () => {
    records = records.filter(r => r.state === 'progressing');
    persist();
    return { success: true };
  });

  ipcMain.on('downloads:refresh', () => {
    broadcast(getMainWindow(), 'downloads:list', records);
  });
}

module.exports = { attachDownloadInterceptor, registerDownloadHandlers };

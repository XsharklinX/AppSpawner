'use strict';
const { v4: uuidv4 } = require('uuid');
const { app, session } = require('electron');
const fs   = require('fs');
const path = require('path');

function getSnapshotDir(appId) {
  return path.join(app.getPath('userData'), 'session-snapshots', appId);
}

function registerSessionHandlers(ipcMain) {

  ipcMain.handle('sessions:list', (_e, appId) => {
    const dir = getSnapshotDir(appId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
          return { id: d.id, name: d.name, savedAt: d.savedAt, cookieCount: d.cookies?.length || 0 };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.savedAt - a.savedAt);
  });

  ipcMain.handle('sessions:save', async (_e, appId, name) => {
    try {
      const sess    = session.fromPartition(`persist:app_${appId}`);
      const cookies = await sess.cookies.get({});
      const snapshot = {
        id:        uuidv4(),
        name:      String(name || '').trim().slice(0, 60) || 'Snapshot',
        savedAt:   Date.now(),
        cookies,
      };
      const dir = getSnapshotDir(appId);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${snapshot.id}.json`), JSON.stringify(snapshot, null, 2));
      return {
        success: true,
        id: snapshot.id, name: snapshot.name,
        savedAt: snapshot.savedAt, cookieCount: cookies.length,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sessions:restore', async (_e, appId, snapshotId) => {
    try {
      const file = path.join(getSnapshotDir(appId), `${snapshotId}.json`);
      if (!fs.existsSync(file)) return { success: false, error: 'Snapshot no encontrado' };
      const snapshot = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const sess     = session.fromPartition(`persist:app_${appId}`);

      await sess.clearStorageData({ storages: ['cookies'] });
      for (const cookie of (snapshot.cookies || [])) {
        try {
          const url = `${cookie.secure ? 'https' : 'http'}://${cookie.domain.replace(/^\./, '')}${cookie.path || '/'}`;
          await sess.cookies.set({ ...cookie, url });
        } catch {}
      }
      await sess.cookies.flushStore();
      return { success: true, cookieCount: snapshot.cookies?.length || 0 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sessions:delete', (_e, appId, snapshotId) => {
    try {
      const file = path.join(getSnapshotDir(appId), `${snapshotId}.json`);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerSessionHandlers };

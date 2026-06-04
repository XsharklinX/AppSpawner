'use strict';
const { v4: uuidv4 } = require('uuid');

function registerWorkspaceHandlers(ipcMain, store) {

  ipcMain.handle('workspaces:get-all', () => store.read().workspaces);

  ipcMain.handle('workspaces:create', (_e, config) => {
    const data = store.read();
    const ws = {
      id:        uuidv4(),
      name:      String(config.name  || '').trim().slice(0, 50),
      color:     /^#[0-9a-fA-F]{6}$/.test(config.color) ? config.color : '#7c3aed',
      emoji:     String(config.emoji || '📁').slice(0, 4),
      createdAt: Date.now(),
    };
    data.workspaces.push(ws);
    store.write(data);
    return ws;
  });

  ipcMain.handle('workspaces:update', (_e, id, updates) => {
    const data = store.read();
    const idx  = data.workspaces.findIndex(w => w.id === id);
    if (idx === -1) return { success: false };
    const { id: _id, createdAt, ...safe } = updates;
    data.workspaces[idx] = { ...data.workspaces[idx], ...safe };
    store.write(data);
    return data.workspaces[idx];
  });

  ipcMain.handle('workspaces:delete', (_e, id) => {
    const data = store.read();
    data.workspaces = data.workspaces.filter(w => w.id !== id);
    data.apps       = data.apps.map(a => a.workspaceId === id ? { ...a, workspaceId: null } : a);
    store.write(data);
    return { success: true };
  });

  ipcMain.handle('workspaces:assign-app', (_e, appId, workspaceId) => {
    const data = store.read();
    const idx  = data.apps.findIndex(a => a.id === appId);
    if (idx === -1) return { success: false };
    data.apps[idx].workspaceId = workspaceId || null;
    store.write(data);
    return { success: true };
  });
}

module.exports = { registerWorkspaceHandlers };

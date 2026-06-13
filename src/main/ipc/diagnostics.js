'use strict';
/**
 * diagnostics.js — Panel de diagnostico por app.
 * Centraliza errores de carga, permisos solicitados, peticiones bloqueadas,
 * cookies y uso de almacenamiento para una sola app SSB.
 */
const { session } = require('electron');
const { getBlockedCount, getBlockLog } = require('./adblock');

const LOAD_ERROR_MAX    = 30;
const PERMISSION_LOG_MAX = 50;

const loadErrors    = new Map(); // appId → entry[]
const permissionLog = new Map(); // appId → entry[]

function recordLoadError(appId, entry) {
  if (!loadErrors.has(appId)) loadErrors.set(appId, []);
  const log = loadErrors.get(appId);
  log.push({ ...entry, ts: Date.now() });
  if (log.length > LOAD_ERROR_MAX) log.splice(0, log.length - LOAD_ERROR_MAX);
}

function recordPermission(appId, permission, granted) {
  if (!permissionLog.has(appId)) permissionLog.set(appId, []);
  const log = permissionLog.get(appId);
  log.push({ permission, granted, ts: Date.now() });
  if (log.length > PERMISSION_LOG_MAX) log.splice(0, log.length - PERMISSION_LOG_MAX);
}

function clearAppDiagnostics(appId) {
  loadErrors.delete(appId);
  permissionLog.delete(appId);
}

function registerDiagnosticsHandlers(ipcMain, store, getSessionSize) {
  ipcMain.handle('diagnostics:get-app', async (_event, appId) => {
    const sess = session.fromPartition(`persist:app_${appId}`);
    const cookies = await sess.cookies.get({}).catch(() => []);
    const storageBytes = await getSessionSize(appId).catch(() => 0);

    return {
      errors:        (loadErrors.get(appId) || []).slice().reverse(),
      blockedCount:  getBlockedCount(appId),
      blockLog:      getBlockLog(appId).slice(0, 40),
      cookieCount:   cookies.length,
      storageBytes,
      permissions:   (permissionLog.get(appId) || []).slice().reverse(),
    };
  });

  ipcMain.handle('diagnostics:clear-errors', (_event, appId) => {
    loadErrors.delete(appId);
    return true;
  });

  // Apps con errores de carga registrados desde el último arranque/limpieza.
  ipcMain.handle('diagnostics:get-problem-apps', () => {
    const result = {};
    for (const [appId, log] of loadErrors.entries()) {
      if (log.length > 0) result[appId] = log.length;
    }
    return result;
  });
}

module.exports = {
  registerDiagnosticsHandlers,
  recordLoadError,
  recordPermission,
  clearAppDiagnostics,
};

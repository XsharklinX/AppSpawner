'use strict';
/**
 * preload.js — Puente IPC seguro entre Electron y React.
 * Cada método expuesto aquí tiene una contraparte registrada en main.js.
 * El renderer NUNCA tiene acceso directo a Node.js ni a Electron.
 */
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const send   = (channel, ...args) => ipcRenderer.send(channel, ...args);

contextBridge.exposeInMainWorld('electronAPI', {

  // ── APPS ──────────────────────────────────────────────────────────────────
  getApps:      ()                  => invoke('apps:get-all'),
  installApp:   (config)            => invoke('apps:install', config),
  uninstallApp: (id)                => invoke('apps:uninstall', id),
  launchApp:    (id)                => invoke('apps:launch', id),
  updateApp:    (id, updates)       => invoke('apps:update', id, updates),
  togglePin:    (id)                => invoke('apps:toggle-pin', id),

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  getSettings:    ()      => invoke('settings:get'),
  updateSettings: (s)     => invoke('settings:update', s),

  // ── USER ──────────────────────────────────────────────────────────────────
  getUser:  ()  => invoke('user:get'),
  saveUser: (u) => invoke('user:save', u),

  // ── SISTEMA ───────────────────────────────────────────────────────────────
  getDefaultInstallPath: () => invoke('system:get-install-path'),
  selectDirectory:       () => invoke('system:select-directory'),
  getPlatform:           () => invoke('system:get-platform'),
  getVersion:            () => invoke('system:get-version'),
  isDev:                 () => invoke('system:is-dev'),

  // ── SHELL ─────────────────────────────────────────────────────────────────
  openExternal: (url) => invoke('shell:open-external', url),

  // ── SHORTCUTS ─────────────────────────────────────────────────────────────
  createShortcuts: (appId) => invoke('shortcuts:create', appId),
  removeShortcuts: (appId) => invoke('shortcuts:remove', appId),

  // ── ALMACENAMIENTO ────────────────────────────────────────────────────────
  getStorageInfo: ()      => invoke('storage:get-info'),
  clearAppData:   (appId) => invoke('storage:clear-app-data', appId),

  // ── TRAY ──────────────────────────────────────────────────────────────────
  refreshTray: () => send('tray:refresh'),

  // ── CONTROLES DE VENTANA ──────────────────────────────────────────────────
  minimizeWindow: () => send('window:minimize'),
  maximizeWindow: () => send('window:maximize'),
  closeWindow:    () => send('window:close'),

  // ── EVENTOS DEL MAIN → RENDERER ───────────────────────────────────────────
  onAppWindowClosed: (cb) => {
    ipcRenderer.on('app:window-closed', (_e, appId) => cb(appId));
    return () => ipcRenderer.removeAllListeners('app:window-closed');
  },

  onBadgeUpdate: (cb) => {
    ipcRenderer.on('badge:update', (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('badge:update');
  },

  onInstallFromLink: (cb) => {
    ipcRenderer.on('install-from-link', (_e, params) => cb(params));
    return () => ipcRenderer.removeAllListeners('install-from-link');
  },

  onQuickLauncherToggle: (cb) => {
    ipcRenderer.on('quicklauncher:toggle', () => cb());
    return () => ipcRenderer.removeAllListeners('quicklauncher:toggle');
  },

  // ── WORKSPACES ────────────────────────────────────────────────────────────
  getWorkspaces:   ()                   => invoke('workspaces:get-all'),
  createWorkspace: (config)             => invoke('workspaces:create', config),
  updateWorkspace: (id, updates)        => invoke('workspaces:update', id, updates),
  deleteWorkspace: (id)                 => invoke('workspaces:delete', id),
  assignWorkspace: (appId, workspaceId) => invoke('workspaces:assign-app', appId, workspaceId),

  // ── SESIONES ──────────────────────────────────────────────────────────────
  listSessions:   (appId)              => invoke('sessions:list', appId),
  saveSession:    (appId, name)        => invoke('sessions:save', appId, name),
  restoreSession: (appId, snapshotId)  => invoke('sessions:restore', appId, snapshotId),
  deleteSession:  (appId, snapshotId)  => invoke('sessions:delete', appId, snapshotId),

  // ── PERFILES ──────────────────────────────────────────────────────────────
  getProfiles:   ()             => invoke('profiles:get-all'),
  createProfile: (config)       => invoke('profiles:create', config),
  updateProfile: (id, updates)  => invoke('profiles:update', id, updates),
  deleteProfile: (id)           => invoke('profiles:delete', id),

  // ── SCRIPTS / CSS ─────────────────────────────────────────────────────────
  getScripts:    (appId)          => invoke('scripts:get',    appId),
  saveScripts:   (appId, scripts) => invoke('scripts:save',   appId, scripts),
  deleteScripts: (appId)          => invoke('scripts:delete', appId),

  // ── CREDENTIALS ───────────────────────────────────────────────────────────
  listCredentials:      (appId)           => invoke('credentials:list',            appId),
  getCredentials:       (appId)           => invoke('credentials:get',             appId),
  addCredential:        (appId, cred)     => invoke('credentials:add',             appId, cred),
  saveCredentials:      (appId, creds)    => invoke('credentials:save',            appId, creds),
  deleteCredential:     (appId, credId)   => invoke('credentials:delete-by-id',   appId, credId),
  deleteCredentials:    (appId)           => invoke('credentials:delete',          appId),
  autofillCredentials:  (appId)           => invoke('credentials:autofill',        appId),
  autofillById:         (appId, credId)   => invoke('credentials:autofill-by-id', appId, credId),
  importCredentialsCSV: (csv)             => invoke('credentials:import-csv',      csv),
  saveImportedCreds:    (imports)         => invoke('credentials:save-imported',   imports),

  // ── TOTP / 2FA ────────────────────────────────────────────────────────────
  listTotp:    (appId)           => invoke('totp:list',     appId),
  addTotp:     (appId, entry)    => invoke('totp:add',      appId, entry),
  getTotpCode: (appId, entryId)  => invoke('totp:get-code', appId, entryId),
  deleteTotp:  (appId, entryId)  => invoke('totp:delete',   appId, entryId),

  // ── OAUTH / EASY LOGIN ────────────────────────────────────────────────────
  openLoginWindow:    (appId, url)  => invoke('auth:open-login-window', appId, url),
  onAuthLoginComplete: (cb) => {
    ipcRenderer.on('auth:login-complete', (_e, d) => cb(d));
    return () => ipcRenderer.removeAllListeners('auth:login-complete');
  },
  onLoginFormDetected: (cb) => {
    ipcRenderer.on('app:login-form', (_e, d) => cb(d));
    return () => ipcRenderer.removeAllListeners('app:login-form');
  },

  // ── SCREENSHOTS ───────────────────────────────────────────────────────────
  listScreenshots: (appId) => invoke('screenshots:list',     appId),
  openScreenshotsDir: (appId) => invoke('screenshots:open-dir', appId),

  // ── AD BLOCK ──────────────────────────────────────────────────────────────
  getAdBlockConfig:       ()              => invoke('adblock:get-config'),
  updateAdBlockConfig:    (updates)       => invoke('adblock:update-config', updates),
  getAppAdBlockConfig:    (appId)         => invoke('adblock:get-app-config', appId),
  updateAppAdBlockConfig: (appId, cfg)    => invoke('adblock:update-app-config', appId, cfg),
  getAdBlockCount:        (appId)         => invoke('adblock:get-blocked-count', appId),
  resetAdBlockCount:      (appId)         => invoke('adblock:reset-count', appId),

  // ── DATOS ─────────────────────────────────────────────────────────────────
  exportData: ()        => invoke('data:export'),
  importData: (jsonStr) => invoke('data:import', jsonStr),

  // ── FLAGS ─────────────────────────────────────────────────────────────────
  isElectron: true,
});

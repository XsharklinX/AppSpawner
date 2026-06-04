// api.js — Wrapper de Tauri invoke(). Misma interfaz que window.electronAPI.
// En el contexto de Tauri, los comandos se invocan con invoke() en lugar de
// IPC de Electron. Esta capa de abstracción permite que los componentes React
// no cambien en absoluto respecto a la versión Electron.

import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { open as openUrl }    from '@tauri-apps/plugin-opener';
import { listen }             from '@tauri-apps/api/event';

// ── Apps ──────────────────────────────────────────────────────────────────────

export const getApps = () => invoke('get_apps');

export const installApp = (config) => invoke('install_app', { config });

export const uninstallApp = (id) => invoke('uninstall_app', { id });

export const updateApp = (id, updates) => invoke('update_app', { id, updates });

export const togglePin = (id) => invoke('toggle_pin', { id });

export const markLaunched = (id) => invoke('mark_launched', { id });

export const launchApp = (id) => invoke('launch_app', { id });

// ── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = () => invoke('get_settings');

export const updateSettings = (settings) => invoke('update_settings', { settings });

// ── User ─────────────────────────────────────────────────────────────────────

export const getUser = () => invoke('get_user');

export const saveUser = (user) => invoke('save_user', { user });

// ── Shortcuts ────────────────────────────────────────────────────────────────

export const createShortcuts = (id) => invoke('create_shortcuts', { id });

export const removeShortcuts = (id) => invoke('remove_shortcuts', { id });

// ── Storage ──────────────────────────────────────────────────────────────────

export const getStorageInfo = () => invoke('get_storage_info');

export const clearAppData = (id) => invoke('clear_app_data', { id });

// ── System ───────────────────────────────────────────────────────────────────

export const getDefaultInstallPath = () => invoke('get_default_install_path');

export const getPlatform = () => invoke('get_platform');

export const getVersion = () => invoke('get_version');

export const openExternal = (url) => openUrl(url);

export const selectDirectory = async () => {
  const result = await openDialog({ directory: true, multiple: false });
  return result ?? null;
};

// ── Eventos (equivalente a electronAPI.onAppWindowClosed) ────────────────────

export const onAppWindowClosed = (callback) => {
  let unlisten;
  listen('ssb:window-closed', (event) => callback(event.payload)).then(fn => {
    unlisten = fn;
  });
  return () => unlisten?.();
};

// ── Compatibilidad: objeto único que replica window.electronAPI ───────────────
// Usado donde el código referencia window.electronAPI directamente.

export const electronAPI = {
  getApps,
  installApp,
  uninstallApp,
  updateApp,
  togglePin,
  launchApp,
  getSettings,
  updateSettings,
  getUser,
  saveUser,
  createShortcuts,
  removeShortcuts,
  getStorageInfo,
  clearAppData,
  getDefaultInstallPath,
  getPlatform,
  getVersion,
  openExternal,
  selectDirectory,
  onAppWindowClosed,
  refreshTray: () => Promise.resolve(), // El tray se actualiza automáticamente
  minimizeWindow: () => invoke('minimize_window').catch(() => {}),
  maximizeWindow: () => invoke('maximize_window').catch(() => {}),
  closeWindow:    () => invoke('close_window').catch(() => {}),
};

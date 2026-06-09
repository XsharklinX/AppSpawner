'use strict';
/**
 * store.js — Persistencia de datos en JSON local.
 * Usa escritura atómica (write-to-temp + rename) para evitar corrupción
 * si el proceso es terminado a mitad de escritura.
 */
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { app } = require('electron');

const STORE_FILE = 'appspawner-data.json';
const BACKUP_FILE = 'appspawner-data.bak.json';

function getStorePath()   { return path.join(app.getPath('userData'), STORE_FILE); }
function getBackupPath()  { return path.join(app.getPath('userData'), BACKUP_FILE); }

const DEFAULT_DATA = {
  user: null,
  settings: {
    theme:               'dark',
    themePreset:         'dark',
    customTheme:         null,
    language:            'es',
    desktopShortcuts:    true,
    startMenuShortcuts:  true,
    installPath:         '',
    interceptLinks:      false,
    forceBrowser:        false,
    autoLaunch:          false,
    hardwareAcceleration: true,
    customUserAgent:     '',
    adblockEnabled:         true,
    adblockCosmetic:        true,
    adblockHttpsUpgrade:    true,
    adblockAggressive:      true,
    adblockAnnoyances:      true,
    adblockLastAutoUpdate:  null,
    autoBackupEnabled:   true,
    autoBackupIntervalHours: 24,
    autoBackupKeep:      10,
    lastAutoBackupAt:    null,
    portableMode:        false,
    updateChannel:       'stable',
    securityPinHash:     null,
    securityPinSalt:     null,
    vaultLockTimeoutMinutes: 15,
    separatePersonalWork: true,
    adblockSubscriptions: [
      {
        id: 'easylist',
        name: 'EasyList',
        url: 'https://easylist.to/easylist/easylist.txt',
        enabled: true,
      },
      {
        id: 'easyprivacy',
        name: 'EasyPrivacy',
        url: 'https://easylist.to/easylist/easyprivacy.txt',
        enabled: true,
      },
      {
        id: 'easylist-annoyances',
        name: 'EasyList Annoyances',
        url: 'https://easylist.to/easylist/fanboy-annoyance.txt',
        enabled: true,
      },
    ],
  },
  apps:       [],
  workspaces: [],
  profiles:   [],
};

/** Lee el store, con fallback a backup si el JSON está corrupto */
function read() {
  const storePath  = getStorePath();
  const backupPath = getBackupPath();

  for (const filePath of [storePath, backupPath]) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw    = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_DATA,
        ...parsed,
        settings:   { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) },
        apps:       Array.isArray(parsed.apps)       ? parsed.apps       : [],
        workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
        profiles:   Array.isArray(parsed.profiles)   ? parsed.profiles   : [],
      };
    } catch (err) {
      console.warn(`[Store] ${filePath === storePath ? 'Principal' : 'Backup'} corrupto, intentando siguiente...`);
    }
  }

  console.error('[Store] Ambos archivos corruptos, usando defaults.');
  return structuredClone(DEFAULT_DATA);
}

/**
 * Escritura atómica:
 *  1. Escribe a un archivo temporal
 *  2. Hace backup del archivo actual
 *  3. Renombra el temporal al archivo principal
 * Si el proceso muere entre 1 y 3, el archivo original sobrevive intacto.
 */
function write(data) {
  const storePath  = getStorePath();
  const backupPath = getBackupPath();
  const tempPath   = path.join(os.tmpdir(), `appspawner-${Date.now()}.tmp.json`);

  try {
    const json = JSON.stringify(data, null, 2);

    // 1. Escribir al temp
    fs.writeFileSync(tempPath, json, 'utf-8');

    // 2. Rotar backup (solo si el principal existe)
    if (fs.existsSync(storePath)) {
      fs.copyFileSync(storePath, backupPath);
    }

    // 3. Atomic rename
    fs.renameSync(tempPath, storePath);
  } catch (err) {
    console.error('[Store] Error en escritura atómica:', err.message);
    // Cleanup del temp si quedó
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
  }
}

module.exports = { read, write, getStorePath, getBackupPath };

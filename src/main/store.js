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
const DATA_SCHEMA_VERSION = '3.2.0';

function getStorePath()   { return path.join(app.getPath('userData'), STORE_FILE); }
function getBackupPath()  { return path.join(app.getPath('userData'), BACKUP_FILE); }

const DEFAULT_DATA = {
  dataVersion: DATA_SCHEMA_VERSION,
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
    securityRecoveryHash: null,
    securityRecoverySalt: null,
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

const DEFAULT_APP_SETTINGS = {
  category: 'general',
  iconType: 'initials',
  iconValue: '',
  iconColor: '#7c3aed',
  accountLabel: '',
  workspaceId: null,
  openMode: 'normal',
  proxy: {
    enabled: false,
    type: 'http',
    host: '',
    port: 8080,
  },
  screenshotConfig: {
    enabled: false,
    interval: 30,
  },
  adblockEnabled: true,
  adblockCustomRules: [],
  adblockCosmeticRules: [],
  adblockFilterCategories: null,
  adblockAggressiveOverride: null,
  userAgent: '',
  windowConfig: {
    width: 1280,
    height: 800,
  },
  toolbar: {
    enabled: false,
    buttons: ['back', 'forward', 'reload', 'home', 'pip', 'notes', 'devtools'],
  },
  shortcuts: {
    enabled: true,
    reload: 'F5',
    reloadAlt: 'Ctrl+R',
    back: 'Alt+ArrowLeft',
    forward: 'Alt+ArrowRight',
    devtools: 'Ctrl+Shift+I',
    pip: 'Ctrl+Shift+P',
  },
  security: {
    locked: false,
    sensitive: false,
    profile: 'personal',
  },
  automation: {
    onOpen: {
      enabled: false,
      delayMs: 0,
      reload: false,
      injectCss: '',
      injectJs: '',
    },
  },
  pinned: false,
  lastUsed: null,
  openCount: 0,
  installedAt: null,
};

function mergeObject(defaults, value) {
  return { ...defaults, ...((value && typeof value === 'object') ? value : {}) };
}

function normalizeApp(appConfig = {}) {
  const appData = mergeObject(DEFAULT_APP_SETTINGS, appConfig);
  const toolbar = mergeObject(DEFAULT_APP_SETTINGS.toolbar, appData.toolbar);
  const shortcuts = mergeObject(DEFAULT_APP_SETTINGS.shortcuts, appData.shortcuts);
  const security = mergeObject(DEFAULT_APP_SETTINGS.security, appData.security);
  const automation = mergeObject(DEFAULT_APP_SETTINGS.automation, appData.automation);

  return {
    ...appData,
    category: appData.category || 'general',
    iconType: appData.iconType || 'initials',
    iconValue: appData.iconValue || String(appData.name || '').trim().charAt(0).toUpperCase(),
    proxy: mergeObject(DEFAULT_APP_SETTINGS.proxy, appData.proxy),
    screenshotConfig: mergeObject(DEFAULT_APP_SETTINGS.screenshotConfig, appData.screenshotConfig),
    windowConfig: mergeObject(DEFAULT_APP_SETTINGS.windowConfig, appData.windowConfig),
    adblockCustomRules: Array.isArray(appData.adblockCustomRules) ? appData.adblockCustomRules : [],
    adblockCosmeticRules: Array.isArray(appData.adblockCosmeticRules) ? appData.adblockCosmeticRules : [],
    toolbar: {
      ...toolbar,
      buttons: Array.isArray(toolbar.buttons) && toolbar.buttons.length
        ? toolbar.buttons
        : DEFAULT_APP_SETTINGS.toolbar.buttons,
    },
    shortcuts,
    security: {
      ...security,
      profile: ['personal', 'work'].includes(security.profile) ? security.profile : 'personal',
    },
    automation: {
      ...automation,
      onOpen: mergeObject(DEFAULT_APP_SETTINGS.automation.onOpen, automation.onOpen),
    },
    openCount: Number(appData.openCount) || 0,
    installedAt: appData.installedAt || Date.now(),
  };
}

// Normaliza datos antiguos al esquema actual sin mutar el objeto original.
function normalizeData(parsed = {}) {
  return {
    ...DEFAULT_DATA,
    ...parsed,
    dataVersion: DATA_SCHEMA_VERSION,
    settings:   { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) },
    apps:       Array.isArray(parsed.apps)       ? parsed.apps.map(normalizeApp) : [],
    workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
    profiles:   Array.isArray(parsed.profiles)   ? parsed.profiles   : [],
  };
}

function hasObjectKey(value, key) {
  return value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);
}

function getMigrationStatus() {
  const storePath = getStorePath();
  if (!fs.existsSync(storePath)) {
    return {
      needed: false,
      currentVersion: DATA_SCHEMA_VERSION,
      targetVersion: DATA_SCHEMA_VERSION,
      appsChecked: 0,
      appsNeedingMigration: 0,
      missingSettings: [],
      storePath,
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    const missingSettings = Object.keys(DEFAULT_DATA.settings)
      .filter(key => !hasObjectKey(parsed.settings || {}, key));
    const migrationFields = [
      'security',
      'automation',
      'toolbar',
      'shortcuts',
      'windowConfig',
      'adblockCustomRules',
      'adblockCosmeticRules',
    ];
    const apps = Array.isArray(parsed.apps) ? parsed.apps : [];
    const appsNeedingMigration = apps.filter(appConfig =>
      migrationFields.some(key => !hasObjectKey(appConfig, key))
    ).length;
    const currentVersion = parsed.dataVersion || 'legacy';
    const needed = currentVersion !== DATA_SCHEMA_VERSION || appsNeedingMigration > 0 || missingSettings.length > 0;

    return {
      needed,
      currentVersion,
      targetVersion: DATA_SCHEMA_VERSION,
      appsChecked: apps.length,
      appsNeedingMigration,
      missingSettings,
      storePath,
    };
  } catch (err) {
    return {
      needed: true,
      currentVersion: 'corrupt',
      targetVersion: DATA_SCHEMA_VERSION,
      appsChecked: 0,
      appsNeedingMigration: 0,
      missingSettings: [],
      storePath,
      error: err.message,
    };
  }
}

function migrate() {
  const before = getMigrationStatus();
  if (before.error) return { success: false, ...before };
  if (!before.needed) {
    return {
      success: true,
      migrated: false,
      before,
      after: before,
    };
  }

  const normalized = normalizeData(read());
  write(normalized);
  return {
    success: true,
    migrated: before.needed,
    before,
    after: getMigrationStatus(),
  };
}

// Lee el store, con fallback a backup si el JSON esta corrupto.
function read() {
  const storePath  = getStorePath();
  const backupPath = getBackupPath();

  for (const filePath of [storePath, backupPath]) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw    = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return normalizeData(parsed);
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

module.exports = {
  read,
  write,
  getStorePath,
  getBackupPath,
  normalizeApp,
  getMigrationStatus,
  migrate,
  DATA_SCHEMA_VERSION,
};

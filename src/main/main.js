'use strict';
/**
 * main.js — Proceso principal de AppSpawner v2.5
 *
 * Mejoras v2.5:
 *  - System Tray con menú de acceso rápido a todas las apps
 *  - autoLaunch real via app.setLoginItemSettings()
 *  - Badge de notificaciones desde título de ventana SSB
 *  - SSB preload (ssb-preload.js) en cada ventana SSB
 *  - User-agent personalizable por app
 *  - Atajos de teclado globales (Ctrl+Alt+Space → Quick Launcher)
 *  - URL security: bloquea protocolos no http/https
 *  - Limpieza completa de sesión al desinstalar
 *  - Single-instance lock con forwarding de --launch-app
 */

const {
  app, BrowserWindow, ipcMain, shell, dialog,
  Menu, Tray, nativeImage, globalShortcut, clipboard,
  session: electronSession, screen,
} = require('electron');
const path = require('path');
const url  = require('url');
const fs   = require('fs');
const crypto = require('crypto');

const store  = require('./store');
const { registerAppManagerHandlers, getSessionSize } = require('./ipc/app-manager');
const { registerDiagnosticsHandlers, recordLoadError, recordPermission } = require('./ipc/diagnostics');
const { registerShortcutHandlers }   = require('./ipc/shortcuts');
const { registerWorkspaceHandlers }  = require('./ipc/workspaces');
const { registerSessionHandlers }    = require('./ipc/sessions');
const { registerScriptHandlers, readScripts } = require('./ipc/scripts');
const { registerCredentialHandlers } = require('./ipc/credentials');
const { registerTotpHandlers }       = require('./ipc/totp');
const { registerAdBlockHandlers, applyAdBlockForApp, getCosmeticCssForUrl, isBlockedDomain, logCosmeticBlock, recordBlockedNavigation } = require('./ipc/adblock');
const { attachDownloadInterceptor, registerDownloadHandlers } = require('./ipc/downloads');
const { recordNavigation, registerHistoryHandlers } = require('./ipc/history');
const { v4: uuidv4 }                 = require('uuid');
const { ensureAppIcon }              = require('./icon-utils');
const { registerCrashLogging }       = require('./crash-logger');

// ── Constantes ────────────────────────────────────────────────────────────────

const IS_DEV = !app.isPackaged;
const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';

registerCrashLogging();

// Dominios de OAuth/auth que deben navegar dentro del SSB (no abrirse en navegador externo)
const AUTH_DOMAINS = [
  'accounts.google.com',
  'oauth2.googleapis.com',
  'login.microsoftonline.com',
  'login.live.com',
  'login.windows.net',
  'appleid.apple.com',
];
function isAuthDomain(hostname) {
  return AUTH_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
}
const PORTABLE_ROOT = app.isPackaged ? path.dirname(process.execPath) : process.cwd();
const PORTABLE_MARKER = path.join(PORTABLE_ROOT, 'portable.flag');
const PORTABLE_DATA_DIR = path.join(PORTABLE_ROOT, 'AppSpawnerData');

if (
  process.argv.includes('--portable') ||
  process.env.APPSPAWNER_PORTABLE === '1' ||
  fs.existsSync(PORTABLE_MARKER)
) {
  app.setPath('userData', PORTABLE_DATA_DIR);
}

/** Mapa de ventanas SSB activas: appId → BrowserWindow */
const appWindows = new Map();
let mainWindow   = null;
let tray         = null;
let ipcHandlersRegistered = false;
let trayRefreshRegistered = false;

// Límite de reglas cosméticas guardadas por app vía el element picker — cada
// regla se persiste en el store, así que se acota para no inflar el JSON.
const MAX_APP_COSMETIC_RULES = 300;

// Throttle de notificaciones "adblock:page-broken" al dashboard: si un sitio
// falla repetidamente (recargas/retries), evita inundar al usuario de avisos.
const PAGE_BROKEN_NOTIFY_INTERVAL_MS = 10000;
const lastPageBrokenNotify = new Map(); // appId → timestamp

// ── Utilidades ────────────────────────────────────────────────────────────────

function getLaunchAppId() {
  const argv = process.argv.slice(IS_DEV ? 2 : 1);
  const arg  = argv.find(a => a.startsWith('--launch-app='));
  return arg ? arg.replace('--launch-app=', '').trim() : null;
}

function getRendererUrl() {
  if (IS_DEV) return 'http://localhost:5173';
  return url.format({
    pathname: path.join(app.getAppPath(), 'dist', 'renderer', 'index.html'),
    protocol: 'file:',
    slashes:  true,
  });
}

// ── System Tray ───────────────────────────────────────────────────────────────

function getTrayIconForApp(appConfig) {
  try {
    const dir = path.join(app.getPath('userData'), 'app-icons');
    if (!fs.existsSync(dir)) return undefined;
    const match = fs.readdirSync(dir).find(f => f.includes(`-${appConfig.id}-`) && f.endsWith('.png'));
    if (!match) return undefined;
    const img = nativeImage.createFromPath(path.join(dir, match));
    return img && !img.isEmpty() ? img.resize({ width: 16, height: 16 }) : undefined;
  } catch { return undefined; }
}

function buildTrayMenu() {
  const data = store.read();
  const recent = [...data.apps]
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
    .slice(0, 10);

  const appItems = recent.length > 0
    ? recent.map(a => {
        const icon = getTrayIconForApp(a);
        return { label: a.name, ...(icon ? { icon } : {}), click: () => createAppWindow(a) };
      })
    : [{ label: 'Sin apps instaladas', enabled: false }];

  return Menu.buildFromTemplate([
    {
      label: 'AppSpawner',
      enabled: false,
      // En macOS el primer item actúa como header
    },
    { type: 'separator' },
    {
      label: 'Abrir Dashboard',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        } else {
          registerIpcHandlers();
          createMainWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Apps Recientes',
      enabled: false,
    },
    ...appItems,
    { type: 'separator' },
    {
      label: 'Salir de AppSpawner',
      role:  'quit',
    },
  ]);
}

function createTray() {
  if (tray) {
    tray.setContextMenu(buildTrayMenu());
    return tray;
  }

  // Crear un ícono básico de 16x16 en base64 para el tray
  // En producción, usar un archivo icon.png real en assets/
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  let trayIcon;

  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    // Ícono fallback generado programáticamente
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('AppSpawner');
  tray.setContextMenu(buildTrayMenu());

  // Doble clic en el tray → abrir dashboard (Windows/Linux)
  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      registerIpcHandlers();
      createMainWindow();
    }
  });

  return tray;
}

/** Refresca el menú del tray (llamar después de instalar/desinstalar apps) */
function refreshTray() {
  tray?.setContextMenu(buildTrayMenu());
}

function readJsonDir(relativeDir, { recursive = false } = {}) {
  const root = path.join(app.getPath('userData'), relativeDir);
  const output = {};
  if (!fs.existsSync(root)) return output;

  const walk = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (recursive) walk(full, key);
        continue;
      }
      if (!entry.name.endsWith('.json')) continue;
      try {
        output[key] = JSON.parse(fs.readFileSync(full, 'utf-8'));
      } catch {}
    }
  };

  walk(root);
  return output;
}

function writeJsonDir(relativeDir, files = {}, { mergeArrays = true } = {}) {
  const root = path.join(app.getPath('userData'), relativeDir);
  let written = 0;
  for (const [name, content] of Object.entries(files || {})) {
    if (!/^[a-zA-Z0-9._/-]+\.json$/.test(name) || name.includes('..')) continue;
    const target = path.join(root, name);
    if (!target.startsWith(root)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    let next = content;
    if (mergeArrays && fs.existsSync(target) && Array.isArray(content)) {
      try {
        const current = JSON.parse(fs.readFileSync(target, 'utf-8'));
        if (Array.isArray(current)) {
          const seen = new Set(current.map(item => item?.id).filter(Boolean));
          next = [...current];
          for (const item of content) {
            if (item?.id && seen.has(item.id)) continue;
            next.push(item);
          }
        }
      } catch {}
    }
    fs.writeFileSync(target, JSON.stringify(next, null, 2));
    written++;
  }
  return written;
}

function createBackupPayload() {
  const data = store.read();
  return {
    schema: 'appspawner-backup',
    schemaVersion: 3,
    appVersion: app.getVersion(),
    exportedAt: new Date().toISOString(),
    data: {
      user: data.user,
      settings: data.settings,
      apps: data.apps,
      workspaces: data.workspaces,
      profiles: data.profiles,
    },
    files: {
      credentials: readJsonDir('credentials'),
      totp: readJsonDir('totp'),
      scripts: readJsonDir('user-scripts'),
      sessionSnapshots: readJsonDir('session-snapshots', { recursive: true }),
    },
  };
}

function mergeById(current = [], incoming = []) {
  const map = new Map((Array.isArray(current) ? current : []).map(item => [item.id, item]));
  for (const item of Array.isArray(incoming) ? incoming : []) {
    if (!item?.id) continue;
    map.set(item.id, { ...(map.get(item.id) || {}), ...item });
  }
  return [...map.values()];
}

function importBackupPayload(payload, { mode = 'merge' } = {}) {
  if (!payload || payload.schema !== 'appspawner-backup' || !payload.data) {
    throw new Error('Formato de backup invalido');
  }

  const current = store.read();
  const incoming = payload.data;
  const next = mode === 'replace'
    ? {
        user: incoming.user ?? null,
        settings: { ...(incoming.settings || {}) },
        apps: Array.isArray(incoming.apps) ? incoming.apps : [],
        workspaces: Array.isArray(incoming.workspaces) ? incoming.workspaces : [],
        profiles: Array.isArray(incoming.profiles) ? incoming.profiles : [],
      }
    : {
        ...current,
        user: incoming.user || current.user,
        settings: { ...current.settings, ...(incoming.settings || {}) },
        apps: mergeById(current.apps, incoming.apps),
        workspaces: mergeById(current.workspaces, incoming.workspaces),
        profiles: mergeById(current.profiles, incoming.profiles),
      };

  next.apps = Array.isArray(next.apps) && typeof store.normalizeApp === 'function'
    ? next.apps.map(store.normalizeApp)
    : (Array.isArray(next.apps) ? next.apps : []);
  store.write(next);
  const files = payload.files || {};
  const written = {
    credentials: writeJsonDir('credentials', files.credentials),
    totp: writeJsonDir('totp', files.totp),
    scripts: writeJsonDir('user-scripts', files.scripts, { mergeArrays: false }),
    sessionSnapshots: writeJsonDir('session-snapshots', files.sessionSnapshots, { mergeArrays: false }),
  };

  return {
    success: true,
    mode,
    apps: next.apps.length,
    workspaces: next.workspaces.length,
    profiles: next.profiles.length,
    files: written,
  };
}

function getBackupDir() {
  return path.join(app.getPath('userData'), 'backups');
}

function createLocalBackup(reason = 'manual') {
  const dir = getBackupDir();
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(dir, `appspawner-${reason}-${stamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(createBackupPayload(), null, 2), 'utf-8');
  return filePath;
}

function listLocalBackups() {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      const filePath = path.join(dir, name);
      const stat = fs.statSync(filePath);
      return {
        name,
        path: filePath,
        size: stat.size,
        createdAt: stat.birthtimeMs || stat.mtimeMs,
        modifiedAt: stat.mtimeMs,
      };
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

function pruneLocalBackups(keep = 10) {
  const backups = listLocalBackups();
  const max = Math.max(1, Number(keep) || 10);
  for (const backup of backups.slice(max)) {
    try { fs.unlinkSync(backup.path); } catch {}
  }
}

function runAutomaticBackupIfNeeded() {
  const data = store.read();
  const settings = data.settings || {};
  if (settings.autoBackupEnabled === false) return { skipped: true, reason: 'disabled' };

  const intervalHours = Math.max(1, Number(settings.autoBackupIntervalHours) || 24);
  const last = settings.lastAutoBackupAt ? Date.parse(settings.lastAutoBackupAt) : 0;
  if (last && Date.now() - last < intervalHours * 60 * 60 * 1000) {
    return { skipped: true, reason: 'interval' };
  }

  const filePath = createLocalBackup('auto');
  pruneLocalBackups(settings.autoBackupKeep);
  data.settings.lastAutoBackupAt = new Date().toISOString();
  store.write(data);
  return { success: true, path: filePath };
}

function setPortableMarker(enabled) {
  if (enabled) {
    fs.writeFileSync(
      PORTABLE_MARKER,
      [
        'AppSpawner portable mode',
        'Remove this file to use the normal per-user data directory again.',
      ].join('\n'),
      'utf-8'
    );
    fs.mkdirSync(PORTABLE_DATA_DIR, { recursive: true });
    return true;
  }
  if (fs.existsSync(PORTABLE_MARKER)) fs.unlinkSync(PORTABLE_MARKER);
  return false;
}

function getShortcutTargets(appConfig, settings = {}) {
  const targets = [];
  if (IS_WIN) {
    if (settings.desktopShortcuts !== false) {
      targets.push({ type: 'desktop', path: path.join(app.getPath('desktop'), `${appConfig.name}.lnk`) });
    }
    if (settings.startMenuShortcuts !== false) {
      targets.push({
        type: 'startMenu',
        path: path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${appConfig.name}.lnk`),
      });
    }
  } else if (IS_MAC) {
    if (settings.desktopShortcuts !== false) {
      targets.push({ type: 'desktop', path: path.join(app.getPath('desktop'), `${appConfig.name}.app`) });
    }
    if (settings.startMenuShortcuts !== false) {
      targets.push({ type: 'applications', path: path.join(app.getPath('home'), 'Applications', `${appConfig.name}.app`) });
    }
  } else {
    if (settings.desktopShortcuts !== false) {
      targets.push({ type: 'desktop', path: path.join(app.getPath('desktop'), `${appConfig.name}.desktop`) });
    }
    if (settings.startMenuShortcuts !== false) {
      targets.push({
        type: 'applications',
        path: path.join(app.getPath('home'), '.local', 'share', 'applications', `appspawner-${appConfig.id}.desktop`),
      });
    }
  }
  return targets;
}

function collectCorruptJsonFiles(relativeDir) {
  const root = path.join(app.getPath('userData'), relativeDir);
  const corrupt = [];
  if (!fs.existsSync(root)) return corrupt;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.json')) {
        try {
          JSON.parse(fs.readFileSync(full, 'utf-8'));
        } catch {
          corrupt.push(full);
        }
      }
    }
  };
  walk(root);
  return corrupt;
}

async function runHealthDiagnostics() {
  const data = store.read();
  const settings = data.settings || {};
  const migration = typeof store.getMigrationStatus === 'function' ? store.getMigrationStatus() : null;
  const issues = [];
  const seenIds = new Set();
  const seenUrls = new Map();

  if (migration?.error) {
    issues.push({
      severity: 'error',
      type: 'migration-error',
      message: `No se pudo leer el store local para migracion: ${migration.error}`,
      path: migration.storePath,
    });
  } else if (migration?.needed) {
    issues.push({
      severity: 'warning',
      type: 'migration-needed',
      message: `Datos locales en esquema ${migration.currentVersion}. Ejecuta la migracion v${migration.targetVersion}.`,
      path: migration.storePath,
      action: 'migrate-data',
    });
  }

  for (const appConfig of data.apps || []) {
    if (!appConfig.id || seenIds.has(appConfig.id)) {
      issues.push({
        severity: 'error',
        type: 'duplicate-id',
        appId: appConfig.id,
        appName: appConfig.name || 'App sin nombre',
        message: 'Hay una app sin ID valido o con ID duplicado.',
      });
    }
    if (appConfig.id) seenIds.add(appConfig.id);

    try {
      const parsed = new URL(appConfig.url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
      const normalized = parsed.href.replace(/\/$/, '');
      if (seenUrls.has(normalized)) {
        issues.push({
          severity: 'warning',
          type: 'duplicate-url',
          appId: appConfig.id,
          appName: appConfig.name,
          message: `Comparte URL con ${seenUrls.get(normalized)}.`,
        });
      } else {
        seenUrls.set(normalized, appConfig.name);
      }
    } catch {
      issues.push({
        severity: 'error',
        type: 'invalid-url',
        appId: appConfig.id,
        appName: appConfig.name || 'App sin nombre',
        message: 'La URL no es valida o no usa HTTP/HTTPS.',
      });
    }

    for (const target of getShortcutTargets(appConfig, settings)) {
      if (!fs.existsSync(target.path)) {
        issues.push({
          severity: 'warning',
          type: 'missing-shortcut',
          appId: appConfig.id,
          appName: appConfig.name,
          message: `Falta el acceso directo de ${target.type}.`,
          path: target.path,
          action: 'repair-shortcuts',
        });
      }
    }

    try {
      const icon = await ensureAppIcon(appConfig);
      if (!icon?.png || (IS_WIN && !icon?.ico) || !fs.existsSync(icon.png) || (IS_WIN && !fs.existsSync(icon.ico))) {
        throw new Error('missing icon file');
      }
    } catch {
      issues.push({
        severity: 'warning',
        type: 'missing-icon',
        appId: appConfig.id,
        appName: appConfig.name,
        message: 'No se pudo preparar el icono local de la app.',
      });
    }
  }

  for (const filePath of collectCorruptJsonFiles('session-snapshots')) {
    issues.push({
      severity: 'error',
      type: 'corrupt-session',
      message: 'Hay un snapshot de sesion corrupto.',
      path: filePath,
    });
  }

  const errors = issues.filter(issue => issue.severity === 'error').length;
  const warnings = issues.filter(issue => issue.severity === 'warning').length;
  const score = Math.max(0, 100 - errors * 25 - warnings * 8);

  return {
    score,
    generatedAt: new Date().toISOString(),
    totals: {
      apps: (data.apps || []).length,
      profiles: (data.profiles || []).length,
      workspaces: (data.workspaces || []).length,
      backups: listLocalBackups().length,
      issues: issues.length,
      errors,
      warnings,
    },
    migration,
    issues,
  };
}

// ── Ventana Principal ─────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width:     1300,
    height:    840,
    minWidth:   920,
    minHeight:  620,
    frame:          false,
    titleBarStyle:  IS_MAC ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#09090e',
    show: false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      nodeIntegration:  false,
      contextIsolation: true,
      webSecurity:      true,
      // sandbox:false porque preload.js usa módulos de Node (fs/path) directamente;
      // contextIsolation:true ya evita que el renderer toque el contexto del preload.
      sandbox:          false,
    },
  });

  mainWindow.loadURL(getRendererUrl());

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (IS_DEV) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  // Prevenir cierre real en macOS: ocultar en vez de destruir
  mainWindow.on('close', (e) => {
    if (IS_MAC && tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (!IS_MAC && appWindows.size === 0 && !tray) app.quit();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (/^https?:\/\//i.test(targetUrl)) shell.openExternal(targetUrl);
    return { action: 'deny' };
  });

  return mainWindow;
}

// ── Ventana SSB ───────────────────────────────────────────────────────────────

function verifySecurityPin(pin, settings = store.read().settings) {
  if (!settings.securityPinHash || !settings.securityPinSalt) return false;
  const hash = crypto
    .pbkdf2Sync(String(pin || ''), settings.securityPinSalt, 120000, 32, 'sha256')
    .toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(settings.securityPinHash, 'hex'));
}

function hashSecurityPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(pin || ''), salt, 120000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function normalizeRecoveryCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function generateRecoveryCode() {
  const raw = crypto.randomBytes(9).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return `AS-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function verifyRecoveryCode(code, settings = store.read().settings) {
  if (!settings.securityRecoveryHash || !settings.securityRecoverySalt) return false;
  const normalized = normalizeRecoveryCode(code);
  const hash = crypto
    .pbkdf2Sync(normalized, settings.securityRecoverySalt, 120000, 32, 'sha256')
    .toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(settings.securityRecoveryHash, 'hex'));
}

function buildLoadErrorPage({ appName, targetUrl, errorCode, errorDesc }) {
  const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
  const retryUrl = JSON.stringify(String(targetUrl || ''));
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(appName)} - error de carga</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b10;color:#f5f3ff;font-family:Inter,Segoe UI,Arial,sans-serif}
    main{width:min(560px,calc(100vw - 48px));border:1px solid rgba(255,255,255,.1);border-radius:18px;background:#14141b;padding:28px;box-shadow:0 20px 70px rgba(0,0,0,.45)}
    h1{font-size:20px;margin:0 0 8px} p{color:rgba(245,243,255,.62);line-height:1.5;margin:8px 0}
    code{display:block;margin:16px 0;padding:12px;border-radius:12px;background:rgba(255,255,255,.05);color:#c4b5fd;word-break:break-all}
    button{border:0;border-radius:12px;background:#7c3aed;color:white;font-weight:700;padding:11px 16px;cursor:pointer}
    .meta{font-size:12px;color:rgba(245,243,255,.38)}
  </style>
</head>
<body>
  <main>
    <h1>No se pudo cargar ${esc(appName)}</h1>
    <p>La ventana no quedo en blanco: Electron reporto un fallo de carga. Reintenta o revisa el diagnostico de la app.</p>
    <code>${esc(targetUrl)}</code>
    <p class="meta">Error ${esc(errorCode)}: ${esc(errorDesc)}</p>
    <button onclick="location.href=${retryUrl}">Reintentar</button>
  </main>
</body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function createAppWindow(appConfig, options = {}) {
  const { id, name, url: appUrl, windowConfig = {}, userAgent } = appConfig;

  if (appConfig.security?.locked && !options.authorized) {
    dialog.showErrorBox('App bloqueada', `${name} requiere PIN para abrirse desde AppSpawner.`);
    return null;
  }

  // Si ya está abierta, enfocar
  const existing = appWindows.get(id);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return existing;
  }

  const { settings: _initSettings } = store.read();
  const _initScripts = readScripts(id);
  const ssbRuntimeConfig = {
    version: app.getVersion(),
    homeUrl: appUrl,
    toolbar: appConfig.toolbar || {},
    shortcuts: appConfig.shortcuts || {},
    adblock: {
      enabled: (_initSettings.adblockEnabled ?? true) && (appConfig.adblockEnabled ?? true),
      annoyances: _initSettings.adblockAnnoyances ?? true,
      cosmetic: _initSettings.adblockCosmetic ?? true,
      overlayMode: appConfig.adblockOverlayMode ?? 'normal',
    },
    indicators: {
      adblock: (_initSettings.adblockEnabled ?? true) && (appConfig.adblockEnabled ?? true),
      scripts: (_initScripts?.enabled !== false) && !!(_initScripts?.css?.trim() || _initScripts?.js?.trim()),
      proxy:   !!(appConfig.proxy?.enabled && appConfig.proxy?.host),
    },
  };

  const win = new BrowserWindow({
    width:    windowConfig.width  || 1280,
    height:   windowConfig.height || 800,
    minWidth:  600,
    minHeight: 400,
    title:     name,
    backgroundColor: '#ffffff',
    webPreferences: {
      // CRÍTICO: partición aislada → cookies/localStorage independientes por app
      partition:        `persist:app_${id}`,
      nodeIntegration:  false,
      contextIsolation: true,
      webSecurity:      true,
      // sandbox:false porque ssb-preload.js usa módulos de Node (fs/path) directamente;
      // contextIsolation:true ya evita que el sitio remoto toque el contexto del preload.
      sandbox:          false,
      // Inyectar el preload también en iframes (incl. cross-origin): los reproductores
      // de video embebidos de terceros son donde suelen vivir los "social bars" de
      // anuncios (notificaciones falsas de Snapchat/Telegram), invisibles para el
      // escáner de molestias si sólo corre en el frame principal.
      nodeIntegrationInSubFrames: true,
      // Preload de navegación SSB
      preload:          path.join(__dirname, 'ssb-preload.js'),
      additionalArguments: [
        `--appspawner-config=${encodeURIComponent(JSON.stringify(ssbRuntimeConfig))}`,
      ],
    },
    autoHideMenuBar: true,
  });

  const windowAppId = `com.appspawner.app.${id}`;
  const installedExe = IS_WIN && app.isPackaged
    ? path.join(process.env.LOCALAPPDATA || '', 'Programs', 'AppSpawner', 'AppSpawner.exe')
    : process.execPath;

  // User-agent personalizado (para apps que bloquean Electron)
  if (userAgent) win.webContents.setUserAgent(userAgent);

  // Icono de la ventana (taskbar de Windows / dock de macOS)
  try {
    const iconPath = path.join(__dirname, '../../assets/icon.png');
    if (fs.existsSync(iconPath)) win.setIcon(nativeImage.createFromPath(iconPath));
  } catch {}
  ensureAppIcon(appConfig)
    .then(paths => {
      if (win.isDestroyed() || !paths?.png) return;
      win.setIcon(nativeImage.createFromPath(paths.png));
      if (IS_WIN && paths.ico && typeof win.setAppDetails === 'function') {
        win.setAppDetails({
          appId: windowAppId,
          appIconPath: paths.ico,
          appIconIndex: 0,
          relaunchCommand: installedExe,
          relaunchDisplayName: name,
        });
      }
    })
    .catch(() => {});

  // Bloquear popups y ventanas nuevas. Excepción: dominios de OAuth/auth (Google, Microsoft…)
  // se abren como ventana hija de Electron para mantener la sesión del SSB.
  // Anti-popunder: las páginas de streaming/anime suelen disparar window.open() hacia
  // redes de anuncios con cualquier clic (incluido "play" en el video) — esos destinos
  // se descartan en silencio en lugar de mandarse al navegador externo, y limitamos
  // la frecuencia de aperturas externas para frenar ráfagas encadenadas.
  let lastExternalPopupAt = 0;
  win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    try {
      const u = new URL(targetUrl);
      if (isAuthDomain(u.hostname)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 500, height: 660,
            parent: win,
            modal: false,
            autoHideMenuBar: true,
            backgroundColor: '#ffffff',
            webPreferences: {
              partition:        `persist:app_${id}`,
              nodeIntegration:  false,
              contextIsolation: true,
              webSecurity:      true,
            },
          },
        };
      }
      if (isBlockedDomain(targetUrl)) {
        recordBlockedNavigation(id, targetUrl, 'popup');
        if (!win.isDestroyed()) {
          win.webContents.send('ssb:show-toast', { message: `Popup bloqueado: ${u.hostname}`, type: 'warning' });
        }
        return { action: 'deny' };
      }
    } catch {}
    if (/^https?:\/\//i.test(targetUrl)) {
      const now = Date.now();
      if (now - lastExternalPopupAt < 1500) return { action: 'deny' };
      lastExternalPopupAt = now;
      shell.openExternal(targetUrl);
    }
    return { action: 'deny' };
  });

  // Navegación en la misma ventana: si el usuario va a otro dominio, abrir en navegador externo.
  // Excepción: rutas de OAuth/auth del mismo dominio raíz (accounts.google.com, etc.) se dejan pasar
  // como navegación directa para no romper flujos de login.
  win.webContents.on('will-navigate', (event, navUrl) => {
    try {
      const nav  = new URL(navUrl);
      const orig = new URL(appUrl);
      // Bloquear protocolos no web
      if (!['http:', 'https:'].includes(nav.protocol)) {
        event.preventDefault();
        return;
      }
      // Mismo dominio raíz → dejar pasar (navegación normal dentro de la app)
      const rootDomain = h => h.split('.').slice(-2).join('.');
      if (rootDomain(nav.hostname) === rootDomain(orig.hostname)) return;
      // Dominios de OAuth/auth → navegar dentro del SSB para no romper el flujo de login
      if (isAuthDomain(nav.hostname)) return;
      // Dominio de ad/tracker conocido → bloquear silenciosamente (no abrir navegador externo)
      // Esto evita que anuncios de video/popup redirijan al browser del sistema
      if (isBlockedDomain(navUrl)) {
        event.preventDefault();
        recordBlockedNavigation(id, navUrl, 'redirect');
        if (!win.isDestroyed()) {
          win.webContents.send('ssb:show-toast', { message: `Redirect bloqueado: ${nav.hostname}`, type: 'warning' });
        }
        return;
      }
      // Dominio diferente desconocido → abrir en navegador externo (link del usuario)
      event.preventDefault();
      shell.openExternal(navUrl);
    } catch {
      event.preventDefault();
    }
  });

  // Ad Blocker: configurar interceptor en la sesión de esta app
  {
    const { settings } = store.read();
    const globalCosmetic = settings.adblockCosmetic ?? true;
    const cosmeticRules    = appConfig.adblockCosmeticRules    ?? [];
    const filterCategories = appConfig.adblockFilterCategories ?? null;
    const shouldBlock = (settings.adblockEnabled ?? true) && (appConfig.adblockEnabled ?? true);
    const sess = applyAdBlockForApp(id, appConfig, settings, {
      onPermissionRequest: (permission, granted) => recordPermission(id, permission, granted),
    });

    // Gestor de descargas central: captura las descargas de esta app y las
    // reporta al dashboard para verlas/abrirlas todas en un único panel.
    attachDownloadInterceptor(sess, id, name, () => mainWindow);

    // HTTPS upgrade: redirigir http → https para peticiones de subrecursos
    if (settings.adblockHttpsUpgrade ?? true) {
      sess.webRequest.onBeforeSendHeaders({ urls: ['http://*/*'] }, (details, callback) => {
        try {
          const u = new URL(details.url);
          if (!['localhost','127.0.0.1','::1'].includes(u.hostname) && !u.hostname.endsWith('.local')) {
            callback({ requestHeaders: details.requestHeaders });
            return;
          }
        } catch {}
        callback({ requestHeaders: details.requestHeaders });
      });
    }

    // Cosmetic CSS (ocultar banners de cookie, contenedores de ads, segun categorias)
    if (shouldBlock && globalCosmetic) {
      const injectCosmeticCss = async () => {
        try {
          const pageUrl = win.webContents.getURL() || appUrl;
          await win.webContents.insertCSS(getCosmeticCssForUrl(pageUrl, filterCategories, cosmeticRules));
        } catch {}
      };
      win.webContents.on('did-finish-load', async () => { await injectCosmeticCss(); });
      win.webContents.on('dom-ready',       async () => { await injectCosmeticCss(); });
      // Re-inyectar en SPAs cuando el router cambia de ruta (React Router, Vue Router, etc.)
      win.webContents.on('did-navigate-in-page', async () => { await injectCosmeticCss(); });
    }

    // Historial de navegación centralizado: cada cambio de URL dentro de la app
    // se guarda para verlo luego en el panel de historial del dashboard.
    const recordHistoryEntry = () => {
      try { recordNavigation(id, name, win.webContents.getURL(), win.webContents.getTitle()); } catch {}
    };
    win.webContents.on('did-navigate', recordHistoryEntry);
    win.webContents.on('did-navigate-in-page', recordHistoryEntry);
    win.webContents.on('page-title-updated', recordHistoryEntry);

    // Detectar pagina rota: registrar el error para el panel de diagnostico y,
    // si el adblock esta activo, avisar tambien al dashboard (puede ser el causante)
    win.webContents.on('did-fail-load', (_ev, errorCode, errorDesc, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return; // -3 = ERR_ABORTED (navegacion usuario)
      recordLoadError(id, { url: validatedURL, errorCode, errorDesc });
      const now = Date.now();
      const last = lastPageBrokenNotify.get(id) || 0;
      if (shouldBlock && now - last >= PAGE_BROKEN_NOTIFY_INTERVAL_MS) {
        lastPageBrokenNotify.set(id, now);
        mainWindow?.webContents.send('adblock:page-broken', {
          appId: id, appName: name, url: validatedURL, errorCode, errorDesc,
        });
      }
      win.loadURL(buildLoadErrorPage({
        appName: name,
        targetUrl: validatedURL || appUrl,
        errorCode,
        errorDesc,
      })).catch(() => {});
    });
  }

  // Proxy por app (antes de cargar la URL)
  if (appConfig.proxy?.enabled && appConfig.proxy?.host) {
    const { type = 'http', host, port = 8080 } = appConfig.proxy;
    electronSession.fromPartition(`persist:app_${id}`)
      .setProxy({ proxyRules: `${type}://${host}:${port}` })
      .catch(err => console.error(`[Proxy] ${name}:`, err.message));
  }

  win.loadURL(options.navigateTo || appUrl);

  // Menú contextual profesional
  win.webContents.on('context-menu', (_ev, params) => {
    const items = [];

    items.push({ label: 'Atrás',    enabled: params.canGoBack,    click: () => win.webContents.goBack() });
    items.push({ label: 'Adelante', enabled: params.canGoForward, click: () => win.webContents.goForward() });
    items.push({ label: 'Recargar', click: () => win.webContents.reload() });
    items.push({ type: 'separator' });

    if (params.linkURL) {
      items.push({ label: 'Abrir enlace en navegador', click: () => shell.openExternal(params.linkURL) });
      items.push({ label: 'Copiar enlace', click: () => clipboard.writeText(params.linkURL) });
      items.push({ type: 'separator' });
    }

    if (params.selectionText?.trim()) {
      items.push({ label: 'Copiar texto', role: 'copy' });
      items.push({ type: 'separator' });
    }

    if (params.mediaType === 'image' && params.srcURL) {
      items.push({ label: 'Guardar imagen como…', click: () => win.webContents.downloadURL(params.srcURL) });
      items.push({ type: 'separator' });
    }

    items.push({ label: 'Abrir en navegador externo', click: () => shell.openExternal(win.webContents.getURL()) });
    items.push({ label: 'Copiar URL actual', click: () => clipboard.writeText(win.webContents.getURL()) });
    items.push({ type: 'separator' });

    const { settings: ctxSettings } = store.read();
    const ctxApp = store.read().apps.find(a => a.id === id) || appConfig;
    const adblockOn = (ctxSettings.adblockEnabled ?? true) && (ctxApp.adblockEnabled ?? true);

    items.push({
      label: adblockOn ? 'Pausar Ad Block' : 'Reanudar Ad Block',
      click: () => {
        const d = store.read();
        const idx = d.apps.findIndex(a => a.id === id);
        if (idx === -1) return;
        d.apps[idx].adblockEnabled = !(d.apps[idx].adblockEnabled ?? true);
        store.write(d);
        const { settings: s } = store.read();
        applyAdBlockForApp(id, d.apps[idx], s, {
          onPermissionRequest: (permission, granted) => recordPermission(id, permission, granted),
        });
        const enabled = d.apps[idx].adblockEnabled;
        if (!win.isDestroyed()) win.webContents.send('adblock:status-changed', { enabled });
        mainWindow?.webContents.send('adblock:app-toggled', { appId: id, enabled });
        if (enabled) win.webContents.reload();
      },
    });

    items.push({
      label: 'Guardar sesión ahora',
      click: async () => {
        try {
          const cookies = await electronSession.fromPartition(`persist:app_${id}`).cookies.get({});
          const snapshot = { id: uuidv4(), name: `Sesión ${new Date().toLocaleString('es')}`, savedAt: Date.now(), cookies };
          const dir = path.join(app.getPath('userData'), 'session-snapshots', id);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, `${snapshot.id}.json`), JSON.stringify(snapshot));
          if (!win.isDestroyed()) win.webContents.send('ssb:snapshot-saved', { name: snapshot.name });
        } catch (err) { console.error('[ContextMenu:Snapshot]', err.message); }
      },
    });

    items.push({ type: 'separator' });
    items.push({ label: 'Herramientas de desarrollo', click: () => win.webContents.openDevTools() });

    Menu.buildFromTemplate(items).popup({ window: win });
  });

  // Inyectar CSS/JS del usuario + detectar formularios de login
  win.webContents.on('did-finish-load', async () => {
    const scripts = readScripts(id);
    if (scripts.enabled !== false) {
      try {
        const permissions = scripts.permissions || {};
        if (scripts.css?.trim() && permissions.css !== false) await win.webContents.insertCSS(scripts.css);
        if (scripts.js?.trim() && permissions.dom !== false)  await win.webContents.executeJavaScript(scripts.js);
      } catch (err) { console.error(`[Scripts] ${name}:`, err.message); }
    }

    try {
      const automation = appConfig.automation?.onOpen || {};
      const delay = Math.max(0, Math.min(15000, Number(automation.delayMs) || 0));
      if (automation.enabled) {
        setTimeout(async () => {
          if (win.isDestroyed()) return;
          try {
            if (automation.reload) await win.webContents.reload();
            if (automation.injectCss?.trim()) await win.webContents.insertCSS(String(automation.injectCss).slice(0, 50000));
            if (automation.injectJs?.trim()) await win.webContents.executeJavaScript(String(automation.injectJs).slice(0, 50000));
          } catch (err) {
            console.error(`[Automation] ${name}:`, err.message);
          }
        }, delay);
      }
    } catch {}

    // Detectar formulario de login y notificar al dashboard
    try {
      const hasLogin = await win.webContents.executeJavaScript(
        `document.querySelectorAll('input[type="password"]').length > 0`
      );
      if (hasLogin) mainWindow?.webContents.send('app:login-form', { appId: id, appName: name });
    } catch {}
  });

  // Modo de pantalla
  if (appConfig.openMode === 'fullscreen') {
    win.setFullScreen(true);
  } else if (appConfig.openMode === 'compact') {
    win.setAlwaysOnTop(true, 'floating');
  }

  // Actualizar lastUsed en el store
  const data     = store.read();
  const appIndex = data.apps.findIndex(a => a.id === id);
  if (appIndex !== -1) {
    data.apps[appIndex].lastUsed = Date.now();
    store.write(data);
  }

  // DevTools para la ventana SSB
  const onOpenDevTools = (event) => {
    if (event.sender !== win.webContents || win.isDestroyed()) return;
    win.webContents.openDevTools();
  };
  ipcMain.on('ssb:open-devtools', onOpenDevTools);

  // Badge de notificaciones: identificar esta ventana por sender y reenviar al dashboard
  const onBadgeUpdate = (event, count) => {
    if (event.sender !== win.webContents) return;
    if (IS_MAC) app.setBadgeCount(count);
    if (IS_WIN && !win.isDestroyed()) {
      win.setTitle(count > 0 ? `(${count}) ${name}` : name);
    }
    mainWindow?.webContents.send('badge:update', { appId: id, count });
  };
  ipcMain.on('ssb:badge-update', onBadgeUpdate);

  // Clic en una notificación nativa del SO → enfocar/restaurar la ventana de la app
  const onNotificationClicked = (event) => {
    if (event.sender !== win.webContents || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  };
  ipcMain.on('ssb:notification-clicked', onNotificationClicked);

  const onTogglePipWindow = (event) => {
    if (event.sender !== win.webContents || win.isDestroyed()) return;
    const isPip = win.__appSpawnerPip === true;
    win.__appSpawnerPip = !isPip;
    win.setAlwaysOnTop(!isPip, 'floating');

    const data     = store.read();
    const appIndex = data.apps.findIndex(a => a.id === id);
    const pipState = (appIndex !== -1 && data.apps[appIndex].pipState) || {};

    if (!isPip) {
      // Entrando en modo PiP: recordar el tamaño/posición normal y restaurar el último PiP usado
      pipState.normal = win.getBounds();
      win.setResizable(true);
      if (pipState.pip) {
        win.setBounds(pipState.pip);
      } else {
        const area = screen.getPrimaryDisplay().workArea;
        const width = 460, height = 280;
        win.setBounds({ x: area.x + area.width - width - 24, y: area.y + area.height - height - 24, width, height });
      }
    } else {
      // Saliendo de PiP: recordar el tamaño/posición flotante y restaurar el normal
      pipState.pip = win.getBounds();
      win.setBounds(pipState.normal || { width: windowConfig.width || 1280, height: windowConfig.height || 800 });
    }

    if (appIndex !== -1) {
      data.apps[appIndex].pipState = pipState;
      store.write(data);
    }
  };
  ipcMain.on('ssb:toggle-pip-window', onTogglePipWindow);

  // Pausa rapida de AdBlock desde la toolbar SSB
  const onToggleAdBlock = (event) => {
    if (event.sender !== win.webContents || win.isDestroyed()) return;
    const appData  = store.read();
    const appIndex = appData.apps.findIndex(a => a.id === id);
    if (appIndex === -1) return;
    const current = appData.apps[appIndex].adblockEnabled ?? true;
    appData.apps[appIndex].adblockEnabled = !current;
    store.write(appData);
    const { settings } = store.read();
    applyAdBlockForApp(id, appData.apps[appIndex], settings, {
      onPermissionRequest: (permission, granted) => recordPermission(id, permission, granted),
    });
    const newEnabled = appData.apps[appIndex].adblockEnabled;
    event.sender.send('adblock:status-changed', { enabled: newEnabled });
    mainWindow?.webContents.send('adblock:app-toggled', { appId: id, enabled: newEnabled });
    if (newEnabled) win.webContents.reload();
  };
  ipcMain.on('ssb:toggle-adblock', onToggleAdBlock);

  // "Esta pagina se rompio": pausa el AdBlock de esta app, registra el evento
  // en el panel de diagnostico y recarga para que el usuario vea el resultado.
  const onReportBrokenPage = (event) => {
    if (event.sender !== win.webContents || win.isDestroyed()) return;
    const appData  = store.read();
    const appIndex = appData.apps.findIndex(a => a.id === id);
    if (appIndex === -1) return;
    recordLoadError(id, {
      url: win.webContents.getURL(),
      errorCode: 'user-report',
      errorDesc: 'El usuario reportó que la página se veía rota',
    });
    if (appData.apps[appIndex].adblockEnabled ?? true) {
      appData.apps[appIndex].adblockEnabled = false;
      store.write(appData);
      const { settings } = store.read();
      applyAdBlockForApp(id, appData.apps[appIndex], settings, {
        onPermissionRequest: (permission, granted) => recordPermission(id, permission, granted),
      });
      event.sender.send('adblock:status-changed', { enabled: false });
      mainWindow?.webContents.send('adblock:app-toggled', { appId: id, enabled: false });
    }
    win.webContents.reload();
  };
  ipcMain.on('ssb:report-broken-page', onReportBrokenPage);

  // Element picker: cuando el SSB elige un elemento lo registramos como regla cosmetica
  const onElementPicked = (event, { selector, hostname } = {}) => {
    if (event.sender !== win.webContents || !selector) return;
    const pickData  = store.read();
    const pickIndex = pickData.apps.findIndex(a => a.id === id);
    if (pickIndex === -1) return;
    const rule = hostname ? `${hostname}##${selector}` : `##${selector}`;
    const existing = pickData.apps[pickIndex].adblockCosmeticRules || [];
    if (!existing.includes(rule)) {
      const updated = [...existing, rule];
      // Acotar a las reglas más recientes para no inflar el JSON del store indefinidamente
      pickData.apps[pickIndex].adblockCosmeticRules = updated.length > MAX_APP_COSMETIC_RULES
        ? updated.slice(updated.length - MAX_APP_COSMETIC_RULES)
        : updated;
      store.write(pickData);
      mainWindow?.webContents.send('adblock:cosmetic-rule-added', { appId: id, rule });
    }
  };
  ipcMain.on('ssb:element-picked', onElementPicked);

  const onCosmeticBlocked = (event, payload = {}) => {
    if (event.sender !== win.webContents) return;
    logCosmeticBlock(id, payload);
    mainWindow?.webContents.send('adblock:dom-blocked', { appId: id, ...payload });
  };
  ipcMain.on('ssb:cosmetic-blocked', onCosmeticBlocked);

  // Guardar snapshot de sesión desde la toolbar SSB
  const onSaveSnapshot = async (event) => {
    if (event.sender !== win.webContents || win.isDestroyed()) return;
    try {
      const cookies = await electronSession.fromPartition(`persist:app_${id}`).cookies.get({});
      const snapshot = { id: uuidv4(), name: `Sesión ${new Date().toLocaleString('es')}`, savedAt: Date.now(), cookies };
      const dir = path.join(app.getPath('userData'), 'session-snapshots', id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${snapshot.id}.json`), JSON.stringify(snapshot));
      if (!win.isDestroyed()) win.webContents.send('ssb:snapshot-saved', { name: snapshot.name });
    } catch (err) { console.error('[Snapshot]', err.message); }
  };
  ipcMain.on('ssb:save-snapshot', onSaveSnapshot);

  // Actualizar botones de la toolbar desde el editor SSB
  const VALID_TOOLBAR_BTNS = ['back','forward','reload','home','pip','notes','devtools','shield','picker','snapshot','settings','broken'];
  const onUpdateToolbarButtons = (event, buttons) => {
    if (event.sender !== win.webContents || win.isDestroyed()) return;
    const safe = Array.isArray(buttons) ? buttons.filter(b => VALID_TOOLBAR_BTNS.includes(b)) : [];
    const d = store.read();
    const i = d.apps.findIndex(a => a.id === id);
    if (i !== -1) {
      d.apps[i].toolbar = { ...d.apps[i].toolbar, buttons: safe };
      store.write(d);
    }
  };
  ipcMain.on('ssb:update-toolbar-buttons', onUpdateToolbarButtons);

  win.on('closed', () => {
    ipcMain.removeListener('ssb:badge-update', onBadgeUpdate);
    ipcMain.removeListener('ssb:notification-clicked', onNotificationClicked);
    ipcMain.removeListener('ssb:toggle-pip-window', onTogglePipWindow);
    ipcMain.removeListener('ssb:open-devtools', onOpenDevTools);
    ipcMain.removeListener('ssb:toggle-adblock', onToggleAdBlock);
    ipcMain.removeListener('ssb:report-broken-page', onReportBrokenPage);
    ipcMain.removeListener('ssb:element-picked', onElementPicked);
    ipcMain.removeListener('ssb:cosmetic-blocked', onCosmeticBlocked);
    ipcMain.removeListener('ssb:save-snapshot', onSaveSnapshot);
    ipcMain.removeListener('ssb:update-toolbar-buttons', onUpdateToolbarButtons);
    appWindows.delete(id);
    mainWindow?.webContents.send('app:window-closed', id);
    mainWindow?.webContents.send('badge:update', { appId: id, count: 0 });
  });

  // Screenshots programados
  if (appConfig.screenshotConfig?.enabled) {
    const mins = Math.max(1, appConfig.screenshotConfig.interval || 30);
    const screenshotTimer = setInterval(async () => {
      if (win.isDestroyed()) { clearInterval(screenshotTimer); return; }
      try {
        const img     = await win.webContents.capturePage();
        const saveDir = path.join(app.getPath('userData'), 'screenshots', id);
        fs.mkdirSync(saveDir, { recursive: true });
        fs.writeFileSync(path.join(saveDir, `${Date.now()}.png`), img.toPNG());
        const files = fs.readdirSync(saveDir).filter(f => f.endsWith('.png')).sort();
        if (files.length > 20) {
          files.slice(0, files.length - 20).forEach(f => {
            try { fs.unlinkSync(path.join(saveDir, f)); } catch {}
          });
        }
      } catch {}
    }, mins * 60 * 1000);
    win.on('closed', () => clearInterval(screenshotTimer));
  }

  appWindows.set(id, win);
  return win;
}

// ── Registro de IPC ───────────────────────────────────────────────────────────

function registerIpcHandlers() {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;

  registerAppManagerHandlers(ipcMain, store, createAppWindow, appWindows);
  registerShortcutHandlers(ipcMain, store);
  registerWorkspaceHandlers(ipcMain, store);
  registerSessionHandlers(ipcMain);
  registerScriptHandlers(ipcMain);
  registerCredentialHandlers(ipcMain, appWindows);
  registerTotpHandlers(ipcMain);
  registerAdBlockHandlers(ipcMain, store);
  registerDownloadHandlers(ipcMain, () => mainWindow);
  registerHistoryHandlers(ipcMain);
  registerDiagnosticsHandlers(ipcMain, store, getSessionSize);

  // Registrar tiempo de uso por app (llamado desde el renderer cuando cierra una ventana)
  ipcMain.handle('app:record-time', (_e, appId, ms) => {
    if (!appId || typeof ms !== 'number' || ms <= 0) return;
    const d = store.read();
    const i = d.apps.findIndex(a => a.id === appId);
    if (i === -1) return;
    d.apps[i].timeSpentMs = (d.apps[i].timeSpentMs || 0) + Math.round(ms);
    store.recordDailyUsage?.(d.apps[i], { timeMs: Math.round(ms) });
    store.write(d);
  });

  // Activar element picker en una ventana SSB desde el dashboard
  ipcMain.handle('adblock:start-element-picker', async (_e, appId) => {
    const ssbWin = appWindows.get(appId);
    if (!ssbWin || ssbWin.isDestroyed()) return { success: false, error: 'Ventana no encontrada' };
    await ssbWin.webContents.executeJavaScript(
      `typeof window.__appSpawnerStartElementPicker === 'function' && window.__appSpawnerStartElementPicker()`
    ).catch(() => {});
    return { success: true };
  });

  // ── Settings ───────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', () => store.read().settings);

  ipcMain.handle('settings:update', (_e, updates) => {
    const data = store.read();
    data.settings = { ...data.settings, ...updates };
    store.write(data);

    // Aplicar autoLaunch inmediatamente
    if ('autoLaunch' in updates) {
      applyAutoLaunch(updates.autoLaunch);
    }
    if ('portableMode' in updates) {
      try { setPortableMarker(updates.portableMode === true); } catch (err) { console.error('[Portable] Error:', err.message); }
    }

    refreshTray();
    return data.settings;
  });

  ipcMain.handle('security:set-pin', (_e, pin) => {
    const normalized = String(pin || '').trim();
    if (!/^\d{4,12}$/.test(normalized)) {
      return { success: false, error: 'El PIN debe tener entre 4 y 12 digitos' };
    }
    const data = store.read();
    const { salt, hash } = hashSecurityPin(normalized);
    const recoveryCode = generateRecoveryCode();
    const recoveryHash = hashSecurityPin(normalizeRecoveryCode(recoveryCode));
    data.settings.securityPinSalt = salt;
    data.settings.securityPinHash = hash;
    data.settings.securityRecoverySalt = recoveryHash.salt;
    data.settings.securityRecoveryHash = recoveryHash.hash;
    store.write(data);
    return { success: true, recoveryCode };
  });

  ipcMain.handle('security:clear-pin', (_e, pin) => {
    const data = store.read();
    if (data.settings.securityPinHash && !verifySecurityPin(pin, data.settings)) {
      return { success: false, error: 'PIN incorrecto' };
    }
    data.settings.securityPinSalt = null;
    data.settings.securityPinHash = null;
    data.settings.securityRecoverySalt = null;
    data.settings.securityRecoveryHash = null;
    store.write(data);
    return { success: true };
  });

  ipcMain.handle('security:reset-pin-with-recovery', (_e, recoveryCode, newPin) => {
    const normalizedPin = String(newPin || '').trim();
    if (!/^\d{4,12}$/.test(normalizedPin)) {
      return { success: false, error: 'El PIN nuevo debe tener entre 4 y 12 digitos' };
    }
    const data = store.read();
    if (!verifyRecoveryCode(recoveryCode, data.settings)) {
      return { success: false, error: 'Codigo de recuperacion invalido' };
    }
    const { salt, hash } = hashSecurityPin(normalizedPin);
    const nextRecoveryCode = generateRecoveryCode();
    const recoveryHash = hashSecurityPin(normalizeRecoveryCode(nextRecoveryCode));
    data.settings.securityPinSalt = salt;
    data.settings.securityPinHash = hash;
    data.settings.securityRecoverySalt = recoveryHash.salt;
    data.settings.securityRecoveryHash = recoveryHash.hash;
    store.write(data);
    return { success: true, recoveryCode: nextRecoveryCode };
  });

  ipcMain.handle('security:verify-pin', (_e, pin) => {
    const settings = store.read().settings;
    return {
      success: verifySecurityPin(pin, settings),
      configured: !!settings.securityPinHash,
    };
  });

  // ── User ──────────────────────────────────────────────────────────────────
  ipcMain.handle('user:get', () => store.read().user);

  ipcMain.handle('user:save', (_e, user) => {
    const data = store.read();
    data.user  = user;
    if (!data.settings.installPath) {
      data.settings.installPath = path.join(app.getPath('documents'), 'AppSpawnerApps');
    }
    store.write(data);
    return data.user;
  });

  // ── Sistema ────────────────────────────────────────────────────────────────
  ipcMain.handle('system:get-install-path', () => {
    const data = store.read();
    return data.settings.installPath || path.join(app.getPath('documents'), 'AppSpawnerApps');
  });

  ipcMain.handle('system:select-directory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title:      'Seleccionar carpeta de instalación',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('system:select-image', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      title: 'Seleccionar icono de app',
      filters: [{ name: 'Imagen', extensions: ['png', 'svg', 'jpg', 'jpeg', 'webp'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.svg' ? 'image/svg+xml'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.webp' ? 'image/webp'
      : 'image/png';
    const stat = fs.statSync(filePath);
    if (stat.size > 5 * 1024 * 1024) throw new Error('El icono no puede superar 5 MB');
    const data = fs.readFileSync(filePath).toString('base64');
    return { path: filePath, dataUrl: `data:${mime};base64,${data}` };
  });

  ipcMain.handle('system:get-platform', () => process.platform);
  ipcMain.handle('system:get-version',  () => app.getVersion());
  ipcMain.handle('system:is-dev',       () => IS_DEV);
  ipcMain.handle('system:get-portable-info', () => ({
    enabled: store.read().settings.portableMode === true || fs.existsSync(PORTABLE_MARKER),
    activeThisRun: app.getPath('userData') === PORTABLE_DATA_DIR,
    userDataPath: app.getPath('userData'),
    portableDataPath: PORTABLE_DATA_DIR,
    markerPath: PORTABLE_MARKER,
    appPath: app.getAppPath(),
    executablePath: process.execPath,
    isPackaged: app.isPackaged,
  }));
  ipcMain.handle('updates:check', () => ({
    success: true,
    currentVersion: app.getVersion(),
    channel: store.read().settings.updateChannel || 'stable',
    available: false,
    status: 'No hay un feed de actualizaciones configurado para esta build.',
  }));

  // ── Shell ─────────────────────────────────────────────────────────────────
  ipcMain.handle('shell:open-external', (_e, targetUrl) => {
    if (/^https?:\/\//i.test(targetUrl)) shell.openExternal(targetUrl);
  });

  // ── Controles de ventana ──────────────────────────────────────────────────
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.on('window:close', () => {
    IS_MAC ? mainWindow?.hide() : mainWindow?.close();
  });

  // ── Profiles ──────────────────────────────────────────────────────────────
  ipcMain.handle('profiles:get-all', () => store.read().profiles);

  ipcMain.handle('profiles:create', (_e, config) => {
    const data = store.read();
    const profile = {
      id:        uuidv4(),
      name:      String(config.name  || '').trim().slice(0, 50),
      color:     /^#[0-9a-fA-F]{6}$/.test(config.color) ? config.color : '#7c3aed',
      emoji:     String(config.emoji || '🚀').slice(0, 4),
      appIds:    Array.isArray(config.appIds) ? config.appIds : [],
      createdAt: Date.now(),
    };
    data.profiles.push(profile);
    store.write(data);
    return profile;
  });

  ipcMain.handle('profiles:update', (_e, id, updates) => {
    const data = store.read();
    const idx  = data.profiles.findIndex(p => p.id === id);
    if (idx === -1) return { success: false };
    const { id: _id, createdAt, ...safe } = updates;
    data.profiles[idx] = { ...data.profiles[idx], ...safe };
    store.write(data);
    return data.profiles[idx];
  });

  ipcMain.handle('profiles:delete', (_e, id) => {
    const data = store.read();
    data.profiles = data.profiles.filter(p => p.id !== id);
    store.write(data);
    return { success: true };
  });

  // ── OAuth / Easy Login ────────────────────────────────────────────────────
  // Abre una ventana de login con User-Agent de Chrome para compatibilidad con Google/SSO.
  // Usa la MISMA partición de sesión del app → las cookies persisten en el SSB.
  ipcMain.handle('auth:open-login-window', async (_e, appId, loginUrl) => {
    const data      = store.read();
    const appConfig = data.apps.find(a => a.id === appId);
    if (!appConfig) return { success: false, error: 'App no encontrada' };

    const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    const loginWin = new BrowserWindow({
      width:  520,
      height: 720,
      title:  `Iniciar sesión — ${appConfig.name}`,
      parent: mainWindow ?? undefined,
      modal:  false,
      webPreferences: {
        partition:        `persist:app_${appId}`,
        nodeIntegration:  false,
        contextIsolation: true,
        webSecurity:      true,
      },
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
    });

    loginWin.webContents.setUserAgent(CHROME_UA);
    loginWin.loadURL(loginUrl || appConfig.url);

    return new Promise(resolve => {
      // Detect successful login: URL returned to app domain
      loginWin.webContents.on('did-navigate', (_ev, navUrl) => {
        try {
          const rootDomain = h => h.split('.').slice(-2).join('.');
          if (rootDomain(new URL(navUrl).hostname) === rootDomain(new URL(appConfig.url).hostname)) {
            mainWindow?.webContents.send('auth:login-complete', { appId });
            setTimeout(() => { if (!loginWin.isDestroyed()) loginWin.close(); }, 800);
          }
        } catch {}
      });
      loginWin.on('closed', () => resolve({ success: true }));
    });
  });

  // ── Screenshots ───────────────────────────────────────────────────────────
  ipcMain.handle('screenshots:list', (_e, appId) => {
    const dir = path.join(app.getPath('userData'), 'screenshots', appId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.png'))
      .sort().reverse().slice(0, 20)
      .map(f => ({ filename: f, timestamp: parseInt(f), path: path.join(dir, f) }));
  });

  ipcMain.handle('screenshots:open-dir', (_e, appId) => {
    const dir = path.join(app.getPath('userData'), 'screenshots', appId);
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  });

  // ── Import / Export ───────────────────────────────────────────────────────
  ipcMain.handle('data:export', () => {
    const data = store.read();
    return JSON.stringify(createBackupPayload(), null, 2);
  });

  ipcMain.handle('data:export-file', async () => {
    const result = await dialog.showSaveDialog(mainWindow ?? undefined, {
      title: 'Exportar backup de AppSpawner',
      defaultPath: `appspawner-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'AppSpawner Backup', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    fs.writeFileSync(result.filePath, JSON.stringify(createBackupPayload(), null, 2), 'utf-8');
    return { success: true, path: result.filePath };
  });

  ipcMain.handle('data:import', (_e, jsonStr, options = {}) => {
    try {
      const imported = JSON.parse(jsonStr);
      if (!Array.isArray(imported.apps)) throw new Error('Formato inválido');
      const data = store.read();
      let added = 0, skipped = 0;
      for (const a of imported.apps) {
        if (!a.id || !a.url || !a.name) { skipped++; continue; }
        if (data.apps.some(x => x.id === a.id)) { skipped++; continue; }
        try {
          const parsed = new URL(a.url);
          if (!['http:', 'https:'].includes(parsed.protocol)) { skipped++; continue; }
        } catch { skipped++; continue; }
        data.apps.push(typeof store.normalizeApp === 'function' ? store.normalizeApp(a) : { ...a });
        added++;
      }
      store.write(data);
      return { success: true, added, skipped };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:import-full', (_e, jsonStr, options = {}) => {
    try {
      return importBackupPayload(JSON.parse(jsonStr), options);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:import-file', async (_e, options = {}) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
        title: 'Importar backup de AppSpawner',
        properties: ['openFile'],
        filters: [{ name: 'AppSpawner Backup', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePaths?.[0]) return { success: false, canceled: true };
      const payload = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
      return { ...importBackupPayload(payload, options), path: result.filePaths[0] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backups:list', () => listLocalBackups());

  ipcMain.handle('backups:run-now', () => {
    try {
      const filePath = createLocalBackup('manual');
      pruneLocalBackups(store.read().settings.autoBackupKeep);
      return { success: true, path: filePath, backups: listLocalBackups() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('diagnostics:run', async () => {
    try {
      return { success: true, ...(await runHealthDiagnostics()) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:migration-status', () => {
    try {
      return { success: true, ...(store.getMigrationStatus?.() || {}) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('data:migrate-now', () => {
    try {
      return store.migrate?.() || { success: false, error: 'Migracion no disponible' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  if (!trayRefreshRegistered) {
    trayRefreshRegistered = true;
    ipcMain.on('tray:refresh', refreshTray);
  }
}

// ── autoLaunch ────────────────────────────────────────────────────────────────

function applyAutoLaunch(enable) {
  if (IS_DEV) return; // No registrar autoLaunch en modo desarrollo
  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
      name:        'AppSpawner',
      args:        [], // Sin --launch-app, abre el dashboard
    });
  } catch (err) {
    console.error('[AutoLaunch] Error:', err.message);
  }
}

// ── Atajo global ──────────────────────────────────────────────────────────────

function registerGlobalShortcuts() {
  // Ctrl+Alt+Space → Abrir Quick Launcher (abre el dashboard si está oculto)
  try {
    globalShortcut.register('CommandOrControl+Alt+Space', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
          mainWindow.focus();
        } else if (!mainWindow.isFocused()) {
          mainWindow.focus();
        }
        mainWindow.webContents.send('quicklauncher:toggle');
      } else {
        registerIpcHandlers();
        const win = createMainWindow();
        win.once('ready-to-show', () => {
          setTimeout(() => win.webContents.send('quicklauncher:toggle'), 300);
        });
      }
    });
  } catch {}
}

// ── Single Instance Lock ──────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const launchArg = argv.find(a => a.startsWith('--launch-app='));
    if (launchArg) {
      const appId   = launchArg.replace('--launch-app=', '');
      const data    = store.read();
      const appConf = data.apps.find(a => a.id === appId);
      if (appConf) createAppWindow(appConf);
    } else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── Deep linking (protocolo appspawner://) ────────────────────────────────────
if (IS_WIN) app.setAsDefaultProtocolClient('appspawner');

// ── Inicialización ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  // Restaurar estado de autoLaunch desde settings
  const { settings } = store.read();
  if (settings.autoLaunch) applyAutoLaunch(true);
  try { runAutomaticBackupIfNeeded(); } catch (err) { console.error('[Backup] Error:', err.message); }
  try {
    const migration = store.migrate?.();
    if (migration?.migrated) console.log('[Store] Migracion v3.2 aplicada.');
  } catch (err) {
    console.error('[Store] Migracion v3.2 fallida:', err.message);
  }

  const launchAppId = getLaunchAppId();

  if (launchAppId) {
    if (IS_WIN) app.setAppUserModelId(`com.appspawner.app.${launchAppId}`);
    // ── MODO SSB DIRECTO (desde acceso directo) ───────────────────────────────
    const data      = store.read();
    const appConfig = data.apps.find(a => a.id === launchAppId);
    if (appConfig) {
      createAppWindow(appConfig);
    } else {
      console.error(`[AppSpawner] App "${launchAppId}" no encontrada.`);
      app.quit();
    }
  } else {
    if (IS_WIN) app.setAppUserModelId('com.appspawner.app');
    // ── MODO DASHBOARD ────────────────────────────────────────────────────────
    registerIpcHandlers();
    createMainWindow();
    createTray();
    registerGlobalShortcuts();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      registerIpcHandlers();
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  // En macOS y cuando hay tray, no salimos aunque se cierren todas las ventanas
  if (!IS_MAC && !tray) app.quit();
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
});

// Deep link via protocolo appspawner:// (macOS / Linux)
app.on('open-url', (_event, openUrl) => {
  // appspawner://install?url=...&name=... — instalación rápida compartida
  if (openUrl.includes('appspawner://install')) {
    try {
      const params = Object.fromEntries(new URL(openUrl).searchParams);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show(); mainWindow.focus();
        mainWindow.webContents.send('install-from-link', params);
      }
    } catch {}
    return;
  }
  // appspawner://launch/{id}
  const match = openUrl.match(/^appspawner:\/\/launch\/(.+)$/);
  if (match) {
    const appId   = match[1];
    const data    = store.read();
    const appConf = data.apps.find(a => a.id === appId);
    if (appConf) createAppWindow(appConf);
  }
});

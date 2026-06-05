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
  Menu, Tray, nativeImage, globalShortcut,
  session: electronSession,
} = require('electron');
const path = require('path');
const url  = require('url');
const fs   = require('fs');
const crypto = require('crypto');

const store  = require('./store');
const { registerAppManagerHandlers } = require('./ipc/app-manager');
const { registerShortcutHandlers }   = require('./ipc/shortcuts');
const { registerWorkspaceHandlers }  = require('./ipc/workspaces');
const { registerSessionHandlers }    = require('./ipc/sessions');
const { registerScriptHandlers, readScripts } = require('./ipc/scripts');
const { registerCredentialHandlers } = require('./ipc/credentials');
const { registerTotpHandlers }       = require('./ipc/totp');
const { registerAdBlockHandlers, applyAdBlockToSession, getCosmeticCssForUrl } = require('./ipc/adblock');
const { v4: uuidv4 }                 = require('uuid');
const { ensureAppIcon }              = require('./icon-utils');

// ── Constantes ────────────────────────────────────────────────────────────────

const IS_DEV = !app.isPackaged;
const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';
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

function buildTrayMenu() {
  const data = store.read();
  const recent = [...data.apps]
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
    .slice(0, 10); // Máximo 10 apps en el tray

  const appItems = recent.length > 0
    ? recent.map(a => ({
        label: a.name,
        click: () => createAppWindow(a),
      }))
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
  const issues = [];
  const seenIds = new Set();
  const seenUrls = new Map();

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

  const ssbRuntimeConfig = {
    version: app.getVersion(),
    homeUrl: appUrl,
    toolbar: appConfig.toolbar || {},
    shortcuts: appConfig.shortcuts || {},
    adblock: {
      enabled: (store.read().settings.adblockEnabled ?? true) && (appConfig.adblockEnabled ?? true),
      annoyances: store.read().settings.adblockAnnoyances ?? true,
      cosmetic: store.read().settings.adblockCosmetic ?? true,
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
      sandbox:          false,
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

  // Bloquear popups y ventanas nuevas (window.open, target="_blank") — evita que los anuncios
  // abran el navegador del sistema. Los links de navegación real se gestionan en will-navigate.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

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
      // Dominio diferente → abrir en navegador externo (link en el que el usuario hizo clic)
      event.preventDefault();
      shell.openExternal(navUrl);
    } catch {
      event.preventDefault();
    }
  });

  // Ad Blocker: configurar interceptor en la sesión de esta app
  {
    const { settings } = store.read();
    const globalEnabled  = settings.adblockEnabled  ?? true;
    const globalCosmetic = settings.adblockCosmetic  ?? true;
    const globalAggressive = settings.adblockAggressive ?? true;
    const globalAnnoyances = settings.adblockAnnoyances ?? true;
    const appEnabled     = appConfig.adblockEnabled  ?? true;
    const customRules    = appConfig.adblockCustomRules ?? [];
    const shouldBlock    = globalEnabled && appEnabled;
    const sess           = electronSession.fromPartition(`persist:app_${id}`);
    applyAdBlockToSession(sess, id, {
      enabled: shouldBlock,
      customRules,
      aggressive: globalAggressive,
      annoyances: globalAnnoyances,
    });

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

    // Cosmetic CSS (ocultar banners de cookie, contenedores de ads)
    if (shouldBlock && globalCosmetic) {
      const injectCosmeticCss = async () => {
        try {
          const pageUrl = win.webContents.getURL() || appUrl;
          await win.webContents.insertCSS(getCosmeticCssForUrl(pageUrl));
        } catch {}
      };
      win.webContents.on('did-finish-load', async () => {
        await injectCosmeticCss();
      });
      win.webContents.on('dom-ready', async () => {
        await injectCosmeticCss();
      });
    }
  }

  // Proxy por app (antes de cargar la URL)
  if (appConfig.proxy?.enabled && appConfig.proxy?.host) {
    const { type = 'http', host, port = 8080 } = appConfig.proxy;
    electronSession.fromPartition(`persist:app_${id}`)
      .setProxy({ proxyRules: `${type}://${host}:${port}` })
      .catch(err => console.error(`[Proxy] ${name}:`, err.message));
  }

  win.loadURL(appUrl);

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

  const onTogglePipWindow = (event) => {
    if (event.sender !== win.webContents || win.isDestroyed()) return;
    const isPip = win.__appSpawnerPip === true;
    win.__appSpawnerPip = !isPip;
    win.setAlwaysOnTop(!isPip, 'floating');
    if (!isPip) {
      win.setSize(460, 280);
      win.setResizable(true);
    } else {
      win.setSize(windowConfig.width || 1280, windowConfig.height || 800);
    }
  };
  ipcMain.on('ssb:toggle-pip-window', onTogglePipWindow);

  win.on('closed', () => {
    ipcMain.removeListener('ssb:badge-update', onBadgeUpdate);
    ipcMain.removeListener('ssb:toggle-pip-window', onTogglePipWindow);
    ipcMain.removeListener('ssb:open-devtools', onOpenDevTools);
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
    data.settings.securityPinSalt = salt;
    data.settings.securityPinHash = hash;
    store.write(data);
    return { success: true };
  });

  ipcMain.handle('security:clear-pin', (_e, pin) => {
    const data = store.read();
    if (data.settings.securityPinHash && !verifySecurityPin(pin, data.settings)) {
      return { success: false, error: 'PIN incorrecto' };
    }
    data.settings.securityPinSalt = null;
    data.settings.securityPinHash = null;
    store.write(data);
    return { success: true };
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
        data.apps.push({ ...a });
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

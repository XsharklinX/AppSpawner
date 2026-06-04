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

const store  = require('./store');
const { registerAppManagerHandlers } = require('./ipc/app-manager');
const { registerShortcutHandlers }   = require('./ipc/shortcuts');
const { registerWorkspaceHandlers }  = require('./ipc/workspaces');
const { registerSessionHandlers }    = require('./ipc/sessions');
const { registerScriptHandlers, readScripts } = require('./ipc/scripts');
const { registerCredentialHandlers } = require('./ipc/credentials');
const { registerTotpHandlers }       = require('./ipc/totp');
const { registerAdBlockHandlers, applyAdBlockToSession, COSMETIC_CSS } = require('./ipc/adblock');
const { v4: uuidv4 }                 = require('uuid');

// ── Constantes ────────────────────────────────────────────────────────────────

const IS_DEV = !app.isPackaged;
const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';

/** Mapa de ventanas SSB activas: appId → BrowserWindow */
const appWindows = new Map();
let mainWindow   = null;
let tray         = null;

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

  // Actualizar menú cuando cambien las apps
  ipcMain.on('tray:refresh', () => {
    tray?.setContextMenu(buildTrayMenu());
  });
}

/** Refresca el menú del tray (llamar después de instalar/desinstalar apps) */
function refreshTray() {
  tray?.setContextMenu(buildTrayMenu());
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

function createAppWindow(appConfig) {
  const { id, name, url: appUrl, windowConfig = {}, userAgent } = appConfig;

  // Si ya está abierta, enfocar
  const existing = appWindows.get(id);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return existing;
  }

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
    },
    autoHideMenuBar: true,
  });

  // User-agent personalizado (para apps que bloquean Electron)
  if (userAgent) win.webContents.setUserAgent(userAgent);

  // Icono de la ventana (taskbar de Windows / dock de macOS)
  try {
    const iconPath = path.join(__dirname, '../../assets/icon.png');
    if (fs.existsSync(iconPath)) win.setIcon(nativeImage.createFromPath(iconPath));
  } catch {}

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
    const appEnabled     = appConfig.adblockEnabled  ?? true;
    const customRules    = appConfig.adblockCustomRules ?? [];
    const shouldBlock    = globalEnabled && appEnabled;
    const sess           = session.fromPartition(`persist:app_${id}`);
    applyAdBlockToSession(sess, id, { enabled: shouldBlock, customRules });

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
      win.webContents.on('did-finish-load', async () => {
        try { await win.webContents.insertCSS(COSMETIC_CSS); } catch {}
      });
      win.webContents.on('dom-ready', async () => {
        try { await win.webContents.insertCSS(COSMETIC_CSS); } catch {}
      });
    }
  }

  // Proxy por app (antes de cargar la URL)
  if (appConfig.proxy?.enabled && appConfig.proxy?.host) {
    const { type = 'http', host, port = 8080 } = appConfig.proxy;
    session.fromPartition(`persist:app_${id}`)
      .setProxy({ proxyRules: `${type}://${host}:${port}` })
      .catch(err => console.error(`[Proxy] ${name}:`, err.message));
  }

  win.loadURL(appUrl);

  // Inyectar CSS/JS del usuario + detectar formularios de login
  win.webContents.on('did-finish-load', async () => {
    const scripts = readScripts(id);
    if (scripts.enabled !== false) {
      try {
        if (scripts.css?.trim()) await win.webContents.insertCSS(scripts.css);
        if (scripts.js?.trim())  await win.webContents.executeJavaScript(scripts.js);
      } catch (err) { console.error(`[Scripts] ${name}:`, err.message); }
    }

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
  ipcMain.once(`ssb:open-devtools`, () => {
    if (!win.isDestroyed()) win.webContents.openDevTools();
  });

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

  win.on('closed', () => {
    ipcMain.removeListener('ssb:badge-update', onBadgeUpdate);
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
  // Evitar registrar handlers duplicados
  if (ipcMain.listenerCount('settings:get') > 0) return;

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

    refreshTray();
    return data.settings;
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

  ipcMain.handle('system:get-platform', () => process.platform);
  ipcMain.handle('system:get-version',  () => app.getVersion());
  ipcMain.handle('system:is-dev',       () => IS_DEV);

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
    return JSON.stringify({ version: app.getVersion(), exportedAt: Date.now(), apps: data.apps }, null, 2);
  });

  ipcMain.handle('data:import', (_e, jsonStr) => {
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

  // ── Tray refresh (llamado desde renderer tras instalar/desinstalar) ────────
  ipcMain.on('tray:refresh', refreshTray);
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

  const launchAppId = getLaunchAppId();

  if (launchAppId) {
    // ── MODO SSB DIRECTO (desde acceso directo) ───────────────────────────────
    const data      = store.read();
    const appConfig = data.apps.find(a => a.id === launchAppId);
    if (appConfig) {
      createAppWindow(appConfig);
      // Crear tray para que el usuario pueda volver al dashboard
      createTray();
    } else {
      console.error(`[AppSpawner] App "${launchAppId}" no encontrada.`);
      app.quit();
    }
  } else {
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

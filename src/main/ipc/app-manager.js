'use strict';
/**
 * app-manager.js — CRUD de apps SSB.
 * Incluye: validación de URL, deduplicación, limpieza de sesión al desinstalar,
 * user-agent personalizable y ventana preconfigurada.
 */
const { v4: uuidv4 } = require('uuid');
const { app, session } = require('electron');
const { clearAppDiagnostics } = require('./diagnostics');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** Genera un color de acento determinista */
function seedColor(name) {
  const palette = [
    '#7c3aed','#2563eb','#059669','#dc2626','#d97706',
    '#db2777','#0891b2','#65a30d','#ea580c','#6366f1',
    '#0d9488','#b91c1c','#c026d3','#1d4ed8','#92400e',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

/**
 * Valida y normaliza una URL.
 * Solo acepta http:// y https:// (bloquea file://, javascript://, etc.)
 * @returns {string|null} URL normalizada o null si es inválida
 */
function sanitizeUrl(rawUrl) {
  try {
    let url = rawUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function removeNativeShortcuts(appConfig) {
  if (!appConfig?.name) return;
  const targets = process.platform === 'win32'
    ? [
        path.join(app.getPath('desktop'), `${appConfig.name}.lnk`),
        path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${appConfig.name}.lnk`),
      ]
    : process.platform === 'darwin'
      ? [
          path.join(app.getPath('desktop'), `${appConfig.name}.app`),
          path.join(app.getPath('home'), 'Applications', `${appConfig.name}.app`),
        ]
      : [
          path.join(app.getPath('desktop'), `appspawner-${appConfig.id}.desktop`),
          path.join(app.getPath('home'), '.local', 'share', 'applications', `appspawner-${appConfig.id}.desktop`),
        ];

  for (const target of targets) {
    try {
      if (!fs.existsSync(target)) continue;
      const stat = fs.statSync(target);
      if (stat.isDirectory()) fs.rmSync(target, { recursive: true, force: true });
      else fs.unlinkSync(target);
    } catch {}
  }
}

function removeAppFiles(appId) {
  const userData = app.getPath('userData');
  const targets = [
    path.join(userData, 'credentials', `${appId}.json`),
    path.join(userData, 'totp', `${appId}.json`),
    path.join(userData, 'user-scripts', `${appId}.json`),
    path.join(userData, 'screenshots', appId),
    path.join(userData, 'session-snapshots', appId),
    path.join(userData, 'Partitions', `app_${appId}`),
  ];

  for (const target of targets) {
    try {
      if (!fs.existsSync(target)) continue;
      const stat = fs.statSync(target);
      if (stat.isDirectory()) fs.rmSync(target, { recursive: true, force: true });
      else fs.unlinkSync(target);
    } catch {}
  }
}

function pruneAppReferences(data, appId) {
  data.profiles = (data.profiles || []).map(profile => ({
    ...profile,
    appIds: Array.isArray(profile.appIds) ? profile.appIds.filter(id => id !== appId) : [],
  }));
  data.workspaces = (data.workspaces || []).map(workspace => ({
    ...workspace,
    appIds: Array.isArray(workspace.appIds) ? workspace.appIds.filter(id => id !== appId) : workspace.appIds,
  }));
}

function verifySecurityPin(pin, settings = {}) {
  if (!settings.securityPinHash || !settings.securityPinSalt) return false;
  try {
    const hash = crypto
      .pbkdf2Sync(String(pin || ''), settings.securityPinSalt, 120000, 32, 'sha256')
      .toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(settings.securityPinHash, 'hex'));
  } catch {
    return false;
  }
}

function mergeNestedAppUpdates(current, updates) {
  const next = { ...current, ...updates };
  for (const key of ['proxy', 'screenshotConfig', 'windowConfig', 'toolbar', 'shortcuts', 'security']) {
    if (updates[key] && typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
      next[key] = { ...(current[key] || {}), ...updates[key] };
    }
  }
  if (updates.automation && typeof updates.automation === 'object') {
    next.automation = {
      ...(current.automation || {}),
      ...updates.automation,
      onOpen: {
        ...(current.automation?.onOpen || {}),
        ...(updates.automation.onOpen || {}),
      },
    };
  }
  return next;
}

/**
 * Calcula el tamaño de la partición de una app de forma asíncrona.
 */
async function getSessionSize(appId) {
  try {
    const { du } = require('fs');
    // La sesión puede exponer cuota, pero no tamaño directo.
    // Accedemos al directorio de particiones de Chromium.
    const path = require('path');
    const fs   = require('fs').promises;
    const partDir = require('path').join(app.getPath('userData'), 'Partitions', `app_${appId}`);

    async function getDirSizeAsync(dir) {
      let size = 0;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        await Promise.all(entries.map(async e => {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) size += await getDirSizeAsync(full);
          else size += (await fs.stat(full).catch(() => ({ size: 0 }))).size;
        }));
      } catch {}
      return size;
    }

    return await getDirSizeAsync(partDir);
  } catch {
    return 0;
  }
}

function registerAppManagerHandlers(ipcMain, store, createAppWindow, appWindows) {

  // ── GET ALL ────────────────────────────────────────────────────────────────
  ipcMain.handle('apps:get-all', () => {
    return store.read().apps;
  });

  // ── INSTALL ───────────────────────────────────────────────────────────────
  ipcMain.handle('apps:install', async (_event, config) => {
    // Validar y sanear URL
    const safeUrl = sanitizeUrl(config.url);
    if (!safeUrl) throw new Error('URL inválida o protocolo no permitido');

    const data = store.read();
    const accountLabel = String(config.accountLabel || '').trim().slice(0, 30);

    // Detectar duplicado: mismo dominio Y misma etiqueta de cuenta
    const dup = data.apps.find(a => {
      try {
        const sameHost  = new URL(a.url).hostname === new URL(safeUrl).hostname;
        const sameLabel = (a.accountLabel || '') === accountLabel;
        return sameHost && sameLabel;
      } catch { return false; }
    });
    if (dup) {
      const msg = accountLabel
        ? `Ya existe "${dup.name}" con la cuenta "${accountLabel}"`
        : `Ya existe "${dup.name}" con ese dominio. Añade una etiqueta de cuenta para crear varias instancias.`;
      throw new Error(msg);
    }

    // Sanitizar windowConfig
    const wc = config.windowConfig || {};
    const windowConfig = {
      width:  Math.max(400, Math.min(Number(wc.width)  || 1280, 3840)),
      height: Math.max(300, Math.min(Number(wc.height) || 800,  2160)),
    };

    const newApp = {
      id:           uuidv4(),
      name:         String(config.name).trim().slice(0, 80),
      url:          safeUrl,
      category:     config.category    || 'general',
      iconType:     ['favicon','initials','emoji','customImage'].includes(config.iconType) ? config.iconType : 'initials',
      iconValue:    config.iconType === 'customImage'
        ? String(config.iconValue || '').slice(0, 7_000_000)
        : String(config.iconValue || '').slice(0, 3) || config.name.trim().charAt(0).toUpperCase(),
      iconColor:    /^#[0-9a-fA-F]{6}$/.test(config.iconColor) ? config.iconColor : seedColor(config.name),
      accountLabel: accountLabel,
      workspaceId:  config.workspaceId || null,
      openMode:         ['normal','fullscreen','compact'].includes(config.openMode) ? config.openMode : 'normal',
      proxy:            {
        enabled: !!config.proxy?.enabled,
        type:    ['http','https','socks4','socks5'].includes(config.proxy?.type) ? config.proxy.type : 'http',
        host:    String(config.proxy?.host || '').trim().slice(0, 200),
        port:    Math.max(1, Math.min(65535, parseInt(config.proxy?.port) || 8080)),
      },
      screenshotConfig: {
        enabled:  !!config.screenshotConfig?.enabled,
        interval: Math.max(1, Math.min(1440, parseInt(config.screenshotConfig?.interval) || 30)),
      },
      adblockEnabled:          config.adblockEnabled            !== false,
      adblockCustomRules:      Array.isArray(config.adblockCustomRules)    ? config.adblockCustomRules    : [],
      adblockCosmeticRules:    Array.isArray(config.adblockCosmeticRules)  ? config.adblockCosmeticRules  : [],
      adblockFilterCategories: config.adblockFilterCategories  ?? null,
      adblockAggressiveOverride: config.adblockAggressiveOverride ?? null,
      userAgent:    config.userAgent   || '',
      windowConfig,
      toolbar: {
        enabled: !!config.toolbar?.enabled,
        buttons: Array.isArray(config.toolbar?.buttons)
          ? config.toolbar.buttons.filter(b => ['back','forward','reload','home','pip','notes','devtools','shield','picker','snapshot','settings'].includes(b)).slice(0, 12)
          : ['back','forward','reload','home','pip','notes','devtools'],
      },
      shortcuts: {
        enabled: config.shortcuts?.enabled !== false,
        reload:   String(config.shortcuts?.reload   || 'F5').slice(0, 40),
        reloadAlt:String(config.shortcuts?.reloadAlt|| 'Ctrl+R').slice(0, 40),
        back:     String(config.shortcuts?.back     || 'Alt+ArrowLeft').slice(0, 40),
        forward:  String(config.shortcuts?.forward  || 'Alt+ArrowRight').slice(0, 40),
        devtools: String(config.shortcuts?.devtools || 'Ctrl+Shift+I').slice(0, 40),
        pip:      String(config.shortcuts?.pip      || 'Ctrl+Shift+P').slice(0, 40),
      },
      security: {
        locked: !!config.security?.locked,
        sensitive: !!config.security?.sensitive,
        profile: ['personal','work'].includes(config.security?.profile) ? config.security.profile : 'personal',
      },
      automation: {
        onOpen: {
          enabled: !!config.automation?.onOpen?.enabled,
          delayMs: Math.max(0, Math.min(15000, Number(config.automation?.onOpen?.delayMs) || 0)),
          reload: !!config.automation?.onOpen?.reload,
          injectCss: String(config.automation?.onOpen?.injectCss || '').slice(0, 50000),
          injectJs: String(config.automation?.onOpen?.injectJs || '').slice(0, 50000),
        },
      },
      catalogId:    config.catalogId   || null,
      pinned:       false,
      lastUsed:     null,
      openCount:    0,
      installedAt:  Date.now(),
    };

    data.apps.push(newApp);
    store.write(data);
    return newApp;
  });

  // ── UNINSTALL ─────────────────────────────────────────────────────────────
  ipcMain.handle('apps:uninstall', async (_event, appId) => {
    const data = store.read();
    const appConfig = data.apps.find(a => a.id === appId);
    removeNativeShortcuts(appConfig);
    removeAppFiles(appId);
    pruneAppReferences(data, appId);
    data.apps  = data.apps.filter(a => a.id !== appId);
    store.write(data);

    // Cerrar ventana SSB si está abierta
    const win = appWindows.get(appId);
    if (win && !win.isDestroyed()) win.close();
    appWindows.delete(appId);

    // Limpiar datos de sesión de Chromium (cookies, cache, localStorage)
    try {
      const sess = session.fromPartition(`persist:app_${appId}`);
      await sess.clearStorageData();
      await sess.clearCache();
    } catch {}

    clearAppDiagnostics(appId);

    return { success: true };
  });

  // ── LAUNCH ────────────────────────────────────────────────────────────────
  ipcMain.handle('apps:launch', async (_event, appId, options = {}) => {
    const data  = store.read();
    const index = data.apps.findIndex(a => a.id === appId);
    if (index === -1) return { success: false, error: 'App no encontrada' };
    if (data.apps[index].security?.locked) {
      if (!data.settings.securityPinHash) {
        return { success: false, requiresPin: true, error: 'Configura un PIN global antes de abrir apps bloqueadas.' };
      }
      if (!verifySecurityPin(options.pin, data.settings)) {
        return { success: false, requiresPin: true, error: options.pin ? 'PIN incorrecto' : 'Esta app requiere PIN.' };
      }
    }
    try {
      createAppWindow(data.apps[index], { authorized: true, navigateTo: options.navigateTo || null });
      data.apps[index].openCount = (data.apps[index].openCount || 0) + 1;
      store.write(data);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'No se pudo abrir la app' };
    }
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────
  ipcMain.handle('apps:update', async (_event, appId, updates) => {
    const data  = store.read();
    const index = data.apps.findIndex(a => a.id === appId);
    if (index === -1) return { success: false, error: 'App no encontrada' };

    // Sanear URL si viene en los updates
    if (updates.url) {
      const safeUrl = sanitizeUrl(updates.url);
      if (!safeUrl) throw new Error('URL inválida');
      updates.url = safeUrl;
    }

    const previousApp = data.apps[index];

    // Prohibir cambiar id / installedAt
    const { id, installedAt, ...safeUpdates } = updates;
    if (safeUpdates.name && safeUpdates.name !== previousApp.name) {
      removeNativeShortcuts(previousApp);
    }
    const merged = mergeNestedAppUpdates(data.apps[index], safeUpdates);
    data.apps[index] = typeof store.normalizeApp === 'function' ? store.normalizeApp(merged) : merged;
    store.write(data);
    return data.apps[index];
  });

  // ── PIN / UNPIN ───────────────────────────────────────────────────────────
  ipcMain.handle('apps:toggle-pin', async (_event, appId) => {
    const data  = store.read();
    const index = data.apps.findIndex(a => a.id === appId);
    if (index === -1) return { success: false };
    data.apps[index].pinned = !data.apps[index].pinned;
    store.write(data);
    return { pinned: data.apps[index].pinned };
  });

  // ── STORAGE INFO (asíncrono) ──────────────────────────────────────────────
  ipcMain.handle('storage:get-info', async () => {
    const data = store.read();
    const sizes = await Promise.all(data.apps.map(async a => ({
      ...a,
      storageBytes: await getSessionSize(a.id),
    })));
    return sizes;
  });

  // ── CLEAR APP DATA ────────────────────────────────────────────────────────
  ipcMain.handle('storage:clear-app-data', async (_event, appId) => {
    const sess = session.fromPartition(`persist:app_${appId}`);
    await sess.clearStorageData();
    await sess.clearCache();
    return { success: true };
  });
}

module.exports = { registerAppManagerHandlers, sanitizeUrl, getSessionSize };

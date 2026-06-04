'use strict';
const path = require('path');
const fs   = require('fs');

// ── Blocklist ─────────────────────────────────────────────────────────────────

let blockSet = new Set();

function loadBlockList() {
  try {
    const file = path.join(__dirname, '../blocklists/domains.json');
    const list = JSON.parse(fs.readFileSync(file, 'utf-8'));
    blockSet = new Set(list);
    console.log(`[AdBlock] Loaded ${blockSet.size} domains`);
  } catch (err) {
    console.error('[AdBlock] Failed to load blocklist:', err.message);
  }
}

/** Comprueba si una URL debe bloquearse. */
function isBlocked(urlStr, customRules = []) {
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
    // Check exact + parent domains
    if (blockSet.has(hostname)) return true;
    const parts = hostname.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      if (blockSet.has(parts.slice(i).join('.'))) return true;
    }
    // Custom user rules (domain substring match)
    for (const rule of customRules) {
      const r = rule.trim().toLowerCase();
      if (r && hostname.includes(r)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ── CSS cosmético (oculta banners, cookies, ads DOM-based) ────────────────────

const COSMETIC_CSS = `
/* AppSpawner AdBlock — cosmetic filter */

/* ── Anuncios de Google ──────────────────────────────────────────── */
ins.adsbygoogle, .adsbygoogle,
[id^="div-gpt-ad"], [id^="google_ads_"],
[id^="dfp-ad"], [class^="dfp-ad"] { display:none!important; }

/* ── Banners de cookies / GDPR ───────────────────────────────────── */
.cc-window, .cc-banner, .cc-floating, .cc-grower,
.cookie-banner, .cookie-notice, .cookie-consent, .cookie-bar, .cookie-message,
.cookieBanner, .cookieConsent, .cookieNotice, .cookieBar, .cookieLaw,
#cookie-consent, #cookie-banner, #cookie-notice, #cookieBanner, #cookieNotice,
#CookieConsent, #cookie-law-info-bar, #cookie-accept-btn,
[id*="cookie-consent"], [id*="cookie-banner"], [id*="cookie-notice"],
[class*="cookie-consent"], [class*="cookie-banner"], [class*="cookie-notice"],
[class*="gdpr"], [id*="gdpr"], .gdpr-overlay, .gdpr-banner,
.cky-consent-container, .cky-modal,   /* CookieYes */
.cookieBot, #CybotCookiebotDialog,     /* Cookiebot */
.js-cookie-consent, .cookie-law-bar,
[aria-label*="cookie"], [aria-describedby*="cookie"],
.qc-cmp2-container, .qc-cmp2-ui,       /* Quantcast */
.sp-message-container,                  /* SourcePoint */
#usercentrics-root,                     /* Usercentrics */
.ot-sdk-container, #onetrust-banner-sdk, #onetrust-consent-sdk,  /* OneTrust */
.evidon-banner, #evidon-banner,         /* Evidon */
.truste_overlay, #truste-consent-track  /* TrustArc */
{ display:none!important; }

/* ── Botones sociales de rastreo ─────────────────────────────────── */
.fb-like-box, .fb-page, .fb-like,
.twitter-follow-button, .twitter-share-button,
.linkedin-plugin, .in-follow-btn,
[data-pin-do], .pinterest-social-widget
{ display:none!important; }

/* ── Contenedores genéricos de anuncios ──────────────────────────── */
[class*="banner-ad"]:not([class*="menu"]):not([class*="header"]):not([class*="nav"]),
[class*="ad-banner"]:not([class*="gradient"]):not([class*="brand"]),
[class*="ad-container"]:not([class*="header"]):not([class*="main"]),
[class*="ad-wrapper"], [class*="ad-holder"], [class*="ad-slot"],
[id*="banner-ad"], [id*="ad-banner"], [id*="ad-slot"],
[id*="leaderboard-ad"], [id*="sidebar-ad"], [id*="footer-ad"]
{ display:none!important; }

/* ── Pop-unders / interstitials ──────────────────────────────────── */
.interstitial-ad, .overlay-ad, .ad-overlay,
[class*="interstitial"]:not(body):not(main)
{ display:none!important; }

/* ── Sugerencias de notificaciones push ──────────────────────────── */
.push-notification-prompt, .push-consent,
[class*="push-notification"], [class*="push-permission"]
{ display:none!important; }
`.trim();

// ── Estadísticas de bloqueo por app ──────────────────────────────────────────

const blockedCounts = new Map(); // appId → number

function incrementBlocked(appId) {
  blockedCounts.set(appId, (blockedCounts.get(appId) || 0) + 1);
}

function getBlockedCount(appId) {
  return blockedCounts.get(appId) || 0;
}

function resetBlockedCount(appId) {
  blockedCounts.delete(appId);
}

// ── Session interceptor ───────────────────────────────────────────────────────

/**
 * Aplica (o quita) el bloqueador de peticiones a una sesión Chromium.
 * Llamar una vez por ventana SSB al crearla.
 */
function applyAdBlockToSession(session, appId, { enabled = true, customRules = [] } = {}) {
  if (!enabled) {
    // Quitar filtro existente
    try { session.webRequest.onBeforeRequest(null); } catch {}
    return;
  }

  session.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    // No bloquear peticiones del renderer de la app principal
    const url = details.url;
    if (url.startsWith('file://') || url.startsWith('http://localhost')) {
      callback({});
      return;
    }

    if (isBlocked(url, customRules)) {
      incrementBlocked(appId);
      callback({ cancel: true });
    } else {
      callback({});
    }
  });
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

function registerAdBlockHandlers(ipcMain, store) {
  loadBlockList();

  ipcMain.handle('adblock:get-config', () => {
    const { settings } = store.read();
    return {
      enabled:         settings.adblockEnabled         ?? true,
      cosmetic:        settings.adblockCosmetic         ?? true,
      httpsUpgrade:    settings.adblockHttpsUpgrade     ?? true,
      domainCount:     blockSet.size,
    };
  });

  ipcMain.handle('adblock:update-config', (_e, updates) => {
    const data = store.read();
    data.settings = {
      ...data.settings,
      ...(updates.enabled         !== undefined && { adblockEnabled:      updates.enabled }),
      ...(updates.cosmetic        !== undefined && { adblockCosmetic:     updates.cosmetic }),
      ...(updates.httpsUpgrade    !== undefined && { adblockHttpsUpgrade: updates.httpsUpgrade }),
    };
    store.write(data);
    return data.settings;
  });

  ipcMain.handle('adblock:get-app-config', (_e, appId) => {
    const { apps } = store.read();
    const app = apps.find(a => a.id === appId);
    return {
      enabled:     app?.adblockEnabled     ?? true,
      customRules: app?.adblockCustomRules ?? [],
      blocked:     getBlockedCount(appId),
    };
  });

  ipcMain.handle('adblock:update-app-config', (_e, appId, updates) => {
    const data  = store.read();
    const index = data.apps.findIndex(a => a.id === appId);
    if (index === -1) return { success: false };
    if (updates.enabled     !== undefined) data.apps[index].adblockEnabled     = updates.enabled;
    if (updates.customRules !== undefined) data.apps[index].adblockCustomRules = updates.customRules;
    store.write(data);
    return { success: true };
  });

  ipcMain.handle('adblock:get-blocked-count', (_e, appId) => getBlockedCount(appId));

  ipcMain.handle('adblock:reset-count', (_e, appId) => { resetBlockedCount(appId); return true; });
}

module.exports = {
  registerAdBlockHandlers,
  applyAdBlockToSession,
  loadBlockList,
  COSMETIC_CSS,
  getBlockedCount,
};

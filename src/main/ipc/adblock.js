'use strict';
const path = require('path');
const fs   = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { app: electronApp } = require('electron');

// ── Blocklist ─────────────────────────────────────────────────────────────────

let blockSet = new Set();
let abpState = {
  networkRules: [],
  exceptionRules: [],
  globalCosmetic: [],
  domainCosmetic: new Map(),
  cosmeticExceptions: new Map(),
  subscriptions: [],
  loadedAt: null,
};

const DEFAULT_SUBSCRIPTIONS = [
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
];

const ABP_LIMITS = {
  networkRulesPerList: 18000,
  cosmeticRulesPerList: 4500,
  injectedGlobalCosmetic: 1200,
  injectedDomainCosmetic: 1000,
};

const EXTRA_BLOCKED_DOMAINS = [
  'doubleclick.net','googleadservices.com','googlesyndication.com','adservice.google.com',
  'pagead2.googlesyndication.com','securepubads.g.doubleclick.net','tpc.googlesyndication.com',
  'google-analytics.com','googletagmanager.com','googletagservices.com','analytics.google.com',
  'facebook.net','connect.facebook.net','ads-twitter.com','analytics.twitter.com',
  'scorecardresearch.com','quantserve.com','quantcount.com','taboola.com','outbrain.com',
  'criteo.com','criteo.net','rubiconproject.com','pubmatic.com','openx.net','openx.com',
  'adnxs.com','adsafeprotected.com','moatads.com','serving-sys.com','3lift.com',
  'rlcdn.com','bluekai.com','casalemedia.com','contextweb.com','lijit.com','yieldmo.com',
  'media.net','mgid.com','revcontent.com','sharethrough.com','smartadserver.com',
  'adsrvr.org','the-ozone-project.com','amazon-adsystem.com','aaxads.com',
  'adform.net','adformdsp.net','bidswitch.net','yieldlab.net','chartbeat.com',
  'hotjar.com','hotjar.io','fullstory.com','mouseflow.com','clarity.ms','segment.io',
  'mixpanel.com','amplitude.com','optimizely.com','braze.com','onesignal.com',
  'pushengage.com','wonderpush.com','intercom.io','drift.com','profitwell.com',
];

const AGGRESSIVE_URL_PATTERNS = [
  /(^|[./_-])ad(s|server|service|system|track|tag|slot|unit)?([./_-]|$)/i,
  /(^|[./_-])(prebid|bidder|rtb|header-bid|programmatic)([./_-]|$)/i,
  /(^|[./_-])(analytics|telemetry|tracking|tracker|pixel|beacon)([./_-]|$)/i,
  /(^|[./_-])(sponsor|promoted|native-ad|outstream)([./_-]|$)/i,
  /\/(ads?|advert|banners?|popunder|interstitial|vast|vpaid)\//i,
  /[?&](utm_|fbclid|gclid|msclkid|mc_cid|yclid|igshid|twclid)/i,
];

const TRACKING_PARAMS = [
  'fbclid','gclid','dclid','msclkid','yclid','igshid','twclid','mc_cid','mc_eid',
  'utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id',
];

function loadBlockList() {
  try {
    const file = path.join(__dirname, '../blocklists/domains.json');
    const list = JSON.parse(fs.readFileSync(file, 'utf-8'));
    blockSet = new Set([...list, ...EXTRA_BLOCKED_DOMAINS]);
    console.log(`[AdBlock] Loaded ${blockSet.size} domains`);
  } catch (err) {
    console.error('[AdBlock] Failed to load blocklist:', err.message);
  }
}

/** Comprueba si una URL debe bloquearse. */
function isBlocked(urlStr, customRules = [], { aggressive = false, resourceType = '', referrer = '' } = {}) {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (matchesAnyAbpRule(urlStr, abpState.exceptionRules, { resourceType, referrer })) return false;
    if (matchesAnyAbpRule(urlStr, abpState.networkRules, { resourceType, referrer })) return true;
    // Check exact + parent domains
    if (blockSet.has(hostname)) return true;
    const parts = hostname.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      if (blockSet.has(parts.slice(i).join('.'))) return true;
    }
    // Custom user rules (domain substring match)
    for (const rule of customRules) {
      const r = rule.trim().toLowerCase();
      if (r && (hostname.includes(r) || parsed.href.toLowerCase().includes(r))) return true;
    }
    if (aggressive) {
      const type = String(resourceType || '').toLowerCase();
      const thirdParty = isThirdParty(urlStr, referrer);
      const blockableType = !type || ['script','image','xhr','fetch','subframe','object','media','stylesheet','ping'].includes(type);
      if (thirdParty && blockableType && AGGRESSIVE_URL_PATTERNS.some(pattern => pattern.test(parsed.href))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function getDefaultSubscriptions() {
  return DEFAULT_SUBSCRIPTIONS.map(item => ({ ...item }));
}

function normalizeSubscriptions(settings = {}) {
  const saved = Array.isArray(settings.adblockSubscriptions) ? settings.adblockSubscriptions : [];
  const savedByUrl = new Map(saved.map(item => [String(item.url || ''), item]));
  const merged = DEFAULT_SUBSCRIPTIONS.map(item => ({
    ...item,
    ...(savedByUrl.get(item.url) || {}),
  }));
  for (const item of saved) {
    if (item?.url && !merged.some(existing => existing.url === item.url)) {
      merged.push({
        id: item.id || hashText(item.url),
        name: item.name || item.url,
        url: item.url,
        enabled: item.enabled !== false,
        lastUpdated: item.lastUpdated,
        ruleCount: item.ruleCount || 0,
        cosmeticCount: item.cosmeticCount || 0,
        error: item.error,
      });
    }
  }
  return merged.map(item => ({
    id: item.id || hashText(item.url),
    name: item.name || item.url,
    url: item.url,
    enabled: item.enabled !== false,
    lastUpdated: item.lastUpdated || null,
    ruleCount: item.ruleCount || 0,
    cosmeticCount: item.cosmeticCount || 0,
    error: item.error || null,
  }));
}

function hashText(text) {
  return crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, 12);
}

function getAdBlockDir() {
  const base = electronApp?.isReady?.()
    ? electronApp.getPath('userData')
    : path.join(process.cwd(), '.appspawner-adblock');
  return path.join(base, 'adblock');
}

function ensureAdBlockDir() {
  const dir = getAdBlockDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getSubscriptionCachePath(subscription) {
  return path.join(ensureAdBlockDir(), `${subscription.id || hashText(subscription.url)}.txt`);
}

function loadCachedSubscriptions(settings = {}) {
  const subscriptions = normalizeSubscriptions(settings);
  const nextState = createEmptyAbpState(subscriptions);
  for (const subscription of subscriptions.filter(item => item.enabled && item.url)) {
    try {
      const file = getSubscriptionCachePath(subscription);
      if (!fs.existsSync(file)) continue;
      const parsed = parseAbpList(fs.readFileSync(file, 'utf-8'), subscription);
      mergeAbpState(nextState, parsed);
      subscription.ruleCount = parsed.networkRules.length + parsed.exceptionRules.length;
      subscription.cosmeticCount = parsed.globalCosmetic.length + countMapItems(parsed.domainCosmetic);
      subscription.error = null;
    } catch (err) {
      subscription.error = err.message;
    }
  }
  abpState = nextState;
  abpState.loadedAt = Date.now();
  return getAdBlockStats();
}

async function updateSubscriptions(store, overrides = {}) {
  const data = store.read();
  const subscriptions = normalizeSubscriptions({
    ...data.settings,
    ...(Array.isArray(overrides.subscriptions) && { adblockSubscriptions: overrides.subscriptions }),
  });
  const nextState = createEmptyAbpState(subscriptions);

  for (const subscription of subscriptions.filter(item => item.enabled && item.url)) {
    try {
      const text = await fetchTextUrl(subscription.url);
      fs.writeFileSync(getSubscriptionCachePath(subscription), text, 'utf-8');
      const parsed = parseAbpList(text, subscription);
      mergeAbpState(nextState, parsed);
      subscription.lastUpdated = new Date().toISOString();
      subscription.ruleCount = parsed.networkRules.length + parsed.exceptionRules.length;
      subscription.cosmeticCount = parsed.globalCosmetic.length + countMapItems(parsed.domainCosmetic);
      subscription.error = null;
    } catch (err) {
      subscription.error = err.message;
      try {
        const cache = getSubscriptionCachePath(subscription);
        if (fs.existsSync(cache)) {
          const parsed = parseAbpList(fs.readFileSync(cache, 'utf-8'), subscription);
          mergeAbpState(nextState, parsed);
          subscription.ruleCount = parsed.networkRules.length + parsed.exceptionRules.length;
          subscription.cosmeticCount = parsed.globalCosmetic.length + countMapItems(parsed.domainCosmetic);
        }
      } catch {}
    }
  }

  data.settings = { ...data.settings, adblockSubscriptions: subscriptions };
  store.write(data);
  abpState = nextState;
  abpState.loadedAt = Date.now();
  return { subscriptions, stats: getAdBlockStats() };
}

function createEmptyAbpState(subscriptions) {
  return {
    networkRules: [],
    exceptionRules: [],
    globalCosmetic: [],
    domainCosmetic: new Map(),
    cosmeticExceptions: new Map(),
    subscriptions,
    loadedAt: null,
  };
}

function mergeAbpState(target, parsed) {
  target.networkRules.push(...parsed.networkRules);
  target.exceptionRules.push(...parsed.exceptionRules);
  target.globalCosmetic.push(...parsed.globalCosmetic);
  mergeSelectorMap(target.domainCosmetic, parsed.domainCosmetic);
  mergeSelectorMap(target.cosmeticExceptions, parsed.cosmeticExceptions);
}

function mergeSelectorMap(target, source) {
  for (const [domain, selectors] of source.entries()) {
    const current = target.get(domain) || [];
    target.set(domain, [...current, ...selectors]);
  }
}

function countMapItems(map) {
  let count = 0;
  for (const items of map.values()) count += items.length;
  return count;
}

function fetchTextUrl(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'http:' ? http : https;
    const req = client.get(parsed, {
      headers: {
        'user-agent': 'AppSpawner AdBlock/2.7',
        accept: 'text/plain,*/*;q=0.8',
      },
      timeout: 20000,
    }, (res) => {
      const location = res.headers.location;
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && location && redirects < 5) {
        res.resume();
        resolve(fetchTextUrl(new URL(location, parsed).href, redirects + 1));
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        body += chunk;
        if (body.length > 12_000_000) req.destroy(new Error('Lista demasiado grande'));
      });
      res.on('end', () => resolve(body));
    });
    req.on('timeout', () => req.destroy(new Error('Tiempo agotado')));
    req.on('error', reject);
  });
}

function parseAbpList(text, source) {
  const parsed = {
    networkRules: [],
    exceptionRules: [],
    globalCosmetic: [],
    domainCosmetic: new Map(),
    cosmeticExceptions: new Map(),
  };
  let networkCount = 0;
  let cosmeticCount = 0;

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('!') || line.startsWith('[')) continue;

    const cosmetic = parseCosmeticRule(line);
    if (cosmetic) {
      if (cosmeticCount >= ABP_LIMITS.cosmeticRulesPerList) continue;
      addCosmeticRule(parsed, cosmetic);
      cosmeticCount += 1;
      continue;
    }

    if (networkCount >= ABP_LIMITS.networkRulesPerList) continue;
    const isException = line.startsWith('@@');
    const rule = compileNetworkRule(isException ? line.slice(2) : line, source);
    if (!rule) continue;
    if (isException) parsed.exceptionRules.push(rule);
    else parsed.networkRules.push(rule);
    networkCount += 1;
  }

  return parsed;
}

function parseCosmeticRule(line) {
  const separator = line.includes('#@#') ? '#@#' : (line.includes('##') ? '##' : null);
  if (!separator) return null;
  const [domainsRaw, selectorRaw] = line.split(separator);
  const selector = selectorRaw?.trim();
  if (!isSafeCssSelector(selector)) return null;
  const domains = String(domainsRaw || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(item => item && !item.startsWith('~') && /^[a-z0-9.*-]+(\.[a-z0-9.*-]+)*$/.test(item))
    .map(item => item.replace(/^\*\./, ''));
  return { exception: separator === '#@#', domains, selector };
}

function isSafeCssSelector(selector) {
  if (!selector || selector.length > 700) return false;
  if (/[{};@]/.test(selector)) return false;
  if (/:-abp-|:contains\(|:matches-css\(|:xpath\(/i.test(selector)) return false;
  return true;
}

function addCosmeticRule(parsed, rule) {
  if (!rule.domains.length && !rule.exception) {
    parsed.globalCosmetic.push(rule.selector);
    return;
  }
  const target = rule.exception ? parsed.cosmeticExceptions : parsed.domainCosmetic;
  for (const domain of rule.domains) {
    const selectors = target.get(domain) || [];
    selectors.push(rule.selector);
    target.set(domain, selectors);
  }
}

function compileNetworkRule(ruleText, source) {
  let raw = String(ruleText || '').trim();
  if (!raw || raw.startsWith('#') || raw.includes('##') || raw.includes('#@#')) return null;
  const [patternRaw, optionsRaw = ''] = raw.split('$');
  raw = patternRaw.trim();
  if (!raw || raw === '*' || raw.startsWith('##')) return null;

  const options = parseRuleOptions(optionsRaw);
  if (options.unsupported) return null;
  if (raw.startsWith('/') && raw.endsWith('/') && raw.length > 2) return null;

  if (raw.startsWith('||')) {
    const body = raw.slice(2).replace(/^\*+/, '');
    const match = body.match(/^([a-z0-9.-]+)(.*)$/i);
    if (!match) return null;
    return {
      kind: 'domain',
      domain: match[1].replace(/\^.*$/, '').toLowerCase(),
      pathToken: normalizeUrlToken(match[2]),
      options,
      source: source?.id,
      raw,
    };
  }

  const token = normalizeUrlToken(raw);
  if (!token || token.length < 3) return null;
  return { kind: 'url', token, options, source: source?.id, raw };
}

function parseRuleOptions(optionsRaw) {
  const options = { types: null, thirdParty: null, domains: null, unsupported: false };
  if (!optionsRaw) return options;
  const typeMap = {
    script: 'script',
    image: 'image',
    stylesheet: 'stylesheet',
    object: 'object',
    xmlhttprequest: 'xhr',
    subdocument: 'subframe',
    media: 'media',
    font: 'font',
    ping: 'ping',
  };
  const types = new Set();
  for (const raw of optionsRaw.split(',')) {
    const item = raw.trim().toLowerCase();
    if (!item) continue;
    if (item === 'third-party') options.thirdParty = true;
    else if (item === '~third-party') options.thirdParty = false;
    else if (item.startsWith('domain=')) options.domains = item.slice(7).split('|').filter(Boolean);
    else if (typeMap[item]) types.add(typeMap[item]);
    else if (item === 'document' || item === 'elemhide' || item === 'generichide') options.unsupported = true;
  }
  options.types = types.size ? types : null;
  return options;
}

function normalizeUrlToken(value) {
  return String(value || '')
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .replace(/\^/g, '/')
    .replace(/\*/g, '')
    .trim()
    .toLowerCase();
}

function matchesAnyAbpRule(urlStr, rules, details) {
  for (const rule of rules) {
    if (matchesAbpRule(urlStr, rule, details)) return true;
  }
  return false;
}

function matchesAbpRule(urlStr, rule, { resourceType = '', referrer = '' } = {}) {
  try {
    const parsed = new URL(urlStr);
    const href = parsed.href.toLowerCase();
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!matchesRuleOptions(rule.options, urlStr, { resourceType, referrer })) return false;
    if (rule.kind === 'domain') {
      const domain = rule.domain.replace(/^www\./, '');
      const domainMatch = hostname === domain || hostname.endsWith(`.${domain}`);
      if (!domainMatch) return false;
      return !rule.pathToken || href.includes(rule.pathToken);
    }
    return href.includes(rule.token);
  } catch {
    return false;
  }
}

function matchesRuleOptions(options = {}, urlStr, { resourceType = '', referrer = '' } = {}) {
  if (options.types?.size && !options.types.has(String(resourceType || '').toLowerCase())) return false;
  if (options.thirdParty !== null && isThirdParty(urlStr, referrer) !== options.thirdParty) return false;
  if (options.domains?.length && referrer) {
    const origin = rootDomain(new URL(referrer).hostname);
    const positive = options.domains.filter(item => !item.startsWith('~'));
    const negative = options.domains.filter(item => item.startsWith('~')).map(item => item.slice(1));
    if (negative.some(domain => origin === domain || origin.endsWith(`.${domain}`))) return false;
    if (positive.length && !positive.some(domain => origin === domain || origin.endsWith(`.${domain}`))) return false;
  }
  return true;
}

function isThirdParty(urlStr, referrer) {
  try {
    if (!referrer) return true;
    const target = rootDomain(new URL(urlStr).hostname);
    const origin = rootDomain(new URL(referrer).hostname);
    return target !== origin;
  } catch {
    return true;
  }
}

function rootDomain(hostname) {
  return String(hostname || '').toLowerCase().replace(/^www\./, '').split('.').slice(-2).join('.');
}

function cleanTrackingUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    let changed = false;
    for (const param of TRACKING_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.delete(param);
        changed = true;
      }
    }
    for (const param of [...parsed.searchParams.keys()]) {
      if (param.startsWith('utm_')) {
        parsed.searchParams.delete(param);
        changed = true;
      }
    }
    return changed ? parsed.href : null;
  } catch {
    return null;
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

/* Video / sticky / sponsored ads */
[id*="sponsor"], [class*="sponsor"],
[id*="promoted"], [class*="promoted"],
[class*="native-ad"], [id*="native-ad"],
[class*="video-ad"], [id*="video-ad"],
[class*="preroll"], [id*="preroll"],
iframe[src*="doubleclick"], iframe[src*="googlesyndication"], iframe[src*="adnxs"],
iframe[src*="taboola"], iframe[src*="outbrain"], iframe[src*="criteo"],
[class*="sticky-ad"], [id*="sticky-ad"]
{ display:none!important; }
`.trim();

function getCosmeticCssForUrl(pageUrl = '') {
  const selectors = new Set();
  for (const selector of abpState.globalCosmetic.slice(0, ABP_LIMITS.injectedGlobalCosmetic)) {
    selectors.add(selector);
  }

  let hostname = '';
  try {
    hostname = new URL(pageUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {}

  if (hostname) {
    const exceptions = getDomainSelectors(abpState.cosmeticExceptions, hostname);
    for (const selector of getDomainSelectors(abpState.domainCosmetic, hostname).slice(0, ABP_LIMITS.injectedDomainCosmetic)) {
      if (!exceptions.has(selector)) selectors.add(selector);
    }
  }

  if (!selectors.size) return COSMETIC_CSS;
  const dynamicCss = chunkSelectors([...selectors], 80)
    .map(chunk => `${chunk.join(',\n')} { display:none!important; visibility:hidden!important; }`)
    .join('\n');
  return `${COSMETIC_CSS}\n\n/* AppSpawner AdBlock - ABP cosmetic filters */\n${dynamicCss}`;
}

function getDomainSelectors(map, hostname) {
  const selectors = new Set();
  const parts = String(hostname || '').split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const domain = parts.slice(i).join('.');
    for (const selector of map.get(domain) || []) selectors.add(selector);
  }
  return selectors;
}

function chunkSelectors(selectors, size) {
  const chunks = [];
  for (let i = 0; i < selectors.length; i += size) chunks.push(selectors.slice(i, i + size));
  return chunks;
}

function getAdBlockStats() {
  return {
    domainCount: blockSet.size,
    networkFilterCount: abpState.networkRules.length + abpState.exceptionRules.length,
    cosmeticFilterCount: abpState.globalCosmetic.length + countMapItems(abpState.domainCosmetic),
    subscriptionCount: abpState.subscriptions.filter(item => item.enabled).length,
    loadedAt: abpState.loadedAt,
  };
}

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
function applyAdBlockToSession(session, appId, { enabled = true, customRules = [], aggressive = true, annoyances = true } = {}) {
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

    const cleaned = cleanTrackingUrl(url);
    if (cleaned && details.resourceType === 'mainFrame') {
      callback({ redirectURL: cleaned });
      return;
    }

    if (isBlocked(url, customRules, {
      aggressive,
      resourceType: details.resourceType,
      referrer: details.referrer,
    })) {
      incrementBlocked(appId);
      callback({ cancel: true });
    } else {
      callback({});
    }
  });

  session.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (annoyances && ['notifications', 'midiSysex', 'pointerLock'].includes(permission)) {
      callback(false);
      return;
    }
    callback(true);
  });
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

function registerAdBlockHandlers(ipcMain, store) {
  loadBlockList();
  loadCachedSubscriptions(store.read().settings);

  ipcMain.handle('adblock:get-config', () => {
    const { settings } = store.read();
    const stats = getAdBlockStats();
    return {
      enabled:         settings.adblockEnabled         ?? true,
      cosmetic:        settings.adblockCosmetic         ?? true,
      httpsUpgrade:    settings.adblockHttpsUpgrade     ?? true,
      aggressive:      settings.adblockAggressive       ?? true,
      annoyances:      settings.adblockAnnoyances       ?? true,
      ...stats,
    };
  });

  ipcMain.handle('adblock:update-config', (_e, updates) => {
    const data = store.read();
    data.settings = {
      ...data.settings,
      ...(updates.enabled         !== undefined && { adblockEnabled:      updates.enabled }),
      ...(updates.cosmetic        !== undefined && { adblockCosmetic:     updates.cosmetic }),
      ...(updates.httpsUpgrade    !== undefined && { adblockHttpsUpgrade: updates.httpsUpgrade }),
      ...(updates.aggressive      !== undefined && { adblockAggressive:   updates.aggressive }),
      ...(updates.annoyances      !== undefined && { adblockAnnoyances:   updates.annoyances }),
    };
    store.write(data);
    return data.settings;
  });

  ipcMain.handle('adblock:get-subscriptions', () => {
    const { settings } = store.read();
    return { subscriptions: normalizeSubscriptions(settings), stats: getAdBlockStats() };
  });

  ipcMain.handle('adblock:update-subscriptions', async (_e, subscriptions) => {
    return updateSubscriptions(store, Array.isArray(subscriptions) ? { subscriptions } : {});
  });

  ipcMain.handle('adblock:set-subscriptions', (_e, subscriptions) => {
    if (!Array.isArray(subscriptions)) return { success: false };
    const data = store.read();
    data.settings = {
      ...data.settings,
      adblockSubscriptions: normalizeSubscriptions({ adblockSubscriptions: subscriptions }),
    };
    store.write(data);
    loadCachedSubscriptions(data.settings);
    return { success: true, subscriptions: data.settings.adblockSubscriptions, stats: getAdBlockStats() };
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
  getCosmeticCssForUrl,
  getDefaultSubscriptions,
  getAdBlockStats,
  getBlockedCount,
};

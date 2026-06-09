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
  // Core — enabled by default
  { id: 'easylist',            name: 'EasyList',              url: 'https://easylist.to/easylist/easylist.txt',              enabled: true  },
  { id: 'easyprivacy',         name: 'EasyPrivacy',           url: 'https://easylist.to/easylist/easyprivacy.txt',           enabled: true  },
  { id: 'easylist-annoyances', name: 'EasyList Annoyances',   url: 'https://easylist.to/easylist/fanboy-annoyance.txt',      enabled: true  },
  { id: 'ubo-filters',         name: 'uBlock Filters',        url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',  enabled: true  },
  { id: 'ubo-privacy',         name: 'uBlock Privacy',        url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt',  enabled: true  },
  { id: 'ubo-annoyances',      name: 'uBlock Annoyances',     url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances.txt', enabled: true },
  { id: 'peter-lowe',          name: 'Peter Lowe Ad Servers', url: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=1&mimetype=plaintext', enabled: true },
  // Extended — opt-in
  { id: 'idontcare-cookies',   name: 'I don\'t care about cookies', url: 'https://www.i-dont-care-about-cookies.eu/abp/',   enabled: false, group: 'extended' },
  { id: 'adguard-base',        name: 'AdGuard Base Filters',  url: 'https://filters.adtidy.org/extension/chromium/filters/2.txt', enabled: false, group: 'extended' },
  { id: 'adguard-tracking',    name: 'AdGuard Tracking',      url: 'https://filters.adtidy.org/extension/chromium/filters/3.txt', enabled: false, group: 'extended' },
  // Regional — opt-in
  { id: 'easylist-spain',      name: 'EasyList Espana',       url: 'https://easylist-downloads.adblockplus.org/easylistspanish.txt',   enabled: false, group: 'regional' },
  { id: 'easylist-france',     name: 'EasyList France',       url: 'https://easylist-downloads.adblockplus.org/liste_fr.txt',           enabled: false, group: 'regional' },
  { id: 'easylist-germany',    name: 'EasyList Germany',      url: 'https://easylist-downloads.adblockplus.org/easylistgermany.txt',    enabled: false, group: 'regional' },
  { id: 'easylist-portuguese', name: 'EasyList Portuguese',   url: 'https://easylist-downloads.adblockplus.org/easylistportuguese.txt', enabled: false, group: 'regional' },
];

const ABP_LIMITS = {
  networkRulesPerList: 18000,
  cosmeticRulesPerList: 4500,
  injectedGlobalCosmetic: 1200,
  injectedDomainCosmetic: 1000,
};

// CDN/reproductores de media — nunca bloqueados aunque el modo agresivo esté activo
const PLAYER_WHITELIST = new Set([
  'cdn.jwplayer.com', 'content.jwplatform.com', 'assets-jpcust.jwpsrv.com', 'jwpsrv.com',
  'vjs.zencdn.net',
  'player.vimeo.com', 'f.vimeocdn.com', 'fresnel.vimeocdn.com', 'i.vimeocdn.com',
  'players.brightcove.net', 'sadmin.brightcove.com', 'secure.brightcove.com',
  'imasdk.googleapis.com',
  'html5.dailymotion.com', 'static1.dmcdn.net',
  'embed.twitch.tv', 'player.twitch.tv', 'static.twitchsvc.net',
  's.ytimg.com', 'i.ytimg.com',
  'cdn.plyr.io',
  'cdn.flowplayer.com',
]);

const EXTRA_BLOCKED_DOMAINS = [
  // Google ads / analytics
  'doubleclick.net','googleadservices.com','googlesyndication.com','adservice.google.com',
  'pagead2.googlesyndication.com','securepubads.g.doubleclick.net','tpc.googlesyndication.com',
  'google-analytics.com','googletagmanager.com','googletagservices.com','analytics.google.com',
  // Social trackers
  'facebook.net','connect.facebook.net','ads-twitter.com','analytics.twitter.com',
  // Nielsen / Comscore / programmatic
  'scorecardresearch.com','quantserve.com','quantcount.com',
  // Content recommendation networks
  'taboola.com','outbrain.com','revcontent.com','mgid.com','adblade.com','content.ad',
  'zergnet.com','gravity.com','disqus.com','ligatus.com','triplelift.com',
  'nativo.com','sharethrough.com','zemanta.com','plista.com',
  // Programmatic DSP/SSP
  'criteo.com','criteo.net','rubiconproject.com','pubmatic.com','openx.net','openx.com',
  'adnxs.com','adsafeprotected.com','moatads.com','serving-sys.com','3lift.com',
  'rlcdn.com','bluekai.com','casalemedia.com','contextweb.com','lijit.com','yieldmo.com',
  'media.net','smartadserver.com','adsrvr.org','the-ozone-project.com',
  'amazon-adsystem.com','aaxads.com','adform.net','adformdsp.net','bidswitch.net',
  'yieldlab.net','indexexchange.com','sovrn.com','appnexus.com','smaato.com',
  'conversantmedia.com','rfihub.com','acuityads.com','rtbhouse.com','seedtag.com',
  'teads.tv','primis.tech','vi.ai','gumgum.com','spotxchange.com','33across.com',
  // Analytics / Session recording / Heatmaps
  'chartbeat.com','hotjar.com','hotjar.io','fullstory.com','mouseflow.com',
  'clarity.ms','segment.io','mixpanel.com','amplitude.com','optimizely.com',
  // CRM / engagement
  'braze.com','intercom.io','drift.com','profitwell.com',
  // Push notification networks (high priority — these create the corner notification ads)
  'onesignal.com','pushengage.com','wonderpush.com','pushcrew.com','webpushr.com',
  'pushwoosh.com','izooto.com','pushassist.com','pushify.net','aimtell.com',
  'pushowl.com','pushmonkey.io','web-push.io','gravitypush.com','cleverpush.com',
  'notix.io','browserpush.com','sendpulse.com','subscribers.com','gravitec.net',
  // Popup / redirect ad networks (these redirect users to browser on video play)
  'propellerads.com','propellerads.net','propeller-ads.net',
  'popads.net','popcash.net','popunder.com','popunderjs.com',
  'adsterra.com','trafficjunky.com','trafficforce.com','traffic-media.co',
  'traffichaus.com','trafficstars.com','trafficshop.com',
  'adcash.com','adprofin.com','bidvertiser.com','bidvertiser.net',
  'exitads.net','zeropark.com','zeropark.net','clickadu.com',
  'exoclick.com','exoclick.net','hilltopads.net','hilltopads.com',
  'yllix.com','plugrush.com','adnow.com','clickaine.com','aceabc.net',
  'revenuehits.com','oaads.com','natexo.com','adxpansion.com',
  'juicyads.com','ero-advertising.com','trafficfactory.biz',
  'popin.cc','popads.io','popu.io','ad2net.com','adlook.com',
  'clkmon.com','clkrev.com','adclickstats.net','adserverpub.com',
  'ads.com','adskeeper.co.uk','realclick.co.uk','rich-ads.com',
  // "Social proof" / fake-notification widget vendors (las cajitas "Juan acaba de
  // comprar..." o que imitan avisos de Snapchat/Telegram con contador de mensajes)
  'useproof.com','provesrc.com','nudgify.com','fomo.com','letsclap.io',
  'notifyvisitors.com','popupsmart.com','wisernotify.com','trustpulse.com',
  'salesnotify.io','socialproofy.io','proofy.io','boostsalesai.com',
  'convertfu.com','beeketing.com','fomoapp.com','provesource.com',
  // Fingerprinting / supercookies
  'fingerprintjs.com','fingerprint.com','fraudscore.com',
  // Ad verification
  'doubleverify.com','iqdigital.de','integral-marketing.com',
];

const AGGRESSIVE_URL_PATTERNS = [
  /(^|[./_-])ad(s|server|service|system|track|tag|slot|unit)?([./_-]|$)/i,
  /(^|[./_-])(prebid|bidder|rtb|header-bid|programmatic)([./_-]|$)/i,
  /(^|[./_-])(analytics|telemetry|tracking|tracker|pixel|beacon)([./_-]|$)/i,
  /(^|[./_-])(sponsor|promoted|native-ad|outstream)([./_-]|$)/i,
  /\/(ads?|advert|banners?|popunder|interstitial|vast|vpaid)\//i,
  /[?&](utm_|fbclid|gclid|msclkid|mc_cid|yclid|igshid|twclid)/i,
  // Popup/redirect specific
  /\/(popup|popunder|pop-under|clickthrough|redirect|redir|goto|out\.php|track\.php)\//i,
  /(^|[./_-])(impression|viewability|viewable|vimpression)([./_-]|$)/i,
  /\/click\?|\/clk\?|\/go\?.*url=|\/redirect\?.*url=/i,
  // "Social bar" / fake-notification widget loaders (imitan avisos de Snapchat/Telegram)
  /(^|[./_-])(social-?bar|sbar|fake-?notif|social-?proof|push-?notif)([./_-]|$)/i,
];

// Patrones de URL que identifican navegaciones iniciadas por anuncios (no por el usuario)
// Usadas en will-navigate para bloquear silenciosamente en lugar de abrir el navegador externo
const AD_NAVIGATION_PATTERNS = [
  /popunder/i, /popup/i, /pop-under/i,
  /clickthrough/i, /click\.track/i,
  /\/redir(ect)?\?/i,
  /[?&]dest(ination)?=/i,
  /[?&]target_url=/i,
  /[?&]exit(_?url)?=/i,
  /[?&]goto=/i,
  /adclick/i, /adredirect/i,
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
    // Populate from EXTRA_BLOCKED_DOMAINS even if file read fails
    blockSet = new Set(EXTRA_BLOCKED_DOMAINS);
  }
}

/**
 * Comprueba si una URL pertenece a un dominio bloqueado.
 * Usada en will-navigate para bloquear silenciosamente redirecciones de anuncios.
 */
function isBlockedDomain(urlStr) {
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
    if (blockSet.has(hostname)) return true;
    const parts = hostname.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      if (blockSet.has(parts.slice(i).join('.'))) return true;
    }
    // Comprueba también ABP network rules para navigations
    if (matchesAnyAbpRule(urlStr, abpState.networkRules, {})) return true;
    return AD_NAVIGATION_PATTERNS.some(p => p.test(urlStr));
  } catch { return false; }
}

// ── Block log (ring buffer por app) ──────────────────────────────────────────

const blockLog = new Map(); // appId → entry[]
const BLOCK_LOG_MAX = 500;

function logBlock(appId, url, resourceType, rule) {
  if (!blockLog.has(appId)) blockLog.set(appId, []);
  const log = blockLog.get(appId);
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch {}
  log.push({ url, hostname, resourceType: resourceType || 'other', rule, ts: Date.now() });
  if (log.length > BLOCK_LOG_MAX) log.splice(0, log.length - BLOCK_LOG_MAX);
}

function getBlockLog(appId) {
  return (blockLog.get(appId) || []).slice().reverse();
}

function clearBlockLog(appId) {
  blockLog.set(appId, []);
}

// ── Player whitelist ──────────────────────────────────────────────────────────

function isPlayerWhitelisted(hostname) {
  if (PLAYER_WHITELIST.has(hostname)) return true;
  for (const wlDomain of PLAYER_WHITELIST) {
    if (hostname.endsWith(`.${wlDomain}`)) return true;
  }
  return false;
}

// ── Request blocking ──────────────────────────────────────────────────────────

/**
 * Returns the blocking reason string if the URL should be blocked, null if allowed.
 */
function isBlocked(urlStr, customRules = [], { aggressive = false, resourceType = '', referrer = '' } = {}) {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (isPlayerWhitelisted(hostname)) return null;
    if (matchesAnyAbpRule(urlStr, abpState.exceptionRules, { resourceType, referrer })) return null;

    const netRule = findMatchingAbpRule(urlStr, abpState.networkRules, { resourceType, referrer });
    if (netRule) return `ABP: ${netRule.raw || netRule.domain || netRule.token || 'rule'}`;

    if (blockSet.has(hostname)) return `Dominio: ${hostname}`;
    const parts = hostname.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join('.');
      if (blockSet.has(parent)) return `Dominio: ${parent}`;
    }

    for (const rule of customRules) {
      const r = rule.trim().toLowerCase();
      if (!r || r.includes('##')) continue;
      if (hostname.includes(r) || parsed.href.toLowerCase().includes(r)) return `Regla: ${rule}`;
    }

    if (aggressive) {
      const type = String(resourceType || '').toLowerCase();
      const thirdParty = isThirdParty(urlStr, referrer);
      const blockableType = !type || ['script','image','xhr','fetch','subframe','object','media','stylesheet','ping'].includes(type);
      if (thirdParty && blockableType && AGGRESSIVE_URL_PATTERNS.some(p => p.test(parsed.href))) {
        return 'Modo agresivo';
      }
    }
    return null;
  } catch {
    return null;
  }
}

function findMatchingAbpRule(urlStr, rules, details) {
  for (const rule of rules) {
    if (matchesAbpRule(urlStr, rule, details)) return rule;
  }
  return null;
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
        group: item.group || 'custom',
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
    group: item.group || 'core',
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

  data.settings = { ...data.settings, adblockSubscriptions: subscriptions, adblockLastAutoUpdate: new Date().toISOString() };
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
      headers: { 'user-agent': 'AppSpawner AdBlock/3.0', accept: 'text/plain,*/*;q=0.8' },
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
    script: 'script', image: 'image', stylesheet: 'stylesheet', object: 'object',
    xmlhttprequest: 'xhr', subdocument: 'subframe', media: 'media', font: 'font', ping: 'ping',
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
    .replace(/^\|/, '').replace(/\|$/, '')
    .replace(/\^/g, '/').replace(/\*/g, '')
    .trim().toLowerCase();
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
    try {
      const origin = rootDomain(new URL(referrer).hostname);
      const positive = options.domains.filter(item => !item.startsWith('~'));
      const negative = options.domains.filter(item => item.startsWith('~')).map(item => item.slice(1));
      if (negative.some(domain => origin === domain || origin.endsWith(`.${domain}`))) return false;
      if (positive.length && !positive.some(domain => origin === domain || origin.endsWith(`.${domain}`))) return false;
    } catch {}
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
      if (parsed.searchParams.has(param)) { parsed.searchParams.delete(param); changed = true; }
    }
    for (const param of [...parsed.searchParams.keys()]) {
      if (param.startsWith('utm_')) { parsed.searchParams.delete(param); changed = true; }
    }
    return changed ? parsed.href : null;
  } catch {
    return null;
  }
}

// ── CSS cosmetico por categorias ──────────────────────────────────────────────

const COSMETIC_ADS = `
/* Anuncios de Google */
ins.adsbygoogle, .adsbygoogle,
[id^="div-gpt-ad"], [id^="google_ads_"],
[id^="dfp-ad"], [class^="dfp-ad"] { display:none!important; }

/* Contenedores genericos de anuncios */
[class*="banner-ad"]:not([class*="menu"]):not([class*="header"]):not([class*="nav"]),
[class*="ad-banner"]:not([class*="gradient"]):not([class*="brand"]),
[class*="ad-container"]:not([class*="header"]):not([class*="main"]),
[class*="ad-wrapper"], [class*="ad-holder"], [class*="ad-slot"],
[id*="banner-ad"], [id*="ad-banner"], [id*="ad-slot"],
[id*="leaderboard-ad"], [id*="sidebar-ad"], [id*="footer-ad"]
{ display:none!important; }
`.trim();

const COSMETIC_COOKIES = `
/* Banners de cookies / GDPR */
.cc-window, .cc-banner, .cc-floating, .cc-grower,
.cookie-banner, .cookie-notice, .cookie-consent, .cookie-bar, .cookie-message,
.cookieBanner, .cookieConsent, .cookieNotice, .cookieBar, .cookieLaw,
#cookie-consent, #cookie-banner, #cookie-notice, #cookieBanner, #cookieNotice,
#CookieConsent, #cookie-law-info-bar, #cookie-accept-btn,
[id*="cookie-consent"], [id*="cookie-banner"], [id*="cookie-notice"],
[class*="cookie-consent"], [class*="cookie-banner"], [class*="cookie-notice"],
[class*="gdpr"], [id*="gdpr"], .gdpr-overlay, .gdpr-banner,
.cky-consent-container, .cky-modal,
.cookieBot, #CybotCookiebotDialog,
.js-cookie-consent, .cookie-law-bar,
[aria-label*="cookie"], [aria-describedby*="cookie"],
.qc-cmp2-container, .qc-cmp2-ui,
.sp-message-container,
#usercentrics-root,
.ot-sdk-container, #onetrust-banner-sdk, #onetrust-consent-sdk,
.evidon-banner, #evidon-banner,
.truste_overlay, #truste-consent-track
{ display:none!important; }
`.trim();

const COSMETIC_SOCIAL = `
/* Botones sociales de rastreo */
.fb-like-box, .fb-page, .fb-like,
.twitter-follow-button, .twitter-share-button,
.linkedin-plugin, .in-follow-btn,
[data-pin-do], .pinterest-social-widget
{ display:none!important; }
`.trim();

const COSMETIC_OVERLAYS = `
/* Pop-unders / interstitials / sticky ads */
.interstitial-ad, .overlay-ad, .ad-overlay,
[class*="interstitial"]:not(body):not(main),
[class*="sticky-ad"], [id*="sticky-ad"],
[class*="floating-ad"], [id*="floating-ad"],
[class*="fixed-ad"], [id*="fixed-ad"],
[class*="adhesion-ad"], [id*="adhesion"],
[class*="leaderboard-sticky"], [id*="leaderboard-sticky"],
.ad-sticky, #ad-sticky, .sticky-banner,
[class*="bottom-ad"], [id*="bottom-ad"],
[data-ad-slot], [data-ad-client]
{ display:none!important; }
`.trim();

const COSMETIC_POPUPS = `
/* Notificaciones push / permisos push */
.push-notification-prompt, .push-consent,
[class*="push-notification"]:not([data-appspawner-ui]),
[class*="push-permission"]:not([data-appspawner-ui]),
[id*="push-notification"], [id*="push-permission"],
[class*="notification-prompt"], [id*="notification-prompt"],
[class*="subscribe-popup"], [id*="subscribe-popup"],
[class*="alert-notify"], [id*="alert-notify"],
/* OneSignal y similares */
#onesignal-popover-container, #onesignal-bell-container,
.onesignal-reset, #onesignal-slidedown-container,
[id*="onesignal"], [class*="onesignal"],
[id*="pushwoosh"], [class*="pushwoosh"],
[id*="izooto"], [class*="izooto"],
[id*="webpushr"], [class*="webpushr"],
/* Notification widget cards en esquinas */
[class*="notification-widget"]:not([data-appspawner-ui]),
[class*="notif-widget"]:not([data-appspawner-ui]),
[id*="notif-widget"], [id*="notification-widget"],
[class*="push-card"], [id*="push-card"],
/* Fake social notification ads */
[class*="social-proof-notif"], [class*="sales-notif"],
[class*="fomo-notification"], [class*="trustedsite-notif"]
{ display:none!important; }
`.trim();

const COSMETIC_SPONSORED = `
/* Patrocinados / video ads */
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

// Legacy export for compatibility
const COSMETIC_CSS = [COSMETIC_ADS, COSMETIC_COOKIES, COSMETIC_SOCIAL, COSMETIC_OVERLAYS, COSMETIC_POPUPS, COSMETIC_SPONSORED].join('\n\n');

function buildCosmeticCss(categories = null) {
  if (!categories) return COSMETIC_CSS;
  const c = { cosmetic: true, cookies: true, overlays: true, popups: true, ...categories };
  const parts = ['/* AppSpawner AdBlock v3 */'];
  if (c.cosmetic !== false) parts.push(COSMETIC_ADS, COSMETIC_SOCIAL, COSMETIC_SPONSORED);
  if (c.cookies !== false)  parts.push(COSMETIC_COOKIES);
  if (c.overlays !== false) parts.push(COSMETIC_OVERLAYS);
  if (c.popups !== false)   parts.push(COSMETIC_POPUPS);
  return parts.join('\n\n');
}

function getCosmeticCssForUrl(pageUrl = '', categories = null, extraCosmeticRules = []) {
  const selectors = new Set();
  for (const selector of abpState.globalCosmetic.slice(0, ABP_LIMITS.injectedGlobalCosmetic)) {
    selectors.add(selector);
  }

  let hostname = '';
  try { hostname = new URL(pageUrl).hostname.toLowerCase().replace(/^www\./, ''); } catch {}

  if (hostname) {
    const exceptions = getDomainSelectors(abpState.cosmeticExceptions, hostname);
    for (const selector of getDomainSelectors(abpState.domainCosmetic, hostname).slice(0, ABP_LIMITS.injectedDomainCosmetic)) {
      if (!exceptions.has(selector)) selectors.add(selector);
    }
  }

  // Apply per-app cosmetic rules (element picker rules: "domain##selector" or "##selector")
  for (const rule of extraCosmeticRules || []) {
    const parsed = parseCosmeticRule(rule);
    if (!parsed || parsed.exception) continue;
    if (parsed.domains.length === 0) {
      selectors.add(parsed.selector);
    } else if (hostname && parsed.domains.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
      selectors.add(parsed.selector);
    }
  }

  const baseCss = buildCosmeticCss(categories);
  if (!selectors.size) return baseCss;
  const dynamicCss = chunkSelectors([...selectors], 80)
    .map(chunk => `${chunk.join(',\n')} { display:none!important; visibility:hidden!important; }`)
    .join('\n');
  return `${baseCss}\n\n/* AppSpawner AdBlock - ABP cosmetic */\n${dynamicCss}`;
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

// ── Estadisticas de bloqueo por app ──────────────────────────────────────────

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

function applyAdBlockToSession(session, appId, {
  enabled = true,
  customRules = [],
  aggressive = true,
  annoyances = true,
  filterCategories = null,
  notificationsAllowed = false,
  onPermissionRequest = null, // (permission, granted) => void — para el panel de diagnostico
} = {}) {
  if (!enabled) {
    try { session.webRequest.onBeforeRequest(null); } catch {}
    return;
  }

  const cats = filterCategories || {};
  const blockNetwork = cats.network !== false;

  session.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
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

    if (blockNetwork) {
      const reason = isBlocked(url, customRules, {
        aggressive,
        resourceType: details.resourceType,
        referrer: details.referrer,
      });
      if (reason) {
        logBlock(appId, url, details.resourceType, reason);
        incrementBlocked(appId);
        callback({ cancel: true });
        return;
      }
    }

    callback({});
  });

  // Bloquear permisos de notificaciones push siempre (independiente del modo annoyances)
  // Las web push notifications son el principal vector de los corner notification ads
  session.setPermissionRequestHandler((_webContents, permission, callback) => {
    const respond = (granted) => {
      try { onPermissionRequest?.(permission, granted); } catch {}
      callback(granted);
    };
    if (permission === 'notifications') {
      respond(notificationsAllowed);
      return;
    }
    if (['midiSysex', 'pointerLock'].includes(permission)) {
      respond(false);
      return;
    }
    if (annoyances && ['geolocation', 'fullscreen'].includes(permission)) {
      respond(false);
      return;
    }
    respond(true);
  });

  // Bloquear headers de respuesta que habilitan popups (X-Frame-Options, etc.)
  try {
    session.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
      const headers = { ...details.responseHeaders };
      // Eliminar cabeceras que fuerzan redirecciones o habilitan popups de terceros
      delete headers['x-frame-options'];
      delete headers['X-Frame-Options'];
      callback({ responseHeaders: headers });
    });
  } catch {}
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

function registerAdBlockHandlers(ipcMain, store) {
  loadBlockList();
  loadCachedSubscriptions(store.read().settings);

  // Auto-update if any enabled subscription is older than 7 days
  (() => {
    const { settings } = store.read();
    const subs = normalizeSubscriptions(settings);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const needsUpdate = subs.some(s =>
      s.enabled && (!s.lastUpdated || Date.now() - new Date(s.lastUpdated).getTime() > sevenDaysMs)
    );
    if (needsUpdate) {
      setTimeout(() => {
        updateSubscriptions(store).catch(err => console.warn('[AdBlock] Auto-update fallido:', err.message));
      }, 8000);
    }
  })();

  ipcMain.handle('adblock:get-config', () => {
    const { settings } = store.read();
    return {
      enabled:      settings.adblockEnabled      ?? true,
      cosmetic:     settings.adblockCosmetic      ?? true,
      httpsUpgrade: settings.adblockHttpsUpgrade  ?? true,
      aggressive:   settings.adblockAggressive    ?? true,
      annoyances:   settings.adblockAnnoyances    ?? true,
      ...getAdBlockStats(),
    };
  });

  ipcMain.handle('adblock:update-config', (_e, updates) => {
    const data = store.read();
    data.settings = {
      ...data.settings,
      ...(updates.enabled      !== undefined && { adblockEnabled:      updates.enabled }),
      ...(updates.cosmetic     !== undefined && { adblockCosmetic:     updates.cosmetic }),
      ...(updates.httpsUpgrade !== undefined && { adblockHttpsUpgrade: updates.httpsUpgrade }),
      ...(updates.aggressive   !== undefined && { adblockAggressive:   updates.aggressive }),
      ...(updates.annoyances   !== undefined && { adblockAnnoyances:   updates.annoyances }),
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
      enabled:           app?.adblockEnabled           ?? true,
      customRules:       app?.adblockCustomRules        ?? [],
      cosmeticRules:     app?.adblockCosmeticRules      ?? [],
      filterCategories:  app?.adblockFilterCategories   ?? null,
      aggressiveOverride: app?.adblockAggressiveOverride ?? null,
      blocked:           getBlockedCount(appId),
    };
  });

  ipcMain.handle('adblock:update-app-config', (_e, appId, updates) => {
    const data  = store.read();
    const index = data.apps.findIndex(a => a.id === appId);
    if (index === -1) return { success: false };
    if (updates.enabled            !== undefined) data.apps[index].adblockEnabled          = updates.enabled;
    if (updates.customRules        !== undefined) data.apps[index].adblockCustomRules       = updates.customRules;
    if (updates.cosmeticRules      !== undefined) data.apps[index].adblockCosmeticRules     = updates.cosmeticRules;
    if (updates.filterCategories   !== undefined) data.apps[index].adblockFilterCategories  = updates.filterCategories;
    if (updates.aggressiveOverride !== undefined) data.apps[index].adblockAggressiveOverride = updates.aggressiveOverride;
    store.write(data);
    return { success: true };
  });

  ipcMain.handle('adblock:get-blocked-count', (_e, appId) => getBlockedCount(appId));
  ipcMain.handle('adblock:reset-count', (_e, appId) => { resetBlockedCount(appId); return true; });

  // Inspector de bloqueos
  ipcMain.handle('adblock:get-log', (_e, appId) => getBlockLog(appId));
  ipcMain.handle('adblock:clear-log', (_e, appId) => { clearBlockLog(appId); return true; });

  // Export/import reglas custom
  ipcMain.handle('adblock:export-rules', (_e, appId) => {
    const { apps } = store.read();
    const app = apps.find(a => a.id === appId);
    const rules = [...(app?.adblockCustomRules || []), ...(app?.adblockCosmeticRules || [])];
    return `! AppSpawner AdBlock rules export\n! App: ${appId}\n${rules.join('\n')}`;
  });

  ipcMain.handle('adblock:import-rules', (_e, appId, text) => {
    const lines = String(text || '').split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('!') && !l.startsWith('#'));
    const networkRules = lines.filter(l => !l.includes('##'));
    const cosmeticRulesImported = lines.filter(l => l.includes('##'));
    const data = store.read();
    const index = data.apps.findIndex(a => a.id === appId);
    if (index === -1) return { success: false };
    const existingNetwork = new Set(data.apps[index].adblockCustomRules || []);
    const existingCosmetic = new Set(data.apps[index].adblockCosmeticRules || []);
    for (const r of networkRules) existingNetwork.add(r);
    for (const r of cosmeticRulesImported) {
      const parsed = parseCosmeticRule(r);
      if (parsed) existingCosmetic.add(r);
    }
    data.apps[index].adblockCustomRules  = [...existingNetwork];
    data.apps[index].adblockCosmeticRules = [...existingCosmetic];
    store.write(data);
    return {
      success: true,
      networkRules: data.apps[index].adblockCustomRules,
      cosmeticRules: data.apps[index].adblockCosmeticRules,
    };
  });

  // Añadir regla cosmetica (elemento picker)
  ipcMain.handle('adblock:add-cosmetic-rule', (_e, appId, domain, selector) => {
    if (!isSafeCssSelector(selector)) return { success: false, error: 'Selector invalido' };
    const data = store.read();
    const index = data.apps.findIndex(a => a.id === appId);
    if (index === -1) return { success: false };
    const rule = domain ? `${domain}##${selector}` : `##${selector}`;
    const existing = data.apps[index].adblockCosmeticRules || [];
    if (!existing.includes(rule)) {
      data.apps[index].adblockCosmeticRules = [...existing, rule];
      store.write(data);
    }
    return { success: true, rule };
  });
}

module.exports = {
  registerAdBlockHandlers,
  applyAdBlockToSession,
  loadBlockList,
  isBlockedDomain,
  COSMETIC_CSS,
  getCosmeticCssForUrl,
  getDefaultSubscriptions,
  getAdBlockStats,
  getBlockedCount,
  isSafeCssSelector,
};

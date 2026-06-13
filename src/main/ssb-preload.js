'use strict';
const { ipcRenderer, contextBridge, webFrame } = require('electron');

// Algunas redes de anuncios (p.ej. "social bars" de Adsterra/PropellerAds que imitan
// notificaciones de Snapchat/Telegram) renderizan su contenido dentro de un Shadow DOM
// cerrado específicamente para que los bloqueadores de anuncios no puedan inspeccionarlo
// ni eliminarlo. Forzamos `attachShadow` a modo "open" en el contexto de la página
// (main world) para que nuestro escáner de molestias pueda atravesar esos shadow roots.
function forceOpenShadowDom() {
  try {
    webFrame.executeJavaScriptInMainWorld({
      code: `(() => {
        if (window.__appSpawnerShadowPatched) return;
        window.__appSpawnerShadowPatched = true;
        const orig = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function(init) {
          let root;
          try { root = orig.call(this, { ...init, mode: 'open' }); }
          catch { root = orig.call(this, init); }
          // Avisar al preload (mismo DOM, distinto realm de JS) para que vuelva
          // a escanear este nodo en busca de notificaciones falsas escondidas.
          try { this.dispatchEvent(new CustomEvent('appspawner:shadow-attached', { bubbles: true, composed: true })); } catch {}
          return root;
        };
      })();`,
      world: 'main',
    });
  } catch {}
}
// Cuando el usuario habilita notificaciones para esta app, Electron ya muestra
// las Notification del navegador como notificaciones nativas del SO — sólo
// hace falta enganchar el clic para enfocar/restaurar la ventana de la app.
function bridgeNativeNotifications() {
  if (window.top !== window.self) return;
  try {
    webFrame.executeJavaScriptInMainWorld({
      code: `(() => {
        if (window.__appSpawnerNotifPatched || !window.Notification) return;
        window.__appSpawnerNotifPatched = true;
        const Original = window.Notification;
        function Patched(title, options) {
          const instance = new Original(title, options);
          try {
            instance.addEventListener('click', () => {
              document.dispatchEvent(new CustomEvent('appspawner:notification-click'));
            });
          } catch {}
          return instance;
        }
        Patched.prototype = Original.prototype;
        Patched.permission = Original.permission;
        Patched.requestPermission = Original.requestPermission.bind(Original);
        window.Notification = Patched;
      })();`,
      world: 'main',
    });
  } catch {}
  document.addEventListener('appspawner:notification-click', () => {
    ipcRenderer.send('ssb:notification-clicked');
  });
}
bridgeNativeNotifications();

const DEFAULT_CONFIG = {
  version: '3.2.0',
  homeUrl: '',
  adblock: {
    enabled: true,
    annoyances: true,
    cosmetic: true,
    overlayMode: 'normal', // 'soft' | 'normal' | 'aggressive'
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
  indicators: {
    adblock: false,
    scripts: false,
    proxy:   false,
  },
};

function readConfig() {
  const arg = process.argv.find(item => item.startsWith('--appspawner-config='));
  if (!arg) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(decodeURIComponent(arg.replace('--appspawner-config=', '')));
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      adblock:    { ...DEFAULT_CONFIG.adblock,    ...(parsed.adblock    || {}) },
      toolbar:    { ...DEFAULT_CONFIG.toolbar,    ...(parsed.toolbar    || {}) },
      shortcuts:  { ...DEFAULT_CONFIG.shortcuts,  ...(parsed.shortcuts  || {}) },
      indicators: { ...DEFAULT_CONFIG.indicators, ...(parsed.indicators || {}) },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

const config = readConfig();

// Solo se activa si esta app tiene el escaneo de molestias habilitado: forzar
// shadow DOM "open" en TODOS los frames (incluidos iframes de terceros como
// Stripe/PayPal) puede romper widgets que dependen de shadow roots cerrados.
// El toggle de adblock/annoyances por app sirve como opt-out para apps sensibles.
if (config.adblock?.enabled && config.adblock?.annoyances) forceOpenShadowDom();

// Con nodeIntegrationInSubFrames activo, este preload se ejecuta también dentro de
// los iframes (incluidos los reproductores de video de terceros, donde suelen vivir
// los "social bars" de anuncios). Las funciones de UI (toolbar, atajos, badge…) sólo
// deben actuar en el frame principal; el escaneo de molestias debe correr en todos.
const isTopFrame = window.top === window.self;

function acceleratorMatches(event, accelerator) {
  if (!accelerator) return false;
  const parts = accelerator.split('+').map(part => part.trim().toLowerCase()).filter(Boolean);
  const key = parts.find(part => !['ctrl', 'control', 'cmd', 'command', 'meta', 'shift', 'alt', 'option'].includes(part));
  const wantsCtrl = parts.includes('ctrl') || parts.includes('control');
  const wantsMeta = parts.includes('cmd') || parts.includes('command') || parts.includes('meta');
  const wantsShift = parts.includes('shift');
  const wantsAlt = parts.includes('alt') || parts.includes('option');
  const eventKey = event.key.toLowerCase();

  return Boolean(key) &&
    eventKey === key.toLowerCase() &&
    event.ctrlKey === wantsCtrl &&
    event.metaKey === wantsMeta &&
    event.shiftKey === wantsShift &&
    event.altKey === wantsAlt;
}

async function togglePictureInPicture() {
  const videos = Array.from(document.querySelectorAll('video'))
    .filter(video => video.readyState > 0 && video.videoWidth > 0 && video.videoHeight > 0);

  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return true;
    }
    if (videos[0]?.requestPictureInPicture) {
      await videos[0].requestPictureInPicture();
      return true;
    }
  } catch {}

  ipcRenderer.send('ssb:toggle-pip-window');
  return false;
}

function goHome() {
  if (config.homeUrl) window.location.href = config.homeUrl;
}

window.addEventListener('keydown', (event) => {
  if (!isTopFrame || config.shortcuts?.enabled === false) return;
  const shortcuts = config.shortcuts || {};

  if (acceleratorMatches(event, shortcuts.reload) || acceleratorMatches(event, shortcuts.reloadAlt)) {
    event.preventDefault();
    window.location.reload();
    return;
  }
  if (acceleratorMatches(event, shortcuts.back)) {
    event.preventDefault();
    window.history.back();
    return;
  }
  if (acceleratorMatches(event, shortcuts.forward)) {
    event.preventDefault();
    window.history.forward();
    return;
  }
  if (acceleratorMatches(event, shortcuts.devtools)) {
    event.preventDefault();
    ipcRenderer.send('ssb:open-devtools');
    return;
  }
  if (acceleratorMatches(event, shortcuts.pip)) {
    event.preventDefault();
    togglePictureInPicture();
  }
});

let lastBadgeCount = -1;

function extractBadgeCount(title) {
  const match = title.match(/^\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

const titleObserver = new MutationObserver(() => {
  const count = extractBadgeCount(document.title);
  if (count !== lastBadgeCount) {
    lastBadgeCount = count;
    ipcRenderer.send('ssb:badge-update', count);
  }
});

function toolbarButton(key) {
  const labels = {
    back:     ['M15 18l-6-6 6-6M9 12h12',                       'Atrás'],
    forward:  ['M9 18l6-6-6-6M3 12h12',                         'Adelante'],
    reload:   ['M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6',          'Recargar'],
    home:     ['M3 11l9-8 9 8M5 10v10h14V10',                   'Inicio'],
    pip:      ['M4 5h16v14H4zM12 12h6v4h-6z',                   'Picture-in-Picture'],
    notes:    ['M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',             'Notas'],
    devtools: ['M8 9l-4 3 4 3M16 9l4 3-4 3M14 5l-4 14',         'DevTools'],
    shield:   ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10',    'Ad Block activo'],
    picker:   ['M4 20h4l10.5-10.5a2 2 0 0 0-4-4L4 16v4',        'Ocultar elemento'],
    snapshot: ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'Guardar sesión'],
    broken:   ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01', 'Esta página se rompió (pausar AdBlock y recargar)'],
    settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z', 'Opciones de toolbar'],
  };
  const [pathData, label] = labels[key] || ['', key];
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = key;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = pathData
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${pathData}"/></svg>`
    : `<span>${key}</span>`;
  button.addEventListener('click', () => {
    if (key === 'back')     window.history.back();
    if (key === 'forward')  window.history.forward();
    if (key === 'reload')   window.location.reload();
    if (key === 'home')     goHome();
    if (key === 'pip')      togglePictureInPicture();
    if (key === 'notes')    toggleNotes();
    if (key === 'devtools') ipcRenderer.send('ssb:open-devtools');
    if (key === 'shield')   ipcRenderer.send('ssb:toggle-adblock');
    if (key === 'picker')   startElementPicker();
    if (key === 'snapshot') ipcRenderer.send('ssb:save-snapshot');
    if (key === 'settings') openToolbarEditor();
    if (key === 'broken') {
      ipcRenderer.send('ssb:report-broken-page');
      showSsbToast('AdBlock pausado para esta app. Recargando…', 'ok');
    }
  });
  return button;
}

// ── Toast de feedback ─────────────────────────────────────────────────────────

function showSsbToast(message, type) {
  if (!document.getElementById('appspawner-toast-anim')) {
    const s = document.createElement('style');
    s.id = 'appspawner-toast-anim';
    s.textContent = `@keyframes as-toast-in{from{opacity:0;transform:translateX(-50%) translateY(6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
    document.head.appendChild(s);
  }
  const t = document.createElement('div');
  t.dataset.appspawnerUi = 'true';
  const col  = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981';
  const icon = type === 'error' ? '✗' : type === 'warning' ? '⚠' : '✓';
  t.style.cssText = `position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(12,12,18,.97);color:#fff;padding:10px 18px;border-radius:12px;font:13px system-ui;border:1px solid ${col}55;box-shadow:0 8px 28px rgba(0,0,0,.45);backdrop-filter:blur(16px);display:flex;align-items:center;gap:9px;white-space:nowrap;animation:as-toast-in .18s ease`;
  t.innerHTML = `<span style="color:${col};font-size:15px">${icon}</span>${message}`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .25s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 260); }, 2500);
}

// ── Editor de toolbar ─────────────────────────────────────────────────────────

const ALL_TOOLBAR_BUTTONS = [
  { key: 'back',     label: 'Atrás',    icon: 'M15 18l-6-6 6-6M9 12h12' },
  { key: 'forward',  label: 'Adelante', icon: 'M9 18l6-6-6-6M3 12h12' },
  { key: 'reload',   label: 'Recargar', icon: 'M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6' },
  { key: 'home',     label: 'Inicio',   icon: 'M3 11l9-8 9 8M5 10v10h14V10' },
  { key: 'pip',      label: 'PiP',      icon: 'M4 5h16v14H4zM12 12h6v4h-6z' },
  { key: 'notes',    label: 'Notas',    icon: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5' },
  { key: 'devtools', label: 'DevTools', icon: 'M8 9l-4 3 4 3M16 9l4 3-4 3M14 5l-4 14' },
  { key: 'shield',   label: 'AdBlock',  icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10' },
  { key: 'picker',   label: 'Ocultar',  icon: 'M4 20h4l10.5-10.5a2 2 0 0 0-4-4L4 16v4' },
  { key: 'snapshot', label: 'Sesión',   icon: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { key: 'broken',   label: 'Reportar', icon: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01' },
];

function rebuildToolbar(newButtons) {
  const tb = document.getElementById('appspawner-toolbar');
  if (!tb) return;
  while (tb.firstChild) tb.removeChild(tb.firstChild);
  (newButtons || config.toolbar?.buttons || DEFAULT_CONFIG.toolbar.buttons).forEach(key => {
    if (key !== 'settings') tb.appendChild(toolbarButton(key));
  });
  tb.appendChild(toolbarButton('settings'));
  if (config.toolbar) config.toolbar.buttons = newButtons;
}

function openToolbarEditor() {
  const existing = document.getElementById('appspawner-toolbar-editor');
  if (existing) { existing.remove(); return; }

  const currentButtons = new Set(config.toolbar?.buttons || DEFAULT_CONFIG.toolbar.buttons);
  const selected = new Set(currentButtons);

  const panel = document.createElement('div');
  panel.id = 'appspawner-toolbar-editor';
  panel.dataset.appspawnerUi = 'true';
  panel.style.cssText = `
    position:fixed;top:54px;right:12px;z-index:2147483647;
    background:rgba(12,12,18,.97);border:1px solid rgba(255,255,255,.14);
    border-radius:14px;padding:12px 10px 10px;
    box-shadow:0 18px 46px rgba(0,0,0,.45);backdrop-filter:blur(18px);
    color:white;display:grid;grid-template-columns:repeat(3,1fr);gap:5px;min-width:190px;
  `;

  ALL_TOOLBAR_BUTTONS.forEach(({ key, label, icon }) => {
    const on = selected.has(key);
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.appspawnerUi = 'true';
    el.dataset.editorKey = key;
    el.title = label;
    el.style.cssText = `
      display:flex;flex-direction:column;align-items:center;gap:3px;
      padding:8px 5px;border-radius:10px;border:0;cursor:pointer;
      font:10px system-ui;transition:all .12s;
      background:${on ? 'rgba(124,58,237,.5)' : 'rgba(255,255,255,.06)'};
      color:${on ? '#c4b5fd' : 'rgba(255,255,255,.45)'};
    `;
    el.innerHTML = `<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="${icon}"/></svg>${label}`;
    el.addEventListener('click', () => {
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
      const active = selected.has(key);
      el.style.background = active ? 'rgba(124,58,237,.5)' : 'rgba(255,255,255,.06)';
      el.style.color       = active ? '#c4b5fd' : 'rgba(255,255,255,.45)';
    });
    panel.appendChild(el);
  });

  const apply = document.createElement('button');
  apply.type = 'button';
  apply.dataset.appspawnerUi = 'true';
  apply.textContent = 'Aplicar';
  apply.style.cssText = `grid-column:1/-1;padding:7px;border:0;border-radius:10px;background:#7c3aed;color:#fff;cursor:pointer;font:700 12px system-ui;margin-top:4px`;
  apply.addEventListener('click', () => {
    const ordered = ALL_TOOLBAR_BUTTONS.map(b => b.key).filter(k => selected.has(k));
    ordered.push('settings');
    ipcRenderer.send('ssb:update-toolbar-buttons', ordered);
    panel.remove();
    rebuildToolbar(ordered);
    showSsbToast('Toolbar actualizada', 'success');
  });
  panel.appendChild(apply);
  document.body.appendChild(panel);

  let closeEditorHandler;
  closeEditorHandler = (e) => {
    if (!isAppSpawnerUi(e.target)) {
      panel.remove();
      document.removeEventListener('click', closeEditorHandler, true);
    }
  };
  setTimeout(() => document.addEventListener('click', closeEditorHandler, true), 120);
}

// ── Element picker ────────────────────────────────────────────────────────────

function safeCssIdent(str) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(str);
  return String(str || '').replace(/[^\w-]/g, c => `\\${c}`);
}

function stableElementSelector(el, { maxDepth = 5 } = {}) {
  if (!(el instanceof Element)) return null;
  const parts = [];
  let cur = el;
  while (cur && cur !== document.body && cur !== document.documentElement && parts.length < maxDepth) {
    if (cur.id && /^[a-z]/i.test(cur.id) && !/(\d{4,}|random|uuid|generated)/i.test(cur.id)) {
      parts.unshift(`#${safeCssIdent(cur.id)}`);
      break;
    }
    const tag = cur.tagName.toLowerCase();
    const classes = Array.from(cur.classList || [])
      .filter(c => c && !/^(is-|has-|active|hover|focus|selected|disabled|open|show|hide|visible|hidden|ng-|css-|jsx-|sc-)/.test(c))
      .filter(c => !/\d{4,}|[a-f0-9]{8,}/i.test(c))
      .slice(0, 2)
      .map(c => `.${safeCssIdent(c)}`)
      .join('');
    const attrName = cur.getAttribute('data-testid') ? 'data-testid'
      : cur.getAttribute('data-test') ? 'data-test'
      : cur.getAttribute('aria-label') ? 'aria-label'
      : '';
    const attrValue = attrName ? String(cur.getAttribute(attrName)).replace(/"/g, '\\"').slice(0, 80) : '';
    parts.unshift(tag + classes + (attrName && parts.length === 0 ? `[${attrName}="${attrValue}"]` : ''));
    cur = cur.parentElement;
  }
  return parts.length ? parts.join(' > ') : null;
}

function pickerTargetFromEvent(event, hovered) {
  if (!hovered) return null;
  if (!event.shiftKey) return hovered;
  let cur = hovered;
  for (let i = 0; i < 3 && cur?.parentElement && cur.parentElement !== document.body; i++) {
    const rect = cur.parentElement.getBoundingClientRect();
    if (rect.width > window.innerWidth * 0.95 && rect.height > window.innerHeight * 0.85) break;
    cur = cur.parentElement;
  }
  return cur;
}

function startElementPicker() {
  if (document.getElementById('appspawner-picker-marker')) return;

  const marker = document.createElement('div');
  marker.id = 'appspawner-picker-marker';
  marker.dataset.appspawnerUi = 'true';
  marker.style.display = 'none';
  document.body.appendChild(marker);

  const style = document.createElement('style');
  style.id = 'appspawner-picker-style';
  style.textContent = `
    #appspawner-picker-highlight {
      position: fixed; z-index: 2147483646; pointer-events: none;
      border: 2px solid #7c3aed; background: rgba(124,58,237,0.14);
      border-radius: 3px; transition: all .05s ease;
    }
    #appspawner-picker-tooltip {
      position: fixed; z-index: 2147483647; pointer-events: none;
      background: rgba(12,12,18,.94); color: #c4b5fd; padding: 5px 10px;
      border-radius: 8px; font: 11px/1.4 monospace; white-space: pre;
      max-width: 440px; overflow: hidden; text-overflow: ellipsis;
      box-shadow: 0 4px 16px rgba(0,0,0,.45); border: 1px solid rgba(124,58,237,.4);
    }
    #appspawner-picker-bar {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      z-index: 2147483647; background: rgba(12,12,18,.94); color: white;
      padding: 10px 18px; border-radius: 12px; font: 13px system-ui;
      border: 1px solid rgba(124,58,237,.35); box-shadow: 0 8px 28px rgba(0,0,0,.45);
      backdrop-filter: blur(16px); text-align: center; white-space: nowrap;
    }
    #appspawner-picker-bar kbd {
      background: rgba(255,255,255,.12); border-radius: 5px;
      padding: 1px 6px; font: 11px monospace;
    }
  `;
  document.head.appendChild(style);

  const highlight = document.createElement('div');
  highlight.id = 'appspawner-picker-highlight';
  highlight.dataset.appspawnerUi = 'true';
  document.body.appendChild(highlight);

  const tooltip = document.createElement('div');
  tooltip.id = 'appspawner-picker-tooltip';
  tooltip.dataset.appspawnerUi = 'true';
  document.body.appendChild(tooltip);

  const bar = document.createElement('div');
  bar.id = 'appspawner-picker-bar';
  bar.dataset.appspawnerUi = 'true';
  bar.innerHTML = `<strong>Inspector AdBlock</strong> &mdash; Clic oculta elemento &nbsp;&middot;&nbsp; <kbd>Shift</kbd> + clic oculta contenedor &nbsp;&middot;&nbsp; <kbd>Esc</kbd> cancela`;
  document.body.appendChild(bar);

  let lastHovered = null;

  function onMouseMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isAppSpawnerUi(el)) return;
    lastHovered = el;
    const rect = el.getBoundingClientRect();
    highlight.style.left   = `${rect.left + window.scrollX}px`;
    highlight.style.top    = `${rect.top  + window.scrollY}px`;
    highlight.style.width  = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    const sel = stableElementSelector(el);
    tooltip.textContent = sel || el.tagName.toLowerCase();
    const tx = Math.min(e.clientX + 14, window.innerWidth - 460);
    const ty = e.clientY > window.innerHeight - 80 ? e.clientY - 52 : e.clientY + 18;
    tooltip.style.left    = `${tx}px`;
    tooltip.style.top     = `${ty}px`;
    tooltip.style.display = 'block';
  }

  function onClick(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!lastHovered) return;
    const target = pickerTargetFromEvent(e, lastHovered);
    const sel = stableElementSelector(target);
    if (!sel) return;
    ipcRenderer.send('ssb:element-picked', { selector: sel, hostname: location.hostname });
    // Ocultar inmediatamente el elemento en esta sesion
    try {
      const styleEl = document.createElement('style');
      styleEl.dataset.appspawnerUi = 'true';
      styleEl.textContent = `${sel} { display:none!important; }`;
      document.head.appendChild(styleEl);
      target?.remove?.();
    } catch {}
    showSsbToast('Regla cosmetica guardada', 'success');
    cleanup();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') cleanup();
  }

  function cleanup() {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click',     onClick,     true);
    document.removeEventListener('keydown',   onKeyDown,   true);
    highlight.remove(); tooltip.remove(); bar.remove(); marker.remove();
    document.getElementById('appspawner-picker-style')?.remove();
  }

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click',     onClick,     true);
  document.addEventListener('keydown',   onKeyDown,   true);
}

window.__appSpawnerStartElementPicker = startElementPicker;

// Recibir activacion del picker desde el proceso principal
ipcRenderer.on('adblock:start-picker', () => startElementPicker());

// Actualizar el boton shield cuando el estado del adblock cambia
ipcRenderer.on('adblock:status-changed', (_e, { enabled }) => {
  const btn = document.querySelector('#appspawner-toolbar [data-action="shield"]');
  if (btn) {
    btn.title = enabled ? 'Ad Block activo' : 'Ad Block PAUSADO';
    btn.style.color = enabled ? '' : 'rgba(251,191,36,1)';
  }
  const ind = document.querySelector('#appspawner-indicators .as-indicator[title*="Block"]');
  if (ind) ind.style.background = enabled ? '#7c3aed' : 'rgba(251,191,36,.7)';
});

// Feedback de snapshot guardado
ipcRenderer.on('ssb:snapshot-saved', (_e, { name } = {}) => {
  showSsbToast(`Sesión guardada${name ? ': ' + name : ''}`, 'success');
});

// Aviso visible cuando el proceso principal bloquea un popup/redirect de anuncios
ipcRenderer.on('ssb:show-toast', (_e, { message, type } = {}) => {
  if (message) showSsbToast(message, type || 'warning');
});

function injectToolbar() {
  if (!config.toolbar?.enabled || document.getElementById('appspawner-toolbar')) return;

  const style = document.createElement('style');
  style.id = 'appspawner-toolbar-style';
  style.textContent = `
    #appspawner-toolbar {
      position: fixed; top: 12px; right: 12px; z-index: 2147483647;
      display: flex; gap: 4px; align-items: center; padding: 5px;
      border-radius: 11px; background: rgba(12, 12, 18, .86);
      border: 1px solid rgba(255,255,255,.13); box-shadow: 0 14px 38px rgba(0,0,0,.28);
      backdrop-filter: blur(18px) saturate(1.2); color: white; font: 12px system-ui, sans-serif;
      opacity: .34; transition: opacity .16s ease, transform .16s ease, background .16s ease;
      -webkit-app-region: no-drag;
    }
    #appspawner-toolbar:hover, #appspawner-toolbar:focus-within {
      opacity: 1; background: rgba(12, 12, 18, .94); transform: translateY(1px);
    }
    #appspawner-toolbar::before {
      content: ""; width: 1px; height: 20px; margin: 0 2px;
      background: linear-gradient(to bottom, transparent, rgba(255,255,255,.24), transparent);
    }
    #appspawner-toolbar button {
      width: 30px; height: 28px; border: 0; border-radius: 8px; color: rgba(255,255,255,.76);
      background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
      transition: background .14s ease, color .14s ease, transform .14s ease;
    }
    #appspawner-toolbar button:hover {
      background: rgba(124,58,237,.82); color: white; transform: translateY(-1px);
    }
    #appspawner-toolbar button:active { transform: translateY(0); }
    #appspawner-toolbar svg {
      width: 15px; height: 15px; stroke: currentColor; fill: none; stroke-width: 2;
      stroke-linecap: round; stroke-linejoin: round; pointer-events: none;
    }
    #appspawner-notes {
      position: fixed; right: 12px; top: 54px; z-index: 2147483647; width: min(360px, calc(100vw - 24px));
      height: 300px; display: none; overflow: hidden; border-radius: 14px; background: rgba(13,13,20,.96);
      border: 1px solid rgba(255,255,255,.14); box-shadow: 0 18px 46px rgba(0,0,0,.36);
      backdrop-filter: blur(18px); color: white; font: 13px system-ui, sans-serif;
    }
    #appspawner-notes[data-open="true"] { display: block; }
    #appspawner-notes header {
      height: 40px; display: flex; align-items: center; justify-content: space-between;
      padding: 0 12px; border-bottom: 1px solid rgba(255,255,255,.08); color: rgba(255,255,255,.82);
      font-weight: 700;
    }
    #appspawner-notes header button {
      width: 26px; height: 26px; border: 0; border-radius: 8px; color: rgba(255,255,255,.55);
      background: rgba(255,255,255,.06); cursor: pointer;
    }
    #appspawner-notes header button:hover { color: white; background: rgba(255,255,255,.12); }
    #appspawner-notes .appspawner-notes-body { height: calc(100% - 40px); padding: 10px; }
    #appspawner-notes textarea {
      width: 100%; height: 100%; resize: none; border: 0; outline: 0; border-radius: 10px;
      padding: 10px; background: rgba(255,255,255,.075); color: white; font: 13px/1.45 system-ui, sans-serif;
    }
    #appspawner-notes textarea::placeholder { color: rgba(255,255,255,.32); }
    #appspawner-indicators {
      position: fixed; top: 52px; right: 12px; z-index: 2147483646;
      display: flex; gap: 4px; align-items: center; padding: 3px 6px;
      border-radius: 8px; background: rgba(12,12,18,.82);
      border: 1px solid rgba(255,255,255,.09);
      backdrop-filter: blur(12px);
      opacity: .55; transition: opacity .16s ease;
    }
    #appspawner-indicators:hover { opacity: 1; }
    .as-indicator {
      width: 6px; height: 6px; border-radius: 50%;
      cursor: default;
    }
    @media (max-width: 720px) {
      #appspawner-toolbar { top: auto; right: 10px; bottom: 10px; opacity: .72; }
      #appspawner-notes { top: auto; right: 10px; bottom: 54px; }
      #appspawner-indicators { top: auto; right: 10px; bottom: 54px; display: none; }
    }
  `;
  document.documentElement.appendChild(style);

  const toolbar = document.createElement('div');
  toolbar.id = 'appspawner-toolbar';
  toolbar.dataset.appspawnerUi = 'true';
  const btnKeys = config.toolbar.buttons || DEFAULT_CONFIG.toolbar.buttons;
  btnKeys.filter(k => k !== 'settings').forEach(key => toolbar.appendChild(toolbarButton(key)));
  toolbar.appendChild(toolbarButton('settings'));
  document.body.appendChild(toolbar);

  // Indicadores de estado (adblock / scripts / proxy)
  const indicators = config.indicators || DEFAULT_CONFIG.indicators;
  const hasBadge = indicators.adblock || indicators.scripts || indicators.proxy;
  if (hasBadge) {
    const indBar = document.createElement('div');
    indBar.id = 'appspawner-indicators';
    indBar.dataset.appspawnerUi = 'true';
    if (indicators.adblock) {
      const d = document.createElement('span');
      d.className = 'as-indicator';
      d.title = 'Ad Block activo';
      d.style.background = '#7c3aed';
      indBar.appendChild(d);
    }
    if (indicators.scripts) {
      const d = document.createElement('span');
      d.className = 'as-indicator';
      d.title = 'Scripts de usuario activos';
      d.style.background = '#10b981';
      indBar.appendChild(d);
    }
    if (indicators.proxy) {
      const d = document.createElement('span');
      d.className = 'as-indicator';
      d.title = 'Proxy activo';
      d.style.background = '#3b82f6';
      indBar.appendChild(d);
    }
    document.body.appendChild(indBar);
  }

  const notes = document.createElement('div');
  notes.id = 'appspawner-notes';
  notes.dataset.appspawnerUi = 'true';
  const header = document.createElement('header');
  const title = document.createElement('span');
  title.textContent = 'Notas';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'x';
  close.title = 'Cerrar notas';
  close.addEventListener('click', toggleNotes);
  header.appendChild(title);
  header.appendChild(close);
  const body = document.createElement('div');
  body.className = 'appspawner-notes-body';
  const textarea = document.createElement('textarea');
  const storageKey = `appspawner:notes:${location.origin}`;
  textarea.placeholder = 'Notas de esta app...';
  textarea.value = localStorage.getItem(storageKey) || '';
  textarea.addEventListener('input', () => localStorage.setItem(storageKey, textarea.value));
  body.appendChild(textarea);
  notes.appendChild(header);
  notes.appendChild(body);
  document.body.appendChild(notes);
}

function toggleNotes() {
  const notes = document.getElementById('appspawner-notes');
  if (!notes) return;
  const open = notes.dataset.open === 'true';
  notes.dataset.open = open ? 'false' : 'true';
  if (!open) notes.querySelector('textarea')?.focus();
}

const FAKE_NOTIFICATION_TERMS = [
  'pending snaps', 'snapchat', 'whatsapp', 'telegram', 'notification',
  'notifications', 'new message', 'you have', 'dating', 'adult', 'casino',
  'winner', 'prize', 'claim now', 'click allow', 'enable notifications',
  'instagram', 'tiktok', 'facebook', 'messenger', 'unread messages',
  'new follower', 'sent you', 'liked your',
];

const CLICKBAIT_TERMS = [
  'going viral', 'trick is going', 'won\'t believe', 'shocking', 'people are sharing',
  'act now', 'limited time', 'click here', 'find out why', 'doctors hate',
  'this simple', 'one weird', 'you need to see', 'this will',
];

function isInsideMediaSurface(node) {
  if (!(node instanceof Element)) return false;
  return Boolean(node.closest('video, audio, media-controller, .plyr, .video-js, .jwplayer, .vjs-control-bar, [class*="control"], [class*="player"], [id*="player"]'));
}

function elementText(node) {
  return String(node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function hasCloseControl(node) {
  if (!(node instanceof Element)) return false;
  return Boolean(node.querySelector('button, [role="button"], [aria-label*="close" i], [aria-label*="cerrar" i], [class*="close" i], [id*="close" i]'));
}

// Umbral minimo de z-index para considerar un elemento "overlay flotante",
// segun el modo anti-overlays configurado por sitio:
//  - soft:       solo los casos mas evidentes (z-index muy alto)
//  - normal:     comportamiento por defecto
//  - aggressive: detecta tambien overlays con z-index bajo (mas falsos positivos posibles)
function getOverlayMode() {
  return config.adblock?.overlayMode || 'normal';
}

function floatingOverlayZThreshold() {
  const mode = getOverlayMode();
  if (mode === 'soft') return 5000;
  if (mode === 'aggressive') return 50;
  return 1000;
}

function isFloatingOverlay(node) {
  if (!(node instanceof Element) || isInsideMediaSurface(node)) return false;
  const style = getComputedStyle(node);
  if (!['fixed', 'sticky', 'absolute'].includes(style.position)) return false;
  const z = Number.parseInt(style.zIndex, 10);
  if (!Number.isFinite(z) || z < floatingOverlayZThreshold()) return false;
  const rect = node.getBoundingClientRect();
  if (rect.width < 80 || rect.height < 40) return false;
  if (rect.width > window.innerWidth * 0.95 && rect.height > window.innerHeight * 0.8) return false;
  return true;
}

function looksLikeFakeNotification(node) {
  if (!isFloatingOverlay(node)) return false;
  const text = elementText(node);
  if (!text || text.length > 500) return false;

  const termHit      = FAKE_NOTIFICATION_TERMS.some(term => text.includes(term));
  const clickbaitHit = CLICKBAIT_TERMS.some(term => text.includes(term));
  const hasBadgeNumber = /\(\d+\)|\b\d+\s+(messages?|snaps?|notifications?)\b/i.test(text);

  if (termHit || hasBadgeNumber) return true;
  if (clickbaitHit && hasCloseControl(node)) return true;
  return false;
}

// Detecta widgets de notificación ad posicionados en esquinas (z-index puede ser bajo)
function isTopCornerNotification(node) {
  if (!(node instanceof Element) || isAppSpawnerUi(node) || isInsideMediaSurface(node)) return false;
  const style = getComputedStyle(node);
  if (!['fixed', 'absolute'].includes(style.position)) return false;
  const mode = getOverlayMode();
  const rect = node.getBoundingClientRect();
  const widthMax  = mode === 'aggressive' ? 600 : 460;
  const heightMax = mode === 'aggressive' ? 320 : 220;
  const topMax    = mode === 'aggressive' ? 600 : 420;
  if (rect.width < 140 || rect.width > widthMax) return false;
  if (rect.height < 48 || rect.height > heightMax) return false;
  if (rect.top < 0 || rect.top > topMax) return false;
  // Debe estar en un lateral (>50% del ancho desde algún borde)
  const nearRight = rect.right > window.innerWidth * 0.5;
  const nearLeft  = rect.left  < window.innerWidth * 0.5;
  if (!nearRight && !nearLeft) return false;
  const text = elementText(node);
  if (!text || text.length > 600) return false;
  const termHit = FAKE_NOTIFICATION_TERMS.some(t => text.includes(t));
  // En modo "soft" solo actuamos ante coincidencias claras de texto de notificacion falsa,
  // para minimizar falsos positivos en sitios productivos.
  if (mode === 'soft') return termHit;
  return (
    termHit ||
    CLICKBAIT_TERMS.some(t => text.includes(t)) ||
    /\(\d+\)|\b\d+\s+(messages?|snaps?|notifications?|unread)\b/i.test(text)
  );
}

function injectAntiNotificationCss() {
  if (document.getElementById('as-anti-notif-css')) return;
  const style = document.createElement('style');
  style.id = 'as-anti-notif-css';
  style.dataset.appspawnerUi = 'true';
  style.textContent = `
    [id*="onesignal" i]:not([data-appspawner-ui]),
    [class*="push-notif" i]:not([data-appspawner-ui]),
    [class*="notification-widget" i]:not([data-appspawner-ui]),
    [class*="notif-popup" i]:not([data-appspawner-ui]),
    [class*="social-bar" i]:not([data-appspawner-ui]),
    [class*="socialbar" i]:not([data-appspawner-ui]),
    [class*="social-proof" i]:not([data-appspawner-ui]),
    [class*="fake-notif" i]:not([data-appspawner-ui]),
    [class*="toast-ad" i]:not([data-appspawner-ui]),
    [id*="social-bar" i]:not([data-appspawner-ui]),
    [id*="socialbar" i]:not([data-appspawner-ui]),
    [id*="notif-banner" i]:not([data-appspawner-ui]),
    [id*="push-banner" i]:not([data-appspawner-ui]),
    [class*="pushNotif" i]:not([data-appspawner-ui]) { display: none !important; }
  `;
  (document.head || document.documentElement).appendChild(style);
}

const overlayLogSeen  = new Set();
const overlayToastSeen = new Set();

function logDomBlock(node, reason) {
  try {
    const selector = stableElementSelector(node) || node?.tagName?.toLowerCase?.() || '';
    const key = `${reason}:${selector}`;
    if (overlayLogSeen.has(key)) return;
    overlayLogSeen.add(key);
    if (overlayLogSeen.size > 120) overlayLogSeen.clear();
    ipcRenderer.send('ssb:cosmetic-blocked', {
      selector,
      reason,
      url: location.href,
      hostname: location.hostname,
    });
    // Aviso visible la primera vez que se detecta cada tipo de molestia en esta
    // pestaña, para que el usuario sepa que AppSpawner actuó (sin saturar de toasts).
    if (!overlayToastSeen.has(reason)) {
      overlayToastSeen.add(reason);
      showSsbToast(`AppSpawner: ${reason.toLowerCase()}`, 'warning');
    }
  } catch {}
}

function overlaysVideo(node) {
  if (!(node instanceof Element) || isInsideMediaSurface(node)) return false;
  const style = getComputedStyle(node);
  if (!['fixed', 'absolute', 'sticky'].includes(style.position)) return false;
  const z = Number.parseInt(style.zIndex, 10);
  const mode = getOverlayMode();
  const zThreshold = mode === 'soft' ? 500 : mode === 'aggressive' ? 10 : 100;
  if (!Number.isFinite(z) || z < zThreshold) return false;
  const rect = node.getBoundingClientRect();
  if (rect.width < 40 || rect.height < 40) return false;
  const opacity = Number.parseFloat(style.opacity || '1');
  const transparent = opacity < 0.12 || style.backgroundColor === 'rgba(0, 0, 0, 0)';
  const interactive = node.querySelectorAll('button, a, input, select, textarea, [role="button"], [controls]').length > 0;
  const empty = elementText(node).length < 4 && !interactive;
  const suspiciousClass = /ad|click|overlay|popup|interstitial|vast|vpaid|preroll|sponsor/i.test(`${node.id || ''} ${node.className || ''}`);
  if (!transparent && !empty && !suspiciousClass) return false;
  const videos = Array.from(document.querySelectorAll('video')).filter(video => video.offsetWidth > 160 && video.offsetHeight > 90);
  return videos.some(video => {
    const v = video.getBoundingClientRect();
    return rect.left < v.right && rect.right > v.left && rect.top < v.bottom && rect.bottom > v.top;
  });
}

function isAppSpawnerUi(node) {
  return node instanceof Element && (node.dataset.appspawnerUi === 'true' || Boolean(node.closest('[data-appspawner-ui="true"]')));
}

// Recorre un árbol incluyendo shadow roots (abiertos gracias a forceOpenShadowDom,
// o ya abiertos de origen) — los "social bars" de anuncios suelen esconder ahí
// sus notificaciones falsas para evadir los escáneres de DOM convencionales.
function collectDeepElements(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!(node instanceof Element || node instanceof ShadowRoot)) continue;
    if (node instanceof Element) out.push(node);
    if (node.shadowRoot) stack.push(node.shadowRoot);
    for (const child of node.children || []) stack.push(child);
  }
  return out;
}

function scanAnnoyances(root = document) {
  if (!config.adblock?.enabled || !config.adblock?.annoyances) return;
  const nodes = root instanceof Element
    ? collectDeepElements(root)
    : collectDeepElements(document.body || document.documentElement);

  for (const node of nodes) {
    if (!(node instanceof Element) || isAppSpawnerUi(node)) continue;
    if (looksLikeFakeNotification(node) || isTopCornerNotification(node)) {
      logDomBlock(node, 'Fake notification removida');
      node.remove();
      continue;
    }
    if (overlaysVideo(node)) {
      if (getOverlayMode() === 'aggressive' && isFloatingOverlay(node)) {
        // En modo agresivo, los overlays grandes y de z-index alto se eliminan
        // directamente en lugar de solo neutralizar el puntero.
        logDomBlock(node, 'Overlay sobre video eliminado (modo agresivo)');
        node.remove();
        continue;
      }
      node.style.pointerEvents = 'none';
      node.style.cursor = 'default';
      node.setAttribute('data-appspawner-overlay-neutralized', 'true');
      logDomBlock(node, 'Overlay sobre video neutralizado');
    }
  }
}

function runAnnoyanceSweep() {
  // Escaneo escalonado para capturar elementos que se insertan con delay
  scanAnnoyances();
  setTimeout(() => scanAnnoyances(), 600);
  setTimeout(() => scanAnnoyances(), 1800);
  // Modo agresivo: barrido periodico continuo, los overlays de redirect/popunder
  // suelen insertarse con retardos variables tras interacciones del usuario.
  if (getOverlayMode() === 'aggressive') {
    if (window.__appSpawnerAggressiveSweep) clearInterval(window.__appSpawnerAggressiveSweep);
    window.__appSpawnerAggressiveSweep = setInterval(() => scanAnnoyances(), 2500);
  }
}

function installAntiAnnoyanceGuard() {
  if (!config.adblock?.enabled || !config.adblock?.annoyances || window.__appSpawnerAntiAnnoyanceInstalled) return;
  window.__appSpawnerAntiAnnoyanceInstalled = true;

  injectAntiNotificationCss();
  runAnnoyanceSweep();
  setTimeout(() => scanAnnoyances(), 4000);

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) scanAnnoyances(node);
      }
    }
  });
  const startObserver = () => {
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });

  // Cuando una página adjunta un shadow root (forzado a "open" por forceOpenShadowDom),
  // re-escaneamos ese nodo: ahí es donde los "social bars" de anuncios esconden
  // sus notificaciones falsas de Snapchat/Telegram para evadir el escáner normal.
  document.addEventListener('appspawner:shadow-attached', (e) => {
    const host = e.target;
    if (host instanceof Element) {
      scanAnnoyances(host);
      setTimeout(() => scanAnnoyances(host), 400);
    }
  }, true);

  // Interceptar navegación SPA (pushState / replaceState) para volver a escanear
  // cuando el router de la app cambia de ruta sin recargar la página
  if (!window.__appSpawnerSpaHooked) {
    window.__appSpawnerSpaHooked = true;
    const _origPush    = history.pushState.bind(history);
    const _origReplace = history.replaceState.bind(history);
    history.pushState    = function(...args) { _origPush(...args);    runAnnoyanceSweep(); };
    history.replaceState = function(...args) { _origReplace(...args); runAnnoyanceSweep(); };
    window.addEventListener('popstate', runAnnoyanceSweep);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (isTopFrame) {
    if (document.head) {
      titleObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
    }
    const count = extractBadgeCount(document.title);
    if (count > 0) ipcRenderer.send('ssb:badge-update', count);
    document.documentElement.style.scrollBehavior = 'smooth';
    injectToolbar();
  }
  installAntiAnnoyanceGuard();
});

installAntiAnnoyanceGuard();

if (isTopFrame) {
  contextBridge.exposeInMainWorld('appSpawner', {
    isSSB: true,
    version: '3.2.0',
    goBack: () => window.history.back(),
    goForward: () => window.history.forward(),
    reload: () => window.location.reload(),
    goHome,
    togglePictureInPicture,
  });
}

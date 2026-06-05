'use strict';
const { ipcRenderer, contextBridge } = require('electron');

const DEFAULT_CONFIG = {
  version: '3.1.0',
  homeUrl: '',
  adblock: {
    enabled: true,
    annoyances: true,
    cosmetic: true,
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
};

function readConfig() {
  const arg = process.argv.find(item => item.startsWith('--appspawner-config='));
  if (!arg) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(decodeURIComponent(arg.replace('--appspawner-config=', '')));
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      adblock: { ...DEFAULT_CONFIG.adblock, ...(parsed.adblock || {}) },
      toolbar: { ...DEFAULT_CONFIG.toolbar, ...(parsed.toolbar || {}) },
      shortcuts: { ...DEFAULT_CONFIG.shortcuts, ...(parsed.shortcuts || {}) },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

const config = readConfig();

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
  if (config.shortcuts?.enabled === false) return;
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
    back: ['M15 18l-6-6 6-6M9 12h12', 'Atras'],
    forward: ['M9 18l6-6-6-6M3 12h12', 'Adelante'],
    reload: ['M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6', 'Recargar'],
    home: ['M3 11l9-8 9 8M5 10v10h14V10', 'Inicio'],
    pip: ['M4 5h16v14H4zM12 12h6v4h-6z', 'Picture-in-Picture'],
    notes: ['M5 4h14v16H5zM8 8h8M8 12h8M8 16h5', 'Notas'],
    devtools: ['M8 9l-4 3 4 3M16 9l4 3-4 3M14 5l-4 14', 'DevTools'],
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
    if (key === 'back') window.history.back();
    if (key === 'forward') window.history.forward();
    if (key === 'reload') window.location.reload();
    if (key === 'home') goHome();
    if (key === 'pip') togglePictureInPicture();
    if (key === 'notes') toggleNotes();
    if (key === 'devtools') ipcRenderer.send('ssb:open-devtools');
  });
  return button;
}

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
    @media (max-width: 720px) {
      #appspawner-toolbar { top: auto; right: 10px; bottom: 10px; opacity: .72; }
      #appspawner-notes { top: auto; right: 10px; bottom: 54px; }
    }
  `;
  document.documentElement.appendChild(style);

  const toolbar = document.createElement('div');
  toolbar.id = 'appspawner-toolbar';
  toolbar.dataset.appspawnerUi = 'true';
  (config.toolbar.buttons || DEFAULT_CONFIG.toolbar.buttons).forEach(key => toolbar.appendChild(toolbarButton(key)));
  document.body.appendChild(toolbar);

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

function isFloatingOverlay(node) {
  if (!(node instanceof Element) || isInsideMediaSurface(node)) return false;
  const style = getComputedStyle(node);
  if (!['fixed', 'sticky', 'absolute'].includes(style.position)) return false;
  const z = Number.parseInt(style.zIndex, 10);
  if (!Number.isFinite(z) || z < 1000) return false;
  const rect = node.getBoundingClientRect();
  if (rect.width < 80 || rect.height < 40) return false;
  if (rect.width > window.innerWidth * 0.95 && rect.height > window.innerHeight * 0.8) return false;
  return true;
}

function looksLikeFakeNotification(node) {
  if (!isFloatingOverlay(node)) return false;
  const text = elementText(node);
  if (!text || text.length > 260) return false;
  const termHit = FAKE_NOTIFICATION_TERMS.some(term => text.includes(term));
  const hasBadgeNumber = /\(\d+\)|\b\d+\s+(messages?|snaps?|notifications?)\b/i.test(text);
  return (termHit || hasBadgeNumber) && hasCloseControl(node);
}

function overlaysVideo(node) {
  if (!(node instanceof Element) || isInsideMediaSurface(node)) return false;
  const style = getComputedStyle(node);
  if (!['fixed', 'absolute', 'sticky'].includes(style.position)) return false;
  const z = Number.parseInt(style.zIndex, 10);
  if (!Number.isFinite(z) || z < 100) return false;
  const rect = node.getBoundingClientRect();
  if (rect.width < 40 || rect.height < 40) return false;
  const opacity = Number.parseFloat(style.opacity || '1');
  const transparent = opacity < 0.08 || style.backgroundColor === 'rgba(0, 0, 0, 0)';
  const empty = elementText(node).length < 4 && node.querySelectorAll('button, a, input, select, textarea').length === 0;
  if (!transparent && !empty) return false;
  const videos = Array.from(document.querySelectorAll('video')).filter(video => video.offsetWidth > 160 && video.offsetHeight > 90);
  return videos.some(video => {
    const v = video.getBoundingClientRect();
    return rect.left < v.right && rect.right > v.left && rect.top < v.bottom && rect.bottom > v.top;
  });
}

function isAppSpawnerUi(node) {
  return node instanceof Element && (node.dataset.appspawnerUi === 'true' || Boolean(node.closest('[data-appspawner-ui="true"]')));
}

function scanAnnoyances(root = document) {
  if (!config.adblock?.enabled || !config.adblock?.annoyances) return;
  const nodes = root instanceof Element
    ? [root, ...root.querySelectorAll('body *')]
    : Array.from(document.querySelectorAll('body *'));

  for (const node of nodes) {
    if (!(node instanceof Element) || isAppSpawnerUi(node)) continue;
    if (looksLikeFakeNotification(node)) {
      node.remove();
      continue;
    }
    if (overlaysVideo(node)) {
      node.style.pointerEvents = 'none';
      node.setAttribute('data-appspawner-overlay-neutralized', 'true');
    }
  }
}

function installAntiAnnoyanceGuard() {
  if (!config.adblock?.enabled || !config.adblock?.annoyances || window.__appSpawnerAntiAnnoyanceInstalled) return;
  window.__appSpawnerAntiAnnoyanceInstalled = true;
  const run = () => scanAnnoyances();
  setTimeout(run, 250);
  setTimeout(run, 1000);
  setTimeout(run, 2500);
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
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.head) {
    titleObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
  }
  const count = extractBadgeCount(document.title);
  if (count > 0) ipcRenderer.send('ssb:badge-update', count);
  document.documentElement.style.scrollBehavior = 'smooth';
  injectToolbar();
  installAntiAnnoyanceGuard();
});

installAntiAnnoyanceGuard();

contextBridge.exposeInMainWorld('appSpawner', {
  isSSB: true,
  version: '3.1.0',
  goBack: () => window.history.back(),
  goForward: () => window.history.forward(),
  reload: () => window.location.reload(),
  goHome,
  togglePictureInPicture,
});

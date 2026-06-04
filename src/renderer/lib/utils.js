/**
 * utils.js — Funciones de utilidad compartidas en el renderer.
 */

/**
 * Formatea un timestamp como tiempo relativo en el idioma indicado.
 * @param {number|null} timestamp
 * @param {'es'|'en'} lang
 * @returns {string}
 */
export function formatRelativeTime(timestamp, lang = 'es') {
  if (!timestamp) return lang === 'es' ? 'Nunca' : 'Never';

  const diff    = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours   / 24);

  if (lang === 'es') {
    if (seconds < 60)  return 'Ahora mismo';
    if (minutes < 60)  return `Hace ${minutes} min`;
    if (hours   < 24)  return `Hace ${hours} h`;
    if (days    < 7)   return `Hace ${days} d`;
    return new Date(timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  } else {
    if (seconds < 60)  return 'Just now';
    if (minutes < 60)  return `${minutes}m ago`;
    if (hours   < 24)  return `${hours}h ago`;
    if (days    < 7)   return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  }
}

/**
 * Formatea bytes en una unidad legible.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0 || bytes == null) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Genera un color de acento determinista a partir de una cadena.
 * @param {string} str
 * @returns {string} Color hex
 */
export function seedColor(str) {
  const palette = [
    '#7c3aed', '#2563eb', '#059669', '#dc2626', '#d97706',
    '#db2777', '#0891b2', '#65a30d', '#ea580c', '#6366f1',
    '#0d9488', '#b91c1c', '#c026d3', '#1d4ed8', '#92400e',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

/**
 * Valida que una cadena sea una URL con esquema http/https.
 * @param {string} str
 * @returns {boolean}
 */
export function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normaliza una URL: añade https:// si no tiene esquema.
 * @param {string} str
 * @returns {string}
 */
export function normalizeUrl(str) {
  const trimmed = str.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Obtiene las iniciales de un nombre (máx. 2 caracteres).
 * @param {string} name
 * @returns {string}
 */
export function getInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Clamp un valor entre un mínimo y máximo.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Filtra apps por texto de búsqueda (nombre, URL, categoría).
 * @param {AppConfig[]} apps
 * @param {string} query
 * @returns {AppConfig[]}
 */
export function filterApps(apps, query) {
  if (!query?.trim()) return apps;
  const q = query.toLowerCase();
  return apps.filter(app =>
    app.name.toLowerCase().includes(q)     ||
    app.url.toLowerCase().includes(q)      ||
    app.category?.toLowerCase().includes(q)
  );
}

/**
 * Agrupa un array de apps por categoría.
 * @param {AppConfig[]} apps
 * @returns {Record<string, AppConfig[]>}
 */
export function groupByCategory(apps) {
  return apps.reduce((acc, app) => {
    const cat = app.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(app);
    return acc;
  }, {});
}

/**
 * Cuenta apps por categoría.
 * @param {AppConfig[]} apps
 * @returns {Record<string, number>}
 */
export function countByCategory(apps) {
  return apps.reduce((acc, app) => {
    const cat = app.category || 'general';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
}

/** Copia texto al portapapeles */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Genera un UUID v4 simple (fallback si no hay crypto.randomUUID) */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

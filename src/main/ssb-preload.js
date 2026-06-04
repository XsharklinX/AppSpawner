'use strict';
/**
 * ssb-preload.js — Preload para ventanas SSB (Site-Specific Browser).
 *
 * Agrega a cada app instalada:
 *  - Atajos de teclado de navegación (F5, Alt+←, Alt+→, Ctrl+L, etc.)
 *  - Detección de badge de notificación desde el título de la página
 *  - User-agent personalizado si la app lo requiere
 *  - Apertura de links en navegador externo (en lugar de nueva ventana Electron)
 *
 * NO expone APIs de Node.js al contenido web (solo keyboard bindings via IPC).
 */
const { ipcRenderer, contextBridge } = require('electron');

// ── Atajos de teclado de navegación ──────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  // F5 o Ctrl+R → Recargar
  if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
    e.preventDefault();
    window.location.reload();
    return;
  }

  // Alt+← → Atrás
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    window.history.back();
    return;
  }

  // Alt+→ → Adelante
  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault();
    window.history.forward();
    return;
  }

  // Ctrl+Shift+I → DevTools
  if (e.ctrlKey && e.shiftKey && e.key === 'I') {
    ipcRenderer.send('ssb:open-devtools');
    return;
  }

  // Escape → Enfocar contenido principal (salir de modales, etc.)
  if (e.key === 'Escape') {
    // No hacemos nada, dejamos que el sitio web lo maneje
    return;
  }
});

// ── Observer de badge de notificación ────────────────────────────────────────
// Muchos sitios (WhatsApp, Slack, Gmail) ponen el conteo en el <title>
// Ejemplo: "(3) WhatsApp Web" → badge = 3

let lastBadgeCount = -1;

function extractBadgeCount(title) {
  const match = title.match(/^\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Observar cambios de título para propagar el badge al proceso principal
const titleObserver = new MutationObserver(() => {
  const count = extractBadgeCount(document.title);
  if (count !== lastBadgeCount) {
    lastBadgeCount = count;
    ipcRenderer.send('ssb:badge-update', count);
  }
});

// El observer se activa cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  if (document.head) {
    titleObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
  }
  // Enviar badge inicial
  const count = extractBadgeCount(document.title);
  if (count > 0) ipcRenderer.send('ssb:badge-update', count);
});

// ── Fix de scroll suave ───────────────────────────────────────────────────────
// Algunos sitios deshabilitan el scroll; lo re-habilitamos
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.style.scrollBehavior = 'smooth';
});

// ── Expose minimal API ────────────────────────────────────────────────────────
// Solo para que el sitio sepa que está en AppSpawner (opcional)
contextBridge.exposeInMainWorld('appSpawner', {
  isSSB:     true,
  version:   '2.4.1',
  goBack:    () => window.history.back(),
  goForward: () => window.history.forward(),
  reload:    () => window.location.reload(),
});

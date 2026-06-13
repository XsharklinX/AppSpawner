'use strict';
/**
 * Lista local de reglas cosmeticas recomendadas, mantenida por AppSpawner.
 * Cada entrada es un conjunto de selectores CSS (formato AdBlock Plus "##selector",
 * sin dominio) agrupados por categoria de sitio. El usuario puede aplicarlas con
 * un clic desde el panel de AdBlock de cada app — se anaden a sus reglas cosmeticas
 * (adblockCosmeticRules) igual que las creadas con el selector de elementos.
 */

const RECOMMENDED_RULES = [
  {
    id: 'streaming-fake-download',
    label: 'Botones "Descargar"/"Play" falsos junto al reproductor',
    category: 'streaming',
    selectors: [
      '[class*="fake-download" i]',
      '[id*="fake-download" i]',
      'a[class*="btn-download"][class*="ad" i]',
      '[class*="download-ad" i]',
      '[id*="download-ad" i]',
    ],
  },
  {
    id: 'streaming-player-overlay',
    label: 'Overlays/clics invisibles sobre el reproductor de video',
    category: 'streaming',
    selectors: [
      '[class*="player-overlay" i]:not([data-appspawner-ui])',
      '[id*="player-overlay" i]',
      '.jw-share-modal',
      '.vjs-ad-overlay',
      '[class*="video-overlay-ad" i]',
    ],
  },
  {
    id: 'anime-popunder-buttons',
    label: 'Botones "Servidor"/"Mirror" que abren popunders',
    category: 'anime',
    selectors: [
      '[class*="popunder" i]:not([data-appspawner-ui])',
      '[id*="popunder" i]',
      '[class*="server-ad" i]',
      '[onclick*="window.open" i]',
    ],
  },
  {
    id: 'anime-bottom-banner',
    label: 'Banners inferiores fijos con anuncios de apps móviles',
    category: 'anime',
    selectors: [
      '[class*="mobile-sticky" i]',
      '#sticky-bottom-ad',
      '[class*="app-download-banner" i]',
      '[id*="app-download-banner" i]',
    ],
  },
  {
    id: 'social-suggested-ads',
    label: 'Tarjetas de "publicaciones patrocinadas" en el feed',
    category: 'redes',
    selectors: [
      '[data-testid*="sponsor" i]',
      '[aria-label*="Sponsored" i]',
      '[aria-label*="Patrocinado" i]',
      '[data-ad-comet-preview]',
    ],
  },
  {
    id: 'social-suggestions-rail',
    label: 'Columna de "sugerencias para ti" / contactos sugeridos',
    category: 'redes',
    selectors: [
      '[aria-label*="Suggestions" i]',
      '[aria-label*="Sugerencias" i]',
    ],
  },
  {
    id: 'generic-click-overlay',
    label: 'Overlays transparentes de clic en toda la pantalla',
    category: 'generic',
    selectors: [
      '[class*="click-overlay" i]:not([data-appspawner-ui])',
      '[id*="click-overlay" i]',
      '[class*="ad-click-layer" i]',
    ],
  },
  {
    id: 'generic-newsletter-modal',
    label: 'Modales de "suscríbete al newsletter"',
    category: 'generic',
    selectors: [
      '[class*="newsletter-modal" i]',
      '[id*="newsletter-popup" i]',
      '[class*="subscribe-modal" i]',
    ],
  },
];

function getRecommendedRules() {
  return RECOMMENDED_RULES.map(item => ({ ...item, selectors: [...item.selectors] }));
}

module.exports = { getRecommendedRules };

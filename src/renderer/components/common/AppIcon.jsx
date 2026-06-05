import React, { useState, useEffect } from 'react';

/**
 * AppIcon — Ícono de app con soporte de favicon automático.
 * iconType: 'favicon' | 'initials' | 'emoji' | 'customImage'
 * Si iconType es 'favicon', usa Google Favicon Service con fallback a iniciales.
 */
export default function AppIcon({
  iconType  = 'initials',
  iconValue = '?',
  iconColor = '#7c3aed',
  name      = '',
  url       = '',
  size      = 48,
  className = '',
}) {
  const [faviconOk, setFaviconOk] = useState(true);
  const radius   = Math.round(size * 0.28);
  const fontSize = Math.round(size * 0.33);
  const textColor = getContrastColor(iconColor);
  const containerStyle = { width: size, height: size, borderRadius: radius, flexShrink: 0 };

  // Calcular URL del favicon desde la URL de la app o iconValue
  const faviconUrl = React.useMemo(() => {
    const src = url || iconValue || '';
    try {
      const domain = new URL(src.startsWith('http') ? src : `https://${src}`).hostname;
      return `https://www.google.com/s2/favicons?sz=${size >= 64 ? 64 : 32}&domain=${domain}`;
    } catch { return null; }
  }, [url, iconValue, size]);

  useEffect(() => { setFaviconOk(true); }, [faviconUrl]);

  if (iconType === 'customImage' && iconValue) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden bg-white/[0.06] ${className}`}
        style={containerStyle}
        title={name}
      >
        <img
          src={iconValue}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          draggable={false}
        />
      </div>
    );
  }

  // ── Favicon ────────────────────────────────────────────────────────────────
  if (iconType === 'favicon' && faviconUrl && faviconOk) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden bg-white/[0.06] ${className}`}
        style={containerStyle} title={name}
      >
        <img
          src={faviconUrl}
          alt={name}
          onError={() => setFaviconOk(false)}
          style={{ width: size * 0.65, height: size * 0.65, objectFit: 'contain', imageRendering: 'auto' }}
          draggable={false}
        />
      </div>
    );
  }

  // ── Emoji ──────────────────────────────────────────────────────────────────
  if (iconType === 'emoji') {
    return (
      <div className={`flex items-center justify-center select-none overflow-hidden bg-white/[0.06] ${className}`}
        style={containerStyle} title={name}>
        <span style={{ fontSize: Math.round(size * 0.52), lineHeight: 1 }}>{iconValue}</span>
      </div>
    );
  }

  // ── Iniciales (default + fallback de favicon) ──────────────────────────────
  const initials = iconType === 'initials' && iconValue
    ? iconValue.slice(0, 3)
    : (name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?');

  return (
    <div className={`flex items-center justify-center select-none overflow-hidden ${className}`}
      style={{ ...containerStyle, background: iconColor }} title={name}>
      <span style={{ color: textColor, fontSize, fontWeight: 700, lineHeight: 1,
        letterSpacing: initials.length > 2 ? '-0.05em' : '0' }}>
        {initials}
      </span>
    </div>
  );
}

function getContrastColor(hex) {
  try {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#111118' : '#ffffff';
  } catch { return '#ffffff'; }
}

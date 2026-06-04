import React from 'react';

/**
 * Switch — Toggle de interruptor estilo macOS.
 * Accesible via keyboard, soporte para labels.
 */
export default function Switch({
  checked   = false,
  onChange,
  label,
  description,
  disabled  = false,
  size      = 'md', // 'sm' | 'md'
}) {
  const sizes = {
    sm: { track: 'w-8 h-4',   thumb: 'w-3 h-3',   translate: 'translate-x-4' },
    md: { track: 'w-10 h-5.5', thumb: 'w-4 h-4',   translate: 'translate-x-5' },
  };
  const s = sizes[size] || sizes.md;

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      onChange?.(!checked);
    }
  };

  return (
    <label
      className={`flex items-center justify-between gap-4 cursor-pointer group ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {/* Texto */}
      {(label || description) && (
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          {label && (
            <span className="text-sm font-medium text-white/80 group-hover:text-white/90 transition-colors">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-white/35 leading-relaxed">{description}</span>
          )}
        </div>
      )}

      {/* Track del switch */}
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={() => !disabled && onChange?.(!checked)}
        className={`
          relative flex-shrink-0 rounded-full transition-all duration-200
          ${s.track}
          ${checked
            ? 'bg-violet-600 shadow-glow-sm'
            : 'bg-white/[0.1] border border-white/[0.08]'
          }
          focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:ring-offset-2 focus:ring-offset-surface-card
        `}
      >
        {/* Thumb */}
        <div
          className={`
            absolute top-[3px] left-[3px] rounded-full bg-white shadow-sm
            transition-transform duration-200
            ${s.thumb}
            ${checked ? s.translate : 'translate-x-0'}
          `}
        />
      </div>
    </label>
  );
}

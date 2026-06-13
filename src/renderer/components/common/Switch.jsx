import React from 'react';
import { useSound } from '../../contexts/SoundContext';

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
  const { playSound, vibrate } = useSound();
  const sizes = {
    sm: { track: 'w-9 h-5',  thumb: 'w-4 h-4', translate: 'translate-x-4' },
    md: { track: 'w-12 h-6', thumb: 'w-5 h-5', translate: 'translate-x-6' },
  };
  const s = sizes[size] || sizes.md;

  const toggle = () => {
    playSound(checked ? 'toggleOff' : 'toggleOn');
    vibrate(8);
    onChange?.(!checked);
  };

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      toggle();
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
            <span className="text-sm font-medium text-fg/80 group-hover:text-fg/90 transition-colors">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-fg/35 leading-relaxed">{description}</span>
          )}
        </div>
      )}

      {/* Track del switch */}
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={() => !disabled && toggle()}
        className={`
          relative flex-shrink-0 rounded-full transition-all duration-200
          ${s.track}
          ${checked
            ? 'bg-violet-600 border border-violet-400/40 shadow-glow-sm'
            : 'bg-overlay/[0.08] border border-line/[0.16]'
          }
          focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:ring-offset-2 focus:ring-offset-surface-card
        `}
      >
        {/* Thumb */}
        <div
          className={`
            absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm
            transition-transform duration-200
            ${s.thumb}
            ${checked ? s.translate : 'translate-x-0'}
          `}
        />
      </div>
    </label>
  );
}

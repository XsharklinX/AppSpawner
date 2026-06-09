import React, { useState, useRef, useEffect, useCallback } from 'react';

const ALIGN = {
  start: 'left-0',
  end:   'right-0',
};

/**
 * Menu — menú desplegable accesible y reusable para acciones secundarias.
 * `trigger` recibe { open, toggle } para construir el botón que lo abre.
 * `items`: [{ icon, label, onClick, danger, disabled }]
 */
export default function Menu({ trigger, items, align = 'end', className = '' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback((e) => { e?.stopPropagation?.(); setOpen(v => !v); }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => { if (!rootRef.current?.contains(e.target)) close(); };
    const onKeyDown = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`} onClick={e => e.stopPropagation()}>
      {trigger({ open, toggle })}
      {open && (
        <div
          role="menu"
          className={`
            absolute z-50 top-full mt-1.5 min-w-[180px] py-1.5
            rounded-xl border border-white/[0.08] shadow-card-hover
            animate-scale-in origin-top-${align === 'end' ? 'right' : 'left'}
            ${ALIGN[align] || ALIGN.end}
          `}
          style={{ background: 'rgba(17,17,24,0.97)', backdropFilter: 'blur(16px)' }}
        >
          {items.map(({ icon: Icon, label, onClick, danger, disabled }, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={disabled}
              onClick={(e) => { e.stopPropagation(); if (disabled) return; close(); onClick?.(e); }}
              className={`
                w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors
                ${disabled
                  ? 'text-white/20 cursor-not-allowed'
                  : danger
                    ? 'text-red-400/90 hover:bg-red-500/10 hover:text-red-400'
                    : 'text-white/65 hover:bg-white/[0.06] hover:text-white/95'}
              `}
            >
              {Icon && <Icon size={14} className="flex-shrink-0" />}
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

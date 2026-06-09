import React from 'react';

const POSITIONS = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  right:  'left-full top-1/2 -translate-y-1/2 ml-2',
};

/**
 * Tooltip — burbuja de ayuda accesible y legible (reemplaza el `title=""` nativo).
 * Envuelve cualquier elemento y lo muestra al pasar el cursor o al enfocarlo por teclado.
 */
export default function Tooltip({ label, position = 'top', children, className = '' }) {
  if (!label) return children;
  return (
    <span className={`relative inline-flex group/tooltip ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`
          pointer-events-none absolute z-[60] whitespace-nowrap
          px-2 py-1 rounded-lg text-[11px] font-medium text-white/90
          border border-white/[0.08] shadow-card
          opacity-0 scale-95 -translate-y-0.5
          group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 group-hover/tooltip:translate-y-0
          group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:scale-100 group-focus-within/tooltip:translate-y-0
          transition-all duration-100 delay-150
          ${POSITIONS[position] || POSITIONS.top}
        `}
        style={{ background: 'rgba(20,20,28,0.97)' }}
      >
        {label}
      </span>
    </span>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

// Símbolos solo para mostrar — el valor guardado conserva el nombre de tecla que espera acceleratorMatches()
const DISPLAY_LABELS = {
  ' ': 'Space',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Control: 'Ctrl',
  Meta: 'Cmd',
};

function displayLabel(part) {
  return DISPLAY_LABELS[part] || part;
}

function keyForAccelerator(key) {
  if (key.length === 1) return key.toUpperCase();
  return key === ' ' ? 'Space' : key;
}

function acceleratorFromEvent(e) {
  const parts = [];
  if (e.ctrlKey)  parts.push('Ctrl');
  if (e.altKey)   parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey)  parts.push('Meta');
  if (!MODIFIER_KEYS.has(e.key)) parts.push(keyForAccelerator(e.key));
  return parts;
}

/** Captura combinaciones de teclas y las muestra como "chips" — formato accelerator de Electron */
export default function ShortcutInput({ value, onChange, placeholder = 'Sin asignar' }) {
  const [recording, setRecording] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!recording) return;
    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setRecording(false); return; }
      const parts = acceleratorFromEvent(e);
      if (MODIFIER_KEYS.has(e.key)) return; // esperar tecla no-modificadora
      onChange(parts.join('+'));
      setRecording(false);
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [recording, onChange]);

  const segments = (value || '').split('+').filter(Boolean);

  return (
    <div className="flex items-center gap-1.5">
      <button
        ref={ref}
        type="button"
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        className={`
          flex-1 flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left
          border ${recording
            ? 'border-violet-500/50 bg-violet-600/10 text-violet-300'
            : 'border-line/[0.08] bg-overlay/[0.03] text-fg/60 hover:border-line/[0.16]'}
        `}
      >
        <Keyboard size={12} className="flex-shrink-0 opacity-50" />
        {recording ? (
          <span className="animate-pulse">Pulsa una combinación…</span>
        ) : segments.length > 0 ? (
          segments.map((seg, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-fg/20">+</span>}
              <kbd className="px-1.5 py-0.5 rounded bg-overlay/[0.06] border border-line/[0.08] text-[11px]">{displayLabel(seg)}</kbd>
            </React.Fragment>
          ))
        ) : (
          <span className="text-fg/25">{placeholder}</span>
        )}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          title="Quitar atajo"
          className="p-1.5 rounded-lg text-fg/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Command } from 'lucide-react';
import AppIcon  from './common/AppIcon';
import { useApps } from '../contexts/AppContext';

export default function QuickLauncher({ onClose }) {
  const { apps, launchApp, badgeCounts } = useApps();
  const [query,   setQuery]   = useState('');
  const [cursor,  setCursor]  = useState(0);
  const inputRef  = useRef(null);
  const listRef   = useRef(null);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return apps.slice(0, 8);
    const q = query.toLowerCase();
    return apps.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.url.toLowerCase().includes(q)  ||
      a.accountLabel?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [apps, query]);

  // Reset cursor cuando cambia la lista
  useEffect(() => { setCursor(0); }, [filtered]);

  // Autofocus
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Scroll activo al cursor
  useEffect(() => {
    const el = listRef.current?.children[cursor];
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const handleLaunch = useCallback((app) => {
    launchApp(app.id);
    onClose();
  }, [launchApp, onClose]);

  const handleKey = (e) => {
    if (e.key === 'Escape')    { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); return; }
    if (e.key === 'Enter' && filtered[cursor]) { handleLaunch(filtered[cursor]); return; }
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl border border-white/[0.08]"
        style={{ background: '#111118' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          <Search size={16} className="text-white/30 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Buscar app y lanzar…"
            className="flex-1 bg-transparent text-white placeholder-white/25 text-sm outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-white/25 hover:text-white/60 transition-colors">
              <X size={14} />
            </button>
          )}
          <kbd className="text-[10px] text-white/20 border border-white/10 rounded px-1.5 py-0.5 font-mono">ESC</kbd>
        </div>

        {/* Lista */}
        <div ref={listRef} className="max-h-72 overflow-y-auto scrollbar-thin py-1.5">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-white/25">
              Sin resultados para "{query}"
            </div>
          ) : (
            filtered.map((app, i) => {
              const badge = badgeCounts?.[app.id] || 0;
              return (
                <button
                  key={app.id}
                  onClick={() => handleLaunch(app)}
                  onMouseEnter={() => setCursor(i)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                    ${i === cursor ? 'bg-violet-600/15' : 'hover:bg-white/[0.03]'}
                  `}
                >
                  <div className="relative flex-shrink-0">
                    <AppIcon
                      iconType={app.iconType}
                      iconValue={app.iconValue}
                      iconColor={app.iconColor}
                      name={app.name}
                      url={app.url}
                      size={34}
                    />
                    {badge > 0 && (
                      <div className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-bold text-white border border-[#111118]">
                        {badge > 9 ? '9+' : badge}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/85 truncate">{app.name}</span>
                      {app.accountLabel && (
                        <span className="text-[9px] text-violet-400/80 bg-violet-500/10 px-1.5 py-0.5 rounded-full border border-violet-500/20 flex-shrink-0">
                          {app.accountLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/30 truncate">{app.url}</p>
                  </div>
                  {i === cursor && (
                    <kbd className="text-[10px] text-white/30 border border-white/10 rounded px-1.5 py-0.5 font-mono flex-shrink-0">↵</kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/[0.05] flex items-center gap-4 text-[10px] text-white/20">
          <span className="flex items-center gap-1"><kbd className="border border-white/10 rounded px-1 font-mono">↑↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="border border-white/10 rounded px-1 font-mono">↵</kbd> abrir</span>
          <span className="flex items-center gap-1"><kbd className="border border-white/10 rounded px-1 font-mono">ESC</kbd> cerrar</span>
          <span className="ml-auto flex items-center gap-1">
            <Command size={9} /> Alt+Space
          </span>
        </div>
      </div>
    </div>
  );
}

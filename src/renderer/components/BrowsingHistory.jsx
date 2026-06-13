import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, History, Search, Trash2, ExternalLink, Globe } from 'lucide-react';
import { formatRelativeTime } from '../lib/utils';
import EmptyState from './common/EmptyState';
import { useApps } from '../contexts/AppContext';

function faviconFor(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; }
  catch { return null; }
}

export default function BrowsingHistory({ onClose }) {
  const { apps, launchApp } = useApps();
  const [items, setItems]   = useState([]);
  const [query, setQuery]   = useState('');
  const [appFilter, setAppFilter] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await window.electronAPI?.listHistory?.({ appId: appFilter, query }) ?? [];
    setItems(list);
    setLoading(false);
  }, [appFilter, query]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const appsWithHistory = useMemo(() => {
    const ids = new Set(items.map(i => i.appId));
    return apps.filter(a => ids.has(a.id) || a.id === appFilter);
  }, [items, apps, appFilter]);

  const handleOpen = (item) => {
    launchApp(item.appId, { navigateTo: item.url });
    onClose();
  };

  const handleRemove = async (id) => {
    await window.electronAPI?.removeHistoryEntry?.(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleClear = async () => {
    await window.electronAPI?.clearHistory?.(appFilter);
    await load();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-line/[0.08] flex flex-col"
        style={{ background: '#111118', maxHeight: '82vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-line/[0.06]">
          <div className="flex items-center gap-2.5">
            <History size={16} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-fg/85">Historial</h2>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleClear} className="text-[11px] text-fg/35 hover:text-fg/70 transition-colors px-2 py-1 rounded-lg hover:bg-overlay/[0.05]">
              Borrar {appFilter ? 'de esta app' : 'todo'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-fg/30 hover:text-fg/70 hover:bg-overlay/[0.06] transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="px-4 py-2.5 border-b border-line/[0.06] flex items-center gap-2">
          <Search size={14} className="text-fg/25 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar en el historial…"
            className="flex-1 bg-transparent text-sm text-fg placeholder-fg/25 outline-none"
          />
        </div>

        {appsWithHistory.length > 0 && (
          <div className="px-3 py-2 border-b border-line/[0.06] flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setAppFilter(null)}
              className={`flex-shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${!appFilter ? 'bg-violet-600/25 text-violet-300' : 'bg-overlay/[0.04] text-fg/40 hover:text-fg/60'}`}
            >
              Todas
            </button>
            {appsWithHistory.map(a => (
              <button
                key={a.id}
                onClick={() => setAppFilter(a.id)}
                className={`flex-shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors truncate max-w-[120px] ${appFilter === a.id ? 'bg-violet-600/25 text-violet-300' : 'bg-overlay/[0.04] text-fg/40 hover:text-fg/60'}`}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-line/[0.04]">
          {loading ? (
            <EmptyState loading title="Cargando…" />
          ) : items.length === 0 ? (
            <EmptyState
              icon={History}
              title={query ? 'Sin resultados' : 'Sin historial todavía'}
            />
          ) : (
            items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-overlay/[0.03] transition-colors group">
                <div className="w-7 h-7 rounded-lg bg-overlay/[0.04] border border-line/[0.06] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {faviconFor(item.url)
                    ? <img src={faviconFor(item.url)} alt="" className="w-4 h-4" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    : <Globe size={13} className="text-fg/30" />}
                </div>
                <button onClick={() => handleOpen(item)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm text-fg/80 truncate" title={item.title}>{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-fg/30 truncate">{item.appName}</span>
                    <span className="text-[11px] text-fg/20">·</span>
                    <span className="text-[11px] text-fg/25 truncate">{formatRelativeTime(item.ts)}</span>
                  </div>
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => handleOpen(item)} title="Abrir" className="p-2 rounded-lg text-fg/30 hover:text-fg/70 hover:bg-overlay/[0.06] transition-colors">
                    <ExternalLink size={13} />
                  </button>
                  <button onClick={() => handleRemove(item.id)} title="Quitar" className="p-2 rounded-lg text-fg/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

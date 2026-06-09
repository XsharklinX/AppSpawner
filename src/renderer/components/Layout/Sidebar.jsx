import React from 'react';
import {
  LayoutGrid, Compass, Plus, Settings, Download, History,
  Box, Briefcase, Users, Tv, Code2, Sparkles, Globe, Rocket,
} from 'lucide-react';
import { useApps }       from '../../contexts/AppContext';
import { useI18n }       from '../../contexts/I18nContext';
import { useWorkspaces } from '../../contexts/WorkspaceContext';
import { countByCategory } from '../../lib/utils';
import { CATEGORIES }    from '../../lib/constants';

const CATEGORY_ICONS = {
  all:            Globe,
  trabajo:        Briefcase,
  social:         Users,
  entretenimiento:Tv,
  desarrollo:     Code2,
  ia:             Sparkles,
  general:        Box,
};

const NAV_ITEMS = [
  { id: 'dashboard', icon: LayoutGrid, key: 'nav_myApps'  },
  { id: 'discover',  icon: Compass,    key: 'nav_discover' },
  { id: 'create',    icon: Plus,       key: 'nav_create'   },
  { id: 'profiles',  icon: Rocket,     key: 'nav_profiles' },
  { id: 'settings',  icon: Settings,   key: 'nav_settings' },
];

export default function Sidebar({
  currentView,
  onNavigate,
  selectedCategory,
  onCategoryChange,
  selectedWorkspace,
  onSelectWorkspace,
  onOpenDownloads,
  onOpenHistory,
}) {
  const { apps }       = useApps();
  const { workspaces } = useWorkspaces();
  const { t }          = useI18n();
  const counts         = countByCategory(apps);
  const totalCount     = apps.length;
  const [activeDownloads, setActiveDownloads] = React.useState(0);

  React.useEffect(() => {
    const refresh = (list) => setActiveDownloads(list.filter(d => d.state === 'progressing').length);
    window.electronAPI?.listDownloads?.().then(refresh);
    const u1 = window.electronAPI?.onDownloadStarted?.(() => window.electronAPI?.listDownloads?.().then(refresh));
    const u2 = window.electronAPI?.onDownloadDone?.(() => window.electronAPI?.listDownloads?.().then(refresh));
    return () => { u1?.(); u2?.(); };
  }, []);

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col h-full bg-surface-card border-r border-line/[0.05] overflow-hidden">

      {/* ── Navegación principal ──────────────────────────────────────────── */}
      <nav className="flex flex-col gap-0.5 p-3 pt-4">
        {NAV_ITEMS.map(item => {
          const Icon   = item.icon;
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`
                group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150 text-left w-full
                ${active
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/25'
                  : 'text-fg/50 hover:text-fg/80 hover:bg-overlay/[0.04]'
                }
              `}
            >
              <Icon size={16} className={active ? 'text-violet-400' : 'text-fg/30 group-hover:text-fg/60'} />
              <span>{t(item.key)}</span>
              {item.id === 'dashboard' && totalCount > 0 && (
                <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${active ? 'bg-violet-500/30 text-violet-300' : 'bg-overlay/[0.06] text-fg/40'}`}>
                  {totalCount}
                </span>
              )}
              {item.id === 'create' && (
                <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-violet-500/30 text-violet-300' : 'bg-violet-600/20 text-violet-400'}`}>
                  NEW
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3">
        <button
          onClick={onOpenDownloads}
          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left w-full text-fg/50 hover:text-fg/80 hover:bg-overlay/[0.04]"
        >
          <Download size={16} className="text-fg/30 group-hover:text-fg/60" />
          <span>Descargas</span>
          {activeDownloads > 0 && (
            <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/30 text-violet-300 animate-pulse">
              {activeDownloads}
            </span>
          )}
        </button>
        <button
          onClick={onOpenHistory}
          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left w-full text-fg/50 hover:text-fg/80 hover:bg-overlay/[0.04]"
        >
          <History size={16} className="text-fg/30 group-hover:text-fg/60" />
          <span>Historial</span>
        </button>
      </div>

      <div className="mx-3 my-1 divider" />

      {/* ── Filtros de categorías (solo en dashboard) ─────────────────────── */}
      {currentView === 'dashboard' && (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-3">
          <p className="text-[10px] font-semibold text-fg/25 uppercase tracking-widest px-2 py-2">
            {t('nav_filters')}
          </p>

          <div className="flex flex-col gap-0.5">
            {CATEGORIES.map(cat => {
              const Icon   = CATEGORY_ICONS[cat.id] || Globe;
              const active = selectedCategory === cat.id;
              const count  = cat.id === 'all' ? totalCount : (counts[cat.id] || 0);
              if (cat.id !== 'all' && count === 0) return null;
              return (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(cat.id)}
                  className={`
                    flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium
                    transition-all duration-100 text-left w-full
                    ${active ? 'bg-overlay/[0.07] text-fg' : 'text-fg/40 hover:text-fg/65 hover:bg-overlay/[0.03]'}
                  `}
                >
                  <Icon size={13} className={active ? 'text-fg/70' : 'text-fg/20'} />
                  <span className="flex-1">{t(`cat_${cat.id === 'entretenimiento' ? 'entertain' : cat.id === 'desarrollo' ? 'dev' : cat.id}`)}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${active ? 'bg-overlay/10 text-fg/60' : 'bg-overlay/[0.04] text-fg/25'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Workspaces ───────────────────────────────────────────────── */}
          {workspaces.length > 0 && (
            <>
              <div className="mx-0 my-2 divider" />
              <p className="text-[10px] font-semibold text-fg/25 uppercase tracking-widest px-2 py-1">
                Workspaces
              </p>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => onSelectWorkspace?.(null)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    !selectedWorkspace ? 'bg-overlay/[0.07] text-fg' : 'text-fg/40 hover:text-fg/65 hover:bg-overlay/[0.03]'
                  }`}
                >
                  <Globe size={13} className={!selectedWorkspace ? 'text-fg/70' : 'text-fg/20'} />
                  <span className="flex-1">Todos</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${!selectedWorkspace ? 'bg-overlay/10 text-fg/60' : 'bg-overlay/[0.04] text-fg/25'}`}>
                    {totalCount}
                  </span>
                </button>
                {workspaces.map(ws => {
                  const count  = apps.filter(a => a.workspaceId === ws.id).length;
                  const active = selectedWorkspace === ws.id;
                  return (
                    <button
                      key={ws.id}
                      onClick={() => onSelectWorkspace?.(active ? null : ws.id)}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        active ? 'bg-overlay/[0.06] text-fg/90' : 'text-fg/40 hover:text-fg/65 hover:bg-overlay/[0.03]'
                      }`}
                      style={active ? { color: ws.color } : {}}
                    >
                      <span className="text-sm w-[13px] text-center">{ws.emoji}</span>
                      <span className="flex-1 truncate">{ws.name}</span>
                      {count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-overlay/[0.04] text-fg/25 font-semibold">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {currentView !== 'dashboard' && <div className="flex-1" />}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-line/[0.04]">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-7 h-7 rounded-lg bg-accent-gradient flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
            AS
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-fg/70 truncate">AppSpawner</p>
            <p className="text-[10px] text-fg/30">v2.5 Premium</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

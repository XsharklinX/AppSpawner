import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search, Plus, Compass, Loader2, Clock, FolderOpen, Trash2, UserRound, BriefcaseBusiness, Layers3, TrendingUp,
  Star, AlertTriangle, LayoutGrid, Grid2x2, Rows3, CheckSquare, Square, X, Wrench, Image as ImageIcon, Eraser, Download,
} from 'lucide-react';
import AppCard   from '../components/common/AppCard';
import AppIcon   from '../components/common/AppIcon';
import Modal     from '../components/common/Modal';
import CreateApp  from './CreateApp';
import { useApps }        from '../contexts/AppContext';
import { useI18n }        from '../contexts/I18nContext';
import { useWorkspaces }  from '../contexts/WorkspaceContext';
import { useToast }       from '../contexts/ToastContext';
import { filterApps }     from '../lib/utils';

const DENSITY_OPTIONS = [
  { id: 'comfortable', label: 'Cómodo',   icon: LayoutGrid },
  { id: 'compact',     label: 'Compacto', icon: Grid2x2 },
  { id: 'list',        label: 'Lista',    icon: Rows3 },
];

const QUICK_FILTERS = [
  { id: 'favorites', label: 'Favoritos',       icon: Star },
  { id: 'mostUsed',  label: 'Más usadas',      icon: TrendingUp },
  { id: 'unused',    label: 'Sin abrir 7d+',   icon: Clock },
  { id: 'problems',  label: 'Con problemas',   icon: AlertTriangle },
];

export default function Dashboard({ selectedCategory, selectedWorkspace, onSelectWorkspace, onNavigate, onOpenTools }) {
  const { apps, recentApps, loading, openWindows, problemAppIds } = useApps();
  const { workspaces }                             = useWorkspaces();
  const { t }                          = useI18n();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [profileFilter, setProfileFilter] = useState('all');
  const [editingApp,  setEditingApp]  = useState(null);
  const [showWSModal, setShowWSModal] = useState(false);
  const [density, setDensity] = useState(() => localStorage.getItem('as_density') || 'comfortable');
  const [quickFilter, setQuickFilter] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => { localStorage.setItem('as_density', density); }, [density]);

  const handleEdit = useCallback((app) => setEditingApp(app), []);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Filtrar por categoría, workspace, perfil, filtro rápido y búsqueda
  const filteredApps = useMemo(() => {
    let result = apps;
    if (selectedCategory && selectedCategory !== 'all') {
      result = result.filter(a => a.category === selectedCategory);
    }
    if (selectedWorkspace) {
      result = result.filter(a => a.workspaceId === selectedWorkspace);
    }
    if (profileFilter !== 'all') {
      result = result.filter(a => (a.security?.profile || 'personal') === profileFilter);
    }
    if (quickFilter === 'favorites') {
      result = result.filter(a => a.favorite);
    } else if (quickFilter === 'mostUsed') {
      result = [...result].filter(a => (a.openCount || 0) > 0).sort((a, b) => (b.openCount || 0) - (a.openCount || 0)).slice(0, 16);
    } else if (quickFilter === 'unused') {
      result = result.filter(a => (!a.lastUsed || a.lastUsed < sevenDaysAgo) && !openWindows?.has(a.id));
    } else if (quickFilter === 'problems') {
      result = result.filter(a => problemAppIds?.has(a.id));
    }
    return filterApps(result, searchQuery);
  }, [apps, selectedCategory, selectedWorkspace, profileFilter, quickFilter, searchQuery, openWindows, problemAppIds, sevenDaysAgo]);

  const showRecent = !searchQuery && selectedCategory === 'all' && !quickFilter && recentApps.length > 0;
  const isEmpty    = apps.length === 0 && !loading;

  const mostUsed = useMemo(() =>
    apps.length ? [...apps].sort((a, b) => (b.openCount || 0) - (a.openCount || 0))[0] : null,
    [apps]);

  const inactiveApps = useMemo(() =>
    apps.filter(a => a.lastUsed && a.lastUsed < sevenDaysAgo && !openWindows?.has(a.id)).slice(0, 3),
    [apps, openWindows]);

  const openCount = openWindows?.size || 0;
  const profileCounts = useMemo(() => ({
    all: apps.length,
    personal: apps.filter(a => (a.security?.profile || 'personal') === 'personal').length,
    work: apps.filter(a => (a.security?.profile || 'personal') === 'work').length,
  }), [apps]);

  const quickFilterCounts = useMemo(() => ({
    favorites: apps.filter(a => a.favorite).length,
    mostUsed:  apps.filter(a => (a.openCount || 0) > 0).length,
    unused:    apps.filter(a => (!a.lastUsed || a.lastUsed < sevenDaysAgo) && !openWindows?.has(a.id)).length,
    problems:  apps.filter(a => problemAppIds?.has(a.id)).length,
  }), [apps, openWindows, problemAppIds, sevenDaysAgo]);

  // ── Selección múltiple / acciones masivas ────────────────────────────────
  const toggleSelect = useCallback((appId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId); else next.add(appId);
      return next;
    });
  }, []);

  const selectAll  = () => setSelectedIds(new Set(filteredApps.map(a => a.id)));
  const selectNone = () => setSelectedIds(new Set());

  const exitSelectionMode = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const withBulkBusy = async (fn) => {
    setBulkBusy(true);
    try { await fn(); } finally { setBulkBusy(false); }
  };

  const handleBulkRepairShortcuts = () => withBulkBusy(async () => {
    for (const id of selectedIds) await window.electronAPI?.createShortcuts(id);
    toast.success('Accesos directos reparados', `${selectedIds.size} apps`);
  });

  const handleBulkRefreshIcons = () => withBulkBusy(async () => {
    await window.electronAPI?.refreshAppIcons?.([...selectedIds]);
    for (const id of selectedIds) await window.electronAPI?.createShortcuts(id);
    toast.success('Iconos actualizados', `${selectedIds.size} apps`);
  });

  const handleBulkClearCache = () => withBulkBusy(async () => {
    for (const id of selectedIds) await window.electronAPI?.clearAppData(id);
    toast.success('Cache limpiada', `${selectedIds.size} apps`);
  });

  const handleBulkExport = () => {
    const selectedApps = apps.filter(a => selectedIds.has(a.id));
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), apps: selectedApps }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `appspawner-grupo-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Grupo exportado', `${selectedApps.length} apps`);
  };

  const gridClass = density === 'list'
    ? 'flex flex-col gap-1.5 animate-fade-in'
    : density === 'compact'
      ? 'grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2 animate-fade-in'
      : 'grid grid-cols-[repeat(auto-fill,minmax(240px,280px))] justify-start gap-3 animate-fade-in';

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-7 pt-6 pb-3">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h1 className="text-xl font-bold text-fg">{t('dash_title')}</h1>
            <p className="text-sm text-fg/35 mt-0.5">
              {t('dash_subtitle')}
              {apps.length > 0 && (
                <span className="ml-2 text-fg/45 font-medium">— {apps.length} apps</span>
              )}
            </p>
          </div>

          {/* Búsqueda */}
          {apps.length > 0 && (
            <div className="relative w-64 flex-shrink-0">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg/25 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('dash_search')}
                className="input-field pl-9 py-2 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg/25 hover:text-fg/60 text-xs"
                >x</button>
              )}
            </div>
          )}
        </div>

        {/* ── Workspace tabs ──────────────────────────────────────────────── */}
        {workspaces.length > 0 && (
          <WorkspaceBar
            workspaces={workspaces}
            selected={selectedWorkspace}
            onSelect={onSelectWorkspace}
            onManage={() => setShowWSModal(true)}
          />
        )}
        {workspaces.length === 0 && apps.length > 0 && (
          <button
            onClick={() => setShowWSModal(true)}
            className="text-[11px] text-fg/20 hover:text-violet-400 transition-colors flex items-center gap-1.5 mb-1"
          >
            <FolderOpen size={11} /> Crear workspace
          </button>
        )}

        {apps.length > 0 && (
          <div className="flex items-center justify-between gap-3 mt-3">
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'all', label: 'Todas', icon: Layers3, count: profileCounts.all },
                { id: 'personal', label: 'Personal', icon: UserRound, count: profileCounts.personal },
                { id: 'work', label: 'Trabajo', icon: BriefcaseBusiness, count: profileCounts.work },
              ].map(({ id, label, icon: Icon, count }) => (
                <button
                  key={id}
                  onClick={() => setProfileFilter(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${
                    profileFilter === id
                      ? 'bg-violet-600/20 border-violet-500/35 text-violet-300'
                      : 'bg-overlay/[0.035] border-line/[0.06] text-fg/35 hover:text-fg/60'
                  }`}
                >
                  <Icon size={12} /> {label}
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                    profileFilter === id ? 'bg-violet-400/15 text-violet-100/70' : 'bg-overlay/[0.04] text-fg/28'
                  }`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Selección múltiple */}
              <button
                onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                title="Selección múltiple"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border transition-all ${
                  selectionMode
                    ? 'bg-violet-600/20 border-violet-500/35 text-violet-300'
                    : 'bg-overlay/[0.035] border-line/[0.06] text-fg/35 hover:text-fg/60'
                }`}
              >
                {selectionMode ? <X size={12} /> : <CheckSquare size={12} />}
              </button>

              {/* Densidad */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-overlay/[0.035] border border-line/[0.06]">
                {DENSITY_OPTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setDensity(id)}
                    title={label}
                    className={`flex items-center justify-center w-7 h-7 rounded-full transition-all ${
                      density === id ? 'bg-violet-600/25 text-violet-300' : 'text-fg/30 hover:text-fg/60'
                    }`}
                  >
                    <Icon size={13} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Filtros rápidos ─────────────────────────────────────────────── */}
        {apps.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {QUICK_FILTERS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setQuickFilter(prev => prev === id ? null : id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                  quickFilter === id
                    ? 'bg-violet-600/20 border-violet-500/35 text-violet-300'
                    : 'bg-overlay/[0.025] border-line/[0.05] text-fg/30 hover:text-fg/55'
                }`}
              >
                <Icon size={11} /> {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                  quickFilter === id ? 'bg-violet-400/15 text-violet-100/70' : 'bg-overlay/[0.04] text-fg/25'
                }`}>
                  {quickFilterCounts[id]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Contenido ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-7 pb-6">

        {/* ── Hub stats bar ──────────────────────────────────────────── */}
        {!loading && apps.length > 0 && !searchQuery && (
          <div className="flex items-center gap-4 mb-4 text-[11px] text-fg/28 select-none">
            {openCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 animate-pulse inline-block" />
                {openCount} {openCount === 1 ? 'abierta ahora' : 'abiertas ahora'}
              </span>
            )}
            {mostUsed && mostUsed.openCount > 0 && (
              <span className="flex items-center gap-1.5 text-fg/22">
                más usada: <span className="text-fg/42 font-medium">{mostUsed.name}</span>
                <span className="text-fg/32">({mostUsed.openCount}×)</span>
              </span>
            )}
          </div>
        )}

        {/* ── Barra de acciones masivas ────────────────────────────────── */}
        {selectionMode && !loading && !isEmpty && (
          <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2 rounded-xl bg-violet-600/[0.08] border border-violet-500/20 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-fg/55">
              <span className="font-semibold text-violet-300">{selectedIds.size}</span> seleccionadas
              <button onClick={selectAll} className="text-fg/35 hover:text-fg/70 underline-offset-2 hover:underline">Todas</button>
              <button onClick={selectNone} className="text-fg/35 hover:text-fg/70 underline-offset-2 hover:underline">Ninguna</button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleBulkRepairShortcuts}
                disabled={selectedIds.size === 0 || bulkBusy}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-overlay/[0.05] text-fg/55 hover:text-fg/85 hover:bg-overlay/[0.09] transition-all disabled:opacity-40"
              >
                <Wrench size={12} /> Reparar accesos
              </button>
              <button
                onClick={handleBulkRefreshIcons}
                disabled={selectedIds.size === 0 || bulkBusy}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-overlay/[0.05] text-fg/55 hover:text-fg/85 hover:bg-overlay/[0.09] transition-all disabled:opacity-40"
              >
                <ImageIcon size={12} /> Actualizar iconos
              </button>
              <button
                onClick={handleBulkClearCache}
                disabled={selectedIds.size === 0 || bulkBusy}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-overlay/[0.05] text-fg/55 hover:text-fg/85 hover:bg-overlay/[0.09] transition-all disabled:opacity-40"
              >
                <Eraser size={12} /> Limpiar cache
              </button>
              <button
                onClick={handleBulkExport}
                disabled={selectedIds.size === 0 || bulkBusy}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-overlay/[0.05] text-fg/55 hover:text-fg/85 hover:bg-overlay/[0.09] transition-all disabled:opacity-40"
              >
                <Download size={12} /> Exportar grupo
              </button>
              {bulkBusy && <Loader2 size={13} className="text-violet-400 animate-spin" />}
            </div>
          </div>
        )}

        {/* Cargando */}
        {loading && (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={28} className="text-violet-500 animate-spin" />
          </div>
        )}

        {/* Estado vacío */}
        {isEmpty && !loading && (
          <EmptyState
            onExplore={() => onNavigate('discover')}
            onCreate={() => onNavigate('create')}
            t={t}
          />
        )}

        {/* Sin resultados de búsqueda */}
        {!isEmpty && !loading && filteredApps.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Search size={28} className="text-fg/12" />
            <p className="text-sm text-fg/35">
              {t('dash_no_results')} "<span className="text-fg/60">{searchQuery}</span>"
            </p>
          </div>
        )}

        {!loading && !isEmpty && filteredApps.length > 0 && (
          <>
            {/* ── Sección Recientes (solo cuando no hay filtro activo) ────── */}
            {showRecent && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={13} className="text-fg/30" />
                  <h2 className="text-xs font-semibold text-fg/35 uppercase tracking-wider">
                    Abiertas recientemente
                  </h2>
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {recentApps.map(app => (
                    <RecentChip key={app.id} app={app} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Recomendaciones: apps sin usar en 7+ días ─────────────── */}
            {showRecent && inactiveApps.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-2.5">
                  <TrendingUp size={12} className="text-amber-400/50" />
                  <h2 className="text-[11px] font-semibold text-fg/30 uppercase tracking-wider">Sin abrir en 7 días</h2>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {inactiveApps.map(app => (
                    <RecentChip key={app.id} app={app} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Grid principal ─────────────────────────────────────────── */}
            <div className={gridClass}>
              {filteredApps.map((app, i) => (
                <div
                  key={app.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${Math.min(i * 25, 300)}ms`, animationFillMode: 'both' }}
                >
                  <AppCard
                    app={app}
                    onEdit={handleEdit}
                    onOpenTools={onOpenTools}
                    density={density}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(app.id)}
                    onToggleSelect={toggleSelect}
                    hasProblem={problemAppIds?.has(app.id)}
                  />
                </div>
              ))}

              {/* Botón sutil de añadir app (solo texto, no toma espacio de grid) */}
            </div>
          </>
        )}
      </div>

      {/* ── Modal de edición ─────────────────────────────────────────────── */}
      <Modal
        isOpen={!!editingApp}
        onClose={() => setEditingApp(null)}
        title={t('edit_title')}
        size="2xl"
      >
        {editingApp && (
          <CreateApp
            editMode
            initialData={editingApp}
            onNavigate={() => setEditingApp(null)}
            onSaved={() => setEditingApp(null)}
            embedded
          />
        )}
      </Modal>

      {/* ── Modal de gestión de workspaces ───────────────────────────────── */}
      <Modal
        isOpen={showWSModal}
        onClose={() => setShowWSModal(false)}
        title="Workspaces"
        size="lg"
      >
        <WorkspaceManager onClose={() => setShowWSModal(false)} />
      </Modal>
    </div>
  );
}

// ── WorkspaceBar ─────────────────────────────────────────────────────────────

function WorkspaceBar({ workspaces, selected, onSelect, onManage }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-2">
      <button
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
          !selected
            ? 'bg-overlay/[0.08] text-fg/80'
            : 'text-fg/35 hover:text-fg/60 hover:bg-overlay/[0.03]'
        }`}
      >
        Todas
      </button>
      {workspaces.map(ws => (
        <button
          key={ws.id}
          onClick={() => onSelect(selected === ws.id ? null : ws.id)}
          className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
            selected === ws.id
              ? 'text-fg/90 border'
              : 'text-fg/35 hover:text-fg/65 hover:bg-overlay/[0.03] border border-transparent'
          }`}
          style={selected === ws.id ? { background: `${ws.color}22`, borderColor: `${ws.color}55`, color: ws.color } : {}}
        >
          <span>{ws.emoji}</span>
          {ws.name}
        </button>
      ))}
      <button
        onClick={onManage}
        className="flex-shrink-0 text-xs text-fg/20 hover:text-violet-400 px-2 py-1.5 transition-colors"
        title="Gestionar workspaces"
      >
        ⚙
      </button>
    </div>
  );
}

// ── WorkspaceManager (modal) ──────────────────────────────────────────────────

const WS_COLORS  = ['#7c3aed','#2563eb','#059669','#dc2626','#d97706','#db2777','#0891b2','#ea580c'];
const WS_EMOJIS  = ['📁','💼','🏠','🎮','🚀','📚','🎨','⚡','🌍','🔧','💡','🎯'];

function WorkspaceManager({ onClose }) {
  const { workspaces, createWorkspace, deleteWorkspace } = useWorkspaces();
  const { apps } = useApps();
  const [name,  setName]  = useState('');
  const [color, setColor] = useState('#7c3aed');
  const [emoji, setEmoji] = useState('📁');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await createWorkspace({ name: name.trim(), color, emoji });
    setName(''); setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Lista de workspaces existentes */}
      {workspaces.length > 0 && (
        <div className="flex flex-col gap-2">
          {workspaces.map(ws => {
            const count = apps.filter(a => a.workspaceId === ws.id).length;
            return (
              <div key={ws.id} className="flex items-center gap-3 glass rounded-xl px-3 py-2.5">
                <span className="text-lg flex-shrink-0">{ws.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fg/80">{ws.name}</p>
                  <p className="text-[11px] text-fg/30">{count} apps</p>
                </div>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ws.color }} />
                <button
                  onClick={() => deleteWorkspace(ws.id)}
                  className="text-fg/20 hover:text-red-400 transition-colors p-1"
                  title="Eliminar workspace"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Crear nuevo workspace */}
      <div className="border-t border-line/[0.06] pt-4">
        <p className="text-xs font-semibold text-fg/35 uppercase tracking-wider mb-3">Nuevo workspace</p>
        <div className="flex flex-col gap-3">
          {/* Emoji picker */}
          <div className="flex gap-1.5 flex-wrap">
            {WS_EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`text-lg w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  emoji === e ? 'bg-overlay/[0.12] ring-1 ring-fg/30' : 'hover:bg-overlay/[0.06]'
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Nombre */}
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Nombre del workspace..."
            className="input-field"
            maxLength={50}
            autoFocus
          />

          {/* Color picker */}
          <div className="flex gap-2">
            {WS_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-lg transition-all ${
                  color === c ? 'ring-2 ring-fg/70 ring-offset-1 ring-offset-surface-card scale-110' : 'opacity-60 hover:opacity-100'
                }`}
                style={{ background: c }}
              />
            ))}
          </div>

          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="btn-primary text-sm flex items-center justify-center gap-2"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : '+ Crear workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Chip de app reciente ──────────────────────────────────────────────────────

const RecentChip = React.memo(function RecentChip({ app }) {
  const { launchApp } = useApps();
  return (
    <button
      onClick={() => launchApp(app.id)}
      className="
        flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0
        glass glass-hover transition-all duration-150 active:scale-95
        group
      "
    >
      <AppIcon
        iconType={app.iconType}
        iconValue={app.iconValue}
        iconColor={app.iconColor}
        name={app.name}
        url={app.url}
        size={22}
      />
      <span className="text-xs font-medium text-fg/65 group-hover:text-fg/90 transition-colors whitespace-nowrap">
        {app.name}
      </span>
    </button>
  );
});

// ── Tarjeta de añadir ─────────────────────────────────────────────────────────

function AddCard({ onClick, t }) {
  return (
    <button
      onClick={onClick}
      className="
        glass rounded-2xl p-4 min-h-[160px]
        flex flex-col items-center justify-center gap-2
        border-dashed border-line/[0.06] hover:border-violet-500/30
        text-fg/20 hover:text-violet-400 transition-all duration-200 group
      "
    >
      <div className="w-10 h-10 rounded-xl border-2 border-dashed border-current flex items-center justify-center transition-colors">
        <Plus size={18} />
      </div>
      <span className="text-xs font-medium">{t('dash_create')}</span>
    </button>
  );
}

// ── Estado vacío ──────────────────────────────────────────────────────────────

function EmptyState({ onExplore, onCreate, t }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 animate-fade-in">
      {/* Ilustración */}
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-overlay/[0.03] border border-line/[0.06] flex items-center justify-center">
          <div className="grid grid-cols-2 gap-2 p-3">
            {['#7c3aed','#2563eb','#059669','#d97706'].map(c => (
              <div key={c} className="w-7 h-7 rounded-xl animate-pulse" style={{ background: c, animationDelay: `${Math.random()*500}ms` }} />
            ))}
          </div>
        </div>
        <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center shadow-glow">
          <Plus size={14} className="text-white" />
        </div>
      </div>

      <div className="text-center max-w-xs">
        <h3 className="text-base font-semibold text-fg/80 mb-1.5">{t('dash_empty_title')}</h3>
        <p className="text-sm text-fg/35 leading-relaxed">{t('dash_empty_desc')}</p>
      </div>

      <div className="flex gap-3">
        <button onClick={onExplore} className="btn-primary flex items-center gap-2 text-sm">
          <Compass size={15} />
          {t('dash_explore')}
        </button>
        <button onClick={onCreate} className="btn-ghost flex items-center gap-2 text-sm">
          <Plus size={15} />
          {t('dash_create')}
        </button>
      </div>
    </div>
  );
}

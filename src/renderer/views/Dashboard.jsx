import React, { useState, useMemo, useCallback } from 'react';
import { Search, Plus, Compass, Loader2, Clock, FolderOpen, Trash2 } from 'lucide-react';
import AppCard   from '../components/common/AppCard';
import AppIcon   from '../components/common/AppIcon';
import Modal     from '../components/common/Modal';
import CreateApp  from './CreateApp';
import { useApps }        from '../contexts/AppContext';
import { useI18n }        from '../contexts/I18nContext';
import { useWorkspaces }  from '../contexts/WorkspaceContext';
import { filterApps }     from '../lib/utils';

export default function Dashboard({ selectedCategory, selectedWorkspace, onSelectWorkspace, onNavigate }) {
  const { apps, recentApps, loading } = useApps();
  const { workspaces }                = useWorkspaces();
  const { t }                          = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingApp,  setEditingApp]  = useState(null);
  const [showWSModal, setShowWSModal] = useState(false);

  const handleEdit = useCallback((app) => setEditingApp(app), []);

  // Filtrar por categoría, workspace y búsqueda
  const filteredApps = useMemo(() => {
    let result = apps;
    if (selectedCategory && selectedCategory !== 'all') {
      result = result.filter(a => a.category === selectedCategory);
    }
    if (selectedWorkspace) {
      result = result.filter(a => a.workspaceId === selectedWorkspace);
    }
    return filterApps(result, searchQuery);
  }, [apps, selectedCategory, selectedWorkspace, searchQuery]);

  const showRecent = !searchQuery && selectedCategory === 'all' && recentApps.length > 0;
  const isEmpty    = apps.length === 0 && !loading;

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-7 pt-6 pb-3">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h1 className="text-xl font-bold text-white">{t('dash_title')}</h1>
            <p className="text-sm text-white/35 mt-0.5">
              {t('dash_subtitle')}
              {apps.length > 0 && (
                <span className="ml-2 text-white/45 font-medium">— {apps.length} apps</span>
              )}
            </p>
          </div>

          {/* Búsqueda */}
          {apps.length > 0 && (
            <div className="relative w-60 flex-shrink-0">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
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
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 text-xs"
                >✕</button>
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
            className="text-[11px] text-white/20 hover:text-violet-400 transition-colors flex items-center gap-1.5 mb-1"
          >
            <FolderOpen size={11} /> Crear workspace
          </button>
        )}
      </div>

      {/* ── Contenido ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-7 pb-6">

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
            <Search size={28} className="text-white/12" />
            <p className="text-sm text-white/35">
              {t('dash_no_results')} "<span className="text-white/60">{searchQuery}</span>"
            </p>
          </div>
        )}

        {!loading && !isEmpty && filteredApps.length > 0 && (
          <>
            {/* ── Sección Recientes (solo cuando no hay filtro activo) ────── */}
            {showRecent && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={13} className="text-white/30" />
                  <h2 className="text-xs font-semibold text-white/35 uppercase tracking-wider">
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

            {/* ── Grid principal ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
              {filteredApps.map((app, i) => (
                <div
                  key={app.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${Math.min(i * 25, 300)}ms`, animationFillMode: 'both' }}
                >
                  <AppCard app={app} onEdit={handleEdit} />
                </div>
              ))}

              {/* Tarjeta de añadir app */}
              {!searchQuery && (
                <AddCard onClick={() => onNavigate('create')} t={t} />
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modal de edición ─────────────────────────────────────────────── */}
      <Modal
        isOpen={!!editingApp}
        onClose={() => setEditingApp(null)}
        title={t('edit_title')}
        size="md"
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
        size="sm"
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
            ? 'bg-white/[0.08] text-white/80'
            : 'text-white/35 hover:text-white/60 hover:bg-white/[0.03]'
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
              ? 'text-white/90 border'
              : 'text-white/35 hover:text-white/65 hover:bg-white/[0.03] border border-transparent'
          }`}
          style={selected === ws.id ? { background: `${ws.color}22`, borderColor: `${ws.color}55`, color: ws.color } : {}}
        >
          <span>{ws.emoji}</span>
          {ws.name}
        </button>
      ))}
      <button
        onClick={onManage}
        className="flex-shrink-0 text-xs text-white/20 hover:text-violet-400 px-2 py-1.5 transition-colors"
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
                  <p className="text-sm font-medium text-white/80">{ws.name}</p>
                  <p className="text-[11px] text-white/30">{count} apps</p>
                </div>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ws.color }} />
                <button
                  onClick={() => deleteWorkspace(ws.id)}
                  className="text-white/20 hover:text-red-400 transition-colors p-1"
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
      <div className="border-t border-white/[0.06] pt-4">
        <p className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-3">Nuevo workspace</p>
        <div className="flex flex-col gap-3">
          {/* Emoji picker */}
          <div className="flex gap-1.5 flex-wrap">
            {WS_EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`text-lg w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  emoji === e ? 'bg-white/[0.12] ring-1 ring-white/30' : 'hover:bg-white/[0.06]'
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
            placeholder="Nombre del workspace…"
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
                  color === c ? 'ring-2 ring-white/70 ring-offset-1 ring-offset-surface-card scale-110' : 'opacity-60 hover:opacity-100'
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
      <span className="text-xs font-medium text-white/65 group-hover:text-white/90 transition-colors whitespace-nowrap">
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
        border-dashed border-white/[0.06] hover:border-violet-500/30
        text-white/20 hover:text-violet-400 transition-all duration-200 group
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
        <div className="w-24 h-24 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
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
        <h3 className="text-base font-semibold text-white/80 mb-1.5">{t('dash_empty_title')}</h3>
        <p className="text-sm text-white/35 leading-relaxed">{t('dash_empty_desc')}</p>
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

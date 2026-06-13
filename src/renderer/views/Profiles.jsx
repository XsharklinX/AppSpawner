import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Rocket, Play, Plus, Trash2, CheckSquare, Square, Edit2, Save,
  Layers3, X, Search, UsersRound, Shield, Code2, BriefcaseBusiness, UserRound,
} from 'lucide-react';
import AppIcon           from '../components/common/AppIcon';
import Modal             from '../components/common/Modal';
import { useApps }        from '../contexts/AppContext';
import { useWorkspaces }  from '../contexts/WorkspaceContext';

const PROFILE_COLORS = ['#7c3aed','#2563eb','#059669','#dc2626','#d97706','#db2777','#0891b2','#ea580c'];
const PROFILE_EMOJIS = ['🚀','💼','🏠','🎮','📚','🎨','⚡','🌙','☀️','🎯','🧪','🔒'];

export default function Profiles({ onOpenTools }) {
  const { apps, launchApp } = useApps();
  const { profiles, createProfile, updateProfile, deleteProfile } = useWorkspaces();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [launching, setLaunching] = useState(null);

  const assignedApps = useMemo(() => {
    const ids = new Set(profiles.flatMap(profile => profile.appIds || []));
    return apps.filter(app => ids.has(app.id)).length;
  }, [apps, profiles]);

  const handleLaunchAll = useCallback(async (profile) => {
    const appIds = (profile.appIds || []).filter(id => apps.some(a => a.id === id));
    if (!appIds.length) return;

    setLaunching(profile.id);
    try {
      for (const id of appIds) {
        await launchApp(id);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } finally {
      setLaunching(null);
    }
  }, [apps, launchApp]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-7 pt-6 pb-5">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-600/15 border border-violet-500/25 flex items-center justify-center">
                  <Rocket size={19} className="text-violet-300" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-fg">Perfiles de lanzamiento</h1>
                  <p className="text-sm text-fg/38 mt-0.5">
                    Crea flujos de trabajo que abren varias apps en secuencia.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={14} /> Nuevo perfil
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-3xl">
            <Stat label="Perfiles" value={profiles.length} icon={UsersRound} />
            <Stat label="Apps agrupadas" value={assignedApps} icon={Layers3} />
            <Stat label="Apps disponibles" value={apps.length} icon={Rocket} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-7 pb-6">
        {profiles.length === 0 ? (
          <EmptyState hasApps={apps.length > 0} onCreate={() => setShowCreate(true)} />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-6xl animate-fade-in">
            {profiles.map(profile => {
              const profileApps = (profile.appIds || [])
                .map(id => apps.find(a => a.id === id))
                .filter(Boolean);

              return (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  apps={profileApps}
                  allApps={apps}
                  launching={launching === profile.id}
                  onLaunch={() => handleLaunchAll(profile)}
                  onEdit={() => setEditingId(profile.id)}
                  onDelete={() => deleteProfile(profile.id)}
                  onUpdate={(updates) => updateProfile(profile.id, updates)}
                  onOpenTools={onOpenTools}
                  isEditing={editingId === profile.id}
                  onStopEdit={() => setEditingId(null)}
                />
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo perfil de lanzamiento"
        size="lg"
      >
        <CreateProfileForm
          apps={apps}
          onSave={async (config) => {
            await createProfile(config);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-overlay/[0.05] flex items-center justify-center text-fg/45">
        <Icon size={15} />
      </div>
      <div>
        <p className="text-lg font-semibold text-fg leading-none">{value}</p>
        <p className="text-[11px] text-fg/32 mt-1">{label}</p>
      </div>
    </div>
  );
}

function ProfileCard({ profile, apps, allApps, launching, onLaunch, onEdit, onDelete, onUpdate, onOpenTools, isEditing, onStopEdit }) {
  const [selectedIds, setSelectedIds] = useState(profile.appIds || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) setSelectedIds(profile.appIds || []);
  }, [isEditing, profile.appIds]);

  const toggle = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({ appIds: selectedIds });
      onStopEdit();
    } finally {
      setSaving(false);
    }
  };

  const personalCount = apps.filter(app => (app.security?.profile || 'personal') === 'personal').length;
  const workCount = apps.filter(app => (app.security?.profile || 'personal') === 'work').length;
  const firstSecureApp = apps.find(app => app.security?.locked || app.security?.sensitive) || apps[0];

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-4 border-line/[0.07] shadow-card">
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${profile.color}22`, border: `1px solid ${profile.color}55` }}
        >
          {profile.emoji || '🚀'}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="text-base font-semibold text-fg/92 truncate">{profile.name}</h3>
          <p className="text-xs text-fg/35 mt-1">
            {apps.length ? `Flujo de ${apps.length} app${apps.length !== 1 ? 's' : ''} en secuencia` : 'Sin apps asignadas'}
          </p>
        </div>
        <div className="flex gap-1.5">
          {!isEditing && (
            <button onClick={onEdit} className="p-2 rounded-lg text-fg/35 hover:text-fg/80 hover:bg-overlay/[0.06] transition-all" title="Editar apps">
              <Edit2 size={14} />
            </button>
          )}
          <button onClick={onDelete} className="p-2 rounded-lg text-fg/25 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Eliminar perfil">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {!isEditing ? (
        <>
          <div className="min-h-[74px] rounded-xl bg-black/15 border border-line/[0.04] p-3">
            {apps.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap text-[10px] text-fg/34">
                  <span className="inline-flex items-center gap-1 rounded-full bg-overlay/[0.04] border border-line/[0.05] px-2 py-1">
                    <UserRound size={10} /> Personal {personalCount}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-overlay/[0.04] border border-line/[0.05] px-2 py-1">
                    <BriefcaseBusiness size={10} /> Trabajo {workCount}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                {apps.map((a, index) => (
                  <div key={a.id} className="flex items-center gap-2 text-xs text-fg/62 bg-overlay/[0.045] border border-line/[0.05] rounded-lg px-2.5 py-1.5 max-w-full">
                    <span className="text-[10px] text-fg/30 font-mono">{index + 1}</span>
                    <AppIcon iconType={a.iconType} iconValue={a.iconValue} iconColor={a.iconColor} name={a.name} url={a.url} size={20} />
                    <span className="truncate max-w-[160px]">{a.name}</span>
                    {a.accountLabel && <span className="text-violet-300/80">({a.accountLabel})</span>}
                  </div>
                ))}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[48px] flex items-center text-xs text-fg/28">
                Usa editar para seleccionar las apps de este perfil.
              </div>
            )}
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <button
              onClick={onLaunch}
              disabled={launching || apps.length === 0}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                apps.length === 0
                  ? 'bg-overlay/[0.04] text-fg/24 cursor-default'
                  : 'bg-violet-600 hover:bg-violet-500 text-white active:scale-[0.98] shadow-glow-sm'
              }`}
            >
              {launching
                ? <div className="w-4 h-4 border-2 border-line/40 border-t-white rounded-full animate-spin" />
                : <Play size={14} fill="currentColor" />
              }
              {launching ? 'Ejecutando...' : `Ejecutar flujo (${apps.length})`}
            </button>
            <button
              onClick={() => firstSecureApp && onOpenTools?.(firstSecureApp, 'security')}
              disabled={!firstSecureApp}
              className="px-3 rounded-xl bg-overlay/[0.04] text-fg/35 hover:text-violet-300 hover:bg-violet-600/15 transition-all disabled:opacity-30"
              title="Centro de seguridad"
            >
              <Shield size={14} />
            </button>
            <button
              onClick={() => apps[0] && onOpenTools?.(apps[0], 'scripts')}
              disabled={!apps[0]}
              className="px-3 rounded-xl bg-overlay/[0.04] text-fg/35 hover:text-violet-300 hover:bg-violet-600/15 transition-all disabled:opacity-30"
              title="Scripts del flujo"
            >
              <Code2 size={14} />
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <AppPicker apps={allApps} selectedIds={selectedIds} onToggle={toggle} />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
              {saving ? <div className="w-4 h-4 border-2 border-line/40 border-t-white rounded-full animate-spin" /> : <Save size={13} />}
              Guardar cambios
            </button>
            <button onClick={onStopEdit} className="btn-ghost text-sm flex items-center gap-2">
              <X size={13} /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateProfileForm({ apps, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#7c3aed');
  const [emoji, setEmoji] = useState('🚀');
  const [appIds, setAppIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggle = (id) => setAppIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), color, emoji, appIds });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-[220px_1fr] gap-5">
      <div className="space-y-4">
        <div>
          <p className="form-label">Icono</p>
          <div className="grid grid-cols-4 gap-2">
            {PROFILE_EMOJIS.map(item => (
              <button
                key={item}
                onClick={() => setEmoji(item)}
                className={`h-10 rounded-xl text-lg flex items-center justify-center transition-all ${
                  emoji === item ? 'bg-violet-600/25 ring-1 ring-violet-400/55' : 'bg-overlay/[0.04] hover:bg-overlay/[0.08]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="form-label">Color</p>
          <div className="grid grid-cols-4 gap-2">
            {PROFILE_COLORS.map(item => (
              <button
                key={item}
                onClick={() => setColor(item)}
                className={`h-9 rounded-xl transition-all ${color === item ? 'ring-2 ring-white/70 ring-offset-2 ring-offset-surface-card scale-[1.03]' : 'opacity-75 hover:opacity-100'}`}
                style={{ background: item }}
                aria-label={`Color ${item}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 min-w-0">
        <div>
          <p className="form-label">Nombre</p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Nombre del perfil..."
            className="input-field"
            maxLength={50}
            autoFocus
          />
        </div>

        <AppPicker apps={apps} selectedIds={appIds} onToggle={toggle} />

        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={!name.trim() || saving} className="btn-primary flex items-center gap-2 text-sm flex-1 justify-center py-2.5">
            {saving ? <div className="w-4 h-4 border-2 border-line/40 border-t-white rounded-full animate-spin" /> : <Rocket size={14} />}
            Crear perfil
          </button>
          <button onClick={onCancel} className="btn-ghost text-sm">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function AppPicker({ apps, selectedIds, onToggle }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter(app =>
      app.name.toLowerCase().includes(q) ||
      app.url.toLowerCase().includes(q) ||
      app.category?.toLowerCase().includes(q)
    );
  }, [apps, query]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs text-fg/40">Apps del perfil ({selectedIds.length} seleccionadas)</p>
        {apps.length > 5 && (
          <div className="relative w-44">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg/25 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="input-field py-1.5 pl-8 pr-2 text-xs rounded-lg"
            />
          </div>
        )}
      </div>
      <div className="max-h-56 overflow-y-auto scrollbar-thin flex flex-col gap-1 glass rounded-xl p-2">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-fg/30">No hay apps para mostrar.</div>
        ) : filtered.map(app => {
          const selected = selectedIds.includes(app.id);
          return (
            <button
              key={app.id}
              onClick={() => onToggle(app.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${
                selected ? 'bg-violet-600/15 border-violet-500/25' : 'hover:bg-overlay/[0.04] border-transparent'
              }`}
            >
              {selected ? <CheckSquare size={14} className="text-violet-400 flex-shrink-0" /> : <Square size={14} className="text-fg/22 flex-shrink-0" />}
              <AppIcon iconType={app.iconType} iconValue={app.iconValue} iconColor={app.iconColor} name={app.name} url={app.url} size={24} />
              <span className="text-sm text-fg/72 truncate">{app.name}</span>
              {app.accountLabel && <span className="text-[10px] text-violet-300/80 ml-auto flex-shrink-0">({app.accountLabel})</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ hasApps, onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] gap-5 animate-fade-in">
      <div className="w-20 h-20 rounded-3xl bg-violet-600/12 border border-violet-500/20 flex items-center justify-center text-4xl">
        🚀
      </div>
      <div className="text-center max-w-sm">
        <h3 className="text-base font-semibold text-fg/82 mb-1.5">Sin perfiles todavia</h3>
        <p className="text-sm text-fg/36 leading-relaxed">
          {hasApps
            ? 'Crea un perfil para abrir grupos de apps de trabajo, estudio o clientes en una sola accion.'
            : 'Primero crea algunas apps y luego agrupalas en perfiles de lanzamiento.'}
        </p>
      </div>
      {hasApps && (
        <button onClick={onCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={14} /> Crear primer perfil
        </button>
      )}
    </div>
  );
}

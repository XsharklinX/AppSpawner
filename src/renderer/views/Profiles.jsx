import React, { useState, useCallback } from 'react';
import { Rocket, Play, Plus, Trash2, CheckSquare, Square, Edit2, Save } from 'lucide-react';
import AppIcon           from '../components/common/AppIcon';
import Modal             from '../components/common/Modal';
import { useApps }        from '../contexts/AppContext';
import { useWorkspaces }  from '../contexts/WorkspaceContext';

const PROFILE_COLORS = ['#7c3aed','#2563eb','#059669','#dc2626','#d97706','#db2777','#0891b2','#ea580c'];
const PROFILE_EMOJIS = ['🚀','💼','🏠','🎮','📚','🎨','⚡','🌙','☀️','🎯','🧪','🔒'];

export default function Profiles({ onNavigate }) {
  const { apps, launchApp }     = useApps();
  const { profiles, createProfile, updateProfile, deleteProfile } = useWorkspaces();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [launching,  setLaunching]  = useState(null);

  const handleLaunchAll = useCallback(async (profile) => {
    setLaunching(profile.id);
    const appIds = profile.appIds.filter(id => apps.some(a => a.id === id));
    for (const id of appIds) {
      await launchApp(id);
      await new Promise(r => setTimeout(r, 200));
    }
    setLaunching(null);
  }, [apps, launchApp]);

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-7 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Rocket size={20} className="text-violet-400" /> Perfiles de lanzamiento
            </h1>
            <p className="text-sm text-white/35 mt-0.5">
              Agrupa apps y ábrelas todas de una vez con un clic.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={14} /> Nuevo perfil
          </button>
        </div>
      </div>

      {/* Lista de perfiles */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-7 pb-6">
        {profiles.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 max-w-2xl">
            {profiles.map(profile => {
              const profileApps = profile.appIds
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
                  isEditing={editingId === profile.id}
                  onStopEdit={() => setEditingId(null)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Modal crear perfil */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo perfil de lanzamiento"
        size="md"
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

// ── ProfileCard ───────────────────────────────────────────────────────────────

function ProfileCard({ profile, apps, allApps, launching, onLaunch, onEdit, onDelete, onUpdate, isEditing, onStopEdit }) {
  const [selectedIds, setSelectedIds] = useState(profile.appIds);
  const [saving, setSaving] = useState(false);

  const toggle = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    await onUpdate({ appIds: selectedIds });
    setSaving(false);
    onStopEdit();
  };

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${profile.color}22`, border: `1px solid ${profile.color}44` }}
        >
          {profile.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white/90">{profile.name}</h3>
          <p className="text-xs text-white/35">{apps.length} app{apps.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all" title="Editar apps del perfil">
            <Edit2 size={13} />
          </button>
          <button onClick={onDelete} className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Eliminar perfil">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Apps preview o editor */}
      {!isEditing ? (
        <>
          {apps.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {apps.map(a => (
                <div key={a.id} className="flex items-center gap-1.5 text-xs text-white/50 glass rounded-lg px-2 py-1">
                  <AppIcon iconType={a.iconType} iconValue={a.iconValue} iconColor={a.iconColor} name={a.name} url={a.url} size={18} />
                  {a.name}
                  {a.accountLabel && <span className="text-violet-400/70">({a.accountLabel})</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/25 italic">Sin apps. Haz clic en editar para añadir.</p>
          )}
          <button
            onClick={onLaunch}
            disabled={launching || apps.length === 0}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              apps.length === 0
                ? 'bg-white/[0.04] text-white/20 cursor-default'
                : 'bg-violet-600 hover:bg-violet-500 text-white active:scale-[0.98]'
            }`}
          >
            {launching
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Play size={14} fill="currentColor" />
            }
            {launching ? 'Lanzando…' : `Lanzar todas (${apps.length})`}
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-white/40">Selecciona las apps de este perfil:</p>
          <div className="max-h-52 overflow-y-auto scrollbar-thin flex flex-col gap-1">
            {allApps.map(a => {
              const selected = selectedIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggle(a.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                    selected ? 'bg-violet-600/15 border border-violet-500/25' : 'hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  {selected ? <CheckSquare size={14} className="text-violet-400 flex-shrink-0" /> : <Square size={14} className="text-white/20 flex-shrink-0" />}
                  <AppIcon iconType={a.iconType} iconValue={a.iconValue} iconColor={a.iconColor} name={a.name} url={a.url} size={24} />
                  <span className="text-sm text-white/70">{a.name}</span>
                  {a.accountLabel && <span className="text-[10px] text-violet-400/70 ml-auto">({a.accountLabel})</span>}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
              {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={13} />}
              Guardar
            </button>
            <button onClick={onStopEdit} className="btn-ghost text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CreateProfileForm ─────────────────────────────────────────────────────────

function CreateProfileForm({ apps, onSave, onCancel }) {
  const [name,    setName]    = useState('');
  const [color,   setColor]   = useState('#7c3aed');
  const [emoji,   setEmoji]   = useState('🚀');
  const [appIds,  setAppIds]  = useState([]);
  const [saving,  setSaving]  = useState(false);

  const toggle = (id) => setAppIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), color, emoji, appIds });
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Emoji + nombre + color */}
      <div className="flex gap-3">
        <select
          value={emoji}
          onChange={e => setEmoji(e.target.value)}
          className="input-field w-16 text-center text-xl"
        >
          {PROFILE_EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nombre del perfil…"
          className="input-field flex-1"
          maxLength={50}
          autoFocus
        />
      </div>

      {/* Colores */}
      <div className="flex gap-2">
        {PROFILE_COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-7 h-7 rounded-lg transition-all ${color === c ? 'ring-2 ring-white/70 ring-offset-1 ring-offset-surface-card scale-110' : 'opacity-60 hover:opacity-100'}`}
            style={{ background: c }}
          />
        ))}
      </div>

      {/* Selección de apps */}
      <div>
        <p className="text-xs text-white/35 mb-2">Apps del perfil ({appIds.length} seleccionadas)</p>
        <div className="max-h-48 overflow-y-auto scrollbar-thin flex flex-col gap-1 glass rounded-xl p-2">
          {apps.map(a => {
            const sel = appIds.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                  sel ? 'bg-violet-600/15 border border-violet-500/20' : 'hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {sel ? <CheckSquare size={13} className="text-violet-400 flex-shrink-0" /> : <Square size={13} className="text-white/20 flex-shrink-0" />}
                <AppIcon iconType={a.iconType} iconValue={a.iconValue} iconColor={a.iconColor} name={a.name} url={a.url} size={22} />
                <span className="text-sm text-white/70">{a.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={!name.trim() || saving} className="btn-primary flex items-center gap-2 text-sm flex-1 justify-center py-2.5">
          {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Rocket size={14} />}
          Crear perfil
        </button>
        <button onClick={onCancel} className="btn-ghost text-sm">Cancelar</button>
      </div>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-5 animate-fade-in">
      <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-4xl">
        🚀
      </div>
      <div className="text-center max-w-xs">
        <h3 className="text-base font-semibold text-white/80 mb-1.5">Sin perfiles todavía</h3>
        <p className="text-sm text-white/35 leading-relaxed">
          Crea un perfil para agrupar las apps que abres juntas y lanzarlas de un clic.
        </p>
      </div>
      <button onClick={onCreate} className="btn-primary flex items-center gap-2 text-sm">
        <Plus size={14} /> Crear primer perfil
      </button>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { Camera, RotateCcw, Trash2, Plus, Cookie, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { formatRelativeTime } from '../lib/utils';
import { useI18n } from '../contexts/I18nContext';

export default function SessionSnapshots({ app, onClose }) {
  const toast = useToast();
  const { language } = useI18n();

  const [snapshots, setSnapshots]   = useState([]);
  const [loading,   setLoading]     = useState(true);
  const [saving,    setSaving]      = useState(false);
  const [restoring, setRestoring]   = useState(null);
  const [newName,   setNewName]     = useState('');
  const [msg,       setMsg]         = useState(null); // {ok, text}

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.electronAPI?.listSessions(app.id) ?? [];
      setSnapshots(list);
    } finally {
      setLoading(false);
    }
  }, [app.id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const name = newName.trim() || `Snapshot ${new Date().toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    setSaving(true);
    setMsg(null);
    try {
      const result = await window.electronAPI?.saveSession(app.id, name);
      if (result?.success) {
        setMsg({ ok: true, text: `${result.cookieCount} cookies guardadas` });
        setNewName('');
        await load();
      } else {
        setMsg({ ok: false, text: result?.error || 'Error al guardar' });
      }
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (snapshot) => {
    setRestoring(snapshot.id);
    setMsg(null);
    try {
      const result = await window.electronAPI?.restoreSession(app.id, snapshot.id);
      if (result?.success) {
        setMsg({ ok: true, text: `${result.cookieCount} cookies restauradas — recarga la app para aplicarlos` });
        toast.success('Sesión restaurada', `Recarga ${app.name} para aplicar los cambios`);
      } else {
        setMsg({ ok: false, text: result?.error || 'Error al restaurar' });
      }
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (snapshot) => {
    await window.electronAPI?.deleteSession(app.id, snapshot.id);
    await load();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Info */}
      <div className="flex items-start gap-3 glass rounded-xl p-3.5">
        <Cookie size={16} className="text-violet-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-white/40 leading-relaxed">
          Guarda el estado actual de cookies de <strong className="text-white/60">{app.name}</strong>.
          Úsalo para guardar sesiones de login y restaurarlas cuando quieras.
        </p>
      </div>

      {/* Lista de snapshots */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-violet-500/40 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-white/20">
          <Camera size={28} />
          <p className="text-sm">Sin snapshots guardados</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {snapshots.map(s => (
            <div key={s.id} className="glass rounded-xl px-3.5 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 truncate">{s.name}</p>
                <p className="text-[11px] text-white/30">
                  {formatRelativeTime(s.savedAt, language)} · {s.cookieCount} cookies
                </p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleRestore(s)}
                  disabled={!!restoring}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-violet-600/15 hover:bg-violet-600/25 text-violet-400 border border-violet-500/20 transition-all disabled:opacity-50"
                  title="Restaurar esta sesión"
                >
                  {restoring === s.id
                    ? <div className="w-3 h-3 border border-violet-400/50 border-t-violet-400 rounded-full animate-spin" />
                    : <RotateCcw size={11} />
                  }
                  Restaurar
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Eliminar snapshot"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guardar nuevo snapshot */}
      <div className="border-t border-white/[0.06] pt-3 flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Nuevo snapshot</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Nombre (opcional)…"
            className="input-field flex-1 text-sm"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2 text-sm px-4 flex-shrink-0"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Camera size={14} />
            }
            Guardar
          </button>
        </div>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 text-xs animate-fade-in ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {msg.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
          {msg.text}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff, Save, Trash2, Zap, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useApps }  from '../contexts/AppContext';
import EmptyState   from './common/EmptyState';

export default function AppCredentials({ app }) {
  const toast = useToast();
  const { isWindowOpen } = useApps();

  const [creds,     setCreds]     = useState(null);  // {username, url, hasPassword}
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [showPwd,   setShowPwd]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [filling,   setFilling]   = useState(false);
  const [msg,       setMsg]       = useState(null); // {ok, text}

  const isOpen = isWindowOpen(app.id);

  useEffect(() => {
    const load = async () => {
      try {
        const c = await window.electronAPI?.getCredentials(app.id);
        setCreds(c);
        if (c) { setUsername(c.username || ''); }
      } finally { setLoading(false); }
    };
    load();
  }, [app.id]);

  const handleSave = async () => {
    if (!username.trim() || !password.trim()) return;
    setSaving(true); setMsg(null);
    try {
      await window.electronAPI?.saveCredentials(app.id, { username, password, url: app.url });
      setCreds({ username, url: app.url, hasPassword: true });
      setPassword(''); setShowForm(false);
      toast.success('Credenciales guardadas', 'Protegidas con cifrado del sistema operativo');
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    await window.electronAPI?.deleteCredentials(app.id);
    setCreds(null); setUsername(''); setPassword('');
    toast.success('Credenciales eliminadas');
  };

  const handleAutofill = async () => {
    if (!isOpen) {
      setMsg({ ok: false, text: 'Abre la app primero para poder rellenar el formulario' });
      return;
    }
    setFilling(true); setMsg(null);
    try {
      const result = await window.electronAPI?.autofillCredentials(app.id);
      if (result?.success) {
        setMsg({ ok: true, text: `Formulario rellenado${result.filledUser ? ' (usuario ✓' : ' (usuario ✗'}${result.filledPass ? ', contraseña ✓)' : ', contraseña ✗)'}` });
      } else {
        setMsg({ ok: false, text: result?.error || 'No se pudo rellenar el formulario' });
      }
    } finally { setFilling(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-5 h-5 border-2 border-violet-500/40 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Info de seguridad */}
      <div className="flex items-start gap-3 glass rounded-xl p-3.5">
        <ShieldCheck size={15} className="text-emerald-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-white/40 leading-relaxed">
          Las credenciales se guardan cifradas usando el llavero del sistema operativo (Windows DPAPI / macOS Keychain). No se sincronizan ni se envían a ningún servidor.
        </p>
      </div>

      {/* Estado actual */}
      {creds ? (
        <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
          <KeyRound size={16} className="text-violet-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/80 truncate">{creds.username}</p>
            <p className="text-[11px] text-white/30">••••••••••••</p>
          </div>
          <button onClick={() => setShowForm(true)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
            Editar
          </button>
          <button onClick={handleDelete} className="text-white/20 hover:text-red-400 transition-colors p-1">
            <Trash2 size={13} />
          </button>
        </div>
      ) : (
        <EmptyState icon={KeyRound} title="Sin credenciales guardadas" compact />
      )}

      {/* Formulario de edición */}
      {(!creds || showForm) && (
        <div className="flex flex-col gap-3 glass rounded-xl p-4">
          <p className="text-xs font-semibold text-white/35 uppercase tracking-wider">
            {creds ? 'Actualizar credenciales' : 'Guardar credenciales'}
          </p>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Usuario o email"
            className="input-field"
            autoComplete="off"
          />
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Contraseña"
              className="input-field pr-10"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !username.trim() || !password.trim()} className="btn-primary flex items-center gap-2 text-sm flex-1 justify-center">
              {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={13} />}
              Guardar
            </button>
            {showForm && <button onClick={() => setShowForm(false)} className="btn-ghost text-sm">Cancelar</button>}
          </div>
        </div>
      )}

      {/* Autofill */}
      {creds && (
        <button
          onClick={handleAutofill}
          disabled={filling}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            isOpen
              ? 'bg-violet-600 hover:bg-violet-500 text-white active:scale-[0.98]'
              : 'bg-white/[0.04] text-white/25 cursor-default'
          }`}
          title={!isOpen ? 'Abre la app primero' : 'Rellenar formulario de login'}
        >
          {filling
            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Zap size={15} />
          }
          {filling ? 'Rellenando…' : isOpen ? 'Rellenar formulario de login' : 'Abre la app para hacer autofill'}
        </button>
      )}

      {msg && (
        <div className={`flex items-center gap-2 text-xs animate-fade-in ${msg.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
          {msg.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
          {msg.text}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  KeyRound, ShieldCheck, Upload, Eye, EyeOff, Save, Trash2, Zap,
  Plus, Copy, Check, RefreshCw, AlertCircle, CheckCircle2, X, QrCode,
} from 'lucide-react';
import { useApps }  from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';

// ── Tab: Contraseñas ──────────────────────────────────────────────────────────

function PasswordsTab({ app }) {
  const toast = useToast();
  const { isWindowOpen } = useApps();
  const isOpen = isWindowOpen(app.id);

  const [creds,   setCreds]   = useState([]);
  const [adding,  setAdding]  = useState(false);
  const [filling, setFilling] = useState(null);
  const [form,    setForm]    = useState({ name: '', username: '', password: '', selectors: { username: '', password: '', submit: '' } });
  const [showPwd, setShowPwd] = useState(false);
  const [msg,     setMsg]     = useState(null);

  const load = useCallback(async () => {
    const list = await window.electronAPI?.listCredentials(app.id) ?? [];
    setCreds(list);
  }, [app.id]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.username.trim() || !form.password.trim()) return;
    const result = await window.electronAPI?.addCredential(app.id, {
      name: form.name.trim() || form.username,
      username: form.username.trim(),
      password: form.password,
      url: app.url,
      selectors: form.selectors,
    });
    if (result?.success) {
      setForm({ name: '', username: '', password: '', selectors: { username: '', password: '', submit: '' } });
      setAdding(false);
      await load();
      toast.success('Credencial guardada');
    } else {
      setMsg({ ok: false, text: result?.error || 'Error' });
    }
  };

  const handleDelete = async (credId) => {
    await window.electronAPI?.deleteCredential(app.id, credId);
    await load();
    toast.success('Credencial eliminada');
  };

  const handleAutofill = async (credId) => {
    if (!isOpen) { setMsg({ ok: false, text: 'Abre la app primero' }); return; }
    setFilling(credId);
    const r = await window.electronAPI?.autofillById(app.id, credId);
    setFilling(null);
    if (r?.success) {
      setMsg({ ok: true, text: `Rellenado: usuario ${r.filledUser ? '✓' : '✗'}, contraseña ${r.filledPass ? '✓' : '✗'}` });
    } else {
      setMsg({ ok: false, text: r?.error || 'Error al rellenar' });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {creds.length === 0 && !adding ? (
        <div className="flex flex-col items-center py-8 gap-3 text-white/20">
          <KeyRound size={28} />
          <p className="text-sm">Sin contraseñas guardadas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {creds.map(c => (
            <div key={c.id} className="glass rounded-xl px-3.5 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 truncate">{c.name}</p>
                <p className="text-[11px] text-white/35 truncate">{c.username}</p>
              </div>
              <button
                onClick={() => handleAutofill(c.id)}
                disabled={filling === c.id}
                className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all ${
                  isOpen
                    ? 'bg-violet-600/15 border-violet-500/20 text-violet-400 hover:bg-violet-600/25'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/20 cursor-default'
                }`}
                title={isOpen ? 'Rellenar formulario' : 'Abre la app primero'}
              >
                {filling === c.id
                  ? <div className="w-3 h-3 border border-violet-400/50 border-t-violet-400 rounded-full animate-spin" />
                  : <Zap size={11} />}
                Autofill
              </button>
              <button onClick={() => handleDelete(c.id)} className="text-white/20 hover:text-red-400 transition-colors p-1">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="glass rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-white/35 uppercase tracking-wider">Nueva credencial</p>
          <input type="text" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Nombre (ej: Trabajo)" className="input-field text-sm" />
          <input type="text" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} placeholder="Usuario o email *" className="input-field text-sm" autoComplete="off" />
          <div className="relative">
            <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="Contraseña *" className="input-field text-sm pr-10" autoComplete="new-password" />
            <button onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 flex flex-col gap-2">
            <p className="text-[11px] text-white/35 font-semibold uppercase tracking-wider">Selectors avanzados opcionales</p>
            <input
              type="text"
              value={form.selectors.username}
              onChange={e => setForm(f => ({ ...f, selectors: { ...f.selectors, username: e.target.value } }))}
              placeholder="Selector usuario: input[name='email']"
              className="input-field text-xs font-mono py-2"
            />
            <input
              type="text"
              value={form.selectors.password}
              onChange={e => setForm(f => ({ ...f, selectors: { ...f.selectors, password: e.target.value } }))}
              placeholder="Selector password: input[type='password']"
              className="input-field text-xs font-mono py-2"
            />
            <input
              type="text"
              value={form.selectors.submit}
              onChange={e => setForm(f => ({ ...f, selectors: { ...f.selectors, submit: e.target.value } }))}
              placeholder="Selector submit opcional: button[type='submit']"
              className="input-field text-xs font-mono py-2"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!form.username || !form.password} className="btn-primary text-sm flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
              <Save size={13} /> Guardar
            </button>
            <button onClick={() => setAdding(false)} className="btn-ghost text-sm">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="btn-ghost flex items-center gap-2 text-sm w-fit">
          <Plus size={13} /> Añadir credencial
        </button>
      )}

      {msg && (
        <div className={`flex items-center gap-2 text-xs animate-fade-in ${msg.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
          {msg.ok ? <CheckCircle2 size={13}/> : <AlertCircle size={13}/>} {msg.text}
        </div>
      )}
    </div>
  );
}

// ── Tab: OTP / 2FA ────────────────────────────────────────────────────────────

function OTPTab({ app }) {
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [adding,  setAdding]  = useState(false);
  const [form,    setForm]    = useState({ name: '', issuer: '', secret: '' });
  const [codes,   setCodes]   = useState({}); // {id: {code, remaining}}
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    const list = await window.electronAPI?.listTotp(app.id) ?? [];
    setEntries(list);
  }, [app.id]);

  useEffect(() => { load(); }, [load]);

  // Refresh codes every second
  useEffect(() => {
    if (!entries.length) return;

    const refresh = async () => {
      const results = await Promise.all(
        entries.map(async e => {
          const r = await window.electronAPI?.getTotpCode(app.id, e.id);
          return [e.id, r?.success ? { code: r.code, remaining: r.remaining } : null];
        })
      );
      setCodes(Object.fromEntries(results.filter(([,v]) => v)));
    };
    refresh();
    timerRef.current = setInterval(refresh, 1000);
    return () => clearInterval(timerRef.current);
  }, [entries, app.id]);

  const handleAdd = async () => {
    const r = await window.electronAPI?.addTotp(app.id, form);
    if (r?.success) {
      setForm({ name: '', issuer: '', secret: '' });
      setAdding(false);
      await load();
      toast.success('2FA añadido', form.name || form.issuer);
    } else {
      toast.error('Error', r?.error || 'Secreto inválido');
    }
  };

  const handleDelete = async (id) => {
    await window.electronAPI?.deleteTotp(app.id, id);
    setEntries(prev => prev.filter(e => e.id !== id));
    setCodes(prev => { const next = {...prev}; delete next[id]; return next; });
    toast.success('2FA eliminado');
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado', code);
  };

  return (
    <div className="flex flex-col gap-3">
      {entries.length === 0 && !adding ? (
        <div className="flex flex-col items-center py-8 gap-3 text-white/20">
          <ShieldCheck size={28} />
          <p className="text-sm">Sin códigos 2FA guardados</p>
          <p className="text-[11px] text-center max-w-[240px] leading-relaxed text-white/15">
            Añade el secreto TOTP de tu app para generar códigos sin necesitar el móvil.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map(e => {
            const data = codes[e.id];
            const pct  = data ? (data.remaining / 30) * 100 : 100;
            const code = data?.code ?? '------';
            const rem  = data?.remaining ?? 30;
            return (
              <div key={e.id} className="glass rounded-xl p-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-white/80">{e.name}</p>
                    {e.issuer && <span className="text-[10px] text-white/30">{e.issuer}</span>}
                  </div>
                  {/* Code display */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xl font-bold tracking-[0.2em] text-violet-400">
                      {code.slice(0,3)} {code.slice(3)}
                    </span>
                    <button onClick={() => copyCode(code)} className="text-white/25 hover:text-violet-400 transition-colors p-1" title="Copiar">
                      <Copy size={13} />
                    </button>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1 rounded-full bg-white/[0.07] overflow-hidden w-full">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${rem <= 5 ? 'bg-red-500' : rem <= 10 ? 'bg-amber-500' : 'bg-violet-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className={`text-[10px] mt-0.5 ${rem <= 5 ? 'text-red-400' : 'text-white/25'}`}>
                    Expira en {rem}s
                  </p>
                </div>
                <button onClick={() => handleDelete(e.id)} className="text-white/20 hover:text-red-400 transition-colors p-1 flex-shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <div className="glass rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-white/35 uppercase tracking-wider">Añadir 2FA (TOTP)</p>
          <input type="text" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Nombre (ej: Cuenta principal)" className="input-field text-sm" />
          <input type="text" value={form.issuer} onChange={e => setForm(f=>({...f,issuer:e.target.value}))} placeholder="Emisor (ej: Google, GitHub…)" className="input-field text-sm" />
          <div>
            <input
              type="text"
              value={form.secret}
              onChange={e => setForm(f=>({...f,secret:e.target.value}))}
              placeholder="Secreto Base32 u otpauth:// del QR"
              className="input-field text-sm font-mono tracking-wider"
              autoComplete="off"
            />
            <p className="text-[11px] text-white/25 mt-1 leading-relaxed">
              Puedes pegar el secreto Base32 o la URL otpauth:// que contiene un QR 2FA exportado por otro gestor.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!form.secret} className="btn-primary text-sm flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
              <ShieldCheck size={13} /> Añadir
            </button>
            <button onClick={() => setAdding(false)} className="btn-ghost text-sm">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="btn-ghost flex items-center gap-2 text-sm w-fit">
          <Plus size={13} /> Añadir código 2FA
        </button>
      )}
    </div>
  );
}

// ── Tab: Importar ─────────────────────────────────────────────────────────────

function ImportTab({ app }) {
  const toast = useToast();
  const { apps } = useApps();
  const fileRef  = useRef(null);

  const [parsed,   setParsed]   = useState(null); // {count, entries}
  const [selected, setSelected] = useState({});   // {idx: appId}
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text   = await file.text();
    const result = await window.electronAPI?.importCredentialsCSV(text);
    if (result?.success) {
      setParsed(result);
      // Auto-match entries to apps
      const autoSelect = {};
      result.entries.forEach((entry, idx) => {
        try {
          const importedHost = new URL(entry.url.startsWith('http') ? entry.url : `https://${entry.url}`).hostname;
          const matched = apps.find(a => {
            try { return new URL(a.url).hostname === importedHost; } catch { return false; }
          });
          if (matched) autoSelect[idx] = matched.id;
        } catch {}
      });
      setSelected(autoSelect);
    } else {
      toast.error('Error al importar', result?.error || 'Formato no reconocido');
    }
    e.target.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    const imports = parsed.entries
      .map((e, idx) => ({ ...e, appId: selected[idx] || null }))
      .filter(e => e.appId);
    const result = await window.electronAPI?.saveImportedCreds(imports);
    setSaving(false);
    if (result?.success) {
      setDone(result.saved);
      setParsed(null);
      toast.success(`${result.saved} contraseñas importadas`);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-xl p-4 flex flex-col gap-3">
        <p className="text-xs text-white/40 leading-relaxed">
          Importa contraseñas desde Chrome, Firefox, Edge o cualquier gestor (Bitwarden, 1Password, etc.)
          exportando a <strong className="text-white/60">CSV</strong>.
        </p>
        <div className="flex flex-col gap-1 text-[11px] text-white/30">
          <p>• <strong className="text-white/50">Chrome/Edge:</strong> chrome://settings/passwords → Exportar contraseñas</p>
          <p>• <strong className="text-white/50">Firefox:</strong> about:logins → ⋯ → Exportar contraseñas</p>
          <p>• <strong className="text-white/50">Bitwarden:</strong> Vault → Herramientas → Exportar</p>
        </div>
        <button onClick={() => fileRef.current?.click()} className="btn-primary flex items-center gap-2 text-sm w-fit">
          <Upload size={13} /> Seleccionar archivo CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      {done !== null && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 animate-fade-in">
          <CheckCircle2 size={14} /> {done} contraseñas guardadas correctamente
        </div>
      )}

      {parsed && parsed.count > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-white/40">{parsed.count} entradas encontradas. Asigna cada una a una app:</p>
          <div className="max-h-56 overflow-y-auto scrollbar-thin flex flex-col gap-2">
            {parsed.entries.map((entry, idx) => (
              <div key={idx} className="glass rounded-xl px-3 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/70 truncate">{entry.username}</p>
                  <p className="text-[10px] text-white/30 truncate">{entry.url}</p>
                </div>
                <select
                  value={selected[idx] || ''}
                  onChange={e => setSelected(prev => ({ ...prev, [idx]: e.target.value || null }))}
                  className="input-field text-xs w-36 flex-shrink-0 py-1"
                >
                  <option value="">Sin asignar</option>
                  {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !Object.values(selected).some(Boolean)}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-40"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={13} />}
            Guardar {Object.values(selected).filter(Boolean).length} seleccionadas
          </button>
        </div>
      )}
    </div>
  );
}

// ── SecurityCenter ────────────────────────────────────────────────────────────

export default function SecurityCenter({ app }) {
  const [tab, setTab] = useState('passwords');

  const TABS = [
    { id: 'passwords', label: '🔑 Contraseñas' },
    { id: 'otp',       label: '🛡 2FA / OTP'   },
    { id: 'import',    label: '📥 Importar'    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 glass rounded-xl">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.id ? 'bg-violet-600/30 text-violet-300' : 'text-white/35 hover:text-white/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={tab} className="animate-fade-in">
        {tab === 'passwords' && <PasswordsTab app={app} />}
        {tab === 'otp'       && <OTPTab       app={app} />}
        {tab === 'import'    && <ImportTab    app={app} />}
      </div>
    </div>
  );
}

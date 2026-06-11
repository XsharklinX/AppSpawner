import React, { useEffect, useState } from 'react';
import { Copy, LockKeyhole, Save, ShieldCheck, TimerReset, UsersRound } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export default function Security() {
  const toast = useToast();
  const [settings, setSettings] = useState({});
  const [pin, setPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.electronAPI?.getSettings?.().then(setSettings).catch(() => {});
  }, []);

  const savePin = async () => {
    setBusy(true);
    try {
      const result = await window.electronAPI?.setSecurityPin?.(pin);
      if (result?.success) {
        setPin('');
        setRecoveryCode(result.recoveryCode || '');
        setSettings(await window.electronAPI?.getSettings?.());
        toast.success('PIN configurado', 'Las apps sensibles ya pueden requerir desbloqueo.');
      } else {
        toast.error('No se pudo guardar el PIN', result?.error || '');
      }
    } finally {
      setBusy(false);
    }
  };

  const clearPin = async () => {
    setBusy(true);
    try {
      const result = await window.electronAPI?.clearSecurityPin?.(currentPin);
      if (result?.success) {
        setCurrentPin('');
        setRecoveryCode('');
        setSettings(await window.electronAPI?.getSettings?.());
        toast.success('PIN eliminado');
      } else {
        toast.error('No se pudo eliminar el PIN', result?.error || '');
      }
    } finally {
      setBusy(false);
    }
  };

  const resetWithRecovery = async () => {
    setBusy(true);
    try {
      const result = await window.electronAPI?.resetSecurityPin?.(resetCode, resetPin);
      if (result?.success) {
        setResetCode('');
        setResetPin('');
        setRecoveryCode(result.recoveryCode || '');
        setSettings(await window.electronAPI?.getSettings?.());
        toast.success('PIN restablecido', 'Guarda el nuevo codigo de recuperacion.');
      } else {
        toast.error('No se pudo restablecer el PIN', result?.error || '');
      }
    } finally {
      setBusy(false);
    }
  };

  const copyRecoveryCode = () => {
    if (!recoveryCode) return;
    navigator.clipboard?.writeText(recoveryCode);
    toast.success('Codigo copiado');
  };

  const update = async (updates) => {
    const next = await window.electronAPI?.updateSettings?.(updates);
    if (next) setSettings(next);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-0.5 flex items-center gap-2">
          <ShieldCheck size={16} className="text-violet-400" /> Seguridad y automatizacion
        </h2>
        <p className="text-sm text-white/35 leading-relaxed max-w-2xl">
          Define el PIN local, endurece el vault y separa apps personales de trabajo.
        </p>
      </div>

      <section className="glass rounded-xl p-4 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600/15 text-violet-300 flex items-center justify-center">
            <LockKeyhole size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/82">PIN global para apps sensibles</p>
            <p className="text-xs text-white/35 mt-1">
              Se guarda como hash PBKDF2 local. No se exporta en texto plano.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
            <p className="text-xs text-white/35 mb-2">{settings?.securityPinHash ? 'Cambiar PIN' : 'Crear PIN'}</p>
            <div className="flex gap-2">
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="4-12 digitos"
                className="input-field text-sm"
              />
              <button onClick={savePin} disabled={busy || pin.length < 4} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40">
                <Save size={13} /> Guardar
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
            <p className="text-xs text-white/35 mb-2">Eliminar PIN actual</p>
            <div className="flex gap-2">
              <input
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="PIN actual"
                className="input-field text-sm"
              />
              <button onClick={clearPin} disabled={busy || !settings?.securityPinHash} className="btn-ghost text-sm disabled:opacity-40">
                Eliminar
              </button>
            </div>
          </div>
        </div>

        {recoveryCode && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-amber-200">Codigo de recuperacion nuevo</p>
              <p className="text-[11px] text-amber-100/55 mt-1">
                Guardalo fuera de AppSpawner. Solo se muestra ahora y permite cambiar el PIN si lo olvidas.
              </p>
              <p className="font-mono text-sm text-amber-100 mt-2 tracking-widest">{recoveryCode}</p>
            </div>
            <button onClick={copyRecoveryCode} className="btn-ghost text-sm flex items-center gap-2 flex-shrink-0">
              <Copy size={13} /> Copiar
            </button>
          </div>
        )}

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
          <p className="text-xs text-white/35 mb-2">Recuperar PIN con codigo</p>
          <div className="grid md:grid-cols-[1fr_160px_auto] gap-2">
            <input
              type="text"
              value={resetCode}
              onChange={e => setResetCode(e.target.value.toUpperCase().slice(0, 24))}
              placeholder="AS-XXXX-XXXX-XXXX"
              className="input-field text-sm font-mono"
            />
            <input
              type="password"
              inputMode="numeric"
              value={resetPin}
              onChange={e => setResetPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="Nuevo PIN"
              className="input-field text-sm"
            />
            <button
              onClick={resetWithRecovery}
              disabled={busy || resetCode.length < 8 || resetPin.length < 4}
              className="btn-ghost text-sm disabled:opacity-40"
            >
              Restablecer
            </button>
          </div>
        </div>
      </section>

      <section className="glass rounded-xl p-4 flex flex-col gap-4">
        <SettingRow
          icon={UsersRound}
          title="Separacion personal/trabajo"
          description="Mantiene el perfil de seguridad por app para futuras vistas y reglas separadas."
          checked={settings?.separatePersonalWork ?? true}
          onChange={() => update({ separatePersonalWork: !(settings?.separatePersonalWork ?? true) })}
        />
        <div className="divider" />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-600/15 text-cyan-300 flex items-center justify-center">
              <TimerReset size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/82">Timeout del vault</p>
              <p className="text-xs text-white/35 mt-1">Base para cerrar sesiones sensibles cuando se agregue desbloqueo persistente.</p>
            </div>
          </div>
          <input
            type="number"
            min="1"
            max="240"
            value={settings?.vaultLockTimeoutMinutes ?? 15}
            onChange={e => update({ vaultLockTimeoutMinutes: Number(e.target.value) || 15 })}
            className="input-field w-24 text-sm"
          />
        </div>
      </section>
    </div>
  );
}

function SettingRow({ icon: Icon, title, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-600/15 text-violet-300 flex items-center justify-center">
          <Icon size={16} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/82">{title}</p>
          <p className="text-xs text-white/35 mt-1">{description}</p>
        </div>
      </div>
      <button onClick={onChange} className={`relative w-10 h-6 rounded-full transition-colors ${checked ? 'bg-violet-600' : 'bg-white/12'}`}>
        <span className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

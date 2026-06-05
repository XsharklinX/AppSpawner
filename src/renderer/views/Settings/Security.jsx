import React, { useEffect, useState } from 'react';
import { LockKeyhole, Save, ShieldCheck, TimerReset, UsersRound } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export default function Security() {
  const toast = useToast();
  const [settings, setSettings] = useState({});
  const [pin, setPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
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
        setSettings(await window.electronAPI?.getSettings?.());
        toast.success('PIN eliminado');
      } else {
        toast.error('No se pudo eliminar el PIN', result?.error || '');
      }
    } finally {
      setBusy(false);
    }
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

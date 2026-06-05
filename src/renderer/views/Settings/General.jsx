import React, { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Check, Info, RefreshCw, PlayCircle } from 'lucide-react';
import Switch     from '../../components/common/Switch';
import { useI18n }  from '../../contexts/I18nContext';
import { useToast } from '../../contexts/ToastContext';

export default function General() {
  const { t, language, setLanguage } = useI18n();
  const toast = useToast();

  const [settings, setSettings] = useState({
    desktopShortcuts:    true,
    startMenuShortcuts:  true,
    autoLaunch:          false,
    installPath:         '',
  });
  const [saved, setSaved] = useState(false);
  const [repairingShortcuts, setRepairingShortcuts] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const s = await window.electronAPI?.getSettings() ?? {};
        const p = await window.electronAPI?.getDefaultInstallPath() ?? '';
        setSettings(prev => ({ ...prev, ...s, installPath: s.installPath || p }));
      } catch {}
    };
    load();
  }, []);

  const save = useCallback(async (updates) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    try {
      await window.electronAPI?.updateSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(t('error'), err.message);
    }
  }, [settings, toast, t]);

  const browsePath = async () => {
    const selectedPath = await window.electronAPI?.selectDirectory();
    if (selectedPath) save({ installPath: selectedPath });
  };

  const repairShortcuts = async () => {
    setRepairingShortcuts(true);
    try {
      const result = await window.electronAPI?.repairShortcuts();
      if (result?.success === false) {
        toast.error('Algunos accesos no se pudieron reparar', `${result.repaired || 0} apps procesadas`);
      } else {
        toast.success('Accesos directos reparados', `${result?.repaired || 0} apps procesadas`);
      }
    } catch (err) {
      toast.error(t('error'), err.message);
    } finally {
      setRepairingShortcuts(false);
    }
  };

  const showOnboarding = () => {
    window.dispatchEvent(new CustomEvent('appspawner:show-onboarding'));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-0.5">{t('set_general')}</h2>
        <p className="text-sm text-white/35">Preferencias generales de AppSpawner.</p>
      </div>

      {/* ── Idioma ────────────────────────────────────────────────────────── */}
      <Section title={t('gen_language')}>
        <div className="flex gap-2">
          {['es', 'en'].map(lang => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`
                flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${language === lang
                  ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30'
                  : 'bg-white/[0.04] text-white/50 hover:text-white/75 border border-white/[0.06]'
                }
              `}
            >
              {lang === 'es' ? '🇪🇸 Español' : '🇺🇸 English'}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Ruta de instalación ───────────────────────────────────────────── */}
      <Section title={t('gen_install_path')}>
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.installPath}
            onChange={e => setSettings(prev => ({ ...prev, installPath: e.target.value }))}
            onBlur={e => save({ installPath: e.target.value })}
            placeholder={t('gen_install_ph')}
            className="input-field flex-1 text-sm font-mono"
          />
          <button
            onClick={browsePath}
            className="btn-ghost flex items-center gap-2 text-sm flex-shrink-0"
          >
            <FolderOpen size={14} />
            {t('gen_browse')}
          </button>
        </div>
        <p className="text-xs text-white/30 mt-1">
          Los accesos directos del escritorio se crearán en esta carpeta y en el Escritorio/Inicio de tu sistema.
        </p>
      </Section>

      {/* ── Accesos directos ─────────────────────────────────────────────── */}
      <Section title="Accesos Directos al Instalar Apps">
        <div className="glass rounded-xl p-4 flex flex-col gap-4">
          <Switch
            checked={settings.desktopShortcuts}
            onChange={v => save({ desktopShortcuts: v })}
            label={t('gen_desktop')}
            description="Crea un .lnk (Win) / .app (macOS) / .desktop (Linux) en tu Escritorio."
          />
          <div className="divider" />
          <Switch
            checked={settings.startMenuShortcuts}
            onChange={v => save({ startMenuShortcuts: v })}
            label={t('gen_start_menu')}
            description="Añade la app al Menú Inicio (Windows) o Aplicaciones (macOS/Linux)."
          />
        </div>
      </Section>

      {/* ── Inicio automático ─────────────────────────────────────────────── */}
      <Section title="Mantenimiento">
        <div className="glass rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/75">Reparar accesos directos</p>
              <p className="text-xs text-white/35 mt-0.5">Regenera accesos con iconos, rutas y nombres actuales.</p>
            </div>
            <button
              onClick={repairShortcuts}
              disabled={repairingShortcuts}
              className="btn-ghost flex items-center gap-2 text-xs flex-shrink-0 disabled:opacity-50"
            >
              <RefreshCw size={13} className={repairingShortcuts ? 'animate-spin' : ''} />
              Reparar
            </button>
          </div>
          <div className="divider" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/75">Ver presentación inicial</p>
              <p className="text-xs text-white/35 mt-0.5">Reabre el tour de AppSpawner sin cambiar tus datos.</p>
            </div>
            <button onClick={showOnboarding} className="btn-ghost flex items-center gap-2 text-xs flex-shrink-0">
              <PlayCircle size={13} />
              Ver tour
            </button>
          </div>
        </div>
      </Section>

      <Section title="Sistema">
        <div className="glass rounded-xl p-4">
          <Switch
            checked={settings.autoLaunch}
            onChange={v => save({ autoLaunch: v })}
            label={t('gen_auto_launch')}
            description="AppSpawner se inicia minimizado en el tray al encender el equipo."
          />
        </div>
      </Section>

      {/* ── Nota sobre el tray ───────────────────────────────────────────── */}
      <div className="flex items-start gap-2.5 glass rounded-xl px-4 py-3">
        <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-white/40 leading-relaxed">
          AppSpawner vive en el <strong className="text-white/60">System Tray</strong> (bandeja del sistema).
          Puedes acceder rápidamente a todas tus apps sin abrir el Dashboard.
          Atajo global: <kbd className="px-1.5 py-0.5 bg-white/[0.07] rounded text-[10px]">Ctrl+Alt+Space</kbd>
        </p>
      </div>

      {/* Indicador de guardado */}
      {saved && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 animate-fade-in">
          <Check size={14} /> {t('gen_saved')}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

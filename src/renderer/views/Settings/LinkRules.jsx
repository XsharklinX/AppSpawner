import React, { useState, useEffect } from 'react';
import { ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
import Switch     from '../../components/common/Switch';
import { useI18n }  from '../../contexts/I18nContext';
import { useToast } from '../../contexts/ToastContext';
import { useApps }  from '../../contexts/AppContext';

export default function LinkRules() {
  const { t }  = useI18n();
  const toast  = useToast();
  const { apps } = useApps();

  const [settings, setSettings] = useState({ interceptLinks: false, forceBrowser: false });
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const s   = await window.electronAPI?.getSettings() ?? {};
        const dev = await window.electronAPI?.isDev?.() ?? false;
        setSettings({ interceptLinks: s.interceptLinks ?? false, forceBrowser: s.forceBrowser ?? false });
        setIsDev(dev);
      } catch {}
    };
    load();
  }, []);

  const save = async (updates) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    try {
      await window.electronAPI?.updateSettings(next);
      toast.success(t('gen_saved'));
    } catch (err) {
      toast.error(t('error'), err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-fg mb-0.5">{t('set_link_rules')}</h2>
        <p className="text-sm text-fg/35 leading-relaxed max-w-md">{t('link_desc')}</p>
      </div>

      {/* ── Cómo funciona ────────────────────────────────────────────────── */}
      <div className="glass rounded-2xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-600/20 flex items-center justify-center flex-shrink-0">
          <ShieldCheck size={17} className="text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-fg/75 mb-1">¿Cómo funciona la intercepción?</p>
          <ol className="text-xs text-fg/35 leading-relaxed space-y-1 list-decimal list-inside">
            <li>AppSpawner se registra como handler del protocolo <code className="text-violet-400 bg-violet-500/10 px-1 rounded">appspawner://</code></li>
            <li>Cuando haces clic en un link que coincide con tu app, el sistema lo redirige aquí</li>
            <li>Se abre la ventana SSB correspondiente en lugar del navegador</li>
          </ol>
        </div>
      </div>

      {/* ── Toggles ──────────────────────────────────────────────────────── */}
      <div className="glass rounded-xl p-4 flex flex-col gap-4">
        <Switch
          checked={settings.interceptLinks}
          onChange={v => save({ interceptLinks: v, forceBrowser: v ? false : settings.forceBrowser })}
          label={t('link_global')}
          description="Captura links externos que coincidan con tus apps instaladas."
        />
        <div className="divider" />
        <Switch
          checked={settings.forceBrowser}
          onChange={v => save({ forceBrowser: v, interceptLinks: v ? false : settings.interceptLinks })}
          label={t('link_force_browser')}
          description="Siempre abrir links externos en el navegador por defecto del sistema."
        />
      </div>

      {/* ── Apps que serían interceptadas ────────────────────────────────── */}
      {settings.interceptLinks && apps.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[11px] font-semibold text-fg/35 uppercase tracking-wider">
            Dominios monitoreados ({apps.length})
          </h3>
          <div className="glass rounded-xl p-3 flex flex-col gap-1.5 max-h-40 overflow-y-auto scrollbar-thin">
            {apps.map(app => {
              let domain = app.url;
              try { domain = new URL(app.url).hostname.replace('www.', ''); } catch {}
              return (
                <div key={app.id} className="flex items-center gap-2.5 px-1 py-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-400/60 flex-shrink-0" />
                  <span className="text-xs text-fg/55 flex-1">{app.name}</span>
                  <code className="text-[10px] text-violet-400/70 bg-violet-500/10 px-1.5 py-0.5 rounded">
                    {domain}
                  </code>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info pie */}
      <div className="flex items-start gap-2 text-xs text-fg/25 leading-relaxed">
        <ExternalLink size={12} className="mt-0.5 flex-shrink-0" />
        <p>
          La intercepción de links puede requerir permisos adicionales en algunos sistemas.
          En Windows, el ejecutable empaquetado los gestiona automáticamente a través del registro de sistema.
        </p>
      </div>
    </div>
  );
}

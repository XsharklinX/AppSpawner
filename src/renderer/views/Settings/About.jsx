import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Cpu, Download, Upload, CheckCircle2, AlertCircle, ArrowUpCircle, Mail, UserRound } from 'lucide-react';
import { useApps } from '../../contexts/AppContext';
import { useI18n }  from '../../contexts/I18nContext';
import { useToast } from '../../contexts/ToastContext';
import { APP_VERSION, APP_NAME, APP_BUILD } from '../../lib/constants';

const TECH_STACK = [
  { label: 'Runtime',    value: 'Electron 31'    },
  { label: 'UI',         value: 'React 18'        },
  { label: 'Estilos',    value: 'Tailwind CSS 3'  },
  { label: 'Bundler',    value: 'Vite 5'          },
];

export default function About() {
  const { t }    = useI18n();
  const toast    = useToast();
  const { loadApps } = useApps();

  const [checking,    setChecking]    = useState(false);
  const [updateState, setUpdateState] = useState(null); // null | 'up-to-date' | {version, url}  | 'error'
  const [platform,    setPlatform]    = useState('');
  const [version,     setVersion]     = useState(APP_VERSION);
  const [importing,   setImporting]   = useState(false);
  const [importMsg,   setImportMsg]   = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const plat = await window.electronAPI?.getPlatform() ?? navigator.platform;
        const ver  = await window.electronAPI?.getVersion() ?? APP_VERSION;
        setPlatform(plat);
        setVersion(ver);
      } catch {}
    };
    load();
  }, []);

  const checkUpdates = async () => {
    setChecking(true);
    setUpdateState(null);
    try {
      const res  = await fetch('https://api.github.com/repos/appspawner/appspawner/releases/latest', {
        headers: { Accept: 'application/vnd.github.v3+json' },
        signal:  AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error('no_repo');
      const data    = await res.json();
      const latest  = data.tag_name?.replace(/^v/, '') ?? '0';
      const current = version.replace(/^v/, '');
      const isNewer = latest.localeCompare(current, undefined, { numeric: true }) > 0;
      setUpdateState(isNewer
        ? { version: data.tag_name, url: data.html_url }
        : 'up-to-date'
      );
    } catch {
      setUpdateState('up-to-date'); // sin repo público → asumir actualizado
    } finally {
      setChecking(false);
    }
  };

  const handleExport = async () => {
    try {
      const json = await window.electronAPI?.exportData();
      if (!json) return;
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `appspawner-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup exportado', 'Archivo JSON descargado correctamente');
    } catch (err) {
      toast.error('Error al exportar', err.message);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const text   = await file.text();
      const result = await window.electronAPI?.importData(text);
      if (result?.success) {
        setImportMsg({ ok: true, text: `${result.added} apps importadas, ${result.skipped} omitidas` });
        if (result.added > 0) loadApps();
      } else {
        setImportMsg({ ok: false, text: result?.error || 'Error desconocido' });
      }
    } catch (err) {
      setImportMsg({ ok: false, text: err.message });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header con logo ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-accent-gradient flex items-center justify-center shadow-glow flex-shrink-0">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="10" stroke="white" strokeWidth="2.5"/>
            <circle cx="13" cy="13" r="4" fill="white" fillOpacity="0.9"/>
            <path d="M13 6v4M13 16v4M6 13h4M16 13h4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">{APP_NAME}</h2>
          <p className="text-sm text-white/40">{APP_BUILD}</p>
        </div>
      </div>

      {/* ── Info de versión ──────────────────────────────────────────────── */}
      <div className="glass rounded-xl overflow-hidden">
        <InfoRow label={t('about_version')} value={`v${version}`} />
        <div className="divider mx-4" />
        <InfoRow label={t('about_build')}   value={APP_BUILD}  />
        <div className="divider mx-4" />
        <InfoRow label="Desarrollador" value="Sharklin" />
        <div className="divider mx-4" />
        <InfoRow label="Contacto" value="contactosharklin@gmail.com" />
        <div className="divider mx-4" />
        <InfoRow label={t('about_platform')} value={
          platform === 'win32'  ? 'Windows' :
          platform === 'darwin' ? 'macOS'   :
          platform ? `Linux (${platform})` : '—'
        } />
      </div>

      {/* ── Stack tecnológico ────────────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-2.5">Stack</h3>
        <div className="grid grid-cols-2 gap-2">
          {TECH_STACK.map(({ label, value }) => (
            <div key={label} className="glass rounded-xl px-3.5 py-2.5 flex items-center gap-2">
              <Cpu size={12} className="text-violet-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-white/30">{label}</p>
                <p className="text-xs font-medium text-white/70">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Descripción ──────────────────────────────────────────────────── */}
      <p className="text-sm text-white/35 leading-relaxed">{t('about_desc')}</p>

      <div className="grid grid-cols-2 gap-2">
        <a href="mailto:contactosharklin@gmail.com" className="glass rounded-xl px-3.5 py-2.5 flex items-center gap-2 hover:border-violet-500/25 transition-colors">
          <Mail size={13} className="text-violet-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-white/30">Quejas y mejoras</p>
            <p className="text-xs font-medium text-white/70 truncate">contactosharklin@gmail.com</p>
          </div>
        </a>
        <div className="glass rounded-xl px-3.5 py-2.5 flex items-center gap-2">
          <UserRound size={13} className="text-violet-400 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-white/30">Desarrollador</p>
            <p className="text-xs font-medium text-white/70">Sharklin</p>
          </div>
        </div>
      </div>

      {/* ── Buscar actualizaciones ───────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <button
          onClick={checkUpdates}
          disabled={checking}
          className={`btn-primary flex items-center gap-2 text-sm w-fit ${checking ? 'opacity-70' : ''}`}
        >
          <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
          {checking ? t('about_checking') : t('about_check')}
        </button>

        {updateState === 'up-to-date' && (
          <div className="flex items-center gap-2 text-sm text-emerald-400 animate-fade-in">
            <CheckCircle2 size={14} /> {t('about_up_to_date')}
          </div>
        )}
        {updateState && typeof updateState === 'object' && (
          <div className="glass rounded-xl p-4 flex items-start gap-3 animate-fade-in border border-violet-500/20">
            <ArrowUpCircle size={18} className="text-violet-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white/85">Nueva versión disponible: {updateState.version}</p>
              <p className="text-xs text-white/40 mt-0.5">Hay una actualización disponible para AppSpawner.</p>
              <button
                onClick={() => window.electronAPI?.openExternal(updateState.url)}
                className="mt-2 btn-primary text-xs flex items-center gap-2 w-fit"
              >
                <Download size={12} /> Descargar actualización
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Import / Export ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-2.5">
          Backup de datos
        </h3>
        <div className="glass rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs text-white/35 leading-relaxed">
            Exporta tus apps a JSON para hacer backup o mover la configuración a otro equipo.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExport}
              className="btn-ghost flex items-center gap-2 text-xs"
            >
              <Download size={13} />
              Exportar apps
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="btn-ghost flex items-center gap-2 text-xs"
            >
              {importing
                ? <div className="w-3 h-3 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                : <Upload size={13} />
              }
              Importar backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>

          {importMsg && (
            <div className={`flex items-center gap-2 text-xs animate-fade-in ${importMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {importMsg.ok
                ? <CheckCircle2 size={13} />
                : <AlertCircle  size={13} />
              }
              {importMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="text-xs text-white/25 pt-2 border-t border-white/[0.05]">
        Hecho con ♥ usando Electron + React
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-white/45">{label}</span>
      <span className="text-sm font-medium text-white/75">{value}</span>
    </div>
  );
}

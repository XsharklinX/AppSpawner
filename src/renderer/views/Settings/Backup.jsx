import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Download,
  Upload,
  RefreshCw,
  ShieldCheck,
  Database,
  KeyRound,
  FileCode2,
  HardDrive,
  Stethoscope,
  Wrench,
  PackageCheck,
  Laptop,
  Clock3,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const BACKUP_ITEMS = [
  { icon: Database, label: 'Apps, perfiles, workspaces y ajustes' },
  { icon: ShieldCheck, label: 'Reglas AdBlock, temas y preferencias' },
  { icon: FileCode2, label: 'Scripts CSS/JS y snapshots guardados' },
  { icon: KeyRound, label: 'Credenciales y 2FA cifrados por el sistema' },
];

const formatDate = (value) => {
  if (!value) return 'Nunca';
  try {
    return new Intl.DateTimeFormat('es', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return 'Nunca';
  }
};

const formatSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function Backup() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);
  const [mode, setMode] = useState('merge');
  const [lastResult, setLastResult] = useState(null);
  const [settings, setSettings] = useState(null);
  const [backups, setBackups] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [portableInfo, setPortableInfo] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);

  const loadRuntimeInfo = async () => {
    const [nextSettings, nextBackups, nextPortable, nextUpdates] = await Promise.all([
      window.electronAPI?.getSettings?.(),
      window.electronAPI?.listBackups?.(),
      window.electronAPI?.getPortableInfo?.(),
      window.electronAPI?.checkForUpdates?.(),
    ]);
    if (nextSettings) setSettings(nextSettings);
    if (Array.isArray(nextBackups)) setBackups(nextBackups);
    if (nextPortable) setPortableInfo(nextPortable);
    if (nextUpdates) setUpdateInfo(nextUpdates);
  };

  useEffect(() => {
    loadRuntimeInfo().catch(() => {});
  }, []);

  const updateSetting = async (updates) => {
    const next = await window.electronAPI?.updateSettings?.(updates);
    if (next) setSettings(next);
  };

  const exportBackup = async () => {
    setBusy(true);
    try {
      const result = await window.electronAPI?.exportBackupFile?.();
      if (result?.canceled) return;
      if (result?.success) {
        setLastResult({ type: 'export', path: result.path });
        toast.success('Backup exportado', result.path);
      } else {
        toast.error('No se pudo exportar el backup', result?.error || '');
      }
    } catch (err) {
      toast.error('No se pudo exportar el backup', err.message);
    } finally {
      setBusy(false);
    }
  };

  const runLocalBackup = async () => {
    setBusy(true);
    try {
      const result = await window.electronAPI?.runBackupNow?.();
      if (result?.success) {
        setBackups(result.backups || []);
        setLastResult({ type: 'local', path: result.path });
        toast.success('Backup local creado', result.path);
      } else {
        toast.error('No se pudo crear el backup local', result?.error || '');
      }
    } catch (err) {
      toast.error('No se pudo crear el backup local', err.message);
    } finally {
      setBusy(false);
    }
  };

  const importBackup = async () => {
    setBusy(true);
    try {
      const result = await window.electronAPI?.importBackupFile?.({ mode });
      if (result?.canceled) return;
      if (result?.success) {
        setLastResult({ type: 'import', ...result });
        await loadRuntimeInfo();
        toast.success('Backup importado', `${result.apps || 0} apps, ${result.profiles || 0} perfiles`);
      } else {
        toast.error('No se pudo importar el backup', result?.error || '');
      }
    } catch (err) {
      toast.error('No se pudo importar el backup', err.message);
    } finally {
      setBusy(false);
    }
  };

  const runDiagnostics = async () => {
    setDiagBusy(true);
    try {
      const result = await window.electronAPI?.runDiagnostics?.();
      if (result?.success) {
        setDiagnostics(result);
        toast.success('Diagnostico completado', `${result.totals?.issues || 0} incidencias encontradas`);
      } else {
        toast.error('No se pudo ejecutar el diagnostico', result?.error || '');
      }
    } catch (err) {
      toast.error('No se pudo ejecutar el diagnostico', err.message);
    } finally {
      setDiagBusy(false);
    }
  };

  const repairShortcuts = async () => {
    setDiagBusy(true);
    try {
      const result = await window.electronAPI?.repairShortcuts?.();
      if (result?.success) {
        toast.success('Accesos directos reparados', `${result.repaired || 0} recreados`);
        await runDiagnostics();
      } else {
        toast.error('No se pudieron reparar los accesos', result?.error || '');
      }
    } finally {
      setDiagBusy(false);
    }
  };

  const healthTone = useMemo(() => {
    const score = diagnostics?.score ?? 100;
    if (score >= 90) return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 70) return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
    return 'text-red-300 bg-red-500/10 border-red-500/20';
  }, [diagnostics]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h2 className="text-base font-semibold text-white mb-0.5 flex items-center gap-2">
          <Archive size={16} className="text-violet-400" /> Backup, salud y portabilidad
        </h2>
        <p className="text-sm text-white/35 leading-relaxed max-w-3xl">
          Exporta la configuracion completa, mantiene copias locales y revisa problemas frecuentes antes de migrar o actualizar.
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {BACKUP_ITEMS.map(({ icon: Icon, label }) => (
          <div key={label} className="glass rounded-xl p-4 flex items-center gap-3 min-h-[76px]">
            <div className="w-9 h-9 rounded-xl bg-violet-600/15 text-violet-300 flex items-center justify-center">
              <Icon size={16} />
            </div>
            <p className="text-sm text-white/65 leading-snug">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-4">
        <section className="glass rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white/82">Exportar o importar backup completo</p>
              <p className="text-xs text-white/35 mt-1">
                Incluye apps, perfiles, workspaces, ajustes, scripts, snapshots y secretos cifrados.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={exportBackup} disabled={busy} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                {busy ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                Exportar
              </button>
              <button onClick={importBackup} disabled={busy} className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50">
                <Upload size={14} />
                Importar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              ['merge', 'Fusionar', 'Conserva lo actual y actualiza por ID cuando coincida.'],
              ['replace', 'Reemplazar', 'Sustituye apps, perfiles, workspaces y ajustes locales.'],
            ].map(([value, label, description]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  mode === value
                    ? 'bg-violet-600/18 border-violet-500/35 text-violet-200'
                    : 'bg-white/[0.025] border-white/[0.07] text-white/48 hover:text-white/72'
                }`}
              >
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-[11px] mt-1 leading-relaxed opacity-70">{description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="glass rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white/82 flex items-center gap-2">
                <HardDrive size={15} className="text-cyan-300" /> Backup automatico local
              </p>
              <p className="text-xs text-white/35 mt-1">Guarda copias periodicas en la carpeta de datos de AppSpawner.</p>
            </div>
            <button
              onClick={() => updateSetting({ autoBackupEnabled: !(settings?.autoBackupEnabled ?? true) })}
              className={`relative w-10 h-6 rounded-full transition-colors ${(settings?.autoBackupEnabled ?? true) ? 'bg-violet-600' : 'bg-white/12'}`}
            >
              <span className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform ${(settings?.autoBackupEnabled ?? true) ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-white/40">
              Intervalo (h)
              <input
                type="number"
                min="1"
                value={settings?.autoBackupIntervalHours ?? 24}
                onChange={e => updateSetting({ autoBackupIntervalHours: Number(e.target.value) || 24 })}
                className="input-field mt-1 w-full py-2 text-sm"
              />
            </label>
            <label className="text-xs text-white/40">
              Mantener
              <input
                type="number"
                min="1"
                value={settings?.autoBackupKeep ?? 10}
                onChange={e => updateSetting({ autoBackupKeep: Number(e.target.value) || 10 })}
                className="input-field mt-1 w-full py-2 text-sm"
              />
            </label>
          </div>

          <button onClick={runLocalBackup} disabled={busy} className="btn-ghost flex items-center justify-center gap-2 text-sm disabled:opacity-50">
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <Clock3 size={14} />}
            Crear backup local ahora
          </button>
        </section>
      </div>

      <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-4">
        <section className="glass rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white/82 flex items-center gap-2">
                <Stethoscope size={15} className="text-emerald-300" /> Diagnostico de salud
              </p>
              <p className="text-xs text-white/35 mt-1">
                Revisa shortcuts rotos, sesiones corruptas, iconos faltantes, URLs invalidas y duplicados.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={repairShortcuts} disabled={diagBusy} className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50">
                <Wrench size={14} /> Reparar
              </button>
              <button onClick={runDiagnostics} disabled={diagBusy} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                {diagBusy ? <RefreshCw size={14} className="animate-spin" /> : <Stethoscope size={14} />}
                Analizar
              </button>
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${healthTone}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Score de salud</span>
              <span className="text-2xl font-bold">{diagnostics?.score ?? '--'}</span>
            </div>
            <p className="text-xs opacity-75 mt-1">
              {diagnostics ? `${diagnostics.totals.issues} incidencias, ${diagnostics.totals.errors} criticas.` : 'Ejecuta un diagnostico para medir el estado local.'}
            </p>
          </div>

          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
            {!diagnostics?.issues?.length && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 flex items-center gap-2 text-sm text-white/45">
                <CheckCircle2 size={15} className="text-emerald-300" />
                Sin incidencias cargadas.
              </div>
            )}
            {diagnostics?.issues?.map((issue, index) => (
              <div key={`${issue.type}-${index}`} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className={issue.severity === 'error' ? 'text-red-300 mt-0.5' : 'text-amber-300 mt-0.5'} />
                  <div className="min-w-0">
                    <p className="text-sm text-white/75 font-medium">{issue.appName || issue.type}</p>
                    <p className="text-xs text-white/40 mt-0.5">{issue.message}</p>
                    {issue.path && <p className="text-[10px] text-white/25 mt-1 font-mono truncate">{issue.path}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-xl p-4 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-white/82 flex items-center gap-2">
              <PackageCheck size={15} className="text-violet-300" /> Actualizador y modo portable
            </p>
            <p className="text-xs text-white/35 mt-1">Estado de version, canal y ruta de datos actual.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <InfoTile label="Version" value={updateInfo?.currentVersion || '3.1.0'} />
            <InfoTile label="Canal" value={updateInfo?.channel || 'stable'} />
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-xs text-white/45 leading-relaxed">
            {updateInfo?.status || 'El actualizador integrado queda preparado para conectar un feed firmado en la build de distribucion.'}
          </div>

          <div className="divider" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white/82 flex items-center gap-2">
                <Laptop size={15} className="text-cyan-300" /> Modo portable
              </p>
              <p className="text-xs text-white/35 mt-1">
                Marca la instalacion para trabajar como portable cuando se empaquete con carpeta local de datos.
              </p>
            </div>
            <button
              onClick={async () => {
                await updateSetting({ portableMode: !(settings?.portableMode ?? false) });
                await loadRuntimeInfo();
              }}
              className={`relative w-10 h-6 rounded-full transition-colors ${(settings?.portableMode ?? false) ? 'bg-violet-600' : 'bg-white/12'}`}
            >
              <span className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform ${(settings?.portableMode ?? false) ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          <p className="text-[10px] text-white/25 font-mono leading-relaxed break-all">{portableInfo?.userDataPath || 'Ruta de datos no cargada'}</p>
        </section>
      </div>

      <section className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white/82">Backups locales recientes</p>
          <span className="text-xs text-white/30">{backups.length} archivos</span>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          {backups.slice(0, 6).map(backup => (
            <div key={backup.path} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 min-w-0">
              <p className="text-sm text-white/70 font-medium truncate">{backup.name}</p>
              <p className="text-xs text-white/35 mt-1">{formatDate(backup.modifiedAt)} - {formatSize(backup.size)}</p>
            </div>
          ))}
          {backups.length === 0 && <p className="text-sm text-white/35">Todavia no hay backups locales.</p>}
        </div>
      </section>

      <div className="glass rounded-xl p-4 border-amber-500/15 bg-amber-500/[0.03]">
        <p className="text-xs text-amber-200/75 leading-relaxed">
          Los secretos se exportan cifrados como estan guardados en este equipo. Restaurarlos en otro Windows puede depender
          de la disponibilidad de cifrado del sistema. Guarda el archivo de backup en un lugar privado.
        </p>
      </div>

      {lastResult && (
        <div className="glass rounded-xl p-3 text-xs text-white/45 animate-fade-in">
          {lastResult.type === 'export' || lastResult.type === 'local'
            ? <>Ultimo backup: <span className="text-white/70 font-mono">{lastResult.path}</span></>
            : <>Ultima importacion: {lastResult.apps} apps, {lastResult.profiles} perfiles, {lastResult.workspaces} workspaces.</>
          }
        </div>
      )}
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
      <p className="text-[10px] uppercase tracking-wider text-white/30">{label}</p>
      <p className="text-sm text-white/78 font-semibold mt-1 truncate">{value}</p>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, ShieldOff, Cookie, HardDrive, KeyRound,
  RefreshCw, Trash2, CheckCircle2, XCircle,
} from 'lucide-react';
import EmptyState   from './common/EmptyState';
import { useI18n }  from '../contexts/I18nContext';
import { formatBytes, formatRelativeTime } from '../lib/utils';

const ERROR_NAMES = {
  '-105': 'Dominio no resuelto (DNS)',
  '-106': 'Sin conexión a internet',
  '-109': 'Dirección inaccesible',
  '-201': 'Certificado inválido',
  '-202': 'Certificado caducado',
};

function errorLabel(code, desc) {
  return ERROR_NAMES[String(code)] || desc || `Error ${code}`;
}

function Section({ icon: Icon, title, value, children }) {
  return (
    <div className="glass rounded-xl p-3.5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-fg/60">
          <Icon size={14} />
          <p className="text-xs font-semibold uppercase tracking-wider">{title}</p>
        </div>
        {value != null && <span className="text-sm font-bold text-fg/80">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export default function AppDiagnostics({ app }) {
  const { language } = useI18n();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await window.electronAPI?.getAppDiagnostics(app.id);
    setData(r || null);
    setLoading(false);
  }, [app.id]);

  useEffect(() => { load(); }, [load]);

  const handleClearErrors = async () => {
    setClearing(true);
    await window.electronAPI?.clearDiagnosticErrors(app.id);
    await load();
    setClearing(false);
  };

  if (loading && !data) {
    return <EmptyState icon={RefreshCw} loading title="Analizando app…" compact />;
  }
  if (!data) {
    return <EmptyState icon={AlertTriangle} title="No se pudo obtener el diagnóstico" compact />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Section icon={ShieldOff} title="Bloqueados" value={data.blockedCount ?? 0} />
        <Section icon={Cookie}    title="Cookies"    value={data.cookieCount ?? 0} />
        <Section icon={HardDrive} title="Almacenamiento" value={formatBytes(data.storageBytes)} />
        <Section icon={KeyRound}  title="Permisos" value={data.permissions?.length ?? 0} />
      </div>

      {/* Errores de carga */}
      <div className="glass rounded-xl p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-fg/60">
            <AlertTriangle size={14} />
            <p className="text-xs font-semibold uppercase tracking-wider">Errores de carga</p>
          </div>
          {data.errors?.length > 0 && (
            <button
              onClick={handleClearErrors}
              disabled={clearing}
              className="flex items-center gap-1.5 text-[11px] text-fg/35 hover:text-red-400 transition-colors px-2 py-1"
            >
              <Trash2 size={11} /> Limpiar
            </button>
          )}
        </div>
        {data.errors?.length > 0 ? (
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto scrollbar-thin">
            {data.errors.map((e, i) => (
              <div key={i} className="rounded-lg bg-overlay/[0.04] px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-amber-400/90 truncate">{errorLabel(e.errorCode, e.errorDesc)}</p>
                  <span className="text-[10px] text-fg/25 flex-shrink-0">{formatRelativeTime(e.ts, language)}</span>
                </div>
                <p className="text-[10px] text-fg/30 truncate mt-0.5">{e.url}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-fg/30">Sin errores recientes</p>
        )}
      </div>

      {/* Permisos solicitados */}
      <div className="glass rounded-xl p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-2 text-fg/60">
          <KeyRound size={14} />
          <p className="text-xs font-semibold uppercase tracking-wider">Permisos solicitados</p>
        </div>
        {data.permissions?.length > 0 ? (
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto scrollbar-thin">
            {data.permissions.map((p, i) => (
              <div key={i} className="rounded-lg bg-overlay/[0.04] px-2.5 py-2 flex items-center gap-2.5">
                {p.granted
                  ? <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                  : <XCircle      size={13} className="text-red-400 flex-shrink-0" />}
                <p className="text-xs font-medium text-fg/65 flex-1 truncate">{p.permission}</p>
                <span className="text-[10px] text-fg/25 flex-shrink-0">{formatRelativeTime(p.ts, language)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-fg/30">Sin permisos solicitados todavía</p>
        )}
      </div>

      {/* Peticiones bloqueadas recientes */}
      <div className="glass rounded-xl p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-2 text-fg/60">
          <ShieldOff size={14} />
          <p className="text-xs font-semibold uppercase tracking-wider">Bloqueos recientes</p>
        </div>
        {data.blockLog?.length > 0 ? (
          <div className="flex flex-col gap-1 max-h-44 overflow-y-auto scrollbar-thin">
            {data.blockLog.map((b, i) => (
              <p key={i} className="text-[10px] text-fg/30 truncate font-mono">{b.hostname || b.url}</p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-fg/30">Sin bloqueos registrados</p>
        )}
      </div>
    </div>
  );
}

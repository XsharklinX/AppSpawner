import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, FolderOpen, FileText, Trash2, XCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { formatBytes, formatRelativeTime } from '../lib/utils';
import EmptyState from './common/EmptyState';

const STATE_META = {
  progressing: { icon: Loader2,       label: 'Descargando', color: 'text-violet-400',  spin: true  },
  completed:   { icon: CheckCircle2,  label: 'Completado',  color: 'text-emerald-400', spin: false },
  cancelled:   { icon: XCircle,       label: 'Cancelado',   color: 'text-fg/30',    spin: false },
  interrupted: { icon: XCircle,       label: 'Interrumpido', color: 'text-rose-400',   spin: false },
};

function DownloadRow({ item, onOpenFile, onOpenFolder, onRemove }) {
  const meta = STATE_META[item.state] || STATE_META.interrupted;
  const Icon = meta.icon;
  const pct  = item.totalBytes > 0 ? Math.min(100, Math.round((item.receivedBytes / item.totalBytes) * 100)) : null;
  const isDone = item.state !== 'progressing';

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-overlay/[0.03] transition-colors group">
      <div className="w-9 h-9 rounded-lg bg-overlay/[0.04] border border-line/[0.06] flex items-center justify-center flex-shrink-0">
        <FileText size={15} className="text-fg/40" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-fg/85 truncate" title={item.filename}>{item.filename || 'Descarga'}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Icon size={11} className={`${meta.color} ${meta.spin ? 'animate-spin' : ''}`} />
          <span className={`text-[11px] ${meta.color}`}>{meta.label}</span>
          <span className="text-[11px] text-fg/25">·</span>
          <span className="text-[11px] text-fg/30 truncate">{item.appName}</span>
          <span className="text-[11px] text-fg/25">·</span>
          <span className="text-[11px] text-fg/30">{formatRelativeTime(item.startedAt)}</span>
        </div>
        {item.state === 'progressing' && (
          <div className="mt-1.5 h-1 rounded-full bg-overlay/[0.06] overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: pct !== null ? `${pct}%` : '40%' }}
            />
          </div>
        )}
        <p className="text-[11px] text-fg/25 mt-1">
          {formatBytes(item.receivedBytes)}{item.totalBytes > 0 ? ` / ${formatBytes(item.totalBytes)}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {isDone && item.state === 'completed' && (
          <>
            <button onClick={() => onOpenFile(item.id)} title="Abrir archivo"
              className="p-2 rounded-lg text-fg/30 hover:text-fg/70 hover:bg-overlay/[0.06] transition-colors">
              <FileText size={14} />
            </button>
            <button onClick={() => onOpenFolder(item.id)} title="Abrir carpeta"
              className="p-2 rounded-lg text-fg/30 hover:text-fg/70 hover:bg-overlay/[0.06] transition-colors">
              <FolderOpen size={14} />
            </button>
          </>
        )}
        {isDone && (
          <button onClick={() => onRemove(item.id)} title="Quitar de la lista"
            className="p-2 rounded-lg text-fg/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Downloads({ onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const list = await window.electronAPI?.listDownloads?.() ?? [];
    setItems(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const u1 = window.electronAPI?.onDownloadStarted?.((rec) => setItems(prev => [rec, ...prev]));
    const u2 = window.electronAPI?.onDownloadProgress?.((data) => setItems(prev => prev.map(it =>
      it.id === data.id ? { ...it, receivedBytes: data.receivedBytes, totalBytes: data.totalBytes, state: data.state } : it
    )));
    const u3 = window.electronAPI?.onDownloadDone?.((rec) => setItems(prev => prev.map(it => it.id === rec.id ? rec : it)));
    return () => { u1?.(); u2?.(); u3?.(); };
  }, []);

  const handleOpenFile   = (id) => window.electronAPI?.openDownloadFile?.(id);
  const handleOpenFolder = (id) => window.electronAPI?.openDownloadFolder?.(id);
  const handleRemove     = async (id) => { await window.electronAPI?.removeDownload?.(id); setItems(prev => prev.filter(it => it.id !== id)); };
  const handleClear      = async () => { await window.electronAPI?.clearDownloads?.(); await load(); };

  const hasFinished = items.some(it => it.state !== 'progressing');

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-line/[0.08] flex flex-col"
        style={{ background: '#111118', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-line/[0.06]">
          <div className="flex items-center gap-2.5">
            <Download size={16} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-fg/85">Descargas</h2>
            {items.length > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-overlay/[0.06] text-fg/40">{items.length}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasFinished && (
              <button onClick={handleClear} className="text-[11px] text-fg/35 hover:text-fg/70 transition-colors px-2 py-1 rounded-lg hover:bg-overlay/[0.05]">
                Limpiar completadas
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-fg/30 hover:text-fg/70 hover:bg-overlay/[0.06] transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-line/[0.04]">
          {loading ? (
            <EmptyState loading title="Cargando…" />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Download}
              title="Sin descargas todavía"
              description="Las descargas de todas tus apps aparecerán aquí, sin importar desde cuál las inicies."
            />
          ) : (
            items.map(item => (
              <DownloadRow
                key={item.id}
                item={item}
                onOpenFile={handleOpenFile}
                onOpenFolder={handleOpenFolder}
                onRemove={handleRemove}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, RefreshCw, HardDrive, AlertCircle } from 'lucide-react';
import AppIcon    from '../../components/common/AppIcon';
import { useApps }   from '../../contexts/AppContext';
import { useI18n }   from '../../contexts/I18nContext';
import { useToast }  from '../../contexts/ToastContext';
import { formatBytes } from '../../lib/utils';

export default function Storage() {
  const { uninstallApp } = useApps();
  const { t }             = useI18n();
  const toast             = useToast();

  const [storageData, setStorageData] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [clearing,    setClearing]    = useState({});
  const [confirm,     setConfirm]     = useState({});

  const loadStorage = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI?.getStorageInfo() ?? [];
      setStorageData(data);
    } catch {
      setStorageData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStorage(); }, [loadStorage]);

  const handleClearData = async (app) => {
    if (!confirm[app.id]) {
      setConfirm(prev => ({ ...prev, [app.id]: true }));
      setTimeout(() => setConfirm(prev => ({ ...prev, [app.id]: false })), 3000);
      return;
    }
    setClearing(prev => ({ ...prev, [app.id]: 'clear' }));
    try {
      await window.electronAPI?.clearAppData(app.id);
      toast.success(t('toast_cleared'), app.name);
      await loadStorage();
    } catch (e) {
      toast.error(t('error'), e.message);
    } finally {
      setClearing(prev => ({ ...prev, [app.id]: null }));
      setConfirm(prev => ({ ...prev, [app.id]: false }));
    }
  };

  const handleUninstall = async (app) => {
    if (!confirm[`del_${app.id}`]) {
      setConfirm(prev => ({ ...prev, [`del_${app.id}`]: true }));
      setTimeout(() => setConfirm(prev => ({ ...prev, [`del_${app.id}`]: false })), 3000);
      return;
    }
    await uninstallApp(app.id);
  };

  const totalBytes = storageData.reduce((s, a) => s + (a.storageBytes || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-fg mb-0.5">{t('set_storage')}</h2>
          <p className="text-sm text-fg/35">{t('stor_desc')}</p>
        </div>
        <button
          onClick={loadStorage}
          className="btn-ghost flex items-center gap-2 text-xs"
          title="Refrescar"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Resumen total */}
      {totalBytes > 0 && (
        <div className="glass rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-overlay/[0.05] flex items-center justify-center">
            <HardDrive size={17} className="text-fg/50" />
          </div>
          <div>
            <p className="text-xs text-fg/35">Total en disco (datos de sesión)</p>
            <p className="text-base font-bold text-fg/80">{formatBytes(totalBytes)}</p>
          </div>
        </div>
      )}

      {/* Lista de apps */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : storageData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <AlertCircle size={24} className="text-fg/15" />
          <p className="text-sm text-fg/30">No hay apps instaladas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {storageData.map(app => (
            <StorageRow
              key={app.id}
              app={app}
              t={t}
              confirm={confirm}
              clearing={clearing[app.id]}
              onClear={() => handleClearData(app)}
              onUninstall={() => handleUninstall(app)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StorageRow({ app, t, confirm, clearing, onClear, onUninstall }) {
  const bytes = app.storageBytes || 0;
  return (
    <div className="glass rounded-xl p-3.5 flex items-center gap-3 hover:border-line/[0.09] transition-colors">
      <AppIcon
        iconType={app.iconType}
        iconValue={app.iconValue}
        iconColor={app.iconColor}
        name={app.name}
        size={36}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-fg/80 truncate">{app.name}</p>
        <p className="text-xs text-fg/30 mt-0.5">
          {bytes > 0 ? formatBytes(bytes) : t('stor_no_data')}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {bytes > 0 && (
          <button
            onClick={onClear}
            disabled={!!clearing}
            className={`
              flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg
              transition-all duration-150 active:scale-95
              ${confirm[app.id]
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/25'
                : 'bg-overlay/[0.04] text-fg/40 hover:text-fg/70 border border-line/[0.06]'
              }
            `}
          >
            <Trash2 size={11} />
            {confirm[app.id] ? t('confirm') : t('stor_clear')}
          </button>
        )}
        <button
          onClick={onUninstall}
          className={`
            flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg
            transition-all duration-150 active:scale-95
            ${confirm[`del_${app.id}`]
              ? 'bg-red-500/25 text-red-400 border border-red-500/30'
              : 'bg-overlay/[0.04] text-fg/35 hover:text-red-400/70 border border-line/[0.06]'
            }
          `}
        >
          <Trash2 size={11} />
          {confirm[`del_${app.id}`] ? t('confirm') : t('stor_uninstall')}
        </button>
      </div>
    </div>
  );
}

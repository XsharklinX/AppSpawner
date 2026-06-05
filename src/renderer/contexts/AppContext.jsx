import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from './ToastContext';
import { useI18n }  from './I18nContext';

const AppContext = createContext(null);

const initialState = { apps: [], loading: false, error: null, openWindows: new Set(), badgeCounts: {} };

function appReducer(state, action) {
  switch (action.type) {
    case 'LOAD_START':   return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS': return { ...state, loading: false, apps: action.apps };
    case 'LOAD_ERROR':   return { ...state, loading: false, error: action.error };
    case 'ADD_APP':      return { ...state, apps: [...state.apps, action.app] };
    case 'REMOVE_APP':   return { ...state, apps: state.apps.filter(a => a.id !== action.id) };
    case 'UPDATE_APP':   return { ...state, apps: state.apps.map(a => a.id === action.id ? { ...a, ...action.updates } : a) };
    case 'MARK_LAUNCHED': {
      const next = new Set(state.openWindows); next.add(action.id);
      return {
        ...state,
        apps: state.apps.map(a => a.id === action.id
          ? { ...a, lastUsed: Date.now(), openCount: (a.openCount || 0) + 1 }
          : a),
        openWindows: next,
      };
    }
    case 'WINDOW_CLOSED': {
      const next = new Set(state.openWindows); next.delete(action.id);
      const counts = { ...state.badgeCounts };
      delete counts[action.id];
      return { ...state, openWindows: next, badgeCounts: counts };
    }
    case 'UPDATE_BADGE':
      return { ...state, badgeCounts: { ...state.badgeCounts, [action.appId]: action.count } };
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const toast      = useToast();
  const { t }      = useI18n();
  const loadingRef = useRef(false);
  const pinResolverRef = useRef(null);
  const [pinDialog, setPinDialog] = useState(null);
  const [pinInput, setPinInput] = useState('');

  useEffect(() => { loadApps(); }, []);

  useEffect(() => {
    const unsub = window.electronAPI?.onAppWindowClosed?.((id) => dispatch({ type: 'WINDOW_CLOSED', id }));
    return () => unsub?.();
  }, []);

  useEffect(() => {
    const unsub = window.electronAPI?.onBadgeUpdate?.((data) =>
      dispatch({ type: 'UPDATE_BADGE', appId: data.appId, count: data.count })
    );
    return () => unsub?.();
  }, []);

  const requestPin = useCallback((appName) => new Promise(resolve => {
    pinResolverRef.current = resolve;
    setPinInput('');
    setPinDialog({ appName });
  }), []);

  const closePinDialog = useCallback((value = null) => {
    pinResolverRef.current?.(value);
    pinResolverRef.current = null;
    setPinDialog(null);
    setPinInput('');
  }, []);

  const loadApps = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    dispatch({ type: 'LOAD_START' });
    try {
      const apps = await window.electronAPI?.getApps() ?? JSON.parse(localStorage.getItem('as_apps') || '[]');
      dispatch({ type: 'LOAD_SUCCESS', apps });
    } catch (err) {
      dispatch({ type: 'LOAD_ERROR', error: err.message });
    } finally { loadingRef.current = false; }
  }, []);

  const installApp = useCallback(async (config, { createShortcuts = true } = {}) => {
    let newApp;
    try {
      newApp = await window.electronAPI?.installApp(config);
      if (!newApp) throw new Error('Sin respuesta del backend');
      dispatch({ type: 'ADD_APP', app: newApp });
      if (createShortcuts) {
        const shortcutResult = await window.electronAPI?.createShortcuts(newApp.id);
        const failedShortcut = Object.values(shortcutResult?.results || {}).find(result => result?.success === false);
        if (shortcutResult?.success === false || failedShortcut) {
          toast.error('No se pudo crear el acceso directo', shortcutResult?.error || failedShortcut?.error || newApp.name);
        }
      }
      window.electronAPI?.refreshTray?.();
      toast.success(`"${newApp.name}" ${t('toast_installed')}`, t('success'));
      return newApp;
    } catch (err) {
      if (newApp) dispatch({ type: 'REMOVE_APP', id: newApp.id });
      toast.error(t('toast_error_install'), err.message);
      throw err;
    }
  }, [toast, t]);

  const uninstallApp = useCallback(async (appId) => {
    const app = state.apps.find(a => a.id === appId);
    if (!app) return;
    try {
      dispatch({ type: 'REMOVE_APP', id: appId });
      await window.electronAPI?.removeShortcuts(appId).catch(() => {});
      await window.electronAPI?.uninstallApp(appId);
      window.electronAPI?.refreshTray?.();
      toast.success(`"${app.name}" ${t('toast_uninstalled')}`, t('success'));
    } catch (err) {
      dispatch({ type: 'ADD_APP', app });
      toast.error(t('toast_error_uninstall'), err.message);
      throw err;
    }
  }, [state.apps, toast, t]);

  const updateApp = useCallback(async (appId, updates) => {
    try {
      const updated = await window.electronAPI?.updateApp(appId, updates);
      dispatch({ type: 'UPDATE_APP', id: appId, updates });
      if (['name', 'url', 'iconType', 'iconValue', 'iconColor'].some(key => Object.hasOwn(updates, key))) {
        window.electronAPI?.createShortcuts(appId).catch(() => {});
      }
      toast.success(t('toast_updated'), updated?.name ?? '');
      return updated;
    } catch (err) { toast.error(t('error'), err.message); throw err; }
  }, [toast, t]);

  const launchApp = useCallback(async (appId) => {
    try {
      const app = state.apps.find(a => a.id === appId);
      let options = {};
      if (app?.security?.locked) {
        const pin = await requestPin(app.name);
        if (!pin) return;
        options.pin = pin;
      }
      const result = await window.electronAPI?.launchApp(appId, options);
      if (result && result.success === false) {
        throw new Error(result.error || 'No se pudo abrir la app');
      }
      dispatch({ type: 'MARK_LAUNCHED', id: appId });
    } catch (err) {
      toast.error(err.message || t('toast_error_launch'), state.apps.find(a => a.id === appId)?.name ?? '');
      throw err;
    }
  }, [state.apps, toast, t, requestPin]);

  const togglePin = useCallback(async (appId) => {
    try {
      const result = await window.electronAPI?.togglePin(appId);
      dispatch({ type: 'UPDATE_APP', id: appId, updates: { pinned: result?.pinned } });
    } catch (err) { toast.error(t('error'), err.message); }
  }, [toast, t]);

  const sortedApps = React.useMemo(() =>
    [...state.apps].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return  1;
      return (b.lastUsed || 0) - (a.lastUsed || 0);
    }), [state.apps]);

  const recentApps = React.useMemo(() =>
    [...state.apps].filter(a => a.lastUsed).sort((a, b) => b.lastUsed - a.lastUsed).slice(0, 5),
    [state.apps]);

  return (
    <AppContext.Provider value={{
      apps: sortedApps, rawApps: state.apps, recentApps,
      loading: state.loading, error: state.error, openWindows: state.openWindows,
      badgeCounts: state.badgeCounts,
      installApp, uninstallApp, updateApp, launchApp, togglePin, loadApps,
      isInstalled:  (catalogId) => state.apps.some(a => a.catalogId === catalogId),
      isWindowOpen: (appId)     => state.openWindows.has(appId),
    }}>
      {children}
      {pinDialog && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass rounded-2xl border border-white/[0.08] shadow-card-hover p-5">
            <p className="text-base font-semibold text-white">App protegida</p>
            <p className="text-sm text-white/40 mt-1">Introduce el PIN para abrir {pinDialog.appName}.</p>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 12))}
              onKeyDown={e => {
                if (e.key === 'Enter' && pinInput.length >= 4) closePinDialog(pinInput);
                if (e.key === 'Escape') closePinDialog(null);
              }}
              className="input-field mt-4 text-center text-lg tracking-[0.3em]"
              placeholder="PIN"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => closePinDialog(null)} className="btn-ghost text-sm flex-1">Cancelar</button>
              <button onClick={() => closePinDialog(pinInput)} disabled={pinInput.length < 4} className="btn-primary text-sm flex-1 disabled:opacity-40">Desbloquear</button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useApps() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApps debe usarse dentro de <AppProvider>');
  return ctx;
}

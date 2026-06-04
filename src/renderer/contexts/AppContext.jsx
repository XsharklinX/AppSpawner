import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
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
      if (createShortcuts) window.electronAPI?.createShortcuts(newApp.id).catch(() => {});
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
      toast.success(t('toast_updated'), updated?.name ?? '');
      return updated;
    } catch (err) { toast.error(t('error'), err.message); throw err; }
  }, [toast, t]);

  const launchApp = useCallback(async (appId) => {
    try {
      await window.electronAPI?.launchApp(appId);
      dispatch({ type: 'MARK_LAUNCHED', id: appId });
    } catch (err) {
      toast.error(t('toast_error_launch'), state.apps.find(a => a.id === appId)?.name ?? '');
      throw err;
    }
  }, [state.apps, toast, t]);

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
    </AppContext.Provider>
  );
}

export function useApps() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApps debe usarse dentro de <AppProvider>');
  return ctx;
}

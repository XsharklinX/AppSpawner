import React, { createContext, useContext, useCallback, useReducer, useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useSound } from './SoundContext';

/**
 * ToastContext — Sistema de notificaciones flotantes.
 * Tipos: 'success' | 'error' | 'warning' | 'info'
 */

const ToastContext = createContext(null);
const AUTO_DISMISS_MS = 4000;

function toastReducer(state, action) {
  switch (action.type) {
    case 'ADD':    return [...state, action.toast];
    case 'REMOVE': return state.filter(t => t.id !== action.id);
    case 'CLEAR':  return [];
    default:       return state;
  }
}

const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertCircle,
  info:    Info,
};

const COLORS = {
  success: 'border-emerald-500/40 bg-emerald-500/10',
  error:   'border-red-500/40    bg-red-500/10',
  warning: 'border-amber-500/40  bg-amber-500/10',
  info:    'border-blue-500/40   bg-blue-500/10',
};

const ICON_COLORS = {
  success: 'text-emerald-400',
  error:   'text-red-400',
  warning: 'text-amber-400',
  info:    'text-blue-400',
};

let toastId = 0;

function Toast({ toast, onDismiss }) {
  const Icon     = ICONS[toast.type]   || Info;
  const colorCls = COLORS[toast.type]  || COLORS.info;
  const iconCls  = ICON_COLORS[toast.type] || ICON_COLORS.info;

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl
        shadow-card max-w-sm w-full
        glass ${colorCls}
        animate-toast-in
      `}
      role="alert"
    >
      <Icon size={18} className={`${iconCls} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-semibold text-fg mb-0.5">{toast.title}</p>
        )}
        <p className="text-sm text-fg/70 leading-snug">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="no-drag flex-shrink-0 text-fg/30 hover:text-fg/70 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const timers = useRef(new Map());
  const { playSound } = useSound();

  const dismiss = useCallback((id) => {
    dispatch({ type: 'REMOVE', id });
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const toast = useCallback(({ type = 'info', title, message, duration = AUTO_DISMISS_MS }) => {
    const id = ++toastId;
    dispatch({ type: 'ADD', toast: { id, type, title, message } });
    playSound(type === 'info' ? 'notification' : type);

    if (duration > 0) {
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    }
    return id;
  }, [dismiss, playSound]);

  // API de conveniencia
  const success = useCallback((msg, title) => toast({ type: 'success', message: msg, title }), [toast]);
  const error   = useCallback((msg, title) => toast({ type: 'error',   message: msg, title, duration: 6000 }), [toast]);
  const warning = useCallback((msg, title) => toast({ type: 'warning', message: msg, title }), [toast]);
  const info    = useCallback((msg, title) => toast({ type: 'info',    message: msg, title }), [toast]);

  // Limpiar timers al desmontar
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}

      {/* Portal de toasts: esquina inferior derecha */}
      <div
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

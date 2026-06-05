import React, { useState, useCallback, useEffect } from 'react';
import { Play, Settings2, Trash2, Clock, Pin, PinOff, Camera, Code2, Shield, Share2, LogIn } from 'lucide-react';
import AppIcon               from './AppIcon';
import Modal                 from './Modal';
import SessionSnapshots      from '../SessionSnapshots';
import AppScripts            from '../AppScripts';
import SecurityCenter        from '../SecurityCenter';
import { useApps }            from '../../contexts/AppContext';
import { useI18n }            from '../../contexts/I18nContext';
import { useToast }           from '../../contexts/ToastContext';
import { formatRelativeTime } from '../../lib/utils';

/**
 * AppCard — Tarjeta de app instalada. Memoizada con React.memo
 * para evitar re-renders innecesarios cuando cambian otras apps.
 */
const AppCard = React.memo(function AppCard({ app, onEdit }) {
  const [hovered,      setHovered]      = useState(false);
  const [launching,    setLaunching]    = useState(false);
  const [confirm,      setConfirm]      = useState(false);
  const [loginAlert,   setLoginAlert]   = useState(false);
  const [showSessions,  setShowSessions]  = useState(false);
  const [showScripts,   setShowScripts]   = useState(false);
  const [showSecurity,  setShowSecurity]  = useState(false);

  const { launchApp, uninstallApp, togglePin, isWindowOpen, badgeCounts } = useApps();
  const { t, language } = useI18n();
  const toast = useToast();

  const windowOpen     = isWindowOpen(app.id);
  const relativeTime   = formatRelativeTime(app.lastUsed, language);
  const badgeCount     = badgeCounts?.[app.id] || 0;

  const handleLaunch = useCallback(async (e) => {
    e?.stopPropagation?.();
    if (launching) return;
    setLaunching(true);
    try {
      await launchApp(app.id);
    } finally {
      // Mantener spinner un momento para que el usuario vea el feedback
      setTimeout(() => setLaunching(false), 800);
    }
  }, [launching, launchApp, app.id]);

  const handleUninstall = useCallback(async (e) => {
    e.stopPropagation();
    if (!confirm) {
      setConfirm(true);
      setTimeout(() => setConfirm(false), 3500);
      return;
    }
    await uninstallApp(app.id);
  }, [confirm, uninstallApp, app.id]);

  const handlePin = useCallback((e) => {
    e.stopPropagation();
    togglePin(app.id);
  }, [togglePin, app.id]);

  // Escuchar eventos de "login form detectado" del main process
  useEffect(() => {
    const unsub = window.electronAPI?.onLoginFormDetected?.((data) => {
      if (data.appId === app.id) setLoginAlert(true);
    });
    return () => unsub?.();
  }, [app.id]);

  const handleEasyLogin = useCallback(async (e) => {
    e.stopPropagation();
    await window.electronAPI?.openLoginWindow(app.id);
  }, [app]);

  const handleShare = useCallback((e) => {
    e.stopPropagation();
    const params = new URLSearchParams({ url: app.url, name: app.name, category: app.category || 'general', iconColor: app.iconColor });
    navigator.clipboard.writeText(`appspawner://install?${params.toString()}`);
    toast.success('Enlace copiado', 'Compártelo para instalar esta app');
  }, [app, toast]);

  return (
    <>
    <div
      className={`
        relative glass rounded-2xl overflow-hidden cursor-pointer group
        transition-all duration-200 min-h-[178px]
        ${hovered ? 'shadow-card-hover -translate-y-[3px] border-white/[0.12]' : 'shadow-card'}
        ${app.pinned ? 'ring-1 ring-violet-500/25' : ''}
      `}
      onMouseEnter={() => { setHovered(true); setConfirm(false); }}
      onMouseLeave={() => { setHovered(false); setConfirm(false); }}
      onClick={handleLaunch}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleLaunch(e)}
      aria-label={`${t('dash_launch')} ${app.name}`}
    >
      {/* Franja de color superior (identidad de la app) */}
      <div
        className="absolute top-0 left-0 right-0 h-1 opacity-70"
        style={{ background: app.iconColor }}
      />

      {/* Glow ambiental */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${app.iconColor}20 0%, transparent 60%)` }}
      />

      {/* Indicador ventana abierta */}
      {windowOpen && (
        <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      )}

      {/* Pin */}
      {app.pinned && !hovered && (
        <div className="absolute top-3 right-3 z-10">
          <Pin size={10} className="text-violet-400/70" />
        </div>
      )}

      {/* ── Contenido ──────────────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-3 p-4 pt-5 min-h-[178px]">
        {/* Ícono */}
        <div className="relative self-start">
          <AppIcon
            iconType={app.iconType} iconValue={app.iconValue}
            iconColor={app.iconColor} name={app.name} url={app.url}
            size={52}
            className={`transition-transform duration-200 ${hovered ? 'scale-[1.08]' : ''}`}
          />
          {badgeCount > 0 && (
            <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white leading-none border-2 border-surface-base pointer-events-none">
              {badgeCount > 99 ? '99+' : badgeCount}
            </div>
          )}
        </div>

        {/* Nombre */}
        <div>
          <h3 className="text-sm font-bold text-white/90 leading-tight truncate">
            {app.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="category-badge capitalize">{app.category || 'general'}</span>
            {app.accountLabel && (
              <span className="text-[9px] font-medium text-violet-400/80 bg-violet-500/10 px-1.5 py-0.5 rounded-full border border-violet-500/20 leading-none">
                {app.accountLabel}
              </span>
            )}
          </div>
        </div>

        {/* Último uso */}
        <div className="flex items-center gap-1.5 mt-auto border-t border-white/[0.05] pt-3">
          <Clock size={10} className="text-white/18 flex-shrink-0" />
          <span className="text-[10px] text-white/28 truncate">{relativeTime}</span>
          {app.openCount > 0 && (
            <span className="text-[10px] text-white/18 ml-auto">{app.openCount}×</span>
          )}
        </div>
      </div>

      {/* ── Overlay ────────────────────────────────────────────────────── */}
      <div
        className={`
          absolute inset-0 flex flex-col gap-2 p-3.5
          transition-opacity duration-150
          ${hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        style={{ background: 'rgba(12,12,18,0.96)', backdropFilter: 'blur(8px)' }}
      >
        {/* Abrir — botón principal */}
        <button
          onClick={handleLaunch}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 active:scale-[0.97] text-white text-sm font-semibold rounded-xl py-3 transition-all flex-shrink-0 shadow-glow-sm"
        >
          {launching
            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Play size={14} fill="currentColor" />
          }
          {windowOpen ? 'Traer al frente' : t('dash_launch')}
        </button>

        {/* Acciones secundarias */}
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onEdit?.(app); }}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-white/55 hover:text-white/90 bg-white/[0.05] hover:bg-white/[0.09] rounded-xl py-2.5 transition-all"
          >
            <Settings2 size={13} /> Editar
          </button>
          <button
            onClick={handlePin}
            className={`flex items-center justify-center rounded-xl px-3 py-2.5 transition-all ${
              app.pinned ? 'bg-violet-600/25 text-violet-400' : 'bg-white/[0.05] text-white/40 hover:text-violet-400'
            }`}
            title={app.pinned ? 'Desfijar' : 'Fijar'}
          >
            {app.pinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
          <button
            onClick={handleUninstall}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
              confirm ? 'bg-red-500/80 text-white' : 'bg-white/[0.05] text-white/35 hover:text-red-400'
            }`}
            title={t('dash_uninstall')}
          >
            <Trash2 size={13} />
            {confirm && 'Seguro'}
          </button>
        </div>

        {/* Herramientas */}
        <div className="flex gap-1.5 flex-shrink-0 mt-auto">
          {[
            { icon: Camera, label: 'Sesiones',     fn: e => { e.stopPropagation(); setShowSessions(true); } },
            { icon: Code2,  label: 'Scripts',       fn: e => { e.stopPropagation(); setShowScripts(true); } },
            { icon: Shield, label: 'Seguridad',     fn: e => { e.stopPropagation(); setShowSecurity(true); setLoginAlert(false); }, alert: loginAlert },
            { icon: Share2, label: 'Compartir',     fn: handleShare },
            { icon: LogIn,  label: 'Easy Login',    fn: handleEasyLogin },
          ].map(({ icon: Icon, label, fn, alert }) => (
            <button key={label} onClick={fn} title={label}
              className="relative flex-1 flex items-center justify-center py-2 rounded-lg bg-white/[0.04] hover:bg-violet-600/20 text-white/30 hover:text-violet-400 transition-all"
            >
              <Icon size={13} />
              {alert && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-violet-400" />}
            </button>
          ))}
        </div>
      </div>
    </div>
    <Modal isOpen={showSessions} onClose={() => setShowSessions(false)} title={`Sesiones — ${app.name}`} size="lg">
      <SessionSnapshots app={app} onClose={() => setShowSessions(false)} />
    </Modal>
    <Modal isOpen={showScripts} onClose={() => setShowScripts(false)} title={`Scripts — ${app.name}`} size="xl">
      <AppScripts app={app} />
    </Modal>
    <Modal isOpen={showSecurity} onClose={() => setShowSecurity(false)} title={`Seguridad — ${app.name}`} size="xl">
      <SecurityCenter app={app} />
    </Modal>
    </>
  );
}, (prev, next) => {
  // Comparación personalizada: solo re-renderizar si la app cambia
  return prev.app === next.app && prev.onEdit === next.onEdit;
});

export default AppCard;

import React, { useState, useCallback, useEffect } from 'react';
import { Shield, Code2, KeyRound, BadgeCheck, LockKeyhole, Network, PanelTop } from 'lucide-react';
import { useApps }            from '../../../contexts/AppContext';
import { useI18n }            from '../../../contexts/I18nContext';
import { useToast }           from '../../../contexts/ToastContext';
import { useSound }           from '../../../contexts/SoundContext';
import { formatRelativeTime } from '../../../lib/utils';
import AppCardList        from './AppCardList';
import AppCardCompact     from './AppCardCompact';
import AppCardComfortable from './AppCardComfortable';

/**
 * AppCard — Tarjeta de app instalada. Memoizada con React.memo
 * para evitar re-renders innecesarios cuando cambian otras apps.
 *
 * density: 'comfortable' | 'compact' | 'list'
 */
const AppCard = React.memo(function AppCard({
  app, onEdit, onOpenTools, density = 'comfortable',
  selectionMode = false, selected = false, onToggleSelect, hasProblem = false,
}) {
  const [hovered,      setHovered]      = useState(false);
  const [launching,    setLaunching]    = useState(false);
  const [confirm,      setConfirm]      = useState(false);
  const [loginAlert,   setLoginAlert]   = useState(false);
  const [toolState,    setToolState]    = useState({ scripts: false, vault: false, totp: false });

  const { launchApp, uninstallApp, togglePin, toggleFavorite, isWindowOpen, badgeCounts } = useApps();
  const { t, language } = useI18n();
  const toast = useToast();
  const { playSound, vibrate } = useSound();

  const windowOpen     = isWindowOpen(app.id);
  const relativeTime   = formatRelativeTime(app.lastUsed, language);
  const badgeCount     = badgeCounts?.[app.id] || 0;

  useEffect(() => {
    let alive = true;
    Promise.all([
      window.electronAPI?.getScripts?.(app.id).catch(() => null),
      window.electronAPI?.listCredentials?.(app.id).catch(() => []),
      window.electronAPI?.listTotp?.(app.id).catch(() => []),
    ]).then(([scripts, creds, totp]) => {
      if (!alive) return;
      setToolState({
        scripts: !!scripts && scripts.enabled !== false && !!((scripts.css || '').trim() || (scripts.js || '').trim()),
        vault: Array.isArray(creds) && creds.length > 0,
        totp: Array.isArray(totp) && totp.length > 0,
      });
    });
    return () => { alive = false; };
  }, [app.id]);

  const statusItems = [
    { key: 'adblock', active: app.adblockEnabled !== false, icon: Shield, label: 'AdBlock' },
    { key: 'scripts', active: toolState.scripts, icon: Code2, label: 'Scripts' },
    { key: 'vault', active: toolState.vault, icon: KeyRound, label: 'Vault' },
    { key: 'totp', active: toolState.totp, icon: BadgeCheck, label: '2FA' },
    { key: 'pin', active: !!app.security?.locked, icon: LockKeyhole, label: 'PIN' },
    { key: 'proxy', active: !!app.proxy?.enabled, icon: Network, label: 'Proxy' },
    { key: 'toolbar', active: !!app.toolbar?.enabled, icon: PanelTop, label: 'Toolbar' },
  ].filter(item => item.active);

  const handleLaunch = useCallback(async (e) => {
    e?.stopPropagation?.();
    if (selectionMode) { onToggleSelect?.(app.id); return; }
    if (launching) return;
    setLaunching(true);
    playSound('launch');
    vibrate(12);
    try {
      await launchApp(app.id);
    } finally {
      // Mantener spinner un momento para que el usuario vea el feedback
      setTimeout(() => setLaunching(false), 800);
    }
  }, [launching, launchApp, app.id, selectionMode, onToggleSelect, playSound, vibrate]);

  const handleUninstall = useCallback(async (e) => {
    e.stopPropagation();
    if (!confirm) {
      setConfirm(true);
      setTimeout(() => setConfirm(false), 3500);
      return;
    }
    playSound('delete');
    vibrate(15);
    await uninstallApp(app.id);
  }, [confirm, uninstallApp, app.id, playSound, vibrate]);

  const handlePin = useCallback((e) => {
    e.stopPropagation();
    playSound(app.pinned ? 'toggleOff' : 'toggleOn');
    vibrate(8);
    togglePin(app.id);
  }, [togglePin, app.id, app.pinned, playSound, vibrate]);

  const handleFavorite = useCallback((e) => {
    e.stopPropagation();
    playSound(app.favorite ? 'toggleOff' : 'toggleOn');
    vibrate(8);
    toggleFavorite(app.id);
  }, [toggleFavorite, app.id, app.favorite, playSound, vibrate]);

  const handleSelect = useCallback((e) => {
    e.stopPropagation();
    onToggleSelect?.(app.id);
  }, [onToggleSelect, app.id]);

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

  const sharedProps = {
    app, hovered, setHovered, confirm, setConfirm, selected, selectionMode,
    windowOpen, relativeTime, badgeCount, statusItems, launching, hasProblem,
    loginAlert, setLoginAlert, t, language,
    onEdit, onOpenTools, onSelect: handleSelect,
    handleLaunch, handleUninstall, handlePin, handleFavorite, handleEasyLogin, handleShare,
  };

  if (density === 'list')    return <AppCardList {...sharedProps} />;
  if (density === 'compact') return <AppCardCompact {...sharedProps} />;
  return <AppCardComfortable {...sharedProps} />;
}, (prev, next) => {
  // Comparación personalizada: solo re-renderizar si la app o las props de presentación cambian
  return prev.app === next.app
    && prev.onEdit === next.onEdit
    && prev.onOpenTools === next.onOpenTools
    && prev.density === next.density
    && prev.selectionMode === next.selectionMode
    && prev.selected === next.selected
    && prev.onToggleSelect === next.onToggleSelect
    && prev.hasProblem === next.hasProblem;
});

export default AppCard;

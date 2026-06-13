import React from 'react';
import { Play, Settings2, Trash2, Clock, Star, AlertTriangle } from 'lucide-react';
import AppIcon from '../AppIcon';
import { SelectionCheckbox, FavoriteBadge } from './shared';

export default function AppCardCompact({
  app, hovered, setHovered, confirm, setConfirm, selected, selectionMode,
  windowOpen, relativeTime, badgeCount, launching, hasProblem, t,
  onEdit, onSelect, handleLaunch, handleUninstall, handleFavorite,
}) {
  return (
    <div
      className={`
        relative glass rounded-xl overflow-hidden cursor-pointer group
        transition-all duration-200 min-h-[92px]
        ${hovered ? 'shadow-card-hover -translate-y-[2px] border-line/[0.12]' : 'shadow-card'}
        ${app.pinned ? 'ring-1 ring-violet-500/25' : ''}
        ${selected ? 'ring-1 ring-violet-500/50' : ''}
        ${launching ? 'animate-press-flash' : ''}
      `}
      onMouseEnter={() => { setHovered(true); setConfirm(false); }}
      onMouseLeave={() => { setHovered(false); setConfirm(false); }}
      onClick={handleLaunch}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleLaunch(e)}
      aria-label={`${t('dash_launch')} ${app.name}`}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-70" style={{ background: app.iconColor }} />

      <div className="relative flex items-center gap-2.5 p-2.5">
        <SelectionCheckbox selectionMode={selectionMode} selected={selected} onToggle={onSelect} />
        <div className="relative flex-shrink-0">
          <AppIcon
            iconType={app.iconType} iconValue={app.iconValue}
            iconColor={app.iconColor} name={app.name} url={app.url}
            size={32}
          />
          {windowOpen && (
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse border border-surface-base" />
          )}
          {badgeCount > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 flex items-center justify-center text-[8px] font-bold text-white leading-none border-2 border-surface-base">
              {badgeCount > 99 ? '99+' : badgeCount}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-bold text-fg/90 leading-tight truncate">{app.name}</h3>
            <FavoriteBadge favorite={app.favorite} size={9} />
            {hasProblem && <AlertTriangle size={10} className="text-amber-400/80 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1 mt-1 text-[9px] text-fg/28">
            <Clock size={9} className="text-fg/18 flex-shrink-0" />
            <span className="truncate">{relativeTime}</span>
            {app.openCount > 0 && <span className="text-fg/32 ml-auto">{app.openCount}×</span>}
          </div>
        </div>
      </div>

      {/* Overlay de acciones */}
      <div
        className={`
          absolute inset-0 flex items-center justify-center gap-1.5 px-2.5
          transition-opacity duration-150
          ${hovered && !selectionMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        style={{ background: 'rgba(12,12,18,0.96)', backdropFilter: 'blur(8px)' }}
      >
        <button onClick={handleLaunch} className="flex-1 flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 active:scale-[0.97] text-white text-xs font-semibold rounded-lg py-2 transition-all">
          {launching
            ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Play size={11} fill="currentColor" />
          }
          {windowOpen ? 'Abrir' : t('dash_launch')}
        </button>
        <button onClick={handleFavorite} title="Favorito"
          className={`flex items-center justify-center rounded-lg w-8 h-8 transition-all ${app.favorite ? 'bg-amber-500/20 text-amber-400' : 'bg-overlay/[0.05] text-fg/40 hover:text-amber-400'}`}>
          <Star size={12} fill={app.favorite ? 'currentColor' : 'none'} />
        </button>
        <button onClick={e => { e.stopPropagation(); onEdit?.(app); }} title="Editar"
          className="flex items-center justify-center rounded-lg w-8 h-8 bg-overlay/[0.05] text-fg/40 hover:text-fg/80 transition-all">
          <Settings2 size={12} />
        </button>
        <button onClick={handleUninstall} title={t('dash_uninstall')}
          className={`flex items-center justify-center rounded-lg w-8 h-8 transition-all ${confirm ? 'bg-red-500/80 text-white' : 'bg-overlay/[0.05] text-fg/40 hover:text-red-400'}`}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

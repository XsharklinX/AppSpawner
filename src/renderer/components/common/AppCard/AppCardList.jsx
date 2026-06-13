import React from 'react';
import { Play, Settings2, Trash2, Clock, Pin, PinOff, Star, AlertTriangle } from 'lucide-react';
import AppIcon from '../AppIcon';
import Tooltip from '../Tooltip';
import { SelectionCheckbox, FavoriteBadge } from './shared';

export default function AppCardList({
  app, hovered, setHovered, confirm, setConfirm, selected, selectionMode,
  windowOpen, relativeTime, statusItems, launching, hasProblem, t,
  onEdit, onSelect, handleLaunch, handleUninstall, handlePin, handleFavorite,
}) {
  return (
    <div
      className={`
        relative glass rounded-xl overflow-hidden cursor-pointer group flex items-center gap-3 px-3 py-2.5
        transition-all duration-150
        ${hovered ? 'border-line/[0.12] bg-overlay/[0.03]' : ''}
        ${app.pinned ? 'ring-1 ring-violet-500/25' : ''}
        ${selected ? 'ring-1 ring-violet-500/50 bg-violet-500/[0.06]' : ''}
        ${launching ? 'animate-press-flash' : ''}
      `}
      onMouseEnter={() => { setHovered(true); setConfirm(false); }}
      onMouseLeave={() => { setHovered(false); setConfirm(false); }}
      onClick={handleLaunch}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleLaunch(e)}
      aria-label={`${t('dash_launch')} ${app.name}`}
    >
      <SelectionCheckbox selectionMode={selectionMode} selected={selected} onToggle={onSelect} />

      <div className="relative flex-shrink-0">
        <AppIcon
          iconType={app.iconType} iconValue={app.iconValue}
          iconColor={app.iconColor} name={app.name} url={app.url}
          size={28}
        />
        {windowOpen && (
          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse border border-surface-base" />
        )}
      </div>

      <div className="min-w-0 flex-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-fg/90 truncate">{app.name}</h3>
        <FavoriteBadge favorite={app.favorite} />
        <span className="category-badge capitalize hidden sm:inline-flex">{app.category || 'general'}</span>
        {app.accountLabel && (
          <span className="text-[9px] font-medium text-violet-400/80 bg-violet-500/10 px-1.5 py-0.5 rounded-full border border-violet-500/20 leading-none hidden sm:inline">
            {app.accountLabel}
          </span>
        )}
        {hasProblem && (
          <Tooltip label="Errores de carga recientes">
            <AlertTriangle size={12} className="text-amber-400/80" />
          </Tooltip>
        )}
      </div>

      {statusItems.length > 0 && (
        <div className="hidden md:flex items-center gap-1 flex-shrink-0">
          {statusItems.slice(0, 4).map(({ key, icon: Icon, label }) => (
            <span key={key} title={label} className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-line/[0.06] bg-overlay/[0.035] text-fg/40">
              <Icon size={11} />
            </span>
          ))}
        </div>
      )}

      <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-fg/28 flex-shrink-0 w-28 justify-end">
        <Clock size={10} className="text-fg/18" />
        <span className="truncate">{relativeTime}</span>
        {app.openCount > 0 && <span className="text-fg/32">· {app.openCount}×</span>}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={handleFavorite} title="Favorito"
          className={`flex items-center justify-center rounded-lg w-7 h-7 transition-all ${app.favorite ? 'text-amber-400' : 'text-fg/25 hover:text-amber-400'}`}>
          <Star size={13} fill={app.favorite ? 'currentColor' : 'none'} />
        </button>
        <button onClick={handlePin} title={app.pinned ? 'Desfijar' : 'Fijar'}
          className={`flex items-center justify-center rounded-lg w-7 h-7 transition-all ${app.pinned ? 'text-violet-400' : 'text-fg/25 hover:text-violet-400'}`}>
          {app.pinned ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
        <button onClick={e => { e.stopPropagation(); onEdit?.(app); }} title="Editar"
          className="flex items-center justify-center rounded-lg w-7 h-7 text-fg/25 hover:text-fg/70 transition-all">
          <Settings2 size={13} />
        </button>
        <button onClick={handleUninstall} title={t('dash_uninstall')}
          className={`flex items-center justify-center rounded-lg w-7 h-7 transition-all ${confirm ? 'bg-red-500/80 text-white' : 'text-fg/25 hover:text-red-400'}`}>
          <Trash2 size={13} />
        </button>
        <button onClick={handleLaunch} title={t('dash_launch')}
          className="flex items-center justify-center rounded-lg w-7 h-7 bg-violet-600/20 text-violet-300 hover:bg-violet-600/35 transition-all">
          {launching
            ? <div className="w-3 h-3 border-2 border-violet-300/40 border-t-violet-300 rounded-full animate-spin" />
            : <Play size={12} fill="currentColor" />
          }
        </button>
      </div>
    </div>
  );
}

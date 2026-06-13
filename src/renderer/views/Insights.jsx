import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Rocket, Clock, ShieldBan, Flame, History, CalendarDays } from 'lucide-react';
import AppIcon from '../components/common/AppIcon';
import { useApps } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';
import { formatDuration, formatRelativeTime, countByCategory } from '../lib/utils';

const CATEGORY_LABELS = {
  all:             'Todas',
  trabajo:         'Trabajo',
  social:          'Social',
  entretenimiento: 'Entretenimiento',
  desarrollo:      'Desarrollo',
  ia:              'IA & Productividad',
  general:         'General',
};

export default function Insights() {
  const { rawApps, recentApps } = useApps();
  const { language } = useI18n();
  const [blockedCounts, setBlockedCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(rawApps.map(async app => {
      try {
        const count = await window.electronAPI?.getAdBlockCount?.(app.id);
        return [app.id, count || 0];
      } catch { return [app.id, 0]; }
    })).then(entries => {
      if (!cancelled) setBlockedCounts(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [rawApps]);

  const totalOpens = useMemo(() => rawApps.reduce((sum, a) => sum + (a.openCount || 0), 0), [rawApps]);
  const totalTimeMs = useMemo(() => rawApps.reduce((sum, a) => sum + (a.timeSpentMs || 0), 0), [rawApps]);
  const totalBlocked = useMemo(() => Object.values(blockedCounts).reduce((sum, c) => sum + c, 0), [blockedCounts]);

  const topByOpens = useMemo(() =>
    [...rawApps].filter(a => a.openCount > 0).sort((a, b) => (b.openCount || 0) - (a.openCount || 0)).slice(0, 5),
    [rawApps]);

  const topByTime = useMemo(() =>
    [...rawApps].filter(a => a.timeSpentMs > 0).sort((a, b) => (b.timeSpentMs || 0) - (a.timeSpentMs || 0)).slice(0, 5),
    [rawApps]);

  const topByWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return rawApps
      .map(app => {
        const weekly = Object.entries(app.dailyUsage || {})
          .filter(([date]) => new Date(date).getTime() >= cutoff)
          .reduce((acc, [, day]) => ({
            opens: acc.opens + (day.opens || 0),
            timeMs: acc.timeMs + (day.timeMs || 0),
          }), { opens: 0, timeMs: 0 });
        return { app, ...weekly };
      })
      .filter(entry => entry.opens > 0)
      .sort((a, b) => b.opens - a.opens)
      .slice(0, 5);
  }, [rawApps]);

  const categoryCounts = useMemo(() => countByCategory(rawApps), [rawApps]);
  const maxCategoryCount = Math.max(1, ...Object.values(categoryCounts));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-7 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-600/15 border border-violet-500/25 flex items-center justify-center">
            <BarChart3 size={19} className="text-violet-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-fg">Insights</h1>
            <p className="text-sm text-fg/38 mt-0.5">
              Estadísticas de uso de tus apps.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 max-w-4xl mt-5">
          <Stat label="Apps instaladas" value={rawApps.length} icon={Rocket} />
          <Stat label="Lanzamientos totales" value={totalOpens} icon={Flame} />
          <Stat label="Tiempo de uso" value={totalTimeMs > 0 ? formatDuration(totalTimeMs) : '—'} icon={Clock} />
          <Stat label="Anuncios bloqueados" value={totalBlocked} icon={ShieldBan} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-7 pb-6">
        {rawApps.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-6xl animate-fade-in">
            <Panel title="Más lanzadas" icon={Flame}>
              {topByOpens.length === 0 ? (
                <EmptyPanel text="Aún no hay lanzamientos registrados." />
              ) : (
                <div className="flex flex-col gap-1">
                  {topByOpens.map(app => (
                    <RankRow
                      key={app.id}
                      app={app}
                      value={`${app.openCount} ${app.openCount === 1 ? 'vez' : 'veces'}`}
                      max={topByOpens[0].openCount}
                      current={app.openCount}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Mayor tiempo de uso" icon={Clock}>
              {topByTime.length === 0 ? (
                <EmptyPanel text="Aún no hay tiempo de uso registrado." />
              ) : (
                <div className="flex flex-col gap-1">
                  {topByTime.map(app => (
                    <RankRow
                      key={app.id}
                      app={app}
                      value={formatDuration(app.timeSpentMs)}
                      max={topByTime[0].timeSpentMs}
                      current={app.timeSpentMs}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Ranking semanal" icon={CalendarDays}>
              {topByWeek.length === 0 ? (
                <EmptyPanel text="Aún no hay actividad en los últimos 7 días." />
              ) : (
                <div className="flex flex-col gap-1">
                  {topByWeek.map(({ app, opens, timeMs }) => (
                    <RankRow
                      key={app.id}
                      app={app}
                      value={`${opens} ${opens === 1 ? 'vez' : 'veces'}${timeMs > 0 ? ` · ${formatDuration(timeMs)}` : ''}`}
                      max={topByWeek[0].opens}
                      current={opens}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Apps por categoría" icon={BarChart3}>
              <div className="flex flex-col gap-2.5">
                {Object.entries(categoryCounts).map(([cat, count]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-xs text-fg/45 w-32 flex-shrink-0 truncate">{CATEGORY_LABELS[cat] || cat}</span>
                    <div className="flex-1 h-2 rounded-full bg-overlay/[0.05] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-500/60"
                        style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-fg/60 w-6 text-right flex-shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Usadas recientemente" icon={History}>
              {recentApps.length === 0 ? (
                <EmptyPanel text="Aún no has abierto ninguna app." />
              ) : (
                <div className="flex flex-col gap-1">
                  {recentApps.map(app => (
                    <div key={app.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-overlay/[0.03] transition-colors">
                      <AppIcon iconType={app.iconType} iconValue={app.iconValue} iconColor={app.iconColor} name={app.name} url={app.url} size={28} />
                      <span className="text-sm text-fg/75 flex-1 truncate">{app.name}</span>
                      <span className="text-xs text-fg/30 flex-shrink-0">{formatRelativeTime(app.lastUsed, language)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-overlay/[0.05] flex items-center justify-center text-fg/45">
        <Icon size={15} />
      </div>
      <div>
        <p className="text-lg font-semibold text-fg leading-none">{value}</p>
        <p className="text-[11px] text-fg/32 mt-1">{label}</p>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-fg/35" />
        <h3 className="text-[11px] font-semibold text-fg/45 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function RankRow({ app, value, max, current }) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-overlay/[0.03] transition-colors">
      <AppIcon iconType={app.iconType} iconValue={app.iconValue} iconColor={app.iconColor} name={app.name} url={app.url} size={28} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-fg/75 truncate">{app.name}</p>
        <div className="h-1 rounded-full bg-overlay/[0.05] overflow-hidden mt-1">
          <div className="h-full rounded-full bg-violet-500/60" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-xs font-medium text-fg/40 flex-shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

function EmptyPanel({ text }) {
  return <p className="text-xs text-fg/30 px-2 py-3">{text}</p>;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-3 max-w-sm mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
        <BarChart3 size={24} className="text-violet-400/60" />
      </div>
      <div>
        <p className="text-sm font-semibold text-fg/70">Sin datos todavía</p>
        <p className="text-xs text-fg/35 mt-1">Instala y usa algunas apps para ver tus estadísticas aquí.</p>
      </div>
    </div>
  );
}

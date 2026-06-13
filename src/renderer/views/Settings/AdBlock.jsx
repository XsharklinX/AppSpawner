import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShieldCheck, Zap, Plus, X, AlertTriangle, RefreshCw, ListFilter,
  Bug, Download, Upload, Eye, EyeOff, ChevronDown, ChevronUp,
  Globe, Layers, Cookie, LayoutTemplate, Bell, Radio, Crosshair,
  Tv, Sparkles, Briefcase, Users, Wind, Flame, Gauge,
} from 'lucide-react';
import Switch from '../../components/common/Switch';
import { useApps } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';

const GROUP_LABELS = { core: 'Activas', extended: 'Extendidas', regional: 'Regionales', custom: 'Personalizadas' };
const GROUP_ORDER  = ['core', 'extended', 'regional', 'custom'];

const DEFAULT_CATEGORIES = { network: true, cosmetic: true, cookies: true, overlays: true, popups: true };

const OVERLAY_MODES = [
  ['soft',       'Suave',    Wind],
  ['normal',     'Normal',   Gauge],
  ['aggressive', 'Agresivo', Flame],
];

const SITE_PROFILES = {
  streaming: {
    label: 'Streaming',
    icon: Tv,
    filterCategories: { network: true, cosmetic: true, cookies: true, overlays: true, popups: true },
    aggressiveOverride: true,
    overlayMode: 'aggressive',
  },
  anime: {
    label: 'Anime',
    icon: Sparkles,
    filterCategories: { network: true, cosmetic: true, cookies: true, overlays: true, popups: true },
    aggressiveOverride: true,
    overlayMode: 'aggressive',
  },
  productividad: {
    label: 'Productividad',
    icon: Briefcase,
    filterCategories: { network: true, cosmetic: false, cookies: true, overlays: false, popups: true },
    aggressiveOverride: false,
    overlayMode: 'soft',
  },
  redes: {
    label: 'Redes sociales',
    icon: Users,
    filterCategories: { network: true, cosmetic: true, cookies: true, overlays: true, popups: true },
    aggressiveOverride: null,
    overlayMode: 'normal',
  },
};

export default function AdBlock() {
  const { apps } = useApps();
  const toast = useToast();
  const [tab, setTab] = useState('config'); // 'config' | 'inspector'

  const [cfg, setCfg] = useState({
    enabled: true, cosmetic: true, httpsUpgrade: true, aggressive: true, annoyances: true,
    domainCount: 0, networkFilterCount: 0, cosmeticFilterCount: 0, subscriptionCount: 0,
  });
  const [subscriptions, setSubscriptions] = useState([]);
  const [updatingLists, setUpdatingLists] = useState(false);
  const [appCfgs, setAppCfgs] = useState({});
  const [newRule, setNewRule] = useState({});
  const [openApp, setOpenApp] = useState(null);
  const [inspectorAppId, setInspectorAppId] = useState(null);
  const [blockLog, setBlockLog] = useState([]);
  const [logFilter, setLogFilter] = useState('');
  const [importText, setImportText] = useState({});
  const fileInputRef = useRef(null);
  const [fileImportAppId, setFileImportAppId] = useState(null);
  const globalFileInputRef = useRef(null);
  const [recommended, setRecommended] = useState({});
  const [groupBySelector, setGroupBySelector] = useState(false);

  const load = useCallback(async () => {
    const global = await window.electronAPI?.getAdBlockConfig?.() ?? {};
    setCfg(prev => ({ ...prev, ...global }));
    const subData = await window.electronAPI?.getAdBlockSubscriptions?.() ?? {};
    if (Array.isArray(subData.subscriptions)) setSubscriptions(subData.subscriptions);
    if (subData.stats) setCfg(prev => ({ ...prev, ...subData.stats }));
    const entries = await Promise.all(
      apps.map(async app => [app.id, await window.electronAPI?.getAppAdBlockConfig(app.id) ?? {}])
    );
    setAppCfgs(Object.fromEntries(entries));
  }, [apps]);

  useEffect(() => { load(); }, [load]);

  // Escuchar reglas cosmeticas añadidas via element picker desde SSB
  useEffect(() => {
    const unsub = window.electronAPI?.onAdBlockCosmeticRuleAdded?.(({ appId, rule }) => {
      setAppCfgs(prev => {
        const ac = prev[appId] || {};
        const existing = ac.cosmeticRules || [];
        if (existing.includes(rule)) return prev;
        return { ...prev, [appId]: { ...ac, cosmeticRules: [...existing, rule] } };
      });
      toast.success('Elemento ocultado', rule.split('##')[1] || rule);
    });
    return () => unsub?.();
  }, [toast]);

  // Escuchar paginas rotas
  useEffect(() => {
    const unsub = window.electronAPI?.onAdBlockPageBroken?.(({ appName, url, errorDesc }) => {
      toast.warning(`${appName}: posible rotura`, `${errorDesc || ''} — ${url?.slice(0, 60) || ''}`);
    });
    return () => unsub?.();
  }, [toast]);

  useEffect(() => {
    const unsub = window.electronAPI?.onAdBlockDomBlocked?.((event) => {
      if (event?.appId !== inspectorAppId) return;
      setBlockLog(prev => [{
        resourceType: 'dom',
        hostname: event.hostname,
        url: event.url || event.selector,
        rule: event.reason,
        selector: event.selector,
        ts: Date.now(),
      }, ...prev].slice(0, 500));
    });
    return () => unsub?.();
  }, [inspectorAppId]);

  const saveGlobal = async (updates) => {
    setCfg(prev => ({ ...prev, ...updates }));
    await window.electronAPI?.updateAdBlockConfig(updates);
    toast.success('Configuracion guardada');
  };

  const saveSubscriptions = async (items) => {
    setSubscriptions(items);
    const result = await window.electronAPI?.setAdBlockSubscriptions?.(items);
    if (result?.stats) setCfg(prev => ({ ...prev, ...result.stats }));
    if (Array.isArray(result?.subscriptions)) setSubscriptions(result.subscriptions);
  };

  const toggleSubscription = async (id) => {
    await saveSubscriptions(subscriptions.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item));
    toast.success('Lista actualizada');
  };

  const updateSubscriptions = async () => {
    setUpdatingLists(true);
    try {
      const result = await window.electronAPI?.updateAdBlockSubscriptions?.(subscriptions);
      if (Array.isArray(result?.subscriptions)) setSubscriptions(result.subscriptions);
      if (result?.stats) setCfg(prev => ({ ...prev, ...result.stats }));
      const failures = result?.subscriptions?.filter(item => item.error).length || 0;
      if (failures) toast.warning(`${failures} lista${failures > 1 ? 's' : ''} no se pudieron actualizar`);
      else toast.success('Listas actualizadas');
    } catch (err) {
      toast.error('Error al actualizar listas', err.message);
    } finally {
      setUpdatingLists(false);
    }
  };

  const saveApp = async (appId, updates) => {
    setAppCfgs(prev => ({ ...prev, [appId]: { ...prev[appId], ...updates } }));
    await window.electronAPI?.updateAppAdBlockConfig(appId, updates);
  };

  const saveCategory = async (appId, key, value) => {
    const current = appCfgs[appId]?.filterCategories ?? DEFAULT_CATEGORIES;
    const updated = { ...DEFAULT_CATEGORIES, ...current, [key]: value };
    await saveApp(appId, { filterCategories: updated });
  };

  const addCustomRule = async (appId) => {
    const rule = (newRule[appId] || '').trim();
    if (!rule) return;
    const current = appCfgs[appId]?.customRules ?? [];
    if (current.includes(rule)) return;
    await saveApp(appId, { customRules: [...current, rule] });
    setNewRule(prev => ({ ...prev, [appId]: '' }));
    toast.success('Regla anadida');
  };

  const removeCustomRule = async (appId, rule) => {
    await saveApp(appId, { customRules: (appCfgs[appId]?.customRules ?? []).filter(r => r !== rule) });
  };

  const removeCosmeticRule = async (appId, rule) => {
    await saveApp(appId, { cosmeticRules: (appCfgs[appId]?.cosmeticRules ?? []).filter(r => r !== rule) });
  };

  const exportRules = async (appId) => {
    const text = await window.electronAPI?.exportAdBlockRules?.(appId);
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `adblock-rules-${appId}.txt`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Reglas exportadas');
  };

  const importRulesText = async (appId, text) => {
    if (!text?.trim()) return;
    const result = await window.electronAPI?.importAdBlockRules?.(appId, text);
    if (result?.success) {
      setAppCfgs(prev => ({
        ...prev,
        [appId]: {
          ...prev[appId],
          customRules:  result.networkRules  || prev[appId]?.customRules  || [],
          cosmeticRules: result.cosmeticRules || prev[appId]?.cosmeticRules || [],
        },
      }));
      setImportText(prev => ({ ...prev, [appId]: '' }));
      toast.success('Reglas importadas');
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !fileImportAppId) return;
    const text = await file.text();
    await importRulesText(fileImportAppId, text);
    e.target.value = '';
    setFileImportAppId(null);
  };

  const openInspector = async (appId) => {
    setInspectorAppId(appId);
    setTab('inspector');
    const log = await window.electronAPI?.getAdBlockLog?.(appId) ?? [];
    setBlockLog(log);
  };

  const clearLog = async (appId) => {
    await window.electronAPI?.clearAdBlockLog?.(appId);
    setBlockLog([]);
    toast.success('Inspector limpiado');
  };

  const startPicker = async (appId) => {
    const result = await window.electronAPI?.startAdBlockElementPicker?.(appId);
    if (!result?.success) toast.warning('Abre la app primero para usar el selector');
    else toast.success('Selector activo — haz clic en la app');
  };

  const togglePanel = async (appId) => {
    const next = openApp === appId ? null : appId;
    setOpenApp(next);
    if (next && !recommended[next]) await loadRecommended(next);
  };

  const loadRecommended = async (appId) => {
    const rules = await window.electronAPI?.getRecommendedAdBlockRules?.(appId) ?? [];
    setRecommended(prev => ({ ...prev, [appId]: rules }));
  };

  const toggleRecommended = async (appId, ruleId, apply) => {
    const result = await window.electronAPI?.applyRecommendedAdBlockRule?.(appId, ruleId, apply);
    if (!result?.success) return;
    setAppCfgs(prev => ({ ...prev, [appId]: { ...prev[appId], cosmeticRules: result.cosmeticRules } }));
    setRecommended(prev => ({
      ...prev,
      [appId]: (prev[appId] || []).map(r => r.id === ruleId ? { ...r, applied: apply } : r),
    }));
    toast.success(apply ? 'Regla aplicada' : 'Regla quitada');
  };

  const applyProfile = async (appId, key) => {
    const preset = SITE_PROFILES[key];
    if (!preset) return;
    await saveApp(appId, {
      profile: key,
      filterCategories: preset.filterCategories,
      aggressiveOverride: preset.aggressiveOverride,
      overlayMode: preset.overlayMode,
    });
    toast.success(`Perfil "${preset.label}" aplicado`);
  };

  const exportAllRules = async () => {
    const text = await window.electronAPI?.exportAllAdBlockRules?.();
    if (!text) return;
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'appspawner-adblock-backup.json'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Configuracion de AdBlock exportada');
  };

  const importAllRules = async (text) => {
    const result = await window.electronAPI?.importAllAdBlockRules?.(text);
    if (result?.success) {
      await load();
      toast.success(`Configuracion importada · ${result.appsMatched} app${result.appsMatched === 1 ? '' : 's'} actualizadas`);
    } else {
      toast.error('Error al importar', result?.error || '');
    }
  };

  const handleGlobalFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importAllRules(text);
    e.target.value = '';
  };

  const addPermanentRule = async (selector) => {
    if (!inspectorAppId || !selector) return;
    const result = await window.electronAPI?.addAdBlockCosmeticRule?.(inspectorAppId, null, selector);
    if (result?.success) {
      setAppCfgs(prev => ({
        ...prev,
        [inspectorAppId]: {
          ...prev[inspectorAppId],
          cosmeticRules: [...(prev[inspectorAppId]?.cosmeticRules || []), result.rule],
        },
      }));
      toast.success('Regla anadida', result.rule);
    }
  };

  const groupedBlockLog = useMemo(() => {
    const map = new Map();
    for (const e of blockLog) {
      if (e.resourceType !== 'dom' || !e.selector) continue;
      const key = `${e.selector}::${e.rule}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        if (e.ts > existing.lastSeen) existing.lastSeen = e.ts;
      } else {
        map.set(key, { selector: e.selector, rule: e.rule, count: 1, lastSeen: e.ts });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [blockLog]);

  const totalBlocked = Object.values(appCfgs).reduce((sum, item) => sum + (item.blocked || 0), 0);

  // Agrupar subscripciones
  const subsByGroup = subscriptions.reduce((acc, s) => {
    const g = s.group || 'core';
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div>
        <h2 className="text-base font-semibold text-fg mb-0.5 flex items-center gap-2">
          <ShieldCheck size={16} className="text-violet-400" /> Ad Block
        </h2>
        <p className="text-sm text-fg/35 leading-relaxed max-w-md">
          Bloquea anuncios, trackers, popups, banners de cookies y peticiones sospechosas.
          Filtros por categoria, modo agresivo por dominio, inspector en tiempo real y selector de elementos.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 glass rounded-xl">
        {[['config', 'Configuracion'], ['inspector', 'Inspector']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${tab === key ? 'bg-violet-600 text-white' : 'text-fg/45 hover:text-fg/70'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'config' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={ShieldCheck} color="violet" label="Dominios bloqueados"  value={cfg.domainCount.toLocaleString()} />
            <Stat icon={Zap}         color="emerald" label="Peticiones bloqueadas" value={totalBlocked.toLocaleString()} />
            <Stat icon={ListFilter}  color="sky"     label="Reglas de red"         value={(cfg.networkFilterCount || 0).toLocaleString()} />
            <Stat icon={ShieldCheck} color="amber"   label="Reglas CSS"            value={(cfg.cosmeticFilterCount || 0).toLocaleString()} />
          </div>

          {/* Opciones globales */}
          <div className="glass rounded-xl p-4 flex flex-col gap-4">
            <Switch checked={cfg.enabled}      onChange={v => saveGlobal({ enabled: v })}      label="Ad Blocker global"            description="Bloquea peticiones a dominios de anuncios y trackers en todos los SSBs." />
            <div className="divider" />
            <Switch checked={cfg.cosmetic}     onChange={v => saveGlobal({ cosmetic: v })}     label="Filtro cosmetico (CSS)"       description="Oculta banners de cookies, contenedores de anuncios, overlays y botones sociales." />
            <div className="divider" />
            <Switch checked={cfg.httpsUpgrade} onChange={v => saveGlobal({ httpsUpgrade: v })} label="Upgrade HTTP a HTTPS"         description="Fuerza conexiones seguras cuando el sitio lo soporta." />
            <div className="divider" />
            <Switch checked={cfg.aggressive}   onChange={v => saveGlobal({ aggressive: v })}   label="Modo agresivo (global)"       description="Bloquea scripts, iframes, pixeles y URLs sospechosas de terceros. Puede romper sitios." />
            <div className="divider" />
            <Switch checked={cfg.annoyances}   onChange={v => saveGlobal({ annoyances: v })}   label="Anti-molestias"               description="Bloquea permisos invasivos y overlays dinamicos detectados por heuristica." />
          </div>

          {/* Aviso */}
          <div className="flex items-start gap-3 glass rounded-xl p-3.5">
            <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-fg/40 leading-relaxed">
              Los cambios se aplican al abrir cada ventana SSB. Reabre la app para que surtan efecto.
              Usa el boton <strong className="text-fg/55">shield</strong> en la toolbar de la app para pausar rapido sin ir a ajustes.
            </p>
          </div>

          {/* Backup global */}
          <div className="glass rounded-xl p-4 flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold text-fg/85">Backup de AdBlock</h3>
              <p className="text-xs text-fg/35 mt-1">
                Exporta o importa toda la configuracion de AdBlock: ajustes globales, suscripciones y reglas de cada app.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={exportAllRules} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
                <Download size={12} /> Exportar todo
              </button>
              <button onClick={() => globalFileInputRef.current?.click()} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
                <Upload size={12} /> Importar todo
              </button>
              <input type="file" accept=".json" ref={globalFileInputRef} onChange={handleGlobalFileImport} className="hidden" />
            </div>
          </div>

          {/* Listas de filtros agrupadas */}
          <div className="glass rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-fg/85">Listas de filtros</h3>
                <p className="text-xs text-fg/35 mt-1">Compatibles con Adblock Plus. Las regionales y extendidas estan desactivadas por defecto.</p>
              </div>
              <button
                onClick={updateSubscriptions}
                disabled={updatingLists}
                className="btn-secondary flex items-center gap-2 text-xs px-3 py-2 flex-shrink-0 disabled:opacity-50"
              >
                <RefreshCw size={13} className={updatingLists ? 'animate-spin' : ''} />
                Actualizar
              </button>
            </div>

            {GROUP_ORDER.filter(g => subsByGroup[g]?.length).map(group => (
              <div key={group}>
                <p className="text-[10px] font-semibold text-fg/30 uppercase tracking-wider mb-1.5 mt-1">
                  {GROUP_LABELS[group] || group}
                </p>
                <div className="flex flex-col gap-1.5">
                  {subsByGroup[group].map(item => (
                    <div key={item.id || item.url} className="rounded-xl border border-line/[0.08] bg-overlay/[0.025] p-3 flex items-center gap-3">
                      <button
                        onClick={() => toggleSubscription(item.id)}
                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${item.enabled ? 'bg-violet-600' : 'bg-overlay/[0.1]'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${item.enabled ? 'translate-x-5' : ''}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-fg/75 truncate">{item.name}</p>
                          {item.error && <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">cache</span>}
                        </div>
                        <p className="text-[11px] text-fg/25 truncate">{item.url}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-fg/55">{((item.ruleCount || 0) + (item.cosmeticCount || 0)).toLocaleString()}</p>
                        <p className="text-[10px] text-fg/25">{item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : 'Sin actualizar'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Por aplicacion */}
          {apps.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-fg/35 uppercase tracking-wider mb-2.5">Por aplicacion</h3>
              <input type="file" accept=".txt" ref={fileInputRef} onChange={handleFileImport} className="hidden" />
              <div className="flex flex-col gap-2">
                {apps.map(app => {
                  const ac = appCfgs[app.id] ?? { enabled: true, customRules: [], cosmeticRules: [], blocked: 0 };
                  const isOpen = openApp === app.id;
                  const cats = { ...DEFAULT_CATEGORIES, ...(ac.filterCategories || {}) };
                  const totalRules = (ac.customRules?.length || 0) + (ac.cosmeticRules?.length || 0);
                  return (
                    <div key={app.id} className="glass rounded-xl overflow-hidden">
                      {/* Fila principal */}
                      <div className="flex items-center gap-3 px-3.5 py-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.enabled && ac.enabled ? 'bg-emerald-400' : 'bg-overlay/15'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-fg/80 truncate">{app.name}</p>
                          <p className="text-[11px] text-fg/30">
                            {ac.blocked > 0 ? `${ac.blocked} bloqueadas` : 'Sin bloqueos'}
                            {totalRules > 0 && ` · ${totalRules} regla${totalRules > 1 ? 's' : ''}`}
                            {ac.aggressiveOverride !== null && ac.aggressiveOverride !== undefined
                              ? ` · agresivo ${ac.aggressiveOverride ? 'ON' : 'OFF'}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => openInspector(app.id)}
                          className="text-[10px] text-fg/30 hover:text-sky-400 transition-colors px-2 py-1 rounded-lg border border-line/[0.06] hover:border-sky-500/30 flex-shrink-0"
                          title="Inspector de bloqueos"
                        >
                          <Bug size={12} />
                        </button>
                        <button
                          onClick={() => saveApp(app.id, { enabled: !ac.enabled })}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${ac.enabled ? 'bg-violet-600 border border-violet-400/40' : 'bg-overlay/[0.08] border border-line/[0.16]'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${ac.enabled ? 'translate-x-5' : ''}`} />
                        </button>
                        <button
                          onClick={() => togglePanel(app.id)}
                          className="text-[10px] text-fg/35 hover:text-violet-400 transition-colors px-2 py-1 rounded-lg border border-line/[0.08] hover:border-violet-500/30 flex-shrink-0"
                        >
                          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </div>

                      {/* Panel expandido */}
                      {isOpen && (
                        <div className="border-t border-line/[0.06] px-3.5 pb-4 pt-3 flex flex-col gap-4">

                          {/* Perfiles de bloqueo por tipo de sitio */}
                          <div>
                            <p className="text-[10px] font-semibold text-fg/30 uppercase tracking-wider mb-2">Perfil de sitio</p>
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                              {Object.entries(SITE_PROFILES).map(([key, preset]) => {
                                const Icon = preset.icon;
                                const active = ac.profile === key;
                                return (
                                  <button
                                    key={key}
                                    onClick={() => applyProfile(app.id, key)}
                                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-[10px] font-medium transition-colors ${active ? 'bg-violet-600/20 border-violet-500/40 text-violet-300' : 'bg-overlay/[0.04] border-line/[0.08] text-fg/30'}`}
                                  >
                                    <Icon size={13} />
                                    {preset.label}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[11px] text-fg/30 mt-1.5">Aplica un preset de categorias, modo agresivo y anti-overlays segun el tipo de sitio.</p>
                          </div>

                          <div className="divider" />

                          {/* Filtros por categoria */}
                          <div>
                            <p className="text-[10px] font-semibold text-fg/30 uppercase tracking-wider mb-2">Categorias activas</p>
                            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                              {[
                                ['network',  'Red',       Radio],
                                ['cosmetic', 'Anuncios',  Layers],
                                ['cookies',  'Cookies',   Cookie],
                                ['overlays', 'Overlays',  LayoutTemplate],
                                ['popups',   'Popups',    Bell],
                              ].map(([key, label, Icon]) => (
                                <button
                                  key={key}
                                  onClick={() => saveCategory(app.id, key, !cats[key])}
                                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-[10px] font-medium transition-colors ${cats[key] ? 'bg-violet-600/20 border-violet-500/40 text-violet-300' : 'bg-overlay/[0.04] border-line/[0.08] text-fg/30'}`}
                                >
                                  <Icon size={13} />
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="divider" />

                          {/* Modo agresivo override */}
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-fg/70">Modo agresivo (esta app)</p>
                              <p className="text-[11px] text-fg/30 mt-0.5">Sobreescribe el ajuste global para esta app.</p>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              {[
                                [null,  'Global'],
                                [true,  'ON'],
                                [false, 'OFF'],
                              ].map(([val, label]) => (
                                <button
                                  key={String(val)}
                                  onClick={() => saveApp(app.id, { aggressiveOverride: val })}
                                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${ac.aggressiveOverride === val ? 'bg-violet-600 border-violet-500 text-white' : 'bg-overlay/[0.04] border-line/[0.08] text-fg/40 hover:text-fg/60'}`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="divider" />

                          {/* Modo anti-overlays */}
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-fg/70">Modo anti-overlays</p>
                              <p className="text-[11px] text-fg/30 mt-0.5">Sensibilidad para detectar overlays, notificaciones falsas y popups invisibles.</p>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              {OVERLAY_MODES.map(([val, label, Icon]) => (
                                <button
                                  key={val}
                                  onClick={() => saveApp(app.id, { overlayMode: val })}
                                  className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${(ac.overlayMode || 'normal') === val ? 'bg-violet-600 border-violet-500 text-white' : 'bg-overlay/[0.04] border-line/[0.08] text-fg/40 hover:text-fg/60'}`}
                                >
                                  <Icon size={11} /> {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="divider" />

                          {/* Ocultar elemento */}
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-fg/70">Ocultar elemento</p>
                              <p className="text-[11px] text-fg/30 mt-0.5">Activa el selector visual en la ventana de la app.</p>
                            </div>
                            <button
                              onClick={() => startPicker(app.id)}
                              className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 flex-shrink-0"
                            >
                              <Crosshair size={12} /> Selector
                            </button>
                          </div>

                          {/* Reglas cosmeticas del element picker */}
                          {ac.cosmeticRules?.length > 0 && (
                            <div className="flex flex-col gap-1">
                              <p className="text-[10px] font-semibold text-fg/25 uppercase tracking-wider">Elementos ocultados</p>
                              {ac.cosmeticRules.map(rule => (
                                <div key={rule} className="flex items-center gap-2 text-xs">
                                  <EyeOff size={10} className="text-violet-400/60 flex-shrink-0" />
                                  <code className="flex-1 text-violet-400/70 bg-violet-500/10 px-2 py-0.5 rounded-lg truncate">{rule}</code>
                                  <button onClick={() => removeCosmeticRule(app.id, rule)} className="text-fg/20 hover:text-red-400 transition-colors p-1 flex-shrink-0">
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reglas recomendadas */}
                          {recommended[app.id]?.length > 0 && (
                            <>
                              <div className="divider" />
                              <div>
                                <p className="text-[10px] font-semibold text-fg/25 uppercase tracking-wider mb-2">Reglas recomendadas</p>
                                <div className="flex flex-col gap-1.5">
                                  {[...recommended[app.id]]
                                    .sort((a, b) => (b.relevant === a.relevant ? 0 : b.relevant ? 1 : -1))
                                    .map(rule => (
                                      <div key={rule.id} className="flex items-center gap-2 rounded-lg border border-line/[0.06] px-2.5 py-1.5">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-fg/65 truncate">{rule.label}</p>
                                          <p className="text-[10px] text-fg/25">
                                            {rule.category}{rule.relevant ? ' · sugerida para este perfil' : ''}
                                          </p>
                                        </div>
                                        <button
                                          onClick={() => toggleRecommended(app.id, rule.id, !rule.applied)}
                                          className={`text-[10px] px-2.5 py-1 rounded-lg border flex-shrink-0 transition-colors ${rule.applied ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-overlay/[0.04] border-line/[0.08] text-fg/40 hover:text-fg/60'}`}
                                        >
                                          {rule.applied ? 'Aplicada' : 'Aplicar'}
                                        </button>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </>
                          )}

                          <div className="divider" />

                          {/* Reglas de red custom */}
                          <div>
                            <p className="text-[10px] font-semibold text-fg/25 uppercase tracking-wider mb-2">Reglas de red adicionales</p>
                            {ac.customRules?.length > 0 && (
                              <div className="flex flex-col gap-1 mb-2">
                                {ac.customRules.map(rule => (
                                  <div key={rule} className="flex items-center gap-2 text-xs">
                                    <code className="flex-1 text-violet-400/80 bg-violet-500/10 px-2 py-1 rounded-lg truncate">{rule}</code>
                                    <button onClick={() => removeCustomRule(app.id, rule)} className="text-fg/25 hover:text-red-400 transition-colors p-1">
                                      <X size={11} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newRule[app.id] || ''}
                                onChange={e => setNewRule(prev => ({ ...prev, [app.id]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && addCustomRule(app.id)}
                                placeholder="ejemplo.com o /ads/"
                                className="input-field flex-1 text-xs"
                              />
                              <button
                                onClick={() => addCustomRule(app.id)}
                                disabled={!(newRule[app.id] || '').trim()}
                                className="btn-primary flex items-center gap-1.5 text-xs px-3 flex-shrink-0 disabled:opacity-40"
                              >
                                <Plus size={12} /> Anadir
                              </button>
                            </div>
                          </div>

                          <div className="divider" />

                          {/* Export / import */}
                          <div>
                            <p className="text-[10px] font-semibold text-fg/25 uppercase tracking-wider mb-2">Export / Import</p>
                            <div className="flex gap-2 mb-2">
                              <button onClick={() => exportRules(app.id)} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
                                <Download size={12} /> Exportar .txt
                              </button>
                              <button
                                onClick={() => { setFileImportAppId(app.id); fileInputRef.current?.click(); }}
                                className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
                              >
                                <Upload size={12} /> Importar archivo
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <textarea
                                value={importText[app.id] || ''}
                                onChange={e => setImportText(prev => ({ ...prev, [app.id]: e.target.value }))}
                                placeholder={'Pega reglas aqui (formato ABP)...\nejemplo.com\nejemplo.com##.ad-banner'}
                                rows={3}
                                className="input-field flex-1 text-xs resize-none font-mono"
                              />
                              <button
                                onClick={() => importRulesText(app.id, importText[app.id])}
                                disabled={!(importText[app.id] || '').trim()}
                                className="btn-primary text-xs px-3 flex-shrink-0 disabled:opacity-40 self-end"
                              >
                                Importar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'inspector' && (
        <div className="flex flex-col gap-3">
          {/* Selector de app */}
          <div className="flex items-center gap-2 flex-wrap">
            {apps.map(app => (
              <button
                key={app.id}
                onClick={() => openInspector(app.id)}
                className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${inspectorAppId === app.id ? 'bg-violet-600 border-violet-500 text-white' : 'bg-overlay/[0.04] border-line/[0.08] text-fg/45 hover:text-fg/70'}`}
              >
                {app.name}
                {appCfgs[app.id]?.blocked > 0 && (
                  <span className="ml-1.5 text-[10px] bg-violet-500/20 text-violet-300 rounded-full px-1.5 py-0.5">
                    {appCfgs[app.id].blocked}
                  </span>
                )}
              </button>
            ))}
          </div>

          {inspectorAppId ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={logFilter}
                  onChange={e => setLogFilter(e.target.value)}
                  placeholder="Filtrar por URL, tipo o regla..."
                  className="input-field flex-1 text-xs"
                />
                <button
                  onClick={() => setGroupBySelector(v => !v)}
                  className={`text-xs px-3 py-2 rounded-lg border transition-colors flex-shrink-0 ${groupBySelector ? 'bg-violet-600 border-violet-500 text-white' : 'bg-overlay/[0.04] border-line/[0.08] text-fg/40 hover:text-fg/60'}`}
                  title="Agrupar bloqueos de DOM por selector"
                >
                  <Layers size={12} />
                </button>
                <button
                  onClick={() => startPicker(inspectorAppId)}
                  className="btn-secondary text-xs px-3 py-2 flex-shrink-0"
                  title="Seleccionar elemento en la ventana abierta"
                >
                  <Crosshair size={12} />
                </button>
                <button
                  onClick={() => clearLog(inspectorAppId)}
                  className="btn-secondary text-xs px-3 py-2 flex-shrink-0"
                >
                  Limpiar
                </button>
                <button
                  onClick={() => openInspector(inspectorAppId)}
                  className="btn-secondary text-xs px-3 py-2 flex-shrink-0"
                >
                  <RefreshCw size={12} />
                </button>
              </div>

              {groupBySelector ? (
                groupedBlockLog.length === 0 ? (
                  <div className="glass rounded-xl p-6 text-center text-fg/25 text-sm">
                    Sin elementos de DOM bloqueados para esta app
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto">
                    {groupedBlockLog
                      .filter(g => {
                        if (!logFilter) return true;
                        const f = logFilter.toLowerCase();
                        return g.selector?.toLowerCase().includes(f) || g.rule?.toLowerCase().includes(f);
                      })
                      .map((g, i) => (
                        <div key={i} className="glass rounded-lg px-3 py-2 flex items-center gap-2.5 min-w-0">
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 bg-emerald-500/15 text-emerald-300">
                            {g.count}x
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-violet-400/80 truncate font-mono">{g.selector}</p>
                            <p className="text-[10px] truncate text-fg/30">
                              {g.rule} · ultimo: {g.lastSeen ? new Date(g.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => addPermanentRule(g.selector)}
                            className="text-[10px] px-2 py-1 rounded-lg border border-line/[0.08] text-fg/40 hover:text-violet-300 hover:border-violet-500/30 flex-shrink-0 transition-colors"
                          >
                            Bloquear siempre
                          </button>
                        </div>
                      ))}
                  </div>
                )
              ) : blockLog.length === 0 ? (
                <div className="glass rounded-xl p-6 text-center text-fg/25 text-sm">
                  Sin bloqueos registrados para esta app
                </div>
              ) : (
                <div className="flex flex-col gap-1 max-h-[420px] overflow-y-auto">
                  {blockLog
                    .filter(entry => {
                      if (!logFilter) return true;
                      const f = logFilter.toLowerCase();
                      return entry.url?.toLowerCase().includes(f) ||
                        entry.rule?.toLowerCase().includes(f) ||
                        entry.resourceType?.toLowerCase().includes(f);
                    })
                    .map((entry, i) => (
                      <LogEntry key={i} entry={entry} />
                    ))}
                </div>
              )}
            </>
          ) : (
            <div className="glass rounded-xl p-6 text-center text-fg/25 text-sm">
              Selecciona una app para ver el historial de bloqueos
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LogEntry({ entry }) {
  const ruleColor = entry.rule?.startsWith('Modo agresivo') ? 'text-orange-400'
    : entry.rule?.startsWith('Regla:') ? 'text-emerald-400'
    : entry.rule?.startsWith('ABP:') ? 'text-sky-400'
    : 'text-violet-400';

  const typeColors = {
    script: 'bg-amber-500/15 text-amber-300',
    image:  'bg-blue-500/15 text-blue-300',
    xhr:    'bg-purple-500/15 text-purple-300',
    fetch:  'bg-purple-500/15 text-purple-300',
    stylesheet: 'bg-green-500/15 text-green-300',
    subframe: 'bg-red-500/15 text-red-300',
    dom:    'bg-emerald-500/15 text-emerald-300',
    other:  'bg-overlay/[0.06] text-fg/35',
  };
  const typeClass = typeColors[entry.resourceType] || typeColors.other;

  return (
    <div className="glass rounded-lg px-3 py-2 flex items-start gap-2.5 min-w-0">
      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${typeClass}`}>
        {entry.resourceType || 'req'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-fg/55 truncate font-mono">{entry.hostname || entry.url}</p>
        <p className={`text-[10px] truncate ${ruleColor}`}>{entry.rule}</p>
        {entry.selector && <p className="text-[10px] truncate text-fg/24 font-mono">{entry.selector}</p>}
      </div>
      <span className="text-[9px] text-fg/20 flex-shrink-0 mt-0.5">
        {entry.ts ? new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
      </span>
    </div>
  );
}

function Stat({ icon: Icon, color, label, value }) {
  const colorClass = {
    emerald: 'bg-emerald-600/15 text-emerald-400',
    sky:     'bg-sky-600/15 text-sky-400',
    amber:   'bg-amber-600/15 text-amber-400',
    violet:  'bg-violet-600/20 text-violet-400',
  }[color] || 'bg-violet-600/20 text-violet-400';

  return (
    <div className="glass rounded-xl p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorClass}`}>
        <Icon size={17} />
      </div>
      <div>
        <p className="text-xs text-fg/30">{label}</p>
        <p className="text-lg font-bold text-fg/85">{value}</p>
      </div>
    </div>
  );
}

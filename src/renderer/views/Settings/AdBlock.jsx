import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Zap, Plus, X, AlertTriangle, RefreshCw, ListFilter } from 'lucide-react';
import Switch from '../../components/common/Switch';
import { useApps } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';

export default function AdBlock() {
  const { apps } = useApps();
  const toast = useToast();

  const [cfg, setCfg] = useState({
    enabled: true,
    cosmetic: true,
    httpsUpgrade: true,
    aggressive: true,
    annoyances: true,
    domainCount: 0,
    networkFilterCount: 0,
    cosmeticFilterCount: 0,
    subscriptionCount: 0,
  });
  const [subscriptions, setSubscriptions] = useState([]);
  const [updatingLists, setUpdatingLists] = useState(false);
  const [appCfgs, setAppCfgs] = useState({});
  const [newRule, setNewRule] = useState('');
  const [openApp, setOpenApp] = useState(null);

  const load = useCallback(async () => {
    const global = await window.electronAPI?.getAdBlockConfig() ?? {};
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
    await saveSubscriptions(subscriptions.map(item => (
      item.id === id ? { ...item, enabled: !item.enabled } : item
    )));
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
      else toast.success('Listas de filtros actualizadas');
    } catch (err) {
      toast.error('No se pudieron actualizar las listas', err.message);
    } finally {
      setUpdatingLists(false);
    }
  };

  const saveApp = async (appId, updates) => {
    setAppCfgs(prev => ({ ...prev, [appId]: { ...prev[appId], ...updates } }));
    await window.electronAPI?.updateAppAdBlockConfig(appId, updates);
  };

  const addCustomRule = async (appId) => {
    const rule = newRule.trim();
    if (!rule) return;
    const current = appCfgs[appId]?.customRules ?? [];
    if (current.includes(rule)) return;
    await saveApp(appId, { customRules: [...current, rule] });
    setNewRule('');
    toast.success('Regla anadida', rule);
  };

  const removeCustomRule = async (appId, rule) => {
    await saveApp(appId, { customRules: (appCfgs[appId]?.customRules ?? []).filter(item => item !== rule) });
  };

  const totalBlocked = Object.values(appCfgs).reduce((sum, item) => sum + (item.blocked || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-0.5 flex items-center gap-2">
          <ShieldCheck size={16} className="text-violet-400" /> Ad Block
        </h2>
        <p className="text-sm text-white/35 leading-relaxed max-w-md">
          Bloquea anuncios, trackers, popups, banners de cookies y peticiones sospechosas en todas tus apps SSB.
          Usa dominios locales, listas ABP, reglas cosmeticas por sitio y heuristicas tipo Brave.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={ShieldCheck} color="violet" label="Dominios bloqueados" value={cfg.domainCount.toLocaleString()} />
        <Stat icon={Zap} color="emerald" label="Peticiones bloqueadas" value={totalBlocked.toLocaleString()} />
        <Stat icon={ListFilter} color="sky" label="Reglas de red" value={(cfg.networkFilterCount || 0).toLocaleString()} />
        <Stat icon={ShieldCheck} color="amber" label="Reglas CSS" value={(cfg.cosmeticFilterCount || 0).toLocaleString()} />
      </div>

      <div className="glass rounded-xl p-4 flex flex-col gap-4">
        <Switch
          checked={cfg.enabled}
          onChange={value => saveGlobal({ enabled: value })}
          label="Ad Blocker global"
          description="Bloquea peticiones a dominios de anuncios y trackers en todos los SSBs."
        />
        <div className="divider" />
        <Switch
          checked={cfg.cosmetic}
          onChange={value => saveGlobal({ cosmetic: value })}
          label="Filtro cosmetico (CSS)"
          description="Oculta banners de cookies, contenedores de anuncios, overlays y botones de rastreo social."
        />
        <div className="divider" />
        <Switch
          checked={cfg.httpsUpgrade}
          onChange={value => saveGlobal({ httpsUpgrade: value })}
          label="Upgrade HTTP -> HTTPS"
          description="Fuerza conexiones seguras cuando el sitio lo soporta."
        />
        <div className="divider" />
        <Switch
          checked={cfg.aggressive}
          onChange={value => saveGlobal({ aggressive: value })}
          label="Modo agresivo anti-anuncios"
          description="Bloquea scripts, iframes, pixeles, pujas de anuncios y URLs sospechosas de terceros."
        />
        <div className="divider" />
        <Switch
          checked={cfg.annoyances}
          onChange={value => saveGlobal({ annoyances: value })}
          label="Anti-molestias"
          description="Bloquea permisos invasivos como notificaciones push y oculta overlays habituales."
        />
      </div>

      <div className="flex items-start gap-3 glass rounded-xl p-3.5">
        <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-white/40 leading-relaxed">
          El ad blocker se aplica al abrir cada ventana. Reabre las apps para que los cambios surtan efecto.
          El modo agresivo puede romper algunos sitios; en ese caso desactivalo solo para esa app.
        </p>
      </div>

      <div className="glass rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white/85">Listas de filtros</h3>
            <p className="text-xs text-white/35 mt-1 leading-relaxed">
              Suscripciones compatibles con Adblock Plus. Se cachean localmente y se combinan con las reglas internas.
            </p>
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

        <div className="flex flex-col gap-2">
          {subscriptions.map(item => (
            <div key={item.id || item.url} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 flex items-center gap-3">
              <button
                onClick={() => toggleSubscription(item.id)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${item.enabled ? 'bg-violet-600' : 'bg-white/[0.1]'}`}
                title={item.enabled ? 'Desactivar lista' : 'Activar lista'}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${item.enabled ? 'translate-x-5' : ''}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white/75 truncate">{item.name}</p>
                  {item.error && <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">cache</span>}
                </div>
                <p className="text-[11px] text-white/30 truncate">{item.url}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-white/55">{((item.ruleCount || 0) + (item.cosmeticCount || 0)).toLocaleString()}</p>
                <p className="text-[10px] text-white/25">{item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : 'Sin actualizar'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {apps.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-2.5">
            Por aplicacion
          </h3>
          <div className="flex flex-col gap-2">
            {apps.map(app => {
              const ac = appCfgs[app.id] ?? { enabled: true, customRules: [], blocked: 0 };
              const isOpen = openApp === app.id;
              return (
                <div key={app.id} className="glass rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-3.5 py-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.enabled && ac.enabled ? 'bg-emerald-400' : 'bg-white/15'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">{app.name}</p>
                      <p className="text-[11px] text-white/30">
                        {ac.blocked > 0 ? `${ac.blocked} bloqueadas` : 'Sin bloqueos registrados'}
                        {ac.customRules?.length > 0 && ` · ${ac.customRules.length} regla${ac.customRules.length > 1 ? 's' : ''} custom`}
                      </p>
                    </div>
                    <button
                      onClick={() => saveApp(app.id, { enabled: !ac.enabled })}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${ac.enabled ? 'bg-violet-600 border border-violet-400/40' : 'bg-white/[0.08] border border-white/[0.16]'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${ac.enabled ? 'translate-x-5' : ''}`} />
                    </button>
                    <button
                      onClick={() => setOpenApp(isOpen ? null : app.id)}
                      className="text-[10px] text-white/35 hover:text-violet-400 transition-colors px-2 py-1 rounded-lg border border-white/[0.08] hover:border-violet-500/30 flex-shrink-0"
                    >
                      {isOpen ? 'Cerrar' : 'Reglas'}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-white/[0.06] px-3.5 pb-3.5 pt-3 flex flex-col gap-3">
                      <p className="text-xs text-white/35">Reglas adicionales para esta app: dominio, URL parcial o palabra clave.</p>
                      {ac.customRules?.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {ac.customRules.map(rule => (
                            <div key={rule} className="flex items-center gap-2 text-xs">
                              <code className="flex-1 text-violet-400/80 bg-violet-500/10 px-2 py-1 rounded-lg">{rule}</code>
                              <button onClick={() => removeCustomRule(app.id, rule)} className="text-white/25 hover:text-red-400 transition-colors p-1">
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newRule}
                          onChange={event => setNewRule(event.target.value)}
                          onKeyDown={event => event.key === 'Enter' && addCustomRule(app.id)}
                          placeholder="ejemplo.com o /ads/"
                          className="input-field flex-1 text-xs"
                        />
                        <button
                          onClick={() => addCustomRule(app.id)}
                          disabled={!newRule.trim()}
                          className="btn-primary flex items-center gap-1.5 text-xs px-3 flex-shrink-0 disabled:opacity-40"
                        >
                          <Plus size={12} /> Anadir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, color, label, value }) {
  const colorClass = {
    emerald: 'bg-emerald-600/15 text-emerald-400',
    sky: 'bg-sky-600/15 text-sky-400',
    amber: 'bg-amber-600/15 text-amber-400',
    violet: 'bg-violet-600/20 text-violet-400',
  }[color] || 'bg-violet-600/20 text-violet-400';

  return (
    <div className="glass rounded-xl p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorClass}`}>
        <Icon size={17} />
      </div>
      <div>
        <p className="text-xs text-white/30">{label}</p>
        <p className="text-lg font-bold text-white/85">{value}</p>
      </div>
    </div>
  );
}

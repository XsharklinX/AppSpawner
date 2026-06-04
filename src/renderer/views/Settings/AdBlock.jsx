import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldOff, Zap, Globe, Lock, RefreshCw, Plus, X, AlertTriangle } from 'lucide-react';
import Switch     from '../../components/common/Switch';
import { useApps }  from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';

export default function AdBlock() {
  const { apps }  = useApps();
  const toast     = useToast();

  const [cfg,     setCfg]     = useState({ enabled: true, cosmetic: true, httpsUpgrade: true, domainCount: 0 });
  const [appCfgs, setAppCfgs] = useState({}); // { appId: { enabled, customRules, blocked } }
  const [loading, setLoading] = useState(true);
  const [newRule, setNewRule] = useState('');
  const [openApp, setOpenApp] = useState(null); // appId with expanded custom rules

  const load = useCallback(async () => {
    try {
      const global = await window.electronAPI?.getAdBlockConfig() ?? {};
      setCfg(global);
      const entries = await Promise.all(
        apps.map(async app => {
          const c = await window.electronAPI?.getAppAdBlockConfig(app.id) ?? {};
          return [app.id, c];
        })
      );
      setAppCfgs(Object.fromEntries(entries));
    } finally {
      setLoading(false);
    }
  }, [apps]);

  useEffect(() => { load(); }, [load]);

  const saveGlobal = async (updates) => {
    const next = { ...cfg, ...updates };
    setCfg(next);
    await window.electronAPI?.updateAdBlockConfig(updates);
    toast.success('Configuración guardada');
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
    const updated = [...current, rule];
    await saveApp(appId, { customRules: updated });
    setNewRule('');
    toast.success('Regla añadida', rule);
  };

  const removeCustomRule = async (appId, rule) => {
    const updated = (appCfgs[appId]?.customRules ?? []).filter(r => r !== rule);
    await saveApp(appId, { customRules: updated });
  };

  const totalBlocked = Object.values(appCfgs).reduce((s, c) => s + (c.blocked || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-0.5 flex items-center gap-2">
          <ShieldCheck size={16} className="text-violet-400" /> Ad Block
        </h2>
        <p className="text-sm text-white/35 leading-relaxed max-w-md">
          Bloquea anuncios, trackers y banners de cookies en todas tus apps SSB.
          Basado en una lista de {cfg.domainCount.toLocaleString()} dominios.
        </p>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600/20 flex items-center justify-center">
            <ShieldCheck size={17} className="text-violet-400" />
          </div>
          <div>
            <p className="text-xs text-white/30">Dominios bloqueados</p>
            <p className="text-lg font-bold text-white/85">{cfg.domainCount.toLocaleString()}</p>
          </div>
        </div>
        <div className="glass rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600/15 flex items-center justify-center">
            <Zap size={17} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-white/30">Peticiones bloqueadas</p>
            <p className="text-lg font-bold text-white/85">{totalBlocked.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── Toggles globales ─────────────────────────────────────────────── */}
      <div className="glass rounded-xl p-4 flex flex-col gap-4">
        <Switch
          checked={cfg.enabled}
          onChange={v => saveGlobal({ enabled: v })}
          label="Ad Blocker global"
          description="Bloquea peticiones a dominios de anuncios y trackers en todos los SSBs."
        />
        <div className="divider" />
        <Switch
          checked={cfg.cosmetic}
          onChange={v => saveGlobal({ cosmetic: v })}
          label="Filtro cosmético (CSS)"
          description="Oculta banners de cookies, contenedores de anuncios y botones de rastreo social."
        />
        <div className="divider" />
        <Switch
          checked={cfg.httpsUpgrade}
          onChange={v => saveGlobal({ httpsUpgrade: v })}
          label="Upgrade HTTP → HTTPS"
          description="Fuerza conexiones seguras cuando el sitio lo soporta."
        />
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 glass rounded-xl p-3.5">
        <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-white/40 leading-relaxed">
          El ad blocker se aplica al abrir cada ventana. <strong className="text-white/60">Reabre las apps</strong> para que los cambios surtan efecto.
          Algunos sites pueden requerir desactivarlo para funcionar correctamente.
        </p>
      </div>

      {/* ── Configuración por app ─────────────────────────────────────────── */}
      {apps.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-2.5">
            Por aplicación
          </h3>
          <div className="flex flex-col gap-2">
            {apps.map(app => {
              const ac      = appCfgs[app.id] ?? { enabled: true, customRules: [], blocked: 0 };
              const isOpen  = openApp === app.id;
              return (
                <div key={app.id} className="glass rounded-xl overflow-hidden">
                  {/* Fila principal */}
                  <div className="flex items-center gap-3 px-3.5 py-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.enabled && ac.enabled ? 'bg-emerald-400' : 'bg-white/15'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">{app.name}</p>
                      <p className="text-[11px] text-white/30">
                        {ac.blocked > 0 ? `${ac.blocked} bloqueadas` : 'Sin bloqueos registrados'}
                        {ac.customRules?.length > 0 && ` · ${ac.customRules.length} regla${ac.customRules.length > 1 ? 's' : ''} custom`}
                      </p>
                    </div>
                    {/* Toggle por app */}
                    <div
                      onClick={() => saveApp(app.id, { enabled: !ac.enabled })}
                      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${ac.enabled ? 'bg-violet-600' : 'bg-white/[0.1]'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${ac.enabled ? 'translate-x-4' : ''}`} />
                    </div>
                    {/* Expandir reglas custom */}
                    <button
                      onClick={() => setOpenApp(isOpen ? null : app.id)}
                      className="text-[10px] text-white/25 hover:text-violet-400 transition-colors px-1.5 py-1 rounded-lg border border-white/[0.05] hover:border-violet-500/30 flex-shrink-0"
                    >
                      {isOpen ? 'Cerrar' : 'Reglas'}
                    </button>
                  </div>

                  {/* Reglas custom expandido */}
                  {isOpen && (
                    <div className="border-t border-white/[0.06] px-3.5 pb-3.5 pt-3 flex flex-col gap-3">
                      <p className="text-xs text-white/35">Reglas de bloqueo adicionales para esta app (dominio o palabra clave):</p>
                      {/* Lista de reglas */}
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
                      {/* Input para nueva regla */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newRule}
                          onChange={e => setNewRule(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addCustomRule(app.id)}
                          placeholder="ejemplo.com o palabra-clave"
                          className="input-field flex-1 text-xs"
                        />
                        <button
                          onClick={() => addCustomRule(app.id)}
                          disabled={!newRule.trim()}
                          className="btn-primary flex items-center gap-1.5 text-xs px-3 flex-shrink-0 disabled:opacity-40"
                        >
                          <Plus size={12} /> Añadir
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

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Save, Globe, AlertCircle, CheckCircle2, ChevronDown, Image, Type, Monitor, Maximize2, PictureInPicture, Pencil } from 'lucide-react';
import AppIcon    from '../components/common/AppIcon';
import Switch     from '../components/common/Switch';
import { useApps }        from '../contexts/AppContext';
import { useI18n }        from '../contexts/I18nContext';
import { useWorkspaces }  from '../contexts/WorkspaceContext';
import { CATEGORIES }     from '../lib/constants';
import { isValidUrl, normalizeUrl, seedColor, getInitials } from '../lib/utils';

const COLOR_PALETTE = [
  '#7c3aed','#2563eb','#059669','#dc2626','#d97706',
  '#db2777','#0891b2','#65a30d','#ea580c','#6366f1',
  '#0d9488','#4f46e5','#be185d','#b45309','#1d4ed8',
];

const USER_AGENTS = [
  { label: 'Por defecto (Electron)',  value: '' },
  { label: 'Chrome 120 (Windows)',   value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  { label: 'Chrome 120 (macOS)',     value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  { label: 'Edge 120 (Windows)',     value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' },
  { label: 'Firefox 121 (Windows)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0' },
  { label: 'Safari 17 (macOS)',      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15' },
];

export default function CreateApp({
  onNavigate,
  editMode    = false,
  initialData = null,
  onSaved     = null,
  embedded    = false,
}) {
  const { installApp, updateApp } = useApps();
  const { workspaces }             = useWorkspaces();
  const { t }                      = useI18n();

  const [form, setForm] = useState({
    name:            initialData?.name         || '',
    url:             initialData?.url          || '',
    category:        initialData?.category     || 'general',
    iconType:        initialData?.iconType     || 'favicon',
    iconValue:       initialData?.iconValue    || '',
    iconColor:       initialData?.iconColor    || seedColor(''),
    accountLabel:    initialData?.accountLabel || '',
    workspaceId:     initialData?.workspaceId  || '',
    openMode:        initialData?.openMode     || 'normal',
    proxy: {
      enabled: initialData?.proxy?.enabled || false,
      type:    initialData?.proxy?.type    || 'http',
      host:    initialData?.proxy?.host    || '',
      port:    initialData?.proxy?.port    || 8080,
    },
    screenshotConfig: {
      enabled:  initialData?.screenshotConfig?.enabled  || false,
      interval: initialData?.screenshotConfig?.interval || 30,
    },
    adblockEnabled: initialData?.adblockEnabled !== false,
    userAgent:      initialData?.userAgent    || '',
    createShortcuts: true,
  });

  const [urlState, setUrlState]   = useState('idle'); // 'idle' | 'valid' | 'invalid'
  const [errors,   setErrors]     = useState({});
  const [saving,   setSaving]     = useState(false);
  const [showUA,   setShowUA]     = useState(false);

  // Iniciales calculadas para el preview
  const iconValue = form.iconValue || getInitials(form.name) || '?';
  const previewIconType = form.iconType === 'favicon' && urlState === 'valid' ? 'favicon' : 'initials';

  // Actualizar color automáticamente cuando cambia el nombre (solo al crear)
  useEffect(() => {
    if (!editMode && form.name && !form.iconValue) {
      setForm(prev => ({ ...prev, iconColor: seedColor(prev.name) }));
    }
  }, [form.name, editMode]);

  // Validación de URL en tiempo real (debounced 400ms)
  useEffect(() => {
    if (!form.url) { setUrlState('idle'); return; }
    setUrlState('idle');
    const timer = setTimeout(() => {
      const normalized = normalizeUrl(form.url);
      setUrlState(isValidUrl(normalized) ? 'valid' : 'invalid');
    }, 400);
    return () => clearTimeout(timer);
  }, [form.url]);

  const field = useCallback((key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  }, []);

  const validate = () => {
    const e = {};
    if (!form.name.trim())                   e.name = t('form_name_error');
    const normalized = normalizeUrl(form.url);
    if (!isValidUrl(normalized))             e.url  = t('form_url_error');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        url:          normalizeUrl(form.url),
        iconValue:    iconValue,
        name:         form.name.trim(),
        accountLabel: form.accountLabel.trim(),
        workspaceId:     form.workspaceId  || null,
        openMode:        form.openMode     || 'normal',
        adblockEnabled:  form.adblockEnabled,
        iconType:        form.iconType,
      };

      if (editMode && initialData) {
        await updateApp(initialData.id, payload);
        onSaved?.();
      } else {
        await installApp(payload, { createShortcuts: form.createShortcuts });
        if (!embedded) onNavigate?.('dashboard');
        else           onSaved?.();
      }
    } finally {
      setSaving(false);
    }
  };

  // Detectar automáticamente el nombre desde la URL
  const autoDetectName = useCallback(() => {
    if (!form.url || form.name) return;
    try {
      const hostname = new URL(normalizeUrl(form.url)).hostname;
      const domain   = hostname.replace('www.', '').split('.')[0];
      const name     = domain.charAt(0).toUpperCase() + domain.slice(1);
      field('name', name);
    } catch {}
  }, [form.url, form.name, field]);

  const urlInputClass = `input-field ${
    urlState === 'valid'   ? 'border-emerald-500/50 focus:border-emerald-500' :
    urlState === 'invalid' ? 'border-red-500/50 focus:border-red-500' :
    errors.url             ? 'border-red-500/50' : ''
  }`;

  return (
    <div className={embedded ? '' : 'h-full flex flex-col overflow-hidden'}>

      {/* Header standalone */}
      {!embedded && (
        <div className="flex-shrink-0 px-7 pt-6 pb-4">
          <button
            onClick={() => onNavigate?.('dashboard')}
            className="flex items-center gap-2 text-sm text-white/35 hover:text-white/65 transition-colors mb-5"
          >
            <ArrowLeft size={15} /> Volver al Dashboard
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-accent-gradient flex items-center justify-center shadow-glow flex-shrink-0">
              {editMode
                ? <Monitor size={17} className="text-white" />
                : <Plus size={17} className="text-white" />
              }
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {editMode ? t('edit_title') : t('create_title')}
              </h1>
              <p className="text-xs text-white/35">{t('create_subtitle')}</p>
            </div>
          </div>
        </div>
      )}

      <div className={embedded ? '' : 'flex-1 overflow-y-auto scrollbar-thin px-7 pb-6'}>
        <div className={embedded ? '' : 'max-w-xl'}>

          {/* Preview en tiempo real (solo standalone) */}
          {!embedded && (
            <div
              className="rounded-2xl mb-5 overflow-hidden border border-white/[0.07]"
              style={{ background: `linear-gradient(135deg, ${form.iconColor}18 0%, #0d0d1a 100%)` }}
            >
              {/* Banda de color */}
              <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${form.iconColor}, ${form.iconColor}55)` }} />
              <div className="p-5 flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <AppIcon
                    iconType={previewIconType}
                    iconValue={iconValue}
                    iconColor={form.iconColor}
                    name={form.name || 'App'}
                    url={normalizeUrl(form.url)}
                    size={64}
                    className="ring-2 ring-white/10"
                  />
                  {urlState === 'valid' && form.iconType === 'favicon' && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-[#09090e]">
                      <Globe size={9} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-white/90 truncate">
                    {form.name || <span className="text-white/25 font-normal">{t('form_name_ph')}</span>}
                  </p>
                  {form.accountLabel && (
                    <span className="text-[10px] text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded-full mt-0.5 inline-block border border-violet-500/20">
                      {form.accountLabel}
                    </span>
                  )}
                  <p className="text-xs text-white/35 mt-1 truncate">
                    {normalizeUrl(form.url) || <span className="text-white/20">{t('form_url_ph')}</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="category-badge capitalize">{form.category}</span>
                    {urlState === 'valid' && <span className="text-[10px] text-emerald-400/80 flex items-center gap-1"><CheckCircle2 size={10}/> URL válida</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* URL */}
            <div>
              <label className="form-label">{t('form_url')}</label>
              <div className="relative">
                <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
                <input
                  type="text"
                  value={form.url}
                  onChange={e => field('url', e.target.value)}
                  onBlur={autoDetectName}
                  placeholder={t('form_url_ph')}
                  className={`${urlInputClass} pl-9 pr-9`}
                  autoComplete="url"
                  autoFocus={!embedded && !editMode}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {urlState === 'valid'   && <CheckCircle2 size={14} className="text-emerald-400" />}
                  {urlState === 'invalid' && <AlertCircle  size={14} className="text-red-400" />}
                </div>
              </div>
              {(errors.url || urlState === 'invalid') && (
                <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {errors.url || t('form_url_error')}
                </p>
              )}
            </div>

            {/* Nombre */}
            <div>
              <label className="form-label">{t('form_name')}</label>
              <input
                type="text"
                value={form.name}
                onChange={e => field('name', e.target.value)}
                placeholder={t('form_name_ph')}
                className={`input-field ${errors.name ? 'border-red-500/50' : ''}`}
                maxLength={80}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-400">{errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Categoría */}
              <div>
                <label className="form-label">{t('form_category')}</label>
                <select
                  value={form.category}
                  onChange={e => field('category', e.target.value)}
                  className="input-field"
                >
                  {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label_es}</option>
                  ))}
                </select>
              </div>

              {/* Etiqueta de cuenta (multi-cuenta) */}
              <div>
                <label className="form-label">Etiqueta de cuenta <span className="text-white/25 font-normal">(opcional)</span></label>
                <input
                  type="text"
                  value={form.accountLabel}
                  onChange={e => field('accountLabel', e.target.value.slice(0, 30))}
                  placeholder="Trabajo, Personal…"
                  className="input-field text-sm"
                  maxLength={30}
                />
              </div>
            </div>

            {/* ── Selector de tipo de ícono ─────────────────────────────── */}
            <div>
              <label className="form-label">Ícono de la app</label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => field('iconType', 'favicon')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    form.iconType === 'favicon'
                      ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                      : 'bg-white/[0.03] border-white/[0.07] text-white/40 hover:text-white/60'
                  }`}
                >
                  <Image size={12} />
                  Favicon del sitio
                  {form.iconType === 'favicon' && urlState === 'valid' && (
                    <span className="text-emerald-400">✓</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => field('iconType', 'initials')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    form.iconType === 'initials'
                      ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                      : 'bg-white/[0.03] border-white/[0.07] text-white/40 hover:text-white/60'
                  }`}
                >
                  <Type size={12} />
                  Iniciales
                </button>
              </div>

              {/* Opciones de iniciales (solo cuando está seleccionado) */}
              {form.iconType === 'initials' && (
                <div className="flex flex-col gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div>
                    <label className="form-label text-[11px]">{t('form_icon_initials')}</label>
                    <input
                      type="text"
                      value={form.iconValue}
                      onChange={e => field('iconValue', e.target.value.toUpperCase().slice(0, 3))}
                      placeholder={getInitials(form.name) || 'AB'}
                      className="input-field uppercase font-bold tracking-wider"
                      maxLength={3}
                    />
                  </div>
                  <div>
                    <label className="form-label text-[11px]">{t('form_icon_color')}</label>
                    <div className="flex gap-2 flex-wrap">
                      {COLOR_PALETTE.map(color => (
                        <button
                          type="button"
                          key={color}
                          onClick={() => field('iconColor', color)}
                          style={{ background: color }}
                          className={`
                            w-7 h-7 rounded-lg transition-all duration-100 active:scale-90
                            ${form.iconColor === color
                              ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-surface-card scale-110'
                              : 'opacity-65 hover:opacity-100 hover:scale-105'
                            }
                          `}
                        />
                      ))}
                      <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-white/15 hover:border-white/30 transition-colors"
                        style={{ background: form.iconColor }}
                        title="Color personalizado"
                      >
                        <input
                          type="color"
                          value={form.iconColor}
                          onChange={e => field('iconColor', e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {form.iconType === 'favicon' && urlState !== 'valid' && (
                <p className="text-[11px] text-white/30 flex items-center gap-1.5 mt-1">
                  <Globe size={11} />
                  Introduce una URL válida para previsualizar el favicon.
                </p>
              )}
            </div>

            {/* ── Opciones avanzadas ─────────────────────────────────────── */}
            <div className="glass rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowUA(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-white/50 hover:text-white/70 transition-colors"
              >
                <span className="font-medium">Opciones avanzadas</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${showUA ? 'rotate-180' : ''}`} />
              </button>

              {showUA && (
                <div className="px-4 pb-4 flex flex-col gap-4 border-t border-white/[0.05]">

                  {/* Workspace */}
                  {workspaces.length > 0 && (
                    <div className="pt-3">
                      <label className="form-label">Workspace</label>
                      <select
                        value={form.workspaceId}
                        onChange={e => field('workspaceId', e.target.value)}
                        className="input-field"
                      >
                        <option value="">Sin workspace</option>
                        {workspaces.map(ws => (
                          <option key={ws.id} value={ws.id}>{ws.emoji} {ws.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Modo de pantalla */}
                  <div className={workspaces.length > 0 ? '' : 'pt-3'}>
                    <label className="form-label">Modo de apertura</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'normal',     icon: Monitor,         label: 'Normal'      },
                        { value: 'fullscreen', icon: Maximize2,       label: 'Pantalla completa' },
                        { value: 'compact',    icon: PictureInPicture, label: 'Compacto flotante' },
                      ].map(({ value, icon: Icon, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => field('openMode', value)}
                          className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[11px] font-medium border transition-all ${
                            form.openMode === value
                              ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                              : 'bg-white/[0.03] border-white/[0.07] text-white/35 hover:text-white/55'
                          }`}
                        >
                          <Icon size={14} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Proxy */}
                  <div>
                    <label className="form-label flex items-center gap-2">
                      Proxy HTTP/SOCKS
                      <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
                        <div
                          onClick={() => field('proxy', { ...form.proxy, enabled: !form.proxy.enabled })}
                          className={`relative w-8 h-4 rounded-full transition-colors ${form.proxy.enabled ? 'bg-violet-600' : 'bg-white/[0.1]'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${form.proxy.enabled ? 'translate-x-4' : ''}`} />
                        </div>
                        <span className="text-[11px] text-white/40">Activar</span>
                      </label>
                    </label>
                    {form.proxy.enabled && (
                      <div className="flex gap-2 mt-2">
                        <select
                          value={form.proxy.type}
                          onChange={e => field('proxy', { ...form.proxy, type: e.target.value })}
                          className="input-field w-28 text-xs flex-shrink-0"
                        >
                          <option value="http">HTTP</option>
                          <option value="https">HTTPS</option>
                          <option value="socks4">SOCKS4</option>
                          <option value="socks5">SOCKS5</option>
                        </select>
                        <input type="text" value={form.proxy.host} onChange={e => field('proxy', { ...form.proxy, host: e.target.value })} placeholder="host o IP" className="input-field flex-1 text-xs" />
                        <input type="number" value={form.proxy.port} onChange={e => field('proxy', { ...form.proxy, port: parseInt(e.target.value) || 8080 })} placeholder="Puerto" className="input-field w-20 text-xs flex-shrink-0" min="1" max="65535" />
                      </div>
                    )}
                  </div>

                  {/* Screenshots programados */}
                  <div>
                    <label className="form-label flex items-center gap-2">
                      Screenshots automáticos
                      <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
                        <div
                          onClick={() => field('screenshotConfig', { ...form.screenshotConfig, enabled: !form.screenshotConfig.enabled })}
                          className={`relative w-8 h-4 rounded-full transition-colors ${form.screenshotConfig.enabled ? 'bg-violet-600' : 'bg-white/[0.1]'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${form.screenshotConfig.enabled ? 'translate-x-4' : ''}`} />
                        </div>
                        <span className="text-[11px] text-white/40">Activar</span>
                      </label>
                    </label>
                    {form.screenshotConfig.enabled && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-white/40">Cada</span>
                        <input
                          type="number"
                          value={form.screenshotConfig.interval}
                          onChange={e => field('screenshotConfig', { ...form.screenshotConfig, interval: parseInt(e.target.value) || 30 })}
                          className="input-field w-20 text-xs"
                          min="1" max="1440"
                        />
                        <span className="text-xs text-white/40">minutos</span>
                      </div>
                    )}
                  </div>

                  {/* Ad Blocker per-app */}
                  <div>
                    <label className="form-label flex items-center gap-2">
                      Ad Blocker
                      <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
                        <div
                          onClick={() => field('adblockEnabled', !form.adblockEnabled)}
                          className={`relative w-8 h-4 rounded-full transition-colors ${form.adblockEnabled ? 'bg-violet-600' : 'bg-white/[0.1]'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${form.adblockEnabled ? 'translate-x-4' : ''}`} />
                        </div>
                        <span className="text-[11px] text-white/40">
                          {form.adblockEnabled ? 'Activado' : 'Desactivado'}
                        </span>
                      </label>
                    </label>
                    <p className="text-[11px] text-white/25 mt-1">
                      Hereda la configuración global. Desactiva solo si la app falla con el bloqueador.
                    </p>
                  </div>

                  {/* User-Agent */}
                  <div>
                    <label className="form-label">User-Agent del navegador</label>
                    <select
                      value={form.userAgent}
                      onChange={e => field('userAgent', e.target.value)}
                      className="input-field text-xs"
                    >
                      {USER_AGENTS.map(ua => (
                        <option key={ua.label} value={ua.value}>{ua.label}</option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-[11px] text-white/30 leading-relaxed">
                      Usa "Chrome" si el sitio web no carga correctamente con el user-agent de Electron.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Toggle de accesos directos (solo al crear) */}
            {!editMode && (
              <div className="glass rounded-xl p-4">
                <Switch
                  checked={form.createShortcuts}
                  onChange={v => field('createShortcuts', v)}
                  label={t('form_shortcuts')}
                  description={t('form_shortcuts_desc')}
                />
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving || urlState === 'invalid'}
                className={`
                  btn-primary flex items-center gap-2 text-sm flex-1 justify-center py-2.5
                  ${(saving || urlState === 'invalid') ? 'opacity-60 cursor-not-allowed' : ''}
                `}
              >
                {saving
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : editMode ? <Save size={15} /> : <Plus size={15} />
                }
                {saving ? t('loading') : editMode ? t('form_save') : t('form_create')}
              </button>

              <button
                type="button"
                onClick={() => embedded ? onSaved?.() : onNavigate?.('dashboard')}
                className="btn-ghost text-sm"
              >
                {t('form_cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

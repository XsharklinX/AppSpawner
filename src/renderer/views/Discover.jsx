import React, { useState, useMemo } from 'react';
import { Search, Download, CheckCircle2, Sparkles, Clapperboard, BrainCircuit, BriefcaseBusiness, Code2, Layers3 } from 'lucide-react';
import AppIcon           from '../components/common/AppIcon';
import { useApps }        from '../contexts/AppContext';
import { useI18n }        from '../contexts/I18nContext';
import { DISCOVER_APPS, CATEGORIES, APP_TEMPLATES, TEMPLATE_BY_CATEGORY } from '../lib/constants';

const TEMPLATE_ICONS = {
  streaming: Clapperboard,
  ia: BrainCircuit,
  productividad: BriefcaseBusiness,
  desarrollo: Code2,
};

export default function Discover({ onNavigate }) {
  const { apps, installApp } = useApps();
  const { t, language }       = useI18n();
  const [searchQuery,  setSearchQuery]  = useState('');
  const [installing,   setInstalling]   = useState({}); // { catalogId: bool }
  const [filterCat,    setFilterCat]    = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState('all');

  // Detectar apps ya instaladas por URL
  const installedUrls = useMemo(
    () => new Set(apps.map(a => a.url.replace(/\/$/, ''))),
    [apps]
  );

  const isInstalled = (catalogApp) =>
    installedUrls.has(catalogApp.url.replace(/\/$/, ''));

  // Filtrar por búsqueda y categoría
  const filteredApps = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return DISCOVER_APPS.filter(app => {
      const templateId    = TEMPLATE_BY_CATEGORY[app.category] || null;
      const matchesTemplate = selectedTemplate === 'all' || templateId === selectedTemplate;
      const matchesCat    = filterCat === 'all' || app.category === filterCat;
      const desc          = language === 'en' ? (app.description_en || '') : (app.description_es || '');
      const matchesSearch = !q || app.name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
      return matchesTemplate && matchesCat && matchesSearch;
    });
  }, [searchQuery, filterCat, selectedTemplate, language]);

  const featuredApps = DISCOVER_APPS.filter(a => a.featured);

  const handleInstall = async (catalogApp) => {
    if (isInstalled(catalogApp) || installing[catalogApp.id]) return;
    setInstalling(prev => ({ ...prev, [catalogApp.id]: true }));
    try {
      await installApp({
        ...(APP_TEMPLATES.find(tpl => tpl.id === (catalogApp.template || TEMPLATE_BY_CATEGORY[catalogApp.category]))?.config || {}),
        name:       catalogApp.name,
        url:        catalogApp.url,
        category:   catalogApp.category,
        iconType:   catalogApp.iconType,
        iconValue:  catalogApp.iconValue,
        iconColor:  catalogApp.iconColor,
        catalogId:  catalogApp.id,
      });
    } finally {
      setInstalling(prev => ({ ...prev, [catalogApp.id]: false }));
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-7 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">{t('disc_title')}</h1>
            <p className="text-sm text-white/35 mt-0.5 max-w-md">{t('disc_subtitle')}</p>
          </div>
          {/* Búsqueda */}
          <div className="relative w-64 flex-shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('disc_search')}
              className="input-field pl-9 py-2 text-sm w-full"
            />
          </div>
        </div>

        {/* Filtros de categoría */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {[{ id: 'all', label_es: 'Todas', label_en: 'All' }, ...CATEGORIES.slice(1)].map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setFilterCat(cat.id);
                if (cat.id === 'all') setSelectedTemplate('all');
              }}
              className={`
                flex-shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full transition-all duration-150
                ${filterCat === cat.id
                  ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30'
                  : 'bg-white/[0.04] text-white/45 hover:text-white/70 hover:bg-white/[0.07] border border-white/[0.05]'
                }
              `}
            >
              {language === 'en' ? cat.label_en : cat.label_es}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers3 size={14} className="text-violet-300" />
            <span className="text-xs font-semibold uppercase tracking-wider text-white/45">Plantillas de instalacion</span>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {[{ id: 'all', label_es: 'Todas', label_en: 'All', description_es: 'Directorio completo sin preset activo.', description_en: 'Full directory without an active preset.', accent: '#8b5cf6' }, ...APP_TEMPLATES].map(template => {
              const Icon = TEMPLATE_ICONS[template.id] || Layers3;
              const active = selectedTemplate === template.id;
              return (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template.id);
                    setFilterCat(template.category || 'all');
                  }}
                  className={`rounded-2xl border p-3 text-left transition-all min-h-[110px] ${
                    active
                      ? 'bg-violet-600/16 border-violet-500/35 shadow-card'
                      : 'bg-white/[0.025] border-white/[0.06] hover:bg-white/[0.045] hover:border-white/[0.1]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${template.accent}22`, color: template.accent }}>
                      <Icon size={16} />
                    </div>
                    {active && <CheckCircle2 size={15} className="text-violet-300" />}
                  </div>
                  <p className="text-sm font-semibold text-white/82 mt-3">{language === 'en' ? template.label_en : template.label_es}</p>
                  <p className="text-[11px] text-white/38 mt-1 leading-relaxed line-clamp-2">
                    {language === 'en' ? template.description_en : template.description_es}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Contenido ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-7 pb-6">

        {/* Apps Destacadas (solo si no hay filtro de búsqueda/categoría) */}
        {!searchQuery && filterCat === 'all' && selectedTemplate === 'all' && (
          <section className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                {t('disc_featured')}
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {featuredApps.map(app => (
                <DiscoverCard
                  key={app.id}
                  app={app}
                  installed={isInstalled(app)}
                  installing={!!installing[app.id]}
                  onInstall={() => handleInstall(app)}
                  t={t}
                  language={language}
                  featured
                />
              ))}
            </div>
          </section>
        )}

        {/* Todas las apps */}
        {filteredApps.length > 0 ? (
          <section>
            {(!searchQuery && filterCat === 'all' && selectedTemplate === 'all') && (
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                {t('disc_all')}
              </h2>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredApps.map((app, i) => (
                <div
                  key={app.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${i * 25}ms`, animationFillMode: 'both' }}
                >
                  <DiscoverCard
                    app={app}
                    installed={isInstalled(app)}
                    installing={!!installing[app.id]}
                    onInstall={() => handleInstall(app)}
                    t={t}
                    language={language}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Search size={24} className="text-white/15" />
            <p className="text-sm text-white/30">No se encontraron apps para "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DiscoverCard({ app, installed, installing, onInstall, t, language, featured }) {
  const desc = language === 'en' ? app.description_en : app.description_es;

  return (
    <div className={`
      relative rounded-2xl overflow-hidden flex flex-col gap-0 group
      transition-all duration-200 border border-white/[0.06]
      ${installed
        ? 'opacity-55 cursor-default'
        : 'hover:shadow-card-hover hover:-translate-y-[2px] hover:border-white/[0.1] cursor-pointer'}
    `}
    style={{ background: `linear-gradient(135deg, ${app.iconColor}12 0%, #0d0d18 60%)` }}
    >
      {/* Accent line */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${app.iconColor}cc, transparent)` }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header: icon + badges */}
        <div className="flex items-start justify-between">
          <AppIcon
            iconType={app.iconType || 'favicon'}
            iconValue={app.iconValue}
            iconColor={app.iconColor}
            name={app.name}
            url={app.url}
            size={48}
            className="transition-transform duration-200 group-hover:scale-105"
          />
          <div className="flex flex-col items-end gap-1 mt-0.5">
            {featured && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/25 leading-none">
                ★ TOP
              </span>
            )}
            {app.rating && (
              <span className="text-[9px] text-white/30 font-medium">★ {app.rating}</span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white/90 leading-tight">{app.name}</h3>
          <p className="text-[11px] text-white/40 mt-1.5 leading-relaxed line-clamp-2">{desc}</p>
        </div>

        {/* Install button */}
        <button
          onClick={onInstall}
          disabled={installed || installing}
          className={`
            w-full flex items-center justify-center gap-1.5 text-xs font-semibold
            rounded-xl py-2.5 transition-all duration-150 active:scale-95 mt-auto
            ${installed
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 cursor-default'
              : installing
                ? 'bg-violet-600/30 text-violet-400 cursor-not-allowed border border-violet-500/20'
                : 'bg-violet-600/25 hover:bg-violet-600/45 text-violet-300 border border-violet-500/25 hover:border-violet-500/50'
            }
          `}
        >
          {installed ? (
            <><CheckCircle2 size={12} /> {t('disc_installed')}</>
          ) : installing ? (
            <><div className="w-3 h-3 border border-violet-400/50 border-t-violet-400 rounded-full animate-spin" /> Instalando...</>
          ) : (
            <><Download size={12} /> {t('disc_install')}</>
          )}
        </button>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { ArrowLeft, Camera, Code2, Shield, Stethoscope } from 'lucide-react';
import AppIcon          from '../components/common/AppIcon';
import SessionSnapshots from '../components/SessionSnapshots';
import AppScripts       from '../components/AppScripts';
import SecurityCenter   from '../components/SecurityCenter';
import AppDiagnostics   from '../components/AppDiagnostics';

const SECTIONS = [
  { id: 'sessions',    icon: Camera,      label: 'Sesiones',    component: SessionSnapshots },
  { id: 'scripts',     icon: Code2,       label: 'Scripts',     component: AppScripts       },
  { id: 'security',    icon: Shield,      label: 'Seguridad',   component: SecurityCenter   },
  { id: 'diagnostics', icon: Stethoscope, label: 'Diagnóstico', component: AppDiagnostics   },
];

/**
 * AppTools — Vista de pantalla completa para las herramientas de una app
 * (sesiones, scripts, seguridad, diagnóstico). Reemplaza los modales
 * anteriores, que quedaban demasiado limitados para editores de código
 * y listas largas.
 */
export default function AppTools({ app, initialSection = 'scripts', onBack }) {
  const [section, setSection] = useState(initialSection);

  if (!app) return null;

  const active  = SECTIONS.find(s => s.id === section) || SECTIONS[0];
  const Content = active.component;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Encabezado */}
      <div className="flex-shrink-0 px-7 pt-6 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-white/35 hover:text-white/65 transition-colors mb-5"
        >
          <ArrowLeft size={15} /> Volver al Dashboard
        </button>
        <div className="flex items-center gap-3">
          <AppIcon
            iconType={app.iconType} iconValue={app.iconValue}
            iconColor={app.iconColor} name={app.name} url={app.url}
            size={40}
          />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-fg/90 truncate">{app.name}</h1>
            <p className="text-xs text-fg/35 capitalize truncate">{app.category || 'general'}{app.accountLabel ? ` · ${app.accountLabel}` : ''}</p>
          </div>
        </div>
      </div>

      {/* Cuerpo: sidebar + contenido */}
      <div className="flex-1 flex overflow-hidden border-t border-white/[0.05]">
        <aside className="w-52 flex-shrink-0 border-r border-white/[0.05] p-3 flex flex-col gap-0.5 pt-5">
          {SECTIONS.map(s => {
            const Icon   = s.icon;
            const isActive = section === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-150 text-left
                  ${isActive
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/25'
                    : 'text-white/45 hover:text-white/75 hover:bg-white/[0.04]'
                  }
                `}
              >
                <Icon size={15} className={isActive ? 'text-violet-400' : 'text-white/25'} />
                {s.label}
              </button>
            );
          })}
        </aside>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-8 py-6">
          <div className="max-w-6xl animate-fade-in" key={section}>
            <Content app={app} />
          </div>
        </div>
      </div>
    </div>
  );
}

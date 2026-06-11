import React, { useState } from 'react';
import { Settings2, Palette, Link2, HardDrive, Info, ShieldCheck, Archive, LockKeyhole } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';
import General    from './General';
import Appearance from './Appearance';
import LinkRules  from './LinkRules';
import Storage    from './Storage';
import About      from './About';
import AdBlock    from './AdBlock';
import Backup     from './Backup';
import Security   from './Security';

const TABS = [
  { id: 'general',    icon: Settings2,   key: 'set_general'    },
  { id: 'adblock',    icon: ShieldCheck, key: 'set_adblock'    },
  { id: 'security',   icon: LockKeyhole, label: 'Seguridad'     },
  { id: 'appearance', icon: Palette,     key: 'set_appearance' },
  { id: 'link_rules', icon: Link2,       key: 'set_link_rules' },
  { id: 'storage',    icon: HardDrive,   key: 'set_storage'    },
  { id: 'backup',     icon: Archive,     label: 'Backup'       },
  { id: 'about',      icon: Info,        key: 'set_about'      },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const { t } = useI18n();

  const renderTab = () => {
    switch (activeTab) {
      case 'general':    return <General />;
      case 'adblock':    return <AdBlock />;
      case 'security':   return <Security />;
      case 'appearance': return <Appearance />;
      case 'link_rules': return <LinkRules />;
      case 'storage':    return <Storage />;
      case 'backup':     return <Backup />;
      case 'about':      return <About />;
      default:           return <General />;
    }
  };

  return (
    <div className="h-full flex overflow-hidden">

      {/* ── Sidebar interna de ajustes ─────────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 border-r border-white/[0.05] p-3 flex flex-col gap-0.5 pt-6">
        <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest px-3 pb-2">
          {t('set_title')}
        </p>
        {TABS.map(tab => {
          const Icon   = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150 text-left
                ${active
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/25'
                  : 'text-white/45 hover:text-white/75 hover:bg-white/[0.04]'
                }
              `}
            >
              <Icon size={15} className={active ? 'text-violet-400' : 'text-white/25'} />
              {tab.label || t(tab.key)}
            </button>
          );
        })}
      </aside>

      {/* ── Contenido del tab activo ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-8 py-6">
        <div className="max-w-6xl animate-fade-in" key={activeTab}>
          {renderTab()}
        </div>
      </div>
    </div>
  );
}

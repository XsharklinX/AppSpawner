import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n }  from '../../contexts/I18nContext';

export default function Appearance() {
  const { theme, setTheme, isDark } = useTheme();
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-0.5">{t('set_appearance')}</h2>
        <p className="text-sm text-white/35">Personaliza el aspecto visual de la interfaz.</p>
      </div>

      {/* ── Selector de tema ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">{t('app_theme')}</h3>

        <div className="grid grid-cols-2 gap-3">
          {/* Tarjeta Oscuro */}
          <ThemeCard
            id="dark"
            label={t('app_dark')}
            icon={Moon}
            selected={isDark}
            onClick={() => setTheme('dark')}
            preview={
              <div className="w-full h-16 rounded-lg bg-[#09090e] border border-white/10 p-2 flex flex-col gap-1.5">
                <div className="w-3/4 h-1.5 rounded-full bg-white/10" />
                <div className="flex gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-600/40" />
                  <div className="flex flex-col gap-1 flex-1 justify-center">
                    <div className="w-full h-1 rounded-full bg-white/10" />
                    <div className="w-2/3 h-1 rounded-full bg-white/[0.06]" />
                  </div>
                </div>
              </div>
            }
          />

          {/* Tarjeta Claro */}
          <ThemeCard
            id="light"
            label={t('app_light')}
            icon={Sun}
            selected={!isDark}
            onClick={() => setTheme('light')}
            preview={
              <div className="w-full h-16 rounded-lg bg-gray-100 border border-gray-200 p-2 flex flex-col gap-1.5">
                <div className="w-3/4 h-1.5 rounded-full bg-gray-300" />
                <div className="flex gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/60" />
                  <div className="flex flex-col gap-1 flex-1 justify-center">
                    <div className="w-full h-1 rounded-full bg-gray-300" />
                    <div className="w-2/3 h-1 rounded-full bg-gray-200" />
                  </div>
                </div>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

function ThemeCard({ id, label, icon: Icon, selected, onClick, preview }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-150 text-left
        ${selected
          ? 'bg-violet-600/15 border-violet-500/40 shadow-glow-sm'
          : 'glass hover:border-white/[0.12] hover:bg-white/[0.05]'
        }
      `}
    >
      {preview}
      <div className="flex items-center gap-2">
        <Icon size={14} className={selected ? 'text-violet-400' : 'text-white/30'} />
        <span className={`text-sm font-medium ${selected ? 'text-violet-300' : 'text-white/60'}`}>
          {label}
        </span>
        {selected && (
          <div className="ml-auto w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        )}
      </div>
    </button>
  );
}

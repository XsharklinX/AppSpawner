import React from 'react';
import { Moon, Sun, Sparkles, Palette, Square, SquareDot, CircleDot } from 'lucide-react';
import { useTheme, RADIUS_OPTIONS, DENSITY_OPTIONS, FONT_OPTIONS } from '../../contexts/ThemeContext';
import { useI18n }  from '../../contexts/I18nContext';

const RADIUS_ICONS = { sharp: Square, balanced: SquareDot, round: CircleDot };

const THEME_META = {
  dark:    { label: 'Dark',    icon: Moon,     desc: 'Base oscura equilibrada.' },
  light:   { label: 'Light',   icon: Sun,      desc: 'Interfaz clara para espacios iluminados.' },
  amoled:  { label: 'AMOLED',  icon: Sparkles, desc: 'Negro puro y acento verde.' },
  dracula: { label: 'Dracula', icon: Palette,  desc: 'Morado suave sobre grises profundos.' },
};

export default function Appearance() {
  const { themePreset, customTheme, presets, setTheme, setCustomTheme, uiPrefs, setUiPrefs } = useTheme();
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-0.5">{t('set_appearance')}</h2>
        <p className="text-sm text-white/35">Temas predefinidos y editor visual de colores.</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Temas del dashboard</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(presets).map(([id, palette]) => {
            const meta = THEME_META[id] || THEME_META.dark;
            return (
              <ThemeCard
                key={id}
                selected={themePreset === id}
                label={meta.label}
                desc={meta.desc}
                icon={meta.icon}
                palette={palette}
                onClick={() => setTheme(id)}
              />
            );
          })}
        </div>
      </div>

      <div className="glass rounded-2xl p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white/80">Tema custom</h3>
            <p className="text-xs text-white/35">Ajusta base, tarjetas, superficies y acento.</p>
          </div>
          <button onClick={() => setTheme('custom')} className="btn-ghost text-xs">
            Usar custom
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ['bg', 'Fondo'],
            ['card', 'Tarjetas'],
            ['elevated', 'Elevado'],
            ['accent', 'Acento'],
            ['text', 'Texto'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 bg-white/[0.035] border border-white/[0.06] rounded-xl px-3 py-2">
              <span className="text-xs text-white/55">{label}</span>
              <input
                type="color"
                value={customTheme[key]}
                onChange={e => setCustomTheme({ [key]: e.target.value })}
                className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
              />
            </label>
          ))}
          <label className="flex items-center justify-between gap-3 bg-white/[0.035] border border-white/[0.06] rounded-xl px-3 py-2">
            <span className="text-xs text-white/55">Modo</span>
            <select
              value={customTheme.mode}
              onChange={e => setCustomTheme({ mode: e.target.value })}
              className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white outline-none"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 flex flex-col gap-5">
        <div>
          <h3 className="text-sm font-semibold text-white/80">Editor avanzado</h3>
          <p className="text-xs text-white/35">Ajusta forma, densidad, transparencia y tipografía de la interfaz.</p>
        </div>

        {/* Radio de bordes */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">Radio de bordes</h4>
          <div className="grid grid-cols-3 gap-2.5">
            {Object.entries(RADIUS_OPTIONS).map(([id, opt]) => {
              const Icon = RADIUS_ICONS[id] || Square;
              const selected = uiPrefs.radius === id;
              return (
                <button
                  key={id}
                  onClick={() => setUiPrefs({ radius: id })}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                    selected ? 'bg-violet-600/15 border-violet-500/40 text-violet-300' : 'bg-white/[0.035] border-white/[0.06] text-white/45 hover:text-white/70 hover:border-white/[0.12]'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-[11px] font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Densidad */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">Densidad</h4>
          <div className="grid grid-cols-3 gap-2.5">
            {Object.entries(DENSITY_OPTIONS).map(([id, opt]) => {
              const selected = uiPrefs.density === id;
              return (
                <button
                  key={id}
                  onClick={() => setUiPrefs({ density: id })}
                  title={opt.desc}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all text-center ${
                    selected ? 'bg-violet-600/15 border-violet-500/40 text-violet-300' : 'bg-white/[0.035] border-white/[0.06] text-white/45 hover:text-white/70 hover:border-white/[0.12]'
                  }`}
                >
                  <span className="text-[11px] font-medium">{opt.label}</span>
                  <span className="text-[10px] text-white/30 leading-snug">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Intensidad del glassmorphism */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">Transparencia (glassmorphism)</h4>
            <span className="text-[11px] text-white/40 tabular-nums">{uiPrefs.glassOpacity}%</span>
          </div>
          <input
            type="range"
            min={60}
            max={100}
            step={2}
            value={uiPrefs.glassOpacity}
            onChange={e => setUiPrefs({ glassOpacity: Number(e.target.value) })}
            className="w-full accent-violet-500"
          />
          <p className="text-[11px] text-white/28">Más alto = paneles más opacos y fáciles de leer; más bajo = más translúcidos.</p>
        </div>

        {/* Fuente */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">Tipografía</h4>
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(FONT_OPTIONS).map(([id, opt]) => {
              const selected = uiPrefs.font === id;
              return (
                <button
                  key={id}
                  onClick={() => setUiPrefs({ font: id })}
                  style={{ fontFamily: opt.stack }}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                    selected ? 'bg-violet-600/15 border-violet-500/40 text-violet-300' : 'bg-white/[0.035] border-white/[0.06] text-white/55 hover:text-white/80 hover:border-white/[0.12]'
                  }`}
                >
                  <span className="text-sm">{opt.label}</span>
                  <span className="text-[11px] opacity-60">Aa Bb 123</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeCard({ label, desc, icon: Icon, selected, onClick, palette }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-150 text-left ${
        selected ? 'bg-violet-600/15 border-violet-500/40 shadow-glow-sm' : 'glass hover:border-white/[0.12] hover:bg-white/[0.05]'
      }`}
    >
      <div className="w-full h-16 rounded-lg border border-white/10 p-2 flex gap-2" style={{ background: palette.bg }}>
        <div className="w-8 rounded-md" style={{ background: palette.accent }} />
        <div className="flex-1 rounded-md p-2" style={{ background: palette.card }}>
          <div className="w-3/4 h-1.5 rounded-full mb-2" style={{ background: palette.elevated }} />
          <div className="w-1/2 h-1.5 rounded-full opacity-70" style={{ background: palette.text }} />
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Icon size={14} className={selected ? 'text-violet-400 mt-0.5' : 'text-white/30 mt-0.5'} />
        <div className="min-w-0">
          <p className={`text-sm font-medium ${selected ? 'text-violet-300' : 'text-white/70'}`}>{label}</p>
          <p className="text-[11px] text-white/32 mt-0.5">{desc}</p>
        </div>
      </div>
    </button>
  );
}

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

/**
 * ThemeContext — Gestión de tema oscuro/claro.
 * Aplica/elimina la clase .dark en <html> para activar Tailwind dark mode.
 * Persiste la preferencia en la configuración del store via IPC.
 */

const ThemeContext = createContext(null);

const THEME_PRESETS = {
  dark:    { mode: 'dark',  bg: '#09090e', card: '#111118', elevated: '#18181f', accent: '#7c3aed', text: '#ffffff' },
  light:   { mode: 'light', bg: '#f8fafc', card: '#ffffff', elevated: '#eef2ff', accent: '#7c3aed', text: '#111827' },
  amoled:  { mode: 'dark',  bg: '#000000', card: '#07070a', elevated: '#101014', accent: '#22c55e', text: '#ffffff' },
  dracula: { mode: 'dark',  bg: '#1e1f29', card: '#282a36', elevated: '#343746', accent: '#bd93f9', text: '#f8f8f2' },
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark'); // 'dark' | 'light'
  const [themePreset, setThemePresetState] = useState('dark');
  const [customTheme, setCustomThemeState] = useState(THEME_PRESETS.dark);

  // Leer tema guardado al montar
  useEffect(() => {
    const load = async () => {
      try {
        const settings = await window.electronAPI?.getSettings();
        const preset = settings?.themePreset || settings?.theme || 'dark';
        apply(preset, settings?.customTheme);
      } catch {
        const stored = localStorage.getItem('as_theme') || 'dark';
        const custom = JSON.parse(localStorage.getItem('as_custom_theme') || 'null');
        apply(stored, custom);
      }
    };
    load();
  }, []);

  /** Aplica el tema al DOM y al estado */
  const apply = (newTheme, custom = null) => {
    const palette = newTheme === 'custom'
      ? { ...THEME_PRESETS.dark, ...(custom || customTheme) }
      : THEME_PRESETS[newTheme] || THEME_PRESETS.dark;
    const html = document.documentElement;
    if (palette.mode === 'dark') {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
    }
    html.style.setProperty('--bg-base-color', palette.bg);
    html.style.setProperty('--bg-card-color', palette.card);
    html.style.setProperty('--bg-elevated-color', palette.elevated);
    html.style.setProperty('--accent-color', palette.accent);
    html.style.setProperty('--text-primary-color', palette.text);
    html.dataset.themePreset = newTheme;
    setThemeState(palette.mode);
    setThemePresetState(newTheme);
    if (custom) setCustomThemeState({ ...THEME_PRESETS.dark, ...custom });
  };

  /** Cambia y persiste el tema */
  const setTheme = useCallback(async (newTheme) => {
    apply(newTheme, customTheme);
    try {
      await window.electronAPI?.updateSettings({ theme: newTheme === 'light' ? 'light' : 'dark', themePreset: newTheme, customTheme });
    } catch {
      localStorage.setItem('as_theme', newTheme);
    }
  }, [customTheme]);

  const setCustomTheme = useCallback(async (nextTheme) => {
    const next = { ...customTheme, ...nextTheme, mode: nextTheme.mode || customTheme.mode || 'dark' };
    setCustomThemeState(next);
    apply('custom', next);
    try {
      await window.electronAPI?.updateSettings({ theme: next.mode, themePreset: 'custom', customTheme: next });
    } catch {
      localStorage.setItem('as_theme', 'custom');
      localStorage.setItem('as_custom_theme', JSON.stringify(next));
    }
  }, [customTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, themePreset, customTheme, presets: THEME_PRESETS, setTheme, setCustomTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}

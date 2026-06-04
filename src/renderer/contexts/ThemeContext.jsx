import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

/**
 * ThemeContext — Gestión de tema oscuro/claro.
 * Aplica/elimina la clase .dark en <html> para activar Tailwind dark mode.
 * Persiste la preferencia en la configuración del store via IPC.
 */

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark'); // 'dark' | 'light'

  // Leer tema guardado al montar
  useEffect(() => {
    const load = async () => {
      try {
        const settings = await window.electronAPI?.getSettings();
        if (settings?.theme) apply(settings.theme);
      } catch {
        const stored = localStorage.getItem('as_theme') || 'dark';
        apply(stored);
      }
    };
    load();
  }, []);

  /** Aplica el tema al DOM y al estado */
  const apply = (newTheme) => {
    const html = document.documentElement;
    if (newTheme === 'dark') {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
    }
    setThemeState(newTheme);
  };

  /** Cambia y persiste el tema */
  const setTheme = useCallback(async (newTheme) => {
    apply(newTheme);
    try {
      await window.electronAPI?.updateSettings({ theme: newTheme });
    } catch {
      localStorage.setItem('as_theme', newTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}

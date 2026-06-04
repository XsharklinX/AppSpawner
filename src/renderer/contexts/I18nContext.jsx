import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

/**
 * I18nContext — Sistema de internacionalización propio (ES / EN).
 * Provee la función t(key) para traducir cualquier texto de la UI.
 */

const I18nContext = createContext(null);

// ── Diccionario de traducciones ───────────────────────────────────────────────
const TRANSLATIONS = {
  es: {
    // Onboarding
    onboarding_title:      'Bienvenido a AppSpawner',
    onboarding_sub:        'El gestor de Site-Specific Browsers más potente.',
    onboarding_desc:       'Convierte cualquier web en una aplicación nativa independiente con sesión aislada, acceso directo y sin distracciones.',
    onboarding_label:      '¿Cómo te llamas?',
    onboarding_placeholder:'Tu nombre...',
    onboarding_btn:        'Comenzar →',
    onboarding_feat1:      'Sesiones aisladas por app',
    onboarding_feat2:      'Accesos directos nativos',
    onboarding_feat3:      'Lanzamiento autónomo',

    // Sidebar
    nav_myApps:    'Mis Apps',
    nav_discover:  'Descubrir',
    nav_create:    'Crear App',
    nav_profiles:  'Perfiles',
    nav_settings:  'Configuración',
    nav_filters:   'Filtros',
    cat_all:       'Todas',
    cat_trabajo:   'Trabajo',
    cat_social:    'Social',
    cat_entertain: 'Entretenimiento',
    cat_dev:       'Desarrollo',
    cat_ia:        'IA & Productividad',
    cat_general:   'General',

    // Dashboard
    dash_title:        'Mis Apps',
    dash_subtitle:     'Tus entornos de trabajo aislados',
    dash_search:       'Buscar apps...',
    dash_empty_title:  'Tu espacio está vacío',
    dash_empty_desc:   'Instala tu primera app desde el directorio o crea una personalizada.',
    dash_explore:      'Explorar Apps',
    dash_create:       'Crear App',
    dash_launch:       'Abrir',
    dash_edit:         'Editar',
    dash_uninstall:    'Desinstalar',
    dash_last_used:    'Último uso',
    dash_never:        'Nunca',
    dash_no_results:   'Sin resultados para',

    // Discover
    disc_title:        'Directorio de Apps',
    disc_subtitle:     'Instala al instante las herramientas más populares en su propio entorno aislado.',
    disc_install:      'Instalar',
    disc_installed:    'Instalada ✓',
    disc_search:       'Buscar en directorio...',
    disc_featured:     'Destacadas',
    disc_all:          'Todas las Apps',

    // Create / Edit
    create_title:      'Crear Nuevo Entorno',
    create_subtitle:   'Envuelve cualquier URL en una app de escritorio nativa.',
    edit_title:        'Editar Entorno',
    form_name:         'Nombre de la App',
    form_name_ph:      'Mi App',
    form_url:          'URL Objetivo',
    form_url_ph:       'https://ejemplo.com',
    form_category:     'Categoría',
    form_icon_color:   'Color del Ícono',
    form_icon_initials:'Iniciales del Ícono',
    form_save:         'Guardar Cambios',
    form_create:       'Crear App',
    form_cancel:       'Cancelar',
    form_url_error:    'Por favor ingresa una URL válida (https://...)',
    form_name_error:   'El nombre es requerido',
    form_shortcuts:    'Crear accesos directos',
    form_shortcuts_desc:'Instala accesos directos en el escritorio y menú de inicio.',

    // Settings
    set_title:         'Configuración',
    set_general:       'General',
    set_adblock:       'Ad Block',
    set_appearance:    'Apariencia',
    set_link_rules:    'Link Rules',
    set_storage:       'Almacenamiento',
    set_about:         'Acerca de',

    // General
    gen_language:      'Idioma',
    gen_install_path:  'Ruta de Instalación',
    gen_install_ph:    'Carpeta para accesos directos',
    gen_browse:        'Examinar...',
    gen_desktop:       'Acceso directo en Escritorio',
    gen_start_menu:    'Acceso directo en Menú de Inicio',
    gen_auto_launch:   'Iniciar AppSpawner al encender el equipo',
    gen_saved:         'Configuración guardada',

    // Appearance
    app_theme:         'Modo de Color',
    app_dark:          'Oscuro',
    app_light:         'Claro',

    // Link Rules
    link_title:        'Intercepción de Links',
    link_desc:         'Cuando hagas clic en un link externo que coincida con una de tus apps instaladas, AppSpawner lo abrirá en su ventana aislada en lugar del navegador.',
    link_global:       'Interceptar links globalmente',
    link_force_browser:'Forzar navegador por defecto siempre',

    // Storage
    stor_title:        'Uso de Almacenamiento',
    stor_desc:         'Datos de sesión almacenados por cada app (cookies, caché, localStorage).',
    stor_clear:        'Limpiar Datos',
    stor_uninstall:    'Desinstalar',
    stor_no_data:      'Sin datos de sesión',
    stor_confirm_clear:'¿Limpiar todos los datos de sesión de',
    stor_confirm_uninstall: '¿Desinstalar',

    // About
    about_version:     'Versión',
    about_build:       'Build',
    about_check:       'Buscar Actualizaciones',
    about_up_to_date:  '¡Estás actualizado!',
    about_checking:    'Verificando...',
    about_platform:    'Plataforma',
    about_desc:        'AppSpawner transforma cualquier sitio web en una aplicación de escritorio nativa con sesión completamente aislada.',
    about_made_with:   'Hecho con ♥ usando Electron + React',

    // Common
    cancel:   'Cancelar',
    confirm:  'Confirmar',
    delete:   'Eliminar',
    close:    'Cerrar',
    save:     'Guardar',
    loading:  'Cargando...',
    success:  '¡Éxito!',
    error:    'Error',

    // Toasts
    toast_installed:   'instalada correctamente',
    toast_uninstalled: 'desinstalada',
    toast_launched:    'lanzada',
    toast_updated:     'actualizada',
    toast_shortcuts:   'Accesos directos creados',
    toast_cleared:     'Datos de sesión limpiados',
    toast_error_install:   'Error al instalar la app',
    toast_error_uninstall: 'Error al desinstalar',
    toast_error_launch:    'Error al lanzar la app',
  },

  en: {
    // Onboarding
    onboarding_title:      'Welcome to AppSpawner',
    onboarding_sub:        'The most powerful Site-Specific Browser manager.',
    onboarding_desc:       'Turn any website into a native standalone app with isolated sessions, desktop shortcuts, and zero distractions.',
    onboarding_label:      'What\'s your name?',
    onboarding_placeholder:'Your name...',
    onboarding_btn:        'Get Started →',
    onboarding_feat1:      'Isolated sessions per app',
    onboarding_feat2:      'Native OS shortcuts',
    onboarding_feat3:      'Autonomous launch',

    // Sidebar
    nav_myApps:    'My Apps',
    nav_discover:  'Discover',
    nav_create:    'Create App',
    nav_profiles:  'Profiles',
    nav_settings:  'Settings',
    nav_filters:   'Filters',
    cat_all:       'All',
    cat_trabajo:   'Work',
    cat_social:    'Social',
    cat_entertain: 'Entertainment',
    cat_dev:       'Development',
    cat_ia:        'AI & Productivity',
    cat_general:   'General',

    // Dashboard
    dash_title:        'My Apps',
    dash_subtitle:     'Your isolated workspaces',
    dash_search:       'Search apps...',
    dash_empty_title:  'Your space is empty',
    dash_empty_desc:   'Install your first app from the directory or create a custom one.',
    dash_explore:      'Explore Apps',
    dash_create:       'Create App',
    dash_launch:       'Open',
    dash_edit:         'Edit',
    dash_uninstall:    'Uninstall',
    dash_last_used:    'Last used',
    dash_never:        'Never',
    dash_no_results:   'No results for',

    // Discover
    disc_title:        'App Directory',
    disc_subtitle:     'Instantly install the most popular tools in their own isolated environment.',
    disc_install:      'Install',
    disc_installed:    'Installed ✓',
    disc_search:       'Search directory...',
    disc_featured:     'Featured',
    disc_all:          'All Apps',

    // Create / Edit
    create_title:      'Create New Environment',
    create_subtitle:   'Wrap any URL into a native desktop app.',
    edit_title:        'Edit Environment',
    form_name:         'App Name',
    form_name_ph:      'My App',
    form_url:          'Target URL',
    form_url_ph:       'https://example.com',
    form_category:     'Category',
    form_icon_color:   'Icon Color',
    form_icon_initials:'Icon Initials',
    form_save:         'Save Changes',
    form_create:       'Create App',
    form_cancel:       'Cancel',
    form_url_error:    'Please enter a valid URL (https://...)',
    form_name_error:   'Name is required',
    form_shortcuts:    'Create shortcuts',
    form_shortcuts_desc:'Install shortcuts on desktop and start menu.',

    // Settings
    set_title:         'Settings',
    set_general:       'General',
    set_adblock:       'Ad Block',
    set_appearance:    'Appearance',
    set_link_rules:    'Link Rules',
    set_storage:       'Storage',
    set_about:         'About',

    // General
    gen_language:      'Language',
    gen_install_path:  'Installation Path',
    gen_install_ph:    'Folder for shortcuts',
    gen_browse:        'Browse...',
    gen_desktop:       'Desktop shortcut',
    gen_start_menu:    'Start Menu shortcut',
    gen_auto_launch:   'Launch AppSpawner at system startup',
    gen_saved:         'Settings saved',

    // Appearance
    app_theme:         'Color Mode',
    app_dark:          'Dark',
    app_light:         'Light',

    // Link Rules
    link_title:        'Link Interception',
    link_desc:         'When you click an external link that matches one of your installed apps, AppSpawner will open it in its isolated window instead of the browser.',
    link_global:       'Intercept links globally',
    link_force_browser:'Always force default browser',

    // Storage
    stor_title:        'Storage Usage',
    stor_desc:         'Session data stored per app (cookies, cache, localStorage).',
    stor_clear:        'Clear Data',
    stor_uninstall:    'Uninstall',
    stor_no_data:      'No session data',
    stor_confirm_clear:'Clear all session data for',
    stor_confirm_uninstall: 'Uninstall',

    // About
    about_version:     'Version',
    about_build:       'Build',
    about_check:       'Check for Updates',
    about_up_to_date:  'You\'re up to date!',
    about_checking:    'Checking...',
    about_platform:    'Platform',
    about_desc:        'AppSpawner transforms any website into a native desktop application with a completely isolated session.',
    about_made_with:   'Made with ♥ using Electron + React',

    // Common
    cancel:   'Cancel',
    confirm:  'Confirm',
    delete:   'Delete',
    close:    'Close',
    save:     'Save',
    loading:  'Loading...',
    success:  'Success!',
    error:    'Error',

    // Toasts
    toast_installed:   'installed successfully',
    toast_uninstalled: 'uninstalled',
    toast_launched:    'launched',
    toast_updated:     'updated',
    toast_shortcuts:   'Shortcuts created',
    toast_cleared:     'Session data cleared',
    toast_error_install:   'Error installing app',
    toast_error_uninstall: 'Error uninstalling',
    toast_error_launch:    'Error launching app',
  },
};

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState('es');

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await window.electronAPI?.getSettings();
        if (settings?.language) setLanguageState(settings.language);
      } catch {
        const stored = localStorage.getItem('as_lang') || 'es';
        setLanguageState(stored);
      }
    };
    load();
  }, []);

  const setLanguage = useCallback(async (lang) => {
    setLanguageState(lang);
    try {
      await window.electronAPI?.updateSettings({ language: lang });
    } catch {
      localStorage.setItem('as_lang', lang);
    }
  }, []);

  /**
   * Función de traducción principal.
   * @param {string} key  - clave del diccionario
   * @param {Record<string,string>} [vars] - variables de interpolación {name: 'Juan'}
   */
  const t = useCallback((key, vars = {}) => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS.es;
    let text = dict[key] ?? TRANSLATIONS.es[key] ?? key;
    // Interpolación simple: {{variable}}
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replaceAll(`{{${k}}}`, v);
    });
    return text;
  }, [language]);

  return (
    <I18nContext.Provider value={{ t, language, setLanguage, languages: ['es', 'en'] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n debe usarse dentro de <I18nProvider>');
  return ctx;
}

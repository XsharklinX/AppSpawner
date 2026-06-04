import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, ExternalLink, Settings, Moon, Sun, Box, Globe,
  LayoutGrid, Search, Edit2, Tag, Compass, Clock, Activity, Download,
  ChevronRight, User, Monitor, Link as LinkIcon, HardDrive, Info,
  ArrowRight, CheckCircle2
} from 'lucide-react';

// --- INTERNATIONALIZATION (i18n) DICTIONARY ---
const translations = {
  es: {
    welcome_title: "Bienvenido a AppSpawner",
    welcome_desc: "Configura tu entorno de trabajo aislado en segundos.",
    welcome_input: "¿Cómo te llamas?",
    welcome_btn: "Comenzar",
    menu_main: "Menú Principal",
    menu_myApps: "Mis Apps",
    menu_discover: "Descubrir",
    menu_add: "Crear Custom App",
    menu_filters: "Filtros",
    menu_all: "Todas",
    menu_settings: "Configuración",
    menu_themeLight: "Tema Claro",
    menu_themeDark: "Tema Oscuro",
    dash_title: "Tu Espacio",
    dash_managing: "Gestionando",
    dash_apps: "aplicaciones.",
    dash_search: "Buscar...",
    dash_empty_title: "Tu entorno está vacío",
    dash_empty_desc: "AppSpawner envuelve sitios web en aplicaciones nativas y rápidas.",
    dash_btn_explore: "Explorar Apps",
    dash_btn_manual: "Añadir Manualmente",
    dash_no_results: "No se encontraron resultados.",
    app_open: "Abrir",
    app_never: "Nunca",
    app_now: "Ahora",
    app_installed: "Instalada",
    app_installing: "Instalando...",
    app_added: "Agregada al Espacio",
    app_btn_install: "Instalar 1-Click",
    discover_title: "Directorio de Apps",
    discover_desc: "Instala al instante las herramientas y plataformas más populares en su propio entorno aislado y optimizado.",
    add_title_new: "Crear Nuevo Entorno",
    add_title_edit: "Configurar Entorno",
    add_desc_new: "Envuelve cualquier URL en una aplicación de escritorio de alto rendimiento.",
    add_desc_edit: "Modifica los parámetros de inyección de tu app.",
    add_form_name: "Nombre de la Aplicación",
    add_form_url: "URL Objetivo",
    add_form_category: "Clasificación",
    add_form_icon: "Ícono Personalizado",
    add_form_icon_opt: "Opcional",
    add_btn_cancel: "Cancelar Operación",
    add_btn_submit_new: "Generar (Spawn) App",
    add_btn_submit_edit: "Actualizar Entorno",
    set_title: "Configuración",
    set_tab_general: "General",
    set_tab_appearance: "Apariencia",
    set_tab_links: "Reglas de Enlaces",
    set_tab_storage: "Almacenamiento",
    set_tab_about: "Acerca de",
    set_lang: "Idioma de la interfaz",
    set_path: "Ruta de instalación",
    set_path_desc: "Ubicación donde se guardan los binarios de las apps.",
    set_shortcuts_desk: "Crear accesos directos en el escritorio",
    set_shortcuts_start: "Crear accesos directos en el menú de inicio",
    set_reset: "Restaurar configuración predeterminada",
    set_theme_mode: "Modo de Color",
    set_theme_desc: "Elige el tema visual de la aplicación.",
    set_link_intercept: "Intercepción de Enlaces Global",
    set_link_desc: "Si haces clic en un enlace (ej. notion.so) en otra app, se abrirá en su respectiva app de AppSpawner.",
    set_link_force: "Forzar apertura de enlaces externos en el navegador por defecto",
    set_store_desc: "Gestiona el espacio en disco que ocupa cada entorno aislado.",
    set_store_total: "Espacio Total Usado",
    set_store_uninstall: "Desinstalar",
    set_about_ver: "Versión de AppSpawner",
    set_about_check: "Buscar actualizaciones",
    set_about_dev: "Desarrollador",
    toast_updated: "ha sido actualizada.",
    toast_created: "generada con éxito.",
    toast_deleted: "Aplicación eliminada.",
    toast_already: "Ya tienes instalada la app:",
    toast_installed: "instalada con éxito."
  },
  en: {
    welcome_title: "Welcome to AppSpawner",
    welcome_desc: "Set up your isolated workspace in seconds.",
    welcome_input: "What's your name?",
    welcome_btn: "Get Started",
    menu_main: "Main Menu",
    menu_myApps: "My Apps",
    menu_discover: "Discover",
    menu_add: "Create Custom App",
    menu_filters: "Filters",
    menu_all: "All",
    menu_settings: "Settings",
    menu_themeLight: "Light Theme",
    menu_themeDark: "Dark Theme",
    dash_title: "Your Space",
    dash_managing: "Managing",
    dash_apps: "applications.",
    dash_search: "Search...",
    dash_empty_title: "Your environment is empty",
    dash_empty_desc: "AppSpawner wraps websites into fast, native desktop applications.",
    dash_btn_explore: "Explore Apps",
    dash_btn_manual: "Add Manually",
    dash_no_results: "No results found.",
    app_open: "Launch",
    app_never: "Never",
    app_now: "Just now",
    app_installed: "Installed",
    app_installing: "Installing...",
    app_added: "Added to Space",
    app_btn_install: "1-Click Install",
    discover_title: "App Directory",
    discover_desc: "Instantly install popular tools and platforms in their own isolated, optimized environment.",
    add_title_new: "Create New Environment",
    add_title_edit: "Configure Environment",
    add_desc_new: "Wrap any URL into a high-performance desktop application.",
    add_desc_edit: "Modify the injection parameters of your app.",
    add_form_name: "Application Name",
    add_form_url: "Target URL",
    add_form_category: "Classification",
    add_form_icon: "Custom Icon",
    add_form_icon_opt: "Optional",
    add_btn_cancel: "Cancel Operation",
    add_btn_submit_new: "Spawn App",
    add_btn_submit_edit: "Update Environment",
    set_title: "Settings",
    set_tab_general: "General",
    set_tab_appearance: "Appearance",
    set_tab_links: "Link Rules",
    set_tab_storage: "Storage",
    set_tab_about: "About",
    set_lang: "Display Language",
    set_path: "Installation Path",
    set_path_desc: "Location where app binaries are stored.",
    set_shortcuts_desk: "Automatically create desktop shortcuts",
    set_shortcuts_start: "Automatically create Start Menu shortcuts",
    set_reset: "Reset settings to their original defaults",
    set_theme_mode: "Color Mode",
    set_theme_desc: "Choose the visual theme of the application.",
    set_link_intercept: "Global Link Interception",
    set_link_desc: "Clicking a supported link (e.g., notion.so) anywhere will open it in its respective AppSpawner app.",
    set_link_force: "Force external links to open in default browser",
    set_store_desc: "Manage the disk space used by each isolated environment.",
    set_store_total: "Total Space Used",
    set_store_uninstall: "Uninstall",
    set_about_ver: "AppSpawner Version",
    set_about_check: "Check for updates",
    set_about_dev: "Developer",
    toast_updated: "has been updated.",
    toast_created: "spawned successfully.",
    toast_deleted: "Application deleted.",
    toast_already: "You already installed:",
    toast_installed: "installed successfully."
  }
};

const DISCOVER_APPS = [
  { name: 'Notion', url: 'https://notion.so', category: 'Trabajo', icon: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png', desc: 'Espacio de trabajo / Workspace' },
  { name: 'Figma', url: 'https://figma.com', category: 'Desarrollo', icon: 'https://upload.wikimedia.org/wikipedia/commons/3/33/Figma-logo.svg', desc: 'Diseño colaborativo / UI Design' },
  { name: 'Spotify', url: 'https://open.spotify.com', category: 'Entretenimiento', icon: 'https://upload.wikimedia.org/wikipedia/commons/2/26/Spotify_logo_with_text.svg', desc: 'Música sin límites / Music player' },
  { name: 'WhatsApp', url: 'https://web.whatsapp.com', category: 'Social', icon: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg', desc: 'Mensajería / Messaging' },
  { name: 'ChatGPT', url: 'https://chat.openai.com', category: 'Trabajo', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', desc: 'Asistente IA / AI Assistant' },
  { name: 'Discord', url: 'https://discord.com/app', category: 'Social', icon: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Discord_logo_2021.svg', desc: 'Chat de voz / Voice chat' },
  { name: 'YouTube', url: 'https://youtube.com', category: 'Entretenimiento', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg', desc: 'Plataforma de videos / Video platform' },
  { name: 'Netflix', url: 'https://netflix.com', category: 'Entretenimiento', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', desc: 'Películas y series / Movies & TV' },
  { name: 'Twitch', url: 'https://twitch.tv', category: 'Entretenimiento', icon: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Twitch_Glitch_Logo_Purple.svg', desc: 'Streaming en vivo / Live streaming' },
  { name: 'GitHub', url: 'https://github.com', category: 'Desarrollo', icon: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg', desc: 'Alojamiento de código / Code hosting' },
  { name: 'Slack', url: 'https://app.slack.com', category: 'Trabajo', icon: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg', desc: 'Comunicación de equipo / Team chat' },
  { name: 'Canva', url: 'https://canva.com', category: 'Trabajo', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Canva_icon_2021.svg', desc: 'Diseño gráfico fácil / Graphic design' },
  { name: 'X (Twitter)', url: 'https://x.com', category: 'Social', icon: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/X_logo_2023.svg', desc: 'Red de microblogging / Social network' },
  { name: 'Instagram', url: 'https://instagram.com', category: 'Social', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg', desc: 'Fotos y Reels / Photos & Reels' },
  { name: 'Reddit', url: 'https://reddit.com', category: 'Social', icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Reddit_logo.svg', desc: 'Foros y comunidades / Forums & communities' },
  { name: 'Claude', url: 'https://claude.ai', category: 'Trabajo', icon: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Anthropic_logo.svg', desc: 'Asistente IA seguro / Safe AI' },
  { name: 'Perplexity', url: 'https://perplexity.ai', category: 'Trabajo', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Perplexity_AI_logo.svg', desc: 'Buscador con IA / AI Search' },
  { name: 'Gmail', url: 'https://mail.google.com', category: 'Trabajo', icon: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg', desc: 'Correo electrónico / Email client' },
  { name: 'NotebookLM', url: 'https://notebooklm.google.com', category: 'Trabajo', icon: 'https://api.dicebear.com/7.x/initials/svg?seed=NLM&backgroundColor=2563eb', desc: 'IA para tus notas / AI notes' },
  { name: 'MangaFire', url: 'https://mangafire.to', category: 'Entretenimiento', icon: 'https://api.dicebear.com/7.x/initials/svg?seed=MF&backgroundColor=ef4444', desc: 'Leer manga online / Read manga' },
  { name: 'Pinterest', url: 'https://pinterest.com', category: 'Social', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Pinterest-logo.png', desc: 'Inspiración visual / Visual inspiration' }
];

const CATEGORIES = ['General', 'Trabajo', 'Social', 'Entretenimiento', 'Desarrollo'];

export default function App() {
  // --- CORE STATE ---
  const [isReady, setIsReady] = useState(false);
  const [username, setUsername] = useState('');
  const [lang, setLang] = useState('es');
  const [apps, setApps] = useState([]);
  const [theme, setTheme] = useState('dark');
  
  // --- NAVIGATION STATE ---
  const [view, setView] = useState('dashboard'); // 'dashboard', 'discover', 'add', 'settings'
  const [activeCategory, setActiveCategory] = useState('All');
  const [settingsTab, setSettingsTab] = useState('general');

  // --- FORM STATE ---
  const [appName, setAppName] = useState('');
  const [appUrl, setAppUrl] = useState('https://');
  const [appIcon, setAppIcon] = useState('');
  const [appCategory, setAppCategory] = useState('General');
  const [editingId, setEditingId] = useState(null);

  // --- UI/SETTINGS STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [installPath, setInstallPath] = useState('');

  // Translation helper function
  const t = (key) => translations[lang][key] || key;

  // Init Data from LocalStorage
  useEffect(() => {
    const savedName = localStorage.getItem('appspawner_user') || '';
    const savedLang = localStorage.getItem('appspawner_lang') || 'es';
    const savedPath = localStorage.getItem('appspawner_path') || 'C:\\Users\\Default\\Documents\\AppSpawnerApps';
    const savedTheme = localStorage.getItem('appspawner_theme') || 'dark';
    
    // Process Apps (assign random sizes if they don't have one, to simulate Storage feature)
    let savedApps = JSON.parse(localStorage.getItem('appspawner_apps') || '[]');
    savedApps = savedApps.map(app => ({
      ...app,
      sizeMB: app.sizeMB || Math.floor(Math.random() * (250 - 45 + 1) + 45) // Random size between 45MB and 250MB
    }));

    setUsername(savedName);
    setLang(savedLang);
    setInstallPath(savedPath);
    setApps(savedApps);
    setTheme(savedTheme);
    
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    setIsReady(true);
  }, []);

  const completeOnboarding = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    localStorage.setItem('appspawner_user', username);
    // Set smart default path based on name
    const defaultPath = `C:\\Users\\${username.replace(/\s+/g, '')}\\Documents\\AppSpawnerApps`;
    setInstallPath(defaultPath);
    localStorage.setItem('appspawner_path', defaultPath);
    setIsReady(true);
    // Trigger re-render to hide onboarding
    setUsername(username); 
  };

  const saveApps = (newApps) => {
    setApps(newApps);
    localStorage.setItem('appspawner_apps', JSON.stringify(newApps));
  };

  const changeLanguage = (newLang) => {
    setLang(newLang);
    localStorage.setItem('appspawner_lang', newLang);
  };

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('appspawner_theme', newTheme);
    if (newTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  const handleQuickInstall = (template) => {
    if (apps.some(a => a.url === template.url)) {
      showToast(`${t('toast_already')} ${template.name}`);
      return;
    }
    const newApp = {
      id: crypto.randomUUID(),
      name: template.name,
      url: template.url,
      icon: template.icon,
      category: template.category,
      createdAt: new Date().toISOString(),
      lastOpened: null,
      launches: 0,
      sizeMB: Math.floor(Math.random() * (180 - 60 + 1) + 60)
    };
    saveApps([...apps, newApp]);
    showToast(`"${template.name}" ${t('toast_installed')}`);
  };

  const handleAddApp = (e) => {
    e.preventDefault();
    if (!appName || !appUrl) return;

    let updatedApps;
    if (editingId) {
      updatedApps = apps.map(app => 
        app.id === editingId 
          ? { ...app, name: appName, url: appUrl, icon: appIcon, category: appCategory } 
          : app
      );
      showToast(`"${appName}" ${t('toast_updated')}`);
    } else {
      const newApp = {
        id: crypto.randomUUID(),
        name: appName,
        url: appUrl,
        icon: appIcon || `https://api.dicebear.com/7.x/initials/svg?seed=${appName}&backgroundColor=3b82f6`,
        category: appCategory,
        createdAt: new Date().toISOString(),
        lastOpened: null,
        launches: 0,
        sizeMB: Math.floor(Math.random() * (120 - 30 + 1) + 30) // App personalizadas suelen pesar menos
      };
      updatedApps = [...apps, newApp];
      showToast(`"${appName}" ${t('toast_created')}`);
    }

    saveApps(updatedApps);
    setAppName(''); setAppUrl('https://'); setAppIcon(''); setAppCategory('General'); setEditingId(null);
    setView('dashboard');
  };

  const handleEditApp = (app, event) => {
    event.stopPropagation();
    setAppName(app.name);
    setAppUrl(app.url);
    setAppIcon(app.icon.includes('api.dicebear.com') ? '' : app.icon);
    setAppCategory(app.category || 'General');
    setEditingId(app.id);
    setView('add');
  };

  const handleDeleteApp = (id, event) => {
    if(event) event.stopPropagation();
    const updatedApps = apps.filter(app => app.id !== id);
    saveApps(updatedApps);
    showToast(t('toast_deleted'));
  };

  const handleLaunchApp = (app) => {
    const updatedApps = apps.map(a => 
      a.id === app.id ? { ...a, lastOpened: new Date().toISOString(), launches: (a.launches || 0) + 1 } : a
    );
    saveApps(updatedApps);

    if (window.electronAPI) {
      window.electronAPI.launchApp(app);
    } else {
      const width = 1200; const height = 800;
      const left = (window.screen.width / 2) - (width / 2);
      const top = (window.screen.height / 2) - (height / 2);
      window.open(app.url, `app_${app.id}`, `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},top=${top},left=${left}`);
    }
  };

  const timeAgo = (dateString) => {
    if (!dateString) return t('app_never');
    const diff = new Date() - new Date(dateString);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('app_now');
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const displayedApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || app.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || app.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const totalStorageMB = apps.reduce((acc, app) => acc + (app.sizeMB || 0), 0);

  // Helper component for Settings Toggles
  const SettingToggle = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer group">
      <input type="checkbox" className="sr-only peer" defaultChecked={checked} onChange={onChange} />
      <div className={`w-11 h-6 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-500/20 transition-all
        ${theme === 'dark' ? 'bg-gray-700 peer-checked:bg-blue-600' : 'bg-gray-300 peer-checked:bg-blue-500'}
        after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 
        after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm
        peer-checked:after:translate-x-full peer-checked:after:border-white group-active:after:w-6 group-active:peer-checked:after:translate-x-4`}
      ></div>
    </label>
  );

  // --- ONBOARDING VIEW ---
  if (isReady && (!localStorage.getItem('appspawner_user') || !username)) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-sans ${theme === 'dark' ? 'bg-[#0A0A0F] text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full mix-blend-screen blur-[100px] opacity-20 bg-blue-500 animate-pulse-slow"></div>
        </div>
        
        <form onSubmit={completeOnboarding} className={`relative z-10 p-12 max-w-md w-full rounded-[2rem] border shadow-2xl backdrop-blur-xl ${theme === 'dark' ? 'bg-[#14141A]/80 border-white/10' : 'bg-white/80 border-gray-200'}`}>
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg shadow-blue-500/30">
            <Box size={32} />
          </div>
          <h1 className="text-3xl font-bold mb-2">{t('welcome_title')}</h1>
          <p className={`mb-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('welcome_desc')}</p>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold tracking-widest mb-2 uppercase opacity-70">{t('welcome_input')}</label>
              <input 
                type="text" 
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. David, Sarah..." 
                className={`w-full px-5 py-4 rounded-2xl border-2 focus:border-blue-500 outline-none transition-all text-lg font-medium ${theme === 'dark' ? 'bg-black/20 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'}`} 
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/25 flex items-center justify-center space-x-2">
              <span>{t('welcome_btn')}</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </form>
      </div>
    );
  }

  // --- MAIN APP VIEW ---
  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 relative overflow-hidden ${theme === 'dark' ? 'bg-[#0A0A0F] text-gray-100' : 'bg-[#F8F9FA] text-gray-900'}`}>
      
      {/* Ambient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-pulse-slow ${theme === 'dark' ? 'bg-indigo-600' : 'bg-blue-300'}`}></div>
        <div className={`absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full mix-blend-screen filter blur-[150px] opacity-20 ${theme === 'dark' ? 'bg-purple-600' : 'bg-purple-300'}`}></div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-8 fade-in duration-300">
          <div className="bg-blue-600/95 backdrop-blur-xl border border-white/10 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-blue-500/25 flex items-center space-x-3">
            <CheckCircle2 size={20} className="text-blue-200" />
            <span className="font-medium tracking-wide">{toast}</span>
          </div>
        </div>
      )}

      {/* Main Sidebar */}
      <div className={`fixed top-0 left-0 h-full w-64 border-r ${theme === 'dark' ? 'border-white/5 bg-[#0A0A0F]/60' : 'border-gray-200/50 bg-white/60'} backdrop-blur-2xl flex flex-col z-20 transition-colors`}>
        <div className="p-6 flex items-center space-x-3 mt-2">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/30">
            <Box size={24} />
          </div>
          <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500">
            AppSpawner
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 mt-4 overflow-y-auto">
          <p className={`px-4 text-[11px] font-bold uppercase tracking-widest mb-3 mt-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{t('menu_main')}</p>
          
          <button onClick={() => setView('dashboard')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all active:scale-[0.98] ${view === 'dashboard' ? (theme === 'dark' ? 'bg-white/10 text-white font-medium shadow-sm' : 'bg-white text-blue-600 font-medium shadow-sm border border-gray-100') : 'hover:bg-gray-500/10 text-gray-400'}`}>
            <div className="flex items-center space-x-3"><LayoutGrid size={18} /><span>{t('menu_myApps')}</span></div>
            <span className={`text-[10px] font-bold py-0.5 px-2 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'}`}>{apps.length}</span>
          </button>
          
          <button onClick={() => setView('discover')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all active:scale-[0.98] ${view === 'discover' ? (theme === 'dark' ? 'bg-white/10 text-white font-medium shadow-sm' : 'bg-white text-blue-600 font-medium shadow-sm border border-gray-100') : 'hover:bg-gray-500/10 text-gray-400'}`}>
            <Compass size={18} /><span>{t('menu_discover')}</span>
          </button>
          
          <button onClick={() => { setEditingId(null); setAppName(''); setAppUrl('https://'); setAppIcon(''); setView('add'); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all active:scale-[0.98] ${view === 'add' ? (theme === 'dark' ? 'bg-white/10 text-white font-medium shadow-sm' : 'bg-white text-blue-600 font-medium shadow-sm border border-gray-100') : 'hover:bg-gray-500/10 text-gray-400'}`}>
            <Plus size={18} /><span>{t('menu_add')}</span>
          </button>

          {apps.length > 0 && (
            <>
              <p className={`px-4 text-[11px] font-bold uppercase tracking-widest mb-3 mt-8 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{t('menu_filters')}</p>
              <button onClick={() => { setView('dashboard'); setActiveCategory('All'); }} className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all text-sm active:scale-[0.98] ${activeCategory === 'All' && view === 'dashboard' ? 'text-blue-500 font-medium' : 'text-gray-400 hover:text-gray-200'}`}>
                <div className={`w-2 h-2 rounded-full shadow-sm ${activeCategory === 'All' ? 'bg-blue-500 shadow-blue-500/50' : 'bg-gray-500'}`} />
                <span>{t('menu_all')}</span>
              </button>
              {CATEGORIES.map(cat => {
                const count = apps.filter(a => a.category === cat).length;
                if (count === 0) return null;
                return (
                  <button key={cat} onClick={() => { setView('dashboard'); setActiveCategory(cat); }} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all text-sm active:scale-[0.98] ${activeCategory === cat && view === 'dashboard' ? 'text-blue-500 font-medium' : 'text-gray-400 hover:text-gray-200'}`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full shadow-sm ${activeCategory === cat ? 'bg-blue-500 shadow-blue-500/50' : 'bg-gray-500'}`} />
                      <span>{cat}</span>
                    </div>
                    <span className="text-[10px] font-medium opacity-50">{count}</span>
                  </button>
                );
              })}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-1">
          <button onClick={() => {setView('settings'); setSettingsTab('general');}} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-sm active:scale-[0.98] ${view === 'settings' ? 'bg-blue-600 text-white font-medium shadow-md shadow-blue-500/20' : 'text-gray-400 hover:bg-gray-500/10'}`}>
            <Settings size={18} /><span>{t('menu_settings')}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="ml-64 p-8 lg:p-12 w-full max-w-7xl mx-auto relative z-10 min-h-screen">
        
        {view === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
              <div>
                <h2 className="text-4xl font-bold mb-2 tracking-tight">{t('dash_title')}</h2>
                <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-lg`}>
                  {t('dash_managing')} <span className={`font-semibold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{apps.length}</span> {t('dash_apps')}
                </p>
              </div>
              
              <div className="flex items-center gap-4 w-full lg:w-auto">
                <div className={`flex items-center px-4 py-3 rounded-2xl border flex-1 lg:w-72 transition-all focus-within:ring-2 focus-within:ring-blue-500/50 ${theme === 'dark' ? 'bg-[#14141A]/80 border-white/10 backdrop-blur-md' : 'bg-white/80 border-gray-200 backdrop-blur-md shadow-sm'}`}>
                  <Search size={18} className="text-gray-400 mr-3" />
                  <input type="text" placeholder={t('dash_search')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`bg-transparent outline-none w-full text-sm font-medium ${theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`} />
                </div>
              </div>
            </div>

            {apps.length === 0 ? (
              <div className={`text-center py-32 rounded-[2rem] border ${theme === 'dark' ? 'border-white/10 bg-white/5 backdrop-blur-xl' : 'border-gray-200 bg-white/50 backdrop-blur-xl shadow-sm'}`}>
                <div className="bg-blue-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-blue-500/5">
                  <Box size={32} className="text-blue-500" />
                </div>
                <h3 className="text-2xl font-bold mb-3">{t('dash_empty_title')}</h3>
                <p className={`mb-8 max-w-md mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('dash_empty_desc')}</p>
                <div className="flex justify-center gap-4">
                  <button onClick={() => setView('discover')} className={`px-6 py-3 rounded-xl font-semibold transition-all active:scale-[0.98] ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white border border-gray-200 hover:bg-gray-50 shadow-sm'}`}>{t('dash_btn_explore')}</button>
                  <button onClick={() => setView('add')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98]">{t('dash_btn_manual')}</button>
                </div>
              </div>
            ) : displayedApps.length === 0 ? (
              <div className="text-center py-20"><p className="text-gray-500">{t('dash_no_results')}</p></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayedApps.map(app => (
                  <div key={app.id} onClick={() => handleLaunchApp(app)} className={`group relative p-6 rounded-[2rem] cursor-pointer transition-all duration-300 hover:-translate-y-2 border backdrop-blur-md ${theme === 'dark' ? 'bg-[#14141A]/80 hover:bg-[#1A1A24] border-white/5 hover:border-blue-500/30 shadow-2xl shadow-black/40 hover:shadow-blue-500/10' : 'bg-white/80 hover:bg-white border-gray-200 hover:border-blue-200 shadow-sm hover:shadow-xl hover:shadow-blue-500/10'}`}>
                    
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1.5 z-10" onClick={e => e.stopPropagation()}>
                      <button onClick={(e) => handleEditApp(app, e)} className={`p-2.5 rounded-xl backdrop-blur-md transition-all hover:scale-110 active:scale-95 ${theme === 'dark' ? 'bg-black/50 text-gray-300 hover:bg-blue-500 hover:text-white' : 'bg-white text-gray-600 hover:bg-blue-500 hover:text-white shadow-sm'}`}><Settings size={16} /></button>
                      <button onClick={(e) => handleDeleteApp(app.id, e)} className={`p-2.5 rounded-xl backdrop-blur-md transition-all hover:scale-110 active:scale-95 ${theme === 'dark' ? 'bg-black/50 text-gray-300 hover:bg-red-500 hover:text-white' : 'bg-white text-gray-600 hover:bg-red-500 hover:text-white shadow-sm'}`}><Trash2 size={16} /></button>
                    </div>
                    
                    <div className="flex flex-col items-center text-center">
                      <div className={`w-20 h-20 mb-5 rounded-2xl flex items-center justify-center p-3 shadow-inner relative group-hover:scale-105 transition-transform duration-300 ${theme === 'dark' ? 'bg-[#1E1E28]' : 'bg-gray-50'}`}>
                        <div className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-20 blur-xl rounded-full transition-opacity duration-500 pointer-events-none"></div>
                        <img src={app.icon} alt={app.name} className="w-full h-full object-contain rounded-xl drop-shadow-md relative z-10" onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${app.name}&backgroundColor=3b82f6`}} />
                      </div>
                      
                      <h3 className="font-bold text-xl mb-1 truncate w-full tracking-tight">{app.name}</h3>
                      <p className={`text-[11px] font-bold px-3 py-1 rounded-full mb-4 inline-block uppercase tracking-wider ${theme === 'dark' ? 'bg-white/5 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>{app.category}</p>
                      
                      <div className={`w-full flex items-center justify-between mt-2 pt-4 border-t text-xs font-medium ${theme === 'dark' ? 'border-white/5 text-gray-500' : 'border-gray-100 text-gray-400'}`}>
                        <div className="flex items-center"><Clock size={12} className="mr-1.5" /> {timeAgo(app.lastOpened)}</div>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 transform translate-x-2 group-hover:translate-x-0 duration-300">{t('app_open')} <ChevronRight size={14} className="ml-0.5" /></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'settings' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold tracking-tight">{t('set_title')}</h2>
            </div>

            <div className="flex flex-col md:flex-row gap-10">
              
              {/* Settings Sidebar */}
              <div className="w-full md:w-56 flex-shrink-0 space-y-6">
                <div className={`flex items-center space-x-3 p-3 rounded-2xl border transition-all cursor-default ${theme === 'dark' ? 'bg-[#14141A]/80 border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold shadow-inner">
                    {username ? username.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="font-semibold text-sm truncate">{username || 'User'}</div>
                </div>

                <nav className="space-y-1">
                  {[
                    { id: 'general', icon: Settings, label: t('set_tab_general') },
                    { id: 'appearance', icon: Monitor, label: t('set_tab_appearance') },
                    { id: 'link_rules', icon: LinkIcon, label: t('set_tab_links') },
                    { id: 'storage', icon: HardDrive, label: t('set_tab_storage') },
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setSettingsTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium active:scale-95
                        ${settingsTab === tab.id 
                          ? (theme === 'dark' ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm border border-gray-200') 
                          : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                        }`}
                    >
                      <tab.icon size={18} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                  
                  <div className={`my-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}></div>
                  
                  <button onClick={() => setSettingsTab('about')} className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium active:scale-95 ${settingsTab === 'about' ? (theme === 'dark' ? 'bg-white/10 text-white' : 'bg-white border text-gray-900') : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                    <Info size={18} /><span>{t('set_tab_about')}</span>
                  </button>
                </nav>
              </div>

              {/* Settings Content Area */}
              <div className="flex-1 max-w-3xl space-y-6">
                
                {settingsTab === 'general' && (
                  <div className="animate-in fade-in duration-300 space-y-6">
                    <div className={`rounded-2xl border backdrop-blur-md overflow-hidden ${theme === 'dark' ? 'bg-[#14141A]/90 border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <div className="px-6 py-5 flex items-center justify-between">
                        <div className="font-semibold text-[15px]">{t('set_lang')}</div>
                        <div className="relative">
                          <select 
                            value={lang} 
                            onChange={(e) => changeLanguage(e.target.value)}
                            className={`appearance-none pl-4 pr-10 py-2 rounded-xl text-sm font-medium border outline-none cursor-pointer transition-colors ${theme === 'dark' ? 'bg-[#1E1E28] border-white/10 text-white hover:border-white/20' : 'bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100'}`}
                          >
                            <option value="en">English (EN)</option>
                            <option value="es">Español (ES)</option>
                          </select>
                          <Globe size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    <div className={`rounded-2xl border backdrop-blur-md overflow-hidden ${theme === 'dark' ? 'bg-[#14141A]/90 border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <div className="px-6 py-5 flex flex-col space-y-3">
                        <div className="font-semibold text-[15px]">{t('set_path')}</div>
                        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('set_path_desc')}</p>
                        <input 
                          type="text" 
                          value={installPath}
                          onChange={(e) => setInstallPath(e.target.value)}
                          className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium font-mono focus:border-blue-500 outline-none transition-colors ${theme === 'dark' ? 'bg-[#1E1E28] border-white/10 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                        />
                      </div>

                      <div className={`h-px w-full ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}></div>

                      <div className="px-6 py-5 flex items-center justify-between">
                        <div className="font-semibold text-[15px]">{t('set_shortcuts_desk')}</div>
                        <SettingToggle checked={true} />
                      </div>

                      <div className={`h-px w-full ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}></div>

                      <div className="px-6 py-5 flex items-center justify-between">
                        <div className="font-semibold text-[15px]">{t('set_shortcuts_start')}</div>
                        <SettingToggle checked={true} />
                      </div>
                    </div>

                    <div className={`rounded-2xl border backdrop-blur-md overflow-hidden ${theme === 'dark' ? 'bg-[#14141A]/90 border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <button className={`w-full px-6 py-5 flex items-center justify-between font-semibold text-[15px] transition-colors active:bg-white/10 ${theme === 'dark' ? 'hover:bg-white/5 text-red-400' : 'hover:bg-gray-50 text-red-500'}`}>
                        <span>{t('set_reset')}</span>
                      </button>
                    </div>
                  </div>
                )}

                {settingsTab === 'appearance' && (
                   <div className="animate-in fade-in duration-300">
                     <div className={`rounded-2xl border backdrop-blur-md overflow-hidden ${theme === 'dark' ? 'bg-[#14141A]/90 border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="px-6 py-5 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-[15px] mb-1">{t('set_theme_mode')}</div>
                            <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('set_theme_desc')}</div>
                          </div>
                          <div className={`flex items-center p-1 rounded-xl border ${theme === 'dark' ? 'bg-[#1E1E28] border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                            <button onClick={() => changeTheme('light')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-all ${theme === 'light' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                              <Sun size={14} /> <span>Light</span>
                            </button>
                            <button onClick={() => changeTheme('dark')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-all ${theme === 'dark' ? 'bg-gray-700 shadow-sm text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                              <Moon size={14} /> <span>Dark</span>
                            </button>
                          </div>
                        </div>
                     </div>
                   </div>
                )}

                {settingsTab === 'link_rules' && (
                  <div className="animate-in fade-in duration-300">
                    <div className={`rounded-2xl border backdrop-blur-md overflow-hidden ${theme === 'dark' ? 'bg-[#14141A]/90 border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <div className="px-6 py-5 flex items-center justify-between">
                        <div className="pr-8">
                          <div className="font-semibold text-[15px] mb-1">{t('set_link_intercept')}</div>
                          <div className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t('set_link_desc')}
                          </div>
                        </div>
                        <SettingToggle checked={true} />
                      </div>
                      <div className={`h-px w-full ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}></div>
                      <div className="px-6 py-5 flex items-center justify-between">
                        <div className="pr-8 font-semibold text-[15px]">{t('set_link_force')}</div>
                        <SettingToggle checked={false} />
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'storage' && (
                  <div className="animate-in fade-in duration-300 space-y-6">
                    <div className={`p-6 rounded-2xl border backdrop-blur-md flex justify-between items-center ${theme === 'dark' ? 'bg-blue-900/20 border-blue-500/20' : 'bg-blue-50 border-blue-200 shadow-sm'}`}>
                      <div>
                        <div className="font-semibold text-lg">{t('set_store_total')}</div>
                        <div className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>{t('set_store_desc')}</div>
                      </div>
                      <div className="text-3xl font-black text-blue-500">{totalStorageMB} MB</div>
                    </div>

                    <div className={`rounded-2xl border backdrop-blur-md overflow-hidden ${theme === 'dark' ? 'bg-[#14141A]/90 border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
                      {apps.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">{t('dash_no_results')}</div>
                      ) : (
                        apps.map((app, index) => (
                          <div key={app.id} className={`px-6 py-4 flex items-center justify-between ${index !== 0 && (theme === 'dark' ? 'border-t border-white/5' : 'border-t border-gray-100')}`}>
                            <div className="flex items-center space-x-4">
                              <img src={app.icon} alt="" className="w-8 h-8 rounded-md" onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${app.name}`}} />
                              <div>
                                <div className="font-semibold text-sm">{app.name}</div>
                                <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{app.sizeMB} MB</div>
                              </div>
                            </div>
                            <button onClick={() => handleDeleteApp(app.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                              {t('set_store_uninstall')}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {settingsTab === 'about' && (
                  <div className="animate-in fade-in duration-300 flex flex-col items-center justify-center py-10">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-500/30">
                      <Box size={48} />
                    </div>
                    <h3 className="text-2xl font-bold mb-1">AppSpawner</h3>
                    <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('set_about_ver')}: 2.4.1 (Premium Build)</p>
                    
                    <div className={`w-full max-w-sm rounded-2xl border p-4 text-center space-y-4 ${theme === 'dark' ? 'bg-[#14141A]/90 border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors">
                        {t('set_about_check')}
                      </button>
                      <div className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                        {t('set_about_dev')}: @TuUsuario <br />
                        © {new Date().getFullYear()} AppSpawner Inc. All rights reserved.
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {view === 'discover' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="mb-10 text-center lg:text-left">
              <h2 className="text-4xl font-bold mb-3 tracking-tight">{t('discover_title')}</h2>
              <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-lg max-w-2xl`}>
                {t('discover_desc')}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {DISCOVER_APPS.map((app, idx) => {
                const isInstalled = apps.some(a => a.url === app.url);
                return (
                  <div key={idx} className={`p-6 rounded-[2rem] border flex items-center space-x-5 transition-all hover:scale-[1.02] backdrop-blur-md ${theme === 'dark' ? 'bg-[#14141A]/80 hover:bg-[#1A1A24] border-white/5 shadow-xl shadow-black/20' : 'bg-white/80 hover:bg-white border-gray-200 shadow-sm hover:shadow-xl'}`}>
                    <div className={`w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center p-2 shadow-inner ${theme === 'dark' ? 'bg-[#1E1E28]' : 'bg-gray-50'}`}>
                       <img src={app.icon} alt={app.name} className="w-full h-full object-contain drop-shadow-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg truncate flex items-center gap-2">
                        {app.name}
                        {isInstalled && <span className="bg-green-500/20 text-green-500 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md tracking-wider">{t('app_installed')}</span>}
                      </h3>
                      <p className={`text-sm truncate mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{app.desc}</p>
                      <button 
                        disabled={isInstalled}
                        onClick={() => handleQuickInstall(app)}
                        className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 ${isInstalled ? (theme === 'dark' ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'}`}
                      >
                        {isInstalled ? <span>{t('app_added')}</span> : <><Download size={16} /><span>{t('app_btn_install')}</span></>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'add' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
             <h2 className="text-4xl font-bold mb-3 tracking-tight">{editingId ? t('add_title_edit') : t('add_title_new')}</h2>
             <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} mb-10 text-lg`}>
               {editingId ? t('add_desc_edit') : t('add_desc_new')}
             </p>
             <form onSubmit={handleAddApp} className={`p-8 lg:p-10 rounded-[2rem] border shadow-2xl backdrop-blur-xl ${theme === 'dark' ? 'bg-[#14141A]/80 border-white/10 shadow-black/40' : 'bg-white/90 border-gray-200 shadow-gray-200/50'}`}>
                <div className="space-y-8">
                  <div>
                    <label className={`block text-xs font-bold tracking-widest mb-3 uppercase ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('add_form_name')}</label>
                    <input type="text" required value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Ej. Panel Administrativo AWS" className={`w-full px-5 py-4 rounded-2xl border-2 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-lg font-medium ${theme === 'dark' ? 'bg-[#0A0A0F]/50 border-white/5 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-100 text-gray-900'}`} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className={`block text-xs font-bold tracking-widest mb-3 uppercase ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('add_form_url')}</label>
                      <input type="url" required value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://..." className={`w-full px-5 py-4 rounded-2xl border-2 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-lg ${theme === 'dark' ? 'bg-[#0A0A0F]/50 border-white/5 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-100 text-gray-900'}`} />
                    </div>
                    <div>
                      <label className={`block text-xs font-bold tracking-widest mb-3 uppercase ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('add_form_category')}</label>
                      <div className="relative">
                        <select value={appCategory} onChange={(e) => setAppCategory(e.target.value)} className={`w-full px-5 py-4 rounded-2xl border-2 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none text-lg font-medium cursor-pointer ${theme === 'dark' ? 'bg-[#0A0A0F]/50 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'}`}>
                          {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <Tag size={20} className={`absolute right-5 top-4 pointer-events-none ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs font-bold tracking-widest mb-3 uppercase flex justify-between ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      <span>{t('add_form_icon')}</span><span className="text-blue-500 font-normal normal-case tracking-normal">{t('add_form_icon_opt')}</span>
                    </label>
                    <div className="flex gap-4 items-center">
                      <div className={`w-16 h-16 rounded-2xl flex-shrink-0 border-2 overflow-hidden flex items-center justify-center p-2 ${theme === 'dark' ? 'bg-[#0A0A0F]/50 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                        {appIcon ? <img src={appIcon} alt="Preview" className="w-full h-full object-contain" /> : <Box className="text-gray-500 opacity-50" />}
                      </div>
                      <input type="url" value={appIcon} onChange={(e) => setAppIcon(e.target.value)} placeholder="URL de imagen PNG/SVG..." className={`flex-1 px-5 py-4 rounded-2xl border-2 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-lg ${theme === 'dark' ? 'bg-[#0A0A0F]/50 border-white/5 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-100 text-gray-900'}`} />
                    </div>
                  </div>
                </div>
                <div className="mt-10 pt-8 border-t flex flex-col-reverse md:flex-row justify-end gap-4 md:space-x-4 border-white/10">
                  <button type="button" onClick={() => { setView('dashboard'); setEditingId(null); }} className={`px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 w-full md:w-auto text-center ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                    {t('add_btn_cancel')}
                  </button>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/25 active:scale-95 w-full md:w-auto text-center">
                    {editingId ? t('add_btn_submit_edit') : t('add_btn_submit_new')}
                  </button>
                </div>
             </form>
          </div>
        )}

      </div>
    </div>
  );
}
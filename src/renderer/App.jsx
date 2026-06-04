import React, { useEffect, useState, Suspense } from 'react';
import { ThemeProvider }       from './contexts/ThemeContext';
import { I18nProvider }        from './contexts/I18nContext';
import { ToastProvider }       from './contexts/ToastContext';
import { AppProvider }         from './contexts/AppContext';
import { WorkspaceProvider }   from './contexts/WorkspaceContext';
import Sidebar            from './components/Layout/Sidebar';
import TitleBar           from './components/Layout/TitleBar';
import QuickLauncher      from './components/QuickLauncher';
import Onboarding         from './views/Onboarding';
import Dashboard          from './views/Dashboard';
import Discover           from './views/Discover';
import CreateApp          from './views/CreateApp';
import Settings           from './views/Settings';
import Profiles           from './views/Profiles';

/** Spinner de carga inicial mientras se consulta el user del store */
function LoadingScreen() {
  return (
    <div className="w-screen h-screen bg-surface-base flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-accent-gradient flex items-center justify-center shadow-glow">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 10a7 7 0 1 1 14 0A7 7 0 0 1 3 10z" stroke="white" strokeWidth="2"/>
            <path d="M10 6v4l3 3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}

/** Renderiza la vista actual según la navegación */
function AppShell({ currentView, setCurrentView, selectedCategory, setSelectedCategory }) {
  const [showQL,             setShowQL]             = useState(false);
  const [selectedWorkspace,  setSelectedWorkspace]  = useState(null);
  const [installPrefill,     setInstallPrefill]     = useState(null);

  useEffect(() => {
    const u1 = window.electronAPI?.onQuickLauncherToggle?.(() => setShowQL(v => !v));
    const u2 = window.electronAPI?.onInstallFromLink?.((params) => {
      setInstallPrefill(params);
      setCurrentView('create');
    });
    return () => { u1?.(); u2?.(); };
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return (
        <Dashboard
          selectedCategory={selectedCategory}
          selectedWorkspace={selectedWorkspace}
          onSelectWorkspace={setSelectedWorkspace}
          onNavigate={setCurrentView}
        />
      );
      case 'discover':  return <Discover onNavigate={setCurrentView} />;
      case 'create':    return <CreateApp onNavigate={(v) => { setInstallPrefill(null); setCurrentView(v); }} initialData={installPrefill} />;
      case 'settings':  return <Settings />;
      case 'profiles':  return <Profiles onNavigate={setCurrentView} />;
      default:          return (
        <Dashboard
          selectedCategory={selectedCategory}
          selectedWorkspace={selectedWorkspace}
          onSelectWorkspace={setSelectedWorkspace}
          onNavigate={setCurrentView}
        />
      );
    }
  };

  return (
    <AppProvider>
      <WorkspaceProvider>
      <div className="flex flex-col w-screen h-screen overflow-hidden bg-surface-base text-white">
        <TitleBar currentView={currentView} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            currentView={currentView}
            onNavigate={setCurrentView}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedWorkspace={selectedWorkspace}
            onSelectWorkspace={setSelectedWorkspace}
          />
          <main className="flex-1 overflow-hidden relative">
            {/* Fondo ambiental */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/8 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-blue-600/6 rounded-full blur-3xl" />
            </div>
            <div className="relative h-full">
              {renderView()}
            </div>
          </main>
        </div>
        {showQL && <QuickLauncher onClose={() => setShowQL(false)} />}
      </div>
      </WorkspaceProvider>
    </AppProvider>
  );
}

export default function App() {
  const [isOnboarding, setIsOnboarding] = useState(null); // null = cargando
  const [currentView,  setCurrentView]  = useState('dashboard');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await window.electronAPI?.getUser();
        setIsOnboarding(!user?.name);
      } catch {
        const stored = localStorage.getItem('as_user');
        setIsOnboarding(!stored);
      }
    };
    checkUser();
  }, []);

  if (isOnboarding === null) return <LoadingScreen />;

  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          {isOnboarding ? (
            <Onboarding onComplete={() => setIsOnboarding(false)} />
          ) : (
            <AppShell
              currentView={currentView}
              setCurrentView={setCurrentView}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
            />
          )}
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

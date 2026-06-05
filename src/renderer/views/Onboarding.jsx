import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, FolderPlus, Globe2, LayoutDashboard,
  MonitorUp, MousePointerClick, ShieldCheck, Sparkles, Wand2,
} from 'lucide-react';
import { useI18n }   from '../contexts/I18nContext';
import { useToast }  from '../contexts/ToastContext';

const COPY = {
  es: {
    next: 'Continuar',
    back: 'Atrás',
    start: 'Entrar a AppSpawner',
    skip: 'Saltar introducción',
    nameLabel: 'Nombre para personalizar tu espacio',
    namePlaceholder: 'Tu nombre',
    saving: 'Preparando tu espacio...',
    welcomeTitle: 'AppSpawner convierte sitios web en apps de escritorio',
    welcomeText: 'Crea ventanas independientes para tus servicios, con sesiones separadas, icono propio, acceso directo y controles pensados para usarlas todos los días.',
    flowTitle: 'El flujo es simple',
    flowText: 'Pegas una URL, eliges identidad visual y AppSpawner crea un entorno aislado que puedes abrir desde el dashboard, escritorio o menú de inicio.',
    controlTitle: 'Cada app tiene su propio entorno',
    controlText: 'Cookies, sesiones, scripts con permisos, adblock, toolbar, PiP, vault, 2FA y PIN pueden gestionarse por app sin mezclar cuentas ni romper tu navegador principal.',
    futureTitle: 'Lo que puedes esperar',
    futureText: 'AppSpawner evoluciona hacia un centro de apps web serio: perfiles, reglas, protección anti anuncios, backups, automatizaciones, vault local y flujos separados de trabajo/personal.',
    cards: [
      ['Apps aisladas', 'Cada web vive en su propia sesión.'],
      ['Accesos directos', 'Abre apps desde Windows como si fueran nativas.'],
      ['Control por app', 'Seguridad, scripts y automatizaciones sin afectar otras apps.'],
    ],
    steps: [
      ['Crear', 'Nombre, URL, categoría e icono.'],
      ['Personalizar', 'Ventana, atajos, toolbar, vault y protección.'],
      ['Usar', 'Abrir, fijar, editar, limpiar o compartir.'],
    ],
    expectations: [
      'Menos pestañas y menos mezcla de sesiones.',
      'Apps web con comportamiento más cercano a escritorio.',
      'Base preparada para perfiles, automatizaciones, PIN y reglas avanzadas.',
    ],
  },
  en: {
    next: 'Continue',
    back: 'Back',
    start: 'Enter AppSpawner',
    skip: 'Skip intro',
    nameLabel: 'Name for your workspace',
    namePlaceholder: 'Your name',
    saving: 'Preparing your workspace...',
    welcomeTitle: 'AppSpawner turns websites into desktop apps',
    welcomeText: 'Create independent windows for your services, with separated sessions, custom icons, shortcuts, and daily-use controls.',
    flowTitle: 'The workflow is simple',
    flowText: 'Paste a URL, choose its visual identity, and AppSpawner creates an isolated environment you can open from the dashboard, desktop, or Start menu.',
    controlTitle: 'Every app owns its environment',
    controlText: 'Cookies, sessions, permissioned scripts, adblock, toolbar, PiP, vault, 2FA, and PIN protection can be managed per app without mixing accounts or touching your main browser.',
    futureTitle: 'What to expect',
    futureText: 'AppSpawner is becoming a serious web-app command center: profiles, rules, ad protection, backups, automations, local vault, and separated work/personal flows.',
    cards: [
      ['Isolated apps', 'Each website lives in its own session.'],
      ['Native shortcuts', 'Launch apps from Windows like native software.'],
      ['Per-app control', 'Security, scripts, and automations without affecting others.'],
    ],
    steps: [
      ['Create', 'Name, URL, category, and icon.'],
      ['Customize', 'Window, shortcuts, toolbar, vault, and protection.'],
      ['Use', 'Open, pin, edit, clean up, or share.'],
    ],
    expectations: [
      'Fewer tabs and less session mixing.',
      'Web apps that behave closer to desktop apps.',
      'A base ready for profiles, automations, PIN, and advanced rules.',
    ],
  },
};

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const { language } = useI18n();
  const toast = useToast();
  const copy = COPY[language] || COPY.es;

  const slides = useMemo(() => [
    {
      icon: Sparkles,
      title: copy.welcomeTitle,
      text: copy.welcomeText,
      visual: <PreviewDashboard cards={copy.cards} />,
    },
    {
      icon: FolderPlus,
      title: copy.flowTitle,
      text: copy.flowText,
      visual: <FlowPreview steps={copy.steps} />,
    },
    {
      icon: ShieldCheck,
      title: copy.controlTitle,
      text: copy.controlText,
      visual: <ControlPreview />,
    },
    {
      icon: Wand2,
      title: copy.futureTitle,
      text: copy.futureText,
      visual: <ExpectationPreview items={copy.expectations} />,
      final: true,
    },
  ], [copy]);

  const current = slides[step];
  const Icon = current.icon;

  useEffect(() => {
    if (current.final) setTimeout(() => inputRef.current?.focus(), 150);
  }, [current.final]);

  const saveUser = async (rawName = name) => {
    const trimmed = rawName.trim() || (language === 'en' ? 'User' : 'Usuario');
    setSaving(true);
    setError('');
    try {
      const defaultPath = await window.electronAPI?.getDefaultInstallPath() ?? '';
      const user = { name: trimmed, installPath: defaultPath, createdAt: Date.now() };
      await window.electronAPI?.saveUser(user);
      localStorage.setItem('as_user', JSON.stringify(user));
      toast.success(`Bienvenido, ${trimmed}`, 'AppSpawner listo');
      onComplete();
    } catch (err) {
      setError(err.message || 'No se pudo guardar la configuración inicial');
    } finally {
      setSaving(false);
    }
  };

  const advance = () => {
    if (current.final) {
      saveUser();
      return;
    }
    setStep(s => Math.min(s + 1, slides.length - 1));
  };

  return (
    <div className="w-screen h-screen bg-surface-base text-white overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.45) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.45) 1px, transparent 1px)', backgroundSize: '44px 44px' }}
      />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_20%,rgba(124,58,237,.18),transparent_32%),radial-gradient(circle_at_82%_70%,rgba(14,165,233,.12),transparent_34%)]" />

      <div className="relative z-10 h-full max-w-6xl mx-auto px-6 py-8 flex flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-gradient shadow-glow flex items-center justify-center">
              <LayoutDashboard size={20} />
            </div>
            <div>
              <p className="text-sm font-bold tracking-wide">APPSPAWNER</p>
              <p className="text-xs text-white/35">Site-Specific Browser Manager</p>
            </div>
          </div>
          <button onClick={() => saveUser(language === 'en' ? 'User' : 'Usuario')} className="text-xs text-white/35 hover:text-white/70 transition-colors">
            {copy.skip}
          </button>
        </header>

        <main className="flex-1 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center min-h-0 py-8">
          <section className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-xs text-white/50 mb-6">
              <Icon size={14} className="text-violet-300" />
              Paso {step + 1} de {slides.length}
            </div>
            <h1 className="text-4xl lg:text-5xl font-black leading-[1.02] tracking-normal mb-5">
              {current.title}
            </h1>
            <p className="text-base text-white/48 leading-relaxed max-w-lg">
              {current.text}
            </p>

            {current.final && (
              <div className="mt-7 max-w-md">
                <label className="form-label">{copy.nameLabel}</label>
                <input
                  ref={inputRef}
                  value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && saveUser()}
                  placeholder={copy.namePlaceholder}
                  className={`input-field text-base ${error ? 'border-red-500/60' : ''}`}
                  maxLength={50}
                />
                {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
              </div>
            )}
          </section>

          <section className="min-h-[420px] flex items-center">
            {current.visual}
          </section>
        </main>

        <footer className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-10 bg-violet-400' : 'w-2.5 bg-white/18 hover:bg-white/35'}`}
                aria-label={`Ir al paso ${i + 1}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0 || saving}
              className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-30"
            >
              <ArrowLeft size={15} /> {copy.back}
            </button>
            <button
              onClick={advance}
              disabled={saving}
              className="btn-primary flex items-center gap-2 text-sm min-w-[160px] justify-center"
            >
              {saving ? copy.saving : current.final ? copy.start : copy.next}
              {!saving && (current.final ? <Check size={15} /> : <ArrowRight size={15} />)}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function PreviewDashboard({ cards }) {
  return (
    <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 shadow-card-hover">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold">Mis Apps</p>
          <p className="text-xs text-white/35">Entornos aislados listos para abrir</p>
        </div>
        <div className="w-28 h-9 rounded-xl bg-white/[0.06]" />
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {cards.map(([title, text], index) => (
          <div key={title} className="rounded-xl bg-surface-card border border-white/[0.08] p-4 min-h-[150px]">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${index === 0 ? 'bg-violet-600/25 text-violet-300' : index === 1 ? 'bg-emerald-600/20 text-emerald-300' : 'bg-sky-600/20 text-sky-300'}`}>
              {index === 0 ? <Globe2 size={18} /> : index === 1 ? <MonitorUp size={18} /> : <ShieldCheck size={18} />}
            </div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-white/35 leading-relaxed mt-2">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowPreview({ steps }) {
  return (
    <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
      <div className="space-y-3">
        {steps.map(([title, text], index) => (
          <div key={title} className="flex items-center gap-4 rounded-xl bg-surface-card border border-white/[0.08] p-4">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-300 flex items-center justify-center font-bold">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-white/35">{text}</p>
            </div>
            {index < steps.length - 1 && <ArrowRight size={16} className="text-white/22" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ControlPreview() {
  const tools = ['Ad Block', 'PiP', 'Toolbar', 'Scripts', '2FA', 'Sesiones'];
  return (
    <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
      <div className="rounded-xl bg-surface-card border border-white/[0.08] p-5">
        <div className="aspect-video rounded-xl bg-black overflow-hidden relative mb-4">
          <div className="absolute inset-x-5 bottom-5 h-10 rounded-xl bg-white/[0.08] border border-white/[0.08] flex items-center px-3 gap-3">
            <MousePointerClick size={16} className="text-violet-300" />
            <div className="h-1.5 flex-1 rounded-full bg-white/[0.12] overflow-hidden">
              <div className="h-full w-2/3 bg-violet-400 rounded-full" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {tools.map(tool => (
            <div key={tool} className="rounded-lg bg-white/[0.045] border border-white/[0.06] px-3 py-2 text-xs text-white/55">
              {tool}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExpectationPreview({ items }) {
  return (
    <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
      <div className="rounded-xl bg-surface-card border border-white/[0.08] p-5">
        <p className="text-sm font-semibold mb-4">Roadmap de experiencia</p>
        <div className="space-y-3">
          {items.map(item => (
            <div key={item} className="flex items-start gap-3">
              <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center flex-shrink-0">
                <Check size={12} />
              </div>
              <p className="text-sm text-white/55 leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

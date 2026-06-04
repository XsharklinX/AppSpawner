import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Shield, Link, Zap } from 'lucide-react';
import { useI18n }   from '../contexts/I18nContext';
import { useToast }  from '../contexts/ToastContext';

const FEATURES = [
  { icon: Shield, key: 'onboarding_feat1', color: 'text-violet-400' },
  { icon: Link,   key: 'onboarding_feat2', color: 'text-blue-400'   },
  { icon: Zap,    key: 'onboarding_feat3', color: 'text-amber-400'  },
];

export default function Onboarding({ onComplete }) {
  const [name,   setName]    = useState('');
  const [saving, setSaving]  = useState(false);
  const [error,  setError]   = useState('');
  const inputRef = useRef(null);
  const { t }    = useI18n();
  const toast    = useToast();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 400);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError(t('form_name_error')); return; }

    setSaving(true);
    try {
      // Obtener ruta de instalación sugerida por el sistema
      const defaultPath = await window.electronAPI?.getDefaultInstallPath() ?? '';
      const user = {
        name:        trimmed,
        installPath: defaultPath,
        createdAt:   Date.now(),
      };

      await window.electronAPI?.saveUser(user);
      // Fallback para dev web
      localStorage.setItem('as_user', JSON.stringify(user));

      toast.success(`¡Bienvenido, ${trimmed}!`, 'AppSpawner listo');
      onComplete();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-screen h-screen bg-surface-base flex items-center justify-center overflow-hidden relative">

      {/* ── Fondos ambientales ────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-violet-600/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)' }}
        />
      </div>

      {/* ── Grid decorativo ───────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      {/* ── Panel central ─────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-slide-up">

        {/* Logo + Título */}
        <div className="text-center mb-10">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-accent-gradient items-center justify-center mb-5 shadow-glow animate-bounce-in">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <circle cx="15" cy="15" r="12" stroke="white" strokeWidth="2.5"/>
              <circle cx="15" cy="15" r="5" fill="white" fillOpacity="0.9"/>
              <path d="M15 7v4M15 19v4M7 15h4M19 15h4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">
            {t('onboarding_title')}
          </h1>
          <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
            {t('onboarding_desc')}
          </p>
        </div>

        {/* Formulario de nombre */}
        <div className="glass rounded-3xl p-6 mb-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="form-label">{t('onboarding_label')}</label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                placeholder={t('onboarding_placeholder')}
                className={`input-field text-base ${error ? 'border-red-500/60 focus:border-red-500/80' : ''}`}
                maxLength={50}
                autoComplete="given-name"
              />
              {error && (
                <p className="mt-1.5 text-xs text-red-400">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className={`
                btn-primary flex items-center justify-center gap-2 py-3 text-sm font-semibold w-full mt-1
                ${(saving || !name.trim()) ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {t('loading')}
                </>
              ) : (
                <>
                  {t('onboarding_btn')}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3">
          {FEATURES.map(({ icon: Icon, key, color }) => (
            <div
              key={key}
              className="glass rounded-2xl p-3 text-center flex flex-col items-center gap-2"
            >
              <div className={`w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center`}>
                <Icon size={16} className={color} />
              </div>
              <p className="text-[10px] text-white/40 leading-tight font-medium">{t(key)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

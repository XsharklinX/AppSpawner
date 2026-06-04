import React, { useState, useEffect } from 'react';
import { Code2, Save, Trash2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

const PLACEHOLDER_CSS = `/* Ejemplo: cambiar el fondo de la app */
body {
  background: #1a1a2e !important;
}`;

const PLACEHOLDER_JS = `// Ejemplo: ocultar un elemento molesto
// document.querySelector('.cookie-banner')?.remove();`;

export default function AppScripts({ app }) {
  const toast = useToast();
  const [css,     setCss]     = useState('');
  const [js,      setJs]      = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [tab,     setTab]     = useState('css'); // 'css' | 'js'

  useEffect(() => {
    const load = async () => {
      try {
        const scripts = await window.electronAPI?.getScripts(app.id) ?? { css: '', js: '', enabled: true };
        setCss(scripts.css || '');
        setJs(scripts.js  || '');
        setEnabled(scripts.enabled !== false);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [app.id]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await window.electronAPI?.saveScripts(app.id, { css, js, enabled });
      setSaved(true);
      toast.success('Scripts guardados', 'Se aplicarán en la próxima recarga');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await window.electronAPI?.deleteScripts(app.id);
    setCss(''); setJs(''); setEnabled(true);
    toast.success('Scripts eliminados');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-5 h-5 border-2 border-violet-500/40 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Info */}
      <div className="flex items-start gap-3 glass rounded-xl p-3.5">
        <Info size={15} className="text-violet-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-white/40 leading-relaxed">
          El CSS y JS se inyectan en <strong className="text-white/60">{app.name}</strong> después de cada carga de página.
          Úsalos para personalizar la interfaz o automatizar acciones.
        </p>
      </div>

      {/* Toggle habilitado */}
      <label className="flex items-center gap-3 cursor-pointer select-none glass rounded-xl px-4 py-3">
        <div
          onClick={() => setEnabled(v => !v)}
          className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-violet-600' : 'bg-white/[0.1]'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : ''}`} />
        </div>
        <span className="text-sm font-medium text-white/70">Scripts habilitados</span>
      </label>

      {/* Tabs CSS / JS */}
      <div className="flex gap-1 p-1 glass rounded-xl">
        {['css', 'js'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t ? 'bg-violet-600/30 text-violet-300' : 'text-white/35 hover:text-white/60'}`}
          >
            {t === 'css' ? '🎨 CSS' : '⚡ JavaScript'}
          </button>
        ))}
      </div>

      {/* Editor */}
      {tab === 'css' ? (
        <textarea
          value={css}
          onChange={e => setCss(e.target.value)}
          placeholder={PLACEHOLDER_CSS}
          className="input-field font-mono text-xs resize-none leading-relaxed"
          rows={10}
          spellCheck={false}
        />
      ) : (
        <textarea
          value={js}
          onChange={e => setJs(e.target.value)}
          placeholder={PLACEHOLDER_JS}
          className="input-field font-mono text-xs resize-none leading-relaxed"
          rows={10}
          spellCheck={false}
        />
      )}

      {/* Botones */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 text-sm flex-1 justify-center"
        >
          {saving
            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : saved
              ? <CheckCircle2 size={14} />
              : <Save size={14} />
          }
          {saved ? 'Guardado' : 'Guardar scripts'}
        </button>
        {(css || js) && (
          <button
            onClick={handleDelete}
            className="btn-ghost flex items-center gap-2 text-sm text-red-400/70 hover:text-red-400"
            title="Eliminar todos los scripts"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <p className="text-[11px] text-white/20 leading-relaxed">
        Los cambios se aplican en la siguiente carga de página. Recarga la app tras guardar.
      </p>
    </div>
  );
}

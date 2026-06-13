import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

/**
 * SoundContext — Sonidos sutiles de interfaz (sintetizados con Web Audio API).
 * No depende de archivos de audio: cada sonido es un breve tono generado
 * en tiempo real con osciladores y una envolvente de volumen.
 */

const SoundContext = createContext(null);

export const SOUND_PREFS_DEFAULT = {
  enabled: true,
  volume: 35, // 0-100
};

/** Definición de cada sonido: secuencia de tonos { freq, delay, duration, type, gain } */
const SOUND_RECIPES = {
  click:     [{ freq: 720,  delay: 0,    duration: 0.045, type: 'sine',     gain: 0.5 }],
  toggleOn:  [{ freq: 640,  delay: 0,    duration: 0.05,  type: 'triangle', gain: 0.45 },
              { freq: 920,  delay: 0.04, duration: 0.06,  type: 'triangle', gain: 0.35 }],
  toggleOff: [{ freq: 760,  delay: 0,    duration: 0.05,  type: 'triangle', gain: 0.4  },
              { freq: 520,  delay: 0.04, duration: 0.06,  type: 'triangle', gain: 0.3  }],
  launch:    [{ freq: 520,  delay: 0,    duration: 0.07,  type: 'sine',     gain: 0.5  },
              { freq: 780,  delay: 0.05, duration: 0.09,  type: 'sine',     gain: 0.4  }],
  success:   [{ freq: 660,  delay: 0,    duration: 0.08,  type: 'sine',     gain: 0.45 },
              { freq: 990,  delay: 0.07, duration: 0.12,  type: 'sine',     gain: 0.4  }],
  warning:   [{ freq: 600,  delay: 0,    duration: 0.07,  type: 'triangle', gain: 0.45 },
              { freq: 600,  delay: 0.11, duration: 0.07,  type: 'triangle', gain: 0.4  }],
  error:     [{ freq: 420,  delay: 0,    duration: 0.09,  type: 'square',   gain: 0.3  },
              { freq: 300,  delay: 0.08, duration: 0.12,  type: 'square',   gain: 0.28 }],
  delete:    [{ freq: 500,  delay: 0,    duration: 0.06,  type: 'sawtooth', gain: 0.3  },
              { freq: 340,  delay: 0.05, duration: 0.09,  type: 'sawtooth', gain: 0.25 }],
  notification: [{ freq: 880, delay: 0,    duration: 0.09, type: 'sine', gain: 0.35 },
                 { freq: 1175, delay: 0.08, duration: 0.14, type: 'sine', gain: 0.3 }],
};

export function SoundProvider({ children }) {
  const [prefs, setPrefs] = useState(SOUND_PREFS_DEFAULT);
  const ctxRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await window.electronAPI?.getSettings();
        setPrefs({ ...SOUND_PREFS_DEFAULT, ...(settings?.soundPrefs || {}) });
      } catch {
        setPrefs({ ...SOUND_PREFS_DEFAULT, ...JSON.parse(localStorage.getItem('as_sound_prefs') || 'null') });
      }
    };
    load();
  }, []);

  const setSoundPrefs = useCallback(async (next) => {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    try {
      await window.electronAPI?.updateSettings({ soundPrefs: merged });
    } catch {
      localStorage.setItem('as_sound_prefs', JSON.stringify(merged));
    }
  }, [prefs]);

  const getAudioContext = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const playSound = useCallback((name) => {
    if (!prefs.enabled || prefs.volume <= 0) return;
    const recipe = SOUND_RECIPES[name];
    if (!recipe) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const masterGain = prefs.volume / 100;
    const now = ctx.currentTime;

    for (const { freq, delay, duration, type, gain } of recipe) {
      const osc  = ctx.createOscillator();
      const node = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const start = now + delay;
      const end   = start + duration;
      const peak  = gain * masterGain;
      node.gain.setValueAtTime(0, start);
      node.gain.linearRampToValueAtTime(peak, start + Math.min(0.01, duration / 3));
      node.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(node);
      node.connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }, [prefs, getAudioContext]);

  /** Vibración háptica sutil (no-op si el dispositivo no soporta navigator.vibrate) */
  const vibrate = useCallback((pattern = 10) => {
    if (!prefs.enabled) return;
    try { navigator.vibrate?.(pattern); } catch {}
  }, [prefs.enabled]);

  return (
    <SoundContext.Provider value={{ playSound, vibrate, soundPrefs: prefs, setSoundPrefs }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound debe usarse dentro de <SoundProvider>');
  return ctx;
}

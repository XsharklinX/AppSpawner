/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/renderer/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class', // Toggle via JS adding/removing .dark on <html>
  theme: {
    extend: {
      colors: {
        // Design system tokens
        surface: {
          base:     '#09090e',
          card:     '#111118',
          elevated: '#18181f',
          overlay:  '#1e1e28',
        },
        border: {
          subtle: 'rgba(255,255,255,0.05)',
          soft:   'rgba(255,255,255,0.08)',
          focus:  'rgba(139,92,246,0.6)',
        },
        accent: {
          DEFAULT: '#7c3aed',
          light:   '#a855f7',
          glow:    'rgba(124,58,237,0.35)',
        },
      },
      animation: {
        'fade-in':     'fadeIn 0.2s ease-out',
        'slide-up':    'slideUp 0.25s ease-out',
        'slide-right': 'slideRight 0.25s ease-out',
        'scale-in':    'scaleIn 0.2s ease-out',
        'bounce-in':   'bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        'toast-in':    'toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        'toast-out':   'toastOut 0.25s ease-in forwards',
        'glow-pulse':  'glowPulse 2s ease-in-out infinite',
        'shimmer':     'shimmer 1.8s linear infinite',
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:  { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideRight: { from: { opacity: '0', transform: 'translateX(-12px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        scaleIn:  { from: { opacity: '0', transform: 'scale(0.94)' }, to: { opacity: '1', transform: 'scale(1)' } },
        bounceIn: { from: { opacity: '0', transform: 'scale(0.8)' }, to: { opacity: '1', transform: 'scale(1)' } },
        toastIn:  { from: { opacity: '0', transform: 'translateX(100%) scale(0.9)' }, to: { opacity: '1', transform: 'translateX(0) scale(1)' } },
        toastOut: { from: { opacity: '1', transform: 'translateX(0) scale(1)' }, to: { opacity: '0', transform: 'translateX(100%) scale(0.9)' } },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 12px rgba(124,58,237,0.3)' },
          '50%':      { boxShadow: '0 0 28px rgba(124,58,237,0.6)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'glow':       '0 0 20px rgba(124,58,237,0.4)',
        'glow-sm':    '0 0 10px rgba(124,58,237,0.25)',
        'card':       '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.6)',
        'glass':      'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        'gradient-radial':   'radial-gradient(var(--tw-gradient-stops))',
        'shimmer-gradient':  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
        'accent-gradient':   'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
        'surface-gradient':  'linear-gradient(180deg, #18181f 0%, #111118 100%)',
      },
    },
  },
  plugins: [],
};

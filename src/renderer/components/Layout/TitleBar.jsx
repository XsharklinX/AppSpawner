import React, { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';

const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI;
const IS_MAC      = navigator.platform?.toLowerCase().includes('mac');

export default function TitleBar({ currentView }) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const check = () => setIsMaximized(
      window.innerWidth  >= window.screen.width  - 10 &&
      window.innerHeight >= window.screen.height - 60
    );
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const minimize = () => window.electronAPI?.minimizeWindow();
  const maximize = () => { window.electronAPI?.maximizeWindow(); setIsMaximized(p => !p); };
  const close    = () => window.electronAPI?.closeWindow();

  if (IS_MAC && IS_ELECTRON) {
    return <div className="drag-region h-8 flex-shrink-0 bg-surface-base border-b border-white/[0.04]" style={{ paddingLeft: 80 }} />;
  }

  return (
    <div className="drag-region h-9 flex-shrink-0 flex items-center justify-between bg-surface-base border-b border-white/[0.04] select-none">
      <div className="no-drag flex items-center gap-2 px-4">
        <div className="w-5 h-5 rounded-md bg-accent-gradient flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4" stroke="white" strokeWidth="1.5"/>
            <circle cx="5" cy="5" r="1.5" fill="white"/>
          </svg>
        </div>
        <span className="text-[11px] font-semibold text-white/40 tracking-widest uppercase">AppSpawner</span>
      </div>

      {IS_ELECTRON && (
        <div className="no-drag flex items-center h-full">
          <WinBtn onClick={minimize} title="Minimizar" hover="hover:bg-white/10"><Minus size={12} /></WinBtn>
          <WinBtn onClick={maximize} title={isMaximized ? 'Restaurar' : 'Maximizar'} hover="hover:bg-white/10">
            {isMaximized
              ? <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M3 1h7v7M1 3v7h7" stroke="currentColor" strokeWidth="1.2"/></svg>
              : <Square size={10} />}
          </WinBtn>
          <WinBtn onClick={close} title="Cerrar" hover="hover:bg-red-500/80"><X size={12} /></WinBtn>
        </div>
      )}
    </div>
  );
}

function WinBtn({ children, onClick, title, hover = '' }) {
  return (
    <button onClick={onClick} title={title}
      className={`flex items-center justify-center w-11 h-9 text-white/40 hover:text-white transition-all duration-100 ${hover}`}>
      {children}
    </button>
  );
}

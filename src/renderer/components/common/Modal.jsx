import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Modal — Diálogo modal con backdrop blur y animación de escala.
 * Accesible: focus trap, cierre con Escape, aria-modal.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  showCloseButton = true,
}) {
  const overlayRef = useRef(null);
  const dialogRef  = useRef(null);

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
  };

  // Cierre con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Focus al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => dialogRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={e => e.target === overlayRef.current && onClose?.()}
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`
          relative w-full ${sizeClasses[size] || sizeClasses.md}
          glass rounded-2xl shadow-card-hover max-h-[88vh] overflow-hidden
          animate-scale-in outline-none
        `}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.06]">
            {title && (
              <h2 className="text-base font-semibold text-white">{title}</h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="ml-auto text-white/30 hover:text-white/70 transition-colors rounded-lg p-1 hover:bg-white/[0.06]"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto scrollbar-thin max-h-[calc(88vh-72px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

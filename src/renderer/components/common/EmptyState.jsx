import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * EmptyState — bloque unificado para estados vacíos / de carga en paneles y listas.
 * Mantiene un mismo lenguaje visual (ícono, título, descripción) en toda la app.
 */
export default function EmptyState({ icon: Icon, title, description, loading = false, compact = false }) {
  return (
    <div className={`flex flex-col items-center text-center gap-2 ${compact ? 'py-8' : 'py-14'} text-white/30`}>
      {loading ? (
        <Loader2 size={Icon ? 28 : 22} className="animate-spin opacity-40" />
      ) : Icon ? (
        <Icon size={28} className="opacity-30" />
      ) : null}
      {title && <p className="text-sm text-white/40">{title}</p>}
      {description && (
        <p className="text-[11px] text-white/22 max-w-[260px] leading-relaxed">{description}</p>
      )}
    </div>
  );
}

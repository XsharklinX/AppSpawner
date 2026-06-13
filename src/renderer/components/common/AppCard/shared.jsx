import React from 'react';
import { Check, Star } from 'lucide-react';

/** Checkbox de selección compartido entre las variantes de densidad */
export function SelectionCheckbox({ selectionMode, selected, onToggle }) {
  if (!selectionMode) return null;
  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-center w-5 h-5 rounded-md border transition-all flex-shrink-0 ${
        selected ? 'bg-violet-600 border-violet-500 text-white' : 'border-fg/20 text-transparent hover:border-violet-400/50'
      }`}
    >
      <Check size={12} />
    </button>
  );
}

/** Estrella de favorito mostrada junto al nombre de la app */
export function FavoriteBadge({ favorite, size = 10 }) {
  if (!favorite) return null;
  return <Star size={size} className="text-amber-400" fill="currentColor" />;
}

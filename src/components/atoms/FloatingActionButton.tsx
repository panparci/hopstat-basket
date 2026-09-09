import React from 'react';
import { Plus } from 'lucide-react';

export const FloatingActionButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="fixed bottom-20 right-6 bg-brand-orange text-[#1A1A1A] p-4 rounded-full shadow-[0_8px_30px_rgba(255,193,7,0.3)] hover:scale-105 transition-transform z-40"
    >
      <Plus size={28} strokeWidth={2.5} />
    </button>
  );
};

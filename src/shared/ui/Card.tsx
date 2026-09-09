import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm transition-all p-6 ${className} ${onClick ? 'cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700' : ''}`}
    >
      {children}
    </div>
  );
};

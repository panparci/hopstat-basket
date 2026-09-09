import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full space-y-1">
      {label && (
        <label className="block text-xs font-black uppercase tracking-widest text-zinc-500">
          {label}
        </label>
      )}
      <input 
        className={`w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange focus:border-transparent transition-all dark:text-white placeholder:text-zinc-400 ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs font-bold text-red-500 uppercase tracking-tight">
          {error}
        </p>
      )}
    </div>
  );
};

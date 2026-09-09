import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-black uppercase tracking-widest transition-transform focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 duration-100 cursor-pointer';
  
  const variants = {
    primary: 'bg-brand-orange text-white shadow-sm hover:bg-brand-orange/90',
    secondary: 'bg-transparent border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
    ghost: 'bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-md'
  };

  const sizes = {
    sm: 'text-xs px-4 py-2 rounded-xl',
    md: 'text-sm px-6 py-3 rounded-2xl',
    lg: 'text-base px-8 py-4 rounded-[1.5rem]'
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

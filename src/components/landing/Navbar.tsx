import React, { useState } from 'react';
import { Trophy, Menu, X, Sun, Moon } from 'lucide-react';
import { Button } from '../atoms/Button';

interface NavbarProps {
  onLoginClick: () => void;
  onSignupClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onLoginClick, onSignupClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const navLinks = [
    { name: 'Fitur', href: '#features' },
    { name: 'Harga', href: '#pricing' },
    { name: 'FAQ', href: '#faq' },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-zinc-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="bg-brand-navy dark:bg-brand-orange p-1.5 rounded-lg text-white dark:text-brand-navy flex items-center justify-center shadow-sm">
              <Trophy size={18} className="stroke-[2.5]" />
            </div>
            <span className="font-display text-xl font-extrabold tracking-wider text-brand-navy dark:text-white uppercase italic">
              Hoop<span className="text-brand-orange">Stats</span>
            </span>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-semibold text-zinc-600 hover:text-brand-navy dark:text-zinc-300 dark:hover:text-brand-orange transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white rounded-lg transition-colors mr-1"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Button variant="ghost" size="sm" onClick={onLoginClick}>
              Masuk
            </Button>
            <Button variant="primary" size="sm" className="bg-brand-navy text-white dark:bg-brand-orange dark:text-brand-navy" onClick={onSignupClick}>
              Coba Gratis
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white rounded-lg transition-colors mr-1"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:outline-none"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu dropdown */}
      {isOpen && (
        <div className="md:hidden border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-4 space-y-3 animate-in fade-in slide-in-from-top-5 duration-200">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="px-3 py-2 text-base font-bold text-zinc-600 hover:text-brand-navy dark:text-zinc-300 dark:hover:text-brand-orange rounded-lg transition-colors"
              >
                {link.name}
              </a>
            ))}
            <hr className="border-zinc-100 dark:border-zinc-800 my-1" />
            <div className="flex flex-col gap-2 pt-1">
              <Button variant="ghost" size="md" className="w-full justify-center" onClick={() => { setIsOpen(false); onLoginClick(); }}>
                Masuk
              </Button>
              <Button variant="primary" size="md" className="w-full justify-center bg-brand-navy text-white dark:bg-brand-orange dark:text-brand-navy" onClick={() => { setIsOpen(false); onSignupClick(); }}>
                Coba Gratis
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

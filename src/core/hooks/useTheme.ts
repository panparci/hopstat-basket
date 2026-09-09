import { useState, useEffect } from 'react';

const KEY = 'hoopstat_theme';

function readTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem(KEY) || localStorage.getItem('theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(KEY, theme);
}

export const useTheme = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(readTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const sync = () => setTheme(readTheme());
    window.addEventListener('hoopstat-theme', sync);
    return () => window.removeEventListener('hoopstat-theme', sync);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    setTheme(next);
    window.dispatchEvent(new Event('hoopstat-theme'));
  };

  return { theme, toggleTheme };
};

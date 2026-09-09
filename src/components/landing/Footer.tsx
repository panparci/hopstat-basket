import React from 'react';
import { Trophy } from 'lucide-react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    { name: 'Tentang Kami', href: '#' },
    { name: 'Fitur', href: '#features' },
    { name: 'Harga', href: '#pricing' },
    { name: 'FAQ', href: '#faq' },
    { name: 'Kontak', href: '#' }
  ];

  return (
    <footer className="bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="bg-brand-navy dark:bg-brand-orange p-1.5 rounded-lg text-white dark:text-brand-navy flex items-center justify-center">
              <Trophy size={16} className="stroke-[2.5]" />
            </div>
            <span className="font-display text-lg font-extrabold tracking-wider text-brand-navy dark:text-white uppercase italic">
              Hoop<span className="text-brand-orange">Stats</span>
            </span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-xs font-semibold text-zinc-500 hover:text-brand-navy dark:text-zinc-400 dark:hover:text-brand-orange transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Copyright text */}
          <div className="text-zinc-400 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
            &copy; {currentYear} HoopStats. Hak Cipta Dilindungi.
          </div>

        </div>
      </div>
    </footer>
  );
};

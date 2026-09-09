import React from 'react';

import { Check, Palette } from 'lucide-react';

interface ColorPickerProps {
  color: string;
  theme: 'gelap' | 'terang';
  name: string;
  onChange: (color: string, theme: 'gelap' | 'terang', name: string) => void;
  label?: string;
}

const COLOR_GROUPS = [
  {
    name: 'Classic',
    colors: [
      { name: 'Navy', value: 'var(--color-brand-navy)', theme: 'gelap' as const },
      { name: 'Biru', value: '#1e40af', theme: 'gelap' as const },
      { name: 'Langit', value: '#0ea5e9', theme: 'terang' as const },
      { name: 'Hijau Tua', value: '#064e3b', theme: 'gelap' as const },
      { name: 'Hijau', value: '#10b981', theme: 'terang' as const },
      { name: 'Marun', value: '#7f1d1d', theme: 'gelap' as const },
      { name: 'Merah', value: '#ef4444', theme: 'gelap' as const },
      { name: 'Oranye', value: '#f97316', theme: 'terang' as const },
    ]
  },
  {
    name: 'Vibrant',
    colors: [
      { name: 'Emas', value: 'var(--color-brand-orange)', theme: 'terang' as const },
      { name: 'Kuning', value: '#facc15', theme: 'terang' as const },
      { name: 'Ungu', value: '#7e22ce', theme: 'gelap' as const },
      { name: 'Indigo', value: '#4338ca', theme: 'gelap' as const },
      { name: 'Pink', value: '#ec4899', theme: 'terang' as const },
      { name: 'Tosca', value: '#0d9488', theme: 'gelap' as const },
      { name: 'Lime', value: '#84cc16', theme: 'terang' as const },
      { name: 'Cyan', value: '#06b6d4', theme: 'terang' as const },
    ]
  },
  {
    name: 'Neutral',
    colors: [
      { name: 'Hitam', value: '#18181b', theme: 'gelap' as const },
      { name: 'Abu Tua', value: '#3f3f46', theme: 'gelap' as const },
      { name: 'Abu', value: '#71717a', theme: 'terang' as const },
      { name: 'Perak', value: '#d4d4d8', theme: 'terang' as const },
      { name: 'Putih', value: '#ffffff', theme: 'terang' as const },
      { name: 'Putih Tulang', value: '#f8fafc', theme: 'terang' as const },
      { name: 'Krem', value: '#f5f5dc', theme: 'terang' as const },
      { name: 'Slate', value: '#475569', theme: 'gelap' as const },
    ]
  }
];

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, theme, name, onChange, label }) => {
  const [customColor, setCustomColor] = React.useState(color);

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    // Auto-detect theme based on brightness
    const r = parseInt(newColor.slice(1, 3), 16);
    const g = parseInt(newColor.slice(3, 5), 16);
    const b = parseInt(newColor.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const newTheme = brightness > 128 ? 'terang' : 'gelap';
    onChange(newColor, newTheme, name);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        {label && <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{label}</label>}
        <div className="flex items-center gap-2">
          <div 
            className="px-2 h-6 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-black uppercase tracking-tighter gap-1"
            style={{ backgroundColor: color, color: theme === 'gelap' ? '#fff' : '#000' }}
          >
            {theme === 'gelap' ? 'GELAP' : 'TERANG'}
          </div>
        </div>
      </div>
      
      <div className="space-y-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
        <div className="flex flex-col gap-2 mb-2">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Nama Warna (untuk Voice)</label>
          <input 
            type="text"
            value={name}
            onChange={(e) => onChange(color, theme, e.target.value)}
            className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-bold text-[#1A1A1A] dark:text-white"
            placeholder="Contoh: Kuning, Emas, Putih..."
          />
        </div>

        {COLOR_GROUPS.map((group) => (
          <div key={group.name} className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{group.name}</h4>
            <div className="grid grid-cols-8 gap-2">
              {group.colors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onChange(c.value, c.theme, c.name)}
                  className={`aspect-square rounded-lg transition-all flex items-center justify-center relative group ${
                    color === c.value 
                      ? 'ring-2 ring-offset-2 ring-brand-navy dark:ring-brand-orange dark:ring-offset-zinc-900 scale-105' 
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                >
                  {color === c.value && (
                    <Check size={14} className={c.theme === 'gelap' ? 'text-white' : 'text-black'} />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative">
                <input
                  type="color"
                  value={customColor}
                  onChange={handleCustomColorChange}
                  className="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent"
                />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <Palette size={16} className="text-zinc-400 mix-blend-difference" />
                </div>
              </div>
              <input
                type="text"
                value={customColor.toUpperCase()}
                onChange={(e) => handleCustomColorChange(e as any)}
                className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-200"
                placeholder="#000000"
              />
            </div>

            <div className="flex bg-zinc-200 dark:bg-zinc-800 rounded-lg p-1 shrink-0">
              <button
                type="button"
                onClick={() => onChange(color, 'terang', name)}
                className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${
                  theme === 'terang'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                Terang
              </button>
              <button
                type="button"
                onClick={() => onChange(color, 'gelap', name)}
                className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${
                  theme === 'gelap'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                Gelap
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

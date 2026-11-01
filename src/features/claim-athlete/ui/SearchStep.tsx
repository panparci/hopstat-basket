import React from 'react';
import { User, Users, AlertCircle, Search, Hash } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { motion } from 'motion/react';

const KU_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

interface SearchStepProps {
  searchName: string;
  setSearchName: (val: string) => void;
  searchKU: number;
  setSearchKU: (val: number) => void;
  searchClub: string;
  setSearchClub: (val: string) => void;
  searchError: string;
  searching: boolean;
  onSearch: (e: React.FormEvent) => void;
}

export const SearchStep: React.FC<SearchStepProps> = ({
  searchName,
  setSearchName,
  searchKU,
  setSearchKU,
  searchClub,
  setSearchClub,
  searchError,
  searching,
  onSearch,
}) => {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <form onSubmit={onSearch} className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
        <p className="text-xs text-zinc-500 leading-relaxed">
          Statistik laga sering tanpa tanggal lahir. Cari dengan nama, klub/tim, dan KU kalender Indonesia
          (tahun laga − tahun lahir). Anak yang lebih muda boleh muncul sebagai playing up. Tanggal lahir lengkap diisi saat verifikasi dokumen.
        </p>

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Nama Atlet <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"><User size={18} /></span>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Contoh: Budi Santoso atau M. Rizky"
              className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl pl-12 pr-4 py-3.5 text-sm border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-brand-navy dark:focus:border-brand-orange transition-colors"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Kelompok Umur (KU) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"><Hash size={18} /></span>
            <select
              value={searchKU}
              onChange={(e) => setSearchKU(Number(e.target.value))}
              className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl pl-12 pr-4 py-3.5 text-sm border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-brand-navy dark:focus:border-brand-orange transition-colors appearance-none"
            >
              {KU_OPTIONS.map((k) => (
                <option key={k} value={k}>KU-{k}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Klub atau Tim Asal <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"><Users size={18} /></span>
            <input
              type="text"
              value={searchClub}
              onChange={(e) => setSearchClub(e.target.value)}
              placeholder="Contoh: Menteng Falcons"
              className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl pl-12 pr-4 py-3.5 text-sm border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-brand-navy dark:focus:border-brand-orange transition-colors"
              required
            />
          </div>
        </div>

        {searchError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2 border border-red-200 dark:border-red-900/30">
            <AlertCircle size={14} className="shrink-0" />
            <span className="font-semibold">{searchError}</span>
          </div>
        )}

        <Button type="submit" className="w-full rounded-2xl py-4 flex items-center justify-center gap-2" disabled={searching}>
          {searching ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Search size={16} />
              Cari Profil Atlet
            </>
          )}
        </Button>
      </form>
    </motion.div>
  );
};

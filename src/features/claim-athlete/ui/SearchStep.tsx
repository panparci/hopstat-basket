import React from 'react';
import { User, Calendar, Users, AlertCircle, Search } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { motion } from 'motion/react';

interface SearchStepProps {
  searchName: string;
  setSearchName: (val: string) => void;
  searchDob: string;
  setSearchDob: (val: string) => void;
  searchClub: string;
  setSearchClub: (val: string) => void;
  searchError: string;
  searching: boolean;
  onSearch: (e: React.FormEvent) => void;
}

export const SearchStep: React.FC<SearchStepProps> = ({
  searchName,
  setSearchName,
  searchDob,
  setSearchDob,
  searchClub,
  setSearchClub,
  searchError,
  searching,
  onSearch
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <form onSubmit={onSearch} className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Nama Lengkap Atlet <span className="text-red-500">*</span></label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"><User size={18} /></span>
            <input 
              type="text" 
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl pl-12 pr-4 py-3.5 text-sm border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-brand-navy dark:focus:border-brand-orange transition-colors"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Tanggal Lahir Atlet <span className="text-red-500">*</span></label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"><Calendar size={18} /></span>
            <input 
              type="date" 
              value={searchDob}
              onChange={(e) => setSearchDob(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl pl-12 pr-4 py-3.5 text-sm border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-brand-navy dark:focus:border-brand-orange transition-colors"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Klub atau Tim Asal <span className="text-red-500">*</span></label>
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
          <p className="text-[10px] text-zinc-400 mt-1 pl-1">
            Masukkan nama klub, tim sekolah, atau tim liga pembinaan atlet secara lengkap.
          </p>
        </div>

        {searchError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2 border border-red-200 dark:border-red-900/30">
            <AlertCircle size={14} className="shrink-0" />
            <span className="font-semibold">{searchError}</span>
          </div>
        )}

        <Button 
          type="submit" 
          className="w-full rounded-2xl py-4 flex items-center justify-center gap-2"
          disabled={searching}
        >
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

import React from 'react';
import { Activity, Target, Shield, Hand } from 'lucide-react';
import { BaseModal } from '../atoms/BaseModal';

interface PlayerStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: any;
  stats: any;
}

export const PlayerStatsModal: React.FC<PlayerStatsModalProps> = ({ isOpen, onClose, player, stats }) => {
  if (!player || !stats) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Statistik Pemain"
      maxWidth="max-w-md"
    >
      <div className="flex items-center gap-4 mb-6 -mt-4">
        <div className="w-16 h-16 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-full flex items-center justify-center font-display font-black text-2xl italic flex-shrink-0">
          {player.jersey || '-'}
        </div>
        <div>
          <h2 className="text-2xl font-display font-black italic uppercase tracking-tight leading-none text-[#1A1A1A] dark:text-white">
            {player.name}
          </h2>
          {player.displayName && (
            <p className="text-sm font-bold text-brand-navy dark:text-brand-orange uppercase tracking-widest mt-1 italic">
              "{player.displayName}"
            </p>
          )}
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mt-1">
            {player.position || 'Pemain'} • {player.teamName || 'Global'}{player.isGuest && ' • Tamu'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <Target size={14} className="text-brand-navy dark:text-brand-orange" />
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Points</span>
          </div>
          <p className="text-3xl font-display font-black italic text-[#1A1A1A] dark:text-white">{stats.pts}</p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={14} className="text-brand-navy dark:text-brand-orange" />
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Rebounds</span>
          </div>
          <p className="text-3xl font-display font-black italic text-[#1A1A1A] dark:text-white">{stats.reb}</p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <Hand size={14} className="text-brand-navy dark:text-brand-orange" />
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Assists</span>
          </div>
          <p className="text-3xl font-display font-black italic text-[#1A1A1A] dark:text-white">{stats.ast}</p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} className="text-brand-navy dark:text-brand-orange" />
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Steals</span>
          </div>
          <p className="text-3xl font-display font-black italic text-[#1A1A1A] dark:text-white">{stats.stl}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wide mb-2">Shooting</h3>
        
        <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Field Goals (2PT)</span>
          <span className="font-mono font-bold text-sm text-[#1A1A1A] dark:text-white">{stats.fgm}/{stats.fga} ({stats.fga > 0 ? Math.round((stats.fgm/stats.fga)*100) : 0}%)</span>
        </div>
        
        <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">3 Pointers</span>
          <span className="font-mono font-bold text-sm text-[#1A1A1A] dark:text-white">{stats.tpm}/{stats.tpa} ({stats.tpa > 0 ? Math.round((stats.tpm/stats.tpa)*100) : 0}%)</span>
        </div>
        
        <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Free Throws</span>
          <span className="font-mono font-bold text-sm text-[#1A1A1A] dark:text-white">{stats.ftm}/{stats.fta} ({stats.fta > 0 ? Math.round((stats.ftm/stats.fta)*100) : 0}%)</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Blocks</span>
          <span className="font-mono font-bold text-sm text-[#1A1A1A] dark:text-white">{stats.blk}</span>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Turnovers</span>
          <span className="font-mono font-bold text-sm text-[#1A1A1A] dark:text-white">{stats.to}</span>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center col-span-2">
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Fouls</span>
          <span className="font-mono font-bold text-sm text-[#1A1A1A] dark:text-white">{stats.fouls}</span>
        </div>
      </div>
    </BaseModal>
  );
};

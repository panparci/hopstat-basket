import React from 'react';
import { Card } from '../atoms/Card';
import { User } from 'lucide-react';
import { Avatar } from '../../shared/ui/Avatar';

interface PlayerCardProps {
  name: string;
  displayName?: string;
  team?: string;
  position?: string;
  subtitle?: string;
  jersey?: string;
  photoUrl?: string;
  avatar?: string;
  ovr?: number;
  archetype?: string;
  stats?: {
    gamesPlayed: number;
    pts: number;
    reb: number;
    ast: number;
  };
  variant?: 'light' | 'dark';
  onClick?: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  name,
  displayName,
  team,
  position,
  subtitle,
  jersey = '?',
  photoUrl,
  avatar,
  ovr = 65,
  archetype = 'All-Around Threat',
  stats,
  variant = 'light',
  onClick,
  actions,
  children
}) => {
  const finalPhoto = photoUrl || avatar;
  const showName = displayName || name;

  if (variant === 'dark') {
    return (
      <Card
        onClick={onClick}
        className={`bg-[#0B1E36] dark:bg-[#0B1E36] border border-zinc-800/50 p-6 rounded-3xl text-white relative overflow-hidden shadow-lg select-none group hover:scale-[1.01] transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      >
        {/* Basketball Vector Accent in top right */}
        <div className="absolute top-4 right-4 opacity-80 pointer-events-none">
          <svg className="w-9 h-9 text-brand-orange fill-brand-orange" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" />
            <path d="M6.2 6.2 C 9.5 9.5, 9.5 14.5, 6.2 17.8" fill="none" />
            <path d="M17.8 6.2 C 14.5 9.5, 14.5 14.5, 17.8 17.8" fill="none" />
            <path d="M2 12 H 22" fill="none" />
            <path d="M12 2 V 22" fill="none" />
          </svg>
        </div>

        <div className="flex flex-col gap-5 relative z-10">
          {/* Avatar / Photo Container */}
          <div className="flex items-center justify-center">
            <div className="shadow-inner relative">
              <Avatar name={name} photoUrl={finalPhoto} size="xl" className="border-2 border-slate-700/80" />
            </div>
          </div>

          {/* Name, Archetype & OVR */}
          <div className="flex justify-between items-end gap-3 pt-2">
            <div className="flex-1">
              <h2 className="font-display text-2xl font-black uppercase leading-tight tracking-tight text-brand-orange mb-1 line-clamp-2">
                {showName}
              </h2>
              <div 
                className="text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.15em] cursor-help"
                title="Gaya Bermain: Klasifikasi peran pemain berdasarkan statistik performa dominan. Skor eksperimental HoopStats, bukan rating resmi"
              >
                {archetype}
              </div>
            </div>

            {/* OVR BADGE */}
            <div 
              className="w-14 h-14 rounded-full border-2 border-brand-orange text-brand-orange flex flex-col items-center justify-center font-display font-black leading-none shrink-0 cursor-help shadow-lg shadow-black/10 bg-[#081524]"
              title="Overall Rating (OVR): Estimasi nilai kemampuan keseluruhan pemain (skala 40-99). Skor eksperimental HoopStats, bukan rating resmi"
            >
              <span className="text-[9px] text-slate-400 font-bold tracking-wider">OVR</span>
              <span className="text-xl font-extrabold">{ovr}</span>
            </div>
          </div>

          {/* Stats Bar (GP, PTS, REB, AST) */}
          {stats ? (
            <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-800/60 text-center">
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block tracking-wider mb-0.5">GP</span>
                <span className="font-extrabold text-base text-white">{stats.gamesPlayed}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block tracking-wider mb-0.5">PTS</span>
                <span className="font-extrabold text-base text-brand-orange">{stats.pts.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block tracking-wider mb-0.5">REB</span>
                <span className="font-extrabold text-base text-brand-orange">{stats.reb.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] font-bold uppercase block tracking-wider mb-0.5">AST</span>
                <span className="font-extrabold text-base text-brand-orange">{stats.ast.toFixed(1)}</span>
              </div>
            </div>
          ) : (
            children && <div className="w-full">{children}</div>
          )}
        </div>
      </Card>
    );
  }

  // Fallback to light / standard card
  return (
    <Card
      onClick={onClick}
      className={`p-5 flex flex-col relative overflow-hidden group gap-4 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 shadow-sm ${onClick ? 'cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4">
          {/* Circular avatar placeholder / initials */}
          <div className="group-hover:scale-105 transition-transform z-10 relative shrink-0">
            <Avatar name={name} photoUrl={finalPhoto} size="lg" className="border border-brand-orange/30 shadow-md" />
          </div>
          <div className="z-10 relative">
            <h2 className="font-display font-black italic text-2xl text-[#1A1A1A] dark:text-white uppercase leading-none mb-1">
              {showName}
            </h2>
            {(team || position || subtitle) && (
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-bold tracking-widest uppercase flex-wrap">
                {team && <span className="text-brand-orange">{team}</span>}
                {team && position && <span>•</span>}
                {position && <span>{position}</span>}
                {(team || position) && subtitle && <span>•</span>}
                {subtitle && <span>{subtitle}</span>}
              </div>
            )}
          </div>
        </div>

        {actions && (
          <div className="z-10 relative flex items-center gap-1 ml-4" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>

      {children && (
        <div className="z-10 relative w-full">
          {children}
        </div>
      )}

      {/* Decorative vector */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 dark:bg-zinc-800/50 rounded-full -mr-10 -mt-10 transition-colors group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800"></div>
    </Card>
  );
};

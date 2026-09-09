import React from 'react';
import { Match, Possession } from '../../core/types/stats';

interface PossessionIndicatorProps {
  match: Match;
  activePossession: Partial<Possession> | null;
  onToggle: () => void;
  activeTeam?: 'home' | 'away';
}

export const PossessionIndicator: React.FC<PossessionIndicatorProps> = ({
  match,
  activePossession,
  onToggle,
  activeTeam
}) => {
  const possessionTeam = activePossession?.teamInPossession || activeTeam;
  
  if (!possessionTeam) return null;

  const teamName = possessionTeam === 'home' 
    ? (match.ourTeamName || 'Home') 
    : (match.theirTeamName || 'Away');
  const teamColor = possessionTeam === 'home' ? match.ourColor : match.theirColor;

  return (
    <button 
      onClick={onToggle}
      className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors group"
      title="Klik untuk ganti possession (Jumpball)"
    >
      <div 
        className="w-1.5 h-1.5 rounded-full animate-pulse" 
        style={{ backgroundColor: teamColor }}
      />
      <span className="text-xs font-black uppercase tracking-tighter text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
        Possession: {teamName}
      </span>
    </button>
  );
};

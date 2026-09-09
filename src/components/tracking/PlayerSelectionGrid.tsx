import React from 'react';
import { Users, Clock, AlertCircle, Sparkles } from 'lucide-react';
import { Match, Player, Possession } from '../../core/types/stats';
import { PossessionIndicator } from './PossessionIndicator';
import { OpponentActions } from '../organisms/OpponentActions';
import { ActionContent } from '../organisms/ActionContent';
import { getContrastTextColor } from '../../core/utils/colorUtils';

interface PlayerSelectionGridGridProps {
  match: Match;
  activeTeam: 'home' | 'away';
  setActiveTeam: (team: 'home' | 'away') => void;
  activePlayerId: string | null;
  setActivePlayerId: (id: string | null) => void;
  currentRoster: Player[];
  isGameStarted: boolean;
  setShowStarterModal: (show: boolean) => void;
  setShowSubModal: (show: boolean) => void;
  logEvent: (type: any, points?: number, overridePlayerId?: string) => void;
  activePossession?: Partial<Possession> | null;
  onTogglePossession: () => void;
  triggerHeldBall?: () => void;
  gameState?: any;
  onToggleTimer?: () => void;
  onOpenAILineupModal?: () => void;
}

export const PlayerSelectionGrid: React.FC<PlayerSelectionGridGridProps> = ({
  match,
  activeTeam,
  setActiveTeam,
  activePlayerId,
  setActivePlayerId,
  currentRoster,
  isGameStarted,
  setShowStarterModal,
  setShowSubModal,
  logEvent,
  activePossession,
  onTogglePossession,
  triggerHeldBall,
  gameState,
  onToggleTimer,
  onOpenAILineupModal
}) => {
  const possessionTeam = activePossession?.teamInPossession;
  const possessionPlayerId = activePossession?.openingPlayerId;

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4 gap-2 w-full">
        {/* Left Side: Roster AI button */}
        <div className="w-24 sm:w-28 shrink-0 flex justify-start">
          {onOpenAILineupModal && (
            <button
              type="button"
              onClick={onOpenAILineupModal}
              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] sm:text-[11px] font-black uppercase px-2.5 py-2 rounded-full transition-all flex items-center gap-1 active:scale-95 cursor-pointer whitespace-nowrap shadow-sm"
              title="Deteksi No Punggung & Roster Bench Pemain AI dari Video"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
              <span>Roster AI</span>
            </button>
          )}
        </div>

        {/* Center: Team Selector */}
        <div className="flex-1 flex justify-center">
          {match.recordingType !== 'single' && (
            <div className="flex bg-zinc-100/80 dark:bg-zinc-900/60 backdrop-blur-sm rounded-full p-1 border border-zinc-200/80 dark:border-zinc-800/80 shadow-inner items-center gap-1">
              {/* HOME TOGGLE */}
              <button 
                onClick={() => { setActiveTeam('home'); setActivePlayerId(null); }}
                className={`relative px-5 py-2.5 rounded-full text-xs font-black uppercase transition-all duration-300 flex flex-col items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95 ${
                  activeTeam === 'home' 
                    ? 'shadow-md' 
                    : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300'
                }`}
                style={{
                  backgroundColor: activeTeam === 'home' ? match.ourColor : undefined,
                  color: activeTeam === 'home' ? getContrastTextColor(match.ourColor) : undefined
                }}
              >
                <span className="tracking-widest">
                  Home
                </span>
                
                {/* Possession LED Strip Indicator */}
                <div className="relative w-12 h-[5px] rounded-full bg-zinc-200 dark:bg-zinc-950 border border-zinc-300/40 dark:border-zinc-800/40 flex items-center justify-center p-[1px] transition-all duration-300">
                  <div 
                    className={`h-full w-full rounded-full transition-all duration-500 ${
                      possessionTeam === 'home' ? 'opacity-100 scale-100 animate-pulse' : 'opacity-20 scale-95'
                    }`}
                    style={{
                      backgroundColor: possessionTeam === 'home' ? '#39FF14' : '#143109',
                      boxShadow: possessionTeam === 'home' ? '0 0 14px #39FF14, 0 0 6px #39FF14, 0 0 2px #39FF14' : 'none'
                    }}
                  />
                </div>
              </button>

              {/* AWAY TOGGLE */}
              <button 
                onClick={() => { setActiveTeam('away'); setActivePlayerId(null); }}
                className={`relative px-5 py-2.5 rounded-full text-xs font-black uppercase transition-all duration-300 flex flex-col items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95 ${
                  activeTeam === 'away' 
                    ? 'shadow-md' 
                    : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300'
                }`}
                style={{
                  backgroundColor: activeTeam === 'away' ? match.theirColor : undefined,
                  color: activeTeam === 'away' ? getContrastTextColor(match.theirColor) : undefined
                }}
              >
                <span className="tracking-widest">
                  Away
                </span>
                
                {/* Possession LED Strip Indicator */}
                <div className="relative w-12 h-[5px] rounded-full bg-zinc-200 dark:bg-zinc-950 border border-zinc-300/40 dark:border-zinc-800/40 flex items-center justify-center p-[1px] transition-all duration-300">
                  <div 
                    className={`h-full w-full rounded-full transition-all duration-500 ${
                      possessionTeam === 'away' ? 'opacity-100 scale-100 animate-pulse' : 'opacity-20 scale-95'
                    }`}
                    style={{
                      backgroundColor: possessionTeam === 'away' ? '#39FF14' : '#143109',
                      boxShadow: possessionTeam === 'away' ? '0 0 14px #39FF14, 0 0 6px #39FF14, 0 0 2px #39FF14' : 'none'
                    }}
                  />
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Start Clock button, sized to fit the selector height */}
        <div className="w-24 sm:w-28 shrink-0 flex justify-end">
          {match.clockMode === 'stop' && gameState && !gameState.isRunning && gameState.timeRemaining > 0 && onToggleTimer && (
            <button
              onClick={onToggleTimer}
              className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wider text-[10px] sm:text-[11px] px-3 py-2.5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1 border border-red-500 animate-pulse cursor-pointer whitespace-nowrap"
            >
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping shrink-0" />
              Start Clock
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-start gap-4 mt-2">
        {match.recordingType === 'team' && activeTeam === 'away' ? (
          <div className="grid grid-cols-1 gap-2 sm:gap-3">
            <button 
              onClick={() => setActivePlayerId('away_team')}
              className={`relative overflow-hidden aspect-[4/3] rounded-2xl border transition-all flex flex-col items-center justify-center group bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 ${
                 activePlayerId === 'away_team' 
                   ? 'bg-zinc-200 dark:bg-zinc-700 shadow-md ring-2 ring-zinc-400 dark:ring-zinc-500' 
                   : ''
               }`}
            >
              <Users className="w-8 h-8 mb-2 opacity-50" />
              <span className="font-bold text-sm tracking-wider uppercase">
                {match.theirTeamName || 'Opponent Team'}
              </span>
            </button>
            {isGameStarted && (
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2">
                <button 
                  onClick={() => logEvent('timeout', 0, undefined)}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 hover:text-amber-600 dark:hover:text-amber-500 hover:border-amber-600/50 transition-colors"
                >
                  <Clock size={20} className="mb-1 sm:mb-2" />
                  <span className="text-xs sm:text-xs font-bold uppercase">Timeout</span>
                </button>
                <button 
                  onClick={() => triggerHeldBall ? triggerHeldBall() : logEvent('held_ball', 0, undefined)}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 hover:text-brand-navy dark:hover:text-brand-orange hover:border-brand-navy/50 transition-colors"
                >
                  <AlertCircle size={20} className="mb-1 sm:mb-2" />
                  <span className="text-xs sm:text-xs font-bold uppercase whitespace-nowrap">Held Ball</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {currentRoster.filter(p => p.isActive).map(player => {
              const teamColor = activeTeam === 'home' ? match.ourColor : match.theirColor;
              const textColor = getContrastTextColor(teamColor);
              const hasPossession = possessionPlayerId === player.id;

              return (
                <button 
                  key={player.id}
                  onClick={() => setActivePlayerId(player.id)}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all relative overflow-hidden select-none ${
                    activePlayerId === player.id 
                      ? 'bg-zinc-100 dark:bg-zinc-800/60 shadow-md border-zinc-400 dark:border-zinc-500' 
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:shadow-sm'
                  }`}
                  style={{ 
                    borderColor: activePlayerId === player.id ? teamColor : undefined
                  }}
                >
                  {/* Possession LED Strip */}
                  {hasPossession && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#39ff14] shadow-[0_0_8px_#39ff14,0_0_15px_#39ff14] animate-pulse z-10" />
                  )}

                  {player.isPlaceholder && (
                    <span className="absolute top-1 right-1 bg-yellow-500 text-white text-xs font-bold px-1 py-0.5 rounded-full uppercase tracking-wider z-20">
                      Temp
                    </span>
                  )}

                  {player.isGuest && (
                    <span className="absolute top-1 left-1 bg-brand-orange text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider z-20">
                      Tamu
                    </span>
                  )}
                  <div 
                    className="w-14 h-14 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-display font-black italic text-3xl sm:text-4xl mb-0.5 shadow-sm active:scale-95 transition-transform mt-1.5"
                    style={{ backgroundColor: teamColor, color: textColor }}
                  >
                    {player.jersey}
                  </div>
                  <span className="text-xs sm:text-sm font-black truncate w-full text-center uppercase tracking-tight text-[#1A1A1A] dark:text-white px-0.5">
                    {player.displayName || player.name}
                  </span>
                </button>
              );
            })}
            
            {currentRoster.filter(p => p.isActive).length === 0 ? (
              <button 
                onClick={() => setShowStarterModal(true)}
                className="col-span-3 flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-brand-navy dark:border-brand-orange bg-blue-50 dark:bg-blue-900/10 text-brand-navy dark:text-brand-orange hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Users size={20} />
                </div>
                <span className="text-sm font-black italic uppercase tracking-wider">Get Starters</span>
                <span className="text-xs font-bold opacity-60 mt-0.5">Pilih 5 pemain awal untuk memulai</span>
              </button>
            ) : (
              <>
                {!isGameStarted ? (
                  <button 
                    onClick={() => setShowStarterModal(true)}
                    className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 hover:text-brand-navy dark:hover:text-brand-orange hover:border-brand-navy/50 dark:hover:border-brand-orange/50 transition-colors"
                  >
                    <Users size={20} className="mb-0.5" />
                    <span className="text-xs font-black uppercase">Revise</span>
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => setShowSubModal(true)}
                      className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 hover:text-brand-navy dark:hover:text-brand-orange hover:border-brand-navy/50 dark:hover:border-brand-orange/50 transition-colors"
                    >
                      <Users size={20} className="mb-0.5" />
                      <span className="text-xs font-black uppercase">Sub</span>
                    </button>
                    <button 
                      onClick={() => logEvent('timeout', 0, undefined)}
                      className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 hover:text-amber-600 dark:hover:text-amber-500 hover:border-amber-600/50 transition-colors"
                    >
                      <Clock size={20} className="mb-0.5" />
                      <span className="text-xs font-black uppercase">Timeout</span>
                    </button>
                    <button 
                      onClick={() => triggerHeldBall ? triggerHeldBall() : logEvent('held_ball', 0, undefined)}
                      className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 hover:text-brand-navy dark:hover:text-brand-orange hover:border-brand-navy/50 transition-colors"
                    >
                      <AlertCircle size={20} className="mb-0.5" />
                      <span className="text-xs sm:text-xs font-black uppercase whitespace-nowrap">Held Ball</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Opponent Score Quick Actions (Only for Team Mode when not on away tab) */}
      {match.recordingType === 'team' && activeTeam === 'home' && (
        <OpponentActions onLogEvent={logEvent} />
      )}
    </div>
  );
};

import React, { useEffect } from 'react';
import { X, Edit2 } from 'lucide-react';
import { EventType, Player, Match, MatchRoster } from '../../core/types/stats';
import { ActionContent } from './ActionContent';

interface ActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  onLogEvent: (
    type: EventType,
    points?: number,
    playerId?: string,
    x?: number,
    y?: number,
    skipSmartPrompt?: boolean,
    subType?: string,
    customTimestamp?: number,
    customQuarter?: number,
    customYoutubeTimestamp?: number,
    metadata?: any,
  ) => void;
  onEditPlayer?: () => void;
  sidePanel?: boolean;
  match?: Match | null;
  matchRosters?: MatchRoster[];
  gameState?: any;
  currentYoutubeTime?: number;
}

export const ActionDrawer: React.FC<ActionDrawerProps> = ({
  isOpen,
  onClose,
  player,
  onLogEvent,
  onEditPlayer,
  sidePanel = false,
  match,
  matchRosters,
  gameState,
  currentYoutubeTime,
}) => {
  useEffect(() => {
    if (isOpen && player) {
      window.dispatchEvent(new CustomEvent('pause-youtube'));
    }
  }, [isOpen, player?.id]);

  if (!isOpen || !player) return null;

  return (
    <div className={`${sidePanel ? 'absolute' : 'fixed'} inset-0 lg:left-auto lg:w-[400px] xl:w-[450px] z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200`} onClick={onClose}>
      <div 
        className="bg-white dark:bg-zinc-900 rounded-t-3xl w-full max-w-md mx-auto overflow-hidden shadow-2xl border-t border-zinc-200 dark:border-zinc-800 flex flex-col animate-in slide-in-from-bottom duration-300 max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy flex items-center justify-center font-display font-black italic text-xl">
              {player.jersey}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-[#1A1A1A] dark:text-white uppercase leading-tight">{player.displayName || player.name}</h2>
                {player.isPlaceholder && (
                  <span className="bg-yellow-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    Temp
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 font-bold tracking-wider uppercase">Record Action</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEditPlayer && (
              <button onClick={onEditPlayer} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-brand-navy dark:hover:text-brand-orange transition-colors">
                <Edit2 size={18} />
              </button>
            )}
            <button onClick={onClose} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-[#1A1A1A] dark:hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="p-4 pb-safe overflow-y-auto">
          <ActionContent
            onLogEvent={onLogEvent}
            isOpen={isOpen}
            match={match}
            matchRosters={matchRosters}
            player={player}
            gameState={gameState}
            currentYoutubeTime={currentYoutubeTime}
          />
        </div>
      </div>
    </div>
  );
};



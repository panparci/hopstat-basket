import React from 'react';
import { Target } from 'lucide-react';
import { EventType } from '../../core/types/stats';

interface OpponentActionsProps {
  onLogEvent: (type: EventType, points: number, playerId?: string) => void;
}

export const OpponentActions: React.FC<OpponentActionsProps> = ({ onLogEvent }) => {
  return (
    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-1">
          <Target size={10} /> Statistik Lawan
        </h3>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <button 
          onClick={() => onLogEvent('1pt_make', 1, 'opp')}
          className="py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-lg font-bold text-xs active:scale-95 transition-all"
        >
          +1
        </button>
        <button 
          onClick={() => onLogEvent('2pt_make', 2, 'opp')}
          className="py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-lg font-bold text-xs active:scale-95 transition-all"
        >
          +2
        </button>
        <button 
          onClick={() => onLogEvent('3pt_make', 3, 'opp')}
          className="py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-lg font-bold text-xs active:scale-95 transition-all"
        >
          +3
        </button>
        <button 
          onClick={() => onLogEvent('defensive_foul', 0, 'opp')}
          className="py-2.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50 rounded-lg font-bold text-xs active:scale-95 transition-all"
        >
          FOUL
        </button>
        <button 
          onClick={() => onLogEvent('foul_drawn', 0, 'opp')}
          className="py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 rounded-lg font-bold text-xs active:scale-95 transition-all"
        >
          FOUL DRAWN
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mt-1.5">
        <button 
          onClick={() => onLogEvent('1pt_miss', 0, 'opp')}
          className="py-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg font-bold text-xs active:scale-95 transition-all"
        >
          MISS FT
        </button>
        <button 
          onClick={() => onLogEvent('2pt_miss', 0, 'opp')}
          className="py-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg font-bold text-xs active:scale-95 transition-all"
        >
          MISS 2
        </button>
        <button 
          onClick={() => onLogEvent('3pt_miss', 0, 'opp')}
          className="py-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg font-bold text-xs active:scale-95 transition-all"
        >
          MISS 3
        </button>
        <button 
          onClick={() => onLogEvent('to', 0, 'opp')}
          className="py-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg font-bold text-xs active:scale-95 transition-all"
        >
          TO
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mt-1.5">
        <button 
          onClick={() => onLogEvent('oreb', 0, 'opp')}
          className="py-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg font-bold text-xs active:scale-95 transition-all"
        >
          O-REB
        </button>
        <button 
          onClick={() => onLogEvent('dreb', 0, 'opp')}
          className="py-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg font-bold text-xs active:scale-95 transition-all"
        >
          D-REB
        </button>
        <button 
          onClick={() => onLogEvent('ast', 0, 'opp')}
          className="py-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg font-bold text-xs active:scale-95 transition-all"
        >
          AST
        </button>
        <button 
          onClick={() => onLogEvent('stl', 0, 'opp')}
          className="py-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg font-bold text-xs active:scale-95 transition-all"
        >
          STL
        </button>
      </div>
    </div>
  );
};

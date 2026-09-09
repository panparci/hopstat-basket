import React from 'react';
import { Target, XCircle, ArrowUpCircle, Shield, Handshake, Hand, Ban, Flag } from 'lucide-react';
import { EventType, Match } from '../../core/types/stats';

interface ActionPanelProps {
  match: Match;
  logEvent: (type: EventType, points?: number, overridePlayerId?: string) => void;
  setPendingTurnover: (event: any) => void;
  activePlayerId: string | null;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ match, logEvent, setPendingTurnover, activePlayerId }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors shrink-0">
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button onClick={() => logEvent('2pt_make', 2)} className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 p-3 rounded-xl font-bold text-sm hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <Target size={20} /> +2 POINTS
        </button>
        <button onClick={() => logEvent('3pt_make', 3)} className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 p-3 rounded-xl font-bold text-sm hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <Target size={20} /> +3 POINTS
        </button>
      </div>
      
      <div className="grid grid-cols-3 gap-2 mb-2">
        <button onClick={() => logEvent('1pt_make', 1)} className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 p-2 rounded-xl font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <Target size={16} /> FT MAKE
        </button>
        <button onClick={() => logEvent('2pt_miss', 0)} className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 p-2 rounded-xl font-bold text-xs hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <XCircle size={16} /> 2PT MISS
        </button>
        <button onClick={() => logEvent('3pt_miss', 0)} className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 p-2 rounded-xl font-bold text-xs hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <XCircle size={16} /> 3PT MISS
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-2">
        <button onClick={() => logEvent('ast', 0)} className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 p-2 rounded-xl font-bold text-xs hover:bg-blue-100 dark:hover:bg-blue-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <Handshake size={14} /> AST
        </button>
        <button onClick={() => logEvent('oreb', 0)} className="bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 p-2 rounded-xl font-bold text-xs hover:bg-cyan-100 dark:hover:bg-cyan-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <ArrowUpCircle size={14} /> OREB
        </button>
        <button onClick={() => logEvent('dreb', 0)} className="bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20 p-2 rounded-xl font-bold text-xs hover:bg-teal-100 dark:hover:bg-teal-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <Shield size={14} /> DREB
        </button>
        <button onClick={() => logEvent('stl', 0)} className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 p-2 rounded-xl font-bold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <Hand size={14} /> STL
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <button onClick={() => logEvent('blk', 0)} className="bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 p-2 rounded-xl font-bold text-xs hover:bg-purple-100 dark:hover:bg-purple-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <Ban size={14} /> BLK
        </button>
        <button onClick={() => setPendingTurnover({ type: 'to', playerId: activePlayerId })} className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 p-2 rounded-xl font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <XCircle size={14} /> TO
        </button>
        <button onClick={() => logEvent('1pt_miss', 0)} className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 p-2 rounded-xl font-bold text-xs hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <XCircle size={14} /> FT MISS
        </button>
      </div>
      
      <div className="flex gap-2 mt-1.5">
        <button onClick={() => logEvent('defensive_foul', 0)} className="flex-1 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 p-2 rounded-xl font-bold text-xs hover:bg-orange-100 dark:hover:bg-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5">
          <Flag size={14} /> FOUL
        </button>
        <div className="flex bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50 p-1">
          <button onClick={() => logEvent('2pt_make', 2, 'opp')} className="px-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-red-500 transition-colors">OPP +2</button>
          <div className="w-px bg-zinc-300 dark:bg-zinc-700 my-1"></div>
          <button onClick={() => logEvent('3pt_make', 3, 'opp')} className="px-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-red-500 transition-colors">OPP +3</button>
          <div className="w-px bg-zinc-300 dark:bg-zinc-700 my-1"></div>
          <button onClick={() => logEvent('defensive_foul', 0, 'opp')} className="px-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-red-500 transition-colors">OPP FOUL</button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { ArrowLeft, Settings, Sun, Moon, List, TrendingUp, Mic } from 'lucide-react';
import { Match, GameState } from '../../core/types/stats';

interface TrackingHeaderProps {
  match: Match;
  gameState: GameState | null;
  theme: string;
  isReloading: boolean;
  showLogs: boolean;
  onBack: () => void;
  onFinish: () => void;
  onShowEditMatch: () => void;
  onShowStatsDashboard: () => void;
  onToggleTheme: () => void;
  onToggleLogs: () => void;
  onToggleRecordingMode: () => void;
}

export const TrackingHeader: React.FC<TrackingHeaderProps> = ({
  match,
  gameState,
  theme,
  isReloading,
  showLogs,
  onBack,
  onFinish,
  onShowEditMatch,
  onShowStatsDashboard,
  onToggleTheme,
  onToggleLogs,
  onToggleRecordingMode
}) => {
  return (
    <header className="flex items-center justify-between p-2 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 shrink-0 transition-colors">
      <div className="flex items-center gap-2">
        <button 
          onClick={onBack} 
          className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-display font-black italic uppercase leading-none">{match.name}</h1>
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest leading-tight mt-0.5">{match.venue || 'Unknown Location'}</p>
        </div>
      </div>
      <div className="flex gap-1 items-center">
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-full mr-2 border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => match.recordingMode !== 'lite' && onToggleRecordingMode()}
            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
              match.recordingMode === 'lite' 
                ? 'bg-white dark:bg-zinc-700 text-brand-navy dark:text-brand-orange shadow-sm' 
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            Lite
          </button>
          <button
            onClick={() => match.recordingMode !== 'detailed' && onToggleRecordingMode()}
            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
              match.recordingMode === 'detailed' 
                ? 'bg-white dark:bg-zinc-700 text-brand-navy dark:text-brand-orange shadow-sm' 
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            Detailed
          </button>
        </div>

        {match.status !== 'completed' && (
          <button 
            onClick={onFinish}
            className="px-3 py-1 bg-green-500 text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-green-600 transition-colors mr-2"
          >
            Finish
          </button>
        )}
        <button onClick={onShowStatsDashboard} className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-emerald-600 dark:text-emerald-400" title="Live Stats Dashboard">
          <TrendingUp size={18} />
        </button>
        <button onClick={onShowEditMatch} className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-500" title="Konfigurasi Match">
          <Settings size={18} />
        </button>
        <button onClick={onToggleTheme} className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          {theme === 'dark' ? <Sun size={18} className="text-zinc-400" /> : <Moon size={18} className="text-brand-navy" />}
        </button>
        <button onClick={onToggleLogs} className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-brand-navy dark:text-brand-orange transition-colors">
          <List size={18} />
        </button>
      </div>
    </header>
  );
};

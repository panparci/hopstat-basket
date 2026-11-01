import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Settings, Sun, Moon, List, TrendingUp, MoreHorizontal } from 'lucide-react';
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

/**
 * Live-track chrome: keep back + title + Finish (and mode) in reach.
 * Theme / logs / stats / edit are rare mid-game → one overflow on narrow screens.
 * Desktop keeps the full strip so the original layout stays familiar there.
 */
export const TrackingHeader: React.FC<TrackingHeaderProps> = ({
  match,
  theme,
  showLogs,
  onBack,
  onFinish,
  onShowEditMatch,
  onShowStatsDashboard,
  onToggleTheme,
  onToggleLogs,
  onToggleRecordingMode,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  const modeToggle = (
    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-full border border-zinc-200 dark:border-zinc-700 shrink-0">
      <button
        type="button"
        onClick={() => match.recordingMode !== 'lite' && onToggleRecordingMode()}
        className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all ${
          match.recordingMode === 'lite'
            ? 'bg-white dark:bg-zinc-700 text-brand-navy dark:text-brand-orange shadow-sm'
            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
        }`}
      >
        Lite
      </button>
      <button
        type="button"
        onClick={() => match.recordingMode !== 'detailed' && onToggleRecordingMode()}
        className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all ${
          match.recordingMode === 'detailed'
            ? 'bg-white dark:bg-zinc-700 text-brand-navy dark:text-brand-orange shadow-sm'
            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
        }`}
      >
        Detailed
      </button>
    </div>
  );

  const iconBtn =
    'p-2 min-w-[40px] min-h-[40px] flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors';

  return (
    <header className="pt-safe flex items-center justify-between gap-2 px-2 pb-2 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 shrink-0 transition-colors max-w-[100vw] overflow-x-hidden">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali"
          className={iconBtn}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-display font-black italic uppercase leading-none truncate">
            {match.name}
          </h1>
          <p className="text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest leading-tight mt-0.5 truncate">
            {match.venue || 'Unknown Location'}
          </p>
        </div>
      </div>

      <div className="flex gap-1.5 items-center shrink-0">
        {/* Mode + Finish stay visible — used at start / end of the business flow */}
        {modeToggle}

        {match.status !== 'completed' && (
          <button
            type="button"
            onClick={onFinish}
            className="px-3 py-2 min-h-[40px] bg-green-500 text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-full hover:bg-green-600 transition-colors"
          >
            Finish
          </button>
        )}

        {/* Desktop: original full strip */}
        <div className="hidden md:flex gap-1 items-center">
          <button type="button" onClick={onShowStatsDashboard} className={`${iconBtn} text-emerald-600 dark:text-emerald-400`} title="Live Stats Dashboard">
            <TrendingUp size={18} />
          </button>
          <button type="button" onClick={onShowEditMatch} className={`${iconBtn} text-zinc-500`} title="Konfigurasi Match">
            <Settings size={18} />
          </button>
          <button type="button" onClick={onToggleTheme} className={iconBtn} title="Tema">
            {theme === 'dark' ? <Sun size={18} className="text-zinc-400" /> : <Moon size={18} className="text-brand-navy" />}
          </button>
          <button type="button" onClick={onToggleLogs} className={`${iconBtn} text-brand-navy dark:text-brand-orange`} title="Event log">
            <List size={18} />
          </button>
        </div>

        {/* Mobile/tablet: one overflow for rarely tapped tools */}
        <div className="relative md:hidden" ref={moreRef}>
          <button
            type="button"
            aria-label="Alat lainnya"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className={`${iconBtn} ${moreOpen ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}
          >
            <MoreHorizontal size={18} />
          </button>
          {moreOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-1.5 space-y-0.5">
                <button
                  type="button"
                  onClick={() => { onShowStatsDashboard(); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
                >
                  <TrendingUp size={14} className="text-emerald-500" /> Live Stats
                </button>
                <button
                  type="button"
                  onClick={() => { onShowEditMatch(); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
                >
                  <Settings size={14} /> Konfigurasi Match
                </button>
                <button
                  type="button"
                  onClick={() => { onToggleTheme(); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
                >
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} Tema
                </button>
                <button
                  type="button"
                  onClick={() => { onToggleLogs(); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
                >
                  <List size={14} /> {showLogs ? 'Tutup Event Log' : 'Event Log'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import { Play, Pause, RotateCcw, FastForward, AlertTriangle, TrendingUp, ChevronLeft, ChevronRight, Dribbble } from 'lucide-react';
import { getContrastTextColor } from '../../core/utils/colorUtils';
import { Match, Possession } from '../../core/types/stats';

interface ScoreboardProps {
  homeScore: number;
  awayScore: number;
  homeFouls?: number;
  awayFouls?: number;
  homeTimeouts?: number;
  awayTimeouts?: number;
  homeLabel?: string;
  awayLabel?: string;
  quarter: number;
  totalPeriods?: number;
  clockMode?: 'stop' | 'running';
  timeRemaining: number;
  isRunning: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onNextQuarter: () => void;
  onPrevQuarter?: () => void;
  onShowStats?: () => void;
  onClockClick?: () => void;
  onHomeTimeout?: () => void;
  onAwayTimeout?: () => void;
  ourColor?: string;
  theirColor?: string;
  ourTheme?: 'gelap' | 'terang';
  theirTheme?: 'gelap' | 'terang';
  activePossession?: any;
  activeTeam?: 'home' | 'away';
  onTogglePossession?: () => void;
  match?: any;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({
  homeScore,
  awayScore,
  homeFouls = 0,
  awayFouls = 0,
  homeTimeouts = 0,
  awayTimeouts = 0,
  homeLabel = 'KITA',
  awayLabel = 'LAWAN',
  quarter,
  totalPeriods,
  clockMode,
  timeRemaining,
  isRunning,
  onToggleTimer,
  onResetTimer,
  onNextQuarter,
  onPrevQuarter,
  onShowStats,
  onClockClick,
  onHomeTimeout,
  onAwayTimeout,
  ourColor = 'var(--color-brand-navy)',
  theirColor = '#E11D48',
  ourTheme = 'gelap',
  theirTheme = 'gelap',
  activePossession,
  activeTeam,
  onTogglePossession,
  match
}) => {
  const [confirmAction, setConfirmAction] = useState<'reset' | 'nextQuarter' | 'prevQuarter' | null>(null);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isHomePossession = (activePossession?.teamInPossession || activeTeam) === 'home';
  const isAwayPossession = (activePossession?.teamInPossession || activeTeam) === 'away';

  const handleConfirm = () => {
    if (confirmAction === 'reset') onResetTimer();
    if (confirmAction === 'nextQuarter') onNextQuarter();
    if (confirmAction === 'prevQuarter' && onPrevQuarter) onPrevQuarter();
    setConfirmAction(null);
  };

  const getTextColor = (hexColor?: string) => {
    return getContrastTextColor(hexColor);
  };

  const getScoreTextColor = (hexColor?: string) => {
    return getContrastTextColor(hexColor);
  };

  return (
    <>
      <div className="bg-[#1A1A1A] rounded-3xl pt-4 px-3.5 pb-4 sm:pt-4 sm:px-4 sm:pb-5 mb-4 shadow-xl border border-zinc-800 relative font-sans select-none">
        
        {/* Background glow effects */}
        <div 
          className="absolute -top-10 -left-10 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-30"
          style={{ backgroundColor: ourColor }}
        ></div>
        <div 
          className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ backgroundColor: theirColor }}
        ></div>

        <div className="flex justify-between items-center relative z-10">
          <div className="text-center flex-1 min-w-0 flex flex-col items-center">
            <div className="text-xs text-zinc-400 font-extrabold tracking-wider uppercase mb-1 w-full truncate px-1">{homeLabel}</div>
            <div className="relative w-full px-1">
              <div 
                className={`relative text-4xl sm:text-5xl font-display font-black italic rounded-2xl py-1.5 px-8 sm:px-10 w-full shadow-inner leading-none truncate flex items-center justify-center min-h-[3.5rem]`}
                style={{ backgroundColor: ourColor, color: getScoreTextColor(ourColor) }}
              >
                <span>{homeScore}</span>
                {match && onTogglePossession && isHomePossession && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePossession();
                    }}
                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 text-amber-500 animate-pulse drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] cursor-pointer hover:scale-110 transition-transform hover:text-amber-400" 
                    title="Possession: Home"
                  >
                    <Dribbble size={20} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-center justify-center px-1 sm:px-3 shrink-0 min-w-[110px]">
            <div className="text-xs text-zinc-400 font-bold tracking-widest uppercase mb-1 flex items-center gap-1.5 justify-center">
              {onPrevQuarter && (
                <button 
                  onClick={() => setConfirmAction('prevQuarter')}
                  className="p-1 hover:text-white transition-colors"
                  disabled={quarter <= 1}
                >
                  <ChevronLeft size={14} />
                </button>
              )}
              <div className="flex items-center gap-1.5 bg-zinc-900/60 px-2 py-0.5 rounded-full border border-zinc-800/80">
                <div className={`w-2 h-2 rounded-full ${clockMode === 'stop' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span>Q{quarter}{totalPeriods ? `/${totalPeriods}` : ''}</span>
              </div>
              <button 
                onClick={() => setConfirmAction('nextQuarter')}
                className="p-1 hover:text-white transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            
            <div className="flex items-center justify-center gap-2">
              <div 
                className={`text-3xl sm:text-4xl font-mono font-bold text-white tracking-wider drop-shadow-md whitespace-nowrap ${onClockClick ? 'cursor-pointer hover:text-amber-400 transition-colors' : ''}`}
                onClick={onClockClick}
              >
                {formatTime(timeRemaining)}
              </div>
              <button 
                onClick={onToggleTimer}
                className={`p-2 rounded-full backdrop-blur-md border ${isRunning ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-zinc-800/50 border-zinc-700/50 text-white'} transition-all active:scale-95 shadow-sm`}
              >
                {isRunning ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current" />}
              </button>
            </div>
          </div>

          <div className="text-center flex-1 min-w-0 flex flex-col items-center relative">
            <div className="text-xs text-zinc-400 font-extrabold tracking-wider uppercase mb-1 w-full truncate px-1">{awayLabel}</div>
            <div className="relative w-full px-1">
              <div 
                className={`relative text-4xl sm:text-5xl font-display font-black italic rounded-2xl py-1.5 px-8 sm:px-10 w-full shadow-inner leading-none truncate flex items-center justify-center min-h-[3.5rem]`}
                style={{ backgroundColor: theirColor, color: getScoreTextColor(theirColor) }}
              >
                {match && onTogglePossession && isAwayPossession && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePossession();
                    }}
                    className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 text-amber-500 animate-pulse drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] cursor-pointer hover:scale-110 transition-transform hover:text-amber-400" 
                    title="Possession: Away"
                  >
                    <Dribbble size={20} strokeWidth={2.5} />
                  </button>
                )}
                <span>{awayScore}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="flex justify-between items-center w-full bg-zinc-900/60 rounded-xl px-2 py-1.5 border border-zinc-800/80 mt-3 relative z-10">
          <div className="flex items-center gap-1 sm:gap-2 text-xs font-bold text-zinc-400 truncate">
            <span className="shrink-0">F:<span className="text-red-400">{homeFouls}</span></span>
            <span className="text-zinc-600 font-black">·</span>
            {onHomeTimeout ? (
              <button onClick={onHomeTimeout} className="flex items-center hover:text-amber-400 transition-colors shrink-0">
                <span>TO:<span className="text-amber-400">{homeTimeouts}</span></span>
              </button>
            ) : (
              <span className="shrink-0">TO:{homeTimeouts}</span>
            )}
          </div>

          <div className="flex items-center justify-center gap-1 sm:gap-2 px-1">
            <button 
              onClick={() => setConfirmAction('reset')}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-all active:scale-95"
              title="Reset Timer"
            >
              <RotateCcw size={14} />
            </button>
            <button 
              onClick={() => setConfirmAction('nextQuarter')}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-all active:scale-95"
              title="Next Quarter"
            >
              <FastForward size={14} />
            </button>
            {onShowStats && (
              <button 
                onClick={onShowStats}
                className="p-1.5 rounded-full text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 transition-all active:scale-95"
                title="Live Stats"
              >
                <TrendingUp size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 text-xs font-bold text-zinc-400 truncate justify-end">
            {onAwayTimeout ? (
              <button onClick={onAwayTimeout} className="flex items-center hover:text-amber-400 transition-colors shrink-0">
                <span>TO:<span className="text-amber-400">{awayTimeouts}</span></span>
              </button>
            ) : (
              <span className="shrink-0">TO:{awayTimeouts}</span>
            )}
            <span className="text-zinc-600 font-black">·</span>
            <span className="shrink-0">F:<span className="text-red-400">{awayFouls}</span></span>
          </div>
        </div>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-2">
                <AlertTriangle size={32} />
              </div>
              <h3 className="font-display font-black italic text-xl uppercase text-[#1A1A1A] dark:text-white">
                {confirmAction === 'reset' ? 'Reset Waktu?' : confirmAction === 'prevQuarter' ? 'Balik Quarter?' : 'Lanjut Quarter?'}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {confirmAction === 'reset' 
                  ? 'Apakah Anda yakin ingin mengulang waktu ke awal quarter?' 
                  : confirmAction === 'prevQuarter'
                    ? 'Apakah Anda yakin ingin kembali ke quarter sebelumnya? Data yang sudah ada tidak akan dihapus.'
                    : 'Apakah Anda yakin ingin mengakhiri quarter ini dan lanjut ke quarter berikutnya?'}
              </p>
            </div>
            <div className="flex border-t border-zinc-100 dark:border-zinc-800">
              <button 
                onClick={() => setConfirmAction(null)}
                className="flex-1 p-4 font-bold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                BATAL
              </button>
              <div className="w-px bg-zinc-100 dark:bg-zinc-800"></div>
              <button 
                onClick={handleConfirm}
                className="flex-1 p-4 font-bold text-brand-orange hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                YAKIN
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

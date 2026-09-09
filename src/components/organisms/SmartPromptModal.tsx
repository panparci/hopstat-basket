import React, { useEffect, useState } from 'react';
import { Player, GameEvent, Match, MatchRoster } from '../../core/types/stats';
import { RotateCcw, History, Maximize2, Zap, HelpCircle } from 'lucide-react';
import * as Icons from 'lucide-react';
import { BaseModal } from '../atoms/BaseModal';
import { useEventEnrichmentVideo } from '../../hooks/useEventEnrichmentVideo';

import { BasketballCourtPicker } from '../common/BasketballCourtPicker';

interface PlayerGroup {
  title: string;
  players: Player[];
  team?: 'home' | 'away' | 'neutral';
  color?: string;
  theme?: string;
  layout?: 'grid' | 'large-buttons' | 'compact-list' | 'grid-compact';
  type?: 'location';
  allowedArea?: '2pt' | '3pt' | 'any';
  value?: { x: number, y: number };
  isSecondaryGroup?: boolean;
  isOptionalGroup?: boolean;
  actionId?: string;
  fieldId?: string;
}

interface SmartPromptModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  groups: PlayerGroup[];
  onSelectPlayer: (playerId: string, meta?: any) => void;
  onConfirm?: () => void;
  isConfirmDisabled?: boolean;
  onSkip?: () => void;
  onClose?: () => void;
  confirmLabel?: string;
  skipText?: string;
  type?: string;
  recentEvents?: GameEvent[];
  youtubeTimestamp?: number;
  isPanel?: boolean;
  match?: Match | null;
  matchRosters?: MatchRoster[];
  missedPossessionTeamName?: string;
}

export const SmartPromptModal: React.FC<SmartPromptModalProps> = ({
  isOpen,
  title,
  description,
  groups,
  onSelectPlayer,
  onConfirm,
  isConfirmDisabled,
  onSkip,
  onClose,
  confirmLabel = 'Lanjutkan',
  skipText = 'Lewati',
  type,
  recentEvents = [],
  youtubeTimestamp,
  isPanel,
  match,
  matchRosters = [],
  missedPossessionTeamName
}) => {
  const [loopDuration, setLoopDuration] = useState(5);
  const [showRecent, setShowRecent] = useState(false);
  const [peekOffset, setPeekOffset] = useState(0);

  const isFreeThrowPrompt = type === 'freethrow' || type === 'next_freethrow' || type === 'ft_miss_eval';

  useEventEnrichmentVideo({
    isOpen,
    youtubeTimestamp,
    expandVideo: loopDuration === 10,
    peekOffset,
    returnToOriginalTime: isFreeThrowPrompt
  });

  const isAnomaly = type === 'missing_event' || youtubeTimestamp !== undefined;

  const homeTeamId = match?.teamId || 'home_team';
  const homeLabel = match?.ourHomeAway === 'away' ? (match?.theirTeamName || 'Lawan') : (match?.ourTeamName || 'Kita');
  const awayLabel = match?.ourHomeAway === 'away' ? (match?.ourTeamName || 'Kita') : (match?.theirTeamName || 'Lawan');

  const formatEventType = (typeStr: string) => {
    switch (typeStr) {
      case '2pt_make': return '2PT Masuk';
      case '3pt_make': return '3PT Masuk';
      case '2pt_miss': return '2PT Meleset';
      case '3pt_miss': return '3PT Meleset';
      case '1pt_make': return 'FT Masuk';
      case '1pt_miss': return 'FT Meleset';
      case 'to': return 'Turnover';
      case 'foul': return 'Foul';
      case 'offensive_foul': return 'Off. Foul';
      case 'defensive_foul': return 'Def. Foul';
      case 'stl': return 'Steal';
      case 'dreb': return 'Def. Rebound';
      case 'oreb': return 'Off. Rebound';
      case 'blk': return 'Block';
      case 'ast': return 'Assist';
      case 'timeout': return 'Timeout';
      case 'sub_in': return 'Sub In';
      case 'sub_out': return 'Sub Out';
      default: return typeStr.replace(/_/g, ' ');
    }
  };

  const content = (
    <div className="flex flex-col h-full">
      {isAnomaly && (
        <div className={`bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 ${type === 'missing_event' ? 'p-2 mb-2 rounded-xl' : 'p-2.5 mb-3 rounded-xl'} shrink-0 shadow-sm text-xs`}>
          {/* Looping Control */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
              <RotateCcw size={11} className="animate-spin-slow text-amber-500" />
              Looping ({loopDuration}s)
            </div>
            
            <div className="flex items-center gap-1.5">
              {isFreeThrowPrompt && (
                <button 
                  onClick={() => setPeekOffset(prev => prev + 5)}
                  className="flex items-center gap-1 px-2.5 py-0.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-xs font-black uppercase tracking-tight transition-colors"
                  title="Maju 5 Detik / Peek Video Lanjutan"
                >
                  <Icons.FastForward size={8} />
                  Maju 5s
                </button>
              )}
              
              <button 
                onClick={() => setLoopDuration(loopDuration === 5 ? 10 : 5)}
                className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-xs font-black uppercase tracking-tight transition-colors"
                id="toggle-loop-duration"
              >
                <Maximize2 size={8} />
                {loopDuration === 5 ? '10s' : '5s'}
              </button>

              {type === 'missing_event' && (
                <button
                  onClick={() => setShowRecent(!showRecent)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-tight transition-colors ${
                    showRecent 
                      ? 'bg-amber-600 text-white shadow-sm' 
                      : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-750 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                  }`}
                  id="toggle-recent-activity"
                >
                  <History size={8} />
                  {showRecent ? 'Tutup' : 'Histori'}
                </button>
              )}
            </div>
          </div>
          
          {type === 'missing_event' && showRecent && (
            <div className="space-y-1 mt-1.5 pt-1.5 border-t border-amber-500/10">
              <div className="bg-white/40 dark:bg-black/10 rounded-lg p-1 max-h-24 overflow-y-auto border border-zinc-200/50 dark:border-zinc-850">
                {recentEvents.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic text-center py-1">Tidak ada kejadian terbaru</p>
                ) : (
                  [...recentEvents].slice(-3).reverse().map((event) => {
                    const eventIsHome = matchRosters?.some(r => r.teamId === homeTeamId && r.profileId === event.playerId) || event.playerId === 'home_team' || event.possession === 'home';
                    const eventTeamLabel = eventIsHome ? homeLabel : awayLabel;
                    const player = matchRosters?.find(r => r.profileId === event.playerId);

                    return (
                      <div key={event.id} className="flex items-center gap-1.5 text-xs py-0.5 px-1 border-b border-zinc-100 dark:border-zinc-800/30 last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded leading-tight">
                        <span className={`px-1 py-0.2 rounded text-xs font-black uppercase tracking-wider shrink-0 ${
                          eventIsHome 
                            ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300' 
                            : 'bg-red-500/10 text-red-600 dark:bg-red-400/20 dark:text-red-300'
                        }`}>
                          {eventTeamLabel}
                        </span>
                        {player ? (
                          <span className="text-zinc-600 dark:text-zinc-300 font-bold truncate max-w-[80px]">
                            #{player.jerseyNumber} {player.name.split(' ')[0]}
                          </span>
                        ) : (
                          <span className="text-zinc-500 dark:text-zinc-400 font-medium truncate italic max-w-[80px]">
                            {event.playerId === 'opp' || event.playerId === 'away_team' ? awayLabel : homeLabel}
                          </span>
                        )}
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium ml-0.5 truncate">
                          {formatEventType(event.type)}
                        </span>
                        {event.points !== undefined && event.points > 0 && (
                          <span className="text-emerald-500 font-bold text-xs bg-emerald-500/10 px-1 rounded-sm leading-none shrink-0 font-sans">+{event.points}</span>
                        )}
                        <span className="ml-auto text-zinc-400 dark:text-zinc-500 font-mono text-xs tracking-tight shrink-0">
                          {Math.floor(event.timestamp / 60)}:{(event.timestamp % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {type === 'missing_event' && missedPossessionTeamName && (
        <div className="bg-red-500/8 dark:bg-red-400/8 border border-red-500/20 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-left gap-2 shadow-sm mb-2">
          <div className="flex items-center gap-2 truncate">
            <div className="w-6 h-6 rounded-lg bg-red-500/10 dark:bg-red-400/15 flex items-center justify-center text-red-500 shrink-0 leading-none">
              <Icons.AlertTriangle size={13} className="animate-pulse" />
            </div>
            <div className="truncate">
              <div className="text-xs font-black tracking-wider text-red-500 uppercase leading-none mb-0.5">POSSESSION TERLEWAT</div>
              <div className="text-xs font-black text-zinc-900 dark:text-white truncate">
                Milik: <span className="text-red-500 underline decoration-1 decoration-red-500/30">{missedPossessionTeamName}</span>
              </div>
            </div>
          </div>
          <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 italic max-w-[130px] leading-tight text-right shrink-0">
            Pilih kejadian penyelesai
          </div>
        </div>
      )}

      {description && type !== 'missing_event' && (
        <p className="text-sm text-zinc-500 mb-6 text-center whitespace-pre-line">
          {description}
        </p>
      )}

      <div className="space-y-4 flex-1">
        {groups.map((group, idx) => {
          const hasPlayers = group.players && group.players.length > 0;
          const isLocation = group.type === 'location';
          if (!hasPlayers && !isLocation) return null;

          const titleLower = group.title.toLowerCase();
          const isSideBySide = 
            group.layout === 'compact-list' && (
              titleLower.includes('block') || 
              titleLower.includes('foul on shot') || 
              titleLower.includes('other') ||
              group.fieldId === 'is_blocked' ||
              group.fieldId === 'foul_during'
            );

          if (isSideBySide) {
            return (
              <div 
                key={`group-${idx}-${group.title}`} 
                className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800/80 gap-4"
              >
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider select-none">
                  {group.title}
                </span>
                <div className="flex gap-1.5 shrink-0">
                  {group.players.map(player => {
                    const isSelected = (player as any).isSelected;
                    return (
                      <button
                        key={player.id}
                        onClick={() => onSelectPlayer(player.id, {
                          actionId: group.actionId,
                          fieldId: group.fieldId
                        })}
                        className={`py-1.5 px-3.5 rounded-lg border transition-all text-xs font-bold shadow-sm leading-tight h-8 flex items-center justify-center select-none ${
                          isSelected 
                            ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy border-transparent scale-105 shadow'
                            : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {player.displayName || player.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <div key={`group-${idx}-${group.title}`} className={type === 'missing_event' ? 'py-1' : 'py-2'}>
              {type !== 'missing_event' && (
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">{group.title}</h3>
              )}
              {group.type === 'location' ? (
                <BasketballCourtPicker 
                  allowedArea={group.allowedArea}
                  initialX={group.value?.x}
                  initialY={group.value?.y}
                  onLocationSelect={(x, y) => onSelectPlayer(`loc_${x}_${y}`, {
                    fieldId: group.fieldId,
                    x, y
                  })}
                />
              ) : group.layout === 'compact-list' ? (
                <div className={`${group.players.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} grid gap-1.5`}>
                  {group.players.map(player => {
                    const isSelected = (player as any).isSelected;
                    return (
                      <button
                        key={player.id}
                        onClick={() => onSelectPlayer(player.id, {
                          actionId: group.actionId,
                          fieldId: group.fieldId
                        })}
                        className={`w-full py-2 px-2 rounded-lg border transition-all flex items-center justify-center text-xs font-bold shadow-sm leading-tight text-center h-10 ${
                          isSelected 
                            ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy border-transparent'
                            : 'bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {player.displayName || player.name}
                      </button>
                    );
                  })}
                </div>
              ) : group.layout === 'grid-compact' ? (
                <div className="grid grid-cols-2 gap-2">
                  {group.players.map((player, idx) => {
                    const isSelected = (player as any).isSelected;
                    const IconComponent = (Icons as any)[player.jersey];
                    const isLastOdd = idx === group.players.length - 1 && group.players.length % 2 !== 0;

                    return (
                      <button
                        key={player.id}
                        onClick={() => onSelectPlayer(player.id, {
                          actionId: group.actionId,
                          fieldId: group.fieldId
                        })}
                        className={`${isLastOdd ? 'col-span-2' : ''} py-2.5 px-3 rounded-xl border transition-all flex items-center gap-2.5 justify-start text-sm font-black shadow-sm leading-tight group h-[52px] select-none ${
                          isSelected 
                            ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy border-transparent scale-[1.01] z-10 shadow-md font-black'
                            : 'bg-white dark:bg-zinc-850/90 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 active:scale-[0.98]'
                        }`}
                      >
                        <span className="text-sm flex items-center justify-center w-7 h-7 bg-zinc-100 dark:bg-zinc-800 rounded-lg group-hover:scale-105 transition-transform shrink-0">
                          {IconComponent ? <IconComponent size={14} /> : player.jersey}
                        </span>
                        <span className="truncate">{player.displayName || player.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : group.layout === 'large-buttons' ? (
                <div className="flex flex-col gap-3">
                  {group.players.map(player => {
                    const IconComponent = (Icons as any)[player.jersey];
                    const isSelected = (player as any).isSelected;

                    return (
                      <button
                        key={player.id}
                        onClick={() => onSelectPlayer(player.id, {
                          actionId: group.actionId,
                          fieldId: group.fieldId
                        })}
                        className={`w-full py-6 rounded-2xl border transition-all flex flex-col items-center justify-center group ${
                          isSelected 
                            ? (group.color ? 'shadow-lg ring-4 ring-offset-2 ring-zinc-900 dark:ring-zinc-100 scale-105 z-10' : 'bg-brand-orange text-white border-brand-orange shadow-lg shadow-orange-500/20 scale-105 z-10')
                            : (group.color ? 'opacity-50 hover:opacity-100 hover:scale-[1.02]' : (group.team === 'home' ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy border-transparent opacity-60 hover:opacity-100' : group.team === 'away' ? 'bg-red-600 dark:bg-red-500 text-white border-transparent opacity-60 hover:opacity-100' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 opacity-60 hover:opacity-100'))
                        }`}
                        style={
                          isSelected && group.color
                            ? { backgroundColor: group.color, borderColor: group.color, color: group.theme === 'terang' ? '#000' : '#fff' }
                            : (group.team === 'home' || group.team === 'away') && !isSelected && group.color
                            ? { backgroundColor: group.color, borderColor: 'transparent', color: group.theme === 'terang' ? '#000' : '#fff' }
                            : {}
                        }
                      >
                        <span className="text-4xl mb-2">
                          {IconComponent ? <IconComponent size={32} /> : player.jersey}
                        </span>
                        <span className="text-sm font-bold uppercase tracking-wider">{player.displayName || player.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {group.players.map(player => {
                    const isSelected = (player as any).isSelected;
                    let btnClass = "aspect-square rounded-xl border flex flex-col items-center justify-center p-1 transition-all active:scale-95 group ";
                    let inlineStyle: React.CSSProperties = {};
                    
                    if (isSelected) {
                       if (group.color) {
                         inlineStyle = { backgroundColor: group.color, borderColor: group.color, color: group.theme === 'terang' ? '#000' : '#fff' };
                         btnClass += " shadow-lg ring-4 ring-offset-2 ring-zinc-900 dark:ring-zinc-100 z-10 scale-105";
                       } else {
                         btnClass += "bg-brand-orange text-white border-brand-orange shadow-lg shadow-orange-500/20 z-10 scale-105";
                       }
                    } else if (group.team === 'home') {
                      if (group.color) {
                        inlineStyle = { backgroundColor: group.color, borderColor: 'transparent', color: group.theme === 'terang' ? '#000' : '#fff' };
                        btnClass += " opacity-50 hover:opacity-100 hover:scale-[1.02]";
                      } else {
                        btnClass += "bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy border-transparent opacity-60 hover:opacity-100";
                      }
                    } else if (group.team === 'away') {
                      if (group.color) {
                        inlineStyle = { backgroundColor: group.color, borderColor: 'transparent', color: group.theme === 'terang' ? '#000' : '#fff' };
                        btnClass += " opacity-50 hover:opacity-100 hover:scale-[1.02]";
                      } else {
                        btnClass += "bg-red-600 dark:bg-red-500 text-white border-transparent opacity-60 hover:opacity-100";
                      }
                    } else {
                      btnClass += "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 opacity-60 hover:opacity-100";
                    }

                    const IconComponent = (Icons as any)[player.jersey];

                    return (
                      <button
                        key={player.id}
                        onClick={() => onSelectPlayer(player.id, {
                          actionId: group.actionId,
                          fieldId: group.fieldId
                        })}
                        className={btnClass}
                        style={inlineStyle}
                      >
                        <span className="font-display font-black italic text-lg leading-none">
                          {IconComponent ? <IconComponent size={18} /> : player.jersey}
                        </span>
                        <span className="text-xs font-bold truncate w-full text-center mt-1 opacity-70 group-hover:opacity-100">
                          {player.id === 'opp' || player.id.startsWith('blk_') || player.id.startsWith('field_') 
                            ? (player.displayName || player.name) 
                            : (player.displayName || player.name).split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={`${type === 'missing_event' ? 'mt-3' : 'mt-8'} flex flex-col gap-2.5 shrink-0`}>
        {onConfirm && (
          <button
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] ${
              isConfirmDisabled 
                ? 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none' 
                : 'bg-brand-orange text-white hover:bg-[#e64a19] hover:shadow-brand-orange/10'
            }`}
          >
            <Zap className="w-4 h-4" />
            {confirmLabel}
          </button>
        )}
        
        <div className="flex gap-2">
          {onSkip && (
            <button
              onClick={onSkip}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700/80 flex items-center justify-center gap-1 active:scale-[0.98]"
            >
              <Icons.ChevronLeft className="w-3.5 h-3.5" />
              {skipText || 'Kembali'}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors border border-red-200/50 dark:border-red-500/20 flex items-center justify-center gap-1 active:scale-[0.98]"
            >
              <Icons.XCircle className="w-3.5 h-3.5" />
              Batal / Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (isPanel) return content;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose || onSkip || (() => {})}
      title={title}
      icon={<Zap className="text-brand-navy dark:text-brand-orange" size={20} />}
      sidePanel={true}
    >
      {content}
    </BaseModal>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { X, Target, Shield, Handshake, Hand, RefreshCcw, Save, Info, Maximize2, Minimize2, User } from 'lucide-react';
import { GameEvent, ShotDifficulty, AssistType, GameContext, PressureLevel, ReboundType, TurnoverType, Match, Player, MatchRoster } from '../../core/types/stats';
import { statsService } from '../../core/services/statsService';
import { getShotAreaName } from '../../core/utils/courtUtils';
import { BaseModal } from '../atoms/BaseModal';
import { useEventEnrichmentVideo } from '../../hooks/useEventEnrichmentVideo';

interface EventEnrichmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: GameEvent | null;
  onSuccess: (updatedEvent: GameEvent, next?: boolean) => void;
  match: Match;
  allPlayers: Player[];
  matchRosters: MatchRoster[];
  sidePanel?: boolean;
}

export const EventEnrichmentModal: React.FC<EventEnrichmentModalProps> = ({ 
  isOpen, 
  onClose, 
  event, 
  onSuccess, 
  match, 
  allPlayers, 
  matchRosters,
  sidePanel = false 
}) => {
  const [x, setX] = useState<number | undefined>(event?.x);
  const [y, setY] = useState<number | undefined>(event?.y);
  const [shotDifficulty, setShotDifficulty] = useState<ShotDifficulty | undefined>(event?.shotDifficulty);
  const [assistType, setAssistType] = useState<AssistType | undefined>(event?.assistType);
  const [gameContext, setGameContext] = useState<GameContext | undefined>(event?.gameContext);
  const [pressureLevel, setPressureLevel] = useState<PressureLevel | undefined>(event?.pressureLevel);
  const [reboundType, setReboundType] = useState<ReboundType | undefined>(event?.reboundType);
  const [turnoverType, setTurnoverType] = useState<TurnoverType | undefined>(event?.subType as TurnoverType);
  const [expandVideo, setExpandVideo] = useState(false);
  const [extraTime, setExtraTime] = useState(0);
  const [missReason, setMissReason] = useState<string | undefined>(event?.metadata?.missReason);
  const [blockedBy, setBlockedBy] = useState<string | undefined>(event?.metadata?.blockedBy);
  const [fouledBy, setFouledBy] = useState<string | undefined>(event?.metadata?.fouledBy);
  const [isSaving, setIsSaving] = useState(false);

  const player = useMemo(() => allPlayers.find(p => p.id === event?.playerId), [allPlayers, event]);

  useEventEnrichmentVideo({
    isOpen,
    youtubeTimestamp: event?.youtubeTimestamp,
    expandVideo,
    extraTime
  });

  useEffect(() => {
    if (isOpen && event) {
      setX(event.x);
      setY(event.y);
      setShotDifficulty(event.shotDifficulty);
      setAssistType(event.assistType);
      setGameContext(event.gameContext);
      setPressureLevel(event.pressureLevel);
      setReboundType(event.reboundType);
      setTurnoverType(event.subType as TurnoverType);
      setMissReason(event.metadata?.missReason);
      setBlockedBy(event.metadata?.blockedBy);
      setFouledBy(event.metadata?.fouledBy);
      setExtraTime(0);
    }
  }, [isOpen, event]);

  const handleSave = async (next: boolean = false) => {
    if (!event) return;
    setIsSaving(true);
    const updatedEvent: GameEvent = {
      ...event,
      x,
      y,
      shotDifficulty,
      assistType,
      gameContext,
      pressureLevel,
      reboundType,
      subType: turnoverType || event.subType,
      metadata: {
        ...event.metadata,
        areaName: (x !== undefined && y !== undefined) ? getShotAreaName(x, y) : event.metadata?.areaName,
        missReason,
        blockedBy: missReason === 'Blocked' ? blockedBy : undefined,
        fouledBy: missReason === 'Fouled' ? fouledBy : undefined
      }
    };

    await statsService.updateEvent(updatedEvent);

    // Link block or foul if specified in full mode
    if (match.recordingType !== 'single') {
      if (missReason === 'Blocked' && blockedBy) {
        // Find existing block or create one? 
        // For now enrichment usually just updates metadata.
        // But if user manually selected a blocker, we should probably record it if it doesn't exist.
      }
    }

    onSuccess(updatedEvent, next);
    setIsSaving(false);
    if (!next) onClose();
  };

  if (!event) return null;

  const isShot = ['2pt_make', '3pt_make', '2pt_miss', '3pt_miss'].includes(event.type);
  const isMiss = event.type.includes('miss');
  const isTurnover = event.type === 'to';
  const isRebound = ['oreb', 'dreb'].includes(event.type);
  const isAssist = event.type === 'ast';

  const opponentPlayers = allPlayers.filter(p => {
    const homeTeamId = match.teamId || 'home_team';
    const playerTeam = event.team || (matchRosters.find(pr => pr.profileId === event.playerId)?.teamId === homeTeamId ? 'home' : 'away');
    const pTeam = matchRosters.find(pr => pr.profileId === p.id)?.teamId === homeTeamId ? 'home' : 'away';
    return pTeam !== playerTeam;
  });

  const turnoverTypes: TurnoverType[] = [
    'Bad Pass', 'Bad Handle', 'Stealed', 'Travel', 'Double Dribble', 
    'Out of Bounds', 'Offensive Foul', 'Time Violation', 'Double Team', 'Miscommunication'
  ];

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      sidePanel={true}
      title="Event Detail"
      headerActions={
        <div className="flex flex-col items-end">
          <h2 className="text-xs font-display font-black italic uppercase text-[#1A1A1A] dark:text-white leading-tight flex items-center gap-2">
            {player?.name || 'Unknown Player'}
          </h2>
          <div className="flex items-center gap-1">
            <span className="text-xs not-italic font-bold px-1 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400">
              {event.type.replace('_', ' ').toUpperCase()}
            </span>
            <span className="text-xs text-zinc-500 font-bold uppercase">
              {event.youtubeTimestamp !== undefined ? new Date(event.youtubeTimestamp * 1000).toISOString().substr(14, 5) : '--:--'}
            </span>
          </div>
        </div>
      }
      icon={<Info className="text-brand-navy dark:text-brand-orange" size={20} />}
    >
      <div className="space-y-6 pb-24">
        {/* Video Context Toggle */}
        <div className="flex flex-col gap-2">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${expandVideo ? 'bg-blue-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'}`}>
                {expandVideo ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-tight text-[#1A1A1A] dark:text-white">Expand Video Context</div>
                <div className="text-xs text-zinc-500 font-bold uppercase">{expandVideo ? '+/- 5' : '+/- 2'} seconds loop</div>
              </div>
            </div>
            <button 
              onClick={() => setExpandVideo(!expandVideo)}
              className={`w-12 h-6 rounded-full relative transition-colors ${expandVideo ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${expandVideo ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
          
          <button
            onClick={() => setExtraTime(prev => prev + 10)}
            className="flex items-center justify-center gap-2 py-2 px-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all border border-blue-100 dark:border-blue-800"
          >
            <RefreshCcw size={14} className={extraTime > 0 ? 'animate-spin' : ''} />
            +10 Seconds Replay {extraTime > 0 ? `(${extraTime}s)` : ''}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <div className="space-y-3">
            <div className="flex flex-col gap-1 ml-1">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-1">
                <Handshake size={10} /> Game Context
              </label>
              <p className="text-xs text-zinc-500 font-medium italic">Kapan aksi ini terjadi dalam alur permainan?</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['Bring up ball', 'Half court set', 'Drive / attack', 'Transition offense', 'Inbound', 'After rebound', 'Fast break'].map((ctx) => (
                <button
                  key={ctx}
                  onClick={() => setGameContext(ctx as GameContext)}
                  className={`p-2 text-xs font-bold rounded-xl border transition-all ${
                    gameContext === ctx 
                      ? 'bg-brand-navy text-white border-brand-navy dark:bg-brand-orange dark:text-brand-navy dark:border-brand-orange' 
                      : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                  }`}
                >
                  {ctx}
                </button>
              ))}
            </div>
          </div>

          {isShot && (
            <div className="space-y-3">
              <div className="flex flex-col gap-1 ml-1">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-1">
                  <Target size={10} /> Shot Difficulty
                </label>
                <p className="text-xs text-zinc-500 font-medium italic">Seberapa sulit tembakan ini dilakukan?</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['Open', 'Lightly Contested', 'Contested', 'Heavily Contested'].map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setShotDifficulty(diff as ShotDifficulty)}
                    className={`p-2 text-xs font-bold rounded-xl border transition-all ${
                      shotDifficulty === diff 
                        ? 'bg-amber-500 text-white border-amber-500' 
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isMiss && (
            <div className="space-y-3 animate-in fade-in slide-in-from-left-2">
              <div className="flex flex-col gap-1 ml-1">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-1">
                  <X size={10} /> Miss Reason
                </label>
                <p className="text-xs text-zinc-500 font-medium italic">Mengapa tembakan ini meleset?</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['Blocked', 'Hurried', 'Fouled', 'Short', 'Long', 'Rimmed Out'].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setMissReason(reason)}
                    className={`p-2 text-xs font-bold rounded-xl border transition-all ${
                      missReason === reason 
                        ? 'bg-red-500 text-white border-red-500' 
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              {(missReason === 'Blocked' || missReason === 'Fouled') && match.recordingType !== 'single' && (
                <div className="mt-4 space-y-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30 animate-in zoom-in-95">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-[0.2em] flex items-center gap-1">
                      <User size={10} /> {missReason === 'Blocked' ? 'Blocked By' : 'Fouled By'}
                    </label>
                    <p className="text-xs text-red-500/70 font-medium italic">Siapa pemain lawan yang terlibat?</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {opponentPlayers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => missReason === 'Blocked' ? setBlockedBy(p.id) : setFouledBy(p.id)}
                        className={`p-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 ${
                          (missReason === 'Blocked' ? blockedBy === p.id : fouledBy === p.id)
                            ? 'bg-red-600 text-white border-red-600' 
                            : 'bg-white dark:bg-zinc-800 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400 hover:border-red-200'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-xs shrink-0">
                          #{p.jersey}
                        </span>
                        <span className="truncate">{p.name}</span>
                      </button>
                    ))}
                    {opponentPlayers.length === 0 && (
                      <button
                        onClick={() => missReason === 'Blocked' ? setBlockedBy('opp') : setFouledBy('opp')}
                        className={`p-2 text-xs font-bold rounded-xl border transition-all ${
                          (missReason === 'Blocked' ? blockedBy === 'opp' : fouledBy === 'opp') ? 'bg-red-600 text-white' : 'bg-white dark:bg-zinc-800 text-red-700'
                        }`}
                      >
                        Lawan (General)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {isAssist && (
            <div className="space-y-3">
              <div className="flex flex-col gap-1 ml-1">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-1">
                  <Hand size={10} /> Assist Type
                </label>
                <p className="text-xs text-zinc-500 font-medium italic">Bagaimana umpan ini berbuah poin?</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {['Direct', 'Short Creation', 'Weak Assist'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setAssistType(type as AssistType)}
                    className={`p-2 text-xs font-bold rounded-xl border transition-all ${
                      assistType === type 
                        ? 'bg-blue-500 text-white border-blue-500' 
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isTurnover && (
            <div className="space-y-3">
              <div className="flex flex-col gap-1 ml-1">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-1">
                  <Shield size={10} /> Turnover Detail
                </label>
                <p className="text-xs text-zinc-500 font-medium italic">Jenis kesalahan yang menyebabkan turnover</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {turnoverTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setTurnoverType(type as TurnoverType)}
                    className={`p-2 text-xs font-bold rounded-xl border transition-all ${
                      turnoverType === type 
                        ? 'bg-red-500 text-white border-red-500' 
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isRebound && (
            <div className="space-y-3">
              <div className="flex flex-col gap-1 ml-1">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-1">
                  <RefreshCcw size={10} /> Rebound Type
                </label>
                <p className="text-xs text-zinc-500 font-medium italic">Di mana bola pantul diambil?</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['Long', 'Under Ring'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setReboundType(type as ReboundType)}
                    className={`p-2 text-xs font-bold rounded-xl border transition-all ${
                      reboundType === type 
                        ? 'bg-green-500 text-white border-green-500' 
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-col gap-1 ml-1">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-1">
                <Shield size={10} /> Pressure Level
              </label>
              <p className="text-xs text-zinc-500 font-medium italic">Seberapa ketat penjagaan lawan saat aksi ini?</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['No Pressure', 'Light', 'Heavy / Trap'].map((level) => (
                <button
                  key={level}
                  onClick={() => setPressureLevel(level as PressureLevel)}
                  className={`p-2 text-xs font-bold rounded-xl border transition-all ${
                    pressureLevel === level 
                      ? 'bg-red-500 text-white border-red-500' 
                      : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-2 shrink-0 z-20">
          <button 
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="w-full py-3 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-xl font-black uppercase tracking-wider text-xs transition-all shadow-lg hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
          >
            <Save size={14} /> {isSaving ? 'Saving...' : 'Save and Next Event'}
          </button>
          <button 
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="w-full py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-black uppercase tracking-wider text-xs transition-all hover:bg-zinc-300 dark:hover:bg-zinc-700"
          >
            Save and Close
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

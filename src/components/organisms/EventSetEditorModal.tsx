import React, { useState, useEffect, useMemo } from 'react';
import { X, Target, Shield, Handshake, RefreshCcw, Save, Trash2, Edit, AlertTriangle, Eye, Video } from 'lucide-react';
import { GameEvent, Match, Player, MatchRoster } from '../../core/types/stats';
import { statsService } from '../../core/services/statsService';
import { findRelatedEvents, getPlaySetType, PlaySetType } from '../../core/utils/eventGrouping';
import { BaseModal } from '../atoms/BaseModal';
import { useEventEnrichmentVideo } from '../../hooks/useEventEnrichmentVideo';
import { getShotAreaName } from '../../core/utils/courtUtils';
import { BasketballCourtPicker } from '../common/BasketballCourtPicker';

interface EventSetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: GameEvent | null;
  onSuccess: () => void;
  match: Match;
  allPlayers: Player[];
  matchRosters: MatchRoster[];
  allEvents: GameEvent[];
}

export const EventSetEditorModal: React.FC<EventSetEditorModalProps> = ({
  isOpen,
  onClose,
  event,
  onSuccess,
  match,
  allPlayers,
  matchRosters,
  allEvents
}) => {
  // 1. Group / Set retrieval
  const relatedEvents = useMemo(() => {
    if (!event) return [];
    return findRelatedEvents(event, allEvents);
  }, [event, allEvents]);

  const playSetType = useMemo(() => {
    return getPlaySetType(relatedEvents);
  }, [relatedEvents]);

  // Video context states
  const [expandVideo, setExpandVideo] = useState(false);
  const [extraTime, setExtraTime] = useState(0);

  // Use existing video loop custom events
  const primaryEvent = relatedEvents[0] || event;
  useEventEnrichmentVideo({
    isOpen,
    youtubeTimestamp: primaryEvent?.youtubeTimestamp,
    expandVideo,
    extraTime
  });

  // 2. Editing states
  const [isSaving, setIsSaving] = useState(false);

  // Teams ID
  const homeTeamId = match.teamId || 'home_team';
  const awayTeamId = match.opponentTeamId || 'away_team';
  
  const [editedYoutubeTimestamp, setEditedYoutubeTimestamp] = useState<number>(0);
  const [editedGameClock, setEditedGameClock] = useState<string>('');
  const [editedQuarter, setEditedQuarter] = useState<number>(1);

  // State for SHOT
  const [shooterId, setShooterId] = useState('');
  const [shotValue, setShotValue] = useState<'2pt' | '3pt' | '1pt'>('2pt');
  const [shotResult, setShotResult] = useState<'make' | 'miss'>('make');
  const [isLineViolation, setIsLineViolation] = useState(false);
  const [hasAssist, setHasAssist] = useState(false);
  const [assistId, setAssistId] = useState('');
  const [hasBlock, setHasBlock] = useState(false);
  const [blockId, setBlockId] = useState('');
  const [reboundType, setReboundType] = useState<'none' | 'oreb' | 'dreb'>('none');
  const [rebounderId, setRebounderId] = useState('');
  const [shotX, setShotX] = useState<number | undefined>(undefined);
  const [shotY, setShotY] = useState<number | undefined>(undefined);

  const [hasFoul, setHasFoul] = useState(false);

  // State for FOUL
  const [foulerId, setFoulerId] = useState('');
  const [victimId, setVictimId] = useState('');
  const [foulType, setFoulType] = useState('');

  // State for TURNOVER
  const [turnoverCommitterId, setTurnoverCommitterId] = useState('');
  const [turnoverType, setTurnoverType] = useState('');
  const [hasSteal, setHasSteal] = useState(false);
  const [stealerId, setStealerId] = useState('');

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Initialize form fields based on set of events
  useEffect(() => {
    if (!isOpen || relatedEvents.length === 0) return;

    // Reset all
    setShowConfirmDelete(false);
    setShooterId(''); setShotValue('2pt'); setShotResult('make'); setIsLineViolation(false);
    setHasAssist(false); setAssistId('');
    setHasBlock(false); setBlockId('');
    setReboundType('none'); setRebounderId('');
    setShotX(undefined); setShotY(undefined);
    setHasFoul(false);
    setFoulerId(''); setVictimId(''); setFoulType('');
    setTurnoverCommitterId(''); setTurnoverType('');
    setHasSteal(false); setStealerId('');
    
    setEditedYoutubeTimestamp(relatedEvents[0]?.youtubeTimestamp || 0);

    const firstEv = relatedEvents[0];
    if (firstEv) {
      const initialTimestamp = firstEv.timestamp || 0;
      const initialMin = Math.floor(initialTimestamp / 60);
      const initialSec = initialTimestamp % 60;
      setEditedGameClock(
        firstEv.gameClock || 
        `${initialMin.toString().padStart(2, '0')}:${initialSec.toString().padStart(2, '0')}`
      );
      setEditedQuarter(firstEv.quarter || 1);
    }

    const mainShot = relatedEvents.find(e => ['2pt_make', '3pt_make', '2pt_miss', '3pt_miss', '1pt_make', '1pt_miss'].includes(e.type));
    const assistEv = relatedEvents.find(e => e.type === 'ast');
    const blockEv = relatedEvents.find(e => e.type === 'blk' || e.type === 'blocked_shot');
    const reboundEv = relatedEvents.find(e => e.type === 'oreb' || e.type === 'dreb');

    if (mainShot) {
      setShooterId(mainShot.playerId);
      setShotResult(mainShot.type.includes('make') ? 'make' : 'miss');
      if (mainShot.type.startsWith('3pt')) setShotValue('3pt');
      else if (mainShot.type.startsWith('1pt')) setShotValue('1pt');
      else setShotValue('2pt');
      
      setIsLineViolation(mainShot.subType === 'Line Violation');
      setShotX(mainShot.x);
      setShotY(mainShot.y);

      if (assistEv) {
        setHasAssist(true);
        setAssistId(assistEv.playerId);
      }
      if (blockEv) {
        setHasBlock(true);
        setBlockId(blockEv.playerId);
      }
      if (reboundEv) {
        setReboundType(reboundEv.type as 'oreb' | 'dreb');
        setRebounderId(reboundEv.playerId);
      }
    }

    const foulEv = relatedEvents.find(e => ['foul', 'defensive_foul', 'offensive_foul'].includes(e.type));
    const victimEv = relatedEvents.find(e => e.type === 'foul_drawn');
    if (foulEv || victimEv) {
      if (mainShot) setHasFoul(true);
      
      let initialFoulType = '';
      if (foulEv) {
        setFoulerId(foulEv.playerId);
        initialFoulType = foulEv.subType || '';
      }
      if (victimEv) {
        setVictimId(victimEv.playerId);
        if (!initialFoulType) initialFoulType = victimEv.subType || '';
      }
      setFoulType(initialFoulType);
    }

    const toEv = relatedEvents.find(e => e.type === 'to');
    const stealEv = relatedEvents.find(e => e.type === 'stl');
    if (toEv) {
      setTurnoverCommitterId(toEv.playerId);
      setTurnoverType(toEv.subType || '');
    }
    if (stealEv) {
      setHasSteal(true);
      setStealerId(stealEv.playerId);
    }
  }, [isOpen, relatedEvents]);

  // Player lists for selection
  const homePlayers = useMemo(() => {
    return allPlayers.filter(p => matchRosters.some(r => r.teamId === homeTeamId && r.profileId === p.id));
  }, [allPlayers, matchRosters, homeTeamId]);

  const awayPlayers = useMemo(() => {
    return allPlayers.filter(p => matchRosters.some(r => r.teamId === awayTeamId && r.profileId === p.id));
  }, [allPlayers, matchRosters, awayTeamId]);

  const mainEventTeam = useMemo(() => {
    return primaryEvent?.team || 'home';
  }, [primaryEvent]);

  const shootingTeamPlayers = mainEventTeam === 'home' ? homePlayers : awayPlayers;
  const defendingTeamPlayers = mainEventTeam === 'home' ? awayPlayers : homePlayers;

  // Enhance roster with generic team options if team mode
  const getShootingTeamOptions = () => {
    if (shootingTeamPlayers.length > 0) return shootingTeamPlayers;
    const tName = mainEventTeam === 'home' ? match.ourTeamName || 'Tim Kita' : match.theirTeamName || 'Lawan';
    return [{ id: mainEventTeam === 'home' ? homeTeamId : awayTeamId, name: tName, jersey: '--' }] as any[];
  };

  const getDefendingTeamOptions = () => {
    if (defendingTeamPlayers.length > 0) return defendingTeamPlayers;
    const tName = mainEventTeam === 'home' ? match.theirTeamName || 'Lawan' : match.ourTeamName || 'Tim Kita';
    return [{ id: mainEventTeam === 'home' ? awayTeamId : homeTeamId, name: tName, jersey: '--' }] as any[];
  };

  const handleSave = async () => {
    if (relatedEvents.length === 0 || !primaryEvent) return;
    setIsSaving(true);

    try {
      // 1. Delete all existing events in the set
      for (const e of relatedEvents) {
        await statsService.removeEvent(match.id, e.id);
      }

      // Parse MM:SS or M:SS to seconds
      const parseGameClockToSeconds = (clockStr: string): number => {
        const parts = clockStr.split(':');
        if (parts.length === 2) {
          const mins = parseInt(parts[0], 10) || 0;
          const secs = parseInt(parts[1], 10) || 0;
          return mins * 60 + secs;
        }
        const singleVal = parseInt(clockStr, 10);
        return isNaN(singleVal) ? 0 : singleVal;
      };

      const finalTimestamp = editedGameClock ? parseGameClockToSeconds(editedGameClock) : primaryEvent.timestamp;
      const baseTimestamp = finalTimestamp;
      const baseQuarter = editedQuarter;
      const baseYoutubeTimestamp = editedYoutubeTimestamp;
      const baseFlowGroupId = primaryEvent.metadata?.flowGroupId || `fg_${Date.now()}`;
      const originalRealTime = primaryEvent.realTime || new Date().toISOString();

      // Helper to generate events
      const createSetEvent = (type: string, pId: string, overrides: Partial<GameEvent> = {}): GameEvent => {
        const isHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === pId) || pId === 'home_team' || pId === homeTeamId;
        const eTeam = isHome ? 'home' : 'away';
        
        return {
          id: `evt_${Math.random().toString(36).substr(2, 9)}`,
          matchId: match.id,
          playerId: pId,
          type: type as any,
          timestamp: baseTimestamp,
          quarter: baseQuarter,
          gameClock: editedGameClock,
          realTime: originalRealTime,
          youtubeTimestamp: baseYoutubeTimestamp,
          team: eTeam,
          metadata: {
            flowGroupId: baseFlowGroupId,
            ...overrides.metadata
          },
          ...overrides
        };
      };

      const newEventsToInsert: GameEvent[] = [];

      if (playSetType === 'SHOT') {
        // Log Shot Event
        const actualResult = (isLineViolation && shotValue === '1pt') ? 'miss' : shotResult;
        const finalType = `${shotValue}_${actualResult}`;
        const points = actualResult === 'make' ? (shotValue === '3pt' ? 3 : shotValue === '1pt' ? 1 : 2) : 0;
        
        const shotOverrides: Partial<GameEvent> = { 
          points,
          subType: (isLineViolation && shotValue === '1pt') ? 'Line Violation' : undefined
        };
        if (shotX !== undefined && shotY !== undefined) {
          shotOverrides.x = shotX;
          shotOverrides.y = shotY;
          shotOverrides.metadata = { areaName: getShotAreaName(shotX, shotY) };
        }

        // FBA Rule: If shooting foul on a miss, we DO NOT log the miss as FGA.
        // We will just not insert the shot event at all!
        const isShootingFoulMiss = hasFoul && foulType === 'Shooting Foul' && shotResult === 'miss';
        
        let shotEvId = '';
        if (!isShootingFoulMiss) {
          const shotEv = createSetEvent(finalType, shooterId || primaryEvent.playerId, shotOverrides);
          shotEvId = shotEv.id;
          newEventsToInsert.push(shotEv);
        }

        if (shotResult === 'make' && hasAssist && assistId) {
          const assistEv = createSetEvent('ast', assistId);
          newEventsToInsert.push(assistEv);
        }

        if (shotResult === 'miss') {
          if (hasBlock && blockId) {
            const blockEv = createSetEvent('blk', blockId);
            newEventsToInsert.push(blockEv);
          }
          if (reboundType !== 'none' && rebounderId) {
            const reboundEv = createSetEvent(reboundType, rebounderId);
            newEventsToInsert.push(reboundEv);
          }
        }
        
        if (hasFoul) {
          const foulActorId = foulerId || 'opp';
          const foulEv = createSetEvent('foul', foulActorId, { subType: foulType || undefined });
          newEventsToInsert.push(foulEv);

          if (victimId) {
            const victimEv = createSetEvent('foul_drawn', victimId, { subType: foulType || undefined });
            newEventsToInsert.push(victimEv);
          }
        }
      } else if (playSetType === 'FOUL') {
        const foulActorId = foulerId || primaryEvent.playerId;
        const foulEv = createSetEvent('foul', foulActorId, { subType: foulType || undefined });
        newEventsToInsert.push(foulEv);

        if (victimId) {
          const victimEv = createSetEvent('foul_drawn', victimId, { subType: foulType || undefined });
          newEventsToInsert.push(victimEv);
        }
      } else if (playSetType === 'TURNOVER') {
        const committerId = turnoverCommitterId || primaryEvent.playerId;
        const toEv = createSetEvent('to', committerId, { subType: turnoverType || undefined });
        newEventsToInsert.push(toEv);

        if (hasSteal && stealerId) {
          const stealEv = createSetEvent('stl', stealerId);
          newEventsToInsert.push(stealEv);
        }
      } else {
        // Non-standard set, fallback to just preserving original event with updated playerId
        const fallbackEv = { 
          ...primaryEvent, 
          playerId: shooterId || primaryEvent.playerId,
          timestamp: baseTimestamp,
          quarter: baseQuarter,
          gameClock: editedGameClock,
          youtubeTimestamp: baseYoutubeTimestamp
        };
        newEventsToInsert.push(fallbackEv);
      }

      // Save all new events
      for (const newEv of newEventsToInsert) {
        await statsService.addEvent(newEv);
      }

      // Rebuild possessions and recalculate stats
      await statsService.rebuildPossessionsForMatch(match.id, match);
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to save play set updates:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSet = async () => {
    if (relatedEvents.length === 0) return;
    
    if (!showConfirmDelete) {
      setShowConfirmDelete(true);
      return;
    }

    setIsSaving(true);
    try {
      for (const e of relatedEvents) {
        await statsService.removeEvent(match.id, e.id);
      }
      await statsService.rebuildPossessionsForMatch(match.id, match);
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to delete play set:", err);
    } finally {
      setIsSaving(false);
      setShowConfirmDelete(false);
    }
  };

  if (!isOpen || relatedEvents.length === 0) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      sidePanel={true}
      title="Revisi Set Kejadian (Play Set)"
      icon={<Edit className="text-amber-500" size={20} />}
    >
      <div className="space-y-6 pb-24">
        {/* Play Set Summary Header */}
        <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs font-black uppercase tracking-[0.15em] text-zinc-400">Tipe Set Kejadian</span>
              <h3 className="text-xs font-bold text-zinc-800 dark:text-white mt-0.5">
                {playSetType === 'SHOT' ? '🏀 SET TEMBAKAN / PLAY SET SHOT' : 
                 playSetType === 'FOUL' ? '🛑 SET PELANGGARAN / PLAY SET FOUL' : 
                 playSetType === 'TURNOVER' ? '🔄 SET TURNOVER & STEAL' : '📋 SET KEJADIAN LAIN'}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-zinc-400">Game Clock</span>
              <p className="text-xs font-mono font-bold text-brand-navy dark:text-brand-orange mt-0.5">
                Q{primaryEvent.quarter} - {Math.floor(primaryEvent.timestamp / 60)}:{(primaryEvent.timestamp % 60).toString().padStart(2, '0')}
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Kejadian ini dibuat dalam satu set alur input menu. Melakukan revisi akan memperbarui seluruh set sekaligus untuk menjaga konsistensi data statistik.
          </p>
        </div>

        {/* Manual Game Clock & Quarter Editor */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 text-left">
          <div className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            <Edit size={14} className="text-amber-500" />
            <span>Edit Manual Game Clock & Quarter</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Quarter</label>
              <select
                value={editedQuarter}
                onChange={(e) => setEditedQuarter(parseInt(e.target.value, 10))}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
              >
                <option value={1}>Quarter 1 (Q1)</option>
                <option value={2}>Quarter 2 (Q2)</option>
                <option value={3}>Quarter 3 (Q3)</option>
                <option value={4}>Quarter 4 (Q4)</option>
                <option value={5}>Overtime (OT)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Game Clock (MM:SS)</label>
              <input
                type="text"
                value={editedGameClock}
                onChange={(e) => setEditedGameClock(e.target.value)}
                placeholder="Contoh: 10:00 atau 05:30"
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold"
              />
            </div>
          </div>

          <div className="text-[10px] text-zinc-500 leading-relaxed bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
            Perubahan Quarter & Game Clock di atas hanya akan diterapkan pada set kejadian ini saja, tanpa mengubah atau merusak record kejadian (play) lainnya dalam game ini.
          </div>
        </div>

        {/* Video Loop controls */}
        <div className="flex flex-col gap-2">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-700 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${expandVideo ? 'bg-amber-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'}`}>
                  <Video size={16} />
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-tight text-[#1A1A1A] dark:text-white">Putar Ulang Video Otomatis</div>
                  <div className="text-xs text-zinc-500 font-bold uppercase">{expandVideo ? '+/- 5' : '+/- 2'} Detik Looping</div>
                </div>
              </div>
              <button 
                onClick={() => setExpandVideo(!expandVideo)}
                className={`w-12 h-6 rounded-full relative transition-colors ${expandVideo ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${expandVideo ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
            
            {/* Waktu Video Editor */}
            <div className="flex flex-col gap-1 border-t border-zinc-200 dark:border-zinc-700 pt-3 mt-1">
              <div className="text-xs font-black uppercase tracking-widest text-zinc-400">Sesuaikan Waktu Kejadian (Video)</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-zinc-400">-30s</span>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  value={editedYoutubeTimestamp - (primaryEvent?.youtubeTimestamp || 0)}
                  onChange={(e) => setEditedYoutubeTimestamp((primaryEvent?.youtubeTimestamp || 0) + parseInt(e.target.value))}
                  className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-xs font-bold text-zinc-400">+30s</span>
              </div>
              <div className="text-center text-xs text-blue-600 dark:text-blue-400 font-bold mt-1">
                Waktu Tersimpan: {Math.floor(editedYoutubeTimestamp / 3600).toString().padStart(2, '0')}:{Math.floor((editedYoutubeTimestamp % 3600) / 60).toString().padStart(2, '0')}:{(editedYoutubeTimestamp % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setExtraTime(prev => prev + 10)}
            className="flex items-center justify-center gap-2 py-2 px-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
          >
            <RefreshCcw size={14} className={extraTime > 0 ? 'animate-spin' : ''} />
            +10 Detik Durasi Putar Ulang {extraTime > 0 ? `(${extraTime}s)` : ''}
          </button>
        </div>

        {/* Editing Fields based on Type */}
        <div className="space-y-6">
          {playSetType === 'SHOT' && (
            <>
              {/* Shooter selection */}
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Penembak (Shooter)</label>
                <select
                  value={shooterId}
                  onChange={(e) => setShooterId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">Pilih Penembak...</option>
                  {shootingTeamPlayers.map(p => (
                    <option key={p.id} value={p.id}>#{p.jersey || '--'} {p.name} ({p.displayName})</option>
                  ))}
                </select>
              </div>

               {/* Shot Result Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Hasil Tembakan (Result)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShotResult('make');
                      setIsLineViolation(false);
                    }}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      shotResult === 'make'
                        ? 'bg-green-600 border-green-600 text-white shadow-sm'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Masuk (Make)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShotResult('miss')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      shotResult === 'miss'
                        ? 'bg-red-600 border-red-600 text-white shadow-sm'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Meleset (Miss)
                  </button>
                </div>
              </div>

              {/* Shot Value */}
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Nilai Tembakan (Value)</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['2pt', '3pt', '1pt'] as const).map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setShotValue(val);
                        if (val !== '1pt') setIsLineViolation(false);
                      }}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                        shotValue === val
                          ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                          : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {val.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line Violation toggle */}
              {shotValue === '1pt' && (
                <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-2xl border border-amber-500/25">
                  <div className="space-y-0.5 pr-2">
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400">Kaki Melewati Garis?</div>
                    <div className="text-[10px] text-zinc-500 font-medium">Melanggar aturan garis free throw (skor batal, tercatat meleset)</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !isLineViolation;
                      setIsLineViolation(nextVal);
                      if (nextVal) {
                        setShotResult('miss');
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      isLineViolation
                        ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {isLineViolation ? 'Ya (Batal)' : 'Tidak'}
                  </button>
                </div>
              )}

              {/* Shot Location */}
              {shotValue !== '1pt' && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Lokasi Tembakan (Titik Shoot)</label>
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-700 flex flex-col items-center justify-center gap-4">
                     <BasketballCourtPicker
                        initialX={shotX}
                        initialY={shotY}
                        allowedArea={shotValue === '2pt' ? '2pt' : '3pt'}
                        onLocationSelect={(x, y) => {
                          setShotX(x);
                          setShotY(y);
                        }}
                     />
                     <div className="text-xs text-zinc-500 font-medium">Klik pada area lapangan untuk mengubah posisi. Area hijau mewakili lokasi tembakan saat ini.</div>
                  </div>
                </div>
              )}

              {/* If Make -> Assist */}
              {shotResult === 'make' && (
                <div className="bg-blue-50/30 dark:bg-blue-900/10 p-3 rounded-2xl border border-blue-100/50 dark:border-blue-900/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Ada Assist?</div>
                    <button
                      type="button"
                      onClick={() => setHasAssist(!hasAssist)}
                      className={`w-12 h-6 rounded-full relative transition-colors ${hasAssist ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${hasAssist ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  {hasAssist && (
                    <select
                      value={assistId}
                      onChange={(e) => setAssistId(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Pilih Pemberi Assist...</option>
                      {shootingTeamPlayers.filter(p => p.id !== shooterId).map(p => (
                        <option key={p.id} value={p.id}>#{p.jersey || '--'} {p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* If Miss -> Block & Rebound */}
              {shotResult === 'miss' && (
                <div className="space-y-4">
                  {/* Block */}
                  <div className="bg-red-50/30 dark:bg-red-900/10 p-3 rounded-2xl border border-red-100/50 dark:border-red-900/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Terkena Block?</div>
                      <button
                        type="button"
                        onClick={() => setHasBlock(!hasBlock)}
                        className={`w-12 h-6 rounded-full relative transition-colors ${hasBlock ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${hasBlock ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {hasBlock && (
                      <select
                        value={blockId}
                        onChange={(e) => setBlockId(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="">Pilih Pemblokir...</option>
                        {defendingTeamPlayers.map(p => (
                          <option key={p.id} value={p.id}>#{p.jersey || '--'} {p.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Rebound */}
                  <div className="bg-green-50/30 dark:bg-green-900/10 p-3 rounded-2xl border border-green-100/50 dark:border-green-900/30 space-y-3">
                    <label className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Rebound Play</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['none', 'oreb', 'dreb'] as const).map(rType => (
                        <button
                          key={rType}
                          type="button"
                          onClick={() => {
                            setReboundType(rType);
                            if (rType === 'none') setRebounderId('');
                          }}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            reboundType === rType
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {rType === 'none' ? 'Tidak Ada' : rType === 'oreb' ? 'Rebound Ofensif' : 'Rebound Defensif'}
                        </button>
                      ))}
                    </div>

                    {reboundType !== 'none' && (
                      <select
                        value={rebounderId}
                        onChange={(e) => setRebounderId(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                      >
                        <option value="">Pilih Rebounder...</option>
                        {(reboundType === 'oreb' ? getShootingTeamOptions() : getDefendingTeamOptions()).map(p => (
                          <option key={p.id} value={p.id}>#{p.jersey || '--'} {p.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}

              {/* Shot + Foul Option */}
              <div className="bg-orange-50/30 dark:bg-orange-900/10 p-3 rounded-2xl border border-orange-100/50 dark:border-orange-900/30 space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Terjadi Foul Pada Play Ini?</div>
                  <button
                    type="button"
                    onClick={() => {
                      setHasFoul(!hasFoul);
                      if (!hasFoul) {
                         setVictimId(shooterId);
                         setFoulType(shotResult === 'make' ? 'And-One' : 'Shooting Foul');
                      }
                    }}
                    className={`w-12 h-6 rounded-full relative transition-colors ${hasFoul ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${hasFoul ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {hasFoul && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Pelaku Foul (Fouler)</label>
                      <select
                        value={foulerId}
                        onChange={(e) => setFoulerId(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="">Pilih Pemain (Lawan)...</option>
                        {defendingTeamPlayers.map(p => (
                          <option key={p.id} value={p.id}>#{p.jersey || '--'} {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Jenis Pelanggaran</label>
                      <select
                        value={foulType}
                        onChange={(e) => setFoulType(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="Shooting Foul">Shooting Foul</option>
                        <option value="And-One">And-One Situation</option>
                        <option value="Offensive Foul">Offensive Foul</option>
                        <option value="Personal Foul">Personal Foul</option>
                        <option value="Blocking">Blocking</option>
                        <option value="Charging">Charging</option>
                        <option value="Reach-in">Reach-in</option>
                        <option value="Double Team">Double Team</option>
                        <option value="Holding">Holding</option>
                        <option value="Loose Ball">Loose Ball</option>
                        <option value="Technical Foul">Technical Foul</option>
                        <option value="Unsportsmanlike">Unsportsmanlike Foul</option>
                        <option value="Illegal Screen">Illegal Screen</option>
                        <option value="Push Off">Push Off</option>
                        <option value="">Foul Biasa (Lainnya)</option>
                      </select>
                    </div>
                    {foulType === 'Shooting Foul' && shotResult === 'miss' && (
                      <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg font-bold">
                        Sesuai aturan FBA, missed shot dengan shooting foul tidak akan dihitung sebagai FGA (Field Goal Attempt).
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {playSetType === 'FOUL' && (
            <>
              {/* Fouler selection */}
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Pemain Pelaku Foul (Fouler)</label>
                <select
                  value={foulerId}
                  onChange={(e) => setFoulerId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">Pilih Pemain...</option>
                  {allPlayers.map(p => {
                    const isHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === p.id);
                    return (
                      <option key={p.id} value={p.id}>
                        {isHome ? '[KITA] ' : '[LAWAN] '} #{p.jersey || '--'} {p.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Victim (Foul Drawn) selection */}
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Korban Foul (Foul Drawn)</label>
                <select
                  value={victimId}
                  onChange={(e) => setVictimId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">Pilih Pemain...</option>
                  <option value="">Tidak ada korban spesifik</option>
                  {allPlayers.filter(p => p.id !== foulerId).map(p => {
                    const isHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === p.id);
                    return (
                      <option key={p.id} value={p.id}>
                        {isHome ? '[KITA] ' : '[LAWAN] '} #{p.jersey || '--'} {p.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Foul Type input */}
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Jenis Pelanggaran (Foul Type)</label>
                <select
                  value={foulType}
                  onChange={(e) => setFoulType(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">Foul Biasa (Personal Foul)</option>
                  <option value="Shooting Foul">Shooting Foul</option>
                  <option value="Offensive Foul">Offensive Foul</option>
                  <option value="Technical Foul">Technical Foul</option>
                  <option value="Unsportsmanlike">Unsportsmanlike Foul</option>
                  <option value="And-One">And-One Situation</option>
                  <option value="Personal Foul">Personal Foul</option>
                  <option value="Blocking">Blocking</option>
                  <option value="Charging">Charging</option>
                  <option value="Reach-in">Reach-in</option>
                  <option value="Double Team">Double Team</option>
                  <option value="Holding">Holding</option>
                  <option value="Loose Ball">Loose Ball</option>
                  <option value="Illegal Screen">Illegal Screen</option>
                  <option value="Push Off">Push Off</option>
                </select>
              </div>
            </>
          )}

          {playSetType === 'TURNOVER' && (
            <>
              {/* Turnover committer */}
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Pemain Turnover</label>
                <select
                  value={turnoverCommitterId}
                  onChange={(e) => setTurnoverCommitterId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">Pilih Pemain...</option>
                  {allPlayers.map(p => {
                    const isHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === p.id);
                    return (
                      <option key={p.id} value={p.id}>
                        {isHome ? '[KITA] ' : '[LAWAN] '} #{p.jersey || '--'} {p.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Turnover Type */}
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest block">Penyebab Turnover</label>
                <select
                  value={turnoverType}
                  onChange={(e) => setTurnoverType(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">Pilih Penyebab...</option>
                  <option value="Bad Pass">Bad Pass (Salah Passing)</option>
                  <option value="Bad Handle">Bad Handle (Dribble Lepas)</option>
                  <option value="Travel">Traveling</option>
                  <option value="Double Dribble">Double Dribble</option>
                  <option value="Out of Bounds">Out of Bounds</option>
                  <option value="Offensive Foul">Offensive Foul</option>
                  <option value="3-Seconds">3-Seconds Violation</option>
                </select>
              </div>

              {/* Steal toggle & player selection */}
              <div className="bg-red-50/30 dark:bg-red-900/10 p-3 rounded-2xl border border-red-100/50 dark:border-red-900/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Ada Steal (Curi Bola)?</div>
                  <button
                    type="button"
                    onClick={() => setHasSteal(!hasSteal)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${hasSteal ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${hasSteal ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {hasSteal && (
                  <select
                    value={stealerId}
                    onChange={(e) => setStealerId(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    <option value="">Pilih Pemain Steal...</option>
                    {allPlayers.filter(p => {
                      const committerIsHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === turnoverCommitterId);
                      const stealerIsHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === p.id);
                      return stealerIsHome !== committerIsHome;
                    }).map(p => (
                      <option key={p.id} value={p.id}>#{p.jersey || '--'} {p.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}
        </div>

        {/* Buttons Action */}
        <div className="pt-4 flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Save size={14} />
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan Set'}
          </button>

          {showConfirmDelete ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDeleteSet}
                disabled={isSaving}
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <AlertTriangle size={14} />
                {isSaving ? 'Menghapus...' : 'Ya, Hapus Set Ini'}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                disabled={isSaving}
                className="flex-1 h-11 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-wider transition-all"
              >
                Batal Hapus
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDeleteSet}
              disabled={isSaving}
              className="w-full h-11 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-900/30 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
            >
              <Trash2 size={14} />
              Hapus Rangkaian Set Kejadian Ini
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-wider transition-all"
          >
            Batal
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

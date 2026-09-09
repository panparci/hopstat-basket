import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateId } from '../core/utils/idUtils';
import { 
  Mic, Upload, 
  Target, XCircle, ArrowUpCircle, Shield, Handshake, Hand, Ban, Flag,
  RefreshCw, Plus, Zap, MoreHorizontal, ChevronDown, Undo, Redo, ArrowRightLeft
} from 'lucide-react';
import { statsService } from '../core/services/statsService';
import { Match, GameEvent, GameState, Player, EventType, TurnoverType, Possession, MatchRoster, Team, Club } from '../core/types/stats';
import { Scoreboard } from '../components/organisms/Scoreboard';
import { SubstitutionModal } from '../components/organisms/SubstitutionModal';
import { StarterSelectionModal } from '../components/organisms/StarterSelectionModal';
import { PlayerCorrectionModal } from '../components/organisms/PlayerCorrectionModal';
import { EditMatchModal } from '../components/organisms/EditMatchModal';
import { ShotChartModal } from '../components/organisms/ShotChartModal';
import { ActionDrawer } from '../components/organisms/ActionDrawer';
import { SmartPromptModal } from '../components/organisms/SmartPromptModal';
import { ClockEditModal } from '../components/organisms/ClockEditModal';
import { PlayerEditModal } from '../components/organisms/PlayerEditModal';
import { TeamFormModal } from '../components/organisms/TeamFormModal';
import { EventEnrichmentModal } from '../components/organisms/EventEnrichmentModal';
import { EventSetEditorModal } from '../components/organisms/EventSetEditorModal';
import { VideoPlayerPanel } from '../components/organisms/VideoPlayerPanel';
import { LiveStatsDashboard } from '../components/organisms/LiveStatsDashboard';
import { CommentaryPanel } from '../components/organisms/CommentaryPanel';
import { VoiceFeedbackToast, VoiceFeedbackState } from '../components/molecules/VoiceFeedbackToast';
import { SinglePlayerActions } from '../components/organisms/SinglePlayerActions';
import { OpponentActions } from '../components/organisms/OpponentActions';
import { PlayerSelectionGrid } from '../components/tracking/PlayerSelectionGrid';
import { useOnTheFlyClockSync } from '../features/on-the-fly-clock-sync';
import { EventLogPanel } from '../components/tracking/EventLogPanel';
import { UndoRedoItem } from '../components/tracking/UndoRedoControls';
import { TrackingHeader } from '../components/tracking/TrackingHeader';
import { PossessionIndicator } from '../components/tracking/PossessionIndicator';
import { TimeRevisionOverlay } from '../components/tracking/TimeRevisionOverlay';
import { SmartPromptManager } from '../components/tracking/SmartPromptManager';
import { VideoEventOverlay } from '../components/tracking/VideoEventOverlay';
import { VideoScoreboardDrawer } from '../modules/tracking/components/VideoScoreboardDrawer';
import { useTheme } from '../core/hooks/useTheme';
import { useSpeechRecognition } from '../core/hooks/useSpeechRecognition';
import { usePlayerManagement } from '../hooks/usePlayerManagement';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { parseVoiceCommand, VoiceCommandResult } from '../core/utils/voiceParser';
import { calculateAge } from '../core/utils/ageCalculator';
import { useGameTracking } from '../hooks/useGameTracking';
import { useVideoSyncTimer } from '../modules/tracking/hooks/useVideoSyncTimer';
import { ClockSyncPanel } from '../features/visual-clock-sync/ui/ClockSyncPanel';
import { ClockSyncPoint } from '../features/visual-clock-sync/types';
import { AILineupDetectorModal } from '../features/ai-lineup-detector';
import { TimelineStorageService } from '../features/automatic-clock-mapping/services/timelineStorageService';
import { QuarterMarker } from '../features/automatic-clock-mapping/types';

type PendingAction = 
  | { type: 'rebound', playerId: string, team: 'home' | 'away', eventId?: string }
  | { type: 'steal', playerId: string, team: 'home' | 'away', eventId?: string }
  | { type: 'turnover', playerId: string, team: 'home' | 'away', eventId?: string }
  | { type: 'block', playerId: string, team: 'home' | 'away', eventId?: string }
  | { type: 'freethrow', playerId: string, team: 'home' | 'away', isMake: boolean, eventId?: string }
  | { type: 'assist', playerId: string, team: 'home' | 'away', eventId?: string }
  | { type: 'foul_drawn', playerId: string, team: 'home' | 'away', eventId?: string };

import { useTrackingLogic } from '../hooks/useTrackingLogic';

import { sortEventsChronologically } from '../core/services/possessionEngine';
import { useToast } from '../core/contexts/ToastContext';

const getPlayerNameWithJersey = (playerId: string, allPlayers: Player[]) => {
  if (playerId === 'opp' || playerId === 'away_team') return 'Opponent';
  if (playerId === 'home_team') return 'Home Team';
  const p = allPlayers.find(pl => pl.id === playerId);
  if (!p) return 'Pemain';
  return p.jersey ? `${p.name} (#${p.jersey})` : p.name;
};

const getEventLabel = (type: string): string => {
  switch (type) {
    case '2pt_make': return 'Masuk 2 Poin';
    case '3pt_make': return 'Masuk 3 Poin';
    case '2pt_miss': return 'Meleset 2 Poin';
    case '3pt_miss': return 'Meleset 3 Poin';
    case '1pt_make': return 'Masuk Free Throw';
    case '1pt_miss': return 'Meleset Free Throw';
    case 'oreb': return 'Offensive Rebound';
    case 'dreb': return 'Defensive Rebound';
    case 'ast': return 'Assist';
    case 'stl': return 'Steal';
    case 'blk': return 'Block';
    case 'to': return 'Turnover';
    case 'foul': return 'Foul';
    case 'defensive_foul': return 'Defensive Foul';
    case 'offensive_foul': return 'Offensive Foul';
    case 'foul_drawn': return 'Foul Drawn';
    case 'sub_in': return 'Masuk Lapangan';
    case 'sub_out': return 'Keluar Lapangan';
    case 'timeout': return 'Timeout';
    case 'jumpball': return 'Jumpball';
    default: return type;
  }
};

const getEventsDiffDescription = (prev: GameEvent[], next: GameEvent[], allPlayers: Player[]): string => {
  const added = next.filter(ne => !prev.some(pe => pe.id === ne.id));
  if (added.length > 0) {
    if (added.length === 1) {
      const ev = added[0];
      const pName = getPlayerNameWithJersey(ev.playerId, allPlayers);
      const label = getEventLabel(ev.type);
      return `Tambah ${label} (${pName})`;
    }
    return `Tambah ${added.length} Kejadian`;
  }

  const deleted = prev.filter(pe => !next.some(ne => ne.id === pe.id));
  if (deleted.length > 0) {
    if (deleted.length === 1) {
      const ev = deleted[0];
      const pName = getPlayerNameWithJersey(ev.playerId, allPlayers);
      const label = getEventLabel(ev.type);
      return `Hapus ${label} (${pName})`;
    }
    return `Hapus ${deleted.length} Kejadian`;
  }

  const modified: { prev: GameEvent; next: GameEvent }[] = [];
  for (const ne of next) {
    const pe = prev.find(p => p.id === ne.id);
    if (pe && JSON.stringify(pe) !== JSON.stringify(ne)) {
      modified.push({ prev: pe, next: ne });
    }
  }

  if (modified.length > 0) {
    if (modified.length === 1) {
      const { prev: pe, next: ne } = modified[0];
      const pName = getPlayerNameWithJersey(ne.playerId, allPlayers);
      const label = getEventLabel(ne.type);
      if (pe.timestamp !== ne.timestamp || pe.gameClock !== ne.gameClock || pe.quarter !== ne.quarter) {
        return `Ubah Waktu ${label} (${pName})`;
      }
      return `Ubah Detail ${label} (${pName})`;
    }
    // Check if they are all timestamp adjustments
    const allTimeAdjusted = modified.every(({ prev: pe, next: ne }) => pe.timestamp !== ne.timestamp);
    if (allTimeAdjusted) {
      return `Sesuaikan Waktu Game (${modified.length} kejadian)`;
    }
    return `Revisi Set Kejadian (Play Set)`;
  }

  return 'Ubah Data Kejadian';
};

export const TrackingPage: React.FC = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const timerWasRunningBeforePauseRef = React.useRef(false);
  const [overlayPosition, setOverlayPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>(() => {
    return (localStorage.getItem('overlayPosition') as any) || 'bottom-center';
  });

  const handleToggleOverlayPosition = () => {
    const positions: ('top-left' | 'top-right' | 'bottom-left' | 'bottom-right')[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
    // For migration from old value if any
    const validCurrent = positions.includes(overlayPosition) ? overlayPosition : 'bottom-left';
    const currentIndex = positions.indexOf(validCurrent);
    const nextIndex = (currentIndex + 1) % positions.length;
    const newPos = positions[nextIndex];
    setOverlayPosition(newPos);
    localStorage.setItem('overlayPosition', newPos);
  };
  
  const {
    match,
    setMatch,
    matchRosters,
    setMatchRosters,
    gameState,
    setGameState,
    events,
    setEvents,
    activePlayerId,
    setActivePlayerId,
    activeTeam,
    setActiveTeam,
    pendingShot,
    setPendingShot,
    handleToggleTimer: baseToggleTimer,
    handleResetTimer,
    handleNextQuarter,
    handleSetQuarter,
    updateMatchStatusToOngoing,
    isDataReady
  } = useGameTracking(gameId);

  // Office-style Undo/Redo States
  const [undoStack, setUndoStack] = useState<UndoRedoItem[]>([]);
  const [redoStack, setRedoStack] = useState<UndoRedoItem[]>([]);
  const isUndoingOrRedoingRef = React.useRef(false);
  const prevEventsRef = React.useRef<GameEvent[]>([]);
  const firstLoadRef = React.useRef(true);

  const handleToggleTimer = useCallback(async () => {
    // When manually toggling timer, we override the auto-resume memory
    timerWasRunningBeforePauseRef.current = false;
    await baseToggleTimer();
  }, [baseToggleTimer]);

  const [ourLogoUrl, setOurLogoUrl] = useState<string | undefined>();
  const [theirLogoUrl, setTheirLogoUrl] = useState<string | undefined>();
  const [ytPlayer, setYtPlayer] = useState<any | null>(null);

  useEffect(() => {
    if (match) {
      const fetchLogos = async () => {
        if (match.teamId) {
          const team = await statsService.getTeam(match.teamId);
          if (team?.clubId) {
            const club = await statsService.getClub(team.clubId);
            setOurLogoUrl(club?.logoUrl);
          }
        }
        if (match.opponentTeamId) {
          const team = await statsService.getTeam(match.opponentTeamId);
          if (team?.clubId) {
            const club = await statsService.getClub(team.clubId);
            setTheirLogoUrl(club?.logoUrl);
          }
        }
      };
      fetchLogos();
    }
  }, [match]);

  const initialPlaybackTime = useMemo(() => {
    if (!isDataReady || !match) return undefined;

    // Filter events that have valid youtubeTimestamp
    const validEvents = events.filter(e => e.youtubeTimestamp !== undefined && e.youtubeTimestamp !== null && e.youtubeTimestamp >= 0);
    const sortedEvents = sortEventsChronologically(validEvents);

    const isFinished = match.status === 'completed';

    if (isFinished) {
      // closed atau finished: play youtube in minute of 'jumpball' or match start (earliest event)
      const jumpball = events.find(e => e.type === 'jumpball');
      if (jumpball && jumpball.youtubeTimestamp !== undefined && jumpball.youtubeTimestamp !== null) {
        return jumpball.youtubeTimestamp;
      }
      if (sortedEvents.length > 0) {
        return sortedEvents[0].youtubeTimestamp || 0;
      }
      return 0; // fallback to video start
    } else {
      // not closed / finished (ongoing or planned): play youtube in minute of the last recorded log event
      if (sortedEvents.length > 0) {
        return sortedEvents[sortedEvents.length - 1].youtubeTimestamp || 0;
      }
      return 0; // fallback to video start
    }
  }, [isDataReady, match, events]);

  const [showLogs, setShowLogs] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showStarterModal, setShowStarterModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showEditMatchModal, setShowEditMatchModal] = useState(false);
  const [showStatsDashboard, setShowStatsDashboard] = useState(false);
  const [showCommentaryPanel, setShowCommentaryPanel] = useState(false);
  const [currentYoutubeTime, setCurrentYoutubeTime] = useState(0);

  // Synchronize game clock with YouTube video player timeline when video tracking is active (FSD)
  useVideoSyncTimer({
    match,
    gameState,
    setGameState,
    currentYoutubeTime
  });
  const [showClockEdit, setShowClockEdit] = useState(false);
  const [showAILineupModal, setShowAILineupModal] = useState(false);
  const [activeQuarterMarkers, setActiveQuarterMarkers] = useState<QuarterMarker[]>([]);

  useEffect(() => {
    if (match?.id) {
      TimelineStorageService.loadTimeline(match.id).then((tl) => {
        if (tl?.quarterMarkers) {
          setActiveQuarterMarkers(tl.quarterMarkers);
        }
      });
    }
  }, [match?.id, showAILineupModal]);
  const [isReloading, setIsReloading] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<VoiceFeedbackState>(null);
  const [enrichingEvent, setEnrichingEvent] = useState<GameEvent | null>(null);
  const [editingEventSet, setEditingEventSet] = useState<GameEvent | null>(null);
  const [isRevisingTime, setIsRevisingTime] = useState(false);
  const [timeRevisionBuffer, setTimeRevisionBuffer] = useState('');
  const [timeRevisionError, setTimeRevisionError] = useState<string | null>(null);
  const [showUtilitiesMenu, setShowUtilitiesMenu] = useState(false);
  const [starterTeam, setStarterTeam] = useState<'home' | 'away'>('home');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);

  const handleEditTeam = async (teamId: string) => {
    try {
      const [team, allClubs] = await Promise.all([
        statsService.getTeam(teamId),
        statsService.getClubs()
      ]);
      if (team) {
        setClubs(allClubs);
        setEditingTeam(team);
      } else {
        showToast('Tim tidak ditemukan', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat tim', 'error');
    }
  };

  const handleCorrectPlayer = async (playerOutId: string, playerInId: string) => {
    if (!match || !gameState) return;

    const teamId = activeTeam === 'home' 
      ? (match.teamId || 'home_team') 
      : (match.opponentTeamId || 'away_team');

    try {
      await statsService.correctPlayerInputError(match.id, teamId, playerOutId, playerInId);

      // Re-sync rosters and events state in TrackingPage to reflect the change immediately
      const freshEvents = await statsService.getEvents(match.id);
      setEvents(freshEvents);

      const freshRosters = await statsService.getMatchRosters(match.id);
      setMatchRosters(freshRosters);

      // Sync possessions and other gameState calculations
      await statsService.rebuildPossessions(match.id, match);
      await syncPossessionStateAfterRebuild();

      setVoiceFeedback({
        text: "Koreksi Pemain Berhasil",
        status: 'success',
        parsed: "✅ Berhasil mengganti pemain & mengoreksi statistik."
      });
    } catch (err) {
      console.error("Failed to apply player correction:", err);
      setVoiceFeedback({
        text: "Koreksi Gagal",
        status: 'error',
        reason: (err as Error).message
      });
    }
  };

  const syncRosterAfterEdit = async (teamId: string) => {
    if (!match || !teamId) return;
    try {
      const [allProfiles, targetTeam] = await Promise.all([
        statsService.getProfiles(),
        statsService.getTeam(teamId)
      ]);

      if (targetTeam) {
        // Find existing match rosters for this team
        const currentRosters = await statsService.getMatchRosters(match.id);
        const teamRosters = currentRosters.filter(r => r.teamId === teamId);

        // Children in team
        const childrenInTeam = allProfiles.filter(p => 
          p.mainTeamId === targetTeam.id || 
          p.schoolTeamId === targetTeam.id || 
          p.academyTeamId === targetTeam.id || 
          p.loanTeamId === targetTeam.id
        );

        const rosterEntries: MatchRoster[] = [];

        // Build entries from profiles
        childrenInTeam.forEach(p => {
          const existing = teamRosters.find(r => r.profileId === p.id);
          rosterEntries.push({
            id: `${match.id}_${p.id}`,
            matchId: match.id,
            teamId: teamId,
            profileId: p.id,
            name: p.name,
            jerseyNumber: p.jerseyNumber || '?',
            isStarter: existing ? existing.isStarter : false,
            isActive: existing ? existing.isActive : false
          });
        });

        // Build entries from team.roster
        if (targetTeam.roster) {
          targetTeam.roster.forEach(p => {
            if (!rosterEntries.some(r => r.profileId === p.id)) {
              const existing = teamRosters.find(r => r.profileId === p.id);
              rosterEntries.push({
                id: `${match.id}_${p.id}`,
                matchId: match.id,
                teamId: teamId,
                profileId: p.id,
                name: p.name,
                jerseyNumber: p.jersey || '?',
                isStarter: existing ? existing.isStarter : false,
                isActive: existing ? existing.isActive : false
              });
            }
          });
        }

        // Add or update to DB
        for (const entry of rosterEntries) {
          await statsService.addMatchRoster(entry);
        }

        // Refresh state
        const updatedRosters = await statsService.getMatchRosters(match.id);
        setMatchRosters(updatedRosters);
        showToast(`Roster ${targetTeam.name} berhasil disinkronisasi!`, 'success');
      }
    } catch (err) {
      console.error('Error syncing roster:', err);
      showToast('Gagal mensinkronisasikan roster', 'error');
    }
  };

  useEffect(() => {
    const handleTimeReport = (e: any) => {
      if (typeof e.detail === 'number') {
        setCurrentYoutubeTime((prev) => {
          // Only update state if second value changes or delta >= 0.5s to prevent video play stuttering
          if (Math.abs(prev - e.detail) >= 0.5 || Math.floor(prev) !== Math.floor(e.detail)) {
            return e.detail;
          }
          return prev;
        });
      }
    };
    window.addEventListener('youtube-time-report', handleTimeReport);
    
    const handleSyncWarning = (e: any) => {
      setVoiceFeedback(e.detail);
    };
    window.addEventListener('sync-warning', handleSyncWarning);

    const handleStoppageEvent = () => {
      timerWasRunningBeforePauseRef.current = false;
    };
    window.addEventListener('stoppage-event-logged', handleStoppageEvent);
    
    const interval = setInterval(() => {
      window.dispatchEvent(new CustomEvent('get-youtube-time'));
    }, 500);

    return () => {
      window.removeEventListener('youtube-time-report', handleTimeReport);
      window.removeEventListener('sync-warning', handleSyncWarning);
      window.removeEventListener('stoppage-event-logged', handleStoppageEvent);
      clearInterval(interval);
    };
  }, []);

  // Loop video for 3 seconds when pending shot coordinate selection is open
  useEffect(() => {
    if (pendingShot && pendingShot.youtubeTimestamp) {
      const ytTime = pendingShot.youtubeTimestamp;
      // Mute video so loop audio isn't annoying
      window.dispatchEvent(new CustomEvent('mute-youtube'));
      
      // Loop of 3 seconds around the shot (2 seconds before to 1 second after)
      const start = Math.max(0, ytTime - 2);
      const end = ytTime + 1;

      // Start looping
      window.dispatchEvent(new CustomEvent('start-loop-youtube', {
        detail: { start, end }
      }));
    } else {
      // Stop looping and resume normal play/unmute when closed
      window.dispatchEvent(new CustomEvent('stop-loop-youtube'));
      window.dispatchEvent(new CustomEvent('unmute-youtube'));
    }

    return () => {
      window.dispatchEvent(new CustomEvent('stop-loop-youtube'));
      window.dispatchEvent(new CustomEvent('unmute-youtube'));
    };
  }, [pendingShot]);

  const handleJumpToTime = (time: number) => {
    window.dispatchEvent(new CustomEvent('seek-youtube', { detail: time }));
    window.dispatchEvent(new CustomEvent('start-loop-youtube', { detail: { start: time, end: time + 5 } }));
  };

  const handleConfirmCommentaryEvent = async (draft: any) => {
    if (draft.parsedData?.type && draft.parsedData?.playerId) {
      const eventId = generateId('e');
      const newEvent: GameEvent = {
        id: eventId,
        matchId: match!.id,
        playerId: draft.parsedData.playerId,
        type: draft.parsedData.type,
        timestamp: draft.timestamp,
        quarter: gameState.currentQuarter,
        realTime: new Date().toISOString(),
        points: draft.parsedData.points,
        team: draft.parsedData.team,
        youtubeTimestamp: draft.timestamp
      };
      
      await statsService.addEvent(newEvent);
      setEvents(prev => [newEvent, ...prev]);
      
      if (draft.rawText && draft.parsedData.playerId) {
        const players = await statsService.getMatchRosters(match!.id);
        const player = players.find(p => p.profileId === draft.parsedData.playerId);
        if (player && draft.rawText.length < 30) {
          import('../core/services/knowledgeService').then(({ knowledgeService }) => {
            knowledgeService.addEntry('player', draft.rawText, player.profileId);
          });
        }
      }
    }
    window.dispatchEvent(new CustomEvent('stop-loop-youtube'));
  };

  const handleTimeRevisionStart = useCallback(async () => {
    if (!gameState) return;
    
    if (isRevisingTime) {
      // If user types * again, it cancels
      setIsRevisingTime(false);
      setTimeRevisionBuffer('');
      setTimeRevisionError(null);
      
      // Resume both
      window.dispatchEvent(new CustomEvent('play-youtube'));
      if (!gameState.isRunning) {
        handleToggleTimer();
      }
      return;
    }

    setIsRevisingTime(true);
    setTimeRevisionBuffer('');
    setTimeRevisionError(null);
    // Pause both
    if (gameState.isRunning) {
      handleToggleTimer();
    }
    window.dispatchEvent(new CustomEvent('pause-youtube'));
  }, [gameState, isRevisingTime, handleToggleTimer]);

  const confirmTimeRevision = useCallback(async (buffer: string) => {
    if (!gameState) return;

    // Pad with leading zeros if < 4 digits
    let padded = buffer;
    while (padded.length < 4) padded = '0' + padded;
    
    const mins = parseInt(padded.substring(0, 2));
    const secs = parseInt(padded.substring(2, 4));

    if (secs >= 60) {
      setTimeRevisionError('Format detik salah (max 59)');
      setTimeout(() => setTimeRevisionError(null), 1000);
      setTimeRevisionBuffer('');
      return;
    }

    const totalSecs = (mins * 60) + secs;

    const newState = { ...gameState, timeRemaining: totalSecs, isRunning: true };
    setGameState(newState);
    await statsService.saveGameState(newState);
    
    // Resume both
    window.dispatchEvent(new CustomEvent('play-youtube'));
    
    setIsRevisingTime(false);
    setTimeRevisionBuffer('');
    setTimeRevisionError(null);
  }, [gameState, setGameState]);

  const handleTimeRevisionDigit = useCallback((digit: string) => {
    if (timeRevisionBuffer.length < 4) {
      const newBuffer = timeRevisionBuffer + digit;
      setTimeRevisionBuffer(newBuffer);
      
      // Auto confirm on 4 digits
      if (newBuffer.length === 4) {
        confirmTimeRevision(newBuffer);
      }
    }
  }, [timeRevisionBuffer, confirmTimeRevision]);

  const handleTimeRevisionBackspace = useCallback(() => {
    if (timeRevisionBuffer.length > 0) {
      setTimeRevisionBuffer(prev => prev.slice(0, -1));
    }
  }, [timeRevisionBuffer]);

  const allPlayers = useMemo(() => {
    const unique = new Map<string, Player>();
    matchRosters.forEach(r => {
      const existing = unique.get(r.profileId);
      // Prefer active player if duplicates exist
      if (!existing || (!existing.isActive && r.isActive)) {
        unique.set(r.profileId, {
          id: r.profileId,
          name: r.name,
          jersey: r.jerseyNumber,
          isActive: r.isActive,
          isPlaceholder: false,
          isGuest: r.isGuest,
          guestForTeamId: r.guestForTeamId
        } as Player);
      }
    });
    return Array.from(unique.values());
  }, [matchRosters]);

  const currentRoster = useMemo(() => {
    if (!match) return [];
    const teamId = activeTeam === 'home' 
      ? (match.teamId || 'home_team') 
      : (match.opponentTeamId || 'away_team');
    
    const unique = new Map<string, Player>();
    matchRosters
      .filter(r => r.teamId === teamId)
      .forEach(r => {
        const existing = unique.get(r.profileId);
        // Prefer active player if duplicates exist
        if (!existing || (!existing.isActive && r.isActive)) {
          unique.set(r.profileId, {
            id: r.profileId,
            name: r.name,
            jersey: r.jerseyNumber,
            isActive: r.isActive,
            isPlaceholder: false,
            isGuest: r.isGuest,
            guestForTeamId: r.guestForTeamId
          } as Player);
        }
      });
    return Array.from(unique.values());
  }, [match, matchRosters, activeTeam]);

  /* Removed auto-showing starter modal to allow user to click 'Get Starter' manually */
  /*
  useEffect(() => {
    if (match && events.length === 0 && match.recordingType !== 'single') {
      const teamId = activeTeam === 'home' 
        ? (match.teamId || 'home_team') 
        : (match.opponentTeamId || 'away_team');
      const currentTeamRoster = matchRosters.filter(r => r.teamId === teamId);
      const activePlayersCount = currentTeamRoster?.filter(p => p.isActive).length || 0;
      if (activePlayersCount === 0) {
        setShowStarterModal(true);
      }
    }
  }, [match, events.length, activeTeam, matchRosters]);
  */

  const onTheFlySync = useOnTheFlyClockSync({
    matchId: match?.id,
    gameState,
    setGameState,
    setEvents,
    showToast,
  });

  const {
    activeInteraction,
    setInteraction,
    logEvent,
    undoLastEvent,
    handleSmartPromptSelect,
    deleteEvent,
    handleAdjustEventTime,
    handleAdjustYoutubeTime,
    handleConfigurableAction,
    activePossession,
    togglePossession,
    resetTrackingState,
    handleToggleRecordingMode,
    checkLineupIntegrity,
    startManualSub,
    triggerHeldBall,
    syncPossessionStateAfterRebuild
  } = useTrackingLogic({
    match,
    matchRosters,
    gameState,
    setGameState,
    events,
    setEvents,
    activePlayerId,
    setActivePlayerId,
    activeTeam,
    setActiveTeam,
    pendingShot,
    setPendingShot,
    updateMatchStatusToOngoing,
    allPlayers,
    onToggleTimer: handleToggleTimer,
    setMatchRosters,
    onEventRecorded: (newEvent, videoTimeSeconds) => {
      onTheFlySync.triggerOnTheFlySync(newEvent, videoTimeSeconds);
    },
  });

  // Track all changes to the events list automatically to generate clear descriptions
  useEffect(() => {
    if (isDataReady) {
      if (firstLoadRef.current) {
        prevEventsRef.current = events;
        firstLoadRef.current = false;
        return;
      }

      if (events !== prevEventsRef.current) {
        if (isUndoingOrRedoingRef.current) {
          prevEventsRef.current = events;
          return;
        }

        const description = getEventsDiffDescription(prevEventsRef.current, events, allPlayers);
        
        setUndoStack(prev => [
          ...prev,
          {
            id: generateId('undo'),
            description,
            events: prevEventsRef.current,
          } as any
        ]);
        setRedoStack([]);
        prevEventsRef.current = events;
      }
    }
  }, [events, isDataReady, allPlayers]);

  const handleUndo = async (count: number) => {
    if (undoStack.length === 0 || !match) return;
    
    isUndoingOrRedoingRef.current = true;
    try {
      let currentEvents = events;
      let nextEvents = events;
      const newUndoStack = [...undoStack];
      const newRedoStack = [...redoStack];

      for (let i = 0; i < count; i++) {
        const item = newUndoStack.pop();
        if (item) {
          newRedoStack.push({
            id: generateId('redo'),
            description: item.description,
            events: currentEvents,
            type: (item as any).type,
            timeRemaining: gameState?.timeRemaining
          } as any);

          if ((item as any).type === 'clock_sync' && gameState) {
            const prevTime = (item as any).timeRemaining;
            const newState = { ...gameState, timeRemaining: prevTime };
            setGameState(newState);
            await statsService.saveGameState(newState);
          }

          currentEvents = (item as any).events || currentEvents;
          nextEvents = (item as any).events || nextEvents;
        }
      }

      setUndoStack(newUndoStack);
      setRedoStack(newRedoStack);

      // Overwrite database
      await statsService.overwriteMatchEvents(match.id, nextEvents);

      // Trigger recalculation and rebuild of possessions
      await statsService.rebuildPossessions(match.id, match);
      await syncPossessionStateAfterRebuild();
    } catch (err) {
      console.error("Failed to perform undo:", err);
    } finally {
      isUndoingOrRedoingRef.current = false;
    }
  };

  const handleRedo = async (count: number) => {
    if (redoStack.length === 0 || !match) return;

    isUndoingOrRedoingRef.current = true;
    try {
      let currentEvents = events;
      let nextEvents = events;
      const newUndoStack = [...undoStack];
      const newRedoStack = [...redoStack];

      for (let i = 0; i < count; i++) {
        const item = newRedoStack.pop();
        if (item) {
          newUndoStack.push({
            id: generateId('undo'),
            description: item.description,
            events: currentEvents,
            type: (item as any).type,
            timeRemaining: gameState?.timeRemaining
          } as any);

          if ((item as any).type === 'clock_sync' && gameState) {
            const nextTime = (item as any).timeRemaining;
            const newState = { ...gameState, timeRemaining: nextTime };
            setGameState(newState);
            await statsService.saveGameState(newState);
          }

          currentEvents = (item as any).events || currentEvents;
          nextEvents = (item as any).events || nextEvents;
        }
      }

      setUndoStack(newUndoStack);
      setRedoStack(newRedoStack);

      // Overwrite database
      await statsService.overwriteMatchEvents(match.id, nextEvents);

      // Trigger recalculation and rebuild of possessions
      await statsService.rebuildPossessions(match.id, match);
      await syncPossessionStateAfterRebuild();
    } catch (err) {
      console.error("Failed to perform redo:", err);
    } finally {
      isUndoingOrRedoingRef.current = false;
    }
  };

  const handleSyncConfirm = async (confirmedSeconds: number, previousSeconds: number, syncPoint: ClockSyncPoint) => {
    if (!gameState || !match) return;

    const newState = { ...gameState, timeRemaining: confirmedSeconds };
    setGameState(newState);
    await statsService.saveGameState(newState);

    const mins = Math.floor(confirmedSeconds / 60);
    const secs = Math.floor(confirmedSeconds % 60);
    const clockStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    setUndoStack(prev => [
      ...prev,
      {
        id: generateId('undo'),
        description: `Clock Synced to ${clockStr}`,
        type: 'clock_sync',
        timeRemaining: previousSeconds,
        events: events,
      } as any
    ]);
    setRedoStack([]);
  };

  const handleEnrichEvent = (event: GameEvent) => {
    setEnrichingEvent(event);
  };

  const handleEnrichSuccess = (updatedEvent: GameEvent, next?: boolean) => {
    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    
    if (next) {
      // Find next event that is missing context
      const currentIndex = events.findIndex(e => e.id === updatedEvent.id);
      const nextEvents = events.slice(currentIndex + 1).filter(e => {
        const isShot = ['2pt_make', '3pt_make', '2pt_miss', '3pt_miss'].includes(e.type);
        const isTurnover = e.type === 'to';
        const isRebound = ['oreb', 'dreb'].includes(e.type);
        const isAssist = e.type === 'ast';
        
        if (isShot) return !e.x || !e.y || !e.shotDifficulty || !e.gameContext;
        if (isTurnover) return !e.subType || !e.gameContext;
        if (isRebound) return !e.reboundType || !e.gameContext;
        if (isAssist) return !e.assistType || !e.gameContext;
        return false;
      });

      if (nextEvents.length > 0) {
        setEnrichingEvent(nextEvents[0]);
      } else {
        setEnrichingEvent(null);
      }
    } else {
      setEnrichingEvent(null);
    }
  };

  const handleVoiceResult = useCallback((text: string) => {
    if (!match || !gameState) return;
    const result = parseVoiceCommand(text, allPlayers, match, matchRosters);
    
    if (result.status === 'success') {
      const player = allPlayers.find(p => p.id === result.playerId);
      const actionText = result.action.replace('_', ' ').replace('1pt', 'FT').toUpperCase();
      
      setVoiceFeedback({
        text,
        status: 'success',
        parsed: `✅ ${player?.name} - ${actionText}`
      });

      // Temporarily set active player to log event
      setActivePlayerId(result.playerId);
      // Use setTimeout to allow state to update before logging
      setTimeout(() => {
        logEvent(result.action, result.points, result.playerId);
      }, 0);
    } else if (result.status === 'ambiguous') {
      setVoiceFeedback({
        text,
        status: 'ambiguous',
        reason: result.reason
      });
    } else {
      setVoiceFeedback({
        text,
        status: 'error',
        reason: result.reason
      });
      console.log('Could not parse voice command:', text);
    }
  }, [match, gameState, allPlayers]);

  const { isListening, startListening, stopListening, supported } = useSpeechRecognition(handleVoiceResult);

  // Keyboard Shortcuts
  useKeyboardShortcuts({
    onHoldToSpeakStart: startListening,
    onHoldToSpeakEnd: stopListening,
    onSeekYoutube: (delta) => {
      window.dispatchEvent(new CustomEvent('seek-relative-youtube', { detail: delta }));
    },
    onPlayYoutube: () => {
      window.dispatchEvent(new CustomEvent('play-youtube'));
    },
    onStopYoutube: () => {
      window.dispatchEvent(new CustomEvent('pause-youtube'));
      // Khusus tombol D: jika youtube stop, timer juga stop
      if (gameState?.isRunning) {
        handleToggleTimer();
      }
    },
    onPlayTimer: () => {
      if (!gameState?.isRunning) {
        handleToggleTimer();
      }
    },
    onStopTimer: () => {
      if (gameState?.isRunning) {
        handleToggleTimer();
      }
    },
    onPlayBoth: () => {
      window.dispatchEvent(new CustomEvent('play-youtube'));
      if (!gameState?.isRunning) {
        handleToggleTimer();
      }
    },
    onStopBoth: () => {
      window.dispatchEvent(new CustomEvent('pause-youtube'));
      if (gameState?.isRunning) {
        handleToggleTimer();
      }
    },
    onToggleBoth: () => {
      // Check if youtube is playing by looking at the custom event or state if we had it
      // For now, we'll just toggle both based on timer state as a proxy, 
      // or better, dispatch a toggle event to youtube and toggle timer
      window.dispatchEvent(new CustomEvent('toggle-youtube-play'));
      handleToggleTimer();
    },
    onAdjustTimer: async (delta) => {
      if (gameState) {
        const newTime = Math.max(0, gameState.timeRemaining + delta);
        const newState = { ...gameState, timeRemaining: newTime };
        setGameState(newState);
        await statsService.saveGameState(newState);
      }
    },
    onTimeRevisionStart: handleTimeRevisionStart,
    onTimeRevisionDigit: handleTimeRevisionDigit,
    onTimeRevisionBackspace: handleTimeRevisionBackspace,
    isRevisingTime
  });
  
  const { 
    editingPlayer, 
    addPlaceholderPlayer, 
    updatePlayer, 
    openEditModal, 
    closeEditModal 
  } = usePlayerManagement(match, setMatch, matchRosters, setMatchRosters);

  const getYoutubeTime = async (): Promise<number> => {
    return new Promise<number>((resolve) => {
      const handler = (e: any) => {
        window.removeEventListener('youtube-time-report', handler);
        resolve(e.detail);
      };
      window.addEventListener('youtube-time-report', handler);
      window.dispatchEvent(new CustomEvent('get-youtube-time'));
      setTimeout(() => {
        window.removeEventListener('youtube-time-report', handler);
        resolve(0);
      }, 200);
    });
  };

  const handleSubstitute = async (playerOutIds: string[], playerInIds: string[]) => {
    if (!match || !gameState) return;

    const newEvents: GameEvent[] = [];
    const now = Date.now();
    const youtubeTimestamp = await getYoutubeTime();

    // Log sub outs
    playerOutIds.forEach((id, index) => {
      newEvents.push({
        id: generateId('sub'),
        matchId: match.id,
        playerId: id,
        type: 'sub_out',
        timestamp: gameState.timeRemaining,
        quarter: gameState.currentQuarter,
        realTime: new Date().toISOString(),
        youtubeTimestamp
      });
    });
    
    // Log sub ins
    playerInIds.forEach((id, index) => {
      newEvents.push({
        id: generateId('sub'),
        matchId: match.id,
        playerId: id,
        type: 'sub_in',
        timestamp: gameState.timeRemaining,
        quarter: gameState.currentQuarter,
        realTime: new Date().toISOString(),
        youtubeTimestamp
      });
    });

    setEvents(prev => [...prev, ...newEvents]);

    for (const event of newEvents) {
      await statsService.addEvent(event);
    }

    // Update MatchRoster
    const updatedRosters = matchRosters.map(r => {
      if (playerOutIds.includes(r.profileId)) return { ...r, isActive: false };
      if (playerInIds.includes(r.profileId)) return { ...r, isActive: true };
      return r;
    });
    setMatchRosters(updatedRosters);
    for (const r of updatedRosters) {
      if (playerOutIds.includes(r.profileId) || playerInIds.includes(r.profileId)) {
        await statsService.updateMatchRoster(r);
      }
    }

    // Update MatchStint
    const teamId = activeTeam === 'home' 
      ? (match.teamId || 'home_team') 
      : (match.opponentTeamId || 'away_team');
      
    await statsService.closeActiveMatchStint(match.id, teamId, gameState.currentQuarter, gameState.timeRemaining);
    
    const newActiveIds = updatedRosters.filter(r => r.teamId === teamId && r.isActive).map(r => r.profileId);
    if (newActiveIds.length === 5) {
      await statsService.openNextMatchStint(match.id, teamId, newActiveIds, gameState.currentQuarter, gameState.timeRemaining);
    }
  };

  const handleSetStarters = async (starterIds: string[]) => {
    if (!match) return;

    const teamId = starterTeam === 'home' 
      ? (match.teamId || 'home_team') 
      : (match.opponentTeamId || 'away_team');
      
    const updatedRosters = matchRosters.map(r => {
      if (r.teamId === teamId) {
        return { ...r, isActive: starterIds.includes(r.profileId), isStarter: starterIds.includes(r.profileId) };
      }
      return r;
    });
    setMatchRosters(updatedRosters);
    for (const r of updatedRosters) {
      if (r.teamId === teamId) {
        await statsService.updateMatchRoster(r);
      }
    }

    // Update MatchStint
    const currentQuarter = gameState?.currentQuarter || 1;
    const defaultDuration = (match.durationPerPeriod || 10) * 60;
    const timeRemaining = gameState?.timeRemaining ?? defaultDuration;
    
    const maxStarters = match.recordingType === 'single' ? 1 : match.gameType === '3x3' ? 3 : 5;
    
    if (starterIds.length === maxStarters) {
      await statsService.createInitialMatchStint(match.id, teamId, starterIds, currentQuarter, timeRemaining);
      
      // Log starter events for the log
      for (const profileId of starterIds) {
        await logEvent('starter', 0, profileId, undefined, undefined, true, undefined, timeRemaining, currentQuarter);
      }
    }

    // Logic for next step
    if (match.recordingType === 'full' && starterTeam === 'home') {
      setStarterTeam('away');
      setActiveTeam('away');
      // Keep modal open for next team
    } else {
      setShowStarterModal(false);
      setStarterTeam('home'); // Reset for next time
      setActiveTeam('home');
      
      // Trigger Jumpball prompt after starters are set
      setInteraction('smartPrompt', { type: 'jumpball' });
    }
  };

  const handleReloadRoster = async () => {
    if (!match || !match.teamId) {
      return;
    }
    
    setIsReloading(true);
    try {
      const [allProfiles, ourTeam] = await Promise.all([
        statsService.getProfiles(),
        statsService.getTeam(match.teamId)
      ]);

      if (ourTeam) {
        // Hydrate MatchRoster from team data
        const childrenInTeam = allProfiles.filter(p => 
          p.mainTeamId === ourTeam.id || 
          p.schoolTeamId === ourTeam.id || 
          p.academyTeamId === ourTeam.id || 
          p.loanTeamId === ourTeam.id
        );

        const rosterEntries: MatchRoster[] = [];
        
        // Add profiles
        childrenInTeam.forEach(p => {
          const existing = matchRosters.find(r => r.profileId === p.id && r.teamId === match.teamId);
          rosterEntries.push({
            id: `${match.id}_${p.id}`,
            matchId: match.id,
            teamId: match.teamId,
            profileId: p.id,
            name: p.name,
            jerseyNumber: p.jerseyNumber || '?',
            isStarter: existing ? existing.isStarter : false,
            isActive: existing ? existing.isActive : false
          });
        });

        // Add other team members
        ourTeam.roster.forEach(p => {
          if (!rosterEntries.some(r => r.profileId === p.id)) {
            const existing = matchRosters.find(r => r.profileId === p.id && r.teamId === match.teamId);
            rosterEntries.push({
              id: `${match.id}_${p.id}`,
              matchId: match.id,
              teamId: match.teamId,
              profileId: p.id,
              name: p.name,
              jerseyNumber: p.jersey || '?',
              isStarter: existing ? existing.isStarter : false,
              isActive: existing ? existing.isActive : false
            });
          }
        });

        for (const entry of rosterEntries) {
          await statsService.addMatchRoster(entry);
        }
        
        const newRosters = await statsService.getMatchRosters(match.id);
        setMatchRosters(newRosters);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsReloading(false);
    }
  };

  // Auto-switch team view based on possession
  useEffect(() => {
    if (activePossession?.teamInPossession) {
      setActiveTeam(activePossession.teamInPossession);
    }
  }, [activePossession?.teamInPossession]);

  const handleVideoPlay = useCallback(async () => {
    // Video play no longer automatically starts the timer to allow granular control
    // BUT user requested that if video plays, timer should also play to stay in sync
    // ONLY IF it was running before the pause
    await updateMatchStatusToOngoing();
    
    if (timerWasRunningBeforePauseRef.current) {
      setGameState(prev => {
        if (prev && !prev.isRunning) {
          const newState = { ...prev, isRunning: true };
          statsService.saveGameState(newState).catch(console.error);
          return newState;
        }
        return prev;
      });
    }
  }, [updateMatchStatusToOngoing, setGameState]);

  const handleVideoPause = useCallback(async () => {
    // Video pause now stops the timer to stay in sync
    setGameState(prev => {
      if (prev && prev.isRunning) {
        // Mark that it was running so we can resume automatically on play
        timerWasRunningBeforePauseRef.current = true;
        const newState = { ...prev, isRunning: false };
        statsService.saveGameState(newState).catch(console.error);
        return newState;
      }
      // If it wasn't running, don't auto-resume later
      timerWasRunningBeforePauseRef.current = false;
      return prev;
    });
  }, [setGameState]);

  const handleSaveVideoUrl = useCallback(async (url: string) => {
    if (!match) return;
    const updatedMatch = { ...match, videoUrl: url };
    setMatch(updatedMatch);
    await statsService.updateMatch(updatedMatch);
  }, [match, setMatch]);

  const handleSinglePlayerSub = async () => {
    if (!match || !gameState || currentRoster.length === 0) return;
    
    const player = currentRoster[0];
    const isCurrentlyActive = player.isActive;
    const newType = isCurrentlyActive ? 'sub_out' : 'sub_in';
    const youtubeTimestamp = await getYoutubeTime();
    
    const subEvent: GameEvent = {
      id: generateId('sub'),
      matchId: match.id,
      playerId: player.id,
      type: newType,
      timestamp: gameState.timeRemaining,
      quarter: gameState.currentQuarter,
      realTime: new Date().toISOString(),
      youtubeTimestamp
    };

    setEvents(prev => [...prev, subEvent]);
    await statsService.addEvent(subEvent);

    // Update MatchRoster
    const rosterId = `${match.id}_${player.id}`;
    const existingRoster = matchRosters.find(r => r.id === rosterId);
    let newActiveIds: string[] = [];
    if (existingRoster) {
      const updatedRoster = { ...existingRoster, isActive: !isCurrentlyActive };
      setMatchRosters(prev => {
        const newRosters = prev.map(r => r.id === rosterId ? updatedRoster : r);
        newActiveIds = newRosters.filter(r => r.teamId === existingRoster.teamId && r.isActive).map(r => r.profileId);
        return newRosters;
      });
      await statsService.updateMatchRoster(updatedRoster);
      
      // Update MatchStint
      await statsService.closeActiveMatchStint(match.id, existingRoster.teamId, gameState.currentQuarter, gameState.timeRemaining);
      // For single player, we might not have 5 players, but we should still track stints if possible, or skip 5-player check for single player mode.
      // Since the prompt says "prevent opening a stint if playerIds length is not exactly 5", we might need to bypass or adjust for single player.
      // Actually, let's just pass the active IDs. The service checks for length === 5, so it will return null and not create a stint if < 5.
      // This is safe and complies with the integrity check.
      await statsService.openNextMatchStint(match.id, existingRoster.teamId, newActiveIds, gameState.currentQuarter, gameState.timeRemaining);
    }
  };

  if (!match || !gameState) return <div className="p-8 text-white">Loading...</div>;

  const isGameStarted = gameState.timeRemaining < (match.durationPerPeriod * 60) || gameState.isRunning || gameState.currentQuarter > 1;

  const handleRestart = async () => {
    if (!match || !gameState) return;
    // Delete all events
    for (const event of events) {
      await statsService.removeEvent(match.id, event.id);
    }
    setEvents([]);
    
    // Reset player rosters (isActive and isStarter should be false)
    const resetRosters = matchRosters.map(r => ({ ...r, isStarter: false, isActive: false }));
    setMatchRosters(resetRosters);
    for (const r of resetRosters) {
      await statsService.updateMatchRoster(r);
    }

    // Delete stints
    const stints = await statsService.getMatchStints(match.id);
    for (const s of stints) {
       await statsService.deleteStint(s.id);
    }

    // Reset game state
    const resetState: GameState = {
      ...gameState,
      homeScore: 0,
      awayScore: 0,
      homeFouls: 0,
      awayFouls: 0,
      homeTimeouts: 0,
      awayTimeouts: 0,
      currentQuarter: 1,
      timeRemaining: match.durationPerPeriod * 60,
      isRunning: false
    };
    setGameState(resetState);
    await statsService.saveGameState(resetState);
    await statsService.rebuildPossessions(match.id, match);

    // Reset modals and selections
    setShowStarterModal(false);
    setEnrichingEvent(null);
    setActivePlayerId(null);
    resetTrackingState();
  };

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-[#F8F9FA] dark:bg-zinc-950 text-[#1A1A1A] dark:text-white transition-colors font-sans">
      <TrackingHeader
        match={match}
        gameState={gameState}
        theme={theme}
        isReloading={isReloading}
        showLogs={showLogs}
        onBack={async () => {
          if (gameState && gameState.isRunning) {
            const newState = { ...gameState, isRunning: false };
            setGameState(newState);
            await statsService.saveGameState(newState);
          }
          navigate('/');
        }}
        onFinish={async () => {
          const updatedMatch = { ...match, status: 'completed' as const };
          setMatch(updatedMatch);
          await statsService.updateMatch(updatedMatch);
          
          // Mark stat request as completed if relevant
          const requestId = localStorage.getItem(`request_match_${match.id}`);
          if (requestId) {
            import('../services/requestService').then(({ requestService }) => {
              requestService.updateRequestStatus(requestId, 'completed', { matchId: match.id });
            });
          }

          if (gameState) {
            const newState = { ...gameState, isRunning: false };
            setGameState(newState);
            await statsService.saveGameState(newState);
          }
          showToast('Pertandingan telah diselesaikan! Statistik telah diperbarui.', 'success');
          navigate(`/match/${match.id}`);
        }}
        onShowEditMatch={() => setShowEditMatchModal(true)}
        onShowStatsDashboard={() => setShowStatsDashboard(true)}
        onToggleTheme={toggleTheme}
        onToggleLogs={() => setShowLogs(!showLogs)}
        onToggleRecordingMode={handleToggleRecordingMode}
      />
      
      <TimeRevisionOverlay
        isRevisingTime={isRevisingTime}
        timeRevisionBuffer={timeRevisionBuffer}
        error={timeRevisionError}
      />
      
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Desktop Video Player Panel (Left) */}
        <aside className="hidden lg:flex flex-1 border-r border-zinc-100 dark:border-zinc-800 bg-black flex-col shrink-0 transition-all duration-500 relative">
          <VideoPlayerPanel 
            onPlay={handleVideoPlay} 
            onPause={handleVideoPause} 
            videoUrl={match.videoUrl} 
            onSaveVideoUrl={handleSaveVideoUrl} 
            initialStartTime={initialPlaybackTime}
            overlayPosition={overlayPosition}
            onToggleOverlayPosition={handleToggleOverlayPosition}
            isClockRunning={gameState?.isRunning}
            clockMode={match.clockMode}
            onPlayerReady={setYtPlayer}
          />

          <VideoEventOverlay 
            events={events} 
            currentYoutubeTime={currentYoutubeTime} 
            matchRosters={matchRosters} 
            homeTeamId={match.teamId || 'home_team'}
            homeTeamName={match.ourHomeAway === 'away' ? (match.theirTeamName || 'Lawan') : (match.ourTeamName || match.name || 'Kita')}
            awayTeamName={match.ourHomeAway === 'away' ? (match.ourTeamName || match.name || 'Kita') : (match.theirTeamName || 'Lawan')}
            ourHomeAway={match.ourHomeAway}
            ourColor={match.ourColor}
            theirColor={match.theirColor}
            position={overlayPosition}
          />
          <VideoScoreboardDrawer
            events={events}
            currentYoutubeTime={currentYoutubeTime}
            matchRosters={matchRosters}
            match={match}
            overlayPosition={overlayPosition}
          />
        </aside>

        {/* Main Stats Panel (Right on Desktop, Full on Mobile) */}
        <div className="flex-1 lg:flex-none lg:w-[400px] xl:w-[450px] flex flex-col h-full bg-[#F8F9FA] dark:bg-zinc-950 relative">
          
          <SubstitutionModal 
            isOpen={showSubModal} 
            onClose={() => setShowSubModal(false)} 
            roster={currentRoster} 
            onSubstitute={handleSubstitute} 
            onQuickAdd={() => addPlaceholderPlayer(activeTeam)}
            teamColor={activeTeam === 'home' ? match.ourColor : match.theirColor}
            teamTheme={activeTeam === 'home' ? match.ourTheme : match.theirTheme}
            sidePanel={true}
          />

          <PlayerCorrectionModal
            isOpen={showCorrectionModal}
            onClose={() => setShowCorrectionModal(false)}
            roster={currentRoster}
            onCorrectPlayer={handleCorrectPlayer}
            teamColor={activeTeam === 'home' ? match.ourColor : match.theirColor}
            teamTheme={activeTeam === 'home' ? match.ourTheme : match.theirTheme}
            sidePanel={true}
          />

          <StarterSelectionModal
            isOpen={showStarterModal}
            onClose={() => setShowStarterModal(false)}
            roster={matchRosters
              .filter(r => r.teamId === (starterTeam === 'home' ? (match?.teamId || 'home_team') : (match?.opponentTeamId || 'away_team')))
              .map(r => ({
                id: r.profileId,
                name: r.name,
                jersey: r.jerseyNumber,
                isActive: r.isActive,
                isPlaceholder: false
              } as Player))
            }
            onConfirm={handleSetStarters}
            maxStarters={match.recordingType === 'single' ? 1 : match.gameType === '3x3' ? 3 : 5}
            onQuickAdd={() => addPlaceholderPlayer(starterTeam)}
            onEditTeam={() => handleEditTeam(starterTeam === 'home' ? (match?.teamId || 'home_team') : (match?.opponentTeamId || 'away_team'))}
            teamColor={starterTeam === 'home' ? match.ourColor : match.theirColor}
            teamTheme={starterTeam === 'home' ? match.ourTheme : match.theirTheme}
            teamName={
              starterTeam === 'home'
                ? (match?.ourHomeAway === 'away' ? match?.theirTeamName : (match?.ourTeamName || match?.name))
                : (match?.ourHomeAway === 'away' ? (match?.ourTeamName || match?.name) : match?.theirTeamName)
            }
            sidePanel={true}
          />

          <EditMatchModal 
            isOpen={showEditMatchModal}
            onClose={() => setShowEditMatchModal(false)}
            match={match}
            onSuccess={async (updatedMatch) => {
              const oldHomeId = match.teamId || 'home_team';
              const oldAwayId = match.opponentTeamId || 'away_team';
              const newHomeId = updatedMatch.teamId || 'home_team';
              const newAwayId = updatedMatch.opponentTeamId || 'away_team';

              setMatch(updatedMatch);

              // If team IDs changed, we must update matchRosters to maintain match for currentRoster memo
              if (oldHomeId !== newHomeId || oldAwayId !== newAwayId) {
                const updatedRosters = matchRosters.map(r => {
                  if (r.teamId === oldHomeId) return { ...r, teamId: newHomeId };
                  if (r.teamId === oldAwayId) return { ...r, teamId: newAwayId };
                  return r;
                });
                setMatchRosters(updatedRosters);
                // Also persist to DB
                for (const r of updatedRosters) {
                  await statsService.updateMatchRoster(r);
                }
              }
            }}
            onRestart={handleRestart}
            onReloadRoster={handleReloadRoster}
            isReloading={isReloading}
            sidePanel={true}
            onEditTeam={handleEditTeam}
          />

          <ShotChartModal
            isOpen={!!pendingShot}
            onClose={() => setPendingShot(null)}
            points={pendingShot?.type.includes('3pt') ? 3 : pendingShot?.type.includes('2pt') ? 2 : undefined}
            onSelectLocation={(x, y) => {
              if (pendingShot) {
                logEvent(
                  pendingShot.type,
                  pendingShot.points,
                  pendingShot.playerId,
                  x,
                  y,
                  false, // skipSmartPrompt
                  undefined, // subType
                  undefined, // customTimestamp
                  undefined, // customQuarter
                  pendingShot.youtubeTimestamp // customYoutubeTimestamp
                );
                setPendingShot(null);
              }
            }}
            sidePanel={true}
          />

          <ClockEditModal
            isOpen={showClockEdit}
            onClose={() => setShowClockEdit(false)}
            currentTime={gameState.timeRemaining}
            onSave={async (newTime) => {
              const newState = { ...gameState, timeRemaining: newTime };
              setGameState(newState);
              await statsService.saveGameState(newState);
            }}
            sidePanel={true}
          />

          <PlayerEditModal
            isOpen={!!editingPlayer}
            onClose={closeEditModal}
            player={editingPlayer?.player || null}
            onSave={(updatedPlayer) => {
              if (editingPlayer) {
                updatePlayer(editingPlayer.team, updatedPlayer);
              }
            }}
            sidePanel={true}
          />

          {editingTeam && (
            <TeamFormModal
              team={editingTeam}
              clubs={clubs}
              onClose={() => setEditingTeam(null)}
              onSave={async () => {
                const teamId = editingTeam.id;
                setEditingTeam(null);
                await syncRosterAfterEdit(teamId);
              }}
              refreshClubs={async () => {
                const allClubs = await statsService.getClubs();
                setClubs(allClubs);
              }}
            />
          )}

          {match && gameState && (
            <LiveStatsDashboard
              isOpen={showStatsDashboard}
              onClose={() => setShowStatsDashboard(false)}
              events={events}
              players={allPlayers}
              gameState={gameState}
              homeTeamName={match.ourHomeAway === 'away' ? (match.theirTeamName || 'Opponent') : (match.ourTeamName || match.name)}
              awayTeamName={match.ourHomeAway === 'away' ? (match.ourTeamName || match.name) : (match.theirTeamName || 'Opponent')}
              homeLogoUrl={match.ourHomeAway === 'away' ? theirLogoUrl : ourLogoUrl}
              awayLogoUrl={match.ourHomeAway === 'away' ? ourLogoUrl : theirLogoUrl}
              ourHomeAway={match.ourHomeAway}
              sidePanel={true}
            />
          )}

          <ActionDrawer
            isOpen={!!activePlayerId && match.recordingType !== 'single'}
            onClose={() => setActivePlayerId(null)}
            player={activePlayerId === 'away_team' ? { id: 'away_team', name: match.theirTeamName || 'Opponent Team', displayName: match.theirTeamName || 'Opponent Team', jersey: '-', isActive: true } : (currentRoster.find(p => p.id === activePlayerId) || null)}
            onLogEvent={(type, points, pId, x, y, skipSmartPrompt, subType, customTimestamp, customQuarter, customYoutubeTimestamp, metadata) => 
              logEvent(type, points ?? 0, pId || activePlayerId || undefined, x, y, skipSmartPrompt, subType, customTimestamp, customQuarter, customYoutubeTimestamp, metadata)
            }
            onEditPlayer={activePlayerId === 'away_team' ? undefined : () => {
              const player = currentRoster.find(p => p.id === activePlayerId);
              if (player) {
                setActivePlayerId(null);
                openEditModal(player, activeTeam);
              }
            }}
            sidePanel={true}
            match={match}
            matchRosters={matchRosters}
            gameState={gameState}
            currentYoutubeTime={currentYoutubeTime}
          />

          <SmartPromptManager
            match={match}
            matchRosters={matchRosters}
            events={events}
            activePossession={activePossession}
            activeInteraction={activeInteraction}
            setInteraction={setInteraction}
            handleSmartPromptSelect={handleSmartPromptSelect}
            handleConfigurableAction={handleConfigurableAction}
            allPlayers={allPlayers}
          />
           {enrichingEvent && match && (
            <EventEnrichmentModal
              isOpen={!!enrichingEvent}
              onClose={() => setEnrichingEvent(null)}
              event={enrichingEvent}
              onSuccess={handleEnrichSuccess}
              match={match}
              allPlayers={allPlayers}
              matchRosters={matchRosters}
              sidePanel={true}
            />
          )}
          {editingEventSet && match && (
            <EventSetEditorModal
              isOpen={!!editingEventSet}
              onClose={() => setEditingEventSet(null)}
              event={editingEventSet}
              onSuccess={async () => {
                await syncPossessionStateAfterRebuild();
              }}
              match={match}
              allPlayers={allPlayers}
              matchRosters={matchRosters}
              allEvents={events}
            />
          )}
          <main className="flex-1 overflow-y-auto p-2 flex flex-col relative">
            <div className="flex gap-2 mb-2 relative">
              <button
                onClick={() => setShowCommentaryPanel(!showCommentaryPanel)}
                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border ${
                  showCommentaryPanel 
                    ? 'bg-brand-navy text-white border-brand-navy' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <Mic size={12} />
                Commentator
              </button>

              <button
                onClick={() => setShowCorrectionModal(true)}
                className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all flex items-center justify-center gap-1.5"
                title="Koreksi / Replace Pemain"
              >
                <ArrowRightLeft size={12} />
                <span>Replace</span>
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setShowUtilitiesMenu(!showUtilitiesMenu)}
                  className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border ${
                    showUtilitiesMenu
                      ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <MoreHorizontal size={14} />
                  <span>Adv. Actions</span>
                </button>
                
                {showUtilitiesMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowUtilitiesMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-1.5 space-y-0.5">
                        <button
                          onClick={() => {
                            setShowSubModal(true);
                            setShowUtilitiesMenu(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                        >
                          <RefreshCw size={12} />
                          Refresh Lineup
                        </button>
                        <button
                          onClick={() => {
                            setShowSubModal(true);
                            setShowUtilitiesMenu(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                        >
                          <Plus size={12} />
                          Manual Sub
                        </button>
                        <button
                          onClick={() => {
                            setShowCorrectionModal(true);
                            setShowUtilitiesMenu(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-800/60 mt-1 pt-1.5"
                        >
                          <ArrowRightLeft size={12} />
                          Koreksi Pemain (Replace)
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("Seluruh data event yang sudah dicatat akan dihapus selamanya. Lanjutkan?")) {
                              handleRestart();
                            }
                            setShowUtilitiesMenu(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center gap-2 mt-1 pt-1.5"
                        >
                          <RefreshCw size={12} className="text-red-500" />
                          Restart Match
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <Scoreboard 
              homeScore={match.ourHomeAway === 'away' ? gameState.awayScore : gameState.homeScore}
              awayScore={match.ourHomeAway === 'away' ? gameState.homeScore : gameState.awayScore}
              homeFouls={match.ourHomeAway === 'away' ? gameState.awayFouls : gameState.homeFouls}
              awayFouls={match.ourHomeAway === 'away' ? gameState.homeFouls : gameState.awayFouls}
              homeTimeouts={match.ourHomeAway === 'away' ? gameState.awayTimeouts : gameState.homeTimeouts}
              awayTimeouts={match.ourHomeAway === 'away' ? gameState.homeTimeouts : gameState.awayTimeouts}
              homeLabel={match.ourHomeAway === 'away' ? match.theirTeamName || "Lawan" : match.ourTeamName || "Kita"}
              awayLabel={match.ourHomeAway === 'away' ? match.ourTeamName || "Kita" : match.theirTeamName || "Lawan"}
              quarter={gameState.currentQuarter}
              totalPeriods={match.periodCount}
              clockMode={match.clockMode}
              timeRemaining={gameState.timeRemaining}
              isRunning={gameState.isRunning}
              onToggleTimer={handleToggleTimer}
              onResetTimer={handleResetTimer}
              onNextQuarter={handleNextQuarter}
              onPrevQuarter={() => {
                if (gameState && gameState.currentQuarter > 1) {
                  handleSetQuarter(gameState.currentQuarter - 1);
                }
              }}
              onShowStats={() => setShowStatsDashboard(true)}
              onClockClick={() => setShowClockEdit(true)}
              onHomeTimeout={() => logEvent('timeout', 0, match.ourHomeAway === 'away' ? 'away_team' : 'home_team')}
              onAwayTimeout={() => logEvent('timeout', 0, match.ourHomeAway === 'away' ? 'home_team' : 'away_team')}
              ourColor={match.ourHomeAway === 'away' ? match.theirColor : match.ourColor}
              theirColor={match.ourHomeAway === 'away' ? match.ourColor : match.theirColor}
              ourTheme={match.ourHomeAway === 'away' ? match.theirTheme : match.ourTheme}
              theirTheme={match.ourHomeAway === 'away' ? match.ourTheme : match.theirTheme}
              activePossession={activePossession}
              activeTeam={activeTeam}
              onTogglePossession={togglePossession}
              match={match}
            />

            <ClockSyncPanel 
              matchId={match.id}
              currentQuarter={gameState.currentQuarter}
              timeRemaining={gameState.timeRemaining}
              currentYoutubeTime={currentYoutubeTime}
              ytPlayer={ytPlayer}
              onSyncConfirm={handleSyncConfirm}
              onTheFlyEnabled={onTheFlySync.isEnabled}
              onToggleOnTheFly={onTheFlySync.toggleEnabled}
              onOpenAILineupModal={() => setShowAILineupModal(true)}
            />

            {showCommentaryPanel ? (
              <div className="flex-1 overflow-hidden relative">
                <CommentaryPanel 
                  matchId={match.id}
                  currentYoutubeTime={currentYoutubeTime}
                  onJumpToTime={handleJumpToTime}
                  onConfirmEvent={handleConfirmCommentaryEvent}
                  lastEvent={events.length > 0 ? events[0] : undefined}
                />
              </div>
            ) : showLogs ? (
              <EventLogPanel
                events={events}
                allPlayers={allPlayers}
                undoLastEvent={undoLastEvent}
                deleteEvent={deleteEvent}
                handleAdjustEventTime={handleAdjustEventTime}
                handleAdjustYoutubeTime={handleAdjustYoutubeTime}
                onEnrich={handleEnrichEvent}
                onEditSet={setEditingEventSet}
                match={match}
                currentYoutubeTime={currentYoutubeTime}
                undoStack={undoStack}
                redoStack={redoStack}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />
            ) : (
              <div className="flex-1 flex flex-col justify-between">
                {/* Player Selection (Hidden for Single Player) */}
                {match.recordingType !== 'single' && (
                  <PlayerSelectionGrid
                    match={match}
                    activeTeam={activeTeam}
                    setActiveTeam={setActiveTeam}
                    activePlayerId={activePlayerId}
                    setActivePlayerId={setActivePlayerId}
                    currentRoster={currentRoster}
                    isGameStarted={isGameStarted}
                    setShowStarterModal={(show) => {
                      setStarterTeam(activeTeam);
                      setShowStarterModal(show);
                    }}
                    setShowSubModal={setShowSubModal}
                    logEvent={logEvent}
                    activePossession={activePossession}
                    onTogglePossession={togglePossession}
                    triggerHeldBall={triggerHeldBall}
                    gameState={gameState}
                    onToggleTimer={handleToggleTimer}
                    onOpenAILineupModal={() => setShowAILineupModal(true)}
                  />
                )}

                {/* Action Grid (Only for Single Player) */}
                {match.recordingType === 'single' && (
                  <SinglePlayerActions 
                    match={match}
                    matchRosters={matchRosters}
                    playerName={currentRoster.find(p => p.id === match.childId)?.name || currentRoster?.[0]?.name || ''}
                    playerId={currentRoster.find(p => p.id === match.childId)?.id || currentRoster?.[0]?.id || ''}
                    isActive={currentRoster.find(p => p.id === match.childId)?.isActive ?? currentRoster?.[0]?.isActive ?? false}
                    onSubToggle={handleSinglePlayerSub}
                    onLogEvent={logEvent}
                  />
                )}
              </div>
            )}
            
            {/* Floating Undo/Redo Buttons */}
            {!showCommentaryPanel && !showLogs && (undoStack.length > 0 || redoStack.length > 0) && (
              <div className="absolute bottom-4 right-4 z-[40] flex items-center gap-2">
                {undoStack.length > 0 && (
                  <button 
                    onClick={() => handleUndo(1)}
                    className="bg-white dark:bg-zinc-800 shadow-lg border border-zinc-200 dark:border-zinc-700 rounded-full px-4 py-2.5 flex items-center gap-2 text-zinc-600 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors active:scale-95"
                    title={undoStack[undoStack.length - 1]?.description}
                  >
                    <Undo size={16} /> Undo
                  </button>
                )}
                {redoStack.length > 0 && (
                  <button 
                    onClick={() => handleRedo(1)}
                    className="bg-white dark:bg-zinc-800 shadow-lg border border-zinc-200 dark:border-zinc-700 rounded-full px-4 py-2.5 flex items-center gap-2 text-zinc-600 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors active:scale-95"
                    title={redoStack[redoStack.length - 1]?.description}
                  >
                    <Redo size={16} /> Redo
                  </button>
                )}
              </div>
            )}
          </main>

      {/* AI & Voice Integration Bar */}
      <div className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-2 pb-safe shrink-0 flex gap-2 transition-colors z-10 relative">
        {/* Voice Feedback Toast */}
        <VoiceFeedbackToast feedback={voiceFeedback} onClose={() => setVoiceFeedback(null)} />

        <button 
          onPointerDown={(e) => { e.preventDefault(); startListening(); }}
          onPointerUp={(e) => { e.preventDefault(); stopListening(); }}
          onPointerLeave={stopListening}
          className={`flex-1 p-3 rounded-xl font-bold tracking-wide flex items-center justify-center gap-2 transition-all select-none touch-none ${
            isListening 
              ? 'bg-red-500 text-white shadow-inner scale-95' 
              : supported 
                ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy shadow-sm hover:opacity-90'
                : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed'
          }`}
          disabled={!supported}
        >
          <Mic size={18} className={isListening ? 'animate-pulse' : ''} />
          {isListening ? 'LISTENING...' : supported ? 'HOLD TO SPEAK (Z)' : 'NOT SUPPORTED'}
        </button>
        <button className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 p-3 rounded-xl font-bold flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          <Upload size={18} />
        </button>
      </div>
    </div>
    </div>


      {/* AI Lineup & Jersey Number Detection Modal */}
      {showAILineupModal && match && (
        <AILineupDetectorModal
          isOpen={showAILineupModal}
          onClose={() => setShowAILineupModal(false)}
          matchId={match.id}
          teamId={match.teamId || ''}
          opponentTeamId={match.opponentTeamId || ''}
          ourTeamName={match.ourTeamName || 'Tim Kami'}
          theirTeamName={match.theirTeamName || 'Tim Lawan'}
          quarterMarkers={activeQuarterMarkers}
          ytPlayer={ytPlayer}
          currentYoutubeTime={currentYoutubeTime}
          onRosterUpdated={async () => {
            const freshRosters = await statsService.getMatchRosters(match.id);
            if (freshRosters) {
              setMatchRosters(freshRosters);
            }
            showToast('Roster lineup & nomor punggung berhasil diperbarui!', 'success');
          }}
        />
      )}
    </div>
  );
};

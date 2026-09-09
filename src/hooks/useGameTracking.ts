import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { statsService } from '../core/services/statsService';
import { Match, GameState, GameEvent, EventType, Player, MatchRoster } from '../core/types/stats';

import { sortEventsChronologically } from '../core/services/possessionEngine';

export const useGameTracking = (gameId: string | undefined) => {
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [matchRosters, setMatchRosters] = useState<MatchRoster[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home');
  const [pendingShot, setPendingShot] = useState<{ type: EventType, points: number, playerId?: string, youtubeTimestamp?: number } | null>(null);
  const [isDataReady, setIsDataReady] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    
    const loadGame = async () => {
      try {
        setIsDataReady(false);
        const m = await statsService.getMatch(gameId);
        if (!m) {
          navigate('/');
          return;
        }
        
        const homeTeamId = m.teamId || 'home_team';
        const awayTeamId = m.opponentTeamId || 'away_team';
        
        let matchUpdated = false;

        // Ensure match rosters exist for tracking
        let rosters = await statsService.getMatchRosters(gameId);
        
        if (rosters.length === 0) {
          // Try to get profiles for home team
          const [allProfiles, ourTeam] = await Promise.all([
            statsService.getProfiles(),
            m.teamId ? statsService.getTeam(m.teamId) : Promise.resolve(null)
          ]);

          const homeRosterEntries: MatchRoster[] = [];

          // Always add the selected child first if selected
          if (m.childId) {
            const childProfile = allProfiles.find(p => p.id === m.childId);
            if (childProfile) {
              homeRosterEntries.push({
                id: `${gameId}_${childProfile.id}`,
                matchId: gameId,
                teamId: homeTeamId,
                profileId: childProfile.id,
                name: childProfile.name,
                jerseyNumber: childProfile.jerseyNumber || '?',
                isStarter: true,
                isActive: true
              });
            }
          }

          if (ourTeam) {
            const childrenInTeam = allProfiles.filter(p => 
              p.mainTeamId === ourTeam.id || 
              p.schoolTeamId === ourTeam.id || 
              p.academyTeamId === ourTeam.id || 
              p.loanTeamId === ourTeam.id
            );

            childrenInTeam.forEach((p, index) => {
              if (!homeRosterEntries.some(r => r.profileId === p.id)) {
                homeRosterEntries.push({
                  id: `${gameId}_${p.id}`,
                  matchId: gameId,
                  teamId: homeTeamId,
                  profileId: p.id,
                  name: p.name,
                  jerseyNumber: p.jerseyNumber || '?',
                  isStarter: m.recordingType === 'single' ? false : false,
                  isActive: m.recordingType === 'single' ? false : false
                });
              }
            });
          }

          if (homeRosterEntries.length === 0) {
            // Fallback placeholders
            for (let i = 1; i <= 5; i++) {
              homeRosterEntries.push({
                id: `${gameId}_h${i}`,
                matchId: gameId,
                teamId: homeTeamId,
                profileId: `h${i}`,
                name: `Pemain ${i}`,
                jerseyNumber: `${i}`,
                isStarter: m.recordingType === 'single' ? i === 1 : false,
                isActive: m.recordingType === 'single' ? i === 1 : false
              });
            }
          }

          for (const r of homeRosterEntries) {
            await statsService.addMatchRoster(r);
          }

          // Away roster for full mode
          if (m.recordingType === 'full') {
            const awayRosterEntries: MatchRoster[] = [];
            if (m.opponentTeamId) {
              const theirTeam = await statsService.getTeam(m.opponentTeamId);
              if (theirTeam && theirTeam.roster) {
                theirTeam.roster.forEach(p => {
                  awayRosterEntries.push({
                    id: `${gameId}_${p.id}`,
                    matchId: gameId,
                    teamId: awayTeamId,
                    profileId: p.id,
                    name: p.name,
                    jerseyNumber: p.jersey || '?',
                    isStarter: false,
                    isActive: false
                  });
                });
              }
            }

            if (awayRosterEntries.length === 0) {
              for (let i = 1; i <= 5; i++) {
                awayRosterEntries.push({
                  id: `${gameId}_a${i}`,
                  matchId: gameId,
                  teamId: awayTeamId,
                  profileId: `a${i}`,
                  name: `Lawan ${i}`,
                  jerseyNumber: `${i}`,
                  isStarter: false,
                  isActive: false
                });
              }
            }

            for (const r of awayRosterEntries) {
              await statsService.addMatchRoster(r);
            }
          }
          
          rosters = await statsService.getMatchRosters(gameId);
        }
        
        // Deduplicate rosters by profileId and teamId to avoid duplicate keys in UI
        const uniqueRosters = new Map<string, MatchRoster>();
        rosters.forEach(r => {
          const key = `${r.profileId}_${r.teamId}`;
          const existing = uniqueRosters.get(key);
          // Prefer active player if duplicates exist
          if (!existing || (!existing.isActive && r.isActive)) {
            uniqueRosters.set(key, r);
          }
        });
        rosters = Array.from(uniqueRosters.values());
        
        setMatch(m);
        
        // Sync rosters if team IDs changed
        const syncedRosters = rosters.map(r => {
          if (r.teamId === 'home_team' && m.teamId) return { ...r, teamId: m.teamId };
          if (r.teamId === 'away_team' && m.opponentTeamId) return { ...r, teamId: m.opponentTeamId };
          return r;
        });

        if (JSON.stringify(syncedRosters) !== JSON.stringify(rosters)) {
          for (const r of syncedRosters) {
            await statsService.updateMatchRoster(r);
          }
          setMatchRosters(syncedRosters);
        } else {
          setMatchRosters(rosters);
        }

        const evs = await statsService.getEvents(gameId);
        setEvents(evs);

        // Self-heal score, fouls, and timeouts directly from event log
        let computedHomeScore = 0;
        let computedAwayScore = 0;
        let fouledHome = 0;
        let fouledAway = 0;
        let timeoutsHome = 0;
        let timeoutsAway = 0;

        // Order events robustly using the FSD possession engine's logic
        const sortedEvs = sortEventsChronologically(evs);

        sortedEvs.forEach(e => {
          const isHomePlayer =
            syncedRosters.some(r => r.teamId === homeTeamId && r.profileId === e.playerId) ||
            e.playerId === 'home_team' ||
            e.playerId === 'our_team' ||
            e.playerId === homeTeamId ||
            e.team === 'home';
          if (e.type.includes('make')) {
            const pts = parseInt(e.type[0]) || 0;
            if (isHomePlayer) computedHomeScore += pts;
            else computedAwayScore += pts;
          } else if (e.type === 'foul' || e.type === 'defensive_foul' || e.type === 'offensive_foul') {
            if (isHomePlayer) fouledHome += 1;
            else fouledAway += 1;
          } else if (e.type === 'timeout') {
            if (isHomePlayer) timeoutsHome += 1;
            else timeoutsAway += 1;
          }
        });

        const savedState = await statsService.getGameState(gameId);
        let finalGameState;
        
        // Derive exact last timestamp and quarter from events if they exist
        let derivedQuarter = 1;
        let derivedTime = (m.durationPerPeriod || 10) * 60;
        if (m.status !== 'completed' && sortedEvs.length > 0) {
          const lastLog = sortedEvs[sortedEvs.length - 1]; // Because we sorted chronologically, newest is last!
          derivedQuarter = lastLog.quarter;
          derivedTime = lastLog.timestamp;
        }

        if (savedState) {
          if (
            savedState.homeScore !== computedHomeScore || 
            savedState.awayScore !== computedAwayScore ||
            savedState.homeFouls !== fouledHome ||
            savedState.awayFouls !== fouledAway ||
            savedState.homeTimeouts !== timeoutsHome ||
            savedState.awayTimeouts !== timeoutsAway
          ) {
            console.log(`[Self-Healing] Detected score/fouls inconsistency. Re-synchronizing...`);
            finalGameState = {
              ...savedState,
              homeScore: computedHomeScore,
              awayScore: computedAwayScore,
              homeFouls: fouledHome,
              awayFouls: fouledAway,
              homeTimeouts: timeoutsHome,
              awayTimeouts: timeoutsAway
            };
            if (m.status !== 'completed' && sortedEvs.length > 0) {
              finalGameState.currentQuarter = derivedQuarter;
              finalGameState.timeRemaining = derivedTime;
            }
            await statsService.saveGameState(finalGameState);
          } else {
            finalGameState = savedState;
            if (m.status !== 'completed' && sortedEvs.length > 0) {
               // Update it strictly to the last log time 
               if (finalGameState.currentQuarter !== derivedQuarter || finalGameState.timeRemaining !== derivedTime) {
                 finalGameState.currentQuarter = derivedQuarter;
                 finalGameState.timeRemaining = derivedTime;
                 await statsService.saveGameState(finalGameState);
               }
            }
          }
        } else {
          finalGameState = {
            matchId: gameId,
            homeScore: computedHomeScore,
            awayScore: computedAwayScore,
            homeFouls: fouledHome,
            awayFouls: fouledAway,
            homeTimeouts: timeoutsHome,
            awayTimeouts: timeoutsAway,
            currentQuarter: derivedQuarter,
            timeRemaining: derivedTime,
            isRunning: false
          };
          await statsService.saveGameState(finalGameState);
        }
        setGameState(finalGameState);

        // Initialize MatchStints if we have active players
        const homeActiveIds = rosters.filter(r => r.teamId === homeTeamId && r.isActive).map(r => r.profileId);
        const awayActiveIds = rosters.filter(r => r.teamId === awayTeamId && r.isActive).map(r => r.profileId);
        
        const currentQuarter = savedState?.currentQuarter || 1;
        const timeRemaining = savedState?.timeRemaining || ((m.durationPerPeriod || 10) * 60);

        await statsService.ensureMatchStintsInitialized(
          gameId, 
          homeTeamId, 
          awayTeamId, 
          homeActiveIds, 
          awayActiveIds, 
          currentQuarter, 
          timeRemaining
        );

        setIsDataReady(true);
      } catch (error) {
        console.error('Failed to load game tracking data:', error);
        setIsDataReady(true);
      }
    };

    loadGame();
  }, [gameId, navigate]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    // Disable standard countdown runner if match has a videoUrl (handled by FSD Video Sync Timer)
    if (gameState?.isRunning && gameState.timeRemaining > 0 && !match?.videoUrl) {
      interval = setInterval(() => {
        setGameState(prev => {
          if (!prev) return prev;
          const newState = { ...prev, timeRemaining: prev.timeRemaining - 1 };
          statsService.saveGameState(newState).catch(console.error);
          return newState;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState?.isRunning, gameState?.timeRemaining, match?.videoUrl]);

  const updateMatchStatusToOngoing = async () => {
    if (match && match.status === 'planned') {
      const updatedMatch = { ...match, status: 'ongoing' as const };
      setMatch(updatedMatch);
      await statsService.updateMatch(updatedMatch);
    }
  };

  const handleToggleTimer = async () => {
    setGameState(prev => {
      if (!prev) return prev;
      const newState = { ...prev, isRunning: !prev.isRunning };
      statsService.saveGameState(newState).catch(console.error);
      if (newState.isRunning) {
        updateMatchStatusToOngoing().catch(console.error);
      }
      return newState;
    });
  };

  const handleResetTimer = async () => {
    if (!match || !gameState) return;
    const defaultDuration = (match.durationPerPeriod || 10) * 60;
    const newState = { ...gameState, timeRemaining: defaultDuration, isRunning: false };
    setGameState(newState);
    await statsService.saveGameState(newState);
  };

  const handleNextQuarter = async () => {
    if (!match || !gameState) return;
    
    const currentQuarter = gameState.currentQuarter;
    const homeTeamId = match.teamId || 'home_team';
    const awayTeamId = match.opponentTeamId || 'away_team';

    // Close active stints at end of current quarter
    await statsService.closeActiveMatchStint(match.id, homeTeamId, currentQuarter, 0);
    await statsService.closeActiveMatchStint(match.id, awayTeamId, currentQuarter, 0);

    // Close active possession if any
    const activeP = await statsService.getActivePossession(match.id);
    if (activeP) {
      await statsService.closePossession(activeP, {
        clockEnd: 0,
        closingEventId: `quarter_end_${currentQuarter}_${Date.now()}`,
        closingAction: 'end_of_period',
        outcome: 'empty'
      });
    }

    // Check if we reached the end of periods
    const maxPeriods = match.periodCount || 4;
    if (gameState.currentQuarter >= maxPeriods) {
      // Game over logic could go here
    }

    const defaultDuration = (match.durationPerPeriod || 10) * 60;
    const nextQuarter = currentQuarter + 1;
    const newState = { 
      ...gameState, 
      currentQuarter: nextQuarter,
      timeRemaining: defaultDuration, 
      isRunning: false 
    };
    setGameState(newState);
    await statsService.saveGameState(newState);

    // Open new stints for the next quarter if we have full lineups
    const homeActiveIds = matchRosters.filter(r => r.teamId === homeTeamId && r.isActive).map(r => r.profileId);
    const awayActiveIds = matchRosters.filter(r => r.teamId === awayTeamId && r.isActive).map(r => r.profileId);

    if (homeActiveIds.length === 5) {
      await statsService.openNextMatchStint(match.id, homeTeamId, homeActiveIds, nextQuarter, defaultDuration);
    }
    if (awayActiveIds.length === 5) {
      await statsService.openNextMatchStint(match.id, awayTeamId, awayActiveIds, nextQuarter, defaultDuration);
    }

    // Dispatch event to trigger jumpball prompt in UI
    window.dispatchEvent(new CustomEvent('trigger-jumpball'));
  };

  const handleSetQuarter = async (q: number) => {
    if (!match || !gameState) return;
    const defaultDuration = (match.durationPerPeriod || 10) * 60;
    const newState = { 
      ...gameState, 
      currentQuarter: q,
      timeRemaining: defaultDuration, 
      isRunning: false 
    };
    setGameState(newState);
    await statsService.saveGameState(newState);
  };

  return {
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
    handleToggleTimer,
    handleResetTimer,
    handleNextQuarter,
    handleSetQuarter,
    updateMatchStatusToOngoing,
    isDataReady
  };
};

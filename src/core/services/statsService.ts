import { ChildProfile, Match, GameEvent, GameState, Player, Team, Series, AiInsight, Possession, Club, MatchRoster, MatchStint, EventLink, PossessionOpeningSource, PossessionClosingAction, PossessionOutcome, MatchAuditResult, AuditIssue, AuditIssueStatus, AuditIssueResolution } from '../types/stats';
import { generateId } from '../utils/idUtils';
import { initDB, purgeLegacyIndexedDb } from '../../lib/db';
import { syncService } from './syncService';
import { parseKUFromString } from '../utils/ageCalculator';


export const statsService = {
  getClubs: async (): Promise<Club[]> => {
    const db = await initDB();
    return db.getAll('clubs');
  },

  getClub: async (id: string): Promise<Club | undefined> => {
    const db = await initDB();
    return db.get('clubs', id);
  },

  addClub: async (club: Club) => {
    const db = await initDB();
    await db.put('clubs', club);
    await syncService.enqueue('clubs', 'INSERT', club);
  },

  updateClub: async (club: Club) => {
    const db = await initDB();
    await db.put('clubs', club);
    await syncService.enqueue('clubs', 'UPDATE', club);
  },

  deleteClub: async (id: string) => {
    const db = await initDB();
    await db.delete('clubs', id);
    await syncService.enqueue('clubs', 'DELETE', { id });
  },

  getProfiles: async (): Promise<ChildProfile[]> => {
    const db = await initDB();
    return db.getAll('profiles');
  },
  
  addProfile: async (profile: ChildProfile) => {
    const db = await initDB();
    await db.put('profiles', profile);
    await syncService.enqueue('profiles', 'INSERT', profile);
  },

  updateProfile: async (profile: ChildProfile) => {
    const db = await initDB();
    await db.put('profiles', profile);
    await syncService.enqueue('profiles', 'UPDATE', profile);
  },

  deleteProfile: async (id: string) => {
    const db = await initDB();
    await db.delete('profiles', id);
    await syncService.enqueue('profiles', 'DELETE', { id });
  },

  getPlayers: async (): Promise<Player[]> => {
    const db = await initDB();
    return db.getAll('players');
  },

  addPlayer: async (player: Player) => {
    const db = await initDB();
    await db.put('players', player);
    await syncService.enqueue('players', 'INSERT', player);
  },

  updatePlayer: async (player: Player) => {
    const db = await initDB();
    await db.put('players', player);
    await syncService.enqueue('players', 'UPDATE', player);
  },

  deletePlayer: async (id: string) => {
    const db = await initDB();
    await db.delete('players', id);
    await syncService.enqueue('players', 'DELETE', { id });
  },

  getTeams: async (): Promise<Team[]> => {
    const db = await initDB();
    return db.getAll('teams');
  },

  getTeam: async (id: string): Promise<Team | undefined> => {
    const db = await initDB();
    return db.get('teams', id);
  },

  addTeam: async (team: Team) => {
    const db = await initDB();
    await db.put('teams', team);
    await syncService.enqueue('teams', 'INSERT', team);
  },

  updateTeam: async (team: Team) => {
    const db = await initDB();
    await db.put('teams', team);
    await syncService.enqueue('teams', 'UPDATE', team);
  },

  deleteTeam: async (id: string) => {
    const db = await initDB();
    await db.delete('teams', id);
    await syncService.enqueue('teams', 'DELETE', { id });
  },

  deleteMatch: async (id: string) => {
    const db = await initDB();
    await db.delete('matches', id);
    
    // Also delete related data
    const events = await db.getAllFromIndex('events', 'by-match', id);
    for (const e of events) await db.delete('events', e.id);
    
    const rosters = await db.getAllFromIndex('match_rosters', 'by-match', id);
    for (const r of rosters) await db.delete('match_rosters', r.id);
    
    const stints = await db.getAllFromIndex('match_stints', 'by-match', id);
    for (const s of stints) await db.delete('match_stints', s.id);
    
    const possessions = await db.getAllFromIndex('possessions', 'by-match', id);
    for (const p of possessions) await db.delete('possessions', p.id);
    
    const links = await db.getAllFromIndex('event_links', 'by-match', id);
    for (const l of links) await db.delete('event_links', l.id);

    await db.delete('game_states', id);
    
    await syncService.enqueue('matches', 'DELETE', { id });
  },

  getSeriesAll: async (): Promise<Series[]> => {
    const db = await initDB();
    return db.getAll('series');
  },

  getSeries: async (id: string): Promise<Series | undefined> => {
    const db = await initDB();
    return db.get('series', id);
  },

  addSeries: async (series: Series) => {
    const db = await initDB();
    await db.put('series', series);
    await syncService.enqueue('series', 'INSERT', series);
  },

  updateSeries: async (series: Series) => {
    const db = await initDB();
    await db.put('series', series);
    await syncService.enqueue('series', 'UPDATE', series);
  },

  deleteSeries: async (id: string) => {
    const db = await initDB();
    await db.delete('series', id);
    await syncService.enqueue('series', 'DELETE', { id });
  },

  getMatches: async (): Promise<Match[]> => {
    const db = await initDB();
    const matches = await db.getAll('matches');
    return matches.map(m => {
      if (m.ageCategory === undefined && m.ageGroup) {
        m.ageCategory = parseKUFromString(m.ageGroup);
      }
      if (!m.productionStage) {
        m.productionStage = 'tracking';
      }
      if (!m.stageHistory) {
        m.stageHistory = [];
      }
      return m;
    });
  },

  getMatch: async (id: string): Promise<Match | undefined> => {
    const db = await initDB();
    const m = await db.get('matches', id);
    if (m) {
      if (m.ageCategory === undefined && m.ageGroup) {
        m.ageCategory = parseKUFromString(m.ageGroup);
      }
      if (!m.productionStage) {
        m.productionStage = 'tracking';
      }
      if (!m.stageHistory) {
        m.stageHistory = [];
      }
    }
    return m;
  },

  addMatch: async (match: Match) => {
    const db = await initDB();
    if (match.ageCategory === undefined && match.ageGroup) {
      match.ageCategory = parseKUFromString(match.ageGroup);
    }
    if (!match.productionStage) {
      match.productionStage = 'tracking';
    }
    if (!match.stageHistory) {
      match.stageHistory = [];
    }
    await db.put('matches', match);
    await syncService.enqueue('matches', 'INSERT', match);
  },

  updateMatch: async (match: Match) => {
    const db = await initDB();
    if (match.ageCategory === undefined && match.ageGroup) {
      match.ageCategory = parseKUFromString(match.ageGroup);
    }
    if (!match.productionStage) {
      match.productionStage = 'tracking';
    }
    if (!match.stageHistory) {
      match.stageHistory = [];
    }
    await db.put('matches', match);
    await syncService.enqueue('matches', 'UPDATE', match);
  },

  getMatchRosters: async (matchId: string): Promise<MatchRoster[]> => {
    const db = await initDB();
    return db.getAllFromIndex('match_rosters', 'by-match', matchId);
  },

  getAllMatchRosters: async (): Promise<MatchRoster[]> => {
    const db = await initDB();
    return db.getAll('match_rosters');
  },

  addMatchRoster: async (roster: MatchRoster) => {
    const db = await initDB();
    await db.put('match_rosters', roster);
    await syncService.enqueue('match_rosters', 'INSERT', roster);
  },

  updateMatchRoster: async (roster: MatchRoster) => {
    const db = await initDB();
    await db.put('match_rosters', roster);
    await syncService.enqueue('match_rosters', 'UPDATE', roster);
  },

  getMatchStints: async (matchId: string): Promise<MatchStint[]> => {
    const db = await initDB();
    return db.getAllFromIndex('match_stints', 'by-match', matchId);
  },

  getActiveMatchStint: async (matchId: string, teamId: string): Promise<MatchStint | undefined> => {
    const db = await initDB();
    const stints = await db.getAllFromIndex('match_stints', 'by-team', teamId);
    const activeStints = stints.filter(s => s.matchId === matchId && s.endQuarter === undefined && s.endClock === undefined);
    
    if (activeStints.length > 1) {
      console.warn(`[MatchStint Anomaly] Multiple active stints detected for match ${matchId} team ${teamId}. Resolving...`);
      // Keep the latest one by ID (which has Date.now()), close others as invalid
      activeStints.sort((a, b) => b.id.localeCompare(a.id));
      const latest = activeStints[0];
      for (let i = 1; i < activeStints.length; i++) {
        const s = activeStints[i];
        const closed = { ...s, endQuarter: s.startQuarter, endClock: s.startClock, isValid: false };
        await db.put('match_stints', closed);
        await syncService.enqueue('match_stints', 'UPDATE', closed);
      }
      return latest;
    }
    
    return activeStints[0];
  },

  createInitialMatchStint: async (matchId: string, teamId: string, playerIds: string[], startQuarter: number, startClock: number): Promise<MatchStint | null> => {
    if (playerIds.length !== 5) return null;
    
    const db = await initDB();
    const activeStint = await statsService.getActiveMatchStint(matchId, teamId);
    
    // If we already have an active stint
    if (activeStint) {
      // If same players and same time, return existing
      const sortedNew = [...playerIds].sort();
      const sortedOld = [...activeStint.playerIds].sort();
      const isSameLineup = JSON.stringify(sortedNew) === JSON.stringify(sortedOld);
      
      if (isSameLineup && activeStint.startQuarter === startQuarter && activeStint.startClock === startClock) {
        return activeStint;
      }

      // If game hasn't really started (Q1, max clock), just update the lineup instead of creating new
      const match = await db.get('matches', matchId);
      const maxClock = (match?.durationPerPeriod || 10) * 60;
      if (startQuarter === 1 && startClock === maxClock) {
        const updated = { ...activeStint, playerIds: [...new Set(playerIds)] };
        await db.put('match_stints', updated);
        await syncService.enqueue('match_stints', 'UPDATE', updated);
        return updated;
      }
      
      return activeStint;
    }

    const newStint: MatchStint = {
      id: generateId('stint'),
      matchId,
      teamId,
      playerIds: [...new Set(playerIds)],
      startQuarter,
      startClock,
      isValid: true
    };

    if (newStint.playerIds.length !== 5) return null;

    await db.put('match_stints', newStint);
    await syncService.enqueue('match_stints', 'INSERT', newStint);
    return newStint;
  },

  closeActiveMatchStint: async (matchId: string, teamId: string, endQuarter: number, endClock: number): Promise<MatchStint | null> => {
    const db = await initDB();
    const activeStint = await statsService.getActiveMatchStint(matchId, teamId);
    if (!activeStint) return null;

    const isGhost = activeStint.startQuarter === endQuarter && activeStint.startClock === endClock;
    const closedStint: MatchStint = { 
      ...activeStint, 
      endQuarter, 
      endClock, 
      isGhostStint: isGhost,
      isValid: activeStint.isValid !== false
    };
    
    await db.put('match_stints', closedStint);
    await syncService.enqueue('match_stints', 'UPDATE', closedStint);
    return closedStint;
  },

  openNextMatchStint: async (matchId: string, teamId: string, playerIds: string[], startQuarter: number, startClock: number): Promise<MatchStint | null> => {
    if (playerIds.length !== 5) return null;
    
    const db = await initDB();
    const activeStint = await statsService.getActiveMatchStint(matchId, teamId);
    
    // Prevent redundant stint if same lineup and same time
    if (activeStint) {
      const sortedNew = [...playerIds].sort();
      const sortedOld = [...activeStint.playerIds].sort();
      if (JSON.stringify(sortedNew) === JSON.stringify(sortedOld) && activeStint.startQuarter === startQuarter && activeStint.startClock === startClock) {
        return activeStint;
      }
      // If we are opening a new one, we should have closed the old one already, 
      // but getActiveMatchStint handles multiple active ones just in case.
    }

    const newStint: MatchStint = {
      id: generateId('stint'),
      matchId,
      teamId,
      playerIds: [...new Set(playerIds)],
      startQuarter,
      startClock,
      isValid: true
    };

    if (newStint.playerIds.length !== 5) return null;

    await db.put('match_stints', newStint);
    await syncService.enqueue('match_stints', 'INSERT', newStint);
    return newStint;
  },

  ensureMatchStintsInitialized: async (matchId: string, homeTeamId: string, awayTeamId: string, homeActiveIds: string[], awayActiveIds: string[], startQuarter: number, startClock: number) => {
    if (homeActiveIds.length === 5) {
      await statsService.createInitialMatchStint(matchId, homeTeamId, homeActiveIds, startQuarter, startClock);
    }
    if (awayActiveIds.length === 5) {
      await statsService.createInitialMatchStint(matchId, awayTeamId, awayActiveIds, startQuarter, startClock);
    }
  },

  // Validation Utilities
  detectMultipleActiveStints: async (matchId: string, teamId: string): Promise<MatchStint[]> => {
    const db = await initDB();
    const stints = await db.getAllFromIndex('match_stints', 'by-team', teamId);
    return stints.filter(s => s.matchId === matchId && s.endQuarter === undefined && s.endClock === undefined);
  },

  detectOverlappingStints: async (matchId: string, teamId: string): Promise<MatchStint[][]> => {
    const stints = await statsService.getMatchStints(matchId);
    const teamStints = stints.filter(s => s.teamId === teamId && s.isValid !== false && !s.isGhostStint);
    
    // Sort by time
    teamStints.sort((a, b) => {
      if (a.startQuarter !== b.startQuarter) return a.startQuarter - b.startQuarter;
      return b.startClock - a.startClock; // Clock counts down
    });

    const overlaps: MatchStint[][] = [];
    for (let i = 0; i < teamStints.length - 1; i++) {
      const current = teamStints[i];
      const next = teamStints[i + 1];
      
      if (current.endQuarter === undefined) continue; // Still active

      // Overlap if next starts before current ends
      if (next.startQuarter < current.endQuarter!) {
        overlaps.push([current, next]);
      } else if (next.startQuarter === current.endQuarter && next.startClock > current.endClock!) {
        overlaps.push([current, next]);
      }
    }
    return overlaps;
  },

  detectGapInTimeline: async (matchId: string, teamId: string): Promise<{ start: { q: number, c: number }, end: { q: number, c: number } }[]> => {
    const stints = await statsService.getMatchStints(matchId);
    const teamStints = stints.filter(s => s.teamId === teamId && s.isValid !== false && !s.isGhostStint);
    
    teamStints.sort((a, b) => {
      if (a.startQuarter !== b.startQuarter) return a.startQuarter - b.startQuarter;
      return b.startClock - a.startClock;
    });

    const gaps: { start: { q: number, c: number }, end: { q: number, c: number } }[] = [];
    for (let i = 0; i < teamStints.length - 1; i++) {
      const current = teamStints[i];
      const next = teamStints[i + 1];
      
      if (current.endQuarter === undefined) continue;

      if (next.startQuarter > current.endQuarter!) {
        gaps.push({ 
          start: { q: current.endQuarter!, c: current.endClock! }, 
          end: { q: next.startQuarter, c: next.startClock } 
        });
      } else if (next.startQuarter === current.endQuarter && next.startClock < current.endClock!) {
        gaps.push({ 
          start: { q: current.endQuarter!, c: current.endClock! }, 
          end: { q: next.startQuarter, c: next.startClock } 
        });
      }
    }
    return gaps;
  },

  getValidMatchStints: async (matchId: string): Promise<MatchStint[]> => {
    const stints = await statsService.getMatchStints(matchId);
    return stints.filter(s => s.isValid !== false && !s.isGhostStint);
  },

  updateStint: async (stint: MatchStint) => {
    const db = await initDB();
    await db.put('match_stints', stint);
    await syncService.enqueue('match_stints', 'UPDATE', stint);
  },

  saveMatchStint: async (stint: MatchStint) => {
    const db = await initDB();
    await db.put('match_stints', stint);
    await syncService.enqueue('match_stints', 'UPDATE', stint);
  },

  deleteStint: async (stintId: string) => {
    const db = await initDB();
    await db.delete('match_stints', stintId);
    await syncService.enqueue('match_stints', 'DELETE', { id: stintId });
  },

  splitStint: async (matchId: string, stintId: string, splitClock: number): Promise<MatchStint[] | null> => {
    const db = await initDB();
    const stint = await db.get('match_stints', stintId);
    if (!stint) return null;

    // Validate split time is within stint
    const isWithin = stint.endClock !== undefined 
      ? (splitClock < stint.startClock && splitClock > stint.endClock)
      : (splitClock < stint.startClock);
    
    if (!isWithin) return null;

    const originalEndClock = stint.endClock;
    const originalEndQuarter = stint.endQuarter;

    // 1. Update original stint to end at split time
    const updatedFirst = { ...stint, endClock: splitClock, endQuarter: stint.startQuarter };
    await statsService.updateStint(updatedFirst);

    // 2. Create second part
    const secondPart: MatchStint = {
      id: generateId('stint'),
      matchId,
      teamId: stint.teamId,
      playerIds: [...stint.playerIds],
      startQuarter: stint.startQuarter,
      startClock: splitClock,
      endQuarter: originalEndQuarter,
      endClock: originalEndClock,
      isValid: true
    };
    await db.put('match_stints', secondPart);
    await syncService.enqueue('match_stints', 'INSERT', secondPart);

    return [updatedFirst, secondPart];
  },

  mergeStints: async (matchId: string, firstStintId: string, secondStintId: string): Promise<MatchStint | null> => {
    const db = await initDB();
    const first = await db.get('match_stints', firstStintId);
    const second = await db.get('match_stints', secondStintId);
    if (!first || !second) return null;

    // Simple merge: take start from first, end from second
    // Assumes they are adjacent and same team
    const merged: MatchStint = {
      ...first,
      endQuarter: second.endQuarter,
      endClock: second.endClock
    };

    await statsService.updateStint(merged);
    await statsService.deleteStint(secondStintId);

    return merged;
  },

  recordSubstitution: async (matchId: string, teamId: string, playerOutId: string, playerInId: string, quarter: number, clock: number) => {
    const stints = await statsService.getMatchStints(matchId);
    const teamStints = stints.filter(s => s.teamId === teamId && s.isValid !== false && !s.isGhostStint);
    
    // Find the stint that covers this timestamp
    const targetStint = teamStints.find(s => 
      s.startQuarter === quarter && 
      s.startClock >= clock && 
      (s.endClock === undefined || s.endClock <= clock)
    );

    if (!targetStint) {
      // If no stint found, maybe it's a gap. We should probably create one or adjust nearby.
      // For now, let's just return if not found to avoid messy logic.
      return null;
    }

    // 1. Split the stint at the substitution time
    const parts = await statsService.splitStint(matchId, targetStint.id, clock);
    if (!parts || parts.length < 2) return null;

    const [firstPart, secondPart] = parts;

    // 2. In the second part, replace playerOut with playerIn
    const newPlayerIds = secondPart.playerIds.map(id => id === playerOutId ? playerInId : id);
    const uniquePlayers = [...new Set(newPlayerIds)];
    
    if (uniquePlayers.length === 5) {
      secondPart.playerIds = uniquePlayers;
      await statsService.updateStint(secondPart);
    }

    return { firstPart, secondPart };
  },

  calculateTotalTrackedTime: async (matchId: string, teamId: string): Promise<number> => {
    const stints = await statsService.getMatchStints(matchId);
    const teamStints = stints.filter(s => s.teamId === teamId && s.isValid !== false && !s.isGhostStint);
    
    let totalSeconds = 0;
    teamStints.forEach(s => {
      if (s.endQuarter !== undefined && s.endClock !== undefined) {
        if (s.startQuarter === s.endQuarter) {
          totalSeconds += (s.startClock - s.endClock);
        } else {
          // Simplified: assume full quarters in between. 
          // In real basketball, stints usually don't cross quarters without being closed.
          totalSeconds += s.startClock; // Time in start quarter
          // This is a bit complex if we don't know quarter duration here, 
          // but usually stints are closed at quarter end.
        }
      }
    });
    return totalSeconds;
  },

  getEvents: async (matchId: string): Promise<GameEvent[]> => {
    const db = await initDB();
    return db.getAllFromIndex('events', 'by-match', matchId);
  },

  getAllEvents: async (): Promise<GameEvent[]> => {
    const db = await initDB();
    return db.getAll('events');
  },

  addEvent: async (event: GameEvent) => {
    const db = await initDB();
    await db.put('events', event);
    await syncService.enqueue('events', 'INSERT', event);
  },

  updateEvent: async (event: GameEvent) => {
    const db = await initDB();
    await db.put('events', event);
    await syncService.enqueue('events', 'UPDATE', event);
  },

  deleteEvent: async (id: string) => {
    const db = await initDB();
    await db.delete('events', id);
    await syncService.enqueue('events', 'DELETE', { id });
  },

  removeEvent: async (matchId: string, eventId: string) => {
    const db = await initDB();
    await db.delete('events', eventId);
    await syncService.enqueue('events', 'DELETE', { id: eventId });
  },

  overwriteMatchEvents: async (matchId: string, events: GameEvent[]) => {
    const db = await initDB();
    const existing = await db.getAllFromIndex('events', 'by-match', matchId);
    for (const e of existing) {
      await db.delete('events', e.id);
      await syncService.enqueue('events', 'DELETE', { id: e.id });
    }
    for (const e of events) {
      await db.put('events', e);
      await syncService.enqueue('events', 'INSERT', e);
    }
  },

  getPossessions: async (matchId: string): Promise<Possession[]> => {
    const db = await initDB();
    return db.getAllFromIndex('possessions', 'by-match', matchId);
  },

  addPossession: async (possession: Possession) => {
    const db = await initDB();
    await db.put('possessions', possession);
    await syncService.enqueue('possessions', 'INSERT', possession);
  },

  updatePossession: async (possession: Possession) => {
    const db = await initDB();
    await db.put('possessions', possession);
    await syncService.enqueue('possessions', 'UPDATE', possession);
  },

  removePossession: async (matchId: string, possessionId: string) => {
    const db = await initDB();
    await db.delete('possessions', possessionId);
    await syncService.enqueue('possessions', 'DELETE', { id: possessionId });
  },

  // Possession Lifecycle Helpers
  openPossession: async (params: {
    matchId: string;
    teamInPossession: 'home' | 'away';
    period: number;
    clockStart: number;
    openingEventId: string;
    openingSource: PossessionOpeningSource;
    openingPlayerId?: string;
    teamId?: string;
  }): Promise<Possession> => {
    const possession: Possession = {
      id: `POS_${params.openingEventId}`,
      matchId: params.matchId,
      teamInPossession: params.teamInPossession,
      period: params.period,
      clockStart: params.clockStart,
      teamId: params.teamId,
      openingEventId: params.openingEventId,
      openingSource: params.openingSource,
      openingPlayerId: params.openingPlayerId,
      pointsScored: 0,
      isAnomaly: false
    };
    await statsService.addPossession(possession);
    return possession;
  },

  closePossession: async (possession: Possession, params: {
    clockEnd: number;
    closingEventId: string;
    closingAction: PossessionClosingAction;
    closingPlayerId?: string;
    outcome: PossessionOutcome;
    pointsScored?: number;
  }): Promise<Possession> => {
    const updated: Possession = {
      ...possession,
      clockEnd: params.clockEnd,
      closingEventId: params.closingEventId,
      closingAction: params.closingAction,
      closingPlayerId: params.closingPlayerId,
      outcome: params.outcome,
      pointsScored: params.pointsScored !== undefined ? params.pointsScored : possession.pointsScored
    };
    await statsService.updatePossession(updated);
    return updated;
  },

  getActivePossession: async (matchId: string): Promise<Possession | null> => {
    const possessions = await statsService.getPossessions(matchId);
    return possessions
      .filter(p => p.clockEnd === undefined)
      .sort((a, b) => (b.clockStart || 0) - (a.clockStart || 0))[0] || null;
  },

  markPossessionAnomaly: async (possessionId: string, reason: string) => {
    const db = await initDB();
    const possession = await db.get('possessions', possessionId);
    if (possession) {
      possession.isAnomaly = true;
      possession.anomalyReason = reason;
      await statsService.updatePossession(possession);
    }
  },

  rebuildPossessions: async (matchId: string, match: any) => {
    return statsService.rebuildPossessionsForMatch(matchId, match);
  },

  rebuildPossessionsForMatch: async (matchId: string, match: any) => {
    const db = await initDB();
    const events = await db.getAllFromIndex('events', 'by-match', matchId);
    if (!events.length) return;

    const matchRosters = await statsService.getMatchRosters(matchId);

    // Call FSD engine
    const { rebuildPossessionsEngine } = await import('./possessionEngine');
    const { possessions, sortedEvents } = rebuildPossessionsEngine(matchId, events, matchRosters, match);

    // Wipe old possessions
    const existingPossessions = await db.getAllFromIndex('possessions', 'by-match', matchId);
    for (const p of existingPossessions) {
      await db.delete('possessions', p.id);
      await syncService.enqueue('possessions', 'DELETE', { id: p.id });
    }

    // Save new possessions
    for (const p of possessions) {
      await db.put('possessions', p);
      await syncService.enqueue('possessions', 'UPDATE', p);
    }

    // Save updated events (which gained possessionId tags inside engine)
    for (const e of sortedEvents) {
      await db.put('events', e);
      // We don't necessarily want to enqueue thousands of syncs here, but we will for now
      // as it might be important for UI refresh. Actually, we just trust the tag updates.
    }
  },

  validatePossessionChain: (events: GameEvent[]): { isAnomaly: boolean; reason?: string } => {
    // Placeholder for more complex validation
    return { isAnomaly: false };
  },

  getGameState: async (matchId: string): Promise<GameState | undefined> => {
    const db = await initDB();
    return db.get('game_states', matchId);
  },

  getLineupAtTime: async (matchId: string, teamId: string, quarter: number, clock: number): Promise<string[]> => {
    const db = await initDB();
    const matchRosters = await statsService.getMatchRosters(matchId);
    const teamRosters = matchRosters.filter(r => r.teamId === teamId);
    
    const events = await statsService.getEvents(matchId);
    const starterEvents = events.filter(e => e.type === 'starter' && teamRosters.some(r => r.profileId === e.playerId));
    
    // Start with starters
    let lineup: Set<string>;
    if (starterEvents.length > 0) {
      lineup = new Set(starterEvents.map(e => e.playerId));
    } else {
      lineup = new Set(teamRosters.filter(r => r.isStarter).map(r => r.profileId));
    }
    
    // Get all sub events for this team up to this time
    // We need to process them in chronological order
    const subEvents = events
      .filter(e => (e.type === 'sub_in' || e.type === 'sub_out') && 
                   teamRosters.some(r => r.profileId === e.playerId) &&
                   (e.quarter < quarter || (e.quarter === quarter && e.timestamp >= clock)))
      .sort((a, b) => {
        if (a.quarter !== b.quarter) return a.quarter - b.quarter;
        return b.timestamp - a.timestamp; // Clock counts down, so larger timestamp is earlier
      });
    
    for (const event of subEvents) {
      if (event.type === 'sub_in') {
        lineup.add(event.playerId);
      } else {
        lineup.delete(event.playerId);
      }
    }
    
    return Array.from(lineup);
  },

  reconcileMatchStints: async (matchId: string, teamId: string) => {
    const db = await initDB();
    const match = await db.get('matches', matchId);
    if (!match) return;

    // 1. Get all sub events and starters
    const events = await statsService.getEvents(matchId);
    const matchRosters = await statsService.getMatchRosters(matchId);
    const teamRosters = matchRosters.filter(r => r.teamId === teamId);
    
    const starterEvents = events.filter(e => e.type === 'starter' && teamRosters.some(r => r.profileId === e.playerId));
    const subs = events
      .filter(e => (e.type === 'sub_in' || e.type === 'sub_out') && teamRosters.some(r => r.profileId === e.playerId))
      .sort((a, b) => {
        if (a.quarter !== b.quarter) return a.quarter - b.quarter;
        return b.timestamp - a.timestamp;
      });

    // 2. Group subs by timestamp
    const subGroups: Record<string, GameEvent[]> = {};
    subs.forEach(s => {
      const key = `${s.quarter}_${s.timestamp}`;
      if (!subGroups[key]) subGroups[key] = [];
      subGroups[key].push(s);
    });

    // 3. Delete existing stints for this team
    const existingStints = await statsService.getMatchStints(matchId);
    const teamStints = existingStints.filter(s => s.teamId === teamId);
    for (const s of teamStints) {
      await db.delete('match_stints', s.id);
      await syncService.enqueue('match_stints', 'DELETE', { id: s.id });
    }

    // 4. Re-create stints
    let currentLineup: Set<string>;
    if (starterEvents.length > 0) {
      currentLineup = new Set(starterEvents.map(e => e.playerId));
    } else {
      currentLineup = new Set(teamRosters.filter(r => r.isStarter).map(r => r.profileId));
    }

    let lastQ = 1;
    let lastC = (match.durationPerPeriod || 10) * 60;

    const sortedKeys = Object.keys(subGroups).sort((a, b) => {
      const [qA, cA] = a.split('_').map(Number);
      const [qB, cB] = b.split('_').map(Number);
      if (qA !== qB) return qA - qB;
      return cB - cA;
    });

    for (const key of sortedKeys) {
      const [q, c] = key.split('_').map(Number);
      
      // Close previous stint if lineup was valid (or at least had players)
      if (currentLineup.size > 0) {
        await statsService.openNextMatchStint(matchId, teamId, Array.from(currentLineup), lastQ, lastC);
        await statsService.closeActiveMatchStint(matchId, teamId, q, c);
      }

      // Apply subs
      subGroups[key].forEach(s => {
        if (s.type === 'sub_in') currentLineup.add(s.playerId);
        else currentLineup.delete(s.playerId);
      });

      lastQ = q;
      lastC = c;
    }

    // Open final stint
    if (currentLineup.size > 0) {
      const gameState = await statsService.getGameState(matchId);
      const endQ = gameState?.currentQuarter || lastQ;
      const endC = gameState?.timeRemaining ?? 0;
      
      await statsService.openNextMatchStint(matchId, teamId, Array.from(currentLineup), lastQ, lastC);
      // If match is completed, close it. Otherwise leave it open.
      if (match.status === 'completed') {
        await statsService.closeActiveMatchStint(matchId, teamId, endQ, endC);
      }
    }
  },

  correctPlayerInputError: async (matchId: string, teamId: string, playerOutId: string, playerInId: string) => {
    const db = await initDB();
    
    // 1. Get all events for the match
    const events = await statsService.getEvents(matchId);
    
    // Find the entry point of the incorrect player (last starter or sub_in event)
    const entryEvents = events
      .filter(e => e.playerId === playerOutId && (e.type === 'sub_in' || e.type === 'starter'))
      .sort((a, b) => {
        if (a.quarter !== b.quarter) return a.quarter - b.quarter;
        return b.timestamp - a.timestamp; // Clock counts down
      });
      
    if (entryEvents.length === 0) {
      throw new Error("No entry event found for this player.");
    }
    
    // The most recent entry event
    const lastEntryEvent = entryEvents[entryEvents.length - 1];
    
    // 2. Find all events of playerOutId since that entry event
    // "Since" means at or after the entry event's quarter and timestamp
    const eventsToUpdate = events.filter(e => {
      if (e.playerId !== playerOutId) return false;
      
      // Check if event is chronologically after or equal to the entry event
      if (e.quarter < lastEntryEvent.quarter) return false;
      if (e.quarter === lastEntryEvent.quarter && e.timestamp > lastEntryEvent.timestamp) return false;
      
      return true;
    });
    
    // 3. Swap playerIds in those events
    for (const e of eventsToUpdate) {
      const updatedEvent = { ...e, playerId: playerInId };
      await statsService.updateEvent(updatedEvent);
    }
    
    // 4. Update starter and active statuses in MatchRoster
    const matchRosters = await statsService.getMatchRosters(matchId);
    const rosterOut = matchRosters.find(r => r.profileId === playerOutId && r.teamId === teamId);
    const rosterIn = matchRosters.find(r => r.profileId === playerInId && r.teamId === teamId);
    
    // If the entry event was a 'starter' event, then swapping isStarter is appropriate
    const isStarterCorrection = lastEntryEvent.type === 'starter';
    
    if (rosterOut) {
      const updatedOut = { 
        ...rosterOut, 
        isActive: false, 
        isStarter: isStarterCorrection ? false : rosterOut.isStarter 
      };
      await statsService.updateMatchRoster(updatedOut);
    }
    
    if (rosterIn) {
      const updatedIn = { 
        ...rosterIn, 
        isActive: true, 
        isStarter: isStarterCorrection ? true : rosterIn.isStarter 
      };
      await statsService.updateMatchRoster(updatedIn);
    }
    
    // 5. Reconcile stints! This will automatically clean up existing stints and rebuild them with the correct players
    await statsService.reconcileMatchStints(matchId, teamId);
  },

  saveGameState: async (state: GameState) => {
    const db = await initDB();
    await db.put('game_states', state);
    await syncService.enqueue('game_states', 'UPDATE', state);
  },

  getInsights: async (targetId: string): Promise<AiInsight[]> => {
    const db = await initDB();
    return db.getAllFromIndex('ai_insights', 'by-target', targetId);
  },

  saveInsight: async (insight: AiInsight) => {
    const db = await initDB();
    await db.put('ai_insights', insight);
    await syncService.enqueue('ai_insights', 'INSERT', insight);
  },

  // EventLink Methods
  getEventLinks: async (matchId: string): Promise<EventLink[]> => {
    const db = await initDB();
    return db.getAllFromIndex('event_links', 'by-match', matchId);
  },

  getEventLinksByPrimaryEvent: async (eventId: string): Promise<EventLink[]> => {
    const db = await initDB();
    return db.getAllFromIndex('event_links', 'by-primary', eventId);
  },

  getEventLinksBySecondaryEvent: async (eventId: string): Promise<EventLink[]> => {
    const db = await initDB();
    return db.getAllFromIndex('event_links', 'by-secondary', eventId);
  },

  addEventLink: async (link: EventLink) => {
    const db = await initDB();
    await db.put('event_links', link);
    await syncService.enqueue('event_links', 'INSERT', link);
  },

  saveEventLink: async (link: EventLink) => {
    const db = await initDB();
    await db.put('event_links', link);
    await syncService.enqueue('event_links', 'UPDATE', link);
  },

  createEventLink: async (matchId: string, primaryId: string, secondaryId: string, relationType: any, metadata?: any) => {
    const link: EventLink = {
      id: generateId('link'),
      matchId,
      primaryEventId: primaryId,
      secondaryEventId: secondaryId,
      relationType,
      metadata
    };
    await statsService.addEventLink(link);
    return link;
  },

  createAssistShotLink: async (matchId: string, assistId: string, shotId: string) => {
    return statsService.createEventLink(matchId, assistId, shotId, 'ASSISTS');
  },

  createStealTurnoverLink: async (matchId: string, stealId: string, turnoverId: string) => {
    return statsService.createEventLink(matchId, stealId, turnoverId, 'STEALS_FROM');
  },

  createReboundShotLink: async (matchId: string, reboundId: string, shotId: string) => {
    return statsService.createEventLink(matchId, reboundId, shotId, 'REBOUNDS');
  },

  createBlockShotLink: async (matchId: string, blockId: string, shotId: string) => {
    return statsService.createEventLink(matchId, blockId, shotId, 'BLOCKS');
  },

  createFoulFreeThrowLink: async (matchId: string, foulId: string, freeThrowId: string) => {
    return statsService.createEventLink(matchId, foulId, freeThrowId, 'RESULTS_IN_FT');
  },

  // Audit & Integrity Engine
  auditMatchIntegrity: async (matchId: string): Promise<MatchAuditResult> => {
    const match = await statsService.getMatch(matchId);
    if (!match) throw new Error('Match not found');

    const stints = await statsService.getMatchStints(matchId);
    const possessions = await statsService.getPossessions(matchId);
    const events = await statsService.getEvents(matchId);
    const links = await statsService.getEventLinks(matchId);
    const rosters = await statsService.getMatchRosters(matchId);
    const resolutions = await statsService.getAuditIssueResolutions(matchId);

    let issues: AuditIssue[] = [];

    // 1. Audit Stints
    const stintIssues = statsService.auditMatchStints(matchId, stints, match);
    issues.push(...stintIssues);

    // 2. Audit Possessions
    const possessionIssues = statsService.auditMatchPossessions(matchId, possessions, events, rosters);
    issues.push(...possessionIssues);

    // 3. Audit Events & Relationships
    const eventIssues = statsService.auditMatchEvents(matchId, events, links);
    issues.push(...eventIssues);

    // 4. Audit Player Attribution (On-Court Integrity)
    const attributionIssues = statsService.auditPlayerAttribution(matchId, events, stints, match, rosters);
    issues.push(...attributionIssues);

    // 5. Issue Grouping (Root Cause Hinting)
    issues = statsService.groupAuditIssues(issues);

    // 6. Generate Suggestions
    issues = statsService.generateSuggestions(issues, events, possessions, links, stints);

    // 7. Apply Resolutions
    issues = issues.map(issue => {
      const res = resolutions.find(r => r.issueId === issue.id);
      return res ? { ...issue, status: res.status } : issue;
    });

    // Calculate Summary (only count non-dismissed issues for health score)
    const activeIssues = issues.filter(i => i.status !== 'dismissed' && i.status !== 'resolved');
    
    const summary = {
      totalIssues: issues.length,
      critical: activeIssues.filter(i => i.severity === 'critical').length,
      high: activeIssues.filter(i => i.severity === 'high').length,
      medium: activeIssues.filter(i => i.severity === 'medium').length,
      low: activeIssues.filter(i => i.severity === 'low').length,
    };

    // Calculate Health Score (Weighted Penalties)
    // Severity weights: Critical=25, High=10, Medium=5, Low=1
    let totalPenalty = 0;
    totalPenalty += summary.critical * 25;
    totalPenalty += summary.high * 10;
    totalPenalty += summary.medium * 5;
    totalPenalty += summary.low * 1;
    
    const healthScore = Math.max(0, 100 - totalPenalty);

    // Data Trust Classification
    let trustClassification: 'TRUSTED' | 'CAUTION' | 'UNRELIABLE' = 'TRUSTED';
    if (healthScore < 70) {
      trustClassification = 'UNRELIABLE';
    } else if (healthScore < 90) {
      trustClassification = 'CAUTION';
    }

    return {
      matchId,
      timestamp: new Date().toISOString(),
      summary,
      issues,
      healthScore,
      trustClassification
    };
  },

  getAuditIssueResolutions: async (matchId: string): Promise<AuditIssueResolution[]> => {
    const db = await initDB();
    return db.getAllFromIndex('audit_issue_resolutions', 'by-match', matchId);
  },

  saveAuditIssueResolution: async (matchId: string, issueId: string, status: AuditIssueStatus, fixMetadata?: AuditIssueResolution['fixMetadata']) => {
    const db = await initDB();
    const id = `${matchId}_${issueId}`;
    const resolution: AuditIssueResolution = {
      id,
      matchId,
      issueId,
      status,
      updatedAt: new Date().toISOString(),
      fixMetadata
    };
    await db.put('audit_issue_resolutions', resolution);
    await syncService.enqueue('audit_issue_resolutions', 'UPDATE', resolution);
  },

  groupAuditIssues: (issues: AuditIssue[]): AuditIssue[] => {
    // Basic grouping logic: cluster issues of same type that are related
    const grouped: AuditIssue[] = [];
    const clusters: Record<string, AuditIssue[]> = {};

    issues.forEach(issue => {
      let clusterKey = `${issue.type}_${issue.severity}`;
      if (issue.type === 'possession' && issue.message.includes('Missed shot')) {
        clusterKey = 'missing_rebound_cluster';
      } else if (issue.type === 'STINT_TIMELINE_GAP') {
        clusterKey = 'stint_gap_cluster';
      }

      if (!clusters[clusterKey]) clusters[clusterKey] = [];
      clusters[clusterKey].push(issue);
    });

    Object.entries(clusters).forEach(([key, clusterIssues]) => {
      if (clusterIssues.length > 3 && key.includes('cluster')) {
        // Create a representative grouped issue
        const first = clusterIssues[0];
          grouped.push({
          ...first,
          id: `group_${key}`,
          status: 'open',
          message: `${clusterIssues.length} related issues: ${first.message.split('followed by')[0]}...`,
          groupingId: key,
          recommendedAction: first.recommendedAction || 'Review the sequence of events in the log to identify missing transitions.'
        });
      } else {
        grouped.push(...clusterIssues);
      }
    });

    return grouped;
  },

  auditMatchStints: (matchId: string, stints: MatchStint[], match: Match): AuditIssue[] => {
    const issues: AuditIssue[] = [];
    const validStints = stints.filter(s => s.isValid !== false && !s.isGhostStint);
    const teams = Array.from(new Set(validStints.map(s => s.teamId)));
    
    const quarterDuration = (match.durationPerPeriod || 10) * 60;

    teams.forEach(teamId => {
      const teamStints = validStints.filter(s => s.teamId === teamId);
      teamStints.sort((a, b) => {
        if (a.startQuarter !== b.startQuarter) return a.startQuarter - b.startQuarter;
        return b.startClock - a.startClock; // descending clock
      });

      // Timeline Gap Detection
      for (let q = 1; q <= (match.periodCount || 4); q++) {
        const qStints = teamStints.filter(s => s.startQuarter === q);
        if (qStints.length === 0) {
          // Entire quarter missing? Only flag if match is completed or quarter is past
          issues.push({
            id: `stint_gap_q${q}_${teamId}`,
            type: 'STINT_TIMELINE_GAP',
            severity: 'high',
            status: 'open',
            message: `No lineup recorded for team ${teamId} in Quarter ${q}`,
            recommendedAction: 'Add a starting lineup for this quarter.'
          });
          continue;
        }

        // Check gap at start of quarter
        const firstStint = qStints[0];
        if (firstStint.startClock < quarterDuration - 5) { // 5s grace
          issues.push({
            id: `stint_gap_start_q${q}_${teamId}`,
            type: 'STINT_TIMELINE_GAP',
            severity: 'medium',
            status: 'open',
            message: `Missing lineup at start of Q${q} for team ${teamId}`,
            recommendedAction: 'Adjust the start time of the first stint or add a preceding one.'
          });
        }

        // Check gaps between stints
        for (let i = 0; i < qStints.length - 1; i++) {
          const current = qStints[i];
          const next = qStints[i+1];
          if (current.endClock !== undefined && current.endClock > next.startClock + 2) { // 2s grace
            issues.push({
              id: `stint_gap_between_${current.id}_${next.id}`,
              type: 'STINT_TIMELINE_GAP',
              severity: 'medium',
              status: 'open',
              message: `Gap in lineup coverage between stints in Q${q}`,
              relatedIds: { stintId: current.id },
              recommendedAction: 'Ensure stints are continuous. Check for missing substitutions.'
            });
          }
        }
      }

      // Overlaps & Unclosed
      for (let i = 0; i < teamStints.length - 1; i++) {
        const current = teamStints[i];
        const next = teamStints[i+1];

        if (current.endQuarter !== undefined && current.endClock !== undefined) {
          if (current.endQuarter > next.startQuarter || 
             (current.endQuarter === next.startQuarter && current.endClock < next.startClock - 2)) {
            issues.push({
              id: `stint_overlap_${current.id}_${next.id}`,
              type: 'stint',
              severity: 'high',
              status: 'open',
              message: `Overlapping stints for team ${teamId} at Q${current.endQuarter}`,
              relatedIds: { stintId: current.id },
              recommendedAction: 'Adjust stint timestamps to remove overlap.'
            });
          }
        } else {
          issues.push({
            id: `stint_unclosed_${current.id}`,
            type: 'stint',
            severity: 'medium',
            status: 'open',
            message: `Unclosed stint for team ${teamId} followed by another stint`,
            relatedIds: { stintId: current.id },
            recommendedAction: 'Set an end time for this stint.'
          });
        }
      }
    });

    // Ghost stints
    stints.filter(s => s.isGhostStint).forEach(s => {
      issues.push({
        id: `stint_ghost_${s.id}`,
        type: 'stint',
        severity: 'low',
        status: 'open',
        message: `Ghost stint detected (zero duration or placeholder)`,
        relatedIds: { stintId: s.id },
        recommendedAction: 'Remove this stint if it was created by mistake.'
      });
    });

    return issues;
  },

  auditMatchPossessions: (matchId: string, possessions: Possession[], events: GameEvent[], matchRosters: MatchRoster[]): AuditIssue[] => {
    const issues: AuditIssue[] = [];

    possessions.forEach(p => {
      if (p.isAnomaly) {
        issues.push({
          id: `poss_anomaly_${p.id}`,
          type: 'possession',
          severity: 'medium',
          status: 'open',
          message: p.anomalyReason || 'Possession marked as anomaly',
          relatedIds: { possessionId: p.id },
          recommendedAction: 'Review the events within this possession for missing rebounds or turnovers.'
        });
      }

      if (p.clockEnd === undefined) {
        issues.push({
          id: `poss_unclosed_${p.id}`,
          type: 'possession',
          severity: 'low',
          status: 'open',
          message: 'Possession was never properly closed',
          relatedIds: { possessionId: p.id },
          recommendedAction: 'Add a closing event (shot, turnover, or end of period).'
        });
      }

      // Check for scorer/team mismatch
      if (p.closingEventId) {
        const closingEvent = events.find(e => e.id === p.closingEventId);
        if (closingEvent && closingEvent.team !== p.teamInPossession) {
          issues.push({
            id: `poss_mismatch_${p.id}`,
            type: 'possession',
            severity: 'critical',
            status: 'open',
            message: `Scorer team (${closingEvent.team}) does not match possession team (${p.teamInPossession})`,
            relatedIds: { possessionId: p.id, eventId: closingEvent.id },
            recommendedAction: 'Correct the team assignment for the scoring event or the possession.'
          });
        }
      }
    });

    return issues;
  },

  auditMatchEvents: (matchId: string, events: GameEvent[], links: EventLink[]): AuditIssue[] => {
    const issues: AuditIssue[] = [];

    events.forEach(ev => {
      if (ev.type === 'ast') {
        const link = links.find(l => l.primaryEventId === ev.id && l.relationType === 'ASSISTS');
        if (!link) {
          issues.push({
            id: `event_orphan_ast_${ev.id}`,
            type: 'relationship',
            severity: 'medium',
            status: 'open',
            message: 'Assist detected without a linked shot event',
            relatedIds: { eventId: ev.id },
            recommendedAction: 'Link this assist to the shot it created.'
          });
        } else if (link) {
          const shot = events.find(e => e.id === link.secondaryEventId);
          if (!shot || !['1pt_make', '2pt_make', '3pt_make'].includes(shot.type)) {
            issues.push({
              id: `event_invalid_ast_${ev.id}`,
              type: 'relationship',
              severity: 'high',
              status: 'open',
              message: 'Assist linked to a non-scoring event',
              relatedIds: { eventId: ev.id },
              recommendedAction: 'Ensure assists are only linked to successful field goals or free throws.'
            });
          }
        }
      }

      if (ev.type === 'stl') {
        const link = links.find(l => l.primaryEventId === ev.id && l.relationType === 'STEALS_FROM');
        if (!link) {
          issues.push({
            id: `event_orphan_stl_${ev.id}`,
            type: 'relationship',
            severity: 'low',
            status: 'open',
            message: 'Steal detected without a linked turnover',
            relatedIds: { eventId: ev.id },
            recommendedAction: 'Link this steal to the opponent turnover event.'
          });
        }
      }
    });

    return issues;
  },

  auditPlayerAttribution: (matchId: string, events: GameEvent[], stints: MatchStint[], match: any, matchRosters: MatchRoster[]): AuditIssue[] => {
    const issues: AuditIssue[] = [];
    const validStints = stints.filter(s => s.isValid !== false && !s.isGhostStint);
    const homeTeamId = match.teamId || 'home_team';

    events.forEach(event => {
      // Skip non-player events
      if (['timeout', 'inbound', 'jumpball', 'sub_in', 'sub_out'].includes(event.type)) return;
      if (event.playerId === 'home_team' || event.playerId === 'away_team' || event.playerId === 'opp') return;

      const isHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === event.playerId);
      const teamId = isHome 
        ? homeTeamId 
        : (match.opponentTeamId || 'away_team');

      // Find active stint for this team at this time
      const activeStint = validStints.find(s => 
        s.teamId === teamId &&
        s.startQuarter <= event.quarter &&
        (s.endQuarter === undefined || s.endQuarter >= event.quarter) &&
        (s.startQuarter < event.quarter || s.startClock >= event.timestamp) &&
        (s.endQuarter === undefined || s.endQuarter > event.quarter || s.endClock! <= event.timestamp)
      );

      if (activeStint) {
        if (!activeStint.playerIds.includes(event.playerId)) {
          issues.push({
            id: `attr_mismatch_${event.id}`,
            type: 'PLAYER_NOT_ON_COURT',
            severity: 'high',
            status: 'open',
            message: `Event ${event.type} assigned to player who was not on court`,
            relatedIds: { eventId: event.id, stintId: activeStint.id, playerId: event.playerId },
            recommendedAction: 'Reassign to an active player or adjust substitution timing.'
          });
        }
      } else {
        // No stint recorded at all for this time
        issues.push({
          id: `attr_no_stint_${event.id}`,
          type: 'POSSIBLE_MISSING_SUBSTITUTION',
          severity: 'medium',
          status: 'open',
          message: `Event ${event.type} occurred when no lineup was recorded for team`,
          relatedIds: { eventId: event.id, playerId: event.playerId },
          recommendedAction: 'Add a lineup stint covering this timestamp.'
        });
      }
    });

    return issues;
  },

  generateSuggestions: (issues: AuditIssue[], events: GameEvent[], possessions: Possession[], links: EventLink[], stints: MatchStint[]): AuditIssue[] => {
    const sortEventsChronologically = (evs: GameEvent[]) => {
      return [...evs].sort((a, b) => {
        if (a.quarter !== b.quarter) return a.quarter - b.quarter;
        const tA = a.timestamp !== undefined ? a.timestamp : 0;
        const tB = b.timestamp !== undefined ? b.timestamp : 0;
        if (tA !== tB) return tB - tA;
        const timeA = a.realTime ? new Date(a.realTime).getTime() : 0;
        const timeB = b.realTime ? new Date(b.realTime).getTime() : 0;
        if (timeA !== timeB) return timeA - timeB;
        const ytA = a.youtubeTimestamp !== undefined ? a.youtubeTimestamp : 0;
        const ytB = b.youtubeTimestamp !== undefined ? b.youtubeTimestamp : 0;
        return ytA - ytB;
      });
    };

    return issues.map(issue => {
      // 1. Orphan Assist Suggestion
      if (issue.id.startsWith('event_orphan_ast_') && issue.relatedIds?.eventId) {
        const assistEvent = events.find(e => e.id === issue.relatedIds?.eventId);
        if (assistEvent) {
          // Find closest made shot by same team within 5 seconds
          const candidate = events.find(e => 
            ['1pt_make', '2pt_make', '3pt_make'].includes(e.type) &&
            e.team === assistEvent.team &&
            Math.abs(e.timestamp - assistEvent.timestamp) <= 5 &&
            e.id !== assistEvent.id
          );
          
          if (candidate) {
            return {
              ...issue,
              suggestion: {
                type: 'LINK_ASSIST',
                targetIds: { eventId: candidate.id },
                confidence: 0.9,
                label: `Link to ${candidate.type.replace('_make', '')} at ${Math.floor(candidate.timestamp/60)}:${(candidate.timestamp%60).toString().padStart(2, '0')}`
              }
            };
          }
        }
      }

      // 2. Missing Rebound Suggestion (Possession Anomaly)
      if (issue.id.startsWith('poss_anomaly_') && issue.message.includes('Missed shot') && issue.relatedIds?.possessionId) {
        const poss = possessions.find(p => p.id === issue.relatedIds?.possessionId);
        if (poss) {
          const sortedEvents = sortEventsChronologically(events);
          const possEvents = sortedEvents.filter(e => e.possessionId === poss.id);
          const missedShot = possEvents.find(e => e.type.includes('_miss'));
          if (missedShot) {
            const missedShotIndex = sortedEvents.findIndex(e => e.id === missedShot.id);
            let nextEvent = null;
            if (missedShotIndex !== -1) {
              for (let i = missedShotIndex + 1; i < sortedEvents.length; i++) {
                const e = sortedEvents[i];
                if (['sub_in', 'sub_out', 'timeout'].includes(e.type)) {
                  continue;
                }
                nextEvent = e;
                break;
              }
            }

            let confidence = 0.4;
            let isSameTeam = false;
            let label = 'Insert Defensive Rebound after missed shot';
            
            if (nextEvent && nextEvent.quarter === missedShot.quarter) {
              const elapsed = Math.max(0, missedShot.timestamp - nextEvent.timestamp);
              isSameTeam = nextEvent.team === missedShot.team;
              if (elapsed < 3) {
                confidence = 0.85;
              } else if (elapsed <= 10) {
                confidence = 0.6;
              } else {
                confidence = 0.4;
              }
              label = `Insert ${isSameTeam ? 'Offensive' : 'Defensive'} Rebound after missed shot`;
            } else {
              confidence = 0.4;
            }

            return {
              ...issue,
              suggestion: {
                type: 'INSERT_REBOUND',
                targetIds: { eventId: missedShot.id, playerId: isSameTeam ? missedShot.playerId : undefined },
                confidence,
                label
              }
            };
          }
        }
      }

      // 3. Orphan Steal Suggestion
      if (issue.id.startsWith('event_orphan_stl_') && issue.relatedIds?.eventId) {
        const stealEvent = events.find(e => e.id === issue.relatedIds?.eventId);
        if (stealEvent) {
          // Find closest turnover by opposing team within 3 seconds
          const candidate = events.find(e => 
            e.type === 'to' &&
            e.team !== stealEvent.team &&
            Math.abs(e.timestamp - stealEvent.timestamp) <= 3
          );
          
          if (candidate) {
            return {
              ...issue,
              suggestion: {
                type: 'LINK_STEAL',
                targetIds: { eventId: candidate.id },
                confidence: 0.95,
                label: `Link to turnover by opponent at ${Math.floor(candidate.timestamp/60)}:${(candidate.timestamp%60).toString().padStart(2, '0')}`
              }
            };
          }
        }
      }

      // 4. Unclosed Possession Suggestion
      if (issue.id.startsWith('poss_unclosed_') && issue.relatedIds?.possessionId) {
        const poss = possessions.find(p => p.id === issue.relatedIds?.possessionId);
        if (poss) {
          // Find first event of next possession or end of period
          const nextEvent = events.find(e => 
            (e.quarter === poss.period && e.timestamp < (poss.clockStart || 0)) ||
            (e.quarter > poss.period)
          );
          
          if (nextEvent) {
            return {
              ...issue,
              suggestion: {
                type: 'CLOSE_POSSESSION',
                targetIds: { eventId: nextEvent.id },
                confidence: 0.7,
                label: `Close possession at ${Math.floor(nextEvent.timestamp/60)}:${(nextEvent.timestamp%60).toString().padStart(2, '0')}`
              }
            };
          }
        }
      }

      // 5. Player Attribution Suggestion
      if (issue.type === 'PLAYER_NOT_ON_COURT' && issue.relatedIds?.eventId && issue.relatedIds?.stintId) {
        const event = events.find(e => e.id === issue.relatedIds?.eventId);
        const stint = stints.find(s => s.id === issue.relatedIds?.stintId);
        
        if (event && stint) {
          // Suggest reassigning to an active player on the same team
          // We'll pick the first active player as a low-confidence suggestion
          const targetPlayerId = stint.playerIds[0];
          
          return {
            ...issue,
            suggestion: {
              type: 'REASSIGN_PLAYER',
              targetIds: { eventId: event.id, stintId: stint.id, playerId: targetPlayerId },
              confidence: 0.4, // Low confidence
              label: `Reassign to active player (e.g. ${targetPlayerId})`
            }
          };
        }
      }

      // 6. Missing Substitution Suggestion
      if (issue.type === 'POSSIBLE_MISSING_SUBSTITUTION' && issue.relatedIds?.eventId) {
        const event = events.find(e => e.id === issue.relatedIds?.eventId);
        if (event) {
          return {
            ...issue,
            suggestion: {
              type: 'ADJUST_STINT_TIME',
              targetIds: { eventId: event.id },
              confidence: 0.6,
              label: `Adjust nearby stint to cover this event`
            }
          };
        }
      }

      return issue;
    });
  },

  applyAuditSuggestion: async (matchId: string, issue: AuditIssue): Promise<boolean> => {
    if (!issue.suggestion) return false;

    const { type, targetIds } = issue.suggestion;
    let success = false;
    
    switch (type) {
      case 'LINK_ASSIST':
        if (issue.relatedIds?.eventId && targetIds.eventId) {
          await statsService.createAssistShotLink(matchId, issue.relatedIds.eventId, targetIds.eventId);
          success = true;
        }
        break;
      
      case 'LINK_STEAL':
        if (issue.relatedIds?.eventId && targetIds.eventId) {
          await statsService.createStealTurnoverLink(matchId, issue.relatedIds.eventId, targetIds.eventId);
          success = true;
        }
        break;

      case 'INSERT_REBOUND':
        if (targetIds.eventId) {
          const db = await initDB();
          const missedShot = await db.get('events', targetIds.eventId);
          if (missedShot) {
            const isOffensive = !!targetIds.playerId;
            const reboundEvent: GameEvent = {
              id: generateId('event'),
              matchId,
              playerId: targetIds.playerId || undefined as any, // level tim dengan playerId undefined
              actorType: targetIds.playerId ? undefined : 'team' as any, // dan actorType 'team'
              type: isOffensive ? 'oreb' : 'dreb',
              timestamp: missedShot.timestamp - 1, // 1s after shot (clock counts down)
              quarter: missedShot.quarter,
              realTime: new Date().toISOString(),
              team: isOffensive ? missedShot.team : (missedShot.team === 'home' ? 'away' : 'home'),
              possessionId: missedShot.possessionId
            };
            await statsService.addEvent(reboundEvent);
            // Also link it
            await statsService.createReboundShotLink(matchId, reboundEvent.id, missedShot.id);
            success = true;
          }
        }
        break;

      case 'CLOSE_POSSESSION':
        if (issue.relatedIds?.possessionId && targetIds.eventId) {
          const db = await initDB();
          const poss = await db.get('possessions', issue.relatedIds.possessionId);
          const closingEvent = await db.get('events', targetIds.eventId);
          if (poss && closingEvent) {
            await statsService.closePossession(poss, {
              clockEnd: closingEvent.timestamp,
              closingEventId: closingEvent.id,
              closingAction: 'deadball_end',
              outcome: 'empty'
            });
            success = true;
          }
        }
        break;

      case 'REASSIGN_PLAYER':
        if (targetIds.eventId && targetIds.playerId) {
          const db = await initDB();
          const event = await db.get('events', targetIds.eventId);
          if (event) {
            event.playerId = targetIds.playerId;
            await statsService.updateEvent(event);
            success = true;
          }
        }
        break;
    }

    if (success) {
      // Mark issue as resolved with metadata
      await statsService.saveAuditIssueResolution(matchId, issue.id, 'resolved', {
        appliedSuggestionType: type,
        confidence: issue.suggestion.confidence,
        appliedAutomatically: false // Will be set to true if called from batch
      });
    } else {
      // Mark issue as failed
      await statsService.saveAuditIssueResolution(matchId, issue.id, 'failed', {
        appliedSuggestionType: type,
        confidence: issue.suggestion.confidence,
        appliedAutomatically: false
      });
    }

    return success;
  },

  applyBatchSuggestions: async (matchId: string, issues: AuditIssue[], confidenceThreshold: number = 0.8) => {
    for (const issue of issues) {
      if (issue.suggestion && issue.status === 'open' && issue.suggestion.confidence >= confidenceThreshold) {
        // For risky types like REASSIGN_PLAYER, we might want to skip batch unless confidence is extremely high
        if (issue.suggestion.type === 'REASSIGN_PLAYER' && issue.suggestion.confidence < 0.95) continue;
        
        const success = await statsService.applyAuditSuggestion(matchId, issue);
        
        if (success) {
          // Update the resolution to reflect it was automatic
          const db = await initDB();
          const resId = `${matchId}_${issue.id}`;
          const res = await db.get('audit_issue_resolutions', resId);
          if (res) {
            res.fixMetadata = { ...res.fixMetadata, appliedAutomatically: true };
            await db.put('audit_issue_resolutions', res);
          }
        }
      }
    }
  },

  clearAllData: async () => {
    const db = await initDB();
    db.close();
    purgeLegacyIndexedDb();
    const res = await fetch("/api/admin/wipe", { method: "POST", credentials: "include" });
    if (!res.ok) {
      throw new Error("Failed to wipe Postgres stores");
    }
  }
};

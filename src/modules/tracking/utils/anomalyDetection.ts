import { GameEvent, MatchRoster } from '../../../core/types/stats';

const NON_GAMEPLAY_TYPES = ['sub_in', 'sub_out', 'timeout', 'starter', 'inbound'];

/**
 * Checks if logging a new play-by-play action constitutes a possession anomaly
 * relative to the chronologically last gameplay event.
 */
export function checkPossessionAnomaly(
  type: string,
  eventTeam: 'home' | 'away',
  events: GameEvent[],
  matchRosters: MatchRoster[],
  homeTeamId: string,
  recordingType: string
): boolean {
  if (events.length === 0 || NON_GAMEPLAY_TYPES.includes(type) || recordingType === 'single') {
    return false;
  }

  const sortedGameplayEvents = [...events]
    .filter(e => !NON_GAMEPLAY_TYPES.includes(e.type))
    .sort((a, b) => {
      if (a.quarter !== b.quarter) return a.quarter - b.quarter;
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      
      const timeA = a.realTime ? new Date(a.realTime).getTime() : 0;
      const timeB = b.realTime ? new Date(b.realTime).getTime() : 0;
      return timeA - timeB;
    });

  const lastEvent = sortedGameplayEvents[sortedGameplayEvents.length - 1];
  if (!lastEvent) {
    return false;
  }

  const lastEventIsHome = 
    matchRosters.some(r => r.teamId === homeTeamId && r.profileId === lastEvent.playerId) || 
    lastEvent.playerId === 'home_team' || 
    lastEvent.playerId === homeTeamId ||
    lastEvent.playerId === 'our_team';
  
  let inferredPossessionTeam: 'home' | 'away' | 'contested' = lastEvent.possession || 'contested';
  
  // Update inferred possession based on last event
  if (['2pt_make', '3pt_make'].includes(lastEvent.type)) {
    inferredPossessionTeam = lastEventIsHome ? 'away' : 'home';
  } else if (['1pt_make', '1pt_miss'].includes(lastEvent.type)) {
    inferredPossessionTeam = 'contested';
  } else if (['to', 'foul', 'offensive_foul', 'defensive_foul'].includes(lastEvent.type)) {
    inferredPossessionTeam = lastEventIsHome ? 'away' : 'home';
  } else if (['stl', 'dreb', 'oreb'].includes(lastEvent.type)) {
    inferredPossessionTeam = lastEventIsHome ? 'home' : 'away';
  } else if (['2pt_miss', '3pt_miss', 'blk'].includes(lastEvent.type)) {
    inferredPossessionTeam = 'contested';
  }

  const isDefensiveAction = ['stl', 'dreb', 'blk'].includes(type);
  const isOffensiveAction = ['1pt_make', '2pt_make', '3pt_make', '1pt_miss', '2pt_miss', '3pt_miss', 'to', 'oreb'].includes(type);

  if (isDefensiveAction && inferredPossessionTeam === eventTeam) {
    return true; // Stealing when we already have possession
  } else if (isOffensiveAction && inferredPossessionTeam !== eventTeam && inferredPossessionTeam !== 'contested') {
    return true; // Scoring when opponent has possession
  }

  return false;
}

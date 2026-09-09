import { Match, GameEvent, MatchStint } from '../types/stats';

/**
 * Checks if a match is countable for statistics (not aborted and not excluded).
 */
export const isCountableMatch = (m: Match): boolean => {
  return m.status !== 'aborted' && !m.excludeFromStats;
};

/**
 * Checks if an athlete actually played in a match.
 * Playing means having at least one event in that match OR being in a MatchStint playerIds list for that match.
 */
export const didPlayInMatch = (
  profileId: string,
  matchId: string,
  events: GameEvent[],
  stints: MatchStint[]
): boolean => {
  const hasEvent = events.some(e => e.matchId === matchId && e.playerId === profileId);
  const hasStint = stints.some(s => s.matchId === matchId && s.playerIds && s.playerIds.includes(profileId));
  return hasEvent || hasStint;
};

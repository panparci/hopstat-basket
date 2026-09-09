import { GameEvent } from '../types/stats';

/**
 * Finds all events that belong to the same logical "set" or play sequence.
 * 
 * Grouping is determined by:
 * 1. Matching flowGroupId in event metadata.
 * 2. Logical sequence at the exact/near same game time (e.g., Foul + Foul Drawn, Shot + Block/Assist/Rebound).
 */
export function findRelatedEvents(targetEvent: GameEvent, allEvents: GameEvent[]): GameEvent[] {
  if (!targetEvent) return [];
  const related = new Set<GameEvent>();
  related.add(targetEvent);

  // 1. Group by flowGroupId in metadata
  const flowGroupId = targetEvent.metadata?.flowGroupId;
  if (flowGroupId) {
    allEvents.forEach(e => {
      if (e.metadata?.flowGroupId === flowGroupId) {
        related.add(e);
      }
    });
  }

  // 2. Fallback matching logic based on game time (within 3 seconds) and roles:
  const targetTime = targetEvent.timestamp;
  const targetQuarter = targetEvent.quarter;

  const actionTypes = [
    '2pt_make', '3pt_make', '2pt_miss', '3pt_miss', '1pt_make', '1pt_miss', 
    'oreb', 'dreb', 'blk', 'blocked_shot', 'ast',
    'foul', 'foul_drawn', 'defensive_foul', 'offensive_foul',
    'stl', 'to'
  ];

  const isAction = actionTypes.includes(targetEvent.type);

  const areEventsRelated = (a: GameEvent, b: GameEvent): boolean => {
    if (a.id === b.id) return true;

    const typeA = a.type;
    const typeB = b.type;
    const teamA = a.team;
    const teamB = b.team;

    // Same team for made shot + assist
    if (['2pt_make', '3pt_make'].includes(typeA) && typeB === 'ast') {
      return teamA === teamB;
    }
    if (typeA === 'ast' && ['2pt_make', '3pt_make'].includes(typeB)) {
      return teamA === teamB;
    }

    // Opposing team for steal + turnover
    if (typeA === 'stl' && typeB === 'to') {
      return teamA !== teamB;
    }
    if (typeA === 'to' && typeB === 'stl') {
      return teamA !== teamB;
    }

    // Opposing team for block + missed shot
    if (typeA === 'blk' && ['2pt_miss', '3pt_miss'].includes(typeB)) {
      return teamA !== teamB;
    }
    if (['2pt_miss', '3pt_miss'].includes(typeA) && typeB === 'blk') {
      return teamA !== teamB;
    }

    // Offensive rebound (oreb) must be same team as missed shot
    if (typeA === 'oreb' && ['2pt_miss', '3pt_miss', '1pt_miss'].includes(typeB)) {
      return teamA === teamB;
    }
    if (['2pt_miss', '3pt_miss', '1pt_miss'].includes(typeA) && typeB === 'oreb') {
      return teamA === teamB;
    }

    // Defensive rebound (dreb) must be opposing team of missed shot
    if (typeA === 'dreb' && ['2pt_miss', '3pt_miss', '1pt_miss'].includes(typeB)) {
      return teamA !== teamB;
    }
    if (['2pt_miss', '3pt_miss', '1pt_miss'].includes(typeA) && typeB === 'dreb') {
      return teamA !== teamB;
    }

    // Foul + Foul Drawn must be opposing teams
    const foulTypes = ['foul', 'defensive_foul', 'offensive_foul'];
    if (foulTypes.includes(typeA) && typeB === 'foul_drawn') {
      return teamA !== teamB;
    }
    if (typeA === 'foul_drawn' && foulTypes.includes(typeB)) {
      return teamA !== teamB;
    }

    // Free Throw sequence: DO NOT group consecutive/multiple free throws together.
    // Each free throw is a distinct event, editing one must not edit or delete other free throws.
    if (['1pt_make', '1pt_miss'].includes(typeA) && ['1pt_make', '1pt_miss'].includes(typeB)) {
      return false;
    }

    // Identical types and same player/team
    if (typeA === typeB) {
      if (['1pt_make', '1pt_miss'].includes(typeA)) {
        return false;
      }
      return teamA === teamB && a.playerId === b.playerId;
    }

    return false;
  };

  allEvents.forEach(e => {
    // Must be same match, quarter, and near in time
    if (e.matchId === targetEvent.matchId && e.quarter === targetQuarter && Math.abs(e.timestamp - targetTime) <= 3) {
      if (isAction && actionTypes.includes(e.type)) {
        if (areEventsRelated(targetEvent, e)) {
          related.add(e);
        }
      }
    }
  });

  // Sort chronologically/sequence order
  return Array.from(related).sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    const seqA = a.sequenceNumber ?? 0;
    const seqB = b.sequenceNumber ?? 0;
    if (seqA !== seqB) return seqA - seqB;
    const timeA = a.realTime ? new Date(a.realTime).getTime() : 0;
    const timeB = b.realTime ? new Date(b.realTime).getTime() : 0;
    return timeA - timeB;
  });
}

/**
 * Determines the general "Play Set Type" of a grouped event set.
 */
export type PlaySetType = 'SHOT' | 'FOUL' | 'TURNOVER' | 'OTHER';

export function getPlaySetType(events: GameEvent[]): PlaySetType {
  if (events.some(e => ['2pt_make', '3pt_make', '2pt_miss', '3pt_miss', '1pt_make', '1pt_miss'].includes(e.type))) {
    return 'SHOT';
  }
  if (events.some(e => ['foul', 'foul_drawn', 'defensive_foul', 'offensive_foul'].includes(e.type))) {
    return 'FOUL';
  }
  if (events.some(e => e.type === 'to' || e.type === 'stl')) {
    return 'TURNOVER';
  }
  return 'OTHER';
}

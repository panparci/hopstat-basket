import { Possession, GameEvent } from '../../core/types/stats';

export function getPossessionPlayString(possession: Possession, events: GameEvent[]): string {
  const possessionEvents = events
    .filter(e => e.possessionId === possession.id)
    .sort((a, b) => {
      if (a.quarter !== b.quarter) return a.quarter - b.quarter;
      // b.timestamp - a.timestamp (descending time remaining is ascending real time)
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      const seqA = a.sequenceNumber ?? 0;
      const seqB = b.sequenceNumber ?? 0;
      return seqA - seqB;
    });

  if (possessionEvents.length === 0) {
    const startStr = possession.openingSource ? possession.openingSource.toUpperCase().replace('_', ' ') : '';
    const endStr = possession.closingAction ? possession.closingAction.toUpperCase().replace('_', ' ') : '';
    const parts = [startStr, endStr].filter(Boolean);
    return parts.join(' > ') || 'No Play Data';
  }

  const parts: string[] = [];
  
  // 1. Add phaseOfPlay from the first event that has it, or from possession opening if any
  const firstWithPhase = possessionEvents.find(e => e.phaseOfPlay);
  if (firstWithPhase && firstWithPhase.phaseOfPlay) {
    const phaseLabels: Record<string, string> = {
      set_offense: 'Set Offense',
      fast_break: 'Fast Break',
      transition: 'Transition',
      inbound: 'Inbound',
      deadball: 'Deadball'
    };
    parts.push(phaseLabels[firstWithPhase.phaseOfPlay] || firstWithPhase.phaseOfPlay);
  } else if (possession.openingSource) {
    parts.push(possession.openingSource.replace('_', ' '));
  }

  // 2. Add each event's action / type / subtype
  possessionEvents.forEach(e => {
    if (['sub_in', 'sub_out', 'starter', 'possession_marker', 'substitution'].includes(e.type)) {
      return;
    }

    const eventParts: string[] = [];
    if (e.subType) {
      eventParts.push(e.subType.charAt(0).toUpperCase() + e.subType.slice(1));
    }

    const typeLabels: Record<string, string> = {
      '1pt_make': 'Make FT',
      '1pt_miss': 'Miss FT',
      '2pt_make': 'Make 2',
      '2pt_miss': 'Miss 2',
      '3pt_make': 'Make 3',
      '3pt_miss': 'Miss 3',
      'oreb': 'O-Reb',
      'dreb': 'D-Reb',
      'ast': 'Assist',
      'stl': 'Steal',
      'blk': 'Block',
      'to': 'Turnover',
      'foul': 'Foul',
      'foul_drawn': 'Foul Drawn',
    };

    const typeLabel = typeLabels[e.type] || e.type.replace('_', ' ');
    eventParts.push(typeLabel);

    parts.push(eventParts.join(' - '));
  });

  const uniqueParts: string[] = [];
  parts.forEach(p => {
    const capitalized = p.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    if (uniqueParts[uniqueParts.length - 1] !== capitalized) {
      uniqueParts.push(capitalized);
    }
  });

  return uniqueParts.join(' > ') || 'No Play Data';
}

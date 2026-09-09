import React, { useMemo } from 'react';
import { GameEvent, Player, Match } from '../../core/types/stats';
import { EventLogItem } from '../molecules/EventLogItem';
import { findRelatedEvents } from '../../core/utils/eventGrouping';
import { UndoRedoControls, UndoRedoItem } from './UndoRedoControls';

interface EventLogPanelProps {
  events: GameEvent[];
  allPlayers: Player[];
  undoLastEvent: () => void;
  deleteEvent: (id: string) => void;
  handleAdjustEventTime: (id: string, delta: number) => void;
  handleAdjustYoutubeTime: (id: string, newTime: number) => void;
  onEnrich?: (event: GameEvent) => void;
  onEditSet?: (event: GameEvent) => void;
  match: Match;
  currentYoutubeTime?: number;
  undoStack?: UndoRedoItem[];
  redoStack?: UndoRedoItem[];
  onUndo?: (count: number) => void;
  onRedo?: (count: number) => void;
}

export const EventLogPanel: React.FC<EventLogPanelProps> = ({
  events,
  allPlayers,
  undoLastEvent,
  deleteEvent,
  handleAdjustEventTime,
  handleAdjustYoutubeTime,
  onEnrich,
  onEditSet,
  match,
  currentYoutubeTime,
  undoStack,
  redoStack,
  onUndo,
  onRedo
}) => {
  const getTeamInfo = (event: GameEvent) => {
    const isHome = event.team === 'home';
    const isOurTeam = match.ourHomeAway === 'away' ? !isHome : isHome;
    if (isOurTeam) {
      return { color: match.ourColor || 'var(--color-brand-navy)', theme: match.ourTheme };
    }
    return { color: match.theirColor || '#E11D48', theme: match.theirTheme };
  };

  const activeEventId = useMemo(() => {
    if (currentYoutubeTime === undefined || currentYoutubeTime <= 0) return null;
    const candidates = events.filter(e => e.youtubeTimestamp !== undefined && e.youtubeTimestamp > 0);
    if (candidates.length === 0) return null;
    
    const activeCandidates = candidates.filter(e => {
      const diff = currentYoutubeTime - e.youtubeTimestamp!;
      return diff >= 0 && diff <= 5;
    });

    if (activeCandidates.length > 0) {
      activeCandidates.sort((a, b) => {
        const diffA = currentYoutubeTime - a.youtubeTimestamp!;
        const diffB = currentYoutubeTime - b.youtubeTimestamp!;
        return diffA - diffB;
      });
      return activeCandidates[0].id;
    }
    
    let closestEvent: GameEvent | null = null;
    let minDiff = 5.1;
    for (const e of candidates) {
      const diff = Math.abs(currentYoutubeTime - e.youtubeTimestamp!);
      if (diff < minDiff) {
        minDiff = diff;
        closestEvent = e;
      }
    }
    return closestEvent ? closestEvent.id : null;
  }, [events, currentYoutubeTime]);

  const sortedEvents = React.useMemo(() => {
    const sorted = events.slice().sort((a, b) => {
      if (b.quarter !== a.quarter) return b.quarter - a.quarter;
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      const timeA = a.realTime ? new Date(a.realTime).getTime() : 0;
      const timeB = b.realTime ? new Date(b.realTime).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      const ytA = a.youtubeTimestamp !== undefined ? a.youtubeTimestamp : 0;
      const ytB = b.youtubeTimestamp !== undefined ? b.youtubeTimestamp : 0;
      return ytB - ytA;
    });

    const result: GameEvent[] = [];
    for (const e of sorted) {
      if (['foul', 'defensive_foul', 'offensive_foul', 'foul_drawn'].includes(e.type)) {
        const duplicate = result.find(r => {
          if (r.quarter !== e.quarter || r.playerId !== e.playerId || Math.abs(r.timestamp - e.timestamp) > 2) return false;
          if (['foul', 'defensive_foul', 'offensive_foul'].includes(e.type)) {
            return ['foul', 'defensive_foul', 'offensive_foul'].includes(r.type);
          }
          return r.type === e.type;
        });
        if (duplicate) continue;
      }
      result.push(e);
    }
    return result;
  }, [events]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors flex-1 overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-2 shrink-0">
        <h2 className="text-sm font-bold text-[#1A1A1A] dark:text-white">Event Log</h2>
        {undoStack && redoStack && onUndo && onRedo ? (
          <UndoRedoControls
            undoStack={undoStack}
            redoStack={redoStack}
            onUndo={onUndo}
            onRedo={onRedo}
          />
        ) : (
          <button onClick={undoLastEvent} className="text-xs text-red-500 dark:text-red-400 font-bold uppercase tracking-widest hover:underline">Undo Last</button>
        )}
      </div>
      <div className="flex flex-col gap-0 overflow-y-auto flex-1">
        {sortedEvents.map((e, index) => {
          const p = allPlayers.find(r => r.id === e.playerId);
          let playerName = p?.displayName || p?.name || 'Unknown';
          if (p && p.jersey) {
            playerName = `${playerName} (#${p.jersey})`;
          }
          
          if (e.playerId === 'home_team' || e.playerId === match.teamId) {
            playerName = match.ourTeamName || 'Home Team';
          } else if (e.playerId === 'away_team' || e.playerId === match.opponentTeamId || e.playerId === 'opp') {
            playerName = match.theirTeamName || 'Opponent Team';
          }

          const teamInfo = getTeamInfo(e);
          
          // Check for sync issue (timestamp vs youtubeTimestamp)
          // sortedEvents has newest (latest game time) first. So sortedEvents[index + 1] is an older event.
          // Therefore, e.youtubeTimestamp should be >= sortedEvents[index + 1].youtubeTimestamp
          let hasSyncWarning = false;
          if (index < sortedEvents.length - 1) {
            const olderEvent = sortedEvents[index + 1];
            if (e.youtubeTimestamp && olderEvent.youtubeTimestamp && e.timestamp !== olderEvent.timestamp) {
              if (e.youtubeTimestamp < olderEvent.youtubeTimestamp - 2) {
                hasSyncWarning = true;
              }
            }
          }

          let flowGroupPosition: "top" | "middle" | "bottom" | "none" = "none";
          
          const olderEvent = index < sortedEvents.length - 1 ? sortedEvents[index + 1] : null;
          const newerEvent = index > 0 ? sortedEvents[index - 1] : null;
          
          let isSameAsOlder = false;
          let isSameAsNewer = false;

          if (e.metadata?.flowGroupId) {
            isSameAsOlder = olderEvent?.metadata?.flowGroupId === e.metadata.flowGroupId;
            isSameAsNewer = newerEvent?.metadata?.flowGroupId === e.metadata.flowGroupId;
          } else {
             const related = findRelatedEvents(e, sortedEvents);
             if (olderEvent && related.some(r => r.id === olderEvent.id)) isSameAsOlder = true;
             if (newerEvent && related.some(r => r.id === newerEvent.id)) isSameAsNewer = true;
          }

          if (isSameAsNewer && !isSameAsOlder) {
            flowGroupPosition = "bottom";
          } else if (!isSameAsNewer && isSameAsOlder) {
            flowGroupPosition = "top";
          } else if (isSameAsNewer && isSameAsOlder) {
            flowGroupPosition = "middle";
          }

          return (
            <EventLogItem
              key={e.id}
              event={e}
              playerName={playerName}
              onDelete={deleteEvent}
              onTimeAdjust={handleAdjustEventTime}
              onYoutubeTimeAdjust={handleAdjustYoutubeTime}
              onEnrich={onEnrich}
              onEditSet={onEditSet}
              teamColor={teamInfo.color}
              teamTheme={teamInfo.theme}
              ourHomeAway={match.ourHomeAway}
              hasSyncWarning={hasSyncWarning}
              isActive={e.id === activeEventId}
              flowGroupPosition={flowGroupPosition}
            />
          );
        })}
        {events.length === 0 && <p className="text-zinc-500 text-center py-4 text-xs">No events recorded yet.</p>}
      </div>
    </div>
  );
};

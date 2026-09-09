import React, { useMemo, useState } from 'react';
import { GameEvent, Player } from '../../core/types/stats';
import { Clock, Activity, ArrowRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface EventAndPossessionLogProps {
  events: GameEvent[];
  players: Player[];
  onSeek?: (timestamp: number) => void;
  hasVideo?: boolean;
}

export const EventAndPossessionLog: React.FC<EventAndPossessionLogProps> = ({ events, players, onSeek, hasVideo }) => {
  const [view, setView] = useState<'event' | 'possession'>('event');

  const getPlayerName = (id: string) => {
    if (id === 'opp' || id === 'away_team') return 'Opponent';
    if (id === 'home_team') return 'Home Team';
    const player = players.find(p => p.id === id);
    if (!player) return 'Unknown';
    return player.jersey ? `${player.name} (#${player.jersey})` : player.name;
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      if (a.quarter !== b.quarter) return a.quarter - b.quarter;
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      
      // If the game time clock is the same, sort by chronological registration order (ascending realTime)
      const timeA = a.realTime ? new Date(a.realTime).getTime() : 0;
      const timeB = b.realTime ? new Date(b.realTime).getTime() : 0;
      return timeA - timeB;
    });
  }, [events]);

  const possessions = useMemo(() => {
    const groups: Record<string, GameEvent[]> = {};
    const unassigned: GameEvent[] = [];

    sortedEvents.forEach(ev => {
      if (ev.possessionId) {
        if (!groups[ev.possessionId]) groups[ev.possessionId] = [];
        groups[ev.possessionId].push(ev);
      } else {
        unassigned.push(ev);
      }
    });

    return Object.values(groups).map(group => {
      const startEvent = group[0];
      const endEvent = group[group.length - 1];
      
      const pts = group.reduce((sum, e) => sum + (e.points || 0), 0);
      const hasMake = group.some(e => e.type.includes('make'));
      const hasTO = group.some(e => e.type === 'to');
      const hasMiss = group.some(e => e.type.includes('miss'));
      const hasFoul = group.some(e => ['foul', 'offensive_foul', 'defensive_foul'].includes(e.type));

      let outcome: 'Scored' | 'Turnover' | 'Missed' | 'Foul' | 'Other' = 'Other';
      if (hasMake) outcome = 'Scored';
      else if (hasTO) outcome = 'Turnover';
      else if (hasMiss) outcome = 'Missed';
      else if (hasFoul) outcome = 'Foul';

      return {
        id: startEvent.possessionId,
        quarter: startEvent.quarter,
        startTime: startEvent.timestamp,
        endTime: endEvent.timestamp,
        startEvent,
        endEvent,
        events: group,
        outcome,
        points: pts
      };
    }).sort((a, b) => {
      if (a.quarter !== b.quarter) return a.quarter - b.quarter;
      return b.startTime - a.startTime;
    });
  }, [sortedEvents]);

  const getEventIcon = (type: string) => {
    if (type.includes('make')) return <CheckCircle2 className="text-emerald-500 w-4 h-4" />;
    if (type.includes('miss')) return <XCircle className="text-red-500 w-4 h-4" />;
    if (type === 'to') return <AlertCircle className="text-amber-500 w-4 h-4" />;
    if (type === 'ast') return <ArrowRight className="text-blue-500 w-4 h-4" />;
    return <Activity className="text-zinc-400 w-4 h-4" />;
  };

  const formatEventType = (ev: GameEvent) => {
    let baseType = ev.type;
    let name = baseType.replace('_', ' ').toUpperCase();
    if (baseType === 'oreb') name = 'OFFENSIVE REBOUND';
    else if (baseType === 'dreb') name = 'DEFENSIVE REBOUND';
    
    let text = name;
    if (ev.subType) text += ` (${ev.subType})`;
    if (ev.turnoverType) text += ` - ${ev.turnoverType}`;
    if (ev.shotDifficulty) text += ` [${ev.shotDifficulty}]`;
    return text;
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-display font-black italic text-xl uppercase tracking-tight">Game Logs</h3>
          <p className="text-sm font-medium text-zinc-500 mt-1">
            Total Possessions: <span className="text-brand-navy dark:text-brand-orange font-bold">{possessions.length}</span> recorded so far
          </p>
        </div>
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setView('event')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === 'event' ? 'bg-white dark:bg-zinc-700 shadow-sm text-brand-navy dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            Event Log
          </button>
          <button
            onClick={() => setView('possession')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === 'possession' ? 'bg-white dark:bg-zinc-700 shadow-sm text-brand-navy dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            Possession Log
          </button>
        </div>
      </div>

      {view === 'event' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950/50 text-xs uppercase tracking-wider text-zinc-500 font-bold">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4">Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sortedEvents.map((ev, idx) => (
                <tr key={ev.id || idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors text-sm">
                  <td className="py-3 px-4 whitespace-nowrap text-zinc-500 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      {hasVideo && onSeek && (
                        <button 
                          onClick={() => onSeek(ev.youtubeTimestamp || ev.timestamp)}
                          className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors text-brand-navy dark:text-brand-orange"
                          title="Seek Video"
                        >
                          <Clock size={14} />
                        </button>
                      )}
                      <span>Q{ev.quarter} | {formatTime(ev.timestamp)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-bold text-zinc-800 dark:text-zinc-200">
                    {getPlayerName(ev.playerId)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {getEventIcon(ev.type)}
                      <span className="font-medium">{formatEventType(ev)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-zinc-500 whitespace-nowrap">
                    {ev.possessionId && (
                      <span className="mr-2 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-mono font-bold rounded" title="Possession ID">
                        #{ev.possessionId.slice(-4)}
                      </span>
                    )}
                    {ev.gameContext && <span className="mr-2 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">{ev.gameContext}</span>}
                    {ev.pressureLevel && <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">{ev.pressureLevel}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {possessions.map((poss, idx) => (
            <div key={poss.id || idx} className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-zinc-500 bg-zinc-200 dark:bg-zinc-700 px-2 py-1 rounded">
                    Q{poss.quarter}
                  </span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                    Possession #{possessions.length - idx}
                  </span>
                  <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    ID: {poss.id.slice(-6)}
                  </span>
                  {hasVideo && onSeek && (
                    <button 
                      onClick={() => onSeek(poss.startEvent.youtubeTimestamp || poss.startEvent.timestamp)}
                      className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors text-brand-navy dark:text-brand-orange ml-2"
                      title="Seek Possession Start"
                    >
                      <Clock size={16} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {poss.outcome === 'Scored' && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold rounded-md flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Scored ({poss.points} pts)</span>}
                  {poss.outcome === 'Turnover' && <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold rounded-md flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Turnover</span>}
                  {poss.outcome === 'Missed' && <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold rounded-md flex items-center gap-1"><XCircle className="w-3 h-3"/> Missed</span>}
                  {poss.outcome === 'Foul' && <span className="px-2 py-1 bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-md">Foul</span>}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                  <div className="text-xs uppercase tracking-wider text-zinc-500 font-bold mb-1">Opening By</div>
                  <div className="font-medium text-zinc-800 dark:text-zinc-200">
                    {getPlayerName(poss.startEvent.playerId)} <span className="text-zinc-500 text-xs ml-1">({poss.startEvent.type.toUpperCase()})</span>
                  </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                  <div className="text-xs uppercase tracking-wider text-zinc-500 font-bold mb-1">Closing By</div>
                  <div className="font-medium text-zinc-800 dark:text-zinc-200">
                    {getPlayerName(poss.endEvent.playerId)} <span className="text-zinc-500 text-xs ml-1">({formatEventType(poss.endEvent)})</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {possessions.length === 0 && (
            <div className="text-center py-8 text-zinc-500">
              No possession data available. Make sure events are tracked with possession context.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

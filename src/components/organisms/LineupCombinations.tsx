import React, { useMemo, useState } from 'react';
import { GameEvent, Player, GameState, Match, MatchStint, EventLink, MatchRoster } from '../../core/types/stats';

interface LineupCombinationsProps {
  events: GameEvent[];
  players: Player[];
  gameState: GameState;
  duration: number;
  match: Match;
  matchStints: MatchStint[];
  eventLinks: EventLink[];
  matchRosters: MatchRoster[];
}

export const LineupCombinations: React.FC<LineupCombinationsProps> = ({ events, players, gameState, duration, match, matchStints, eventLinks, matchRosters }) => {
  const [comboSize, setComboSize] = useState<2 | 3>(2);

  const combinations = useMemo(() => {
    if (!matchStints || matchStints.length === 0) return [];

    // Helper to get combinations of size k from an array
    const getCombinations = (arr: string[], k: number): string[][] => {
      if (k === 1) return arr.map(a => [a]);
      const combos: string[][] = [];
      for (let i = 0; i <= arr.length - k; i++) {
        const head = arr.slice(i, i + 1);
        const tailCombos = getCombinations(arr.slice(i + 1), k - 1);
        for (const tail of tailCombos) {
          combos.push(head.concat(tail));
        }
      }
      return combos;
    };

    const stats: Record<string, { 
      playerIds: string[], 
      min: number, 
      ptsFor: number, 
      ptsAgainst: number, 
      ptsTogether: number,
      assists: number,
      possessionsInvolved: number,
      successfulPossessions: number
    }> = {};

    // 1. Process each valid stint
    matchStints.forEach(stint => {
      let stintDuration = 0;
      if (stint.endQuarter !== undefined && stint.endClock !== undefined) {
        if (stint.startQuarter === stint.endQuarter) {
          stintDuration = stint.startClock - stint.endClock;
        } else {
          stintDuration = stint.startClock;
        }
      } else if (gameState) {
        if (stint.startQuarter === gameState.currentQuarter) {
          stintDuration = stint.startClock - gameState.timeRemaining;
        }
      }

      if (stintDuration <= 0 || !stint.playerIds || stint.playerIds.length === 0) return;

      const combos = getCombinations([...stint.playerIds].sort(), comboSize);
      
      // Get events for this stint
      const stintEvents = events.filter(e => {
        // Time-range matching for all events
        if (e.quarter < stint.startQuarter) return false;
        if (e.quarter > (stint.endQuarter ?? 99)) return false;
        if (e.quarter === stint.startQuarter && e.timestamp > stint.startClock) return false;
        if (stint.endQuarter !== undefined && e.quarter === stint.endQuarter && e.timestamp < stint.endClock!) return false;
        return true;
      });

      combos.forEach(combo => {
        const key = combo.join(',');
        if (!stats[key]) {
          stats[key] = { playerIds: combo, min: 0, ptsFor: 0, ptsAgainst: 0, ptsTogether: 0, assists: 0, possessionsInvolved: 0, successfulPossessions: 0 };
        }
        stats[key].min += stintDuration;

        // Process events for this combo in this stint
        stintEvents.forEach(ev => {
          // Handle Scoring
          if (['1pt_make', '2pt_make', '3pt_make'].includes(ev.type)) {
            const points = ev.type === '1pt_make' ? 1 : ev.type === '2pt_make' ? 2 : 3;
            const isOpponent = ev.playerId === 'opp' || ev.playerId === 'away_team' || matchRosters.some(r => r.profileId === ev.playerId && r.teamId === (match.opponentTeamId || 'away_team'));
            
            if (isOpponent) {
              stats[key].ptsAgainst += points;
            } else {
              stats[key].ptsFor += points;
              // PTS Together: if the scorer is IN the combo
              if (combo.includes(ev.playerId)) {
                stats[key].ptsTogether += points;
              }
            }
          }

          // Handle Assists
          if (ev.type === 'ast') {
            const assister = ev.playerId;
            let scorer: string | undefined;

            // Prefer EventLinks for structured relationship
            const assistLink = eventLinks.find(l => l.primaryEventId === ev.id && l.relationType === 'ASSISTS');
            if (assistLink) {
              const shotEvent = events.find(e => e.id === assistLink.secondaryEventId);
              scorer = shotEvent?.playerId;
            } else {
              // No related player found
              scorer = undefined;
            }

            if (scorer && combo.includes(assister) && combo.includes(scorer)) {
              stats[key].assists += 1;
            }
          }
        });

        // Handle Possessions (Simplified: count possessions that started or ended in this stint)
        const stintPossessions = new Set(stintEvents.filter(e => e.possessionId).map(e => e.possessionId));
        stintPossessions.forEach(pid => {
          stats[key].possessionsInvolved += 1;
          const pEvents = stintEvents.filter(e => e.possessionId === pid);
          if (pEvents.some(e => e.type.includes('make'))) {
            stats[key].successfulPossessions += 1;
          }
        });
      });
    });

    // Format, score, and sort
    return Object.values(stats)
      .filter(stat => stat.min >= 60) // Cleansing Rule: Exclude if MIN < 1 minute
      .map(stat => {
        const plusMinus = stat.ptsFor - stat.ptsAgainst;
        const possSuccessRate = stat.possessionsInvolved > 0 ? (stat.successfulPossessions / stat.possessionsInvolved) : 0;
        
        const synergyScore = (stat.ptsTogether * 1.5) + (stat.assists * 3.0) + (possSuccessRate * 100 * 2.0) + (plusMinus * 1.0);

        return {
          ...stat,
          min: Math.round(stat.min / 60),
          plusMinus,
          possSuccessRate: Math.round(possSuccessRate * 100),
          synergyScore: Math.round(synergyScore)
        };
      })
      .sort((a, b) => b.synergyScore - a.synergyScore) // Sort by Synergy Score
      .slice(0, 5); // Top 5

  }, [events, gameState, duration, comboSize, matchStints, matchRosters, eventLinks, match.opponentTeamId]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="font-display font-black italic text-lg uppercase tracking-tight">Top Lineup Combinations</h3>
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setComboSize(2)}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${comboSize === 2 ? 'bg-white dark:bg-zinc-700 shadow-sm text-brand-navy dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            2-Man
          </button>
          <button
            onClick={() => setComboSize(3)}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${comboSize === 3 ? 'bg-white dark:bg-zinc-700 shadow-sm text-brand-navy dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            3-Man
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-950/50 text-xs uppercase tracking-wider text-zinc-500 font-bold">
              <th className="py-3 px-4 sticky left-0 bg-zinc-50 dark:bg-zinc-950/50 z-10">Combination</th>
              <th className="py-3 px-2 text-center">MIN</th>
              <th className="py-3 px-2 text-center" title="Points scored by players IN this combination">PTS Together</th>
              <th className="py-3 px-2 text-center" title="Assists between players in this combination">Direct AST</th>
              <th className="py-3 px-2 text-center" title="Percentage of possessions ending in a score while on court">Poss Success</th>
              <th className="py-3 px-2 text-center">+/-</th>
              <th className="py-3 px-2 text-center text-purple-600 dark:text-purple-400" title="Weighted score based on PTS Together, Direct AST, Poss Success, and +/-">Synergy Score</th>
            </tr>
          </thead>
          <tbody>
            {combinations.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-500">No combination data available (requires at least 1 minute of play).</td>
              </tr>
            ) : (
              combinations.map((combo, idx) => {
                const playerNames = combo.playerIds
                  .map(id => players.find(p => p.id === id)?.name || 'Unknown')
                  .join(' + ');
                return (
                  <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800 text-xs">
                    <td className="py-3 px-4 font-bold text-[#1A1A1A] dark:text-white sticky left-0 bg-white dark:bg-zinc-900 max-w-[200px] truncate" title={playerNames}>
                      {playerNames}
                    </td>
                    <td className="py-3 px-2 text-center text-zinc-500">{combo.min}</td>
                    <td className="py-3 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400">{combo.ptsTogether}</td>
                    <td className="py-3 px-2 text-center font-bold text-blue-600 dark:text-blue-400">{combo.assists}</td>
                    <td className="py-3 px-2 text-center font-bold text-amber-600 dark:text-amber-400">{combo.possSuccessRate}%</td>
                    <td className={`py-3 px-2 text-center font-bold ${combo.plusMinus > 0 ? 'text-emerald-600 dark:text-emerald-400' : combo.plusMinus < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>
                      {combo.plusMinus > 0 ? '+' : ''}{combo.plusMinus}
                    </td>
                    <td className="py-3 px-2 text-center font-black text-purple-600 dark:text-purple-400">{combo.synergyScore}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

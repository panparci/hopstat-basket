import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { GameEvent, Player } from '../../core/types/stats';
import { BasketballCourt } from '../atoms/BasketballCourt';

interface ShotChartAnalysisProps {
  events: GameEvent[];
  players: Player[];
}

export const ShotChartAnalysis: React.FC<ShotChartAnalysisProps> = ({ events, players }) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('all');

  // Filter events to only include shots with coordinates
  const shotEvents = useMemo(() => {
    return events.filter(e => 
      (e.type.includes('make') || e.type.includes('miss')) && 
      e.x !== undefined && 
      e.y !== undefined &&
      (selectedPlayerId === 'all' || e.playerId === selectedPlayerId)
    );
  }, [events, selectedPlayerId]);

  const makes = shotEvents.filter(e => e.type.includes('make')).length;
  const misses = shotEvents.filter(e => e.type.includes('miss')).length;
  const total = makes + misses;
  const percentage = total > 0 ? Math.round((makes / total) * 100) : 0;

  const areaStats = useMemo(() => {
    const stats: Record<string, { makes: number, attempts: number }> = {};
    shotEvents.forEach(shot => {
      const area = shot.metadata?.areaName || 'Unknown Area';
      if (!stats[area]) {
        stats[area] = { makes: 0, attempts: 0 };
      }
      stats[area].attempts += 1;
      if (shot.type.includes('make')) {
        stats[area].makes += 1;
      }
    });
    return Object.entries(stats)
      .map(([area, data]) => ({
        area,
        makes: data.makes,
        attempts: data.attempts,
        percentage: data.attempts > 0 ? Math.round((data.makes / data.attempts) * 100) : 0
      }))
      .sort((a, b) => b.attempts - a.attempts); // Sort by volume
  }, [shotEvents]);

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="font-display font-bold text-xl italic uppercase">Shot Chart</h3>
        
        <select
          value={selectedPlayerId}
          onChange={(e) => setSelectedPlayerId(e.target.value)}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-orange"
        >
          <option value="all">Semua Pemain</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>{p.jersey} - {p.name}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="text-sm font-medium">Make ({makes})</span>
        </div>
        <div className="flex items-center gap-2">
          <X size={14} className="text-red-500 stroke-[3]" />
          <span className="text-sm font-medium">Miss ({misses})</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm font-bold">{percentage}% FG</span>
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto">
        <BasketballCourt className="rounded-xl shadow-lg">
          {shotEvents.map((shot) => {
            const isMake = shot.type.includes('make');
            return (
              <div
                key={shot.id}
                className={`absolute -ml-2 -mt-2 transition-transform hover:scale-150 z-10 flex items-center justify-center`}
                style={{
                  left: `${shot.x}%`,
                  top: `${shot.y}%`,
                  width: '16px',
                  height: '16px',
                }}
                title={`${isMake ? 'Make' : 'Miss'} - ${shot.metadata?.areaName || 'Unknown Area'} (${shot.x?.toFixed(1)}%, ${shot.y?.toFixed(1)}%) - Q${shot.quarter}`}
              >
                {isMake ? (
                  <div className="w-3 h-3 rounded-full bg-emerald-500 border border-white shadow-sm"></div>
                ) : (
                  <X size={16} className="text-red-500 drop-shadow-sm stroke-[3]" />
                )}
              </div>
            );
          })}
        </BasketballCourt>
      </div>

      {areaStats.length > 0 && (
        <div className="mt-8">
          <h4 className="font-bold text-sm uppercase tracking-wider text-zinc-500 mb-4">Shot Ratio per Area</h4>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-xs tracking-wider">
                <tr>
                  <th className="p-3">Area</th>
                  <th className="p-3 text-center">Makes / Attempts</th>
                  <th className="p-3 text-center">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {areaStats.map((stat, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="p-3 font-bold text-zinc-800 dark:text-zinc-200">{stat.area}</td>
                    <td className="p-3 text-center text-zinc-600 dark:text-zinc-400">{stat.makes} / {stat.attempts}</td>
                    <td className="p-3 text-center font-bold">
                      <span className={stat.percentage >= 50 ? 'text-emerald-600 dark:text-emerald-400' : stat.percentage >= 35 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                        {stat.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

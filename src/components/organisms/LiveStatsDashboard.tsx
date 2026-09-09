import React, { useMemo } from 'react';
import { X, TrendingUp, Shield, Zap, Target, AlertTriangle, MousePointer2 } from 'lucide-react';
import { GameEvent, Player, GameState } from '../../core/types/stats';
import { BasketballCourt } from '../atoms/BasketballCourt';

interface LiveStatsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  events: GameEvent[];
  players: Player[];
  gameState: GameState;
  homeTeamName: string;
  awayTeamName: string;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  ourHomeAway?: 'home' | 'away';
  sidePanel?: boolean;
}

export const LiveStatsDashboard: React.FC<LiveStatsDashboardProps> = ({ 
  isOpen, 
  onClose, 
  events, 
  players, 
  gameState,
  homeTeamName,
  awayTeamName,
  homeLogoUrl,
  awayLogoUrl,
  ourHomeAway = 'home',
  sidePanel = false
}) => {
  if (!isOpen) return null;

  const stats = useMemo(() => {
    const calculateTeamStats = (team: 'home' | 'away') => {
      const teamEvents = events.filter(e => e.team === team);
      const pts = teamEvents.reduce((acc, e) => acc + (e.points || 0), 0);
      const ast = teamEvents.filter(e => e.type === 'ast').length;
      const reb = teamEvents.filter(e => e.type === 'oreb' || e.type === 'dreb').length;
      const oreb = teamEvents.filter(e => e.type === 'oreb').length;
      const dreb = teamEvents.filter(e => e.type === 'dreb').length;
      const stl = teamEvents.filter(e => e.type === 'stl').length;
      const blk = teamEvents.filter(e => e.type === 'blk').length;
      const to = teamEvents.filter(e => e.type === 'to').length;
      const fls = teamEvents.filter(e => e.type === 'foul' || e.type === 'defensive_foul' || e.type === 'offensive_foul').length;

      const fga = teamEvents.filter(e => {
        if (['2pt_make', '3pt_make'].includes(e.type)) return true;
        if (['2pt_miss', '3pt_miss'].includes(e.type)) return !e.isShootingFoul;
        return false;
      }).length;
      const fgm = teamEvents.filter(e => ['2pt_make', '3pt_make'].includes(e.type)).length;
      const tpa = teamEvents.filter(e => {
        if (e.type === '3pt_make') return true;
        if (e.type === '3pt_miss') return !e.isShootingFoul;
        return false;
      }).length;
      const tpm = teamEvents.filter(e => e.type === '3pt_make').length;
      const fta = teamEvents.filter(e => ['1pt_make', '1pt_miss'].includes(e.type)).length;
      const ftm = teamEvents.filter(e => e.type === '1pt_make').length;

      // Layer 2: Efficiency
      const fgPct = fga > 0 ? ((fgm / fga) * 100).toFixed(1) : '0.0';
      const tpPct = tpa > 0 ? ((tpm / tpa) * 100).toFixed(1) : '0.0';
      const ftPct = fta > 0 ? ((ftm / fta) * 100).toFixed(1) : '0.0';
      const efgPct = fga > 0 ? (((fgm + 0.5 * tpm) / fga) * 100).toFixed(1) : '0.0';

      // Layer 2: Turnover Breakdown
      const liveTo = teamEvents.filter(e => e.type === 'to' && e.turnoverType === 'live_ball').length;
      const deadTo = teamEvents.filter(e => e.type === 'to' && e.turnoverType === 'dead_ball').length;

      // Layer 3: Context Efficiency
      const fastBreakShots = teamEvents.filter(e => e.gameContext === 'Fast break' && (['2pt_make', '3pt_make'].includes(e.type) || (['2pt_miss', '3pt_miss'].includes(e.type) && !e.isShootingFoul)));
      const fastBreakMakes = fastBreakShots.filter(e => e.type.includes('make')).length;
      const fastBreakPct = fastBreakShots.length > 0 ? ((fastBreakMakes / fastBreakShots.length) * 100).toFixed(1) : '0.0';

      const halfCourtShots = teamEvents.filter(e => e.gameContext === 'Half court set' && (['2pt_make', '3pt_make'].includes(e.type) || (['2pt_miss', '3pt_miss'].includes(e.type) && !e.isShootingFoul)));
      const halfCourtMakes = halfCourtShots.filter(e => e.type.includes('make')).length;
      const halfCourtPct = halfCourtShots.length > 0 ? ((halfCourtMakes / halfCourtShots.length) * 100).toFixed(1) : '0.0';

      // Layer 3: Pressure Impact
      const highPressureShots = teamEvents.filter(e => e.pressureLevel === 'Heavy / Trap' && (['2pt_make', '3pt_make'].includes(e.type) || (['2pt_miss', '3pt_miss'].includes(e.type) && !e.isShootingFoul)));
      const highPressureMakes = highPressureShots.filter(e => e.type.includes('make')).length;
      const highPressurePct = highPressureShots.length > 0 ? ((highPressureMakes / highPressureShots.length) * 100).toFixed(1) : '0.0';

      return {
        pts, ast, reb, oreb, dreb, stl, blk, to, fls,
        fga, fgm, tpa, tpm, fta, ftm,
        fgPct, tpPct, ftPct, efgPct,
        liveTo, deadTo,
        fastBreakPct, halfCourtPct, highPressurePct,
        totalShots: fga,
        fastBreakCount: fastBreakShots.length,
        highPressureCount: highPressureShots.length
      };
    };

    const homeStats = calculateTeamStats(ourHomeAway === 'home' ? 'home' : 'away');
    const awayStats = calculateTeamStats(ourHomeAway === 'home' ? 'away' : 'home');

    return {
      home: homeStats,
      away: awayStats
    };
  }, [events, ourHomeAway]);

  const playerStats = useMemo(() => {
    return players.map(player => {
      const pEvents = events.filter(e => e.playerId === player.id);
      const pts = pEvents.reduce((acc, e) => acc + (e.points || 0), 0);
      const reb = pEvents.filter(e => e.type === 'oreb' || e.type === 'dreb').length;
      const ast = pEvents.filter(e => e.type === 'ast').length;
      const stl = pEvents.filter(e => e.type === 'stl').length;
      const blk = pEvents.filter(e => e.type === 'blk').length;
      const to = pEvents.filter(e => e.type === 'to').length;
      
      const fga = pEvents.filter(e => {
        if (['2pt_make', '3pt_make'].includes(e.type)) return true;
        if (['2pt_miss', '3pt_miss'].includes(e.type)) return !e.isShootingFoul;
        return false;
      }).length;
      const fgm = pEvents.filter(e => ['2pt_make', '3pt_make'].includes(e.type)).length;
      const fgPct = fga > 0 ? ((fgm / fga) * 100).toFixed(1) : '0.0';

      return {
        id: player.id,
        name: player.name,
        jersey: player.jersey,
        isGuest: player.isGuest,
        pts, reb, ast, stl, blk, to, fga, fgm, fgPct
      };
    }).sort((a, b) => b.pts - a.pts);
  }, [events, players]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-orange rounded-2xl shadow-lg shadow-brand-orange/20">
              <TrendingUp className="text-white" size={24} />
            </div>
            <div>
              <h2 className="font-display font-black italic text-2xl uppercase tracking-tight text-[#1A1A1A] dark:text-white">
                Live Stats Dashboard
              </h2>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Deep Analysis • Layer 1-3</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-[#1A1A1A] dark:hover:text-white transition-all hover:rotate-90"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Scoreboard Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Home Team */}
            <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center gap-3 mb-4">
                {homeLogoUrl ? (
                  <img src={homeLogoUrl} alt={homeTeamName} className="w-12 h-12 rounded-xl object-contain bg-white p-1 shadow-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black italic">
                    {homeTeamName.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">HOME TEAM</div>
                  <div className="font-display font-black italic text-2xl text-blue-900 dark:text-blue-200 truncate max-w-[180px]">{homeTeamName}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xs font-bold text-blue-500 uppercase">Points</div>
                  <div className="text-2xl font-black text-blue-900 dark:text-blue-100">{stats.home.pts}</div>
                </div>
                <div className="text-center border-x border-blue-200 dark:border-blue-800">
                  <div className="text-xs font-bold text-blue-500 uppercase">Rebounds</div>
                  <div className="text-2xl font-black text-blue-900 dark:text-blue-100">{stats.home.reb}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-blue-500 uppercase">Assists</div>
                  <div className="text-2xl font-black text-blue-900 dark:text-blue-100">{stats.home.ast}</div>
                </div>
              </div>
            </div>

            {/* VS Divider */}
            <div className="flex flex-col items-center justify-center py-4">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-display font-black italic text-xl text-zinc-400">VS</div>
              <div className="mt-2 text-xs font-black text-zinc-400 uppercase tracking-widest">Q{gameState.currentQuarter} • {gameState.timeRemaining}s</div>
            </div>

            {/* Away Team */}
            <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-[2rem] border border-red-100 dark:border-red-900/30 text-right">
              <div className="flex items-center justify-end gap-3 mb-4">
                <div>
                  <div className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">AWAY TEAM</div>
                  <div className="font-display font-black italic text-2xl text-red-900 dark:text-red-200 truncate max-w-[180px]">{awayTeamName}</div>
                </div>
                {awayLogoUrl ? (
                  <img src={awayLogoUrl} alt={awayTeamName} className="w-12 h-12 rounded-xl object-contain bg-white p-1 shadow-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 font-black italic">
                    {awayTeamName.substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xs font-bold text-red-500 uppercase">Points</div>
                  <div className="text-2xl font-black text-red-900 dark:text-red-100">{stats.away.pts}</div>
                </div>
                <div className="text-center border-x border-red-200 dark:border-red-800">
                  <div className="text-xs font-bold text-red-500 uppercase">Rebounds</div>
                  <div className="text-2xl font-black text-red-900 dark:text-red-100">{stats.away.reb}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-red-500 uppercase">Assists</div>
                  <div className="text-2xl font-black text-red-900 dark:text-red-100">{stats.away.ast}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Layer 2 & 3: Deep Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Efficiency & Shooting (Layer 2) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="text-emerald-500" size={18} />
                <h3 className="font-display font-black italic text-lg uppercase tracking-tight">Layer 2: Efficiency</h3>
              </div>
              
              <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                <div className="space-y-6">
                  {/* FG% Comparison */}
                  <div>
                    <div className="flex justify-between text-xs font-black uppercase mb-2">
                      <span>FG% Efficiency</span>
                      <span className="text-zinc-400">eFG% Home: {stats.home.efgPct}% | Away: {stats.away.efgPct}%</span>
                    </div>
                    <div className="flex h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="bg-blue-500 transition-all duration-500" style={{ width: `${parseFloat(stats.home.fgPct)}%` }}></div>
                      <div className="flex-1"></div>
                      <div className="bg-red-500 transition-all duration-500" style={{ width: `${parseFloat(stats.away.fgPct)}%` }}></div>
                    </div>
                    <div className="flex justify-between mt-1 text-xs font-bold">
                      <span className="text-blue-600">{stats.home.fgPct}%</span>
                      <span className="text-red-600">{stats.away.fgPct}%</span>
                    </div>
                  </div>

                  {/* TO Breakdown */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <div className="text-xs font-black text-zinc-400 uppercase mb-2">Turnover Type (Home)</div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold">Live: <span className="text-amber-600">{stats.home.liveTo}</span></div>
                        <div className="text-xs font-bold">Dead: <span className="text-zinc-500">{stats.home.deadTo}</span></div>
                      </div>
                    </div>
                    <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <div className="text-xs font-black text-zinc-400 uppercase mb-2">Turnover Type (Away)</div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold">Live: <span className="text-amber-600">{stats.away.liveTo}</span></div>
                        <div className="text-xs font-bold">Dead: <span className="text-zinc-500">{stats.away.deadTo}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Strategic Context (Layer 3) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="text-amber-500" size={18} />
                <h3 className="font-display font-black italic text-lg uppercase tracking-tight">Layer 3: Strategic Context</h3>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                <div className="space-y-6">
                  {/* Fast Break Efficiency */}
                  <div>
                    <div className="flex justify-between text-xs font-black uppercase mb-2">
                      <span>Fast Break Efficiency</span>
                      <span className="text-zinc-400">Attempts: {stats.home.fastBreakCount} vs {stats.away.fastBreakCount}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-black text-blue-600">{stats.home.fastBreakPct}%</div>
                        <div className="text-xs font-bold text-zinc-500 leading-tight uppercase">Home<br/>Success</div>
                      </div>
                      <div className="flex items-center gap-3 justify-end">
                        <div className="text-xs font-bold text-zinc-500 leading-tight uppercase text-right">Away<br/>Success</div>
                        <div className="text-2xl font-black text-red-600">{stats.away.fastBreakPct}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Pressure Impact */}
                  <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="text-amber-500" size={14} />
                      <div className="text-xs font-black text-amber-600 uppercase">High Pressure Performance</div>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-2xl font-black text-zinc-800 dark:text-zinc-200">{stats.home.highPressurePct}%</div>
                        <div className="text-xs font-bold text-zinc-500 uppercase">Home FG% under pressure</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-zinc-800 dark:text-zinc-200">{stats.away.highPressurePct}%</div>
                        <div className="text-xs font-bold text-zinc-500 uppercase">Away FG% under pressure</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Player Box Score (Layer 1) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <MousePointer2 className="text-blue-500" size={18} />
              <h3 className="font-display font-black italic text-lg uppercase tracking-tight">Player Performance</h3>
            </div>
            
            <div className="overflow-x-auto rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900/80">
                    <th className="p-4 text-xs font-black uppercase text-zinc-500">Player</th>
                    <th className="p-4 text-xs font-black uppercase text-zinc-500 text-center">PTS</th>
                    <th className="p-4 text-xs font-black uppercase text-zinc-500 text-center">REB</th>
                    <th className="p-4 text-xs font-black uppercase text-zinc-500 text-center">AST</th>
                    <th className="p-4 text-xs font-black uppercase text-zinc-500 text-center">STL</th>
                    <th className="p-4 text-xs font-black uppercase text-zinc-500 text-center">BLK</th>
                    <th className="p-4 text-xs font-black uppercase text-zinc-500 text-center">TO</th>
                    <th className="p-4 text-xs font-black uppercase text-zinc-500 text-center">FG%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {playerStats.map(p => (
                    <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                            {p.jersey}
                          </div>
                          <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                            {p.name}
                            {p.isGuest && (
                              <span className="text-[9px] font-black bg-brand-orange text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Tamu
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center font-black text-zinc-900 dark:text-white">{p.pts}</td>
                      <td className="p-4 text-center font-bold text-zinc-600 dark:text-zinc-400">{p.reb}</td>
                      <td className="p-4 text-center font-bold text-zinc-600 dark:text-zinc-400">{p.ast}</td>
                      <td className="p-4 text-center font-bold text-zinc-600 dark:text-zinc-400">{p.stl}</td>
                      <td className="p-4 text-center font-bold text-zinc-600 dark:text-zinc-400">{p.blk}</td>
                      <td className="p-4 text-center font-bold text-zinc-600 dark:text-zinc-400">{p.to}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-lg text-xs font-black ${
                          parseFloat(p.fgPct) >= 50 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          parseFloat(p.fgPct) >= 40 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}>
                          {p.fgm}/{p.fga} ({p.fgPct}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

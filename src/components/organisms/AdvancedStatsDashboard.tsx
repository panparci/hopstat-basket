import React, { useMemo, useState } from 'react';
import { GameEvent, Player, Possession } from '../../core/types/stats';
import { calculateAdvancedStats, calculatePlayerAdvancedStats } from '../../core/utils/advancedStats';
import { Target, Zap, RefreshCcw, Shield, Activity, Brain, Lightbulb, Minus } from 'lucide-react';

interface AdvancedStatsDashboardProps {
  events: GameEvent[];
  players: Player[];
  team: 'home' | 'away';
  opponentEvents?: GameEvent[];
  homeRosterIds?: string[];
  awayRosterIds?: string[];
  possessions?: Possession[];
}

export const AdvancedStatsDashboard: React.FC<AdvancedStatsDashboardProps> = ({ events, players, team: initialTeam, opponentEvents = [], homeRosterIds = [], awayRosterIds = [], possessions = [] }) => {
  const [team, setTeam] = useState<'home' | 'away'>(initialTeam);
  
  const stats = useMemo(() => calculateAdvancedStats(events, team, opponentEvents, homeRosterIds, awayRosterIds, possessions), [events, team, opponentEvents, homeRosterIds, awayRosterIds, possessions]);
  
  const playerStats = useMemo(() => {
    const teamPlayers = players.filter(p => team === 'home' ? homeRosterIds.includes(p.id) : awayRosterIds.includes(p.id));
    return teamPlayers.map(p => {
      const pEvents = events.filter(e => e.playerId === p.id);
      const pts = pEvents.reduce((sum, e) => sum + (e.points || 0), 0);
      const fga = pEvents.filter(e => {
        if (['2pt_make', '3pt_make'].includes(e.type)) return true;
        if (['2pt_miss', '3pt_miss'].includes(e.type)) return !e.isShootingFoul;
        return false;
      }).length;
      const fgm = pEvents.filter(e => ['2pt_make', '3pt_make'].includes(e.type)).length;
      const tpa = pEvents.filter(e => {
        if (e.type === '3pt_make') return true;
        if (e.type === '3pt_miss') return !e.isShootingFoul;
        return false;
      }).length;
      const tpm = pEvents.filter(e => e.type === '3pt_make').length;
      const fta = pEvents.filter(e => ['1pt_make', '1pt_miss'].includes(e.type)).length;
      const ftm = pEvents.filter(e => e.type === '1pt_make').length;
      const ast = pEvents.filter(e => e.type === 'ast').length;
      const oreb = pEvents.filter(e => e.type === 'oreb').length;
      const dreb = pEvents.filter(e => e.type === 'dreb').length;
      const to = pEvents.filter(e => e.type === 'to').length;
      const stl = pEvents.filter(e => e.type === 'stl').length;
      const blk = pEvents.filter(e => e.type === 'blk').length;
      const fls = pEvents.filter(e => e.type === 'foul' || e.type === 'defensive_foul' || e.type === 'offensive_foul').length;
      
      const advanced = calculatePlayerAdvancedStats(events, p.id, stats.possessionEfficiency.possessions);

      return {
        ...p,
        pts, fga, fgm, tpa, tpm, fta, ftm, ast, oreb, dreb, to, stl, blk, fls,
        ...advanced
      };
    }).sort((a, b) => b.pts - a.pts);
  }, [events, players, team, homeRosterIds, awayRosterIds, stats.possessionEfficiency.possessions]);

  const formatPct = (val: number) => `${Math.round(val)}%`;
  const formatNum = (val: number) => (Math.round(val * 10) / 10).toString();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div className="flex justify-center mb-6">
        <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex">
          <button
            onClick={() => setTeam('home')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${team === 'home' ? 'bg-white dark:bg-zinc-700 shadow-sm text-brand-navy dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            Home Team
          </button>
          <button
            onClick={() => setTeam('away')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${team === 'away' ? 'bg-white dark:bg-zinc-700 shadow-sm text-red-600 dark:text-red-400' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            Away Team
          </button>
        </div>
      </div>

      {/* 1.5. Player Advanced Metrics */}
      <section>
        <h3 className="font-display font-black italic text-xl uppercase tracking-tight mb-4 flex items-center gap-2">
          <Brain className="text-purple-500" /> Player Advanced Metrics
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-xs tracking-wider">
              <tr>
                <th className="p-3">Player</th>
                <th className="p-3 text-center">Usage Rate</th>
                <th className="p-3 text-center">AST/TO Ratio</th>
                <th className="p-3 text-center">Decision Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {playerStats.map(p => (
                <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="p-3 font-bold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-500">{p.jersey}</span>
                    {p.name}
                  </td>
                  <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">{formatPct(p.usageRate)}</td>
                  <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{formatNum(p.astToRatio)}</td>
                  <td className={`p-3 text-center font-bold ${p.decisionScore > 0 ? 'text-emerald-500' : p.decisionScore < 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                    {p.decisionScore > 0 ? '+' : ''}{p.decisionScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 2. Shooting Quality */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-display font-black italic text-lg uppercase tracking-tight mb-4 flex items-center gap-2">
            <Target className="text-emerald-500" /> Shooting Quality
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-zinc-500">FG / 3PT / FT</span>
              <span className="font-black">{formatPct(stats.shootingQuality.fgPct)} / {formatPct(stats.shootingQuality.tpPct)} / {formatPct(stats.shootingQuality.ftPct)}</span>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold text-zinc-400 uppercase">By Difficulty</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-xl text-center">
                  <div className="text-xs text-emerald-600 uppercase font-bold">Open</div>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">{formatPct(stats.shootingQuality.byDifficulty.openPct)}</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-xl text-center">
                  <div className="text-xs text-amber-600 uppercase font-bold">Contested</div>
                  <div className="text-lg font-black text-amber-700 dark:text-amber-400">{formatPct(stats.shootingQuality.byDifficulty.contestedPct)}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-xl text-center">
                  <div className="text-xs text-red-600 uppercase font-bold">Heavy</div>
                  <div className="text-lg font-black text-red-700 dark:text-red-400">{formatPct(stats.shootingQuality.byDifficulty.heavilyContestedPct)}</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold text-zinc-400 uppercase">By Shot Type</div>
              <div className="flex justify-between text-sm font-medium">
                <span>Layup/Paint: <span className="font-bold">{formatPct(stats.shootingQuality.byShotType.layupPct)}</span></span>
                <span>Midrange: <span className="font-bold">{formatPct(stats.shootingQuality.byShotType.midrangePct)}</span></span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Possession & Efficiency */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-display font-black italic text-lg uppercase tracking-tight mb-4 flex items-center gap-2">
            <Zap className="text-amber-500" /> Possession & Efficiency
          </h3>
          <div className="grid grid-cols-2 gap-4 h-full pb-8">
            <div className="flex flex-col justify-center items-center p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
              <div className="text-xs font-bold text-zinc-400 uppercase mb-1">
                {stats.possessionEfficiency.isReal ? "Real Possessions" : "Est. Possessions"}
              </div>
              <div className="text-4xl font-black text-zinc-800 dark:text-zinc-200">{stats.possessionEfficiency.possessions}</div>
            </div>
            <div className="flex flex-col justify-center items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
              <div className="text-xs font-bold text-blue-500 uppercase mb-1">Points Per Poss (PPP)</div>
              <div className="text-4xl font-black text-blue-600 dark:text-blue-400">{stats.possessionEfficiency.ppp}</div>
              {stats.possessionEfficiency.anomalousPct !== undefined && stats.possessionEfficiency.anomalousPct > 0 && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1 text-center">
                  ⚠️ {stats.possessionEfficiency.anomalousPct.toFixed(1)}% anomalous pos. excluded
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 4. Turnover Analysis */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-display font-black italic text-lg uppercase tracking-tight mb-4 flex items-center gap-2">
            <RefreshCcw className="text-red-500" /> Turnover Analysis
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-zinc-500">Turnover Rate</span>
              <span className="font-black text-red-500">{formatPct(stats.turnoverAnalysis.toRate)}</span>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold text-zinc-400 uppercase">Breakdown</div>
              <div className="flex h-4 rounded-full overflow-hidden">
                <div className="bg-red-500" style={{ width: `${stats.turnoverAnalysis.breakdown.badPassPct}%` }} title="Bad Pass"></div>
                <div className="bg-amber-500" style={{ width: `${stats.turnoverAnalysis.breakdown.dribbleLostPct}%` }} title="Dribble Lost"></div>
                <div className="bg-zinc-500" style={{ width: `${stats.turnoverAnalysis.breakdown.violationPct}%` }} title="Violation"></div>
              </div>
              <div className="flex justify-between text-xs font-bold text-zinc-500">
                <span className="text-red-500">Bad Pass: {formatPct(stats.turnoverAnalysis.breakdown.badPassPct)}</span>
                <span className="text-amber-500">Dribble: {formatPct(stats.turnoverAnalysis.breakdown.dribbleLostPct)}</span>
                <span>Violation: {formatPct(stats.turnoverAnalysis.breakdown.violationPct)}</span>
              </div>
            </div>
            <div className="flex justify-between text-sm font-medium pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <span>Transition TO: <span className="font-bold text-red-500">{stats.turnoverAnalysis.vsPressure.transitionTo}</span></span>
              <span>Half Court TO: <span className="font-bold text-amber-500">{stats.turnoverAnalysis.vsPressure.halfCourtTo}</span></span>
            </div>
          </div>
        </section>

        {/* 6. Phase of Play */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-display font-black italic text-lg uppercase tracking-tight mb-4 flex items-center gap-2">
            <Activity className="text-indigo-500" /> Phase of Play
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-xs font-bold text-zinc-400 uppercase mb-1">Fast Break</div>
                <div className="text-lg font-black">{formatPct(stats.phaseOfPlay.distribution.fastBreakPct)}</div>
                <div className="text-xs font-bold text-indigo-500">{formatNum(stats.phaseOfPlay.efficiency.pppFastBreak)} PPP</div>
              </div>
              <div className="text-center border-x border-zinc-100 dark:border-zinc-800">
                <div className="text-xs font-bold text-zinc-400 uppercase mb-1">Transition</div>
                <div className="text-lg font-black">{formatPct(stats.phaseOfPlay.distribution.transitionPct)}</div>
                <div className="text-xs font-bold text-indigo-500">{formatNum(stats.phaseOfPlay.efficiency.pppTransition)} PPP</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-zinc-400 uppercase mb-1">Half Court</div>
                <div className="text-lg font-black">{formatPct(stats.phaseOfPlay.distribution.halfCourtPct)}</div>
                <div className="text-xs font-bold text-indigo-500">{formatNum(stats.phaseOfPlay.efficiency.pppHalfCourt)} PPP</div>
              </div>
            </div>
          </div>
        </section>

        {/* 7 & 8. Defense & Rebounds */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-display font-black italic text-lg uppercase tracking-tight mb-4 flex items-center gap-2">
            <Shield className="text-zinc-700 dark:text-zinc-300" /> Defense & Control
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="text-xs font-bold text-zinc-400 uppercase">Rebound Rate</div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Offensive</span>
                <span className="font-black text-blue-500">{formatPct(stats.reboundControl.orebRate)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Defensive</span>
                <span className="font-black text-emerald-500">{formatPct(stats.reboundControl.drebRate)}</span>
              </div>
            </div>
            <div className="space-y-3 border-l border-zinc-100 dark:border-zinc-800 pl-4">
              <div className="text-xs font-bold text-zinc-400 uppercase">Impact</div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Forced TO</span>
                <span className="font-black text-amber-500">{stats.defensiveImpact.forcedTo}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Steal Rate</span>
                <span className="font-black text-blue-500">{formatPct(stats.defensiveImpact.stealRate)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 10. Decision Quality */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-display font-black italic text-lg uppercase tracking-tight mb-4 flex items-center gap-2">
            <Brain className="text-purple-500" /> Decision Quality
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-3xl font-black text-emerald-500">+{stats.decisionQuality.goodDecisions}</div>
                <div className="text-xs font-bold text-zinc-400 uppercase">Good</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-red-500">-{stats.decisionQuality.badDecisions}</div>
                <div className="text-xs font-bold text-zinc-400 uppercase">Bad</div>
              </div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-900/30">
              <div className="text-xs font-bold text-purple-600 uppercase mb-1">Net Score</div>
              <div className={`text-4xl font-black ${stats.decisionQuality.score >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats.decisionQuality.score > 0 ? '+' : ''}{stats.decisionQuality.score}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 11. Insights */}
      {stats.insights.length > 0 && (
        <section className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/30">
          <h3 className="font-display font-black italic text-lg uppercase tracking-tight mb-4 flex items-center gap-2 text-blue-800 dark:text-blue-300">
            <Lightbulb className="text-amber-500" /> Combination Insights
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stats.insights.map((insight, idx) => (
              <div key={idx} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm flex items-start gap-3">
                <div className="mt-1">
                  {insight.type === 'decision' && <Brain size={16} className="text-purple-500" />}
                  {insight.type === 'shot_selection' && <Target size={16} className="text-emerald-500" />}
                  {insight.type === 'playmaking' && <Activity size={16} className="text-blue-500" />}
                  {insight.type === 'general' && <Lightbulb size={16} className="text-amber-500" />}
                </div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{insight.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
};

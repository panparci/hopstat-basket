import { GameEvent, Player, GameState, Match } from '../types/stats';
import { findRelatedEvents } from './eventGrouping';

export interface BoxScore {
  playerId: string;
  name: string;
  jersey: string;
  pts: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  ast: number;
  oreb: number;
  dreb: number;
  reb: number;
  to: number;
  stl: number;
  blk: number;
  fls: number;
}

export interface ShootingQuality {
  fgPct: number;
  tpPct: number;
  ftPct: number;
  byDifficulty: {
    openPct: number;
    contestedPct: number;
    heavilyContestedPct: number;
  };
  byShotType: {
    layupPct: number;
    midrangePct: number;
    tpPct: number;
  };
}

export interface PossessionEfficiency {
  possessions: number;
  ppp: number;
  anomalousPct?: number;
  anomalousCount?: number;
  isReal?: boolean;
}

export interface TurnoverAnalysis {
  toRate: number;
  breakdown: {
    badPassPct: number;
    dribbleLostPct: number;
    violationPct: number;
  };
  vsPressure: {
    transitionTo: number;
    halfCourtTo: number;
  };
}

export interface AssistQuality {
  total: number;
  typeRatio: {
    directPct: number;
    shortCreationPct: number;
    weakPct: number;
  };
  astToRatio: number;
}

export interface PhaseOfPlay {
  distribution: {
    fastBreakPct: number;
    transitionPct: number;
    halfCourtPct: number;
  };
  efficiency: {
    pppFastBreak: number;
    pppTransition: number;
    pppHalfCourt: number;
  };
  shotDistribution: {
    fastBreakPct: number;
    transitionPct: number;
    halfCourtPct: number;
  };
}

export interface ReboundControl {
  total: number;
  orebRate: number;
  drebRate: number;
}

export interface DefensiveImpact {
  forcedTo: number;
  stealRate: number;
  opponentPts: number;
}

export interface PlayerUtilization {
  usageRate: number;
}

export interface DecisionQuality {
  goodDecisions: number;
  badDecisions: number;
  score: number;
}

export interface CombinationInsight {
  type: 'decision' | 'shot_selection' | 'playmaking' | 'general';
  text: string;
}

export const calculateAdvancedStats = (events: GameEvent[], team: 'home' | 'away', opponentEvents: GameEvent[] = [], homeRosterIds: string[] = [], awayRosterIds: string[] = [], possessionsList: any[] = []) => {
  const isHomeEvent = (e: GameEvent) => e.team === 'home' || homeRosterIds.includes(e.playerId) || e.playerId === 'home_team';
  const isAwayEvent = (e: GameEvent) => e.team === 'away' || awayRosterIds.includes(e.playerId) || e.playerId === 'away_team' || e.playerId === 'opp';

  let teamEvents = events.filter(e => team === 'home' ? isHomeEvent(e) : isAwayEvent(e));
  const oppEvents = opponentEvents.length > 0 ? opponentEvents : events.filter(e => team === 'home' ? isAwayEvent(e) : isHomeEvent(e));
  
  // Exclude misses that were part of a shooting foul
  teamEvents = teamEvents.filter(e => {
    if (['2pt_miss', '3pt_miss'].includes(e.type)) {
      const related = findRelatedEvents(e, events);
      const hasShootingFoul = related.some(r => r.type === 'foul_drawn' && r.subType === 'Shooting Foul');
      if (hasShootingFoul) return false;
    }
    return true;
  });
  
  // 1. Basic Box Score
  // Calculated per player usually, but we can aggregate for team
  const pts = teamEvents.reduce((sum, e) => sum + (e.points || 0), 0);
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
  const ast = teamEvents.filter(e => e.type === 'ast').length;
  const oreb = teamEvents.filter(e => e.type === 'oreb').length;
  const dreb = teamEvents.filter(e => e.type === 'dreb').length;
  const to = teamEvents.filter(e => e.type === 'to').length;
  const stl = teamEvents.filter(e => e.type === 'stl').length;
  const blk = teamEvents.filter(e => e.type === 'blk').length;
  const fls = teamEvents.filter(e => e.type === 'foul').length;

  // 2. Shooting Quality
  const shots = teamEvents.filter(e => ['2pt_make', '2pt_miss', '3pt_make', '3pt_miss'].includes(e.type));
  const openShots = shots.filter(e => e.shotDifficulty === 'Open');
  const contestedShots = shots.filter(e => e.shotDifficulty === 'Contested' || e.shotDifficulty === 'Lightly Contested');
  const heavilyContestedShots = shots.filter(e => e.shotDifficulty === 'Heavily Contested');

  const layups = shots.filter(e => e.metadata?.areaName === 'Restricted Area' || e.metadata?.areaName === 'Paint');
  const midranges = shots.filter(e => e.metadata?.areaName === 'Mid-Range' || e.metadata?.areaName === 'Short Corner');
  const threes = shots.filter(e => ['3pt_make', '3pt_miss'].includes(e.type));

  const shootingQuality: ShootingQuality = {
    fgPct: fga > 0 ? (fgm / fga) * 100 : 0,
    tpPct: tpa > 0 ? (tpm / tpa) * 100 : 0,
    ftPct: fta > 0 ? (ftm / fta) * 100 : 0,
    byDifficulty: {
      openPct: openShots.length > 0 ? (openShots.filter(e => e.type.includes('make')).length / openShots.length) * 100 : 0,
      contestedPct: contestedShots.length > 0 ? (contestedShots.filter(e => e.type.includes('make')).length / contestedShots.length) * 100 : 0,
      heavilyContestedPct: heavilyContestedShots.length > 0 ? (heavilyContestedShots.filter(e => e.type.includes('make')).length / heavilyContestedShots.length) * 100 : 0,
    },
    byShotType: {
      layupPct: layups.length > 0 ? (layups.filter(e => e.type.includes('make')).length / layups.length) * 100 : 0,
      midrangePct: midranges.length > 0 ? (midranges.filter(e => e.type.includes('make')).length / midranges.length) * 100 : 0,
      tpPct: threes.length > 0 ? (threes.filter(e => e.type.includes('make')).length / threes.length) * 100 : 0,
    }
  };

  // 3. Possession & Efficiency
  const teamPossessions = possessionsList?.filter(p => p.teamInPossession === team) || [];
  let possessions = teamPossessions.length;
  if (possessions === 0) {
    const actualPossessionIds = new Set(
      events.filter(e => e.possession === team && e.possessionId).map(e => e.possessionId)
    );
    possessions = actualPossessionIds.size;
    if (possessions === 0) {
      possessions = fga + to - oreb + 0.44 * fta;
    }
  }

  const teamAnomalousPossessions = teamPossessions.filter(p => p.isAnomaly);
  const anomalousCount = teamAnomalousPossessions.length;
  const nonAnomalousPossessionsCount = Math.max(0, possessions - anomalousCount);
  
  const pppDenominator = nonAnomalousPossessionsCount > 0 ? nonAnomalousPossessionsCount : possessions;
  const ppp = pppDenominator > 0 ? pts / pppDenominator : 0;

  const possessionEfficiency: PossessionEfficiency = {
    possessions: Math.round(possessions * 10) / 10,
    ppp: Math.round(ppp * 100) / 100,
    anomalousPct: possessions > 0 ? (anomalousCount / possessions) * 100 : 0,
    anomalousCount,
    isReal: possessionsList && possessionsList.length > 0 ? true : false
  };

  // 4. Turnover Analysis
  const badPasses = teamEvents.filter(e => e.type === 'to' && e.subType === 'Bad Pass').length;
  const dribbleLost = teamEvents.filter(e => e.type === 'to' && e.subType === 'Bad Handle').length;
  const violations = teamEvents.filter(e => e.type === 'to' && ['Travel', 'Double Dribble', 'Time Violation'].includes(e.subType || '')).length;
  
  const transitionTo = teamEvents.filter(e => e.type === 'to' && (e.gameContext === 'Fast break' || e.gameContext === 'Transition offense')).length;
  const halfCourtTo = teamEvents.filter(e => e.type === 'to' && e.gameContext === 'Half court set').length;

  const turnoverAnalysis: TurnoverAnalysis = {
    toRate: possessions > 0 ? (to / possessions) * 100 : 0,
    breakdown: {
      badPassPct: to > 0 ? (badPasses / to) * 100 : 0,
      dribbleLostPct: to > 0 ? (dribbleLost / to) * 100 : 0,
      violationPct: to > 0 ? (violations / to) * 100 : 0,
    },
    vsPressure: {
      transitionTo,
      halfCourtTo
    }
  };

  // 5. Assist Quality
  const directAst = teamEvents.filter(e => e.type === 'ast' && e.assistType === 'Direct').length;
  const shortCreationAst = teamEvents.filter(e => e.type === 'ast' && e.assistType === 'Short Creation').length;
  const weakAst = teamEvents.filter(e => e.type === 'ast' && e.assistType === 'Weak Assist').length;

  const assistQuality: AssistQuality = {
    total: ast,
    typeRatio: {
      directPct: ast > 0 ? (directAst / ast) * 100 : 0,
      shortCreationPct: ast > 0 ? (shortCreationAst / ast) * 100 : 0,
      weakPct: ast > 0 ? (weakAst / ast) * 100 : 0,
    },
    astToRatio: to > 0 ? ast / to : ast
  };

  // 6. Phase of Play Analysis
  const fastBreakEvents = teamEvents.filter(e => e.gameContext === 'Fast break');
  const transitionEvents = teamEvents.filter(e => e.gameContext === 'Transition offense');
  const halfCourtEvents = teamEvents.filter(e => e.gameContext === 'Half court set');
  
  const totalContextEvents = fastBreakEvents.length + transitionEvents.length + halfCourtEvents.length;

  const fbPts = fastBreakEvents.reduce((sum, e) => sum + (e.points || 0), 0);
  const fbFga = fastBreakEvents.filter(e => {
    if (['2pt_make', '3pt_make'].includes(e.type)) return true;
    if (['2pt_miss', '3pt_miss'].includes(e.type)) return !e.isShootingFoul;
    return false;
  }).length;
  const fbTo = fastBreakEvents.filter(e => e.type === 'to').length;
  const fbOreb = fastBreakEvents.filter(e => e.type === 'oreb').length;
  const fbFta = fastBreakEvents.filter(e => ['1pt_make', '1pt_miss'].includes(e.type)).length;
  const fbPoss = fbFga + fbTo - fbOreb + 0.44 * fbFta;

  const hcPts = halfCourtEvents.reduce((sum, e) => sum + (e.points || 0), 0);
  const hcFga = halfCourtEvents.filter(e => {
    if (['2pt_make', '3pt_make'].includes(e.type)) return true;
    if (['2pt_miss', '3pt_miss'].includes(e.type)) return !e.isShootingFoul;
    return false;
  }).length;
  const hcTo = halfCourtEvents.filter(e => e.type === 'to').length;
  const hcOreb = halfCourtEvents.filter(e => e.type === 'oreb').length;
  const hcFta = halfCourtEvents.filter(e => ['1pt_make', '1pt_miss'].includes(e.type)).length;
  const hcPoss = hcFga + hcTo - hcOreb + 0.44 * hcFta;

  const trPts = transitionEvents.reduce((sum, e) => sum + (e.points || 0), 0);
  const trFga = transitionEvents.filter(e => {
    if (['2pt_make', '3pt_make'].includes(e.type)) return true;
    if (['2pt_miss', '3pt_miss'].includes(e.type)) return !e.isShootingFoul;
    return false;
  }).length;
  const trTo = transitionEvents.filter(e => e.type === 'to').length;
  const trOreb = transitionEvents.filter(e => e.type === 'oreb').length;
  const trFta = transitionEvents.filter(e => ['1pt_make', '1pt_miss'].includes(e.type)).length;
  const trPoss = trFga + trTo - trOreb + 0.44 * trFta;

  const phaseOfPlay: PhaseOfPlay = {
    distribution: {
      fastBreakPct: totalContextEvents > 0 ? (fastBreakEvents.length / totalContextEvents) * 100 : 0,
      transitionPct: totalContextEvents > 0 ? (transitionEvents.length / totalContextEvents) * 100 : 0,
      halfCourtPct: totalContextEvents > 0 ? (halfCourtEvents.length / totalContextEvents) * 100 : 0,
    },
    efficiency: {
      pppFastBreak: fbPoss > 0 ? fbPts / fbPoss : 0,
      pppTransition: trPoss > 0 ? trPts / trPoss : 0,
      pppHalfCourt: hcPoss > 0 ? hcPts / hcPoss : 0,
    },
    shotDistribution: {
      fastBreakPct: fga > 0 ? (fbFga / fga) * 100 : 0,
      transitionPct: fga > 0 ? (trFga / fga) * 100 : 0,
      halfCourtPct: fga > 0 ? (hcFga / fga) * 100 : 0,
    }
  };

  // 7. Rebound Control
  const oppDreb = oppEvents.filter(e => e.type === 'dreb').length;
  const oppOreb = oppEvents.filter(e => e.type === 'oreb').length;

  const reboundControl: ReboundControl = {
    total: oreb + dreb,
    orebRate: (oreb + oppDreb) > 0 ? (oreb / (oreb + oppDreb)) * 100 : 0,
    drebRate: (dreb + oppOreb) > 0 ? (dreb / (dreb + oppOreb)) * 100 : 0,
  };

  // 8. Defensive Impact
  const forcedTo = oppEvents.filter(e => e.type === 'to' && (e.subType === 'Bad Pass' || e.subType === 'Bad Handle' || e.pressureLevel === 'Heavy / Trap')).length;
  
  const oppTeam = team === 'home' ? 'away' : 'home';
  const oppPossessionsList = possessionsList?.filter(p => p.teamInPossession === oppTeam) || [];
  let oppPossessions = oppPossessionsList.length;
  if (oppPossessions === 0) {
    const actualOppPossessionIds = new Set(
      events.filter(e => e.possession === oppTeam && e.possessionId).map(e => e.possessionId)
    );
    oppPossessions = actualOppPossessionIds.size;
    if (oppPossessions === 0) {
      const oppFga = oppEvents.filter(e => {
        if (['2pt_make', '3pt_make'].includes(e.type)) return true;
        if (['2pt_miss', '3pt_miss'].includes(e.type)) return !e.isShootingFoul;
        return false;
      }).length;
      const oppTo = oppEvents.filter(e => e.type === 'to').length;
      const oppFta = oppEvents.filter(e => ['1pt_make', '1pt_miss'].includes(e.type)).length;
      oppPossessions = oppFga + oppTo - oppOreb + 0.44 * oppFta;
    }
  }
  
  const defensiveImpact: DefensiveImpact = {
    forcedTo,
    stealRate: oppPossessions > 0 ? (stl / oppPossessions) * 100 : 0,
    opponentPts: oppEvents.reduce((sum, e) => sum + (e.points || 0), 0)
  };

  // 10. Decision Quality
  let goodDecisions = 0;
  let badDecisions = 0;

  teamEvents.forEach(e => {
    if (['2pt_make', '2pt_miss', '3pt_make', '3pt_miss'].includes(e.type) && e.shotDifficulty === 'Open') goodDecisions++;
    if (e.type === 'ast' && e.assistType === 'Direct') goodDecisions++;
    if (['2pt_make', '2pt_miss', '3pt_make', '3pt_miss'].includes(e.type) && e.shotDifficulty === 'Heavily Contested') badDecisions++;
    if (e.type === 'to' && e.subType === 'Bad Pass') badDecisions++;
    if (e.type === 'to' && e.subType === 'Bad Handle') badDecisions++;
  });

  const decisionQuality: DecisionQuality = {
    goodDecisions,
    badDecisions,
    score: goodDecisions - badDecisions
  };

  // 11. Combination Insights
  const insights: CombinationInsight[] = [];
  
  if (transitionTo > 2) {
    insights.push({ type: 'decision', text: 'Turnover tinggi di transisi. Perbaiki decision making saat fast break.' });
  }
  
  if (shootingQuality.fgPct > 45 && shootingQuality.byDifficulty.heavilyContestedPct > 30) {
    insights.push({ type: 'shot_selection', text: 'Shooting bagus tapi terlalu banyak contested shot. Shot selection perlu diperbaiki.' });
  }

  if (ast > 5 && assistQuality.typeRatio.weakPct > 50) {
    insights.push({ type: 'playmaking', text: 'Assist tinggi tapi didominasi weak assist. Butuh true playmaker untuk direct creation.' });
  }

  if (reboundControl.orebRate < 20) {
    insights.push({ type: 'general', text: 'Offensive rebound rate rendah. Tingkatkan agresivitas second chance.' });
  }

  return {
    basic: { pts, fga, fgm, tpa, tpm, fta, ftm, ast, oreb, dreb, to, stl, blk, fls },
    shootingQuality,
    possessionEfficiency,
    turnoverAnalysis,
    assistQuality,
    phaseOfPlay,
    reboundControl,
    defensiveImpact,
    decisionQuality,
    insights
  };
};

export const calculatePlayerAdvancedStats = (events: GameEvent[], playerId: string, teamPossessions: number) => {
  const playerEvents = events.filter(e => e.playerId === playerId);
  
  const fga = playerEvents.filter(e => {
    if (['2pt_make', '3pt_make'].includes(e.type)) return true;
    if (['2pt_miss', '3pt_miss'].includes(e.type)) return !e.isShootingFoul;
    return false;
  }).length;
  const to = playerEvents.filter(e => e.type === 'to').length;
  const ast = playerEvents.filter(e => e.type === 'ast').length;
  
  let goodDecisions = 0;
  let badDecisions = 0;

  playerEvents.forEach(e => {
    if (['2pt_make', '2pt_miss', '3pt_make', '3pt_miss'].includes(e.type) && e.shotDifficulty === 'Open') goodDecisions++;
    if (e.type === 'ast' && e.assistType === 'Direct') goodDecisions++;
    if (['2pt_make', '2pt_miss', '3pt_make', '3pt_miss'].includes(e.type) && e.shotDifficulty === 'Heavily Contested') badDecisions++;
    if (e.type === 'to' && e.subType === 'Bad Pass') badDecisions++;
    if (e.type === 'to' && e.subType === 'Bad Handle') badDecisions++;
  });

  const playerTeam = playerEvents.find(e => e.team)?.team || 'home';
  let isOnCourt = false;
  const firstSubIn = playerEvents.find(e => e.type === 'sub_in');
  const firstSubOut = playerEvents.find(e => e.type === 'sub_out');
  const firstAction = playerEvents.find(e => !['sub_in', 'sub_out'].includes(e.type));
  
  if (firstSubOut && (!firstSubIn || firstSubOut.timestamp < firstSubIn.timestamp)) {
    isOnCourt = true;
  } else if (firstAction && (!firstSubIn || firstAction.timestamp < firstSubIn.timestamp)) {
    isOnCourt = true;
  } else if (!firstSubIn && !firstSubOut && firstAction) {
    isOnCourt = true;
  }

  const playerPossessionIds = new Set<string>();
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  
  for (const e of sortedEvents) {
    if (e.playerId === playerId) {
       if (e.type === 'sub_in') isOnCourt = true;
       if (e.type === 'sub_out') isOnCourt = false;
    }
    if (isOnCourt && e.possessionId && e.possession === playerTeam) {
      playerPossessionIds.add(e.possessionId);
    }
  }

  let playerPossessionsCount = playerPossessionIds.size;
  if (playerPossessionsCount === 0) {
     playerPossessionsCount = teamPossessions;
  }

  return {
    usageRate: playerPossessionsCount > 0 ? ((fga + to) / playerPossessionsCount) * 100 : 0,
    astToRatio: to > 0 ? ast / to : ast,
    decisionScore: goodDecisions - badDecisions
  };
};

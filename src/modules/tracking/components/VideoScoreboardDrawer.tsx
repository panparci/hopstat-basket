import React, { useState, useMemo } from 'react';
import { GameEvent, MatchRoster, Match } from '../../../core/types/stats';
import { 
  rebuildPossessionsEngine, 
  sortEventsChronologically 
} from '../../../core/services/possessionEngine';
import { 
  ChevronLeft, 
  ChevronRight, 
  Tv, 
  Users, 
  Award, 
  Activity, 
  AlertCircle,
  TrendingUp,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VideoScoreboardDrawerProps {
  events: GameEvent[];
  currentYoutubeTime: number;
  matchRosters: MatchRoster[];
  match: Match;
  overlayPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const VideoScoreboardDrawer: React.FC<VideoScoreboardDrawerProps> = ({
  events,
  currentYoutubeTime,
  matchRosters,
  match,
  overlayPosition = 'bottom-left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'lineup' | 'roster' | 'plays'>('lineup');

  const homeTeamId = match.teamId || 'home_team';
  const awayTeamId = match.opponentTeamId || 'away_team';

  const homeTeamName = match.ourHomeAway === 'away' ? (match.theirTeamName || 'Lawan') : (match.ourTeamName || match.name || 'Kita');
  const awayTeamName = match.ourHomeAway === 'away' ? (match.ourTeamName || match.name || 'Kita') : (match.theirTeamName || 'Lawan');

  // Determine which side of the screen the drawer should slide in from
  // Sits opposite to the toast overlay position
  const drawerSide = useMemo<'left' | 'right'>(() => {
    if (overlayPosition.includes('right')) {
      return 'left';
    }
    return 'right';
  }, [overlayPosition]);

  // 1. Filter events up to current video playback time
  // Starter events are always included as the base state
  const filteredEvents = useMemo(() => {
    return events.filter(e => 
      e.type === 'starter' || 
      (e.youtubeTimestamp !== undefined && e.youtubeTimestamp <= currentYoutubeTime)
    );
  }, [events, currentYoutubeTime]);

  // Sort them chronologically for logical sequential processing
  const sortedFilteredEvents = useMemo(() => {
    return sortEventsChronologically(filteredEvents);
  }, [filteredEvents]);

  // 2. Compute Match Stats up to current timestamp
  const stats = useMemo(() => {
    let homeScore = 0;
    let awayScore = 0;
    let homeFoulsCumulative = 0;
    let awayFoulsCumulative = 0;
    let homeFoulsCurrentQuarter = 0;
    let awayFoulsCurrentQuarter = 0;
    let homeTimeouts = 0;
    let awayTimeouts = 0;

    // Get latest gameplay event to determine quarter and clock
    const gameplayEvents = sortedFilteredEvents.filter(e => e.type !== 'starter');
    const latestEvent = gameplayEvents[gameplayEvents.length - 1];
    
    const currentQuarter = latestEvent?.quarter || 1;
    const gameClockSeconds = latestEvent?.timestamp !== undefined 
      ? latestEvent.timestamp 
      : (match.durationPerPeriod || 10) * 60;

    sortedFilteredEvents.forEach(e => {
      // Scores
      if (e.type.includes('make')) {
        const pts = parseInt(e.type[0]) || 0;
        const isHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === e.playerId) ||
                       e.playerId === 'home_team' ||
                       e.playerId === 'our_team' ||
                       e.playerId === homeTeamId ||
                       e.team === 'home';
        if (isHome) homeScore += pts;
        else awayScore += pts;
      }
      
      // Fouls
      const isFoul = e.type === 'foul' || e.type === 'defensive_foul' || e.type === 'offensive_foul';
      if (isFoul) {
        const isHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === e.playerId) ||
                       e.playerId === 'home_team' ||
                       e.playerId === 'our_team' ||
                       e.playerId === homeTeamId ||
                       e.team === 'home';
        if (isHome) {
          homeFoulsCumulative++;
          if (e.quarter === currentQuarter) homeFoulsCurrentQuarter++;
        } else {
          awayFoulsCumulative++;
          if (e.quarter === currentQuarter) awayFoulsCurrentQuarter++;
        }
      }

      // Timeouts
      if (e.type === 'timeout') {
        const isHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === e.playerId) ||
                       e.playerId === 'home_team' ||
                       e.playerId === 'our_team' ||
                       e.playerId === homeTeamId ||
                       e.team === 'home';
        if (isHome) homeTimeouts++;
        else awayTimeouts++;
      }
    });

    // 3. Compute Lineups, Player Fouls, and Player Points
    const playerFouls: Record<string, number> = {};
    const playerPoints: Record<string, number> = {};
    
    sortedFilteredEvents.forEach(e => {
      const isFoul = e.type === 'foul' || e.type === 'defensive_foul' || e.type === 'offensive_foul';
      if (isFoul && e.playerId && e.playerId !== 'home_team' && e.playerId !== 'away_team' && e.playerId !== 'our_team' && e.playerId !== 'opp') {
        playerFouls[e.playerId] = (playerFouls[e.playerId] || 0) + 1;
      }
      
      if (e.type.includes('make') && e.playerId && e.playerId !== 'home_team' && e.playerId !== 'away_team' && e.playerId !== 'our_team' && e.playerId !== 'opp') {
        const pts = parseInt(e.type[0]) || 0;
        playerPoints[e.playerId] = (playerPoints[e.playerId] || 0) + pts;
      }
    });

    const getLineupForTeam = (teamId: string) => {
      const teamRosters = matchRosters.filter(r => r.teamId === teamId);
      const starterEvents = sortedFilteredEvents.filter(e => e.type === 'starter' && teamRosters.some(r => r.profileId === e.playerId));
      
      let lineupSet = new Set<string>();
      if (starterEvents.length > 0) {
        starterEvents.forEach(e => lineupSet.add(e.playerId));
      } else {
        teamRosters.filter(r => r.isStarter).forEach(r => lineupSet.add(r.profileId));
      }
      
      // Filter out only substitutions up to current time
      const subs = sortedFilteredEvents
        .filter(e => (e.type === 'sub_in' || e.type === 'sub_out') && teamRosters.some(r => r.profileId === e.playerId));
        
      subs.forEach(e => {
        if (e.type === 'sub_in') {
          lineupSet.add(e.playerId);
        } else if (e.type === 'sub_out') {
          lineupSet.delete(e.playerId);
        }
      });
      
      return Array.from(lineupSet);
    };

    const homeLineupIds = getLineupForTeam(homeTeamId);
    const awayLineupIds = getLineupForTeam(awayTeamId);

    // 4. Possession Calculation
    let possessionTeam: 'home' | 'away' | undefined = undefined;
    try {
      const { activePossession } = rebuildPossessionsEngine(match.id, sortedFilteredEvents, matchRosters, match);
      possessionTeam = activePossession?.teamInPossession;
    } catch (err) {
      console.warn("Could not calculate possession for snapshot:", err);
    }

    return {
      homeScore,
      awayScore,
      homeFoulsCumulative,
      awayFoulsCumulative,
      homeFoulsCurrentQuarter,
      awayFoulsCurrentQuarter,
      homeTimeouts,
      awayTimeouts,
      currentQuarter,
      gameClockSeconds,
      homeLineupIds,
      awayLineupIds,
      playerFouls,
      playerPoints,
      possessionTeam
    };
  }, [sortedFilteredEvents, matchRosters, homeTeamId, awayTeamId, match, match.id]);

  // Format remaining game clock (MM:SS)
  const formatGameClock = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Format YouTube time
  const formatYoutubeTime = (seconds: number) => {
    if (seconds === undefined || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Get active lineup players details
  const homeLineupPlayers = useMemo(() => {
    return matchRosters
      .filter(r => stats.homeLineupIds.includes(r.profileId))
      .map(r => ({
        ...r,
        fouls: stats.playerFouls[r.profileId] || 0,
        points: stats.playerPoints[r.profileId] || 0
      }));
  }, [matchRosters, stats.homeLineupIds, stats.playerFouls, stats.playerPoints]);

  const awayLineupPlayers = useMemo(() => {
    return matchRosters
      .filter(r => stats.awayLineupIds.includes(r.profileId))
      .map(r => ({
        ...r,
        fouls: stats.playerFouls[r.profileId] || 0,
        points: stats.playerPoints[r.profileId] || 0
      }));
  }, [matchRosters, stats.awayLineupIds, stats.playerFouls, stats.playerPoints]);

  // Get full rosters with fouls
  const homeRosterPlayers = useMemo(() => {
    return matchRosters
      .filter(r => r.teamId === homeTeamId)
      .map(r => ({
        ...r,
        fouls: stats.playerFouls[r.profileId] || 0,
        points: stats.playerPoints[r.profileId] || 0,
        isOnCourt: stats.homeLineupIds.includes(r.profileId)
      }))
      .sort((a, b) => b.points - a.points || b.fouls - a.fouls || (a.isOnCourt ? -1 : 1));
  }, [matchRosters, homeTeamId, stats.playerFouls, stats.playerPoints, stats.homeLineupIds]);

  const awayRosterPlayers = useMemo(() => {
    return matchRosters
      .filter(r => r.teamId === awayTeamId)
      .map(r => ({
        ...r,
        fouls: stats.playerFouls[r.profileId] || 0,
        points: stats.playerPoints[r.profileId] || 0,
        isOnCourt: stats.awayLineupIds.includes(r.profileId)
      }))
      .sort((a, b) => b.points - a.points || b.fouls - a.fouls || (a.isOnCourt ? -1 : 1));
  }, [matchRosters, awayTeamId, stats.playerFouls, stats.playerPoints, stats.awayLineupIds]);

  // Recent plays before the current timestamp (last 4 events)
  const recentPlays = useMemo(() => {
    return sortedFilteredEvents
      .filter(e => e.type !== 'starter')
      .slice(-4)
      .reverse();
  }, [sortedFilteredEvents]);

  const handleToggle = () => setIsOpen(!isOpen);

  // Styling helpers
  const homeBgColor = match.ourColor || 'var(--color-brand-navy)';
  const awayBgColor = match.theirColor || '#E11D48';

  const getEventName = (type: string) => {
    if (type === '1pt_make') return 'Free Throw Masuk';
    if (type === '1pt_miss') return 'Free Throw Gagal';
    if (type === '2pt_make') return '2 Poin Masuk';
    if (type === '2pt_miss') return '2 Poin Gagal';
    if (type === '3pt_make') return '3 Poin Masuk';
    if (type === '3pt_miss') return '3 Poin Gagal';
    if (type === 'oreb') return 'Offensive Rebound';
    if (type === 'dreb') return 'Defensive Rebound';
    if (type === 'ast') return 'Assist';
    if (type === 'to') return 'Turnover';
    if (type === 'stl') return 'Steal';
    if (type === 'blk') return 'Block';
    if (type === 'foul') return 'Foul';
    if (type === 'timeout') return 'Timeout';
    if (type === 'sub_in') return 'Pemain Masuk';
    if (type === 'sub_out') return 'Pemain Keluar';
    return type.toUpperCase();
  };

  return (
    <div className="absolute inset-y-0 z-[70] pointer-events-none flex items-center">
      {/* Drawer Container (Absolute within parent) */}
      <div 
        className={`absolute inset-y-0 flex items-center ${
          drawerSide === 'left' ? 'left-0' : 'right-0'
        }`}
      >
        {/* Toggle Button Handle */}
        <button
          onClick={handleToggle}
          style={{
            backgroundColor: 'rgba(17, 24, 39, 0.8)',
            borderColor: 'rgba(55, 65, 81, 0.5)'
          }}
          className={`pointer-events-auto h-28 w-7 border-y flex flex-col items-center justify-center text-zinc-300 hover:text-white transition-all shadow-2xl backdrop-blur-md focus:outline-none z-50 ${
            drawerSide === 'left' 
              ? 'rounded-r-xl border-r border-zinc-700/50 left-full absolute' 
              : 'rounded-l-xl border-l border-zinc-700/50 right-full absolute'
          }`}
          title={isOpen ? "Tutup Scoreboard Snapshot" : "Buka Scoreboard Snapshot"}
        >
          {drawerSide === 'left' ? (
            isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />
          ) : (
            isOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />
          )}
          <span 
            className="text-xs font-bold tracking-[0.2em] font-display uppercase origin-center mt-2"
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed'
            }}
          >
            SCOREBOARD
          </span>
        </button>

        {/* The Drawer Content Panel */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ x: drawerSide === 'left' ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: drawerSide === 'left' ? '-100%' : '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className={`pointer-events-auto w-[335px] sm:w-[370px] h-full bg-zinc-950/65 backdrop-blur-xl border-zinc-800/60 text-white shadow-2xl flex flex-col overflow-hidden relative ${
                drawerSide === 'left' ? 'border-r' : 'border-l'
              }`}
            >
              {/* Header: Replay Indicator */}
              <div className="p-3 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/40 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-bold text-amber-400 font-display uppercase tracking-widest flex items-center gap-1.5">
                    <Tv size={14} /> REPLAY SNAPBOARD
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-zinc-300 bg-zinc-900/80 px-2.5 py-1 rounded-md border border-zinc-700/50">
                  YT: {formatYoutubeTime(currentYoutubeTime)}
                </div>
              </div>

              {/* STADIUM STYLE SCOREBOARD WIDGET */}
              <div className="p-4 bg-zinc-950/40 border-b border-zinc-900/60 shrink-0 select-none">
                <div className="bg-[#0b0c10]/65 border border-zinc-800/80 rounded-2xl p-3.5 shadow-2xl relative flex flex-col gap-3 font-mono backdrop-blur-sm">
                  
                  {/* Neon Glow Tube Ornament lines */}
                  <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-zinc-700 to-transparent opacity-60" />
                  
                  {/* Top Row: QUARTER & TIME */}
                  <div className="flex justify-between items-center px-1">
                    {/* Period/Quarter display */}
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-zinc-400 font-display font-bold tracking-widest uppercase mb-1">PERIOD</span>
                      <div className="bg-zinc-950/90 px-3 py-1 rounded-lg border border-zinc-800 text-amber-500 text-2xl font-black text-center min-w-[40px] tracking-tighter shadow-inner">
                        {stats.currentQuarter}
                      </div>
                    </div>

                    {/* Possession Indicator Center */}
                    <div className="flex gap-4 items-center">
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-zinc-400 font-display font-bold tracking-widest mb-1">POSS</span>
                        <div className="flex gap-2 bg-zinc-950/90 p-1.5 rounded-lg border border-zinc-900 shadow-inner">
                          <div 
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                              stats.possessionTeam === 'home' 
                                ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' 
                                : 'bg-zinc-800'
                            }`} 
                            title={`${homeTeamName} Possession`}
                          />
                          <div 
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                              stats.possessionTeam === 'away' 
                                ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]' 
                                : 'bg-zinc-800'
                            }`}
                            title={`${awayTeamName} Possession`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Game Clock Display */}
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-zinc-400 font-display font-bold tracking-widest uppercase mb-1">GAME TIME</span>
                      <div className="bg-zinc-950/90 px-3.5 py-1 rounded-lg border border-zinc-800 text-red-500 text-2xl font-black tracking-widest shadow-inner">
                        {formatGameClock(stats.gameClockSeconds)}
                      </div>
                    </div>
                  </div>

                  {/* Middle Row: Team Names & Scores */}
                  <div className="grid grid-cols-5 items-center gap-2 mt-1 bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-900/80">
                    
                    {/* Home Team */}
                    <div className="col-span-2 text-center flex flex-col gap-1 min-w-0">
                      <div 
                        style={{ borderLeftColor: homeBgColor }}
                        className="text-xs sm:text-sm font-display font-bold tracking-wide text-zinc-100 truncate pl-1.5 border-l-[3px] text-left"
                      >
                        {homeTeamName}
                      </div>
                      <div className="text-left flex gap-1.5 mt-0.5">
                        <span className="text-xs text-zinc-400 font-medium">TF: <strong className="text-red-400 font-bold">{stats.homeFoulsCurrentQuarter}</strong></span>
                        <span className="text-xs text-zinc-400 font-medium">TO: <strong className="text-amber-500 font-bold">{stats.homeTimeouts}</strong></span>
                      </div>
                    </div>

                    {/* Scores Center Display */}
                    <div className="col-span-1 flex items-center justify-center">
                      <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800 text-center min-w-[55px] shadow-md">
                        <div className="text-base font-black text-emerald-400 tracking-wider">
                          {stats.homeScore}:{stats.awayScore}
                        </div>
                      </div>
                    </div>

                    {/* Away Team */}
                    <div className="col-span-2 text-center flex flex-col items-end gap-1 min-w-0">
                      <div 
                        style={{ borderRightColor: awayBgColor }}
                        className="text-xs sm:text-sm font-display font-bold tracking-wide text-zinc-100 truncate pr-1.5 border-r-[3px] text-right w-full"
                      >
                        {awayTeamName}
                      </div>
                      <div className="text-right flex gap-1.5 mt-0.5 justify-end">
                        <span className="text-xs text-zinc-400 font-medium">TF: <strong className="text-red-400 font-bold">{stats.awayFoulsCurrentQuarter}</strong></span>
                        <span className="text-xs text-zinc-400 font-medium">TO: <strong className="text-amber-500 font-bold">{stats.awayTimeouts}</strong></span>
                      </div>
                    </div>

                  </div>

                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-zinc-900/60 shrink-0 bg-zinc-950/45 backdrop-blur-sm">
                <button
                  onClick={() => setActiveTab('lineup')}
                  className={`flex-1 py-3 text-xs font-bold font-display uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                    activeTab === 'lineup' 
                      ? 'border-amber-500 text-white bg-zinc-900/30' 
                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/10'
                  }`}
                >
                  <Users size={14} /> ON COURT
                </button>
                <button
                  onClick={() => setActiveTab('roster')}
                  className={`flex-1 py-3 text-xs font-bold font-display uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                    activeTab === 'roster' 
                      ? 'border-amber-500 text-white bg-zinc-900/30' 
                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/10'
                  }`}
                >
                  <Award size={14} /> ALL PLAYERS
                </button>
                <button
                  onClick={() => setActiveTab('plays')}
                  className={`flex-1 py-3 text-xs font-bold font-display uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                    activeTab === 'plays' 
                      ? 'border-amber-500 text-white bg-zinc-900/30' 
                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/10'
                  }`}
                >
                  <Activity size={14} /> RECENT PLAYS
                </button>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-transparent">
                
                {/* 1. CURRENT LINEUPS ON COURT */}
                {activeTab === 'lineup' && (
                  <div className="space-y-5">
                    {/* Home Lineup */}
                    <div>
                      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-zinc-800/60">
                        <span className="text-xs font-bold tracking-widest font-display uppercase text-zinc-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-3 rounded-sm" style={{ backgroundColor: homeBgColor }} />
                          {homeTeamName} Lineup
                        </span>
                        <span className="text-xs text-zinc-500 font-mono font-bold uppercase tracking-wider">STATS</span>
                      </div>
                      {homeLineupPlayers.length === 0 ? (
                        <div className="text-xs text-zinc-500 text-center py-3 italic">
                          Lineup data belum terdefinisi pada detik ini.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {homeLineupPlayers.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-sm py-2 px-2.5 bg-zinc-900/35 hover:bg-zinc-900/50 rounded-lg transition-all border border-zinc-800/40">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-mono font-black text-emerald-400 w-6 shrink-0 text-left">#{p.jerseyNumber}</span>
                                <span className="truncate text-zinc-200 font-medium">{p.name}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black px-1.5 py-0.5 rounded font-mono">
                                  {p.points || 0} PTS
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map(i => (
                                      <div 
                                        key={i} 
                                        className={`w-1.5 h-1.5 rounded-sm ${
                                          p.fouls >= i 
                                            ? i === 5 ? 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]' : 'bg-amber-500 shadow-[0_0_3px_rgba(245,158,11,0.8)]' 
                                            : 'bg-zinc-800'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-xs font-mono font-bold text-zinc-400 w-4 text-right">{p.fouls} PF</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Away Lineup */}
                    <div>
                      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-zinc-800/60">
                        <span className="text-xs font-bold tracking-widest font-display uppercase text-zinc-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-3 rounded-sm" style={{ backgroundColor: awayBgColor }} />
                          {awayTeamName} Lineup
                        </span>
                        <span className="text-xs text-zinc-500 font-mono font-bold uppercase tracking-wider">STATS</span>
                      </div>
                      {awayLineupPlayers.length === 0 ? (
                        <div className="text-xs text-zinc-500 text-center py-3 italic">
                          Lineup data belum terdefinisi pada detik ini.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {awayLineupPlayers.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-sm py-2 px-2.5 bg-zinc-900/35 hover:bg-zinc-900/50 rounded-lg transition-all border border-zinc-800/40">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-mono font-black text-brand-orange w-6 shrink-0 text-left">#{p.jerseyNumber}</span>
                                <span className="truncate text-zinc-200 font-medium">{p.name}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-black px-1.5 py-0.5 rounded font-mono">
                                  {p.points || 0} PTS
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map(i => (
                                      <div 
                                        key={i} 
                                        className={`w-1.5 h-1.5 rounded-sm ${
                                          p.fouls >= i 
                                            ? i === 5 ? 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]' : 'bg-amber-500 shadow-[0_0_3px_rgba(245,158,11,0.8)]' 
                                            : 'bg-zinc-800'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-xs font-mono font-bold text-zinc-400 w-4 text-right">{p.fouls} PF</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. FULL ROSTERS WITH FOULS & ON-COURT LABELS */}
                {activeTab === 'roster' && (
                  <div className="space-y-5">
                    {/* Home Roster */}
                    <div>
                      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-zinc-800/60">
                        <span className="text-xs font-bold tracking-widest font-display uppercase text-zinc-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-3 rounded-sm" style={{ backgroundColor: homeBgColor }} />
                          {homeTeamName} Roster
                        </span>
                        <span className="text-xs text-zinc-500 font-mono font-bold uppercase tracking-wider">PTS & FOULS</span>
                      </div>
                      <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                        {homeRosterPlayers.map(p => (
                          <div key={p.id} className="flex items-center justify-between text-sm py-2 px-2 border-b border-zinc-900/30 hover:bg-zinc-900/25 transition-all rounded">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono text-zinc-400 w-6 text-right shrink-0 font-semibold">#{p.jerseyNumber}</span>
                              <span className="truncate text-zinc-200 font-medium">{p.name}</span>
                              {p.isOnCourt && (
                                <span className="bg-emerald-500/15 text-emerald-400 text-xs font-black px-1.5 py-0.2 rounded border border-emerald-500/30 shrink-0">COURT</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-zinc-200 font-black font-mono bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-800/80 text-xs">
                                {p.points || 0} PTS
                              </span>
                              <span className={`text-xs font-mono font-bold w-10 text-right ${p.fouls >= 5 ? 'text-red-500 font-black' : p.fouls >= 3 ? 'text-amber-400 font-bold' : 'text-zinc-400'}`}>
                                {p.fouls} PF
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Away Roster */}
                    <div>
                      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-zinc-800/60">
                        <span className="text-xs font-bold tracking-widest font-display uppercase text-zinc-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-3 rounded-sm" style={{ backgroundColor: awayBgColor }} />
                          {awayTeamName} Roster
                        </span>
                        <span className="text-xs text-zinc-500 font-mono font-bold uppercase tracking-wider">PTS & FOULS</span>
                      </div>
                      <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                        {awayRosterPlayers.map(p => (
                          <div key={p.id} className="flex items-center justify-between text-sm py-2 px-2 border-b border-zinc-900/30 hover:bg-zinc-900/25 transition-all rounded shadow-sm">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono text-zinc-400 w-6 text-right shrink-0 font-semibold">#{p.jerseyNumber}</span>
                              <span className="truncate text-zinc-200 font-medium">{p.name}</span>
                              {p.isOnCourt && (
                                <span className="bg-emerald-500/15 text-emerald-400 text-xs font-black px-1.5 py-0.2 rounded border border-emerald-500/30 shrink-0">COURT</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-zinc-200 font-black font-mono bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-800/80 text-xs">
                                {p.points || 0} PTS
                              </span>
                              <span className={`text-xs font-mono font-bold w-10 text-right ${p.fouls >= 5 ? 'text-red-500 font-black' : p.fouls >= 3 ? 'text-amber-400 font-bold' : 'text-zinc-400'}`}>
                                {p.fouls} PF
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. RECENT PLAYS LEADING TO THIS MOMENT */}
                {activeTab === 'plays' && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold tracking-widest font-display uppercase text-zinc-300 mb-2 pb-1.5 border-b border-zinc-800/60 flex items-center justify-between">
                      <span>KRONOLOGI AKSI</span>
                      <span className="text-xs font-normal lowercase italic text-zinc-500">terbaru di atas</span>
                    </div>
                    {recentPlays.length === 0 ? (
                      <div className="text-xs text-zinc-500 text-center py-4 italic">
                        Belum ada aksi tercatat sebelum detik ini.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentPlays.map((e, idx) => {
                          const player = matchRosters.find(r => r.profileId === e.playerId);
                          const isHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === e.playerId) ||
                                         e.playerId === 'home_team' ||
                                         e.playerId === 'our_team' ||
                                         e.playerId === homeTeamId ||
                                         e.team === 'home';
                                         
                          return (
                            <div 
                              key={e.id || idx} 
                              className="relative pl-4 border-l-[3px] py-1 bg-zinc-900/20 rounded-r-lg pr-2 border-r border-t border-b border-transparent hover:border-zinc-800/40 hover:bg-zinc-900/30 transition-all"
                              style={{ borderLeftColor: isHome ? homeBgColor : awayBgColor }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-zinc-100 font-sans truncate pr-2 max-w-[170px]">
                                  {player ? (player.jerseyNumber ? `#${player.jerseyNumber} ${player.name}` : player.name) : (isHome ? homeTeamName : awayTeamName)}
                                </span>
                                <span className="text-xs font-mono font-bold text-zinc-400 bg-zinc-900/85 px-1.5 py-0.5 rounded border border-zinc-800/80 flex items-center gap-1 shrink-0">
                                  <Clock size={10} /> {formatGameClock(e.timestamp)}
                                </span>
                              </div>
                              <div className="text-sm font-semibold text-zinc-300 flex items-center justify-between">
                                <span className="text-amber-400 font-bold font-sans">{getEventName(e.type)}</span>
                                {e.points !== undefined && e.points > 0 && (
                                  <span className="bg-emerald-500/15 text-emerald-400 text-xs px-2 py-0.5 font-black rounded border border-emerald-500/30">
                                    +{e.points} PTS
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Footer: Dynamic status update details */}
              <div className="p-3.5 border-t border-zinc-900 bg-zinc-950/75 backdrop-blur-md shrink-0 text-center text-xs text-zinc-400 font-mono tracking-tight flex items-center justify-center gap-2">
                <AlertCircle size={12} className="text-amber-500/70" />
                <span>State is computed dynamically up to current video position.</span>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};


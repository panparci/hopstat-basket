import { useState, useEffect } from 'react';
import { statsService } from '../core/services/statsService';
import { GameEvent, Match, ChildProfile, MatchRoster } from '../core/types/stats';
import { isCountableMatch, didPlayInMatch } from '../core/utils/matchFilters';
import { initDB } from '../lib/db';

export interface PlayerStats {
  pts: number;
  reb: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  blk: number;
  to: number;
  fouls: number;
  fgm: number;
  fga: number;
  fg2m: number;
  fg2a: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  gamesPlayed: number;
  turnoverDetails?: Record<string, number>;
}

export interface TeammateStat extends PlayerStats {
  id: string;
  name: string;
  jersey: string;
  isChild: boolean;
}

export const useStats = (
  profileId?: string | null,
  seriesId?: string | null,
  filterKU?: number | 'all' | null,
  filterGrade?: string | 'all' | null
) => {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ChildProfile | null>(null);
  const [childStats, setChildStats] = useState<PlayerStats | null>(null);
  const [gameByGameStats, setGameByGameStats] = useState<any[]>([]);
  const [teamStats, setTeamStats] = useState<PlayerStats | null>(null);
  const [opponentStats, setOpponentStats] = useState<PlayerStats | null>(null);
  const [allTeammateStats, setAllTeammateStats] = useState<TeammateStat[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const allProfiles = await statsService.getProfiles();
        setProfiles(allProfiles);

        let currentProfile = null;
        if (profileId) {
          currentProfile = allProfiles.find(p => p.id === profileId) || null;
          // If not in profiles, try to find in players or just create a mock profile to calculate stats
          if (!currentProfile) {
            const allPlayers = await statsService.getPlayers();
            const allTeams = await statsService.getTeams();
            
            const teamPlayers = allTeams.flatMap(t => t.roster || []);
            const player = allPlayers.find(p => p.id === profileId) || 
                           teamPlayers.find(p => p.id === profileId);
                           
            if (player) {
              currentProfile = { id: player.id, name: player.name } as ChildProfile;
            }
          }
        } else if (allProfiles.length > 0) {
          currentProfile = allProfiles[0];
        }
        setSelectedProfile(currentProfile);

        let matches = await statsService.getMatches();
        const allMatchRosters = await statsService.getAllMatchRosters();
        // Filter out aborted and excluded matches
        matches = matches.filter(isCountableMatch);
        
        // Filter by series if provided
        if (seriesId) {
          matches = matches.filter(m => m.seriesId === seriesId);
        }

        // Apply filters
        if (filterKU !== undefined && filterKU !== 'all' && filterKU !== null) {
          matches = matches.filter(m => {
            const mKU = m.matchKU !== undefined ? m.matchKU : m.ageCategory;
            return mKU === filterKU;
          });
        }
        if (filterGrade !== undefined && filterGrade !== 'all' && filterGrade !== null) {
          matches = matches.filter(m => m.competitionGrade === filterGrade);
        }
        
        const events = await statsService.getAllEvents();
        const db = await initDB();
        const stints = await db.getAll('match_stints');

        // Calculate Team & Opponent Stats
        const tStats = createEmptyStats();
        const oStats = createEmptyStats();

        let playedTeamMatchesCount = 0;
        matches.forEach(match => {
          const matchEvents = events.filter(e => e.matchId === match.id);
          const matchRosters = allMatchRosters.filter(r => r.matchId === match.id);
          if (matchEvents.length > 0 || matchRosters.length > 0) {
            playedTeamMatchesCount++;
          }
        });
        tStats.gamesPlayed = playedTeamMatchesCount;
        oStats.gamesPlayed = playedTeamMatchesCount;

        events.forEach(e => {
          const match = matches.find(m => m.id === e.matchId);
          if (match) {
            const matchRosters = allMatchRosters.filter(r => r.matchId === match.id);
            const homeTeamId = match.teamId || 'home_team';
            
            const isHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === e.playerId) || e.playerId === 'home_team';
            const isAway = matchRosters.some(r => r.teamId !== homeTeamId && r.profileId === e.playerId) || e.playerId === 'away_team';
            
            if (isHome) {
              aggregateEvent(tStats, e);
            } else if (isAway) {
              aggregateEvent(oStats, e);
            }
          }
        });

        setTeamStats(tStats);
        setOpponentStats(oStats);

        // Calculate All Teammates Stats
        const teammateMap: Record<string, TeammateStat> = {};
        
        matches.forEach(m => {
          const matchRosters = allMatchRosters.filter(r => r.matchId === m.id);
          const homeTeamId = m.teamId || 'home_team';
          
          if (matchRosters.length > 0) {
            matchRosters.filter(r => r.teamId === homeTeamId).forEach(r => {
              if (!teammateMap[r.profileId]) {
                teammateMap[r.profileId] = { 
                  ...createEmptyStats(), 
                  id: r.profileId, 
                  name: r.name, 
                  jersey: r.jerseyNumber,
                  isChild: allProfiles.some(prof => prof.id === r.profileId || prof.name.toLowerCase() === r.name.toLowerCase())
                };
              }
            });
          }
        });

        // Calculate games played for teammates
        matches.forEach(m => {
          const matchRosters = allMatchRosters.filter(r => r.matchId === m.id);
          const homeTeamId = m.teamId || 'home_team';
          
          if (matchRosters.length > 0) {
            matchRosters.filter(r => r.teamId === homeTeamId).forEach(r => {
              if (teammateMap[r.profileId]) {
                if (didPlayInMatch(r.profileId, m.id, events, stints)) {
                  teammateMap[r.profileId].gamesPlayed += 1;
                }
              }
            });
          }
        });

        events.forEach(e => {
          if (teammateMap[e.playerId]) {
            aggregateEvent(teammateMap[e.playerId], e);
          }
        });

        const sortedTeammates = Object.values(teammateMap).sort((a, b) => b.pts - a.pts);
        setAllTeammateStats(sortedTeammates);

        // Calculate Child Stats
        if (currentProfile) {
          const cStats = createEmptyStats();
          const childNameLower = currentProfile.name.toLowerCase();
          
          const matchingPlayerIds = new Set<string>();
          
          matchingPlayerIds.add(currentProfile.id);

          allMatchRosters.forEach(r => {
            if (r.id === currentProfile.id || r.profileId === currentProfile.id) {
              matchingPlayerIds.add(r.profileId);
            }
            const aliases = currentProfile.voiceAliases?.map(a => a.toLowerCase()) || [];
            if (r.profileId === currentProfile.id && aliases.includes(r.name.toLowerCase())) {
              matchingPlayerIds.add(r.profileId);
            }
          });

          const validMatchIds = new Set(matches.map(m => m.id));
          const childEvents = events.filter(e => matchingPlayerIds.has(e.playerId) && validMatchIds.has(e.matchId));
          
          const matchesPlayed = new Set<string>();
          matches.forEach(m => {
            const hasPlayed = Array.from(matchingPlayerIds).some(pid => 
              didPlayInMatch(pid, m.id, events, stints)
            );
            if (hasPlayed) {
              matchesPlayed.add(m.id);
            }
          });
          
          cStats.gamesPlayed = matchesPlayed.size;

          childEvents.forEach(e => {
            aggregateEvent(cStats, e);
          });

          setChildStats(cStats);

          const gbg: any[] = [];
          const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          let playedIndex = 0;
          sortedMatches.forEach((m) => {
            if (matchesPlayed.has(m.id)) {
              playedIndex++;
              const mStats = createEmptyStats();
              mStats.gamesPlayed = 1;
              const mEvents = childEvents.filter(e => e.matchId === m.id);
              mEvents.forEach(e => aggregateEvent(mStats, e));
              gbg.push({
                matchId: m.id,
                date: new Date(m.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
                gameLabel: `G${playedIndex}`,
                pts: mStats.pts,
                reb: mStats.reb,
                ast: mStats.ast,
                stl: mStats.stl,
                blk: mStats.blk,
              });
            }
          });
          setGameByGameStats(gbg);
        } else {
          setChildStats(null);
          setGameByGameStats([]);
        }

      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [profileId, seriesId, filterKU, filterGrade]);

  return {
    loading,
    profiles,
    selectedProfile,
    childStats,
    gameByGameStats,
    teamStats,
    opponentStats,
    allTeammateStats
  };
};

export function createEmptyStats(): PlayerStats {
  return {
    pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, to: 0, fouls: 0,
    fgm: 0, fga: 0, fg2m: 0, fg2a: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, gamesPlayed: 0,
    turnoverDetails: {}
  };
}

export function aggregateEvent(stats: PlayerStats, e: GameEvent) {
  switch (e.type) {
    case '1pt_make': stats.pts += 1; stats.ftm += 1; stats.fta += 1; break;
    case '1pt_miss': stats.fta += 1; break;
    case '2pt_make': stats.pts += 2; stats.fgm += 1; stats.fga += 1; stats.fg2m += 1; stats.fg2a += 1; break;
    case '2pt_miss': 
      if (!e.isShootingFoul) {
        stats.fga += 1; stats.fg2a += 1; 
      }
      break;
    case '3pt_make': stats.pts += 3; stats.fgm += 1; stats.fga += 1; stats.tpm += 1; stats.tpa += 1; break;
    case '3pt_miss': 
      if (!e.isShootingFoul) {
        stats.fga += 1; stats.tpa += 1; 
      }
      break;
    case 'oreb': stats.reb += 1; stats.oreb += 1; break;
    case 'dreb': stats.reb += 1; stats.dreb += 1; break;
    case 'ast': stats.ast += 1; break;
    case 'stl': stats.stl += 1; break;
    case 'blk': stats.blk += 1; break;
    case 'to': 
      stats.to += 1; 
      if (e.subType) {
        if (!stats.turnoverDetails) stats.turnoverDetails = {};
        stats.turnoverDetails[e.subType] = (stats.turnoverDetails[e.subType] || 0) + 1;
      }
      break;
    case 'foul': 
    case 'offensive_foul':
    case 'defensive_foul':
      stats.fouls += 1; break;
  }
}

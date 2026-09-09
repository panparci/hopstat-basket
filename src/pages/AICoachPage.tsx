import React, { useState, useEffect } from 'react';
import { Brain, Users, Target, Activity, ShieldAlert, ChevronDown, Loader2 } from 'lucide-react';
import { useStats, createEmptyStats, aggregateEvent, PlayerStats } from '../hooks/useStats';
import { statsService } from '../core/services/statsService';
import { aiCoachService, AgentRole, AgentInsight } from '../core/services/ai';
import { ChildProfile, Match, Team, Player } from '../core/types/stats';
import { isCountableMatch, didPlayInMatch } from '../core/utils/matchFilters';
import { initDB } from '../lib/db';

const AICoachPage: React.FC = () => {
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  
  const { childStats, teamStats, opponentStats, loading: statsLoading } = useStats(selectedProfileId);
  
  const [activeAgent, setActiveAgent] = useState<AgentRole>('team_analyst');
  const [insights, setInsights] = useState<Record<AgentRole, AgentInsight | null>>({
    team_analyst: null,
    skill_coach: null,
    shot_analyst: null,
    strategist: null,
    scout: null,
    progress_analyst: null
  });
  const [activeInsightIds, setActiveInsightIds] = useState<Record<AgentRole, string | null>>({
    team_analyst: null,
    skill_coach: null,
    shot_analyst: null,
    strategist: null,
    scout: null,
    progress_analyst: null
  });
  const [loadingAgent, setLoadingAgent] = useState<AgentRole | null>(null);
  const [insightHistory, setInsightHistory] = useState<any[]>([]);

  const loadInsightHistory = async () => {
    let targetId = '';
    if (activeAgent === 'skill_coach' || activeAgent === 'shot_analyst' || activeAgent === 'progress_analyst') {
      targetId = selectedProfileId || '';
    } else if (activeAgent === 'team_analyst') {
      targetId = selectedTeamId || '';
    } else if (activeAgent === 'strategist' || activeAgent === 'scout') {
      targetId = selectedMatchId || '';
    }
    
    if (targetId) {
      const history = await statsService.getInsights(targetId);
      const filteredHistory = history.filter(h => h.role === activeAgent).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setInsightHistory(filteredHistory);
      
      setInsights(prev => {
        if (!prev[activeAgent] && filteredHistory.length > 0) {
          setActiveInsightIds(prevIds => ({ ...prevIds, [activeAgent]: filteredHistory[0].id }));
          return { ...prev, [activeAgent]: filteredHistory[0].insightData };
        }
        return prev;
      });
    } else {
      setInsightHistory([]);
    }
  };

  useEffect(() => {
    loadInsightHistory();
  }, [activeAgent, selectedProfileId, selectedTeamId, selectedMatchId]);

  useEffect(() => {
    const loadData = async () => {
      const [loadedProfiles, loadedMatches, loadedTeams, loadedPlayers, loadedMatchRosters] = await Promise.all([
        statsService.getProfiles(),
        statsService.getMatches(),
        statsService.getTeams(),
        statsService.getPlayers(),
        statsService.getAllMatchRosters()
      ]);
      
      const teamPlayers = loadedTeams.flatMap(t => t.roster || []);
      const matchPlayers = loadedMatchRosters.map(r => ({ id: r.profileId, name: r.name, jersey: r.jerseyNumber } as Player));
      
      const allUniquePlayersMap = new Map<string, Player>();
      loadedPlayers.forEach(p => allUniquePlayersMap.set(p.id, p));
      teamPlayers.forEach(p => allUniquePlayersMap.set(p.id, p));
      matchPlayers.forEach(p => allUniquePlayersMap.set(p.id, p));
      
      const combinedPlayers = Array.from(allUniquePlayersMap.values());
      
      setProfiles(loadedProfiles);
      setAllPlayers(combinedPlayers);
      // Filter out aborted matches
      const validMatches = loadedMatches.filter(isCountableMatch);
      setMatches(validMatches);
      setTeams(loadedTeams);
      
      if (loadedProfiles.length > 0 && !selectedProfileId) setSelectedProfileId(loadedProfiles[0].id);
      if (validMatches.length > 0 && !selectedMatchId) setSelectedMatchId(validMatches[0].id);
      if (loadedTeams.length > 0 && !selectedTeamId) setSelectedTeamId(loadedTeams[0].id);
    };
    loadData();
  }, []);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) || allPlayers.find(p => p.id === selectedProfileId) as unknown as ChildProfile;
  const selectedMatch = matches.find(m => m.id === selectedMatchId);
  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const clearInsights = () => {
    setInsights({
      team_analyst: null,
      skill_coach: null,
      shot_analyst: null,
      strategist: null,
      scout: null,
      progress_analyst: null
    });
    setActiveInsightIds({
      team_analyst: null,
      skill_coach: null,
      shot_analyst: null,
      strategist: null,
      scout: null,
      progress_analyst: null
    });
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProfileId(e.target.value);
    clearInsights();
  };

  const handleMatchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMatchId(e.target.value);
    clearInsights();
  };

  const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTeamId(e.target.value);
    clearInsights();
  };

  const generateInsight = async (role: AgentRole) => {
    if (loadingAgent) return;
    
    setLoadingAgent(role);
    try {
      let contextData: any = {};
      let targetId = '';

      if (role === 'skill_coach' || role === 'shot_analyst') {
        if (!selectedProfile) throw new Error("Pilih profil atlet terlebih dahulu");
        targetId = selectedProfile.id;
        
        const allMatches = await statsService.getMatches();
        const validMatches = allMatches.filter(isCountableMatch);
        const allEvents = await statsService.getAllEvents();
        const playerEvents = allEvents.filter(e => e.playerId === selectedProfile.id);

        contextData = {
          player: selectedProfile,
          playerStats: childStats || undefined,
          matches: validMatches,
          events: playerEvents
        };
      } else if (role === 'team_analyst') {
        if (!selectedTeam) throw new Error("Pilih tim terlebih dahulu");
        targetId = selectedTeam.id;
        
        const allMatches = await statsService.getMatches();
        // Filter out aborted matches
        const validMatches = allMatches.filter(isCountableMatch);
        const teamMatches = validMatches.filter(m => m.teamId === selectedTeam.id);
        const allEvents = await statsService.getAllEvents();
        const allMatchRosters = await statsService.getAllMatchRosters();
        const db = await initDB();
        const stints = await db.getAll('match_stints');
        
        const tStats = createEmptyStats();
        const playedTeamMatches = teamMatches.filter(match => {
          const matchEvents = allEvents.filter(e => e.matchId === match.id);
          const matchRosters = allMatchRosters.filter(r => r.matchId === match.id);
          return matchEvents.length > 0 || matchRosters.length > 0;
        });
        tStats.gamesPlayed = playedTeamMatches.length;

        const teamMembersStats: { player: Player, stats: PlayerStats }[] = selectedTeam.roster.map(player => {
          const pStats = createEmptyStats();
          let gamesPlayed = 0;
          
          teamMatches.forEach(match => {
            const isPlaying = didPlayInMatch(player.id, match.id, allEvents, stints);
            
            if (isPlaying) {
              gamesPlayed++;
              const matchEvents = allEvents.filter(e => e.matchId === match.id && e.playerId === player.id);
              matchEvents.forEach(e => {
                aggregateEvent(pStats, e);
                aggregateEvent(tStats, e); // Aggregate to team stats as well
              });
            }
          });
          
          pStats.gamesPlayed = gamesPlayed;
          return { player, stats: pStats };
        });

        contextData = {
          team: selectedTeam,
          teamStats: tStats,
          teamMembersStats
        };
      } else if (role === 'progress_analyst') {
        if (!selectedProfile) throw new Error("Pilih profil atlet terlebih dahulu");
        targetId = selectedProfile.id;
        const allMatches = await statsService.getMatches();
        const validMatches = allMatches.filter(isCountableMatch);
        const validMatchIds = new Set(validMatches.map(m => m.id));
        const allEvents = await statsService.getAllEvents();
        const playerEvents = allEvents.filter(e => e.playerId === selectedProfile.id && validMatchIds.has(e.matchId));
        
        contextData = {
          player: selectedProfile,
          events: playerEvents,
          matches: validMatches
        };
      } else if (role === 'strategist' || role === 'scout') {
        if (!selectedMatch) throw new Error("Pilih pertandingan terlebih dahulu");
        targetId = selectedMatch.id;
        
        const allEvents = await statsService.getEvents(selectedMatch.id);
        const allPossessions = await statsService.getPossessions(selectedMatch.id);
        const matchRosters = await statsService.getMatchRosters(selectedMatch.id);
        const homeTeamId = selectedMatch.teamId || 'home_team';
        
        const tStats = createEmptyStats();
        const oStats = createEmptyStats();
        tStats.gamesPlayed = 1;
        oStats.gamesPlayed = 1;

        allEvents.forEach(e => {
          const isHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === e.playerId) || e.playerId === 'home_team';
          const isAway = matchRosters.some(r => r.teamId !== homeTeamId && r.profileId === e.playerId) || e.playerId === 'away_team' || e.playerId === 'opp';
          
          if (isHome) aggregateEvent(tStats, e);
          if (isAway) aggregateEvent(oStats, e);
        });

        contextData = {
          matches: [selectedMatch],
          teamStats: tStats,
          opponentStats: oStats,
          events: allEvents,
          possessions: allPossessions
        };
      }

      // Fetch previous insights for this target to allow AI collaboration
      if (targetId) {
        const allInsights = await statsService.getInsights(targetId);
        // Get the latest insight from each other role
        const latestInsightsByRole = new Map<string, any>();
        allInsights.forEach(insight => {
          if (insight.role !== role) {
            const existing = latestInsightsByRole.get(insight.role);
            if (!existing || new Date(insight.createdAt) > new Date(existing.createdAt)) {
              latestInsightsByRole.set(insight.role, insight);
            }
          }
        });
        
        const previousInsights = Array.from(latestInsightsByRole.values()).map(i => ({
          role: i.role,
          title: i.insightData.title,
          content: i.insightData.content,
          actionableAdvice: i.insightData.actionableAdvice
        }));
        
        contextData.previousInsights = previousInsights;
      }

      // Data Quality Check Gate (PERBAIKAN 5)
      let matchesToAudit: Match[] = [];
      if (selectedMatch) {
        matchesToAudit.push(selectedMatch);
      } else if (selectedTeam) {
        const allMatches = await statsService.getMatches();
        const teamMatches = allMatches.filter(isCountableMatch).filter(m => m.teamId === selectedTeam.id);
        matchesToAudit = teamMatches;
      } else if (selectedProfile) {
        const allMatches = await statsService.getMatches();
        matchesToAudit = allMatches.filter(isCountableMatch);
      }

      const unreliableWarnings: string[] = [];
      for (const m of matchesToAudit) {
        const auditResult = await statsService.auditMatchIntegrity(m.id);
        if (auditResult.trustClassification === 'UNRELIABLE') {
          unreliableWarnings.push(`PERHATIAN: data match ${m.name || m.id} berkualitas rendah (health score ${auditResult.healthScore}%), jangan tarik kesimpulan kuat darinya.`);
        }
      }

      if (unreliableWarnings.length > 0) {
        if (!contextData.previousInsights) {
          contextData.previousInsights = [];
        }
        contextData.previousInsights.push({
          role: 'strategist' as any,
          title: 'PERINGATAN KUALITAS DATA',
          content: unreliableWarnings.join('\n'),
          actionableAdvice: ['Jalankan audit ulang dan perbaiki masalah integritas data di Match Details.']
        });
      }

      const insight = await aiCoachService.generateInsight(role, contextData);
      
      if (targetId) {
        const newInsightId = crypto.randomUUID();
        const newInsight = {
          id: newInsightId,
          role,
          targetId,
          insightData: insight,
          createdAt: new Date().toISOString()
        };
        await statsService.saveInsight(newInsight);
        setActiveInsightIds(prev => ({ ...prev, [role]: newInsightId }));
        loadInsightHistory();
      }

      setInsights(prev => ({ ...prev, [role]: insight }));
    } catch (error) {
      console.error("Failed to generate insight", error);
      alert(error instanceof Error ? error.message : "Gagal menghasilkan analisa");
    } finally {
      setLoadingAgent(null);
    }
  };

  const agents = [
    { id: 'team_analyst', name: 'Team Analyst', icon: <Users size={20} />, desc: 'Mengevaluasi performa dan identitas tim secara keseluruhan.' },
    { id: 'skill_coach', name: 'Skill Coach', icon: <Target size={20} />, desc: 'Fokus pada pengembangan pemain individu dan rekomendasi drills.' },
    { id: 'shot_analyst', name: 'Shot Analyst', icon: <Activity size={20} />, desc: 'Menganalisa efisiensi shooting dan shot selection.' },
    { id: 'strategist', name: 'Strategist', icon: <Brain size={20} />, desc: 'Menyarankan penyesuaian taktik dan game plan.' },
    { id: 'scout', name: 'Advance Scout', icon: <ShieldAlert size={20} />, desc: 'Menganalisa kecenderungan opponent dan skema defensive.' },
    { id: 'progress_analyst', name: 'Progress Analyst', icon: <Activity size={20} />, desc: 'Menganalisa perkembangan pemain dari waktu ke waktu.' },
  ] as const;

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 pb-24 transition-colors font-sans">
      <header className="flex justify-between items-center p-4 bg-white dark:bg-zinc-950 sticky top-0 z-30 border-b border-zinc-100 dark:border-zinc-800 md:hidden">
        <div className="flex items-center gap-2">
          <div className="text-brand-navy dark:text-brand-orange">
            <Brain size={24} strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-display font-bold text-brand-navy dark:text-white uppercase tracking-wide">AI Coach</h1>
        </div>
      </header>

      <main className="p-4 mt-2 max-w-none">
        {/* Dynamic Selector based on Active Agent */}
        <div className="mb-6">
          {(activeAgent === 'skill_coach' || activeAgent === 'shot_analyst' || activeAgent === 'progress_analyst') && (profiles.length > 0 || allPlayers.length > 0) && (
            <>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Fokus Analisa Pemain
              </label>
              <div className="relative">
                <select
                  value={selectedProfileId || ''}
                  onChange={handleProfileChange}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all appearance-none shadow-sm"
                >
                  <option value="">-- Pilih Pemain --</option>
                  <optgroup label="Profil Atlet">
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Rekan Setim / Pemain Lain">
                    {allPlayers.filter(p => !profiles.some(prof => prof.id === p.id)).map(p => (
                      <option key={p.id} value={p.id}>{p.name} {p.jersey ? `(#${p.jersey})` : ''}</option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              </div>
            </>
          )}

          {activeAgent === 'team_analyst' && teams.length > 0 && (
            <>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Fokus Analisa Tim
              </label>
              <div className="relative">
                <select
                  value={selectedTeamId || ''}
                  onChange={handleTeamChange}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all appearance-none shadow-sm"
                >
                  <option value="">-- Pilih Tim --</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              </div>
            </>
          )}

          {(activeAgent === 'strategist' || activeAgent === 'scout') && matches.length > 0 && (
            <>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Fokus Analisa Pertandingan
              </label>
              <div className="relative">
                <select
                  value={selectedMatchId || ''}
                  onChange={handleMatchChange}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all appearance-none shadow-sm"
                >
                  <option value="">-- Pilih Pertandingan --</option>
                  {matches.map(m => (
                    <option key={m.id} value={m.id}>{m.name} vs {m.theirTeamName || 'Lawan'}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              </div>
            </>
          )}
        </div>

        {/* Agent Selection Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 pb-2">
          {agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent.id as AgentRole)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap transition-all ${
                activeAgent === agent.id
                  ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-[#1A1A1A] font-bold shadow-md'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 font-medium'
              }`}
            >
              {agent.icon}
              <span className="text-sm">{agent.name}</span>
            </button>
          ))}
        </div>

        {/* Active Agent Content */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-brand-navy/10 dark:bg-brand-orange/10 text-brand-navy dark:text-brand-orange rounded-lg">
                {agents.find(a => a.id === activeAgent)?.icon}
              </div>
              <div>
                <h2 className="font-bold text-[#1A1A1A] dark:text-white">{agents.find(a => a.id === activeAgent)?.name}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{agents.find(a => a.id === activeAgent)?.desc}</p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {statsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-zinc-400" size={24} />
              </div>
            ) : !insights[activeAgent] ? (
              <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm mt-4">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-navy dark:text-brand-orange">
                  <Brain size={32} />
                </div>
                <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-2">Belum Ada Analisa</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Minta AI Coach untuk menganalisa data pemain ini dan memberikan wawasan khusus.</p>
                <button
                  onClick={() => generateInsight(activeAgent)}
                  disabled={loadingAgent !== null}
                  className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 text-sm tracking-wide mx-auto disabled:opacity-50"
                >
                  {loadingAgent === activeAgent ? (
                    <><Loader2 className="animate-spin" size={18} /> MENGANALISA...</>
                  ) : (
                    <>MULAI ANALISA</>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-3">
                    {insights[activeAgent]?.title}
                  </h3>
                  <div className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {insights[activeAgent]?.content}
                  </div>
                </div>

                {insights[activeAgent]?.actionableAdvice && insights[activeAgent]!.actionableAdvice.length > 0 && (
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                      Rencana Tindakan
                    </h4>
                    <ul className="space-y-3">
                      {insights[activeAgent]?.actionableAdvice.map((advice, idx) => (
                        <li key={`advice-${idx}-${advice.slice(0, 20)}`} className="flex gap-3 text-sm text-[#1A1A1A] dark:text-white">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-navy/10 dark:bg-brand-orange/10 text-brand-navy dark:text-brand-orange flex items-center justify-center font-bold text-xs">
                            {idx + 1}
                          </span>
                          <span className="pt-0.5">{advice}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                  <div className="text-xs text-zinc-500">
                    {activeInsightIds[activeAgent] && insightHistory.find(h => h.id === activeInsightIds[activeAgent])
                      ? `Dianalisa pada ${new Date(insightHistory.find(h => h.id === activeInsightIds[activeAgent])!.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`
                      : ''}
                  </div>
                  <button
                    onClick={() => generateInsight(activeAgent)}
                    disabled={loadingAgent !== null}
                    className="text-sm font-bold text-brand-navy dark:text-brand-orange hover:opacity-80 transition-opacity flex items-center gap-2"
                  >
                    {loadingAgent === activeAgent ? <Loader2 className="animate-spin" size={16} /> : <Brain size={16} />}
                    Analisa Ulang
                  </button>
                </div>

                {insightHistory.length > 1 && (
                  <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    <h4 className="text-sm font-bold text-[#1A1A1A] dark:text-white mb-4">Riwayat Analisa</h4>
                    <div className="space-y-4">
                      {insightHistory.filter(h => h.id !== activeInsightIds[activeAgent]).map(historyItem => (
                        <div key={historyItem.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                          <div className="text-xs text-zinc-500 mb-2">
                            {new Date(historyItem.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                          <h5 className="font-bold text-sm text-[#1A1A1A] dark:text-white mb-2">{historyItem.insightData.title}</h5>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3">
                            {historyItem.insightData.content}
                          </div>
                          <button 
                            onClick={() => {
                              setInsights(prev => ({ ...prev, [activeAgent]: historyItem.insightData }));
                              setActiveInsightIds(prev => ({ ...prev, [activeAgent]: historyItem.id }));
                            }}
                            className="mt-3 text-xs font-bold text-brand-navy dark:text-brand-orange"
                          >
                            Lihat Detail
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AICoachPage;

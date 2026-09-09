import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../components/atoms/Button';
import { StatsSummary } from '../components/molecules/StatsSummary';
import { BarChart3, ChevronDown, User, Users, ShieldAlert, Download, UserPlus, FileText, Trophy, Brain } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStats, PlayerStats, TeammateStat } from '../hooks/useStats';
import { CompetitionGrade, COMPETITION_GRADE_LABELS } from '../core/config/competition';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from "jspdf";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { useToast } from '../core/contexts/ToastContext';
import { PlayerCard } from '../components/molecules/PlayerCard';
import { StatTile } from '../shared/ui/StatTile';
import { StatBar } from '../shared/ui/StatBar';
import { authService } from '../services/authService';
import { usePermissions } from '../core/contexts/PermissionsContext';
import AICoachPage from './AICoachPage';
import { motion } from 'motion/react';
import { Avatar } from '../shared/ui/Avatar';

export const StatsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryParams = new URLSearchParams(location.search);
  const profileIdFromUrl = queryParams.get('profileId');

  const tabFromUrl = queryParams.get('tab');

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(profileIdFromUrl);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [filterKU, setFilterKU] = useState<number | 'all'>('all');
  const [filterGrade, setFilterGrade] = useState<string | 'all'>('all');
  const { loading, profiles, selectedProfile, childStats, gameByGameStats, teamStats, opponentStats, allTeammateStats } = useStats(
    selectedProfileId,
    selectedSeriesId,
    filterKU === 'all' ? null : filterKU,
    filterGrade === 'all' ? null : filterGrade
  );
  
  const { can } = usePermissions();
  const [activeTab, setActiveTab] = useState<'anak' | 'rekan' | 'tim' | 'ai_coach'>('anak');

  useEffect(() => {
    if (tabFromUrl === 'aicoach') setActiveTab('ai_coach');
    else if (tabFromUrl === 'teammates' || tabFromUrl === 'rekan') setActiveTab('rekan');
    else if (tabFromUrl === 'team' || tabFromUrl === 'tim') setActiveTab('tim');
    else if (!tabFromUrl) setActiveTab('anak');
  }, [tabFromUrl]);
  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeammateId, setSelectedTeammateId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [recentInsights, setRecentInsights] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [kuSummary, setKuSummary] = useState<any[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchKuSummary = async () => {
      if (!selectedProfileId) {
        setKuSummary([]);
        return;
      }
      try {
        const { statsService } = await import('../core/services/statsService');
        const { isCountableMatch } = await import('../core/utils/matchFilters');
        const { createEmptyStats, aggregateEvent } = await import('../hooks/useStats');

        const allProfiles = await statsService.getProfiles();
        const currentProfile = allProfiles.find(p => p.id === selectedProfileId) || null;
        let profileToUse = currentProfile;
        if (!currentProfile) {
          const allPlayers = await statsService.getPlayers();
          const allTeams = await statsService.getTeams();
          const teamPlayers = allTeams.flatMap(t => t.roster || []);
          const player = allPlayers.find(p => p.id === selectedProfileId) || 
                         teamPlayers.find(p => p.id === selectedProfileId);
          if (player) {
            profileToUse = { id: player.id, name: player.name } as any;
          }
        }

        if (!profileToUse) {
          setKuSummary([]);
          return;
        }

        let matches = await statsService.getMatches();
        const allMatchRosters = await statsService.getAllMatchRosters();
        matches = matches.filter(isCountableMatch);
        const events = await statsService.getAllEvents();

        const matchingPlayerIds = new Set<string>();
        matchingPlayerIds.add(profileToUse.id);
        allMatchRosters.forEach(r => {
          if (r.id === profileToUse.id || r.profileId === profileToUse.id) {
            matchingPlayerIds.add(r.profileId);
          }
          const aliases = (profileToUse as any).voiceAliases?.map((a: string) => a.toLowerCase()) || [];
          if (r.profileId === profileToUse.id && aliases.includes(r.name.toLowerCase())) {
            matchingPlayerIds.add(r.profileId);
          }
        });

        // Group matches played by KU
        const kuGroups: Record<number | string, { matches: typeof matches, events: typeof events }> = {};

        matches.forEach(m => {
          const isParticipant = allMatchRosters.filter(r => r.matchId === m.id).some(r => matchingPlayerIds.has(r.profileId)) || 
                                events.some(e => e.matchId === m.id && matchingPlayerIds.has(e.playerId));
          if (isParticipant) {
            const mKU = m.matchKU !== undefined ? m.matchKU : (m.ageCategory !== undefined ? m.ageCategory : 'Unknown');
            if (!kuGroups[mKU]) {
              kuGroups[mKU] = { matches: [], events: [] };
            }
            kuGroups[mKU].matches.push(m);
          }
        });

        const summaryList = Object.keys(kuGroups).map(kuKey => {
          const group = kuGroups[kuKey];
          const matchIds = new Set(group.matches.map(m => m.id));
          const groupEvents = events.filter(e => matchingPlayerIds.has(e.playerId) && matchIds.has(e.matchId));
          
          const groupStats = createEmptyStats();
          groupStats.gamesPlayed = group.matches.length;
          groupEvents.forEach(e => aggregateEvent(groupStats, e));

          return {
            ku: kuKey,
            gamesPlayed: groupStats.gamesPlayed,
            pts: groupStats.gamesPlayed > 0 ? groupStats.pts / groupStats.gamesPlayed : 0,
            reb: groupStats.gamesPlayed > 0 ? groupStats.reb / groupStats.gamesPlayed : 0,
            ast: groupStats.gamesPlayed > 0 ? groupStats.ast / groupStats.gamesPlayed : 0,
          };
        }).sort((a, b) => {
          const kuA = parseInt(a.ku.toString()) || 99;
          const kuB = parseInt(b.ku.toString()) || 99;
          return kuA - kuB;
        });

        setKuSummary(summaryList);
      } catch (error) {
        console.error("Error fetching KU summary:", error);
      }
    };

    fetchKuSummary();
  }, [selectedProfileId]);

  useEffect(() => {
    const fetchData = async () => {
      const { statsService } = await import('../core/services/statsService');
      const [s, c, t, user] = await Promise.all([
        statsService.getSeriesAll(),
        statsService.getClubs(),
        statsService.getTeams(),
        authService.getCurrentUser()
      ]);
      setSeriesList(s);
      setClubs(c);
      setTeams(t);
      setCurrentUser(user);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (profileIdFromUrl && profileIdFromUrl !== selectedProfileId) {
      setSelectedProfileId(profileIdFromUrl);
    }
  }, [profileIdFromUrl]);

  useEffect(() => {
    // Reset selected teammate when tab changes
    if (activeTab !== 'rekan') {
      setSelectedTeammateId(null);
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchInsights = async () => {
      if (selectedProfileId) {
        const { statsService } = await import('../core/services/statsService');
        const insights = await statsService.getInsights(selectedProfileId);
        // Get the latest 3 insights
        setRecentInsights(insights.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3));
      } else {
        setRecentInsights([]);
      }
    };
    fetchInsights();
  }, [selectedProfileId]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedProfileId(newId);
    navigate(`/stats${newId ? `?profileId=${newId}` : ''}`, { replace: true });
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#09090b' : '#F8F9FA'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Statistik_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast('Gagal membuat PDF.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const calculateOVR = (stats: PlayerStats) => {
    if (stats.gamesPlayed === 0) return 65;
    const ppg = stats.pts / stats.gamesPlayed;
    const rpg = stats.reb / stats.gamesPlayed;
    const apg = stats.ast / stats.gamesPlayed;
    const spg = stats.stl / stats.gamesPlayed;
    const bpg = stats.blk / stats.gamesPlayed;
    const topg = stats.to / stats.gamesPlayed;
    
    let ovr = 65 + (ppg * 1.5) + (rpg * 1.2) + (apg * 1.5) + (spg * 2) + (bpg * 2) - (topg * 1.5);
    return Math.min(99, Math.max(40, Math.round(ovr)));
  };

  const determineArchetype = (stats: PlayerStats) => {
    if (stats.gamesPlayed === 0) return "Prospect";
    const ppg = stats.pts / stats.gamesPlayed;
    const rpg = stats.reb / stats.gamesPlayed;
    const apg = stats.ast / stats.gamesPlayed;
    const tpa = stats.tpa / stats.gamesPlayed;
    const spg = stats.stl / stats.gamesPlayed;
    
    if (tpa > 3 && ppg > 10) return "Sharpshooter";
    if (apg > 4 && ppg > 10) return "Playmaking Shot Creator";
    if (rpg > 8 && ppg > 10) return "Glass-Cleaning Finisher";
    if (spg > 2) return "2-Way Lockdown Defender";
    if (apg > 5) return "Floor General";
    if (ppg > 15) return "Scoring Machine";
    if (rpg > 8) return "Paint Beast";
    return "All-Around Threat";
  };

  const getBadges = (stats: PlayerStats) => {
    const badges = [];
    if (stats.gamesPlayed === 0) return badges;
    const ppg = stats.pts / stats.gamesPlayed;
    const rpg = stats.reb / stats.gamesPlayed;
    const apg = stats.ast / stats.gamesPlayed;
    const spg = stats.stl / stats.gamesPlayed;
    const bpg = stats.blk / stats.gamesPlayed;
    
    if (ppg >= 15) badges.push({ name: 'Volume Shooter', color: 'bg-purple-500' });
    if (rpg >= 8) badges.push({ name: 'Rebound Chaser', color: 'bg-blue-500' });
    if (apg >= 5) badges.push({ name: 'Dimer', color: 'bg-yellow-500' });
    if (spg >= 2) badges.push({ name: 'Pick Pocket', color: 'bg-red-500' });
    if (bpg >= 1.5) badges.push({ name: 'Rim Protector', color: 'bg-zinc-800' });
    if (stats.tpm > 0 && (stats.tpm / stats.tpa) >= 0.4) badges.push({ name: 'Catch & Shoot', color: 'bg-green-500' });
    
    return badges;
  };

  const renderPlayerCard = (profile: any, stats: PlayerStats) => {
    const ovr = calculateOVR(stats);
    const archetype = determineArchetype(stats);
    return (
      <PlayerCard 
        name={profile.name}
        displayName={profile.displayName || profile.name}
        photoUrl={profile.photoUrl}
        avatar={profile.avatar}
        ovr={ovr}
        archetype={archetype}
        stats={{
          gamesPlayed: stats.gamesPlayed,
          pts: stats.gamesPlayed > 0 ? stats.pts / stats.gamesPlayed : 0,
          reb: stats.gamesPlayed > 0 ? stats.reb / stats.gamesPlayed : 0,
          ast: stats.gamesPlayed > 0 ? stats.ast / stats.gamesPlayed : 0
        }}
        variant="dark"
      />
    );
  };

  const getTooltipForStat = (title: string) => {
    if (title === 'TS%') return "True Shooting %: Mengukur efisiensi tembakan dengan memperhitungkan 2PT, 3PT, dan Free Throw.";
    if (title === 'eFG%') return "Effective Field Goal %: Mengukur efisiensi tembakan dengan memberi nilai lebih pada 3PT.";
    if (title === 'TO') return "Turnovers: Kehilangan penguasaan bola.";
    if (title === 'PF') return "Personal Fouls: Pelanggaran individu.";
    return undefined;
  };

  const renderStatsSection = (title: string, icon: React.ReactNode, stats: PlayerStats | null) => {
    if (!stats) return null;

    const fgPct = stats.fga > 0 ? ((stats.fgm / stats.fga) * 100).toFixed(1) : '0.0';
    const tpPct = stats.tpa > 0 ? ((stats.tpm / stats.tpa) * 100).toFixed(1) : '0.0';
    const ftPct = stats.fta > 0 ? ((stats.ftm / stats.fta) * 100).toFixed(1) : '0.0';
    
    const tsAttempts = stats.fga + 0.44 * stats.fta;
    const tsPct = tsAttempts > 0 ? ((stats.pts / (2 * tsAttempts)) * 100).toFixed(1) : '0.0';

    const efgPct = stats.fga > 0 ? (((stats.fgm + 0.5 * stats.tpm) / stats.fga) * 100).toFixed(1) : '0.0';
    const pg = Math.max(1, stats.gamesPlayed);

    return (
      <section className="mb-8 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-brand-orange">
            {icon}
          </div>
          <h2 className="text-lg font-display font-black text-brand-navy dark:text-white uppercase tracking-tight">{title}</h2>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatTile label="PTS" value={stats.pts} subValue={`${(stats.pts / pg).toFixed(1)}/G`} />
          <StatTile label="REB" value={stats.reb} subValue={`${(stats.reb / pg).toFixed(1)}/G`} />
          <StatTile label="AST" value={stats.ast} subValue={`${(stats.ast / pg).toFixed(1)}/G`} />
          <StatTile label="OREB" value={stats.oreb} subValue={`${(stats.oreb / pg).toFixed(1)}/G`} />
          <StatTile label="DREB" value={stats.dreb} subValue={`${(stats.dreb / pg).toFixed(1)}/G`} />
          <StatTile label="STL" value={stats.stl} subValue={`${(stats.stl / pg).toFixed(1)}/G`} />
          <StatTile label="BLK" value={stats.blk} subValue={`${(stats.blk / pg).toFixed(1)}/G`} />
          <StatTile label="TO" value={stats.to} subValue={`${(stats.to / pg).toFixed(1)}/G`} tooltip={getTooltipForStat('TO')} />
          <StatTile label="PF" value={stats.fouls} subValue={`${(stats.fouls / pg).toFixed(1)}/G`} tooltip={getTooltipForStat('PF')} />
          <StatTile label="GP" value={stats.gamesPlayed} subValue="Main" />
          <StatTile label="TS%" value={`${tsPct}%`} tooltip={getTooltipForStat('TS%')} />
          <StatTile label="EFG%" value={`${efgPct}%`} tooltip={getTooltipForStat('eFG%')} />
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm">
          <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Shooting Splits</h3>
          <div className="space-y-4">
            <StatBar label="FG" percentage={fgPct} fraction={`(${stats.fgm}/${stats.fga})`} />
            <StatBar label="3PT" percentage={tpPct} fraction={`(${stats.tpm}/${stats.tpa})`} />
            <StatBar label="FT" percentage={ftPct} fraction={`(${stats.ftm}/${stats.fta})`} />
          </div>
        </div>
      </section>
    );
  };

  const renderPerformancePerCategory = () => {
    if (kuSummary.length === 0) return null;
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5 shadow-sm mb-6">
        <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-brand-navy dark:text-brand-orange" />
          Performa per Kategori (KU)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">
                <th className="py-2">Kategori</th>
                <th className="py-2 text-center">Main</th>
                <th className="py-2 text-right">PTS (Avg)</th>
                <th className="py-2 text-right">REB (Avg)</th>
                <th className="py-2 text-right">AST (Avg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {kuSummary.map((item) => (
                <tr key={item.ku} className="text-[#1A1A1A] dark:text-white font-medium">
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-zinc-800 text-brand-navy dark:text-brand-orange font-bold text-[11px]">
                      {item.ku === 'Unknown' ? 'Unknown' : `KU-${item.ku}`}
                    </span>
                  </td>
                  <td className="py-2.5 text-center font-bold text-zinc-600 dark:text-zinc-400">
                    {item.gamesPlayed} game
                  </td>
                  <td className="py-2.5 text-right font-bold text-brand-navy dark:text-brand-orange">
                    {item.pts.toFixed(1)}
                  </td>
                  <td className="py-2.5 text-right text-zinc-600 dark:text-zinc-400">
                    {item.reb.toFixed(1)}
                  </td>
                  <td className="py-2.5 text-right text-zinc-600 dark:text-zinc-400">
                    {item.ast.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTrendChart = () => {
    if (!gameByGameStats || gameByGameStats.length < 2) return null;

    const isCustomer = currentUser?.role === 'customer' || !currentUser;

    return (
      <div className="mb-8 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm h-full">
        <h3 className="text-sm font-display font-black text-[#1A1A1A] dark:text-white uppercase tracking-wider mb-4">Grafik Tren Pertandingan</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={gameByGameStats} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis dataKey="gameLabel" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                labelStyle={{ fontWeight: 'bold', color: '#18181b', marginBottom: '4px' }}
              />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line type="monotone" dataKey="pts" name="PTS" stroke="var(--color-brand-orange)" strokeWidth={3} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="reb" name="REB" stroke="#FFB74D" strokeWidth={3} />
              <Line type="monotone" dataKey="ast" name="AST" stroke="#B23B15" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {isCustomer && (
          <div 
            className="mt-6 p-4 bg-[#0B1E36] border border-brand-orange/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-white shadow-md relative overflow-hidden"
            data-html2canvas-ignore
          >
            <div className="flex items-center gap-3 relative z-10 text-left">
              <Trophy className="text-brand-orange shrink-0" size={20} />
              <p className="text-sm font-semibold leading-relaxed">
                Ingin analisa lebih dalam dari coach bersertifikat?
              </p>
            </div>
            <button
              onClick={() => navigate('/services')}
              className="px-6 py-2.5 bg-brand-orange hover:bg-brand-orange/90 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all duration-200 active:scale-95 shrink-0 cursor-pointer shadow-sm relative z-10"
            >
              Pelajari
            </button>
            {/* Soft decorative background element */}
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-5 pointer-events-none">
              <Trophy size={100} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTeammatesList = () => {
    if (!allTeammateStats || allTeammateStats.length === 0) {
      return (
        <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm mt-4">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 dark:text-zinc-500">
            <Users size={32} />
          </div>
          <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-2">Belum Ada Rekan Setim</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Tambahkan pemain lain saat mencatat pertandingan (Team Mode) untuk melihat statistiknya di sini.</p>
        </div>
      );
    }

    if (selectedTeammateId) {
      const tm = allTeammateStats.find(t => t.id === selectedTeammateId);
      if (!tm) return null;
      
      return (
        <div className="animate-in fade-in slide-in-from-right-2 duration-300">
          <button 
            onClick={() => setSelectedTeammateId(null)}
            className="mb-4 text-sm font-bold text-brand-navy dark:text-brand-orange flex items-center gap-1 hover:underline"
            data-html2canvas-ignore
          >
            ← Kembali ke Daftar
          </button>
          {renderPlayerCard({ name: tm.name, photoUrl: '' }, tm)}
          {renderStatsSection(`Detail Statistik: ${tm.name}`, <User size={20} strokeWidth={2.5} />, tm)}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {allTeammateStats.map((tm) => (
          <div 
            key={tm.id}
            onClick={() => setSelectedTeammateId(tm.id)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-[1rem] p-5 flex items-start sm:items-center justify-between cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <Avatar name={tm.name} size="lg" className="border-[3px] border-brand-orange mx-auto sm:mx-0 shadow-sm" />

              <div className="flex flex-col gap-3">
                {/* Name & Badge */}
                <div className="flex items-center gap-3 justify-center sm:justify-start flex-wrap">
                  <h3 className="font-display font-black text-[#1A1A1A] dark:text-white uppercase tracking-wide text-lg sm:text-xl leading-none">
                    {tm.name}
                  </h3>
                  {tm.isChild && (
                    <span className="bg-[#0B1E36] dark:bg-brand-orange text-white dark:text-brand-navy text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full whitespace-nowrap">
                      Profil Anda
                    </span>
                  )}
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-6 sm:gap-8 justify-center sm:justify-start">
                  <div className="text-center">
                    <div className="text-[#1A1A1A] dark:text-white font-black text-lg leading-none">{tm.pts}</div>
                    <div className="text-zinc-500 font-bold text-[10px] uppercase mt-1">PTS</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#1A1A1A] dark:text-white font-black text-lg leading-none">{(tm.reb / Math.max(1, tm.gamesPlayed)).toFixed(1)}</div>
                    <div className="text-zinc-500 font-bold text-[10px] uppercase mt-1">REB</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#1A1A1A] dark:text-white font-black text-lg leading-none">{(tm.ast / Math.max(1, tm.gamesPlayed)).toFixed(1)}</div>
                    <div className="text-zinc-500 font-bold text-[10px] uppercase mt-1">AST</div>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="text-[#1A1A1A] dark:text-white font-black text-lg leading-none">{(tm.stl / Math.max(1, tm.gamesPlayed)).toFixed(1)}</div>
                    <div className="text-zinc-500 font-bold text-[10px] uppercase mt-1">STL</div>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="text-[#1A1A1A] dark:text-white font-black text-lg leading-none">{(tm.blk / Math.max(1, tm.gamesPlayed)).toFixed(1)}</div>
                    <div className="text-zinc-500 font-bold text-[10px] uppercase mt-1">BLK</div>
                  </div>
                </div>
              </div>
            </div>

            {/* OVR Badge */}
            <div className="flex items-center gap-2 self-start sm:self-auto ml-auto pl-4">
              <span className="font-bold text-[#1A1A1A] dark:text-white text-xs sm:text-sm tracking-wider">OVR</span>
              <div className="bg-brand-orange text-white font-black text-base sm:text-lg px-2.5 sm:px-3 py-1 rounded-lg">
                {calculateOVR(tm)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 pb-24 transition-colors font-sans"
    >
      <header className="flex justify-between items-center p-4 bg-white dark:bg-zinc-950 sticky top-0 z-30 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-display font-black text-[#1A1A1A] dark:text-white uppercase tracking-tight">Statistik</h1>
          <div className="text-zinc-400">
            <FileText size={20} strokeWidth={2.5} />
          </div>
        </div>
        <button 
          onClick={handleExportPDF}
          disabled={isExporting || loading}
          className="flex items-center gap-2 px-4 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {isExporting ? (
            <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download size={16} />
          )}
          PDF
        </button>
      </header>
      
      {/* Tab Navigation */}
      <div className="flex bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 sticky top-[65px] z-20">
        <button
          onClick={() => setActiveTab('anak')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'anak' 
              ? 'text-[#1A1A1A] dark:text-white border-brand-orange' 
              : 'text-zinc-400 border-transparent hover:text-zinc-600 dark:hover:text-zinc-300'
          }`}
        >
          Profil Atlet
        </button>
        <button
          onClick={() => setActiveTab('rekan')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'rekan' 
              ? 'text-[#1A1A1A] dark:text-white border-brand-orange' 
              : 'text-zinc-400 border-transparent hover:text-zinc-600 dark:hover:text-zinc-300'
          }`}
        >
          Rekan Setim
        </button>
        <button
          onClick={() => setActiveTab('tim')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'tim' 
              ? 'text-[#1A1A1A] dark:text-white border-brand-orange' 
              : 'text-zinc-400 border-transparent hover:text-zinc-600 dark:hover:text-zinc-300'
          }`}
        >
          Tim
        </button>
        {can('view_own_stats') && (
          <button
            onClick={() => setActiveTab('ai_coach')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'ai_coach' 
                ? 'text-[#1A1A1A] dark:text-white border-brand-orange' 
                : 'text-zinc-400 border-transparent hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            <Brain size={14} className="text-brand-orange shrink-0" />
            AI Coach
          </button>
        )}
      </div>

      <main className="p-4 mt-2" ref={printRef}>
        {loading ? (
          <div className="space-y-6 animate-pulse">
            {/* Player Card Skeleton */}
            <div className="bg-zinc-200/50 dark:bg-zinc-800/50 p-5 rounded-2xl h-44 w-full flex flex-col justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="h-6 bg-zinc-300 dark:bg-zinc-700 rounded w-1/3" />
                  <div className="h-4 bg-zinc-300 dark:bg-zinc-700 rounded w-1/2" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 bg-zinc-300 dark:bg-zinc-700 rounded w-16" />
                <div className="h-8 bg-zinc-300 dark:bg-zinc-700 rounded w-16" />
              </div>
            </div>
            {/* Stats Summary Skeleton */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-200/50 dark:bg-zinc-800/50 p-4 rounded-2xl h-24" />
              <div className="bg-zinc-200/50 dark:bg-zinc-800/50 p-4 rounded-2xl h-24" />
              <div className="bg-zinc-200/50 dark:bg-zinc-800/50 p-4 rounded-2xl h-24" />
            </div>
            {/* Chart Skeleton */}
            <div className="bg-zinc-200/50 dark:bg-zinc-800/50 p-6 rounded-2xl h-64 w-full flex flex-col justify-between">
              <div className="h-4 bg-zinc-300 dark:bg-zinc-700 rounded w-1/4 mb-4" />
              <div className="h-44 bg-zinc-300/30 dark:bg-zinc-700/30 rounded w-full" />
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'anak' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {selectedProfile && childStats ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
                    
                    {/* Left Column: Filters and Player Card */}
                    <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-[120px]" data-html2canvas-ignore={false}>
                      {/* Filters Container */}
                      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm space-y-4" data-html2canvas-ignore>
                        <h3 className="text-sm font-display font-black text-[#1A1A1A] dark:text-white uppercase tracking-wider mb-2">Filter Statistik</h3>
                        
                        {profiles.length > 0 && (
                          <div>
                            <label className="block text-[10px] font-black text-[#1A1A1A] dark:text-zinc-400 uppercase tracking-widest mb-1">
                              Pilih Profil Atlet
                            </label>
                            <div className="relative">
                              <select
                                value={selectedProfileId || ''}
                                onChange={handleProfileChange}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-orange transition-all appearance-none shadow-sm"
                              >
                                <option value="">-- Pilih Atlet --</option>
                                {profiles.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-[10px] font-black text-[#1A1A1A] dark:text-zinc-400 uppercase tracking-widest mb-1">
                            Filter Series
                          </label>
                          <div className="relative">
                            <select
                              value={selectedSeriesId || ''}
                              onChange={(e) => setSelectedSeriesId(e.target.value || null)}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-orange transition-all appearance-none shadow-sm"
                            >
                              <option value="">-- Semua Pertandingan --</option>
                              {seriesList.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-[#1A1A1A] dark:text-zinc-400 uppercase tracking-widest mb-1">
                            Kategori Umur (KU)
                          </label>
                          <div className="relative">
                            <select
                              value={filterKU}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFilterKU(val === 'all' ? 'all' : parseInt(val));
                              }}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-orange transition-all appearance-none shadow-sm"
                            >
                              <option value="all">-- Semua KU --</option>
                              <option value="8">KU-8</option>
                              <option value="10">KU-10</option>
                              <option value="12">KU-12</option>
                              <option value="14">KU-14</option>
                              <option value="16">KU-16</option>
                              <option value="18">KU-18</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-[#1A1A1A] dark:text-zinc-400 uppercase tracking-widest mb-1">
                            Level Kompetisi
                          </label>
                          <div className="relative">
                            <select
                              value={filterGrade}
                              onChange={(e) => setFilterGrade(e.target.value)}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-orange transition-all appearance-none shadow-sm"
                            >
                              <option value="all">-- Semua Level --</option>
                              {Object.values(CompetitionGrade).map(grade => (
                                <option key={grade} value={grade}>{COMPETITION_GRADE_LABELS[grade]}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      {renderPlayerCard(selectedProfile, childStats)}
                    </div>

                    {/* Main Content Column */}
                    <div className="lg:col-span-9 space-y-6">
                      {/* Detail Statistik Card */}
                      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm">
                        <h2 className="text-sm font-display font-black text-[#1A1A1A] dark:text-white uppercase tracking-wider mb-4">Detail Statistik</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {(() => {
                            const tsAttempts = childStats.fga + 0.44 * childStats.fta;
                            const tsPct = tsAttempts > 0 ? ((childStats.pts / (2 * tsAttempts)) * 105).toFixed(1) : '0.0'; // scaling factor or direct math
                            const efgPct = childStats.fga > 0 ? (((childStats.fgm + 0.5 * childStats.tpm) / childStats.fga) * 100).toFixed(1) : '0.0';
                            const pg = Math.max(1, childStats.gamesPlayed);
                            return (
                              <>
                                <StatTile label="PTS" value={childStats.pts} subValue={`${(childStats.pts / pg).toFixed(1)}/G`} />
                                <StatTile label="REB" value={childStats.reb} subValue={`${(childStats.reb / pg).toFixed(1)}/G`} />
                                <StatTile label="AST" value={childStats.ast} subValue={`${(childStats.ast / pg).toFixed(1)}/G`} />
                                <StatTile label="OREB" value={childStats.oreb} subValue={`${(childStats.oreb / pg).toFixed(1)}/G`} />
                                <StatTile label="DREB" value={childStats.dreb} subValue={`${(childStats.dreb / pg).toFixed(1)}/G`} />
                                <StatTile label="STL" value={childStats.stl} subValue={`${(childStats.stl / pg).toFixed(1)}/G`} />
                                <StatTile label="BLK" value={childStats.blk} subValue={`${(childStats.blk / pg).toFixed(1)}/G`} />
                                <StatTile label="TO" value={childStats.to} subValue={`${(childStats.to / pg).toFixed(1)}/G`} tooltip={getTooltipForStat('TO')} />
                                <StatTile label="PF" value={childStats.fouls} subValue={`${(childStats.fouls / pg).toFixed(1)}/G`} tooltip={getTooltipForStat('PF')} />
                                <StatTile label="GP" value={childStats.gamesPlayed} subValue="Main" />
                                <StatTile label="TS%" value={`${tsPct}%`} tooltip={getTooltipForStat('TS%')} />
                                <StatTile label="EFG%" value={`${efgPct}%`} tooltip={getTooltipForStat('eFG%')} />
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Shooting Splits Card */}
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm space-y-4">
                          <h2 className="text-sm font-display font-black text-[#1A1A1A] dark:text-white uppercase tracking-wider">Shooting Splits</h2>
                          <div className="space-y-4">
                            {(() => {
                              const fgPct = childStats.fga > 0 ? ((childStats.fgm / childStats.fga) * 100).toFixed(1) : '0.0';
                              const tpPct = childStats.tpa > 0 ? ((childStats.tpm / childStats.tpa) * 100).toFixed(1) : '0.0';
                              const ftPct = childStats.fta > 0 ? ((childStats.ftm / childStats.fta) * 100).toFixed(1) : '0.0';
                              return (
                                <>
                                  <StatBar label="FG" percentage={fgPct} fraction={`(${childStats.fgm}/${childStats.fga})`} />
                                  <StatBar label="3PT" percentage={tpPct} fraction={`(${childStats.tpm}/${childStats.tpa})`} />
                                  <StatBar label="FT" percentage={ftPct} fraction={`(${childStats.ftm}/${childStats.fta})`} />
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Grafik Tren Pertandingan Card */}
                        {renderTrendChart()}
                      </div>

                      {/* Performa per Kategori */}
                      {renderPerformancePerCategory()}

                      {/* AI Insights */}
                      {recentInsights.length > 0 && (
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-display font-black text-brand-navy dark:text-white uppercase tracking-wider">Wawasan AI Terbaru</h4>
                            <button 
                              onClick={() => navigate('/ai-coach')}
                              className="text-xs font-bold text-brand-orange hover:underline uppercase tracking-wider"
                            >
                              Lihat Semua
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {recentInsights.map(insight => (
                              <div key={insight.id} className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200/30 dark:border-zinc-800/30">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-brand-orange/10 text-brand-orange rounded">
                                    {insight.role === 'skill_coach' ? 'Skill Coach' : 
                                     insight.role === 'shot_analyst' ? 'Shot Analyst' : 
                                     insight.role === 'progress_analyst' ? 'Progress Analyst' : insight.role}
                                  </span>
                                  <span className="text-xs text-zinc-500">
                                    {new Date(insight.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                  </span>
                                </div>
                                <h5 className="font-bold text-sm text-[#1A1A1A] dark:text-white mb-2">{insight.insightData.title}</h5>
                                <div className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3">
                                  {insight.insightData.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                ) : (
                  <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm mt-4">
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 dark:text-zinc-500">
                      <BarChart3 size={32} />
                    </div>
                    <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-2">Belum Ada Statistik</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Pilih profil atlet atau rekam pertandingan terlebih dahulu untuk melihat statistik lengkap di sini.</p>
                    <button onClick={() => navigate('/games')} className="px-5 py-2.5 bg-brand-orange text-white font-bold rounded-xl text-xs uppercase tracking-wider">
                      KE PERTANDINGAN
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'rekan' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start">
                  
                  {/* Left Column: Teammate Filters */}
                  <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-[120px]" data-html2canvas-ignore={false}>
                    <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4" data-html2canvas-ignore>
                      <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Filter Rekan Setim</h3>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                          Filter Series
                        </label>
                        <div className="relative">
                          <select
                            value={selectedSeriesId || ''}
                            onChange={(e) => setSelectedSeriesId(e.target.value || null)}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all appearance-none shadow-sm"
                          >
                            <option value="">-- Semua Pertandingan --</option>
                            {seriesList.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {selectedSeriesId && seriesList.find(s => s.id === selectedSeriesId) && (
                      <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center gap-4 shadow-sm">
                        {seriesList.find(s => s.id === selectedSeriesId).logoUrl ? (
                          <img src={seriesList.find(s => s.id === selectedSeriesId).logoUrl} alt="Series Logo" className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                            <BarChart3 size={24} />
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-sm text-[#1A1A1A] dark:text-white">{seriesList.find(s => s.id === selectedSeriesId).name}</h3>
                          <p className="text-xs text-zinc-500">Statistik khusus series ini</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Teammates List */}
                  <div className="lg:col-span-8">
                    {renderTeammatesList()}
                  </div>

                </div>
              </div>
            )}

            {activeTab === 'tim' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start">
                  
                  {/* Left Column: Team Filters */}
                  <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-[120px]" data-html2canvas-ignore={false}>
                    <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4" data-html2canvas-ignore>
                      <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Filter Tim</h3>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                          Filter Series
                        </label>
                        <div className="relative">
                          <select
                            value={selectedSeriesId || ''}
                            onChange={(e) => setSelectedSeriesId(e.target.value || null)}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all appearance-none shadow-sm"
                          >
                            <option value="">-- Semua Pertandingan --</option>
                            {seriesList.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {selectedSeriesId && seriesList.find(s => s.id === selectedSeriesId) && (
                      <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center gap-4 shadow-sm">
                        {seriesList.find(s => s.id === selectedSeriesId).logoUrl ? (
                          <img src={seriesList.find(s => s.id === selectedSeriesId).logoUrl} alt="Series Logo" className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                            <BarChart3 size={24} />
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-sm text-[#1A1A1A] dark:text-white">{seriesList.find(s => s.id === selectedSeriesId).name}</h3>
                          <p className="text-xs text-zinc-500">Statistik khusus series ini</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Team Stats Details */}
                  <div className="lg:col-span-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {teamStats && renderStatsSection('Overall Tim Kita', <Users size={20} strokeWidth={2.5} />, teamStats)}
                      {opponentStats && renderStatsSection('Overall Tim Lawan', <ShieldAlert size={20} strokeWidth={2.5} />, opponentStats)}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {activeTab === 'ai_coach' && can('view_own_stats') && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <AICoachPage />
              </div>
            )}
          </>
        )}
      </main>
    </motion.div>
  );
};

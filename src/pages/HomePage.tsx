import React, { useState, useEffect } from 'react';
import { Trophy, Settings, Moon, Sun, Calendar, MapPin, ChevronRight, ShoppingBag, User, LogOut, ArrowUpRight, ArrowDownRight, UserPlus, FolderOpen, Users, ClipboardList, Minus, Check, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { PlayerCard } from '../components/molecules/PlayerCard';
import { StatsSummary } from '../components/molecules/StatsSummary';
import { GameCard } from '../components/molecules/GameCard';
import { FloatingActionButton } from '../components/atoms/FloatingActionButton';
import { Button } from '../components/atoms/Button';
import { GameSetupModal } from '../components/organisms/GameSetupModal';
import { statsService } from '../core/services/statsService';
import { authService } from '../services/authService';
import { Match, Player, ChildProfile } from '../core/types/stats';
import { isCountableMatch } from '../core/utils/matchFilters';
import { useTheme } from '../core/hooks/useTheme';
import { Card } from '../components/atoms/Card';
import { BaseModal } from '../components/atoms/BaseModal';
import { usePermissions } from '../core/contexts/PermissionsContext';
import { Avatar } from '../shared/ui/Avatar';
import { CountUp } from '../shared/ui/CountUp';
import { HighlightCarousel } from '../features/home-highlights/ui/HighlightCarousel';
import { initDB } from '../lib/db';
import { filterViewableMatches } from '../features/access-control/model/matchAccess';

export const HomePage: React.FC = () => {
  const { can, user } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [ahaMatch, setAhaMatch] = useState<Match | null>(null);

  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [featuredProfile, setFeaturedProfile] = useState<ChildProfile | null>(null);
  const [hasProfiles, setHasProfiles] = useState(true); // Default true to avoid flash
  const [hasTeams, setHasTeams] = useState(true); // Default true to avoid flash
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [allMatchRosters, setAllMatchRosters] = useState<any[]>([]);
  const [statsTrend, setStatsTrend] = useState<{
    pts: { recent: number; prev: number; diff: number; status: 'naik' | 'turun' | 'stabil' };
    reb: { recent: number; prev: number; diff: number; status: 'naik' | 'turun' | 'stabil' };
    ast: { recent: number; prev: number; diff: number; status: 'naik' | 'turun' | 'stabil' };
    fg: { recent: number; prev: number; diff: number; status: 'naik' | 'turun' | 'stabil' };
    gamesCount: number;
  } | null>(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    setIsLogoutConfirmOpen(true);
  };

  const confirmLogout = async () => {
    setIsLogoutConfirmOpen(false);
    await authService.logout();
    window.location.assign('/');
  };

  const calculateTrendForProfile = (profileId: string, activeMatches: Match[], eventsList: any[], rostersList: any[], pList: ChildProfile[]) => {
    const profile = pList.find(p => p.id === profileId);
    if (!profile) {
      setStatsTrend(null);
      return;
    }

    const matchingPlayerIds = new Set<string>();
    matchingPlayerIds.add(profile.id);
    rostersList.forEach(r => {
      if (r.id === profile.id || r.profileId === profile.id) {
        matchingPlayerIds.add(r.profileId);
      }
      const aliases = profile.voiceAliases?.map(a => a.toLowerCase()) || [];
      if (r.profileId === profile.id && aliases.includes(r.name.toLowerCase())) {
        matchingPlayerIds.add(r.profileId);
      }
    });

    const countableMatches = activeMatches.filter(isCountableMatch);
    const playerMatches = countableMatches.filter(match => {
      const rosters = rostersList.filter(r => r.matchId === match.id);
      return rosters.some(r => matchingPlayerIds.has(r.profileId));
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (playerMatches.length >= 2) {
      const gamesCount = Math.min(5, Math.floor(playerMatches.length / 2) || 1);
      const recentMatches = playerMatches.slice(-gamesCount);
      const prevMatches = playerMatches.slice(-gamesCount * 2, -gamesCount);

      if (recentMatches.length > 0 && prevMatches.length > 0) {
        const getStats = (matchesArr: Match[]) => {
          const matchIds = new Set(matchesArr.map(x => x.id));
          const events = eventsList.filter(e => matchIds.has(e.matchId) && matchingPlayerIds.has(e.playerId));
          
          const pts = events.reduce((sum, e) => sum + (e.points || 0), 0) / matchesArr.length;
          
          const fga = events.filter(e => ['2pt_make', '3pt_make'].includes(e.type) || (['2pt_miss', '3pt_miss'].includes(e.type) && !e.isShootingFoul)).length;
          const fgm = events.filter(e => ['2pt_make', '3pt_make'].includes(e.type)).length;
          const fg = fga > 0 ? (fgm / fga) * 100 : 0;

          const ast = events.filter(e => e.type === 'ast').length / matchesArr.length;
          const reb = events.filter(e => ['oreb', 'dreb'].includes(e.type)).length / matchesArr.length;

          return { pts, fg, ast, reb };
        };

        const recentStats = getStats(recentMatches);
        const prevStats = getStats(prevMatches);

        const ptsDiff = recentStats.pts - prevStats.pts;
        const ptsStatus = Math.abs(ptsDiff) < 0.05 ? 'stabil' : (ptsDiff > 0 ? 'naik' : 'turun');

        const fgDiff = recentStats.fg - prevStats.fg;
        const fgStatus = Math.abs(fgDiff) < 0.05 ? 'stabil' : (fgDiff > 0 ? 'naik' : 'turun');

        const astDiff = recentStats.ast - prevStats.ast;
        const astStatus = Math.abs(astDiff) < 0.05 ? 'stabil' : (astDiff > 0 ? 'naik' : 'turun');

        const rebDiff = recentStats.reb - prevStats.reb;
        const rebStatus = Math.abs(rebDiff) < 0.05 ? 'stabil' : (rebDiff > 0 ? 'naik' : 'turun');

        setStatsTrend({
          pts: { recent: recentStats.pts, prev: prevStats.pts, diff: Math.abs(ptsDiff), status: ptsStatus },
          reb: { recent: recentStats.reb, prev: prevStats.reb, diff: Math.abs(rebDiff), status: rebStatus },
          ast: { recent: recentStats.ast, prev: prevStats.ast, diff: Math.abs(astDiff), status: astStatus },
          fg: { recent: recentStats.fg, prev: prevStats.fg, diff: Math.abs(fgDiff), status: fgStatus },
          gamesCount: recentMatches.length
        });
      } else {
        setStatsTrend(null);
      }
    } else {
      setStatsTrend(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);

      const m = await statsService.getMatches();
      const pList = await statsService.getProfiles();
      const evs = await statsService.getAllEvents();
      const rst = await statsService.getAllMatchRosters();
      const db = await initDB();
      const payments = await db.getAll('payments');
      const activeMatches = filterViewableMatches(
        user,
        m.filter((match) => match.status !== 'aborted'),
        pList,
        rst,
        payments
      );
      setMatches(activeMatches);
      setProfiles(pList);
      setHasProfiles(pList.length > 0);

      const teams = await statsService.getTeams();
      setHasTeams(teams.length > 0);
      setAllEvents(evs);
      setAllMatchRosters(rst);

      if (pList.length > 0) {
        // Use existing selectedProfileId, or default to first profile
        let currentProfileId = selectedProfileId;
        if (!currentProfileId || !pList.some(p => p.id === currentProfileId)) {
          currentProfileId = pList[0].id;
          setSelectedProfileId(pList[0].id);
        }
        
        const currentProfile = pList.find(p => p.id === currentProfileId) || pList[0];
        setFeaturedProfile(currentProfile);
        
        calculateTrendForProfile(currentProfile.id, activeMatches, evs, rst, pList);
      } else {
        setFeaturedProfile(null);
        setStatsTrend(null);
      }
    } catch (err) {
      console.error('Error loading homepage data', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-calculate trend when selected profile changes
  useEffect(() => {
    if (selectedProfileId && matches.length > 0 && allEvents.length > 0) {
      const currentProfile = profiles.find(p => p.id === selectedProfileId);
      if (currentProfile) {
        setFeaturedProfile(currentProfile);
        calculateTrendForProfile(selectedProfileId, matches, allEvents, allMatchRosters, profiles);
      }
    }
  }, [selectedProfileId, matches, allEvents, allMatchRosters, profiles]);

  // Refresh matches when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      loadData();
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (matches.length > 0) {
      const matchToShow = matches.find(m => {
        const isCompleted = m.status === 'completed' || m.productionStage === 'published';
        const alreadyShown = localStorage.getItem(`hoopstats_aha_${m.id}`) === 'true';
        
        let belongsToUser = true;
        if (profiles.length > 0 && allMatchRosters.length > 0) {
          belongsToUser = allMatchRosters.some(r => r.matchId === m.id && profiles.some(p => p.id === r.profileId));
        }
        
        return isCompleted && belongsToUser && !alreadyShown;
      });
      if (matchToShow) {
        setAhaMatch(matchToShow);
      }
    }
  }, [matches, profiles, allMatchRosters]);

  const getChildIdForMatch = (matchId: string) => {
    const rosterEntry = allMatchRosters.find(r => r.matchId === matchId && profiles.some(p => p.id === r.profileId));
    return rosterEntry ? rosterEntry.profileId : (profiles[0]?.id || '');
  };

  const handleCloseAhaModal = () => {
    if (ahaMatch) {
      localStorage.setItem(`hoopstats_aha_${ahaMatch.id}`, 'true');
    }
    setAhaMatch(null);
  };

  const latestMatch = matches.length > 0 ? matches[matches.length - 1] : null;

  // Visual skeleton reflecting true layout dimensions and hierarchy
  const HomeSkeleton = () => (
    <div className="space-y-8 animate-pulse">
      {/* Progress card skeleton */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-100 dark:border-zinc-800 h-64 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-3.5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-8 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>
        <div className="flex gap-4">
          <div className="h-20 bg-zinc-150 dark:bg-zinc-800/80 rounded-2xl flex-1" />
          <div className="h-20 bg-zinc-150 dark:bg-zinc-800/80 rounded-2xl flex-1" />
        </div>
      </div>
      
      {/* Latest match card skeleton */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden h-96 space-y-4">
        <div className="h-48 bg-zinc-200 dark:bg-zinc-800" />
        <div className="p-5 space-y-4">
          <div className="h-6 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-10 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        </div>
      </div>
    </div>
  );

  const calculateMatchScore = (matchId: string) => {
    const homeTeamId = 'home_team';
    const awayTeamId = 'away_team';
    
    const events = allEvents.filter(e => e.matchId === matchId);
    const rosters = allMatchRosters.filter(r => r.matchId === matchId);
    
    let homeScore = 0;
    let awayScore = 0;
    
    events.forEach(e => {
      const isHome = rosters.some(r => r.teamId === homeTeamId && r.profileId === e.playerId) || e.playerId === 'home_team';
      const isAway = rosters.some(r => r.teamId === awayTeamId && r.profileId === e.playerId) || e.playerId === 'opp' || e.playerId === 'away_team';
      
      const pts = e.type === '1pt_make' ? 1 : e.type === '2pt_make' ? 2 : e.type === '3pt_make' ? 3 : 0;
      if (isHome) homeScore += pts;
      else if (isAway) awayScore += pts;
    });
    
    return { homeScore, awayScore };
  };

  const getProfileTrendData = () => {
    if (!featuredProfile || matches.length === 0) return [];
    
    // Find matches where the profile participated
    const profileMatches = matches.filter(m => {
      const rosters = allMatchRosters.filter(r => r.matchId === m.id);
      const events = allEvents.filter(e => e.matchId === m.id);
      const matchingPlayerIds = new Set([featuredProfile.id]);
      rosters.forEach(r => {
        if (r.id === featuredProfile.id || r.profileId === featuredProfile.id) {
          matchingPlayerIds.add(r.profileId);
        }
      });
      return rosters.some(r => matchingPlayerIds.has(r.profileId)) || events.some(e => matchingPlayerIds.has(e.playerId));
    });

    // Calculate points for each match
    const trend = profileMatches.map((m, idx) => {
      const events = allEvents.filter(e => e.matchId === m.id && (e.playerId === featuredProfile.id || allMatchRosters.filter(r => r.matchId === m.id && r.profileId === featuredProfile.id).some(r => r.profileId === e.playerId || r.id === e.playerId)));
      let pts = 0;
      events.forEach(e => {
        if (e.type === '1pt_make') pts += 1;
        else if (e.type === '2pt_make') pts += 2;
        else if (e.type === '3pt_make') pts += 3;
      });
      return {
        matchName: m.name || `G${idx + 1}`,
        points: pts,
        date: new Date(m.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      };
    }).slice(-5); // Last 5 matches
    
    return trend;
  };

  const renderTrendChart = () => {
    const data = getProfileTrendData();
    if (data.length === 0) return null;

    const maxPoints = Math.max(...data.map(d => d.points), 10);
    const chartHeight = 140;
    const chartWidth = 500;
    const padding = 30;

    // Compute SVG points
    const points = data.map((d, i) => {
      const x = padding + (i * (chartWidth - padding * 2)) / (data.length - 1 || 1);
      const y = chartHeight - padding - (d.points * (chartHeight - padding * 2)) / maxPoints;
      return { x, y, ...d };
    });

    const pathD = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    const areaD = points.length > 0 
      ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z` 
      : '';

    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150/50 dark:border-zinc-800/80 rounded-3xl p-5 shadow-sm transition-colors">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h4 className="font-display font-bold text-slate-800 dark:text-slate-100 text-base md:text-lg">Tren Skor (PTS) Terakhir</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Perkembangan poin per pertandingan</p>
          </div>
          <span className="text-xs font-bold text-[#2B889B] dark:text-teal-400 bg-[#2B889B]/10 px-3 py-1 rounded-full">
            Rata-rata: {(data.reduce((sum, d) => sum + d.points, 0) / data.length).toFixed(1)} PTS
          </span>
        </div>

        <div className="relative w-full overflow-hidden">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            
            {/* Horizontal Grid lines */}
            {[0, 0.5, 1].map((ratio, idx) => {
              const y = padding + ratio * (chartHeight - padding * 2);
              const val = Math.round(maxPoints * (1 - ratio));
              return (
                <g key={idx}>
                  <line 
                    x1={padding} 
                    y1={y} 
                    x2={chartWidth - padding} 
                    y2={y} 
                    stroke="currentColor" 
                    className="text-zinc-100 dark:text-zinc-800" 
                    strokeDasharray="4 4" 
                  />
                  <text 
                    x={padding - 8} 
                    y={y + 4} 
                    textAnchor="end" 
                    className="fill-zinc-400 dark:fill-zinc-500 text-[10px] font-bold"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area under curve */}
            {areaD && <path d={areaD} fill="url(#chartGrad)" />}

            {/* Line curve */}
            {pathD && (
              <path 
                d={pathD} 
                fill="none" 
                stroke="#D4AF37" 
                strokeWidth="3.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            )}

            {/* Point circles & labels */}
            {points.map((p, i) => (
              <g key={i} className="group cursor-pointer">
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="5" 
                  fill="#D4AF37" 
                  stroke="white" 
                  strokeWidth="2" 
                  className="dark:stroke-zinc-900 transition-all hover:r-7" 
                />
                <text 
                  x={p.x} 
                  y={p.y - 12} 
                  textAnchor="middle" 
                  className="fill-zinc-700 dark:fill-zinc-200 text-[10px] font-black"
                >
                  {p.points}
                </text>
                <text 
                  x={p.x} 
                  y={chartHeight - 8} 
                  textAnchor="middle" 
                  className="fill-zinc-400 dark:fill-zinc-500 text-[9px] font-bold uppercase tracking-wider"
                >
                  {p.matchName.length > 8 ? `${p.matchName.substring(0, 6)}..` : p.matchName}
                </text>
              </g>
            ))}
          </svg>
        </div>
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
      <header className="flex justify-between items-center p-4 bg-white dark:bg-zinc-950 sticky top-0 z-35 border-b border-zinc-100/40 dark:border-zinc-900/40 md:hidden">
        <div className="flex items-center gap-2.5">
          <Avatar name={featuredProfile?.name || 'H'} photoUrl={featuredProfile?.photoUrl || featuredProfile?.avatar} size="md" className="border border-zinc-150 dark:border-zinc-800" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Selamat Datang</span>
            <h1 className="text-xs font-black text-brand-navy dark:text-white uppercase tracking-wide leading-none mt-0.5">
              {currentUser ? currentUser.username || currentUser.email : 'Orang Tua / Wali'}
            </h1>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {/* Theme switcher */}
          <button 
            onClick={toggleTheme} 
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer" 
            title="Ubah Tema"
          >
            {theme === 'dark' ? <Sun size={20} className="text-zinc-400" /> : <Moon size={20} className="text-brand-navy" />}
          </button>

          {/* Settings button */}
          <button 
            onClick={() => navigate('/admin')} 
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer" 
            title="Settings / Admin"
          >
            <Settings size={20} className="text-brand-navy dark:text-zinc-400" />
          </button>

          {/* Reusable Profile Avatar Dropdown Menu */}
          <div className="relative">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
              title="Menu Profil"
            >
              <User size={20} className="text-brand-navy dark:text-zinc-400" />
            </button>

            <AnimatePresence>
              {showProfileMenu && (
                <>
                  {/* Backdrop for click out */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowProfileMenu(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-2 py-2.5 overflow-hidden text-left"
                  >
                    {featuredProfile && (
                      <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/85 mb-1.5">
                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Atlet Terklaim</p>
                        <p className="text-xs font-bold text-zinc-800 dark:text-white truncate mt-0.5">{featuredProfile.name}</p>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate(featuredProfile ? `/stats?profileId=${featuredProfile.id}` : '/profiles');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-all text-left cursor-pointer"
                    >
                      <User size={14} className="text-zinc-400" />
                      Akun / Profil Saya
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/claim');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-all text-left cursor-pointer"
                    >
                      <UserPlus size={14} className="text-zinc-400" />
                      Klaim Saya
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/profiles');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-all text-left cursor-pointer"
                    >
                      <Users size={14} className="text-zinc-400" />
                      Daftar Profil Atlet
                    </button>

                    <div className="border-t border-zinc-100 dark:border-zinc-800/85 my-1.5" />

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all text-left cursor-pointer"
                    >
                      <LogOut size={14} />
                      Keluar / Logout
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="px-0 mt-6 space-y-6 w-full max-w-none">
        {loading ? (
          <HomeSkeleton />
        ) : (
          <>
            {can('view_published_story') && (
              <div className="px-4 md:px-0">
                <HighlightCarousel />
              </div>
            )}
            {matches.length === 0 && profiles.length === 0 ? (
              <section className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-brand-navy/10 dark:bg-brand-orange/10 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-navy dark:text-brand-orange">
                <Trophy size={32} />
              </div>
              <h2 className="text-xl font-display font-black text-[#1A1A1A] dark:text-white uppercase mb-2">Selamat Datang di HoopsStats!</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Mari mulai perjalanan merekam statistik basket atlet Anda dalam 3 langkah mudah.</p>
            </div>

            <div className="space-y-4 relative">
              <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-zinc-100 dark:bg-zinc-800 -z-10" />
              
              <div className={`flex gap-4 items-start relative z-10 transition-opacity ${hasProfiles ? 'opacity-60' : ''}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black flex-shrink-0 border-4 border-white dark:border-zinc-900 ${hasProfiles ? 'bg-emerald-500 text-white' : 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy'}`}>
                  {hasProfiles ? <Check size={20} strokeWidth={3} /> : '1'}
                </div>
                <div className="flex-1 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <h3 className="font-bold text-[#1A1A1A] dark:text-white mb-1">Buat Profil Atlet</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Tambahkan data pemain yang akan dilacak statistiknya.</p>
                  <button onClick={() => navigate('/profiles')} className="text-xs font-bold text-brand-navy dark:text-brand-orange flex items-center gap-1 cursor-pointer">
                    Tambah Profil <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className={`flex gap-4 items-start relative z-10 transition-opacity ${hasTeams ? 'opacity-60' : !hasProfiles ? 'opacity-40' : ''}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black flex-shrink-0 border-4 border-white dark:border-zinc-900 ${hasTeams ? 'bg-emerald-500 text-white' : hasProfiles ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                  {hasTeams ? <Check size={20} strokeWidth={3} /> : '2'}
                </div>
                <div className="flex-1 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <h3 className="font-bold text-[#1A1A1A] dark:text-white mb-1">Buat Tim</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Siapkan tim sebelum pertandingan dimulai.</p>
                  <button onClick={() => navigate('/teams')} disabled={!hasProfiles} className="text-xs font-bold text-brand-navy dark:text-brand-orange flex items-center gap-1 disabled:opacity-50 cursor-pointer">
                    Tambah Tim <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className={`flex gap-4 items-start relative z-10 transition-opacity ${!(hasProfiles && hasTeams) ? 'opacity-40' : ''}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black flex-shrink-0 border-4 border-white dark:border-zinc-900 ${hasProfiles && hasTeams ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                  3
                </div>
                <div className="flex-1 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  {can('track_match') ? (
                    <>
                      <h3 className="font-bold text-[#1A1A1A] dark:text-white mb-1">Mulai Pertandingan</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Rekam statistik pertandingan pertama Anda.</p>
                      <button onClick={() => setIsModalOpen(true)} disabled={!(hasProfiles && hasTeams)} className="text-xs font-bold text-brand-navy dark:text-brand-orange flex items-center gap-1 disabled:opacity-50 cursor-pointer">
                        New Game <ChevronRight size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <h3 className="font-bold text-[#1A1A1A] dark:text-white mb-1">Layanan Statistik</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Pesan analisis statistik profesional dari video pertandingan basket anak Anda.</p>
                      <button onClick={() => navigate('/services')} disabled={!(hasProfiles)} className="text-xs font-bold text-brand-navy dark:text-brand-orange flex items-center gap-1 disabled:opacity-50 cursor-pointer">
                        Request Stats (from Video) <ChevronRight size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Left Column: Progress Card & Grafik Tren */}
            <div className="lg:col-span-7 space-y-6">
              {/* "Atlet Aktif" Progress Hero Card matching reference image palette */}
              {featuredProfile && (
                <section className="bg-gradient-to-r from-[#2B889B] via-[#388FA0] to-[#E5A990] rounded-[28px] p-6 text-white relative overflow-hidden shadow-xl border border-white/20 animate-in fade-in duration-200">
                  {/* Basketball Vector Graphic */}
                  <svg className="absolute -right-16 -bottom-16 w-72 h-72 text-white/10 pointer-events-none" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <path d="M15 50 H 85" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <path d="M50 15 V 85" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <path d="M22 22 Q 50 50 22 78" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <path d="M78 22 Q 50 50 78 78" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  </svg>

                  <div className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      {/* Multi-Athlete Selector */}
                      {profiles.length > 1 ? (
                        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 w-full max-w-md">
                          {profiles.map(p => (
                            <button
                              key={p.id}
                              onClick={() => setSelectedProfileId(p.id)}
                              className={`px-3.5 py-1 text-[11px] font-black rounded-full transition-all whitespace-nowrap cursor-pointer ${selectedProfileId === p.id ? 'bg-white text-[#2B889B] shadow-md' : 'bg-black/20 text-white hover:bg-black/30'}`}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div />
                      )}
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                      <Avatar name={featuredProfile.name} photoUrl={featuredProfile.photoUrl || featuredProfile.avatar} size="xl" className="border-3 border-white shadow-lg shrink-0" />
                      <div>
                        <span className="text-[10px] font-black tracking-[0.2em] text-white/90 uppercase block leading-none mb-1">
                          PROGRES UTAMA ATLET
                        </span>
                        <h2 className="font-display text-3xl font-black uppercase leading-none tracking-tight text-white drop-shadow-sm">
                          {featuredProfile.name}
                        </h2>
                      </div>
                    </div>
                    
                    {statsTrend ? (
                      <div className="space-y-4">
                        <p className="text-xs font-semibold text-white/90">
                          Performa rata-rata game ({statsTrend.gamesCount} laga terakhir):
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3.5">
                          {/* PTS BLOCK */}
                          <div className="bg-white/15 backdrop-blur border border-white/20 rounded-2xl p-4 relative overflow-hidden shadow-inner">
                            <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider block">PTS (Avg)</span>
                            <span className="text-3xl font-black text-white block mt-1 leading-none">
                              <CountUp value={statsTrend.pts.recent} decimals={1} />
                            </span>
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-black mt-2 px-2 py-0.5 rounded-full ${statsTrend.pts.status === 'stabil' ? 'bg-white/20 text-white' : statsTrend.pts.status === 'naik' ? 'bg-emerald-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
                              {statsTrend.pts.status === 'stabil' ? <Minus size={10} /> : statsTrend.pts.status === 'naik' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                              {statsTrend.pts.status.toUpperCase()}
                            </span>
                          </div>

                          {/* REB BLOCK */}
                          <div className="bg-white/15 backdrop-blur border border-white/20 rounded-2xl p-4 relative overflow-hidden shadow-inner">
                            <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider block">REB (Avg)</span>
                            <span className="text-3xl font-black text-white block mt-1 leading-none">
                              <CountUp value={statsTrend.reb.recent} decimals={1} />
                            </span>
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-black mt-2 px-2 py-0.5 rounded-full ${statsTrend.reb.status === 'stabil' ? 'bg-white/20 text-white' : statsTrend.reb.status === 'naik' ? 'bg-emerald-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
                              {statsTrend.reb.status === 'stabil' ? <Minus size={10} /> : statsTrend.reb.status === 'naik' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                              {statsTrend.reb.status.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => navigate(`/stats?profileId=${featuredProfile.id}`)}
                            className="bg-white text-[#2B889B] hover:bg-slate-100 font-extrabold text-xs px-5 py-2.5 rounded-full shadow-md transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                          >
                            Lihat Statistik Lengkap <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/15 backdrop-blur border border-white/20 rounded-2xl p-4">
                        <p className="text-xs text-white/90">Belum ada statistik laga yang tercatat untuk {featuredProfile.name}.</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Responsive SVG Trend Chart */}
              {renderTrendChart()}
            </div>

            {/* Right Column: Quick Actions, Recent Matches, Upsell Card */}
            <div className="lg:col-span-5 space-y-6">
              {/* Quick Actions Row */}
              <section className="space-y-2.5">
                <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 text-base px-1">Aksi Cepat</h3>
                <div className="grid grid-cols-3 gap-3">
                  {can('track_match') ? (
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="bg-white dark:bg-zinc-900 border border-zinc-150/50 dark:border-zinc-800/80 p-3.5 rounded-2xl flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-all cursor-pointer shadow-sm group"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#2B889B]/10 text-[#2B889B] border border-[#2B889B]/30 flex items-center justify-center mb-1.5 group-hover:bg-[#2B889B]/20 transition-colors">
                        <Plus size={20} strokeWidth={2.5} />
                      </div>
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Game Baru</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => navigate('/services')}
                      className="bg-white dark:bg-zinc-900 border border-zinc-150/50 dark:border-zinc-800/80 p-3.5 rounded-2xl flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-all cursor-pointer shadow-sm group"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#2B889B]/10 text-[#2B889B] border border-[#2B889B]/30 flex items-center justify-center mb-1.5 group-hover:bg-[#2B889B]/20 transition-colors">
                        <ClipboardList size={18} strokeWidth={2} />
                      </div>
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Request Stats</span>
                    </button>
                  )}

                  <button 
                    onClick={() => navigate(`/stats?profileId=${featuredProfile?.id || ''}`)}
                    className="bg-white dark:bg-zinc-900 border border-zinc-150/50 dark:border-zinc-800/80 p-3.5 rounded-2xl flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-all cursor-pointer shadow-sm group"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#2B889B]/10 text-[#2B889B] border border-[#2B889B]/30 flex items-center justify-center mb-1.5 group-hover:bg-[#2B889B]/20 transition-colors">
                      <Trophy size={18} strokeWidth={2} />
                    </div>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Statistik</span>
                  </button>

                  <button 
                    onClick={() => navigate('/services')}
                    className="bg-white dark:bg-zinc-900 border border-zinc-150/50 dark:border-zinc-800/80 p-3.5 rounded-2xl flex flex-col items-center justify-center text-center hover:scale-[1.02] transition-all cursor-pointer shadow-sm group"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#2B889B]/10 text-[#2B889B] border border-[#2B889B]/30 flex items-center justify-center mb-1.5 group-hover:bg-[#2B889B]/20 transition-colors">
                      <ClipboardList size={18} strokeWidth={2} />
                    </div>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Review Video</span>
                  </button>
                </div>
              </section>

              {/* Pertandingan Terakhir Feed */}
              {matches.length > 0 && (
                <section className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 text-base">Pertandingan Terakhir</h3>
                    <button 
                      onClick={() => navigate('/games')}
                      className="text-xs font-bold text-[#2B889B] hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      Lihat Semua <ChevronRight size={14} />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {matches.slice(-3).reverse().map(match => {
                      const score = calculateMatchScore(match.id);
                      return (
                        <GameCard 
                          key={match.id} 
                          match={match} 
                          onClick={() => {
                            if (match.status === 'completed') {
                              navigate(`/match/${match.id}`);
                            } else if (can('track_match')) {
                              navigate(`/track/${match.id}`);
                            }
                          }}
                          homeScore={score.homeScore}
                          awayScore={score.awayScore}
                        />
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Premium Upsell Card */}
              <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] dark:from-zinc-900 dark:to-zinc-950 rounded-3xl p-5 text-white relative overflow-hidden border border-zinc-800/40 shadow-lg">
                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                  <Trophy size={140} />
                </div>
                <span className="bg-brand-orange text-brand-navy text-[9px] font-black uppercase px-2 py-0.5 rounded-full">Dukung Bakatnya</span>
                <h4 className="text-sm font-bold mt-2 uppercase tracking-wide">Analisis Video Profesional</h4>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">Dapatkan visualisasi shot chart interaktif, tracking box score lengkap, dan highlight AI dari rekaman pertandingan Anda.</p>
                <button onClick={() => navigate('/services')} className="mt-3.5 bg-brand-orange text-brand-navy text-xs font-black py-2.5 px-4 rounded-xl hover:scale-[1.02] transition-transform w-full cursor-pointer uppercase tracking-wider">
                  Pesan Layanan Statistik
                </button>
              </div>
            </div>
          </div>
            )}
          </>
        )}
      </main>

      <GameSetupModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
      <BaseModal 
        isOpen={isLogoutConfirmOpen} 
        onClose={() => setIsLogoutConfirmOpen(false)}
        title="Konfirmasi Keluar"
      >
        <div className="space-y-6 pt-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Apakah Anda yakin ingin keluar / sign out dari HoopStats? Anda harus masuk kembali untuk mengakses data Anda.
          </p>
          <div className="flex gap-3 justify-end">
            <Button 
              variant="secondary" 
              onClick={() => setIsLogoutConfirmOpen(false)}
              className="px-4 py-2 cursor-pointer"
            >
              Batal
            </Button>
            <Button 
              variant="primary" 
              onClick={confirmLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 border-none cursor-pointer"
            >
              Keluar
            </Button>
          </div>
        </div>
      </BaseModal>

      {/* Celebration Aha-Moment Modal */}
      <BaseModal
        isOpen={!!ahaMatch}
        onClose={handleCloseAhaModal}
        title="Pertandingan Selesai!"
      >
        <div className="flex flex-col items-center text-center p-4">
          <div className="w-16 h-16 bg-brand-orange/10 text-brand-orange rounded-full flex items-center justify-center mb-4">
            <Trophy size={36} />
          </div>
          <h3 className="text-xl font-black uppercase text-brand-navy dark:text-white tracking-tight mb-2">
            Laporan pertandingan siap!
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
            Statistik dan analisis performa untuk pertandingan <span className="font-bold">"{ahaMatch?.name}"</span> telah berhasil direkam dan dipublikasikan.
          </p>
          <div className="flex flex-col gap-3 w-full">
            <Button
              variant="primary"
              onClick={() => {
                if (ahaMatch) {
                  localStorage.setItem(`hoopstats_aha_${ahaMatch.id}`, 'true');
                  const childId = getChildIdForMatch(ahaMatch.id);
                  navigate(`/stats?profileId=${childId}`);
                  setAhaMatch(null);
                }
              }}
              className="w-full text-center py-3"
            >
              Lihat Statistik
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (ahaMatch) {
                  localStorage.setItem(`hoopstats_aha_${ahaMatch.id}`, 'true');
                  navigate(`/story/${ahaMatch.id}`);
                  setAhaMatch(null);
                }
              }}
              className="w-full text-center py-3"
            >
              Lihat Cerita Pertandingan
            </Button>
          </div>
        </div>
      </BaseModal>
    </motion.div>
  );
};

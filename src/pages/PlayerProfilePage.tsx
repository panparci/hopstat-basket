import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { statsService } from '../core/services/statsService';
import { useStats } from '../hooks/useStats';
import { StatsSummary } from '../components/molecules/StatsSummary';
import { Avatar } from '../shared/ui/Avatar';
import { 
  ChevronLeft, 
  BarChart2, 
  Calendar, 
  Target, 
  ShieldCheck, 
  Activity, 
  Award, 
  TrendingUp 
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { motion } from 'motion/react';
import { isCountableMatch, didPlayInMatch } from '../core/utils/matchFilters';
import { initDB } from '../lib/db';
import { GameEvent } from '../core/types/stats';
import { isPlayingUp, parseKUFromString } from '../core/utils/ageCalculator';
import { 
  CompetitionGrade, 
  COMPETITION_GRADE_LABELS, 
  COMPETITION_GRADE_WEIGHTS 
} from '../core/config/competition';

export const PlayerProfilePage: React.FC = () => {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [shots, setShots] = useState<GameEvent[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  
  // Custom states for Scout / Talenta Gallery enhancements
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [allClubs, setAllClubs] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [statsByKU, setStatsByKU] = useState<any[]>([]);
  const [highestGrade, setHighestGrade] = useState<string | null>(null);
  const [hasPlayedUp, setHasPlayedUp] = useState(false);
  const [guardians, setGuardians] = useState<any[]>([]);
  const [playerSubmissions, setPlayerSubmissions] = useState<any[]>([]);

  // Load aggregate stats and game-by-game trends using useStats hook
  const { loading: loadingStats, childStats, gameByGameStats } = useStats(profileId || null);

  useEffect(() => {
    const fetchProfileDetails = async () => {
      if (!profileId) return;
      setLoadingProfile(true);
      try {
        // Fetch authentication information
        const { authService } = await import('../services/authService');
        const user = await authService.getCurrentUser();
        setCurrentUser(user);

        // Fetch clubs
        const clubs = await statsService.getClubs();
        setAllClubs(clubs);

        const [allProfiles, allTeams, allEvents, allMatches] = await Promise.all([
          statsService.getProfiles(),
          statsService.getTeams(),
          statsService.getAllEvents(),
          statsService.getMatches()
        ]);
        setAllTeams(allTeams);

        const foundProfile = allProfiles.find(p => p.id === profileId);
        if (!foundProfile) {
          navigate('/gallery');
          return;
        }

        // Respect isDiscoverable and view_gallery permission constraints
        const isAdmin = user?.role === 'admin';
        const isOwner = user && (
          (foundProfile.links && foundProfile.links.some((l: any) => l.accountId === user.id)) ||
          (foundProfile.guardianAccountIds && foundProfile.guardianAccountIds.includes(user.id))
        );

        if (!foundProfile.isDiscoverable && !isAdmin && !isOwner) {
          navigate('/gallery');
          return;
        }

        // Set profile info but strictly exclude any contact data (e.g. phone, address, email)
        const teamPlayers = allTeams.flatMap(t => t.roster || []);
        const playerDetails = teamPlayers.find(p => p.id === foundProfile.id);

        let ageGroup = 'N/A';
        if (foundProfile.mainTeamId) {
          const team = allTeams.find(t => t.id === foundProfile.mainTeamId);
          if (team?.ageGroup) {
            ageGroup = team.ageGroup;
          }
        }
        if (ageGroup === 'N/A' && foundProfile.birthDate) {
          const birthYear = new Date(foundProfile.birthDate).getFullYear();
          const currentYear = new Date().getFullYear();
          const ku = currentYear - birthYear;
          ageGroup = `KU-${ku}`;
        }

        setProfile({
          ...foundProfile,
          position: playerDetails?.position || 'N/A',
          ageGroup
        });

        // Resolve guardians details
        const allUsers = await authService.getAllUsers();
        const guardianLinks = foundProfile.links || [];
        const resolvedGuardians = guardianLinks
          .filter((l: any) => l.relationship === 'guardian')
          .map((l: any) => {
            const u = allUsers.find((usr: any) => usr.id === l.accountId) as any;
            return {
              id: l.accountId,
              name: u?.name || 'Wali Resmi',
              email: u?.email || '—',
              phone: u?.phone || u?.phoneNumber || '—',
              address: u?.address || '—',
              verified: l.verified
            };
          });

        const guardianAccountIds = foundProfile.guardianAccountIds || [];
        guardianAccountIds.forEach((id: string) => {
          if (!resolvedGuardians.some((g: any) => g.id === id)) {
            const u = allUsers.find((usr: any) => usr.id === id) as any;
            resolvedGuardians.push({
              id,
              name: u?.name || 'Wali Resmi',
              email: u?.email || '—',
              phone: u?.phone || u?.phoneNumber || '—',
              address: u?.address || '—',
              verified: true
            });
          }
        });
        setGuardians(resolvedGuardians);

        // Load shots with coordinates for plotting
        const countableMatches = allMatches.filter(isCountableMatch);
        const countableMatchIds = new Set(countableMatches.map(m => m.id));

        const matchingPlayerIds = new Set<string>([profileId]);
        const rosterRecords = await statsService.getAllMatchRosters();
        const db = await initDB();
        const stints = await db.getAll('match_stints');

        rosterRecords.forEach(r => {
          if (r.id === profileId || r.profileId === profileId) {
            matchingPlayerIds.add(r.profileId);
          }
        });

        const playerShots = allEvents.filter(e => 
          matchingPlayerIds.has(e.playerId) && 
          countableMatchIds.has(e.matchId) && 
          ['1pt_make', '1pt_miss', '2pt_make', '2pt_miss', '3pt_make', '3pt_miss'].includes(e.type) &&
          e.x !== undefined && e.y !== undefined
        );
        setShots(playerShots);

        // Fetch fundamental drill submissions for scout/coach evaluation
        try {
          const { fundamentalService } = await import('../modules/fundamentals/services/fundamentalService');
          const subs = await fundamentalService.getSubmissions();
          const filteredSubs = subs.filter(s => 
            s.athleteId === foundProfile.id || 
            (s.athleteName && s.athleteName.toLowerCase().includes(foundProfile.name.toLowerCase()))
          );
          setPlayerSubmissions(filteredSubs);
        } catch (subErr) {
          console.warn('Error loading submissions for player profile:', subErr);
        }

        // Fetch statistician completed verification status
        const { requestService } = await import('../services/requestService');
        const allRequests = await requestService.getAllRequests();
        const completedRequestsIds = new Set(
          allRequests
            .filter(r => r.status === 'completed' || r.status === 'reviewed')
            .map(r => r.matchId)
            .filter(Boolean)
        );

        const matchesPlayedSet = new Set<string>();
        countableMatches.forEach(m => {
          const hasPlayed = Array.from(matchingPlayerIds).some(pid => 
            didPlayInMatch(pid, m.id, allEvents, stints)
          );
          if (hasPlayed) {
            matchesPlayedSet.add(m.id);
          }
        });

        const verified = Array.from(matchesPlayedSet).some(mId => completedRequestsIds.has(mId));
        setIsVerified(verified);

        // --- CALCULATE CAREER TIMELINE & SCOUT METRICS ---
        const playerMatches = countableMatches.filter(m => {
          return matchesPlayedSet.has(m.id);
        });

        const yearsSet = new Set<number>();
        playerMatches.forEach(m => {
          if (m.date) {
            const yr = new Date(m.date).getFullYear();
            if (!isNaN(yr)) yearsSet.add(yr);
          }
        });
        const transferHistory = foundProfile.transferHistory || [];
        transferHistory.forEach(th => {
          if (th.date) {
            const yr = new Date(th.date).getFullYear();
            if (!isNaN(yr)) yearsSet.add(yr);
          }
        });
        if (yearsSet.size === 0) {
          yearsSet.add(new Date().getFullYear());
        }

        const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

        let calculatedPlayedUp = false;
        let maxGradeWeight = 0;
        let maxGradeName: string | null = null;

        playerMatches.forEach(m => {
          let activeKU = m.matchKU !== undefined ? m.matchKU : m.ageCategory;
          if (activeKU === undefined && m.ageGroup) {
            activeKU = parseKUFromString(m.ageGroup);
          }
          if (activeKU !== undefined && foundProfile.birthDate) {
            const status = isPlayingUp(foundProfile.birthDate, m.date, activeKU);
            if (status === 'up') {
              calculatedPlayedUp = true;
            }
          }
          if (m.competitionGrade) {
            const weight = COMPETITION_GRADE_WEIGHTS[m.competitionGrade as CompetitionGrade] || 0;
            if (weight > maxGradeWeight) {
              maxGradeWeight = weight;
              maxGradeName = m.competitionGrade;
            }
          }
        });

        setHasPlayedUp(calculatedPlayedUp);
        setHighestGrade(maxGradeName);

        // Build career timeline items
        const timelineData = sortedYears.map(year => {
          const matchesInYear = playerMatches.filter(m => {
            if (!m.date) return false;
            return new Date(m.date).getFullYear() === year;
          });

          const teamIdsInYear = new Set<string>();
          matchesInYear.forEach(m => {
            const rosterForMatch = rosterRecords.find(r => r.matchId === m.id && matchingPlayerIds.has(r.profileId));
            const tId = rosterForMatch ? rosterForMatch.teamId : m.teamId;
            if (tId) teamIdsInYear.add(tId);
          });

          const transfersInYear = transferHistory.filter(th => {
            if (!th.date) return false;
            return new Date(th.date).getFullYear() === year;
          });
          transfersInYear.forEach(th => {
            if (th.toTeamId) teamIdsInYear.add(th.toTeamId);
            if (th.fromTeamId) teamIdsInYear.add(th.fromTeamId);
          });

          if (teamIdsInYear.size === 0 && foundProfile.mainTeamId) {
            teamIdsInYear.add(foundProfile.mainTeamId);
          }

          const resolvedTeams = Array.from(teamIdsInYear).map(tId => {
            const team = allTeams.find(t => t.id === tId);
            if (!team) return { id: tId, name: 'Klub Tidak Diketahui', logo: null };
            const club = team.clubId ? clubs.find(c => c.id === team.clubId) : null;
            return {
              id: tId,
              name: club ? club.name : team.name,
              logo: club?.logoUrl || team.logoUrl || null
            };
          });

          let kuLabel = 'N/A';
          if (foundProfile.birthDate) {
            const birthYr = new Date(foundProfile.birthDate).getFullYear();
            if (!isNaN(birthYr)) {
              kuLabel = `KU-${year - birthYr}`;
            }
          }

          const eventsInYear = allEvents.filter(e => {
            return matchingPlayerIds.has(e.playerId) && matchesInYear.some(m => m.id === e.matchId);
          });

          let ptsInYear = 0;
          let rebInYear = 0;
          let astInYear = 0;
          eventsInYear.forEach(e => {
            if (e.type === '1pt_make') ptsInYear += 1;
            else if (e.type === '2pt_make') ptsInYear += 2;
            else if (e.type === '3pt_make') ptsInYear += 3;
            else if (e.type === 'oreb' || e.type === 'dreb') rebInYear += 1;
            else if (e.type === 'ast') astInYear += 1;
          });

          let highPts = 0;
          let highPtsOpponent = '';
          matchesInYear.forEach(m => {
            let mPts = 0;
            allEvents.filter(e => e.matchId === m.id && matchingPlayerIds.has(e.playerId)).forEach(e => {
              if (e.type === '1pt_make') mPts += 1;
              else if (e.type === '2pt_make') mPts += 2;
              else if (e.type === '3pt_make') mPts += 3;
            });
            if (mPts > highPts) {
              highPts = mPts;
              const oppTeam = allTeams.find(t => t.id === m.opponentTeamId);
              highPtsOpponent = oppTeam ? oppTeam.name : 'Lawan';
            }
          });

          const totalGamesInYear = matchesInYear.length;

          return {
            year,
            ku: kuLabel,
            teams: resolvedTeams,
            gamesPlayed: totalGamesInYear,
            transfers: transfersInYear,
            stats: {
              ppg: totalGamesInYear > 0 ? (ptsInYear / totalGamesInYear).toFixed(1) : '0',
              rpg: totalGamesInYear > 0 ? (rebInYear / totalGamesInYear).toFixed(1) : '0',
              apg: totalGamesInYear > 0 ? (astInYear / totalGamesInYear).toFixed(1) : '0',
              highPts,
              highPtsOpponent
            }
          };
        });

        setTimeline(timelineData);

        // Group stats automatically per KU (Kategori Umur)
        const kuStatsMap: Record<string, { pts: number; reb: number; ast: number; games: number; maxPoints: number }> = {};
        playerMatches.forEach(m => {
          let activeKU = 'N/A';
          if (foundProfile.birthDate && m.date) {
            const matchYr = new Date(m.date).getFullYear();
            const birthYr = new Date(foundProfile.birthDate).getFullYear();
            if (!isNaN(matchYr) && !isNaN(birthYr)) {
              activeKU = `KU-${matchYr - birthYr}`;
            }
          }
          if (activeKU === 'N/A') {
            const kuNum = m.matchKU !== undefined ? m.matchKU : m.ageCategory;
            activeKU = kuNum ? `KU-${kuNum}` : (m.ageGroup || 'N/A');
          }

          if (!kuStatsMap[activeKU]) {
            kuStatsMap[activeKU] = { pts: 0, reb: 0, ast: 0, games: 0, maxPoints: 0 };
          }

          const kStats = kuStatsMap[activeKU];
          kStats.games += 1;

          const matchEvents = allEvents.filter(e => e.matchId === m.id && matchingPlayerIds.has(e.playerId));
          let matchPts = 0;
          matchEvents.forEach(e => {
            if (e.type === '1pt_make') {
              matchPts += 1;
              kStats.pts += 1;
            } else if (e.type === '2pt_make') {
              matchPts += 2;
              kStats.pts += 2;
            } else if (e.type === '3pt_make') {
              matchPts += 3;
              kStats.pts += 3;
            } else if (e.type === 'oreb' || e.type === 'dreb') {
              kStats.reb += 1;
            } else if (e.type === 'ast') {
              kStats.ast += 1;
            }
          });

          if (matchPts > kStats.maxPoints) {
            kStats.maxPoints = matchPts;
          }
        });

        const kuStatsData = Object.entries(kuStatsMap).map(([ku, data]) => ({
          ku,
          games: data.games,
          ppg: data.games > 0 ? (data.pts / data.games).toFixed(1) : '0',
          rpg: data.games > 0 ? (data.reb / data.games).toFixed(1) : '0',
          apg: data.games > 0 ? (data.ast / data.games).toFixed(1) : '0',
          maxPoints: data.maxPoints
        })).sort((a, b) => a.ku.localeCompare(b.ku));

        setStatsByKU(kuStatsData);

      } catch (err) {
        console.error('Error fetching player profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfileDetails();
  }, [profileId, navigate]);

  if (loadingProfile || loadingStats) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-zinc-300 border-t-brand-navy dark:border-t-brand-orange rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-zinc-400 mt-4">Memuat data talenta...</p>
      </div>
    );
  }

  if (!profile) return null;

  // Compute shooting splits percentages
  const fgm = childStats?.fgm || 0;
  const fga = childStats?.fga || 0;
  const tpm = childStats?.tpm || 0;
  const tpa = childStats?.tpa || 0;
  const ftm = childStats?.ftm || 0;
  const fta = childStats?.fta || 0;

  const fgPct = fga > 0 ? ((fgm / fga) * 100).toFixed(1) : '0';
  const tpPct = tpa > 0 ? ((tpm / tpa) * 100).toFixed(1) : '0';
  const ftPct = fta > 0 ? ((ftm / fta) * 100).toFixed(1) : '0';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 pb-24 transition-colors font-sans"
    >
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 p-4 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
        <button
          onClick={() => navigate('/gallery')}
          className="p-2 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
        <h1 className="text-sm font-bold text-brand-navy dark:text-white uppercase tracking-wider">
          Kembali ke Galeri
        </h1>
      </header>

      <main className="p-4 mt-2 space-y-6 max-w-4xl mx-auto">
        {/* Profile Card Header (Ringkasan Identitas) */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-6 flex flex-col md:flex-row items-center gap-6">
          <Avatar name={profile.name} photoUrl={profile.photoUrl || profile.avatar} size="xl" className="shadow-xs" />
          
          <div className="text-center md:text-left flex-1 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <h2 className="text-xl font-display font-black text-[#1A1A1A] dark:text-white uppercase tracking-tight">
                {profile.name}
              </h2>
              <div className="flex flex-wrap justify-center md:justify-start gap-1.5">
                {isVerified && (
                  <div
                    id="profile-verified-badge"
                    className="flex items-center gap-1 bg-green-50 dark:bg-green-950/20 text-green-650 dark:text-green-400 px-2 py-0.5 rounded-full text-[10px] font-black border border-green-100 dark:border-green-900/30 w-fit"
                  >
                    <ShieldCheck size={10} strokeWidth={3} />
                    TERVERIFIKASI
                  </div>
                )}
                {hasPlayedUp && (
                  <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/30">
                    Playing UP
                  </span>
                )}
                {highestGrade && (
                  <span className="bg-brand-navy/10 text-brand-navy dark:bg-brand-orange/15 dark:text-brand-orange text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-brand-navy/10 dark:border-brand-orange/20">
                    Level: {COMPETITION_GRADE_LABELS[highestGrade as CompetitionGrade] || highestGrade}
                  </span>
                )}
              </div>
            </div>

            {/* Structured details pill row */}
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              <span className="bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-150/40 dark:border-zinc-800/80">
                {profile.position || 'N/A'}
              </span>
              <span className="bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-150/40 dark:border-zinc-800/80">
                {profile.birthDate ? (
                  `KU-${new Date().getFullYear() - new Date(profile.birthDate).getFullYear()} (Lahir ${new Date(profile.birthDate).getFullYear()})`
                ) : (
                  profile.ageGroup || 'KU: N/A'
                )}
              </span>
              <span className="bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-150/40 dark:border-zinc-800/80">
                {profile.gender === 'P' || profile.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki'}
              </span>
              {profile.jerseyNumber && (
                <span className="bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-150/40 dark:border-zinc-800/80 text-brand-navy dark:text-brand-orange">
                  #{profile.jerseyNumber}
                </span>
              )}
            </div>

            {/* Club & Aliases */}
            <div className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
              <div className="flex justify-center md:justify-start items-center gap-1">
                <span className="font-semibold text-zinc-400 dark:text-zinc-500">Klub Aktif:</span>
                <span className="text-[#1A1A1A] dark:text-white font-bold">
                  {(() => {
                    const activeTeam = allTeams.find(t => t.id === (profile.mainTeamId || profile.teamId || profile.academyTeamId));
                    const activeClub = activeTeam ? allClubs.find(c => c.id === activeTeam.clubId) : null;
                    return activeClub ? activeClub.name : (activeTeam ? activeTeam.name : 'N/A');
                  })()}
                </span>
              </div>

              {(() => {
                const uniqueAliases = Array.from(new Set([
                  ...(profile.aliases || []),
                  ...(profile.voiceAliases || [])
                ])).filter(alias => alias && alias.toLowerCase() !== profile.name.toLowerCase());

                if (uniqueAliases.length > 0) {
                  return (
                    <div className="text-center md:text-left">
                      <span className="font-semibold text-zinc-400 dark:text-zinc-500">Nama Alias:</span>{' '}
                      <span className="font-medium italic text-zinc-600 dark:text-zinc-300">
                        {uniqueAliases.join(', ')}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono text-center md:text-left">
                ID: {profile.id}
              </div>
            </div>

            <p className="text-[10px] bg-zinc-50 dark:bg-zinc-950 text-zinc-400 dark:text-zinc-500 px-3 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800 w-fit mx-auto md:mx-0 font-medium leading-normal">
              🛡️ Informasi Kontak & Alamat Disembunyikan untuk Melindungi Privasi Pemain.
            </p>
          </div>
        </div>

        {/* Hubungi Wali / Informasi Kontak */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-brand-navy dark:text-brand-orange">
              <ShieldCheck size={20} strokeWidth={2.5} />
            </div>
            <h2 className="text-sm font-display font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wider">
              Kontak Wali & Informasi Pencari Bakat
            </h2>
          </div>

          {guardians.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">Belum ada informasi wali terdaftar.</p>
          ) : (
            <div className="space-y-4">
              {guardians.map((g, idx) => {
                const isAdmin = currentUser?.role === 'admin';
                const isOwner = currentUser && (
                  (profile.links && profile.links.some((l: any) => l.accountId === currentUser.id)) ||
                  (profile.guardianAccountIds && profile.guardianAccountIds.includes(currentUser.id))
                );
                const canSeeContact = isAdmin || isOwner || currentUser?.role === 'statistician' || currentUser?.role === 'coach';

                return (
                  <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-150/50 dark:border-zinc-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#1A1A1A] dark:text-white">{g.name}</span>
                      {g.verified && (
                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/35">
                          Guardian Terverifikasi
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-zinc-100 dark:border-zinc-800/60">
                      <div>
                        <span className="text-zinc-400 block mb-0.5">Email</span>
                        {canSeeContact ? (
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">{g.email}</span>
                        ) : (
                          <span className="text-zinc-400 italic flex items-center gap-1">
                            🔒 Disembunyikan (Khusus Wali/Admin)
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-zinc-400 block mb-0.5">No. Telepon / HP</span>
                        {canSeeContact ? (
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">{g.phone}</span>
                        ) : (
                          <span className="text-zinc-400 italic flex items-center gap-1">
                            🔒 Disembunyikan (Khusus Wali/Admin)
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-zinc-400 block mb-0.5">Alamat</span>
                        {canSeeContact ? (
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">{g.address}</span>
                        ) : (
                          <span className="text-zinc-400 italic flex items-center gap-1">
                            🔒 Disembunyikan (Khusus Wali/Admin)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Aggregate Stats Section */}
        {childStats && (
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-brand-navy dark:text-brand-orange">
                <BarChart2 size={20} strokeWidth={2.5} />
              </div>
              <h2 className="text-sm font-display font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wider">
                Rata-rata & Ringkasan Statistik
              </h2>
            </div>

            {/* Quick Summary Grid */}
            <StatsSummary
              cols={3}
              stats={[
                { label: 'PTS', value: childStats.pts, subValue: `${(childStats.pts / Math.max(1, childStats.gamesPlayed)).toFixed(1)}/G` },
                { label: 'REB', value: childStats.reb, subValue: `${(childStats.reb / Math.max(1, childStats.gamesPlayed)).toFixed(1)}/G` },
                { label: 'AST', value: childStats.ast, subValue: `${(childStats.ast / Math.max(1, childStats.gamesPlayed)).toFixed(1)}/G` }
              ]}
            />

            <StatsSummary
              cols={4}
              stats={[
                { label: 'OREB', value: childStats.oreb },
                { label: 'DREB', value: childStats.dreb },
                { label: 'STL', value: childStats.stl },
                { label: 'BLK', value: childStats.blk }
              ]}
            />

            <StatsSummary
              cols={3}
              stats={[
                { label: 'TO', value: childStats.to },
                { label: 'PF', value: childStats.fouls },
                { label: 'GAMES', value: childStats.gamesPlayed }
              ]}
            />

            {/* Shooting Splits */}
            <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Shooting Splits</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-[#1A1A1A] dark:text-white">FG ({childStats.fgm}/{childStats.fga})</span>
                    <span className="text-brand-navy dark:text-brand-orange">{fgPct}%</span>
                  </div>
                  <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-navy dark:bg-brand-orange rounded-full" style={{ width: `${parseFloat(fgPct)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-[#1A1A1A] dark:text-white">3PT ({childStats.tpm}/{childStats.tpa})</span>
                    <span className="text-brand-navy dark:text-brand-orange">{tpPct}%</span>
                  </div>
                  <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-navy dark:bg-brand-orange rounded-full" style={{ width: `${parseFloat(tpPct)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-[#1A1A1A] dark:text-white">FT ({childStats.ftm}/{childStats.fta})</span>
                    <span className="text-brand-navy dark:text-brand-orange">{ftPct}%</span>
                  </div>
                  <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-navy dark:bg-brand-orange rounded-full" style={{ width: `${parseFloat(ftPct)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Career Timeline Section (Perjalanan Karier & Lini Masa) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-brand-navy dark:text-brand-orange">
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <h2 className="text-sm font-display font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wider">
              Perjalanan Karier & Lini Masa
            </h2>
          </div>

          {timeline.length === 0 ? (
            <div className="text-center py-6 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Belum Ada Riwayat Karier Tercatat</p>
            </div>
          ) : (
            <div className="relative pl-6 border-l border-zinc-200 dark:border-zinc-800 space-y-8 py-2 ml-3">
              {timeline.map((item, index) => {
                const olderItem = timeline[index + 1];
                const showProgression = olderItem && olderItem.ku !== 'N/A' && item.ku !== 'N/A';

                return (
                  <div key={item.year} className="relative">
                    {/* Circle Indicator on vertical line */}
                    <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border-2 border-brand-navy dark:border-brand-orange">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-navy dark:bg-brand-orange" />
                    </span>

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg font-display font-black text-brand-navy dark:text-brand-orange">
                            Musim {item.year}
                          </span>
                          <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                            {item.ku}
                          </span>
                          {showProgression && (
                            <span className="text-[10px] text-green-600 dark:text-green-400 font-bold flex items-center gap-0.5">
                              ➔ Progres dari {olderItem.ku}
                            </span>
                          )}
                        </div>

                        {/* Club / Team list */}
                        <div className="text-xs font-bold text-zinc-650 dark:text-zinc-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span>Klub/Tim:</span>
                          {item.teams.length === 0 ? (
                            <span className="text-zinc-400 dark:text-zinc-500 font-medium italic">Tidak terdaftar di klub</span>
                          ) : (
                            <div className="flex gap-2 items-center flex-wrap">
                              {item.teams.map((t: any) => (
                                <span key={t.id} className="bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-150 dark:border-zinc-800 text-xs text-brand-navy dark:text-brand-orange font-black">
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-zinc-50 dark:bg-zinc-950 px-4 py-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 shrink-0 text-left md:text-right w-full md:w-auto">
                        <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">
                          Pertandingan: {item.gamesPlayed} Game
                        </div>
                        {item.gamesPlayed > 0 ? (
                          <div className="text-xs font-semibold space-y-0.5">
                            <div className="text-zinc-700 dark:text-zinc-300">
                              Rata-rata: <span className="font-black text-brand-navy dark:text-brand-orange">{item.stats.ppg} PTS</span> / <span className="font-bold">{item.stats.rpg} REB</span> / <span className="font-bold">{item.stats.apg} AST</span>
                            </div>
                            {item.stats.highPts > 0 && (
                              <div className="text-[10px] text-zinc-450 dark:text-zinc-500">
                                Tertinggi: <span className="font-bold text-green-600 dark:text-green-450">{item.stats.highPts} Poin</span> vs {item.stats.highPtsOpponent}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">Belum ada statistik tercatat</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Performance per KU Section (Performa per-KU) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-brand-navy dark:text-brand-orange">
              <Award size={20} strokeWidth={2.5} />
            </div>
            <h2 className="text-sm font-display font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wider">
              Performa per Kategori Umur (KU)
            </h2>
          </div>

          {statsByKU.length === 0 ? (
            <div className="text-center py-6 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Belum Ada Performa KU Tercatat</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {statsByKU.map((item) => (
                <div key={item.ku} className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-150/50 dark:border-zinc-800/80 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-black text-brand-navy dark:text-brand-orange">
                        {item.ku}
                      </span>
                      <span className="text-[10px] bg-brand-navy/5 text-brand-navy dark:bg-brand-orange/10 dark:text-brand-orange px-2 py-0.5 rounded-full font-bold">
                        {item.games} Game
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center mt-2 bg-white dark:bg-zinc-900/60 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                      <div>
                        <span className="block text-[9px] font-bold text-zinc-400 uppercase">PPG</span>
                        <span className="text-xs font-black text-brand-navy dark:text-brand-orange">{item.ppg}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold text-zinc-400 uppercase">RPG</span>
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{item.rpg}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold text-zinc-400 uppercase">APG</span>
                        <span className="text-xs font-bold text-[#1A1A1A] dark:text-white">{item.apg}</span>
                      </div>
                    </div>
                  </div>

                  {item.maxPoints > 0 && (
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium text-center mt-3 pt-2 border-t border-zinc-150/50 dark:border-zinc-800/50">
                      🏆 Poin Maksimum: <span className="font-bold text-[#1A1A1A] dark:text-white">{item.maxPoints} Poin</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fundamental Drill & Video Submissions Section (Khusus Scouting & Evaluasi Pelatih) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                <Target size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-sm font-display font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wider">
                  Setoran Video & Progress Drill Fundamental
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Rekam jejak latihan teknik dasar & penilaian kualitatif pelatih
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/fundamentals')}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Lihat Semua Drill ➔
            </button>
          </div>

          {playerSubmissions.length === 0 ? (
            <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Belum Ada Setoran Video Latihan</p>
              <p className="text-[11px] text-zinc-500 mt-1">Pemain ini belum menyetorkan video latihan ke Google Classroom Fundamental.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {playerSubmissions.map((sub: any) => (
                <div key={sub.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-150/60 dark:border-zinc-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block">
                        {sub.drillName}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        Diserahkan: {new Date(sub.submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                        sub.status === 'reviewed' 
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border-emerald-200' 
                          : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 border-amber-200'
                      }`}>
                        {sub.status === 'reviewed' ? '✓ Telah Dievaluasi' : '⏳ Menunggu Review'}
                      </span>
                      {sub.videoUrl && (
                        <a
                          href={sub.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                        >
                          ▶ Tonton Video
                        </a>
                      )}
                    </div>
                  </div>

                  {sub.athleteNotes && (
                    <div className="text-xs bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 text-zinc-650 dark:text-zinc-300 italic">
                      "{sub.athleteNotes}"
                    </div>
                  )}

                  {sub.coachFeedback && (
                    <div className="p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/20 space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
                        <span>📋 Review Pelatih ({sub.coachFeedback.coachName})</span>
                        <span>Rating: ⭐ {sub.coachFeedback.rating}/5</span>
                      </div>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed">
                        {sub.coachFeedback.comments}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Statistical Trend graph */}
        {gameByGameStats && gameByGameStats.length >= 2 && (
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-brand-navy dark:text-brand-orange">
                <Calendar size={20} strokeWidth={2.5} />
              </div>
              <h2 className="text-sm font-display font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wider">
                Grafik Tren Pertandingan
              </h2>
            </div>
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
                  <Line type="monotone" dataKey="pts" name="PTS" stroke="var(--color-brand-navy)" strokeWidth={3} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="reb" name="REB" stroke="#3b82f6" strokeWidth={3} />
                  <Line type="monotone" dataKey="ast" name="AST" stroke="#f59e0b" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Shot Chart Section */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="text-brand-navy dark:text-brand-orange">
              <Target size={20} strokeWidth={2.5} />
            </div>
            <h2 className="text-sm font-display font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wider">
              Shot Chart (Peta Tembakan)
            </h2>
          </div>

          {shots.length === 0 ? (
            <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6">
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Belum Ada Koordinat Tembakan Tercatat</p>
              <p className="text-[11px] text-zinc-450 dark:text-zinc-500 mt-1">Gunakan detail tracking koordinat di pertandingan untuk memvisualisasikan peta tembakan.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="relative aspect-[10/9] w-full max-w-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-inner">
                {/* Court Diagram */}
                <svg viewBox="0 0 100 90" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none fill-none" strokeWidth="0.8">
                  <g className="opacity-30 dark:opacity-20 stroke-current text-zinc-900 dark:text-zinc-100">
                    <rect x="0" y="0" width="100" height="90" />
                    <line x1="0" y1="90" x2="100" y2="90" />
                    <rect x="34" y="0" width="32" height="38" />
                    <circle cx="50" cy="38" r="12" />
                    <line x1="42" y1="8" x2="58" y2="8" strokeWidth="1.5" />
                    <circle cx="50" cy="11" r="3" strokeWidth="1.2" />
                    <path d="M 8 0 L 8 28 A 42 42 0 0 0 92 28 L 92 0" />
                    <path d="M 42 11 A 8 8 0 0 0 58 11" strokeDasharray="1 1" />
                  </g>
                </svg>

                {/* Plotting individual shot circles */}
                {shots.map((shot, index) => {
                  const isMake = shot.type.includes('_make');
                  return (
                    <div
                      key={shot.id || index}
                      style={{
                        position: 'absolute',
                        left: `${shot.x}%`,
                        top: `${(shot.y ?? 0) * (90/100)}%`, // Correctly scale y ratio to 90% SVG box
                        transform: 'translate(-50%, -50%)',
                      }}
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-[7px] border cursor-pointer hover:scale-125 transition-transform shadow-sm ${
                        isMake 
                          ? 'bg-green-500 text-white border-green-600' 
                          : 'bg-red-500 text-white border-red-600'
                      }`}
                      title={`${shot.type.replace('_', ' ').toUpperCase()} at Q${shot.quarter}`}
                    >
                      {isMake ? '✓' : '✗'}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex gap-4 text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-green-500 rounded-full border border-green-600 inline-block"></span>
                  <span className="text-zinc-600 dark:text-zinc-300">MASUK ({shots.filter(s => s.type.includes('_make')).length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-red-500 rounded-full border border-red-600 inline-block"></span>
                  <span className="text-zinc-600 dark:text-zinc-300">LUPUT ({shots.filter(s => s.type.includes('_miss')).length})</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* PRIVACY & SECURITY COMMENTARY DISCLOSURE (REQUIRED BY SPEC):
          Note: In production environments, access control logic and data visibility (discoverable players) 
          must be strictly enforced on the server-side / database layer (using Supabase Row Level Security (RLS) policies). 
          Filtering in the client UI is for demo and preview purposes only. */}

    </motion.div>
  );
};

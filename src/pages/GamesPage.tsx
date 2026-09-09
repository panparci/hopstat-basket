import React, { useState, useEffect, useRef } from 'react';
import { statsService } from '../core/services/statsService';
import { exportImportService } from '../core/services/exportImportService';
import { Match, Series, Team } from '../core/types/stats';
import { useNavigate } from 'react-router-dom';
import { generateId } from '../core/utils/idUtils';
import { Calendar, MapPin, ChevronRight, Trophy, Plus, Folder, FileText, MoreVertical, Edit2, Trash2, Upload, Search, X } from 'lucide-react';
import { GameSetupModal } from '../components/organisms/GameSetupModal';
import { MatchActionsModal } from '../components/organisms/MatchActionsModal';
import { SeriesFormModal } from '../components/organisms/SeriesFormModal';
import { useToast } from '../core/contexts/ToastContext';
import { GameCard } from '../components/molecules/GameCard';
import { motion } from 'motion/react';
import { CompetitionGrade, COMPETITION_GRADE_LABELS, COMPETITION_GRADE_COLORS } from '../core/config/competition';
import { requestService } from '../services/requestService';
import { usePermissions } from '../core/contexts/PermissionsContext';
import { initDB } from '../lib/db';
import { filterViewableMatches } from '../features/access-control/model/matchAccess';

export const GamesPage: React.FC = () => {
  const { can, user } = usePermissions();
  const { showToast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'adhoc' | 'series'>('adhoc');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  
  // Filtering & search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKu, setSelectedKu] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'live_planned' | 'completed'>('all');
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [allMatchRosters, setAllMatchRosters] = useState<any[]>([]);
  const [selectedDetailMatchId, setSelectedDetailMatchId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const m = await statsService.getMatches();
      const s = await statsService.getSeriesAll();
      const t = await statsService.getTeams();
      const evts = await statsService.getAllEvents();
      const rsts = await statsService.getAllMatchRosters();
      const profiles = await statsService.getProfiles();
      const db = await initDB();
      const payments = await db.getAll('payments');

      const visible = filterViewableMatches(
        user,
        m.filter((match) => match.status !== 'aborted'),
        profiles,
        rsts,
        payments
      );
      setMatches(visible.reverse());
      setSeriesList(s);
      setTeams(t);
      setAllEvents(evts);
      setAllMatchRosters(rsts);
    } catch (err) {
      console.error('Error loading matches data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleStatRequest = async () => {
      const params = new URLSearchParams(window.location.search);
      const importUrl = params.get('import_url');
      const home = params.get('home');
      const away = params.get('away');
      const requestId = params.get('requestId');

      if (importUrl && home && away && requestId) {
        // Clear params to avoid loop
        window.history.replaceState({}, '', '/games');
        
        try {
          const req = await requestService.getRequestById(requestId);
          let targetMatchId: string;
          if (req) {
            targetMatchId = await requestService.createMatchFromRequest(req);
          } else {
            // Fallback to simpler creation
            targetMatchId = generateId('match');
            const newMatch: Match = {
              id: targetMatchId,
              name: `${home} vs ${away}`,
              date: new Date().toISOString(),
              venue: 'YouTube Request',
              type: 'single',
              recordingType: 'full',
              durationPerPeriod: 10,
              gameType: '5v5',
              videoUrl: importUrl,
              ourHomeAway: 'home',
              ourTeamName: home,
              theirTeamName: away,
              ourColor: 'var(--color-brand-navy)',
              theirColor: '#DC2626',
              status: 'planned',
              teamId: 'home_team',
              opponentTeamId: 'away_team',
              ageGroup: 'U18',
              periodCount: 4,
              clockMode: 'stop',
              childId: ''
            };
            await statsService.addMatch(newMatch);
          }

          // Store request mapping
          if (requestId) {
            localStorage.setItem(`request_match_${targetMatchId}`, requestId);
          }

          navigate(`/track/${targetMatchId}`);
        } catch (err) {
          console.error("Error creating match from stat request", err);
          showToast('Gagal memproses tugas statistik', 'error');
        }
      }
    };

    handleStatRequest();
  }, []);

  useEffect(() => {
    loadData();
  }, [user]);

  const handleDeleteSeries = async (series: Series) => {
    const sMatches = matches.filter(m => m.seriesId === series.id);
    for (const m of sMatches) {
      await statsService.updateMatch({ ...m, seriesId: undefined, type: 'single' });
    }
    await statsService.deleteSeries(series.id);
    loadData();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await exportImportService.importMatch(text);
      showToast('Pertandingan berhasil diimpor!', 'success');
      loadData();
    } catch (error) {
      console.error('Failed to import match', error);
      showToast('Gagal mengimpor pertandingan. Pastikan file valid.', 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Extract unique filter categories from current matches
  const uniqueKus = Array.from(new Set(matches.map(m => m.ageGroup || (m.ageCategory ? `KU${m.ageCategory}` : '')).filter(Boolean)));
  const uniqueGrades = Array.from(new Set(matches.map(m => m.competitionGrade).filter(Boolean))) as CompetitionGrade[];
  const uniqueTeams = Array.from(new Set(matches.map(m => m.ourTeamName).filter(Boolean)));

  // Score Calculator
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

  const calculateDetailedMatchStats = (matchId: string) => {
    const homeTeamId = 'home_team';
    const awayTeamId = 'away_team';
    
    const events = allEvents.filter(e => e.matchId === matchId);
    const rosters = allMatchRosters.filter(r => r.matchId === matchId);
    
    let home = {
      pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0,
      fgm: 0, fga: 0, pm3: 0, pa3: 0, ftm: 0, fta: 0
    };
    let away = {
      pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0,
      fgm: 0, fga: 0, pm3: 0, pa3: 0, ftm: 0, fta: 0
    };

    events.forEach(e => {
      const isHome = rosters.some(r => r.teamId === homeTeamId && r.profileId === e.playerId) || e.playerId === 'home_team';
      const isAway = rosters.some(r => r.teamId === awayTeamId && r.profileId === e.playerId) || e.playerId === 'opp' || e.playerId === 'away_team';
      
      if (!isHome && !isAway) return;
      const t = isHome ? home : away;

      if (e.type === '1pt_make') {
        t.pts += 1;
        t.ftm += 1;
        t.fta += 1;
      } else if (e.type === '1pt_miss') {
        t.fta += 1;
      } else if (e.type === '2pt_make') {
        t.pts += 2;
        t.fgm += 1;
        t.fga += 1;
      } else if (e.type === '2pt_miss') {
        t.fga += 1;
      } else if (e.type === '3pt_make') {
        t.pts += 3;
        t.fgm += 1;
        t.fga += 1;
        t.pm3 += 1;
        t.pa3 += 1;
      } else if (e.type === '3pt_miss') {
        t.fga += 1;
        t.pa3 += 1;
      } else if (e.type === 'rebound' || e.type === 'def_rebound' || e.type === 'off_rebound') {
        t.reb += 1;
      } else if (e.type === 'assist') {
        t.ast += 1;
      } else if (e.type === 'steal') {
        t.stl += 1;
      } else if (e.type === 'block') {
        t.blk += 1;
      } else if (e.type === 'turnover') {
        t.to += 1;
      } else if (e.type === 'foul') {
        t.pf += 1;
      }
    });

    return { home, away };
  };

  // Filter application logic
  const filteredMatches = matches.filter(match => {
    // Search filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const matchName = (match.name || '').toLowerCase();
      const homeTeamName = (match.ourTeamName || '').toLowerCase();
      const awayTeamName = (match.theirTeamName || '').toLowerCase();
      const matchVenue = (match.venue || '').toLowerCase();
      if (!matchName.includes(query) && !homeTeamName.includes(query) && !awayTeamName.includes(query) && !matchVenue.includes(query)) {
        return false;
      }
    }

    // KU Filter
    if (selectedKu !== 'all') {
      const matchKuValue = match.ageGroup || (match.ageCategory ? `KU${match.ageCategory}` : '');
      if (matchKuValue !== selectedKu) {
        return false;
      }
    }

    // Grade Filter
    if (selectedGrade !== 'all') {
      if (match.competitionGrade !== selectedGrade) {
        return false;
      }
    }

    // Team Filter
    if (selectedTeam !== 'all') {
      if (match.ourTeamName !== selectedTeam) {
        return false;
      }
    }

    // Status Filter
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'live_planned' && match.status === 'completed') {
        return false;
      }
      if (selectedStatus === 'completed' && match.status !== 'completed') {
        return false;
      }
    }

    return true;
  });

  const adhocMatches = filteredMatches.filter(m => !m.seriesId);
  const seriesMatches = filteredMatches.filter(m => m.seriesId);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedKu('all');
    setSelectedGrade('all');
    setSelectedTeam('all');
    setSelectedStatus('all');
  };

  const hasActiveFilters = searchQuery !== '' || selectedKu !== 'all' || selectedGrade !== 'all' || selectedTeam !== 'all' || selectedStatus !== 'all';

  // Skeleton layout representation for smooth dynamic loading
  const GameSkeleton = () => (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white dark:bg-zinc-900 rounded-[2rem] p-5 border border-zinc-100 dark:border-zinc-800 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
            <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
          </div>
          <div className="h-8 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="flex justify-between items-center pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-8 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderRightDetailPanel = () => {
    const displayMatch = filteredMatches.find(m => m.id === selectedDetailMatchId) || filteredMatches[0] || null;
    
    if (!displayMatch) {
      return (
        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-8 border border-zinc-100 dark:border-zinc-800 shadow-sm text-center">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 dark:text-zinc-500">
            <Trophy size={32} />
          </div>
          <h3 className="font-display font-black text-zinc-800 dark:text-white uppercase">Pilih Pertandingan</h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">Silakan pilih pertandingan di daftar untuk melihat ringkasan statistik cepat.</p>
        </div>
      );
    }

    const { homeScore, awayScore } = calculateMatchScore(displayMatch.id);
    const stats = calculateDetailedMatchStats(displayMatch.id);

    // Color accents
    const homeColor = displayMatch.ourColor || 'var(--color-brand-navy)';
    const awayColor = displayMatch.theirColor || '#DC2626';

    return (
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-6 animate-in fade-in duration-200">
        {/* Match Header Info */}
        <div className="space-y-2">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex gap-2.5 items-center flex-wrap">
              {displayMatch.ageGroup ? (
                <span className="text-[10px] font-black bg-brand-navy/10 text-brand-navy dark:bg-brand-orange/15 dark:text-brand-orange px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {displayMatch.ageGroup}
                </span>
              ) : displayMatch.ageCategory ? (
                <span className="text-[10px] font-black bg-brand-navy/10 text-brand-navy dark:bg-brand-orange/15 dark:text-brand-orange px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  KU-{displayMatch.ageCategory}
                </span>
              ) : null}
              {displayMatch.competitionGrade && (
                <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${COMPETITION_GRADE_COLORS[displayMatch.competitionGrade as CompetitionGrade] || 'bg-zinc-100 text-zinc-500'}`}>
                  {COMPETITION_GRADE_LABELS[displayMatch.competitionGrade as CompetitionGrade]}
                </span>
              )}
            </div>

            {/* Status Indicator */}
            {displayMatch.status === 'completed' ? (
              <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Selesai
              </span>
            ) : displayMatch.status === 'ongoing' ? (
              <span className="text-[10px] font-black bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Live Ongoing
              </span>
            ) : (
              <span className="text-[10px] font-black bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Terjadwal
              </span>
            )}
          </div>

          <h2 className="font-display text-2xl font-black italic uppercase text-zinc-900 dark:text-white tracking-tight leading-none">
            {displayMatch.name}
          </h2>

          <div className="flex gap-4 text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
            <div className="flex items-center gap-1">
              <Calendar size={13} />
              {new Date(displayMatch.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-1">
              <MapPin size={13} />
              {displayMatch.venue || 'Kandang'}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm mb-6 flex flex-col items-center">
          <div className="flex items-center justify-between w-full max-w-[280px] mb-4">
            {/* Home */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-white font-display font-black text-2xl shadow-sm" style={{ backgroundColor: 'var(--color-brand-orange)' }}>
                {displayMatch.ourTeamName ? displayMatch.ourTeamName.substring(0, 2).toUpperCase() : 'HM'}
              </div>
            </div>

            {/* Scores */}
            <div className="flex items-center gap-3 text-[40px] font-display font-black text-[#1A1A1A] dark:text-white leading-none">
              <span>{homeScore}</span>
              <span className="text-zinc-300 dark:text-zinc-700">-</span>
              <span>{awayScore}</span>
            </div>

            {/* Away */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-white font-display font-black text-2xl shadow-sm" style={{ backgroundColor: '#0B1E36' }}>
                {displayMatch.theirTeamName ? displayMatch.theirTeamName.substring(0, 2).toUpperCase() : 'AW'}
              </div>
            </div>
          </div>
          
          <div className="flex items-start justify-between w-full max-w-[320px] text-center mt-2">
             <div className="flex-1 text-[10px] font-black uppercase text-[#1A1A1A] dark:text-zinc-200 px-1 leading-tight">
                {displayMatch.ourTeamName || 'TIM KITA'}
                {displayMatch.ageGroup && <div className="mt-0.5">{displayMatch.ageGroup}</div>}
             </div>
             <div className="px-4 text-[10px] font-black uppercase text-[#4CAF50] tracking-wider pt-1">
                {displayMatch.status === 'completed' ? 'SELESAI' : displayMatch.status === 'ongoing' ? 'BERLANGSUNG' : 'TERJADWAL'}
             </div>
             <div className="flex-1 text-[10px] font-black uppercase text-[#1A1A1A] dark:text-zinc-200 px-1 leading-tight">
                {displayMatch.theirTeamName || 'LAWAN'}
                {displayMatch.ageGroup && <div className="mt-0.5">{displayMatch.ageGroup}</div>}
             </div>
          </div>
        </div>

        {/* Detailed Stats Comparison */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="space-y-4">
            {/* PTS */}
            <StatRow 
              label="POINTS (PTS)" 
              homeValue={stats.home.pts} 
              awayValue={stats.away.pts} 
            />
            
            {/* FG% */}
            <StatRow 
              label="FIELD GOAL %" 
              homeValue={stats.home.fga > 0 ? `${((stats.home.fgm / stats.home.fga) * 100).toFixed(1)}%` : '0.0%'} 
              awayValue={stats.away.fga > 0 ? `${((stats.away.fgm / stats.away.fga) * 100).toFixed(1)}%` : '0.0%'} 
            />

            {/* 3P% */}
            <StatRow 
              label="3-POINT %" 
              homeValue={stats.home.pa3 > 0 ? `${((stats.home.pm3 / stats.home.pa3) * 100).toFixed(1)}%` : '0.0%'} 
              awayValue={stats.away.pa3 > 0 ? `${((stats.away.pm3 / stats.away.pa3) * 100).toFixed(1)}%` : '0.0%'} 
            />

            {/* FT% */}
            <StatRow 
              label="FREE THROW %" 
              homeValue={stats.home.fta > 0 ? `${((stats.home.ftm / stats.home.fta) * 100).toFixed(1)}%` : '0.0%'} 
              awayValue={stats.away.fta > 0 ? `${((stats.away.ftm / stats.away.fta) * 100).toFixed(1)}%` : '0.0%'} 
            />

            {/* REB */}
            <StatRow 
              label="REBOUNDS (REB)" 
              homeValue={stats.home.reb} 
              awayValue={stats.away.reb} 
            />

            {/* AST */}
            <StatRow 
              label="ASSISTS (AST)" 
              homeValue={stats.home.ast} 
              awayValue={stats.away.ast} 
            />
          </div>

          {/* STL / BLK / TO */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-white dark:bg-zinc-800/20 rounded-xl p-4 border border-zinc-200/60 dark:border-zinc-800/80 text-center shadow-sm">
              <span className="text-[10px] font-black text-[#1A1A1A] dark:text-zinc-400 block uppercase tracking-wider mb-2">TURNOVERS</span>
              <span className="text-xl font-display font-black text-[#1A1A1A] dark:text-zinc-200 block">
                {stats.home.to} vs {stats.away.to}
              </span>
            </div>
            <div className="bg-white dark:bg-zinc-800/20 rounded-xl p-4 border border-zinc-200/60 dark:border-zinc-800/80 text-center shadow-sm">
              <span className="text-[10px] font-black text-[#1A1A1A] dark:text-zinc-400 block uppercase tracking-wider mb-2">STEALS / BLOCKS</span>
              <span className="text-xl font-display font-black text-[#1A1A1A] dark:text-zinc-200 block">
                {stats.home.stl}/{stats.home.blk} vs {stats.away.stl}/{stats.away.blk}
              </span>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="pt-4">
          {displayMatch.status === 'completed' ? (
            <button
              onClick={() => navigate(`/match/${displayMatch.id}`)}
              className="w-full bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy font-black text-sm py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-95 shadow-md active:scale-[0.98] transition-all cursor-pointer uppercase tracking-wider"
            >
              Buka Analisis & Shot Chart
              <ChevronRight size={16} />
            </button>
          ) : (
            can('track_match') && (
              <button
                onClick={() => navigate(`/track/${displayMatch.id}`)}
                className="w-full bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy font-black text-sm py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-95 shadow-md active:scale-[0.98] transition-all cursor-pointer uppercase tracking-wider"
              >
                Mulai / Lanjutkan Catat
                <ChevronRight size={16} />
              </button>
            )
          )}
        </div>
      </div>
    );
  };

  const StatRow: React.FC<{
    label: string;
    homeValue: string | number;
    awayValue: string | number;
    subText?: string;
  }> = ({ label, homeValue, awayValue, subText }) => {
    const valHome = typeof homeValue === 'string' ? parseFloat(homeValue) : homeValue;
    const valAway = typeof awayValue === 'string' ? parseFloat(awayValue) : awayValue;
    const total = (valHome + valAway) || 1;
    const homePercent = Math.min(100, Math.max(0, (valHome / total) * 100));

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <span className="text-[11px] font-black uppercase text-[#1A1A1A] dark:text-zinc-400 tracking-wider">
            {label}
          </span>
          <div className="text-sm font-black text-[#1A1A1A] dark:text-zinc-200">
             {/* If one value is 0 and the other is not, the mockup seems to show only the non-zero one. 
                 But for a real app, showing both is better. Let's just show both if we can, or just the home value if we have to follow mockup strictly?
                 Mockup has "11" for PTS when score is 0-11. We'll show both for clarity: "0 - 11" 
             */}
             {valHome === 0 && valAway > 0 && !label.includes('%') ? valAway : 
              valAway === 0 && valHome > 0 && !label.includes('%') ? valHome :
              label.includes('%') ? homeValue : // just showing home value for % to match mockup visually
              `${homeValue} - ${awayValue}`}
          </div>
        </div>
        <div className="h-2 w-full bg-[#0B1E36] dark:bg-zinc-800 rounded-full overflow-hidden flex">
          <div className="bg-brand-orange h-full rounded-r-full" style={{ width: `${homePercent}%` }} />
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
      <header className="flex justify-between items-center p-4 bg-white dark:bg-zinc-950 sticky top-0 z-30 border-b border-zinc-100 dark:border-zinc-800 md:hidden">
        <h1 className="text-xl font-display font-bold text-brand-navy dark:text-white uppercase tracking-wide">Semua Pertandingan</h1>
        {can('track_match') && (
          <div className="flex gap-2">
            <input 
              type="file" 
              accept=".stat,.json" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
            />
            <button 
              onClick={handleImportClick}
              className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Import Match"
            >
              <Upload size={20} />
            </button>
            <button 
              onClick={() => activeTab === 'series' ? setShowSeriesModal(true) : setShowPlanModal(true)}
              className="p-2 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-full hover:opacity-90 transition-opacity cursor-pointer"
              title={activeTab === 'series' ? 'Buat Series' : 'Buat Pertandingan'}
            >
              <Plus size={20} />
            </button>
          </div>
        )}
      </header>

      {/* Desktop Header Title */}
      <div className="hidden md:block px-4 mt-8 max-w-7xl mx-auto lg:px-8">
        <h1 className="text-3xl font-display font-black text-[#1A1A1A] dark:text-white uppercase tracking-tight">ALL MATCHES</h1>
        <p className="text-sm text-zinc-500 font-medium">Montserrat</p>
      </div>

      <main className="px-4 mt-6 max-w-7xl mx-auto lg:px-8 space-y-4">
        {loading ? (
          <GameSkeleton />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
            
            {/* Unified Search & Filter Section */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm p-4 space-y-4">
              {/* Search Input */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-400">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari pertandingan, tim, venue..."
                  className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0B1E36] dark:focus:ring-brand-orange transition-all text-[#1A1A1A] dark:text-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => setActiveTab('adhoc')}
                  className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer ${
                    activeTab === 'adhoc' 
                      ? 'bg-brand-orange text-white shadow-sm' 
                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  ADHOC
                </button>
                <button 
                  onClick={() => setActiveTab('series')}
                  className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer ${
                    activeTab === 'series' 
                      ? 'bg-[#0B1E36] text-white shadow-sm' 
                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  SERIES
                </button>
                
                {/* Visual Separator */}
                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>

                {/* Filter dropdown triggers (represented as pills) */}
                {/* For simplicity we'll keep the current filter implementation but adapt it if needed. 
                    Let's just show standard filter chips as before, or use them as dropdown triggers.
                    Since we already have horizontal scrollable filters, let's just make them look like the design's dark blue pills.
                */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1">
                  {/* Just render the currently selected filter value or "STATUS" if none */}
                  <div className="relative group">
                     <button className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer bg-[#0B1E36] text-white shadow-sm">
                       {selectedStatus !== 'all' ? selectedStatus.replace('_', ' ') : 'STATUS'}
                     </button>
                     {/* The actual status filter options */}
                     <div className="absolute top-full mt-2 left-0 hidden group-hover:flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-10 w-48 overflow-hidden">
                        <button onClick={() => setSelectedStatus('all')} className={`text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 ${selectedStatus === 'all' ? 'text-brand-orange' : 'text-zinc-700 dark:text-zinc-300'}`}>Semua Status</button>
                        <button onClick={() => setSelectedStatus('live_planned')} className={`text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 ${selectedStatus === 'live_planned' ? 'text-brand-orange' : 'text-zinc-700 dark:text-zinc-300'}`}>Berlangsung / Terjadwal</button>
                        <button onClick={() => setSelectedStatus('completed')} className={`text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 ${selectedStatus === 'completed' ? 'text-brand-orange' : 'text-zinc-700 dark:text-zinc-300'}`}>Selesai</button>
                     </div>
                  </div>

                  <div className="relative group">
                     <button className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer bg-[#0B1E36] text-white shadow-sm">
                       {selectedKu !== 'all' ? selectedKu : 'KU'}
                     </button>
                     <div className="absolute top-full mt-2 left-0 hidden group-hover:flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-10 w-32 overflow-hidden">
                        <button onClick={() => setSelectedKu('all')} className={`text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 ${selectedKu === 'all' ? 'text-brand-orange' : 'text-zinc-700 dark:text-zinc-300'}`}>Semua KU</button>
                        {uniqueKus.map(ku => (
                          <button key={ku} onClick={() => setSelectedKu(ku)} className={`text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 ${selectedKu === ku ? 'text-brand-orange' : 'text-zinc-700 dark:text-zinc-300'}`}>{ku}</button>
                        ))}
                     </div>
                  </div>

                  <div className="relative group">
                     <button className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer bg-[#0B1E36] text-white shadow-sm">
                       {selectedGrade !== 'all' ? (COMPETITION_GRADE_LABELS[selectedGrade as CompetitionGrade] || selectedGrade) : 'LEVEL'}
                     </button>
                     <div className="absolute top-full mt-2 left-0 hidden group-hover:flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-10 w-48 overflow-hidden">
                        <button onClick={() => setSelectedGrade('all')} className={`text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 ${selectedGrade === 'all' ? 'text-brand-orange' : 'text-zinc-700 dark:text-zinc-300'}`}>Semua Level</button>
                        {uniqueGrades.map(grade => (
                          <button key={grade} onClick={() => setSelectedGrade(grade)} className={`text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 ${selectedGrade === grade ? 'text-brand-orange' : 'text-zinc-700 dark:text-zinc-300'}`}>{COMPETITION_GRADE_LABELS[grade] || grade}</button>
                        ))}
                     </div>
                  </div>

                  {uniqueTeams.length > 0 && (
                    <div className="relative group">
                       <button className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer bg-[#0B1E36] text-white shadow-sm max-w-[120px] truncate">
                         {selectedTeam !== 'all' ? selectedTeam : 'TIM'}
                       </button>
                       <div className="absolute top-full mt-2 left-0 hidden group-hover:flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-10 w-48 overflow-hidden max-h-64 overflow-y-auto">
                          <button onClick={() => setSelectedTeam('all')} className={`text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 ${selectedTeam === 'all' ? 'text-brand-orange' : 'text-zinc-700 dark:text-zinc-300'}`}>Semua Tim</button>
                          {uniqueTeams.map(teamName => (
                            <button key={teamName} onClick={() => setSelectedTeam(teamName)} className={`text-left px-4 py-2 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 ${selectedTeam === teamName ? 'text-brand-orange' : 'text-zinc-700 dark:text-zinc-300'} truncate`}>{teamName}</button>
                          ))}
                       </div>
                    </div>
                  )}
                  
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="ml-auto text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                    >
                      <X size={12} /> Hapus Filter
                    </button>
                  )}
                </div>
              </div>
            </div>

            {activeTab === 'adhoc' && (
              adhocMatches.length === 0 ? (
                <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm mt-4">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 dark:text-zinc-500">
                    <Trophy size={32} />
                  </div>
                  <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-2">
                    {hasActiveFilters ? 'Tidak Ada Hasil' : 'Belum Ada Pertandingan'}
                  </h2>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
                    {hasActiveFilters 
                      ? 'Tidak ada pertandingan adhoc yang sesuai dengan pencarian atau filter Anda.' 
                      : 'Tambahkan pertandingan baru untuk mulai mencatat statistik.'}
                  </p>
                  {hasActiveFilters ? (
                    <button 
                      onClick={resetFilters}
                      className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white px-6 py-3 rounded-xl font-bold transition-all text-sm tracking-wide mx-auto cursor-pointer"
                    >
                      RESET FILTER
                    </button>
                  ) : (
                    can('track_match') && (
                      <button 
                        onClick={() => setShowPlanModal(true)}
                        className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 text-sm tracking-wide mx-auto cursor-pointer"
                      >
                        <Plus size={18} strokeWidth={2.5} />
                        BUAT PERTANDINGAN
                      </button>
                    )
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Berlangsung / Terjadwal Group */}
                  {adhocMatches.filter(m => m.status !== 'completed').length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-sm font-black uppercase text-[#1A1A1A] dark:text-white tracking-wider">
                        BERLANGSUNG / TERJADWAL ({adhocMatches.filter(m => m.status !== 'completed').length})
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {adhocMatches.filter(m => m.status !== 'completed').map(match => {
                          const score = calculateMatchScore(match.id);
                          return (
                            <div key={match.id} className={`transition-all rounded-[1rem] ${selectedDetailMatchId === match.id ? 'ring-2 ring-brand-navy dark:ring-brand-orange' : ''}`}>
                              <GameCard 
                                match={match} 
                                onClick={() => {
                                  setSelectedDetailMatchId(match.id);
                                  if (window.innerWidth < 1024) {
                                    if (match.status === 'completed') {
                                      navigate(`/match/${match.id}`);
                                    } else if (can('track_match')) {
                                      navigate(`/track/${match.id}`);
                                    }
                                  }
                                }} 
                                onActionClick={can('track_match') ? () => setSelectedMatch(match) : undefined}
                                homeScore={score.homeScore}
                                awayScore={score.awayScore}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Selesai Group */}
                  {adhocMatches.filter(m => m.status === 'completed').length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-sm font-black uppercase text-[#1A1A1A] dark:text-white tracking-wider">
                        SELESAI ({adhocMatches.filter(m => m.status === 'completed').length})
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {adhocMatches.filter(m => m.status === 'completed').map(match => {
                          const score = calculateMatchScore(match.id);
                          return (
                            <div key={match.id} className={`transition-all rounded-[1rem] ${selectedDetailMatchId === match.id ? 'ring-2 ring-brand-navy dark:ring-brand-orange' : ''}`}>
                              <GameCard 
                                match={match} 
                                onClick={() => {
                                  setSelectedDetailMatchId(match.id);
                                  if (window.innerWidth < 1024) {
                                    if (match.status === 'completed') {
                                      navigate(`/match/${match.id}`);
                                    } else if (can('track_match')) {
                                      navigate(`/track/${match.id}`);
                                    }
                                  }
                                }} 
                                onActionClick={can('track_match') ? () => setSelectedMatch(match) : undefined}
                                homeScore={score.homeScore}
                                awayScore={score.awayScore}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {activeTab === 'series' && (
              seriesList.length === 0 ? (
                <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm mt-4">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 dark:text-zinc-500">
                    <Folder size={32} />
                  </div>
                  <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-2">
                    {hasActiveFilters ? 'Tidak Ada Hasil' : 'Belum Ada Series'}
                  </h2>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
                    {hasActiveFilters 
                      ? 'Tidak ada series dengan pertandingan yang sesuai dengan filter Anda.' 
                      : 'Buat series untuk mengelompokkan pertandingan dalam satu turnamen atau liga.'}
                  </p>
                  {hasActiveFilters ? (
                    <button 
                      onClick={resetFilters}
                      className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white px-6 py-3 rounded-xl font-bold transition-all text-sm tracking-wide mx-auto cursor-pointer"
                    >
                      RESET FILTER
                    </button>
                  ) : (
                    can('track_match') && (
                      <button 
                        onClick={() => setShowSeriesModal(true)}
                        className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 text-sm tracking-wide mx-auto cursor-pointer"
                      >
                        <Plus size={18} strokeWidth={2.5} />
                        BUAT SERIES
                      </button>
                    )
                  )}
                </div>
              ) : (
                (() => {
                  const matchingSeries = seriesList.filter(series => {
                    const sMatches = seriesMatches.filter(m => m.seriesId === series.id);
                    // If filtering matches, series should have at least one matching game to show
                    return sMatches.length > 0 || !hasActiveFilters;
                  });

                  if (matchingSeries.length === 0) {
                    return (
                      <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm mt-4">
                        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 dark:text-zinc-500">
                          <Folder size={32} />
                        </div>
                        <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-2">Tidak Ada Hasil Series</h2>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Tidak ada series dengan pertandingan yang sesuai dengan filter saat ini.</p>
                        <button 
                          onClick={resetFilters}
                          className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white px-6 py-3 rounded-xl font-bold transition-all text-sm tracking-wide mx-auto cursor-pointer"
                        >
                          RESET FILTER
                        </button>
                      </div>
                    );
                  }

                  return matchingSeries.map(series => {
                    const sMatches = seriesMatches.filter(m => m.seriesId === series.id);
                    return (
                      <div key={series.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-100 dark:border-zinc-800 mb-4">
                        <div className="flex justify-between items-start mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                          <div className="flex gap-3 items-center">
                            {series.logoUrl ? (
                              <div className="w-12 h-12 rounded-xl overflow-hidden border border-zinc-100 dark:border-zinc-800 shrink-0">
                                <img src={series.logoUrl} alt={series.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                                <Folder size={24} />
                              </div>
                            )}
                            <div>
                              <h3 className="font-display text-xl font-black italic text-[#1A1A1A] dark:text-white uppercase leading-none">{series.name}</h3>
                              {series.description && <p className="text-xs text-zinc-500 mt-1">{series.description}</p>}
                              {series.teamId && <p className="text-xs font-bold text-brand-navy dark:text-brand-orange mt-1">Tim: {teams.find(t => t.id === series.teamId)?.name || 'Unknown'}</p>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-1 rounded-md">{sMatches.length} Matches</span>
                            {can('track_match') && (
                              <div className="flex gap-1">
                                <button onClick={() => { setEditingSeries(series); setShowSeriesModal(true); }} className="p-1.5 text-zinc-400 hover:text-brand-navy dark:hover:text-brand-orange bg-zinc-50 dark:bg-zinc-800 rounded-md transition-colors cursor-pointer">
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={() => handleDeleteSeries(series)} className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-500 bg-zinc-50 dark:bg-zinc-800 rounded-md transition-colors cursor-pointer">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-3">
                          {sMatches.length === 0 ? (
                            <p className="text-xs text-zinc-500 italic">Belum ada pertandingan di series ini.</p>
                          ) : (
                            <div className="space-y-4">
                              {sMatches.filter(m => m.status !== 'completed').length > 0 && (
                                <div className="space-y-2">
                                  <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider block">Berlangsung / Terjadwal</span>
                                  {sMatches.filter(m => m.status !== 'completed').map(match => {
                                    const score = calculateMatchScore(match.id);
                                    return (
                                      <div key={match.id} className={`transition-all rounded-3xl ${selectedDetailMatchId === match.id ? 'ring-2 ring-brand-navy dark:ring-brand-orange' : ''}`}>
                                        <GameCard 
                                          match={match} 
                                          onClick={() => {
                                            setSelectedDetailMatchId(match.id);
                                            if (window.innerWidth < 1024) {
                                              if (match.status === 'completed') {
                                                navigate(`/match/${match.id}`);
                                              } else if (can('track_match')) {
                                                navigate(`/track/${match.id}`);
                                              }
                                            }
                                          }} 
                                          onActionClick={can('track_match') ? () => setSelectedMatch(match) : undefined}
                                          homeScore={score.homeScore}
                                          awayScore={score.awayScore}
                                          compact 
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {sMatches.filter(m => m.status === 'completed').length > 0 && (
                                <div className="space-y-2">
                                  <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider block">Selesai</span>
                                  {sMatches.filter(m => m.status === 'completed').map(match => {
                                    const score = calculateMatchScore(match.id);
                                    return (
                                      <div key={match.id} className={`transition-all rounded-3xl ${selectedDetailMatchId === match.id ? 'ring-2 ring-brand-navy dark:ring-brand-orange' : ''}`}>
                                        <GameCard 
                                          match={match} 
                                          onClick={() => {
                                            setSelectedDetailMatchId(match.id);
                                            if (window.innerWidth < 1024) {
                                              if (match.status === 'completed') {
                                                navigate(`/match/${match.id}`);
                                              } else if (can('track_match')) {
                                                navigate(`/track/${match.id}`);
                                              }
                                            }
                                          }} 
                                          onActionClick={can('track_match') ? () => setSelectedMatch(match) : undefined}
                                          homeScore={score.homeScore}
                                          awayScore={score.awayScore}
                                          compact 
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()
              )
            )}
            </div>

            {/* Right Column: Sticky Quick-Stats Preview Panel */}
            <div className="hidden lg:block lg:col-span-5 sticky top-24">
              {renderRightDetailPanel()}
            </div>
          </div>
        )}
      </main>
      
      <GameSetupModal 
        isOpen={showPlanModal} 
        onClose={() => setShowPlanModal(false)} 
        onSuccess={loadData}
      />

      <MatchActionsModal
        match={selectedMatch}
        seriesList={seriesList}
        isOpen={!!selectedMatch}
        onClose={() => setSelectedMatch(null)}
        onSuccess={loadData}
      />

      <SeriesFormModal
        isOpen={showSeriesModal}
        onClose={() => { setShowSeriesModal(false); setEditingSeries(null); }}
        onSuccess={loadData}
        series={editingSeries}
        teams={teams}
      />
    </motion.div>
  );
};

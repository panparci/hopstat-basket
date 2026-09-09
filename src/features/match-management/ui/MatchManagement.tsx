import React, { useState, useEffect, useMemo } from 'react';
import { statsService } from '../../../core/services/statsService';
import { Match, Team, Series } from '../../../core/types/stats';
import { CompetitionGrade, COMPETITION_GRADE_LABELS } from '../../../core/config/competition';
import { useToast } from '../../../core/contexts/ToastContext';
import { 
  Plus, Search, Filter, Trash2, Edit2, Calendar, MapPin, 
  MoreVertical, Trophy, RefreshCw, X, FileText, LayoutGrid, List, BarChart3, Clock, PlayCircle
} from 'lucide-react';
import { GameSetupModal } from '../../../components/organisms/GameSetupModal';
import { EditMatchModal } from '../../../components/organisms/EditMatchModal';
import { MatchActionsModal } from '../../../components/organisms/MatchActionsModal';
import { Button } from '../../../shared/ui/Button';
import { requestService } from '../../../services/requestService';

export const MatchManagement: React.FC = () => {
  const { showToast } = useToast();

  // Data states
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKU, setFilterKU] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterOurTeam, setFilterOurTeam] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Modals active states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  
  // Selected states for modals
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  // Load data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allMatches, allTeams, allSeries, allRequests] = await Promise.all([
        statsService.getMatches(),
        statsService.getTeams(),
        statsService.getSeriesAll(),
        requestService.getAllRequests()
      ]);
      setMatches(allMatches);
      setTeams(allTeams);
      setSeriesList(allSeries);
      setRequests(allRequests);
    } catch (err) {
      console.error('Failed to load matches data', err);
      showToast('Gagal memuat data pertandingan', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestStats = async (match: Match) => {
    if (!match.videoUrl || match.videoUrl.trim() === '') {
      showToast('Wajib mengisi Link Video (YouTube) terlebih dahulu!', 'error');
      return;
    }

    // Check duplicate
    const activeRequest = requests.find(r => r.matchId === match.id);
    if (activeRequest) {
      showToast('Sudah ada request statistik aktif untuk match ini!', 'error');
      return;
    }

    try {
      // Get rosters for match
      const rosters = await statsService.getMatchRosters(match.id);
      
      // Create request via requestService
      await requestService.createBackOfficeRequest(match, rosters);
      
      showToast('Berhasil mengirim permintaan statistik ke antrean back-office!', 'success');
      // Reload data to reflect
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Gagal memproses permintaan statistik', 'error');
    }
  };

  const getProductionStageBadge = (stage?: 'tracking' | 'qa_review' | 'coach_analysis' | 'published') => {
    const currentStage = stage || 'tracking';
    switch (currentStage) {
      case 'tracking':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300 border border-slate-200/80 dark:border-zinc-700">
            📊 Tracking
          </span>
        );
      case 'qa_review':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100/90 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80">
            🔍 QA Review
          </span>
        );
      case 'coach_analysis':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-100/90 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80">
            🧠 Coach Analysis
          </span>
        );
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-teal-100/90 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/80">
            🌐 Published
          </span>
        );
      default:
        return null;
    }
  };

  const getVideoUrlIndicator = (videoUrl?: string) => {
    if (videoUrl && videoUrl.trim() !== '') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100/80 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/80" title={videoUrl}>
          🎥 Set (YouTube)
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100/90 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/80" title="Link video kosong">
          ⚠️ No Video
        </span>
      );
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter logic
  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
      // 1. Text Search (nama event, nama tim, venue)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const eventName = (match.eventName || '').toLowerCase();
        const homeName = (match.ourTeamName || '').toLowerCase();
        const awayName = (match.theirTeamName || '').toLowerCase();
        const venueName = (match.venue || '').toLowerCase();
        const matchName = (match.name || '').toLowerCase();

        if (
          !eventName.includes(query) &&
          !homeName.includes(query) &&
          !awayName.includes(query) &&
          !venueName.includes(query) &&
          !matchName.includes(query)
        ) {
          return false;
        }
      }

      // 2. KU Category Filter
      if (filterKU !== 'all') {
        const matchKUValue = match.matchKU !== undefined ? `KU-${match.matchKU}` : (match.ageGroup || '');
        if (matchKUValue !== filterKU) {
          return false;
        }
      }

      // 3. Competition Grade Filter
      if (filterGrade !== 'all') {
        if (match.competitionGrade !== filterGrade) {
          return false;
        }
      }

      // 4. Status Filter
      if (filterStatus !== 'all') {
        if (match.status !== filterStatus) {
          return false;
        }
      }

      // 5. Our Team Filter (dropdown tim kita)
      if (filterOurTeam !== 'all') {
        if (match.ourTeamName !== filterOurTeam && match.teamId !== filterOurTeam) {
          return false;
        }
      }

      // 6. Date Range Filter
      if (startDate !== '') {
        const matchTime = new Date(match.date).getTime();
        const startThreshold = new Date(startDate).getTime();
        if (matchTime < startThreshold) {
          return false;
        }
      }

      if (endDate !== '') {
        const matchTime = new Date(match.date).getTime();
        // End of the day for proper inclusive date check
        const endThreshold = new Date(endDate).setHours(23, 59, 59, 999);
        if (matchTime > endThreshold) {
          return false;
        }
      }

      return true;
    });
  }, [matches, searchQuery, filterKU, filterGrade, filterStatus, filterOurTeam, startDate, endDate]);

  // Extract unique filter categories
  const uniqueKus = useMemo(() => {
    const kus = new Set<string>();
    matches.forEach(m => {
      const kuValue = m.matchKU !== undefined ? `KU-${m.matchKU}` : (m.ageGroup || '');
      if (kuValue) kus.add(kuValue);
    });
    return Array.from(kus).sort();
  }, [matches]);

  const uniqueOurTeams = useMemo(() => {
    const tNames = new Set<string>();
    matches.forEach(m => {
      if (m.ourTeamName) tNames.add(m.ourTeamName);
    });
    return Array.from(tNames).sort();
  }, [matches]);

  // KPI calculations
  const stats = useMemo(() => {
    const total = matches.length;
    const completed = matches.filter(m => m.status === 'completed').length;
    const ongoing = matches.filter(m => m.status === 'ongoing').length;
    const planned = matches.filter(m => m.status === 'planned').length;
    const aborted = matches.filter(m => m.status === 'aborted').length;
    return { total, completed, ongoing, planned, aborted };
  }, [matches]);

  const resetFilters = () => {
    setSearchQuery('');
    setFilterKU('all');
    setFilterGrade('all');
    setFilterStatus('all');
    setFilterOurTeam('all');
    setStartDate('');
    setEndDate('');
  };

  const handleOpenEdit = (match: Match) => {
    setSelectedMatch(match);
    setIsEditOpen(true);
  };

  const handleOpenActions = (match: Match) => {
    setSelectedMatch(match);
    setIsActionsOpen(true);
  };

  const getStatusBadge = (status: Match['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/90 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Completed
          </span>
        );
      case 'ongoing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100/90 text-amber-900 border border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Ongoing
          </span>
        );
      case 'planned':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100/90 text-sky-800 border border-sky-200/80 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Planned
          </span>
        );
      case 'aborted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100/90 text-rose-800 border border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Aborted
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-black text-slate-800 dark:text-white leading-tight">
            Manajemen <span className="text-[#2B889B] dark:text-teal-400">Pertandingan</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Kelola seluruh riwayat, jadwal, dan rekaman pertandingan secara global.
          </p>
        </div>
        <div>
          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="w-full sm:w-auto bg-[#2B889B] hover:bg-[#226F7F] text-white px-5 py-3 rounded-full flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all scale-100 hover:scale-[1.02]"
          >
            <Plus size={16} /> Buat Pertandingan
          </Button>
        </div>
      </div>

      {/* KPI Stats Panel - Soft SaaS Gradient Style */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* HERO CARD: Total Match */}
        <div className="bg-gradient-to-br from-[#2B889B] to-[#1D6372] text-white p-5 rounded-[28px] shadow-lg relative overflow-hidden flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between relative z-10">
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center text-white">
              <Trophy size={18} />
            </div>
            <span className="text-[10px] font-bold bg-white/20 backdrop-blur px-2 py-0.5 rounded-full uppercase tracking-wider">Overall</span>
          </div>
          <div className="mt-4 relative z-10">
            <div className="text-xs font-semibold text-slate-100/90">Total Match</div>
            <div className="text-3xl md:text-4xl font-black font-display tracking-tight text-white mt-0.5">{stats.total}</div>
          </div>
          {/* Decorative watermark icon */}
          <svg className="absolute -right-3 -bottom-3 w-24 h-24 text-white/10 pointer-events-none" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="23" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M5 25 H 45" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M25 5 V 45" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>

        {/* Completed Card */}
        <div className="bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-emerald-500/5 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-400/25 p-5 rounded-[28px] shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Clock size={18} />
          </div>
          <div className="mt-3">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Completed</div>
            <div className="text-2xl md:text-3xl font-black font-display text-emerald-700 dark:text-emerald-400 mt-0.5">{stats.completed}</div>
          </div>
        </div>

        {/* Ongoing Card - Soft Apricot/Peach */}
        <div className="bg-gradient-to-br from-[#FDE2D1] via-[#FCE9DD] to-[#F9D8C6] dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-300/50 p-5 rounded-[28px] shadow-sm flex flex-col justify-between text-slate-900 dark:text-slate-100">
          <div className="w-9 h-9 rounded-full bg-amber-400/30 text-amber-900 dark:text-amber-300 flex items-center justify-center">
            <PlayCircle size={18} />
          </div>
          <div className="mt-3">
            <div className="text-xs font-bold text-slate-700 dark:text-amber-300">Ongoing</div>
            <div className="text-2xl md:text-3xl font-black font-display text-amber-950 dark:text-amber-400 mt-0.5">{stats.ongoing}</div>
          </div>
        </div>

        {/* Planned Card */}
        <div className="bg-gradient-to-br from-sky-500/15 via-sky-500/10 to-sky-500/5 dark:from-sky-950/40 dark:to-sky-900/20 border border-sky-400/25 p-5 rounded-[28px] shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <Calendar size={18} />
          </div>
          <div className="mt-3">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Planned</div>
            <div className="text-2xl md:text-3xl font-black font-display text-sky-700 dark:text-sky-400 mt-0.5">{stats.planned}</div>
          </div>
        </div>

        {/* Aborted Card */}
        <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-rose-500/15 via-rose-500/10 to-rose-500/5 dark:from-rose-950/40 dark:to-rose-900/20 border border-rose-400/25 p-5 rounded-[28px] shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <X size={18} />
          </div>
          <div className="mt-3">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Aborted</div>
            <div className="text-2xl md:text-3xl font-black font-display text-rose-700 dark:text-rose-400 mt-0.5">{stats.aborted}</div>
          </div>
        </div>
      </div>

      {/* Advanced Filter Box - Soft SaaS Style */}
      <div className="bg-slate-50/80 dark:bg-zinc-850/80 rounded-[28px] border border-slate-200/80 dark:border-zinc-800 p-6 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          {/* Text Search */}
          <div className="flex-1 relative">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Search size={18} />
            </span>
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama event, nama tim, venue..."
              className="w-full pl-11 pr-10 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-full text-sm focus:ring-2 focus:ring-[#2B889B] outline-none font-medium text-slate-800 dark:text-white transition-all shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex bg-white dark:bg-zinc-900 p-1.5 rounded-full border border-slate-200 dark:border-zinc-700 self-start md:self-auto gap-1 shadow-sm">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-full transition-all cursor-pointer ${viewMode === 'list' ? 'bg-[#2B889B] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              title="List View"
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-full transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-[#2B889B] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              title="Grid View"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {/* Extended Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-1">
          {/* KU */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Kategori Umur</label>
            <select
              value={filterKU}
              onChange={(e) => setFilterKU(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-[#2B889B]"
            >
              <option value="all">Semua KU</option>
              {uniqueKus.map(ku => (
                <option key={ku} value={ku}>{ku}</option>
              ))}
            </select>
          </div>

          {/* Grade */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Tingkat Kompetisi</label>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-[#2B889B]"
            >
              <option value="all">Semua Tingkat</option>
              {Object.entries(COMPETITION_GRADE_LABELS).map(([grade, label]) => (
                <option key={grade} value={grade}>{label}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Status Match</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-[#2B889B]"
            >
              <option value="all">Semua Status</option>
              <option value="planned">Planned</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="aborted">Aborted</option>
            </select>
          </div>

          {/* Our Team */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Tim Kita</label>
            <select
              value={filterOurTeam}
              onChange={(e) => setFilterOurTeam(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-[#2B889B]"
            >
              <option value="all">Semua Tim Kita</option>
              {uniqueOurTeams.map(tName => (
                <option key={tName} value={tName}>{tName}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Dari Tanggal</label>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-[#2B889B]"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">Hingga Tanggal</label>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-[#2B889B]"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {(searchQuery || filterKU !== 'all' || filterGrade !== 'all' || filterStatus !== 'all' || filterOurTeam !== 'all' || startDate || endDate) && (
          <div className="flex justify-end pt-2">
            <button 
              onClick={resetFilters}
              className="text-xs font-black uppercase tracking-widest text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={12} /> Reset Semua Filter
            </button>
          </div>
        )}
      </div>

      {/* Main Listing View */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800">
          <div className="w-10 h-10 border-4 border-brand-navy border-t-transparent dark:border-brand-orange rounded-full animate-spin" />
          <p className="text-zinc-400 text-xs font-bold mt-4 uppercase tracking-wider">Memuat data pertandingan...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 text-center">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-full text-zinc-400 mb-4">
            <Trophy size={40} />
          </div>
          <h3 className="font-display font-black text-xl text-zinc-800 dark:text-white uppercase">Tidak Ada Pertandingan</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm mx-auto">
            Tidak ditemukan pertandingan yang cocok dengan filter aktif Anda.
          </p>
          <Button 
            onClick={resetFilters} 
            className="mt-6 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-4 py-2.5 rounded-xl uppercase text-xs tracking-wider cursor-pointer"
          >
            Clear Filters
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Bento Grid Layout */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMatches.map(match => (
            <div 
              key={match.id}
              className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col justify-between hover:shadow-lg dark:hover:shadow-zinc-900/50 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  {getStatusBadge(match.status)}
                  <span className="text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-md uppercase tracking-widest">
                    {match.recordingType === 'single' ? 'Single Player' : match.recordingType === 'team' ? 'Team' : 'Full Match'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {getVideoUrlIndicator(match.videoUrl)}
                  {getProductionStageBadge(match.productionStage)}
                </div>

                <div className="space-y-1">
                  {match.eventName && (
                    <div className="text-[10px] font-black text-brand-navy dark:text-brand-orange uppercase tracking-widest">
                      {match.eventName}
                    </div>
                  )}
                  <h3 className="font-display font-black italic text-xl text-zinc-800 dark:text-white uppercase leading-tight group-hover:text-brand-navy dark:group-hover:text-brand-orange transition-colors">
                    {match.name || `${match.ourTeamName} vs ${match.theirTeamName}`}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 py-4 border-y border-zinc-100 dark:border-zinc-800">
                  <div>
                    <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Tim Kita</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: match.ourColor || 'var(--color-brand-navy)' }} />
                      <span className="text-sm font-bold text-zinc-800 dark:text-white truncate">{match.ourTeamName || 'Tim Kita'}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Lawan</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: match.theirColor || 'var(--color-brand-orange)' }} />
                      <span className="text-sm font-bold text-zinc-800 dark:text-white truncate">{match.theirTeamName || 'Lawan'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                    <Calendar size={14} className="shrink-0" />
                    <span>{new Date(match.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                    <MapPin size={14} className="shrink-0" />
                    <span className="truncate">{match.venue || 'Kandang'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <Button 
                  onClick={() => handleOpenEdit(match)}
                  className="flex-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Edit2 size={13} /> Edit
                </Button>
                {requests.some(r => r.matchId === match.id) ? (
                  <span className="px-3 py-2 text-center text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/40 rounded-full border border-emerald-200/80 flex-1">
                    Requested
                  </span>
                ) : (
                  <Button
                    onClick={() => handleRequestStats(match)}
                    className="flex-1 bg-[#2B889B] hover:bg-[#226F7F] text-white py-2.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer shadow-sm transition-all"
                  >
                    Minta Statistik
                  </Button>
                )}
                <Button 
                  onClick={() => handleOpenActions(match)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 p-2.5 rounded-full cursor-pointer transition-colors"
                  title="More actions"
                >
                  <MoreVertical size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Tabular List Layout */
        <div className="bg-white dark:bg-zinc-900 rounded-[28px] border border-slate-200/80 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/40">
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Pertandingan</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Jadwal & Lokasi</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Kategori</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Video</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Prod. Stage</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                  <th className="p-4 md:p-5 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {filteredMatches.map(match => (
                  <tr key={match.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-950/20 transition-colors">
                    <td className="p-4 md:p-5">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-full bg-[#2B889B]/10 dark:bg-[#2B889B]/20 flex items-center justify-center text-[#2B889B] dark:text-teal-400 shrink-0">
                          <Trophy size={18} />
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-display font-bold text-base md:text-lg text-slate-800 dark:text-white hover:text-[#2B889B] transition-colors">
                            {match.name || `${match.ourTeamName} vs ${match.theirTeamName}`}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                            <span className="flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-full inline-block border border-slate-200" style={{ backgroundColor: match.ourColor || '#2B889B' }} />
                              {match.ourTeamName}
                            </span>
                            <span className="text-slate-400 font-bold">vs</span>
                            <span className="flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-full inline-block border border-slate-200" style={{ backgroundColor: match.theirColor || '#E5A990' }} />
                              {match.theirTeamName}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 md:p-5">
                      <div className="space-y-1 text-xs font-semibold text-slate-600 dark:text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          <span>{new Date(match.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{match.venue || 'Kandang'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 md:p-5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {match.matchKU !== undefined ? `KU-${match.matchKU}` : (match.ageGroup || 'Umur Bebas')}
                        </span>
                        {match.competitionGrade && (
                          <span className="text-[10px] font-bold text-[#2B889B] dark:text-teal-400">
                            {COMPETITION_GRADE_LABELS[match.competitionGrade as CompetitionGrade]}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 md:p-5 text-center">
                      {getVideoUrlIndicator(match.videoUrl)}
                    </td>

                    <td className="p-4 md:p-5 text-center">
                      {getProductionStageBadge(match.productionStage)}
                    </td>

                    <td className="p-4 md:p-5 text-center">
                      {getStatusBadge(match.status)}
                    </td>

                    <td className="p-4 md:p-5">
                      <div className="flex items-center justify-end gap-2">
                        {requests.some(r => r.matchId === match.id) ? (
                          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 whitespace-nowrap">
                            Requested
                          </span>
                        ) : (
                          <Button
                            onClick={() => handleRequestStats(match)}
                            className="bg-[#2B889B] hover:bg-[#226F7F] text-white px-4 py-2 rounded-full text-xs font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap"
                          >
                            Minta Statistik
                          </Button>
                        )}
                        <Button 
                          onClick={() => handleOpenEdit(match)}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 p-2 rounded-full transition-colors cursor-pointer"
                          title="Edit match configuration"
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button 
                          onClick={() => handleOpenActions(match)}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 p-2 rounded-full transition-colors cursor-pointer"
                          title="Actions and cascade delete"
                        >
                          <MoreVertical size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      
      {/* 1. Create Match Modal */}
      <GameSetupModal 
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={loadData}
        isAdmin={true}
      />

      {/* 2. Edit Match Modal */}
      {selectedMatch && isEditOpen && (
        <EditMatchModal 
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setSelectedMatch(null);
          }}
          match={selectedMatch}
          onSuccess={loadData}
        />
      )}

      {/* 3. Match Actions and Cascade Delete Modal */}
      {selectedMatch && isActionsOpen && (
        <MatchActionsModal 
          match={selectedMatch}
          isOpen={isActionsOpen}
          onClose={() => {
            setIsActionsOpen(false);
            setSelectedMatch(null);
          }}
          seriesList={seriesList}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};

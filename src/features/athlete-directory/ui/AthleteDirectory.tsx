import React, { useState, useEffect } from 'react';
import { statsService } from '../../../core/services/statsService';
import { authService } from '../../../services/authService';
import { mergeService } from '../../merge-player/model/mergeService';
import { ChildProfile, Team, Club, Match, MatchRoster } from '../../../core/types/stats';
import { UserAccount } from '../../../core/types/serviceRequests';
import { getCurrentKU } from '../../../core/utils/ageCalculator';
import { useToast } from '../../../core/contexts/ToastContext';
import { Button } from '../../../shared/ui/Button';
import { 
  Plus, Search, Filter, Eye, Edit2, Link, ArrowRightLeft, 
  Trash2, ToggleLeft, ToggleRight, CheckCircle, Clock, AlertCircle, RefreshCw, Sparkles, UserCheck 
} from 'lucide-react';
import { AthleteDetailsModal } from './AthleteDetailsModal';
import { LinkGuardianModal } from './LinkGuardianModal';
import { AddAthleteModal } from './AddAthleteModal';
import { MergePlayerModal } from '../../merge-player/ui/MergePlayerModal';
import { Avatar } from '../../../shared/ui/Avatar';

export const AthleteDirectory: React.FC = () => {
  const { showToast } = useToast();

  // Data states
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [potentialDuplicates, setPotentialDuplicates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Match statistics for Tercatat tab
  const [allRosters, setAllRosters] = useState<MatchRoster[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);

  // Active Tab state: 'terkelola' | 'tercatat'
  const [activeTab, setActiveTab] = useState<'terkelola' | 'tercatat'>('terkelola');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKU, setFilterKU] = useState<string>('all');
  const [filterClub, setFilterClub] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Modal active states
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState<ChildProfile | null>(null);

  const [isLinkGuardianOpen, setIsLinkGuardianOpen] = useState(false);

  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [athleteToEdit, setAthleteToEdit] = useState<ChildProfile | null>(null);

  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergePrimaryId, setMergePrimaryId] = useState('');
  const [mergeSecondaryId, setMergeSecondaryId] = useState('');

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allProfiles, allClubs, allTeams, allUsers, currUser, rosters, matches] = await Promise.all([
        statsService.getProfiles(),
        statsService.getClubs(),
        statsService.getTeams(),
        authService.getAllUsers(),
        authService.getCurrentUser(),
        statsService.getAllMatchRosters(),
        statsService.getMatches()
      ]);

      setProfiles(allProfiles);
      setClubs(allClubs);
      setTeams(allTeams);
      setUsers(allUsers);
      setCurrentUser(currUser);
      setAllRosters(rosters);
      setAllMatches(matches);

      // Load potential duplicates for merge button check
      const dups = await mergeService.getPotentialDuplicates();
      setPotentialDuplicates(dups);
    } catch (err) {
      console.error('Failed to load Athlete Directory data', err);
      showToast('Gagal memuat data direktori atlet', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Archive toggle action
  const handleToggleArchive = async (athlete: ChildProfile) => {
    try {
      const updated = { ...athlete, archived: !athlete.archived };
      await statsService.updateProfile(updated);
      showToast(`Berhasil ${updated.archived ? 'mengarsipkan' : 'mengaktifkan kembali'} ${athlete.name}`, 'success');
      loadData();
    } catch (err) {
      showToast('Gagal mengubah status arsip atlet', 'error');
    }
  };

  // Helper to find guardian name
  const getGuardianName = (athlete: ChildProfile) => {
    if (!athlete.links || !Array.isArray(athlete.links)) return '—';
    const verifiedGuardianLink = athlete.links.find(l => l.relationship === 'guardian' && l.verified);
    if (!verifiedGuardianLink) return '—';

    const u = users.find(usr => usr.id === verifiedGuardianLink.accountId);
    return u ? u.name : '—';
  };

  // Find duplicates recommendation for current row
  const getMergeSuggestionFor = (athleteId: string) => {
    return potentialDuplicates.find(dup => dup.primary.id === athleteId || dup.secondary.id === athleteId);
  };

  // Helper to get total match appearances and last match details for Tercatat tab
  const getAthleteMatchStats = (athleteId: string) => {
    const athleteRosters = allRosters.filter(r => r.profileId === athleteId);
    const matchCount = athleteRosters.length;
    
    if (matchCount === 0) {
      return { matchCount: 0, lastMatchString: '—' };
    }

    // Sort rosters by match date descending (latest first)
    const sortedMatchesWithRoster = athleteRosters
      .map(r => {
        const match = allMatches.find(m => m.id === r.matchId);
        return { roster: r, match };
      })
      .filter(item => !!item.match)
      .sort((a, b) => new Date(b.match!.date).getTime() - new Date(a.match!.date).getTime());

    if (sortedMatchesWithRoster.length === 0) {
      return { matchCount, lastMatchString: '—' };
    }

    const latest = sortedMatchesWithRoster[0];
    const m = latest.match!;
    const r = latest.roster;

    // Determine the player's team name
    const playerTeamId = r.teamId;
    const playerTeam = teams.find(t => t.id === playerTeamId);
    const playerTeamName = playerTeam?.name || (playerTeamId === m.teamId ? m.ourTeamName : m.theirTeamName) || 'Kita';

    // Determine the opponent's team name
    const opponentTeamId = playerTeamId === m.teamId ? m.opponentTeamId : m.teamId;
    const opponentTeam = teams.find(t => t.id === opponentTeamId);
    const opponentTeamName = opponentTeam?.name || (opponentTeamId === m.teamId ? m.ourTeamName : m.theirTeamName) || 'Lawan';

    return {
      matchCount,
      lastMatchString: `${playerTeamName} vs ${opponentTeamName}`
    };
  };

  // Filtering Logic
  const filteredProfiles = profiles.filter(p => {
    // Search query: match name, aliases, or internalId
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.internalId && p.internalId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.aliases && p.aliases.some(alias => alias.toLowerCase().includes(searchQuery.toLowerCase())));

    // Tab Filter
    const statusValue = p.claimStatus || 'unclaimed';
    const isTerkelola = statusValue === 'verified' || statusValue === 'claim_pending';
    const matchesTab = activeTab === 'terkelola' ? isTerkelola : !isTerkelola;

    // KU filter
    const kuStr = getCurrentKU(p.birthDate) || '';
    const matchesKU = filterKU === 'all' || kuStr === filterKU;

    // Club filter
    const matchesClub = filterClub === 'all' || p.clubId === filterClub;

    // Archived filter
    const matchesArchived = showArchived ? true : !p.archived;

    return matchesSearch && matchesTab && matchesKU && matchesClub && matchesArchived;
  });

  // Unique list of current KUs for the dropdown filter
  const uniqueKUs = Array.from(
    new Set(
      profiles
        .map(p => getCurrentKU(p.birthDate))
        .filter((ku): ku is string => !!ku)
    )
  ).sort();

  // Summary counts
  const totalCount = profiles.filter(p => !p.archived).length;
  const verifiedCount = profiles.filter(p => !p.archived && p.claimStatus === 'verified').length;
  const pendingCount = profiles.filter(p => !p.archived && p.claimStatus === 'claim_pending').length;
  const unclaimedCount = profiles.filter(p => !p.archived && (p.claimStatus === 'unclaimed' || !p.claimStatus)).length;

  return (
    <div className="space-y-6 font-sans text-zinc-900 dark:text-zinc-100 max-w-7xl mx-auto">
      {/* Upper header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black font-display tracking-tight text-zinc-900 dark:text-white uppercase flex items-center gap-2">
            🛡️ Direktori Atlet HoopStats
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Kelola profil atlet, tatanan klaim guardian, serta selaraskan profil atlet ganda/duplikat.
          </p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => {
            setAthleteToEdit(null);
            setIsAddEditOpen(true);
          }}
          className="flex items-center gap-2 bg-brand-navy hover:bg-brand-navy/90 text-white font-bold py-2.5 px-4 rounded-xl shadow-md border-0 shrink-0 cursor-pointer"
        >
          <Plus size={18} /> Tambah Atlet
        </Button>
      </div>

      {/* Stats Summary Dashboard cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Total Atlet Aktif</span>
          <p className="text-3xl font-black font-mono text-zinc-800 dark:text-white mt-1">{totalCount}</p>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider flex items-center gap-1">
            <CheckCircle size={10} /> Terkelola (Wali)
          </span>
          <p className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {verifiedCount + pendingCount}
            <span className="text-xs font-semibold text-zinc-400 block mt-0.5">
              {verifiedCount} Verified · {pendingCount} Pending
            </span>
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-zinc-550 dark:text-zinc-400 tracking-wider flex items-center gap-1">
            <AlertCircle size={10} /> Tercatat (Game)
          </span>
          <p className="text-3xl font-black font-mono text-zinc-650 dark:text-zinc-300 mt-1">
            {unclaimedCount}
            <span className="text-xs font-semibold text-zinc-400 block mt-0.5">
              Unclaimed entities
            </span>
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider flex items-center gap-1">
            <Clock size={10} /> Duplikat Potensial
          </span>
          <p className="text-3xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
            {potentialDuplicates.length}
            <span className="text-xs font-semibold text-zinc-400 block mt-0.5">
              Butuh Merge
            </span>
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-col gap-4">
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => {
              setActiveTab('terkelola');
              setSearchQuery('');
            }}
            className={`pb-4 px-6 text-sm font-bold uppercase tracking-wider transition-all border-b-2 relative cursor-pointer ${
              activeTab === 'terkelola'
                ? 'text-brand-navy dark:text-brand-orange border-brand-navy dark:border-brand-orange font-black'
                : 'text-zinc-400 border-transparent hover:text-zinc-600 dark:hover:text-zinc-350'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>Terkelola</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'terkelola' 
                  ? 'bg-brand-navy/10 dark:bg-brand-orange/20 text-brand-navy dark:text-brand-orange' 
                  : 'bg-zinc-100 dark:bg-zinc-850 text-zinc-500'
              }`}>
                {verifiedCount + pendingCount}
              </span>
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTab('tercatat');
              setSearchQuery('');
            }}
            className={`pb-4 px-6 text-sm font-bold uppercase tracking-wider transition-all border-b-2 relative cursor-pointer ${
              activeTab === 'tercatat'
                ? 'text-brand-navy dark:text-brand-orange border-brand-navy dark:border-brand-orange font-black'
                : 'text-zinc-400 border-transparent hover:text-zinc-600 dark:hover:text-zinc-350'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>Tercatat</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'tercatat' 
                  ? 'bg-brand-navy/10 dark:bg-brand-orange/20 text-brand-navy dark:text-brand-orange' 
                  : 'bg-zinc-100 dark:bg-zinc-850 text-zinc-500'
              }`}>
                {unclaimedCount}
              </span>
            </div>
          </button>
        </div>

        {/* Tab description text banner */}
        <div className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/35 p-3 rounded-xl border border-zinc-150/50 dark:border-zinc-800/50">
          {activeTab === 'terkelola' ? (
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span><strong>Terkelola:</strong> Dikelola wali/manager</span>
            </p>
          ) : (
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-400"></span>
              <span><strong>Tercatat:</strong> Terekam dari pertandingan, belum diklaim — bisa diklaim wali kapan saja</span>
            </p>
          )}
        </div>
      </div>

      {/* Filter panel */}
      <div className="p-4 bg-zinc-50/70 dark:bg-zinc-900/40 rounded-2xl border border-zinc-150 dark:border-zinc-800/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Cari nama, alias, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-orange"
            />
          </div>

          {/* KU dropdown */}
          <select
            value={filterKU}
            onChange={(e) => setFilterKU(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:outline-none"
          >
            <option value="all">Semua Kategori Umur (KU)</option>
            {uniqueKUs.map(ku => (
              <option key={ku} value={ku}>{ku}</option>
            ))}
          </select>

          {/* Club dropdown */}
          <select
            value={filterClub}
            onChange={(e) => setFilterClub(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:outline-none"
          >
            <option value="all">Semua Klub Aktif</option>
            {clubs.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Archived toggle */}
        <div className="flex justify-between items-center pt-2 border-t border-zinc-150 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-archived"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-800 text-brand-orange focus:ring-brand-orange h-4 w-4 cursor-pointer"
            />
            <label htmlFor="show-archived" className="text-xs font-bold text-zinc-600 dark:text-zinc-400 select-none cursor-pointer">
              Tampilkan terarsip
            </label>
          </div>
          <button 
            onClick={loadData}
            className="text-xs font-bold text-zinc-500 hover:text-brand-orange flex items-center gap-1 transition-all cursor-pointer"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} /> Segarkan Data
          </button>
        </div>
      </div>

      {/* Main Tabbed Content List */}
      <div>
        {isLoading ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-sm p-12 text-center text-zinc-400">
            <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
            <p className="text-sm font-semibold">Memuat data direktori atlet...</p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-sm p-12 text-center text-zinc-400">
            <AlertCircle className="mx-auto mb-2 text-zinc-300 dark:text-zinc-700" size={32} />
            <p className="text-sm font-bold">Tidak ada atlet ditemukan.</p>
            <p className="text-xs mt-1">Coba sesuaikan kata kunci pencarian atau filter status.</p>
          </div>
        ) : activeTab === 'terkelola' ? (
          /* TERKELOLA TAB - Render clean, detailed Table with Guardian details */
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-400 text-[10px] uppercase font-black tracking-wider">
                    <th className="py-3 px-4">Profil</th>
                    <th className="py-3 px-4">ID Internal</th>
                    <th className="py-3 px-4">KU</th>
                    <th className="py-3 px-4">Gender</th>
                    <th className="py-3 px-4">Klub Aktif</th>
                    <th className="py-3 px-4">Status & Guardian</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800 text-sm">
                  {filteredProfiles.map((p) => {
                    const currentKU = getCurrentKU(p.birthDate) || '—';
                    const activeClub = clubs.find(c => c.id === p.clubId);
                    const guardianName = getGuardianName(p);
                    const hasDuplicates = getMergeSuggestionFor(p.id);

                    return (
                      <tr 
                        key={p.id} 
                        className={`hover:bg-zinc-50/30 dark:hover:bg-zinc-800/20 transition-colors ${
                          p.archived ? 'opacity-50 bg-zinc-100/30 dark:bg-zinc-950/10' : ''
                        }`}
                      >
                        {/* Name/Avatar info */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={p.name} photoUrl={p.photoUrl || p.avatar} size="sm" />
                            <div className="min-w-0">
                              <div className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-white truncate">
                                {p.name}
                                {p.archived && (
                                  <span className="text-[9px] bg-zinc-200 dark:bg-zinc-800 text-zinc-500 px-1 py-0.2 rounded uppercase font-black shrink-0">
                                    Arsip
                                  </span>
                                )}
                              </div>
                              {p.aliases && p.aliases.length > 0 && (
                                <span className="text-[10px] text-zinc-400 block max-w-xs truncate">
                                  Alias: {p.aliases.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Internal ID */}
                        <td className="py-3.5 px-4 font-mono text-xs text-zinc-500 dark:text-zinc-400 font-bold">
                          {p.internalId || '—'}
                        </td>

                        {/* KU */}
                        <td className="py-3.5 px-4 font-bold">
                          {currentKU}
                        </td>

                        {/* Gender */}
                        <td className="py-3.5 px-4 text-xs">
                          {p.gender === 'P' || p.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki'}
                        </td>

                        {/* Club active */}
                        <td className="py-3.5 px-4 font-semibold text-zinc-700 dark:text-zinc-300">
                          {activeClub ? activeClub.name : '—'}
                        </td>

                        {/* Claim Status Badge & Guardian */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {p.claimStatus === 'verified' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/20">
                                  <CheckCircle size={10} /> Terkelola
                                </span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold mt-0.5">
                                  Wali: {guardianName}
                                </p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-900/20">
                                <Clock size={10} /> Menunggu Klaim
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex justify-end items-center gap-1.5">
                            {/* Merge button recommendation */}
                            {hasDuplicates && (
                              <button
                                onClick={() => {
                                  setMergePrimaryId(hasDuplicates.primary.id);
                                  setMergeSecondaryId(hasDuplicates.secondary.id);
                                  setIsMergeOpen(true);
                                }}
                                title="Tinjau potensi duplikat untuk digabungkan"
                                className="p-1.5 text-amber-500 hover:text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded-lg transition-colors flex items-center gap-1 animate-pulse border border-amber-200 dark:border-amber-900/40 px-2 text-[10px] font-bold uppercase cursor-pointer"
                              >
                                <ArrowRightLeft size={12} /> Merge
                              </button>
                            )}

                            {/* Details */}
                            <button
                              onClick={() => {
                                setSelectedAthlete(p);
                                setIsDetailsOpen(true);
                              }}
                              title="Detail Profil"
                              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => {
                                setAthleteToEdit(p);
                                setIsAddEditOpen(true);
                              }}
                              title="Edit Atlet"
                              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 size={15} />
                            </button>

                            {/* Link Guardian */}
                            <button
                              onClick={() => {
                                setSelectedAthlete(p);
                                setIsLinkGuardianOpen(true);
                              }}
                              title="Tautkan Guardian Manual"
                              className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg transition-colors cursor-pointer"
                            >
                              <Link size={15} />
                            </button>

                            {/* Archive/Unarchive */}
                            <button
                              onClick={() => handleToggleArchive(p)}
                              title={p.archived ? 'Aktifkan Kembali' : 'Arsipkan Atlet'}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                p.archived 
                                  ? 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20' 
                                  : 'text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                              }`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* TERCATAT TAB - Render Card-based layout with Match Appearances, KU, and Klaim actions */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
            {filteredProfiles.map((p) => {
              const currentKU = getCurrentKU(p.birthDate) || 'KU-?';
              const activeClub = clubs.find(c => c.id === p.clubId);
              const stats = getAthleteMatchStats(p.id);
              const hasDuplicates = getMergeSuggestionFor(p.id);

              return (
                <div 
                  key={p.id} 
                  className={`bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative ${
                    p.archived ? 'opacity-50' : ''
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header: Avatar, Name, and Club */}
                    <div className="flex items-start gap-3">
                      <Avatar name={p.name} photoUrl={p.photoUrl || p.avatar} size="md" />
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <h4 className="font-bold text-base text-zinc-900 dark:text-white truncate flex items-center gap-1.5">
                          {p.name}
                          {p.archived && (
                            <span className="text-[9px] bg-zinc-200 dark:bg-zinc-800 text-zinc-500 px-1 py-0.2 rounded uppercase font-black shrink-0">
                              Arsip
                            </span>
                          )}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="font-semibold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                            {currentKU}
                          </span>
                          {activeClub && (
                            <span className="truncate">
                              {activeClub.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats section */}
                    <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60">
                      <div>
                        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Pertandingan</span>
                        <span className="text-sm font-black font-mono text-zinc-800 dark:text-white">
                          {stats.matchCount} Game
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Tim/Lawan Terakhir</span>
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block truncate" title={stats.lastMatchString}>
                          {stats.lastMatchString}
                        </span>
                      </div>
                    </div>

                    {/* Badge */}
                    <div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                        <AlertCircle size={10} /> Belum Diklaim
                      </span>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-5 pt-3 border-t border-zinc-150 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {/* Details */}
                      <button
                        onClick={() => {
                          setSelectedAthlete(p);
                          setIsDetailsOpen(true);
                        }}
                        title="Detail Profil"
                        className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-xl transition-colors cursor-pointer"
                      >
                        <Eye size={15} />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => {
                          setAthleteToEdit(p);
                          setIsAddEditOpen(true);
                        }}
                        title="Edit Atlet"
                        className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-xl transition-colors cursor-pointer"
                      >
                        <Edit2 size={15} />
                      </button>

                      {/* Merge recommendation */}
                      {hasDuplicates && (
                        <button
                          onClick={() => {
                            setMergePrimaryId(hasDuplicates.primary.id);
                            setMergeSecondaryId(hasDuplicates.secondary.id);
                            setIsMergeOpen(true);
                          }}
                          title="Tinjau potensi duplikat untuk digabungkan"
                          className="p-1.5 text-amber-500 hover:text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded-lg transition-colors flex items-center gap-1 animate-pulse border border-amber-200 dark:border-amber-900/40 px-2 text-[10px] font-bold uppercase cursor-pointer"
                        >
                          <ArrowRightLeft size={11} /> Merge
                        </button>
                      )}
                    </div>

                    {/* Claim Button */}
                    <button
                      onClick={() => {
                        setSelectedAthlete(p);
                        setIsLinkGuardianOpen(true);
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-brand-navy hover:bg-opacity-90 dark:bg-brand-orange dark:text-brand-navy rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                    >
                      <UserCheck size={13} />
                      Klaim / Tautkan Wali
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sub-modals composition */}
      {isDetailsOpen && (
        <AthleteDetailsModal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedAthlete(null);
          }}
          athlete={selectedAthlete}
          teams={teams}
          clubs={clubs}
          users={users}
        />
      )}

      {isLinkGuardianOpen && (
        <LinkGuardianModal
          isOpen={isLinkGuardianOpen}
          onClose={() => {
            setIsLinkGuardianOpen(false);
            setSelectedAthlete(null);
          }}
          athlete={selectedAthlete}
          users={users}
          onSuccess={loadData}
        />
      )}

      {isAddEditOpen && (
        <AddAthleteModal
          isOpen={isAddEditOpen}
          onClose={() => {
            setIsAddEditOpen(false);
            setAthleteToEdit(null);
          }}
          athleteToEdit={athleteToEdit}
          clubs={clubs}
          users={users}
          onSuccess={loadData}
        />
      )}

      {isMergeOpen && (
        <MergePlayerModal
          isOpen={isMergeOpen}
          onClose={() => {
            setIsMergeOpen(false);
            setMergePrimaryId('');
            setMergeSecondaryId('');
          }}
          profiles={profiles}
          isAdmin={currentUser?.role === 'admin'}
          onMergeSuccess={() => {
            loadData();
            setIsMergeOpen(false);
          }}
          initialPrimaryId={mergePrimaryId}
          initialSecondaryId={mergeSecondaryId}
        />
      )}
    </div>
  );
};

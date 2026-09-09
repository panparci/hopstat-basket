import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  ArrowLeft, 
  Save, 
  Check, 
  Video, 
  ListFilter, 
  Edit2, 
  Sparkles, 
  Info,
  Play,
  RotateCcw,
  Plus,
  ShieldCheck,
  ChevronRight,
  User,
  Activity,
  Award
} from 'lucide-react';
import { statsService } from '../../../core/services/statsService';
import { pipelineService } from '../model/pipelineService';
import { useToast } from '../../../core/contexts/ToastContext';
import { usePermissions } from '../../../core/contexts/PermissionsContext';
import { 
  Match, 
  GameEvent, 
  Player, 
  MatchRoster, 
  MatchAuditResult, 
  AuditIssue,
  PhaseOfPlay,
  AssistType,
  PressureLevel
} from '../../../core/types/stats';
import { EventSetEditorModal } from '../../../components/organisms/EventSetEditorModal';
import { StageProgress } from '../../../shared/ui/StageProgress';

export const QAReview: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = usePermissions();

  // Core Data States
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [matchRosters, setMatchRosters] = useState<MatchRoster[]>([]);
  const [auditResult, setAuditResult] = useState<MatchAuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // QA Specific States
  const [selectedEvent, setSelectedEvent] = useState<GameEvent | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [onlyMissingDetails, setOnlyMissingDetails] = useState(false);

  // Form Fields for Selected Event
  const [shotZone, setShotZone] = useState('');
  const [assistType, setAssistType] = useState<AssistType | ''>('');
  const [phaseOfPlay, setPhaseOfPlay] = useState<PhaseOfPlay | ''>('');
  const [pressureLevel, setPressureLevel] = useState<PressureLevel | ''>('');
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  // Edit Set Modal State (reusing EventSetEditorModal)
  const [isSetEditorOpen, setIsSetEditorOpen] = useState(false);
  const [setEditorEvent, setSetEditorEvent] = useState<GameEvent | null>(null);

  // Return Stage Dialog State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnNote, setReturnNote] = useState('');

  // Checklist States
  const [checkedScore, setCheckedScore] = useState(false);
  const [checkedAnomalies, setCheckedAnomalies] = useState(false);
  const [checkedLineup, setCheckedLineup] = useState(false);

  // Load Data
  const loadData = async () => {
    if (!matchId) return;
    try {
      setIsLoading(true);
      const m = await statsService.getMatch(matchId);
      if (!m) {
        showToast('Pertandingan tidak ditemukan.', 'error');
        navigate('/games');
        return;
      }
      setMatch(m);

      const evs = await statsService.getEvents(matchId);
      setEvents(evs);

      const players = await statsService.getPlayers();
      setAllPlayers(players);

      const rosters = await statsService.getMatchRosters(matchId);
      setMatchRosters(rosters);

      let audit: MatchAuditResult | null = null;
      try {
        audit = await statsService.auditMatchIntegrity(matchId);
        setAuditResult(audit);
      } catch (e) {
        console.warn('Audit failed:', e);
      }
    } catch (err: any) {
      console.error('Error loading QA data:', err);
      showToast(err.message || 'Gagal memuat data pertandingan', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [matchId]);

  // YouTube URL Helper
  const youtubeVideoId = useMemo(() => {
    if (!match?.videoUrl) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const res = match.videoUrl.match(regExp);
    return (res && res[2].length === 11) ? res[2] : '';
  }, [match?.videoUrl]);

  // Player Name Helper
  const getPlayerName = (id: string) => {
    if (id === 'opp' || id === 'away_team') return 'Opponent';
    if (id === 'home_team') return 'Home Team';
    const p = allPlayers.find(p => p.id === id);
    if (!p) return 'Unknown Player';
    return p.jersey ? `${p.name} (#${p.jersey})` : p.name;
  };

  // Seek Video Helper
  const seekVideo = (timestamp: number) => {
    const player = document.getElementById('youtube-player-qa') as HTMLIFrameElement;
    if (player && player.contentWindow) {
      player.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: 'seekTo',
        args: [timestamp, true]
      }), '*');
      player.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: 'playVideo',
        args: []
      }), '*');
    } else {
      showToast(`Memutar video pada detik ke-${timestamp}`, 'info');
    }
  };

  // Sort and Filter Events
  const sortedAndFilteredEvents = useMemo(() => {
    const sorted = [...events].sort((a, b) => {
      if (a.quarter !== b.quarter) return a.quarter - b.quarter;
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      const timeA = a.realTime ? new Date(a.realTime).getTime() : 0;
      const timeB = b.realTime ? new Date(b.realTime).getTime() : 0;
      return timeA - timeB;
    });

    return sorted.filter(ev => {
      // Event type filter
      if (filterType !== 'all') {
        if (filterType === 'shots' && !ev.type.includes('make') && !ev.type.includes('miss')) return false;
        if (filterType === 'turnovers' && ev.type !== 'to') return false;
        if (filterType === 'fouls' && !ev.type.includes('foul')) return false;
        if (filterType === 'rebounds' && ev.type !== 'oreb' && ev.type !== 'dreb') return false;
        if (filterType === 'assists' && ev.type !== 'ast') return false;
      }

      // Missing details filter
      if (onlyMissingDetails) {
        const isShot = ev.type.includes('make') || ev.type.includes('miss');
        const isAssist = ev.type === 'ast';
        
        const hasMissingShotZone = isShot && !ev.shotZone;
        const hasMissingAssistType = isAssist && !ev.assistType;
        const hasMissingPhaseOfPlay = !ev.phaseOfPlay;
        const hasMissingPressureLevel = !ev.pressureLevel;

        return hasMissingShotZone || hasMissingAssistType || hasMissingPhaseOfPlay || hasMissingPressureLevel;
      }

      return true;
    });
  }, [events, filterType, onlyMissingDetails]);

  // Handle Select Event
  const handleSelectEvent = (ev: GameEvent) => {
    setSelectedEvent(ev);
    setShotZone(ev.shotZone || '');
    setAssistType(ev.assistType || '');
    setPhaseOfPlay(ev.phaseOfPlay || '');
    setPressureLevel(ev.pressureLevel || '');
  };

  // Save Event Details Form
  const handleSaveEventDetails = async () => {
    if (!selectedEvent) return;
    setIsSavingEvent(true);
    try {
      const updatedEvent: GameEvent = {
        ...selectedEvent,
        shotZone: shotZone || undefined,
        assistType: (assistType as AssistType) || undefined,
        phaseOfPlay: (phaseOfPlay as PhaseOfPlay) || undefined,
        pressureLevel: (pressureLevel as PressureLevel) || undefined,
      };

      await statsService.updateEvent(updatedEvent);
      
      // Update local state
      setEvents(prev => prev.map(e => e.id === selectedEvent.id ? updatedEvent : e));
      setSelectedEvent(updatedEvent);

      // Re-run audit integrity
      if (matchId) {
        const audit = await statsService.auditMatchIntegrity(matchId);
        setAuditResult(audit);
      }

      showToast('Detail event berhasil disimpan & diperbarui!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan detail event', 'error');
    } finally {
      setIsSavingEvent(false);
    }
  };

  // Apply Quick Fix Audit Suggestion
  const handleApplyQuickFix = async (issue: AuditIssue) => {
    if (!matchId) return;
    try {
      const success = await statsService.applyAuditSuggestion(matchId, issue);
      if (success) {
        showToast('Rekomendasi perbaikan otomatis berhasil diterapkan!', 'success');
        // Reload all data to refresh state
        await loadData();
      } else {
        showToast('Gagal menerapkan rekomendasi perbaikan.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbaiki anomali otomatis', 'error');
    }
  };

  // Set Editor Callback on success
  const handleSetEditorSuccess = async () => {
    setIsSetEditorOpen(false);
    setSetEditorEvent(null);
    setSelectedEvent(null);
    showToast('Event berhasil diperbarui!', 'success');
    await loadData();
  };

  // Final Action: Approve Stage
  const handleApproveQA = async () => {
    if (!match || !user) return;
    if (!checkedScore || !checkedAnomalies || !checkedLineup) {
      showToast('Harap selesaikan semua checklist QA terlebih dahulu.', 'error');
      return;
    }

    try {
      const updatedMatch = await pipelineService.advanceStage(match.id, user);
      setMatch(updatedMatch);
      showToast('Statistik pertandingan berhasil disetujui & dikirim ke Coach!', 'success');
      navigate(`/match/${match.id}`);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyetujui statistik', 'error');
    }
  };

  // Final Action: Return Stage
  const handleReturnQA = async () => {
    if (!match || !user) return;
    if (!returnNote.trim()) {
      showToast('Catatan perbaikan wajib diisi.', 'error');
      return;
    }

    try {
      const updatedMatch = await pipelineService.returnStage(match.id, user, returnNote);
      setMatch(updatedMatch);
      showToast('Statistik dikembalikan ke Statistician!', 'success');
      setIsReturnModalOpen(false);
      navigate(`/match/${match.id}`);
    } catch (err: any) {
      showToast(err.message || 'Gagal mengembalikan alur kerja', 'error');
    }
  };

  // Helper format time MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-brand-navy border-t-brand-orange animate-spin"></div>
        <p className="text-sm font-bold text-zinc-500 animate-pulse">Memuat data QA Review...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="p-8 text-center bg-red-50 dark:bg-red-950/20 text-red-600 rounded-3xl border border-red-100 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-3" />
        <h3 className="font-bold text-lg mb-1">Pertandingan Tidak Ditemukan</h3>
        <p className="text-sm">Silakan pilih kembali pertandingan dari daftar pertandingan utama.</p>
        <Link to="/games" className="inline-block mt-4 px-4 py-2 bg-zinc-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider">Kembali</Link>
      </div>
    );
  }

  const isCurrentQA = match.productionStage === 'qa_review';

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 select-none font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(`/match/${match.id}`)}
            className="p-3 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} className="text-zinc-600 dark:text-zinc-400" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 bg-brand-orange/15 text-brand-navy dark:text-brand-orange text-[10px] font-black uppercase tracking-wider rounded-lg border border-brand-orange/30">
                Mode QA Review
              </span>
              {!isCurrentQA && (
                <span className="px-2.5 py-0.5 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 text-[10px] font-black uppercase tracking-wider rounded-lg">
                  View-Only Mode (Stage: {match.productionStage})
                </span>
              )}
            </div>
            <h1 className="text-2xl font-display font-black italic text-zinc-900 dark:text-white uppercase tracking-tight mt-1">
              {match.name || 'Detail Peninjauan Data'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl">
            Match Date: {new Date(match.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Stage Progress */}
      <StageProgress stage={match.productionStage || 'tracking'} />

      {/* Main Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Event Log List & Video (6 or 7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* YouTube video container */}
          {match.videoUrl && youtubeVideoId ? (
            <div className="bg-black aspect-video rounded-3xl overflow-hidden shadow-md border border-zinc-200 dark:border-zinc-800 relative">
              <iframe
                id="youtube-player-qa"
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1`}
                title="QA YouTube Video Player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          ) : (
            <div className="bg-zinc-100 dark:bg-zinc-900 aspect-video rounded-3xl flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-200 dark:border-zinc-800">
              <Video className="w-12 h-12 text-zinc-400 mb-3" />
              <p className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Video Rekaman Pertandingan Tidak Tersedia</p>
              <p className="text-xs text-zinc-400 mt-1">Gunakan log play-by-play untuk meninjau data manual.</p>
            </div>
          )}

          {/* Event Log Panel */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-150 dark:border-zinc-800 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-md font-display font-black uppercase text-zinc-850 dark:text-zinc-100 italic">Play-by-Play Event Log</h3>
                <p className="text-xs text-zinc-400">Klik event untuk melompat ke video & melengkapi detail</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 text-zinc-700 dark:text-zinc-300 focus:outline-none"
                >
                  <option value="all">Semua Tipe</option>
                  <option value="shots">🏀 Shots</option>
                  <option value="turnovers">⚠️ Turnovers</option>
                  <option value="rebounds">🛡️ Rebounds</option>
                  <option value="assists">🤝 Assists</option>
                  <option value="fouls">🛑 Fouls</option>
                </select>

                <button
                  onClick={() => setOnlyMissingDetails(!onlyMissingDetails)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
                    onlyMissingDetails 
                      ? 'bg-brand-orange/20 text-brand-navy border-brand-orange dark:text-brand-orange' 
                      : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-150 dark:border-zinc-850 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'
                  }`}
                >
                  <ListFilter size={12} />
                  <span>Detail Kosong</span>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[480px] rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-950/50 text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="py-2.5 px-3">Waktu</th>
                    <th className="py-2.5 px-3">Pemain</th>
                    <th className="py-2.5 px-3">Event</th>
                    <th className="py-2.5 px-3 text-right">Detail Terpasang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850/40">
                  {sortedAndFilteredEvents.map((ev, idx) => {
                    const isSelected = selectedEvent?.id === ev.id;
                    const isShot = ev.type.includes('make') || ev.type.includes('miss');
                    const isAssist = ev.type === 'ast';
                    
                    const isFullyEnriched = (!isShot || !!ev.shotZone) && 
                                            (!isAssist || !!ev.assistType) && 
                                            !!ev.phaseOfPlay && 
                                            !!ev.pressureLevel;

                    return (
                      <tr 
                        key={ev.id || idx} 
                        onClick={() => handleSelectEvent(ev)}
                        className={`transition-all duration-150 text-xs cursor-pointer ${
                          isSelected 
                            ? 'bg-brand-orange/10 dark:bg-brand-orange/5 border-l-4 border-brand-orange' 
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-950/40'
                        }`}
                      >
                        <td className="py-3 px-3 whitespace-nowrap text-zinc-500 font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            {match.videoUrl && ev.youtubeTimestamp !== undefined && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  seekVideo(ev.youtubeTimestamp!);
                                }}
                                className="p-1 hover:bg-brand-orange/25 text-brand-navy dark:text-brand-orange rounded-full transition-all"
                                title="Lompat ke Detik Video"
                              >
                                <Play size={10} className="fill-current" />
                              </button>
                            )}
                            <span>Q{ev.quarter} | {formatTime(ev.timestamp)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-bold text-zinc-850 dark:text-zinc-200">
                          {getPlayerName(ev.playerId)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                            {ev.type.replace('_', ' ').toUpperCase()}
                          </span>
                          {ev.subType && <span className="text-[10px] text-zinc-400 ml-1">({ev.subType})</span>}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {ev.shotZone && <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 text-[9px] font-bold rounded">Zone</span>}
                            {ev.assistType && <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold rounded">Assist</span>}
                            {ev.phaseOfPlay && <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold rounded">Phase</span>}
                            {ev.pressureLevel && <span className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 text-[9px] font-bold rounded">Press</span>}
                            {isFullyEnriched ? (
                              <CheckCircle2 size={12} className="text-emerald-500 ml-1" />
                            ) : (
                              <span title="Butuh Detail QA">
                                <AlertCircle size={12} className="text-amber-500 ml-1" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedAndFilteredEvents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-400">
                        Tidak ada log event yang cocok dengan filter aktif.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Panel: Data Quality Audit, Enrichment Form, Checklist & Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Data Quality & Health Score Panel */}
          {auditResult && (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-150 dark:border-zinc-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-850 pb-3">
                <div>
                  <h3 className="text-md font-display font-black uppercase text-zinc-850 dark:text-zinc-100 italic">Kualitas Integritas Data</h3>
                  <p className="text-xs text-zinc-400">Skor audit relasi statistik pertandingan</p>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-display font-black italic ${
                    auditResult.healthScore >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
                    auditResult.healthScore >= 75 ? 'text-amber-500 dark:text-brand-orange' : 'text-red-500'
                  }`}>
                    {auditResult.healthScore}
                  </div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-zinc-450 dark:text-zinc-500 block">Health Score</span>
                </div>
              </div>

              {/* Trust Classification Badge */}
              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-850">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <Award size={14} className="text-brand-orange" />
                  Klasifikasi Kepercayaan Data:
                </span>
                <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-lg border ${
                  auditResult.trustClassification === 'TRUSTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400' :
                  auditResult.trustClassification === 'CAUTION' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-brand-orange' :
                  'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400'
                }`}>
                  {auditResult.trustClassification}
                </span>
              </div>

              {/* List of Anomalies */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider block">
                  Anomali Terdeteksi ({auditResult.issues.length})
                </span>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {auditResult.issues.map((issue) => (
                    <div 
                      key={issue.id} 
                      className={`text-xs p-3 rounded-2xl border flex flex-col gap-2 ${
                        issue.severity === 'critical' ? 'bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-950/40' :
                        issue.severity === 'high' ? 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-100 dark:border-amber-950/30' :
                        'bg-zinc-50 dark:bg-zinc-950 border-zinc-150 dark:border-zinc-850'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.25 rounded border ${
                            issue.severity === 'critical' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400' :
                            issue.severity === 'high' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-brand-orange' :
                            'bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-850 dark:text-zinc-400'
                          }`}>
                            {issue.severity.toUpperCase()}
                          </span>
                          <p className="font-bold text-zinc-850 dark:text-zinc-200 mt-1">{issue.message}</p>
                        </div>
                      </div>

                      {issue.recommendedAction && (
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic">
                          💡 Rekomendasi: {issue.recommendedAction}
                        </p>
                      )}

                      {/* Action buttons per anomaly */}
                      <div className="flex items-center gap-1.5 mt-1 justify-end flex-wrap">
                        {issue.relatedIds?.eventId && (
                          <button
                            onClick={() => {
                              const related = events.find(e => e.id === issue.relatedIds?.eventId);
                              if (related) {
                                handleSelectEvent(related);
                                if (related.youtubeTimestamp !== undefined) {
                                  seekVideo(related.youtubeTimestamp);
                                }
                              }
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors cursor-pointer"
                          >
                            📍 Lompat ke Event
                          </button>
                        )}
                        
                        {issue.suggestion && isCurrentQA && (
                          <button
                            onClick={() => handleApplyQuickFix(issue)}
                            className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy hover:bg-brand-navy/90 dark:hover:bg-brand-orange/90 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                          >
                            ⚡ Perbaikan Cepat
                          </button>
                        )}

                        {issue.relatedIds?.eventId && isCurrentQA && (
                          <button
                            onClick={() => {
                              const targetEv = events.find(e => e.id === issue.relatedIds?.eventId);
                              if (targetEv) {
                                setSetEditorEvent(targetEv);
                                setIsSetEditorOpen(true);
                              }
                            }}
                            className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                          >
                            ✏️ Edit Set
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {auditResult.issues.length === 0 && (
                    <div className="text-center py-6 text-zinc-400 text-xs">
                      🎉 Tidak ada anomali integrasi data yang terdeteksi. Kualitas data prima!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Event Detail Enrichment Form */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-150 dark:border-zinc-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-850 pb-3">
              <div>
                <h3 className="text-md font-display font-black uppercase text-zinc-850 dark:text-zinc-100 italic">Pengayaan Detail Statistik</h3>
                <p className="text-xs text-zinc-400">Lengkapi field kosong pada event terpilih</p>
              </div>
              {selectedEvent && (
                <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  Q{selectedEvent.quarter} | {formatTime(selectedEvent.timestamp)}
                </span>
              )}
            </div>

            {selectedEvent ? (
              <div className="space-y-4 text-xs">
                {/* Event Summary Banner */}
                <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-850/60 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-400 block">Pemain & Tindakan</span>
                    <strong className="text-zinc-800 dark:text-zinc-200">{getPlayerName(selectedEvent.playerId)}</strong>
                    <span className="text-zinc-500 block text-[11px] font-medium">{selectedEvent.type.replace('_', ' ').toUpperCase()}</span>
                  </div>
                  {isCurrentQA && (
                    <button
                      onClick={() => {
                        setSetEditorEvent(selectedEvent);
                        setIsSetEditorOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-850 hover:bg-zinc-200 dark:hover:bg-zinc-850/80 rounded-xl transition-all font-bold text-[10px] uppercase tracking-wide text-zinc-700 dark:text-zinc-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 size={10} /> Edit Hubungan
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Shot Zone (for shot events) */}
                  {(selectedEvent.type.includes('make') || selectedEvent.type.includes('miss')) && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">Zona Tembakan (`shotZone`)</label>
                      <select
                        value={shotZone}
                        disabled={!isCurrentQA}
                        onChange={(e) => setShotZone(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-brand-orange disabled:opacity-60"
                      >
                        <option value="">-- Pilih Zona --</option>
                        <option value="Restricted Area / Rim">Restricted Area / Rim</option>
                        <option value="Paint / Key">Paint / Key</option>
                        <option value="Paint / Low Post">Paint / Low Post</option>
                        <option value="Left Mid-Range">Left Mid-Range</option>
                        <option value="Right Mid-Range">Right Mid-Range</option>
                        <option value="Left Short Corner">Left Short Corner</option>
                        <option value="Right Short Corner">Right Short Corner</option>
                        <option value="Top of Key 3">Top of Key 3</option>
                        <option value="Left Wing 3">Left Wing 3</option>
                        <option value="Right Wing 3">Right Wing 3</option>
                        <option value="Left Corner 3">Left Corner 3</option>
                        <option value="Right Corner 3">Right Corner 3</option>
                      </select>
                    </div>
                  )}

                  {/* Assist Type */}
                  {(selectedEvent.type === 'ast' || (selectedEvent.type.includes('make') && selectedEvent.relatedEventIds?.length)) && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">Tipe Assist (`assistType`)</label>
                      <select
                        value={assistType}
                        disabled={!isCurrentQA}
                        onChange={(e) => setAssistType(e.target.value as AssistType)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-brand-orange disabled:opacity-60"
                      >
                        <option value="">-- Tanpa Spesifikasi --</option>
                        <option value="Direct">Direct (Langsung)</option>
                        <option value="Short Creation">Short Creation (Kreasi Pendek)</option>
                        <option value="Weak Assist">Weak Assist (Assist Lemah)</option>
                      </select>
                    </div>
                  )}

                  {/* Phase of Play */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">Fase Permainan (`phaseOfPlay`)</label>
                    <select
                      value={phaseOfPlay}
                      disabled={!isCurrentQA}
                      onChange={(e) => setPhaseOfPlay(e.target.value as PhaseOfPlay)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-brand-orange disabled:opacity-60"
                    >
                      <option value="">-- Pilih Fase --</option>
                      <option value="set_offense">Set Offense (Serangan Teratur)</option>
                      <option value="fast_break">Fast Break (Serangan Cepat)</option>
                      <option value="transition">Transition (Transisi)</option>
                      <option value="inbound">Inbound (Bola Mati Masuk)</option>
                      <option value="deadball">Deadball (Bola Mati Lainnya)</option>
                    </select>
                  </div>

                  {/* Pressure Level */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">Tingkat Tekanan (`pressureLevel`)</label>
                    <select
                      value={pressureLevel}
                      disabled={!isCurrentQA}
                      onChange={(e) => setPressureLevel(e.target.value as PressureLevel)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-brand-orange disabled:opacity-60"
                    >
                      <option value="">-- Pilih Tekanan --</option>
                      <option value="No Pressure">No Pressure (Tanpa Tekanan)</option>
                      <option value="Light">Light (Tekanan Ringan)</option>
                      <option value="Heavy / Trap">Heavy / Trap (Ketat / Perangkap)</option>
                    </select>
                  </div>
                </div>

                {/* Form Action */}
                {isCurrentQA && (
                  <button
                    onClick={handleSaveEventDetails}
                    disabled={isSavingEvent}
                    className="w-full mt-2 py-2.5 bg-zinc-800 hover:bg-zinc-900 text-white dark:bg-brand-orange dark:text-brand-navy dark:hover:bg-brand-orange/90 rounded-xl transition-all font-bold uppercase tracking-wider text-[11px] shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <Save size={13} />
                    <span>{isSavingEvent ? 'Menyimpan...' : 'Simpan Detail Pengayaan'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-zinc-450 dark:text-zinc-500 border border-dashed border-zinc-150 dark:border-zinc-850 rounded-2xl">
                <Sparkles className="w-8 h-8 text-brand-orange mx-auto mb-2 opacity-70" />
                <p className="font-bold">Pilih Event Terlebih Dahulu</p>
                <p className="text-[11px] mt-0.5">Pilih event dari daftar sebelah kiri untuk melengkapi detail.</p>
              </div>
            )}
          </div>

          {/* QA Verification Checklist */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-150 dark:border-zinc-800 p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-md font-display font-black uppercase text-zinc-850 dark:text-zinc-100 italic">Checklist Verifikasi QA</h3>
              <p className="text-xs text-zinc-400">Validasi wajib sebelum menyetujui data alur produksi</p>
            </div>

            <div className="space-y-3">
              {/* Checkbox 1 */}
              <label className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-850 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checkedScore}
                  disabled={!isCurrentQA}
                  onChange={(e) => setCheckedScore(e.target.checked)}
                  className="mt-0.5 w-4.5 h-4.5 border border-zinc-300 rounded focus:ring-brand-orange text-brand-navy"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Skor Akhir Cocok</span>
                  <p className="text-[10px] text-zinc-500 leading-normal">Papan skor & akumulasi poin event log cocok dengan video rekaman asli.</p>
                </div>
              </label>

              {/* Checkbox 2 */}
              <label className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-850 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checkedAnomalies}
                  disabled={!isCurrentQA}
                  onChange={(e) => setCheckedAnomalies(e.target.checked)}
                  className="mt-0.5 w-4.5 h-4.5 border border-zinc-300 rounded focus:ring-brand-orange text-brand-navy"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Tidak Ada Anomali Kritis</span>
                  <p className="text-[10px] text-zinc-500 leading-normal">Kesalahan integrasi data kritis (seperti overlapping stints/double assist) sudah bersih/diperbaiki.</p>
                </div>
              </label>

              {/* Checkbox 3 */}
              <label className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-850 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checkedLineup}
                  disabled={!isCurrentQA}
                  onChange={(e) => setCheckedLineup(e.target.checked)}
                  className="mt-0.5 w-4.5 h-4.5 border border-zinc-300 rounded focus:ring-brand-orange text-brand-navy"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Lineup & Roster Lengkap</span>
                  <p className="text-[10px] text-zinc-500 leading-normal">Informasi pemain yang bermain dan tim tervalidasi dengan benar di setiap quarter.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Workflow Action Panel */}
          {isCurrentQA ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Return Button */}
              <button
                onClick={() => {
                  setReturnNote('');
                  setIsReturnModalOpen(true);
                }}
                className="py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/30 rounded-2xl transition-all font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-sm border border-red-200/40 dark:border-red-950/40"
              >
                ↩️ Kembalikan
              </button>

              {/* Approve Button */}
              <button
                onClick={handleApproveQA}
                disabled={!checkedScore || !checkedAnomalies || !checkedLineup}
                className={`py-3 px-4 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 rounded-2xl transition-all shadow-sm cursor-pointer ${
                  checkedScore && checkedAnomalies && checkedLineup
                    ? 'bg-brand-navy hover:bg-brand-navy/90 text-white dark:bg-brand-orange dark:text-brand-navy dark:hover:bg-brand-orange/90'
                    : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-850 dark:text-zinc-600 cursor-not-allowed'
                }`}
              >
                Setuju & Kirim ✅
              </button>
            </div>
          ) : (
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 text-center text-xs text-zinc-500 rounded-3xl">
              Alur kerja tidak aktif karena pertandingan saat ini tidak berada di tahap <strong>qa_review</strong>.
            </div>
          )}
        </div>
      </div>

      {/* Return Stage Note Modal */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-md font-display font-black uppercase text-zinc-850 dark:text-zinc-100 italic">Kembalikan ke Statistician</h3>
              <p className="text-xs text-zinc-400 mt-1">Berikan catatan perbaikan wajib agar statistician mengerti bagian yang perlu dikoreksi.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Catatan Perbaikan *</label>
              <textarea
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                placeholder="Misal: Mohon cek quarter 2 menit ke-3, sepertinya statistik assist belum terhubung ke shooter."
                className="w-full h-24 p-3 text-xs rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-850 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-brand-orange"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:text-zinc-400 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleReturnQA}
                disabled={!returnNote.trim()}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider text-white rounded-xl transition-all cursor-pointer ${
                  returnNote.trim() 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-red-300 cursor-not-allowed'
                }`}
              >
                Kembalikan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reused Event Set Editor Modal */}
      {isSetEditorOpen && setEditorEvent && (
        <EventSetEditorModal
          isOpen={isSetEditorOpen}
          onClose={() => {
            setIsSetEditorOpen(false);
            setSetEditorEvent(null);
          }}
          event={setEditorEvent}
          onSuccess={handleSetEditorSuccess}
          match={match}
          allPlayers={allPlayers}
          matchRosters={matchRosters}
          allEvents={events}
        />
      )}
    </div>
  );
};

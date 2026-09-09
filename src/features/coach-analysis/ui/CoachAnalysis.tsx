import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import YouTube, { YouTubeEvent, YouTubePlayer } from 'react-youtube';
import {
  Award,
  Compass,
  Zap,
  Users,
  Flame,
  Brain,
  Play,
  Pause,
  Star,
  Trash2,
  Plus,
  ArrowLeft,
  Check,
  CornerUpLeft,
  Clock,
  Video,
  ChevronLeft,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { statsService } from '../../../core/services/statsService';
import { pipelineService } from '../../production-pipeline/model/pipelineService';
import { coachAnalysisService } from '../model/coachAnalysisService';
import { usePermissions } from '../../../core/contexts/PermissionsContext';
import { useToast } from '../../../core/contexts/ToastContext';
import { Match, Possession, GameEvent, MatchRoster } from '../../../core/types/stats';
import { CoachAnnotation } from '../../../entities/coach-annotation/model/types';
import { getPossessionPlayString } from '../../../shared/lib/possessionUtils'; // We'll create this or inline it

export const CoachAnalysis: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user, can } = usePermissions();
  const { showToast } = useToast();

  const [match, setMatch] = useState<Match | null>(null);
  const [possessions, setPossessions] = useState<Possession[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [rosters, setRosters] = useState<MatchRoster[]>([]);
  const [annotations, setAnnotations] = useState<CoachAnnotation[]>([]);
  const [loading, setLoading] = useState(true);

  // YouTube player state
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  
  // Annotation Form State
  const [activeTab, setActiveTab] = useState<'timeline' | 'annotations'>('timeline');
  const [selectedPossessionId, setSelectedPossessionId] = useState<string>('');
  const [targetType, setTargetType] = useState<'game' | 'possession' | 'player' | 'team'>('game');
  const [targetId, setTargetId] = useState<string>('');
  const [category, setCategory] = useState<'skill' | 'strategy' | 'decision' | 'teamwork' | 'effort' | 'mental'>('skill');
  const [rating, setRating] = useState<number>(0);
  const [note, setNote] = useState('');
  const [customTimestamp, setCustomTimestamp] = useState<string>('');

  // Auto-update timer for scrubber
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const hasAccess = can('do_coach_analysis');

  const loadData = useCallback(async () => {
    if (!matchId) return;
    try {
      setLoading(true);
      const m = await statsService.getMatch(matchId);
      if (m) {
        setMatch(m);
        if (m.videoUrl) {
          setVideoUrlInput(m.videoUrl);
        }
        
        // Fetch rosters
        const ros = await statsService.getMatchRosters(matchId);
        setRosters(ros);

        // Fetch possessions
        const poss = await statsService.getPossessions(matchId);
        // Sort possessions chronologically (quarter, start time or index)
        const sortedPoss = [...poss].sort((a, b) => {
          if (a.period !== b.period) return a.period - b.period;
          const aStart = a.clockStart ?? 0;
          const bStart = b.clockStart ?? 0;
          // clockStart is remaining time (usually descending in real time)
          return bStart - aStart;
        });
        setPossessions(sortedPoss);

        // Fetch events
        const evts = await statsService.getEvents(matchId);
        setEvents(evts);

        // Fetch annotations
        const ann = await coachAnalysisService.getAnnotationsByMatch(matchId);
        setAnnotations(ann);
      }
    } catch (e) {
      console.error(e);
      showToast('Gagal memuat data pertandingan', 'error');
    } finally {
      setLoading(false);
    }
  }, [matchId, showToast]);

  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [matchId, hasAccess, loadData]);

  // Handle time update loop
  useEffect(() => {
    if (isPlaying && player) {
      timerRef.current = setInterval(() => {
        try {
          const time = player.getCurrentTime();
          setCurrentTime(Math.round(time));
          const dur = player.getDuration();
          if (dur) setDuration(Math.round(dur));
        } catch (err) {
          // ignore player errors when detached
        }
      }, 500);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, player]);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full mb-4">
          <ShieldAlert size={48} />
        </div>
        <h1 className="text-xl font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100 mb-2">
          Akses Ditolak
        </h1>
        <p className="text-sm text-zinc-500 max-w-md">
          Anda tidak memiliki hak akses (do_coach_analysis) untuk membuka halaman analisis coach bersertifikat ini.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
        >
          Kembali
        </button>
      </div>
    );
  }

  if (loading || !match) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
      </div>
    );
  }

  const extractVideoId = (url: string) => {
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/
    );
    return match ? match[1] : null;
  };

  const videoId = match.videoUrl ? extractVideoId(match.videoUrl) : null;

  const handleSaveVideoUrl = async () => {
    if (!videoUrlInput.trim()) return;
    const id = extractVideoId(videoUrlInput);
    if (!id) {
      showToast('URL YouTube tidak valid', 'error');
      return;
    }
    try {
      const updatedMatch = { ...match, videoUrl: videoUrlInput.trim() };
      await statsService.updateMatch(updatedMatch);
      setMatch(updatedMatch);
      showToast('Video URL berhasil disimpan!', 'success');
    } catch (e) {
      showToast('Gagal menyimpan URL video', 'error');
    }
  };

  // Player handlers
  const handleReady = (event: YouTubeEvent) => {
    setPlayer(event.target);
    setDuration(Math.round(event.target.getDuration() || 0));
  };

  const handleStateChange = (event: YouTubeEvent) => {
    // 1 = playing, 2 = paused
    if (event.data === 1) {
      setIsPlaying(true);
    } else if (event.data === 2) {
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!player) return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  const seekRelative = (seconds: number) => {
    if (!player) return;
    try {
      const t = player.getCurrentTime();
      player.seekTo(Math.max(0, t + seconds), true);
      setCurrentTime(Math.round(Math.max(0, t + seconds)));
    } catch (e) {
      console.warn(e);
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (!player) return;
    try {
      player.setPlaybackRate(rate);
      setPlaybackRate(rate);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!player) return;
    const newTime = parseFloat(e.target.value);
    try {
      player.seekTo(newTime, true);
      setCurrentTime(Math.round(newTime));
    } catch (err) {
      console.warn(err);
    }
  };

  const handlePossessionClick = (pos: Possession) => {
    setSelectedPossessionId(pos.id);
    setTargetType('possession');
    setTargetId(pos.id);
    
    // Find the earliest youtubeTimestamp among events in this possession
    const posEvents = events.filter(e => e.possessionId === pos.id);
    const validTimes = posEvents
      .map(e => e.youtubeTimestamp)
      .filter((t): t is number => t !== undefined && t > 0);
    
    if (validTimes.length > 0) {
      const earliestTime = Math.min(...validTimes);
      if (player) {
        player.seekTo(earliestTime, true);
        player.playVideo();
        setCurrentTime(earliestTime);
        showToast(`Melompat ke possession (Q${pos.period})`, 'success');
      }
    } else {
      showToast('Tidak ada video timestamp tercatat untuk possession ini', 'info');
    }
  };

  const handleAddAnnotation = () => {
    // Auto fill timestamp from current video position
    let seconds = currentTime;
    if (customTimestamp.trim()) {
      const parts = customTimestamp.split(':');
      if (parts.length === 2) {
        seconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      } else {
        seconds = parseInt(customTimestamp, 10) || currentTime;
      }
    }
    
    // Validate target has been selected
    let finalTargetId = targetId;
    if (targetType === 'game') {
      finalTargetId = match.id;
    } else if (targetType === 'team') {
      finalTargetId = targetId || 'team_home';
    } else if (targetType === 'player' && !targetId) {
      showToast('Pilih pemain terlebih dahulu', 'error');
      return;
    } else if (targetType === 'possession' && !targetId) {
      showToast('Pilih possession terlebih dahulu', 'error');
      return;
    }

    if (!note.trim()) {
      showToast('Anotasi/catatan tidak boleh kosong', 'error');
      return;
    }

    const newAnnotation: CoachAnnotation = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      matchId: match.id,
      coachId: user?.id || 'coach_id',
      targetType,
      targetId: finalTargetId,
      category,
      rating: rating > 0 ? rating : undefined,
      note: note.trim(),
      videoTimestamp: seconds,
      createdAt: new Date().toISOString()
    };

    coachAnalysisService.createAnnotation(newAnnotation).then(() => {
      showToast('Anotasi berhasil ditambahkan', 'success');
      setNote('');
      setRating(0);
      setCustomTimestamp('');
      loadData();
    }).catch(() => {
      showToast('Gagal menyimpan anotasi', 'error');
    });
  };

  const handleDeleteAnnotation = async (id: string) => {
    if (window.confirm('Hapus anotasi ini?')) {
      try {
        await coachAnalysisService.deleteAnnotation(id);
        showToast('Anotasi dihapus', 'success');
        loadData();
      } catch (e) {
        showToast('Gagal menghapus anotasi', 'error');
      }
    }
  };

  // Stage Handlers
  const handleAdvanceStage = async () => {
    try {
      const updated = await pipelineService.advanceStage(match.id, user!);
      setMatch(updated);
      showToast('Pertandingan berhasil dipublikasikan! 🎉', 'success');
      navigate(`/match/${match.id}`);
    } catch (err: any) {
      showToast(err.message || 'Gagal memajukan tahap', 'error');
    }
  };

  const handleReturnStage = async () => {
    const note = window.prompt('Masukkan catatan pengembalian ke QA:');
    if (note === null) return; // cancelled
    try {
      const updated = await pipelineService.returnStage(match.id, user!, note);
      setMatch(updated);
      showToast('Pertandingan dikembalikan ke tahap QA 🔍', 'success');
      navigate(`/match/${match.id}`);
    } catch (err: any) {
      showToast(err.message || 'Gagal mengembalikan tahap', 'error');
    }
  };

  const formatVideoTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getTargetName = (ann: CoachAnnotation) => {
    if (ann.targetType === 'game') return 'Pertandingan';
    if (ann.targetType === 'team') {
      return ann.targetId === 'team_away' ? (match.theirTeamName || 'Opponent') : (match.ourTeamName || 'Team');
    }
    if (ann.targetType === 'player') {
      const rosterItem = rosters.find(r => r.profileId === ann.targetId);
      return rosterItem ? `#${rosterItem.jerseyNumber} ${rosterItem.name}` : 'Pemain';
    }
    if (ann.targetType === 'possession') {
      const index = possessions.findIndex(p => p.id === ann.targetId);
      return index !== -1 ? `Possession #${index + 1}` : 'Possession';
    }
    return 'Lainnya';
  };

  const categories = [
    { id: 'skill', label: 'Skill', icon: Award, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800' },
    { id: 'strategy', label: 'Strategi', icon: Compass, color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800' },
    { id: 'decision', label: 'Keputusan', icon: Zap, color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800' },
    { id: 'teamwork', label: 'Kerja Sama Tim', icon: Users, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' },
    { id: 'effort', label: 'Usaha', icon: Flame, color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800' },
    { id: 'mental', label: 'Mental / Fokus', icon: Brain, color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-800' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 text-zinc-900 dark:text-zinc-100 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-150 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/match/${match.id}`)}
            className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors cursor-pointer text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-orange bg-brand-navy/10 dark:bg-brand-orange/10 px-2 py-0.5 rounded-md">
                Coach Film Study
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Tahap 3: Analisis Coach Bersertifikat
              </span>
            </div>
            <h1 className="text-xl font-display font-black uppercase tracking-tight mt-0.5">
              {match.ourTeamName || 'Home'} <span className="text-brand-orange">VS</span> {match.theirTeamName || 'Away'}
            </h1>
          </div>
        </div>

        {/* Action Handoffs */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleReturnStage}
            className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5"
          >
            <CornerUpLeft size={14} /> Kembalikan ke QA
          </button>
          <button
            onClick={handleAdvanceStage}
            className="px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-brand-navy hover:bg-brand-navy/90 dark:bg-brand-orange dark:text-brand-navy dark:hover:bg-brand-orange/90 rounded-2xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <Check size={14} /> Publikasikan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* LEFT COLUMN: Youtube Player & Form */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          {/* YouTube Video Panel */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
            {videoId ? (
              <div className="relative aspect-video bg-black w-full">
                <YouTube
                  videoId={videoId}
                  opts={{
                    height: '100%',
                    width: '100%',
                    playerVars: {
                      autoplay: 0,
                      controls: 1,
                      rel: 0,
                      showinfo: 0,
                      modestbranding: 1,
                    },
                  }}
                  onReady={handleReady}
                  onStateChange={handleStateChange}
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center aspect-video bg-zinc-50 dark:bg-zinc-950">
                <Video size={48} className="text-zinc-400 mb-3" />
                <h3 className="font-bold text-sm mb-1 text-zinc-750 dark:text-zinc-200">Belum Ada Tautan Video YouTube</h3>
                <p className="text-xs text-zinc-500 max-w-sm mb-4">Tautkan video pertandingan dari YouTube untuk memulai peninjauan per-possession dan analisis taktis.</p>
                <div className="flex gap-2 max-w-md w-full">
                  <input
                    type="text"
                    placeholder="Tautan YouTube (e.g. https://youtube.com/...)"
                    value={videoUrlInput}
                    onChange={(e) => setVideoUrlInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveVideoUrl}
                    className="px-4 py-2 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy font-bold text-xs rounded-xl hover:opacity-90 transition-opacity"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            )}

            {/* Video Controllers Bar (Study Film tools) */}
            {videoId && (
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-4">
                {/* 1. Scrubber Timeline */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-zinc-500">{formatVideoTime(currentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleScrubberChange}
                    className="flex-1 accent-brand-navy dark:accent-brand-orange cursor-pointer h-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800"
                  />
                  <span className="text-xs font-mono text-zinc-500">{formatVideoTime(duration)}</span>
                </div>

                {/* 2. Button controllers */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-150/50 dark:border-zinc-800/50">
                  {/* Play & Jumps */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="p-3 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-full shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                      {isPlaying ? <Pause size={18} strokeWidth={2.5} /> : <Play size={18} strokeWidth={2.5} className="ml-0.5" />}
                    </button>
                    
                    <div className="flex bg-zinc-200/60 dark:bg-zinc-800 rounded-xl p-0.5">
                      <button
                        onClick={() => seekRelative(-5)}
                        className="px-2.5 py-1.5 text-[11px] font-black hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer text-zinc-650 dark:text-zinc-300"
                        title="Mundur 5 detik"
                      >
                        -5s
                      </button>
                      <button
                        onClick={() => seekRelative(-2)}
                        className="px-2.5 py-1.5 text-[11px] font-black hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer text-zinc-650 dark:text-zinc-300"
                        title="Mundur 2 detik"
                      >
                        -2s
                      </button>
                      <button
                        onClick={() => seekRelative(2)}
                        className="px-2.5 py-1.5 text-[11px] font-black hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer text-zinc-650 dark:text-zinc-300"
                        title="Maju 2 detik"
                      >
                        +2s
                      </button>
                      <button
                        onClick={() => seekRelative(5)}
                        className="px-2.5 py-1.5 text-[11px] font-black hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer text-zinc-650 dark:text-zinc-300"
                        title="Maju 5 detik"
                      >
                        +5s
                      </button>
                    </div>
                  </div>

                  {/* Playback speed */}
                  <div className="flex items-center gap-1 bg-zinc-250/50 dark:bg-zinc-800 p-0.5 rounded-xl">
                    <span className="text-[10px] font-bold text-zinc-400 px-2 uppercase tracking-wide">Kecepatan:</span>
                    {[0.5, 1, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className={`px-2.5 py-1 text-xs font-extrabold rounded-lg transition-colors cursor-pointer ${
                          playbackRate === rate
                            ? 'bg-brand-navy text-white dark:bg-brand-orange dark:text-brand-navy shadow-sm'
                            : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-150 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {rate === 1 ? 'Normal' : `${rate}x`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Annotation Form */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-5 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="p-2 bg-brand-orange/10 text-brand-orange rounded-xl">
                <Plus size={18} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight">Formulir Anotasi Cepat</h2>
                <p className="text-[11px] text-zinc-500">Tambahkan catatan evaluasi subjektif terkait video saat ini.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Target Type & Target Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-zinc-450 tracking-wider">Level Target</label>
                <div className="flex gap-1.5">
                  {(['game', 'team', 'player', 'possession'] as const).map((type) => {
                    const labels: Record<string, string> = {
                      game: 'Game',
                      team: 'Tim',
                      player: 'Atlet',
                      possession: 'Possession'
                    };
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setTargetType(type);
                          setTargetId('');
                        }}
                        className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                          targetType === type
                            ? 'bg-zinc-850 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                        }`}
                      >
                        {labels[type]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Specific Entity Id selector based on Target Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-zinc-450 tracking-wider">Pilih Spesifik</label>
                {targetType === 'game' && (
                  <div className="px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium">
                    Satu Pertandingan Penuh
                  </div>
                )}
                {targetType === 'team' && (
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none"
                  >
                    <option value="">-- Pilih Tim --</option>
                    <option value="team_home">{match.ourTeamName || 'Tim Kami'}</option>
                    <option value="team_away">{match.theirTeamName || 'Lawan'}</option>
                  </select>
                )}
                {targetType === 'player' && (
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none"
                  >
                    <option value="">-- Pilih Atlet --</option>
                    {rosters.map((player) => (
                      <option key={player.id} value={player.profileId}>
                        #{player.jerseyNumber} - {player.name}
                      </option>
                    ))}
                  </select>
                )}
                {targetType === 'possession' && (
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none"
                  >
                    <option value="">-- Pilih Possession --</option>
                    {possessions.map((pos, index) => (
                      <option key={pos.id} value={pos.id}>
                        P#{index + 1} - Q{pos.period} ({pos.teamInPossession === 'home' ? 'Home' : 'Away'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Category selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-zinc-450 tracking-wider">Kategori Penilaian</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((cat) => {
                  const CatIcon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id as any)}
                      className={`flex items-center gap-2 p-2.5 rounded-2xl text-xs font-bold transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-brand-navy border-brand-navy text-white dark:bg-brand-orange dark:border-brand-orange dark:text-brand-navy shadow-sm'
                          : 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <CatIcon size={14} className={isSelected ? 'text-white dark:text-brand-navy' : 'text-zinc-450'} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Optional Rating */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-zinc-450 tracking-wider">Penilaian Subjektif (Bintang)</label>
                <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-0.5 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        size={18}
                        className={star <= rating ? 'fill-brand-orange text-brand-orange' : 'text-zinc-300 dark:text-zinc-700'}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <button
                      type="button"
                      onClick={() => setRating(0)}
                      className="text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-zinc-600 ml-auto"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Timestamp anchor info */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-zinc-450 tracking-wider">Anchor Video Timestamp</label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-mono font-bold text-zinc-600">
                    <Clock size={14} className="text-zinc-400" />
                    <span>Auto: {formatVideoTime(currentTime)}</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Manual (MM:SS)"
                    value={customTimestamp}
                    onChange={(e) => setCustomTimestamp(e.target.value)}
                    className="w-1/2 px-3 py-2 text-xs font-mono rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Note text field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-zinc-450 tracking-wider">Catatan Evaluasi / Rekomendasi Pelatih</label>
              <textarea
                rows={3}
                placeholder="Tuliskan analisis taktis, catatan kesalahan teknik, atau instruksi perbaikan detail di sini..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-3.5 text-xs rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none leading-relaxed"
              ></textarea>
            </div>

            {/* Action submit */}
            <button
              onClick={handleAddAnnotation}
              className="w-full py-3 bg-brand-navy hover:bg-brand-navy/90 dark:bg-brand-orange dark:hover:bg-brand-orange/95 dark:text-brand-navy font-bold text-xs uppercase tracking-wider text-white rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus size={14} /> Simpan Anotasi Ke Timeline
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: POSSESSIONS LIST & ANNOTATIONS */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          {/* Tabs */}
          <div className="flex bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-1.5 rounded-2xl shadow-sm">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                activeTab === 'timeline'
                  ? 'bg-zinc-850 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Timeline Possession ({possessions.length})
            </button>
            <button
              onClick={() => setActiveTab('annotations')}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                activeTab === 'annotations'
                  ? 'bg-zinc-850 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Daftar Anotasi ({annotations.length})
            </button>
          </div>

          {/* TAB CONTENT: TIMELINE POSSESSION */}
          {activeTab === 'timeline' && (
            <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
              {possessions.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-8 rounded-3xl text-center">
                  <p className="text-xs text-zinc-500 font-medium">Belum ada possession terekam dalam pertandingan ini.</p>
                </div>
              ) : (
                possessions.map((pos, index) => {
                  const playString = getPossessionPlayString(pos, events);
                  const posAnnotations = annotations.filter(a => a.targetId === pos.id);
                  const isSelected = selectedPossessionId === pos.id;
                  
                  return (
                    <div
                      key={pos.id}
                      onClick={() => handlePossessionClick(pos)}
                      className={`p-4 bg-white dark:bg-zinc-900 border rounded-2xl transition-all cursor-pointer shadow-sm hover:border-brand-orange ${
                        isSelected 
                          ? 'border-brand-orange ring-1 ring-brand-orange' 
                          : 'border-zinc-150 dark:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-brand-navy dark:text-brand-orange">
                            POSSESSION #{index + 1}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-md">
                            Q{pos.period}
                          </span>
                        </div>

                        {/* Point details / status */}
                        <div className="flex items-center gap-1.5">
                          {pos.pointsScored > 0 && (
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-md">
                              +{pos.pointsScored} Pts
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-zinc-400">
                            {pos.clockStart !== undefined ? formatVideoTime(pos.clockStart) : ''}
                          </span>
                        </div>
                      </div>

                      {/* Generated play string */}
                      <p className="text-xs font-bold text-zinc-750 dark:text-zinc-300 mt-2 leading-relaxed">
                        {playString}
                      </p>

                      <div className="flex items-center justify-between gap-2 mt-3.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                        <span className="text-[10px] font-extrabold uppercase text-zinc-400">
                          {pos.teamInPossession === 'home' ? (match.ourTeamName || 'Home') : (match.theirTeamName || 'Away')}
                        </span>
                        
                        {/* Annotations badge */}
                        {posAnnotations.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] font-black text-brand-orange bg-brand-navy/5 dark:bg-brand-orange/10 px-2 py-0.5 rounded-full">
                            <Brain size={11} />
                            <span>{posAnnotations.length} Analisis</span>
                          </div>
                        )}
                      </div>

                      {/* Display annotations linked to this possession inside timeline */}
                      {posAnnotations.length > 0 && (
                        <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-brand-orange/40">
                          {posAnnotations.map((ann) => (
                            <div key={ann.id} className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 p-2 rounded-xl border border-zinc-150/40">
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="font-extrabold text-brand-orange uppercase tracking-tight text-[9px]">
                                  {ann.category.toUpperCase()}
                                </span>
                                <span className="text-[9px] font-mono">
                                  {formatVideoTime(ann.videoTimestamp || 0)}
                                </span>
                              </div>
                              <p className="italic">"{ann.note}"</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB CONTENT: ALL ANNOTATIONS */}
          {activeTab === 'annotations' && (
            <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
              {annotations.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-8 rounded-3xl text-center">
                  <p className="text-xs text-zinc-500 font-medium">Belum ada anotasi ditambahkan oleh pelatih.</p>
                </div>
              ) : (
                [...annotations]
                  .sort((a, b) => (a.videoTimestamp || 0) - (b.videoTimestamp || 0))
                  .map((ann) => {
                    const catObj = categories.find(c => c.id === ann.category);
                    const CatIcon = catObj?.icon || Award;
                    return (
                      <div
                        key={ann.id}
                        className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative"
                      >
                        {/* Rating stars and Category */}
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${catObj?.color || ''}`}>
                            <CatIcon size={12} />
                            <span>{catObj?.label || ann.category}</span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Video jump badge */}
                            <button
                              onClick={() => {
                                if (player && ann.videoTimestamp !== undefined) {
                                  player.seekTo(ann.videoTimestamp, true);
                                  player.playVideo();
                                  setCurrentTime(ann.videoTimestamp);
                                  showToast('Melompat ke anotasi video', 'success');
                                }
                              }}
                              className="px-2 py-0.5 text-[10px] font-mono font-black text-zinc-650 dark:text-zinc-300 hover:text-white bg-zinc-100 dark:bg-zinc-800 hover:bg-brand-navy dark:hover:bg-brand-orange dark:hover:text-brand-navy rounded transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Play size={8} className="fill-current" />
                              {formatVideoTime(ann.videoTimestamp || 0)}
                            </button>
                            
                            <button
                              onClick={() => handleDeleteAnnotation(ann.id)}
                              className="text-zinc-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/25 cursor-pointer"
                              title="Hapus anotasi"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Target Info */}
                        <div className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wide">
                          Target: <span className="text-zinc-800 dark:text-zinc-200">{getTargetName(ann)}</span>
                        </div>

                        {/* Subjective Star Rating */}
                        {ann.rating && (
                          <div className="flex items-center gap-0.5 mt-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={12}
                                className={s <= (ann.rating || 0) ? 'fill-brand-orange text-brand-orange' : 'text-zinc-200 dark:text-zinc-800'}
                              />
                            ))}
                          </div>
                        )}

                        {/* Annotation text */}
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-2 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-150/40 leading-relaxed font-medium">
                          {ann.note}
                        </p>
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

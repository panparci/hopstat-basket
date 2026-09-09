import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import YouTube, { YouTubeProps } from 'react-youtube';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ReferenceLine 
} from 'recharts';
import { 
  Trophy, 
  Calendar, 
  MapPin, 
  ShieldCheck, 
  Play, 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  Star, 
  Lock, 
  Eye, 
  BarChart2, 
  Video, 
  ChevronRight, 
  CheckCircle2, 
  ChevronLeft, 
  RefreshCw, 
  Layers,
  Award,
  AlertTriangle,
  Flame,
  Volume2
} from 'lucide-react';

import { initDB } from '../../../lib/db';
import { statsService } from '../../../core/services/statsService';
import { coachAnalysisService } from '../../coach-analysis/model/coachAnalysisService';
import { useToast } from '../../../core/contexts/ToastContext';
import { usePermissions } from '../../../core/contexts/PermissionsContext';
import { getPossessionPlayString } from '../../../shared/lib/possessionUtils';
import { isPlayingUp, parseKUFromString } from '../../../core/utils/ageCalculator';
import { AdvancedStatsDashboard } from '../../../components/organisms/AdvancedStatsDashboard';
import { BasketballCourt } from '../../../components/atoms/BasketballCourt';
import { Card } from '../../../shared/ui/Card';
import { Match, GameEvent, MatchRoster, Possession, ChildProfile, Player } from '../../../core/types/stats';
import { CoachAnnotation } from '../../../entities/coach-annotation/model/types';
import { PaymentRecord, StatServiceRequest } from '../../../core/types/serviceRequests';
import { canViewMatch } from '../../access-control/model/matchAccess';

export const MatchStory: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = usePermissions();

  // Mode state: 'simple' | 'pro'
  const [mode, setMode] = useState<'simple' | 'pro'>('simple');
  const [proSubTab, setProSubTab] = useState<'stats' | 'shotchart'>('stats');

  // DB Data state
  const [match, setMatch] = useState<Match | null>(null);
  const [possessions, setPossessions] = useState<Possession[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [matchRosters, setMatchRosters] = useState<MatchRoster[]>([]);
  const [coachAnnotations, setCoachAnnotations] = useState<CoachAnnotation[]>([]);
  const [childProfile, setChildProfile] = useState<ChildProfile | null>(null);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Video player references
  const [youtubePlayer, setYoutubePlayer] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeClipIndex, setActiveClipIndex] = useState<number | null>(null);

  // Shot Chart sub-states
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('all');
  const [selectedShot, setSelectedShot] = useState<GameEvent | null>(null);

  // Timeline & Filters
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'scoring' | 'coach'>('all');

  // Load All Match Data on Mount
  useEffect(() => {
    if (matchId) {
      loadMatchData(matchId);
    }
  }, [matchId]);

  const loadMatchData = async (mId: string) => {
    setLoading(true);
    try {
      const db = await initDB();
      const loadedMatch = await statsService.getMatch(mId);

      if (!loadedMatch) {
        showToast('Pertandingan tidak ditemukan', 'error');
        navigate('/');
        return;
      }

      setMatch(loadedMatch);

      // Load related data parallelly
      const [allPossessions, allEvents, rosters, annotations] = await Promise.all([
        statsService.getPossessions(mId),
        statsService.getEvents(mId),
        statsService.getMatchRosters(mId),
        coachAnalysisService.getAnnotationsByMatch(mId)
      ]);

      setPossessions(allPossessions.sort((a, b) => {
        if (a.period !== b.period) return a.period - b.period;
        return (b.clockStart ?? 0) - (a.clockStart ?? 0);
      }));

      setEvents(allEvents);
      setMatchRosters(rosters);
      setCoachAnnotations(annotations);

      // Load Child Profile if there is childId associated
      if (loadedMatch.childId) {
        const profile = await db.get('profiles', loadedMatch.childId);
        if (profile) {
          setChildProfile(profile);
        }
      }

      // Perform access check
      try {
        const loadedProfiles = await statsService.getProfiles();
        const athletesInMatch = loadedProfiles.filter(p => 
          p.id === loadedMatch.childId || rosters.some(r => r.profileId === p.id)
        );
        const allPayments: PaymentRecord[] = await db.getAll('payments');
        
        const allowed = canViewMatch(user, loadedMatch, athletesInMatch, allPayments);
        setIsAllowed(allowed);
      } catch (e) {
        console.error('Error in matchAccess check in MatchStory:', e);
        setIsAllowed(false);
      }

      // Check premium status
      await checkPremiumStatus(mId, loadedMatch.childId);

    } catch (error) {
      console.error('Error loading match story data:', error);
      showToast('Gagal memuat data cerita pertandingan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkPremiumStatus = async (mId: string, cId?: string) => {
    try {
      const db = await initDB();
      const allPayments: PaymentRecord[] = await db.getAll('payments');

      // 1. Check direct payment for this matchId (the watch/tonton payment)
      const directPayment = allPayments.find(
        p => p.requestId === mId && p.status === 'success' && p.amount >= 150000
      );
      if (directPayment) {
        setIsPremium(true);
        return;
      }

      // Check if this match has an associated request
      const allRequests: StatServiceRequest[] = await db.getAll('stat_requests');
      const request = allRequests.find(r => r.matchId === mId);

      // If the match was produced by ADMIN (price === 0), it requires a separate direct watch payment.
      // We only allow associated request payment or claim payment to grant premium watch access if the request's production price was greater than 0.
      const isProducedByAdmin = request && request.price === 0;

      if (!isProducedByAdmin) {
        // 2. Check payment for associated stat request (pembayaran produksi)
        if (request) {
          const requestPayment = allPayments.find(
            p => (p.requestId === request.id || p.id === request.paymentId) && 
                 p.status === 'success' && 
                 p.amount >= 150000
          );
          if (requestPayment) {
            setIsPremium(true);
            return;
          }
        }

        // 3. Check claim payment
        if (cId) {
          const allClaims = await db.getAll('claim_requests');
          const claim = allClaims.find(c => c.profileId === cId);
          if (claim) {
            const claimPayment = allPayments.find(
              p => (p.requestId === claim.id || p.id === claim.paymentId) && 
                   p.status === 'success' && 
                   p.amount >= 150000
            );
            if (claimPayment) {
              setIsPremium(true);
              return;
            }
          }
        }
      }

      setIsPremium(false);
    } catch (e) {
      console.error('Error checking premium status:', e);
      setIsPremium(false);
    }
  };

  const handleUpgrade = async () => {
    if (!match) return;
    try {
      const db = await initDB();
      const paymentId = crypto.randomUUID();
      const payment: PaymentRecord = {
        id: paymentId,
        requestId: match.id,
        amount: 150000,
        status: 'success',
        method: 'card',
        createdAt: Date.now()
      };
      await db.put('payments', payment);
      
      setIsPremium(true);
      showToast('Pembayaran berhasil! Akses premium diaktifkan.', 'success');
    } catch (e) {
      showToast('Gagal memproses pembayaran upgrade', 'error');
    }
  };

  // Extract YouTube ID
  const extractVideoId = (url?: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    return match ? match[1] : null;
  };

  const videoId = match?.videoUrl ? extractVideoId(match.videoUrl) : null;

  // YouTube player handlers
  const onPlayerReady = (event: any) => {
    setYoutubePlayer(event.target);
  };

  const onPlayerStateChange = (event: any) => {
    // 1 = playing, 2 = paused
    if (event.data === 1) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const jumpToTime = (seconds: number) => {
    if (youtubePlayer) {
      youtubePlayer.seekTo(seconds, true);
      youtubePlayer.playVideo();
      
      // Scroll smoothly to video on mobile devices
      const playerEl = document.getElementById('story-video-player');
      if (playerEl) {
        playerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      showToast('Memutar video... Pastikan player video siap.', 'info');
    }
  };

  // All Players List for dropdowns/renders
  const allPlayers = useMemo(() => {
    return matchRosters.map(r => ({
      id: r.profileId,
      name: r.name,
      jersey: r.jerseyNumber,
      isActive: r.isActive
    } as Player));
  }, [matchRosters]);

  // Scoring Progression for Trend Chart
  const scoreHistory = useMemo(() => {
    let homeScore = 0;
    let awayScore = 0;
    
    // Sort possessions in ascending chronological order (period asc, time remaining desc)
    const chronologicalPossessions = [...possessions].sort((a, b) => {
      if (a.period !== b.period) return a.period - b.period;
      return (b.clockStart ?? 0) - (a.clockStart ?? 0);
    });

    const progression = chronologicalPossessions.map((pos, idx) => {
      if (pos.teamInPossession === 'home') {
        homeScore += pos.pointsScored || 0;
      } else {
        awayScore += pos.pointsScored || 0;
      }
      return {
        name: `P${pos.period} ${pos.clockStart ? Math.floor(pos.clockStart / 60) + ':' + String(pos.clockStart % 60).padStart(2, '0') : ''}`,
        idx: idx + 1,
        Home: homeScore,
        Away: awayScore,
        Margin: homeScore - awayScore,
        raw: pos
      };
    });

    return progression;
  }, [possessions]);

  // Quarter Breakdown Score Calculations
  const quarterScores = useMemo(() => {
    if (!match) return [];
    const scores = Array.from({ length: match.periodCount || 4 }, (_, i) => ({
      period: i + 1,
      home: 0,
      away: 0
    }));

    const homeTeamId = match.teamId || 'home_team';
    const awayTeamId = match.opponentTeamId || 'away_team';

    events.forEach(e => {
      const isHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === e.playerId) || e.playerId === 'home_team';
      const isAway = matchRosters.some(r => r.teamId === awayTeamId && r.profileId === e.playerId) || e.playerId === 'opp' || e.playerId === 'away_team';
      
      let points = 0;
      if (e.type === '1pt_make') points = 1;
      else if (e.type === '2pt_make') points = 2;
      else if (e.type === '3pt_make') points = 3;

      if (points > 0) {
        const periodIdx = (e.quarter || 1) - 1;
        if (periodIdx >= 0 && periodIdx < scores.length) {
          if (isHome) {
            scores[periodIdx].home += points;
          } else if (isAway) {
            scores[periodIdx].away += points;
          }
        }
      }
    });

    return scores;
  }, [match, events, matchRosters]);

  const finalScores = useMemo(() => {
    const totalHome = quarterScores.reduce((sum, q) => sum + q.home, 0);
    const totalAway = quarterScores.reduce((sum, q) => sum + q.away, 0);
    return { home: totalHome, away: totalAway };
  }, [quarterScores]);

  // Aggregate Highlight Clips Playlist
  const highlightsPlaylist = useMemo(() => {
    // Collect possession indices that either have points scored or has coach annotations with youtubeTimestamp
    const list: {
      possessionId: string;
      timestamp: number;
      title: string;
      description: string;
      annotation?: CoachAnnotation;
      possession: Possession;
    }[] = [];

    possessions.forEach(pos => {
      const posEvents = events.filter(e => e.possessionId === pos.id);
      const annot = coachAnnotations.find(a => a.targetId === pos.id);
      
      // Get play string
      const playString = getPossessionPlayString(pos, events);

      // Find best timestamp from events
      const evtWithTime = posEvents.find(e => e.youtubeTimestamp !== undefined);
      const timestamp = evtWithTime?.youtubeTimestamp ?? annot?.videoTimestamp;

      if (timestamp !== undefined) {
        const hasPoints = pos.pointsScored > 0;
        const hasNotes = !!annot;

        if (hasPoints || hasNotes) {
          list.push({
            possessionId: pos.id,
            timestamp,
            title: hasPoints ? `Skor +${pos.pointsScored} Tembakan` : 'Analisis Taktis',
            description: playString,
            annotation: annot,
            possession: pos
          });
        }
      }
    });

    // Sort by chronological timing
    return list.sort((a, b) => {
      const posA = a.possession;
      const posB = b.possession;
      if (posA.period !== posB.period) return posA.period - posB.period;
      return (posB.clockStart ?? 0) - (posA.clockStart ?? 0);
    });
  }, [possessions, events, coachAnnotations]);

  // Handle playing playlist sequentially
  useEffect(() => {
    if (activeClipIndex !== null && highlightsPlaylist[activeClipIndex]) {
      const clip = highlightsPlaylist[activeClipIndex];
      jumpToTime(clip.timestamp);
    }
  }, [activeClipIndex]);

  const handleNextClip = () => {
    if (activeClipIndex === null) {
      setActiveClipIndex(0);
    } else if (activeClipIndex < highlightsPlaylist.length - 1) {
      setActiveClipIndex(activeClipIndex + 1);
    } else {
      showToast('Sudah berada di akhir playlist sorotan', 'info');
    }
  };

  const handlePrevClip = () => {
    if (activeClipIndex !== null && activeClipIndex > 0) {
      setActiveClipIndex(activeClipIndex - 1);
    }
  };

  // Filtered Timeline for Simple Mode
  const filteredTimeline = useMemo(() => {
    return possessions.filter(pos => {
      const posEvents = events.filter(e => e.possessionId === pos.id);
      const annot = coachAnnotations.find(a => a.targetId === pos.id);
      const hasTimestamp = posEvents.some(e => e.youtubeTimestamp !== undefined) || annot?.videoTimestamp !== undefined;
      
      if (!hasTimestamp) return false;

      if (timelineFilter === 'scoring') {
        return pos.pointsScored > 0;
      }
      if (timelineFilter === 'coach') {
        return !!annot;
      }
      return pos.pointsScored > 0 || !!annot; // All highlights default
    });
  }, [possessions, events, coachAnnotations, timelineFilter]);

  // Filtered Shots for Connected Shot Chart (Pro Mode)
  const filteredShots = useMemo(() => {
    return events.filter(e => 
      (e.type.includes('make') || e.type.includes('miss')) && 
      e.x !== undefined && 
      e.y !== undefined &&
      (selectedPlayerId === 'all' || e.playerId === selectedPlayerId)
    );
  }, [events, selectedPlayerId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 text-center">
        <RefreshCw className="animate-spin text-emerald-500 mb-4" size={48} />
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-150 uppercase tracking-wide">Memuat Cerita Pertandingan</h3>
        <p className="text-zinc-500 text-sm mt-1">Mengambil timeline, visualisasi, dan laporan tim...</p>
      </div>
    );
  }

  if (isAllowed === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center font-sans">
        <div className="max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-sm border border-zinc-150 dark:border-zinc-800 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center mb-6">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-2xl font-display font-black italic text-brand-navy dark:text-white uppercase tracking-wide mb-2">Akses Ditolak</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
            Anda tidak memiliki izin atau hak akses data tingkat-pemilik untuk melihat cerita pertandingan ini. 
            Hanya guardian terverifikasi dari atlet yang bertanding atau pengguna dengan akses premium yang diperbolehkan.
          </p>
          <div className="flex flex-col gap-2 w-full">
            <button 
              onClick={() => navigate('/games')}
              className="w-full bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy font-black text-sm py-3 px-4 rounded-xl hover:opacity-95 shadow-md transition-all cursor-pointer uppercase tracking-wider"
            >
              Kembali ke Pertandingan
            </button>
            {!user ? (
              <button 
                onClick={() => navigate('/login')}
                className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-white font-bold text-sm py-3 px-4 rounded-xl hover:opacity-95 transition-all cursor-pointer uppercase tracking-wider"
              >
                Login
              </button>
            ) : (
              <button 
                onClick={() => navigate('/services')}
                className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-white font-bold text-sm py-3 px-4 rounded-xl hover:opacity-95 transition-all cursor-pointer uppercase tracking-wider"
              >
                Minta Statistik (dari Video)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!match || isAllowed === null) return null;

  const opponentTeamName = match.theirTeamName || 'Lawan';
  const ourTeamName = match.ourTeamName || 'Tim Kami';
  const finalHomeScore = finalScores.home || 0;
  const finalAwayScore = finalScores.away || 0;

  // Playing Up evaluation
  let playUpType: 'own' | 'up' | 'down' | undefined = undefined;
  if (childProfile && match.date) {
    const matchKU = match.matchKU || parseKUFromString(match.ageGroup);
    playUpType = isPlayingUp(childProfile.birthDate, match.date, matchKU);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* Top Breadcrumb & Header Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-150 dark:border-zinc-800 pb-4">
        <button 
          onClick={() => navigate(`/match/${match.id}`)}
          className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300 font-bold text-sm uppercase tracking-wider hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors w-fit"
        >
          <ArrowLeft size={16} /> Kembali ke Detail
        </button>

        <div className="flex items-center gap-2 self-end sm:self-auto bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setMode('simple')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${mode === 'simple' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
          >
            <Sparkles size={14} className="text-emerald-500" /> Mode Sederhana
          </button>
          <button
            onClick={() => setMode('pro')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${mode === 'pro' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
          >
            <BarChart2 size={14} className="text-brand-orange" /> Mode Pro
          </button>
        </div>
      </div>

      {/* Match Context Display */}
      <div className="relative overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-black text-[10px] tracking-wider uppercase rounded-lg">
                Pertandingan Selesai
              </span>
              {childProfile && (
                <>
                  {childProfile.claimStatus === 'verified' && (
                    <span className="flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-black text-[10px] tracking-wider uppercase rounded-lg">
                      <ShieldCheck size={12} /> Verified Athlete
                    </span>
                  )}
                  {playUpType === 'up' && (
                    <span className="flex items-center gap-1 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-black text-[10px] tracking-wider uppercase rounded-lg">
                      <Award size={12} /> Playing-Up
                    </span>
                  )}
                </>
              )}
            </div>
            
            <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
              {ourTeamName} <span className="text-zinc-400 font-medium">vs</span> {opponentTeamName}
            </h1>

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span className="flex items-center gap-1.5"><Calendar size={14} /> {match.date}</span>
              {match.venue && <span className="flex items-center gap-1.5"><MapPin size={14} /> {match.venue}</span>}
              <span className="flex items-center gap-1.5"><Trophy size={14} /> KU-{match.matchKU || match.ageGroup} {match.competitionLevel}</span>
            </div>
          </div>

          <div className="md:col-span-4 bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-150 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Skor Akhir</p>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-zinc-900 dark:text-white">{finalHomeScore}</span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">{ourTeamName.substring(0, 3)}</span>
              </div>
              <span className="text-lg font-bold text-zinc-300">-</span>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-zinc-900 dark:text-white">{finalAwayScore}</span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">{opponentTeamName.substring(0, 3)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Free vs Paid Features Info Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50/60 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-800/80 text-xs leading-relaxed">
        <div className="flex items-start gap-2.5">
          <span className="p-1 bg-emerald-500/10 text-emerald-500 rounded-md shrink-0">
            <CheckCircle2 size={14} />
          </span>
          <div>
            <span className="font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide text-[10px] block">FITUR GRATIS</span>
            <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">Ringkasan skor, statistik box-score dasar atlet, bagan & grafik tren margin skor.</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800 pt-3 md:pt-0 md:pl-4">
          <span className={`p-1 rounded-md shrink-0 ${isPremium ? 'bg-emerald-500/10 text-emerald-500' : 'bg-brand-orange/10 text-brand-orange'}`}>
            {isPremium ? <ShieldCheck size={14} /> : <Lock size={14} />}
          </span>
          <div>
            <span className={`font-black uppercase tracking-wide text-[10px] block ${isPremium ? 'text-emerald-600 dark:text-emerald-400' : 'text-brand-orange'}`}>
              FITUR PREMIUM {isPremium ? '(AKTIF)' : '(TERKUNCI)'}
            </span>
            <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">Termasuk pemutaran video interaktif, cuplikan sorotan momen, dan catatan detail evaluasi Coach.</p>
          </div>
        </div>
      </div>

      {/* Main Feature Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Video Player & Highlight Playlist */}
        <div className="lg:col-span-5 space-y-6">
          {/* YouTube Sticky Video Player */}
          <div id="story-video-player" className="sticky top-6 z-10 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="bg-zinc-900 dark:bg-black px-4 py-3 flex items-center justify-between text-white border-b border-zinc-800">
              <span className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider text-emerald-400">
                <Video size={14} /> Media Replay
              </span>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`}></span>
                <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">{isPlaying ? 'Playing' : 'Paused'}</span>
              </div>
            </div>

            {!isPremium ? (
              <div className="relative aspect-video bg-zinc-900/90 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                {/* Background representation with severe blur */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-orange/20 via-zinc-900 to-zinc-950 opacity-60 backdrop-blur-xl"></div>
                
                <div className="relative z-10 space-y-3.5 max-w-sm px-4">
                  <div className="inline-flex p-3 bg-brand-orange/10 border border-brand-orange/20 text-brand-orange rounded-full">
                    <Lock size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm uppercase tracking-wider text-white flex items-center justify-center gap-1.5">
                      Video Review Lengkap
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      Tonton rekaman video per momentum/possession dan baca catatan detail Coach bersertifikat.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleUpgrade}
                    className="w-full py-2.5 bg-brand-orange hover:bg-opacity-95 text-brand-navy font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles size={14} /> Buka Review Lengkap — Rp 150.000
                  </button>
                </div>
              </div>
            ) : videoId ? (
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
                  onReady={onPlayerReady}
                  onStateChange={onPlayerStateChange}
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            ) : (
              <div className="aspect-video bg-zinc-100 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
                <Volume2 size={40} className="text-zinc-400 mb-2" />
                <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">Video Tidak Tersedia</p>
                <p className="text-xs text-zinc-400 mt-1">Pertandingan ini tidak memiliki video YouTube yang tersemat.</p>
              </div>
            )}

            {/* Playlist Controls under the video */}
            {highlightsPlaylist.length > 0 && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-150 dark:border-zinc-800 space-y-3 relative overflow-hidden">
                {!isPremium && (
                  <div className="absolute inset-0 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-[1px] z-20 flex items-center justify-center p-4">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm">
                      <Lock size={12} className="text-brand-orange" /> Playlist Sorotan Terkunci
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                    <Layers size={12} className="text-emerald-500" /> Playlist Sorotan ({highlightsPlaylist.length} klip)
                  </h4>
                  <div className="flex gap-1">
                    <button
                      onClick={handlePrevClip}
                      disabled={activeClipIndex === null || activeClipIndex === 0}
                      className="p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={handleNextClip}
                      disabled={activeClipIndex === highlightsPlaylist.length - 1}
                      className="p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {activeClipIndex !== null && highlightsPlaylist[activeClipIndex] ? (
                  <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-black text-[10px] uppercase text-emerald-500">Momen {activeClipIndex + 1} sedang diputar</span>
                      <span className="font-mono text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                        {Math.floor(highlightsPlaylist[activeClipIndex].timestamp / 60)}:
                        {String(highlightsPlaylist[activeClipIndex].timestamp % 60).padStart(2, '0')}
                      </span>
                    </div>
                    <p className="font-bold text-zinc-800 dark:text-zinc-200 mt-1 line-clamp-2">
                      {highlightsPlaylist[activeClipIndex].description}
                    </p>
                    {highlightsPlaylist[activeClipIndex].annotation && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 italic border-l-2 border-emerald-500 pl-2 line-clamp-1">
                        Coach: {highlightsPlaylist[activeClipIndex].annotation?.note}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveClipIndex(0)}
                    className="w-full py-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Play size={12} className="text-emerald-500 fill-emerald-500" /> Putar Playlist Sorotan
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Mode-Specific Contents */}
        <div className="lg:col-span-7 space-y-6">
          {/* ======================================= */}
          {/*          1. MODE SEDERHANA              */}
          {/* ======================================= */}
          {mode === 'simple' && (
            <div className="space-y-6">
              {/* Quarters breakdown & scoring details */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-4">
                <h3 className="font-black text-xs uppercase tracking-wider text-zinc-400">Rincian Skor Per Kuarter</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-center text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold text-xs uppercase">
                        <th className="py-2 text-left">Tim</th>
                        {quarterScores.map(q => (
                          <th key={q.period} className="py-2">K{q.period}</th>
                        ))}
                        <th className="py-2 font-black text-zinc-900 dark:text-white">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      <tr className="text-zinc-800 dark:text-zinc-200">
                        <td className="py-3 text-left font-black">{ourTeamName}</td>
                        {quarterScores.map(q => (
                          <td key={q.period} className="py-3 font-medium">{q.home}</td>
                        ))}
                        <td className="py-3 font-black text-lg text-emerald-600 dark:text-emerald-400">{finalHomeScore}</td>
                      </tr>
                      <tr className="text-zinc-800 dark:text-zinc-200">
                        <td className="py-3 text-left font-black">{opponentTeamName}</td>
                        {quarterScores.map(q => (
                          <td key={q.period} className="py-3 font-medium">{q.away}</td>
                        ))}
                        <td className="py-3 font-black text-lg text-zinc-600 dark:text-zinc-400">{finalAwayScore}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Score Margin / Trend Sparkline Chart */}
              {scoreHistory.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-4">
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-wider text-zinc-400">Grafik Margin Skor Pertandingan</h3>
                    <p className="text-xs text-zinc-500 mt-1">Grafik area di atas garis tengah menunjukkan keunggulan {ourTeamName}, di bawah menunjukkan {opponentTeamName}.</p>
                  </div>
                  <div className="w-full h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={scoreHistory}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <XAxis dataKey="idx" hide />
                        <YAxis />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const marginVal = data.Margin;
                              const leadingStr = marginVal > 0 
                                ? `${ourTeamName} +${marginVal}` 
                                : marginVal < 0 
                                  ? `${opponentTeamName} +${Math.abs(marginVal)}`
                                  : 'Imbang';

                              return (
                                <div className="bg-zinc-950 text-white p-2 text-[11px] rounded-xl shadow-lg border border-zinc-800">
                                  <p className="font-black uppercase text-emerald-400 mb-0.5">{leadingStr}</p>
                                  <p className="font-medium text-zinc-300">Skor: {data.Home} - {data.Away}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <ReferenceLine y={0} stroke="#71717a" strokeWidth={1} strokeDasharray="3 3" />
                        <Area 
                          type="monotone" 
                          dataKey="Margin" 
                          stroke="#10b981" 
                          fill="#10b981" 
                          fillOpacity={0.2} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Timeline of Highlights */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-150 dark:border-zinc-800 pb-3">
                  <h3 className="font-black text-sm uppercase tracking-wider text-zinc-900 dark:text-white">Alur Momen Penting</h3>
                  
                  {/* Timeline Filters */}
                  <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl text-[10px] font-bold uppercase tracking-wider w-fit">
                    <button
                      onClick={() => setTimelineFilter('all')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${timelineFilter === 'all' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'}`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => setTimelineFilter('scoring')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${timelineFilter === 'scoring' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'}`}
                    >
                      Skor
                    </button>
                    <button
                      onClick={() => setTimelineFilter('coach')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${timelineFilter === 'coach' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'}`}
                    >
                      Analisis Coach
                    </button>
                  </div>
                </div>

                {filteredTimeline.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl">
                    <p className="text-zinc-400 text-xs">Tidak ada momen penting yang sesuai dengan filter.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredTimeline.map((pos, idx) => {
                      const posEvents = events.filter(e => e.possessionId === pos.id);
                      const annot = coachAnnotations.find(a => a.targetId === pos.id);
                      const playString = getPossessionPlayString(pos, events);

                      // Find timing
                      const evtWithTime = posEvents.find(e => e.youtubeTimestamp !== undefined);
                      const timestamp = evtWithTime?.youtubeTimestamp ?? annot?.videoTimestamp;

                      return (
                        <Card key={pos.id} className="p-5 border border-zinc-150 dark:border-zinc-800 relative overflow-hidden flex flex-col md:flex-row md:items-start justify-between gap-4 group">
                          <div className="space-y-2.5 flex-1">
                            {/* Quarter and clock header */}
                            <div className="flex items-center gap-2">
                              <span className="font-black text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded uppercase">
                                K{pos.period} - {pos.clockStart ? `${Math.floor(pos.clockStart / 60)}:${String(pos.clockStart % 60).padStart(2, '0')}` : ''}
                              </span>
                              {pos.pointsScored > 0 && (
                                <span className="font-black text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded">
                                  SKOR +{pos.pointsScored}
                                </span>
                              )}
                            </div>

                            {/* Narration of play */}
                            <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200 uppercase tracking-tight">
                              {playString}
                            </p>

                            {/* Coach Analysis Section */}
                            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 mt-2">
                              {isPremium ? (
                                <>
                                  {annot ? (
                                    <div className="space-y-2 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3.5 rounded-2xl">
                                      <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-1 font-black text-[10px] uppercase text-emerald-600 dark:text-emerald-400">
                                          <ShieldCheck size={12} /> Analisis Coach Bersertifikat
                                        </span>
                                        {annot.rating && (
                                          <div className="flex items-center gap-0.5">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                              <Star 
                                                key={i} 
                                                size={11} 
                                                className={i < (annot.rating ?? 0) ? 'text-amber-500 fill-amber-500' : 'text-zinc-300'} 
                                              />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                                        {annot.note}
                                      </p>
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-[9px] font-bold text-emerald-500 bg-emerald-100/50 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full uppercase">
                                          Kategori: {annot.category}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-zinc-400 italic">Belum ada evaluasi coach tertulis untuk momen ini.</p>
                                  )}
                                </>
                              ) : (
                                /* Gating Tier Premium Teaser Box */
                                <div className="relative bg-zinc-50/60 dark:bg-zinc-950/40 border border-dashed border-zinc-200 dark:border-zinc-800/80 p-4 rounded-2xl text-center select-none overflow-hidden">
                                  <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-3">
                                    <div className="bg-white/95 dark:bg-zinc-900/95 p-3 px-4 rounded-2xl shadow-md border border-zinc-150 dark:border-zinc-800 flex flex-col items-center max-w-xs">
                                      <Lock size={14} className="text-brand-orange mb-1.5" />
                                      <h5 className="text-[11px] font-black uppercase text-zinc-800 dark:text-zinc-200 tracking-wide">Analisis Coach Terkunci</h5>
                                      <p className="text-[9px] text-zinc-500 dark:text-zinc-400 leading-relaxed mt-0.5">
                                        Termasuk video review & catatan coach (narasi, rating, kategori)
                                      </p>
                                    </div>
                                  </div>
                                  {/* Dummy text behind blur */}
                                  <div className="opacity-10 space-y-1.5 text-left">
                                    <div className="h-3 w-1/3 bg-zinc-400 rounded"></div>
                                    <div className="h-2 w-full bg-zinc-400 rounded"></div>
                                    <div className="h-2 w-5/6 bg-zinc-400 rounded"></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick Watch Replay action */}
                          {timestamp !== undefined && (
                            <button
                              onClick={isPremium ? () => jumpToTime(timestamp) : handleUpgrade}
                              className={`md:self-center px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-1.5 w-full md:w-auto cursor-pointer ${
                                isPremium 
                                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:scale-105' 
                                  : 'bg-zinc-150 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                              }`}
                            >
                              {isPremium ? (
                                <>
                                  <Play size={11} className="fill-current" /> Tonton Momen
                                </>
                              ) : (
                                <>
                                  <Lock size={11} /> Buka Tontonan
                                </>
                              )}
                            </button>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/*            2. MODE PRO                  */}
          {/* ======================================= */}
          {mode === 'pro' && (
            <div className="space-y-6">
              {/* Pro Sub Tab Toggles */}
              <div className="flex border-b border-zinc-150 dark:border-zinc-800">
                <button
                  onClick={() => setProSubTab('stats')}
                  className={`px-5 py-3 border-b-2 font-black text-xs uppercase tracking-wider transition-all ${proSubTab === 'stats' ? 'border-brand-orange text-brand-orange' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
                >
                  Statistik Lengkap
                </button>
                <button
                  onClick={() => setProSubTab('shotchart')}
                  className={`px-5 py-3 border-b-2 font-black text-xs uppercase tracking-wider transition-all ${proSubTab === 'shotchart' ? 'border-brand-orange text-brand-orange' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
                >
                  Shot Chart Terhubung
                </button>
              </div>

              {/* Pro subtab 1: Full stats dashboard */}
              {proSubTab === 'stats' && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
                  <AdvancedStatsDashboard 
                    events={events} 
                    players={allPlayers} 
                    team="home" 
                    opponentEvents={events.filter(e => e.team === 'away' || e.playerId === 'opp')}
                    homeRosterIds={matchRosters.filter(r => r.teamId === (match.teamId || 'home_team')).map(r => r.profileId)}
                    awayRosterIds={matchRosters.filter(r => r.teamId === (match.opponentTeamId || 'away_team')).map(r => r.profileId)}
                    possessions={possessions}
                  />
                </div>
              )}

              {/* Pro subtab 2: Connected shot chart with video playbacks */}
              {proSubTab === 'shotchart' && (
                <div className="space-y-6 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-black text-sm uppercase tracking-wider text-zinc-900 dark:text-white">Peta Tembakan Interaktif</h3>
                      <p className="text-xs text-zinc-500 mt-1">Klik pada dot tembakan untuk melihat rincian play dan menonton video rekamannya.</p>
                    </div>

                    <select
                      value={selectedPlayerId}
                      onChange={(e) => {
                        setSelectedPlayerId(e.target.value);
                        setSelectedShot(null);
                      }}
                      className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-orange text-zinc-800 dark:text-zinc-150"
                    >
                      <option value="all">Semua Pemain</option>
                      {allPlayers.map(p => (
                        <option key={p.id} value={p.id}>#{p.jersey} - {p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Basketball Court with active shot dots */}
                  <div className="relative w-full max-w-lg mx-auto">
                    <BasketballCourt className="shadow-inner rounded-2xl border border-zinc-200 dark:border-zinc-800">
                      {filteredShots.map((shot) => {
                        const isMake = shot.type.includes('make');
                        const isSelected = selectedShot?.id === shot.id;

                        return (
                          <button
                            key={shot.id}
                            onClick={() => setSelectedShot(shot)}
                            className={`absolute -ml-2.5 -mt-2.5 z-10 flex items-center justify-center p-0.5 transition-transform hover:scale-150 ${isSelected ? 'scale-150 ring-4 ring-orange-500 rounded-full bg-white dark:bg-zinc-900 z-20' : ''}`}
                            style={{
                              left: `${shot.x}%`,
                              top: `${shot.y}%`,
                              width: '20px',
                              height: '20px',
                            }}
                            title={`${isMake ? 'Make' : 'Miss'} - Q${shot.quarter}`}
                          >
                            {isMake ? (
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white shadow-sm"></div>
                            ) : (
                              <span className="text-red-500 font-bold text-sm leading-none drop-shadow-sm select-none">×</span>
                            )}
                          </button>
                        );
                      })}
                    </BasketballCourt>
                  </div>

                  {/* Selected Shot Details Card */}
                  {selectedShot ? (
                    <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded ${selectedShot.type.includes('make') ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {selectedShot.type.includes('make') ? 'TEMBAKAN MASUK (MAKE)' : 'TEMBAKAN GAGAL (MISS)'}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          K{selectedShot.quarter} - {selectedShot.gameClock || `${Math.floor(selectedShot.timestamp / 60)}:${String(selectedShot.timestamp % 60).padStart(2, '0')}`}
                        </span>
                      </div>

                      <div className="text-xs">
                        <p className="font-bold text-zinc-900 dark:text-white">
                          Pemain: {allPlayers.find(p => p.id === selectedShot.playerId)?.name || 'Pemain Utama'}
                        </p>
                        {selectedShot.metadata?.areaName && (
                          <p className="text-zinc-500 mt-0.5">Area Lapangan: {selectedShot.metadata.areaName}</p>
                        )}
                        
                        {/* Play narration */}
                        {selectedShot.possessionId && (
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-2 italic bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            Play: {getPossessionPlayString(possessions.find(p => p.id === selectedShot.possessionId) || { id: selectedShot.possessionId, pointsScored: 0, teamInPossession: 'home', period: selectedShot.quarter } as Possession, events)}
                          </p>
                        )}
                      </div>

                      {selectedShot.youtubeTimestamp !== undefined && (
                        <button
                          onClick={isPremium ? () => jumpToTime(selectedShot.youtubeTimestamp!) : handleUpgrade}
                          className={`w-full py-2 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isPremium 
                              ? 'bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm' 
                              : 'bg-zinc-150 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          {isPremium ? (
                            <>
                              <Play size={12} className="fill-current" /> Tonton Rekaman Tembakan
                            </>
                          ) : (
                            <>
                              <Lock size={12} /> Buka Tontonan
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="py-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                      <p className="text-xs text-zinc-400 font-medium">Silakan klik dot pada peta lapangan untuk melihat klip tembakan.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Trophy, 
  Calendar, 
  MapPin, 
  Clock, 
  Settings, 
  ShieldCheck, 
  AlertTriangle, 
  Info,
  CheckCircle2,
  XCircle,
  Eye,
  ExternalLink,
  Play,
  RotateCcw,
  ArrowRightLeft,
  Plus,
  History,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { statsService } from '../core/services/statsService';
import { initDB } from '../lib/db';
import { canViewMatch } from '../features/access-control/model/matchAccess';
import { generateId } from '../core/utils/idUtils';
import { formatKU, isPlayingUp } from '../core/utils/ageCalculator';
import { CompetitionGrade, COMPETITION_GRADE_LABELS, COMPETITION_GRADE_COLORS } from '../core/config/competition';
import { useToast } from '../core/contexts/ToastContext';
import { usePermissions } from '../core/contexts/PermissionsContext';
import { StageProgress } from '../shared/ui/StageProgress';
import { Match, GameState, GameEvent, Player, MatchStint, EventLink, MatchAuditResult, AuditIssue, AuditIssueStatus, MatchRoster, Possession, ChildProfile } from '../core/types/stats';
import { ShotChartAnalysis } from '../components/organisms/ShotChartAnalysis';
import { AdvancedStatsDashboard } from '../components/organisms/AdvancedStatsDashboard';
import { LineupCombinations } from '../components/organisms/LineupCombinations';
import { EventAndPossessionLog } from '../components/organisms/EventAndPossessionLog';
import { Card } from '../components/atoms/Card';
import { EditMatchModal } from '../components/organisms/EditMatchModal';
import { StintTimelineEditor } from '../components/organisms/StintTimelineEditor';
import { motion, AnimatePresence } from 'motion/react';
import { MomentumChart } from '../features/match-momentum/ui/MomentumChart';

export const MatchDetailsPage: React.FC = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, can } = usePermissions();
  const [match, setMatch] = useState<Match | null>(null);
  const [childProfile, setChildProfile] = useState<ChildProfile | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [matchStints, setMatchStints] = useState<MatchStint[]>([]);
  const [matchRosters, setMatchRosters] = useState<MatchRoster[]>([]);
  const [eventLinks, setEventLinks] = useState<EventLink[]>([]);
  const [auditResult, setAuditResult] = useState<MatchAuditResult | null>(null);
  const [reviewingIssue, setReviewingIssue] = useState<AuditIssue | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [possessions, setPossessions] = useState<Possession[]>([]);
  const [activeTab, setActiveTab] = useState<'team' | 'basic' | 'advanced' | 'deep' | 'lineups' | 'shotchart' | 'logs' | 'health' | 'momentum'>('team');
  const [viewMode, setViewMode] = useState<'simple' | 'pro'>('simple');
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStintEditor, setShowStintEditor] = useState(false);
  const [batchFixPreview, setBatchFixPreview] = useState<{ count: number, types: Record<string, number> } | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.8);
  const [showAhaModal, setShowAhaModal] = useState(false);

  const [quickAddData, setQuickAddData] = useState<{
    quarter: number;
    timestamp: number;
    team: 'home' | 'away';
    playerId?: string;
    type?: string;
  } | null>(null);

  const loadData = async () => {
    if (!gameId) return;
    try {
      const m = await statsService.getMatch(gameId);
      const gs = await statsService.getGameState(gameId);
      
      if (!gs && m) {
        // Initialize state if missing
        const initialState: GameState = {
          matchId: gameId,
          homeScore: 0,
          awayScore: 0,
          homeFouls: 0,
          awayFouls: 0,
          homeTimeouts: 0,
          awayTimeouts: 0,
          currentQuarter: 1,
          timeRemaining: (m.durationPerPeriod || 10) * 60,
          isRunning: false
        };
        await statsService.saveGameState(initialState);
        setGameState(initialState);
      } else {
        setGameState(gs || null);
      }

      const evs = await statsService.getEvents(gameId);
      const stints = await statsService.getValidMatchStints(gameId);
      const rosters = await statsService.getMatchRosters(gameId);
      const links = await statsService.getEventLinks(gameId);
      
      let audit: MatchAuditResult | null = null;
      try {
        audit = await statsService.auditMatchIntegrity(gameId);
      } catch (e) {
        console.warn('Audit failed:', e);
      }
      
      // Sort events chronologically: Quarter asc, then Clock desc (since clock counts down)
      const sortedEvents = [...evs].sort((a, b) => {
        if (a.quarter !== b.quarter) return a.quarter - b.quarter;
        if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
        
        // If the game time clock is the same, sort by chronological registration order (ascending realTime)
        const timeA = a.realTime ? new Date(a.realTime).getTime() : 0;
        const timeB = b.realTime ? new Date(b.realTime).getTime() : 0;
        return timeA - timeB;
      });

      let possList: Possession[] = [];
      try {
        possList = await statsService.getPossessions(gameId);
      } catch (e) {
        console.warn('Failed to load possessions:', e);
      }

      setMatch(m || null);
      try {
        const loadedProfiles = await statsService.getProfiles();
        setProfiles(loadedProfiles);
        if (m && m.childId) {
          const foundChild = loadedProfiles.find(p => p.id === m.childId);
          if (foundChild) {
            setChildProfile(foundChild);
          }
        }
      } catch (e) {
        console.warn('Failed to load profiles:', e);
      }
      setEvents(sortedEvents);
      setMatchStints(stints);
      setMatchRosters(rosters);
      setEventLinks(links);
      setAuditResult(audit);
      setPossessions(possList);

      // Perform access check
      if (m) {
        try {
          const db = await initDB();
          const allPayments = await db.getAll('payments');
          const loadedProfiles = await statsService.getProfiles();
          const athletesInMatch = loadedProfiles.filter(p => 
            p.id === m.childId || rosters.some(r => r.profileId === p.id)
          );
          const allowed = canViewMatch(user, m, athletesInMatch, allPayments);
          setIsAllowed(allowed);
        } catch (e) {
          console.error('Error in matchAccess check:', e);
          setIsAllowed(false);
        }
      } else {
        setIsAllowed(false);
      }
    } catch (error) {
      console.error('Failed to load match data:', error);
    }
  };

  const handleAdvanceStage = async () => {
    if (!match) return;
    if (!user) {
      showToast('Silakan login terlebih dahulu.', 'error');
      return;
    }
    try {
      const { pipelineService } = await import('../features/production-pipeline/model/pipelineService');
      const updatedMatch = await pipelineService.advanceStage(match.id, user);
      setMatch(updatedMatch);
      showToast('Berhasil memajukan tahap produksi pertandingan!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah tahap produksi', 'error');
    }
  };

  const handleReturnStage = async (note?: string) => {
    if (!match) return;
    if (!user) {
      showToast('Silakan login terlebih dahulu.', 'error');
      return;
    }
    try {
      const { pipelineService } = await import('../features/production-pipeline/model/pipelineService');
      const updatedMatch = await pipelineService.returnStage(match.id, user, note);
      setMatch(updatedMatch);
      showToast('Berhasil mengembalikan tahap produksi pertandingan!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengembalikan tahap produksi', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, [gameId]);

  useEffect(() => {
    if (match && match.status === 'completed') {
      const checkAhaMoment = async () => {
        const hasCelebrated = localStorage.getItem('first_match_celebrated') === 'true';
        if (!hasCelebrated) {
          const allMatches = await statsService.getMatches();
          const completedMatches = allMatches.filter(m => m.status === 'completed');
          if (completedMatches.length === 1) {
            setShowAhaModal(true);
          }
        }
      };
      checkAhaMoment();
    }
  }, [match]);

  // Set default view mode based on user role
  useEffect(() => {
    if (user) {
      if (['statistician', 'coach', 'scout', 'admin'].includes(user.role)) {
        setViewMode('pro');
      } else {
        setViewMode('simple');
      }
    } else {
      setViewMode('simple');
    }
  }, [user]);

  // Restrict activeTab when switching to simple mode
  useEffect(() => {
    if (viewMode === 'simple') {
      const allowedTabs = ['team', 'momentum', 'shotchart'];
      if (!allowedTabs.includes(activeTab)) {
        setActiveTab('team');
      }
    }
  }, [viewMode, activeTab]);

  if (isAllowed === false) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-sm border border-zinc-150 dark:border-zinc-800 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center mb-6">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-2xl font-display font-black italic text-brand-navy dark:text-white uppercase tracking-wide mb-2">Akses Ditolak</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
            Anda tidak memiliki izin atau hak akses data tingkat-pemilik untuk melihat detail pertandingan ini. 
            Hanya guardian terverifikasi dari atlet yang bertanding atau pengguna dengan akses premium yang diperbolehkan.
          </p>
          <div className="flex flex-col gap-2 w-full">
            <button 
              onClick={() => navigate(-1)}
              className="w-full bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy font-black text-sm py-3 px-4 rounded-xl hover:opacity-95 shadow-md transition-all cursor-pointer uppercase tracking-wider"
            >
              Kembali
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

  if (!match || !gameState || isAllowed === null) return <div className="p-8 text-center text-zinc-500">Loading...</div>;

  const allPlayers = matchRosters.map(r => ({ id: r.profileId, name: r.name, jersey: r.jerseyNumber, isActive: r.isActive, isGuest: r.isGuest, guestForTeamId: r.guestForTeamId } as Player));

  const handleUpdateIssueStatus = async (issueId: string, status: AuditIssueStatus) => {
    if (!gameId) return;
    setIsUpdatingStatus(true);
    try {
      await statsService.saveAuditIssueResolution(gameId, issueId, status);
      const result = await statsService.auditMatchIntegrity(gameId);
      setAuditResult(result);
      if (reviewingIssue?.id === issueId) {
        setReviewingIssue(prev => prev ? { ...prev, status } : null);
      }
    } catch (error) {
      console.error('Failed to update issue status:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleApplySuggestion = async (issue: AuditIssue) => {
    if (!gameId || !issue.suggestion) return;
    setIsUpdatingStatus(true);
    try {
      const success = await statsService.applyAuditSuggestion(gameId, issue);
      if (!success) {
        showToast('Fix gagal, data sudah berubah — jalankan audit ulang', 'error');
      }
      const evs = await statsService.getEvents(gameId);
      const links = await statsService.getEventLinks(gameId);
      const audit = await statsService.auditMatchIntegrity(gameId);
      setEvents(evs);
      setEventLinks(links);
      setAuditResult(audit);
      setReviewingIssue(null);
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleBatchApplyAll = async () => {
    if (!gameId || !auditResult) return;
    
    const issuesWithSuggestions = auditResult.issues.filter(i => 
      i.suggestion && 
      i.status === 'open' && 
      i.suggestion.confidence >= confidenceThreshold
    );

    if (issuesWithSuggestions.length === 0) return;

    // Show preview first
    const types: Record<string, number> = {};
    issuesWithSuggestions.forEach(i => {
      const type = i.suggestion!.type;
      types[type] = (types[type] || 0) + 1;
    });

    setBatchFixPreview({ count: issuesWithSuggestions.length, types });
  };

  const confirmBatchFix = async () => {
    if (!gameId || !auditResult) return;
    setIsUpdatingStatus(true);
    try {
      const issuesWithSuggestions = auditResult.issues.filter(i => 
        i.suggestion && 
        i.status === 'open' && 
        i.suggestion.confidence >= confidenceThreshold
      );
      await statsService.applyBatchSuggestions(gameId, issuesWithSuggestions, confidenceThreshold);
      const evs = await statsService.getEvents(gameId);
      const links = await statsService.getEventLinks(gameId);
      const audit = await statsService.auditMatchIntegrity(gameId);
      setEvents(evs);
      setEventLinks(links);
      setAuditResult(audit);
      setBatchFixPreview(null);
    } catch (error) {
      console.error('Failed to apply batch suggestions:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusColor = (status: AuditIssueStatus) => {
    switch (status) {
      case 'resolved': return 'text-green-500 bg-green-500/10';
      case 'dismissed': return 'text-zinc-400 bg-zinc-400/10';
      case 'reviewed': return 'text-blue-500 bg-blue-500/10';
      default: return 'text-orange-500 bg-orange-500/10';
    }
  };

  const handleQuickAddEvent = async () => {
    if (!gameId || !quickAddData || !quickAddData.type || !quickAddData.playerId) return;
    
    setIsUpdatingStatus(true);
    try {
      const newEvent: GameEvent = {
        id: generateId('manual'),
        matchId: gameId,
        playerId: quickAddData.playerId,
        team: quickAddData.team,
        type: quickAddData.type as any,
        timestamp: quickAddData.timestamp,
        quarter: quickAddData.quarter,
        realTime: new Date().toISOString(),
        youtubeTimestamp: quickAddData.timestamp // Default to game clock if no video sync
      };

      await statsService.addEvent(newEvent);
      await statsService.rebuildPossessions(gameId, match!);
      
      // Refresh data
      await loadData();
      setQuickAddData(null);
    } catch (error) {
      console.error('Failed to add quick event:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const renderIssueReviewModal = () => {
    if (!reviewingIssue) return null;

    const relatedEvent = reviewingIssue.relatedIds?.eventId 
      ? events.find(e => e.id === reviewingIssue.relatedIds?.eventId) 
      : null;
    
    const extractYtId = (url?: string) => {
      if (!url) return null;
      const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([^&?\/#]+)/);
      return m ? m[1] : null;
    };
    const youtubeId = extractYtId(match?.videoUrl);
    const timestamp = relatedEvent?.youtubeTimestamp || relatedEvent?.timestamp;

    const activeStint = reviewingIssue.relatedIds?.stintId 
      ? matchStints.find(s => s.id === reviewingIssue.relatedIds?.stintId)
      : null;
    
    const lineupPlayers = (activeStint?.playerIds || []).map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as Player[];

    // Nearby events logic
    const nearbyEvents = (() => {
      if (!relatedEvent) return [];
      const idx = events.findIndex(e => e.id === relatedEvent.id);
      if (idx === -1) return [];
      const start = Math.max(0, idx - 2);
      const end = Math.min(events.length, idx + 3);
      return events.slice(start, end);
    })();

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-4xl overflow-hidden shadow-2xl border border-zinc-100 dark:border-zinc-800 my-8"
        >
          <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
            {/* Left Column: Video & Timeline */}
            <div className="lg:w-1/2 border-r border-zinc-100 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-950/50">
              {youtubeId && timestamp !== undefined ? (
                <div className="aspect-video bg-black relative">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${youtubeId}?start=${Math.max(0, Math.floor(timestamp) - 3)}&autoplay=1&enablejsapi=1`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              ) : (
                <div className="aspect-video bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <Play className="w-12 h-12 opacity-20" />
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                    <History className="w-3 h-3" />
                    Nearby Events
                  </h4>
                </div>
                
                <div className="space-y-2">
                  {nearbyEvents.map((ev, idx) => {
                    const isMain = ev.id === relatedEvent?.id;
                    const player = allPlayers.find(p => p.id === ev.playerId);
                    
                    return (
                      <div key={ev.id} className="relative">
                        <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isMain 
                            ? 'bg-white dark:bg-zinc-800 border-blue-500 shadow-sm z-10' 
                            : 'bg-transparent border-transparent opacity-60'
                        }`}>
                          <div className="text-xs font-mono text-zinc-400 w-10 shrink-0">
                            {Math.floor(ev.timestamp / 60)}:{(ev.timestamp % 60).toString().padStart(2, '0')}
                          </div>
                          <div className={`w-2 h-2 rounded-full shrink-0 ${isMain ? 'bg-blue-500 animate-pulse' : 'bg-zinc-300'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold truncate">{ev.type.replace('_', ' ').toUpperCase()}</span>
                              <span className={`text-xs px-1 rounded font-black ${ev.team === 'home' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                                {ev.team?.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-xs text-zinc-500 truncate">
                              {player ? `#${player.jersey} ${player.name}` : 'Team'}
                            </div>
                          </div>
                        </div>
                        
                        {/* Insert Button between events */}
                        {idx < nearbyEvents.length - 1 && (
                          <div className="flex justify-center -my-1 relative z-20">
                            <button 
                              onClick={() => setQuickAddData({
                                quarter: ev.quarter,
                                timestamp: Math.floor((ev.timestamp + nearbyEvents[idx+1].timestamp) / 2),
                                team: ev.team as any || 'home',
                                type: '2pt_make'
                              })}
                              className="p-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-500 hover:text-white rounded-full transition-all group"
                              title="Insert event here"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex gap-2">
                  <button 
                    onClick={() => {
                      if (!relatedEvent) return;
                      setQuickAddData({
                        quarter: relatedEvent.quarter,
                        timestamp: Math.min((match?.durationPerPeriod || 10) * 60, relatedEvent.timestamp + 5),
                        team: relatedEvent.team as any || 'home',
                        type: '2pt_make'
                      });
                    }}
                    className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" /> Add Before
                  </button>
                  <button 
                    onClick={() => {
                      if (!relatedEvent) return;
                      setQuickAddData({
                        quarter: relatedEvent.quarter,
                        timestamp: Math.max(0, relatedEvent.timestamp - 5),
                        team: relatedEvent.team as any || 'home',
                        type: '2pt_make'
                      });
                    }}
                    className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" /> Add After
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Issue Details & Actions */}
            <div className="lg:w-1/2 flex flex-col p-8 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    reviewingIssue.severity === 'critical' ? 'bg-red-100 text-red-600' :
                    reviewingIssue.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                    reviewingIssue.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 dark:text-white">Review Issue</h3>
                    <p className="text-sm text-zinc-500 uppercase tracking-widest font-bold">{reviewingIssue.type}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setReviewingIssue(null);
                    setQuickAddData(null);
                  }}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-6 flex-1">
                {quickAddData ? (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100">Quick Add Event</h4>
                      <button onClick={() => setQuickAddData(null)} className="text-blue-500 hover:text-blue-700"><XCircle className="w-4 h-4" /></button>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Type</label>
                          <select 
                            value={quickAddData.type}
                            onChange={(e) => setQuickAddData({...quickAddData, type: e.target.value})}
                            className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs"
                          >
                            <option value="2pt_make">2PT Make</option>
                            <option value="2pt_miss">2PT Miss</option>
                            <option value="3pt_make">3PT Make</option>
                            <option value="3pt_miss">3PT Miss</option>
                            <option value="1pt_make">FT Make</option>
                            <option value="1pt_miss">FT Miss</option>
                            <option value="oreb">Off Rebound</option>
                            <option value="dreb">Def Rebound</option>
                            <option value="ast">Assist</option>
                            <option value="stl">Steal</option>
                            <option value="blk">Block</option>
                            <option value="to">Turnover</option>
                            <option value="foul">Foul</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Team</label>
                          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
                            <button 
                              onClick={() => setQuickAddData({...quickAddData, team: 'home'})}
                              className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${quickAddData.team === 'home' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'}`}
                            >
                              HOME
                            </button>
                            <button 
                              onClick={() => setQuickAddData({...quickAddData, team: 'away'})}
                              className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${quickAddData.team === 'away' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'}`}
                            >
                              AWAY
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Player</label>
                        <select 
                          value={quickAddData.playerId}
                          onChange={(e) => setQuickAddData({...quickAddData, playerId: e.target.value})}
                          className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs"
                        >
                          <option value="">Select Player</option>
                          {allPlayers
                            .filter(p => matchRosters.find(r => r.profileId === p.id)?.teamId === (quickAddData.team === 'home' ? (match?.teamId || 'home_team') : (match?.opponentTeamId || 'away_team')))
                            .map(p => (
                              <option key={p.id} value={p.id}>#{p.jersey} {p.name}</option>
                            ))
                          }
                          <option value={quickAddData.team === 'home' ? 'home_team' : 'away_team'}>Team Event</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Quarter</label>
                          <input 
                            type="number" 
                            value={quickAddData.quarter}
                            onChange={(e) => setQuickAddData({...quickAddData, quarter: parseInt(e.target.value)})}
                            className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-zinc-400 uppercase mb-1 block">Clock (Sec)</label>
                          <input 
                            type="number" 
                            value={quickAddData.timestamp}
                            onChange={(e) => setQuickAddData({...quickAddData, timestamp: parseInt(e.target.value)})}
                            className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 text-xs"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={handleQuickAddEvent}
                        disabled={isUpdatingStatus || !quickAddData.playerId}
                        className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Insert Event
                      </button>
                    </div>
                  </div>
                ) : reviewingIssue.suggestion ? (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Smart Suggestion</h4>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                        {Math.round((reviewingIssue.suggestion.confidence || 0) * 100)}% Confidence
                      </span>
                    </div>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-4">{reviewingIssue.suggestion.label}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleApplySuggestion(reviewingIssue)}
                        disabled={isUpdatingStatus}
                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Apply Fix
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <p className="text-lg font-medium text-zinc-900 dark:text-white mb-2">{reviewingIssue.message}</p>
                  {reviewingIssue.recommendedAction && (
                    <div className="flex gap-2 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                      <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        <span className="font-bold">Recommendation:</span> {reviewingIssue.recommendedAction}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Context</h4>
                    <div className="space-y-1">
                      {Object.entries(reviewingIssue.relatedIds || {}).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-xs p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                          <span className="text-zinc-500 capitalize">{key}</span>
                          <span className="font-mono text-zinc-900 dark:text-white">{val}</span>
                        </div>
                      ))}
                    </div>
                    
                    {lineupPlayers && lineupPlayers.length > 0 && (
                      <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <h5 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Active Lineup</h5>
                        <div className="flex flex-wrap gap-1">
                          {lineupPlayers.map(p => (
                            <span key={p.id} className="text-xs px-1.5 py-0.5 bg-white dark:bg-zinc-700 rounded border border-zinc-200 dark:border-zinc-600 font-bold">
                              #{p.jersey} {p.name.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Workflow</h4>
                    <div className="grid grid-cols-1 gap-2">
                      <button 
                        onClick={() => handleUpdateIssueStatus(reviewingIssue.id, 'reviewed')}
                        disabled={isUpdatingStatus}
                        className={`flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-bold transition-all ${
                          reviewingIssue.status === 'reviewed' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        Mark Reviewed
                      </button>
                      <button 
                        onClick={() => handleUpdateIssueStatus(reviewingIssue.id, 'resolved')}
                        disabled={isUpdatingStatus}
                        className={`flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-bold transition-all ${
                          reviewingIssue.status === 'resolved' 
                            ? 'bg-green-500 text-white' 
                            : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Mark Resolved
                      </button>
                      <button 
                        onClick={() => handleUpdateIssueStatus(reviewingIssue.id, 'dismissed')}
                        disabled={isUpdatingStatus}
                        className={`flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-bold transition-all ${
                          reviewingIssue.status === 'dismissed' 
                            ? 'bg-zinc-500 text-white' 
                            : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 hover:bg-zinc-100'
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => {
                    setReviewingIssue(null);
                    setQuickAddData(null);
                  }}
                  className="flex-1 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Close
                </button>
                {reviewingIssue.relatedIds?.eventId && (
                  <button 
                    onClick={() => {
                      setActiveTab('logs');
                      setReviewingIssue(null);
                    }}
                    className="flex-[2] py-4 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Jump to Full Logs
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const calculateMinutesPlayed = (playerId: string) => {
    if (!matchStints || matchStints.length === 0) return 0;
    
    let totalSeconds = 0;
    matchStints.forEach(stint => {
      if (stint.playerIds && stint.playerIds.includes(playerId)) {
        if (stint.endQuarter !== undefined && stint.endClock !== undefined) {
          if (stint.startQuarter === stint.endQuarter) {
            totalSeconds += (stint.startClock - stint.endClock);
          } else {
            // Simplified: assume closed at quarter end
            totalSeconds += stint.startClock;
          }
        } else if (gameState) {
          // Still active stint
          if (stint.startQuarter === gameState.currentQuarter) {
            totalSeconds += (stint.startClock - gameState.timeRemaining);
          }
        }
      }
    });

    return Math.round(totalSeconds / 60);
  };

  const calculateLineupStats = () => {
    if (!match || !matchStints || matchStints.length === 0) return [];
    
    const lineupStats: Record<string, { min: number, ptsFor: number, ptsAgainst: number, playerIds: string[] }> = {};

    // 1. Group stints by lineup and calculate total minutes
    matchStints.forEach(stint => {
      if (!stint.playerIds || stint.playerIds.length === 0) return;
      
      const key = [...stint.playerIds].sort().join(',');
      if (!lineupStats[key]) {
        lineupStats[key] = { min: 0, ptsFor: 0, ptsAgainst: 0, playerIds: stint.playerIds };
      }

      let duration = 0;
      if (stint.endQuarter !== undefined && stint.endClock !== undefined) {
        if (stint.startQuarter === stint.endQuarter) {
          duration = stint.startClock - stint.endClock;
        } else {
          duration = stint.startClock;
        }
      } else if (gameState) {
        if (stint.startQuarter === gameState.currentQuarter) {
          duration = stint.startClock - gameState.timeRemaining;
        }
      }
      lineupStats[key].min += duration;

      // 2. Calculate points for this specific stint
      const stintEvents = events.filter(e => {
        // Time-range matching for all events
        if (e.quarter < stint.startQuarter) return false;
        if (e.quarter > (stint.endQuarter ?? 99)) return false;
        if (e.quarter === stint.startQuarter && e.timestamp > stint.startClock) return false;
        if (stint.endQuarter !== undefined && e.quarter === stint.endQuarter && e.timestamp < stint.endClock!) return false;
        return true;
      });

      stintEvents.forEach(ev => {
        if (['1pt_make', '2pt_make', '3pt_make'].includes(ev.type)) {
          const points = ev.type === '1pt_make' ? 1 : ev.type === '2pt_make' ? 2 : 3;
          const isOpponent = ev.team === 'away';
          
          if (isOpponent) {
            lineupStats[key].ptsAgainst += points;
          } else {
            lineupStats[key].ptsFor += points;
          }
        }
      });
    });

    // Convert to array and format
    return Object.values(lineupStats)
      .filter(stat => stat.min > 0)
      .map(stat => ({
        ...stat,
        min: Math.round(stat.min / 60),
        plusMinus: stat.ptsFor - stat.ptsAgainst
      }))
      .sort((a, b) => b.min - a.min); // Sort by minutes played
  };

  const calculateStats = (playerId: string) => {
    const playerEvents = events.filter(e => e.playerId === playerId);
    
    const min = calculateMinutesPlayed(playerId);
    const ftm = playerEvents.filter(e => e.type === '1pt_make').length;
    const fta = ftm + playerEvents.filter(e => e.type === '1pt_miss').length;
    
    const fg2m = playerEvents.filter(e => e.type === '2pt_make').length;
    const fg2a = fg2m + playerEvents.filter(e => e.type === '2pt_miss' && !e.isShootingFoul).length;
    
    const fg3m = playerEvents.filter(e => e.type === '3pt_make').length;
    const fg3a = fg3m + playerEvents.filter(e => e.type === '3pt_miss' && !e.isShootingFoul).length;
    
    const fgm = fg2m + fg3m;
    const fga = fg2a + fg3a;
    
    const pts = (ftm * 1) + (fg2m * 2) + (fg3m * 3);
    const oreb = playerEvents.filter(e => e.type === 'oreb').length;
    const dreb = playerEvents.filter(e => e.type === 'dreb').length;
    const reb = oreb + dreb;
    const ast = playerEvents.filter(e => e.type === 'ast').length;
    const stl = playerEvents.filter(e => e.type === 'stl').length;
    const blk = playerEvents.filter(e => e.type === 'blk').length;
    const to = playerEvents.filter(e => e.type === 'to').length;
    const foul = playerEvents.filter(e => e.type === 'foul').length;

    // Advanced Stats
    const tsAttempts = fga + 0.44 * fta;
    const tsPercent = tsAttempts > 0 ? (pts / (2 * tsAttempts)) * 100 : 0;
    const efgPercent = fga > 0 ? ((fgm + 0.5 * fg3m) / fga) * 100 : 0;

    return {
      min, pts, reb, ast, stl, blk, to, foul,
      fgm, fga, fgPercent: fga > 0 ? (fgm / fga) * 100 : 0,
      fg3m, fg3a, fg3Percent: fg3a > 0 ? (fg3m / fg3a) * 100 : 0,
      ftm, fta, ftPercent: fta > 0 ? (ftm / fta) * 100 : 0,
      tsPercent, efgPercent
    };
  };

  const renderPlayerRow = (player: Player) => {
    const stats = calculateStats(player.id);
    const profileOfPlayer = profiles.find(p => p.id === player.id);
    const activeKU = match?.matchKU !== undefined ? match?.matchKU : match?.ageCategory;
    const playingStatus = profileOfPlayer && activeKU !== undefined ? isPlayingUp(profileOfPlayer.birthDate, match?.date, activeKU) : null;

    if (activeTab === 'basic') {
      return (
        <tr key={player.id} className="border-b border-zinc-100 dark:border-zinc-800 text-xs">
          <td className="py-3 px-2 font-bold text-[#1A1A1A] dark:text-white sticky left-0 bg-white dark:bg-zinc-900">
            <div className="flex flex-col gap-1">
              <span>{player.name}</span>
              {playingStatus && playingStatus !== 'own' && (
                <span className={`text-[9px] uppercase font-black px-1.5 py-0.25 rounded-md w-fit whitespace-nowrap ${
                  playingStatus === 'up' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' :
                  'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {playingStatus === 'up' ? 'Playing UP' : 'Playing DOWN'}
                </span>
              )}
            </div>
          </td>
          <td className="py-3 px-2 text-center text-zinc-500">{stats.min}</td>
          <td className="py-3 px-2 text-center">{stats.pts}</td>
          <td className="py-3 px-2 text-center">{stats.reb}</td>
          <td className="py-3 px-2 text-center">{stats.ast}</td>
          <td className="py-3 px-2 text-center">{stats.stl}</td>
          <td className="py-3 px-2 text-center">{stats.blk}</td>
          <td className="py-3 px-2 text-center">{stats.to}</td>
          <td className="py-3 px-2 text-center">{stats.foul}</td>
        </tr>
      );
    } else {
      return (
        <tr key={player.id} className="border-b border-zinc-100 dark:border-zinc-800 text-xs">
          <td className="py-3 px-2 font-bold text-[#1A1A1A] dark:text-white sticky left-0 bg-white dark:bg-zinc-900">
            <div className="flex flex-col gap-1">
              <span>{player.name}</span>
              {playingStatus && playingStatus !== 'own' && (
                <span className={`text-[9px] uppercase font-black px-1.5 py-0.25 rounded-md w-fit whitespace-nowrap ${
                  playingStatus === 'up' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' :
                  'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {playingStatus === 'up' ? 'Playing UP' : 'Playing DOWN'}
                </span>
              )}
            </div>
          </td>
          <td className="py-3 px-2 text-center text-zinc-500">{stats.min}</td>
          <td className="py-3 px-2 text-center">{stats.fgm}-{stats.fga} ({stats.fgPercent.toFixed(1)}%)</td>
          <td className="py-3 px-2 text-center">{stats.fg3m}-{stats.fg3a} ({stats.fg3Percent.toFixed(1)}%)</td>
          <td className="py-3 px-2 text-center">{stats.ftm}-{stats.fta} ({stats.ftPercent.toFixed(1)}%)</td>
          <td className="py-3 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400">{stats.tsPercent.toFixed(1)}%</td>
          <td className="py-3 px-2 text-center font-bold text-blue-600 dark:text-blue-400">{stats.efgPercent.toFixed(1)}%</td>
        </tr>
      );
    }
  };

  const renderTeamStats = () => {
    if (!match || !gameState) return null;

    const homeStats = {
      fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0,
      ast: 0, oreb: 0, dreb: 0, stl: 0, blk: 0, to: 0, benchPts: 0
    };
    const awayStats = {
      fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0,
      ast: 0, oreb: 0, dreb: 0, stl: 0, blk: 0, to: 0, benchPts: 0
    };

    const homeTeamId = match.teamId || 'home_team';
    const awayTeamId = match.opponentTeamId || 'away_team';

    const homeStarters = new Set(
      matchRosters.filter(r => r.teamId === homeTeamId && r.isStarter).map(r => r.profileId)
    );
    const awayStarters = new Set(
      matchRosters.filter(r => r.teamId === awayTeamId && r.isStarter).map(r => r.profileId)
    );

    events.forEach(e => {
      const isHome = matchRosters.some(r => r.teamId === homeTeamId && r.profileId === e.playerId) || e.playerId === 'home_team';
      const isAway = matchRosters.some(r => r.teamId === awayTeamId && r.profileId === e.playerId) || e.playerId === 'opp' || e.playerId === 'away_team';
      
      const stats = isHome ? homeStats : (isAway ? awayStats : null);
      if (!stats) return;

      const isBench = isHome ? !homeStarters.has(e.playerId) : !awayStarters.has(e.playerId);

      switch (e.type) {
        case '1pt_make': stats.ftm++; stats.fta++; if (isBench) stats.benchPts += 1; break;
        case '1pt_miss': stats.fta++; break;
        case '2pt_make': stats.fgm++; stats.fga++; if (isBench) stats.benchPts += 2; break;
        case '2pt_miss': 
          if (!e.isShootingFoul) stats.fga++; 
          break;
        case '3pt_make': stats.fgm++; stats.fga++; stats.fg3m++; stats.fg3a++; if (isBench) stats.benchPts += 3; break;
        case '3pt_miss': 
          if (!e.isShootingFoul) { stats.fga++; stats.fg3a++; }
          break;
        case 'oreb': stats.oreb++; break;
        case 'dreb': stats.dreb++; break;
        case 'ast': stats.ast++; break;
        case 'stl': stats.stl++; break;
        case 'blk': stats.blk++; break;
        case 'to': stats.to++; break;
      }
    });

    const StatRow = ({ label, homeVal, awayVal, homePct, awayPct }: any) => {
      let homeNum = typeof homeVal === 'number' ? homeVal : parseInt(homeVal.split(' ')[0]) || 0;
      let awayNum = typeof awayVal === 'number' ? awayVal : parseInt(awayVal.split(' ')[0]) || 0;
      
      if (homePct !== undefined) homeNum = parseFloat(homePct) || 0;
      if (awayPct !== undefined) awayNum = parseFloat(awayPct) || 0;

      const total = homeNum + awayNum;
      const homeWidth = total === 0 ? 50 : (homeNum / total) * 100;
      const awayWidth = total === 0 ? 50 : (awayNum / total) * 100;

      return (
        <div className="flex flex-col mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-lg text-[#1A1A1A] dark:text-white w-16 text-left">{homePct !== undefined ? `${homePct}%` : homeVal}</span>
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider text-center flex-1">{label}</span>
            <span className="font-bold text-lg text-[#1A1A1A] dark:text-white w-16 text-right">{awayPct !== undefined ? `${awayPct}%` : awayVal}</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
            <div className="bg-brand-navy dark:bg-brand-orange" style={{ width: `${homeWidth}%` }} />
            <div className="bg-red-600 dark:bg-red-500" style={{ width: `${awayWidth}%` }} />
          </div>
        </div>
      );
    };

    const homeFgPct = homeStats.fga > 0 ? ((homeStats.fgm / homeStats.fga) * 100).toFixed(1) : '0.0';
    const awayFgPct = awayStats.fga > 0 ? ((awayStats.fgm / awayStats.fga) * 100).toFixed(1) : '0.0';
    
    const home3pPct = homeStats.fg3a > 0 ? ((homeStats.fg3m / homeStats.fg3a) * 100).toFixed(1) : '0.0';
    const away3pPct = awayStats.fg3a > 0 ? ((awayStats.fg3m / awayStats.fg3a) * 100).toFixed(1) : '0.0';
    
    const homeFtPct = homeStats.fta > 0 ? ((homeStats.ftm / homeStats.fta) * 100).toFixed(1) : '0.0';
    const awayFtPct = awayStats.fta > 0 ? ((awayStats.ftm / awayStats.fta) * 100).toFixed(1) : '0.0';

    return (
      <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div className="text-center mb-6">
          <h2 className="text-xl font-display font-black text-white uppercase tracking-wide bg-red-600 py-2 rounded-xl inline-block px-8">FULLTIME STATS</h2>
        </div>
        
        <div className="flex justify-between items-center mb-8 px-4">
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-zinc-500 uppercase mb-2">{match.ourTeamName || 'Home'}</span>
            <span className="text-5xl font-display font-black italic text-brand-navy dark:text-white">{gameState.homeScore}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-zinc-500 uppercase mb-2">{match.theirTeamName || 'Away'}</span>
            <span className="text-5xl font-display font-black italic text-red-600 dark:text-red-500">{gameState.awayScore}</span>
          </div>
        </div>

        <div className="space-y-4">
          <StatRow label="2-POINT FG" homeVal={`${homeStats.fgm - homeStats.fg3m}/${homeStats.fga - homeStats.fg3a}`} awayVal={`${awayStats.fgm - awayStats.fg3m}/${awayStats.fga - awayStats.fg3a}`} homePct={homeFgPct} awayPct={awayFgPct} />
          <StatRow label="3-POINT FG" homeVal={`${homeStats.fg3m}/${homeStats.fg3a}`} awayVal={`${awayStats.fg3m}/${awayStats.fg3a}`} homePct={home3pPct} awayPct={away3pPct} />
          <StatRow label="FREE THROWS" homeVal={`${homeStats.ftm}/${homeStats.fta}`} awayVal={`${awayStats.ftm}/${awayStats.fta}`} homePct={homeFtPct} awayPct={awayFtPct} />
          <StatRow label="ASSISTS" homeVal={homeStats.ast} awayVal={awayStats.ast} />
          <StatRow label="REBOUNDS (OFF)" homeVal={`${homeStats.oreb + homeStats.dreb} (${homeStats.oreb})`} awayVal={`${awayStats.oreb + awayStats.dreb} (${awayStats.oreb})`} />
          <StatRow label="STEALS" homeVal={homeStats.stl} awayVal={awayStats.stl} />
          <StatRow label="BENCH POINTS" homeVal={homeStats.benchPts} awayVal={awayStats.benchPts} />
          <StatRow label="TURNOVERS" homeVal={homeStats.to} awayVal={awayStats.to} />
        </div>
      </div>
    );
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/games');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 pb-24 transition-colors font-sans flex flex-col">
      <header className="bg-white dark:bg-zinc-950 p-4 sticky top-0 z-30 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-[#1A1A1A] dark:hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-display font-black italic text-brand-navy dark:text-white uppercase tracking-wide">Match Details</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'simple' ? 'pro' : 'simple')}
            className="px-2.5 py-1.5 bg-zinc-150 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 rounded-xl text-[10px] font-extrabold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 cursor-pointer"
          >
            Mode: {viewMode === 'simple' ? 'Sederhana' : 'Pro'}
          </button>
          <button 
            onClick={() => setShowEditModal(true)}
            className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-[#1A1A1A] dark:hover:text-white transition-colors"
            title="Edit Konfigurasi Match"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto max-w-none">
        {/* Desktop Header / Navigation Back bar */}
        {match && (
          <div className="hidden md:flex items-center justify-between mb-4 bg-white dark:bg-zinc-900 px-6 py-4 rounded-2xl border border-zinc-150 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center gap-3">
              <button onClick={handleBack} className="p-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 rounded-full text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer">
                <ArrowLeft size={16} />
              </button>
              <div className="text-left">
                <h2 className="text-sm font-black uppercase text-brand-navy dark:text-brand-orange tracking-wide leading-none">Detail Pertandingan</h2>
                <span className="text-xs text-zinc-400 mt-1 block">{match.ourTeamName || 'Home'} vs {match.theirTeamName || 'Away'}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode(viewMode === 'simple' ? 'pro' : 'simple')}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-xl border border-zinc-200 dark:border-zinc-850 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Mode: <span className="text-brand-orange font-black">{viewMode === 'simple' ? 'Sederhana' : 'Pro'}</span>
              </button>
              <button 
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 rounded-xl transition-all border border-zinc-200 dark:border-zinc-700 text-xs font-bold uppercase tracking-wider cursor-pointer"
                title="Edit Konfigurasi Match"
              >
                <Settings size={14} /> Konfigurasi
              </button>
            </div>
          </div>
        )}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800 mb-6 flex flex-col items-center">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Trophy size={14} className="text-brand-orange" /> Final Score
          </div>
          <div className="flex justify-center items-center gap-8 w-full">
            <div className="flex flex-col items-center flex-1">
              <span className="text-sm font-bold text-zinc-500 uppercase mb-2 text-center">{match.ourTeamName || 'Home'}</span>
              <span className="text-5xl font-display font-black italic text-brand-navy dark:text-white">{gameState.homeScore}</span>
              <div className="flex gap-3 mt-2 text-xs font-bold text-zinc-500">
                <span>F: <span className="text-red-500">{gameState.homeFouls || 0}</span></span>
                <span>TO: <span className="text-amber-500">{gameState.homeTimeouts || 0}</span></span>
              </div>
            </div>
            <div className="text-2xl font-black text-zinc-300 dark:text-zinc-700">-</div>
            <div className="flex flex-col items-center flex-1">
              <span className="text-sm font-bold text-zinc-500 uppercase mb-2 text-center">{match.theirTeamName || 'Away'}</span>
              <span className="text-5xl font-display font-black italic text-red-600 dark:text-red-500">{gameState.awayScore}</span>
              <div className="flex gap-3 mt-2 text-xs font-bold text-zinc-500">
                <span>F: <span className="text-red-500">{gameState.awayFouls || 0}</span></span>
                <span>TO: <span className="text-amber-500">{gameState.awayTimeouts || 0}</span></span>
              </div>
            </div>
          </div>
          {(() => {
            const activeKU = match.matchKU !== undefined ? match.matchKU : match.ageCategory;
            const playingStatus = isPlayingUp(childProfile?.birthDate, match.date, activeKU);
            return (
              <div className="flex flex-wrap gap-4 mt-6 text-xs text-zinc-500 items-center justify-center">
                <div className="flex items-center gap-1"><Calendar size={14} /> {new Date(match.date).toLocaleDateString()}</div>
                {match.venue && <div className="flex items-center gap-1"><MapPin size={14} /> {match.venue}</div>}
                {activeKU !== undefined && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-zinc-800 text-brand-navy dark:text-brand-orange font-bold text-[11px] border border-brand-navy/10 dark:border-brand-orange/10">
                    KU-{activeKU}
                    {playingStatus && (
                      <span className={`text-[10px] uppercase font-black px-1.5 py-0.25 rounded-md ${
                        playingStatus === 'own' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' :
                        playingStatus === 'up' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' :
                        'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {playingStatus === 'own' ? 'Sesuai KU' : playingStatus === 'up' ? 'Playing UP' : 'Playing DOWN'}
                      </span>
                    )}
                  </div>
                )}
                {match.competitionGrade && (
                  <span className={`text-[11px] font-bold px-2.5 py-1.25 rounded-full border ${COMPETITION_GRADE_COLORS[match.competitionGrade as CompetitionGrade] || 'bg-zinc-100 text-zinc-500'}`}>
                    {COMPETITION_GRADE_LABELS[match.competitionGrade as CompetitionGrade]}
                  </span>
                )}
                {match.matchLevel && (
                  <span className="text-[11px] font-bold px-2.5 py-1.25 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 capitalize">
                    Level: {match.matchLevel}
                  </span>
                )}
                {match.isOfficiated && (
                  <span className="text-[11px] font-black px-2.5 py-1.25 rounded-full bg-brand-orange/10 text-brand-orange border border-brand-orange/20 uppercase tracking-wider flex items-center gap-1">
                    ★ RESMI
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* Stage Progress and Actions Panel */}
        {match && (
          <div className="space-y-4 mb-6">
            <StageProgress stage={match.productionStage || 'tracking'} />
            
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-5 rounded-3xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-zinc-450 dark:text-zinc-500 tracking-wider block">Status Alur Produksi</span>
                  <span className="text-sm font-black text-zinc-850 dark:text-zinc-100 uppercase tracking-wide">
                    {match.productionStage === 'tracking' && '📊 Tahap 1: Perekaman Statistik'}
                    {match.productionStage === 'qa_review' && '🔍 Tahap 2: Pemeriksaan Kualitas (QA)'}
                    {match.productionStage === 'coach_analysis' && '🧠 Tahap 3: Penyusunan Analisis Coach Bersertifikat'}
                    {match.productionStage === 'published' && '🌐 Tahap 4: Selesai & Dipublikasikan'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {/* Tool Action Button (Open QA Review or Coach Analysis) */}
                  {match.productionStage === 'qa_review' && can('do_qa_review') && (
                    <button
                      onClick={() => navigate(`/qa/${match.id}`)}
                      className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-750 dark:bg-blue-500 rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1"
                    >
                      🔍 Buka QA Review
                    </button>
                  )}
                  {match.productionStage === 'coach_analysis' && can('do_coach_analysis') && (
                    <button
                      onClick={() => navigate(`/coach-analysis/${match.id}`)}
                      className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-750 dark:bg-emerald-500 rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1"
                    >
                      🧠 Buka Analisis Coach Bersertifikat
                    </button>
                  )}

                  {match.productionStage === 'published' && (
                    <button
                      onClick={() => navigate(`/story/${match.id}`)}
                      className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-750 dark:bg-emerald-500 rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      📖 Cerita Pertandingan
                    </button>
                  )}

                  {/* Return Stage Button */}
                  {match.productionStage !== 'tracking' && match.productionStage !== 'published' && (
                    <button
                      onClick={() => {
                        const note = window.prompt("Masukkan catatan perbaikan (opsional):");
                        if (note !== null) {
                          handleReturnStage(note);
                        }
                      }}
                      className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      ↩️ Kembalikan
                    </button>
                  )}
                  
                  {/* Advance Stage Button */}
                  {match.productionStage !== 'published' && (
                    <button
                      onClick={handleAdvanceStage}
                      className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-brand-navy hover:bg-brand-navy/90 dark:bg-brand-orange dark:text-brand-navy dark:hover:bg-brand-orange/90 rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1"
                    >
                      {match.productionStage === 'tracking' && 'Kirim ke QA 🚀'}
                      {match.productionStage === 'qa_review' && 'Setujui & Kirim ke Coach ✅'}
                      {match.productionStage === 'coach_analysis' && 'Publikasikan Statistik 🌐'}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Stage History */}
              {match.stageHistory && match.stageHistory.length > 0 && (
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3.5 space-y-2.5">
                  <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider flex items-center gap-1">
                    <History size={12} /> Riwayat Perjalanan Data (Handoff)
                  </span>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {match.stageHistory.map((h, idx) => (
                      <div key={idx} className="text-xs bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl flex flex-col gap-1 border border-zinc-150/40 dark:border-zinc-850/60 shadow-sm">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-extrabold text-zinc-800 dark:text-zinc-200">
                            {h.action === 'advanced' ? '➡️ Naik ke' : '↩️ Dikembalikan ke'}{' '}
                            <span className="underline decoration-brand-orange decoration-2">
                              {h.stage === 'tracking' && 'Perekaman'}
                              {h.stage === 'qa_review' && 'Pemeriksaan QA'}
                              {h.stage === 'coach_analysis' && 'Analisis Coach Bersertifikat'}
                              {h.stage === 'published' && 'Siap/Terbit'}
                            </span>
                          </span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                            {new Date(h.at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap">
                          <span>Oleh: <strong className="text-zinc-700 dark:text-zinc-300 font-bold">{h.byName}</strong></span>
                          {h.note && (
                            <span className="text-red-500 dark:text-red-400 italic font-semibold ml-1 bg-red-500/5 px-2 py-0.5 rounded-lg border border-red-500/10">
                              catatan: "{h.note}"
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-sm border border-zinc-100 dark:border-zinc-800">
          <div className="flex border-b border-zinc-100 dark:border-zinc-800 overflow-x-auto scrollbar-hide">
            <button 
              onClick={() => setActiveTab('team')}
              className={`flex-1 min-w-[100px] py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'team' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              Team
            </button>
            <button 
              onClick={() => setActiveTab('momentum')}
              className={`flex-1 min-w-[100px] py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'momentum' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              Momentum
            </button>
            {viewMode === 'pro' && (
              <button 
                onClick={() => setActiveTab('basic')}
                className={`flex-1 min-w-[100px] py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'basic' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Basic
              </button>
            )}
            {viewMode === 'pro' && (
              <button 
                onClick={() => setActiveTab('advanced')}
                className={`flex-1 min-w-[100px] py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'advanced' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Advanced
              </button>
            )}
            {viewMode === 'pro' && (
              <button 
                onClick={() => setActiveTab('deep')}
                className={`flex-1 min-w-[100px] py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'deep' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Deep Stats
              </button>
            )}
            {viewMode === 'pro' && match.recordingType !== 'single' && (
              <button 
                onClick={() => setActiveTab('lineups')}
                className={`flex-1 min-w-[100px] py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'lineups' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Lineups
              </button>
            )}
            <button 
              onClick={() => setActiveTab('shotchart')}
              className={`flex-1 min-w-[100px] py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'shotchart' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              Shot Chart
            </button>
            {viewMode === 'pro' && (
              <button 
                onClick={() => setActiveTab('logs')}
                className={`flex-1 min-w-[100px] py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'logs' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Logs
              </button>
            )}
            {viewMode === 'pro' && (
              <div className="relative flex items-center px-2 border-l border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => setActiveTab('health')}
                  className={`p-2 rounded-full transition-colors ${activeTab === 'health' ? 'bg-brand-orange text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                  title="Data Integrity Audit (Advanced)"
                >
                  <ShieldCheck className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto">
            {activeTab === 'team' ? (
              renderTeamStats()
            ) : activeTab === 'momentum' ? (
              <div className="p-6">
                <MomentumChart 
                  events={events} 
                  matchRosters={matchRosters} 
                  match={match} 
                  possessions={possessions} 
                />
              </div>
            ) : activeTab === 'deep' ? (
              <div className="p-6">
                <AdvancedStatsDashboard 
                  events={events} 
                  players={allPlayers} 
                  team="home" 
                  opponentEvents={events.filter(e => e.team === 'away')}
                  homeRosterIds={matchRosters.filter(r => r.teamId === (match.teamId || 'home_team')).map(r => r.profileId)}
                  awayRosterIds={matchRosters.filter(r => r.teamId === (match.opponentTeamId || 'away_team')).map(r => r.profileId)}
                  possessions={possessions}
                />
              </div>
            ) : activeTab === 'shotchart' ? (
              <div className="p-6">
                <ShotChartAnalysis events={events} players={allPlayers} />
              </div>
            ) : activeTab === 'lineups' ? (
              <div className="flex flex-col gap-6 p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-black italic text-lg uppercase tracking-tight">5-Man Lineups</h3>
                    <button 
                      onClick={() => setShowStintEditor(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold hover:opacity-90 transition-all"
                    >
                      <Clock className="w-4 h-4" />
                      Manage Timeline
                    </button>
                  </div>
                  {(() => {
                    const lineupStats = calculateLineupStats();
                    if (lineupStats.length === 0) {
                      return <div className="py-8 text-center text-zinc-500 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">No lineup data available.</div>;
                    }
                    return lineupStats.map((lineup, idx) => {
                      const playerNames = lineup.playerIds
                        .map(id => allPlayers.find(p => p.id === id)?.name || 'Unknown')
                        .join(', ');
                      return (
                        <Card key={idx} className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="font-bold text-[#1A1A1A] dark:text-white text-sm line-clamp-2 pr-2 leading-tight">{playerNames}</div>
                            <div className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-1 rounded-lg shrink-0">MIN: {lineup.min}</div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-2 text-center">
                              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase mb-1">PTS FOR</div>
                              <div className="font-black text-sm text-emerald-700 dark:text-emerald-300">{lineup.ptsFor}</div>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-2 text-center">
                              <div className="text-xs text-red-600 dark:text-red-400 font-bold uppercase mb-1">PTS AGN</div>
                              <div className="font-black text-sm text-red-700 dark:text-red-300">{lineup.ptsAgainst}</div>
                            </div>
                            <div className={`rounded-xl p-2 text-center ${lineup.plusMinus > 0 ? 'bg-emerald-100 dark:bg-emerald-900/20' : lineup.plusMinus < 0 ? 'bg-red-100 dark:bg-red-900/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                              <div className={`text-xs font-bold uppercase mb-1 ${lineup.plusMinus > 0 ? 'text-emerald-700 dark:text-emerald-400' : lineup.plusMinus < 0 ? 'text-red-700 dark:text-red-400' : 'text-zinc-500'}`}>+/-</div>
                              <div className={`font-black text-sm ${lineup.plusMinus > 0 ? 'text-emerald-800 dark:text-emerald-300' : lineup.plusMinus < 0 ? 'text-red-800 dark:text-red-300' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                {lineup.plusMinus > 0 ? '+' : ''}{lineup.plusMinus}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    });
                  })()}
                </div>
                <LineupCombinations 
                  events={events} 
                  players={allPlayers} 
                  gameState={gameState} 
                  duration={(match.durationPerPeriod || 10) * 60} 
                  match={match} 
                  matchStints={matchStints} 
                  eventLinks={eventLinks}
                  matchRosters={matchRosters}
                />
              </div>
            ) : activeTab === 'logs' ? (
              <div className="p-6 space-y-6">
                {(() => {
                  const ytId = match.videoUrl ? match.videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([^&?\/#]+)/)?.[1] : null;
                  if (!ytId) return null;
                  return (
                    <div className="bg-black aspect-video rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 max-w-4xl mx-auto">
                      <iframe
                        id="youtube-player"
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${ytId}?enablejsapi=1`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  );
                })()}
                <EventAndPossessionLog 
                  events={events} 
                  players={allPlayers} 
                  hasVideo={!!match.videoUrl}
                  onSeek={(timestamp) => {
                    const player = document.getElementById('youtube-player') as HTMLIFrameElement;
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
                    }
                  }}
                />
              </div>
            ) : activeTab === 'health' ? (
              <div className="p-6 space-y-6">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Match Data Integrity</h3>
                      <p className="text-sm text-zinc-500">Audit of stints, possessions, and event relationships</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-black ${
                        (auditResult?.healthScore || 0) >= 90 ? 'text-green-500' : 
                        (auditResult?.healthScore || 0) >= 70 ? 'text-orange-500' : 'text-red-500'
                      }`}>
                        {auditResult?.healthScore || 0}%
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Health Score</div>
                        {auditResult?.trustClassification && (
                          <div className={`mt-1 text-xs font-black px-2 py-0.5 rounded border ${
                            auditResult.trustClassification === 'TRUSTED' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                            auditResult.trustClassification === 'CAUTION' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                            'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}>
                            {auditResult.trustClassification}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl">
                      <div className="text-2xl font-bold text-red-500">{auditResult?.summary.critical || 0}</div>
                      <div className="text-xs text-zinc-500 font-medium">Critical Issues</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl">
                      <div className="text-2xl font-bold text-orange-500">{auditResult?.summary.high || 0}</div>
                      <div className="text-xs text-zinc-500 font-medium">High Severity</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl">
                      <div className="text-2xl font-bold text-yellow-500">{auditResult?.summary.medium || 0}</div>
                      <div className="text-xs text-zinc-500 font-medium">Medium Issues</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl">
                      <div className="text-2xl font-bold text-blue-500">{auditResult?.summary.low || 0}</div>
                      <div className="text-xs text-zinc-500 font-medium">Low Severity</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Issue Log</h4>
                      {auditResult?.issues.some(i => i.suggestion && i.status === 'open') && (
                        <button 
                          onClick={handleBatchApplyAll}
                          disabled={isUpdatingStatus}
                          className="text-xs font-bold px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Batch Fix Suggestions
                        </button>
                      )}
                    </div>
                    {auditResult?.issues.length === 0 ? (
                      <div className="text-center py-8 text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                        <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-20" />
                        <p>No integrity issues detected. Data is reliable.</p>
                      </div>
                    ) : (
                      auditResult?.issues.map((issue, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setReviewingIssue(issue)}
                          className={`flex items-start gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border transition-all cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600 ${
                            issue.status === 'dismissed' ? 'opacity-50 grayscale' : 
                            issue.status === 'resolved' ? 'border-green-500/30 bg-green-500/5' : 'border-zinc-100 dark:border-zinc-800'
                          }`}
                        >
                          <div className={`mt-1 p-1.5 rounded-lg ${
                            issue.severity === 'critical' ? 'bg-red-100 text-red-600' :
                            issue.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                            issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {issue.status === 'resolved' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{issue.type}</span>
                                {issue.status !== 'open' && (
                                  <span className={`text-xs font-black px-1.5 py-0.5 rounded uppercase ${getStatusColor(issue.status)}`}>
                                    {issue.status}
                                  </span>
                                )}
                              </div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                                issue.severity === 'critical' ? 'bg-red-500 text-white' :
                                issue.severity === 'high' ? 'bg-orange-500 text-white' :
                                issue.severity === 'medium' ? 'bg-yellow-500 text-white' : 'bg-blue-500 text-white'
                              }`}>
                                {issue.severity}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">{issue.message}</p>
                            {issue.recommendedAction && (
                              <p className="mt-1 text-xs text-zinc-500 italic">
                                <span className="font-bold not-italic">Tip:</span> {issue.recommendedAction}
                              </p>
                            )}
                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex flex-wrap gap-2">
                                {issue.relatedIds && Object.entries(issue.relatedIds).map(([key, val]) => (
                                  <span key={key} className="text-xs bg-white dark:bg-zinc-700 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-600 text-zinc-500">
                                    {key}: {val}
                                  </span>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 text-zinc-400">
                                <Eye className="w-3 h-3" />
                                <span className="text-xs font-bold uppercase tracking-widest">Review</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {reviewingIssue && renderIssueReviewModal()}
                </AnimatePresence>

                <AnimatePresence>
                  {batchFixPreview && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl border border-zinc-100 dark:border-zinc-800 p-8"
                      >
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                            <ShieldCheck className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-zinc-900 dark:text-white">Batch Fix Preview</h3>
                            <p className="text-sm text-zinc-500">Review planned corrections</p>
                          </div>
                        </div>

                        <div className="space-y-4 mb-8">
                          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                            <div className="text-3xl font-black text-emerald-500 mb-1">{batchFixPreview.count}</div>
                            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Total Suggestions to Apply</div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Breakdown by Type</h4>
                            {Object.entries(batchFixPreview.types).map(([type, count]) => (
                              <div key={type} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-xs">
                                <span className="font-bold text-zinc-600 dark:text-zinc-400">{type}</span>
                                <span className="font-mono font-black text-zinc-900 dark:text-white">{count}</span>
                              </div>
                            ))}
                          </div>

                          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                            <div className="flex gap-3">
                              <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                              <p className="text-xs text-orange-800 dark:text-orange-300">
                                <span className="font-bold">Caution:</span> Batch fixes are applied based on heuristics. High confidence suggestions (&gt;80%) are generally safe, but manual review is always recommended for critical data.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button 
                            onClick={() => setBatchFixPreview(null)}
                            className="flex-1 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold hover:bg-zinc-200"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={confirmBatchFix}
                            disabled={isUpdatingStatus}
                            className="flex-[2] py-4 rounded-2xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                          >
                            {isUpdatingStatus ? (
                              <RotateCcw className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            Apply All Fixes
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                {showStintEditor && match && (
                  <StintTimelineEditor 
                    match={match}
                    stints={matchStints}
                    allPlayers={allPlayers}
                    onUpdate={loadData}
                    onClose={() => setShowStintEditor(false)}
                  />
                )}

                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-3xl p-6 border border-orange-100 dark:border-orange-900/30">
                  <div className="flex gap-4">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-xl h-fit">
                      <Info className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-orange-900 dark:text-orange-200">Audit Engine Information</h4>
                      <p className="text-sm text-orange-800 dark:text-orange-300 mt-1">
                        The integrity engine checks for logical inconsistencies that might skew advanced analytics. 
                        Low health scores indicate that lineup synergy or possession efficiency metrics may be inaccurate.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {allPlayers.map((player) => {
                  const stats = calculateStats(player.id);
                  const profileOfPlayer = profiles.find(p => p.id === player.id);
                  const activeKU = match?.matchKU !== undefined ? match?.matchKU : match?.ageCategory;
                  const playingStatus = profileOfPlayer && activeKU !== undefined ? isPlayingUp(profileOfPlayer.birthDate, match?.date, activeKU) : null;
                  return (
                    <Card key={player.id} className="p-4 mb-4">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-bold text-[#1A1A1A] dark:text-white text-lg">{player.name}</div>
                          {player.isGuest && (
                            <span className="text-[10px] font-black bg-brand-orange text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Tamu
                            </span>
                          )}
                          {playingStatus && playingStatus !== 'own' && (
                            <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                              playingStatus === 'up' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' :
                              'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}>
                              {playingStatus === 'up' ? 'Playing UP' : 'Playing DOWN'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-1 rounded-lg">MIN: {stats.min}</div>
                      </div>
                      
                      {activeTab === 'basic' ? (
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-2">
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">PTS</div>
                            <div className="font-black text-sm dark:text-white">{stats.pts}</div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-2">
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">REB</div>
                            <div className="font-black text-sm dark:text-white">{stats.reb}</div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-2">
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">AST</div>
                            <div className="font-black text-sm dark:text-white">{stats.ast}</div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-2">
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">STL</div>
                            <div className="font-black text-sm dark:text-white">{stats.stl}</div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-2">
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">BLK</div>
                            <div className="font-black text-sm dark:text-white">{stats.blk}</div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-2">
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">TO</div>
                            <div className="font-black text-sm dark:text-white">{stats.to}</div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-2">
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">PF</div>
                            <div className="font-black text-sm dark:text-white">{stats.foul}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-2">
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">FG</div>
                            <div className="font-black text-sm dark:text-white">{stats.fgm}-{stats.fga}</div>
                            <div className="text-xs text-zinc-400 mt-0.5">{stats.fgPercent.toFixed(1)}%</div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-2">
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">3PT</div>
                            <div className="font-black text-sm dark:text-white">{stats.fg3m}-{stats.fg3a}</div>
                            <div className="text-xs text-zinc-400 mt-0.5">{stats.fg3Percent.toFixed(1)}%</div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-2">
                            <div className="text-xs text-zinc-500 font-bold uppercase mb-1">FT</div>
                            <div className="font-black text-sm dark:text-white">{stats.ftm}-{stats.fta}</div>
                            <div className="text-xs text-zinc-400 mt-0.5">{stats.ftPercent.toFixed(1)}%</div>
                          </div>
                          
                          <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-2 col-span-1">
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase mb-1 cursor-help" title="True Shooting % - Akurasi tembakan total termasuk free throw">TS%</div>
                            <div className="font-black text-sm text-emerald-700 dark:text-emerald-300">{stats.tsPercent.toFixed(1)}%</div>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-2 col-span-2">
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase mb-1 cursor-help" title="Effective Field Goal % - Menghitung 3PT lebih berharga dari 2PT">eFG%</div>
                            <div className="font-black text-sm text-blue-700 dark:text-blue-300">{stats.efgPercent.toFixed(1)}%</div>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <EditMatchModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        match={match}
        onSuccess={(updatedMatch) => setMatch(updatedMatch)}
      />

      <AnimatePresence>
        {showAhaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                localStorage.setItem('first_match_celebrated', 'true');
                setShowAhaModal(false);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[2rem] p-6 shadow-2xl border border-zinc-100 dark:border-zinc-800 text-center z-10 overflow-hidden"
            >
              <div className="absolute -right-12 -top-12 w-32 h-32 bg-brand-orange/20 rounded-full blur-2xl" />
              <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-brand-navy/20 rounded-full blur-2xl" />
              
              <div className="relative z-10">
                {/* Trophy Animation */}
                <motion.div
                  initial={{ rotate: -15, scale: 0.5 }}
                  animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="w-20 h-20 bg-brand-orange/10 dark:bg-brand-orange/20 rounded-full flex items-center justify-center mx-auto mb-6 text-brand-navy dark:text-brand-orange"
                >
                  <Trophy size={44} className="text-brand-orange" strokeWidth={2.5} />
                </motion.div>
                
                <h2 className="text-2xl font-display font-black text-[#1A1A1A] dark:text-white uppercase tracking-tight mb-2">
                  Laporan pertama Anda siap!
                </h2>
                
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 px-2 leading-relaxed">
                  Selamat! Anda berhasil mencatat pertandingan pertama. Statistik performa dan analisis mendalam atlet Anda kini telah siap untuk dianalisis.
                </p>
                
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      localStorage.setItem('first_match_celebrated', 'true');
                      setShowAhaModal(false);
                      navigate(`/stats?profileId=${match.childId || ''}`);
                    }}
                    className="w-full py-4 bg-brand-orange hover:bg-yellow-400 text-brand-navy font-bold text-sm rounded-2xl transition-colors shadow-lg shadow-brand-orange/10 active:scale-95 duration-150 uppercase tracking-wider"
                  >
                    Lihat Statistik
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem('first_match_celebrated', 'true');
                      setShowAhaModal(false);
                      navigate('/coach');
                    }}
                    className="w-full py-4 border-2 border-brand-navy dark:border-zinc-700 text-brand-navy dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold text-sm rounded-2xl transition-colors active:scale-95 duration-150 uppercase tracking-wider"
                  >
                    Minta Review AI
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { statsService } from '../core/services/statsService';
import { requestService } from '../services/requestService';
import { ChildProfile, Team, GameEvent, Match } from '../core/types/stats';
import { isCountableMatch, didPlayInMatch } from '../core/utils/matchFilters';
import { initDB } from '../lib/db';
import { CompetitionGrade, COMPETITION_GRADE_LABELS, COMPETITION_GRADE_WEIGHTS } from '../core/config/competition';
import { isPlayingUp } from '../core/utils/ageCalculator';
import { 
  Search, Filter, ShieldCheck, Users, TrendingUp, Sparkles, Database, Terminal, 
  Copy, Check, BookOpen, FileText, Layers, X, Youtube, Play, ArrowLeft, RotateCcw, 
  Clapperboard, Flame, Dribbble, SlidersHorizontal, User as UserIcon, CalendarClock, 
  Eye, Volume2, Maximize, PlayCircle, EyeOff, Film, HelpCircle,
  Lock, Unlock, MessageSquare, Star, Trash2, Plus, Edit, Settings, Globe
} from 'lucide-react';
import { useToast } from '../core/contexts/ToastContext';
import { usePermissions } from '../core/contexts/PermissionsContext';
import { authService } from '../services/authService';
import { coachAnalysisService } from '../features/coach-analysis/model/coachAnalysisService';
import { UserAccount } from '../core/types/serviceRequests';
import { CoachAnnotation } from '../entities/coach-annotation/model/types';
import { motion } from 'motion/react';
import { Avatar } from '../shared/ui/Avatar';
import YouTube from 'react-youtube';

export interface SynergyEvent {
  id: string;
  youtubeTimestamp: number;
  playerName: string;
  playerAvatar?: string;
  type: string; // e.g. "3PT Make", "Turnover", "Assist", "Rebound", "Steal", "2PT Make"
  typeCategory: 'shot_make' | 'shot_miss' | 'assist' | 'rebound' | 'steal' | 'turnover' | 'foul' | 'other';
  phaseOfPlay: 'set_offense' | 'transition' | 'fast_break' | 'inbound' | 'deadball';
  quarter: number;
  gameClock: string; // "07:24"
  description: string;
  x?: number; // 0-100 court percentage
  y?: number; // 0-100 court percentage
}

export interface FeaturedSynergyMatch {
  id: string;
  title: string;
  teams: {
    home: { name: string; logo: string };
    away: { name: string; logo: string };
  };
  date: string;
  competition: string;
  ageCategory: string;
  youtubeId: string;
  duration: string;
  thumbnailUrl: string;
  events: SynergyEvent[];
  isPrivate?: boolean;
}

export const GalleryPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { can } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [verifiedMatchIds, setVerifiedMatchIds] = useState<Set<string>>(new Set());
  
  const [galleryTab, setGalleryTab] = useState<'synergy' | 'talents' | 'athlete-clips'>('synergy');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Synergy States
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [realMatches, setRealMatches] = useState<FeaturedSynergyMatch[]>([]);
  const [allDbMatches, setAllDbMatches] = useState<Match[]>([]);
  const [coachAnnotations, setCoachAnnotations] = useState<Record<string, CoachAnnotation[]>>({});
  
  const [isAddReviewOpen, setIsAddReviewOpen] = useState<boolean>(false);
  const [newReview, setNewReview] = useState<{
    category: CoachAnnotation['category'];
    rating: number;
    note: string;
  }>({ category: 'skill', rating: 5, note: '' });
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  
  const [isLinkVideoModalOpen, setIsLinkVideoModalOpen] = useState<boolean>(false);
  const [selectedMatchToLink, setSelectedMatchToLink] = useState<Match | null>(null);
  const [youtubeUrlToLink, setYoutubeUrlToLink] = useState<string>('');

  const [selectedMatch, setSelectedMatch] = useState<FeaturedSynergyMatch | null>(null);
  const [synergyFilters, setSynergyFilters] = useState({
    playerName: 'All',
    eventType: 'All',
    possessionType: 'All'
  });
  const [youtubePlayer, setYoutubePlayer] = useState<any>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [courtHoveredEvent, setCourtHoveredEvent] = useState<SynergyEvent | null>(null);

  // Athlete clips states
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [activeAthleteClipId, setActiveAthleteClipId] = useState<string>('');
  const [athletePlayer, setAthletePlayer] = useState<any>(null);
  const [athletePlaybackRate, setAthletePlaybackRate] = useState<number>(1);

  const athleteClips = React.useMemo(() => {
    const selectedAth = profiles.find(p => p.id === selectedAthleteId);
    if (!selectedAth) return [];
    
    const clips: Array<SynergyEvent & { matchTitle: string; youtubeId: string; date: string }> = [];
    realMatches.forEach(m => {
      m.events.forEach(e => {
        const matchesName = e.playerName.toLowerCase().includes(selectedAth.name.toLowerCase()) || 
                            selectedAth.name.toLowerCase().includes(e.playerName.toLowerCase());
        if (matchesName) {
          clips.push({
            ...e,
            matchTitle: m.title,
            youtubeId: m.youtubeId,
            date: m.date
          });
        }
      });
    });
    return clips;
  }, [selectedAthleteId, profiles, realMatches]);

  const athleteStats = React.useMemo(() => {
    const selectedAth = profiles.find(p => p.id === selectedAthleteId);
    if (!selectedAth) return { ppg: '0.0', rpg: '0.0', apg: '0.0', totalClips: 0 };
    
    let totalPoints = 0;
    let totalRebounds = 0;
    let totalAssists = 0;
    let uniqueMatches = new Set<string>();

    athleteClips.forEach(c => {
      uniqueMatches.add(c.matchTitle);
      if (c.type === '3PT Make') totalPoints += 3;
      else if (c.type === '2PT Make') totalPoints += 2;
      else if (c.type === 'Free Throw' || c.type === '1PT Make') totalPoints += 1;
      else if (c.type === 'Assist') totalAssists += 1;
      else if (c.type === 'Defensive Rebound' || c.type === 'Offensive Rebound' || c.type === 'Rebound') totalRebounds += 1;
    });

    const mCount = uniqueMatches.size || 1;
    return {
      ppg: (totalPoints / mCount).toFixed(1),
      rpg: (totalRebounds / mCount).toFixed(1),
      apg: (totalAssists / mCount).toFixed(1),
      totalClips: athleteClips.length
    };
  }, [athleteClips, selectedAthleteId, profiles]);

  useEffect(() => {
    if (athleteClips.length > 0) {
      const activeExists = athleteClips.some(c => c.id === activeAthleteClipId);
      if (!activeExists) {
        setActiveAthleteClipId(athleteClips[0].id);
      }
    } else {
      setActiveAthleteClipId('');
    }
  }, [selectedAthleteId, athleteClips]);

  const triggerDataRefresh = async () => {
    try {
      const [allProfiles, allTeams, allMatches, allEvents] = await Promise.all([
        statsService.getProfiles(),
        statsService.getTeams(),
        statsService.getMatches(),
        statsService.getAllEvents()
      ]);

      const db = await initDB();
      let allAnnotations: CoachAnnotation[] = [];
      try {
        allAnnotations = await db.getAll('coach_annotations');
      } catch (e) {
        console.error('Error loading coach annotations:', e);
      }
      const annotationsMap: Record<string, CoachAnnotation[]> = {};
      allAnnotations.forEach(ann => {
        if (!annotationsMap[ann.targetId]) {
          annotationsMap[ann.targetId] = [];
        }
        annotationsMap[ann.targetId].push(ann);
      });
      setCoachAnnotations(annotationsMap);
      setAllDbMatches(allMatches);

      const getYouTubeId = (url?: string): string | null => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
      };

      const parsedRealMatches: FeaturedSynergyMatch[] = [];
      for (const m of allMatches) {
        const ytId = getYouTubeId(m.videoUrl);
        if (ytId) {
          const matchEvents = allEvents.filter(e => e.matchId === m.id);
          const mappedEvents: SynergyEvent[] = matchEvents.map(e => {
            const playerProfile = allProfiles.find(p => p.id === e.playerId);
            const pName = playerProfile?.name || playerProfile?.displayName || e.playerId || 'Pemain';
            const pAvatar = playerProfile?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(pName)}`;
            
            let readableType = e.type as string;
            let typeCategory: SynergyEvent['typeCategory'] = 'other';
            
            if (e.type === '3pt_make') { readableType = '3PT Make'; typeCategory = 'shot_make'; }
            else if (e.type === '2pt_make') { readableType = '2PT Make'; typeCategory = 'shot_make'; }
            else if (e.type === '1pt_make') { readableType = 'FT Make'; typeCategory = 'shot_make'; }
            else if (e.type === '3pt_miss') { readableType = '3PT Miss'; typeCategory = 'shot_miss'; }
            else if (e.type === '2pt_miss') { readableType = '2PT Miss'; typeCategory = 'shot_miss'; }
            else if (e.type === '1pt_miss') { readableType = 'FT Miss'; typeCategory = 'shot_miss'; }
            else if (e.type === 'ast') { readableType = 'Assist'; typeCategory = 'assist'; }
            else if (e.type === 'oreb' || e.type === 'dreb' || e.type === 'rebound') { readableType = 'Rebound'; typeCategory = 'rebound'; }
            else if (e.type === 'stl') { readableType = 'Steal'; typeCategory = 'steal'; }
            else if (e.type === 'to' || e.type === 'turnover') { readableType = 'Turnover'; typeCategory = 'turnover'; }
            else if (e.type === 'foul') { readableType = 'Foul'; typeCategory = 'foul'; }
            
            return {
              id: e.id,
              youtubeTimestamp: e.youtubeTimestamp || 0,
              playerName: pName,
              playerAvatar: pAvatar,
              type: readableType,
              typeCategory,
              phaseOfPlay: e.phaseOfPlay || 'set_offense',
              quarter: e.quarter || 1,
              gameClock: e.gameClock || '00:00',
              description: e.sourceText || (e as any).description || `${pName} melakukan ${readableType}`,
              x: e.x,
              y: e.y
            };
          });

          const homeTeam = allTeams.find(t => t.id === m.teamId);
          const homeName = homeTeam?.name || m.ourTeamName || 'Tim Kita';
          const homeLogo = homeTeam?.logoUrl || 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=100&auto=format&fit=crop&q=60';

          const awayTeam = allTeams.find(t => t.id === m.opponentTeamId);
          const awayName = awayTeam?.name || m.theirTeamName || 'Lawan';
          const awayLogo = awayTeam?.logoUrl || 'https://images.unsplash.com/photo-1519766304817-4f37bda74a27?w=100&auto=format&fit=crop&q=60';

          parsedRealMatches.push({
            id: m.id,
            title: m.name || `${homeName} vs ${awayName}`,
            teams: {
              home: { name: homeName, logo: homeLogo },
              away: { name: awayName, logo: awayLogo }
            },
            date: m.date,
            competition: m.eventName || 'DBL Junior League',
            ageCategory: m.ageGroup || 'KU-16',
            youtubeId: ytId,
            duration: m.durationPerPeriod ? `${m.periodCount * m.durationPerPeriod} Menit` : '12:45',
            thumbnailUrl: `https://img.youtube.com/vi/${ytId}/0.jpg`,
            events: mappedEvents,
            isPrivate: (m as any).isPrivate ?? false
          });
        }
      }
      setRealMatches(parsedRealMatches);

      if (selectedMatch) {
        const updatedSelected = parsedRealMatches.find(m => m.id === selectedMatch.id);
        if (updatedSelected) {
          setSelectedMatch(updatedSelected);
        }
      }
    } catch (e) {
      console.error('Refresh failed:', e);
    }
  };

  const toggleMatchPrivacy = async (matchId: string, currentVal: boolean) => {
    try {
      const match = allDbMatches.find(m => m.id === matchId);
      if (!match) return;
      
      const updatedMatch = {
        ...match,
        isPrivate: !currentVal
      };
      
      await statsService.updateMatch(updatedMatch);
      showToast(`Status pertandingan diubah menjadi ${!currentVal ? 'PRIVAT (Hanya Pelatih/Admin)' : 'PUBLIK (Umum)'}`, 'success');
      await triggerDataRefresh();
    } catch (e) {
      console.error(e);
      showToast('Gagal mengubah status visibilitas', 'error');
    }
  };

  const handleLinkVideo = async (matchId: string, url: string) => {
    if (!url.trim()) {
      showToast('URL video YouTube tidak boleh kosong', 'error');
      return;
    }
    try {
      const match = allDbMatches.find(m => m.id === matchId);
      if (!match) return;

      const updatedMatch = {
        ...match,
        videoUrl: url
      };

      await statsService.updateMatch(updatedMatch);
      showToast('Berhasil menautkan video ke pertandingan', 'success');
      setIsLinkVideoModalOpen(false);
      setSelectedMatchToLink(null);
      setYoutubeUrlToLink('');
      await triggerDataRefresh();
    } catch (e) {
      console.error(e);
      showToast('Gagal menautkan video', 'error');
    }
  };

  const handleSaveAnnotation = async (eventId: string, matchId: string) => {
    if (!newReview.note.trim()) {
      showToast('Catatan ulasan tidak boleh kosong', 'error');
      return;
    }
    try {
      let timestamp = 0;
      if (youtubePlayer) {
        timestamp = Math.floor(youtubePlayer.getCurrentTime());
      }

      if (editingReviewId) {
        // Update existing
        const existingAnns = coachAnnotations[eventId] || [];
        const existingAnn = existingAnns.find(a => a.id === editingReviewId);
        if (existingAnn) {
          const updatedAnn: CoachAnnotation = {
            ...existingAnn,
            category: newReview.category,
            rating: newReview.rating,
            note: newReview.note,
            videoTimestamp: timestamp || existingAnn.videoTimestamp
          };
          await coachAnalysisService.updateAnnotation(updatedAnn);
          showToast('Ulasan pelatih berhasil diperbarui', 'success');
        }
      } else {
        // Create new
        const newAnn: CoachAnnotation = {
          id: `ann-${Math.random().toString(36).substring(2, 11)}`,
          matchId,
          coachId: currentUser?.id || 'default-coach',
          targetType: 'event',
          targetId: eventId,
          category: newReview.category,
          rating: newReview.rating,
          note: newReview.note,
          videoTimestamp: timestamp,
          createdAt: new Date().toISOString()
        };
        await coachAnalysisService.createAnnotation(newAnn);
        showToast('Ulasan pelatih berhasil ditambahkan', 'success');
      }

      setNewReview({ category: 'skill', rating: 5, note: '' });
      setIsAddReviewOpen(false);
      setEditingReviewId(null);
      await triggerDataRefresh();
    } catch (e) {
      console.error(e);
      showToast('Gagal menyimpan ulasan pelatih', 'error');
    }
  };

  const handleDeleteAnnotation = async (annId: string, eventId: string) => {
    try {
      await coachAnalysisService.deleteAnnotation(annId);
      showToast('Ulasan pelatih berhasil dihapus', 'success');
      await triggerDataRefresh();
    } catch (e) {
      console.error(e);
      showToast('Gagal menghapus ulasan', 'error');
    }
  };

  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  
  // Aggregate stats per player
  const [playerStatsMap, setPlayerStatsMap] = useState<Record<string, {
    ppg: number;
    rpg: number;
    apg: number;
    gamesPlayed: number;
    isVerified: boolean;
    position: string;
    ageGroup: string;
    hasPlayedUp: boolean;
    highestCompetitionGrade: string | null;
  }>>({});

  // Discovery / Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('All');
  const [selectedPosition, setSelectedPosition] = useState('All');
  const [selectedGrade, setSelectedGrade] = useState('All');

  useEffect(() => {
    const loadGalleryData = async () => {
      setLoading(true);
      try {
        // 1. Get all profiles, teams, matches, events, and requests
        const [allProfiles, allTeams, allMatches, allEvents, allRequests] = await Promise.all([
          statsService.getProfiles(),
          statsService.getTeams(),
          statsService.getMatches(),
          statsService.getAllEvents(),
          requestService.getAllRequests()
        ]);

        // Fetch current user
        try {
          const user = await authService.getCurrentUser();
          setCurrentUser(user);
        } catch (e) {
          console.error('Error fetching current user:', e);
        }

        // Fetch coach annotations
        const db = await initDB();
        let allAnnotations: CoachAnnotation[] = [];
        try {
          allAnnotations = await db.getAll('coach_annotations');
        } catch (e) {
          console.error('Error loading coach annotations:', e);
        }
        const annotationsMap: Record<string, CoachAnnotation[]> = {};
        allAnnotations.forEach(ann => {
          if (!annotationsMap[ann.targetId]) {
            annotationsMap[ann.targetId] = [];
          }
          annotationsMap[ann.targetId].push(ann);
        });
        setCoachAnnotations(annotationsMap);

        // Store all db matches
        setAllDbMatches(allMatches);

        // Map matches to FeaturedSynergyMatch
        const getYouTubeId = (url?: string): string | null => {
          if (!url) return null;
          const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
          const match = url.match(regExp);
          return (match && match[2].length === 11) ? match[2] : null;
        };

        const parsedRealMatches: FeaturedSynergyMatch[] = [];
        for (const m of allMatches) {
          const ytId = getYouTubeId(m.videoUrl);
          if (ytId) {
            const matchEvents = allEvents.filter(e => e.matchId === m.id);
            const mappedEvents: SynergyEvent[] = matchEvents.map(e => {
              const playerProfile = allProfiles.find(p => p.id === e.playerId);
              const pName = playerProfile?.name || playerProfile?.displayName || e.playerId || 'Pemain';
              const pAvatar = playerProfile?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(pName)}`;
              
              let readableType = e.type as string;
              let typeCategory: SynergyEvent['typeCategory'] = 'other';
              
              if (e.type === '3pt_make') { readableType = '3PT Make'; typeCategory = 'shot_make'; }
              else if (e.type === '2pt_make') { readableType = '2PT Make'; typeCategory = 'shot_make'; }
              else if (e.type === '1pt_make') { readableType = 'FT Make'; typeCategory = 'shot_make'; }
              else if (e.type === '3pt_miss') { readableType = '3PT Miss'; typeCategory = 'shot_miss'; }
              else if (e.type === '2pt_miss') { readableType = '2PT Miss'; typeCategory = 'shot_miss'; }
              else if (e.type === '1pt_miss') { readableType = 'FT Miss'; typeCategory = 'shot_miss'; }
              else if (e.type === 'ast') { readableType = 'Assist'; typeCategory = 'assist'; }
              else if (e.type === 'oreb' || e.type === 'dreb' || e.type === 'rebound') { readableType = 'Rebound'; typeCategory = 'rebound'; }
              else if (e.type === 'stl') { readableType = 'Steal'; typeCategory = 'steal'; }
              else if (e.type === 'to' || e.type === 'turnover') { readableType = 'Turnover'; typeCategory = 'turnover'; }
              else if (e.type === 'foul') { readableType = 'Foul'; typeCategory = 'foul'; }
              
              return {
                id: e.id,
                youtubeTimestamp: e.youtubeTimestamp || 0,
                playerName: pName,
                playerAvatar: pAvatar,
                type: readableType,
                typeCategory,
                phaseOfPlay: e.phaseOfPlay || 'set_offense',
                quarter: e.quarter || 1,
                gameClock: e.gameClock || '00:00',
                description: e.sourceText || (e as any).description || `${pName} melakukan ${readableType}`,
                x: e.x,
                y: e.y
              };
            });

            const homeTeam = allTeams.find(t => t.id === m.teamId);
            const homeName = homeTeam?.name || m.ourTeamName || 'Tim Kita';
            const homeLogo = homeTeam?.logoUrl || 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=100&auto=format&fit=crop&q=60';

            const awayTeam = allTeams.find(t => t.id === m.opponentTeamId);
            const awayName = awayTeam?.name || m.theirTeamName || 'Lawan';
            const awayLogo = awayTeam?.logoUrl || 'https://images.unsplash.com/photo-1519766304817-4f37bda74a27?w=100&auto=format&fit=crop&q=60';

            parsedRealMatches.push({
              id: m.id,
              title: m.name || `${homeName} vs ${awayName}`,
              teams: {
                home: { name: homeName, logo: homeLogo },
                away: { name: awayName, logo: awayLogo }
              },
              date: m.date,
              competition: m.eventName || 'DBL Junior League',
              ageCategory: m.ageGroup || 'KU-16',
              youtubeId: ytId,
              duration: m.durationPerPeriod ? `${m.periodCount * m.durationPerPeriod} Menit` : '12:45',
              thumbnailUrl: `https://img.youtube.com/vi/${ytId}/0.jpg`,
              events: mappedEvents,
              isPrivate: (m as any).isPrivate ?? false
            });
          }
        }
        setRealMatches(parsedRealMatches);

        // Filter only discoverable profiles
        const discoverableProfiles = allProfiles.filter(p => p.isDiscoverable === true);
        setProfiles(discoverableProfiles);
        setSelectedAthleteId(prev => prev || discoverableProfiles[0]?.id || '');
        setTeams(allTeams);

        // Map verified match IDs from completed/reviewed stat service requests
        const verifiedIds = new Set(
          allRequests
            .filter(req => req.status === 'completed' || req.status === 'reviewed')
            .map(req => req.matchId)
            .filter(Boolean) as string[]
        );
        setVerifiedMatchIds(verifiedIds);

        const countableMatches = allMatches.filter(isCountableMatch);
        const matchMap = new Map(countableMatches.map(m => [m.id, m]));
        const rosterRecords = await statsService.getAllMatchRosters();
        const stints = await db.getAll('match_stints');

        // 2. Pre-calculate stats for each discoverable profile
        const statsMap: typeof playerStatsMap = {};

        discoverableProfiles.forEach(profile => {
          // Find potential player records in teams roster to extract position/jersey/age group
          const teamPlayers = allTeams.flatMap(t => t.roster || []);
          const matchedPlayer = teamPlayers.find(p => p.id === profile.id);
          
          const position = matchedPlayer?.position || 'N/A';
          
          // Determine Age Group from team or birthdate
          let ageGroup = 'N/A';
          if (profile.mainTeamId) {
            const team = allTeams.find(t => t.id === profile.mainTeamId);
            if (team?.ageGroup) {
              ageGroup = team.ageGroup;
            }
          }
          if (ageGroup === 'N/A' && profile.birthDate) {
            const birthYear = new Date(profile.birthDate).getFullYear();
            const currentYear = new Date().getFullYear();
            const ku = currentYear - birthYear;
            ageGroup = `KU-${ku}`;
          }

          // Gather matching player IDs for stat grouping
          const matchingPlayerIds = new Set<string>([profile.id]);
          rosterRecords.forEach(r => {
            if (r.id === profile.id || r.profileId === profile.id) {
              matchingPlayerIds.add(r.profileId);
            }
            const aliases = profile.voiceAliases?.map(a => a.toLowerCase()) || [];
            if (r.profileId === profile.id && aliases.includes(r.name.toLowerCase())) {
              matchingPlayerIds.add(r.profileId);
            }
          });

          // Filter events belonging to this player in countable matches
          const playerEvents = allEvents.filter(e => 
            matchingPlayerIds.has(e.playerId) && matchMap.has(e.matchId)
          );

          // Calculate matches played
          const matchesPlayedSet = new Set<string>();
          countableMatches.forEach(m => {
            const hasPlayed = Array.from(matchingPlayerIds).some(pid => 
              didPlayInMatch(pid, m.id, allEvents, stints)
            );
            if (hasPlayed) {
              matchesPlayedSet.add(m.id);
            }
          });

          const gamesPlayed = matchesPlayedSet.size;

          // Aggregate points, rebounds, and assists
          let totalPoints = 0;
          let totalRebounds = 0;
          let totalAssists = 0;

          playerEvents.forEach(e => {
            switch (e.type) {
              case '1pt_make': totalPoints += 1; break;
              case '2pt_make': totalPoints += 2; break;
              case '3pt_make': totalPoints += 3; break;
              case 'oreb':
              case 'dreb':
                totalRebounds += 1;
                break;
              case 'ast':
                totalAssists += 1;
                break;
            }
          });

          // Check if any match played is verified
          const isVerified = Array.from(matchesPlayedSet).some(mId => verifiedIds.has(mId));

          let hasPlayedUp = false;
          let highestGradeWeight = 0;
          let highestGradeName: string | null = null;

          const playerMatchesList = countableMatches.filter(m => {
            const matchRosters = rosterRecords.filter(r => r.matchId === m.id);
            return matchRosters.some(r => matchingPlayerIds.has(r.profileId));
          });

          playerMatchesList.forEach(m => {
            const activeKU = m.matchKU !== undefined ? m.matchKU : m.ageCategory;
            if (activeKU !== undefined && profile.birthDate) {
              const status = isPlayingUp(profile.birthDate, m.date, activeKU);
              if (status === 'up') {
                hasPlayedUp = true;
              }
            }
            if (m.competitionGrade) {
              const weight = COMPETITION_GRADE_WEIGHTS[m.competitionGrade as CompetitionGrade] || 0;
              if (weight > highestGradeWeight) {
                highestGradeWeight = weight;
                highestGradeName = m.competitionGrade;
              }
            }
          });

          statsMap[profile.id] = {
            ppg: gamesPlayed > 0 ? Number((totalPoints / gamesPlayed).toFixed(1)) : 0,
            rpg: gamesPlayed > 0 ? Number((totalRebounds / gamesPlayed).toFixed(1)) : 0,
            apg: gamesPlayed > 0 ? Number((totalAssists / gamesPlayed).toFixed(1)) : 0,
            gamesPlayed,
            isVerified,
            position,
            ageGroup,
            hasPlayedUp,
            highestCompetitionGrade: highestGradeName
          };
        });

        setPlayerStatsMap(statsMap);
      } catch (err) {
        console.error('Error loading gallery details:', err);
      } finally {
        setLoading(false);
      }
    };

    loadGalleryData();
  }, []);

  // Filter profiles based on search query, age group, position, and highest competition grade
  const filteredProfiles = profiles.filter(profile => {
    const stats = playerStatsMap[profile.id] || { position: 'N/A', ageGroup: 'N/A', highestCompetitionGrade: null };
    const matchesSearch = profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.displayName && profile.displayName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesAgeGroup = selectedAgeGroup === 'All' || 
      stats.ageGroup.toLowerCase().replace(/[^a-z0-9]/g, '') === selectedAgeGroup.toLowerCase().replace(/[^a-z0-9]/g, '');

    const matchesPosition = selectedPosition === 'All' || 
      stats.position.toLowerCase() === selectedPosition.toLowerCase();

    const matchesGrade = selectedGrade === 'All' ||
      stats.highestCompetitionGrade === selectedGrade;

    return matchesSearch && matchesAgeGroup && matchesPosition && matchesGrade;
  });

  const uniqueAgeGroups = Array.from(new Set(Object.values(playerStatsMap).map(s => s.ageGroup))).filter(g => g !== 'N/A');
  const uniquePositions = Array.from(new Set(Object.values(playerStatsMap).map(s => s.position))).filter(p => p !== 'N/A');
  const uniqueGrades = Array.from(new Set(Object.values(playerStatsMap).map(s => s.highestCompetitionGrade).filter(Boolean))) as CompetitionGrade[];

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedAgeGroup('All');
    setSelectedPosition('All');
    setSelectedGrade('All');
  };

  const hasActiveFilters = searchQuery !== '' || selectedAgeGroup !== 'All' || selectedPosition !== 'All' || selectedGrade !== 'All';

  // Loading Skeleton State for clean layout transitions
  const GallerySkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 animate-pulse">
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-3 space-y-3 shadow-sm">
          <div className="w-full aspect-square bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-3 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="flex gap-1.5 pt-1">
            <div className="h-5 w-12 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderSynergyTab = () => {
    const canSeePrivate = can('manage_users') || can('do_coach_analysis');
    const allAvailableMatches = [
      ...realMatches,
    ];
    const visibleMatches = allAvailableMatches.filter(m => {
      if (canSeePrivate) return true;
      return !m.isPrivate;
    });

    if (selectedMatch) {
      // Extract unique players
      const uniquePlayers = Array.from(new Set(selectedMatch.events.map(e => e.playerName)));
      
      // Filtered play-by-play list
      const filteredEvents = selectedMatch.events.filter(e => {
        const matchesPlayer = synergyFilters.playerName === 'All' || e.playerName === synergyFilters.playerName;
        
        let matchesEvent = false;
        if (synergyFilters.eventType === 'All') {
          matchesEvent = true;
        } else if (synergyFilters.eventType === 'Shots') {
          matchesEvent = e.typeCategory === 'shot_make' || e.typeCategory === 'shot_miss';
        } else if (synergyFilters.eventType === 'Makes') {
          matchesEvent = e.typeCategory === 'shot_make';
        } else if (synergyFilters.eventType === 'Assists') {
          matchesEvent = e.typeCategory === 'assist';
        } else if (synergyFilters.eventType === 'Rebounds') {
          matchesEvent = e.typeCategory === 'rebound';
        } else if (synergyFilters.eventType === 'Steals') {
          matchesEvent = e.typeCategory === 'steal';
        } else if (synergyFilters.eventType === 'Turnovers') {
          matchesEvent = e.typeCategory === 'turnover';
        } else if (synergyFilters.eventType === 'Fouls') {
          matchesEvent = e.typeCategory === 'foul';
        }
        
        const matchesPossession = synergyFilters.possessionType === 'All' || e.phaseOfPlay === synergyFilters.possessionType;
        
        return matchesPlayer && matchesEvent && matchesPossession;
      });

      return (
        <div className="space-y-6 text-left" id="synergy-workspace">
          {/* Back Navigation Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 text-white p-4 rounded-2xl border border-zinc-800 shadow-md">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedMatch(null);
                  setActiveEventId(null);
                  setSynergyFilters({ playerName: 'All', eventType: 'All', possessionType: 'All' });
                }}
                className="flex items-center justify-center p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all text-zinc-300 hover:text-white cursor-pointer"
                title="Kembali ke Galeri Video"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-brand-orange text-zinc-950 font-black text-[9px] uppercase rounded-md tracking-wider">
                    {selectedMatch.ageCategory}
                  </span>
                  <span className="text-zinc-400 text-xs font-mono">{selectedMatch.competition}</span>
                </div>
                <h2 className="text-sm sm:text-base font-display font-black text-white mt-0.5 uppercase tracking-wide text-left">
                  {selectedMatch.title}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
              <CalendarClock size={14} className="text-brand-orange" />
              <span>{selectedMatch.date}</span>
              <span className="text-zinc-600">•</span>
              <span>Durasi: {selectedMatch.duration}</span>
            </div>
          </div>

          {/* Interactive Workspace Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left side: Video & Basketball Court */}
            <div className="lg:col-span-7 space-y-4">
              {/* Video Player Box */}
              <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl group">
                <YouTube
                  videoId={selectedMatch.youtubeId}
                  opts={{
                    width: '100%',
                    height: '100%',
                    playerVars: {
                      autoplay: 1,
                      controls: 1,
                      rel: 0,
                      modestbranding: 1,
                      enablejsapi: 1,
                    },
                  }}
                  onReady={(event) => setYoutubePlayer(event.target)}
                  className="w-full h-full aspect-video"
                />
              </div>

              {/* Video & Playback Rate Controls */}
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl space-y-3 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-wider mr-2">Kecepatan Analisis:</span>
                    {[0.5, 0.75, 1, 1.25].map(rate => (
                      <button
                        key={rate}
                        onClick={() => handleSpeedChange(rate)}
                        className={`px-3 py-1 text-xs font-black rounded-lg transition-all cursor-pointer ${
                          playbackRate === rate
                            ? 'bg-brand-orange text-zinc-950 shadow-sm'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        {rate === 1 ? 'MURNI (1x)' : `${rate}x`}
                      </button>
                    ))}
                  </div>

                  {/* Manual Controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (youtubePlayer) {
                          const curr = youtubePlayer.getCurrentTime();
                          youtubePlayer.seekTo(Math.max(0, curr - 3), true);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-zinc-800"
                      title="Mundur 3 Detik"
                    >
                      <RotateCcw size={13} /> -3s
                    </button>
                    <button
                      onClick={() => {
                        if (youtubePlayer) {
                          const state = youtubePlayer.getPlayerState();
                          if (state === 1) { // playing
                            youtubePlayer.pauseVideo();
                          } else {
                            youtubePlayer.playVideo();
                          }
                        }
                      }}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer border border-zinc-800"
                    >
                      Pause / Play
                    </button>
                    <button
                      onClick={() => {
                        if (youtubePlayer) {
                          const curr = youtubePlayer.getCurrentTime();
                          youtubePlayer.seekTo(curr + 3, true);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-zinc-800"
                      title="Maju 3 Detik"
                    >
                      +3s <RotateCcw size={13} className="transform rotate-180" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Court Event Mapper Panel */}
              <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-3xl shadow-lg space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Dribbble className="text-brand-orange animate-pulse" size={18} />
                    <h3 className="text-xs font-black uppercase text-white tracking-wider">
                      Peta Kejadian di Lapangan (Event Court Map)
                    </h3>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono bg-zinc-900 px-2 py-1 rounded-md">
                    {filteredEvents.length} Kejadian Terpeta
                  </span>
                </div>

                <p className="text-xs text-zinc-400">
                  Klik titik berwarna di lapangan basket di bawah ini untuk langsung memutar video pada momen tersebut.
                </p>

                {/* Court Map Graphic */}
                <div className="relative">
                  <svg viewBox="0 0 100 50" className="w-full bg-[#0E0E11] border border-zinc-800 rounded-2xl shadow-inner relative overflow-hidden">
                    {/* Court lines */}
                    <rect x="0" y="0" width="100" height="50" fill="none" stroke="#27272A" strokeWidth="0.8" />
                    <line x1="50" y1="0" x2="50" y2="50" stroke="#27272A" strokeWidth="0.8" />
                    <circle cx="50" cy="25" r="8" fill="none" stroke="#27272A" strokeWidth="0.8" />
                    <circle cx="50" cy="25" r="1.5" fill="#27272A" />
                    
                    {/* Left court */}
                    <rect x="0" y="17" width="19" height="16" fill="none" stroke="#27272A" strokeWidth="0.8" />
                    <path d="M 19 21 A 4 4 0 0 1 19 29" fill="none" stroke="#27272A" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
                    <path d="M 19 29 A 4 4 0 0 1 19 21" fill="none" stroke="#27272A" strokeWidth="0.8" />
                    <path d="M 0 5 A 20 20 0 0 0 0 45" fill="none" stroke="#27272A" strokeWidth="0.8" />
                    <circle cx="4.75" cy="25" r="1.2" fill="none" stroke="#27272A" strokeWidth="0.8" />
                    <line x1="4" y1="21" x2="4" y2="29" stroke="#27272A" strokeWidth="1" />
                    
                    {/* Right court */}
                    <rect x="81" y="17" width="19" height="16" fill="none" stroke="#27272A" strokeWidth="0.8" />
                    <path d="M 81 21 A 4 4 0 0 0 81 29" fill="none" stroke="#27272A" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
                    <path d="M 81 29 A 4 4 0 0 0 81 21" fill="none" stroke="#27272A" strokeWidth="0.8" />
                    <path d="M 100 5 A 20 20 0 0 0 100 45" fill="none" stroke="#27272A" strokeWidth="0.8" />
                    <circle cx="95.25" cy="25" r="1.2" fill="none" stroke="#27272A" strokeWidth="0.8" />
                    <line x1="96" y1="21" x2="96" y2="29" stroke="#27272A" strokeWidth="1" />

                    {/* Plot Interactive Dots */}
                    {filteredEvents.map(event => {
                      const cxVal = event.x || 50;
                      const cyVal = (event.y || 50) / 2; // Scale height down to viewBox range (50)
                      
                      // Compute dot color based on category
                      let color = '#3B82F6'; // default blue
                      if (event.typeCategory === 'shot_make') color = '#10B981'; // green make
                      else if (event.typeCategory === 'shot_miss') color = '#EF4444'; // red miss
                      else if (event.typeCategory === 'assist') color = '#8B5CF6'; // purple assist
                      else if (event.typeCategory === 'steal') color = '#F59E0B'; // orange steal
                      else if (event.typeCategory === 'turnover') color = '#EC4899'; // pink turnover
                      else if (event.typeCategory === 'foul') color = '#EAB308'; // yellow foul
                      
                      const isCurrentlyActive = activeEventId === event.id;

                      return (
                        <g key={event.id}>
                          {isCurrentlyActive && (
                            <circle
                              cx={cxVal}
                              cy={cyVal}
                              r="3.5"
                              fill="none"
                              stroke={color}
                              strokeWidth="0.8"
                              className="animate-ping"
                              style={{ transformOrigin: `${cxVal}px ${cyVal}px` }}
                            />
                          )}
                          <circle
                            cx={cxVal}
                            cy={cyVal}
                            r={isCurrentlyActive ? 2.5 : 1.8}
                            fill={color}
                            className="cursor-pointer transition-all duration-150 hover:r-[3.5] filter drop-shadow"
                            onClick={() => handleEventClick(event)}
                            onMouseEnter={() => setCourtHoveredEvent(event)}
                            onMouseLeave={() => setCourtHoveredEvent(null)}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Tooltip Overlay */}
                  <div className="absolute top-2 left-2 pointer-events-none transition-all duration-200">
                    {courtHoveredEvent ? (
                      <div className="bg-zinc-900/95 border border-zinc-800 text-white p-2.5 rounded-xl shadow-xl max-w-xs text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className={`w-2 h-2 rounded-full ${
                            courtHoveredEvent.typeCategory === 'shot_make' ? 'bg-emerald-500' :
                            courtHoveredEvent.typeCategory === 'shot_miss' ? 'bg-rose-500' :
                            courtHoveredEvent.typeCategory === 'assist' ? 'bg-purple-500' :
                            courtHoveredEvent.typeCategory === 'steal' ? 'bg-amber-500' : 'bg-blue-500'
                          }`} />
                          <span className="text-zinc-300 font-mono text-[10px]">{courtHoveredEvent.gameClock} Q{courtHoveredEvent.quarter}</span>
                        </div>
                        <p className="font-black text-white text-[11px] uppercase tracking-wide">
                          {courtHoveredEvent.playerName} • {courtHoveredEvent.type}
                        </p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed italic">{courtHoveredEvent.description}</p>
                      </div>
                    ) : (
                      <div className="bg-zinc-900/40 text-[10px] text-zinc-500 font-mono px-2 py-1 rounded border border-zinc-800/40">
                        Arahkan kursor ke titik untuk detail kejadian
                      </div>
                    )}
                  </div>

                  {/* Court Color Legend */}
                  <div className="flex flex-wrap items-center justify-center gap-4 pt-3 text-[10px] text-zinc-400 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-[#10B981] rounded-full" /> <span>Tembakan Masuk (Make)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-[#8B5CF6] rounded-full" /> <span>Assist</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-[#F59E0B] rounded-full" /> <span>Steal</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-[#EC4899] rounded-full" /> <span>Turnover</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-[#3B82F6] rounded-full" /> <span>Lainnya</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Interactive Playlist Feed */}
            <div className="lg:col-span-5 space-y-4 text-left">
              {/* Filter Panel */}
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-3xl space-y-3 shadow-lg text-left">
                <div className="flex items-center gap-1.5 text-zinc-300 font-bold text-xs">
                  <SlidersHorizontal size={14} className="text-brand-orange" />
                  <span>FILTER PLAYLIST KEJADIAN</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-left">
                  {/* Player Name Filter */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Pemain</label>
                    <select
                      value={synergyFilters.playerName}
                      onChange={(e) => setSynergyFilters(prev => ({ ...prev, playerName: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg p-2 text-[11px] font-bold focus:outline-none focus:border-brand-orange cursor-pointer"
                    >
                      <option value="All">Semua Pemain</option>
                      {uniquePlayers.map(p => {
                        const n = p.toLowerCase();
                        let jersey = '';
                        if (n.includes('heldrand')) jersey = ' (#8)';
                        else if (n.includes('rivaldo')) jersey = ' (#12)';
                        else if (n.includes('arya')) jersey = ' (#11)';
                        else if (n.includes('wijaya')) jersey = ' (#23)';
                        return (
                          <option key={p} value={p}>{p}{jersey}</option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Event Type Filter */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Kejadian</label>
                    <select
                      value={synergyFilters.eventType}
                      onChange={(e) => setSynergyFilters(prev => ({ ...prev, eventType: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg p-2 text-[11px] font-bold focus:outline-none focus:border-brand-orange cursor-pointer"
                    >
                      <option value="All">Semua Aksi</option>
                      <option value="Shots">Semua Tembakan</option>
                      <option value="Makes">Tembakan Masuk (Makes)</option>
                      <option value="Assists">Assist</option>
                      <option value="Rebounds">Rebound</option>
                      <option value="Steals">Steal</option>
                      <option value="Turnovers">Turnover</option>
                      <option value="Fouls">Foul</option>
                    </select>
                  </div>

                  {/* Possession Phase Filter */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Possession</label>
                    <select
                      value={synergyFilters.possessionType}
                      onChange={(e) => setSynergyFilters(prev => ({ ...prev, possessionType: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg p-2 text-[11px] font-bold focus:outline-none focus:border-brand-orange cursor-pointer"
                    >
                      <option value="All">Semua Fase</option>
                      <option value="set_offense">Set Offense</option>
                      <option value="transition">Transition</option>
                      <option value="fast_break">Fast Break</option>
                      <option value="inbound">Inbound Play</option>
                      <option value="deadball">Deadball</option>
                    </select>
                  </div>
                </div>

                {/* Reset Filters */}
                {(synergyFilters.playerName !== 'All' || synergyFilters.eventType !== 'All' || synergyFilters.possessionType !== 'All') && (
                  <button
                    onClick={() => setSynergyFilters({ playerName: 'All', eventType: 'All', possessionType: 'All' })}
                    className="w-full text-center py-1.5 border border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer hover:bg-zinc-900"
                  >
                    Reset Filter Playlist
                  </button>
                )}
              </div>

              {/* Event Playlist Container */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[500px]">
                <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center">
                  <h4 className="text-[11px] font-black uppercase text-zinc-300 tracking-wider">
                    Daftar Putar Kejadian ({filteredEvents.length} Item)
                  </h4>
                  <span className="text-[9px] text-zinc-500 font-mono">Urut berdasarkan Waktu</span>
                </div>

                <div className="overflow-y-auto divide-y divide-zinc-900 p-2 space-y-1 bg-zinc-950">
                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500 space-y-2">
                      <Film size={28} className="mx-auto text-zinc-700" />
                      <p className="text-xs">Tidak ada kejadian yang cocok dengan filter aktif Anda.</p>
                      <p className="text-[10px] text-zinc-600">Cobalah mengubah filter pencarian atau pemain.</p>
                    </div>
                  ) : (
                    filteredEvents.map((event, index) => {
                      const isActive = activeEventId === event.id;
                      
                      return (
                        <div
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className={`p-3 rounded-xl transition-all duration-150 cursor-pointer text-left flex items-start gap-3 ${
                            isActive
                              ? 'bg-brand-orange/10 border border-brand-orange/40 text-white'
                              : 'hover:bg-zinc-900/60 border border-transparent text-zinc-300 hover:text-white'
                          }`}
                        >
                          <div className="flex-shrink-0 mt-0.5 relative">
                            {event.playerAvatar ? (
                              <img
                                src={event.playerAvatar}
                                alt={event.playerName}
                                className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-white border border-zinc-700">
                                {event.playerName.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 bg-zinc-950 rounded-full p-0.5 border border-zinc-800">
                              {isActive ? (
                                <span className="flex h-2 w-2 relative">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                              ) : (
                                <Play size={8} className="text-brand-orange fill-brand-orange" />
                              )}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                event.typeCategory === 'shot_make' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                event.typeCategory === 'shot_miss' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                event.typeCategory === 'assist' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                event.typeCategory === 'steal' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                event.typeCategory === 'turnover' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' :
                                'bg-zinc-800 text-zinc-400'
                              }`}>
                                {event.type}
                              </span>
                              
                              <span className="text-[10px] font-mono text-zinc-500">
                                Q{event.quarter} • {event.gameClock}
                              </span>
                            </div>

                            <p className="text-xs font-black text-white uppercase tracking-wide truncate">
                              {event.playerName} {(() => {
                                const n = event.playerName.toLowerCase();
                                if (n.includes('heldrand')) return '#8';
                                if (n.includes('rivaldo')) return '#12';
                                if (n.includes('arya')) return '#11';
                                if (n.includes('wijaya')) return '#23';
                                return '';
                              })()}
                            </p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed italic line-clamp-2">
                              {event.description}
                            </p>

                            <div className="pt-1 flex flex-wrap items-center gap-1.5">
                              <span className="px-1.5 py-0.5 bg-zinc-900 text-zinc-500 text-[8px] font-black uppercase rounded border border-zinc-800 tracking-wider">
                                {event.phaseOfPlay.replace('_', ' ')}
                              </span>
                              {coachAnnotations[event.id]?.length > 0 && (
                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase rounded border border-amber-500/20 tracking-wider flex items-center gap-1">
                                  <MessageSquare size={8} /> Reviewed
                                </span>
                              )}
                            </div>

                            {/* Coach Review Section */}
                            {isActive && (
                              <div className="mt-3 pt-3 border-t border-zinc-900 space-y-3" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-brand-orange uppercase tracking-wider">
                                  <MessageSquare size={12} /> Ulasan & Analisis Pelatih
                                </div>
                                
                                {/* List existing reviews for this event */}
                                {coachAnnotations[event.id]?.map(ann => {
                                  const isReviewEditing = editingReviewId === ann.id;
                                  
                                  if (isReviewEditing) {
                                    return (
                                      <div key={ann.id} className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                                        <div className="flex items-center justify-between text-[10px]">
                                          <span className="font-bold text-zinc-400">Edit Ulasan</span>
                                          <button 
                                            onClick={() => {
                                              setEditingReviewId(null);
                                              setNewReview({ category: 'skill', rating: 5, note: '' });
                                            }}
                                            className="text-rose-500 hover:underline"
                                          >
                                            Batal
                                          </button>
                                        </div>
                                        
                                        {/* Category selection */}
                                        <div className="space-y-1">
                                          <label className="text-[9px] uppercase font-bold text-zinc-500">Kategori</label>
                                          <select
                                            value={newReview.category}
                                            onChange={(e) => setNewReview(prev => ({ ...prev, category: e.target.value as any }))}
                                            className="w-full bg-zinc-900 border border-zinc-800 text-white rounded p-1 text-xs"
                                          >
                                            <option value="skill">Skill & Teknik</option>
                                            <option value="decision">Pengambilan Keputusan (Decision Making)</option>
                                            <option value="strategy">Strategi & Taktik</option>
                                            <option value="teamwork">Kerja Sama Tim (Teamwork)</option>
                                            <option value="effort">Usaha & Stamina (Effort)</option>
                                            <option value="mental">Kekuatan Mental (Mental)</option>
                                          </select>
                                        </div>

                                        {/* Rating selection */}
                                        <div className="space-y-1">
                                          <label className="text-[9px] uppercase font-bold text-zinc-500 block">Rating Keputusan (1-5)</label>
                                          <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map(star => (
                                              <button
                                                key={star}
                                                onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                                                className="text-sm cursor-pointer focus:outline-none"
                                              >
                                                <Star size={14} fill={star <= newReview.rating ? '#F59E0B' : 'transparent'} className={star <= newReview.rating ? 'text-amber-500' : 'text-zinc-600'} />
                                              </button>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Note textarea */}
                                        <div className="space-y-1">
                                          <label className="text-[9px] uppercase font-bold text-zinc-500">Catatan Pelatih</label>
                                          <textarea
                                            value={newReview.note}
                                            onChange={(e) => setNewReview(prev => ({ ...prev, note: e.target.value }))}
                                            className="w-full bg-zinc-900 border border-zinc-800 text-white rounded p-1.5 text-xs h-16 focus:outline-none focus:border-brand-orange"
                                            placeholder="Tulis ulasan teknis..."
                                          />
                                        </div>

                                        <button
                                          onClick={() => handleSaveAnnotation(event.id, selectedMatch.id)}
                                          className="w-full py-1.5 bg-brand-orange text-zinc-950 font-black text-xs rounded transition-all hover:opacity-90"
                                        >
                                          Perbarui Ulasan
                                        </button>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div key={ann.id} className="p-3 bg-zinc-900 border border-zinc-800/60 rounded-xl space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="px-2 py-0.5 bg-brand-orange/10 text-brand-orange border border-brand-orange/20 text-[8px] font-black uppercase rounded tracking-wider">
                                          {ann.category === 'skill' ? 'Skill & Teknik' :
                                           ann.category === 'decision' ? 'Keputusan' :
                                           ann.category === 'strategy' ? 'Strategi & Taktik' :
                                           ann.category === 'teamwork' ? 'Kerja Sama' :
                                           ann.category === 'effort' ? 'Usaha' : 'Mental'}
                                        </span>
                                        
                                        <div className="flex items-center gap-0.5">
                                          {Array.from({ length: 5 }).map((_, i) => (
                                            <Star key={i} size={10} fill={i < (ann.rating || 5) ? '#F59E0B' : 'transparent'} className={i < (ann.rating || 5) ? 'text-amber-500' : 'text-zinc-700'} />
                                          ))}
                                        </div>
                                      </div>

                                      <p className="text-[11px] text-zinc-300 leading-relaxed italic bg-zinc-950/40 p-2 rounded-lg border border-zinc-900/40">
                                        "{ann.note}"
                                      </p>

                                      <div className="flex items-center justify-between pt-1 text-[9px] text-zinc-500 font-mono">
                                        <span>Oleh: Pelatih Tim</span>
                                        {(can('manage_users') || can('do_coach_analysis')) && (
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => {
                                                setEditingReviewId(ann.id);
                                                setNewReview({
                                                  category: ann.category,
                                                  rating: ann.rating || 5,
                                                  note: ann.note
                                                });
                                              }}
                                              className="text-zinc-400 hover:text-white flex items-center gap-0.5 cursor-pointer"
                                            >
                                              <Edit size={10} /> Edit
                                            </button>
                                            <button
                                              onClick={() => handleDeleteAnnotation(ann.id, event.id)}
                                              className="text-rose-400 hover:text-rose-300 flex items-center gap-0.5 cursor-pointer"
                                            >
                                              <Trash2 size={10} /> Hapus
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Form to add a new review */}
                                {isAddReviewOpen && !editingReviewId ? (
                                  <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="font-bold text-zinc-400">Tambah Ulasan Baru</span>
                                      <button onClick={() => setIsAddReviewOpen(false)} className="text-zinc-500 hover:text-white">
                                        Batal
                                      </button>
                                    </div>
                                    
                                    <div className="space-y-1">
                                      <label className="text-[9px] uppercase font-bold text-zinc-500">Kategori</label>
                                      <select
                                        value={newReview.category}
                                        onChange={(e) => setNewReview(prev => ({ ...prev, category: e.target.value as any }))}
                                        className="w-full bg-zinc-900 border border-zinc-800 text-white rounded p-1 text-xs"
                                      >
                                        <option value="skill">Skill & Teknik</option>
                                        <option value="decision">Pengambilan Keputusan (Decision Making)</option>
                                        <option value="strategy">Strategi & Taktik</option>
                                        <option value="teamwork">Kerja Sama Tim (Teamwork)</option>
                                        <option value="effort">Usaha & Stamina (Effort)</option>
                                        <option value="mental">Kekuatan Mental (Mental)</option>
                                      </select>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[9px] uppercase font-bold text-zinc-500 block">Rating Keputusan (1-5)</label>
                                      <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(star => (
                                          <button
                                            key={star}
                                            onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                                            className="text-sm cursor-pointer focus:outline-none"
                                          >
                                            <Star size={14} fill={star <= newReview.rating ? '#F59E0B' : 'transparent'} className={star <= newReview.rating ? 'text-amber-500' : 'text-zinc-600'} />
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[9px] uppercase font-bold text-zinc-500">Catatan Ulasan</label>
                                      <textarea
                                        value={newReview.note}
                                        onChange={(e) => setNewReview(prev => ({ ...prev, note: e.target.value }))}
                                        className="w-full bg-zinc-900 border border-zinc-800 text-white rounded p-1.5 text-xs h-16 focus:outline-none focus:border-brand-orange"
                                        placeholder="Tulis ulasan ulasan taktis..."
                                      />
                                    </div>

                                    <button
                                      onClick={() => handleSaveAnnotation(event.id, selectedMatch.id)}
                                      className="w-full py-1.5 bg-brand-orange text-zinc-950 font-black text-xs rounded transition-all hover:opacity-90"
                                    >
                                      Simpan Ulasan
                                    </button>
                                  </div>
                                ) : (
                                  /* Dotted button to add ulasan if role is coach or admin */
                                  (can('manage_users') || can('do_coach_analysis')) && !editingReviewId && (
                                    <button
                                      onClick={() => {
                                        setNewReview({ category: 'skill', rating: 5, note: '' });
                                        setIsAddReviewOpen(true);
                                      }}
                                      className="w-full py-2.5 border border-dashed border-zinc-800 hover:border-brand-orange text-zinc-400 hover:text-brand-orange rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <Plus size={12} /> Tambah Ulasan Pelatih
                                    </button>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Default: Return the Netflix style hub
    return (
      <div className="space-y-8 text-left bg-zinc-950 p-6 rounded-3xl border border-zinc-900 text-white" id="synergy-netflix-hub">
        {/* Superadmin Moderation Panel */}
        {can('manage_users') && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-brand-orange animate-spin-slow" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">Panel Moderasi & Manajemen Video</h3>
                  <p className="text-[10px] text-zinc-400 font-mono">Peran Aktif: Superadmin / Admin</p>
                </div>
              </div>
              <span className="text-[9px] bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded font-bold uppercase border border-brand-orange/20">
                Kontrol Visibilitas
              </span>
            </div>
            
            <p className="text-xs text-zinc-300 leading-relaxed">
              Sebagai Admin, Anda dapat mengaitkan tautan YouTube hasil rekaman statistik pertandingan serta menentukan visibilitas penonton umum (Publik vs Privat). Pertandingan privat hanya bisa diakses oleh Coach dan Admin.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
              {allDbMatches.map(m => {
                const hasVideo = !!m.videoUrl;
                return (
                  <div key={m.id} className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-4 text-xs hover:border-zinc-700 transition-all">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 font-mono">
                        <span>{m.eventName || 'Turnamen'}</span>
                        <span>•</span>
                        <span>{m.date}</span>
                      </div>
                      <h4 className="font-bold text-white truncate uppercase tracking-wide">
                        {m.name || `${m.ourTeamName} vs ${m.theirTeamName}`}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${hasVideo ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                          {hasVideo ? 'Video Tertaut' : 'Belum Ada Video'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${m.isPrivate ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                          {m.isPrivate ? 'Privat' : 'Publik'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedMatchToLink(m);
                          setYoutubeUrlToLink(m.videoUrl || '');
                          setIsLinkVideoModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer text-[10px] uppercase border border-zinc-800 hover:border-zinc-700"
                        title="Tautkan atau ubah link video rekaman"
                      >
                        <Youtube size={12} className="text-brand-orange" />
                        {hasVideo ? 'Edit Video' : 'Link Video'}
                      </button>

                      <button
                        onClick={() => toggleMatchPrivacy(m.id, m.isPrivate || false)}
                        className={`p-2 rounded-lg transition-all cursor-pointer border ${
                          m.isPrivate 
                            ? 'bg-rose-950/20 border-rose-900/50 hover:bg-rose-900/30 text-rose-400' 
                            : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                        title={m.isPrivate ? "Ubah ke Publik (Untuk Umum)" : "Ubah ke Privat (Khusus Internal)"}
                      >
                        {m.isPrivate ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                    </div>
                  </div>
                );
              })}
              {allDbMatches.length === 0 && (
                <div className="col-span-2 text-center py-6 text-zinc-500 text-xs">
                  Belum ada data pertandingan di database. Silakan rekam statistik terlebih dahulu.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hero Poster Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-black via-zinc-950 to-transparent border border-zinc-900">
          <div className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&auto=format&fit=crop&q=80')` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          
          <div className="relative p-6 sm:p-10 md:p-12 space-y-4 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-orange"></span>
              </span>
              <span className="text-brand-orange font-mono text-xs font-bold uppercase tracking-widest">
                Fitur Premium Synergy Sports
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-black text-white leading-tight uppercase tracking-wider">
              {visibleMatches[0]?.title || 'SBA Harimau U-16'} <span className="text-brand-orange">vs</span> {visibleMatches[0]?.teams?.away?.name || 'DBL Sharks'}
            </h1>
            
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Tonton, telaah, dan telusuri setiap momen penting per kejadian (possession) atau per atlet di pertandingan final bersejarah East Java Series secara instan.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  const m = visibleMatches[0];
                  if (!m) return;
                  setSelectedMatch(m);
                  setActiveEventId(null);
                }}
                className="px-6 py-3 bg-brand-orange hover:bg-brand-orange/90 text-zinc-950 font-black text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer uppercase tracking-wider shadow-lg shadow-brand-orange/20"
              >
                <PlayCircle size={18} fill="currentColor" /> Mulai Analisis Video
              </button>
              <span className="text-xs text-zinc-400 font-mono bg-black/60 px-3 py-1.5 rounded-lg border border-zinc-900">
                KU-16 • Durasi: {visibleMatches[0]?.duration || '12:45'} • {visibleMatches[0]?.events?.length || 9} Kejadian Terpeta
              </span>
            </div>
          </div>
        </div>

        {/* Netflix Carousel 1: Pertandingan Terverifikasi */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Sesi Aliran Rekaman Terverifikasi (Match Streams)
            </h3>
            <span className="text-[10px] text-zinc-500 font-mono">Geser Horizontal</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {visibleMatches.map(match => (
              <div
                key={match.id}
                onClick={() => {
                  setSelectedMatch(match);
                  setActiveEventId(null);
                }}
                className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:border-brand-orange shadow-md text-left"
              >
                <div className="relative aspect-video">
                  <img
                    src={match.thumbnailUrl}
                    alt={match.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                    <div className="w-12 h-12 bg-brand-orange rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                      <Play size={20} className="text-zinc-950 fill-zinc-950 ml-1" />
                    </div>
                  </div>
                  <span className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-300 border border-zinc-800 z-10">
                    {match.duration}
                  </span>
                  <span className="absolute top-2 left-2 bg-brand-orange text-zinc-950 text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase z-10">
                    {match.ageCategory}
                  </span>
                  {match.isPrivate && (
                    <span className="absolute top-2 right-2 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase flex items-center gap-1 shadow z-10">
                      <Lock size={10} /> Privat
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                    <span>{match.competition}</span>
                    <span>•</span>
                    <span>{match.date}</span>
                  </div>
                  <h4 className="text-xs font-black uppercase text-white tracking-wide group-hover:text-brand-orange transition-colors truncate">
                    {match.title}
                  </h4>
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800 text-[10px] text-zinc-400 font-mono">
                    <span>{match.events.length} Kejadian Terpeta</span>
                    <span className="text-brand-orange font-bold flex items-center gap-1">
                      ANALISIS <Eye size={12} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Netflix Carousel 2: Fase Possession */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-white">
            Eksplorasi Berdasarkan Fase Taktik (Possession Phases)
          </h3>
          <p className="text-xs text-zinc-400">
            Klik salah satu kategori di bawah ini untuk langsung menyaring kejadian taktis tersebut di pertandingan final.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { phase: 'set_offense', title: 'Set Offense', desc: 'Serangan pola teratur', count: '4' },
              { phase: 'fast_break', title: 'Fast Break', desc: 'Serangan balik kilat', count: '2' },
              { phase: 'transition', title: 'Transition', desc: 'Transisi bertahan-menyerang', count: '3' },
              { phase: 'inbound', title: 'Inbound Plays', desc: 'Skema lemparan ke dalam', count: '1' },
              { phase: 'deadball', title: 'Deadball Situations', desc: 'Momen bola mati/mati bola', count: '1' }
            ].map((cat, i) => (
              <div
                key={i}
                onClick={() => {
                  const m = visibleMatches[0];
                  if (!m) return;
                  setSelectedMatch(m);
                  setSynergyFilters({ playerName: 'All', eventType: 'All', possessionType: cat.phase });
                  setActiveEventId(null);
                }}
                className="bg-zinc-900 border border-zinc-800 hover:border-brand-orange p-4 rounded-xl transition-all hover:scale-[1.03] cursor-pointer text-left space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <Flame size={16} className="text-brand-orange group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-mono text-zinc-500">Momen: {cat.count}</span>
                </div>
                <h4 className="text-xs font-black text-white uppercase tracking-wide pt-1">{cat.title}</h4>
                <p className="text-[10px] text-zinc-500 leading-snug line-clamp-2">{cat.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Netflix Carousel 3: Kejadian Populer */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-white">
            Saringan Cepat Kejadian Populer (Play Types & Highlights)
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { type: 'Makes', label: 'Tembakan 3 & 2 Angka Masuk', icon: Dribbble, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { type: 'Assists', label: 'Umpan Matang Pencetak Skor (Assists)', icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { type: 'Steals', label: 'Curi Bola & Intersepsi (Steals)', icon: Flame, color: 'text-amber-500', bg: 'bg-amber-500/10' },
              { type: 'Turnovers', label: 'Kesalahan Aliran Bola (Turnovers)', icon: Film, color: 'text-pink-500', bg: 'bg-pink-500/10' }
            ].map((play, i) => (
              <div
                key={i}
                onClick={() => {
                  const m = visibleMatches[0];
                  if (!m) return;
                  setSelectedMatch(m);
                  setSynergyFilters({ playerName: 'All', eventType: play.type, possessionType: 'All' });
                  setActiveEventId(null);
                }}
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-brand-orange p-3 rounded-xl transition-all hover:scale-[1.03] cursor-pointer"
              >
                <div className={`p-2 rounded-lg ${play.bg} ${play.color}`}>
                  <play.icon size={16} />
                </div>
                <div className="text-left min-w-0">
                  <h4 className="text-xs font-black text-white uppercase tracking-wide truncate">{play.type}</h4>
                  <p className="text-[10px] text-zinc-500 truncate">{play.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderAthleteClipsTab = () => {
    const activeClip = athleteClips.find(c => c.id === activeAthleteClipId) || athleteClips[0];
    
    const handleAthleteClipClick = (clip: any) => {
      setActiveAthleteClipId(clip.id);
      if (athletePlayer) {
        const seekTime = Math.max(0, clip.youtubeTimestamp - 2);
        athletePlayer.seekTo(seekTime, true);
        athletePlayer.playVideo();
      }
    };

    const handleAthleteSpeedChange = (rate: number) => {
      setAthletePlaybackRate(rate);
      if (athletePlayer) {
        athletePlayer.setPlaybackRate(rate);
      }
    };

    const renderMiniCourt = (clip: any) => {
      if (!clip || clip.x === undefined || clip.y === undefined) return null;
      return (
        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl relative overflow-hidden">
          <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-2">POSISI AKSI DI LAPANGAN (COURT COORDINATE)</h4>
          <div className="relative w-full aspect-[2/1] bg-[#1A3A2A]/40 rounded-xl border border-emerald-500/20 overflow-hidden flex items-center justify-center">
            {/* Court markings */}
            <div className="absolute inset-y-0 left-0 w-1/2 border-r border-dashed border-emerald-500/20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-emerald-500/20" />
            <div className="absolute top-1/2 -translate-y-1/2 left-0 w-24 h-24 rounded-r-full border border-emerald-500/20" />
            <div className="absolute top-1/2 -translate-y-1/2 right-0 w-24 h-24 rounded-l-full border border-emerald-500/20" />
            
            {/* Three-point lines */}
            <div className="absolute inset-y-4 left-0 w-16 border-y border-r border-emerald-500/20 rounded-r-3xl" />
            <div className="absolute inset-y-4 right-0 w-16 border-y border-l border-emerald-500/20 rounded-l-3xl" />
            
            {/* Key/Paint areas */}
            <div className="absolute inset-y-12 left-0 w-20 border border-emerald-500/20 bg-emerald-500/5" />
            <div className="absolute inset-y-12 right-0 w-20 border border-emerald-500/20 bg-emerald-500/5" />

            {/* Action Marker */}
            <div 
              className="absolute w-4 h-4 rounded-full bg-brand-orange text-zinc-950 flex items-center justify-center text-[8px] font-bold shadow-lg shadow-brand-orange/40 animate-ping"
              style={{ left: `${clip.x}%`, top: `${clip.y}%` }}
            />
            <div 
              className="absolute w-3 h-3 rounded-full bg-brand-orange border-2 border-white flex items-center justify-center text-[8px] font-bold shadow-md shadow-brand-orange/50"
              style={{ left: `${clip.x}%`, top: `${clip.y}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>
          <p className="text-[9px] text-zinc-500 mt-2 text-center font-mono">
            KOORDINAT AKSI: X: {clip.x}%, Y: {clip.y}% • FASE: {clip.phaseOfPlay.toUpperCase().replace('_', ' ')}
          </p>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        {/* Horizontal Netflix-style Athlete Selector Carousel */}
        <div className="space-y-2 text-left">
          <div className="flex items-center gap-1.5 text-[#1A1A1A] dark:text-zinc-300 font-black text-xs uppercase tracking-wider">
            <Users size={14} className="text-brand-navy dark:text-brand-orange" />
            <span>Pilih Atlet ({profiles.length} Terdaftar)</span>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-zinc-950">
            {profiles.map(ath => {
              const isSelected = ath.id === selectedAthleteId;
              const team = teams.find(t => t.id === ath.teamId || t.id === ath.mainTeamId);
              
              return (
                <button
                  key={ath.id}
                  onClick={() => setSelectedAthleteId(ath.id)}
                  className={`flex-shrink-0 w-52 bg-white dark:bg-zinc-900 border text-left p-4 rounded-3xl transition-all relative cursor-pointer ${
                    isSelected 
                      ? 'border-brand-navy dark:border-brand-orange ring-2 ring-brand-navy/10 dark:ring-brand-orange/20 scale-[1.02] shadow-md shadow-brand-navy/5 dark:shadow-brand-orange/5' 
                      : 'border-zinc-200/50 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  {/* Jersey Badge */}
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-brand-navy dark:bg-brand-orange text-white dark:text-zinc-950 font-black text-[10px] rounded-lg shadow-sm">
                    #{ath.jerseyNumber || 'N/A'}
                  </span>

                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                      <img 
                        src={ath.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${ath.name}`} 
                        alt={ath.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wide truncate">
                        {ath.name}
                      </h4>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-bold">
                        {team ? team.name : 'Atlet Mandiri'}
                      </p>
                      <p className="text-[9px] text-zinc-400 font-mono mt-1">
                        Lahir: {ath.birthDate}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Athlete Profile Stats Banner */}
        {profiles.find(p => p.id === selectedAthleteId) && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 p-6 rounded-[2rem] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 text-left">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-3xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 border-2 border-brand-navy dark:border-brand-orange flex items-center justify-center">
                <img 
                  src={profiles.find(p => p.id === selectedAthleteId)?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(profiles.find(p => p.id === selectedAthleteId)?.name || 'athlete')}`} 
                  alt="athlete photo"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-display font-black text-zinc-900 dark:text-white uppercase tracking-wide">
                    {profiles.find(p => p.id === selectedAthleteId)?.name}
                  </h3>
                  <span className="px-2 py-0.5 bg-brand-navy dark:bg-brand-orange text-white dark:text-zinc-950 font-black text-[10px] rounded-md">
                    #{profiles.find(p => p.id === selectedAthleteId)?.jerseyNumber}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Klip Terkumpul: <span className="font-bold text-zinc-900 dark:text-white">{athleteClips.length} klip video</span> dari berbagai kejurnas & turnamen junior.
                </p>
              </div>
            </div>

            {/* Athlete Quick Stats from clips */}
            <div className="grid grid-cols-4 gap-4 bg-zinc-50 dark:bg-zinc-950/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 shrink-0 min-w-[280px]">
              <div className="text-center">
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">PPG</p>
                <p className="text-base font-display font-black text-brand-navy dark:text-brand-orange mt-0.5">{athleteStats.ppg}</p>
              </div>
              <div className="text-center border-l border-zinc-200 dark:border-zinc-800">
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">RPG</p>
                <p className="text-base font-display font-black text-zinc-900 dark:text-white mt-0.5">{athleteStats.rpg}</p>
              </div>
              <div className="text-center border-l border-zinc-200 dark:border-zinc-800">
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">APG</p>
                <p className="text-base font-display font-black text-zinc-900 dark:text-white mt-0.5">{athleteStats.apg}</p>
              </div>
              <div className="text-center border-l border-zinc-200 dark:border-zinc-800">
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">GAME</p>
                <p className="text-base font-display font-black text-zinc-900 dark:text-white mt-0.5">
                  {new Set(athleteClips.map(c => c.matchTitle)).size}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Video Player & Clip Playlist Workspace */}
        {athleteClips.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Responsive Video Player + court */}
            <div className="lg:col-span-7 space-y-4">
              <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl group text-left">
                {activeClip && (
                  <YouTube
                    videoId={activeClip.youtubeId}
                    opts={{
                      width: '100%',
                      height: '100%',
                      playerVars: {
                        autoplay: 1,
                        controls: 1,
                        rel: 0,
                        modestbranding: 1,
                        enablejsapi: 1,
                      },
                    }}
                    onReady={(event) => setAthletePlayer(event.target)}
                    className="w-full h-full aspect-video"
                  />
                )}
              </div>

              {/* Video and analyze controls */}
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl space-y-3 shadow-lg text-left">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-wider mr-2">Kecepatan Analisis:</span>
                    {[0.5, 0.75, 1, 1.25].map(rate => (
                      <button
                        key={rate}
                        onClick={() => handleAthleteSpeedChange(rate)}
                        className={`px-3 py-1 text-xs font-black rounded-lg transition-all cursor-pointer ${
                          athletePlaybackRate === rate
                            ? 'bg-brand-orange text-zinc-950 shadow-sm'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        {rate === 1 ? 'MURNI (1x)' : `${rate}x`}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (athletePlayer) {
                          const curr = athletePlayer.getCurrentTime();
                          athletePlayer.seekTo(Math.max(0, curr - 3), true);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer uppercase tracking-wider"
                    >
                      <RotateCcw size={10} /> -3s
                    </button>
                    <button
                      onClick={() => {
                        if (athletePlayer) {
                          const curr = athletePlayer.getCurrentTime();
                          athletePlayer.seekTo(curr + 3, true);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer uppercase tracking-wider"
                    >
                      +3s <Play size={10} />
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-900">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-brand-orange/10 text-brand-orange font-black text-[9px] uppercase rounded border border-brand-orange/20 tracking-wider">
                      {activeClip?.type}
                    </span>
                    <span className="text-zinc-500 font-mono text-[10px]">
                      Q{activeClip?.quarter} • {activeClip?.gameClock}
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-xs mt-1.5 leading-normal">
                    {activeClip?.description}
                  </h4>
                  <p className="text-[10px] text-zinc-500 mt-1 font-semibold uppercase tracking-wider">
                    Sumber: {activeClip?.matchTitle} ({activeClip?.date})
                  </p>
                </div>
              </div>

              {/* Court Coordinate Visualization */}
              {renderMiniCourt(activeClip)}
            </div>

            {/* Right Column: Playlist of Clips */}
            <div className="lg:col-span-5 space-y-4 text-left">
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-[2rem] shadow-xl text-left">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
                  <div className="flex items-center gap-1.5 text-zinc-300 font-bold text-xs uppercase tracking-wider">
                    <Clapperboard size={14} className="text-brand-orange" />
                    <span>Daftar Putar Kejadian ({athleteClips.length} Aksi)</span>
                  </div>
                </div>

                <div className="mt-3 space-y-2 max-h-[550px] overflow-y-auto pr-1">
                  {athleteClips.map((clip, index) => {
                    const isActive = clip.id === activeAthleteClipId;
                    
                    return (
                      <button
                        key={clip.id}
                        onClick={() => handleAthleteClipClick(clip)}
                        className={`w-full p-3.5 rounded-2xl border text-left flex gap-3 transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-brand-orange/10 border-brand-orange/40 shadow-md shadow-brand-orange/5' 
                            : 'bg-zinc-900/50 border-zinc-900 hover:border-zinc-800'
                        }`}
                      >
                        <div className="pt-0.5">
                          <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${
                            isActive ? 'bg-brand-orange text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {isActive ? <Play size={12} fill="currentColor" /> : <PlayCircle size={14} />}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              clip.typeCategory === 'shot_make' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              clip.typeCategory === 'shot_miss' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                              clip.typeCategory === 'assist' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                              clip.typeCategory === 'steal' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              clip.typeCategory === 'turnover' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' :
                              'bg-zinc-800 text-zinc-400'
                            }`}>
                              {clip.type}
                            </span>
                            
                            <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                              Q{clip.quarter} • {clip.gameClock}
                            </span>
                          </div>

                          <p className="text-[11px] text-white mt-1.5 font-bold leading-snug line-clamp-2">
                            {clip.description}
                          </p>

                          <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-500">
                            <span className="truncate max-w-[140px] font-semibold">
                              {clip.matchTitle.replace('Kejuaraan Nasional U-18:', 'KEJURNAS:').replace('Final DBL Academy Surabaya:', 'DBL Surabaya:')}
                            </span>
                            <span className="font-mono">
                              {index + 1}/{athleteClips.length}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 p-12 rounded-[2rem] shadow-sm text-center">
            <Film size={40} className="text-zinc-300 dark:text-zinc-600 mx-auto" />
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-300 mt-3">Tidak Ada Klip Sorotan</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Pemain yang Anda pilih belum memiliki rekaman video highlight yang dimoderasi.
            </p>
          </div>
        )}
      </div>
    );
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (youtubePlayer) {
      youtubePlayer.setPlaybackRate(rate);
    }
  };

  const handleEventClick = (event: SynergyEvent) => {
    setActiveEventId(event.id);
    if (youtubePlayer) {
      // Seek to time (rewind by 2s so you see the buildup, which is exactly how scouts do it!)
      const seekTime = Math.max(0, event.youtubeTimestamp - 2);
      youtubePlayer.seekTo(seekTime, true);
      youtubePlayer.playVideo();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 pb-24 transition-colors font-sans"
    >
      <header className="sticky top-0 z-30 flex justify-between items-center p-4 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 md:hidden">
        <div className="flex items-center gap-2">
          <div className="text-brand-navy dark:text-brand-orange">
            <Users size={24} strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-display font-bold text-brand-navy dark:text-white uppercase tracking-wide">
            Galeri Talenta
          </h1>
        </div>
        

      </header>

      <main className="p-4 mt-2 space-y-4 max-w-none">
        {/* Tab Switcher & Desktop Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/80">
          <div className="flex flex-1 p-0.5 gap-1 bg-white/40 dark:bg-black/20 rounded-xl">
            <button
              onClick={() => setGalleryTab('synergy')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                galleryTab === 'synergy'
                  ? 'bg-white dark:bg-zinc-800 text-brand-navy dark:text-brand-orange shadow-sm font-black'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <Youtube size={16} /> Synergy Video
            </button>
            <button
              onClick={() => setGalleryTab('athlete-clips')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                galleryTab === 'athlete-clips'
                  ? 'bg-white dark:bg-zinc-800 text-brand-navy dark:text-brand-orange shadow-sm font-black'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <Film size={16} /> Galeri Atlet
            </button>
            <button
              onClick={() => setGalleryTab('talents')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                galleryTab === 'talents'
                  ? 'bg-white dark:bg-zinc-800 text-brand-navy dark:text-brand-orange shadow-sm font-black'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <Users size={16} /> Talenta Publik
            </button>

          </div>


        </div>

        {galleryTab === 'synergy' ? (
          renderSynergyTab()
        ) : galleryTab === 'athlete-clips' ? (
          renderAthleteClipsTab()
        ) : galleryTab === 'talents' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start text-left">
            {/* Desktop Filter Rail (Left) */}
            <aside className="hidden lg:block lg:col-span-3 sticky top-24 space-y-5 bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <Filter size={16} className="text-brand-navy dark:text-brand-orange" />
                <h3 className="text-xs font-black uppercase text-[#1A1A1A] dark:text-white tracking-wider">Filter Talenta</h3>
              </div>
              
              {/* Search input */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nama Pemain</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Cari nama..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-[#1A1A1A] dark:text-white border border-zinc-100 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 hover:text-zinc-650"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Age Group */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Kelompok Umur</label>
                <select
                  value={selectedAgeGroup}
                  onChange={(e) => setSelectedAgeGroup(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-750 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all appearance-none cursor-pointer"
                >
                  <option value="All">Semua Umur</option>
                  {uniqueAgeGroups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>

              {/* Position */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Posisi Bermain</label>
                <select
                  value={selectedPosition}
                  onChange={(e) => setSelectedPosition(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-750 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all appearance-none cursor-pointer"
                >
                  <option value="All">Semua Posisi</option>
                  {uniquePositions.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>

              {/* Grade */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Level Kompetisi</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-750 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all appearance-none cursor-pointer"
                >
                  <option value="All">Semua Level</option>
                  {uniqueGrades.map(grade => (
                    <option key={grade} value={grade}>{COMPETITION_GRADE_LABELS[grade] || grade}</option>
                  ))}
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="w-full py-2 bg-red-55 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-500 font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <X size={12} /> Hapus Semua Filter
                </button>
              )}
            </aside>

            {/* Right Panel / Main Grid (Desktop & Mobile list) */}
            <div className="lg:col-span-9 space-y-4">
              {/* Info Banner */}
              <div className="bg-brand-navy/5 dark:bg-brand-orange/5 border border-brand-navy/10 dark:border-brand-orange/15 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="text-brand-navy dark:text-brand-orange mt-0.5 shrink-0">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#1A1A1A] dark:text-white leading-normal">
                    Platform Discovery HoopStats
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-normal">
                    Selamat datang di pusat pemantauan bakat! Di bawah ini adalah statistik dasar pemain muda potensial yang telah disetujui orang tua mereka untuk ditampilkan secara publik kepada scout dan pelatih. Informasi kontak dan detail pribadi dijaga kerahasiaannya untuk melindungi privasi anak-anak.
                  </p>
                </div>
              </div>

              {/* Mobile Filter Row (only visible on mobile) */}
              <div className="lg:hidden bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-3">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-400">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="Cari nama pemain..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-950 text-sm font-bold text-[#1A1A1A] dark:text-white border border-zinc-100 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400">
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={selectedAgeGroup}
                    onChange={(e) => setSelectedAgeGroup(e.target.value)}
                    className="px-2 py-2 bg-zinc-50 dark:bg-zinc-950 text-[11px] font-bold text-zinc-750 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800 rounded-xl"
                  >
                    <option value="All">Umur</option>
                    {uniqueAgeGroups.map(group => <option key={group} value={group}>{group}</option>)}
                  </select>

                  <select
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(e.target.value)}
                    className="px-2 py-2 bg-zinc-50 dark:bg-zinc-950 text-[11px] font-bold text-zinc-750 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800 rounded-xl"
                  >
                    <option value="All">Posisi</option>
                    {uniquePositions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                  </select>

                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="px-2 py-2 bg-zinc-50 dark:bg-zinc-950 text-[11px] font-bold text-zinc-750 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-800 rounded-xl"
                  >
                    <option value="All">Level</option>
                    {uniqueGrades.map(grade => <option key={grade} value={grade}>{COMPETITION_GRADE_LABELS[grade] || grade}</option>)}
                  </select>
                </div>

                {hasActiveFilters && (
                  <div className="flex justify-end pt-1">
                    <button onClick={resetFilters} className="text-xs font-bold text-red-500 hover:text-red-650 flex items-center gap-1 bg-red-50 dark:bg-red-950/20 px-3 py-1 rounded-full cursor-pointer">
                      <X size={12} /> Hapus Filter
                    </button>
                  </div>
                )}
              </div>

              {/* Gallery Grid/Content */}
              {loading ? (
                <GallerySkeleton />
              ) : filteredProfiles.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center py-16 shadow-sm">
                  <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-950 text-zinc-300 dark:text-zinc-700 rounded-full flex items-center justify-center mb-4 border border-zinc-100 dark:border-zinc-800">
                    <Users size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-750 dark:text-zinc-200">
                    {hasActiveFilters ? 'Tidak Ada Hasil' : 'Tidak Ada Pemain Ditemukan'}
                  </h3>
                  <p className="text-xs text-zinc-450 max-w-sm mt-1 leading-normal">
                    {hasActiveFilters 
                      ? 'Tidak ada pemain yang sesuai dengan filter pencarian Anda saat ini.' 
                      : 'Belum ada pemain dengan profil publik yang tersedia di galeri talenta.'}
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="mt-6 px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white rounded-xl text-xs font-bold uppercase cursor-pointer"
                    >
                      RESET FILTER
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {filteredProfiles.map(profile => {
                    const stats = playerStatsMap[profile.id] || {
                      ppg: 0,
                      rpg: 0,
                      apg: 0,
                      gamesPlayed: 0,
                      isVerified: false,
                      position: 'N/A',
                      ageGroup: 'N/A',
                      hasPlayedUp: false,
                      highestCompetitionGrade: null as string | null
                    };

                    return (
                      <div
                        key={profile.id}
                        id={`player-card-${profile.id}`}
                        onClick={() => navigate(`/gallery/${profile.id}`)}
                        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden cursor-pointer hover:border-brand-navy/20 dark:hover:border-brand-orange/30 hover:shadow-md transition-all flex flex-col h-full animate-in fade-in zoom-in-95 duration-150"
                      >
                        {/* Photo Section with badges overlaid */}
                        <div className="relative aspect-square w-full bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center border-b border-zinc-100 dark:border-zinc-800 overflow-hidden shrink-0">
                          <Avatar name={profile.name} photoUrl={profile.photoUrl || profile.avatar} size="full" className="rounded-none" />
                          
                          {/* Top-left: KU badge */}
                          <span className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">
                            {stats.ageGroup}
                          </span>

                          {/* Top-right: Verified badge */}
                          {stats.isVerified && (
                            <div
                              id="verified-badge"
                              className="absolute top-2.5 right-2.5 flex items-center gap-0.5 bg-green-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black shadow-sm shrink-0"
                              title="Terverifikasi oleh Statistician HoopStats"
                            >
                              <ShieldCheck size={9} strokeWidth={3} />
                              VERIFIED
                            </div>
                          )}

                          {/* Bottom overlay: Playing Up and Position badges */}
                          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                            {stats.hasPlayedUp && (
                              <span className="bg-amber-500 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm">
                                Playing UP
                              </span>
                            )}
                            <span className="bg-brand-navy text-brand-orange dark:bg-brand-orange dark:text-brand-navy text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm">
                              {stats.position}
                            </span>
                          </div>
                        </div>

                        {/* Info Section */}
                        <div className="p-3.5 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="font-display font-bold text-sm text-[#1A1A1A] dark:text-white leading-tight line-clamp-1">
                              {profile.name}
                            </h3>
                            
                            {stats.highestCompetitionGrade && (
                              <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-1 uppercase tracking-wide">
                                Level: {COMPETITION_GRADE_LABELS[stats.highestCompetitionGrade as CompetitionGrade] || stats.highestCompetitionGrade}
                              </p>
                            )}
                          </div>

                          {/* Stats bar */}
                          <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                            <div className="grid grid-cols-3 gap-1 bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800 text-center">
                              <div>
                                <span className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wider">PPG</span>
                                <span className="font-display font-black text-xs text-brand-navy dark:text-brand-orange">{stats.ppg}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wider">RPG</span>
                                <span className="font-display font-black text-xs text-[#1A1A1A] dark:text-white">{stats.rpg}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] font-bold text-zinc-400 uppercase tracking-wider">APG</span>
                                <span className="font-display font-black text-xs text-[#1A1A1A] dark:text-white">{stats.apg}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between mt-2.5 text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                              <span>{stats.gamesPlayed} GAMES</span>
                              <span className="text-brand-navy dark:text-brand-orange flex items-center gap-0.5">
                                Profil <TrendingUp size={10} />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>

      {/* Link Video YouTube Modal */}
      {isLinkVideoModalOpen && selectedMatchToLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 text-left text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Tautkan Link Rekaman Video</h3>
              <button 
                onClick={() => {
                  setIsLinkVideoModalOpen(false);
                  setSelectedMatchToLink(null);
                  setYoutubeUrlToLink('');
                }}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-zinc-400 uppercase font-bold">Nama Pertandingan</span>
              <p className="text-xs font-black text-brand-orange uppercase">
                {selectedMatchToLink.name || `${selectedMatchToLink.ourTeamName} vs ${selectedMatchToLink.theirTeamName}`}
              </p>
              <p className="text-[10px] text-zinc-500 font-mono">Tanggal: {selectedMatchToLink.date}</p>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase text-zinc-400 tracking-wider">URL Rekaman YouTube</label>
              <input
                type="text"
                value={youtubeUrlToLink}
                onChange={(e) => setYoutubeUrlToLink(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-brand-orange rounded-xl p-3 text-xs text-white focus:outline-none font-mono"
              />
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Masukkan tautan YouTube murni (misal: watch?v= atau share link). Sistem akan mendeteksi dan mengekstrak ID video secara otomatis untuk memetakan statistik possession.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setIsLinkVideoModalOpen(false);
                  setSelectedMatchToLink(null);
                  setYoutubeUrlToLink('');
                }}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                Batal
              </button>
              <button
                onClick={() => handleLinkVideo(selectedMatchToLink.id, youtubeUrlToLink)}
                className="flex-1 py-2 bg-brand-orange hover:bg-brand-orange/90 text-zinc-950 font-black text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                Tautkan Video
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

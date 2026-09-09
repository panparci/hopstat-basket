import React, { useState, useEffect, useMemo } from 'react';
import { X, User, Users, Globe, ChevronLeft, Wand2, Copy, AlertCircle, Info, FastForward, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { statsService } from '../../core/services/statsService';
import { generateId } from '../../core/utils/idUtils';
import { calculateAgeCategory } from '../../core/utils/ageCalculator';
import { DIVISIONS, getDivisionForAthlete, getDivision, mapLegacyToDivisionCode, formatDivision } from '../../entities/division/model/divisions';
import { OrganizationSelector } from '../../entities/organization/ui/OrganizationSelector';
import { organizationRepo } from '../../entities/organization/model/organizationRepo';
import { teamRepo } from '../../entities/team/model/teamRepo';
import { Match, RecordingType, Team, ChildProfile, Player, MatchRoster } from '../../core/types/stats';
import { CompetitionGrade, COMPETITION_GRADE_LABELS } from '../../core/config/competition';
import { ColorPicker } from '../molecules/ColorPicker';
import { AITeamSetupModal } from './AITeamSetupModal';
import { BaseModal } from '../atoms/BaseModal';
import { useToast } from '../../core/contexts/ToastContext';
import { authService } from '../../services/authService';
import { canManage } from '../../entities/athlete/lib/athleteAccess';

type GameMode = RecordingType | null;

interface GameSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isAdmin?: boolean;
}

export const GameSetupModal: React.FC<GameSetupModalProps> = ({ isOpen, onClose, onSuccess, isAdmin = false }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  // Step & Path State
  const [step, setStep] = useState(1);
  const [setupPath, setSetupPath] = useState<'quick' | 'full' | null>(null);
  const [mode, setMode] = useState<GameMode>(null);

  // Data States
  const [savedTeams, setSavedTeams] = useState<Team[]>([]);
  const [seriesList, setSeriesList] = useState<{id: string, name: string}[]>([]);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [recentMatch, setRecentMatch] = useState<Match | null>(null);

  // Form States - Team & Profile
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [opponent, setOpponent] = useState('');
  const [selectedOurTeamId, setSelectedOurTeamId] = useState('');
  const [selectedTheirTeamId, setSelectedTheirTeamId] = useState('');

  // Organization States
  const [ourOrgId, setOurOrgId] = useState('');
  const [ourOrgName, setOurOrgName] = useState('');
  const [theirOrgId, setTheirOrgId] = useState('');
  const [theirOrgName, setTheirOrgName] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const handleNextStepFromTeamSetup = async () => {
    if (!selectedProfileId || !ourOrgId || !theirOrgId) return;
    await checkAndResolveTeams();
  };

  const checkAndResolveTeams = async (useOurTeamId?: string, useTheirTeamId?: string) => {
    let resolvedOurTeamId = useOurTeamId;
    let resolvedTheirTeamId = useTheirTeamId;

    if (!resolvedOurTeamId) {
      const existing = await teamRepo.findCanonical(ourOrgId, selectedDivisionCode);
      if (existing) {
        const formattedDate = existing.createdAt ? new Date(existing.createdAt).toLocaleDateString('id-ID') : 'baru-baru ini';
        const playerCount = existing.roster ? existing.roster.length : 0;
        setConfirmModal({
          title: `Tim Kita Sudah Ada`,
          message: `Tim '${existing.name}' sudah ada (dibuat ${formattedDate}, ${playerCount} pemain terdaftar). Pakai tim ini?`,
          onConfirm: () => {
            setConfirmModal(null);
            setSelectedOurTeamId(existing.id);
            checkAndResolveTeams(existing.id, resolvedTheirTeamId);
          },
          onCancel: () => {
            setConfirmModal(null);
          }
        });
        return;
      } else {
        // Create new canonical team
        const newTeam = await teamRepo.create({
          organizationId: ourOrgId,
          divisionCode: selectedDivisionCode,
          name: '', // derived
          roster: [],
          status: 'active'
        });
        setSelectedOurTeamId(newTeam.id);
        resolvedOurTeamId = newTeam.id;
        // Refresh saved teams
        const teams = await statsService.getTeams();
        setSavedTeams(teams);
      }
    }

    if (!resolvedTheirTeamId) {
      const existing = await teamRepo.findCanonical(theirOrgId, selectedDivisionCode);
      if (existing) {
        const formattedDate = existing.createdAt ? new Date(existing.createdAt).toLocaleDateString('id-ID') : 'baru-baru ini';
        const playerCount = existing.roster ? existing.roster.length : 0;
        setConfirmModal({
          title: `Tim Lawan Sudah Ada`,
          message: `Tim '${existing.name}' sudah ada (dibuat ${formattedDate}, ${playerCount} pemain terdaftar). Pakai tim ini?`,
          onConfirm: () => {
            setConfirmModal(null);
            setSelectedTheirTeamId(existing.id);
            setOpponent(existing.name);
            checkAndResolveTeams(resolvedOurTeamId, existing.id);
          },
          onCancel: () => {
            setConfirmModal(null);
          }
        });
        return;
      } else {
        // Create new canonical team
        const newTeam = await teamRepo.create({
          organizationId: theirOrgId,
          divisionCode: selectedDivisionCode,
          name: '', // derived
          roster: [],
          status: 'active'
        });
        setSelectedTheirTeamId(newTeam.id);
        setOpponent(newTeam.name);
        resolvedTheirTeamId = newTeam.id;
        // Refresh saved teams
        const teams = await statsService.getTeams();
        setSavedTeams(teams);
      }
    }

    // Both resolved! Proceed to Step 3
    setStep(3);
  };

  // Form States - Colors
  const [ourColor, setOurColor] = useState('#1e3a8a');
  const [ourTheme, setOurTheme] = useState<'gelap'|'terang'>('gelap');
  const [ourColorName, setOurColorName] = useState('Navy');
  const [isEditingOurMaster, setIsEditingOurMaster] = useState(false);

  const [theirColor, setTheirColor] = useState('#dc2626');
  const [theirTheme, setTheirTheme] = useState<'gelap'|'terang'>('gelap');
  const [theirColorName, setTheirColorName] = useState('Merah');
  const [isEditingTheirMaster, setIsEditingTheirMaster] = useState(false);

  // Form States - Match Details
  const [selectedSeriesId, setSelectedSeriesId] = useState('adhoc');
  const [eventName, setEventName] = useState('');
  const [location, setLocation] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [matchKU, setMatchKU] = useState<number | undefined>(undefined);
  const [selectedDivisionCode, setSelectedDivisionCode] = useState<string>('');
  const [isKUManuallyOverridden, setIsKUManuallyOverridden] = useState(false);
  const [competitionGrade, setCompetitionGrade] = useState<CompetitionGrade>(CompetitionGrade.LOCAL_FRIENDLY);
  const [ourHomeAway, setOurHomeAway] = useState<'home'|'away'>('home');
  const [matchLevel, setMatchLevel] = useState<'club'|'academy'|'school'|'mixed'>('club');
  const [isOfficiated, setIsOfficiated] = useState<boolean>(false);

  useEffect(() => {
    if (ourOrgId) {
      organizationRepo.getById(ourOrgId).then((org) => {
        if (org && org.type) {
          if (org.type === 'school' || org.type === 'academy' || org.type === 'club') {
            setMatchLevel(org.type);
          }
        }
      });
    }
  }, [ourOrgId]);
  
  const [periodCount, setPeriodCount] = useState<number>(4);
  const [durationPerPeriod, setDurationPerPeriod] = useState<number>(10);
  const [clockMode, setClockMode] = useState<'stop'|'running'>('running');

  // AI Context Layer
  const [matchContext, setMatchContext] = useState<any>({
    format: 'single',
    stage: 'group',
    importance: 'medium',
    purpose: 'competitive',
    opponentLevel: 'unknown'
  });

  // Modals & Extra State
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [customOpponentRoster, setCustomOpponentRoster] = useState<Player[] | null>(null);

  useEffect(() => {
    if (isOpen) {
      setVideoUrl('');
      const loadData = async () => {
        const teams = await statsService.getTeams();
        setSavedTeams(teams);
        
        const series = await statsService.getSeriesAll();
        setSeriesList(series.map(s => ({ id: s.id, name: s.name })));
        
        const p = await statsService.getProfiles();
        let filteredProfiles = p;
        if (!isAdmin) {
          const currentUser = await authService.getCurrentUser();
          if (currentUser) {
            if (currentUser.role !== 'admin') {
              filteredProfiles = p.filter(profile => canManage(profile, currentUser.id) || !profile.claimStatus || profile.claimStatus === 'unclaimed');
            }
          } else {
            filteredProfiles = [];
          }
        }
        
        setProfiles(filteredProfiles);
        if (filteredProfiles.length > 0 && !selectedProfileId) {
            setSelectedProfileId(filteredProfiles[0].id);
        }
        
        const allMatches = await statsService.getMatches();
        if (allMatches.length > 0) {
          const sorted = [...allMatches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setRecentMatch(sorted[0]);
        }
      };
      loadData();
    }
  }, [isOpen, selectedProfileId, isAdmin]);

  useEffect(() => {
    if (!isKUManuallyOverridden && selectedProfileId && profiles.length > 0) {
      const p = profiles.find(prof => prof.id === selectedProfileId);
      if (p?.birthDate) {
        const matchYear = new Date().getFullYear();
        const calculated = calculateAgeCategory(p.birthDate, matchYear);
        if (calculated !== undefined) {
          setMatchKU(calculated);
          const divCode = getDivisionForAthlete(p.birthDate, p.gender || 'M', matchYear);
          if (divCode) {
            setSelectedDivisionCode(divCode);
          }
        } else {
          setMatchKU(undefined);
          setSelectedDivisionCode('');
        }
      } else {
        setMatchKU(undefined);
        setSelectedDivisionCode('');
      }
    }
  }, [selectedProfileId, profiles, isKUManuallyOverridden]);

  const handleProfileChange = (profileId: string) => {
    setSelectedProfileId(profileId);
    const selectedProfile = profiles.find(p => p.id === profileId);
    if (selectedProfile && (selectedProfile.mainTeamId || selectedProfile.teamId)) {
      const activeTeamId = selectedProfile.mainTeamId || selectedProfile.teamId;
      if (activeTeamId) {
        setSelectedOurTeamId(activeTeamId);
      const t = savedTeams.find(team => team.id === activeTeamId);
      if (t) {
        if (t.lightJersey) {
          setOurColor(t.lightJersey.color);
          setOurTheme(t.lightJersey.theme);
          setOurColorName(t.lightJersey.name);
        } else if (t.defaultColor) {
          setOurColor(t.defaultColor);
          setOurTheme(t.defaultTheme || 'terang');
          setOurColorName(t.defaultTheme === 'gelap' ? 'Gelap' : 'Terang');
        }
      }
      }
    }
  };

  const handleTheirTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const teamId = e.target.value;
    setSelectedTheirTeamId(teamId);
    if (teamId) {
      const t = savedTeams.find(t => t.id === teamId);
      if (t) {
        setOpponent(t.name);
        if (t.darkJersey) {
          setTheirColor(t.darkJersey.color);
          setTheirTheme(t.darkJersey.theme);
          setTheirColorName(t.darkJersey.name);
        } else if (t.defaultColor) {
          setTheirColor(t.defaultColor);
          setTheirTheme(t.defaultTheme || 'gelap');
          setTheirColorName(t.defaultTheme === 'gelap' ? 'Gelap' : 'Terang');
        }
      }
    } else {
      setOpponent('');
    }
  };

  const handleDuplicate = () => {
    if (!recentMatch) return;
    setMode(recentMatch.recordingType);
    setSelectedProfileId(recentMatch.childId);
    setOpponent(recentMatch.theirTeamName || '');
    setSelectedSeriesId(recentMatch.seriesId || 'adhoc');
    setEventName(recentMatch.eventName || '');
    setLocation(recentMatch.venue || '');
    setAgeGroup(recentMatch.ageGroup || '');
    if (recentMatch.competitionGrade) {
      setCompetitionGrade(recentMatch.competitionGrade);
    }
    if (recentMatch.divisionCode) {
      setSelectedDivisionCode(recentMatch.divisionCode);
      const div = getDivision(recentMatch.divisionCode);
      if (div) {
        setMatchKU(div.ageCategory);
      }
      setIsKUManuallyOverridden(true);
    } else if (recentMatch.ageGroup) {
      const athlete = profiles.find(prof => prof.id === recentMatch.childId);
      const mappedCode = mapLegacyToDivisionCode(recentMatch.ageGroup, athlete?.gender);
      if (mappedCode) {
        setSelectedDivisionCode(mappedCode);
        const div = getDivision(mappedCode);
        if (div) {
          setMatchKU(div.ageCategory);
        }
        setIsKUManuallyOverridden(true);
      } else if (recentMatch.ageCategory !== undefined) {
        setMatchKU(recentMatch.ageCategory);
        setIsKUManuallyOverridden(true);
      } else if (recentMatch.matchKU !== undefined) {
        setMatchKU(recentMatch.matchKU);
        setIsKUManuallyOverridden(true);
      }
    } else if (recentMatch.ageCategory !== undefined) {
      setMatchKU(recentMatch.ageCategory);
      setIsKUManuallyOverridden(true);
    } else if (recentMatch.matchKU !== undefined) {
      setMatchKU(recentMatch.matchKU);
      setIsKUManuallyOverridden(true);
    }
    setOurHomeAway(recentMatch.ourHomeAway || 'home');
    
    setPeriodCount(recentMatch.periodCount || 4);
    setDurationPerPeriod(recentMatch.durationPerPeriod || 10);
    setClockMode(recentMatch.clockMode || 'running');
    
    if (recentMatch.matchContext) {
      setMatchContext(recentMatch.matchContext);
    }
    
    setSetupPath('full');
    setStep(2);
  };

  const handleStartTracking = async (status: 'planned' | 'ongoing') => {
    if (!mode) return;

    const matchId = generateId('m');

    const newMatch: Match = {
      id: matchId,
      childId: selectedProfileId,
      seriesId: selectedSeriesId === 'adhoc' ? undefined : selectedSeriesId,
      name: `vs ${opponent}`,
      date: new Date().toISOString(),
      status: status,
      recordingType: mode,
      
      teamId: selectedOurTeamId || generateId('t'),
      opponentTeamId: selectedTheirTeamId || generateId('t'),
      ageGroup: selectedDivisionCode ? (getDivision(selectedDivisionCode)?.label || ageGroup) : (matchKU ? `KU-${matchKU}` : ageGroup),
      matchKU: selectedDivisionCode ? (getDivision(selectedDivisionCode)?.ageCategory || matchKU) : matchKU,
      ageCategory: selectedDivisionCode ? (getDivision(selectedDivisionCode)?.ageCategory || matchKU) : matchKU,
      divisionCode: selectedDivisionCode,
      competitionGrade: competitionGrade,
      gameType: '5v5',
      periodCount,
      clockMode,
      stopClockOnMadeBasket: 'fiba',
      durationPerPeriod,
      venue: location,
      eventName: eventName,
      videoUrl: videoUrl || undefined,
      
      ourTeamName: selectedOurTeamId ? (savedTeams.find(t => t.id === selectedOurTeamId)?.name || 'Tim Kita') : 'Tim Kita',
      theirTeamName: opponent,
      ourHomeAway,
      
      ourColor,
      theirColor,
      ourTheme,
      theirTheme,
      ourColorName,
      theirColorName,
      
      type: selectedSeriesId === 'adhoc' ? 'single' : 'series',
      matchContext: matchContext as any,
      matchLevel,
      isOfficiated
    };

    await statsService.addMatch(newMatch);

    if (selectedOurTeamId) {
      const team = savedTeams.find(t => t.id === selectedOurTeamId);
      if (team && team.roster) {
        for (const p of team.roster) {
          await statsService.addMatchRoster({
            id: generateId('mr'),
            matchId,
            teamId: newMatch.teamId,
            profileId: p.id,
            name: p.name,
            jerseyNumber: p.jersey || '',
            isStarter: false,
            isActive: true
          });
        }
      }
    } else {
      const p = profiles.find(prof => prof.id === selectedProfileId);
      if (p) {
        await statsService.addMatchRoster({
          id: generateId('mr'),
          matchId,
          teamId: newMatch.teamId,
          profileId: p.id,
          name: p.name,
          jerseyNumber: p.jerseyNumber?.toString() || '0',
          isStarter: false,
          isActive: true
        });
      }
    }

    if (customOpponentRoster) {
      for (const p of customOpponentRoster) {
        await statsService.addMatchRoster({
          id: generateId('mr'),
          matchId,
          teamId: newMatch.opponentTeamId,
          profileId: p.id,
          name: p.name,
          jerseyNumber: p.jersey || '',
          isStarter: false,
          isActive: true
        });
      }
    } else if (selectedTheirTeamId) {
      const team = savedTeams.find(t => t.id === selectedTheirTeamId);
      if (team && team.roster) {
        for (const p of team.roster) {
          await statsService.addMatchRoster({
            id: generateId('mr'),
            matchId,
            teamId: newMatch.opponentTeamId,
            profileId: p.id,
            name: p.name,
            jerseyNumber: p.jersey || '',
            isStarter: false,
            isActive: true
          });
        }
      }
    }

    if (status === 'ongoing') {
      showToast('Game dibuat! Selamat merekam pertandingan pertama Anda.', 'success');
      navigate(`/track/${newMatch.id}`);
    } else {
      showToast('Pertandingan telah direncanakan.', 'success');
      onSuccess?.();
    }
    onClose();
  };

  const getStepTitle = () => {
    if (step === 1) return 'Mulai Baru';
    if (step === 2 && setupPath === 'quick') return 'Mulai Cepat';
    if (step === 2 && setupPath === 'full') return 'Setup Tim';
    if (step === 3 && setupPath === 'full') return 'Detail Match';
    if (step === 4 && setupPath === 'full') return 'AI Context Layer';
    if (step === 5 && setupPath === 'full') return 'Ringkasan';
    return '';
  };

  const maxSteps = setupPath === 'quick' ? 2 : 5;

  const renderStepIndicator = () => (
    <div className="flex gap-2 mb-8">
      {Array.from({ length: maxSteps }).map((_, i) => (
        <div 
          key={i} 
          className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${i + 1 === step ? 'bg-brand-navy dark:bg-brand-orange' : i + 1 < step ? 'bg-blue-200 dark:bg-yellow-900/40' : 'bg-zinc-100 dark:bg-zinc-800'}`}
        />
      ))}
    </div>
  );

  const headerActions = (
    <button onClick={onClose} className="p-2 -mr-2 text-zinc-400 hover:text-[#1A1A1A] dark:hover:text-white transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
      <X size={20} />
    </button>
  );

  const SummaryCard = () => (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-100 dark:border-zinc-800 space-y-4">
      <div className="flex items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="p-3 bg-brand-navy/10 dark:bg-brand-orange/10 rounded-xl text-brand-navy dark:text-brand-orange">
          {mode === 'single' ? <User size={24} /> : mode === 'team' ? <Users size={24} /> : <Globe size={24} />}
        </div>
        <div>
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Mode Tracking</div>
          <div className="font-black italic text-[#1A1A1A] dark:text-white uppercase">{mode === 'single' ? '1 Pemain' : mode === 'team' ? 'Tim Saya' : 'Full Match'}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">Tim Kita</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ourColor }}></div>
            <span className="text-sm font-bold text-[#1A1A1A] dark:text-white truncate">
              {profiles.find(p => p.id === selectedProfileId)?.name || '-'}
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">Lawan</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theirColor }}></div>
            <span className="text-sm font-bold text-[#1A1A1A] dark:text-white truncate">
              {opponent || '-'}
            </span>
          </div>
        </div>
      </div>
      
      {setupPath === 'full' && (
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-start gap-2">
          <Info size={16} className="text-brand-navy dark:text-brand-orange shrink-0 mt-0.5" />
          <div className="text-xs font-bold text-zinc-500 leading-relaxed">
            Format: {matchContext?.format}, {periodCount}x{durationPerPeriod}mnt ({clockMode === 'running' ? 'Kotor' : 'Bersih'}). {customOpponentRoster ? `${customOpponentRoster.length} roster lawan di-ekstrak.` : ''}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title={getStepTitle()}
        headerActions={headerActions}
        maxWidth="max-w-2xl"
      >
        <div className="my-auto">
          {step > 0 && renderStepIndicator()}
          
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-display font-black italic uppercase text-[#1A1A1A] dark:text-white leading-tight">
                  Pilih Mode <span className="text-brand-navy dark:text-brand-orange">Tracking</span>
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Tentukan seberapa detail statistik yang ingin Anda catat.</p>
              </div>

              {recentMatch && (
                <button 
                  onClick={handleDuplicate}
                  className="w-full mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-brand-navy/20 dark:border-brand-orange/20 rounded-2xl flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-navy/10 dark:bg-brand-orange/10 rounded-xl text-brand-navy dark:text-brand-orange">
                      <Copy size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-black italic uppercase text-brand-navy dark:text-brand-orange mb-0.5">Duplikasi Pertandingan Terakhir</div>
                      <div className="text-sm font-bold text-[#1A1A1A] dark:text-white">{recentMatch.name}</div>
                    </div>
                  </div>
                  <ChevronLeft className="rotate-180 text-brand-navy dark:text-brand-orange opacity-50 group-hover:opacity-100 transition-opacity" size={20} />
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <button 
                  onClick={() => setMode('single')} 
                  className={`group relative p-6 border-2 rounded-3xl text-left transition-all duration-300 ${
                    mode === 'single' 
                      ? 'border-brand-navy dark:border-brand-orange bg-blue-50/50 dark:bg-blue-900/20' 
                      : 'border-zinc-100 dark:border-zinc-800 hover:border-brand-navy/50 dark:hover:border-brand-orange/50'
                  }`}
                >
                  <div className={`w-12 h-12 mb-4 rounded-2xl flex items-center justify-center transition-all ${
                    mode === 'single' 
                      ? 'bg-brand-navy text-white dark:bg-brand-orange dark:text-brand-navy' 
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:bg-brand-navy/10 group-hover:text-brand-navy'
                  }`}>
                    <User size={24} />
                  </div>
                  <div className="font-black italic uppercase text-sm text-[#1A1A1A] dark:text-white mb-1">1 Pemain</div>
                  <div className="text-xs text-zinc-500 font-bold leading-relaxed">Fokus hanya pada statistik atlet Anda sendiri.</div>
                </button>
                
                <button 
                  onClick={() => setMode('team')} 
                  className={`group relative p-6 border-2 rounded-3xl text-left transition-all duration-300 ${
                    mode === 'team' 
                      ? 'border-brand-navy dark:border-brand-orange bg-blue-50/50 dark:bg-blue-900/20' 
                      : 'border-zinc-100 dark:border-zinc-800 hover:border-brand-navy/50 dark:hover:border-brand-orange/50'
                  }`}
                >
                  <div className={`w-12 h-12 mb-4 rounded-2xl flex items-center justify-center transition-all ${
                    mode === 'team' 
                      ? 'bg-brand-navy text-white dark:bg-brand-orange dark:text-brand-navy' 
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:bg-brand-navy/10 group-hover:text-brand-navy'
                  }`}>
                    <Users size={24} />
                  </div>
                  <div className="font-black italic uppercase text-sm text-[#1A1A1A] dark:text-white mb-1">Tim Saya</div>
                  <div className="text-xs text-zinc-500 font-bold leading-relaxed">Catat statistik untuk seluruh tim atlet Anda.</div>
                </button>

                <button 
                  onClick={() => setMode('full')} 
                  className={`group relative p-6 border-2 rounded-3xl text-left transition-all duration-300 ${
                    mode === 'full' 
                      ? 'border-brand-navy dark:border-brand-orange bg-blue-50/50 dark:bg-blue-900/20' 
                      : 'border-zinc-100 dark:border-zinc-800 hover:border-brand-navy/50 dark:hover:border-brand-orange/50'
                  }`}
                >
                  <div className={`w-12 h-12 mb-4 rounded-2xl flex items-center justify-center transition-all ${
                    mode === 'full' 
                      ? 'bg-brand-navy text-white dark:bg-brand-orange dark:text-brand-navy' 
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:bg-brand-navy/10 group-hover:text-brand-navy'
                  }`}>
                    <Globe size={24} />
                  </div>
                  <div className="font-black italic uppercase text-sm text-[#1A1A1A] dark:text-white mb-1">Full Match</div>
                  <div className="text-xs text-zinc-500 font-bold leading-relaxed">Catat statistik untuk kedua tim yang bertanding.</div>
                </button>
              </div>

              {mode && (
                <div className="flex flex-col sm:flex-row gap-3 mt-8 animate-in fade-in slide-in-from-bottom-2">
                  <button 
                    onClick={() => { setSetupPath('quick'); setStep(2); }}
                    className="flex-[3] py-4 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-2xl font-black italic uppercase tracking-wider hover:opacity-90 transition-all shadow-xl shadow-blue-900/20 dark:shadow-yellow-900/20 flex items-center justify-center gap-2"
                  >
                    MULAI CEPAT <FastForward size={18} />
                  </button>
                  <button 
                    onClick={() => { setSetupPath('full'); setStep(2); }}
                    className="flex-[2] py-4 bg-zinc-100 dark:bg-zinc-800 text-[#1A1A1A] dark:text-white rounded-2xl font-bold uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Settings size={18} /> SETUP LENGKAP
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && setupPath === 'quick' && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="mb-6">
                 <h2 className="text-2xl font-display font-black italic uppercase text-[#1A1A1A] dark:text-white leading-tight">
                   Info <span className="text-brand-navy dark:text-brand-orange">Dasar</span>
                 </h2>
                 <p className="text-sm text-zinc-500 mt-1">Lengkapi informasi wajib untuk segera memulai.</p>
               </div>

               <div className="space-y-4 mb-8">
                 <div className="space-y-1.5">
                   <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Profil Atlet (Wajib)</label>
                   {profiles.length > 0 ? (
                     <select 
                       value={selectedProfileId}
                       onChange={(e) => handleProfileChange(e.target.value)}
                       className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                     >
                       <option value="">-- Pilih Profil Atlet --</option>
                       {profiles.map(p => (
                         <option key={p.id} value={p.id}>{p.name}</option>
                       ))}
                     </select>
                   ) : (
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl text-sm flex items-center gap-2">
                        <AlertCircle size={16} /> Silakan buat profil atlet terlebih dahulu di menu Profil.
                      </div>
                   )}
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Lawan / Tim Musuh (Wajib)</label>
                   <input 
                     type="text"
                     value={opponent}
                     onChange={(e) => setOpponent(e.target.value)}
                     placeholder="Contoh: Garuda Bandung"
                     className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                   />
                 </div>

                 <div className="space-y-1.5">
                   <div className="flex justify-between items-center ml-1">
                     <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Kategori Umur (KU)</label>
                     {!isKUManuallyOverridden && matchKU !== undefined && (
                       <span className="text-[10px] font-bold text-brand-navy dark:text-brand-orange bg-blue-50 dark:bg-yellow-950/40 px-2 py-0.5 rounded-md">
                         Terhitung: KU-{matchKU}
                       </span>
                     )}
                   </div>
                   <select 
                     value={isKUManuallyOverridden && matchKU !== undefined ? matchKU : 'auto'}
                     onChange={(e) => {
                       const val = e.target.value;
                       if (val === 'auto') {
                         setIsKUManuallyOverridden(false);
                         const p = profiles.find(prof => prof.id === selectedProfileId);
                         if (p?.birthDate) {
                           const matchYear = new Date().getFullYear();
                           const calculated = calculateAgeCategory(p.birthDate, matchYear);
                           setMatchKU(calculated);
                         } else {
                           setMatchKU(undefined);
                         }
                       } else {
                         setMatchKU(Number(val));
                         setIsKUManuallyOverridden(true);
                       }
                     }}
                     className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                   >
                     <option value="auto">Otomatis (Ikuti Tahun Lahir Atlet)</option>
                     <option value={8}>KU-8</option>
                     <option value={10}>KU-10</option>
                     <option value={12}>KU-12</option>
                     <option value={14}>KU-14</option>
                     <option value={16}>KU-16</option>
                     <option value={18}>KU-18</option>
                   </select>
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Level Kompetisi</label>
                   <select 
                     value={competitionGrade}
                     onChange={(e) => setCompetitionGrade(e.target.value as CompetitionGrade)}
                     className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                   >
                     {Object.values(CompetitionGrade).map(grade => (
                       <option key={grade} value={grade}>{COMPETITION_GRADE_LABELS[grade]}</option>
                     ))}
                   </select>
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Link Video (YouTube) <span className="text-zinc-500 text-[10px] lowercase italic">(wajib jika meminta statting)</span></label>
                   <input 
                     type="text"
                     value={videoUrl}
                     onChange={(e) => setVideoUrl(e.target.value)}
                     placeholder="Contoh: https://www.youtube.com/watch?v=..."
                     className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                   />
                 </div>
               </div>

               <SummaryCard />

               <div className="flex gap-3 mt-8">
                 <button 
                   onClick={() => { setStep(1); setSetupPath(null); }}
                   className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-[#1A1A1A] dark:text-white rounded-2xl font-bold tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                 >
                   KEMBALI
                 </button>
                 <button 
                   disabled={!selectedProfileId || !opponent}
                   onClick={() => handleStartTracking('ongoing')}
                   className="flex-[2] py-4 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-2xl font-black italic uppercase tracking-wider hover:opacity-90 transition-all shadow-xl shadow-blue-900/20 dark:shadow-yellow-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   MULAI RECORD <Wand2 size={18} />
                 </button>
               </div>
               {(!selectedProfileId || !opponent) && (
                 <p className="text-center text-xs text-red-500 mt-3 font-bold">Lengkapi Profil Atlet dan Nama Lawan untuk memulai.</p>
               )}
             </div>
          )}

          {step === 2 && setupPath === 'full' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="mb-6">
                <h2 className="text-2xl font-display font-black italic uppercase text-[#1A1A1A] dark:text-white leading-tight">
                  Setup <span className="text-brand-navy dark:text-brand-orange">Tim & Jersey</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar pb-4">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Profil & Tim Kita (Wajib)</label>
                    {profiles.length > 0 && (
                      <select 
                        value={selectedProfileId}
                        onChange={(e) => handleProfileChange(e.target.value)}
                        className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all mb-2"
                      >
                        <option value="">-- Pilih Profil Atlet --</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}

                    <OrganizationSelector
                      label="Organisasi Tim Kita (Wajib)"
                      selectedOrgId={ourOrgId}
                      onChange={(id, name) => {
                        setOurOrgId(id);
                        setOurOrgName(name);
                      }}
                    />
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Warna Jersey Kita</label>
                      <button 
                        onClick={() => setIsEditingOurMaster(!isEditingOurMaster)}
                        className="text-xs font-bold text-brand-navy dark:text-brand-orange hover:underline"
                      >
                        {isEditingOurMaster ? 'Tutup' : 'Ubah'}
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl shadow-inner border border-zinc-200 dark:border-zinc-700" style={{ backgroundColor: ourColor }}></div>
                      <div>
                        <div className="font-bold text-[#1A1A1A] dark:text-white text-sm">{ourColorName || 'Custom'}</div>
                        <div className="text-xs text-zinc-500 capitalize">{ourTheme} Theme</div>
                      </div>
                    </div>

                    {isEditingOurMaster && (
                      <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <ColorPicker name={ourColorName} color={ourColor} 
                          onChange={(c) => { setOurColor(c); setOurColorName(''); }}
                          theme={ourTheme}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Lawan (Wajib)</label>
                    
                    <OrganizationSelector
                      label="Organisasi Tim Lawan (Wajib)"
                      selectedOrgId={theirOrgId}
                      onChange={(id, name) => {
                        setTheirOrgId(id);
                        setTheirOrgName(name);
                      }}
                    />
                    
                    {!selectedTheirTeamId && opponent && (
                      <button 
                        onClick={() => setIsAIModalOpen(true)}
                        className="w-full py-3 mt-2 bg-blue-50 dark:bg-blue-900/20 text-brand-navy dark:text-brand-orange rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        <Wand2 size={14} /> AI EXTRACTION ROSTER LAWAN
                      </button>
                    )}
                    {customOpponentRoster && !selectedTheirTeamId && (
                      <div className="text-[10px] text-green-600 dark:text-green-400 font-bold ml-1 mt-1 flex items-center gap-1">
                        ✓ {customOpponentRoster.length} pemain terekstrak
                      </div>
                    )}
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Warna Jersey Lawan</label>
                      <button 
                        onClick={() => setIsEditingTheirMaster(!isEditingTheirMaster)}
                        className="text-xs font-bold text-brand-navy dark:text-brand-orange hover:underline"
                      >
                        {isEditingTheirMaster ? 'Tutup' : 'Ubah'}
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl shadow-inner border border-zinc-200 dark:border-zinc-700" style={{ backgroundColor: theirColor }}></div>
                      <div>
                        <div className="font-bold text-[#1A1A1A] dark:text-white text-sm">{theirColorName || 'Custom'}</div>
                        <div className="text-xs text-zinc-500 capitalize">{theirTheme} Theme</div>
                      </div>
                    </div>

                    {isEditingTheirMaster && (
                      <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <ColorPicker name={theirColorName} color={theirColor} 
                          onChange={(c) => { setTheirColor(c); setTheirColorName(''); }}
                          theme={theirTheme}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => { setStep(1); setSetupPath(null); }}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-[#1A1A1A] dark:text-white rounded-2xl font-bold tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  KEMBALI
                </button>
                <button 
                  disabled={!selectedProfileId || !ourOrgId || !theirOrgId}
                  onClick={handleNextStepFromTeamSetup}
                  className="flex-[2] py-4 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-2xl font-black italic uppercase tracking-wider hover:opacity-90 transition-all shadow-xl shadow-blue-900/20 dark:shadow-yellow-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  LANJUT
                </button>
              </div>
              {(!selectedProfileId || !ourOrgId || !theirOrgId) && (
                <p className="text-center text-xs text-red-500 mt-3 font-bold">Profil Atlet, Organisasi Kita, dan Organisasi Lawan harus dipilih.</p>
              )}
            </div>
          )}

          {step === 3 && setupPath === 'full' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="mb-6">
                <h2 className="text-2xl font-display font-black italic uppercase text-[#1A1A1A] dark:text-white leading-tight">
                  Detail <span className="text-brand-navy dark:text-brand-orange">Pertandingan</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Series / Turnamen (Opsional)</label>
                  <select 
                    value={selectedSeriesId}
                    onChange={(e) => setSelectedSeriesId(e.target.value)}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  >
                    <option value="adhoc">Pertandingan Lepas (Tanpa Series)</option>
                    {seriesList.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Nama Event (Opsional)</label>
                  <input 
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Contoh: Final Kejurda U-14"
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Lokasi / Venue (Opsional)</label>
                  <input 
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Contoh: GOR C-Tra Arena"
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Kategori Umur (KU)</label>
                    {!isKUManuallyOverridden && selectedDivisionCode && (
                      <span className="text-[10px] font-bold text-brand-navy dark:text-brand-orange bg-blue-50 dark:bg-yellow-950/40 px-2 py-0.5 rounded-md">
                        Terhitung: {formatDivision(selectedDivisionCode)}
                      </span>
                    )}
                  </div>
                  <select 
                    value={isKUManuallyOverridden ? selectedDivisionCode : 'auto'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'auto') {
                        setIsKUManuallyOverridden(false);
                        const p = profiles.find(prof => prof.id === selectedProfileId);
                        if (p?.birthDate) {
                          const matchYear = new Date().getFullYear();
                          const calculated = calculateAgeCategory(p.birthDate, matchYear);
                          setMatchKU(calculated);
                          const divCode = getDivisionForAthlete(p.birthDate, p.gender || 'M', matchYear);
                          if (divCode) {
                            setSelectedDivisionCode(divCode);
                          }
                        } else {
                          setMatchKU(undefined);
                          setSelectedDivisionCode('');
                        }
                      } else {
                        setSelectedDivisionCode(val);
                        const div = getDivision(val);
                        if (div) {
                          setMatchKU(div.ageCategory);
                        }
                        setIsKUManuallyOverridden(true);
                      }
                    }}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  >
                    <option value="auto">Otomatis (Ikuti Tahun Lahir Atlet)</option>
                    {DIVISIONS.map(div => (
                      <option key={div.code} value={div.code}>
                        {div.label} ({div.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Level Kompetisi</label>
                  <select 
                    value={competitionGrade}
                    onChange={(e) => setCompetitionGrade(e.target.value as CompetitionGrade)}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  >
                    {Object.values(CompetitionGrade).map(grade => (
                      <option key={grade} value={grade}>{COMPETITION_GRADE_LABELS[grade]}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Level Pertandingan</label>
                  <select 
                    value={matchLevel}
                    onChange={(e) => setMatchLevel(e.target.value as any)}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  >
                    <option value="club">Club (Klub Umum)</option>
                    <option value="academy">Academy (Akademi)</option>
                    <option value="school">School (Sekolah)</option>
                    <option value="mixed">Mixed (Campuran/Lainnya)</option>
                  </select>
                </div>

                <div className="space-y-1.5 flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl md:col-span-2">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide block">Wasit & Aturan Resmi</label>
                    <span className="text-[10px] text-zinc-400 font-semibold">Aktifkan jika pertandingan dipimpin wasit & aturan resmi</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOfficiated(!isOfficiated)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isOfficiated ? 'bg-brand-orange' : 'bg-zinc-200 dark:bg-zinc-850'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isOfficiated ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Status Tim Kita</label>
                  <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-1">
                    <button 
                      onClick={() => setOurHomeAway('home')}
                      className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${ourHomeAway === 'home' ? 'bg-white dark:bg-zinc-800 shadow text-[#1A1A1A] dark:text-white' : 'text-zinc-500 hover:text-[#1A1A1A] dark:hover:text-white'}`}
                    >
                      HOME
                    </button>
                    <button 
                      onClick={() => setOurHomeAway('away')}
                      className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${ourHomeAway === 'away' ? 'bg-white dark:bg-zinc-800 shadow text-[#1A1A1A] dark:text-white' : 'text-zinc-500 hover:text-[#1A1A1A] dark:hover:text-white'}`}
                    >
                      AWAY
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Jumlah Quarter</label>
                  <select 
                    value={periodCount}
                    onChange={(e) => setPeriodCount(Number(e.target.value))}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  >
                    <option value={2}>2 Babak (Half)</option>
                    <option value={4}>4 Quarter</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Durasi per Quarter</label>
                  <select 
                    value={durationPerPeriod}
                    onChange={(e) => setDurationPerPeriod(Number(e.target.value))}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  >
                    <option value={5}>5 Menit</option>
                    <option value={8}>8 Menit</option>
                    <option value={10}>10 Menit</option>
                    <option value={12}>12 Menit</option>
                    <option value={15}>15 Menit</option>
                    <option value={20}>20 Menit</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Jenis Jam</label>
                  <select 
                    value={clockMode}
                    onChange={(e) => setClockMode(e.target.value as 'stop' | 'running')}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  >
                    <option value="stop">Stop Clock (Berhenti saat mati)</option>
                    <option value="running">Kotor / Running (Terus jalan)</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Link Video (YouTube) <span className="text-zinc-500 text-[10px] lowercase italic">(wajib jika meminta statting)</span></label>
                  <input 
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Contoh: https://www.youtube.com/watch?v=..."
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-10">
                <button 
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-[#1A1A1A] dark:text-white rounded-2xl font-bold tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  KEMBALI
                </button>
                <button 
                  onClick={() => setStep(4)}
                  className="flex-[2] py-4 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-2xl font-black italic uppercase tracking-wider hover:opacity-90 transition-all shadow-xl shadow-blue-900/20 dark:shadow-yellow-900/20"
                >
                  LANJUT
                </button>
              </div>
            </div>
          )}

          {step === 4 && setupPath === 'full' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="mb-6">
                <h2 className="text-2xl font-display font-black italic uppercase text-[#1A1A1A] dark:text-white leading-tight">
                  AI <span className="text-brand-navy dark:text-brand-orange">Context Layer</span> <span className="text-sm font-normal text-zinc-500 capitalize tracking-normal">(Opsional)</span>
                </h2>
                <p className="text-xs text-zinc-500 mt-1">Berikan konteks untuk analisa AI yang lebih tajam. Anda bisa melewati langkah ini.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Format Kompetisi</label>
                  <select 
                    value={matchContext?.format}
                    onChange={(e) => setMatchContext(prev => ({ ...prev!, format: e.target.value as any }))}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  >
                    <option value="single">Single Match / Friendly</option>
                    <option value="tournament">Tournament / Cup</option>
                    <option value="league">League / Round Robin</option>
                    <option value="playoff">Playoff Series</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Tahap (Stage)</label>
                  <select 
                    value={matchContext?.stage}
                    onChange={(e) => setMatchContext(prev => ({ ...prev!, stage: e.target.value as any }))}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  >
                    <option value="friendly">Friendly / Sparring</option>
                    <option value="group">Group Stage / Regular</option>
                    <option value="quarterfinal">Perempat Final</option>
                    <option value="semifinal">Semifinal</option>
                    <option value="final">Final / Championship</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Tingkat Tekanan (Stakes)</label>
                  <select 
                    value={matchContext?.importance}
                    onChange={(e) => setMatchContext(prev => ({ ...prev!, importance: e.target.value as any }))}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  >
                    <option value="low">Low Stakes (Latihan)</option>
                    <option value="medium">Medium Stakes (Penyisihan)</option>
                    <option value="high">High Stakes (Semi/Final)</option>
                    <option value="elimination">Elimination (Kalah = Keluar)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Tujuan (Purpose)</label>
                  <select 
                    value={matchContext?.purpose}
                    onChange={(e) => setMatchContext(prev => ({ ...prev!, purpose: e.target.value as any }))}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  >
                    <option value="development">Development (Skill)</option>
                    <option value="evaluation">Evaluation (Seleksi)</option>
                    <option value="competitive">Competitive (Menang)</option>
                    <option value="experimental">Experimental (Strategi)</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Level Lawan</label>
                  <select 
                    value={matchContext?.opponentLevel}
                    onChange={(e) => setMatchContext(prev => ({ ...prev!, opponentLevel: e.target.value as any }))}
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  >
                    <option value="weaker">Lebih Lemah (Weaker)</option>
                    <option value="same">Setara (Same Level)</option>
                    <option value="stronger">Lebih Kuat (Stronger)</option>
                    <option value="unknown">Tidak Diketahui</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-10">
                <button 
                  onClick={() => setStep(3)}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-[#1A1A1A] dark:text-white rounded-2xl font-bold tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  KEMBALI
                </button>
                <div className="flex-[2] flex gap-2">
                  <button 
                    onClick={() => setStep(5)}
                    className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-[#1A1A1A] dark:text-white rounded-2xl font-bold uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-xs flex items-center justify-center"
                  >
                    LEWATI & LANJUT
                  </button>
                  <button 
                    onClick={() => setStep(5)}
                    className="flex-1 py-4 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-2xl font-black italic uppercase tracking-wider hover:opacity-90 transition-all flex items-center justify-center shadow-md shadow-blue-900/10 dark:shadow-yellow-900/10"
                  >
                    LANJUT
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 5 && setupPath === 'full' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="mb-6">
                 <h2 className="text-2xl font-display font-black italic uppercase text-[#1A1A1A] dark:text-white leading-tight">
                   Ringkasan <span className="text-brand-navy dark:text-brand-orange">Akhir</span>
                 </h2>
                 <p className="text-sm text-zinc-500 mt-1">Periksa kembali detail pertandingan sebelum memulai.</p>
               </div>
               
               <SummaryCard />

               <div className="flex gap-3 mt-10">
                 <button 
                   onClick={() => setStep(4)}
                   className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-[#1A1A1A] dark:text-white rounded-2xl font-bold tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                 >
                   KEMBALI
                 </button>
                 <div className="flex-[2] flex gap-2">
                   <button 
                     onClick={() => handleStartTracking('planned')}
                     className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-[#1A1A1A] dark:text-white rounded-2xl font-black italic uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all shadow-sm flex items-center justify-center gap-2 text-xs"
                   >
                     SIMPAN RENCANA
                   </button>
                   <button 
                     onClick={() => handleStartTracking('ongoing')}
                     className="flex-1 py-4 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-2xl font-black italic uppercase tracking-wider hover:opacity-90 transition-all shadow-xl shadow-blue-900/20 dark:shadow-yellow-900/20 flex items-center justify-center gap-2"
                   >
                     MULAI RECORD <Wand2 size={18} />
                   </button>
                 </div>
               </div>
            </div>
          )}

        </div>
      </BaseModal>

      <AITeamSetupModal 
        isOpen={isAIModalOpen} 
        onClose={() => setIsAIModalOpen(false)} 
        onExtract={(players) => {
          const newPlayers: Player[] = players.map((p, i) => ({
            id: generateId('p'),
            name: p.name || `Pemain ${p.jersey || i + 1}`,
            jersey: p.jersey || '',
            isActive: i < 5
          }));
          setCustomOpponentRoster(newPlayers);
        }} 
      />

      {confirmModal && (
        <BaseModal
          isOpen={!!confirmModal}
          onClose={confirmModal.onCancel}
          title={confirmModal.title}
        >
          <div className="space-y-4 font-sans p-2">
            <div className="flex gap-3 text-brand-orange">
              <AlertCircle size={24} className="shrink-0" />
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                {confirmModal.message}
              </p>
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={confirmModal.onCancel}
                className="rounded-full px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 font-bold transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="rounded-full px-5 py-2.5 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold transition-all"
              >
                Pakai Tim Ini
              </button>
            </div>
          </div>
        </BaseModal>
      )}
    </>
  );
};

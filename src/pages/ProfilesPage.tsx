import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/atoms/Button';
import { BaseModal } from '../components/atoms/BaseModal';
import { Plus, User, Edit2, Trash2, X, ArrowRightLeft, LogOut, Camera, Upload } from 'lucide-react';
import { statsService } from '../core/services/statsService';
import { authService } from '../services/authService';
import { applicationService } from '../services/applicationService';
import { getCurrentKU } from '../core/utils/ageCalculator';
import { RoleApplication } from '../core/types/roleApplication';
import { generateId } from '../core/utils/idUtils';
import { ChildProfile, Team } from '../core/types/stats';
import { canManage } from '../entities/athlete/lib/athleteAccess';
import { UserAccount } from '../core/types/serviceRequests';
import { useTheme } from '../core/hooks/useTheme';
import { PlayerCard } from '../components/molecules/PlayerCard';
import { useToast } from '../core/contexts/ToastContext';
import { motion } from 'motion/react';
import { FileText, Clock, CheckCircle, XCircle, Award, Target } from 'lucide-react';
import { MergePlayerModal } from '../components/organisms/MergePlayerModal';
import { usePermissions } from '../core/contexts/PermissionsContext';
import { TeamsPage } from './TeamsPage';
import { ClaimAthletePage } from './ClaimAthletePage';
import { ClaimStatusPage } from './ClaimStatusPage';

export const ProfilesPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<ChildProfile | null>(null);
  const { theme } = useTheme();

  // Role Application state
  const [userApps, setUserApps] = useState<RoleApplication[]>([]);
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [motivation, setMotivation] = useState('');
  const [experience, setExperience] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);

  const { can } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = tabParam === 'teams' ? 'teams' : tabParam === 'claim' ? 'claim_athlete' : 'mine';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    const p = activeTab === 'teams' ? 'teams' : activeTab === 'claim_athlete' ? 'claim' : 'mine';
    setSearchParams({ tab: p }, { replace: true });
  }, [activeTab]);

  // Sub-tab under "Klaim Atlet"
  const [claimSubTab, setClaimSubTab] = useState<'search' | 'status'>('search');
  const [unclaimedProfiles, setUnclaimedProfiles] = useState<ChildProfile[]>([]);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimingProfile, setClaimingProfile] = useState<ChildProfile | null>(null);
  const [relationship, setRelationship] = useState<'guardian' | 'manager' | 'agent'>('guardian');

  // Form state
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [voiceAliases, setVoiceAliases] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [mainTeamId, setMainTeamId] = useState('');
  const [schoolTeamId, setSchoolTeamId] = useState('');
  const [academyTeamId, setAcademyTeamId] = useState('');
  const [loanTeamId, setLoanTeamId] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [avatar, setAvatar] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  // Transfer state
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMainTeamId, setNewMainTeamId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const p = await statsService.getProfiles();
    const t = await statsService.getTeams();
    const user = await authService.getCurrentUser();
    
    let filteredProfiles = p.filter(profile => profile.claimStatus !== 'unclaimed');
    if (user) {
      if (user.role !== 'admin') {
        filteredProfiles = p.filter(profile => canManage(profile, user.id) && profile.claimStatus !== 'unclaimed');
      }
    } else {
      filteredProfiles = [];
    }
    
    const unclaimed = p.filter(profile => profile.claimStatus === 'unclaimed');
    
    setProfiles(filteredProfiles);
    setUnclaimedProfiles(unclaimed);
    setTeams(t);
    setCurrentUser(user);
    if (user) {
      try {
        const apps = await applicationService.getUserApplications(user.id);
        setUserApps(apps);
      } catch (err) {
        console.error('Failed to load user applications', err);
      }
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!motivation.trim()) {
      showToast('Motivasi wajib diisi!', 'error');
      return;
    }
    setSubmittingApp(true);
    try {
      await applicationService.createApplication(
        currentUser.id,
        currentUser.name,
        currentUser.email,
        'statistician',
        motivation.trim(),
        experience.trim()
      );
      showToast('Pengajuan sebagai Statistician berhasil dikirim!', 'success');
      setMotivation('');
      setExperience('');
      setIsAppModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirim pengajuan', 'error');
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleLogout = async () => {
    setIsLogoutConfirmOpen(true);
  };

  const confirmLogout = async () => {
    setIsLogoutConfirmOpen(false);
    await authService.logout();
    window.location.assign('/');
  };

  const calculateKU = (dateString?: string) => {
    if (!dateString) return null;
    const birthYear = new Date(dateString).getFullYear();
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear;
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) return;

    const profile: ChildProfile = {
      id: editingProfile ? editingProfile.id : generateId('profile'),
      name: name.trim(),
      displayName: displayName.trim() || undefined,
      voiceAliases: voiceAliases ? voiceAliases.split(',').map(s => s.trim()).filter(s => s !== '') : undefined,
      birthDate: birthDate || undefined,
      mainTeamId: mainTeamId || undefined,
      schoolTeamId: schoolTeamId || undefined,
      academyTeamId: academyTeamId || undefined,
      loanTeamId: loanTeamId || undefined,
      jerseyNumber: jerseyNumber || undefined,
      avatar: avatar.trim() || undefined,
      isDiscoverable: isDiscoverable,
      transferHistory: editingProfile?.transferHistory || [],
      links: editingProfile?.links || (currentUser ? [{
        accountId: currentUser.id,
        relationship: 'guardian',
        verified: true,
        verifiedAt: Date.now()
      }] : []),
      claimStatus: editingProfile?.claimStatus || 'verified'
    };

    if (editingProfile) {
      await statsService.updateProfile(profile);
    } else {
      await statsService.addProfile(profile);
      showToast('Profil dibuat! Tinggal 2 langkah lagi', 'success');
    }

    await loadData();
    closeModal();
  };

  const handleTransfer = async () => {
    if (!editingProfile || !newMainTeamId) return;

    const updatedProfile = { ...editingProfile };
    const history = updatedProfile.transferHistory || [];
    
    history.push({
      fromTeamId: updatedProfile.mainTeamId || updatedProfile.teamId,
      toTeamId: newMainTeamId,
      date: transferDate
    });

    updatedProfile.mainTeamId = newMainTeamId;
    updatedProfile.transferHistory = history;

    await statsService.updateProfile(updatedProfile);
    await loadData();
    closeTransferModal();
  };

  const handleDeleteProfile = async (id: string) => {
    setProfileToDelete(id);
  };

  const confirmDeleteProfile = async () => {
    if (profileToDelete) {
      await statsService.deleteProfile(profileToDelete);
      setProfileToDelete(null);
      await loadData();
    }
  };

  const openAddModal = () => {
    setEditingProfile(null);
    setName('');
    setDisplayName('');
    setVoiceAliases('');
    setBirthDate('');
    setMainTeamId('');
    setSchoolTeamId('');
    setAcademyTeamId('');
    setLoanTeamId('');
    setJerseyNumber('');
    setIsDiscoverable(false);
    setAvatar('');
    setIsModalOpen(true);
  };

  const openEditModal = (profile: ChildProfile) => {
    setEditingProfile(profile);
    setName(profile.name);
    setDisplayName(profile.displayName || '');
    setVoiceAliases(profile.voiceAliases?.join(', ') || '');
    setBirthDate(profile.birthDate || '');
    setMainTeamId(profile.mainTeamId || profile.teamId || '');
    setSchoolTeamId(profile.schoolTeamId || '');
    setAcademyTeamId(profile.academyTeamId || '');
    setLoanTeamId(profile.loanTeamId || '');
    setJerseyNumber(profile.jerseyNumber || '');
    setIsDiscoverable(profile.isDiscoverable || false);
    setAvatar(profile.avatar || '');
    setIsModalOpen(true);
  };

  const openTransferModal = (profile: ChildProfile) => {
    setEditingProfile(profile);
    setNewMainTeamId('');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setIsTransferModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProfile(null);
  };

  const closeTransferModal = () => {
    setIsTransferModalOpen(false);
    setEditingProfile(null);
  };

  const openClaimModal = (profile: ChildProfile) => {
    setClaimingProfile(profile);
    setRelationship('guardian');
    setIsClaimModalOpen(true);
  };

  const handleClaimProfile = async () => {
    if (!claimingProfile || !currentUser) return;

    const updatedProfile: ChildProfile = {
      ...claimingProfile,
      claimStatus: 'verified',
      links: [
        ...(claimingProfile.links || []),
        {
          accountId: currentUser.id,
          relationship: relationship,
          verified: true,
          verifiedAt: Date.now()
        }
      ]
    };

    await statsService.updateProfile(updatedProfile);
    showToast(`Berhasil mengklaim atlet ${claimingProfile.name}!`, 'success');
    setIsClaimModalOpen(false);
    setClaimingProfile(null);
    await loadData();
  };

  const getTeamName = (id?: string) => {
    if (!id) return '-';
    return teams.find(t => t.id === id)?.name || 'Tidak Diketahui';
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
        <div className="flex items-center gap-2">
          <div className="text-brand-navy dark:text-brand-orange">
            <User size={24} strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-display font-bold text-brand-navy dark:text-white uppercase tracking-wide">Profil Atlet</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMergeModalOpen(true)}
            className="bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 p-2 rounded-xl transition-colors flex items-center justify-center shadow-xs border border-zinc-200 dark:border-zinc-800 cursor-pointer"
            title="Gabungkan Profil Atlet Duplikat"
          >
            <ArrowRightLeft size={20} strokeWidth={2} />
          </button>
          <button 
            onClick={openAddModal}
            className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy p-2 rounded-xl transition-colors flex items-center justify-center shadow-sm hover:opacity-90 border-none cursor-pointer"
            title="Tambah Atlet"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      {/* Sub-tab navigation & Desktop Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 md:top-16 z-20 px-4">
        <div className="flex flex-1 overflow-x-auto scrollbar-none gap-2">
          <button
            onClick={() => setActiveTab('mine')}
            className={`flex-1 md:flex-none md:px-8 py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'mine' 
                ? 'text-brand-navy dark:text-brand-orange border-brand-navy dark:border-brand-orange' 
                : 'text-zinc-400 border-transparent hover:text-zinc-500'
            }`}
          >
            Atlet Saya
          </button>
          {can('manage_teams') && (
            <button
              onClick={() => setActiveTab('teams')}
              className={`flex-1 md:flex-none md:px-8 py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'teams' 
                  ? 'text-brand-navy dark:text-brand-orange border-brand-navy dark:border-brand-orange' 
                  : 'text-zinc-400 border-transparent hover:text-zinc-500'
              }`}
            >
              Tim
            </button>
          )}
          {can('request_stats') && (
            <button
              onClick={() => setActiveTab('claim_athlete')}
              className={`flex-1 md:flex-none md:px-8 py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'claim_athlete' 
                  ? 'text-brand-navy dark:text-brand-orange border-brand-navy dark:border-brand-orange' 
                  : 'text-zinc-400 border-transparent hover:text-zinc-500'
              }`}
            >
              Klaim Atlet
            </button>
          )}
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => navigate('/fundamentals')}
              className="flex-1 md:flex-none md:px-8 py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer text-amber-600 dark:text-amber-400 border-transparent hover:text-amber-500 flex items-center gap-1.5"
            >
              <Target size={14} />
              Library Fundamental
            </button>
          )}
        </div>

        {/* Desktop actions */}
        {activeTab === 'mine' && (
          <div className="hidden md:flex items-center gap-2.5 py-2">
            <button 
              onClick={() => setIsMergeModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 rounded-xl transition-all border border-zinc-200 dark:border-zinc-700 text-xs font-bold uppercase tracking-wider cursor-pointer"
              title="Gabungkan Profil Atlet Duplikat"
            >
              <ArrowRightLeft size={16} /> Gabung Duplikat
            </button>
            <button 
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl transition-all text-xs font-bold uppercase tracking-wider cursor-pointer"
              title="Tambah Atlet"
            >
              <Plus size={16} /> Tambah Atlet
            </button>
          </div>
        )}
      </div>

      <main className="p-4 mt-2 space-y-6">
        {currentUser && (
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-650 dark:text-zinc-400">
                <User size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white leading-none mb-1">{currentUser.name}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {currentUser.email} • <span className="capitalize font-semibold text-xs text-brand-navy dark:text-brand-orange">{currentUser.role}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {currentUser.role === 'admin' && (
                <>
                  <button
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                  >
                    Dashboard Admin
                  </button>
                  <button
                    onClick={() => navigate('/fundamentals')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                  >
                    <Target size={14} />
                    Library Fundamental
                  </button>
                </>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-red-650 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
              >
                <LogOut size={14} />
                SIGN OUT
              </button>
            </div>
          </div>
        )}

        {activeTab === 'mine' && (
          profiles.length === 0 ? (
            <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm mt-4">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 dark:text-zinc-500">
                <User size={32} />
              </div>
              <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-2">Belum Ada Profil</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Tambahkan profil atlet Anda untuk mulai melacak pertandingan dan statistik mereka secara personal.</p>
              <button 
                onClick={openAddModal}
                className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy px-5 py-2.5 rounded-xl font-bold tracking-wide uppercase text-xs flex items-center gap-2 mx-auto hover:opacity-90 transition-opacity cursor-pointer shadow-md border-none"
              >
                <Plus size={18} strokeWidth={2.5} />
                TAMBAH PROFIL
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">Daftar Profil Atlet</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profiles.map(profile => {
                  const currentKU = getCurrentKU(profile.birthDate);
                  const birthYear = profile.birthDate && !isNaN(new Date(profile.birthDate).getTime()) ? new Date(profile.birthDate).getFullYear() : null;
                  const subtitleStr = currentKU ? `${currentKU} · lahir ${birthYear}` : 'KU-?';
                  const mainTeam = teams.find(t => t.id === (profile.mainTeamId || profile.teamId));
                  return (
                    <PlayerCard 
                      key={profile.id}
                      onClick={() => openEditModal(profile)}
                      name={profile.name}
                      displayName={profile.displayName}
                      jersey={profile.jerseyNumber || '?'}
                      subtitle={subtitleStr}
                      avatar={profile.avatar}
                      actions={
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); openTransferModal(profile); }}
                            className="p-2 text-zinc-400 hover:text-brand-navy dark:hover:text-brand-orange transition-colors cursor-pointer"
                            title="Pindah Klub Utama"
                          >
                            <ArrowRightLeft size={18} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); openEditModal(profile); }}
                            className="p-2 text-zinc-400 hover:text-brand-navy dark:hover:text-brand-orange transition-colors cursor-pointer"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteProfile(profile.id); }}
                            className="p-2 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      }
                    >
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                          <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Klub Utama</span>
                          <span className="font-bold text-[#1A1A1A] dark:text-white">{mainTeam ? mainTeam.name : '-'}</span>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                          <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Klub Sekolah</span>
                          <span className="font-bold text-[#1A1A1A] dark:text-white">{getTeamName(profile.schoolTeamId)}</span>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                          <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Klub Akademi</span>
                          <span className="font-bold text-[#1A1A1A] dark:text-white">{getTeamName(profile.academyTeamId)}</span>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                          <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Tim Pinjaman</span>
                          <span className="font-bold text-[#1A1A1A] dark:text-white">{getTeamName(profile.loanTeamId)}</span>
                        </div>
                      </div>
                    </PlayerCard>
                  );
                })}
              </div>
            </div>
          )
        )}

        {activeTab === 'teams' && can('manage_teams') && (
          <div className="animation-fade">
            <TeamsPage />
          </div>
        )}

        {activeTab === 'claim_athlete' && can('request_stats') && (
          <div className="space-y-4 animation-fade">
            {/* Sub-tab switcher inside Claim Athlete */}
            <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl max-w-sm mx-auto">
              <button
                onClick={() => setClaimSubTab('search')}
                className={`flex-1 text-center py-2 text-xs font-black uppercase rounded-lg tracking-wider transition-all cursor-pointer ${
                  claimSubTab === 'search'
                    ? 'bg-white dark:bg-zinc-800 text-brand-navy dark:text-brand-orange shadow-xs font-black'
                    : 'text-zinc-400 hover:text-zinc-650'
                }`}
              >
                Cari & Klaim
              </button>
              <button
                onClick={() => setClaimSubTab('status')}
                className={`flex-1 text-center py-2 text-xs font-black uppercase rounded-lg tracking-wider transition-all cursor-pointer ${
                  claimSubTab === 'status'
                    ? 'bg-white dark:bg-zinc-800 text-brand-navy dark:text-brand-orange shadow-xs font-black'
                    : 'text-zinc-400 hover:text-zinc-650'
                }`}
              >
                Status Klaim Saya
              </button>
            </div>

            <div className="mt-4">
              {claimSubTab === 'search' ? (
                <ClaimAthletePage />
              ) : (
                <ClaimStatusPage />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 shrink-0">
              <h3 className="font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wider text-sm">
                {editingProfile ? 'Edit Profil Atlet' : 'Tambah Profil Atlet'}
              </h3>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Photo Athlete Section */}
              <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-800 space-y-3.5">
                <div className="flex items-center gap-4">
                  {/* Circular Preview */}
                  <div className="w-16 h-16 rounded-full bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy flex items-center justify-center font-display font-black text-sm border-2 border-brand-orange/30 overflow-hidden shrink-0 relative shadow-inner group">
                    {avatar ? (
                      <>
                        <img src={avatar} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button 
                          type="button"
                          onClick={() => setAvatar('')}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-150"
                          title="Hapus foto"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <span>
                        {name ? (name.trim().split(/\s+/).length >= 2 ? (name.trim().split(/\s+/)[0].charAt(0) + name.trim().split(/\s+/)[1].charAt(0)).toUpperCase() : name.trim().substring(0,2).toUpperCase()) : '?'}
                      </span>
                    )}
                  </div>

                  {/* Drag-and-drop & manual upload */}
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-black text-[#1A1A1A] dark:text-white uppercase tracking-wider mb-1">
                      Foto Profil Atlet
                    </span>
                    <div 
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          if (!file.type.startsWith('image/')) {
                            showToast('File harus berupa gambar', 'error');
                            return;
                          }
                          if (file.size > 2 * 1024 * 1024) {
                            showToast('Ukuran gambar maksimal 2MB', 'error');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                             setAvatar(reader.result as string);
                             showToast('Foto berhasil dimuat!', 'success');
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className={`border-2 border-dashed rounded-xl p-2.5 text-center cursor-pointer transition-all ${
                        isDragging 
                          ? 'border-brand-orange bg-brand-navy/5 dark:bg-brand-orange/10' 
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-brand-navy dark:hover:border-brand-orange'
                      }`}
                      onClick={() => document.getElementById('atlet-photo-file-input')?.click()}
                    >
                      <Upload size={16} className="mx-auto text-zinc-400 mb-1" />
                      <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                        Pilih file / Tarik gambar kemari (Max 2MB)
                      </p>
                      <input 
                        id="atlet-photo-file-input"
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              showToast('Ukuran gambar maksimal 2MB', 'error');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setAvatar(reader.result as string);
                              showToast('Foto berhasil dimuat!', 'success');
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Direct URL input */}
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
                    Atau Masukkan URL Foto
                  </label>
                  <input
                    type="url"
                    value={avatar.startsWith('data:') ? '' : avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder="https://example.com/foto.jpg"
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-bold text-[#1A1A1A] dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-navy dark:focus:ring-brand-orange"
                  />
                </div>

                {/* Preset sports templates */}
                <div>
                  <span className="block text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">
                    Rekomendasi Foto Basket (Template)
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: 'Red Player', url: 'https://images.unsplash.com/photo-1544642899-f0d6e5f6ed6f?auto=format&fit=crop&q=80&w=200' },
                      { name: 'Blue Player', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200' },
                      { name: 'Dribbling', url: 'https://images.unsplash.com/photo-1519766304817-4f37bda74a27?auto=format&fit=crop&q=80&w=200' },
                      { name: 'Female Player', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200' }
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAvatar(preset.url);
                          showToast(`Menggunakan template ${preset.name}!`, 'success');
                        }}
                        className={`aspect-square rounded-lg overflow-hidden border-2 transition-all relative ${
                          avatar === preset.url ? 'border-brand-orange scale-95 shadow-md' : 'border-transparent hover:border-zinc-400'
                        }`}
                      >
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Nama Atlet
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
                  placeholder="Masukkan nama"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Nama Punggung (Jersey Name)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
                  placeholder="Contoh: Jordan"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Voice Mapping (Pisah dengan koma)
                </label>
                <input
                  type="text"
                  value={voiceAliases}
                  onChange={(e) => setVoiceAliases(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
                  placeholder="Contoh: Ailin, Alin, Ailen"
                />
                <p className="text-xs text-zinc-400 mt-1 italic">Gunakan ini jika aplikasi salah mengenali suara saat menyebut nama atlet.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Tanggal Lahir
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    No. Punggung
                  </label>
                  <input
                    type="text"
                    value={jerseyNumber}
                    onChange={(e) => setJerseyNumber(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
                    placeholder="Contoh: 23"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <h4 className="text-xs font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wider">Afiliasi Klub</h4>
                
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Klub Utama
                  </label>
                  <select
                    value={mainTeamId}
                    onChange={(e) => setMainTeamId(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all appearance-none"
                  >
                    <option value="">Pilih Klub Utama</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Klub Sekolah
                  </label>
                  <select
                    value={schoolTeamId}
                    onChange={(e) => setSchoolTeamId(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all appearance-none"
                  >
                    <option value="">Pilih Klub Sekolah</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Klub Akademi
                  </label>
                  <select
                    value={academyTeamId}
                    onChange={(e) => setAcademyTeamId(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all appearance-none"
                  >
                    <option value="">Pilih Klub Akademi</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Klub Pinjaman
                  </label>
                  <select
                    value={loanTeamId}
                    onChange={(e) => setLoanTeamId(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all appearance-none"
                  >
                    <option value="">Pilih Klub Pinjaman</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className="relative flex items-center pt-0.5">
                      <input
                        type="checkbox"
                        checked={isDiscoverable}
                        onChange={(e) => setIsDiscoverable(e.target.checked)}
                        className="sr-only peer"
                        id="isDiscoverable-toggle"
                      />
                      <div className="w-10 h-6 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-navy dark:peer-checked:bg-brand-orange"></div>
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-[#1A1A1A] dark:text-white block">
                        Tampilkan di Galeri Talenta (dapat dilihat scout)
                      </span>
                      <span className="text-xs text-zinc-400 mt-1 block leading-normal">
                        Hanya statistik & info dasar yang akan ditampilkan kepada scout, tanpa data kontak apa pun.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex gap-3 shrink-0">
              <button
                onClick={closeModal}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-zinc-600 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={!name.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-brand-navy dark:bg-brand-orange dark:text-brand-navy hover:bg-brand-navy/90 dark:hover:bg-brand-orange/90 transition-colors disabled:opacity-50"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
              <h3 className="font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wider text-sm">
                Pindah Klub Utama
              </h3>
              <button onClick={closeTransferModal} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Klub Utama Saat Ini
                </label>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-zinc-500 dark:text-zinc-400">
                  {getTeamName(editingProfile?.mainTeamId || editingProfile?.teamId)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Klub Utama Baru
                </label>
                <select
                  value={newMainTeamId}
                  onChange={(e) => setNewMainTeamId(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all appearance-none"
                >
                  <option value="">Pilih Klub Baru</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Tanggal Pindah
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <button
                onClick={handleTransfer}
                disabled={!newMainTeamId}
                className="w-full bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide text-sm"
              >
                Simpan Kepindahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals for Confirmation */}
      <BaseModal 
        isOpen={isLogoutConfirmOpen} 
        onClose={() => setIsLogoutConfirmOpen(false)}
        title="Konfirmasi Keluar"
      >
        <div className="space-y-6 pt-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Apakah Anda yakin ingin keluar / sign out dari HoopStats? Anda harus masuk kembali untuk mengakses data Anda.
          </p>
          <div className="flex gap-3 justify-end">
            <Button 
              variant="secondary" 
              onClick={() => setIsLogoutConfirmOpen(false)}
              className="px-4 py-2"
            >
              Batal
            </Button>
            <Button 
              variant="primary" 
              onClick={confirmLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 border-none"
            >
              Keluar
            </Button>
          </div>
        </div>
      </BaseModal>

      <BaseModal 
        isOpen={profileToDelete !== null} 
        onClose={() => setProfileToDelete(null)}
        title="Hapus Profil"
      >
        <div className="space-y-6 pt-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Apakah Anda yakin ingin menghapus profil atlet ini? Semua data statistik dan pertandingan yang terkait dengan profil ini akan tetap ada namun profil ini akan terhapus. Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex gap-3 justify-end">
            <Button 
              variant="secondary" 
              onClick={() => setProfileToDelete(null)}
              className="px-4 py-2"
            >
              Batal
            </Button>
            <Button 
              variant="primary" 
              onClick={confirmDeleteProfile}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 border-none"
            >
              Hapus
            </Button>
          </div>
        </div>
      </BaseModal>

      {/* Role Application Modal */}
      <BaseModal
        isOpen={isAppModalOpen}
        onClose={() => setIsAppModalOpen(false)}
        title="Pengajuan Peran Statistician"
        icon={<Award size={20} className="text-brand-navy dark:text-brand-orange" />}
      >
        <form onSubmit={handleSubmitApplication} className="space-y-4 pt-2 font-sans text-zinc-900 dark:text-zinc-100">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Silakan lengkapi formulir di bawah ini untuk mengajukan diri sebagai Statistician di HoopStats. Pengajuan Anda akan ditinjau oleh Admin secepatnya.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Motivasi Bergabung <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-semibold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
              placeholder="Jelaskan alasan mengapa Anda ingin menjadi statistician..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Pengalaman Terkait (Opsional)
            </label>
            <textarea
              rows={2}
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-semibold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
              placeholder="Contoh: Pernah mencatat pertandingan di turnamen lokal..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAppModalOpen(false)}
              className="px-4 py-2 text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submittingApp || !motivation.trim()}
              className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy font-bold px-4 py-2 border-none text-xs disabled:opacity-50"
            >
              {submittingApp ? 'Mengirim...' : 'Kirim Pengajuan'}
            </Button>
          </div>
        </form>
      </BaseModal>

      {/* Claim Athlete Modal */}
      <BaseModal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        title="Klaim Profil Atlet"
        icon={<Award size={20} className="text-brand-navy dark:text-brand-orange" />}
      >
        <div className="space-y-4 pt-2 font-sans text-zinc-900 dark:text-zinc-100">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Anda akan mengklaim profil atlet <strong className="text-brand-navy dark:text-brand-orange">{claimingProfile?.name}</strong>. Silakan pilih hubungan Anda dengan atlet ini untuk menyelesaikan proses klaim.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Hubungan / Relasi dengan Atlet <span className="text-red-500">*</span>
            </label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value as any)}
              className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-semibold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
            >
              <option value="guardian">Orang Tua / Wali (Guardian)</option>
              <option value="manager">Manajer Tim (Manager)</option>
              <option value="agent">Agen Atlet (Agent)</option>
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="secondary"
              onClick={() => setIsClaimModalOpen(false)}
              className="px-4 py-2 text-xs"
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleClaimProfile}
              className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy font-bold px-4 py-2 border-none text-xs"
            >
              Klaim & Hubungkan
            </Button>
          </div>
        </div>
      </BaseModal>

      <MergePlayerModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        profiles={profiles}
        isAdmin={currentUser?.role === 'admin'}
        onMergeSuccess={loadData}
      />
    </motion.div>
  );
};

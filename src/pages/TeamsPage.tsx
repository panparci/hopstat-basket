import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, ArrowLeft, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from "../components/atoms/Button";
import { Card } from "../components/atoms/Card";
import { statsService } from '../core/services/statsService';
import { Team, Player, Jersey, ChildProfile, Club } from '../core/types/stats';
import { generateId } from '../core/utils/idUtils';
import { AITeamSetupModal } from '../components/organisms/AITeamSetupModal';
import { ColorPicker } from '../components/molecules/ColorPicker';
import { QuickClubModal } from '../components/organisms/QuickClubModal';
import { BaseModal } from '../components/atoms/BaseModal';
import { useToast } from '../core/contexts/ToastContext';
import { TeamFormModal } from '../components/organisms/TeamFormModal';
import { usePermissions } from '../core/contexts/PermissionsContext';
import { canManage } from '../entities/athlete/lib/athleteAccess';
import { motion } from 'motion/react';

export const TeamsPage: React.FC = () => {
  const { user } = usePermissions();
  const { showToast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClubModalOpen, setIsClubModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);
  const [clubToDelete, setClubToDelete] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'teams' | 'clubs'>('teams');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [t, p, c] = await Promise.all([
      statsService.getTeams(),
      statsService.getProfiles(),
      statsService.getClubs()
    ]);
    setTeams(t);
    setProfiles(p);
    setClubs(c);
  };

  const getTeamRoster = (team: Team) => {
    const childrenInTeam = profiles.filter(p => 
      p.mainTeamId === team.id || 
      p.schoolTeamId === team.id || 
      p.academyTeamId === team.id || 
      p.loanTeamId === team.id
    ).map(p => ({
      id: p.id,
      name: p.name,
      jersey: p.jerseyNumber || '?',
      isActive: true,
      isChildProfile: true
    }));

    return [...team.roster, ...childrenInTeam];
  };

  const isTeamOwned = (team: Team) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role !== 'customer') return false;

    // Check if explicitly created by this user
    if (team.createdBy === user.id) return true;

    // Or check if associated with user's managed profiles
    const userManagedProfileIds = profiles
      .filter(p => canManage(p, user.id))
      .map(p => p.id);

    const isAssociatedWithProfile = profiles.some(p => 
      canManage(p, user.id) && 
      (p.mainTeamId === team.id || 
       p.schoolTeamId === team.id || 
       p.academyTeamId === team.id || 
       p.loanTeamId === team.id || 
       p.teamId === team.id)
    );

    if (isAssociatedWithProfile) return true;

    const isAssociatedWithRoster = team.roster.some(player => 
      userManagedProfileIds.includes(player.id) ||
      profiles.some(p => canManage(p, user.id) && p.name.toLowerCase() === player.name.toLowerCase())
    );

    return isAssociatedWithRoster;
  };

  const handleDelete = async (id: string) => {
    setTeamToDelete(id);
  };

  const confirmDeleteTeam = async () => {
    if (teamToDelete) {
      await statsService.deleteTeam(teamToDelete);
      setTeamToDelete(null);
      loadData();
    }
  };

  const handleDeleteClub = async (id: string) => {
    setClubToDelete(id);
  };

  const confirmDeleteClub = async () => {
    if (clubToDelete) {
      await statsService.deleteClub(clubToDelete);
      setClubToDelete(null);
      loadData();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 pb-20 transition-colors font-sans"
    >
      <header className="bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-30">
        <div className="flex items-center p-4 gap-4">
          <button   className="!px-2 -ml-2" onClick={() => navigate(-1)}>
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-display font-black italic uppercase text-[#1A1A1A] dark:text-white tracking-tight">Manajemen Tim</h1>
        </div>
        <div className="flex px-4 pb-2 gap-4">
          <button 
            onClick={() => setViewMode('teams')}
            className={`pb-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${viewMode === 'teams' ? 'text-brand-navy dark:text-brand-orange border-brand-navy dark:border-brand-orange' : 'text-zinc-400 border-transparent'}`}
          >
            Daftar Tim
          </button>
          <button 
            onClick={() => setViewMode('clubs')}
            className={`pb-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${viewMode === 'clubs' ? 'text-brand-navy dark:text-brand-orange border-brand-navy dark:border-brand-orange' : 'text-zinc-400 border-transparent'}`}
          >
            Master Klub
          </button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {viewMode === 'teams' ? (
          <>
            {teams.length > 0 && (
              <Button className="w-full mb-4" onClick={() => { setEditingTeam(null); setIsModalOpen(true); }}>
                <Plus size={20} />
                TAMBAH TIM BARU
              </Button>
            )}

            {teams.length === 0 ? (
              <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm mt-4">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 dark:text-zinc-500">
                  <Users size={32} />
                </div>
                <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-2">Belum Ada Tim</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Tambahkan tim untuk mengelompokkan pemain dan melacak statistik per tim.</p>
                <button onClick={() => { setEditingTeam(null); setIsModalOpen(true); }}>
                  <Plus size={18} strokeWidth={2.5} />
                  TAMBAH TIM BARU
              </button>
              </div>
            ) : (
              teams.map(team => {
                const fullRoster = getTeamRoster(team);
                const club = clubs.find(c => c.id === team.clubId);
                return (
                  <Card key={team.id} className="p-4 flex justify-between items-center mb-4">
                    <div className="flex gap-3 items-start">
                      {team.logoUrl ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-zinc-100 dark:border-zinc-800 shrink-0">
                          <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                          <Users size={24} />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-black italic uppercase text-xl text-[#1A1A1A] dark:text-white leading-tight">{team.name}</h3>
                          {team.ageGroup && (
                            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded font-bold">{team.ageGroup}</span>
                          )}
                        </div>
                        {club && <p className="text-xs font-bold text-brand-navy dark:text-brand-orange uppercase tracking-wider mt-0.5">{club.name}</p>}
                        <p className="text-sm text-zinc-500 font-medium mt-1">{fullRoster.length} Pemain</p>
                        <div className="flex gap-2 mt-2 items-center">
                          {team.lightJersey && (
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm" style={{ backgroundColor: team.lightJersey.color }} />
                              <span className="text-xs text-zinc-400 font-bold uppercase">{team.lightJersey.name}</span>
                            </div>
                          )}
                          {team.darkJersey && (
                            <div className="flex items-center gap-1 ml-2">
                              <div className="w-3 h-3 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm" style={{ backgroundColor: team.darkJersey.color }} />
                              <span className="text-xs text-zinc-400 font-bold uppercase">{team.darkJersey.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {isTeamOwned(team) ? (
                        <>
                          <button className="!p-2 !rounded-full cursor-pointer" onClick={() => { setEditingTeam(team); setIsModalOpen(true); }}>
                            <Edit2 size={18} />
                          </button>
                          <button className="!p-2 !rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 cursor-pointer" onClick={() => handleDelete(team.id)}>
                            <Trash2 size={18} />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 italic bg-zinc-50 dark:bg-zinc-850 px-2 py-1 rounded">Global / Read Only</span>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </>
        ) : (
          <>
            {clubs.length > 0 && user?.role === 'admin' && (
              <button className="w-full mb-4" onClick={() => { setEditingClub(null); setIsClubModalOpen(true); }}>
                <Plus size={20} />
                TAMBAH KLUB BARU
              </button>
            )}

            {clubs.length === 0 ? (
              <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm mt-4">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 dark:text-zinc-500">
                  <Users size={32} />
                </div>
                <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-2">Belum Ada Klub</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Tambahkan klub untuk menaungi berbagai tim yang Anda kelola.</p>
                {user?.role === 'admin' && (
                  <button onClick={() => { setEditingClub(null); setIsClubModalOpen(true); }}>
                    <Plus size={18} strokeWidth={2.5} />
                    TAMBAH KLUB BARU
                  </button>
                )}
              </div>
            ) : (
              clubs.map(club => {
                const clubTeams = teams.filter(t => t.clubId === club.id);
                return (
                  <Card key={club.id} className="p-4 flex justify-between items-center mb-4">
                    <div className="flex gap-3 items-center">
                      {club.logoUrl ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-zinc-100 dark:border-zinc-800 shrink-0">
                          <img src={club.logoUrl} alt={club.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                          <Users size={24} />
                        </div>
                      )}
                      <div>
                        <h3 className="font-display font-black italic uppercase text-xl text-[#1A1A1A] dark:text-white leading-tight">{club.name}</h3>
                        <p className="text-xs text-zinc-500 font-medium mt-1">{clubTeams.length} Tim Terdaftar</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {clubTeams.map(t => (
                            <span key={t.id} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded uppercase font-bold">{t.name}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {user?.role === 'admin' ? (
                        <>
                          <button className="!p-2 !rounded-full cursor-pointer" onClick={() => { setEditingClub(club); setIsClubModalOpen(true); }}>
                            <Edit2 size={18} />
                          </button>
                          <button className="!p-2 !rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 cursor-pointer" onClick={() => handleDeleteClub(club.id)}>
                            <Trash2 size={18} />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 italic bg-zinc-50 dark:bg-zinc-850 px-2 py-1 rounded">Global / Read Only</span>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </>
        )}
      </main>

      {isModalOpen && (
        <TeamFormModal 
          team={editingTeam} 
          clubs={clubs}
          onClose={() => setIsModalOpen(false)} 
          onSave={() => { 
            setIsModalOpen(false); 
            loadData(); 
            showToast('Tim berhasil disimpan! Lanjutkan ke langkah berikutnya.', 'success');
          }} 
          refreshClubs={loadData}
        />
      )}

      {isClubModalOpen && (
        <ClubFormModal 
          club={editingClub}
          onClose={() => setIsClubModalOpen(false)}
          onSave={() => { setIsClubModalOpen(false); loadData(); }}
        />
      )}

      <BaseModal 
        isOpen={teamToDelete !== null} 
        onClose={() => setTeamToDelete(null)}
        title="Hapus Tim"
      >
        <div className="space-y-6 pt-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Apakah Anda yakin ingin menghapus tim ini? Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex gap-3 justify-end">
            <Button 
              variant="secondary" 
              onClick={() => setTeamToDelete(null)}
              className="px-4 py-2"
            >
              Batal
            </Button>
            <Button 
              variant="primary" 
              onClick={confirmDeleteTeam}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 border-none"
            >
              Hapus
            </Button>
          </div>
        </div>
      </BaseModal>

      <BaseModal 
        isOpen={clubToDelete !== null} 
        onClose={() => setClubToDelete(null)}
        title="Hapus Klub"
      >
        <div className="space-y-6 pt-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Apakah Anda yakin ingin menghapus klub ini? Semua tim di bawahnya akan kehilangan referensi klub. Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex gap-3 justify-end">
            <Button 
              variant="secondary" 
              onClick={() => setClubToDelete(null)}
              className="px-4 py-2"
            >
              Batal
            </Button>
            <Button 
              variant="primary" 
              onClick={confirmDeleteClub}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 border-none"
            >
              Hapus
            </Button>
          </div>
        </div>
      </BaseModal>
    </motion.div>
  );
};



interface ClubFormModalProps {
  club: Club | null;
  onClose: () => void;
  onSave: () => void;
}

const ClubFormModal: React.FC<ClubFormModalProps> = ({ club, onClose, onSave }) => {
  const [name, setName] = useState(club?.name || '');
  const [location, setLocation] = useState(club?.location || '');
  const [description, setDescription] = useState(club?.description || '');
  const [logoUrl, setLogoUrl] = useState(club?.logoUrl || '');

  const handleSave = async () => {
    if (!name.trim()) return;
    
    const newClub: Club = {
      id: club?.id || generateId('club'),
      name,
      location,
      description,
      logoUrl
    };

    if (club) {
      await statsService.updateClub(newClub);
    } else {
      await statsService.addClub(newClub);
    }
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto font-sans">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 relative shadow-2xl border border-zinc-100 dark:border-zinc-800 my-8">
        <h2 className="text-2xl font-display font-black italic uppercase text-[#1A1A1A] dark:text-white mb-6">{club ? 'Edit Master Klub' : 'Tambah Master Klub'}</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Nama Klub</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white transition-all" 
              placeholder="Contoh: The Hawk Tangerang"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Lokasi</label>
            <input 
              type="text" 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white transition-all" 
              placeholder="Contoh: Tangerang"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Deskripsi</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white transition-all resize-none h-24" 
              placeholder="Keterangan tambahan..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Logo URL (Opsional)</label>
            <input 
              type="text" 
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white transition-all" 
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button 
            onClick={onClose}
            className="w-1/3 py-4 bg-zinc-100 dark:bg-zinc-800 text-[#1A1A1A] dark:text-white rounded-2xl font-bold tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            BATAL
          </button>
          <button 
            onClick={handleSave}
            disabled={!name.trim()}
            className="w-2/3 py-4 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-2xl font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-sm"
          >
            SIMPAN
          </button>
        </div>
      </div>
    </div>
  );
};

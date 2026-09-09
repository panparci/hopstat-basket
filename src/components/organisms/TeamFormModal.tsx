import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Wand2, Save } from 'lucide-react';
import { Team, Player, Jersey, ChildProfile, Club } from '../../core/types/stats';
import { statsService } from '../../core/services/statsService';
import { generateId } from '../../core/utils/idUtils';
import { AITeamSetupModal } from './AITeamSetupModal';
import { ColorPicker } from '../molecules/ColorPicker';
import { QuickClubModal } from './QuickClubModal';
import { useToast } from '../../core/contexts/ToastContext';
import { usePermissions } from '../../core/contexts/PermissionsContext';

interface TeamFormModalProps {
  team: Team | null;
  clubs: Club[];
  onClose: () => void;
  onSave: () => void;
  refreshClubs: () => void;
}

export const TeamFormModal: React.FC<TeamFormModalProps> = ({ team, clubs, onClose, onSave, refreshClubs }) => {
  const { showToast } = useToast();
  const { user } = usePermissions();
  const [name, setName] = useState(team?.name || '');
  const [clubId, setClubId] = useState(team?.clubId || '');
  const [ageGroup, setAgeGroup] = useState(team?.ageGroup || '');
  const [logoUrl, setLogoUrl] = useState(team?.logoUrl || '');
  const [roster, setRoster] = useState<Player[]>(team?.roster || []);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [lightJersey, setLightJersey] = useState<Jersey>(team?.lightJersey || { color: '#ffffff', theme: 'terang', name: 'Putih' });
  const [darkJersey, setDarkJersey] = useState<Jersey>(team?.darkJersey || { color: 'var(--color-brand-navy)', theme: 'gelap', name: 'Navy' });
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [showQuickClubModal, setShowQuickClubModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'light' | 'dark' | 'players'>('info');

  const [expandedPlayerIndex, setExpandedPlayerIndex] = useState<number | null>(null);
  const [expandedChildIndex, setExpandedChildIndex] = useState<number | null>(null);

  useEffect(() => {
    statsService.getProfiles().then(p => {
      const unique = new Map<string, ChildProfile>();
      p.forEach(prof => unique.set(prof.id, prof));
      setProfiles(Array.from(unique.values()));
    });
  }, []);

  const childrenInTeam = team ? profiles.filter(p => 
    p.mainTeamId === team.id || 
    p.schoolTeamId === team.id || 
    p.academyTeamId === team.id || 
    p.loanTeamId === team.id
  ) : [];

  const handleSave = async () => {
    if (!name.trim()) return;
    
    for (const prof of profiles) {
      await statsService.updateProfile(prof);
    }

    const newTeam: Team = {
      id: team?.id || generateId('team'),
      name,
      clubId,
      logoUrl,
      ageGroup,
      roster,
      lightJersey,
      darkJersey,
      defaultColor: darkJersey.color,
      defaultTheme: darkJersey.theme,
      createdBy: team?.createdBy || user?.id
    };

    if (team) {
      await statsService.updateTeam(newTeam);
    } else {
      await statsService.addTeam(newTeam);
      showToast('Tim dibuat! Tinggal 1 langkah lagi', 'success');
    }
    onSave();
  };

  const addPlayer = () => {
    setRoster([...roster, { id: generateId('p'), name: '', jersey: '', isActive: true }]);
    setExpandedPlayerIndex(roster.length);
  };

  const updatePlayer = (index: number, field: keyof Player, value: any) => {
    const newRoster = [...roster];
    newRoster[index] = { ...newRoster[index], [field]: value };
    setRoster(newRoster);
  };

  const removePlayer = (index: number) => {
    const newRoster = [...roster];
    newRoster.splice(index, 1);
    setRoster(newRoster);
    if (expandedPlayerIndex === index) setExpandedPlayerIndex(null);
  };

  const handleAIExtract = (extractedPlayers: Partial<Player>[]) => {
    const newPlayers: Player[] = extractedPlayers.map((p, i) => ({
      id: generateId('p'),
      name: p.name || `Pemain ${p.jersey || i + 1}`,
      jersey: p.jersey || '',
      isActive: true
    }));
    setRoster([...roster, ...newPlayers]);
  };

  const tabs = [
    { id: 'info', label: 'Info' },
    { id: 'light', label: 'Terang' },
    { id: 'dark', label: 'Gelap' },
    { id: 'players', label: 'Pemain' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto font-sans">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl p-6 relative shadow-2xl border border-zinc-100 dark:border-zinc-800 my-8 max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-display font-black italic uppercase text-[#1A1A1A] dark:text-white mb-4 shrink-0">{team ? 'Edit Tim' : 'Tambah Tim Baru'}</h2>
        
        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800 mb-6 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === tab.id 
                  ? 'text-brand-navy dark:text-brand-orange border-brand-navy dark:border-brand-orange' 
                  : 'text-zinc-400 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {activeTab === 'info' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Nama Tim</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white transition-all" 
                  placeholder="Contoh: Garuda KU 8"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Pilih Master Klub (Opsional)</label>
                <div className="flex gap-2">
                  <select 
                    value={clubId}
                    onChange={(e) => setClubId(e.target.value)}
                    className="flex-1 p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white transition-all"
                  >
                    <option value="">-- Tanpa Klub (Independen) --</option>
                    {clubs.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => setShowQuickClubModal(true)}
                    className="p-4 bg-zinc-100 dark:bg-zinc-800 text-brand-navy dark:text-brand-orange rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                    title="Tambah Klub Baru"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Kelompok Usia (KU)</label>
                <input 
                  type="text" 
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white transition-all" 
                  placeholder="Contoh: KU 8"
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
          )}

          {activeTab === 'light' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ColorPicker 
                label="Jersey TERANG (Light)" 
                color={lightJersey.color} 
                theme={lightJersey.theme} 
                name={lightJersey.name}
                onChange={(c, t, n) => setLightJersey({ color: c, theme: t, name: n })} 
              />
            </div>
          )}

          {activeTab === 'dark' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ColorPicker 
                label="Jersey GELAP (Dark)" 
                color={darkJersey.color} 
                theme={darkJersey.theme} 
                name={darkJersey.name}
                onChange={(c, t, n) => setDarkJersey({ color: c, theme: t, name: n })} 
              />
            </div>
          )}

          {activeTab === 'players' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Daftar Pemain</label>
                  <div className="flex gap-3">
                    <button onClick={() => setIsAIModalOpen(true)} className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:underline cursor-pointer">
                      <Wand2 size={14} /> AI Assistant
                    </button>
                    <button onClick={addPlayer} className="text-xs font-bold text-brand-navy dark:text-brand-orange flex items-center gap-1 hover:underline cursor-pointer">
                      <Plus size={14} /> Tambah
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {childrenInTeam.map((p, i) => (
                    <div key={p.id} className="space-y-2">
                      <div className="flex gap-2 items-center bg-blue-50 dark:bg-blue-900/20 p-2 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                        <div className="w-16 p-3 bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 rounded-xl text-center text-sm font-bold text-brand-navy dark:text-brand-orange">
                          {p.jerseyNumber || '?'}
                        </div>
                        <div className="flex-1 p-3 bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 rounded-xl text-sm font-bold text-brand-navy dark:text-brand-orange flex items-center justify-between">
                          {p.name}
                          <span className="text-xs bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy px-1.5 py-0.5 rounded uppercase font-black">Profil Atlet</span>
                        </div>
                        <button 
                          onClick={() => setExpandedChildIndex(expandedChildIndex === i ? null : i)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${expandedChildIndex === i ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy border-transparent' : 'text-zinc-400 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'}`}
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                      
                      {expandedChildIndex === i && (
                        <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20 space-y-4 animate-in slide-in-from-top-2 duration-200">
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Nama Punggung (Jersey Name)</label>
                            <input 
                              type="text" 
                              value={p.displayName || ''}
                              onChange={(e) => {
                                const newProfiles = [...profiles];
                                const index = newProfiles.findIndex(prof => prof.id === p.id);
                                if (index !== -1) {
                                  newProfiles[index] = { ...newProfiles[index], displayName: e.target.value };
                                  setProfiles(newProfiles);
                                }
                              }}
                              className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
                              placeholder="Contoh: Jordan"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Voice Mapping (Pisah dengan koma)</label>
                            <input 
                              type="text" 
                              value={p.voiceAliases?.join(', ') || ''}
                              onChange={(e) => {
                                const newProfiles = [...profiles];
                                const index = newProfiles.findIndex(prof => prof.id === p.id);
                                if (index !== -1) {
                                  newProfiles[index] = { ...newProfiles[index], voiceAliases: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '') };
                                  setProfiles(newProfiles);
                                }
                              }}
                              className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
                              placeholder="Contoh: Ailin, Alin, Ailen"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {roster.filter(p => !childrenInTeam.some(c => c.id === p.id)).map((p, i) => (
                    <div key={p.id} className="space-y-2">
                      <div className="flex gap-2 items-center bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <input 
                          type="text" 
                          value={p.jersey}
                          onChange={(e) => updatePlayer(i, 'jersey', e.target.value)}
                          className="w-16 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-center text-sm font-bold focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
                          placeholder="No"
                        />
                        <input 
                          type="text" 
                          value={p.name}
                          onChange={(e) => updatePlayer(i, 'name', e.target.value)}
                          className="flex-1 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
                          placeholder="Nama Pemain"
                        />
                        <button 
                          onClick={() => setExpandedPlayerIndex(expandedPlayerIndex === i ? null : i)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${expandedPlayerIndex === i ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy border-transparent' : 'text-zinc-400 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'}`}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => removePlayer(i)} className="p-3 text-zinc-400 hover:text-red-500 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-red-200 dark:hover:border-red-900/50 transition-all cursor-pointer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      {expandedPlayerIndex === i && (
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-4 animate-in slide-in-from-top-2 duration-200">
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Nama Punggung (Jersey Name)</label>
                            <input 
                              type="text" 
                              value={p.displayName || ''}
                              onChange={(e) => updatePlayer(i, 'displayName', e.target.value)}
                              className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
                              placeholder="Contoh: Jordan"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Voice Mapping (Pisah dengan koma)</label>
                            <input 
                              type="text" 
                              value={p.voiceAliases?.join(', ') || ''}
                              onChange={(e) => updatePlayer(i, 'voiceAliases', e.target.value.split(',').map(s => s.trim()).filter(s => s !== ''))}
                              className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
                              placeholder="Contoh: Ailin, Alin, Ailen"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {roster.length === 0 && (
                    <div className="text-center p-6 text-sm font-medium text-zinc-500 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50">
                      Belum ada pemain. Klik Tambah.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-8 shrink-0">
          <button 
            onClick={onClose}
            className="w-1/3 py-4 bg-zinc-100 dark:bg-zinc-800 text-[#1A1A1A] dark:text-white rounded-2xl font-bold tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            BATAL
          </button>
          <button 
            onClick={handleSave}
            disabled={!name.trim()}
            className="w-2/3 py-4 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-2xl font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-sm cursor-pointer"
          >
            SIMPAN
          </button>
        </div>
      </div>
      
      <AITeamSetupModal 
        isOpen={isAIModalOpen} 
        onClose={() => setIsAIModalOpen(false)} 
        onExtract={handleAIExtract} 
      />

      <QuickClubModal 
        isOpen={showQuickClubModal}
        onClose={() => setShowQuickClubModal(false)}
        onSuccess={(newClub) => {
          setClubId(newClub.id);
          refreshClubs();
        }}
      />
    </div>
  );
};

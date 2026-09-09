import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Database, 
  Check, 
  X, 
  AlertCircle, 
  Search, 
  Trash2, 
  UserCheck, 
  Users, 
  CheckCircle2, 
  MapPin, 
  GitMerge, 
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { organizationRepo } from '../../entities/organization/model/organizationRepo';
import { teamRepo } from '../../entities/team/model/teamRepo';
import { Organization } from '../../entities/organization/model/types';
import { Team } from '../../core/types/stats';
import { Card } from '../../components/atoms/Card';
import { BaseModal } from '../../components/atoms/BaseModal';
import { useToast } from '../../core/contexts/ToastContext';
import { formatDivision } from '../../entities/division/model/divisions';

type MainTab = 'organizations' | 'teams';
type CurationStatus = 'pending' | 'verified' | 'merged';

export const CurationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<MainTab>('organizations');
  const [activeStatus, setActiveStatus] = useState<CurationStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Merge Dialog states
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [sourceOrg, setSourceOrg] = useState<Organization | null>(null);
  const [sourceTeam, setSourceTeam] = useState<Team | null>(null);
  const [mergeSearchQuery, setMergeSearchQuery] = useState('');
  const [mergeTargets, setMergeTargets] = useState<any[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab, activeStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'organizations') {
        const list = await organizationRepo.list();
        // filter by status
        const filtered = list.filter(org => {
          const status = org.status || 'pending';
          return status === activeStatus;
        });
        setOrgs(filtered);
      } else {
        const list = await teamRepo.list();
        const filtered = list.filter(team => {
          // team status can be 'active' | 'deleted' | 'merged'.
          // 'pending' status is simulated by team.status === 'pending' or checking if its organization is pending.
          if (activeStatus === 'merged') {
            return team.status === 'merged' || !!team.mergedIntoId;
          } else if (activeStatus === 'pending') {
            return team.status === 'pending';
          } else {
            return team.status === 'active' && !team.mergedIntoId;
          }
        });
        setTeams(filtered);
      }
    } catch (err) {
      console.error('Error loading curation data:', err);
      showToast('Gagal memuat data kurasi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOrg = async (orgId: string) => {
    try {
      await organizationRepo.update(orgId, { status: 'verified' });
      showToast('Organisasi berhasil diverifikasi', 'success');
      loadData();
    } catch (err) {
      console.error('Error verifying organization:', err);
      showToast('Gagal memverifikasi organisasi', 'error');
    }
  };

  const handleVerifyTeam = async (teamId: string) => {
    try {
      await teamRepo.update(teamId, { status: 'active' });
      showToast('Tim berhasil diverifikasi', 'success');
      loadData();
    } catch (err) {
      console.error('Error verifying team:', err);
      showToast('Gagal memverifikasi tim', 'error');
    }
  };

  // Merge Dialog Initiation
  const handleOpenMergeOrg = async (org: Organization) => {
    setSourceOrg(org);
    setSourceTeam(null);
    setMergeSearchQuery('');
    setSelectedTargetId('');
    
    // Suggest candidates
    const all = await organizationRepo.list();
    const candidates = all.filter(o => o.id !== org.id && o.status === 'verified');
    setMergeTargets(candidates);
    setIsMergeModalOpen(true);
  };

  const handleOpenMergeTeam = async (team: Team) => {
    setSourceTeam(team);
    setSourceOrg(null);
    setMergeSearchQuery('');
    setSelectedTargetId('');

    // Suggest candidates
    const all = await teamRepo.list();
    const candidates = all.filter(t => t.id !== team.id && t.status === 'active' && t.divisionCode === team.divisionCode);
    setMergeTargets(candidates);
    setIsMergeModalOpen(true);
  };

  const handleSearchMergeTargets = async () => {
    if (sourceOrg) {
      const all = await organizationRepo.list();
      const query = mergeSearchQuery.toLowerCase();
      const candidates = all.filter(o => 
        o.id !== sourceOrg.id && 
        o.status === 'verified' &&
        (o.name.toLowerCase().includes(query) || o.city.toLowerCase().includes(query))
      );
      setMergeTargets(candidates);
    } else if (sourceTeam) {
      const all = await teamRepo.list();
      const query = mergeSearchQuery.toLowerCase();
      const candidates = all.filter(t => 
        t.id !== sourceTeam.id && 
        t.status === 'active' && 
        t.divisionCode === sourceTeam.divisionCode &&
        t.name.toLowerCase().includes(query)
      );
      setMergeTargets(candidates);
    }
  };

  const handleExecuteMerge = async () => {
    if (!selectedTargetId) return;
    setMerging(true);
    try {
      if (sourceOrg) {
        await organizationRepo.executeMerge(sourceOrg.id, selectedTargetId);
        showToast('Organisasi berhasil digabungkan (Merged)!', 'success');
      } else if (sourceTeam) {
        await teamRepo.executeTeamMerge(sourceTeam.id, selectedTargetId);
        showToast('Tim berhasil digabungkan (Merged)!', 'success');
      }
      setIsMergeModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Error executing merge:', err);
      showToast('Gagal menggabungkan data', 'error');
    } finally {
      setMerging(false);
    }
  };

  // Filter local listings based on search box
  const filteredOrgs = orgs.filter(o => 
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20 font-sans">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin')}
            className="p-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-2xl transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
              <Database className="text-brand-orange" size={24} />
              Kurasi Organisasi & Tim
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Pusat pembersihan duplikasi dan kurasi data master HoopStats.</p>
          </div>
        </div>
        <button 
          onClick={loadData}
          className="p-3 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-500 rounded-2xl transition-all"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-950 rounded-2xl">
        <button
          onClick={() => { setActiveTab('organizations'); setActiveStatus('pending'); }}
          className={`flex-1 py-3 text-sm font-black uppercase italic tracking-wider rounded-xl transition-all ${
            activeTab === 'organizations' 
              ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy shadow-md' 
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          ORGANISASI
        </button>
        <button
          onClick={() => { setActiveTab('teams'); setActiveStatus('pending'); }}
          className={`flex-1 py-3 text-sm font-black uppercase italic tracking-wider rounded-xl transition-all ${
            activeTab === 'teams' 
              ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy shadow-md' 
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          TIM
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2">
        {(['pending', 'verified', 'merged'] as CurationStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setActiveStatus(status)}
            className={`px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wide border transition-all ${
              activeStatus === status
                ? 'bg-brand-orange/10 text-brand-orange border-brand-orange/30'
                : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50'
            }`}
          >
            {status === 'pending' ? 'Pending (Usulan Baru)' : status === 'verified' ? (activeTab === 'organizations' ? 'Verified (Kanonikal)' : 'Active') : 'Merged (Duplikat)'}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
        <input
          type="text"
          placeholder={`Cari nama ${activeTab === 'organizations' ? 'organisasi atau kota' : 'tim'}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all shadow-sm"
        />
      </div>

      {/* List Container */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
        </div>
      ) : activeTab === 'organizations' ? (
        filteredOrgs.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800">
            <Database size={48} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="font-bold text-zinc-400 dark:text-zinc-600">Tidak ada organisasi berstatus '{activeStatus}'</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrgs.map((org) => (
              <Card key={org.id} className="p-5 flex flex-col justify-between border-zinc-100 dark:border-zinc-800">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded-md uppercase">
                        {org.type}
                      </span>
                      <h3 className="text-base font-black text-[#1A1A1A] dark:text-white mt-1 leading-snug">{org.name}</h3>
                    </div>
                    {org.status && (
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full capitalize ${
                        org.status === 'verified' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' 
                          : org.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        {org.status}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 mt-2.5">
                    <MapPin size={13} />
                    <span>{org.city || 'Kota tidak diset'}</span>
                  </div>

                  {org.mergedIntoId && (
                    <div className="text-xs text-zinc-400 mt-2.5 p-2.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-900 flex items-center gap-1.5 font-bold">
                      <GitMerge size={14} className="text-zinc-400" />
                      <span>Merged Into ID: <code className="text-brand-orange font-mono text-[10px]">{org.mergedIntoId}</code></span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800/60">
                  {org.status === 'pending' && (
                    <button
                      onClick={() => handleVerifyOrg(org.id)}
                      className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={14} /> Verifikasi
                    </button>
                  )}
                  {org.status !== 'merged' && (
                    <button
                      onClick={() => handleOpenMergeOrg(org)}
                      className="flex-1 py-2.5 bg-brand-orange/10 hover:bg-brand-orange/20 text-brand-orange font-black text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <GitMerge size={14} /> Tandai Duplikat / Merge
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        filteredTeams.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800">
            <Users size={48} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="font-bold text-zinc-400 dark:text-zinc-600">Tidak ada tim berstatus '{activeStatus}'</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTeams.map((team) => (
              <Card key={team.id} className="p-5 flex flex-col justify-between border-zinc-100 dark:border-zinc-800">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-brand-navy dark:text-brand-orange bg-blue-50 dark:bg-yellow-950/40 px-2 py-0.5 rounded-md uppercase">
                        {team.divisionCode ? formatDivision(team.divisionCode) : 'Divisi tidak dikenal'}
                      </span>
                      <h3 className="text-base font-black text-[#1A1A1A] dark:text-white mt-1 leading-snug">{team.name}</h3>
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full capitalize ${
                      team.status === 'active' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' 
                        : team.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {team.status || 'active'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 mt-2.5">
                    <Users size={13} />
                    <span>Roster: {team.roster ? team.roster.length : 0} Pemain Terdaftar</span>
                  </div>

                  {team.mergedIntoId && (
                    <div className="text-xs text-zinc-400 mt-2.5 p-2.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-900 flex items-center gap-1.5 font-bold">
                      <GitMerge size={14} className="text-zinc-400" />
                      <span>Merged Into ID: <code className="text-brand-orange font-mono text-[10px]">{team.mergedIntoId}</code></span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800/60">
                  {team.status === 'pending' && (
                    <button
                      onClick={() => handleVerifyTeam(team.id)}
                      className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={14} /> Verifikasi
                    </button>
                  )}
                  {team.status !== 'merged' && (
                    <button
                      onClick={() => handleOpenMergeTeam(team)}
                      className="flex-1 py-2.5 bg-brand-orange/10 hover:bg-brand-orange/20 text-brand-orange font-black text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <GitMerge size={14} /> Tandai Duplikat / Merge
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Merge Modal Dialog */}
      {isMergeModalOpen && (
        <BaseModal
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
          title={`Gabungkan ${sourceOrg ? 'Organisasi' : 'Tim'}`}
        >
          <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">Master Sumber (Duplikat)</span>
              <h4 className="font-bold text-sm text-[#1A1A1A] dark:text-white mt-1">
                {sourceOrg ? sourceOrg.name : sourceTeam?.name}
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                {sourceOrg ? `${sourceOrg.city || ''} (${sourceOrg.type})` : `Divisi: ${sourceTeam?.divisionCode}`}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Cari Master Target (Kanonikal)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={`Ketik nama ${sourceOrg ? 'organisasi' : 'tim'} target...`}
                  value={mergeSearchQuery}
                  onChange={(e) => setMergeSearchQuery(e.target.value)}
                  className="flex-1 p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl focus:ring-2 focus:ring-brand-orange outline-none font-bold text-xs text-[#1A1A1A] dark:text-white transition-all"
                />
                <button
                  onClick={handleSearchMergeTargets}
                  className="px-4 bg-brand-navy text-white rounded-xl font-bold text-xs"
                >
                  Cari
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Pilih Master Target</span>
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-150 dark:divide-zinc-800 max-h-48 overflow-y-auto bg-white dark:bg-zinc-950">
                {mergeTargets.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-400 font-bold">
                    Tidak ada kandidat target ditemukan.
                  </div>
                ) : (
                  mergeTargets.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => setSelectedTargetId(target.id)}
                      className={`w-full p-3.5 text-left text-xs font-bold flex justify-between items-center transition-all ${
                        selectedTargetId === target.id 
                          ? 'bg-brand-orange/10 text-brand-orange' 
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      <div>
                        <div>{target.name}</div>
                        <div className="text-[10px] text-zinc-400 font-medium mt-0.5">
                          {sourceOrg ? `${target.city || ''} (${target.type})` : `Roster: ${target.roster?.length || 0} pemain`}
                        </div>
                      </div>
                      {selectedTargetId === target.id && (
                        <Check size={16} className="text-brand-orange shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {selectedTargetId && (
              <div className="p-4 bg-brand-orange/5 border border-brand-orange/20 rounded-2xl flex gap-3 text-brand-orange items-start">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-extrabold uppercase tracking-wide block mb-0.5">Peringatan Kurasi</span>
                  <span>Tindakan ini akan memindahkan semua data tim, roster pemain, dan riwayat pertandingan yang bersangkutan ke master target. Operasi ini bersifat permanen dan tidak dapat dibatalkan.</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={merging}
                onClick={() => setIsMergeModalOpen(false)}
                className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-[#1A1A1A] dark:text-white rounded-xl font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!selectedTargetId || merging}
                onClick={handleExecuteMerge}
                className="flex-[2] py-3 bg-brand-orange text-white rounded-xl font-black italic uppercase tracking-wider text-xs hover:opacity-90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                {merging ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <GitMerge size={14} /> GABUNGKAN SEKARANG
                  </>
                )}
              </button>
            </div>
          </div>
        </BaseModal>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/organisms/Layout';
import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { requestService } from '../../services/requestService';
import { authService } from '../../services/authService';
import { StatServiceRequest, UserAccount } from '../../core/types/serviceRequests';
import { DIVISIONS, getDivision } from '../../entities/division/model/divisions';
import { OrganizationSelector } from '../../entities/organization/ui/OrganizationSelector';
import { teamRepo } from '../../entities/team/model/teamRepo';
import { BaseModal } from '../../shared/ui/BaseModal';
import { Youtube, Plus, Clock, CheckCircle, CreditCard, ChevronRight, Play, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const RequestStatsPage: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<StatServiceRequest[]>([]);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recordingType, setRecordingType] = useState<'single' | 'team' | null>(null);

  // Form State
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [homeOrgId, setHomeOrgId] = useState('');
  const [homeOrgName, setHomeOrgName] = useState('');
  const [awayOrgId, setAwayOrgId] = useState('');
  const [awayOrgName, setAwayOrgName] = useState('');
  const [selectedDivisionCode, setSelectedDivisionCode] = useState('');

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const currentUser = await authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      const reqs = await requestService.getCustomerRequests(currentUser.id);
      setRequests(reqs.sort((a, b) => b.createdAt - a.createdAt));
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !homeOrgId || !awayOrgId || !selectedDivisionCode) return;

    await checkAndSubmit();
  };

  const checkAndSubmit = async (useHomeTeamId?: string, useAwayTeamId?: string) => {
    if (!user) return;
    let resolvedHomeTeamId = useHomeTeamId;
    let resolvedAwayTeamId = useAwayTeamId;

    if (!resolvedHomeTeamId) {
      const existing = await teamRepo.findCanonical(homeOrgId, selectedDivisionCode);
      if (existing) {
        const formattedDate = existing.createdAt ? new Date(existing.createdAt).toLocaleDateString('id-ID') : 'baru-baru ini';
        const playerCount = existing.roster ? existing.roster.length : 0;
        setConfirmModal({
          title: `Tim Home Sudah Ada`,
          message: `Tim '${existing.name}' sudah ada (dibuat ${formattedDate}, ${playerCount} pemain terdaftar). Pakai tim ini?`,
          onConfirm: () => {
            setConfirmModal(null);
            checkAndSubmit(existing.id, resolvedAwayTeamId);
          },
          onCancel: () => {
            setConfirmModal(null);
          }
        });
        return;
      } else {
        // Create new canonical team
        const newTeam = await teamRepo.create({
          organizationId: homeOrgId,
          divisionCode: selectedDivisionCode,
          name: '', // derived in teamRepo.create
          roster: [],
          status: 'active'
        });
        resolvedHomeTeamId = newTeam.id;
      }
    }

    if (!resolvedAwayTeamId) {
      const existing = await teamRepo.findCanonical(awayOrgId, selectedDivisionCode);
      if (existing) {
        const formattedDate = existing.createdAt ? new Date(existing.createdAt).toLocaleDateString('id-ID') : 'baru-baru ini';
        const playerCount = existing.roster ? existing.roster.length : 0;
        setConfirmModal({
          title: `Tim Away Sudah Ada`,
          message: `Tim '${existing.name}' sudah ada (dibuat ${formattedDate}, ${playerCount} pemain terdaftar). Pakai tim ini?`,
          onConfirm: () => {
            setConfirmModal(null);
            checkAndSubmit(resolvedHomeTeamId, existing.id);
          },
          onCancel: () => {
            setConfirmModal(null);
          }
        });
        return;
      } else {
        // Create new canonical team
        const newTeam = await teamRepo.create({
          organizationId: awayOrgId,
          divisionCode: selectedDivisionCode,
          name: '', // derived
          roster: [],
          status: 'active'
        });
        resolvedAwayTeamId = newTeam.id;
      }
    }

    // Now both canonical teams are resolved or created! Create request
    await requestService.createRequest({
      customerId: user.id,
      youtubeUrl,
      homeTeamName: homeOrgName,
      awayTeamName: awayOrgName,
      homeRoster: [], // Optional
      awayRoster: [],
      divisionCode: selectedDivisionCode || undefined,
      ageCategory: selectedDivisionCode ? getDivision(selectedDivisionCode)?.ageCategory : undefined,
    });

    setYoutubeUrl('');
    setHomeOrgId('');
    setHomeOrgName('');
    setAwayOrgId('');
    setAwayOrgName('');
    setSelectedDivisionCode('');
    setShowModal(false);
    setRecordingType(null);
    loadData();
  };

  const handlePay = async (id: string) => {
    await requestService.processPayment(id);
    loadData();
  };

  const getStatusColor = (status: StatServiceRequest['status']) => {
    switch (status) {
      case 'pending': return 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800';
      case 'awaiting_payment': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
      case 'paid': return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
      case 'assigned': return 'text-amber-500 bg-amber-100 dark:bg-amber-900/30';
      case 'completed': return 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30';
      default: return 'text-zinc-500 bg-zinc-100';
    }
  };

  return (
    <Layout title="Stat Services">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight uppercase">Request Statistics</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Professional analysis for your basketball videos</p>
          </div>
          <Button onClick={() => setShowModal(true)} className="rounded-full shadow-lg shadow-emerald-500/20 px-6">
            <Plus className="mr-2" size={18} />
            New Request
          </Button>
        </div>

        <div className="grid gap-4">
          {requests.length === 0 && !loading && (
            <div className="py-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
              <Youtube className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" size={48} />
              <p className="text-zinc-500 dark:text-zinc-400">No requests yet. Submit your first YouTube link!</p>
            </div>
          )}

          {requests.map(req => (
            <Card key={req.id} className="p-5 border-none shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    <Youtube className="text-red-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2 uppercase tracking-wide">
                      {req.homeTeamName} <span className="text-zinc-400">vs</span> {req.awayTeamName}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-1 truncate max-w-[200px] sm:max-w-md">
                      {req.youtubeUrl}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${getStatusColor(req.status)}`}>
                    {req.status.replace('_', ' ')}
                  </div>
                  
                  {req.status === 'pending' && (
                    <Button 
                      size="sm" 
                      onClick={() => handlePay(req.id)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-4 text-xs"
                    >
                      <CreditCard size={14} className="mr-1.5" />
                      Pay 50k
                    </Button>
                  )}

                  {req.status === 'completed' && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => req.matchId && navigate(`/match/${req.matchId}?review=true`)}
                      className="text-emerald-500 hover:text-emerald-600 rounded-full px-4 text-xs uppercase font-black"
                    >
                      View Stats
                      <ChevronRight size={14} className="ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-[2rem] w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-6 uppercase tracking-tight">Post New Video</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-500">YouTube URL</label>
                  <Input 
                    placeholder="https://youtube.com/watch?v=..." 
                    value={youtubeUrl}
                    onChange={e => setYoutubeUrl(e.target.value)}
                    required
                    className="rounded-2xl border-zinc-200 bg-zinc-50 dark:bg-zinc-800/50"
                  />
                </div>
                
                <div className="space-y-4">
                  <OrganizationSelector
                    label="Home Team (Organization)"
                    selectedOrgId={homeOrgId}
                    onChange={(id, name) => {
                      setHomeOrgId(id);
                      setHomeOrgName(name);
                    }}
                  />

                  <OrganizationSelector
                    label="Away Team (Organization)"
                    selectedOrgId={awayOrgId}
                    onChange={(id, name) => {
                      setAwayOrgId(id);
                      setAwayOrgName(name);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Kategori Umur / Divisi</label>
                  <select 
                    value={selectedDivisionCode}
                    onChange={(e) => setSelectedDivisionCode(e.target.value)}
                    required
                    className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-sm text-[#1A1A1A] dark:text-white transition-all"
                  >
                    <option value="">-- Pilih Divisi --</option>
                    {DIVISIONS.map(div => (
                      <option key={div.code} value={div.code}>
                        {div.label} ({div.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pt-4 flex gap-3">
                  <Button type="button" variant="ghost" onClick={() => { setShowModal(false); setRecordingType(null); }} className="flex-1 rounded-full text-zinc-500">Cancel</Button>
                  <Button type="submit" className="flex-1 rounded-full bg-emerald-500 hover:bg-emerald-600">Submit Request</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              <Button
                type="button"
                variant="ghost"
                onClick={confirmModal.onCancel}
                className="rounded-full text-zinc-500 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={confirmModal.onConfirm}
                className="rounded-full bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-6"
              >
                Pakai Tim Ini
              </Button>
            </div>
          </div>
        </BaseModal>
      )}
    </Layout>
  );
};

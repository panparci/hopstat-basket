import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { leadService } from '../../services/leadService';
import { Lead, LeadNote } from '../../core/types/crm';
import { UserAccount } from '../../core/types/serviceRequests';
import { useToast } from '../../core/contexts/ToastContext';
import { BottomNav } from '../../components/atoms/BottomNav';
import { Can } from '../../core/contexts/PermissionsContext';
import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { BaseModal } from '../../components/atoms/BaseModal';
import { Input } from '../../components/atoms/Input';
import { 
  Users, 
  ArrowLeft, 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  Clock, 
  Layers, 
  MessageSquare, 
  Trash2, 
  ExternalLink, 
  Sparkles, 
  CheckCircle,
  FileText
} from 'lucide-react';

const STAGES: { value: Lead['stage']; label: string; color: string; bg: string; text: string }[] = [
  { value: 'new', label: 'Baru', color: 'bg-blue-500', bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
  { value: 'contacted', label: 'Dihubungi', color: 'bg-yellow-500', bg: 'bg-yellow-500/10 dark:bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-400' },
  { value: 'trial', label: 'Trial', color: 'bg-purple-500', bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' },
  { value: 'customer', label: 'Pelanggan', color: 'bg-emerald-500', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'lost', label: 'Batal', color: 'bg-red-500', bg: 'bg-red-500/10 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400' }
];

const INTEREST_LABELS: Record<Lead['interest'], string> = {
  free: 'Starter (Gratis)',
  pro: 'Pro (Berbayar)',
  verified: 'Club Verified',
  unknown: 'Tidak Diketahui'
};

const SOURCE_LABELS: Record<Lead['source'], string> = {
  landing_hero: 'Hero Landing',
  landing_pricing: 'Pricing Modal',
  landing_footer: 'Footer CTA',
  manual: 'Input Manual'
};

export const CrmPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Lead['stage']>('new');
  
  // Detail Modal/Drawer state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  
  // Create Manual Lead Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualChildAge, setManualChildAge] = useState('');
  const [manualInterest, setManualInterest] = useState<Lead['interest']>('free');
  
  // Confirm Delete state
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        navigate('/login', { replace: true });
      } else {
        setUser(currentUser);
        await loadLeads();
        setLoading(false);
      }
    };
    checkRole();
  }, [navigate]);

  const loadLeads = async () => {
    const data = await leadService.getLeads();
    setLeads(data);
  };

  const getLeadAge = (timestamp: number) => {
    const diffTime = Math.abs(Date.now() - timestamp);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hari ini';
    return `${diffDays} hari lalu`;
  };

  const getStageCount = (stage: Lead['stage']) => {
    return leads.filter(l => l.stage === stage).length;
  };

  const handleStageChange = async (leadId: string, newStage: Lead['stage']) => {
    try {
      const updated = await leadService.updateLeadStage(leadId, newStage);
      if (updated) {
        showToast(`Tahap lead berhasil dipindah ke ${STAGES.find(s => s.value === newStage)?.label}`, 'success');
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead(updated);
        }
        await loadLeads();
      }
    } catch (err) {
      showToast('Gagal merubah tahap lead', 'error');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !newNoteText.trim()) return;

    try {
      const updated = await leadService.addLeadNote(selectedLead.id, newNoteText.trim());
      if (updated) {
        showToast('Catatan berhasil ditambahkan', 'success');
        setSelectedLead(updated);
        setNewNoteText('');
        await loadLeads();
      }
    } catch (err) {
      showToast('Gagal menambahkan catatan', 'error');
    }
  };

  const handleDeleteLead = async () => {
    if (!leadToDelete) return;
    try {
      await leadService.deleteLead(leadToDelete.id);
      showToast('Lead berhasil dihapus', 'success');
      if (selectedLead && selectedLead.id === leadToDelete.id) {
        setSelectedLead(null);
      }
      setLeadToDelete(null);
      await loadLeads();
    } catch (err) {
      showToast('Gagal menghapus lead', 'error');
    }
  };

  const handleCreateManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualEmail.trim()) {
      showToast('Nama dan Email wajib diisi', 'error');
      return;
    }

    try {
      await leadService.createLead({
        name: manualName,
        email: manualEmail,
        phone: manualPhone,
        childAge: manualChildAge,
        source: 'manual',
        interest: manualInterest
      });
      showToast('Lead manual berhasil didaftarkan', 'success');
      
      // Reset form
      setManualName('');
      setManualEmail('');
      setManualPhone('');
      setManualChildAge('');
      setManualInterest('free');
      setIsCreateModalOpen(false);
      
      await loadLeads();
    } catch (err) {
      showToast('Gagal mendaftarkan lead', 'error');
    }
  };

  // Filter leads based on search query
  const filteredLeads = leads.filter(lead => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      lead.name.toLowerCase().includes(query) ||
      lead.email.toLowerCase().includes(query) ||
      (lead.phone && lead.phone.includes(query)) ||
      (lead.childAge && lead.childAge.toLowerCase().includes(query))
    );
  });

  const getWhatsAppLink = (phone?: string) => {
    if (!phone) return null;
    // Strip non-numbers
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    }
    return `https://wa.me/${clean}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent dark:border-brand-orange rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-zinc-900 dark:text-zinc-50">
      {/* Top action header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-orange/10 text-brand-orange rounded-2xl">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">CRM Lead Capture</h1>
            <p className="text-xs text-zinc-500">Kelola prospek penjualan, follow-up, & riwayat interaksi.</p>
          </div>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          variant="primary"
          size="sm"
          className="bg-brand-navy text-white hover:opacity-90 dark:bg-brand-orange dark:text-brand-navy flex items-center gap-1.5 px-4 py-2 text-xs border-none rounded-xl font-extrabold cursor-pointer"
        >
          <Plus size={14} />
          <span>Tambah Prospek / Lead</span>
        </Button>
      </div>

      <div className="space-y-6">
        
        {/* Search bar & utility */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari nama, email, WA, atau usia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
            />
          </div>
          <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-end">
            Total Leads: {filteredLeads.length}
          </div>
        </div>

        {/* 1. Stage summary row (5 cards) */}
        <div className="grid grid-cols-5 gap-2 sm:gap-4">
          {STAGES.map((stg) => {
            const count = getStageCount(stg.value);
            const isTabActive = activeTab === stg.value;
            return (
              <button
                key={stg.value}
                onClick={() => setActiveTab(stg.value)}
                className={`flex flex-col items-center justify-between p-3 rounded-2xl border text-center transition-all ${
                  isTabActive 
                    ? 'border-brand-navy dark:border-brand-orange bg-brand-navy/5 dark:bg-brand-orange/5 ring-1 ring-brand-navy/10 dark:ring-brand-orange/10 scale-[1.02]' 
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${stg.color}`} />
                  <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    {stg.label}
                  </span>
                  <span className="sm:hidden text-[9px] font-black uppercase tracking-wider text-zinc-500">
                    {stg.label.substring(0, 3)}
                  </span>
                </div>
                <div className="text-lg sm:text-2xl font-black mt-1 text-zinc-900 dark:text-white">
                  {count}
                </div>
              </button>
            );
          })}
        </div>

        {/* 2. Pipeline view / Tab view */}
        
        {/* Desktop Pipeline (>=1024px) */}
        <div className="hidden lg:grid grid-cols-5 gap-4 items-start">
          {STAGES.map((stg) => {
            const stageLeads = filteredLeads.filter(l => l.stage === stg.value);
            return (
              <div key={stg.value} className="bg-zinc-50 dark:bg-zinc-900/20 p-3 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-3 min-h-[500px]">
                {/* Header stage */}
                <div className="flex items-center justify-between px-2 pb-1 border-b border-zinc-150 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${stg.color}`} />
                    <h3 className="font-display font-black text-xs uppercase tracking-wider text-[#1A1A1A] dark:text-white">
                      {stg.label}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-zinc-400 bg-zinc-200/50 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards stack */}
                <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
                  {stageLeads.length === 0 ? (
                    <div className="py-8 text-center text-zinc-400 dark:text-zinc-600 text-xs font-semibold">
                      Tidak ada lead
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <Card
                        key={lead.id}
                        className="p-4 border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:shadow-md transition-shadow cursor-pointer relative"
                        onClick={() => setSelectedLead(lead)}
                      >
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                              {lead.name}
                            </h4>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate space-y-0.5 mt-1">
                              {lead.email && (
                                <div className="flex items-center gap-1.5">
                                  <Mail size={12} />
                                  <span className="truncate">{lead.email}</span>
                                </div>
                              )}
                              {lead.phone && (
                                <div className="flex items-center gap-1.5">
                                  <Phone size={12} />
                                  <span>{lead.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Age & Interest badge */}
                          <div className="flex flex-wrap gap-1">
                            {lead.childAge && (
                              <span className="text-[9px] font-black uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded">
                                {lead.childAge}
                              </span>
                            )}
                            <span className="text-[9px] font-black uppercase tracking-wider bg-brand-orange/15 text-brand-orange px-2 py-0.5 rounded">
                              {INTEREST_LABELS[lead.interest]}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500 font-bold">
                              <Clock size={10} />
                              <span>{getLeadAge(lead.createdAt)}</span>
                            </div>

                            {/* Dropdown to change stage */}
                            <select
                              value={lead.stage}
                              onChange={(e) => handleStageChange(lead.id, e.target.value as Lead['stage'])}
                              className="text-[10px] font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-zinc-700 dark:text-zinc-300 focus:outline-none"
                            >
                              {STAGES.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Tab View (<1024px) */}
        <div className="lg:hidden space-y-4">
          <div className="bg-white dark:bg-zinc-900/40 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <span className={`w-2.5 h-2.5 rounded-full ${STAGES.find(s => s.value === activeTab)?.color}`} />
              <h3 className="font-display font-black text-sm uppercase tracking-wider text-[#1A1A1A] dark:text-white">
                Daftar Lead: {STAGES.find(s => s.value === activeTab)?.label}
              </h3>
            </div>

            {/* Leads list */}
            <div className="space-y-3">
              {filteredLeads.filter(l => l.stage === activeTab).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400">
                  <Layers size={36} className="text-zinc-300 mb-2 stroke-[1.5]" />
                  <p className="text-sm font-bold">Tidak ada lead di tahap ini</p>
                  <p className="text-xs text-zinc-500">Cari lead lain atau tambahkan baru</p>
                </div>
              ) : (
                filteredLeads.filter(l => l.stage === activeTab).map((lead) => (
                  <Card
                    key={lead.id}
                    className="p-4 border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 active:scale-[0.99] transition-all cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <div className="flex flex-col space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-base text-zinc-900 dark:text-white">
                            {lead.name}
                          </h4>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5 mt-1">
                            {lead.email && <div className="flex items-center gap-1.5"><Mail size={12} /><span>{lead.email}</span></div>}
                            {lead.phone && <div className="flex items-center gap-1.5"><Phone size={12} /><span>{lead.phone}</span></div>}
                          </div>
                        </div>

                        {/* Top badge */}
                        <span className="text-[10px] font-black uppercase tracking-wider bg-brand-orange/15 text-brand-orange px-2.5 py-1 rounded-full">
                          {INTEREST_LABELS[lead.interest]}
                        </span>
                      </div>

                      {/* Meta information row */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 justify-between" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <Clock size={12} />
                          <span>{getLeadAge(lead.createdAt)}</span>
                          {lead.childAge && (
                            <span className="ml-1.5 text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded">
                              {lead.childAge}
                            </span>
                          )}
                        </div>

                        {/* Dropdown changer */}
                        <select
                          value={lead.stage}
                          onChange={(e) => handleStageChange(lead.id, e.target.value as Lead['stage'])}
                          className="text-xs font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-zinc-700 dark:text-zinc-300 focus:outline-none"
                        >
                          {STAGES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 3. Detail Lead Drawer / Modal */}
      <BaseModal
        isOpen={selectedLead !== null}
        onClose={() => setSelectedLead(null)}
        title="Detail Prospek / Lead"
      >
        {selectedLead && (
          <div className="space-y-6 pt-2">
            
            {/* Quick Profile Cards */}
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nama Lengkap</span>
                <h3 className="font-display font-black text-xl text-brand-navy dark:text-white uppercase leading-tight">
                  {selectedLead.name}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Email</span>
                  <a href={`mailto:${selectedLead.email}`} className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1 hover:underline">
                    {selectedLead.email}
                    <ExternalLink size={12} className="opacity-60" />
                  </a>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">No. WhatsApp</span>
                  {selectedLead.phone ? (
                    <a 
                      href={getWhatsAppLink(selectedLead.phone) || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                    >
                      {selectedLead.phone}
                      <ExternalLink size={12} className="opacity-60" />
                    </a>
                  ) : (
                    <span className="font-medium text-zinc-400">-</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Kategori Usia</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {selectedLead.childAge || 'Tidak diisi'}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Paket Diminati</span>
                  <span className="font-bold text-brand-orange">
                    {INTEREST_LABELS[selectedLead.interest]}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Sumber Lead</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {SOURCE_LABELS[selectedLead.source]}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Terakhir Diperbarui</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {new Date(selectedLead.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Stage Dropdown Select */}
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500">
                Status / Tahapan Prospek
              </label>
              <div className="flex gap-2">
                {STAGES.map((stg) => {
                  const isActive = selectedLead.stage === stg.value;
                  return (
                    <button
                      key={stg.value}
                      onClick={() => handleStageChange(selectedLead.id, stg.value)}
                      className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-xl border transition-all ${
                        isActive 
                          ? `${stg.bg} border-current ${stg.text}` 
                          : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {stg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons: WhatsApp and Delete */}
            <div className="flex gap-3 justify-between items-center pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
              <div className="flex gap-2">
                {selectedLead.phone && (
                  <a
                    href={getWhatsAppLink(selectedLead.phone) || ''}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs px-4 py-2.5 rounded-2xl shadow-sm transition-colors"
                  >
                    <Phone size={14} />
                    <span>Hubungi WA</span>
                  </a>
                )}
              </div>

              <Can permission="manage_crm">
                <Button
                  variant="danger"
                  size="sm"
                  className="bg-red-500 hover:bg-red-600 text-white flex items-center gap-1.5 px-4 py-2.5 rounded-2xl"
                  onClick={() => setLeadToDelete(selectedLead)}
                >
                  <Trash2 size={14} />
                  <span>Hapus Lead</span>
                </Button>
              </Can>
            </div>

            {/* Note History Section */}
            <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
              <div className="flex items-center gap-2 text-brand-navy dark:text-white font-display font-black text-sm uppercase tracking-wider">
                <MessageSquare size={16} />
                <span>Catatan & Riwayat Interaksi</span>
              </div>

              {/* Note creator */}
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  placeholder="Tambahkan catatan hasil follow-up, status telpon, kendala, atau janji trial..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange dark:text-white placeholder:text-zinc-400 min-h-[80px]"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy text-xs border-none"
                    disabled={!newNoteText.trim()}
                  >
                    Simpan Catatan
                  </Button>
                </div>
              </form>

              {/* Note lists */}
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {selectedLead.notes.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic text-center py-4">
                    Belum ada riwayat catatan untuk prospek ini.
                  </p>
                ) : (
                  selectedLead.notes.map((note) => (
                    <div 
                      key={note.id} 
                      className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-2xl space-y-1 text-xs"
                    >
                      <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                        <span>Oleh Admin</span>
                        <span>
                          {new Date(note.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-300 font-medium whitespace-pre-wrap leading-relaxed">
                        {note.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}
      </BaseModal>

      {/* 4. Create Manual Lead Modal */}
      <BaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Daftarkan Lead Baru secara Manual"
      >
        <form onSubmit={handleCreateManualLead} className="space-y-4 pt-2">
          <Input
            label="Nama Lengkap *"
            placeholder="Masukkan nama prospek"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            required
          />

          <Input
            label="Alamat Email *"
            placeholder="nama@email.com"
            type="email"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            required
          />

          <Input
            label="No. WhatsApp (Opsional)"
            placeholder="Contoh: 081234567890"
            type="tel"
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500">
                Kategori Usia Atlet
              </label>
              <select
                value={manualChildAge}
                onChange={(e) => setManualChildAge(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange focus:border-transparent transition-all dark:text-white"
              >
                <option value="">Pilih Kategori</option>
                <option value="KU-8">KU-8</option>
                <option value="KU-10">KU-10</option>
                <option value="KU-12">KU-12</option>
                <option value="KU-14">KU-14</option>
                <option value="KU-16">KU-16</option>
                <option value="KU-18">KU-18</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500">
                Paket Diminati
              </label>
              <select
                value={manualInterest}
                onChange={(e) => setManualInterest(e.target.value as Lead['interest'])}
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange focus:border-transparent transition-all dark:text-white"
              >
                <option value="free">Starter (Gratis)</option>
                <option value="pro">Pro (Berbayar)</option>
                <option value="verified">Club Verified</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="bg-brand-navy hover:opacity-90 dark:bg-brand-orange dark:text-brand-navy border-none"
            >
              Daftarkan
            </Button>
          </div>
        </form>
      </BaseModal>

      {/* 5. Delete Confirm Modal */}
      <BaseModal
        isOpen={leadToDelete !== null}
        onClose={() => setLeadToDelete(null)}
        title="Hapus Lead"
      >
        <div className="space-y-6 pt-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Apakah Anda yakin ingin menghapus prospek <strong className="text-zinc-900 dark:text-white">{leadToDelete?.name}</strong> dari sistem CRM? Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => setLeadToDelete(null)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleDeleteLead}
              className="bg-red-600 hover:bg-red-700 text-white border-none"
            >
              Hapus
            </Button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
};

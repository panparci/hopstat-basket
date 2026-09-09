import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Award, 
  ArrowLeft, 
  Check, 
  X, 
  Clock, 
  FileText, 
  Calendar, 
  User, 
  CheckCircle2, 
  XCircle,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { applicationService } from '../../services/applicationService';
import { authService } from '../../services/authService';
import { RoleApplication } from '../../core/types/roleApplication';
import { UserAccount } from '../../core/types/serviceRequests';
import { BottomNav } from '../../components/atoms/BottomNav';
import { Button } from '../../components/atoms/Button';
import { BaseModal } from '../../components/atoms/BaseModal';
import { useToast } from '../../core/contexts/ToastContext';
import { motion } from 'motion/react';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export const ApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [applications, setApplications] = useState<RoleApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterStatus>('pending');
  
  // Review Modal state
  const [selectedApp, setSelectedApp] = useState<RoleApplication | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get current logged-in user (admin)
      const activeUser = await authService.getCurrentUser();
      setCurrentUser(activeUser);

      // Get all applications
      const allApps = await applicationService.getApplications();
      // Sort: newest first
      allApps.sort((a, b) => b.createdAt - a.createdAt);
      setApplications(allApps);
    } catch (err) {
      showToast('Gagal memuat data pengajuan peran', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (app: RoleApplication, initialDecision: 'approved' | 'rejected') => {
    setSelectedApp(app);
    setDecision(initialDecision);
    setReviewNote('');
    setIsReviewModalOpen(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !currentUser) return;

    setSubmittingReview(true);
    try {
      await applicationService.reviewApplication(
        selectedApp.id,
        decision,
        reviewNote.trim(),
        currentUser.id
      );

      showToast(
        decision === 'approved' 
          ? `Pengajuan ${selectedApp.userName} disetujui!` 
          : `Pengajuan ${selectedApp.userName} ditolak.`,
        'success'
      );

      setIsReviewModalOpen(false);
      setSelectedApp(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan keputusan review', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const filteredApps = applications.filter(app => {
    if (activeTab === 'all') return true;
    return app.status === activeTab;
  });

  const getStatusBadge = (status: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide">
            <CheckCircle2 size={12} />
            DISETUJUI
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide">
            <XCircle size={12} />
            DITOLAK
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide">
            <Clock size={12} className="animate-pulse" />
            MENUNGGU
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-20 text-zinc-900 dark:text-zinc-100">
      {/* Top action header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-orange/10 text-brand-orange rounded-2xl">
            <Award size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">Persetujuan Peran</h1>
            <p className="text-xs text-zinc-500">Tinjau permohonan atlet, pelatih, agen, atau pengurus klub.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Status Filter Tabs */}
        <div className="flex bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          {(['pending', 'approved', 'rejected', 'all'] as FilterStatus[]).map((tab) => {
            const count = applications.filter(app => app.status === tab || (tab === 'all')).length;
            const label = tab === 'pending' ? 'Pending' 
                        : tab === 'approved' ? 'Disetujui' 
                        : tab === 'rejected' ? 'Ditolak' : 'Semua';
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
                  isActive 
                    ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                    isActive 
                      ? 'bg-white/25 text-white dark:bg-brand-navy/20 dark:text-brand-navy' 
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400">
            <div className="w-8 h-8 border-4 border-brand-navy dark:border-brand-orange border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold">Memuat pengajuan peran...</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="text-center p-10 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 mb-4 border border-zinc-100 dark:border-zinc-700">
              <Award size={28} className="opacity-70 text-zinc-400 dark:text-zinc-500" />
            </div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-1">
              Tidak Ada Pengajuan
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[280px]">
              Tidak ditemukan berkas pendaftaran dengan status {
                activeTab === 'pending' ? 'menunggu persetujuan' 
                : activeTab === 'approved' ? 'disetujui'
                : activeTab === 'rejected' ? 'ditolak' : 'apapun'
              }.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApps.map((app) => (
              <motion.div
                key={app.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                      <User size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white leading-none mb-1">{app.userName}</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{app.userEmail}</p>
                    </div>
                  </div>
                  <div>
                    {getStatusBadge(app.status)}
                  </div>
                </div>

                <div className="bg-[#F8F9FA] dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/40 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs text-brand-navy dark:text-brand-orange font-bold uppercase tracking-wider">
                    <Sparkles size={12} />
                    <span>Dokumen Pengajuan {app.requestedRole}</span>
                  </div>
                  
                  <div className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-350">
                    <p className="leading-relaxed">
                      <strong className="text-zinc-900 dark:text-white block mb-0.5 font-semibold text-[11px] uppercase tracking-wider text-zinc-500">Motivasi:</strong>
                      "{app.motivation}"
                    </p>
                    {app.experience && (
                      <p className="leading-relaxed">
                        <strong className="text-zinc-900 dark:text-white block mb-0.5 font-semibold text-[11px] uppercase tracking-wider text-zinc-500">Pengalaman Terkait:</strong>
                        "{app.experience}"
                      </p>
                    )}
                  </div>

                  {app.reviewNote && (
                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-1 text-xs">
                      <strong className="text-zinc-900 dark:text-white block mb-0.5 font-semibold text-[11px] uppercase tracking-wider text-zinc-500">Catatan Review Admin:</strong>
                      <p className="text-zinc-600 dark:text-zinc-400 italic font-medium">"{app.reviewNote}"</p>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono pt-1">
                    <Calendar size={11} />
                    <span>Dibuat: {new Date(app.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {app.status === 'pending' && (
                  <div className="flex gap-2.5 justify-end">
                    <button
                      onClick={() => handleOpenReview(app, 'rejected')}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-red-650 dark:text-red-400 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/35 transition-colors border border-red-100 dark:border-red-900/30"
                    >
                      <X size={14} />
                      Tolak
                    </button>
                    <button
                      onClick={() => handleOpenReview(app, 'approved')}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-emerald-650 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/35 transition-colors border border-emerald-100 dark:border-emerald-900/30"
                    >
                      <Check size={14} />
                      Setujui
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      <BaseModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          if (!submittingReview) {
            setIsReviewModalOpen(false);
            setSelectedApp(null);
          }
        }}
        title={`Review Pengajuan: ${selectedApp?.userName || ''}`}
        icon={<Award size={20} className="text-brand-navy dark:text-brand-orange" />}
      >
        <form onSubmit={handleSubmitReview} className="space-y-4 pt-2 font-sans text-zinc-900 dark:text-zinc-100">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Tentukan keputusan Anda untuk pendaftaran ini. Pengguna akan mendapatkan pembaruan peran secara instan jika pendaftaran disetujui.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Keputusan
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDecision('approved')}
                className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                  decision === 'approved'
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <Check size={14} />
                Setujui (Approve)
              </button>
              <button
                type="button"
                onClick={() => setDecision('rejected')}
                className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                  decision === 'rejected'
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <X size={14} />
                Tolak (Reject)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Catatan Review (Opsional)
            </label>
            <textarea
              rows={3}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-semibold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
              placeholder={decision === 'approved' ? "Contoh: Selamat bergabung sebagai statistician!" : "Contoh: Mohon lengkapi detail pengalaman Anda..."}
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsReviewModalOpen(false);
                setSelectedApp(null);
              }}
              disabled={submittingReview}
              className="px-4 py-2 text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submittingReview}
              className={`font-bold px-4 py-2 border-none text-xs ${
                decision === 'approved' 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {submittingReview ? 'Menyimpan...' : 'Kirim Keputusan'}
            </Button>
          </div>
        </form>
      </BaseModal>
    </div>
  );
};

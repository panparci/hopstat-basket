import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Award, 
  Check, 
  X, 
  Clock, 
  FileText, 
  Calendar, 
  User, 
  CheckCircle2, 
  XCircle, 
  Phone, 
  ShieldAlert, 
  ExternalLink,
  Sparkles,
  Search,
  MessageSquare,
  ArrowRightLeft,
  CheckCircle
} from 'lucide-react';
import { claimService } from '../../services/claimService';
import { authService } from '../../services/authService';
import { statsService } from '../../core/services/statsService';
import { ClaimRequest } from '../../core/types/claim';
import { UserAccount, PaymentRecord } from '../../core/types/serviceRequests';
import { ChildProfile } from '../../core/types/stats';
import { BottomNav } from '../../components/atoms/BottomNav';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { BaseModal } from '../../components/atoms/BaseModal';
import { useToast } from '../../core/contexts/ToastContext';
import { motion, AnimatePresence } from 'motion/react';
import { initDB } from '../../lib/db';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'refund';

export const ClaimReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [payments, setPayments] = useState<Record<string, PaymentRecord>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterStatus>('pending');
  
  // Review Modal state
  const [selectedClaim, setSelectedClaim] = useState<ClaimRequest | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Refund Modal state
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedRefundClaim, setSelectedRefundClaim] = useState<ClaimRequest | null>(null);
  const [refundDecision, setRefundDecision] = useState<'refunded' | 'refund_rejected'>('refunded');
  const [refundNote, setRefundNote] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  // Merge Offering state
  const [shouldMerge, setShouldMerge] = useState(false);
  const [matchingPlaceholders, setMatchingPlaceholders] = useState<ChildProfile[]>([]);
  const [selectedMergeId, setSelectedMergeId] = useState<string>('');

  // Document Viewer state
  const [viewingDoc, setViewingDoc] = useState<{ name: string; dataUrl: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const activeUser = await authService.getCurrentUser();
      setCurrentUser(activeUser);

      const allClaims = await claimService.getClaims();
      // Sort: Pending first, then by matchScore descending, then by newest first
      allClaims.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        
        if (a.status === b.status) {
          if (b.matchScore !== a.matchScore) {
            return b.matchScore - a.matchScore;
          }
          return b.createdAt - a.createdAt;
        }
        return 0;
      });
      setClaims(allClaims);

      const db = await initDB();
      const allPayments = await db.getAll('payments');
      const paymentsMap: Record<string, PaymentRecord> = {};
      allPayments.forEach(p => {
        paymentsMap[p.id] = p;
      });
      setPayments(paymentsMap);
    } catch (err) {
      showToast('Gagal memuat data pengajuan klaim', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRefundDecision = (claim: ClaimRequest, dec: 'refunded' | 'refund_rejected') => {
    setSelectedRefundClaim(claim);
    setRefundDecision(dec);
    setRefundNote('');
    setIsRefundModalOpen(true);
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRefundClaim || !currentUser) return;

    if (refundDecision === 'refund_rejected' && !refundNote.trim()) {
      showToast('Alasan penolakan refund wajib diisi!', 'error');
      return;
    }

    setRefundSubmitting(true);
    try {
      await claimService.processRefund(
        selectedRefundClaim.id,
        refundDecision,
        refundNote.trim() || undefined
      );

      showToast(
        refundDecision === 'refunded'
          ? `Status refund untuk klaim ${selectedRefundClaim.childData.name} ditandai Berhasil Direfund!`
          : `Status refund untuk klaim ${selectedRefundClaim.childData.name} ditolak.`,
        'success'
      );

      setIsRefundModalOpen(false);
      setSelectedRefundClaim(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses refund', 'error');
    } finally {
      setRefundSubmitting(false);
    }
  };

  const handleOpenReview = async (claim: ClaimRequest, initialDecision: 'approved' | 'rejected') => {
    setSelectedClaim(claim);
    setDecision(initialDecision);
    setReviewNote('');
    setShouldMerge(false);
    setMatchingPlaceholders([]);
    setSelectedMergeId('');

    if (initialDecision === 'approved') {
      try {
        const allProfiles = await statsService.getProfiles();
        const matches = allProfiles.filter(p => {
          // Must belong to the claimant (verified or not, so any link containing accountId)
          const isClaimantProfile = p.links?.some(l => l.accountId === claim.claimantAccountId);
          // Must match name and dob
          const nameMatches = p.name.trim().toLowerCase() === claim.childData.name.trim().toLowerCase();
          const dobMatches = p.birthDate === claim.childData.dob;
          // Must NOT be the claimed profile itself
          const isNotSame = p.id !== claim.profileId;
          // Must not be archived
          const isNotArchived = !p.archived;
          
          return isClaimantProfile && nameMatches && dobMatches && isNotSame && isNotArchived;
        });
        setMatchingPlaceholders(matches);
        if (matches.length > 0) {
          setSelectedMergeId(matches[0].id);
          setShouldMerge(true); // pre-select by default
        }
      } catch (err) {
        console.error('Failed to find matching placeholders', err);
      }
    }

    setIsReviewModalOpen(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim || !currentUser) return;

    if (decision === 'rejected' && !reviewNote.trim()) {
      showToast('Alasan penolakan wajib diisi jika klaim ditolak!', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const mergeId = (decision === 'approved' && shouldMerge) ? selectedMergeId : undefined;
      await claimService.reviewClaim(
        selectedClaim.id,
        decision,
        currentUser.id,
        reviewNote.trim() || undefined,
        mergeId
      );

      showToast(
        decision === 'approved' 
          ? `Klaim atlet ${selectedClaim.childData.name} disetujui!${shouldMerge ? ' Profil placeholder berhasil di-merge.' : ''}` 
          : `Klaim atlet ${selectedClaim.childData.name} ditolak.`,
        'success'
      );

      setIsReviewModalOpen(false);
      setSelectedClaim(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan keputusan review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getWarningReason = (claim: ClaimRequest) => {
    const warnings: string[] = [];
    if (claim.matchScore < 80) {
      warnings.push("Skor kecocokan rendah (< 80%). Harap teliti kembali data anak.");
    }
    
    // Heuristic checking if claimant shares surname or words with the child
    const childNameParts = claim.childData.name.toLowerCase().split(/\s+/).filter(p => p.length > 2);
    const claimantNameParts = claim.claimantName.toLowerCase().split(/\s+/).filter(p => p.length > 2);
    const sharesNamePart = childNameParts.some(p => claimantNameParts.includes(p));
    
    if (!sharesNamePart && claim.relationship !== 'wali') {
      warnings.push(`Nama akun pengklaim ("${claim.claimantName}") tidak memiliki kesamaan kata nama dengan nama anak ("${claim.childData.name}").`);
    }
    
    return warnings;
  };

  const filteredClaims = claims.filter(c => {
    if (activeTab === 'refund') {
      return c.paymentStatus === 'refund_pending';
    }
    if (activeTab === 'all') return true;
    return c.status === activeTab;
  });

  const getStatusBadge = (status: ClaimRequest['status']) => {
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
            PENDING
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
            <h1 className="text-lg font-black uppercase tracking-tight">Panel Review Klaim</h1>
            <p className="text-xs text-zinc-500">Tinjau, setujui, atau tolak klaim profil atlet yang diajukan oleh pengguna.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Status Filter Tabs */}
        <div className="flex bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm max-w-lg mx-auto lg:mx-0 overflow-x-auto">
          {(['pending', 'approved', 'rejected', 'refund', 'all'] as FilterStatus[]).map((tab) => {
            const count = tab === 'refund'
              ? claims.filter(c => c.paymentStatus === 'refund_pending').length
              : claims.filter(c => c.status === tab || (tab === 'all')).length;
            const label = tab === 'pending' ? 'Pending' 
                        : tab === 'approved' ? 'Disetujui' 
                        : tab === 'rejected' ? 'Ditolak' 
                        : tab === 'refund' ? 'Antrean Refund' : 'Semua';
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
                  isActive 
                    ? 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy' 
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
            <p className="text-xs font-semibold">Memuat data klaim atlet...</p>
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="text-center p-10 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 mb-4 border border-zinc-100 dark:border-zinc-700">
              <Award size={28} className="opacity-70 text-zinc-400 dark:text-zinc-500" />
            </div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-1">
              Tidak Ada Pengajuan Klaim
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Tidak ditemukan berkas pengajuan klaim atlet dengan status {
                activeTab === 'pending' ? 'menunggu persetujuan' 
                : activeTab === 'approved' ? 'disetujui'
                : activeTab === 'rejected' ? 'ditolak'
                : activeTab === 'refund' ? 'menunggu refund' : 'apapun'
              }.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredClaims.map((claim) => {
              const warnings = getWarningReason(claim);
              return (
                <motion.div
                  key={claim.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4"
                >
                  {/* Claimant / Submitter header */}
                  <div className="flex justify-between items-start border-b border-zinc-50 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <User size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white leading-none mb-1 flex items-center gap-2">
                          {claim.claimantName}
                          <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full font-bold uppercase tracking-wide">
                            {claim.relationship}
                          </span>
                        </h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-1 font-mono">
                          <Phone size={10} />
                          {claim.claimantPhone}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {getStatusBadge(claim.status)}
                      {claim.paymentStatus === 'refund_pending' && (
                        <span className="text-[9px] bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded font-black uppercase tracking-wider animate-pulse">
                          Refund Pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Wide 2-Column Side-by-Side Area */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch pt-2">
                    {/* Left Column: Data & Warnings */}
                    <div className="space-y-4">
                      {/* Athlete child details */}
                      <div className="bg-[#F8F9FA] dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/40 space-y-3">
                        <div className="flex items-center justify-between text-xs text-brand-navy dark:text-brand-orange font-bold uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <Sparkles size={12} />
                            Detail Profil Atlet
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                            claim.matchScore >= 80 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400'
                          }`}>
                            Pencocokan: {claim.matchScore}/100
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-y-3 text-xs text-zinc-700 dark:text-zinc-350">
                          <div>
                            <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider">Nama Anak</span>
                            <strong className="text-zinc-900 dark:text-white">{claim.childData.name}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider">Tanggal Lahir / Gender</span>
                            <strong className="text-zinc-900 dark:text-white">
                              {claim.childData.dob} ({claim.childData.gender === 'L' ? 'Laki-laki' : 'Perempuan'})
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider">Klub / No. Punggung</span>
                            <strong className="text-zinc-900 dark:text-white">
                              {claim.childData.club} {claim.childData.jerseyNumber ? `#${claim.childData.jerseyNumber}` : ''}
                            </strong>
                          </div>
                          {claim.paymentId && (
                            <div>
                              <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider">ID Pembayaran</span>
                              <strong className="text-zinc-900 dark:text-white font-mono break-all">{claim.paymentId}</strong>
                            </div>
                          )}
                          {claim.childData.events && claim.childData.events.length > 0 && (
                            <div className="col-span-2">
                              <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider mb-1">Event Diketahui</span>
                              <div className="flex flex-wrap gap-1">
                                {claim.childData.events.map((evt, idx) => (
                                  <span key={idx} className="bg-white dark:bg-zinc-900 text-[9px] font-bold py-0.5 px-2 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-500">
                                    {evt}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Warnings Display */}
                      {warnings.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-3 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-400">
                          <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-500" />
                          <div className="space-y-1">
                            <span className="font-bold uppercase tracking-wider text-[10px] block">Peringatan Verifikasi Manual</span>
                            <ul className="list-disc pl-4 space-y-0.5 text-[11px] leading-relaxed">
                              {warnings.map((w, idx) => <li key={idx}>{w}</li>)}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Live Side-by-Side Document Preview */}
                    <div className="bg-[#F8F9FA] dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/40 flex flex-col justify-between min-h-[200px]">
                      <div className="flex items-center justify-between border-b border-zinc-200/40 dark:border-zinc-800 pb-1.5 mb-3">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <FileText size={12} />
                          Lampiran Dokumen Bukti (KK/Akta)
                        </span>
                        <span className="text-[9px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-bold text-zinc-500 uppercase tracking-wider">Berdampingan</span>
                      </div>

                      <div className="flex-1 flex flex-col gap-3 justify-center">
                        {claim.documents && claim.documents.length > 0 ? (
                          claim.documents.map((doc, dIdx) => (
                            <div key={dIdx} className="space-y-1.5">
                              <span className="text-[9px] text-zinc-400 font-bold uppercase">
                                {doc.type === 'kk' ? 'Kartu Keluarga (KK)' : doc.type === 'akta' ? 'Akta Lahir' : 'Kartu Pelajar'}
                              </span>
                              
                              {doc.dataUrl.startsWith('data:application/pdf') ? (
                                <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center space-y-1 shadow-sm">
                                  <FileText size={24} className="text-zinc-400 mx-auto" />
                                  <p className="text-[10px] text-zinc-500 font-bold max-w-full truncate">{doc.fileName}</p>
                                  <a 
                                    href={doc.dataUrl} 
                                    download={`${doc.type}_${claim.childData.name}.pdf`}
                                    className="text-[10px] text-brand-navy dark:text-brand-orange font-bold underline block"
                                  >
                                    Unduh PDF Lengkap
                                  </a>
                                </div>
                              ) : (
                                <div className="relative border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 flex items-center justify-center h-32">
                                  <img 
                                    src={doc.dataUrl} 
                                    alt={doc.fileName} 
                                    className="h-28 object-contain w-full"
                                    referrerPolicy="no-referrer"
                                  />
                                  <button 
                                    onClick={() => setViewingDoc({ name: `${doc.type.toUpperCase()} - ${doc.fileName}`, dataUrl: doc.dataUrl })}
                                    className="absolute bottom-1.5 right-1.5 bg-black/70 hover:bg-black text-white px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                                  >
                                    <ExternalLink size={10} /> Perbesar
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-center p-6 text-zinc-400 text-xs">
                            Tidak ada dokumen bukti terlampir.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Review Logs */}
                  {claim.reviewNote && (
                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl text-xs border border-zinc-200/50 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1 mb-1 font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider text-[10px]">
                        <MessageSquare size={12} />
                        Catatan Penilai (Admin)
                      </div>
                      "{claim.reviewNote}"
                    </div>
                  )}

                  {/* Action Buttons */}
                  {claim.status === 'pending' && (
                    <div className="flex gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                      {claim.paymentId && payments[claim.paymentId]?.status !== 'success' && (
                        <button
                          onClick={() => claimService.confirmPayment(claim.id).then(loadData)}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold text-brand-navy dark:text-brand-orange border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                        >
                          Tandai Lunas
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenReview(claim, 'rejected')}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all flex items-center justify-center gap-1.5"
                      >
                        <X size={14} />
                        Tolak Klaim
                      </button>
                      {(!claim.paymentId || payments[claim.paymentId]?.status === 'success' || claim.paymentStatus === 'paid') && (
                        <button
                          onClick={() => handleOpenReview(claim, 'approved')}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Check size={14} />
                          Setujui Klaim
                        </button>
                      )}
                    </div>
                  )}

                  {/* Refund Action Buttons */}
                  {claim.paymentStatus === 'refund_pending' && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-[#F8F9FA] dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-850">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold uppercase tracking-wider text-[10px] text-zinc-400">Total Refund:</span>
                          <span className="font-mono font-black text-sm text-zinc-900 dark:text-white">
                            {claim.paymentId && payments[claim.paymentId]
                              ? `Rp ${payments[claim.paymentId].amount.toLocaleString('id-ID')}`
                              : 'Rp 50.000'}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                          * Ini adalah refund manual/administratif. Integrasi gateway pembayaran riil menyusul di produksi.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenRefundDecision(claim, 'refund_rejected')}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all flex items-center justify-center gap-1.5"
                        >
                          <X size={14} />
                          Tolak Refund
                        </button>
                        <button
                          onClick={() => handleOpenRefundDecision(claim, 'refunded')}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Check size={14} />
                          Tandai Sudah Direfund
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Confirmation Modal */}
      <BaseModal 
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title={decision === 'approved' ? 'Setujui Pengajuan Klaim' : 'Tolak Pengajuan Klaim'}
      >
        {selectedClaim && (
          <form onSubmit={handleSubmitReview} className="space-y-4 p-1">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
              {decision === 'approved' 
                ? `Apakah Anda yakin ingin menyetujui klaim atlet untuk ${selectedClaim.childData.name}? Menyetujui akan mengubah status profil menjadi Verified dan memberikan hak akses wali resmi ke user ini.`
                : `Apakah Anda yakin ingin menolak klaim atlet untuk ${selectedClaim.childData.name}? Penolakan akan mengembalikan status profil menjadi Unclaimed agar wali lain dapat mengajukan ulang.`}
            </p>

            {/* Merge Placeholder offering */}
            {decision === 'approved' && matchingPlaceholders.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <ArrowRightLeft size={16} className="shrink-0" />
                  <span className="font-bold text-xs uppercase tracking-wide">PENGGABUNGAN PROFIL (MERGE)</span>
                </div>
                <p className="text-[11px] text-blue-600 dark:text-blue-300 leading-relaxed font-semibold">
                  Pengklaim terdeteksi memiliki profil placeholder lokal "{matchingPlaceholders[0].name}" yang cocok dengan data anak ini. Gabungkan seluruh daftar tanding, statistik, dan riwayat pertandingan ke profil terverifikasi ini secara otomatis?
                </p>
                <label className="flex items-center gap-2 pt-1 text-xs text-zinc-700 dark:text-zinc-300 font-bold cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={shouldMerge}
                    onChange={(e) => setShouldMerge(e.target.checked)}
                    className="rounded text-brand-navy focus:ring-brand-navy dark:bg-zinc-900 dark:border-zinc-700"
                  />
                  Ya, gabungkan data & arsipkan profil placeholder lama
                </label>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                Catatan Peninjauan / Alasan {decision === 'rejected' ? <span className="text-red-500 font-black">(WAJIB)</span> : <span className="text-zinc-400">(Opsional)</span>}
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={decision === 'rejected' ? "Berikan keterangan alasan penolakan berkas secara jelas..." : "Berikan keterangan detail peninjauan dokumen..."}
                rows={3}
                className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl px-4 py-3 text-xs border border-zinc-200 dark:border-zinc-800 focus:outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsReviewModalOpen(false)}
                className="flex-1 rounded-2xl py-3 text-xs border-zinc-200 dark:border-zinc-850"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className={`flex-1 rounded-2xl py-3 text-xs flex items-center justify-center gap-2 border-none ${
                  decision === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {decision === 'approved' ? 'Setujui' : 'Tolak'} Pengajuan
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </BaseModal>

      {/* Refund Decision Modal */}
      <BaseModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        title={refundDecision === 'refunded' ? 'Selesaikan Refund Klaim' : 'Tolak Refund Klaim'}
      >
        {selectedRefundClaim && (
          <form onSubmit={handleSubmitRefund} className="space-y-4 p-1">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
              {refundDecision === 'refunded'
                ? `Apakah Anda yakin ingin menandai refund ini sudah sukses diproses untuk ${selectedRefundClaim.childData.name}? Tindakan ini akan memperbarui status transaksi pembayaran terkait menjadi Failed (Refunded) secara administratif.`
                : `Apakah Anda yakin ingin menolak refund untuk ${selectedRefundClaim.childData.name}? Tindakan ini akan menandai status pengembalian dana tersebut sebagai Ditolak.`}
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                Catatan Refund / Alasan Penolakan {refundDecision === 'refund_rejected' ? <span className="text-red-500 font-black">(WAJIB)</span> : <span className="text-zinc-400">(Opsional)</span>}
              </label>
              <textarea
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
                placeholder={refundDecision === 'refund_rejected' ? "Berikan keterangan alasan penolakan refund..." : "Catatan administratif tambahan..."}
                rows={3}
                className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-2xl px-4 py-3 text-xs border border-zinc-200 dark:border-zinc-800 focus:outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsRefundModalOpen(false)}
                className="flex-1 rounded-2xl py-3 text-xs border-zinc-200 dark:border-zinc-850"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={refundSubmitting}
                className={`flex-1 rounded-2xl py-3 text-xs flex items-center justify-center gap-2 border-none ${
                  refundDecision === 'refunded' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {refundSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {refundDecision === 'refunded' ? 'Tandai Refunded' : 'Tolak Refund'}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </BaseModal>

      {/* Document Viewer Modal */}
      <BaseModal 
        isOpen={viewingDoc !== null}
        onClose={() => setViewingDoc(null)}
        title={viewingDoc?.name || 'Berkas Lampiran'}
      >
        {viewingDoc && (
          <div className="space-y-4 p-1">
            <div className="border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden max-h-[360px] flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
              {viewingDoc.dataUrl.startsWith('data:application/pdf') ? (
                <div className="p-10 text-center space-y-2">
                  <FileText size={48} className="text-zinc-400 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-500">Berkas PDF terenkripsi lokal.</p>
                  <a 
                    href={viewingDoc.dataUrl} 
                    download={viewingDoc.name}
                    className="inline-block text-xs text-brand-navy dark:text-brand-orange font-bold underline"
                  >
                    Unduh file PDF untuk melihatnya
                  </a>
                </div>
              ) : (
                <img 
                  src={viewingDoc.dataUrl} 
                  alt="Attachment" 
                  className="max-h-[320px] object-contain"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setViewingDoc(null)} className="rounded-2xl py-2 px-6 text-xs">
                Tutup
              </Button>
            </div>
          </div>
        )}
      </BaseModal>
    </div>
  );
};

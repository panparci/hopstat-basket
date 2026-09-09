import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimService } from '../services/claimService';
import { ClaimRequest } from '../core/types/claim';
import { initDB } from '../lib/db';
import { PaymentRecord } from '../core/types/serviceRequests';
import { authService } from '../services/authService';
import { useToast } from '../core/contexts/ToastContext';
import { ArrowLeft, FileText, CheckCircle2, XCircle, Clock, ExternalLink, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const ClaimStatusPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [payments, setPayments] = useState<Record<string, PaymentRecord>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserClaims();
  }, []);

  const loadUserClaims = async () => {
    setLoading(true);
    try {
      const activeUser = await authService.getCurrentUser();
      if (!activeUser) {
        showToast('Silakan login terlebih dahulu', 'error');
        navigate('/login');
        return;
      }

      // Fetch user claims
      const userClaims = await claimService.getUserClaims(activeUser.id);
      
      // Sort: newest first
      userClaims.sort((a, b) => b.createdAt - a.createdAt);
      setClaims(userClaims);

      // Fetch corresponding payment records
      const db = await initDB();
      const allPayments = await db.getAll('payments');
      const paymentsMap: Record<string, PaymentRecord> = {};
      allPayments.forEach(p => {
        paymentsMap[p.id] = p;
      });
      setPayments(paymentsMap);

      // Mark all fetched claims as seen/read in localStorage
      userClaims.forEach(claim => {
        localStorage.setItem(`claim_seen_${claim.id}`, claim.updatedAt.toString());
      });

      // Dispatch event to update BottomNav count if needed
      window.dispatchEvent(new Event('claims_read'));

    } catch (err) {
      showToast('Gagal memuat data klaim Anda', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusDisplay = (claim: ClaimRequest) => {
    switch (claim.status) {
      case 'approved':
        return {
          title: 'Klaim Disetujui',
          color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30',
          icon: <CheckCircle2 size={16} />,
          desc: 'Dokumen Kartu Keluarga Anda telah tervalidasi dengan sukses. Profil atlet kini resmi terhubung dengan akun Anda.'
        };
      case 'rejected':
        return {
          title: 'Klaim Ditolak',
          color: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30',
          icon: <XCircle size={16} />,
          desc: 'Pengajuan ditolak setelah peninjauan dokumen bukti oleh Admin.'
        };
      default:
        return {
          title: 'Menunggu Review',
          color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30',
          icon: <Clock size={16} className="animate-pulse" />,
          desc: 'Berkas dan pembayaran Anda berhasil diterima. Tim Admin sedang meninjau keaslian hubungan Kartu Keluarga (KK).'
        };
    }
  };

  const getRefundStatusDisplay = (paymentStatus?: ClaimRequest['paymentStatus']) => {
    switch (paymentStatus) {
      case 'refunded':
        return {
          title: 'Sudah Direfund',
          color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40',
          desc: 'Dana administrasi pendaftaran klaim Anda telah berhasil ditransfer kembali ke rekening asal Anda.'
        };
      case 'refund_rejected':
        return {
          title: 'Refund Ditolak',
          color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40',
          desc: 'Pengembalian dana ditolak oleh Admin. Silakan periksa catatan penolakan refund di bawah.'
        };
      case 'refund_pending':
        return {
          title: 'Refund Diproses',
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40',
          desc: 'Klaim Anda ditolak. Dana pengembalian masuk antrean pengembalian otomatis HoopStats.'
        };
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 pb-24 transition-colors font-sans">
      <header className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-950 sticky top-0 z-30 border-b border-zinc-100 dark:border-zinc-800">
        <button 
          onClick={() => navigate('/')}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
        >
          <ArrowLeft size={20} className="text-brand-navy dark:text-zinc-400" />
        </button>
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-brand-navy dark:text-brand-orange" />
          <h1 className="text-xl font-display font-bold text-brand-navy dark:text-white uppercase tracking-wide">Klaim Saya</h1>
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-2xl mx-auto">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400">
            <div className="w-8 h-8 border-4 border-brand-navy dark:border-brand-orange border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold">Memuat riwayat klaim Anda...</p>
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center p-10 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 mb-4 border border-zinc-100 dark:border-zinc-700">
              <FileText size={28} className="opacity-70 text-zinc-400 dark:text-zinc-500" />
            </div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-1">
              Belum Ada Klaim
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 max-w-xs leading-relaxed">
              Anda belum pernah mengajukan hak wali (claim) untuk profil atlet manapun di HoopStats.
            </p>
            <button
              onClick={() => navigate('/claim')}
              className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy px-6 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase shadow-sm transition-transform hover:scale-[1.02]"
            >
              Cari Atlet Sekarang
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => {
              const statusInfo = getStatusDisplay(claim);
              const refundInfo = claim.status === 'rejected' ? getRefundStatusDisplay(claim.paymentStatus) : null;
              const payment = claim.paymentId ? payments[claim.paymentId] : null;

              return (
                <motion.div
                  key={claim.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4"
                >
                  {/* Claim Profile Info */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
                        Klaim Wali Atlet
                      </span>
                      <h3 className="font-display font-black text-lg text-zinc-900 dark:text-white leading-tight uppercase italic">
                        {claim.childData.name}
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        Tahun Lahir: <span className="font-semibold font-mono">{claim.childData.dob ? claim.childData.dob.split('-')[0] : '-'}</span> • Gender: <span className="font-semibold">{claim.childData.gender === 'M' ? 'Putra' : 'Putri'}</span>
                      </p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 font-mono">
                        ID Pengajuan: {claim.id}
                      </p>
                    </div>

                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${statusInfo.color}`}>
                      {statusInfo.icon}
                      {statusInfo.title}
                    </div>
                  </div>

                  {/* Status Explanation card */}
                  <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                    <p className="font-medium leading-relaxed">
                      {statusInfo.desc}
                    </p>
                  </div>

                  {/* Reject / Refund Section */}
                  {claim.status === 'rejected' && (
                    <div className="p-4 bg-red-50/40 dark:bg-red-950/10 rounded-2xl border border-red-100/50 dark:border-red-950/20 space-y-3">
                      {claim.reviewNote && (
                        <div className="text-xs">
                          <span className="font-bold text-red-800 dark:text-red-400 uppercase text-[9px] tracking-wider block mb-0.5">Catatan Administrator:</span>
                          <p className="text-zinc-700 dark:text-zinc-300 italic">"{claim.reviewNote}"</p>
                        </div>
                      )}

                      {/* Refund Status Card */}
                      {refundInfo && (
                        <div className="pt-2 border-t border-zinc-200/40 dark:border-zinc-800/60 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Status Refund Transaksi:</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${refundInfo.color}`}>
                              {refundInfo.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                            {refundInfo.desc}
                          </p>
                          <div className="text-[9px] text-zinc-400/80">
                            * Integrasi API payment gateway otomatis (seperti Midtrans/Xendit) menyusul di produksi.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Metadata Row */}
                  {payment && (
                    <div className="flex justify-between items-center text-[10px] text-zinc-400 dark:text-zinc-500 font-mono py-1 border-t border-zinc-100 dark:border-zinc-800/60">
                      <span>Metode: {payment.method?.toUpperCase() || 'MANUAL_TRANSFER'}</span>
                      <span>ID Trx: {payment.id}</span>
                      <span>Jumlah: Rp {payment.amount.toLocaleString('id-ID')}</span>
                    </div>
                  )}

                  {/* Approved Action - View Profile */}
                  {claim.status === 'approved' && (
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() => navigate(`/gallery/${claim.profileId}`)}
                        className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy text-xs font-bold px-4 py-2.5 rounded-xl uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all hover:opacity-90"
                      >
                        <ExternalLink size={14} />
                        Lihat Profil Atlet Terverifikasi
                      </button>
                    </div>
                  )}

                </motion.div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
};

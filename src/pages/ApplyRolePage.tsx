import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Clock, XCircle, ArrowLeft, Send } from 'lucide-react';
import { Button } from '../components/atoms/Button';
import { usePermissions } from '../core/contexts/PermissionsContext';
import { useToast } from '../core/contexts/ToastContext';
import { applicationService } from '../services/applicationService';
import { authService } from '../services/authService';
import { RoleApplication } from '../core/types/roleApplication';

export const ApplyRolePage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, refreshPermissions } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [userApps, setUserApps] = useState<RoleApplication[]>([]);
  const [requestedRole, setRequestedRole] = useState<'statistician' | 'coach'>('statistician');
  const [motivation, setMotivation] = useState('');
  const [experience, setExperience] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUserApps();
  }, [user]);

  const loadUserApps = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const apps = await applicationService.getUserApplications(user.id);
      setUserApps(apps);
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!motivation.trim()) {
      showToast('Motivasi wajib diisi!', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await applicationService.createApplication(
        user.id,
        user.name,
        user.email,
        requestedRole,
        motivation.trim(),
        experience.trim()
      );
      showToast(`Pengajuan sebagai ${requestedRole === 'statistician' ? 'Statistician' : 'Coach'} berhasil dikirim!`, 'success');
      setMotivation('');
      setExperience('');
      await loadUserApps();
      await refreshPermissions();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirim pengajuan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent dark:border-brand-orange rounded-full animate-spin" />
      </div>
    );
  }

  const pendingApp = userApps.find(app => app.status === 'pending');
  const hasPending = !!pendingApp;
  const rejectedApps = userApps.filter(app => app.status === 'rejected');

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-4 pb-12 font-sans text-zinc-900 dark:text-zinc-100">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer uppercase tracking-wider"
      >
        <ArrowLeft size={16} />
        Kembali
      </button>

      {/* Header Card */}
      <div className="bg-[#0B1E36] text-white p-6 rounded-2xl border border-zinc-800 shadow-md">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-brand-orange/20 text-brand-orange shrink-0">
            <Award size={32} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">Ajukan Peran Profesional</h1>
            <p className="text-xs text-zinc-300 mt-1">
              Bantu catat statistik, berikan analisis taktis, dan buka fitur premium HoopStats.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {hasPending ? (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-brand-orange font-black text-xs uppercase tracking-widest">
            <Clock size={16} className="animate-pulse shrink-0" />
            <span>Pengajuan Menunggu Review Admin</span>
          </div>
          <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl text-sm">
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Peran yang diajukan</span>
              <span className="font-extrabold text-zinc-800 dark:text-white capitalize">{pendingApp.requestedRole}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Motivasi Bergabung</span>
              <p className="text-zinc-650 dark:text-zinc-300 leading-relaxed mt-0.5 italic">"{pendingApp.motivation}"</p>
            </div>
            {pendingApp.experience && (
              <div>
                <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Pengalaman Terkait</span>
                <p className="text-zinc-650 dark:text-zinc-300 leading-relaxed mt-0.5">{pendingApp.experience}</p>
              </div>
            )}
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-150 dark:border-zinc-800">
              Diajukan pada: {new Date(pendingApp.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center leading-relaxed">
            Tim kami sedang melakukan review terhadap pengajuan Anda. Mohon tunggu proses persetujuan admin.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-6">
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800">
            Formulir Pengajuan Peran
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Pilih Peran <span className="text-red-500">*</span>
              </label>
              <select
                value={requestedRole}
                onChange={(e) => setRequestedRole(e.target.value as any)}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-semibold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all cursor-pointer"
              >
                <option value="statistician">Statistician (Petugas Pencatat Statistik Lapangan)</option>
                <option value="coach">Coach / Pelatih Kepala (Analis Taktis Pertandingan)</option>
              </select>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 leading-relaxed">
                {requestedRole === 'statistician' 
                  ? 'Mendapatkan akses pencatatan statistik langsung (Live Tracking) di pertandingan basket.'
                  : 'Mendapatkan akses melakukan analisis taktis (Coach Review/Analysis) pertandingan yang telah selesai.'
                }
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Motivasi Bergabung <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-semibold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
                placeholder="Jelaskan secara detail alasan mengapa Anda ingin mengisi peran ini..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Pengalaman Terkait (Opsional)
              </label>
              <textarea
                rows={3}
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-semibold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
                placeholder="Contoh: Pengalaman melatih tim, mencatat stats turnamen, dsb..."
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || !motivation.trim()}
                className="bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl disabled:opacity-50 flex items-center gap-2 shadow-md hover:scale-[1.02] duration-150"
              >
                <Send size={14} />
                {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Rejected Applications */}
      {rejectedApps.length > 0 && !hasPending && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 p-5 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 font-bold text-red-700 dark:text-red-400 text-xs uppercase tracking-widest">
            <XCircle size={16} />
            <span>Riwayat Pengajuan Sebelumnya Ditolak</span>
          </div>
          <div className="space-y-3">
            {rejectedApps.map(app => (
              <div key={app.id} className="text-xs text-zinc-600 dark:text-zinc-400 pl-4 border-l-2 border-red-200 dark:border-red-900/40 py-1 space-y-1">
                <p><strong>Peran:</strong> {app.requestedRole === 'statistician' ? 'Statistician' : 'Coach'}</p>
                <p><strong>Motivasi:</strong> "{app.motivation}"</p>
                <p className="text-red-650 dark:text-red-400"><strong>Catatan Reviewer:</strong> {app.reviewNote || 'Tidak ada catatan khusus dari admin'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

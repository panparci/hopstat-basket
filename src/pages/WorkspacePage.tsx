import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, ShieldAlert, Award, FileText, CheckCircle, ChevronRight } from 'lucide-react';
import { usePermissions } from '../core/contexts/PermissionsContext';
import { useToast } from '../core/contexts/ToastContext';
import { statsService } from '../core/services/statsService';
import { Match } from '../core/types/stats';
import { StatTasksPage } from './services/StatTasksPage';
import { Card } from '../components/atoms/Card';

export const WorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, user, loading: permLoading } = usePermissions();
  const { showToast } = useToast();

  const [qaMatches, setQaMatches] = useState<Match[]>([]);
  const [coachMatches, setCoachMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine available tabs based on user permissions
  const hasInputPerm = can('do_stat_tasks');
  const hasQaPerm = can('do_qa_review');
  const hasCoachPerm = can('do_coach_analysis');

  const tabParam = searchParams.get('tab');
  const defaultTab = tabParam || (hasInputPerm ? 'input' : hasQaPerm ? 'qa' : hasCoachPerm ? 'coach' : 'input');
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    loadWorkspaceMatches();
  }, []);

  const loadWorkspaceMatches = async () => {
    setLoading(true);
    try {
      const allMatches = await statsService.getMatches();
      // Tab Review QA shows match with productionStage === 'qa_review'
      const qaQueue = allMatches.filter(m => m.productionStage === 'qa_review' && m.status !== 'aborted');
      setQaMatches(qaQueue);

      // Tab Coach Analysis shows match with productionStage === 'coach_analysis'
      const coachQueue = allMatches.filter(m => m.productionStage === 'coach_analysis' && m.status !== 'aborted');
      setCoachMatches(coachQueue);
    } catch (err) {
      console.error('Failed to load workspace matches:', err);
      showToast('Gagal memuat antrean ruang kerja', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent dark:border-brand-orange rounded-full animate-spin" />
      </div>
    );
  }

  // If user doesn't have ANY workspace permissions, show access denied
  if (!hasInputPerm && !hasQaPerm && !hasCoachPerm) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 min-h-[60vh] font-sans">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/20 text-red-500 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert size={36} />
        </div>
        <h2 className="text-xl font-black uppercase text-zinc-800 dark:text-white tracking-tight mb-2">Akses Terbatas</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md leading-relaxed">
          Akun Anda tidak memiliki peran atau izin untuk mengakses modul Ruang Kerja internal. Silakan hubungi admin jika ini kesalahan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 font-sans text-zinc-900 dark:text-zinc-100">
      {/* Upper Navigation Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto scrollbar-none gap-2">
        {hasInputPerm && (
          <button
            onClick={() => setActiveTab('input')}
            className={`py-3 px-4 font-black text-xs uppercase tracking-wider whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeTab === 'input'
                ? 'border-brand-orange text-brand-orange'
                : 'border-transparent text-zinc-400 hover:text-zinc-650'
            }`}
          >
            Tugas Input
          </button>
        )}
        {hasQaPerm && (
          <button
            onClick={() => setActiveTab('qa')}
            className={`py-3 px-4 font-black text-xs uppercase tracking-wider whitespace-nowrap border-b-2 transition-all cursor-pointer relative ${
              activeTab === 'qa'
                ? 'border-brand-orange text-brand-orange'
                : 'border-transparent text-zinc-400 hover:text-zinc-650'
            }`}
          >
            Review QA
            {qaMatches.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                {qaMatches.length}
              </span>
            )}
          </button>
        )}
        {hasCoachPerm && (
          <button
            onClick={() => setActiveTab('coach')}
            className={`py-3 px-4 font-black text-xs uppercase tracking-wider whitespace-nowrap border-b-2 transition-all cursor-pointer relative ${
              activeTab === 'coach'
                ? 'border-brand-orange text-brand-orange'
                : 'border-transparent text-zinc-400 hover:text-zinc-650'
            }`}
          >
            Analisis Coach
            {coachMatches.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                {coachMatches.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Tab Contents */}
      <div className="mt-4">
        {activeTab === 'input' && hasInputPerm && (
          <div className="animation-fade">
            <StatTasksPage />
          </div>
        )}

        {activeTab === 'qa' && hasQaPerm && (
          <div className="space-y-4 animation-fade">
            <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="p-3 bg-brand-orange/10 text-brand-orange rounded-2xl">
                <FileText size={24} />
              </div>
              <div>
                <h1 className="text-lg font-black uppercase tracking-tight">Antrean Pemeriksaan Kualitas (QA)</h1>
                <p className="text-xs text-zinc-500">Periksa dan validasi keakuratan data statistik pertandingan sebelum diteruskan ke coach.</p>
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent dark:border-brand-orange rounded-full animate-spin" />
              </div>
            ) : qaMatches.length === 0 ? (
              <Card className="p-8 text-center border-none shadow-sm flex flex-col items-center justify-center bg-white dark:bg-zinc-900 h-48">
                <CheckCircle size={32} className="text-emerald-500 mb-2" />
                <h3 className="font-bold text-zinc-850 dark:text-white mb-1 text-sm uppercase tracking-wider">Semua Bersih!</h3>
                <p className="text-xs text-zinc-500">Tidak ada pertandingan yang menunggu review pemeriksaan kualitas saat ini.</p>
              </Card>
            ) : (
              <div className="grid gap-3">
                {qaMatches.map(match => (
                  <Card key={match.id} className="p-5 border-none shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900">
                    <div>
                      <div className="text-xs font-bold text-zinc-400 mb-1">
                        {match.date ? new Date(match.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Tanggal tidak tersedia'}
                      </div>
                      <h3 className="font-bold text-zinc-850 dark:text-white uppercase text-base">{match.name}</h3>
                      <div className="flex gap-2 items-center mt-2">
                        <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded uppercase">QA Review</span>
                        {match.competitionGrade && (
                          <span className="text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded uppercase">KU-{match.competitionGrade}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/qa/${match.id}`)}
                      className="flex items-center justify-center gap-2 px-5 py-3 bg-[#0B1E36] hover:bg-brand-orange hover:text-[#0B1E36] text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95 duration-150 cursor-pointer shadow-sm shrink-0"
                    >
                      Mulai Periksa
                      <ChevronRight size={14} />
                    </button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'coach' && hasCoachPerm && (
          <div className="space-y-4 animation-fade">
            <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="p-3 bg-brand-orange/10 text-brand-orange rounded-2xl">
                <Award size={24} />
              </div>
              <div>
                <h1 className="text-lg font-black uppercase tracking-tight">Antrean Analisis Taktis Coach</h1>
                <p className="text-xs text-zinc-500">Berikan ulasan performa, rating, dan publish laporan statistik resmi atlet Anda.</p>
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent dark:border-brand-orange rounded-full animate-spin" />
              </div>
            ) : coachMatches.length === 0 ? (
              <Card className="p-8 text-center border-none shadow-sm flex flex-col items-center justify-center bg-white dark:bg-zinc-900 h-48">
                <CheckCircle size={32} className="text-emerald-500 mb-2" />
                <h3 className="font-bold text-zinc-850 dark:text-white mb-1 text-sm uppercase tracking-wider">Antrean Kosong</h3>
                <p className="text-xs text-zinc-500">Semua pertandingan yang selesai telah dianalisis dan dipublikasikan.</p>
              </Card>
            ) : (
              <div className="grid gap-3">
                {coachMatches.map(match => (
                  <Card key={match.id} className="p-5 border-none shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900">
                    <div>
                      <div className="text-xs font-bold text-zinc-400 mb-1">
                        {match.date ? new Date(match.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Tanggal tidak tersedia'}
                      </div>
                      <h3 className="font-bold text-zinc-850 dark:text-white uppercase text-base">{match.name}</h3>
                      <div className="flex gap-2 items-center mt-2">
                        <span className="text-[10px] font-black bg-purple-100 text-purple-600 px-2 py-0.5 rounded uppercase">Coach Analysis</span>
                        {match.competitionGrade && (
                          <span className="text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded uppercase">KU-{match.competitionGrade}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/coach-analysis/${match.id}`)}
                      className="flex items-center justify-center gap-2 px-5 py-3 bg-[#0B1E36] hover:bg-brand-orange hover:text-[#0B1E36] text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95 duration-150 cursor-pointer shadow-sm shrink-0"
                    >
                      Mulai Analisis
                      <ChevronRight size={14} />
                    </button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

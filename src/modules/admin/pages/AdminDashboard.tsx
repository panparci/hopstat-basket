import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Settings, 
  Zap, 
  Database, 
  Users, 
  MessageSquare,
  ChevronRight,
  FileText,
  Shield,
  UserCheck,
  Award,
  Target
} from 'lucide-react';
import { BottomNav } from '../../../components/atoms/BottomNav';
import { Card } from '../../../components/atoms/Card';
import { Can } from '../../../core/contexts/PermissionsContext';
import { Permission } from '../../../core/config/permissions';
import { applicationService } from '../../../services/applicationService';
import { claimService } from '../../../services/claimService';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = React.useState(0);
  const [pendingClaimsCount, setPendingClaimsCount] = React.useState(0);

  React.useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const apps = await applicationService.getApplications('pending');
        setPendingCount(apps.length);
      } catch (err) {
        console.error('Failed to load pending applications count', err);
      }
    };
    const fetchPendingClaimsCount = async () => {
      try {
        const claims = await claimService.getClaims();
        const pendingClaims = claims.filter(c => c.status === 'pending');
        setPendingClaimsCount(pendingClaims.length);
      } catch (err) {
        console.error('Failed to load pending claims count', err);
      }
    };
    fetchPendingCount();
    fetchPendingClaimsCount();
  }, []);

  const menuItems = [
    {
      id: 'crm',
      title: 'CRM Lead Capture',
      description: 'Kelola data prospek, status follow-up, & catatan interaksi.',
      icon: Users,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      path: '/admin/crm',
      permission: 'manage_crm' as Permission
    },
    {
      id: 'users',
      title: 'Manajemen Pengguna',
      description: 'Kelola pendaftaran user, ubah role (admin, statistician, dll), atau tangguhkan akun.',
      icon: UserCheck,
      color: 'text-sky-500',
      bg: 'bg-sky-500/10',
      path: '/admin/users',
      permission: 'manage_users' as Permission
    },
    {
      id: 'applications',
      title: 'Persetujuan Peran',
      description: 'Review pengajuan pendaftaran dari pengguna untuk menjadi Statistician / Scout.',
      icon: Award,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
      path: '/admin/applications',
      permission: 'approve_applications' as Permission,
      badge: pendingCount > 0 ? pendingCount : undefined
    },
    {
      id: 'claims',
      title: 'Persetujuan Klaim Atlet',
      description: 'Review dokumen & pembayaran dari orang tua untuk mengklaim statistik profil anak.',
      icon: Award,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      path: '/admin/claims',
      permission: 'approve_applications' as Permission,
      badge: pendingClaimsCount > 0 ? pendingClaimsCount : undefined
    },
    {
      id: 'fundamentals',
      title: 'Kurikulum & Library Fundamental',
      description: 'Kelola video drill fundamental, kurikulum latihan, & materi AI coach.',
      icon: Target,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      path: '/fundamentals',
      permission: 'view_home' as Permission
    },
    {
      id: 'cms',
      title: 'Landing CMS Editor',
      description: 'Edit konten landing page, headline, harga, testimoni, & FAQ tanpa kode.',
      icon: FileText,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      path: '/admin/cms',
      permission: 'manage_cms' as Permission
    },
    {
      id: 'rbac',
      title: 'Konfigurasi Hak Akses (RBAC)',
      description: 'Atur pemetaan permission untuk masing-masing role secara dinamis dalam matriks.',
      icon: Shield,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
      path: '/admin/roles',
      permission: 'manage_roles_config' as Permission
    },
    {
      id: 'prompt-editor',
      title: 'Prompt Flow Editor',
      description: 'Manage recording sequences for shots, turnovers, and fouls.',
      icon: Zap,
      color: 'text-brand-orange',
      bg: 'bg-yellow-500/10',
      path: '/admin/prompt-editor',
      permission: 'manage_roles_config' as Permission
    },
    {
      id: 'voice-config',
      title: 'Voice Commands',
      description: 'Configure voice aliases and recognition patterns.',
      icon: MessageSquare,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      path: '#'
    },
    {
      id: 'curations',
      title: 'Kurasi Organisasi & Tim',
      description: 'Verifikasi usulan organisasi baru, tandai duplikat, dan lakukan merge data master.',
      icon: Database,
      color: 'text-brand-orange',
      bg: 'bg-yellow-500/10',
      path: '/admin/curations',
      permission: 'approve_applications' as Permission
    },
    {
      id: 'data-mgmt',
      title: 'Data Management',
      description: 'Export/Import database and reset local storage.',
      icon: Database,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      path: '#'
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Soft Modern Hero Banner */}
      <div className="bg-gradient-to-r from-[#246A78] via-[#2B889B] to-[#45A8B9] text-white p-6 sm:p-8 rounded-[28px] shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[11px] font-black uppercase tracking-wider text-amber-300 mb-3 border border-white/20">
            <Shield size={13} /> Control Panel Overview
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white leading-tight">
            Admin Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-teal-50 mt-2 leading-relaxed">
            Pusat tata kelola operasional, verifikasi peran, kurasi data, dan manajemen platform HoopStats.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/admin/claims')}
            className="px-4 py-2.5 bg-amber-300 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-2xl uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <Award size={16} /> Verifikasi Klaim ({pendingClaimsCount})
          </button>
        </div>
        {/* Soft background glow circles */}
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Soft Pastel Summary Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Pending Claims */}
        <div 
          onClick={() => navigate('/admin/claims')}
          className="bg-gradient-to-br from-[#E2F4F7] to-[#CBEBF0] dark:from-teal-950/40 dark:to-cyan-950/30 border border-teal-100 dark:border-teal-900/40 rounded-[24px] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
        >
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-800 dark:text-teal-300 block mb-1">
              Klaim Profil Atlet
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {pendingClaimsCount} <span className="text-xs font-bold text-teal-700 dark:text-teal-400">Pending</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
              Menunggu verifikasi orang tua
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
            <Award size={24} />
          </div>
        </div>

        {/* Card 2: Pending Role Applications */}
        <div 
          onClick={() => navigate('/admin/applications')}
          className="bg-gradient-to-br from-[#FDF0E6] to-[#F7E1D3] dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-100 dark:border-amber-900/40 rounded-[24px] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
        >
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800 dark:text-amber-300 block mb-1">
              Persetujuan Peran
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {pendingCount} <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Pengajuan</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
              Scout & Statistician baru
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <UserCheck size={24} />
          </div>
        </div>

        {/* Card 3: Platform Health */}
        <div 
          onClick={() => navigate('/admin/users')}
          className="bg-gradient-to-br from-[#E8F1F5] to-[#D5E4EB] dark:from-slate-900/60 dark:to-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-[24px] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
        >
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-slate-300 block mb-1">
              Status Sistem
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse inline-block" /> Active
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
              Semua modul berjalan normal
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-500/15 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
            <Zap size={24} />
          </div>
        </div>
      </div>

      {/* Feature Menu Items Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {menuItems.map((item) => {
          const cardElement = (
            <div
              key={item.id}
              onClick={item.path !== '#' ? () => navigate(item.path) : undefined}
              className={`w-full bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800 rounded-[24px] p-5 transition-all text-left flex items-center justify-between shadow-sm ${
                item.path !== '#' 
                  ? 'hover:shadow-md hover:border-teal-300/60 dark:hover:border-teal-700/60 cursor-pointer active:scale-[0.99]' 
                  : 'opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center shrink-0 shadow-xs`}>
                  <item.icon size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-900 dark:text-white leading-none text-sm">{item.title}</h3>
                    {item.badge !== undefined && (
                      <span className="bg-amber-300 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full leading-none shadow-xs">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1">{item.description}</p>
                </div>
              </div>
              {item.path !== '#' && <ChevronRight size={18} className="text-slate-400 dark:text-zinc-600 shrink-0" />}
            </div>
          );

          if (item.permission) {
            return (
              <Can key={item.id} permission={item.permission}>
                {cardElement}
              </Can>
            );
          }

          return cardElement;
        })}
      </div>

      {/* Developer System Info Panel */}
      <div className="p-6 bg-gradient-to-r from-[#243440] to-[#1C2C36] rounded-[28px] text-white shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={16} className="text-amber-300" />
          <span className="text-xs font-black text-amber-300 uppercase tracking-widest">Sistem & Arsitektur Data</span>
        </div>
        <p className="text-slate-300 text-xs mb-4">
          Status konfigurasi runtime: data domain di PostgreSQL (VPS). Video tidak disimpan di database.
        </p>
        <div className="bg-black/20 rounded-2xl p-4 border border-white/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Storage Layer</span>
              <span className="text-white font-bold">PostgreSQL (VPS)</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Recording Engine</span>
              <span className="text-white font-bold">Voice & Event Tap</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">RBAC Enforcement</span>
              <span className="text-amber-300 font-bold">Dynamic Matrix</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">App Release</span>
              <span className="text-white font-bold">v1.2.0-beta</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

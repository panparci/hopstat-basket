import { UserRole } from '../types/serviceRequests';

export type Permission =
  | 'view_home'
  | 'track_match'
  | 'view_matches'
  | 'view_published_story'
  | 'view_own_stats'
  | 'request_stats'
  | 'do_stat_tasks'
  | 'view_gallery'
  | 'manage_users'
  | 'manage_roles_config'
  | 'manage_crm'
  | 'manage_cms'
  | 'assign_stat_tasks'
  | 'approve_applications'
  | 'manage_teams'
  | 'manage_profiles'
  | 'manage_athletes'
  | 'do_qa_review'
  | 'do_coach_analysis';

export interface PermissionDetails {
  id: Permission;
  name: string;
  description: string;
  category: 'General' | 'Stats & Tracking' | 'Management' | 'Core Admin';
}

export const PERMISSION_CATALOG: Record<Permission, PermissionDetails> = {
  view_home: {
    id: 'view_home',
    name: 'Lihat Beranda',
    description: 'Mengizinkan user melihat halaman utama / dashboard dasar.',
    category: 'General',
  },
  view_gallery: {
    id: 'view_gallery',
    name: 'Lihat Galeri',
    description: 'Mengizinkan user mengakses galeri media / rekaman pertandingan.',
    category: 'General',
  },
  track_match: {
    id: 'track_match',
    name: 'Catat Statistik (Tracking)',
    description: 'Mengizinkan user melakukan pencatatan statistik langsung (Live Tracking) di pertandingan.',
    category: 'Stats & Tracking',
  },
  view_own_stats: {
    id: 'view_own_stats',
    name: 'Lihat Statistik Sendiri/Tim',
    description: 'Mengizinkan user melihat visualisasi statistik performa tim/pemain yang dimiliki.',
    category: 'Stats & Tracking',
  },
  request_stats: {
    id: 'request_stats',
    name: 'Ajukan Jasa Statistik',
    description: 'Mengizinkan user mengajukan pesanan pencatatan statistik berbayar oleh statistician profesional.',
    category: 'Stats & Tracking',
  },
  do_stat_tasks: {
    id: 'do_stat_tasks',
    name: 'Kerjakan Tugas Statistik',
    description: 'Mengizinkan statistician melihat daftar tugas penugasan & melakukan pencatatan pesanan.',
    category: 'Stats & Tracking',
  },
  manage_teams: {
    id: 'manage_teams',
    name: 'Kelola Tim',
    description: 'Mengizinkan user membuat, memperbarui, dan menghapus data tim basket.',
    category: 'Management',
  },
  manage_profiles: {
    id: 'manage_profiles',
    name: 'Kelola Profil Pemain',
    description: 'Mengizinkan user membuat, memperbarui, dan mengelola profil anak/pemain.',
    category: 'Management',
  },
  manage_athletes: {
    id: 'manage_athletes',
    name: 'Kelola Direktori Atlet',
    description: 'Mengizinkan admin melihat daftar semua atlet, membuat atlet baru, serta menautkan guardian secara manual.',
    category: 'Management',
  },
  manage_users: {
    id: 'manage_users',
    name: 'Kelola Pengguna',
    description: 'Mengizinkan admin melihat daftar pengguna sistem dan mengubah status akun (mis. Suspend).',
    category: 'Core Admin',
  },
  manage_roles_config: {
    id: 'manage_roles_config',
    name: 'Konfigurasi Hak Akses (RBAC)',
    description: 'Mengizinkan admin mengatur pemetaan permission untuk masing-masing role secara dinamis.',
    category: 'Core Admin',
  },
  manage_crm: {
    id: 'manage_crm',
    name: 'Kelola CRM (Leads)',
    description: 'Mengizinkan tim sales/admin mengelola prospek pendaftaran kelas/langganan (Leads CRM).',
    category: 'Core Admin',
  },
  manage_cms: {
    id: 'manage_cms',
    name: 'Kelola CMS (Situs)',
    description: 'Mengizinkan admin mengedit konten situs utama / landing page secara dinamis.',
    category: 'Core Admin',
  },
  assign_stat_tasks: {
    id: 'assign_stat_tasks',
    name: 'Tugaskan Statistician',
    description: 'Mengizinkan admin menugaskan statistician tertentu untuk mengerjakan request pesanan.',
    category: 'Core Admin',
  },
  approve_applications: {
    id: 'approve_applications',
    name: 'Setujui Pembayaran & Request',
    description: 'Mengizinkan admin memvalidasi bukti transfer pembayaran dan menyetujui order jasa statistik.',
    category: 'Core Admin',
  },
  do_qa_review: {
    id: 'do_qa_review',
    name: 'Pemeriksaan Kualitas (QA)',
    description: 'Mengizinkan user memeriksa kualitas data statistik (Review QA) sebelum dilanjutkan.',
    category: 'Stats & Tracking',
  },
  do_coach_analysis: {
    id: 'do_coach_analysis',
    name: 'Analisis Coach',
    description: 'Mengizinkan coach menganalisis pertandingan yang telah diverifikasi dan mempublikasikannya.',
    category: 'Stats & Tracking',
  },
  view_matches: {
    id: 'view_matches',
    name: 'Melihat Pertandingan',
    description: 'Mengizinkan user melihat/menelusuri daftar & detail pertandingan yang berhak.',
    category: 'Stats & Tracking',
  },
  view_published_story: {
    id: 'view_published_story',
    name: 'Melihat Match Story',
    description: 'Mengizinkan user melihat match story & profil publik ter-publish.',
    category: 'General',
  },
};

export const ALL_PERMISSIONS: Permission[] = Object.keys(PERMISSION_CATALOG) as Permission[];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  statistician: ['view_home', 'view_matches', 'track_match', 'do_stat_tasks', 'view_own_stats'],
  customer: ['view_home', 'view_matches', 'view_own_stats', 'view_published_story', 'request_stats', 'manage_teams', 'manage_profiles'],
  scout: ['view_home', 'view_gallery', 'view_published_story'],
  coach: ['view_home', 'view_matches', 'view_own_stats', 'view_published_story', 'do_coach_analysis'],
};

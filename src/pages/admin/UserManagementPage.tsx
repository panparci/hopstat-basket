import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  ArrowLeft, 
  Search, 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  Lock, 
  Info,
  Filter,
  Calendar,
  Mail,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { authService } from '../../services/authService';
import { rbacService } from '../../services/rbacService';
import { useToast } from '../../core/contexts/ToastContext';
import { usePermissions } from '../../core/contexts/PermissionsContext';
import { BottomNav } from '../../components/atoms/BottomNav';
import { Button } from '../../components/atoms/Button';
import { UserAccount, UserRole } from '../../core/types/serviceRequests';
import { BaseModal } from '../../components/atoms/BaseModal';
import { Avatar } from '../../shared/ui/Avatar';

export const UserManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refreshPermissions } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal / Confirm state
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  const [pendingStatusUser, setPendingStatusUser] = useState<UserAccount | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'active' | 'suspended' | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const activeUser = await authService.getCurrentUser();
      setCurrentUser(activeUser);

      const allUsers = await authService.getAllUsers();
      // Sort users by name
      allUsers.sort((a, b) => a.name.localeCompare(b.name));
      setUsers(allUsers);
    } catch (err) {
      showToast('Gagal memuat data pengguna', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getActiveAdminsCount = (): number => {
    return users.filter(u => u.role === 'admin' && (u.status || 'active') === 'active').length;
  };

  const handleRoleChangeAttempt = (user: UserAccount, targetRole: UserRole) => {
    if (user.id === currentUser?.id) {
      showToast('Anda tidak dapat mengubah role Anda sendiri!', 'error');
      return;
    }

    // Safety check: is this the last active admin and we're demoting them?
    if (user.role === 'admin' && targetRole !== 'admin') {
      const activeAdmins = getActiveAdminsCount();
      if (activeAdmins <= 1) {
        showToast('Gagal: Harus menyisakan minimal 1 Admin aktif di sistem!', 'error');
        return;
      }
    }

    setSelectedUser(user);
    setPendingRole(targetRole);
    setIsRoleModalOpen(true);
  };

  const handleConfirmRoleChange = async () => {
    if (!selectedUser || !pendingRole) return;

    try {
      await authService.updateUserRole(selectedUser.id, pendingRole);
      showToast(`Berhasil mengubah role ${selectedUser.name} menjadi ${pendingRole.toUpperCase()}`, 'success');
      
      // Refresh local user list
      await loadData();
      
      // Refresh context in case currently logged in user is affected
      await refreshPermissions();
    } catch (err) {
      showToast('Gagal memperbarui role pengguna', 'error');
    } finally {
      setIsRoleModalOpen(false);
      setSelectedUser(null);
      setPendingRole(null);
    }
  };

  const handleStatusChangeAttempt = (user: UserAccount, targetStatus: 'active' | 'suspended') => {
    if (user.id === currentUser?.id) {
      showToast('Anda tidak dapat menangguhkan akun Anda sendiri!', 'error');
      return;
    }

    // Safety check: is this the last active admin and we're suspending them?
    if (user.role === 'admin' && targetStatus === 'suspended') {
      const activeAdmins = getActiveAdminsCount();
      if (activeAdmins <= 1) {
        showToast('Gagal: Harus menyisakan minimal 1 Admin aktif di sistem!', 'error');
        return;
      }
    }

    setPendingStatusUser(user);
    setPendingStatus(targetStatus);
    setIsStatusModalOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!pendingStatusUser || !pendingStatus) return;

    try {
      await authService.updateUserStatus(pendingStatusUser.id, pendingStatus);
      const actionText = pendingStatus === 'suspended' ? 'ditangguhkan' : 'diaktifkan kembali';
      showToast(`Akun ${pendingStatusUser.name} berhasil ${actionText}!`, 'success');
      
      // Refresh local user list
      await loadData();
      
      // Refresh context in case currently logged in user is affected
      await refreshPermissions();
    } catch (err) {
      showToast('Gagal memperbarui status pengguna', 'error');
    } finally {
      setIsStatusModalOpen(false);
      setPendingStatusUser(null);
      setPendingStatus(null);
    }
  };

  // Filter users based on query and filters
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    
    const uStatus = u.status || 'active';
    const matchesStatus = statusFilter === 'all' || uStatus === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-800/60';
      case 'statistician':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/60';
      case 'customer':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800/60';
      case 'scout':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60';
      case 'coach':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800/60';
      default:
        return 'bg-zinc-50 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'statistician': return 'Statistician';
      case 'customer': return 'Customer';
      case 'scout': return 'Scout';
      case 'coach': return 'Coach';
      default: return role;
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Tidak diketahui';
    const date = new Date(timestamp);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent dark:border-brand-orange rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-zinc-900 dark:text-zinc-100">
      {/* Top action header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-orange/10 text-brand-orange rounded-2xl">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">Manajemen Pengguna</h1>
            <p className="text-xs text-zinc-500">Kelola pendaftaran user, ubah peran, atau tangguhkan akun.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="flex items-center gap-1 px-4 py-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 rounded-xl transition-all cursor-pointer shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
        >
          <RefreshCw size={12} /> Refresh Data
        </button>
      </div>

      <div className="space-y-6">
        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 p-4 rounded-3xl flex gap-3 text-blue-800 dark:text-blue-400">
          <Info size={20} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-extrabold uppercase block tracking-wider text-blue-900 dark:text-blue-300">Panduan Admin</span>
            <p className="leading-relaxed">
              Anda dapat menaikkan atau menurunkan peran pengguna, serta menangguhkan akses mereka. Untuk alasan keamanan, Anda tidak diizinkan mengubah peran atau menonaktifkan akun Anda sendiri. Sistem juga memastikan minimal ada 1 Admin aktif yang tersisa.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-3.5 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input 
              type="text"
              placeholder="Cari nama atau email pengguna..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <Filter size={10} /> Filter Peran
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs p-2.5 font-bold focus:ring-2 focus:ring-brand-navy"
              >
                <option value="all">Semua Peran</option>
                <option value="admin">Admin</option>
                <option value="statistician">Statistician</option>
                <option value="customer">Customer</option>
                <option value="scout">Scout</option>
                <option value="coach">Coach</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <ShieldAlert size={10} /> Status Akun
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs p-2.5 font-bold focus:ring-2 focus:ring-brand-navy"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif (Active)</option>
                <option value="suspended">Ditangguhkan (Suspended)</option>
              </select>
            </div>
          </div>
        </div>

        {/* User Count Stats */}
        <div className="flex justify-between items-center px-1">
          <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
            Menampilkan {filteredUsers.length} dari {users.length} Pengguna
          </span>
          <span className="text-xs bg-brand-navy/5 dark:bg-brand-orange/10 text-brand-navy dark:text-brand-orange px-2.5 py-1 rounded-xl font-bold border border-brand-navy/10 dark:border-brand-orange/20">
            Admins aktif: {getActiveAdminsCount()}
          </span>
        </div>

        {/* User Cards List */}
        <div className="space-y-3">
          {filteredUsers.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-zinc-200 dark:border-zinc-800 space-y-2">
              <AlertTriangle className="mx-auto text-zinc-400" size={32} />
              <h3 className="font-bold text-sm">Tidak ada pengguna ditemukan</h3>
              <p className="text-xs text-zinc-500">Coba ubah kata kunci pencarian atau filter status Anda.</p>
            </div>
          ) : (
            filteredUsers.map(user => {
              const isSelf = user.id === currentUser?.id;
              const uStatus = user.status || 'active';
              const isSuspended = uStatus === 'suspended';

              return (
                <div 
                  key={user.id} 
                  className={`bg-white dark:bg-zinc-900 rounded-3xl border p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-all ${
                    isSelf 
                      ? 'border-brand-navy/30 dark:border-brand-orange/30 ring-1 ring-brand-navy/10 dark:ring-brand-orange/10 bg-brand-navy/[0.01]' 
                      : isSuspended 
                        ? 'border-red-200 dark:border-red-950 bg-red-500/[0.01]'
                        : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <Avatar name={user.name} photoUrl={user.avatar} size="md" className={isSuspended ? "opacity-50 grayscale" : ""} />

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-zinc-900 dark:text-white truncate max-w-[180px]">
                          {user.name}
                        </span>
                        {isSelf && (
                          <span className="text-[9px] bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy px-1.5 py-0.5 rounded-lg font-black uppercase tracking-wider">
                            Anda
                          </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border uppercase tracking-wider ${getRoleBadgeStyle(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                        {isSuspended && (
                          <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 px-2 py-0.5 rounded-lg font-extrabold border border-red-200 dark:border-red-900/40 uppercase tracking-wider">
                            Suspended
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Mail size={12} className="text-zinc-400" />
                          <span className="truncate">{user.email}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-zinc-400" />
                          <span>Terdaftar: {formatDate(user.createdAt)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-800 md:border-none pt-3.5 md:pt-0 flex-wrap">
                    {/* Role selector dropdown */}
                    <div className="flex flex-col gap-0.5 flex-1 md:flex-initial">
                      <span className="text-[8px] font-black uppercase text-zinc-400 block px-1 tracking-wider">Role</span>
                      <select
                        disabled={isSelf}
                        value={user.role}
                        onChange={(e) => handleRoleChangeAttempt(user, e.target.value as UserRole)}
                        className={`text-xs font-bold rounded-xl border p-2 focus:ring-1 focus:ring-brand-navy outline-none cursor-pointer ${
                          isSelf 
                            ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 cursor-not-allowed'
                            : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                        }`}
                      >
                        <option value="admin">Admin</option>
                        <option value="statistician">Statistician</option>
                        <option value="customer">Customer</option>
                        <option value="scout">Scout</option>
                        <option value="coach">Coach</option>
                      </select>
                    </div>

                    {/* Suspend / Activate toggle */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-black uppercase text-zinc-400 block px-1 tracking-wider text-center">Aksi</span>
                      {isSelf ? (
                        <div 
                          className="px-3.5 py-2 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 font-bold cursor-not-allowed"
                          title="Anda tidak bisa menangguhkan akun Anda sendiri"
                        >
                          <Lock size={12} /> Dikunci
                        </div>
                      ) : isSuspended ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleStatusChangeAttempt(user, 'active')}
                          className="rounded-xl text-xs font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100/50 border border-emerald-200 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-400 flex items-center gap-1 px-3 py-2"
                        >
                          <UserCheck size={13} /> Aktifkan
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleStatusChangeAttempt(user, 'suspended')}
                          className="rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100/50 border border-red-200 dark:border-red-950 dark:bg-red-950/20 dark:text-red-400 flex items-center gap-1 px-3 py-2"
                        >
                          <UserX size={13} /> Tangguhkan
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Role Change Confirmation Modal */}
      <BaseModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="Ubah Role Pengguna"
        icon={<AlertTriangle className="text-amber-500" size={20} />}
      >
        <div className="space-y-4 font-sans text-[#1A1A1A] dark:text-white p-1">
          <p className="text-sm leading-relaxed">
            Apakah Anda yakin ingin mengubah hak akses peran pengguna berikut?
          </p>
          
          {selectedUser && pendingRole && (
            <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Nama Pengguna:</span>
                <span className="font-extrabold">{selectedUser.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Email:</span>
                <span className="font-mono text-zinc-400">{selectedUser.email}</span>
              </div>
              <div className="border-t border-zinc-200/50 dark:border-zinc-700/50 pt-2 flex items-center justify-between text-xs">
                <span className="text-zinc-500">Perubahan Peran:</span>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-zinc-500 line-through">{selectedUser.role.toUpperCase()}</span>
                  <span>&rarr;</span>
                  <span className="text-brand-navy dark:text-brand-orange">{pendingRole.toUpperCase()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 p-3 rounded-xl text-xs flex gap-2">
            <Info size={16} className="shrink-0 mt-0.5" />
            <span>Perubahan ini langsung membatalkan session token pengguna tersebut sehingga hak navigasi &amp; menu mereka akan langsung tersesuaikan.</span>
          </div>

          <div className="flex gap-2.5 justify-end pt-2">
            <Button
              variant="secondary"
              onClick={() => setIsRoleModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmRoleChange}
              className="rounded-xl text-xs bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy border-none font-bold"
            >
              Ya, Ubah Peran
            </Button>
          </div>
        </div>
      </BaseModal>

      {/* Account Status Suspend/Activate Confirmation Modal */}
      <BaseModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={pendingStatus === 'suspended' ? 'Tangguhkan Akun' : 'Aktifkan Kembali Akun'}
        icon={<AlertTriangle className={pendingStatus === 'suspended' ? 'text-red-500' : 'text-emerald-500'} size={20} />}
      >
        <div className="space-y-4 font-sans text-[#1A1A1A] dark:text-white p-1">
          <p className="text-sm leading-relaxed">
            {pendingStatus === 'suspended' 
              ? 'Apakah Anda yakin ingin menangguhkan (suspend) pengguna berikut? Pengguna yang ditangguhkan tidak akan dapat login kembali atau menggunakan aplikasi.'
              : 'Apakah Anda yakin ingin mengaktifkan kembali akun pengguna berikut? Pengguna akan dapat login dan menggunakan aplikasi sesuai peran mereka.'
            }
          </p>
          
          {pendingStatusUser && (
            <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Nama Pengguna:</span>
                <span className="font-extrabold">{pendingStatusUser.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Email:</span>
                <span className="font-mono text-zinc-400">{pendingStatusUser.email}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Status Saat Ini:</span>
                <span className="font-bold uppercase text-zinc-400">{(pendingStatusUser.status || 'active').toUpperCase()}</span>
              </div>
              <div className="border-t border-zinc-200/50 dark:border-zinc-700/50 pt-2 flex justify-between text-xs">
                <span className="text-zinc-500">Target Status:</span>
                <span className={`font-extrabold uppercase ${pendingStatus === 'suspended' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {pendingStatus?.toUpperCase()}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2.5 justify-end pt-2">
            <Button
              variant="secondary"
              onClick={() => setIsStatusModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmStatusChange}
              className={`rounded-xl text-xs border-none font-bold text-white ${
                pendingStatus === 'suspended' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {pendingStatus === 'suspended' ? 'Ya, Tangguhkan' : 'Ya, Aktifkan'}
            </Button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
};

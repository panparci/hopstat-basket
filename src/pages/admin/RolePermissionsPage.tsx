import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Save, RotateCcw, Check, Lock, Info, Table, LayoutGrid } from 'lucide-react';
import { rbacService } from '../../services/rbacService';
import { useToast } from '../../core/contexts/ToastContext';
import { usePermissions } from '../../core/contexts/PermissionsContext';
import { Button } from '../../components/atoms/Button';
import { UserRole } from '../../core/types/serviceRequests';
import { Permission, PERMISSION_CATALOG, ALL_PERMISSIONS } from '../../core/config/permissions';

type ViewMode = 'matrix' | 'tabs';

export const RolePermissionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refreshPermissions } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');
  
  // States to keep track of changes
  const [originalPermissions, setOriginalPermissions] = useState<Record<UserRole, Permission[]>>({} as any);
  const [currentPermissions, setCurrentPermissions] = useState<Record<UserRole, Permission[]>>({} as any);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const data = await rbacService.getRolePermissions();
      // Safe copy
      const copy: Record<UserRole, Permission[]> = {
        admin: [...(data.admin || ALL_PERMISSIONS)],
        statistician: [...(data.statistician || [])],
        customer: [...(data.customer || [])],
        scout: [...(data.scout || [])],
        coach: [...(data.coach || [])],
      };
      setOriginalPermissions(JSON.parse(JSON.stringify(copy)));
      setCurrentPermissions(JSON.parse(JSON.stringify(copy)));
    } catch (err) {
      showToast('Gagal memuat konfigurasi hak akses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCell = (role: UserRole, permission: Permission) => {
    if (role === 'admin') return; // Admin is locked to protect system access

    setCurrentPermissions(prev => {
      const roleList = prev[role] || [];
      const updatedList = roleList.includes(permission)
        ? roleList.filter(p => p !== permission)
        : [...roleList, permission];
      
      return {
        ...prev,
        [role]: updatedList,
      };
    });
  };

  const checkIfChanged = (): boolean => {
    const roles: UserRole[] = ['admin', 'statistician', 'customer', 'scout', 'coach'];
    for (const role of roles) {
      const orig = [...(originalPermissions[role] || [])].sort().join(',');
      const curr = [...(currentPermissions[role] || [])].sort().join(',');
      if (orig !== curr) return true;
    }
    return false;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const roles: UserRole[] = ['admin', 'statistician', 'customer', 'scout', 'coach'];
      for (const role of roles) {
        await rbacService.setRolePermissions(role, currentPermissions[role]);
      }
      
      setOriginalPermissions(JSON.parse(JSON.stringify(currentPermissions)));
      showToast('Konfigurasi hak akses berhasil disimpan!', 'success');
      await refreshPermissions();
    } catch (err) {
      showToast('Gagal menyimpan perubahan hak akses', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Apakah Anda yakin ingin mengembalikan konfigurasi hak akses ke pengaturan default bawaan pabrik?')) {
      setLoading(true);
      try {
        const defaultMap = await rbacService.resetToDefault();
        const copy: Record<UserRole, Permission[]> = {
          admin: [...(defaultMap.admin || ALL_PERMISSIONS)],
          statistician: [...(defaultMap.statistician || [])],
          customer: [...(defaultMap.customer || [])],
          scout: [...(defaultMap.scout || [])],
          coach: [...(defaultMap.coach || [])],
        };
        setOriginalPermissions(JSON.parse(JSON.stringify(copy)));
        setCurrentPermissions(JSON.parse(JSON.stringify(copy)));
        showToast('Hak akses berhasil di-reset ke default!', 'success');
        await refreshPermissions();
      } catch (err) {
        showToast('Gagal mereset hak akses', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const roles: { id: UserRole; label: string; desc: string; color: string }[] = [
    { id: 'admin', label: 'Admin', desc: 'Pemilik sistem dengan kendali penuh.', color: 'text-red-500 bg-red-500/10' },
    { id: 'statistician', label: 'Statistician', desc: 'Petugas pencatatan statistik di lapangan.', color: 'text-amber-500 bg-amber-500/10' },
    { id: 'customer', label: 'Customer', desc: 'Orang tua, pelatih, atau tim konsumen.', color: 'text-blue-500 bg-blue-500/10' },
    { id: 'scout', label: 'Scout', desc: 'Pencari bakat yang melihat statistik & galeri.', color: 'text-emerald-500 bg-emerald-500/10' },
    { id: 'coach', label: 'Coach', desc: 'Pelatih kepala yang menganalisis taktis & setuju publikasi.', color: 'text-purple-500 bg-purple-500/10' },
  ];

  const permissionsList = ALL_PERMISSIONS;
  const isChanged = checkIfChanged();

  // Group permissions by category for the Tab View
  const categories: Record<string, Permission[]> = {};
  Object.values(PERMISSION_CATALOG).forEach(item => {
    if (!categories[item.category]) {
      categories[item.category] = [];
    }
    categories[item.category].push(item.id);
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent dark:border-brand-orange rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 text-zinc-900 dark:text-zinc-100">
      {/* Top action header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-orange/10 text-brand-orange rounded-2xl">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">Peran & Hak Akses</h1>
            <p className="text-xs text-zinc-500">Kelola izin akses fitur sistem untuk tiap peran pengguna.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggles */}
          <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl flex gap-1">
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Table size={14} />
              Matriks Peran
            </button>
            <button
              onClick={() => setViewMode('tabs')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'tabs'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <LayoutGrid size={14} />
              Detail per Peran
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw size={14} /> Reset Bawaan
          </button>
        </div>
      </div>

      {/* Info Warning Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 p-4 rounded-3xl flex gap-3 text-amber-800 dark:text-amber-400">
        <Info size={20} className="flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-extrabold uppercase block tracking-wider text-amber-900 dark:text-amber-300">Catatan Keamanan</span>
          <p className="leading-relaxed">
            Peran <strong>Admin</strong> terkunci penuh secara permanen demi keamanan agar pengelola tidak mengunci diri sendiri dari sistem. Perubahan hak akses berlaku instan ke sistem navigasi pengguna secara real-time.
          </p>
        </div>
      </div>

      {/* CONDITIONAL RENDERING FOR VIEW MODES */}
      {viewMode === 'matrix' ? (
        /* Matrix Table View */
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <th className="p-4 font-black text-xs uppercase tracking-wider text-zinc-400 min-w-[280px]">
                    Permissions & Deskripsi
                  </th>
                  {roles.map(r => (
                    <th 
                      key={r.id} 
                      className="p-4 text-center font-extrabold text-xs uppercase tracking-wider min-w-[110px]"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-zinc-900 dark:text-white">{r.label}</span>
                        {r.id === 'admin' ? (
                          <span className="text-[8px] bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                            Terkunci
                          </span>
                        ) : (
                          <span className="text-[8px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1 py-0.2 rounded font-medium uppercase tracking-wider">
                            Bisa Diedit
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {permissionsList.map(permission => {
                  const details = PERMISSION_CATALOG[permission] || {
                    name: permission,
                    description: 'No description provided.',
                    category: 'Lainnya',
                  };

                  return (
                    <tr 
                      key={permission}
                      className="hover:bg-zinc-50/30 dark:hover:bg-zinc-800/10 transition-colors"
                    >
                      <td className="p-4">
                        <div className="space-y-1 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900 dark:text-white">
                              {details.name}
                            </span>
                            <span className="font-mono text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 dark:text-zinc-400">
                              {permission}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal max-w-lg">
                            {details.description}
                          </p>
                        </div>
                      </td>

                      {roles.map(r => {
                        const hasPerm = currentPermissions[r.id]?.includes(permission);
                        const isAdmin = r.id === 'admin';

                        return (
                          <td 
                            key={r.id} 
                            className="p-4 text-center align-middle"
                          >
                            <div className="flex justify-center">
                              <button
                                type="button"
                                disabled={isAdmin}
                                onClick={() => handleToggleCell(r.id, permission)}
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                                  isAdmin 
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                                    : hasPerm
                                      ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer border border-emerald-500/30'
                                      : 'bg-zinc-100/50 dark:bg-zinc-800/50 text-zinc-300 dark:text-zinc-700 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 cursor-pointer border border-transparent'
                                }`}
                                title={`${r.label}: ${details.name}`}
                              >
                                {isAdmin ? (
                                  <Lock size={16} className="text-zinc-400 dark:text-zinc-500" />
                                ) : hasPerm ? (
                                  <Check size={20} strokeWidth={3} />
                                ) : (
                                  <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                )}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Categorized Tabbed View per Role */
        <div className="space-y-6">
          {/* Role selector grid */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-3 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 px-1">Pilih Peran Pengguna</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {roles.map(r => {
                const isSelected = selectedRole === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRole(r.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${
                      isSelected
                        ? 'bg-brand-orange border-brand-orange text-brand-navy shadow-lg shadow-brand-orange/10'
                        : 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <span className="font-extrabold text-sm uppercase tracking-wider block">
                      {r.label}
                    </span>
                    <span className={`text-[10px] leading-tight line-clamp-2 ${isSelected ? 'text-brand-navy/80 font-bold' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {r.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categorized list of permissions */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <h3 className="font-black text-sm uppercase tracking-wide">
                Daftar Izin untuk Peran: <span className="text-brand-orange font-extrabold bg-zinc-900 dark:bg-zinc-800 px-2 py-0.5 rounded ml-1 text-xs uppercase">{selectedRole}</span>
              </h3>
              <p className="text-[10px] text-zinc-500 mt-1">Centang kotak untuk memberikan atau mencabut izin akses fitur.</p>
            </div>

            <div className="p-5 space-y-8">
              {Object.entries(categories).map(([category, pIds]) => (
                <div key={category} className="space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/80 pb-1">
                    {category}
                  </h4>
                  
                  <div className="grid md:grid-cols-2 gap-3">
                    {pIds.map(pId => {
                      const hasPerm = currentPermissions[selectedRole]?.includes(pId);
                      const details = PERMISSION_CATALOG[pId];
                      const isAdmin = selectedRole === 'admin';
                      
                      return (
                        <div 
                          key={pId}
                          onClick={() => !isAdmin && handleToggleCell(selectedRole, pId)}
                          className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 select-none ${
                            isAdmin 
                              ? 'bg-zinc-50 dark:bg-zinc-800/20 border-zinc-200 dark:border-zinc-800 opacity-75 cursor-not-allowed'
                              : hasPerm
                                ? 'bg-emerald-500/5 border-emerald-500/20 dark:border-emerald-500/30 cursor-pointer hover:bg-emerald-500/10'
                                : 'bg-zinc-50/40 dark:bg-zinc-800/10 border-zinc-200 dark:border-zinc-800/60 hover:bg-zinc-100/30 dark:hover:bg-zinc-800/20 cursor-pointer'
                          }`}
                        >
                          <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            isAdmin
                              ? 'bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-500'
                              : hasPerm
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-zinc-300 dark:border-zinc-700'
                          }`}>
                            {isAdmin ? <Lock size={12} /> : hasPerm && <Check size={14} strokeWidth={3} />}
                          </div>
                          
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-zinc-900 dark:text-white">
                                {details.name}
                              </span>
                              <span className="font-mono text-[9px] bg-zinc-200/60 dark:bg-zinc-800 px-1 py-0.2 rounded text-zinc-500 dark:text-zinc-400">
                                {pId}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
                              {details.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Actions bar inside container */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg bg-zinc-950/90 dark:bg-zinc-900/95 border border-zinc-800/80 p-4 flex items-center justify-between rounded-3xl shadow-2xl z-40 backdrop-blur-md px-5">
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Status Konfigurasi</span>
          <span className={`text-xs font-bold uppercase ${isChanged ? 'text-brand-orange animate-pulse' : 'text-emerald-400'}`}>
            {isChanged ? 'Ada Perubahan Belum Disimpan' : 'Semua Perubahan Tersimpan'}
          </span>
        </div>

        <div className="flex gap-2">
          {isChanged && (
            <button
              onClick={loadPermissions}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>
          )}
          <Button
            variant="primary"
            size="sm"
            disabled={!isChanged || saving}
            onClick={handleSave}
            className={`rounded-xl text-xs font-black px-6 py-2 flex items-center gap-1.5 ${
              isChanged 
                ? 'bg-brand-orange hover:opacity-90 text-brand-navy border-none' 
                : 'bg-zinc-800 text-zinc-500 border-none cursor-not-allowed'
            }`}
          >
            <Save size={14} />
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>
      </div>
    </div>
  );
};

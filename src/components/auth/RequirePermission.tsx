import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { usePermissions } from '../../core/contexts/PermissionsContext';
import { Permission } from '../../core/config/permissions';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface RequirePermissionProps {
  permission: Permission;
  children: React.ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({ permission, children }) => {
  const { can, loading, user } = usePermissions();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!can(permission)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-6">
          <ShieldAlert size={44} />
        </div>
        <h1 className="text-2xl font-black text-zinc-950 dark:text-white uppercase tracking-wider mb-2">Akses Ditolak</h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-md mb-8 text-sm">
          Akun Anda (<span className="font-semibold text-zinc-800 dark:text-zinc-200">{user.name}</span> - <span className="font-semibold uppercase text-brand-navy dark:text-brand-orange">{user.role}</span>) tidak memiliki hak akses <span className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{permission}</span> untuk melihat halaman ini.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            Kembali
          </button>
          <Link
            to="/"
            className="px-6 py-3 rounded-xl font-bold text-sm text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 transition-opacity block"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

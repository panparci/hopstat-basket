import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../core/contexts/PermissionsContext';
import { HomePage } from '../pages/HomePage';

export const RoleBasedDashboard: React.FC = () => {
  const { user, can, loading } = usePermissions();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // Admin "Beranda Publik" must land here — do not bounce to /admin (that broke the sidebar link).
  // Admin console remains at /admin via Dashboard Control.
  if (can('do_stat_tasks') && !can('manage_users')) return <Navigate to="/services/tasks" replace />;
  return <HomePage />;
};

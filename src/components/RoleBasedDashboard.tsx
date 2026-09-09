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
  if (can('manage_users')) return <Navigate to="/admin" replace />;
  if (can('do_stat_tasks')) return <Navigate to="/services/tasks" replace />;
  return <HomePage />;
};

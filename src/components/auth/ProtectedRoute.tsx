import React from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { usePermissions } from '../../core/contexts/PermissionsContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: session, loading } = usePermissions();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  
  if (!session) return <Navigate to="/" replace />;
  
  if (session.status === 'suspended') {
    void authService.logout();
    return <Navigate to="/login?error=suspended" replace />;
  }

  return <>{children}</>;
};

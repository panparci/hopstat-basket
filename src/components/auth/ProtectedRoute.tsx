import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { UserAccount } from '../../core/types/serviceRequests';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const user = await authService.getCurrentUser();
      setSession(user);
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  
  if (!session) return <Navigate to="/welcome" replace />;
  
  if (session.status === 'suspended') {
    void authService.logout();
    return <Navigate to="/login?error=suspended" replace />;
  }

  return <>{children}</>;
};

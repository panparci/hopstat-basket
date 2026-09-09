import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserAccount } from '../types/serviceRequests';
import { Permission } from '../config/permissions';
import { rbacService } from '../../services/rbacService';
import { authService } from '../../services/authService';

interface PermissionsContextType {
  user: UserAccount | null;
  permissions: Permission[];
  loading: boolean;
  can: (permission: Permission) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserAndPermissions = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        const rolePermissionsMap = await rbacService.getRolePermissions();
        const userPermissions = rolePermissionsMap[currentUser.role] || [];
        setPermissions(userPermissions);
      } else {
        setPermissions([]);
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserAndPermissions();
  }, []);

  const can = (permission: Permission): boolean => {
    if (!user) return false;
    // Admins always bypass, or they use their configured permissions
    if (user.role === 'admin') return true;
    return permissions.includes(permission);
  };

  return (
    <PermissionsContext.Provider
      value={{
        user,
        permissions,
        loading,
        can,
        refreshPermissions: fetchUserAndPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = (): PermissionsContextType => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

interface CanProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({ permission, children, fallback = null }) => {
  const { can, loading } = usePermissions();
  if (loading) return null;
  return can(permission) ? <>{children}</> : <>{fallback}</>;
};

import { initDB } from '../lib/db';
import { UserRole } from '../core/types/serviceRequests';
import { Permission, DEFAULT_ROLE_PERMISSIONS } from '../core/config/permissions';

export const rbacService = {
  /**
   * Fetch all roles and their mapped permissions.
   * If empty, seeds DEFAULT_ROLE_PERMISSIONS first.
   */
  async getRolePermissions(): Promise<Record<UserRole, Permission[]>> {
    const db = await initDB();
    const stored = await db.getAll('role_permissions');
    
    if (stored.length === 0) {
      // Seed default permissions
      const initialMap: Record<UserRole, Permission[]> = { ...DEFAULT_ROLE_PERMISSIONS };
      const roles: UserRole[] = ['admin', 'statistician', 'customer', 'scout', 'coach'];
      for (const role of roles) {
        await db.put('role_permissions', {
          role,
          permissions: initialMap[role] || [],
        });
      }
      return initialMap;
    }

    const result = {} as Record<UserRole, Permission[]>;
    for (const item of stored) {
      const role = item.role as UserRole;
      let currentPerms = item.permissions as Permission[];
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || [];
      
      // Auto-migrate: Add newly introduced default permissions if they are missing
      const missingNewPerms = defaultPerms.filter(p => (p === 'view_matches' || p === 'view_published_story') && !currentPerms.includes(p));
      
      let hasChanges = false;
      if (missingNewPerms.length > 0) {
        currentPerms = [...currentPerms, ...missingNewPerms];
        hasChanges = true;
      }

      if (hasChanges) {
        await db.put('role_permissions', {
          role,
          permissions: currentPerms,
        });
      }

      result[role] = currentPerms;
    }

    // Safety fallback for any unseeded roles
    const roles: UserRole[] = ['admin', 'statistician', 'customer', 'scout', 'coach'];
    for (const role of roles) {
      if (!result[role]) {
        result[role] = DEFAULT_ROLE_PERMISSIONS[role] || [];
        await db.put('role_permissions', {
          role,
          permissions: DEFAULT_ROLE_PERMISSIONS[role] || [],
        });
      }
    }

    return result;
  },

  /**
   * Save custom permissions configuration for a specific role.
   */
  async setRolePermissions(role: UserRole, permissions: Permission[]): Promise<void> {
    const db = await initDB();
    await db.put('role_permissions', {
      role,
      permissions,
    });
  },

  /**
   * Reset role-permissions store back to default mapping.
   */
  async resetToDefault(): Promise<Record<UserRole, Permission[]>> {
    const db = await initDB();
    const tx = db.transaction('role_permissions', 'readwrite');
    await tx.store.clear();
    await tx.done;
    return this.getRolePermissions();
  },
};

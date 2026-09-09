import { initDB } from '../lib/db';
import { UserAccount, UserRole } from '../core/types/serviceRequests';

const STORAGE_KEY = 'hoopstats_current_user';

async function authApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Auth ${res.status}`);
  }
  return data as T;
}

export const authService = {
  async getCurrentUser(): Promise<UserAccount | null> {
    localStorage.removeItem(STORAGE_KEY);
    try {
      const data = await authApi<{ user: UserAccount }>('/api/auth/me');
      return data.user || null;
    } catch {
      return null;
    }
  },

  async login(email: string, password?: string): Promise<UserAccount> {
    if (!password) throw new Error('Password wajib diisi');
    const data = await authApi<{ user: UserAccount }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return data.user;
  },

  async logout() {
    localStorage.removeItem(STORAGE_KEY);
    await authApi('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
  },

  async register(name: string, email: string, password?: string, _role: UserRole = 'customer'): Promise<UserAccount> {
    if (!password || password.length < 6) {
      throw new Error('Password minimal harus 6 karakter');
    }
    const data = await authApi<{ user: UserAccount }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    return data.user;
  },

  async getAllUsersByRole(role: UserRole): Promise<UserAccount[]> {
    const all = await this.getAllUsers();
    return all.filter((u) => u.role === role);
  },

  async getAllUsers(): Promise<UserAccount[]> {
    const db = await initDB();
    return db.getAll('user_accounts');
  },

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    const db = await initDB();
    const user = await db.get('user_accounts', userId);
    if (!user) throw new Error('User tidak ditemukan');
    user.role = role;
    await db.put('user_accounts', user);
  },

  async updateUserStatus(userId: string, status: 'active' | 'suspended'): Promise<void> {
    const db = await initDB();
    const user = await db.get('user_accounts', userId);
    if (!user) throw new Error('User tidak ditemukan');
    user.status = status;
    await db.put('user_accounts', user);
  },

  async seedMockUsers() {
    return;
  },
};

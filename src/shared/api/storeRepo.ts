import { initDB } from '../../lib/db';

export interface BaseEntity {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'deleted' | string;
}

const generateUUID = (): string => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export function createStoreRepo<T extends BaseEntity>(storeName: any) {
  return {
    async getById(id: string): Promise<T | undefined> {
      const db = await initDB();
      return db.get(storeName, id) as Promise<T | undefined>;
    },

    async list(): Promise<T[]> {
      const db = await initDB();
      const all = await db.getAll(storeName);
      return (all as T[]).filter(item => item.status !== 'deleted');
    },

    async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'status'> & Partial<Pick<T, 'id'>>): Promise<T> {
      const db = await initDB();
      const id = data.id || generateUUID();
      const now = new Date().toISOString();
      const record = {
        ...data,
        id,
        createdAt: now,
        updatedAt: now,
        status: 'active'
      } as unknown as T;

      await db.put(storeName, record);
      return record;
    },

    async update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T> {
      const db = await initDB();
      const existing = await db.get(storeName, id);
      if (!existing) {
        throw new Error(`Record with id ${id} not found in store ${storeName}`);
      }

      const now = new Date().toISOString();
      const updatedRecord = {
        ...existing,
        ...data,
        id,
        updatedAt: now
      } as unknown as T;

      await db.put(storeName, updatedRecord);
      return updatedRecord;
    },

    async softDelete(id: string): Promise<void> {
      const db = await initDB();
      const existing = await db.get(storeName, id);
      if (!existing) {
        return;
      }

      const now = new Date().toISOString();
      const updatedRecord = {
        ...existing,
        updatedAt: now,
        status: 'deleted'
      } as unknown as any;

      await db.put(storeName, updatedRecord);
    }
  };
}

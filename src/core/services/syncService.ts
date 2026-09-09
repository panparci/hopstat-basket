/** Postgres is the source of truth. This used to queue IndexedDB→Supabase; no-op now. */
export const syncService = {
  async sync() {},
  async enqueue(_table: string, _action: 'INSERT' | 'UPDATE' | 'DELETE', _payload: unknown) {},
};

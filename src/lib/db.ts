/**
 * Postgres-backed drop-in for the old IndexedDB hoopstats-db.
 * Same get/put/getAll/getAllFromIndex/transaction surface so domain services stay intact.
 * Video blobs are never persisted (stripped server-side).
 */

const LEGACY_IDB_NAMES = [
  "hoopstats-db",
  "basketball_knowledge_db",
  "hoopstats-token-logs",
  "HoopStatsDB",
];

export function purgeLegacyIndexedDb() {
  if (typeof indexedDB === "undefined") return;
  for (const name of LEGACY_IDB_NAMES) {
    try {
      indexedDB.deleteDatabase(name);
    } catch {
      // ignore
    }
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data.error || `Store API ${res.status} on ${path}`);
  }
  return data as T;
}

function encodeKey(id: string | number | IDBValidKey): string {
  return encodeURIComponent(String(id));
}

type BatchOp =
  | { op: "put"; store: string; doc: any }
  | { op: "delete"; store: string; id: string }
  | { op: "clear"; store: string };

class StoreObjectStore {
  constructor(
    private store: string,
    private ops: BatchOp[] | null
  ) {}

  async get(key: IDBValidKey) {
    return getRecord(this.store, String(key));
  }

  async getAll() {
    return listRecords(this.store);
  }

  async put(doc: any) {
    if (this.ops) {
      this.ops.push({ op: "put", store: this.store, doc });
      return doc?.id;
    }
    return putRecord(this.store, doc);
  }

  async add(doc: any) {
    return this.put(doc);
  }

  async delete(key: IDBValidKey) {
    if (this.ops) {
      this.ops.push({ op: "delete", store: this.store, id: String(key) });
      return;
    }
    await api(`/api/stores/${this.store}/${encodeKey(key)}`, { method: "DELETE" });
  }

  async clear() {
    if (this.ops) {
      this.ops.push({ op: "clear", store: this.store });
      return;
    }
    await api(`/api/stores/${this.store}`, { method: "DELETE" });
  }
}

class StoreTransaction {
  readonly store: StoreObjectStore;
  private ops: BatchOp[] = [];
  private flushPromise: Promise<void> | null = null;

  constructor(storeNames: string[]) {
    this.store = new StoreObjectStore(storeNames[0], this.ops);
  }

  get done() {
    if (!this.flushPromise) {
      this.flushPromise = this.flush();
    }
    return this.flushPromise;
  }

  objectStore(name: string) {
    return new StoreObjectStore(name, this.ops);
  }

  private async flush() {
    if (this.ops.length === 0) return;
    await api("/api/stores/batch", {
      method: "POST",
      body: JSON.stringify({ ops: this.ops }),
    });
  }
}

async function getRecord(store: string, id: string) {
  const res = await fetch(`/api/stores/${store}/${encodeKey(id)}`);
  if (res.status === 404) return undefined;
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `GET ${store} failed`);
  return data.item;
}

async function listRecords(store: string, indexName?: string, eq?: string) {
  const params = new URLSearchParams();
  if (indexName && eq !== undefined) {
    params.set("index", indexName);
    params.set("eq", eq);
  }
  const qs = params.toString();
  const data = await api<{ items: any[] }>(`/api/stores/${store}${qs ? `?${qs}` : ""}`);
  return data.items || [];
}

async function putRecord(store: string, doc: any) {
  const pk =
    store === "game_states"
      ? doc.matchId
      : store === "role_permissions"
        ? doc.role
        : doc.id;
  if (pk === undefined || pk === null || pk === "") {
    const data = await api<{ item: any }>(`/api/stores/${store}`, {
      method: "POST",
      body: JSON.stringify(doc),
    });
    return data.item;
  }
  const data = await api<{ item: any }>(`/api/stores/${store}/${encodeKey(pk)}`, {
    method: "PUT",
    body: JSON.stringify(doc),
  });
  return data.item;
}

export type HoopStoreDb = {
  get: (store: any, key: IDBValidKey) => Promise<any>;
  getAll: (store: any) => Promise<any[]>;
  put: (store: any, value: any) => Promise<any>;
  add: (store: any, value: any) => Promise<any>;
  delete: (store: any, key: IDBValidKey) => Promise<void>;
  clear: (store: any) => Promise<void>;
  getAllFromIndex: (store: any, indexName: string, query?: IDBValidKey) => Promise<any[]>;
  transaction: (storeNames: any, mode?: IDBTransactionMode) => StoreTransaction;
  close: () => void;
};

let dbPromise: Promise<HoopStoreDb> | undefined;

function createClient(): HoopStoreDb {
  return {
    async get(store, key) {
      return getRecord(String(store), String(key));
    },
    async getAll(store) {
      return listRecords(String(store));
    },
    async put(store, value) {
      return putRecord(String(store), value);
    },
    async add(store, value) {
      return putRecord(String(store), value);
    },
    async delete(store, key) {
      await api(`/api/stores/${String(store)}/${encodeKey(key)}`, { method: "DELETE" });
    },
    async clear(store) {
      await api(`/api/stores/${String(store)}`, { method: "DELETE" });
    },
    async getAllFromIndex(store, indexName, query) {
      if (query === undefined) {
        return listRecords(String(store));
      }
      return listRecords(String(store), indexName, String(query));
    },
    transaction(storeNames) {
      const names = Array.isArray(storeNames) ? storeNames.map(String) : [String(storeNames)];
      return new StoreTransaction(names);
    },
    close() {
      dbPromise = undefined;
    },
  };
}

export const initDB = () => {
  if (!dbPromise) {
    purgeLegacyIndexedDb();
    dbPromise = Promise.resolve(createClient());
  }
  return dbPromise;
};

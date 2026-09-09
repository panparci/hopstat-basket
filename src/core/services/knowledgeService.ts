import Fuse from 'fuse.js';
import { KnowledgeEntry } from '../types/commentary';
import { generateId } from '../utils/idUtils';
import { initDB } from '../../lib/db';

const STORE_NAME = 'knowledge_entries';

export const knowledgeService = {
  async getAllEntries(): Promise<KnowledgeEntry[]> {
    const db = await initDB();
    return db.getAll(STORE_NAME);
  },

  async addEntry(category: KnowledgeEntry['category'], alias: string, canonical: string) {
    const db = await initDB();
    const existing = await db.getAllFromIndex(STORE_NAME, 'by-alias', alias.toLowerCase());
    
    if (existing.length > 0) {
      const entry = existing[0];
      entry.matchCount += 1;
      entry.lastUsed = new Date().toISOString();
      await db.put(STORE_NAME, entry);
    } else {
      const entry: KnowledgeEntry = {
        id: generateId('kn'),
        category,
        alias: alias.toLowerCase(),
        canonical,
        matchCount: 1,
        lastUsed: new Date().toISOString()
      };
      await db.put(STORE_NAME, entry);
    }
  },

  async findMatch(text: string, category?: KnowledgeEntry['category']): Promise<KnowledgeEntry | null> {
    const entries = await this.getAllEntries();
    const filtered = category ? entries.filter(e => e.category === category) : entries;
    
    if (filtered.length === 0) return null;

    const fuse = new Fuse<KnowledgeEntry>(filtered, {
      keys: ['alias'],
      threshold: 0.4,
      includeScore: true
    });

    const results = fuse.search(text);
    if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.3) {
      return results[0].item;
    }
    return null;
  }
};

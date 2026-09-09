import { GameEvent } from './stats';

export interface DraftEvent {
  id: string;
  matchId: string;
  rawText: string;
  timestamp: number; // YouTube timestamp in seconds
  confidence: number;
  status: 'draft' | 'validated' | 'rejected';
  parsedData?: Partial<GameEvent>;
  createdAt: string;
}

export interface KnowledgeEntry {
  id: string;
  category: 'player' | 'team' | 'term' | 'location' | 'event';
  alias: string; // What the user said
  canonical: string; // The real ID or name
  matchCount: number;
  lastUsed: string;
}

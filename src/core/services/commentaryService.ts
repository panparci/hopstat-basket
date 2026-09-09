import { DraftEvent } from '../types/commentary';
import { GameEvent, EventType } from '../types/stats';
import { generateId } from '../utils/idUtils';
import { knowledgeService } from './knowledgeService';
import { statsService } from './statsService';

// State rules for sequences (Simplified)
const eventSequenceProbability: Record<string, EventType[]> = {
  '3pt_miss': ['oreb', 'dreb', 'foul'],
  '2pt_miss': ['oreb', 'dreb', 'foul'],
  '1pt_miss': ['oreb', 'dreb', 'foul'],
  'oreb': ['2pt_make', '2pt_miss', 'to', 'foul', 'ast'], // Putback, turnover, foul, pass
  'dreb': ['2pt_make', 'to', 'ast'], 
  'to': ['stl', 'foul'], // Often follows steal
  'stl': ['2pt_make', 'foul', 'ast'], // Fastbreak
  'blk': ['oreb', 'dreb'],
};

export const commentaryService = {
  // Intent keyword mapping (more robust than direct mapping)
  intents: {
    make: ['masuk', 'gol', 'poin', 'cetak', 'berhasil', 'score', 'bucket', 'and one'],
    miss: ['gagal', 'meleset', 'luput', 'miss', 'gak masuk', 'ring', 'bantat'],
    foul: ['pelanggaran', 'foul', 'langgar', 'nabrak', 'hacking', 'reach', 'charging'],
    oreb: ['rebound', 'ambil', 'dapat pentalan', 'pental', 'board'],
    ast: ['assist', 'umpan', 'kasih', 'oper', 'pass'],
    stl: ['steal', 'curi', 'potong', 'rebut', 'intercept'],
    blk: ['blok', 'block', 'tepis', 'tolak', 'reject'],
    to: ['turnover', 'hilang', 'lepas', 'buang', 'travel', 'langkah', 'out', 'keluar'],
    '3pt': ['tiga', 'three', 'jauh', 'luar'],
    '2pt': ['dua', 'two', 'layup', 'dunk', 'dalam', 'dekat', 'middle'],
    '1pt': ['satu', 'free throw', 'tembakan bebas', 'pinalti']
  },

  detectIntent(text: string): { action: string, confidence: number }[] {
    const rawMatches: { action: string, score: number }[] = [];
    for (const [action, keywords] of Object.entries(this.intents) as [string, string[]][]) {
      let score = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) {
          score += 1;
        }
      }
      if (score > 0) rawMatches.push({ action, score });
    }
    // Normalize and return
    return rawMatches.sort((a, b) => b.score - a.score).map(m => ({ action: m.action, confidence: Math.min(m.score * 0.4, 0.9) }));
  },

  async parseCommentary(text: string, matchId: string, timestamp: number, lastEventType?: EventType): Promise<DraftEvent> {
    const normalizedText = text.toLowerCase();
    let confidence = 0.3; // Base confidence
    let type: EventType | undefined;
    let points: number | undefined;
    let team: 'home' | 'away' | undefined;
    let playerId: string | undefined;

    // 1. Intent Detection
    const intents = this.detectIntent(normalizedText);
    
    let hasMake = intents.some(i => i.action === 'make');
    let hasMiss = intents.some(i => i.action === 'miss');
    let has3pt = intents.some(i => i.action === '3pt');
    let has2pt = intents.some(i => i.action === '2pt');
    let has1pt = intents.some(i => i.action === '1pt');

    // Resolve logic based on intent
    if (has3pt) points = 3;
    else if (has1pt) points = 1;
    else if (has2pt || hasMake || hasMiss) points = 2; // Default to 2pt if making/missing implied

    if (hasMake) {
       if (points === 3) type = '3pt_make';
       else if (points === 2) type = '2pt_make';
       else if (points === 1) type = '1pt_make';
       confidence += intents.find(i => i.action === 'make')!.confidence;
    } else if (hasMiss) {
       if (points === 3) type = '3pt_miss';
       else if (points === 2) type = '2pt_miss';
       else if (points === 1) type = '1pt_miss';
       confidence += intents.find(i => i.action === 'miss')!.confidence;
    } else if (intents.length > 0) {
       const topIntent = intents[0].action;
       if (!['3pt', '2pt', '1pt'].includes(topIntent)) {
          type = topIntent as EventType;
          confidence += intents[0].confidence;
       }
    }

    // Contextual Sequence Boost (If this event logically follows the last one)
    if (lastEventType && type && eventSequenceProbability[lastEventType]?.includes(type)) {
      confidence += 0.2; // Boost confidence if it makes sequential sense
    }

    // 2. Detect Player (Fuzzy Match & Roster)
    const match = await statsService.getMatch(matchId);
    if (match) {
      const players = await statsService.getMatchRosters(matchId);
      
      for (const player of players) {
        if (player.name && normalizedText.includes(player.name.toLowerCase())) {
          playerId = player.profileId;
          team = player.teamId === match.teamId ? 'home' : 'away';
          confidence += 0.4;
          break;
        }
        if (player.jerseyNumber && normalizedText.includes(player.jerseyNumber)) {
          // Number match is weaker context than name, unless surrounded by spaces
          if (new RegExp(`\\b${player.jerseyNumber}\\b`).test(normalizedText)) {
            playerId = player.profileId;
            team = player.teamId === match.teamId ? 'home' : 'away';
            confidence += 0.25;
            break;
          }
        }
      }
    }

    // 3. Fallback to Knowledge Base
    if (!playerId) {
      const kbMatch = await knowledgeService.findMatch(normalizedText, 'player');
      if (kbMatch) {
        playerId = kbMatch.canonical;
        confidence += 0.3;
        
        // Lookup team for this canonical player ID from roster
        if (match) {
           const players = await statsService.getMatchRosters(matchId);
           const p = players.find(x => x.profileId === playerId);
           if (p) team = p.teamId === match.teamId ? 'home' : 'away';
        }
      }
    }

    const draftEvent: DraftEvent = {
      id: generateId('dr'),
      matchId,
      rawText: text,
      timestamp,
      confidence: Math.min(confidence, 1),
      status: 'draft',
      createdAt: new Date().toISOString(),
      parsedData: {
        type,
        playerId,
        points,
        team,
        timestamp 
      }
    };

    return draftEvent;
  }
};

import { Player, Match, EventType, MatchRoster } from '../types/stats';

// Levenshtein distance for string similarity
function levenshtein(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function getSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshtein(longer, shorter)) / longer.length;
}

function getPhonicKey(s: string): string {
  // Simple phonic key: remove vowels, duplicate letters, and normalize common sounds
  return s.toLowerCase()
    .replace(/[aeiouy]/g, '')
    .replace(/(.)\1+/g, '$1')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/c/g, 'k')
    .replace(/j/g, 'g')
    .replace(/z/g, 's');
}

function findClosestMatch(word: string, dictionary: string[], threshold: number = 0.7): string | null {
  let closest = null;
  let maxSimilarity = 0;
  
  const wordPhonic = getPhonicKey(word);

  for (const term of dictionary) {
    // 1. Phonic match (very high priority)
    if (wordPhonic === getPhonicKey(term)) return term;

    // 2. Similarity match
    const sim = getSimilarity(word, term);
    if (sim > maxSimilarity && sim >= threshold) {
      maxSimilarity = sim;
      closest = term;
    }
  }
  
  return closest;
}

// Seed data for basketball terms
export const DEFAULT_TERM_MAPPINGS: Record<string, string> = {
  'fou': 'foul',
  'faul': 'foul',
  'pelanggaran': 'foul',
  'asis': 'assist',
  'operan': 'assist',
  'umpan': 'assist',
  'stil': 'steal',
  'curi': 'steal',
  'blok': 'block',
  'turn over': 'turnover',
  'hilang': 'turnover',
  'lepas': 'turnover',
  'ribon': 'rebound',
  'ribound': 'rebound',
  'serang': 'offense',
  'bertahan': 'defense',
  'masuk': 'make',
  'gol': 'make',
  'berhasil': 'make',
  'poin': 'point',
  'gagal': 'miss',
  'luar': 'miss',
  'meleset': 'miss',
  'satu': '1',
  'dua': '2',
  'tiga': '3',
  'free throw': '1',
  'ft': '1',
  'reach': 'reach',
  'shooting': 'shooting',
  'charge': 'charge',
  'technical': 'technical',
  'double team': 'double team',
  'blocking': 'blocking',
  'holding': 'holding',
  'hand check': 'hand check',
  'loose ball': 'loose ball',
  'illegal screen': 'illegal screen',
  'push-off': 'push-off',
  'unsportsmanlike': 'unsportsmanlike',
  'direct': 'direct',
  'short creation': 'short creation',
  'weak assist': 'weak assist',
  'bring up ball': 'bring up ball',
  'half court set': 'half court set',
  'drive / attack': 'drive / attack',
  'transition offense': 'transition offense',
  'inbound': 'inbound',
  'after rebound': 'after rebound',
  'fast break': 'fast break'
};

export const getCustomMappings = (): Record<string, string> => {
  const data = localStorage.getItem('hoopstats_voice_mappings');
  return data ? JSON.parse(data) : {};
};

export const saveCustomMapping = (word: string, meaning: string) => {
  const mappings = getCustomMappings();
  mappings[word.toLowerCase()] = meaning.toLowerCase();
  localStorage.setItem('hoopstats_voice_mappings', JSON.stringify(mappings));
};

export const getUnrecognizedLogs = (): string[] => {
  const data = localStorage.getItem('hoopstats_unrecognized_voice');
  return data ? JSON.parse(data) : [];
};

export const addUnrecognizedLog = (text: string) => {
  const logs = getUnrecognizedLogs();
  if (!logs.includes(text)) {
    logs.push(text);
    localStorage.setItem('hoopstats_unrecognized_voice', JSON.stringify(logs));
  }
};

export type VoiceCommandResult = 
  | { status: 'success'; playerId: string; action: EventType; points: number }
  | { status: 'ambiguous'; players: Player[]; reason: string }
  | { status: 'error'; reason: string };

export const parseVoiceCommand = (text: string, roster: Player[], match: Match, matchRosters: MatchRoster[]): VoiceCommandResult => {
  let lowerText = text.toLowerCase();
  const customMappings = getCustomMappings();
  const allMappings = { ...DEFAULT_TERM_MAPPINGS, ...customMappings };
  
  // Replace multi-word phrases first
  for (const [key, value] of Object.entries(allMappings)) {
    if (key.includes(' ')) {
      lowerText = lowerText.replace(new RegExp(key, 'g'), value);
    }
  }

  // Replace words based on mappings
  const words = lowerText.split(' ');
  const normalizedWords = words.map(word => {
    // Exact match in mappings
    if (allMappings[word]) return allMappings[word];
    
    // Similarity match (only for words > 3 chars to avoid mapping short unrelated words)
    if (word.length > 3) {
      const closest = findClosestMatch(word, Object.keys(allMappings), 1);
      if (closest) return allMappings[closest];
    }
    
    return word;
  });
  
  lowerText = normalizedWords.join(' ');

  // Filter roster based on recording type
  let searchableRoster = roster;
  if (match.recordingType === 'team' || match.recordingType === 'single') {
    const homeTeamId = match.teamId || 'home_team';
    const homeRosterIds = matchRosters.filter(r => r.teamId === homeTeamId).map(r => r.profileId);
    searchableRoster = roster.filter(p => homeRosterIds.includes(p.id));
  }

  // 1. Identify Player
  let matchedPlayerId: string | null = null;
  
  const homeTeamName = match.ourTeamName?.toLowerCase() || 'kita';
  const awayTeamName = match.theirTeamName?.toLowerCase() || 'lawan';
  
  const isHomeMentioned = lowerText.includes('home') || lowerText.includes('tuan rumah') || lowerText.includes('kita') || lowerText.includes(homeTeamName);
  const isAwayMentioned = lowerText.includes('away') || lowerText.includes('tamu') || lowerText.includes('lawan') || lowerText.includes(awayTeamName);

  const homeColorName = match.ourColorName?.toLowerCase();
  const awayColorName = match.theirColorName?.toLowerCase();

  const isHomeColorMentioned = homeColorName && lowerText.includes(homeColorName);
  const isAwayColorMentioned = awayColorName && lowerText.includes(awayColorName);

  const isHomeThemeMentioned = match.ourTheme && lowerText.includes(match.ourTheme);
  const isAwayThemeMentioned = match.theirTheme && lowerText.includes(match.theirTheme);

  const isHomeContext = isHomeMentioned || isHomeColorMentioned || isHomeThemeMentioned;
  const isAwayContext = isAwayMentioned || isAwayColorMentioned || isAwayThemeMentioned;

  // Try matching by name first (highest priority, even if number is wrong)
  let potentialNameMatches: { id: string, score: number }[] = [];
  
  for (const p of searchableRoster) {
    const playerName = p.name.toLowerCase();
    const playerDisplayName = p.displayName?.toLowerCase();
    const aliases = p.voiceAliases?.map(a => a.toLowerCase()) || [];
    
    let matched = false;
    let score = 0;

    // Check exact matches first
    if (playerDisplayName && lowerText.includes(playerDisplayName)) {
      matched = true;
      score = 2; // High priority for display name
    } else if (aliases.some(a => lowerText.includes(a))) {
      matched = true;
      score = 2; // High priority for aliases
    } else if (lowerText.includes(playerName)) {
      matched = true;
      score = 1; // Lower priority for full name
    }

    if (matched) {
      potentialNameMatches.push({ id: p.id, score });
      continue;
    }

    // Check similarity for each word
    for (const word of normalizedWords) {
      if (word.length > 2) {
        if (playerDisplayName) {
          const closestDisplay = findClosestMatch(word, [playerDisplayName], 0.75);
          if (closestDisplay) {
            potentialNameMatches.push({ id: p.id, score: 2 });
            matched = true;
            break;
          }
        }
        
        if (!matched && aliases.length > 0) {
          const closestAlias = findClosestMatch(word, aliases, 0.75);
          if (closestAlias) {
            potentialNameMatches.push({ id: p.id, score: 2 });
            matched = true;
            break;
          }
        }

        if (!matched) {
          const closestName = findClosestMatch(word, [playerName], 0.75);
          if (closestName) {
            potentialNameMatches.push({ id: p.id, score: 1 });
            matched = true;
            break;
          }
        }
      }
    }
  }

  if (potentialNameMatches.length > 0) {
    // Sort by score descending
    potentialNameMatches.sort((a, b) => b.score - a.score);
    
    // Filter to only keep the highest score matches
    const highestScore = potentialNameMatches[0].score;
    const bestMatches = potentialNameMatches.filter(m => m.score === highestScore).map(m => m.id);

    if (bestMatches.length === 1) {
      matchedPlayerId = bestMatches[0];
    } else {
      // Multiple matches with the same score, try to filter by context
      let filteredMatches = bestMatches;
      const homeTeamId = match.teamId || 'home_team';
      const awayTeamId = match.opponentTeamId || 'away_team';
      
      if (isHomeContext) {
        filteredMatches = bestMatches.filter(id => matchRosters.some(r => r.profileId === id && r.teamId === homeTeamId));
      } else if (isAwayContext) {
        filteredMatches = bestMatches.filter(id => matchRosters.some(r => r.profileId === id && r.teamId === awayTeamId));
      }
      
      if (filteredMatches.length === 1) {
        matchedPlayerId = filteredMatches[0];
      } else if (filteredMatches.length > 1) {
        const ambiguousPlayers = searchableRoster.filter(p => filteredMatches.includes(p.id));
        return { status: 'ambiguous', players: ambiguousPlayers, reason: 'Terdapat beberapa pemain dengan nama mirip. Sebutkan tim atau nomor punggung.' };
      } else {
        const ambiguousPlayers = searchableRoster.filter(p => bestMatches.includes(p.id));
        return { status: 'ambiguous', players: ambiguousPlayers, reason: 'Terdapat beberapa pemain dengan nama mirip. Sebutkan tim atau nomor punggung.' };
      }
    }
  }

  // Try matching by jersey number if name not found
  if (!matchedPlayerId) {
    const numbers = lowerText.match(/\d+/g);
    if (numbers) {
      for (const num of numbers) {
        // Filter roster based on context if available
        let potentialPlayers = searchableRoster.filter(r => r.jersey === num);
        
        if (potentialPlayers.length > 1) {
          const homeTeamId = match.teamId || 'home_team';
          const awayTeamId = match.opponentTeamId || 'away_team';
          
          if (isHomeContext) {
            potentialPlayers = potentialPlayers.filter(p => matchRosters.some(r => r.profileId === p.id && r.teamId === homeTeamId));
          } else if (isAwayContext) {
            potentialPlayers = potentialPlayers.filter(p => matchRosters.some(r => r.profileId === p.id && r.teamId === awayTeamId));
          }
        }

        if (potentialPlayers.length === 1) {
          matchedPlayerId = potentialPlayers[0].id;
          break;
        } else if (potentialPlayers.length > 1) {
          return { status: 'ambiguous', players: potentialPlayers, reason: `Terdapat beberapa pemain dengan nomor punggung ${num}. Sebutkan timnya.` };
        }
      }
    }
  }

  if (!matchedPlayerId) {
    if (isAwayContext) {
      matchedPlayerId = 'opp';
    } else {
      addUnrecognizedLog(text);
      return { status: 'error', reason: 'Pemain tidak ditemukan.' };
    }
  }

  // 2. Identify Action
  let action: EventType | null = null;
  let points = 0;

  const isMake = lowerText.includes('make');
  const isMiss = lowerText.includes('miss');
  
  const is3pt = lowerText.includes('3');
  const is2pt = lowerText.includes('2');
  const is1pt = lowerText.includes('1') || lowerText.includes('ft') || lowerText.includes('free throw') || lowerText.includes('freethrow');

  // Implicit make: if points are mentioned but no miss keyword, assume make
  const isImplicitMake = (is3pt || is2pt || is1pt) && !isMiss;

  if (is3pt && (isMake || isImplicitMake)) { action = '3pt_make'; points = 3; }
  else if (is3pt && isMiss) { action = '3pt_miss'; }
  else if (is2pt && (isMake || isImplicitMake)) { action = '2pt_make'; points = 2; }
  else if (is2pt && isMiss) { action = '2pt_miss'; }
  else if (is1pt && (isMake || isImplicitMake)) { action = '1pt_make'; points = 1; }
  else if (is1pt && isMiss) { action = '1pt_miss'; }
  else if (lowerText.includes('foul') || lowerText.includes('reach') || lowerText.includes('shooting') || lowerText.includes('charge') || lowerText.includes('technical') || lowerText.includes('unsportsmanlike') || lowerText.includes('blocking') || lowerText.includes('holding') || lowerText.includes('hand check') || lowerText.includes('loose ball') || lowerText.includes('illegal screen') || lowerText.includes('push-off')) { action = 'foul'; }
  else if (lowerText.includes('assist')) { action = 'ast'; }
  else if (lowerText.includes('steal')) { action = 'stl'; }
  else if (lowerText.includes('block')) { action = 'blk'; }
  else if (lowerText.includes('turnover')) { action = 'to'; }
  else if (lowerText.includes('rebound') && lowerText.includes('offense')) { action = 'oreb'; }
  else if (lowerText.includes('rebound') && (lowerText.includes('defense') || !action)) { action = 'dreb'; }
  
  if (!action) {
    addUnrecognizedLog(text);
    return { status: 'error', reason: 'Aksi tidak dikenali.' };
  }

  return { status: 'success', playerId: matchedPlayerId, action, points };
};

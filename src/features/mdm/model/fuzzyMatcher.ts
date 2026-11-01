/**
 * Utility matching dan normalisasi teks untuk Entity Resolution & Deduplikasi Master Data
 */

export function normalizeText(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Kamus singkatan umum di dunia basket & institusi Indonesia
const INDONESIAN_SYNONYMS: Record<string, string> = {
  'smg': 'semarang',
  'jkt': 'jakarta',
  'jakpus': 'jakarta pusat',
  'jaksel': 'jakarta selatan',
  'jaktim': 'jakarta timur',
  'jakbar': 'jakarta barat',
  'sby': 'surabaya',
  'bdg': 'bandung',
  'smpn': 'smp',
  'sman': 'sma',
  'sdn': 'sd',
  'kejurkot': 'kejuaraan kota',
  'kejurda': 'kejuaraan daerah',
  'kejurnas': 'kejuaraan nasional',
  'turnamen': 'tournament',
  'bc': 'basketball club',
  'bb': 'basketball',
  'putra': 'boys',
  'putri': 'girls',
  'pa': 'boys',
  'pi': 'girls'
};

export function expandAbbreviations(text: string): string {
  const words = normalizeText(text).split(' ');
  const expanded = words.map(w => INDONESIAN_SYNONYMS[w] || w);
  return expanded.join(' ');
}

// Levenshtein distance
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) matrix[i] = [i];
  for (let j = 0; j <= an; j++) matrix[0][j] = j;

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Menghitung skor kemiripan antara dua string (0 s/d 100)
 */
export function calculateSimilarity(s1?: string, s2?: string): number {
  if (!s1 || !s2) return 0;
  
  const norm1 = normalizeText(s1);
  const norm2 = normalizeText(s2);
  if (norm1 === norm2) return 100;

  // Direct substring inclusion check
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const minLen = Math.min(norm1.length, norm2.length);
    const maxLen = Math.max(norm1.length, norm2.length);
    const ratio = (minLen / maxLen) * 100;
    return Math.max(85, Math.round(ratio));
  }

  // Expansion comparison
  const exp1 = expandAbbreviations(norm1);
  const exp2 = expandAbbreviations(norm2);
  if (exp1 === exp2) return 96;

  // Token Jaccard similarity
  const tokens1 = new Set(exp1.split(' ').filter(Boolean));
  const tokens2 = new Set(exp2.split(' ').filter(Boolean));
  
  let intersection = 0;
  tokens1.forEach(t => {
    if (tokens2.has(t)) intersection++;
  });

  const union = new Set([...tokens1, ...tokens2]).size;
  const jaccardScore = union > 0 ? (intersection / union) * 100 : 0;

  // Levenshtein on whole string
  const maxL = Math.max(exp1.length, exp2.length);
  const levDist = levenshteinDistance(exp1, exp2);
  const levScore = maxL > 0 ? ((maxL - levDist) / maxL) * 100 : 0;

  // Weighted combo
  const finalScore = Math.round((jaccardScore * 0.6) + (levScore * 0.4));
  return Math.min(100, Math.max(0, finalScore));
}

/**
 * Memeriksa apakah kata singkatan awal cocok (cth: "SMP 1" dan "SMPN 1")
 */
export function isAcronymOrAbbrMatch(s1: string, s2: string): boolean {
  const norm1 = normalizeText(s1);
  const norm2 = normalizeText(s2);
  const words1 = norm1.split(' ').filter(Boolean);
  const words2 = norm2.split(' ').filter(Boolean);

  if (words1.length === 0 || words2.length === 0) return false;

  // First word acronym check (e.g. SMA Kanisius vs Kolese Kanisius)
  const commonWords = words1.filter(w => words2.includes(w) && w.length >= 3);
  return commonWords.length >= 1;
}

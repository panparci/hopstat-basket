export const calculateAge = (birthDateStr?: string, matchDateStr?: string): number | undefined => {
  if (!birthDateStr || !matchDateStr) return undefined;
  const birthDate = new Date(birthDateStr);
  const matchDate = new Date(matchDateStr);
  
  if (isNaN(birthDate.getTime()) || isNaN(matchDate.getTime())) return undefined;

  const ageInMs = matchDate.getTime() - birthDate.getTime();
  const ageInYears = ageInMs / (1000 * 60 * 60 * 24 * 365.25);
  return Math.round(ageInYears * 10) / 10;
};

export const calculateAgeCategory = (birthDateStr?: string, competitionYear?: number): number | undefined => {
  if (!birthDateStr || !competitionYear) return undefined;
  const birthDate = new Date(birthDateStr);
  if (isNaN(birthDate.getTime())) return undefined;
  const birthYear = birthDate.getFullYear();
  return competitionYear - birthYear;
};

export const formatKU = (n?: number): string => {
  if (n === undefined || isNaN(n)) return '';
  return `KU-${n}`;
};

export const getCurrentKU = (birthDateStr?: string): string | undefined => {
  if (!birthDateStr) return undefined;
  const currentYear = new Date().getFullYear();
  const ku = calculateAgeCategory(birthDateStr, currentYear);
  if (ku === undefined) return undefined;
  return formatKU(ku);
};

export const compareKU = (
  birthDateStrStr?: string,
  matchDateStr?: string,
  matchKUValue?: number
): 'own' | 'up' | 'down' | undefined => {
  if (!birthDateStrStr || !matchDateStr || matchKUValue === undefined) return undefined;
  const matchDate = new Date(matchDateStr);
  if (isNaN(matchDate.getTime())) return undefined;
  const matchYear = matchDate.getFullYear();
  
  const playerKU = calculateAgeCategory(birthDateStrStr, matchYear);
  if (playerKU === undefined) return undefined;

  if (playerKU === matchKUValue) return 'own';
  if (playerKU < matchKUValue) return 'up';
  return 'down';
};

export const isPlayingUp = (
  birthDateStr?: string,
  matchDateStr?: string,
  matchKUValue?: number
): 'own' | 'up' | 'down' | undefined => {
  return compareKU(birthDateStr, matchDateStr, matchKUValue);
};

export const parseKUFromString = (ageGroup?: string): number | undefined => {
  if (!ageGroup) return undefined;
  const clean = ageGroup.toUpperCase().trim();
  const match = clean.match(/KU[- ]*(\d+)/) || clean.match(/U[- ]*(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) return num;
  }
  return undefined;
};

/** Calendar-year KU (Indonesia): KU = competitionYear − birthYear. Younger may play up; older may not. */
export type KuEligibility = 'exact' | 'playing_up' | 'overage' | 'unknown';

export interface KuEligibilityResult {
  status: KuEligibility;
  athleteKU?: number;
  matchKU: number;
}

export function checkKuEligibility(
  birthDateStr: string | undefined,
  matchKU: number,
  competitionYear: number,
): KuEligibilityResult {
  if (!birthDateStr || !matchKU || !competitionYear) return { status: 'unknown', matchKU };
  const athleteKU = calculateAgeCategory(birthDateStr, competitionYear);
  if (athleteKU === undefined) return { status: 'unknown', matchKU };
  if (athleteKU === matchKU) return { status: 'exact', athleteKU, matchKU };
  if (athleteKU < matchKU) return { status: 'playing_up', athleteKU, matchKU };
  return { status: 'overage', athleteKU, matchKU };
}

export const birthYearFromKu = (ku: number, competitionYear = new Date().getFullYear()) => competitionYear - ku;



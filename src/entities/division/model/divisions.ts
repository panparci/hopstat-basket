import { calculateAgeCategory } from '../../../core/utils/ageCalculator';

export interface Division {
  code: string;
  ageCategory: number;
  gender: 'M' | 'F' | 'MIX';
  label: string;
}

// Generate DIVISIONS masterdata: ageCategory 8 s/d 19, for M (Putra), F (Putri), MIX (Campuran)
export const DIVISIONS: Division[] = [];

for (let age = 8; age <= 19; age++) {
  DIVISIONS.push({
    code: `KU${age}-M`,
    ageCategory: age,
    gender: 'M',
    label: `KU-${age} PA`
  });
  DIVISIONS.push({
    code: `KU${age}-F`,
    ageCategory: age,
    gender: 'F',
    label: `KU-${age} PI`
  });
  DIVISIONS.push({
    code: `KU${age}-MIX`,
    ageCategory: age,
    gender: 'MIX',
    label: `KU-${age} Campuran`
  });
}

export function getDivision(code: string): Division | undefined {
  return DIVISIONS.find(d => d.code === code);
}

export function formatDivision(code: string): string {
  const div = getDivision(code);
  return div ? div.label : code;
}

export function getDivisionForAthlete(birthDate: string, gender: string, competitionYear: number): string | undefined {
  const ageCategory = calculateAgeCategory(birthDate, competitionYear);
  if (ageCategory === undefined) {
    return undefined;
  }
  // Clamp or filter within range? The instruction says: "ageCategory 8 s/d 19". Let's clamp if outside range or allow closest?
  // Let's constrain/map if within 8 s/d 19, otherwise fallback toClosest or return undefined.
  // The instruction says: "ageCategory 8 s/d 19". Let's handle ages outside by mapping to closest or undefined.
  const clampedAge = Math.max(8, Math.min(19, ageCategory));
  
  let targetGender: 'M' | 'F' | 'MIX' = 'MIX';
  const g = gender?.toUpperCase() || '';
  if (g.startsWith('L') || g.startsWith('M') || g.startsWith('PA') || g.startsWith('BOY') || g.startsWith('MALE') || g === 'PUTRA') {
    targetGender = 'M';
  } else if (g.startsWith('P') || g.startsWith('F') || g.startsWith('PI') || g.startsWith('GIRL') || g.startsWith('FEMALE') || g === 'PUTRI') {
    targetGender = 'F';
  }

  const found = DIVISIONS.find(d => d.ageCategory === clampedAge && d.gender === targetGender);
  return found?.code;
}

export function mapLegacyToDivisionCode(ageGroup?: string, gender?: string): string | undefined {
  if (!ageGroup) return undefined;
  const clean = ageGroup.toUpperCase().trim();
  const match = clean.match(/KU[- ]*(\d+)/) || clean.match(/U[- ]*(\d+)/) || clean.match(/KATEGORI[- ]*UMUR[- ]*(\d+)/);
  if (!match) return undefined;
  const age = parseInt(match[1], 10);
  if (isNaN(age) || age < 8 || age > 19) return undefined;

  let targetGender: 'M' | 'F' | 'MIX' = 'MIX';
  if (gender) {
    const g = gender.toUpperCase();
    if (g.startsWith('L') || g.startsWith('M') || g.startsWith('PA') || g.startsWith('BOY') || g.startsWith('MALE') || g === 'PUTRA') {
      targetGender = 'M';
    } else if (g.startsWith('P') || g.startsWith('F') || g.startsWith('PI') || g.startsWith('GIRL') || g.startsWith('FEMALE') || g === 'PUTRI') {
      targetGender = 'F';
    }
  } else {
    if (clean.includes('PA') || clean.includes('PUTRA') || clean.includes('BOYS') || clean.includes('COWOK')) {
      targetGender = 'M';
    } else if (clean.includes('PI') || clean.includes('PUTRI') || clean.includes('GIRLS') || clean.includes('CEWEK')) {
      targetGender = 'F';
    }
  }

  const found = DIVISIONS.find(d => d.ageCategory === age && d.gender === targetGender);
  return found?.code;
}


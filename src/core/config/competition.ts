export enum CompetitionGrade {
  LOCAL_FRIENDLY = 'local_friendly',
  CLUB_INTERNAL = 'club_internal',
  REGIONAL = 'regional',
  PROVINCIAL = 'provincial',
  NATIONAL = 'national',
  INTERNATIONAL = 'international'
}

export const COMPETITION_GRADE_LABELS: Record<CompetitionGrade, string> = {
  [CompetitionGrade.LOCAL_FRIENDLY]: 'Friendly Lokal',
  [CompetitionGrade.CLUB_INTERNAL]: 'Liga Internal Klub',
  [CompetitionGrade.REGIONAL]: 'Turnamen Regional',
  [CompetitionGrade.PROVINCIAL]: 'Kejuaraan Provinsi',
  [CompetitionGrade.NATIONAL]: 'Kejuaraan Nasional',
  [CompetitionGrade.INTERNATIONAL]: 'Turnamen Internasional',
};

export const COMPETITION_GRADE_WEIGHTS: Record<CompetitionGrade, number> = {
  [CompetitionGrade.LOCAL_FRIENDLY]: 1,
  [CompetitionGrade.CLUB_INTERNAL]: 2,
  [CompetitionGrade.REGIONAL]: 3,
  [CompetitionGrade.PROVINCIAL]: 4,
  [CompetitionGrade.NATIONAL]: 5,
  [CompetitionGrade.INTERNATIONAL]: 6,
};

export const COMPETITION_GRADE_COLORS: Record<CompetitionGrade, string> = {
  [CompetitionGrade.LOCAL_FRIENDLY]: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700',
  [CompetitionGrade.CLUB_INTERNAL]: 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900',
  [CompetitionGrade.REGIONAL]: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900',
  [CompetitionGrade.PROVINCIAL]: 'bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-900',
  [CompetitionGrade.NATIONAL]: 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-900',
  [CompetitionGrade.INTERNATIONAL]: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900',
};

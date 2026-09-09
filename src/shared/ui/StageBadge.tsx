import React from 'react';

interface StageBadgeProps {
  stage: 'tracking' | 'qa_review' | 'coach_analysis' | 'published';
  id?: string;
}

export const StageBadge: React.FC<StageBadgeProps> = ({ stage, id }) => {
  const getBadgeStyle = () => {
    switch (stage) {
      case 'tracking':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40';
      case 'qa_review':
        return 'bg-blue-50 text-blue-750 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40';
      case 'coach_analysis':
        return 'bg-purple-50 text-purple-750 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/40';
      case 'published':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40';
      default:
        return 'bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-850 dark:text-zinc-400 dark:border-zinc-800';
    }
  };

  const getBadgeLabel = () => {
    switch (stage) {
      case 'tracking':
        return 'Perekaman';
      case 'qa_review':
        return 'Pemeriksaan QA';
      case 'coach_analysis':
        return 'Analisis Coach';
      case 'published':
        return 'Siap';
      default:
        return stage;
    }
  };

  return (
    <span
      id={id}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-xl border ${getBadgeStyle()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {getBadgeLabel()}
    </span>
  );
};

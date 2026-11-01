import React from 'react';
import { Star, Clock, GitMerge, Tag } from 'lucide-react';
import { MasterRecordStatus } from '../model/types';

interface GoldenRecordBadgeProps {
  status: MasterRecordStatus | 'alias';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export const GoldenRecordBadge: React.FC<GoldenRecordBadgeProps> = ({
  status,
  size = 'md',
  showLabel = true
}) => {
  if (status === 'canonical') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-bold rounded-full border shadow-xs ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60`}>
        <Star className={size === 'sm' ? 'w-3 h-3 fill-amber-500 text-amber-500' : 'w-3.5 h-3.5 fill-amber-500 text-amber-500'} />
        {showLabel && <span>Golden Record</span>}
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-bold rounded-full border shadow-xs ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60`}>
        <Clock className={size === 'sm' ? 'w-3 h-3 text-sky-500' : 'w-3.5 h-3.5 text-sky-500'} />
        {showLabel && <span>Usulan Pending</span>}
      </span>
    );
  }

  if (status === 'merged') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-bold rounded-full border shadow-xs ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700`}>
        <GitMerge className={size === 'sm' ? 'w-3 h-3 text-zinc-500' : 'w-3.5 h-3.5 text-zinc-500'} />
        {showLabel && <span>Merged</span>}
      </span>
    );
  }

  if (status === 'alias') {
    return (
      <span className={`inline-flex items-center gap-1 font-semibold rounded-full border ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
      } bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50`}>
        <Tag className="w-2.5 h-2.5 text-purple-500" />
        {showLabel && <span>Alias</span>}
      </span>
    );
  }

  return null;
};

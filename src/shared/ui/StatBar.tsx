import React from 'react';

interface StatBarProps {
  label: string;
  percentage: number | string;
  fraction?: string;
}

export const StatBar: React.FC<StatBarProps> = ({ label, percentage, fraction }) => {
  const percentNum = typeof percentage === 'string' ? parseFloat(percentage) : percentage;
  const displayPercent = typeof percentage === 'number' ? `${percentage.toFixed(1)}%` : percentage;

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex justify-between items-baseline text-xs font-bold uppercase tracking-wider">
        <span className="text-zinc-800 dark:text-zinc-200">
          {label} {fraction && <span className="text-zinc-400 dark:text-zinc-500 lowercase font-medium">{fraction}</span>}
        </span>
        <span className="text-brand-orange font-extrabold">{displayPercent}</span>
      </div>
      <div className="h-2 bg-zinc-100 dark:bg-zinc-800/80 rounded-full overflow-hidden w-full border border-zinc-200/20">
        <div 
          className="h-full bg-brand-orange rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${Math.min(100, Math.max(0, percentNum))}%` }} 
        />
      </div>
    </div>
  );
};

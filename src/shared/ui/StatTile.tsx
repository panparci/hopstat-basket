import React from 'react';
import { CountUp } from './CountUp';

interface StatTileProps {
  label: string;
  value: string | number;
  subValue?: string;
  tooltip?: string;
}

export const StatTile: React.FC<StatTileProps> = ({ label, value, subValue, tooltip }) => {
  let renderedValue: React.ReactNode = value;
  
  if (typeof value === 'number') {
    renderedValue = <CountUp value={value} decimals={Number.isInteger(value) ? 0 : 1} />;
  } else if (typeof value === 'string') {
    const isPercent = value.endsWith('%');
    const numericStr = isPercent ? value.slice(0, -1) : value;
    const num = parseFloat(numericStr);
    if (!isNaN(num)) {
      const decimals = numericStr.includes('.') ? numericStr.split('.')[1].length : 0;
      renderedValue = <CountUp value={num} decimals={decimals} suffix={isPercent ? '%' : ''} />;
    }
  }

  return (
    <div 
      className="bg-white dark:bg-zinc-900 border border-brand-orange/40 dark:border-brand-orange/30 rounded-xl p-3.5 flex flex-col items-center justify-center text-center relative group min-h-[100px] shadow-sm select-none"
      title={tooltip}
    >
      <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
        {label}
      </span>
      <span className="text-3xl font-extrabold font-display text-brand-orange leading-none my-1 block">
        {renderedValue}
      </span>
      {subValue && (
        <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 block">
          {subValue}
        </span>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';

const CountUp: React.FC<{ value: string | number }> = ({ value }) => {
  const strVal = String(value);
  const numericPart = parseFloat(strVal.replace(/[^0-9.]/g, ''));
  const unit = strVal.replace(/[0-9.]/g, '');

  const [displayVal, setDisplayVal] = useState<number>(0);

  useEffect(() => {
    if (isNaN(numericPart)) {
      return;
    }
    
    let start = 0;
    const end = numericPart;
    if (start === end) {
      setDisplayVal(end);
      return;
    }

    const duration = 400; // fast & responsive ms
    const increment = end / (duration / 16); // approx 60 FPS
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        clearInterval(timer);
        setDisplayVal(end);
      } else {
        setDisplayVal(current);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value, numericPart]);

  if (isNaN(numericPart)) {
    return <span>{value}</span>;
  }

  const isInt = numericPart % 1 === 0;
  const formatted = isInt ? Math.round(displayVal) : displayVal.toFixed(1);

  return <span>{formatted}{unit}</span>;
};

export const StatsSummary: React.FC<{ 
  stats: { label: string; value: string | number; subValue?: string; tooltip?: string }[];
  cols?: 2 | 3 | 4;
}> = ({ stats, cols = 3 }) => {
  const colClass = cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-4' : 'grid-cols-3';
  return (
    <div className={`grid ${colClass} gap-3 my-4`}>
      {stats.map((stat, idx) => (
        <div key={`${stat.label}-${idx}`} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm text-center transition-colors relative group" title={stat.tooltip}>
          <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">{stat.label}</div>
          <div className="font-display font-black italic text-3xl text-brand-navy dark:text-brand-orange leading-none">
            <CountUp value={stat.value} />
          </div>
          {stat.subValue && <div className="text-xs font-bold text-zinc-400 mt-1">{stat.subValue}</div>}
        </div>
      ))}
    </div>
  );
};

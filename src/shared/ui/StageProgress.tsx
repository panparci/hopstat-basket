import React from 'react';
import { Check, ClipboardList, ShieldCheck, BarChart4, Globe } from 'lucide-react';

interface StageProgressProps {
  stage: 'tracking' | 'qa_review' | 'coach_analysis' | 'published';
  id?: string;
}

export const StageProgress: React.FC<StageProgressProps> = ({ stage, id }) => {
  const steps = [
    { key: 'tracking', label: 'Direkam', icon: ClipboardList, desc: 'Petugas mencatat statistik' },
    { key: 'qa_review', label: 'Diperiksa QA', icon: ShieldCheck, desc: 'Ditinjau oleh Quality Assurance' },
    { key: 'coach_analysis', label: 'Dianalisis Coach', icon: BarChart4, desc: 'Analisis Coach Bersertifikat' },
    { key: 'published', label: 'Siap', icon: Globe, desc: 'Statistik dipublikasi ke publik' },
  ];

  const getStageIndex = (s: string) => {
    switch (s) {
      case 'tracking': return 0;
      case 'qa_review': return 1;
      case 'coach_analysis': return 2;
      case 'published': return 3;
      default: return 0;
    }
  };

  const currentIndex = getStageIndex(stage);

  return (
    <div id={id} className="w-full font-sans bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-5 rounded-3xl shadow-sm">
      <div className="flex items-center justify-between gap-1 md:gap-4 relative overflow-hidden">
        {/* Background connector line */}
        <div className="absolute top-[22px] left-[10%] right-[10%] h-[2px] bg-zinc-200 dark:bg-zinc-800 -z-0" />
        
        {/* Active connector line fill */}
        <div 
          className="absolute top-[22px] left-[10%] h-[2px] bg-brand-navy dark:bg-brand-orange transition-all duration-500 -z-0 animate-pulse"
          style={{ width: `${(currentIndex / (steps.length - 1)) * 80}%` }}
        />

        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;
          
          return (
            <div key={step.key} className="flex flex-col items-center flex-1 text-center group z-10">
              {/* Step Circle Icon */}
              <div 
                className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-350 shadow-sm ${
                  isCompleted 
                    ? 'bg-brand-navy border-brand-navy text-white dark:bg-brand-orange dark:border-brand-orange dark:text-brand-navy' 
                    : isActive 
                      ? 'bg-white border-brand-navy dark:bg-zinc-900 dark:border-brand-orange text-brand-navy dark:text-brand-orange ring-4 ring-brand-navy/10 dark:ring-brand-orange/10 scale-105' 
                      : 'bg-zinc-50 border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 text-zinc-400'
                }`}
              >
                {isCompleted ? (
                  <Check size={18} className="stroke-[3px]" />
                ) : (
                  <Icon size={18} />
                )}
              </div>

              {/* Step Label */}
              <span className={`text-[11px] font-black uppercase tracking-wider mt-2.5 transition-colors duration-250 ${
                isActive 
                  ? 'text-brand-navy dark:text-brand-orange' 
                  : isCompleted 
                    ? 'text-zinc-700 dark:text-zinc-300 font-extrabold' 
                    : 'text-zinc-400'
              }`}>
                {step.label}
              </span>

              {/* Step Description */}
              <span className="hidden md:block text-[9px] text-zinc-450 dark:text-zinc-500 mt-1 max-w-[110px] leading-tight">
                {step.desc}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

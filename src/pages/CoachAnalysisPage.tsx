import React from 'react';
import { CoachAnalysis } from '../features/coach-analysis/ui/CoachAnalysis';

export const CoachAnalysisPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
      <CoachAnalysis />
    </div>
  );
};

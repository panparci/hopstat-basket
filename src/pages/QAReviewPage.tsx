import React from 'react';
import { QAReview } from '../features/production-pipeline/ui/QAReview';

export const QAReviewPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 py-6">
      <QAReview />
    </div>
  );
};

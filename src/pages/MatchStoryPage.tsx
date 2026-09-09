import React from 'react';
import { MatchStory } from '../features/match-story/ui/MatchStory';

export const MatchStoryPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
      <MatchStory />
    </div>
  );
};

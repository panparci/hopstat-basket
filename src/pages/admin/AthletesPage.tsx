import React from 'react';
import { AthleteDirectory } from '../../features/athlete-directory/ui/AthleteDirectory';

export const AthletesPage: React.FC = () => {
  return (
    <div className="py-2">
      <AthleteDirectory />
    </div>
  );
};

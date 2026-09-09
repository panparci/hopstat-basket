import React, { useState } from 'react';
import { getInitials, getStringColor } from '../lib/stringUtils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';

export interface AvatarProps {
  name: string;
  photoUrl?: string;
  size?: AvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
  '2xl': 'w-32 h-32 text-4xl',
  '3xl': 'w-48 h-48 text-6xl',
  full: 'w-full h-full text-4xl',
};

export const Avatar: React.FC<AvatarProps> = ({ 
  name, 
  photoUrl, 
  size = 'md', 
  className = '' 
}) => {
  const [imageError, setImageError] = useState(false);

  const initials = getInitials(name || 'Unknown');
  const bgColorClass = getStringColor(name || 'Unknown');
  const sizeClass = SIZE_CLASSES[size];

  if (photoUrl && !imageError) {
    return (
      <div className={`relative rounded-full overflow-hidden shrink-0 ${sizeClass} ${className}`}>
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center justify-center rounded-full shrink-0 font-bold text-white uppercase shadow-sm ${bgColorClass} ${sizeClass} ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
};

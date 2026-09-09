import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="w-full">
      {children}
    </div>
  );
};

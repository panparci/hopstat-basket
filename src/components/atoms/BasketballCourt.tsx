import React from 'react';

interface BasketballCourtProps {
  onClick?: (x: number, y: number) => void;
  children?: React.ReactNode;
  className?: string;
  points?: number;
}

export const BasketballCourt: React.FC<BasketballCourtProps> = ({ onClick, children, className = '', points }) => {
  const handleCourtClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (points) {
      const x_m = (x / 100) * 15;
      const y_m = ((100 - y) / 100) * 14;

      let isInside = false;
      
      if (x_m >= 0.9 && x_m <= 14.1) {
        if (y_m <= 2.99) {
          isInside = true;
        } else {
          const hx = 7.5;
          const hy = 1.575;
          const distance = Math.sqrt(Math.pow(x_m - hx, 2) + Math.pow(y_m - hy, 2));
          if (distance <= 6.75) {
            isInside = true;
          }
        }
      }

      if (points === 2 && !isInside) return; // Must click inside 2PT area
      if (points === 3 && isInside) return; // Must click outside 2PT area
    }

    onClick(x, y);
  };

  return (
    <div 
      className={`relative w-full aspect-[15/14] bg-zinc-100 dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-800 rounded-2xl overflow-hidden ${onClick ? 'cursor-crosshair' : ''} ${className}`}
      onClick={handleCourtClick}
    >
      {/* Paint (Key) */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[32.66%] h-[41.42%] border-2 border-zinc-200 dark:border-zinc-800/80 bg-zinc-200/50 dark:bg-zinc-800/40 pointer-events-none"></div>

      {/* Free Throw Circle */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-[24%] aspect-square pointer-events-none"
        style={{ bottom: '28.57%' }}
      >
        {/* Top half (solid) */}
        <div className="absolute top-0 left-0 w-full h-1/2 border-2 border-b-0 border-zinc-350 dark:border-zinc-700 rounded-t-full"></div>
        {/* Bottom half (dashed) */}
        <div className="absolute bottom-0 left-0 w-full h-1/2 border-2 border-t-0 border-dashed border-zinc-350 dark:border-zinc-700/60 rounded-b-full"></div>
      </div>

      {/* 3PT Line - Arc */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-[90%] aspect-square border-2 border-zinc-350 dark:border-zinc-700 rounded-full pointer-events-none"
        style={{ bottom: '-36.96%' }}
      >
        {/* Helper overlay for 2PT/3PT area visualization */}
        {points === 2 && (
          <div className="absolute inset-0 bg-[#000000] opacity-0" />
        )}
      </div>

      {/* 2PT Area Highlight Overlay */}
      {points === 2 && (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-black/40 z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 94% 100%, 94% 78.65%, 50% 10%, 6% 78.65%, 6% 100%, 0 100%)' }}>
           {/* We just use an SVG or clipPath for perfect clipping of the 3PT area */}
        </div>
      )}

      {/* 3PT Line - Straight sides (Covering the arc's bottom parts) */}
      <div className="absolute bottom-0 left-[6%] w-[2px] h-[21.35%] bg-zinc-350 dark:bg-zinc-700 pointer-events-none"></div>
      <div className="absolute bottom-0 right-[6%] w-[2px] h-[21.35%] bg-zinc-350 dark:bg-zinc-700 pointer-events-none"></div>
      
      {/* Hide the arc outside the straight lines by overlaying background color */}
      <div className="absolute bottom-0 left-0 w-[6%] h-[21.35%] bg-zinc-100 dark:bg-zinc-900 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[6%] h-[21.35%] bg-zinc-100 dark:bg-zinc-900 pointer-events-none"></div>

      {/* Restricted Area Arc */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-[16.66%] aspect-square border-2 border-zinc-300 dark:border-zinc-700 rounded-full pointer-events-none"
        style={{ bottom: '2.32%' }}
      ></div>
      {/* Hide bottom half of restricted area */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[17%] h-[11.25%] bg-zinc-200/50 dark:bg-zinc-800/40 pointer-events-none"></div>

      {/* Backboard */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-[12%] h-[2px] bg-zinc-400 dark:bg-zinc-650 pointer-events-none"
        style={{ bottom: '8.57%' }}
      ></div>

      {/* Hoop */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-[3%] aspect-square border-2 border-red-500/80 rounded-full pointer-events-none"
        style={{ bottom: '9.75%' }}
      ></div>

      {/* Children (Dots, etc) */}
      {children}
    </div>
  );
};

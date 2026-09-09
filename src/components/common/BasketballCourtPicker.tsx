import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';

interface BasketballCourtPickerProps {
  onLocationSelect: (x: number, y: number, area: '2pt' | '3pt') => void;
  allowedArea?: '2pt' | '3pt' | 'any';
  initialX?: number;
  initialY?: number;
}

export const BasketballCourtPicker: React.FC<BasketballCourtPickerProps> = ({
  onLocationSelect,
  allowedArea = 'any',
  initialX,
  initialY
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPos, setSelectedPos] = useState<{ x: number, y: number } | null>(
    initialX !== undefined && initialY !== undefined ? { x: initialX, y: initialY } : null
  );

  React.useEffect(() => {
    if (initialX !== undefined && initialY !== undefined) {
      setSelectedPos({ x: initialX, y: initialY });
    } else {
      setSelectedPos(null);
    }
  }, [initialX, initialY]);

  const [hoverArea, setHoverArea] = useState<'2pt' | '3pt' | null>(null);

  const calculateArea = (x: number, yPercent: number): '2pt' | '3pt' => {
    // Map vertical percentage (0..100) to standard SVG coordinate space (0..90)
    const ySvg = yPercent * 0.9;

    // If y is in the straight-line corner section (ySvg < 28)
    if (ySvg < 28) {
      if (x < 8 || x > 92) return '3pt';
      return '2pt';
    }

    // If y is in the arc section (ySvg >= 28)
    // The arc is a perfect circle centered at (50, 28) with a radius of 42 in SVG coordinate space
    const dx = x - 50;
    const dy = ySvg - 28;
    const dist = Math.sqrt(dx * dx + dy * dy);

    return dist > 42 ? '3pt' : '2pt';
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const area = calculateArea(x, y);

    if (allowedArea !== 'any' && allowedArea !== area) {
      return;
    }

    setSelectedPos({ x, y });
    onLocationSelect(x, y, area);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Keep raw x, y bound within court limits
    if (x >= 0 && x <= 100 && y >= 0 && y <= 90) {
      setHoverArea(calculateArea(x, y));
    } else {
      setHoverArea(null);
    }
  };

  const handlePointerLeave = () => {
    setHoverArea(null);
  };

  const isCursorAllowed = allowedArea === 'any' || !hoverArea || hoverArea === allowedArea;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {allowedArea !== 'any' && !selectedPos && (
        <div className="text-center font-black text-xs uppercase tracking-widest text-brand-navy dark:text-brand-orange animate-pulse">
          🎯 Pilih Lokasi Tembakan {allowedArea === '2pt' ? '2PT' : '3PT'}
        </div>
      )}

      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={`relative aspect-[10/9] w-full max-w-md bg-zinc-100 dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden touch-none select-none transition-colors ${
          isCursorAllowed ? 'cursor-crosshair' : 'cursor-not-allowed'
        }`}
      >
        {/* Court Shading & Lines SVG */}
        <svg viewBox="0 0 100 90" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none fill-none" strokeWidth="0.8">
          {/* Forbidden Zones Gray-out overlay */}
          {allowedArea === '2pt' && (
            // Shading outstanding 3pt area
            <path 
              d="M 0 0 L 0 90 L 100 90 L 100 0 L 92 0 L 92 28 A 42 42 0 0 1 8 28 L 8 0 Z" 
              fill="currentColor" 
              className="text-zinc-300/40 dark:text-zinc-950/60" 
            />
          )}

          {allowedArea === '3pt' && (
            // Shading inside 2pt area
            <path 
              d="M 8 0 L 8 28 A 42 42 0 0 0 92 28 L 92 0 Z" 
              fill="currentColor" 
              className="text-zinc-300/40 dark:text-zinc-950/60" 
            />
          )}

          {/* Lines */}
          <g className="opacity-40 dark:opacity-20 stroke-current text-zinc-900 dark:text-zinc-100">
            {/* Outer Boundary */}
            <rect x="0" y="0" width="100" height="90" />
            
            {/* Half Court Line */}
            <line x1="0" y1="90" x2="100" y2="90" />
            
            {/* Key / Paint */}
            <rect x="34" y="0" width="32" height="38" />
            <circle cx="50" cy="38" r="12" />
            <circle cx="50" cy="38" r="12" strokeDasharray="2 2" className="opacity-50" />

            {/* Hoop & Backdrop */}
            <line x1="42" y1="8" x2="58" y2="8" strokeWidth="1.5" />
            <circle cx="50" cy="11" r="3" strokeWidth="1.2" />

            {/* 3pt Arc */}
            {/* Path for NBA 3pt line: straight lines at corners, arc in middle */}
            <path d="M 8 0 L 8 28 A 42 42 0 0 0 92 28 L 92 0" />

            {/* Restricted Area */}
            <path d="M 42 11 A 8 8 0 0 0 58 11" strokeDasharray="1 1" />
          </g>
        </svg>

        {/* Selected Marker */}
        {selectedPos && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute w-6 h-6 -ml-3 -mt-3 flex items-center justify-center pointer-events-none"
            style={{ left: `${selectedPos.x}%`, top: `${selectedPos.y}%` }}
          >
            <div className="w-full h-full bg-red-500 rounded-full animate-ping opacity-50 absolute" />
            <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-lg relative z-10" />
          </motion.div>
        )}
      </div>

      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full bg-blue-500 ${allowedArea === '3pt' ? 'opacity-30' : ''}`} />
          <span className={`text-xs font-bold ${allowedArea === '3pt' ? 'text-zinc-400 dark:text-zinc-600 line-through' : 'text-zinc-500'}`}>
            Zona 2PT
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full bg-emerald-500 ${allowedArea === '2pt' ? 'opacity-30' : ''}`} />
          <span className={`text-xs font-bold ${allowedArea === '2pt' ? 'text-zinc-400 dark:text-zinc-600 line-through' : 'text-zinc-500'}`}>
            Zona 3PT
          </span>
        </div>
      </div>
    </div>
  );
};

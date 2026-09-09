import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Brain, Quote, Sparkles } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { getHighlights, Highlight } from '../model/highlights';

export const HighlightCarousel: React.FC = () => {
  const navigate = useNavigate();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine how many cards to show
  const visibleCount = width < 640 ? 1 : width < 1024 ? 2 : 3;

  useEffect(() => {
    const fetchHighlights = async () => {
      try {
        const data = await getHighlights();
        setHighlights(data);
      } catch (err) {
        console.error('Error fetching highlights:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHighlights();
  }, []);

  const maxIndex = Math.max(0, highlights.length - visibleCount);

  // Reset current index if it goes out of bounds on resize
  useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(maxIndex);
    }
  }, [visibleCount, maxIndex, currentIndex]);

  // Auto-advance loop
  useEffect(() => {
    if (isHovered || highlights.length <= visibleCount) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, 5000);

    return () => clearInterval(interval);
  }, [isHovered, maxIndex, highlights.length, visibleCount]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? maxIndex : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  };

  if (loading) {
    return (
      <div className="w-full h-48 flex items-center justify-center bg-white dark:bg-zinc-950 rounded-[2rem] border border-zinc-100 dark:border-zinc-800">
        <div className="flex flex-col items-center gap-2">
          <Brain className="animate-pulse text-brand-orange" size={28} />
          <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Memuat etalase unggulan...</span>
        </div>
      </div>
    );
  }

  if (highlights.length === 0) {
    return null;
  }

  return (
    <div 
      className="w-full relative mb-6"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center text-brand-orange">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-white">Etalase Analisis Unggulan</h2>
            <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-bold uppercase">Komentar Coach Bersertifikat & Momentum Pertandingan</p>
          </div>
        </div>

        {highlights.length > visibleCount && (
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-all cursor-pointer shadow-sm"
              aria-label="Previous Highlight"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-all cursor-pointer shadow-sm"
              aria-label="Next Highlight"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Carousel container */}
      <div className="overflow-hidden w-full rounded-[2rem] p-1">
        <div 
          className="flex transition-transform duration-500 ease-out gap-4"
          style={{ transform: `translateX(-${currentIndex * (100 / visibleCount + (16 / visibleCount) * (visibleCount - 1) / 100)}%)` }}
        >
          {highlights.map((item, idx) => {
            // Determine split offset for mini recharts
            const margins = item.momentumPoints.map((d) => d.margin);
            const max = Math.max(...margins, 1);
            const min = Math.min(...margins, -1);
            const absMin = Math.abs(min);
            const off = max + absMin === 0 ? 0.5 : max / (max - min);

            return (
              <motion.div
                key={`${item.matchId}-${idx}`}
                className="flex-shrink-0 group cursor-pointer"
                style={{ width: `calc((100% - ${(visibleCount - 1) * 16}px) / ${visibleCount})` }}
                whileHover={{ y: -3 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                onClick={() => navigate(`/story/${item.matchId}`)}
              >
                <div className="h-full bg-white dark:bg-zinc-950 rounded-[2rem] border border-zinc-150 dark:border-zinc-800/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    {/* Coach Header */}
                    <div className="flex items-center gap-1.5 text-[10px] text-brand-orange dark:text-orange-400 font-extrabold uppercase tracking-wider mb-2">
                      <Brain size={12} className="text-brand-orange" />
                      <span className="truncate max-w-[180px]">{item.coachName}</span>
                    </div>

                    {/* Match Title */}
                    <h3 className="font-black text-zinc-900 dark:text-white uppercase text-xs line-clamp-1 group-hover:text-brand-orange transition-colors leading-tight">
                      {item.matchTitle}
                    </h3>

                    {/* Mini Match Momentum Chart */}
                    <div className="relative h-12 w-full mt-2 bg-zinc-50/50 dark:bg-zinc-900/10 rounded-xl overflow-hidden p-1 border border-zinc-100/50 dark:border-zinc-800/30">
                      <div className="absolute top-1 left-2 text-[8px] font-bold uppercase tracking-wider text-zinc-400 z-10">Match Momentum</div>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={item.momentumPoints} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                          <defs>
                            <linearGradient id={`splitColor-mini-${idx}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset={off} stopColor="#1e3b8b" stopOpacity={0.5} />
                              <stop offset={off} stopColor="#ef4444" stopOpacity={0.5} />
                            </linearGradient>
                          </defs>
                          <ReferenceLine y={0} stroke="#d4d4d8" strokeWidth={0.75} strokeDasharray="2 2" />
                          <Area
                            type="monotone"
                            dataKey="margin"
                            stroke="#71717a"
                            strokeWidth={1}
                            fill={`url(#splitColor-mini-${idx})`}
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Snippet quote */}
                    {item.snippet && (
                      <div className="relative mt-2.5 p-2.5 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl border border-zinc-100 dark:border-zinc-800/50 flex flex-col">
                        <Quote size={10} className="text-zinc-300 dark:text-zinc-700 absolute top-2 left-2" />
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed italic pl-4 line-clamp-2">
                          "{item.snippet}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer view indicator */}
                  <div className="flex justify-end mt-3 text-[9px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-brand-orange transition-colors gap-0.5 items-center">
                    <span>Mulai Analisis</span>
                    <ChevronRight size={10} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Slide indicators / dots */}
      {highlights.length > visibleCount && (
        <div className="flex justify-center items-center gap-1.5 mt-3">
          {Array.from({ length: maxIndex + 1 }).map((_, dotIdx) => (
            <button
              key={dotIdx}
              onClick={() => setCurrentIndex(dotIdx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                currentIndex === dotIdx 
                  ? 'w-5 bg-brand-orange' 
                  : 'w-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700'
              }`}
              aria-label={`Go to slide page ${dotIdx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

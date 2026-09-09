import React from 'react';
import { motion } from 'motion/react';
import { Play, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

interface HeroProps {
  onSignupClick: () => void;
  onDemoClick: () => void;
  hero?: {
    headline: string;
    subheadline: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
}

const mockChartData = [
  { game: 'G1', PTS: 12, AST: 3 },
  { game: 'G2', PTS: 18, AST: 5 },
  { game: 'G3', PTS: 15, AST: 4 },
  { game: 'G4', PTS: 24, AST: 7 },
  { game: 'G5', PTS: 22, AST: 6 },
];

export const Hero: React.FC<HeroProps> = ({ onSignupClick, onDemoClick, hero }) => {
  return (
    <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32 bg-radial-at-t from-zinc-50 via-white to-zinc-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900">
      {/* Decorative Grid Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Text Content */}
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-brand-navy/5 dark:bg-brand-orange/10 border border-brand-navy/10 dark:border-brand-orange/20 rounded-full"
            >
              <Sparkles size={14} className="text-brand-navy dark:text-brand-orange" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-brand-navy dark:text-brand-orange">
                AI-Powered Basketball Analytics
              </span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-5xl sm:text-6xl md:text-7xl font-black italic uppercase leading-none tracking-tight text-brand-navy dark:text-white"
            >
              {hero?.headline ? (
                <span className="whitespace-pre-line">{hero.headline}</span>
              ) : (
                <>
                  STATISTIK NYATA.<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-navy to-blue-600 dark:from-brand-orange dark:to-amber-500">
                    PERKEMBANGAN NYATA.
                  </span>
                </>
              )}
            </motion.h1>

            {/* Subheading */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-2xl mx-auto lg:mx-0 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed"
            >
              {hero?.subheadline || "Catat statistik pertandingan basket anak Anda secara real-time, dapatkan review mendalam dari AI Coach, dan pantau tren perkembangan performa untuk membuka jalan karir basket masa depannya."}
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
            >
              <Button
                variant="primary"
                size="lg"
                onClick={onSignupClick}
                className="w-full sm:w-auto bg-brand-navy text-white hover:bg-brand-navy/90 dark:bg-brand-orange dark:text-brand-navy dark:hover:bg-brand-orange/90 flex items-center gap-2 group"
              >
                {hero?.ctaPrimary || "Coba Gratis Sekarang"}
                <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={onDemoClick}
                className="w-full sm:w-auto border border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2"
              >
                <Play size={14} className="fill-current text-zinc-700 dark:text-zinc-300" />
                {hero?.ctaSecondary || "Lihat Demo"}
              </Button>
            </motion.div>
          </div>

          {/* Graphic Mockup Area */}
          <div className="lg:col-span-5 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, rotate: 1 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative mx-auto max-w-[420px] lg:max-w-none"
            >
              {/* Scorecard Widget (Top overlay) */}
              <Card className="absolute -top-8 -left-4 sm:-left-8 z-20 w-64 p-4 shadow-xl border border-zinc-100 dark:border-zinc-800 rotate-[-2deg]">
                <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  <span>Match Live</span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                    <span className="text-red-500 font-extrabold">Q4 02:45</span>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-center flex-1">
                    <div className="font-display font-black text-xs text-brand-navy dark:text-white uppercase truncate">Satria Muda U14</div>
                    <div className="text-2xl font-black font-display tracking-tight text-brand-navy dark:text-white">68</div>
                  </div>
                  <div className="text-zinc-300 dark:text-zinc-700 font-display font-bold text-xs">VS</div>
                  <div className="text-center flex-1">
                    <div className="font-display font-black text-xs text-brand-navy dark:text-white uppercase truncate">CLS Surabaya U14</div>
                    <div className="text-2xl font-black font-display tracking-tight text-brand-navy dark:text-white">62</div>
                  </div>
                </div>
              </Card>

              {/* Main App Preview Container */}
              <div className="bg-zinc-900 text-white rounded-[2.5rem] border-8 border-zinc-950 p-6 shadow-2xl relative overflow-hidden aspect-[4/5] sm:aspect-auto">
                <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Player Profile</span>
                    <h3 className="font-display text-lg font-bold italic text-brand-orange uppercase">Bintang Santoso #10</h3>
                  </div>
                  <span className="bg-brand-orange text-brand-navy font-display text-[10px] font-black px-2 py-1 rounded-md uppercase">
                    PRO
                  </span>
                </div>

                {/* Score Widget Grid */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">PTS</span>
                    <span className="font-display text-xl font-extrabold text-white">24.2</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">AST</span>
                    <span className="font-display text-xl font-extrabold text-white">6.8</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">REB</span>
                    <span className="font-display text-xl font-extrabold text-white">11.4</span>
                  </div>
                </div>

                {/* Recharts Area */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp size={10} className="text-emerald-400" /> Tren PTS (5 Pertandingan Terakhir)
                    </span>
                    <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      +15.2%
                    </span>
                  </div>
                  <div className="h-28 w-full bg-white/5 rounded-xl p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mockChartData}>
                        <XAxis dataKey="game" stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} domain={[0, 30]} width={15} />
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', fontSize: 10 }} />
                        <Line type="monotone" dataKey="PTS" stroke="var(--color-brand-orange)" strokeWidth={3} dot={{ fill: 'var(--color-brand-orange)', r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="AST" stroke="#3b82f6" strokeWidth={1.5} dot={{ fill: '#3b82f6', r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* AI Review Snippet (Bottom overlay style inside) */}
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-brand-orange/20 rounded-2xl p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-brand-orange uppercase tracking-wider mb-1">
                    <Sparkles size={11} /> AI Coach Review
                  </div>
                  <p className="text-[10px] text-zinc-300 leading-relaxed italic">
                    "Efisiensi offense Bintang meningkat pesat saat fast break set, mencatatkan 82% FG% di area perimeter kanan. Fokuskan latihan pick-and-roll untuk game selanjutnya."
                  </p>
                </div>
              </div>

              {/* Decorative behind elements */}
              <div className="absolute -bottom-6 -right-6 -z-10 w-44 h-44 bg-brand-orange/10 dark:bg-brand-orange/5 rounded-full blur-2xl" />
              <div className="absolute -top-12 -left-12 -z-10 w-44 h-44 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-2xl" />
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
};

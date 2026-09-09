import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { LeadForm } from './LeadForm';

interface CtaBannerProps {
  onCtaClick: () => void;
}

export const CtaBanner: React.FC<CtaBannerProps> = () => {
  return (
    <section className="relative overflow-hidden py-20 bg-brand-navy dark:bg-zinc-950 text-white border-t border-b border-white/5">
      {/* Sporty Diagonal Stripe details in the background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[repeating-linear-gradient(45deg,#fff,#fff_10px,transparent_10px,transparent_20px)]" />
      </div>

      {/* Radiant glow dots */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-orange/10 dark:bg-brand-orange/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Copy info */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Visual Badge */}
            <div className="flex justify-center lg:justify-start">
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 dark:bg-brand-orange/10 border border-white/10 dark:border-brand-orange/20 rounded-full"
              >
                <Sparkles size={12} className="text-brand-orange" />
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-orange">
                  Mulai Langkah Pertama
                </span>
              </motion.div>
            </div>

            {/* Content Headline */}
            <div className="space-y-4">
              <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-black italic uppercase leading-none tracking-tight text-white">
                SIAP MELACAK & MEMAKSIMALKAN POTENSI ATLET?
              </h2>
              <p className="text-zinc-300 font-medium text-xs sm:text-sm md:text-base leading-relaxed">
                Bergabunglah dengan ribuan orang tua, pelatih, dan pemain yang menggunakan HoopStats untuk melacak pertumbuhan basket secara profesional. Isi formulir untuk berbicara dengan tim kami.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <div className="text-zinc-950 dark:text-white">
              <LeadForm source="landing_footer" defaultInterest="free" />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

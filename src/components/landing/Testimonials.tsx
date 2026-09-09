import React from 'react';
import { motion } from 'motion/react';
import { Quote, Star } from 'lucide-react';
import { TESTIMONIALS } from '../../core/config/landingContent';
import { Card } from '../atoms/Card';
import { Testimonial } from '../../core/types/cms';
import { Avatar } from '../../shared/ui/Avatar';

interface TestimonialsProps {
  testimonials?: Testimonial[];
}

export const Testimonials: React.FC<TestimonialsProps> = ({ testimonials }) => {
  const displayTestimonials = testimonials || TESTIMONIALS.map(t => ({
    id: t.id,
    quote: t.quote,
    name: t.name,
    role: t.role
  }));

  return (
    <section className="py-20 bg-zinc-50 dark:bg-zinc-900/40 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Title */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-black uppercase tracking-wider text-brand-orange bg-brand-orange/10 px-3 py-1 rounded-full border border-brand-orange/20">
            Suara Pengguna
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-black italic uppercase text-brand-navy dark:text-white leading-tight">
            APA KATA ORANG TUA DAN PELATIH
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium text-sm md:text-base">
            Cerita sukses dari mereka yang telah mengubah cara melacak dan mengevaluasi performa atlet basket masa depan.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {displayTestimonials.map((testi, idx: number) => (
            <motion.div
              key={testi.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
            >
              <Card className="h-full p-8 border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="space-y-6">
                  {/* Quote icon & stars */}
                  <div className="flex justify-between items-center">
                    <div className="bg-brand-navy/5 dark:bg-brand-orange/10 p-2.5 rounded-xl text-brand-navy dark:text-brand-orange">
                      <Quote size={20} className="fill-current" />
                    </div>
                    <div className="flex gap-0.5 text-brand-orange">
                      {[...Array(5)].map((_, sIdx) => (
                        <Star key={sIdx} size={14} className="fill-current" />
                      ))}
                    </div>
                  </div>

                  {/* Quote Content */}
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 italic leading-relaxed font-medium">
                    "{testi.quote}"
                  </p>
                </div>

                {/* Profile Card Footer */}
                <div className="flex items-center gap-3 pt-6 border-t border-zinc-100 dark:border-zinc-900 mt-6">
                  {/* Circle initials avatar */}
                  <Avatar name={testi.name} size="md" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-tight text-brand-navy dark:text-white">
                      {testi.name}
                    </h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                      {testi.role}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

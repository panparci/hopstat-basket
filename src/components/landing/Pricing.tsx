import React from 'react';
import { motion } from 'motion/react';
import { Check, Star, ArrowRight } from 'lucide-react';
import { PRICE_PLANS } from '../../core/config/landingContent';
import { Card } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { PricingPackage } from '../../core/types/cms';

interface PricingProps {
  onPlanSelect: (planId: string) => void;
  plans?: PricingPackage[];
}

export const Pricing: React.FC<PricingProps> = ({ onPlanSelect, plans }) => {
  const displayPlans = plans || PRICE_PLANS.map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    period: p.period,
    features: p.features,
    highlighted: p.isPopular || false,
    ctaText: p.ctaText
  }));

  return (
    <section id="pricing" className="py-20 bg-white dark:bg-zinc-950 relative overflow-hidden">
      {/* Visual background details */}
      <div className="absolute top-1/4 right-0 w-80 h-80 bg-brand-orange/5 dark:bg-brand-orange/2 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-brand-navy/5 dark:bg-brand-navy/2 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Title */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-black uppercase tracking-wider text-brand-orange bg-brand-orange/10 px-3 py-1 rounded-full border border-brand-orange/20">
            Pilihan Paket & Harga
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-black italic uppercase text-brand-navy dark:text-white leading-tight">
            PILIH STRATEGI PERKEMBANGAN ANDA
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium text-sm md:text-base">
            Mulai pelacakan dengan paket gratis selamanya atau tingkatkan analitik Anda dengan ulasan AI pro dan pencatatan profesional.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto">
          {displayPlans.map((plan, idx: number) => {
            const isPopular = plan.highlighted;
            // Determine cta text
            const ctaText = (plan as any).ctaText || (plan.id === 'free' ? 'Mulai Gratis' : plan.id === 'pro' ? 'Coba Pro Gratis' : 'Pesan Sekarang');
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="flex"
              >
                <Card
                  className={`relative flex flex-col justify-between w-full p-8 border ${
                    isPopular
                      ? 'border-brand-orange shadow-2xl ring-2 ring-brand-orange/30'
                      : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30'
                  }`}
                >
                  {/* Popular Ribbon Badge */}
                  {isPopular && (
                    <div className="absolute -top-4 right-6 bg-brand-orange text-brand-navy text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                      <Star size={10} className="fill-current" /> Paling Populer
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="space-y-4">
                    <div>
                      <h3 className={`text-xl font-black uppercase tracking-tight ${isPopular ? 'text-brand-orange' : 'text-brand-navy dark:text-white'}`}>
                        {plan.name}
                      </h3>
                      <p className="text-xs mt-1 leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {plan.id === 'free' 
                          ? 'Cocok untuk mencoba pencatatan statistik mandiri dasar.' 
                          : plan.id === 'pro' 
                            ? 'Sangat cocok untuk orang tua & pelatih yang ingin perkembangan analitis.' 
                            : 'Pencatatan profesional tanpa repot untuk hasil terverifikasi.'}
                      </p>
                    </div>

                    <div className="flex items-baseline gap-1 py-2">
                      <span className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white font-display">
                        {plan.price}
                      </span>
                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        / {plan.period}
                      </span>
                    </div>

                    <hr className="border-zinc-100 dark:border-zinc-800" />

                    {/* Feature list */}
                    <ul className="space-y-3 pt-2">
                      {plan.features.map((feature: string, fIdx: number) => (
                        <li key={fIdx} className="flex items-start gap-2.5">
                          <div className={`mt-0.5 rounded-full p-0.5 flex items-center justify-center shrink-0 ${
                            isPopular ? 'bg-brand-orange/15 text-brand-orange' : 'bg-brand-navy/5 text-brand-navy dark:bg-brand-orange/10 dark:text-brand-orange'
                          }`}>
                            <Check size={12} className="stroke-[3]" />
                          </div>
                          <span className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Plan CTA Button */}
                  <div className="pt-8">
                    <Button
                      variant={isPopular ? 'primary' : 'secondary'}
                      onClick={() => onPlanSelect(plan.id)}
                      className={`w-full justify-center flex items-center gap-2 group ${
                        isPopular
                          ? 'bg-brand-orange text-brand-navy hover:bg-brand-orange/90 border-0'
                          : 'border border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      {ctaText}
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

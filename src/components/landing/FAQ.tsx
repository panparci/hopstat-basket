import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { FAQ_ITEMS } from '../../core/config/landingContent';
import { Card } from '../atoms/Card';
import { FaqItem } from '../../core/types/cms';

interface FAQProps {
  faqs?: FaqItem[];
}

export const FAQ: React.FC<FAQProps> = ({ faqs }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const displayFaqs = faqs || FAQ_ITEMS;

  const toggleIndex = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 bg-white dark:bg-zinc-950 relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Title */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-black uppercase tracking-wider text-brand-orange bg-brand-orange/10 px-3 py-1 rounded-full border border-brand-orange/20">
            Pertanyaan Umum
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-black italic uppercase text-brand-navy dark:text-white leading-tight">
            FAQ & INFORMASI DETAIL
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium text-sm md:text-base">
            Masih ada pertanyaan? Di bawah ini adalah jawaban atas pertanyaan yang paling sering diajukan mengenai layanan HoopStats.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {displayFaqs.map((item, idx: number) => {
            const isOpen = openIndex === idx;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
              >
                <Card className="overflow-hidden border-zinc-100 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-900/30">
                  {/* Accordion Trigger Button */}
                  <button
                    onClick={() => toggleIndex(idx)}
                    className="w-full text-left p-6 flex items-center justify-between gap-4 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40 transition-colors focus:outline-none"
                  >
                    <div className="flex items-center gap-3">
                      <HelpCircle size={18} className="text-brand-navy dark:text-brand-orange shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                        {item.question}
                      </span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-zinc-500 dark:text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Accordion Collapsible Content */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                      >
                        <div className="px-6 pb-6 pt-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium border-t border-zinc-100/40 dark:border-zinc-800/40">
                          {item.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

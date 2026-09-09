import React from 'react';
import { motion } from 'motion/react';
import { UserPlus, Clipboard, Sparkles, ChevronRight } from 'lucide-react';
import { Card } from '../atoms/Card';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      number: '01',
      title: 'Daftar & Buat Profil Atlet',
      desc: 'Buat akun Anda secara instan dan lengkapi profil atlet muda meliputi tinggi badan, posisi, nomor punggung, tim sekolah/klub, dan kustomisasi lainnya.',
      icon: <UserPlus className="text-white" size={24} />,
      gradient: 'from-brand-navy to-blue-900 dark:from-brand-orange dark:to-amber-500'
    },
    {
      number: '02',
      title: 'Catat Match / Kirim Video',
      desc: 'Gunakan live tracker terpadu kami saat mendampingi game atlet, atau manfaatkan layanan statistik kami dengan mengirimkan link rekaman video pertandingan/YouTube.',
      icon: <Clipboard className="text-white" size={24} />,
      gradient: 'from-blue-600 to-indigo-800 dark:from-amber-500 dark:to-orange-500'
    },
    {
      number: '03',
      title: 'Terima Laporan & Review AI',
      desc: 'Dapatkan grafik efisiensi tembakan, bagan perkembagan, serta ulasan mendalam AI Coach yang membedah keunggulan taktis dan rincian latihan yang ideal.',
      icon: <Sparkles className="text-white" size={24} />,
      gradient: 'from-indigo-600 to-purple-800 dark:from-orange-500 dark:to-yellow-500'
    }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-zinc-50 dark:bg-zinc-900/50 relative overflow-hidden">
      {/* Visual background accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-navy/5 dark:bg-brand-navy/1 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Title */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-black uppercase tracking-wider text-brand-orange bg-brand-orange/10 px-3 py-1 rounded-full border border-brand-orange/20">
            Cara Kerja
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-black italic uppercase text-brand-navy dark:text-white leading-tight">
            TIGA LANGKAH MUDAH DIMULAI
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium text-sm md:text-base">
            Proses pelacakan statistik yang dirancang praktis bagi orang tua, pelatih, maupun atlet itu sendiri.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
          {/* Connector line for large screens */}
          <div className="hidden lg:block absolute top-1/2 left-12 right-12 h-0.5 bg-zinc-200 dark:bg-zinc-800 -translate-y-8 z-0" />

          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
              className="relative z-10"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                
                {/* Numbered icon badge */}
                <div className={`w-16 h-16 rounded-[1.25rem] bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-lg relative`}>
                  {step.icon}
                  <span className="absolute -top-3 -right-3 w-7 h-7 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-full flex items-center justify-center font-display text-xs font-black">
                    {step.number}
                  </span>
                </div>

                {/* Step card */}
                <Card className="p-6 border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 w-full hover:shadow-md transition-shadow">
                  <h3 className="text-lg font-black uppercase tracking-tight text-brand-navy dark:text-brand-orange mb-3">
                    {step.title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                    {step.desc}
                  </p>
                </Card>

              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

import React from 'react';
import { motion } from 'motion/react';
import { Target, Grid, Sparkles, TrendingUp, BadgeCheck, Youtube, Star } from 'lucide-react';
import { Card } from '../atoms/Card';

export const Features: React.FC = () => {
  const list = [
    {
      title: 'Live Tracking Real-time',
      desc: 'Sistem input instan yang sangat intuitif. Catat tembakan, rebound, turnover, pelanggaran, hingga konteks offense (half-court / transition) dengan satu sentuhan ringan.',
      icon: <Target className="text-brand-navy dark:text-brand-orange" size={24} />,
      badge: 'Instan'
    },
    {
      title: 'Visual Shot Chart',
      desc: 'Petakan titik tembakan akurat di lapangan basket virtual. Ketahui zona efisiensi tertinggi atlet Anda (seperti sayap kanan atau area paint) untuk meningkatkan akurasi.',
      icon: <Grid className="text-brand-navy dark:text-brand-orange" size={24} />,
      badge: 'Visual'
    },
    {
      title: 'AI Coach Review',
      desc: 'Model AI khusus yang menganalisis seluruh statistik yang dikumpulkan. Memberikan evaluasi performa mingguan ala pelatih pro lengkap dengan rekomendasi latihan terarah.',
      icon: <Sparkles className="text-brand-navy dark:text-brand-orange" size={24} />,
      badge: 'Cerdas'
    },
    {
      title: 'Grafik Perkembangan',
      desc: 'Pantau kemajuan metrik penting dari game ke game. Grafik interaktif memvisualisasikan tren kontribusi poin (PTS), assist (AST), dan statistik penting lainnya.',
      icon: <TrendingUp className="text-brand-navy dark:text-brand-orange" size={24} />,
      badge: 'Analitis'
    },
    {
      title: 'Verified by HoopStats',
      desc: 'Dapatkan lencana centang verifikasi (Verified Badge) setelah divalidasi oleh administrator kami. Jaminan 100% data akurat yang kredibel bagi agen, scout, dan pelatih.',
      icon: <BadgeCheck className="text-brand-navy dark:text-brand-orange" size={24} />,
      badge: 'Kredibel'
    },
    {
      title: 'Jasa Statistik Profesional',
      desc: 'Tidak sempat mencatat statistik langsung? Cukup kirim video pertandingan atau tautan YouTube Anda. Tim statistisi profesional kami yang akan menginputnya.',
      icon: <Youtube className="text-brand-navy dark:text-brand-orange" size={24} />,
      badge: 'Eksklusif'
    }
  ];

  return (
    <section id="features-detail" className="py-20 bg-white dark:bg-zinc-950 relative overflow-hidden">
      {/* Background ambient details */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64 h-64 bg-brand-navy/5 dark:bg-brand-navy/2 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-64 h-64 bg-brand-orange/5 dark:bg-brand-orange/2 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Title */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-black uppercase tracking-wider text-brand-orange bg-brand-orange/10 px-3 py-1 rounded-full border border-brand-orange/20">
            Fitur Utama
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-black italic uppercase text-brand-navy dark:text-white leading-tight">
            TEKNOLOGI TERBAIK UNTUK EVALUASI TIM & ATLET
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium text-sm md:text-base">
            Segala hal yang Anda butuhkan untuk mendigitalisasi data performa dan memaksimalkan potensi basket dari genggaman Anda.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {list.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
            >
              <Card className="h-full p-8 border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/70 shadow-sm hover:shadow-md hover:border-zinc-200 dark:hover:border-zinc-700 flex flex-col justify-between group">
                <div className="space-y-6">
                  {/* Icon header */}
                  <div className="flex justify-between items-center">
                    <div className="bg-brand-navy/5 dark:bg-brand-orange/10 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                      {item.icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded">
                      {item.badge}
                    </span>
                  </div>

                  {/* Text */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-black uppercase tracking-tight text-brand-navy dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                      {item.desc}
                    </p>
                  </div>
                </div>

                {/* Micro accent */}
                <div className="pt-6 flex items-center text-xs font-bold text-brand-navy dark:text-brand-orange opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                  Pelajari Selengkapnya <span className="translate-x-0 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

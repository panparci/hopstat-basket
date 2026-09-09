import React from 'react';
import { motion } from 'motion/react';
import { ClipboardList, AlertCircle, TrendingUp, HelpCircle, Trophy, UserCheck } from 'lucide-react';
import { Card } from '../atoms/Card';

export const ProblemSolution: React.FC = () => {
  const items = [
    {
      problem: {
        title: 'Statistik Manual Berantakan',
        desc: 'Mencatat dengan kertas dan pulpen sering hilang, tidak lengkap, dan sangat melelahkan di tengah panasnya pertandingan.',
        icon: <AlertCircle className="text-red-500" size={24} />,
        badge: 'Masalah 01',
        badgeColor: 'bg-red-500/10 text-red-500 border-red-500/20'
      },
      solution: {
        title: 'Live Tracking Cepat & Praktis',
        desc: 'Cukup tap di layar HP/Tablet saat pertandingan. Semua statistik tercatat aman di database offline-ready secara real-time.',
        icon: <ClipboardList className="text-emerald-500" size={24} />,
        badge: 'Solusi HoopStats',
        badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      }
    },
    {
      problem: {
        title: 'Buta Perkembangan Atlet',
        desc: 'Sulit mengukur apakah jam-jam latihan ekstra yang dijalani atlet Anda benar-benar membuahkan hasil di lapangan.',
        icon: <HelpCircle className="text-red-500" size={24} />,
        badge: 'Masalah 02',
        badgeColor: 'bg-red-500/10 text-red-500 border-red-500/20'
      },
      solution: {
        title: 'Tren Laporan & Review AI',
        desc: 'Grafik performa otomatis dan saran taktis dari AI Coach mengulas performa pertandingan ke pertandingan secara presisi.',
        icon: <TrendingUp className="text-emerald-500" size={24} />,
        badge: 'Solusi HoopStats',
        badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      }
    },
    {
      problem: {
        title: 'Sulit Dilirik Scout & Klub',
        desc: 'Tanpa rekam jejak statistik resmi, bakat luar biasa atlet Anda sulit meyakinkan pemandu bakat dan pelatih klub elite.',
        icon: <AlertCircle className="text-red-500" size={24} />,
        badge: 'Masalah 03',
        badgeColor: 'bg-red-500/10 text-red-500 border-red-500/20'
      },
      solution: {
        title: 'Profil Publik Terverifikasi',
        desc: 'Simpan portofolio performa dalam profil digital publik dengan centang verifikasi (Verified Badge) yang siap dikirim ke mana saja.',
        icon: <UserCheck className="text-emerald-500" size={24} />,
        badge: 'Solusi HoopStats',
        badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      }
    }
  ];

  return (
    <section id="features" className="py-20 bg-zinc-100/50 dark:bg-zinc-900/40 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-black uppercase tracking-wider text-brand-orange bg-brand-orange/10 px-3 py-1 rounded-full border border-brand-orange/20">
            Problem & Solution
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-black italic uppercase text-brand-navy dark:text-white leading-tight">
            UBAH CARA ANDA MELIHAT PERMAINAN
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium text-sm md:text-base">
            Kami menyelesaikan kendala terbesar dalam melacak bakat basket usia dini dengan teknologi analisis modern.
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {items.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
              className="flex flex-col gap-4"
            >
              {/* Problem Card */}
              <Card className="p-6 border-zinc-200/60 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 opacity-85 hover:opacity-100 transition-opacity">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-red-500/10 dark:bg-red-500/5 p-2 rounded-xl">
                    {item.problem.icon}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border rounded ${item.problem.badgeColor}`}>
                    {item.problem.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  {item.problem.title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                  {item.problem.desc}
                </p>
              </Card>

              {/* Connector (Arrow pointing down/right) */}
              <div className="flex justify-center text-zinc-300 dark:text-zinc-700 font-black text-sm">
                ↓
              </div>

              {/* Solution Card (Highlighted) */}
              <Card className="p-6 border-brand-navy/10 dark:border-brand-orange/20 bg-white dark:bg-zinc-950 shadow-md ring-1 ring-emerald-500/10 dark:ring-brand-orange/10 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-emerald-500/10 dark:bg-emerald-500/5 p-2 rounded-xl">
                    {item.solution.icon}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border rounded ${item.solution.badgeColor}`}>
                    {item.solution.badge}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-brand-navy dark:text-brand-orange mb-2">
                  {item.solution.title}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
                  {item.solution.desc}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

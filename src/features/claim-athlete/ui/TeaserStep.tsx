import React from 'react';
import { Users, Sparkles, Lock, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { motion } from 'motion/react';
import { ChildProfile } from '../../../entities/athlete/model/types';

// Let's import Team type if needed, but since it can be typed as any or specific, let's keep it generic/flexible.
interface Team {
  id: string;
  name: string;
  clubId?: string;
}

interface StatsSummary {
  ppg: string;
  rpg: string;
  apg: string;
  matchCount: number;
}

interface TeaserStepProps {
  matchedProfile: ChildProfile;
  matchedTeam: Team | null;
  statsSummary: StatsSummary;
  userApproved: boolean;
  userPending: boolean;
  othersVerified: boolean;
  othersPending: boolean;
  calculateKU: (dateString?: string) => string;
  onBack: () => void;
  onNext: () => void;
}

export const TeaserStep: React.FC<TeaserStepProps> = ({
  matchedProfile,
  matchedTeam,
  statsSummary,
  userApproved,
  userPending,
  othersVerified,
  othersPending,
  calculateKU,
  onBack,
  onNext
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="p-6 border-none shadow-sm space-y-6 relative overflow-hidden bg-white dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <span className="bg-brand-navy/10 text-brand-navy dark:bg-brand-orange/10 dark:text-brand-orange px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest">
              {calculateKU(matchedProfile.birthDate)}
            </span>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight uppercase">
              {matchedProfile.name}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-semibold uppercase tracking-wide">
              <Users size={12} />
              {matchedTeam ? matchedTeam.name : 'Unassigned Club'}
            </p>
          </div>
          
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-500/20">
            <Sparkles size={24} />
          </div>
        </div>

        {/* Blurred Stats Container */}
        <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-3 relative">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-2 uppercase tracking-wider">
            <span>Indikator Statistik Utama</span>
            <span className="text-emerald-500">{statsSummary.matchCount} Pertandingan</span>
          </div>

          <div className="grid grid-cols-3 gap-2 py-1">
            <div className="text-center p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-xs">
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Rata-rata Poin</span>
              <span className="text-lg font-black text-brand-navy dark:text-brand-orange">{statsSummary.ppg} PPG</span>
            </div>
            
            {/* BLURRED STATS: Rebounds & Assists */}
            <div className="text-center p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-xs relative overflow-hidden">
              <div className="absolute inset-0 bg-white/70 dark:bg-zinc-900/80 backdrop-blur-xs flex items-center justify-center">
                <Lock size={12} className="text-zinc-400" />
              </div>
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Rebounds</span>
              <span className="text-lg font-black text-zinc-300">0.0</span>
            </div>
            
            <div className="text-center p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-xs relative overflow-hidden">
              <div className="absolute inset-0 bg-white/70 dark:bg-zinc-900/80 backdrop-blur-xs flex items-center justify-center">
                <Lock size={12} className="text-zinc-400" />
              </div>
              <span className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Assists</span>
              <span className="text-lg font-black text-zinc-300">0.0</span>
            </div>
          </div>

          {/* Lock banner overlay */}
          <div className="p-3 bg-brand-navy dark:bg-zinc-800 rounded-xl text-white dark:text-brand-orange flex items-center gap-3">
            <Lock size={16} className="shrink-0 text-brand-orange" />
            <p className="text-[10px] leading-relaxed font-semibold">
              Statistik lengkap, bagan tembakan, analisis AI Coach, serta rekaman video dikunci demi privasi anak Anda. Klaim profil ini untuk membuka seluruh fitur.
            </p>
          </div>
        </div>

        {/* Double Claim Protection / Form Button */}
        {userApproved ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl flex gap-3 text-xs">
            <CheckCircle size={20} className="shrink-0" />
            <div>
              <span className="font-bold block uppercase tracking-wide mb-1">PROFIL ANDA</span>
              <p className="leading-normal">Anda sudah diverifikasi secara resmi sebagai orang tua / wali aktif untuk profil atlet ini.</p>
            </div>
          </div>
        ) : userPending ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 rounded-2xl flex gap-3 text-xs">
            <Clock size={20} className="shrink-0 animate-pulse" />
            <div>
              <span className="font-bold block uppercase tracking-wide mb-1">MENUNGGU REVIEW ADMIN</span>
              <p className="leading-normal">Anda sudah mengirimkan berkas klaim untuk atlet ini. Status saat ini masih menunggu verifikasi dokumen oleh Admin.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {(othersVerified || othersPending) && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 rounded-2xl flex gap-3 text-xs">
                <AlertCircle size={20} className="shrink-0 text-blue-500" />
                <div>
                  <span className="font-bold block uppercase tracking-wide mb-1">INFORMASI MULTI-GUARDIAN</span>
                  <p className="leading-normal">
                    Profil ini sudah diklaim atau sedang ditinjau untuk wali lain (misal salah satu orang tua). 
                    HoopStats mendukung multi-guardian terverifikasi. Anda tetap dapat melanjutkan klaim untuk menjadi wali resmi tambahan jika dokumen KK Anda sah.
                  </p>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button 
                variant="secondary"
                onClick={onBack}
                className="flex-1 rounded-2xl py-3 text-xs border-zinc-200 dark:border-zinc-800"
              >
                Kembali Cari
              </Button>
              <Button 
                onClick={onNext}
                className="flex-1 rounded-2xl py-3 text-xs flex items-center justify-center gap-2"
              >
                Mulai Klaim Atlet
              </Button>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { motion } from 'motion/react';

interface SuccessStepProps {
  matchScore: number;
  onReturnHome: () => void;
}

export const SuccessStep: React.FC<SuccessStepProps> = ({
  matchScore,
  onReturnHome
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center p-8 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-6"
    >
      <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-500 mx-auto rounded-full flex items-center justify-center border border-emerald-200 dark:border-emerald-900/30">
        <CheckCircle size={32} />
      </div>

      <div className="space-y-2">
        <h3 className="font-bold text-zinc-900 dark:text-white text-lg">Klaim Berhasil Dikirim!</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
          Kami telah mendeteksi kelengkapan Kartu Keluarga dan pembayaran Anda secara otomatis. Profil atlet di-set sementara sebagai <strong>Klaim Tertunda (Claim Pending)</strong>. Tim administrator akan memvalidasi kesesuaian data dalam waktu 1-24 jam.
        </p>
      </div>

      <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-left space-y-2 max-w-sm mx-auto">
        <div className="flex justify-between text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          <span>Rangkuman Pre-Screening</span>
          <span className="text-emerald-500 font-bold">Tinggi ({matchScore}/100)</span>
        </div>
        <p className="text-[10px] text-zinc-500 leading-normal font-semibold">
          Sistem otomatis menandai kecocokan tinggi berdasarkan keselarasan Nama, Tanggal Lahir, Klub, dan Nomor Punggung yang dikonfirmasi. Ini akan mempercepat peninjauan berkas oleh admin.
        </p>
      </div>

      <div className="pt-2">
        <Button 
          onClick={onReturnHome}
          className="w-full rounded-2xl py-3.5 text-xs"
        >
          Kembali ke Beranda
        </Button>
      </div>
    </motion.div>
  );
};

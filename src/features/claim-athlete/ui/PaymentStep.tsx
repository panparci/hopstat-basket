import React from 'react';
import { CreditCard, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { motion } from 'motion/react';

interface PaymentStepProps {
  selectedPackage: 'basic' | 'premium' | 'pro';
  setSelectedPackage: (val: 'basic' | 'premium' | 'pro') => void;
  paymentMethod: 'card' | 'transfer' | 'e-wallet';
  setPaymentMethod: (val: 'card' | 'transfer' | 'e-wallet') => void;
  uploadError: string;
  processingPayment: boolean;
  getPackagePrice: (pkg: 'basic' | 'premium' | 'pro') => number;
  handleProcessPayment: () => void;
  onBack: () => void;
}

export const PaymentStep: React.FC<PaymentStepProps> = ({
  selectedPackage,
  setSelectedPackage,
  paymentMethod,
  setPaymentMethod,
  uploadError,
  processingPayment,
  getPackagePrice,
  handleProcessPayment,
  onBack
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Package Selection */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">
          Pilih Paket Statistik Anak
        </span>

        <div className="grid gap-3">
          {(['basic', 'premium', 'pro'] as const).map(pkg => {
            const isSelected = selectedPackage === pkg;
            const price = getPackagePrice(pkg);
            return (
              <button
                key={pkg}
                type="button"
                onClick={() => setSelectedPackage(pkg)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all ${
                  isSelected 
                    ? 'bg-brand-navy dark:bg-brand-orange/10 border-brand-navy dark:border-brand-orange text-brand-navy dark:text-brand-orange' 
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-brand-navy dark:border-brand-orange' : 'border-zinc-300 dark:border-zinc-700'
                  }`}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-brand-navy dark:bg-brand-orange" />}
                  </div>
                  <div>
                    <span className="text-sm font-black uppercase tracking-wide">
                      {pkg === 'basic' && 'Paket Basic'}
                      {pkg === 'premium' && 'Paket Premium / Populer'}
                      {pkg === 'pro' && 'Paket Elite / Pro'}
                    </span>
                    <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal">
                      {pkg === 'basic' && 'Membuka seluruh statistik dasar, tabel, & history.'}
                      {pkg === 'premium' && 'Membuka bagan interaktif, grafik tren, & evaluasi dasar.'}
                      {pkg === 'pro' && 'Akses penuh analisis AI Coach, masukan video, & download PDF.'}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-black font-mono">
                  Rp {price.toLocaleString('id-ID')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4">
        <h3 className="font-display font-black text-sm uppercase tracking-wider text-brand-navy dark:text-brand-orange border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-2">
          <CreditCard size={16} />
          Metode Pembayaran
        </h3>

        <div className="grid grid-cols-3 gap-2">
          {(['transfer', 'card', 'e-wallet'] as const).map(method => (
            <button
              type="button"
              key={method}
              onClick={() => setPaymentMethod(method)}
              className={`py-3.5 rounded-xl text-xs font-bold border capitalize transition-all flex flex-col items-center justify-center gap-1 ${
                paymentMethod === method 
                  ? 'bg-brand-navy dark:bg-brand-orange border-brand-navy dark:border-brand-orange text-white dark:text-brand-navy' 
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <span className="font-semibold text-[10px] tracking-wide">
                {method === 'transfer' && 'Bank Transfer'}
                {method === 'card' && 'Kartu Kredit'}
                {method === 'e-wallet' && 'E-Wallet'}
              </span>
            </button>
          ))}
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-500 leading-relaxed font-semibold">
          Sistem mendeteksi mode prototipe lokal. Pembayaran akan diproses secara instan (mock payment) dan aman demi kelancaran simulasi review.
        </div>

        {uploadError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2 border border-red-200 dark:border-red-900/30">
            <AlertCircle size={14} className="shrink-0" />
            <span className="font-semibold">{uploadError}</span>
          </div>
        )}
      </div>

      {/* Submit & Summary Card */}
      <div className="p-6 bg-zinc-900 dark:bg-zinc-900 rounded-[2rem] text-white space-y-4">
        <div className="flex justify-between items-center text-xs font-bold border-b border-white/10 pb-3">
          <span className="text-zinc-400 uppercase tracking-wider">Total Pembayaran</span>
          <span className="text-lg font-black font-mono text-brand-orange">
            Rp {getPackagePrice(selectedPackage).toLocaleString('id-ID')}
          </span>
        </div>

        <div className="flex gap-4">
          <Button 
            type="button"
            variant="secondary"
            onClick={onBack}
            className="flex-1 rounded-2xl py-3.5 text-xs text-white border-white/10 hover:bg-white/5"
          >
            Kembali
          </Button>
          <Button 
            onClick={handleProcessPayment}
            disabled={processingPayment}
            className="flex-1 rounded-2xl py-3.5 text-xs bg-emerald-500 hover:bg-emerald-600 border-none text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            {processingPayment ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Proses Pembayaran
                <ArrowRight size={14} />
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

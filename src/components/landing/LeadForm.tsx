import React, { useState } from 'react';
import { Input } from '../atoms/Input';
import { Button } from '../atoms/Button';
import { leadService } from '../../services/leadService';
import { Lead } from '../../core/types/crm';
import { CheckCircle2 } from 'lucide-react';

interface LeadFormProps {
  source: Lead['source'];
  defaultInterest?: Lead['interest'];
  onSuccess?: () => void;
}

export const LeadForm: React.FC<LeadFormProps> = ({ 
  source, 
  defaultInterest = 'free',
  onSuccess 
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [childAge, setChildAge] = useState('');
  const [interest, setInterest] = useState<Lead['interest']>(defaultInterest);
  
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validate = () => {
    const newErrors: { name?: string; email?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Nama wajib diisi';
    }
    if (!email.trim()) {
      newErrors.email = 'Email wajib diisi';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Format email tidak valid';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await leadService.createLead({
        name,
        email,
        phone,
        childAge,
        source,
        interest
      });
      setIsSubmitted(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to submit lead', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 border border-emerald-500/20 rounded-3xl shadow-xl text-center space-y-4">
        <div className="bg-emerald-500/10 p-4 rounded-full text-emerald-500">
          <CheckCircle2 size={40} className="stroke-[2.5]" />
        </div>
        <div className="space-y-2">
          <h3 className="font-display font-black uppercase text-xl text-zinc-900 dark:text-white">
            Pendaftaran Berhasil!
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium text-xs sm:text-sm">
            Terima kasih! Tim kami akan menghubungi Anda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8 bg-white dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800 rounded-3xl shadow-lg text-left">
      <h3 className="font-display font-black uppercase text-zinc-900 dark:text-white text-lg tracking-tight mb-2">
        Hubungi Tim Kami
      </h3>
      
      <Input
        label="Nama Lengkap *"
        placeholder="Masukkan nama Anda"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        disabled={isSubmitting}
      />

      <Input
        label="Alamat Email *"
        placeholder="nama@email.com"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        disabled={isSubmitting}
      />

      <Input
        label="No. WhatsApp (Opsional)"
        placeholder="Contoh: 081234567890"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={isSubmitting}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Child Age */}
        <div className="space-y-1">
          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500">
            Kategori Usia Atlet
          </label>
          <select
            value={childAge}
            onChange={(e) => setChildAge(e.target.value)}
            disabled={isSubmitting}
            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange focus:border-transparent transition-all dark:text-white"
          >
            <option value="">Pilih Kategori</option>
            <option value="KU-8">KU-8</option>
            <option value="KU-10">KU-10</option>
            <option value="KU-12">KU-12</option>
            <option value="KU-14">KU-14</option>
            <option value="KU-16">KU-16</option>
            <option value="KU-18">KU-18</option>
          </select>
        </div>

        {/* Plan Interest */}
        <div className="space-y-1">
          <label className="block text-xs font-black uppercase tracking-widest text-zinc-500">
            Paket Yang Diminati
          </label>
          <select
            value={interest}
            onChange={(e) => setInterest(e.target.value as Lead['interest'])}
            disabled={isSubmitting}
            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange focus:border-transparent transition-all dark:text-white"
          >
            <option value="free">Starter (Gratis)</option>
            <option value="pro">Pro (Berbayar)</option>
            <option value="verified">Club Verified</option>
          </select>
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          className="w-full bg-brand-navy hover:opacity-90 dark:bg-brand-orange dark:text-brand-navy"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Mengirim...' : 'Kirim Sekarang'}
        </Button>
      </div>
    </form>
  );
};

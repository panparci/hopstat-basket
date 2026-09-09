import React, { useState } from 'react';
import { Shield, MapPin, Globe, Save } from 'lucide-react';
import { statsService } from '../../core/services/statsService';
import { generateId } from '../../core/utils/idUtils';
import { Club } from '../../core/types/stats';
import { BaseModal } from '../atoms/BaseModal';

interface QuickClubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (club: Club) => void;
}

export const QuickClubModal: React.FC<QuickClubModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [logo, setLogo] = useState('');

  const handleSave = async () => {
    if (!name) return;
    const newClub: Club = {
      id: generateId('club'),
      name,
      city,
      logoUrl: logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00204A&color=fff`,
      establishedYear: new Date().getFullYear()
    };
    await statsService.addClub(newClub);
    onSuccess(newClub);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Master Klub Baru"
      icon={<Shield className="text-brand-navy dark:text-brand-orange" size={20} />}
      maxWidth="max-w-sm"
    >
      <div className="space-y-5">
        <p className="text-zinc-500 text-sm font-medium -mt-2 mb-4">Buat entitas klub utama untuk tim Anda.</p>
        
        <div>
          <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Nama Klub</label>
          <div className="relative">
            <Shield size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="cth: Indonesia Warriors" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-4 pl-12 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Kota</label>
          <div className="relative">
            <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="cth: Jakarta" 
              value={city}
              onChange={e => setCity(e.target.value)}
              className="w-full p-4 pl-12 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Logo URL (Opsional)</label>
          <div className="relative">
            <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="https://..." 
              value={logo}
              onChange={e => setLogo(e.target.value)}
              className="w-full p-4 pl-12 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-10">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl font-black uppercase tracking-wider text-xs transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            Batal
          </button>
          <button 
            onClick={handleSave}
            disabled={!name}
            className="flex-[2] py-4 bg-brand-navy dark:bg-brand-orange disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-500 text-white dark:text-brand-navy rounded-2xl font-black uppercase tracking-wider text-xs transition-all shadow-lg hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
          >
            <Save size={14} /> Simpan Klub
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

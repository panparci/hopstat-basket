import React, { useState, useEffect } from 'react';
import { generateId } from '../../core/utils/idUtils';
import { Player } from '../../core/types/stats';
import { BaseModal } from '../atoms/BaseModal';

interface PlayerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (player: Player) => void;
  initialData?: Player | null;
}

export const PlayerFormModal: React.FC<PlayerFormModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [voiceAliases, setVoiceAliases] = useState('');
  const [jersey, setJersey] = useState('');
  const [position, setPosition] = useState('');
  const [birthDate, setBirthDate] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDisplayName(initialData.displayName || '');
      setVoiceAliases(initialData.voiceAliases?.join(', ') || '');
      setJersey(initialData.jersey);
      setPosition(initialData.position || '');
      setBirthDate(initialData.birthDate || '');
    } else {
      setName('');
      setDisplayName('');
      setVoiceAliases('');
      setJersey('');
      setPosition('');
      setBirthDate('');
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !jersey) return;

    onSave({
      id: initialData?.id || generateId('p'),
      name,
      displayName: displayName || undefined,
      voiceAliases: voiceAliases ? voiceAliases.split(',').map(s => s.trim()).filter(s => s !== '') : undefined,
      jersey,
      position: position || undefined,
      birthDate: birthDate || undefined,
      isActive: initialData?.isActive ?? false,
    });
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'EDIT PEMAIN' : 'TAMBAH PEMAIN BARU'}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">NAMA LENGKAP</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-[#1A1A1A] dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
            placeholder="e.g. Michael Jordan"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">NAMA PUNGGUNG (OPSIONAL)</label>
          <input 
            type="text" 
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-[#1A1A1A] dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
            placeholder="e.g. Jordan"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">VOICE MAPPING (PISAH DENGAN KOMA)</label>
          <input 
            type="text" 
            value={voiceAliases}
            onChange={(e) => setVoiceAliases(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-[#1A1A1A] dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
            placeholder="e.g. Ailin, Alin, Ailen"
          />
          <p className="text-xs text-zinc-400 mt-1 italic">Gunakan ini jika aplikasi salah mengenali suara saat menyebut nama pemain.</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">TANGGAL LAHIR (OPSIONAL)</label>
          <input 
            type="date" 
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-[#1A1A1A] dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">NO. JERSEY</label>
            <input 
              type="text" 
              value={jersey}
              onChange={(e) => setJersey(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-[#1A1A1A] dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
              placeholder="e.g. 23"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">POSISI (OPSIONAL)</label>
            <select 
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-[#1A1A1A] dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
            >
              <option value="">Tidak Ditentukan</option>
              <option value="PG">PG - Point Guard</option>
              <option value="SG">SG - Shooting Guard</option>
              <option value="SF">SF - Small Forward</option>
              <option value="PF">PF - Power Forward</option>
              <option value="C">C - Center</option>
            </select>
          </div>
        </div>

        <button 
          type="submit"
          className="w-full mt-6 py-4 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-2xl font-bold tracking-wide hover:opacity-90 transition-all shadow-sm"
        >
          {initialData ? 'SIMPAN PERUBAHAN' : 'TAMBAH PEMAIN'}
        </button>
      </form>
    </BaseModal>
  );
};

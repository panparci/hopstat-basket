import React, { useState, useEffect } from 'react';
import { Player } from '../../core/types/stats';
import { BaseModal } from '../atoms/BaseModal';

interface PlayerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  onSave: (updatedPlayer: Player) => void;
  sidePanel?: boolean;
}

export const PlayerEditModal: React.FC<PlayerEditModalProps> = ({
  isOpen,
  onClose,
  player,
  onSave,
  sidePanel = false
}) => {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [jersey, setJersey] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    if (player) {
      setName(player.name);
      setDisplayName(player.displayName || '');
      setJersey(player.jersey);
      setBirthDate(player.birthDate || '');
      setIsGuest(player.isGuest || false);
    }
  }, [player]);

  if (!player) return null;

  const handleSave = () => {
    if (!name.trim() || !jersey.trim()) return;
    
    onSave({
      ...player,
      name: name.trim(),
      displayName: displayName.trim() || undefined,
      jersey: jersey.trim(),
      birthDate: birthDate || undefined,
      isGuest: isGuest,
      // Remove placeholder flag if they actually edited it
      isPlaceholder: false 
    });
  };

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={player.isPlaceholder ? 'Edit Placeholder' : 'Edit Player'}
      maxWidth="max-w-sm"
    >
      <div className="space-y-4 -mt-4">
        <div>
          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
            placeholder="Enter full name"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
            Jersey Name (Nama Punggung)
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
            placeholder="Enter jersey name"
          />
        </div>
        
        <div>
          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
            Jersey Number
          </label>
          <input
            type="text"
            value={jersey}
            onChange={(e) => setJersey(e.target.value)}
            className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
            placeholder="Enter number"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
            Tanggal Lahir (Opsional)
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] dark:text-white focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange transition-all"
          />
        </div>

        <div className="flex items-center justify-between p-3.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl">
          <div>
            <label className="block text-xs font-bold text-[#1A1A1A] dark:text-white uppercase tracking-wide">
              Pemain Tamu (Guest)
            </label>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Tandai jika merupakan pemain tamu</span>
          </div>
          <button
            type="button"
            onClick={() => setIsGuest(!isGuest)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isGuest ? 'bg-brand-orange' : 'bg-zinc-200 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isGuest ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
      
      <div className="mt-6 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-xl font-bold text-sm text-zinc-600 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || !jersey.trim()}
          className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-brand-navy dark:bg-brand-orange dark:text-brand-navy hover:bg-brand-navy/90 dark:hover:bg-brand-orange/90 transition-colors disabled:opacity-50"
        >
          Save Changes
        </button>
      </div>
    </BaseModal>
  );
};

import React, { useState, useEffect } from 'react';
import { Users, Shield, Palette, Plus, Save } from 'lucide-react';
import { statsService } from '../../core/services/statsService';
import { generateId } from '../../core/utils/idUtils';
import { Team, Club } from '../../core/types/stats';
import { QuickClubModal } from './QuickClubModal';
import { BaseModal } from '../atoms/BaseModal';

interface QuickTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (team: Team) => void;
}

export const QuickTeamModal: React.FC<QuickTeamModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState('U10');
  const [clubId, setClubId] = useState('');
  const [color, setColor] = useState('var(--color-brand-navy)');
  const [theme, setTheme] = useState<'gelap' | 'terang'>('gelap');
  
  const [clubs, setClubs] = useState<Club[]>([]);
  const [showClubModal, setShowClubModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      statsService.getClubs().then(setClubs);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!name) return;
    const newTeam: Team = {
      id: generateId('team'),
      name,
      ageGroup,
      clubId: clubId || undefined,
      defaultColor: color,
      defaultTheme: theme,
      roster: []
    };
    await statsService.addTeam(newTeam);
    onSuccess(newTeam);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Tambah Tim Baru"
      icon={<Users className="text-brand-navy dark:text-brand-orange" size={20} />}
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        <p className="text-zinc-500 text-sm font-medium -mt-2 mb-4">Daftarkan tim baru untuk pertandingan Anda.</p>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          <div>
            <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Nama Tim</label>
            <input 
              type="text" 
              placeholder="cth: Warriors Elite" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Kelompok Usia</label>
              <input 
                type="text" 
                placeholder="U10" 
                value={ageGroup}
                onChange={e => setAgeGroup(e.target.value)}
                className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Warna Utama</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="color" 
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-12 h-12 rounded-xl border-none p-0 cursor-pointer bg-transparent"
                />
                <div className="flex-1 p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl text-xs font-mono font-bold text-zinc-500">
                  {color.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Klub Master</label>
            <div className="flex gap-2">
              <select 
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                className="flex-1 p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-bold text-[#1A1A1A] dark:text-white transition-all"
              >
                <option value="">-- Tanpa Klub --</option>
                {clubs.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button 
                onClick={() => setShowClubModal(true)}
                className="p-4 bg-zinc-100 dark:bg-zinc-800 text-brand-navy dark:text-brand-orange rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                title="Tambah Klub Baru"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Tema Kostum</label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setTheme('gelap')}
                className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs ${theme === 'gelap' ? 'bg-brand-navy border-brand-navy text-white' : 'bg-white border-zinc-100 text-zinc-400'}`}
              >
                <div className="w-3 h-3 rounded-full bg-brand-navy" /> Gelap
              </button>
              <button 
                onClick={() => setTheme('terang')}
                className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs ${theme === 'terang' ? 'bg-zinc-100 border-brand-navy text-brand-navy' : 'bg-white border-zinc-100 text-zinc-400'}`}
              >
                <div className="w-3 h-3 rounded-full bg-white border border-zinc-200" /> Terang
              </button>
            </div>
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
            <Save size={14} /> Simpan Tim
          </button>
        </div>
      </div>

      <QuickClubModal 
        isOpen={showClubModal}
        onClose={() => setShowClubModal(false)}
        onSuccess={(newClub) => {
          setClubs(prev => [...prev, newClub]);
          setClubId(newClub.id);
        }}
      />
    </BaseModal>
  );
};

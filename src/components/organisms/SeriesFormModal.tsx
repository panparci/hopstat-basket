import React, { useState, useEffect } from 'react';
import { Series, Team } from '../../core/types/stats';
import { statsService } from '../../core/services/statsService';
import { BaseModal } from '../atoms/BaseModal';

interface SeriesFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  series: Series | null;
  teams: Team[];
}

export const SeriesFormModal: React.FC<SeriesFormModalProps> = ({ isOpen, onClose, onSuccess, series, teams }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (isOpen && series) {
      setName(series.name || '');
      setDescription(series.description || '');
      setTeamId(series.teamId || '');
      setLogoUrl(series.logoUrl || '');
    } else {
      setName('');
      setDescription('');
      setTeamId('');
      setLogoUrl('');
    }
  }, [isOpen, series]);

  const handleSave = async () => {
    if (!name || !teamId) return;
    if (series) {
      await statsService.updateSeries({
        ...series,
        name,
        description,
        teamId,
        logoUrl
      });
    } else {
      await statsService.addSeries({
        id: `series_${Date.now()}`,
        name,
        description,
        teamId,
        logoUrl
      });
    }
    onSuccess();
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Series"
      maxWidth="max-w-sm"
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Nama Series</label>
          <input 
            type="text" 
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white transition-all"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Deskripsi</label>
          <textarea 
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white transition-all resize-none h-24"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Tim Utama Series</label>
          <select 
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white transition-all"
          >
            <option value="">-- Pilih Tim Utama --</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 block">Logo URL (Opsional)</label>
          <input 
            type="text" 
            placeholder="https://..."
            value={logoUrl}
            onChange={e => setLogoUrl(e.target.value)}
            className="w-full p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white transition-all"
          />
        </div>
        <button 
          onClick={handleSave}
          disabled={!name || !teamId}
          className="w-full mt-6 py-4 bg-brand-navy dark:bg-brand-orange disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-500 text-white dark:text-brand-navy rounded-2xl font-bold tracking-wide transition-all shadow-sm hover:opacity-90"
        >
          SIMPAN PERUBAHAN
        </button>
      </div>
    </BaseModal>
  );
};

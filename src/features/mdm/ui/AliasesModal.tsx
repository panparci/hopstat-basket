import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, X, Check, Star } from 'lucide-react';
import { BaseModal } from '../../../components/atoms/BaseModal';
import { MasterEntityItem, MasterAlias } from '../model/types';
import { mdmService } from '../model/mdmService';

interface AliasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: MasterEntityItem | null;
  onAliasesUpdated: () => void;
}

export const AliasesModal: React.FC<AliasesModalProps> = ({
  isOpen,
  onClose,
  entity,
  onAliasesUpdated
}) => {
  const [aliases, setAliases] = useState<MasterAlias[]>([]);
  const [newAliasText, setNewAliasText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (isOpen && entity) {
      loadAliases();
    }
  }, [isOpen, entity]);

  const loadAliases = async () => {
    if (!entity) return;
    const list = await mdmService.getAliases(entity.id);
    setAliases(list);
  };

  const handleAddAlias = async () => {
    if (!entity || !newAliasText.trim()) return;
    setIsAdding(true);
    try {
      await mdmService.addAlias(entity.id, entity.entityType, newAliasText.trim());
      setNewAliasText('');
      await loadAliases();
      onAliasesUpdated();
    } catch (err) {
      console.error('Failed to add alias:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteAlias = async (aliasId: string) => {
    try {
      await mdmService.deleteAlias(aliasId);
      await loadAliases();
      onAliasesUpdated();
    } catch (err) {
      console.error('Failed to delete alias:', err);
    }
  };

  if (!entity) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Kelola Alias & Variasi Ejaan Resmi"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 font-sans">
        {/* Canonical Master Banner */}
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            Golden Record Resmi
          </div>
          <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
            {entity.name}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Setiap kali pengguna mengetik salah satu alias di bawah ini, sistem akan otomatis mengenali dan mengarahkannya ke record master ini.
          </p>
        </div>

        {/* Add New Alias Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newAliasText}
            onChange={(e) => setNewAliasText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
            placeholder="Tambah varian nama baru (cth: singkatan, nama lama)..."
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="button"
            disabled={!newAliasText.trim() || isAdding}
            onClick={handleAddAlias}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah</span>
          </button>
        </div>

        {/* Alias List */}
        <div>
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
            Daftar Alias Aktif ({aliases.length})
          </label>

          {aliases.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              Belum ada alias untuk record ini. Tambahkan di atas atau lakukan merge dari data duplikat.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {aliases.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {a.aliasText}
                    </span>
                    <span className="text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                      {a.source}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAlias(a.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                    title="Hapus alias"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

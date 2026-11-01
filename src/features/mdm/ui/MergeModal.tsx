import React, { useState } from 'react';
import { GitMerge, ArrowRight, Star, AlertTriangle, Check } from 'lucide-react';
import { BaseModal } from '../../../components/atoms/BaseModal';
import { DuplicateCandidatePair, MergeActionPayload } from '../model/types';
import { GoldenRecordBadge } from './GoldenRecordBadge';

interface MergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  pair: DuplicateCandidatePair | null;
  onConfirmMerge: (payload: MergeActionPayload) => Promise<void>;
}

export const MergeModal: React.FC<MergeModalProps> = ({
  isOpen,
  onClose,
  pair,
  onConfirmMerge
}) => {
  const [retainAlias, setRetainAlias] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!pair) return null;
  const { sourceItem, canonicalTarget, similarityScore } = pair;

  const handleExecute = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmMerge({
        entityType: pair.entityType,
        sourceId: sourceItem.id,
        canonicalTargetId: canonicalTarget.id,
        retainSourceAsAlias: retainAlias,
        notes: notes.trim() || undefined
      });
      onClose();
    } catch (err) {
      console.error('Error during merge:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Konfirmasi Penggabungan Data (Merge)"
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 font-sans">
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 font-bold mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Tindakan Penggabungan Master Data (Entity Resolution)</span>
          </div>
          Penggabungan ini akan mengalihkan semua histori pertandingan, roster, dan statistik dari data sumber ke Golden Record resmi.
        </div>

        {/* Transition Preview */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-[45%]">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Data Sumber (Akan ditutup)
              </span>
              <strong className="text-sm font-bold text-zinc-900 dark:text-white block mt-0.5">
                {sourceItem.name}
              </strong>
              <span className="text-xs text-zinc-500">ID: {sourceItem.id}</span>
            </div>

            <div className="w-[10%] flex justify-center text-amber-500">
              <ArrowRight className="w-5 h-5" />
            </div>

            <div className="w-[45%]">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                Golden Record Penerima
              </span>
              <strong className="text-sm font-extrabold text-zinc-900 dark:text-white block mt-0.5">
                {canonicalTarget.name}
              </strong>
              <span className="text-xs text-zinc-500">ID: {canonicalTarget.id}</span>
            </div>
          </div>
        </div>

        {/* Option: Retain Source as Alias */}
        <label className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 cursor-pointer">
          <input
            type="checkbox"
            checked={retainAlias}
            onChange={(e) => setRetainAlias(e.target.checked)}
            className="mt-0.5 rounded text-amber-500 focus:ring-amber-500"
          />
          <div className="text-xs">
            <span className="font-bold text-purple-900 dark:text-purple-200 block">
              Simpan nama "{sourceItem.name}" sebagai Alias Resmi
            </span>
            <span className="text-purple-700/80 dark:text-purple-300/80 mt-0.5 block">
              Direkomendasikan. Jika di kemudian hari ada pengguna mengetik nama lama ini, sistem akan otomatis mengenalinya sebagai {canonicalTarget.name}.
            </span>
          </div>
        </label>

        {/* Admin Notes */}
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">
            Catatan Kurasi (Opsional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="cth: Dikonfirmasi nama arena sama di Semarang..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white"
          />
        </div>

        {/* Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleExecute}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <span>Menggabungkan Data...</span>
            ) : (
              <>
                <GitMerge className="w-4 h-4" />
                <span>Eksekusi Merge</span>
              </>
            )}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

import React, { useState } from 'react';
import { ArrowRightLeft, Check, AlertCircle } from 'lucide-react';
import { Player } from '../../core/types/stats';
import { BaseModal } from '../atoms/BaseModal';
import { getContrastTextColor } from '../../core/utils/colorUtils';

interface PlayerCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: Player[];
  onCorrectPlayer: (playerOutId: string, playerInId: string) => Promise<void>;
  teamColor?: string;
  teamTheme?: 'gelap' | 'terang';
  sidePanel?: boolean;
}

export const PlayerCorrectionModal: React.FC<PlayerCorrectionModalProps> = ({
  isOpen,
  onClose,
  roster,
  onCorrectPlayer,
  teamColor,
  teamTheme,
  sidePanel = false,
}) => {
  const [selectedOutId, setSelectedOutId] = useState<string | null>(null);
  const [selectedInId, setSelectedInId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const primaryColor = teamColor || 'var(--color-brand-navy)';
  const contrastTextColor = getContrastTextColor(primaryColor);

  const activePlayers = roster.filter((p) => p.isActive);
  const benchPlayers = roster.filter((p) => !p.isActive);

  const handleClose = () => {
    setSelectedOutId(null);
    setSelectedInId(null);
    setIsSubmitting(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedOutId || !selectedInId) return;
    setIsSubmitting(true);
    try {
      await onCorrectPlayer(selectedOutId, selectedInId);
      handleClose();
    } catch (err) {
      console.error('Failed to apply player correction:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOutPlayer = activePlayers.find((p) => p.id === selectedOutId);
  const selectedInPlayer = benchPlayers.find((p) => p.id === selectedInId);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="KOREKSI / REPLACE PEMAIN"
      icon={<ArrowRightLeft size={20} className="text-brand-navy dark:text-brand-orange" />}
      maxWidth="max-w-md"
      sidePanel={sidePanel}
    >
      <div className="space-y-6">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-1">Koreksi Kesalahan Input (Bukan Substitusi)</p>
            <p>Fitur ini memindahkan seluruh statistik & menit bermain dari pemain salah (di lapangan) ke pemain yang benar (di bench) sejak pergantian/starter terakhir.</p>
          </div>
        </div>

        {/* Step 1: Select Player on Court to Replace */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
            1. Pilih pemain salah di lapangan (untuk di-replace):
          </h3>
          <div className="grid grid-cols-5 gap-1.5">
            {activePlayers.map((player) => {
              const isSelected = selectedOutId === player.id;
              return (
                <button
                  key={player.id}
                  id={`correct-out-${player.id}`}
                  onClick={() => {
                    setSelectedOutId(player.id);
                    // Reset selectedIn if it's no longer compatible or to force clean selection
                    if (selectedInId === player.id) setSelectedInId(null);
                  }}
                  className={`relative p-2 rounded-xl border flex flex-col items-center justify-center transition-all min-h-[64px] ${
                    isSelected
                      ? 'border-brand-navy bg-brand-navy/5 text-brand-navy dark:border-brand-orange dark:bg-brand-orange/10 dark:text-brand-orange font-bold scale-[1.02]'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <span className="text-xs font-black mb-0.5">#{player.jersey}</span>
                  <span className="text-[10px] text-center line-clamp-1 break-all px-0.5 leading-tight">
                    {player.name.split(' ')[0]}{player.isGuest && '*'}
                  </span>
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-full p-0.5">
                      <Check size={8} strokeWidth={4} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Select Replacement Player from Bench */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
            2. Pilih pemain benar di bench (pengganti):
          </h3>
          {benchPlayers.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">Tidak ada pemain di bench.</p>
          ) : (
            <div className="grid grid-cols-5 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
              {benchPlayers.map((player) => {
                const isSelected = selectedInId === player.id;
                return (
                  <button
                    key={player.id}
                    id={`correct-in-${player.id}`}
                    onClick={() => setSelectedInId(player.id)}
                    className={`relative p-2 rounded-xl border flex flex-col items-center justify-center transition-all min-h-[64px] ${
                      isSelected
                        ? 'border-brand-navy bg-brand-navy/5 text-brand-navy dark:border-brand-orange dark:bg-brand-orange/10 dark:text-brand-orange font-bold scale-[1.02]'
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="text-xs font-black mb-0.5">#{player.jersey}</span>
                    <span className="text-[10px] text-center line-clamp-1 break-all px-0.5 leading-tight">
                      {player.name.split(' ')[0]}{player.isGuest && '*'}
                    </span>
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-full p-0.5">
                        <Check size={8} strokeWidth={4} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirmation Summary */}
        {selectedOutPlayer && selectedInPlayer && (
          <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl space-y-2">
            <h4 className="text-xs font-black uppercase text-zinc-500 tracking-wider">Konfirmasi Koreksi</h4>
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex flex-col">
                <span className="text-zinc-500">Pemain Salah:</span>
                <span className="font-bold text-red-500">#{selectedOutPlayer.jersey} {selectedOutPlayer.name}</span>
              </div>
              <ArrowRightLeft size={16} className="text-zinc-400 shrink-0" />
              <div className="flex flex-col text-right">
                <span className="text-zinc-500">Pemain Benar:</span>
                <span className="font-bold text-green-500">#{selectedInPlayer.jersey} {selectedInPlayer.name}</span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-2 leading-normal border-t border-zinc-150 dark:border-zinc-800/60 pt-2">
              Statistik (poin, rebound, asis, dll.) dan menit bermain sejak pergantian/starter terakhir dari #{selectedOutPlayer.jersey} akan dipindahkan ke #{selectedInPlayer.jersey}.
            </p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleConfirm}
          disabled={!selectedOutId || !selectedInId || isSubmitting}
          style={{
            backgroundColor: selectedOutId && selectedInId ? primaryColor : undefined,
            color: selectedOutId && selectedInId ? contrastTextColor : undefined,
          }}
          className={`w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all ${
            selectedOutId && selectedInId
              ? 'hover:opacity-95 active:scale-[0.98]'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? 'Memproses Koreksi...' : 'Terapkan Koreksi'}
        </button>
      </div>
    </BaseModal>
  );
};

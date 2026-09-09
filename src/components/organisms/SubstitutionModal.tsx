import React, { useState, useCallback } from 'react';
import { ArrowRightLeft, UserPlus, Mic, Check } from 'lucide-react';
import { Player } from '../../core/types/stats';
import { useSpeechRecognition } from '../../core/hooks/useSpeechRecognition';
import { BaseModal } from '../atoms/BaseModal';
import { getContrastTextColor } from '../../core/utils/colorUtils';

interface SubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: Player[];
  onSubstitute: (playerOutIds: string[], playerInIds: string[]) => void;
  onQuickAdd?: () => void;
  teamColor?: string;
  teamTheme?: 'gelap' | 'terang';
  sidePanel?: boolean;
}

export const SubstitutionModal: React.FC<SubstitutionModalProps> = ({ 
  isOpen, onClose, roster, onSubstitute, onQuickAdd, teamColor, teamTheme, sidePanel = false 
}) => {
  const [selectedOut, setSelectedOut] = useState<string[]>([]);
  const [selectedIn, setSelectedIn] = useState<string[]>([]);
  const [isListeningSub, setIsListeningSub] = useState(false);

  const primaryColor = teamColor || 'var(--color-brand-navy)';
  const contrastTextColor = getContrastTextColor(primaryColor);

  const activePlayers = roster.filter(p => p.isActive);
  const benchPlayers = roster.filter(p => !p.isActive);

  const handleClose = () => {
    setSelectedOut([]);
    setSelectedIn([]);
    onClose();
  };

  const handleConfirm = () => {
    const resultingOnCourt = activePlayers.length - selectedOut.length + selectedIn.length;
    if (selectedOut.length > 0 && selectedIn.length > 0 && resultingOnCourt === 5) {
      onSubstitute(selectedOut, selectedIn);
      handleClose();
    }
  };

  const toggleOut = (id: string) => {
    setSelectedOut(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleIn = (id: string) => {
    setSelectedIn(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleVoiceResult = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    
    // Simple parsing logic for substitution
    const outPart = lowerText.split(/ganti|diganti|oleh|in|masuk/)[0];
    const inPart = lowerText.split(/ganti|diganti|oleh|in|masuk/).slice(1).join(' ');
    
    const newOut: string[] = [];
    const newIn: string[] = [];
    
    activePlayers.forEach(p => {
      if (outPart.includes(p.name.toLowerCase())) {
        newOut.push(p.id);
      }
    });
    
    benchPlayers.forEach(p => {
      if (inPart.includes(p.name.toLowerCase())) {
        newIn.push(p.id);
      }
    });
    
    if (newOut.length > 0) setSelectedOut(newOut);
    if (newIn.length > 0) setSelectedIn(newIn);
    
    setIsListeningSub(false);
  }, [activePlayers, benchPlayers]);

  const { startListening, stopListening, supported } = useSpeechRecognition(handleVoiceResult);

  const headerActions = (
    <div className="flex items-center gap-3">
      {supported && (
        <button 
          onPointerDown={() => { setIsListeningSub(true); startListening(); }}
          onPointerUp={() => { stopListening(); }}
          className={`p-3 rounded-full transition-all ${isListeningSub ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
        >
          <Mic size={20} />
        </button>
      )}
      <button 
        onClick={handleConfirm}
        disabled={selectedOut.length === 0 || selectedIn.length === 0 || (activePlayers.length - selectedOut.length + selectedIn.length !== 5)}
        className="px-6 py-2.5 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-500 rounded-xl font-bold tracking-wide transition-all shadow-sm hover:opacity-90 flex items-center gap-2"
        style={{ backgroundColor: (selectedOut.length > 0 && selectedIn.length > 0 && (activePlayers.length - selectedOut.length + selectedIn.length === 5)) ? primaryColor : undefined, color: (selectedOut.length > 0 && selectedIn.length > 0 && (activePlayers.length - selectedOut.length + selectedIn.length === 5)) ? contrastTextColor : undefined }}
      >
        <Check size={18} />
        CONFIRM
      </button>
    </div>
  );

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="SUBSTITUTION"
      icon={<ArrowRightLeft style={{ color: primaryColor }} />}
      maxWidth="max-w-md"
      headerActions={headerActions}
      sidePanel={true}
    >
      <div className="flex flex-col border-t border-zinc-100 dark:border-zinc-800 overflow-y-auto max-h-[70vh]">
        {/* Player Out */}
        <div className="flex flex-col border-b border-zinc-100 dark:border-zinc-800">
          <div className="p-3 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
            <h3 className="text-xs text-red-600 dark:text-red-400 font-black uppercase tracking-[0.2em]">KELUAR ({selectedOut.length})</h3>
            <span className="text-xs text-zinc-400 font-bold uppercase">On Court</span>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {activePlayers.map(p => (
              <button 
                key={p.id}
                onClick={() => toggleOut(p.id)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                  selectedOut.includes(p.id) ? 'bg-red-50 dark:bg-red-900/20 border-red-500 shadow-sm' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center font-display font-black italic text-xs ${selectedOut.includes(p.id) ? 'bg-red-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-white'}`}>{p.jersey}</div>
                <span className={`text-xs font-bold truncate uppercase flex-1 text-left ${selectedOut.includes(p.id) ? 'text-red-700 dark:text-red-400' : ''}`}>{p.displayName || p.name}{p.isGuest && ' (Tamu)'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Player In */}
        <div className="flex flex-col">
          <div className="p-3 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
            <h3 className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: primaryColor }}>MASUK ({selectedIn.length})</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-bold uppercase">Bench</span>
              {onQuickAdd && (
                <button 
                  onClick={onQuickAdd}
                  className="text-xs bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                >
                  + QUICK
                </button>
              )}
            </div>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {benchPlayers.length === 0 ? (
              <div className="col-span-2 flex flex-col items-center justify-center text-zinc-400 gap-2 py-8">
                <UserPlus size={24} strokeWidth={1.5} />
                <p className="text-xs italic font-medium">No players on bench</p>
              </div>
            ) : (
              benchPlayers.map(p => (
                <button 
                  key={p.id}
                  onClick={() => toggleIn(p.id)}
                  className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                    selectedIn.includes(p.id) ? 'bg-blue-50 dark:bg-blue-900/20 shadow-sm' : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                  style={{ borderColor: selectedIn.includes(p.id) ? primaryColor : undefined }}
                >
                  <div 
                    className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center font-display font-black italic text-xs ${selectedIn.includes(p.id) ? '' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-white'}`}
                    style={selectedIn.includes(p.id) ? { backgroundColor: primaryColor, color: contrastTextColor } : {}}
                  >
                    {p.jersey}
                  </div>
                  <span className={`text-xs font-bold truncate uppercase flex-1 text-left`} style={selectedIn.includes(p.id) ? { color: primaryColor } : {}}>{p.displayName || p.name}{p.isGuest && ' (Tamu)'}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Footer info */}
      <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center font-medium italic">
          Tip: Tahan tombol mic dan katakan "Keluar [Nama], Masuk [Nama]" untuk otomatisasi.
        </p>
      </div>
    </BaseModal>
  );
};

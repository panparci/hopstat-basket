import React, { useState, useEffect } from 'react';
import { Users, Mic, MicOff, UserPlus, Settings } from 'lucide-react';
import { Player } from '../../core/types/stats';
import { useSpeechRecognition } from '../../core/hooks/useSpeechRecognition';
import { BaseModal } from '../atoms/BaseModal';
import { getContrastTextColor } from '../../core/utils/colorUtils';

interface StarterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: Player[];
  onConfirm: (starters: string[]) => void;
  maxStarters?: number;
  onQuickAdd?: () => void;
  onEditTeam?: () => void;
  teamColor?: string;
  teamTheme?: 'gelap' | 'terang';
  teamName?: string;
  sidePanel?: boolean;
}

export const StarterSelectionModal: React.FC<StarterSelectionModalProps> = ({ 
  isOpen, 
  onClose, 
  roster, 
  onConfirm, 
  maxStarters = 5,
  onQuickAdd,
  onEditTeam,
  teamColor,
  teamTheme,
  teamName,
  sidePanel = false
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [voiceFeedback, setVoiceFeedback] = useState('');

  const primaryColor = teamColor || 'var(--color-brand-navy)';
  const contrastTextColor = getContrastTextColor(primaryColor);
  const storageKey = `starter_selection_${teamName || 'team'}_${maxStarters}`;

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as string[];
          setSelectedIds(parsed);
          return;
        } catch (e) {
          console.error(e);
        }
      }
      setSelectedIds(roster.filter(p => p.isActive).map(p => p.id));
    }
  }, [isOpen]);

  const handleVoiceResult = (text: string) => {
    const lowerText = text.toLowerCase();
    const stopWords = ['dan', 'masukkan', 'tolong', 'nomor', 'no', 'punggung', 'pemain', 'yang', 'sama', 'juga', 'aku', 'mau', 'pilih'];
    const words = lowerText.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
    
    const matchedIds = new Set<string>();

    roster.forEach(p => {
      // check jersey
      if (p.jersey) {
        const regex = new RegExp(`\\b(?:nomor|no|punggung)?\\s*0*${p.jersey}\\b`, 'i');
        if (regex.test(lowerText)) {
          matchedIds.add(p.id);
        }
      }
      
      // check name
      const nameParts = p.name.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (nameParts.some(part => part === word || (part.length > 3 && part.startsWith(word)) || (word.length > 3 && part.includes(word)))) {
          matchedIds.add(p.id);
        }
      });
    });

    if (matchedIds.size > 0) {
      setSelectedIds(prev => {
        const current = new Set(prev);
        matchedIds.forEach(id => current.add(id));
        const newSelected = Array.from(current);
        
        if (newSelected.length > maxStarters) {
          setVoiceFeedback(`⚠️ Terdeteksi ${newSelected.length} pemain. Silakan hapus ${newSelected.length - maxStarters} pemain.`);
        } else {
          const matchedNames = roster.filter(p => matchedIds.has(p.id)).map(p => p.name).join(', ');
          setVoiceFeedback(`✅ Menambahkan: ${matchedNames}`);
        }
        localStorage.setItem(storageKey, JSON.stringify(newSelected));
        return newSelected;
      });
    } else {
      setVoiceFeedback(`❌ Tidak mengenali pemain dari: "${text}"`);
    }
    setTimeout(() => setVoiceFeedback(''), 6000);
  };

  const { isListening, startListening, stopListening, supported } = useSpeechRecognition(handleVoiceResult);

  const togglePlayer = (id: string) => {
    setSelectedIds(prev => {
      let newSelected;
      if (prev.includes(id)) {
        newSelected = prev.filter(pId => pId !== id);
      } else {
        if (prev.length < maxStarters) {
          newSelected = [...prev, id];
        } else {
          newSelected = prev;
        }
      }
      localStorage.setItem(storageKey, JSON.stringify(newSelected));
      return newSelected;
    });
  };

  const handleConfirm = () => {
    localStorage.removeItem(storageKey);
    onConfirm(selectedIds);
  };

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`STARTING ${maxStarters} ${teamName ? `- ${teamName}` : ''}`}
      icon={<Users style={{ color: primaryColor }} />}
      maxWidth="max-w-md"
      sidePanel={true}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 mt-6 md:mt-4 border-b border-zinc-100 dark:border-zinc-800/50 pb-3 pt-2">
        <p className={`text-xs font-black uppercase tracking-wider m-0 ${selectedIds.length > maxStarters ? 'text-red-500 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
          PILIH {maxStarters} PEMAIN ({selectedIds.length}/{maxStarters})
        </p>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {onQuickAdd && (
            <button 
              onClick={onQuickAdd}
              className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-full font-black hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1 uppercase"
            >
              <UserPlus size={11} />
              QUICK ADD
            </button>
          )}
          {onEditTeam && (
            <button 
              onClick={onEditTeam}
              className="text-[11px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full font-black flex items-center gap-1 border border-amber-500/20 transition-all uppercase"
            >
              <Settings size={11} />
              EDIT TIM
            </button>
          )}
          {supported && (
            <button
              onClick={isListening ? stopListening : startListening}
              className={`p-1 px-2.5 rounded-full flex items-center gap-1 text-[11px] font-black uppercase transition-all ${
                isListening 
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse' 
                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {isListening ? <MicOff size={11} /> : <Mic size={11} />}
              {isListening ? 'Mendengarkan...' : 'Voice'}
            </button>
          )}
        </div>
      </div>

      {voiceFeedback && (
        <div className={`p-3 rounded-xl mb-4 text-xs font-bold ${
          voiceFeedback.startsWith('✅') ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 
          voiceFeedback.startsWith('⚠️') ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
          'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
        }`}>
          {voiceFeedback}
        </div>
      )}

      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
        {roster.map(p => {
          const isSelected = selectedIds.includes(p.id);
          const isDisabled = !isSelected && selectedIds.length >= maxStarters;
          return (
            <button 
              key={p.id}
              onClick={() => togglePlayer(p.id)}
              disabled={isDisabled}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                isSelected 
                  ? 'bg-blue-50 dark:bg-blue-900/20 shadow-sm shadow-blue-500/10' 
                  : isDisabled
                    ? 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 opacity-50 cursor-not-allowed'
                    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
              style={{ borderColor: isSelected ? primaryColor : undefined }}
            >
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-black italic text-sm ${isSelected ? '' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-white'}`}
                style={isSelected ? { backgroundColor: primaryColor, color: contrastTextColor } : {}}
              >
                {p.jersey}
              </div>
              <span className={`text-sm font-bold truncate uppercase flex-1 text-left ${isSelected ? '' : ''}`} style={isSelected ? { color: primaryColor } : {}}>{p.name}{p.isGuest && ' (Tamu)'}</span>
              {isSelected && (
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>Starter</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button 
          onClick={onClose}
          className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold tracking-wide transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700"
        >
          CANCEL
        </button>
        <button 
          onClick={handleConfirm}
          disabled={selectedIds.length !== maxStarters}
          className="flex-[2] py-4 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-500 rounded-xl font-bold tracking-wide transition-all shadow-sm hover:opacity-90"
          style={{ backgroundColor: selectedIds.length === maxStarters ? primaryColor : undefined, color: selectedIds.length === maxStarters ? contrastTextColor : undefined }}
        >
          CONFIRM
        </button>
      </div>
    </BaseModal>
  );
};

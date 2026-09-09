import React, { useState } from 'react';
import { DraftEvent } from '../../core/types/commentary';
import { GameEvent } from '../../core/types/stats';
import { useCommentarySpeech } from '../../core/hooks/useCommentarySpeech';
import { useCommentaryProcessor } from '../../core/hooks/useCommentaryProcessor';
import { CommentaryScanner } from '../tracking/commentary/CommentaryScanner';
import { CommentaryValidator } from '../tracking/commentary/CommentaryValidator';
import { RotateCcw } from 'lucide-react';

interface CommentaryPanelProps {
  matchId: string;
  currentYoutubeTime: number;
  lastEvent?: GameEvent;
  onJumpToTime: (time: number) => void;
  onConfirmEvent: (event: DraftEvent) => void;
}

export const CommentaryPanel: React.FC<CommentaryPanelProps> = ({
  matchId,
  currentYoutubeTime,
  lastEvent,
  onJumpToTime,
  onConfirmEvent
}) => {
  const [mode, setMode] = useState<'scan' | 'validate'>('scan');
  const [activeValidationId, setActiveValidationId] = useState<string | null>(null);

  const handleAutoAccept = (draft: DraftEvent) => {
    // Treat as confirmed directly
    onConfirmEvent(draft);
  };

  const {
    drafts,
    interimText,
    handleFinalText,
    handleInterimText,
    rejectDraft,
    acceptDraft
  } = useCommentaryProcessor(matchId, currentYoutubeTime, lastEvent, handleAutoAccept);

  const { 
    isListening, 
    startListening, 
    stopListening, 
    supported,
    error 
  } = useCommentarySpeech((text, isFinal) => {
    if (isFinal) {
      handleFinalText(text);
    } else {
      handleInterimText(text);
    }
  });

  const handleConfirm = (draft: DraftEvent) => {
    onConfirmEvent(draft);
    acceptDraft(draft.id);
    if (activeValidationId === draft.id) {
      setActiveValidationId(null);
    }
  };

  const startValidation = (draft: DraftEvent) => {
    setActiveValidationId(draft.id);
    onJumpToTime(draft.timestamp - 2); // Jump to 2 seconds before
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden relative">
      {/* Settings / Mode Switcher */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col gap-3 bg-zinc-50/50 dark:bg-zinc-900/50 z-10 shrink-0">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-brand-navy dark:text-brand-orange">Commentary System</h3>
          <p className="text-xs text-zinc-500 font-bold uppercase">AI Labeling Engine</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setMode('scan');
              setActiveValidationId(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${mode === 'scan' ? 'bg-brand-navy text-white shadow-lg' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
          >
            Scan Mode
          </button>
          <button
            onClick={() => setMode('validate')}
            className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${mode === 'validate' ? 'bg-brand-navy text-white shadow-lg' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
          >
            Validate
            {drafts.length > 0 && (
              <span className="bg-red-500 text-white rounded-full px-1.5 py-0.5 text-xs ml-1">
                {drafts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {mode === 'scan' ? (
          <CommentaryScanner 
            isListening={isListening}
            startListening={startListening}
            stopListening={stopListening}
            supported={supported}
            interimText={interimText}
            error={error}
          />
        ) : (
          <CommentaryValidator 
            drafts={drafts}
            activeValidationId={activeValidationId}
            startValidation={startValidation}
            handleConfirm={handleConfirm}
            handleReject={rejectDraft}
          />
        )}
      </div>

      {/* Footer Details */}
      {mode === 'scan' && drafts.length > 0 && (
        <div 
          onClick={() => setMode('validate')}
          className="absolute bottom-4 left-4 right-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl p-3 flex items-center justify-between shadow-2xl cursor-pointer hover:scale-[1.02] transition-transform"
        >
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-wider">Queue Action Required</span>
            <span className="text-xs font-medium">{drafts.length} events waiting</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-black">
            {drafts.length}
          </div>
        </div>
      )}
    </div>
  );
};

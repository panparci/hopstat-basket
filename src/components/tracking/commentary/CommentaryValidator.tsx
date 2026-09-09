import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DraftEvent } from '../../../core/types/commentary';
import { CheckCircle2, Play, Trash2, AlertCircle, Zap, FastForward } from 'lucide-react';

interface CommentaryValidatorProps {
  drafts: DraftEvent[];
  activeValidationId: string | null;
  startValidation: (draft: DraftEvent) => void;
  handleConfirm: (draft: DraftEvent) => void;
  handleReject: (id: string) => void;
}

export const CommentaryValidator: React.FC<CommentaryValidatorProps> = ({
  drafts, activeValidationId, startValidation, handleConfirm, handleReject
}) => {
  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50 bg-zinc-50 dark:bg-zinc-950">
        <CheckCircle2 size={48} className="text-zinc-400" />
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-zinc-400">Queue Clear</p>
          <p className="text-xs font-bold text-zinc-500 uppercase mt-1">All events validated</p>
        </div>
      </div>
    );
  }

  // Sort: High impact or sequence errors could go first, but for now we sort by confidence (lowest first) to force review
  const sortedDrafts = [...drafts].sort((a, b) => a.confidence - b.confidence);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-zinc-50/50 dark:bg-zinc-950/50">
      <AnimatePresence initial={false}>
        {sortedDrafts.map((draft) => {
          const isHighConfidence = draft.confidence >= 0.7;
          const isLowConfidence = draft.confidence < 0.4;

          return (
            <motion.div
              key={draft.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20 }}
              className={`p-4 rounded-2xl border transition-all ${
                activeValidationId === draft.id 
                  ? 'border-brand-navy dark:border-brand-orange ring-2 ring-brand-navy/10 dark:ring-brand-orange/10 bg-white dark:bg-zinc-900 shadow-xl' 
                  : 'border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-200 dark:hover:border-zinc-700 shadow-sm'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-md text-xs font-black text-zinc-500 font-mono">
                      {Math.floor(draft.timestamp / 60)}:{(draft.timestamp % 60).toString().padStart(2, '0')}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${isHighConfidence ? 'bg-green-500' : isLowConfidence ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      <span className={`text-xs font-bold ${isHighConfidence ? 'text-green-600 dark:text-green-400' : isLowConfidence ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                        {(draft.confidence * 100).toFixed(0)}% Confidence
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleReject(draft.id)}
                  className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl mb-3 border border-zinc-100 dark:border-zinc-800">
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 italic">"{draft.rawText}"</p>
              </div>

              {draft.parsedData?.type ? (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="px-2 py-1 bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy rounded-md text-xs font-black uppercase tracking-wider">
                    {draft.parsedData.type.replace('_', ' ')}
                  </span>
                  {draft.parsedData.playerId ? (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md text-xs font-black uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 size={10} /> Player Linked
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-xs font-black uppercase tracking-wider flex items-center gap-1">
                      <AlertCircle size={10} /> No Player
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-4 text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                  <AlertCircle size={14} />
                  <span className="text-xs font-black uppercase tracking-wider">Unrecognized Action</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => startValidation(draft)}
                  className="flex-[1] py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                >
                  <Play size={14} className={activeValidationId === draft.id ? "text-blue-500 animate-pulse" : ""} /> 
                  Watch Loop
                </button>
                <button
                  onClick={() => handleConfirm(draft)}
                  className={`flex-[2] py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg ${
                    isHighConfidence 
                      ? 'bg-green-500 text-white hover:bg-green-600 shadow-green-500/20' 
                      : 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy hover:opacity-90 shadow-brand-navy/20 dark:shadow-brand-orange/20'
                  }`}
                >
                  {isHighConfidence ? <Zap size={14} /> : <CheckCircle2 size={14} />} 
                  {isHighConfidence ? 'Fast Accept' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

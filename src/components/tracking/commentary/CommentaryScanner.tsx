import React from 'react';
import { Mic, MicOff, AlertTriangle, Sparkles } from 'lucide-react';

interface CommentaryScannerProps {
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  supported: boolean;
  interimText: string;
  error?: string | null;
}

export const CommentaryScanner: React.FC<CommentaryScannerProps> = ({
  isListening, startListening, stopListening, supported, interimText, error
}) => {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 p-6 items-center justify-center relative">
      {!supported && (
        <div className="absolute top-4 left-4 right-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 text-center rounded-xl text-xs font-bold flex items-center justify-center gap-2">
          <AlertTriangle size={14} /> Speech Recognition not supported in this browser.
        </div>
      )}

      {error === 'not-allowed' && (
        <div className="absolute top-4 left-4 right-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 text-center rounded-xl text-xs font-bold leading-relaxed border border-red-200 dark:border-red-800 shadow-sm z-10">
          <div className="flex items-center justify-center gap-2 mb-1">
             <AlertTriangle size={16} /> <span className="uppercase tracking-widest font-black">Microphone Blocked</span>
          </div>
          Please click the microphone icon in your browser's address bar to allow access, or <strong>open this preview in a new tab</strong>.
        </div>
      )}

      <div className="mb-12 text-center">
        <h2 className="text-2xl font-black italic tracking-widest uppercase text-zinc-300 dark:text-zinc-700 mb-2">
          Scan Mode
        </h2>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Play video at 1.5x - Speak freely
        </p>
      </div>

      <button
        onClick={isListening ? stopListening : startListening}
        disabled={error === 'not-allowed' || !supported}
        className={`w-40 h-40 rounded-full flex flex-col items-center justify-center gap-4 transition-all duration-500 shadow-2xl relative ${
          error === 'not-allowed' || !supported
            ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
            : isListening 
              ? 'bg-red-500 text-white animate-pulse shadow-red-500/50 scale-105' 
              : 'bg-brand-navy dark:bg-brand-orange text-white dark:text-brand-navy shadow-brand-navy/30 dark:shadow-brand-orange/20 hover:scale-105 cursor-pointer'
        }`}
      >
        {isListening && (
          <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-20" />
        )}
        {isListening ? <MicOff size={48} /> : <Mic size={48} />}
        <span className="font-black italic uppercase tracking-widest text-xs">
          {error === 'not-allowed' ? 'BLOCKED' : isListening ? 'Stop' : 'Start'}
        </span>
      </button>

      <div className="mt-16 h-24 w-full max-w-sm px-6 flex items-center justify-center relative">
        {interimText ? (
          <div className="w-full text-center animate-in slide-in-from-bottom-2 fade-in duration-300">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
              <span className="text-xs font-black text-blue-500 uppercase tracking-widest">Listening</span>
            </div>
            <p className="text-lg font-bold italic text-zinc-700 dark:text-zinc-300 line-clamp-2">
              "{interimText}"
            </p>
          </div>
        ) : (
          <div className="w-full text-center opacity-30 flex flex-col items-center justify-center">
             <Sparkles size={20} className="mb-2 text-zinc-400" />
             <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">AI is ready to parse</p>
          </div>
        )}
      </div>
    </div>
  );
};

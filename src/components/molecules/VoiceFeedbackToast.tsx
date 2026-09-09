import React, { useEffect, useRef } from 'react';

export type VoiceFeedbackState = {
  text: string;
  status: 'success' | 'ambiguous' | 'error';
  parsed?: string;
  reason?: string;
} | null;

interface VoiceFeedbackToastProps {
  feedback: VoiceFeedbackState;
  onClose: () => void;
}

export const VoiceFeedbackToast: React.FC<VoiceFeedbackToastProps> = ({ feedback, onClose }) => {
  const lastPlayedRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (feedback) {
      const feedbackId = `${feedback.status}-${feedback.text}-${Date.now()}`;
      
      // Only play sound if it's a new feedback event
      if (lastPlayedRef.current !== feedback.text) {
        lastPlayedRef.current = feedback.text;
        
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          if (feedback.status === 'success') {
            // Success sound (High pitch, very short)
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.05);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
          } else if (feedback.status === 'ambiguous') {
            // Ambiguous sound (Two fast medium pitches)
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
            oscillator.frequency.setValueAtTime(554.37, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.2);
          } else if (feedback.status === 'error') {
            // Error sound (Low pitch, very short)
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.15);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.15);
          }
        } catch (e) {
          console.error('Audio playback failed', e);
        }
      }

      const timer = setTimeout(() => {
        onCloseRef.current();
        lastPlayedRef.current = null;
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  if (!feedback) return null;

  const bgColors = {
    success: 'bg-green-500 dark:bg-green-600',
    ambiguous: 'bg-yellow-500 dark:bg-yellow-600',
    error: 'bg-red-500 dark:bg-red-600'
  };

  const textColors = {
    success: 'text-white',
    ambiguous: 'text-yellow-950 dark:text-yellow-50',
    error: 'text-white'
  };

  return (
    <div className={`absolute bottom-full left-2 right-2 mb-2 ${bgColors[feedback.status]} ${textColors[feedback.status]} p-3 rounded-2xl shadow-xl border border-black/10 dark:border-white/10 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200`}>
      <div className="flex flex-col gap-1">
        <span className="text-xs opacity-70 uppercase tracking-wider font-bold">Heard:</span>
        <span className="text-sm italic font-medium">"{feedback.text}"</span>
        <div className="h-px bg-black/10 dark:bg-white/10 my-1"></div>
        <span className="text-xs opacity-70 uppercase tracking-wider font-bold">
          {feedback.status === 'success' ? 'Action:' : feedback.status === 'ambiguous' ? 'Clarification Needed:' : 'Error:'}
        </span>
        <span className="text-sm font-bold">
          {feedback.status === 'success' ? feedback.parsed : feedback.reason}
        </span>
      </div>
    </div>
  );
};

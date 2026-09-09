import { useEffect } from 'react';
import { KEYBOARD_SHORTCUTS } from '../core/constants/shortcuts';

interface KeyboardShortcutsProps {
  onHoldToSpeakStart: () => void;
  onHoldToSpeakEnd: () => void;
  onSeekYoutube: (delta: number) => void;
  onPlayYoutube: () => void;
  onStopYoutube: () => void;
  onPlayTimer: () => void;
  onStopTimer: () => void;
  onPlayBoth: () => void;
  onStopBoth: () => void;
  onToggleBoth: () => void;
  onAdjustTimer: (delta: number) => void;
  onTimeRevisionStart: () => void;
  onTimeRevisionDigit: (digit: string) => void;
  onTimeRevisionBackspace: () => void;
  isRevisingTime: boolean;
}

export const useKeyboardShortcuts = ({
  onHoldToSpeakStart,
  onHoldToSpeakEnd,
  onSeekYoutube,
  onPlayYoutube,
  onStopYoutube,
  onPlayTimer,
  onStopTimer,
  onPlayBoth,
  onStopBoth,
  onToggleBoth,
  onAdjustTimer,
  onTimeRevisionStart,
  onTimeRevisionDigit,
  onTimeRevisionBackspace,
  isRevisingTime,
}: KeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.repeat) return;

      const key = e.key.toLowerCase();

      // Time Revision Mode
      if (isRevisingTime) {
        if (/^[0-9]$/.test(key)) {
          e.preventDefault();
          onTimeRevisionDigit(key);
          return;
        }
        if (key === 'backspace') {
          e.preventDefault();
          onTimeRevisionBackspace();
          return;
        }
        if (key === '*') {
          e.preventDefault();
          onTimeRevisionStart(); // This will toggle/confirm in TrackingPage
          return;
        }
      }

      const shortcut = KEYBOARD_SHORTCUTS.find(s => s.key === key);
      if (shortcut) {
        e.preventDefault();
        
        switch (shortcut.action) {
          case 'toggle_both':
            onToggleBoth();
            break;
          case 'play_both':
            onPlayBoth();
            break;
          case 'stop_both':
            onStopBoth();
            break;
          case 'play_youtube':
            onPlayYoutube();
            break;
          case 'stop_youtube':
            onStopYoutube();
            break;
          case 'play_timer':
            onPlayTimer();
            break;
          case 'stop_timer':
            onStopTimer();
            break;
          case 'seek_both_backward_5':
            onSeekYoutube(-5);
            onAdjustTimer(5);
            break;
          case 'seek_both_backward_1':
            onSeekYoutube(-1);
            onAdjustTimer(1);
            break;
          case 'seek_both_forward_1':
            onSeekYoutube(1);
            onAdjustTimer(-1);
            break;
          case 'seek_both_forward_5':
            onSeekYoutube(5);
            onAdjustTimer(-5);
            break;
          case 'seek_youtube_backward_3':
            onSeekYoutube(-3);
            break;
          case 'seek_youtube_backward_1':
            onSeekYoutube(-1);
            break;
          case 'seek_youtube_forward_1':
            onSeekYoutube(1);
            break;
          case 'seek_youtube_forward_3':
            onSeekYoutube(3);
            break;
          case 'adjust_timer_backward_3':
            onAdjustTimer(-3);
            break;
          case 'adjust_timer_backward_1':
            onAdjustTimer(-1);
            break;
          case 'adjust_timer_forward_1':
            onAdjustTimer(1);
            break;
          case 'adjust_timer_forward_3':
            onAdjustTimer(3);
            break;
          case 'voice_command':
            if (!e.repeat) onHoldToSpeakStart();
            break;
          case 'time_revision':
            onTimeRevisionStart();
            break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const key = e.key.toLowerCase();
      const shortcut = KEYBOARD_SHORTCUTS.find(s => s.key === key);
      
      if (shortcut && shortcut.action === 'voice_command') {
        e.preventDefault();
        onHoldToSpeakEnd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    onHoldToSpeakStart,
    onHoldToSpeakEnd,
    onSeekYoutube,
    onPlayYoutube,
    onStopYoutube,
    onPlayTimer,
    onStopTimer,
    onPlayBoth,
    onStopBoth,
    onToggleBoth,
    onAdjustTimer,
    onTimeRevisionStart,
    onTimeRevisionDigit,
    isRevisingTime,
  ]);
};

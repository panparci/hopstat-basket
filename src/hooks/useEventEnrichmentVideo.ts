import { useEffect } from 'react';

interface UseEventEnrichmentVideoProps {
  isOpen: boolean;
  youtubeTimestamp?: number;
  onStopTimer?: () => void;
  onStartTimer?: () => void;
  expandVideo?: boolean;
  extraTime?: number;
}

export const useEventEnrichmentVideo = ({
  isOpen,
  youtubeTimestamp,
  onStopTimer,
  onStartTimer,
  expandVideo = false,
  extraTime = 0,
  peekOffset = 0,
  returnToOriginalTime = false
}: UseEventEnrichmentVideoProps & { peekOffset?: number; returnToOriginalTime?: boolean }) => {
  useEffect(() => {
    if (isOpen && youtubeTimestamp !== undefined) {
      // 1. Mute video
      window.dispatchEvent(new CustomEvent('mute-youtube'));
      
      // 2. Start loop 
      // Default: +/- 2 seconds (4s loop)
      // Expanded: +/- 5 seconds (10s loop)
      const buffer = expandVideo ? 5 : 2;
      const shift = Math.floor(extraTime / 2);
      
      const effectiveTime = youtubeTimestamp + peekOffset;
      const start = Math.max(0, effectiveTime - buffer - shift);
      const end = effectiveTime + buffer + (extraTime - shift);

      window.dispatchEvent(new CustomEvent('start-loop-youtube', {
        detail: { start, end }
      }));

      // 3. Stop timer
      if (onStopTimer) {
        onStopTimer();
      }
    }

    return () => {
      if (isOpen && youtubeTimestamp !== undefined) {
        // Cleanup when modal closes or component unmounts
        window.dispatchEvent(new CustomEvent('stop-loop-youtube'));
        window.dispatchEvent(new CustomEvent('unmute-youtube'));
        
        if (returnToOriginalTime) {
          window.dispatchEvent(new CustomEvent('seek-youtube', { detail: { time: youtubeTimestamp } }));
        }
        
        window.dispatchEvent(new CustomEvent('play-youtube'));
      }
    };
  }, [isOpen, youtubeTimestamp, expandVideo, extraTime, peekOffset, returnToOriginalTime]);
};

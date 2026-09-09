import { useState, useEffect, useCallback } from "react";
import { GameEvent, GameState } from "../../../core/types/stats";
import { statsService } from "../../../core/services/statsService";
import { TimelineStorageService } from "../../automatic-clock-mapping/services/timelineStorageService";
import { NormalizedClockRegion, QuarterMarker } from "../../automatic-clock-mapping/types";
import { executeOnTheFlyClockSync } from "../services/onTheFlyClockSyncService";
import { OnTheFlySyncResult } from "../types";
import { formatSecondsToMMSS } from "../../automatic-clock-mapping/utils/clockParser";

const LOCAL_STORAGE_KEY = "onthefly_clock_sync_enabled";

interface UseOnTheFlyClockSyncProps {
  matchId?: string;
  gameState?: GameState | null;
  setGameState?: React.Dispatch<React.SetStateAction<GameState | null>>;
  setEvents?: React.Dispatch<React.SetStateAction<GameEvent[]>>;
  showToast?: (message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export function useOnTheFlyClockSync({
  matchId,
  gameState,
  setGameState,
  setEvents,
  showToast,
}: UseOnTheFlyClockSyncProps = {}) {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved === "true";
    } catch (e) {
      return false;
    }
  });

  const [clockRegion, setClockRegion] = useState<NormalizedClockRegion | null>(null);
  const [altClockRegion, setAltClockRegion] = useState<NormalizedClockRegion | null>(null);

  // Load clock calibration region from published timeline draft
  useEffect(() => {
    if (!matchId) return;

    const loadRegions = async () => {
      try {
        const timeline = await TimelineStorageService.loadTimeline(matchId);
        if (timeline?.clockRegion) {
          setClockRegion(timeline.clockRegion);
        }
        if (timeline?.altClockRegion) {
          setAltClockRegion(timeline.altClockRegion);
        }
      } catch (e) {
        console.warn("[useOnTheFlyClockSync] Failed to load clock regions:", e);
      }
    };

    loadRegions();

    const handleUpdate = () => loadRegions();
    window.addEventListener("timeline-published", handleUpdate);
    window.addEventListener("timeline-updated", handleUpdate);

    return () => {
      window.removeEventListener("timeline-published", handleUpdate);
      window.removeEventListener("timeline-updated", handleUpdate);
    };
  }, [matchId]);

  // Handle Toggle Enable/Disable
  const toggleEnabled = useCallback((value?: boolean) => {
    setIsEnabled((prev) => {
      const next = value !== undefined ? value : !prev;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, String(next));
      } catch (e) {
        console.error("Failed to save on-the-fly toggle:", e);
      }
      return next;
    });
  }, []);

  // Main Background Execution Trigger
  const triggerOnTheFlySync = useCallback(
    (
      event: GameEvent,
      videoTimeSeconds: number,
      customVideoEl?: HTMLVideoElement | null,
      quarterMarker?: QuarterMarker | null
    ) => {
      if (!isEnabled) return;

      const recordedAtMs = Date.now();

      // Fire completely asynchronously without awaiting in caller's UI thread
      setTimeout(async () => {
        try {
          const result: OnTheFlySyncResult = await executeOnTheFlyClockSync({
            event,
            videoTimeSeconds,
            recordedAtMs,
            videoEl: customVideoEl || null,
            quarterMarker,
            currentGameState: gameState,
            clockRegion,
            altClockRegion,
            minConfidence: 70,
          });

          if (result.status === "SUCCESS") {
            const adjustedSeconds = Math.round(result.detectedGameClockMs / 1000);
            const currentClockStr = event.gameClock || formatSecondsToMMSS(event.timestamp || 0);

            // 1. Update event in DB & UI
            if (result.adjustedTimestamp !== currentClockStr) {
              const updatedEvent: GameEvent = {
                ...event,
                timestamp: adjustedSeconds,
                gameClock: result.adjustedTimestamp,
                youtubeTimestamp: videoTimeSeconds,
              };

              await statsService.updateEvent(updatedEvent);

              if (setEvents) {
                setEvents((prev) =>
                  prev.map((e) => (e.id === event.id ? updatedEvent : e))
                );
              }
            }

            // 2. Adjust Live Game Clock if required & applicable
            if (
              result.adjustedLiveTimerSeconds !== undefined &&
              setGameState &&
              gameState?.isRunning
            ) {
              setGameState((prev) => {
                if (!prev) return prev;
                const newGameState: GameState = {
                  ...prev,
                  timeRemaining: result.adjustedLiveTimerSeconds!,
                };
                statsService.saveGameState(newGameState).catch((err) =>
                  console.error("Failed to save adjusted game state:", err)
                );
                return newGameState;
              });
            }

            // 3. Notify user via subtle toast / custom event
            window.dispatchEvent(
              new CustomEvent("onthefly-clock-sync-completed", { detail: result })
            );

            if (showToast && result.adjustedTimestamp !== currentClockStr) {
              showToast(
                `⚡ OCR Sync: Event ${event.type.toUpperCase()} disesuaikan ke ${result.adjustedTimestamp} (${result.confidence}%)`,
                "success"
              );
            }
          } else if (result.status === "FAILED") {
            console.warn("[OnTheFlyClockSync] Background OCR skipped/failed:", result.message);
          }
        } catch (e) {
          console.error("[OnTheFlyClockSync] Background process error:", e);
        }
      }, 50);
    },
    [isEnabled, clockRegion, altClockRegion, gameState, setGameState, setEvents, showToast]
  );

  return {
    isEnabled,
    toggleEnabled,
    clockRegion,
    altClockRegion,
    triggerOnTheFlySync,
  };
}

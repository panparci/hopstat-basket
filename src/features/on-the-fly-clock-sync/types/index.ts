import { GameEvent, GameState } from "../../../core/types/stats";
import { NormalizedClockRegion, QuarterMarker } from "../../automatic-clock-mapping/types";

export interface OnTheFlyConfig {
  enabled: boolean;
  minConfidence: number; // default 75
  screenShareActive: boolean;
  clockRegion?: NormalizedClockRegion | null;
  altClockRegion?: NormalizedClockRegion | null;
}

export interface OnTheFlySyncParams {
  event: GameEvent;
  videoTimeSeconds: number;
  recordedAtMs: number;
  videoEl?: HTMLVideoElement | null;
  quarterMarker?: QuarterMarker | null;
  currentGameState?: GameState | null;
  clockRegion?: NormalizedClockRegion | null;
  altClockRegion?: NormalizedClockRegion | null;
  minConfidence?: number;
}

export interface OnTheFlySyncResult {
  eventId: string;
  eventType: string;
  originalTimestamp: string;
  adjustedTimestamp: string;
  detectedGameClockMs: number;
  adjustedLiveTimerSeconds?: number;
  confidence: number;
  status: "SUCCESS" | "LOW_CONFIDENCE" | "NO_CLOCK_DETECTED" | "SKIPPED" | "FAILED";
  message: string;
  timeDeltaMs: number;
  cropUrl?: string;
}

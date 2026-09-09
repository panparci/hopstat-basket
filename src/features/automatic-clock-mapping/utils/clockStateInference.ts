import { RawClockScanPoint, ScanConfig, ClockState } from "../types";

export type SuspiciousInterval = {
  quarter: number;
  startVideoTime: number;
  endVideoTime: number;
  reason:
    | "STOPPED_CLOCK"
    | "CLOCK_DISCREPANCY"
    | "MISSING_OR_INVALID"
    | "REPLAY_SUSPECTED"
    | "LOW_CONFIDENCE";
  suggestedInterval: 5 | 1;
};

export type IntervalInference = {
  clockState: ClockState;
  gameClockStartMs: number;
  gameClockEndMs: number;
  confidence: number;
  needsRefinement: boolean;
  refinementReason?: string;
};

/**
 * Analyzes a pair of consecutive scan points to infer clock state and check if refinement is needed.
 */
export function inferClockStateForInterval(
  pointA: RawClockScanPoint,
  pointB: RawClockScanPoint,
  config: ScanConfig
): IntervalInference {
  const videoDelta = pointB.videoTimeSeconds - pointA.videoTimeSeconds;

  // Invalid or missing points
  if (
    pointA.status === "INVALID" ||
    pointB.status === "INVALID" ||
    pointA.detectedGameClockMs === null ||
    pointB.detectedGameClockMs === null
  ) {
    return {
      clockState: "UNRESOLVED",
      gameClockStartMs: pointA.detectedGameClockMs || 0,
      gameClockEndMs: pointB.detectedGameClockMs || 0,
      confidence: 0,
      needsRefinement: true,
      refinementReason: "Missing or invalid OCR data in interval",
    };
  }

  // Low confidence points
  if (pointA.status === "LOW_CONFIDENCE" || pointB.status === "LOW_CONFIDENCE") {
    return {
      clockState: "UNRESOLVED",
      gameClockStartMs: pointA.detectedGameClockMs,
      gameClockEndMs: pointB.detectedGameClockMs,
      confidence: Math.min(pointA.confidence, pointB.confidence),
      needsRefinement: true,
      refinementReason: "Low OCR confidence scan point in interval",
    };
  }

  // Replay suspected
  if (pointA.status === "POSSIBLE_REPLAY" || pointB.status === "POSSIBLE_REPLAY") {
    return {
      clockState: "UNRESOLVED",
      gameClockStartMs: pointA.detectedGameClockMs,
      gameClockEndMs: pointB.detectedGameClockMs,
      confidence: 30,
      needsRefinement: true,
      refinementReason: "Possible replay detected",
    };
  }

  const clockDecreaseSec = (pointA.detectedGameClockMs - pointB.detectedGameClockMs) / 1000;
  const avgConfidence = (pointA.confidence + pointB.confidence) / 2;

  // Case 1: Clock didn't change (clock decrease is 0 +/- 0.5s)
  if (Math.abs(clockDecreaseSec) <= 0.5) {
    return {
      clockState: "STOPPED",
      gameClockStartMs: pointA.detectedGameClockMs,
      gameClockEndMs: pointA.detectedGameClockMs,
      confidence: avgConfidence,
      needsRefinement: videoDelta > 10, // If stopped for >10s in 30s scan, refine to find start/stop
      refinementReason: videoDelta > 10 ? "Clock stopped for extended period, refine transition" : undefined,
    };
  }

  // Case 2: Clock decrease matches video elapsed time within tolerance (RUNNING)
  const diffFromVideoDelta = Math.abs(videoDelta - clockDecreaseSec);
  if (diffFromVideoDelta <= config.allowedClockDeltaToleranceSec) {
    return {
      clockState: "RUNNING",
      gameClockStartMs: pointA.detectedGameClockMs,
      gameClockEndMs: pointB.detectedGameClockMs,
      confidence: avgConfidence,
      needsRefinement: false,
    };
  }

  // Case 3: Partial running / partial stopped or clock discrepancy
  // e.g. YouTube elapsed 30s, clock decreased 12s -> clock ran 12s and stopped 18s
  return {
    clockState: "UNRESOLVED",
    gameClockStartMs: pointA.detectedGameClockMs,
    gameClockEndMs: pointB.detectedGameClockMs,
    confidence: avgConfidence * 0.7,
    needsRefinement: true,
    refinementReason: `Clock decreased by ${clockDecreaseSec.toFixed(1)}s over ${videoDelta.toFixed(1)}s video time (mixed running/stopped)`,
  };
}

/**
 * Scans a list of ordered raw scan points for a quarter and identifies suspicious intervals needing refinement.
 */
export function findSuspiciousIntervals(
  points: RawClockScanPoint[],
  config: ScanConfig
): SuspiciousInterval[] {
  const intervals: SuspiciousInterval[] = [];
  if (points.length < 2) return intervals;

  // Sort by videoTime
  const sorted = [...points].sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);

  for (let i = 0; i < sorted.length - 1; i++) {
    const ptA = sorted[i];
    const ptB = sorted[i + 1];
    const videoDelta = ptB.videoTimeSeconds - ptA.videoTimeSeconds;

    if (videoDelta <= 1) continue; // Already at 1-second resolution

    const inf = inferClockStateForInterval(ptA, ptB, config);

    if (inf.needsRefinement) {
      const suggestedInterval: 5 | 1 = videoDelta > 6 ? 5 : 1;
      let reason: SuspiciousInterval["reason"] = "CLOCK_DISCREPANCY";

      if (ptA.status === "INVALID" || ptB.status === "INVALID") {
        reason = "MISSING_OR_INVALID";
      } else if (ptA.status === "LOW_CONFIDENCE" || ptB.status === "LOW_CONFIDENCE") {
        reason = "LOW_CONFIDENCE";
      } else if (ptA.status === "POSSIBLE_REPLAY" || ptB.status === "POSSIBLE_REPLAY") {
        reason = "REPLAY_SUSPECTED";
      } else if (inf.clockState === "STOPPED") {
        reason = "STOPPED_CLOCK";
      }

      intervals.push({
        quarter: ptA.quarter,
        startVideoTime: ptA.videoTimeSeconds,
        endVideoTime: ptB.videoTimeSeconds,
        reason,
        suggestedInterval,
      });
    }
  }

  return intervals;
}

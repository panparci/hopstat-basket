import {
  ClockTimeline,
  QuarterMarker,
  NormalizedClockRegion,
  RawClockScanPoint,
  ScanConfig,
  MappingMode,
  EventTimelineMetadata,
} from "../types";
import { buildTimelineSegments } from "../utils/segmentBuilder";
import { formatMsToClockString } from "../utils/clockParser";

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  engine: "OFFLINE_OCR",
  coarseIntervalSeconds: 30,
  mediumIntervalSeconds: 5,
  fineIntervalSeconds: 1,
  minOCRConfidence: 60,
  stabilizationDelayMs: 500,
  maxRefinementAttempts: 3,
  allowedClockDeltaToleranceSec: 2,
};

/**
 * Builds or updates a ClockTimeline object from scan points.
 */
export function generateClockTimeline(
  matchId: string,
  videoId: string | undefined,
  quarterMarkers: QuarterMarker[],
  clockRegion: NormalizedClockRegion,
  altClockRegion: NormalizedClockRegion | null | undefined,
  rawScanPoints: RawClockScanPoint[],
  mode: MappingMode = "AUTO_WITH_REVIEW",
  existingTimeline?: ClockTimeline,
  ytTimerRegion?: NormalizedClockRegion | null
): ClockTimeline {
  const config = existingTimeline?.scanConfig || DEFAULT_SCAN_CONFIG;
  const { segments, issues, markers } = buildTimelineSegments(rawScanPoints, quarterMarkers, config);

  const unresolvedCount = issues.filter((i) => !i.resolved).length;
  const status =
    unresolvedCount === 0
      ? "READY_TO_PUBLISH"
      : "REVIEW_REQUIRED";

  return {
    id: existingTimeline?.id || `timeline-${matchId}`,
    matchId,
    videoId,
    quarterMarkers,
    clockRegion,
    altClockRegion,
    ytTimerRegion,
    rawScanPoints,
    derivedSegments: segments,
    clockStateMarkers: existingTimeline?.clockStateMarkers || markers,
    scanConfig: config,
    status,
    mode,
    version: 1, // Single active timeline entity per game/video
    createdAt: existingTimeline?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Given a published ClockTimeline and a current YouTube playback timestamp (seconds),
 * returns the mapped Quarter, Game Clock (ms & string), and full clock confidence/status metadata.
 * Strictly respects synchronization priority:
 * 1. Manual correction / Manual Start-Stop Clock markers
 * 2. Manual sync points
 * 3. Valid auto-scan mapping points
 * 4. Interpolated values from surrounding trusted points
 * 5. Unresolved state fallback (Invalid OCR records are strictly excluded)
 */
export function calculateGameClockFromTimeline(
  timeline: ClockTimeline,
  currentVideoTimeSeconds: number
): EventTimelineMetadata | null {
  if (!timeline || timeline.status !== "PUBLISHED" || timeline.derivedSegments.length === 0) {
    return null;
  }

  // 1. Identify active quarter
  const activeQuarterMarker = timeline.quarterMarkers.find(
    (qm) => currentVideoTimeSeconds >= qm.videoStartSeconds && currentVideoTimeSeconds <= qm.videoEndSeconds
  );

  const q = activeQuarterMarker ? activeQuarterMarker.quarter : 1;

  // Filter out INVALID scan points (Requirement 8)
  const quarterValidPoints = timeline.rawScanPoints
    .filter((p) => p.quarter === q && p.status === "VALID" && p.detectedGameClockMs !== null)
    .sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);

  const prevPoint = quarterValidPoints
    .filter((p) => p.videoTimeSeconds <= currentVideoTimeSeconds)
    .pop();

  const nextPoint = quarterValidPoints
    .find((p) => p.videoTimeSeconds >= currentVideoTimeSeconds);

  const prevTrustedPointMs = prevPoint?.detectedGameClockMs ?? null;
  const nextTrustedPointMs = nextPoint?.detectedGameClockMs ?? null;

  // Check explicit Start/Stop Clock markers (Priority #1 / #2)
  if (timeline.clockStateMarkers && timeline.clockStateMarkers.length > 0) {
    const qMarkers = timeline.clockStateMarkers
      .filter((m) => m.quarter === q && m.videoTimeSeconds <= currentVideoTimeSeconds)
      .sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);

    if (qMarkers.length > 0) {
      const activeMarker = qMarkers[qMarkers.length - 1];
      const isManual = activeMarker.source === "MANUAL";

      if (activeMarker.action === "STOP_CLOCK") {
        return {
          mappedGameClockMs: activeMarker.gameClockMs,
          mappedGameClockString: formatMsToClockString(activeMarker.gameClockMs),
          quarter: activeMarker.quarter,
          timelineSegmentId: activeMarker.id,
          timelineVersion: 1,
          clockConfidence: activeMarker.confidence,
          mappingSource: isManual ? "MANUAL_CORRECTION" : "AUTO",
          isUnresolvedEstimate: false,
          youtubeTimeSeconds: currentVideoTimeSeconds,
          clockState: "STOPPED",
          prevTrustedPointMs,
          nextTrustedPointMs,
          isInterpolated: false,
          isManuallyCorrected: isManual,
        };
      } else if (activeMarker.action === "START_CLOCK") {
        const elapsedVideo = currentVideoTimeSeconds - activeMarker.videoTimeSeconds;
        const calculatedMs = Math.max(0, activeMarker.gameClockMs - elapsedVideo * 1000);
        const roundedMs = Math.round(calculatedMs);

        return {
          mappedGameClockMs: roundedMs,
          mappedGameClockString: formatMsToClockString(roundedMs),
          quarter: activeMarker.quarter,
          timelineSegmentId: activeMarker.id,
          timelineVersion: 1,
          clockConfidence: activeMarker.confidence,
          mappingSource: isManual ? "MANUAL_CORRECTION" : "AUTO",
          isUnresolvedEstimate: false,
          youtubeTimeSeconds: currentVideoTimeSeconds,
          clockState: "RUNNING",
          prevTrustedPointMs,
          nextTrustedPointMs,
          isInterpolated: elapsedVideo > 0,
          isManuallyCorrected: isManual,
        };
      }
    }
  }

  // 2. Find matching timeline segment
  const seg = timeline.derivedSegments.find(
    (s) => currentVideoTimeSeconds >= s.videoStartSeconds && currentVideoTimeSeconds <= s.videoEndSeconds
  );

  if (seg) {
    const isManuallyCorrected = seg.source === "MANUAL_CORRECTION";

    if (seg.clockState === "STOPPED") {
      return {
        mappedGameClockMs: seg.gameClockStartMs,
        mappedGameClockString: formatMsToClockString(seg.gameClockStartMs),
        quarter: seg.quarter,
        timelineSegmentId: seg.id,
        timelineVersion: 1,
        clockConfidence: seg.confidence,
        mappingSource: seg.source,
        isUnresolvedEstimate: false,
        youtubeTimeSeconds: currentVideoTimeSeconds,
        clockState: "STOPPED",
        prevTrustedPointMs,
        nextTrustedPointMs,
        isInterpolated: false,
        isManuallyCorrected,
      };
    }

    if (seg.clockState === "RUNNING") {
      let calculatedMs = 0;
      if (seg.slope !== undefined && seg.intercept !== undefined) {
        calculatedMs = Math.max(0, seg.slope * currentVideoTimeSeconds + seg.intercept);
      } else {
        const elapsedVideo = currentVideoTimeSeconds - seg.videoStartSeconds;
        calculatedMs = Math.max(0, seg.gameClockStartMs - elapsedVideo * 1000);
      }
      const roundedMs = Math.round(calculatedMs);
      return {
        mappedGameClockMs: roundedMs,
        mappedGameClockString: formatMsToClockString(roundedMs),
        quarter: seg.quarter,
        timelineSegmentId: seg.id,
        timelineVersion: 1,
        clockConfidence: seg.confidence,
        mappingSource: seg.source,
        isUnresolvedEstimate: false,
        youtubeTimeSeconds: currentVideoTimeSeconds,
        clockState: "RUNNING",
        prevTrustedPointMs,
        nextTrustedPointMs,
        isInterpolated: true,
        isManuallyCorrected,
      };
    }
  }

  // 3. Fallback for UNRESOLVED segment or gaps between segments
  const nearestSeg = timeline.derivedSegments
    .filter((s) => s.quarter === q)
    .sort(
      (a, b) =>
        Math.abs(currentVideoTimeSeconds - a.videoStartSeconds) -
        Math.abs(currentVideoTimeSeconds - b.videoStartSeconds)
    )[0];

  if (nearestSeg) {
    const elapsedVideo = Math.max(0, currentVideoTimeSeconds - nearestSeg.videoStartSeconds);
    const estimatedMs = Math.max(0, nearestSeg.gameClockStartMs - elapsedVideo * 1000);
    const roundedMs = Math.round(estimatedMs);
    return {
      mappedGameClockMs: roundedMs,
      mappedGameClockString: formatMsToClockString(roundedMs),
      quarter: q,
      timelineSegmentId: nearestSeg.id,
      timelineVersion: 1,
      clockConfidence: 40,
      mappingSource: nearestSeg.source,
      isUnresolvedEstimate: true,
      youtubeTimeSeconds: currentVideoTimeSeconds,
      clockState: "UNRESOLVED",
      prevTrustedPointMs,
      nextTrustedPointMs,
      isInterpolated: true,
      isManuallyCorrected: false,
    };
  }

  return null;
}

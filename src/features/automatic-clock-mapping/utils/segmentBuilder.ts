import {
  RawClockScanPoint,
  ClockTimelineSegment,
  QuarterMarker,
  MandatoryReviewIssue,
  ScanConfig,
  ClockStateMarker,
} from "../types";
import { inferClockStateForInterval } from "./clockStateInference";
import {
  detectAndFilterOutliers,
  calculateSubsecondStoppageTransition,
} from "./statisticalRegression";

export type TimelineBuildResult = {
  segments: ClockTimelineSegment[];
  issues: MandatoryReviewIssue[];
  markers: ClockStateMarker[];
};

/**
 * Builds contiguous, non-overlapping ClockTimelineSegments from a set of raw scan points.
 * Also applies statistical linear regression outlier filtering and subsecond transition splitting,
 * generating explicit START_CLOCK and STOP_CLOCK state markers.
 */
export function buildTimelineSegments(
  rawPoints: RawClockScanPoint[],
  quarterMarkers: QuarterMarker[],
  config: ScanConfig
): TimelineBuildResult {
  const segments: ClockTimelineSegment[] = [];
  const issues: MandatoryReviewIssue[] = [];
  const markers: ClockStateMarker[] = [];

  // Filter statistical outliers before segment construction
  const cleanedPoints = detectAndFilterOutliers(rawPoints);

  for (const qMarker of quarterMarkers) {
    const qPoints = cleanedPoints
      .filter((p) => p.quarter === qMarker.quarter)
      .sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);

    if (qPoints.length === 0) {
      issues.push({
        id: `issue-no-points-q${qMarker.quarter}`,
        type: "MISSING_SCAN",
        quarter: qMarker.quarter,
        videoTimeSeconds: qMarker.videoStartSeconds,
        message: `No scan points found for Quarter ${qMarker.quarter}`,
        resolved: false,
      });
      continue;
    }

    // Check if quarter start point exists
    if (qPoints[0].videoTimeSeconds > qMarker.videoStartSeconds + 15) {
      issues.push({
        id: `issue-q-start-q${qMarker.quarter}`,
        type: "QUARTER_BOUNDARY_INCONSISTENCY",
        quarter: qMarker.quarter,
        videoTimeSeconds: qMarker.videoStartSeconds,
        message: `Missing scan point at or near Quarter ${qMarker.quarter} start (${qMarker.videoStartSeconds}s)`,
        resolved: false,
      });
    }

    let prevInferredState: "RUNNING" | "STOPPED" | "UNKNOWN" = "UNKNOWN";

    // Process scan points sequentially
    for (let i = 0; i < qPoints.length - 1; i++) {
      const ptA = qPoints[i];
      const ptB = qPoints[i + 1];

      // Flag point issues
      if (ptA.status === "INVALID") {
        issues.push({
          id: `issue-invalid-${ptA.id}`,
          type: "INVALID_OCR",
          quarter: ptA.quarter,
          videoTimeSeconds: ptA.videoTimeSeconds,
          message: `Invalid OCR result at ${ptA.videoTimeSeconds}s: ${ptA.rejectionReason || "Unreadable digits"}`,
          relatedPointIds: [ptA.id],
          resolved: false,
        });
      } else if (ptA.status === "LOW_CONFIDENCE") {
        issues.push({
          id: `issue-lowconf-${ptA.id}`,
          type: "LOW_CONFIDENCE",
          quarter: ptA.quarter,
          videoTimeSeconds: ptA.videoTimeSeconds,
          message: `Low OCR confidence (${Math.round(ptA.confidence)}%) at ${ptA.videoTimeSeconds}s: ${ptA.rejectionReason || "Low confidence score"}`,
          relatedPointIds: [ptA.id],
          resolved: false,
        });
      } else if (ptA.status === "POSSIBLE_REPLAY") {
        issues.push({
          id: `issue-replay-${ptA.id}`,
          type: "POSSIBLE_REPLAY",
          quarter: ptA.quarter,
          videoTimeSeconds: ptA.videoTimeSeconds,
          message: `Possible replay or unexpected clock jump at ${ptA.videoTimeSeconds}s`,
          relatedPointIds: [ptA.id],
          resolved: false,
        });
      }

      const inf = inferClockStateForInterval(ptA, ptB, config);

      let segmentSource: ClockTimelineSegment["source"] = "AUTO";
      if (ptA.scanIntervalSeconds < 30 || ptB.scanIntervalSeconds < 30) {
        segmentSource = "AUTO_REFINED";
      }

      const segmentId = `seg-q${qMarker.quarter}-${Math.round(ptA.videoTimeSeconds)}-${Math.round(ptB.videoTimeSeconds)}`;
      const videoDelta = ptB.videoTimeSeconds - ptA.videoTimeSeconds;

      if (inf.clockState === "RUNNING") {
        let slope = -1000;
        if (videoDelta > 0) {
          slope = (ptB.detectedGameClockMs! - ptA.detectedGameClockMs!) / videoDelta;
        }
        const intercept = ptA.detectedGameClockMs! - slope * ptA.videoTimeSeconds;

        segments.push({
          id: segmentId,
          quarter: qMarker.quarter,
          videoStartSeconds: ptA.videoTimeSeconds,
          videoEndSeconds: ptB.videoTimeSeconds,
          gameClockStartMs: ptA.detectedGameClockMs!,
          gameClockEndMs: ptB.detectedGameClockMs!,
          clockState: "RUNNING",
          confidence: inf.confidence,
          source: segmentSource,
          slope,
          intercept,
        });

        if (prevInferredState !== "RUNNING") {
          markers.push({
            id: `marker-start-${segmentId}`,
            quarter: qMarker.quarter,
            videoTimeSeconds: ptA.videoTimeSeconds,
            gameClockMs: ptA.detectedGameClockMs!,
            action: "START_CLOCK",
            source: "AUTO",
            confidence: inf.confidence,
          });
        }
        prevInferredState = "RUNNING";
      } else if (inf.clockState === "STOPPED") {
        segments.push({
          id: segmentId,
          quarter: qMarker.quarter,
          videoStartSeconds: ptA.videoTimeSeconds,
          videoEndSeconds: ptB.videoTimeSeconds,
          gameClockStartMs: ptA.detectedGameClockMs!,
          gameClockEndMs: ptA.detectedGameClockMs!,
          clockState: "STOPPED",
          confidence: inf.confidence,
          source: segmentSource,
          slope: 0,
          intercept: ptA.detectedGameClockMs!,
        });

        if (prevInferredState !== "STOPPED") {
          markers.push({
            id: `marker-stop-${segmentId}`,
            quarter: qMarker.quarter,
            videoTimeSeconds: ptA.videoTimeSeconds,
            gameClockMs: ptA.detectedGameClockMs!,
            action: "STOP_CLOCK",
            source: "AUTO",
            confidence: inf.confidence,
          });
        }
        prevInferredState = "STOPPED";
      } else if (
        ptA.status === "VALID" &&
        ptB.status === "VALID" &&
        ptA.detectedGameClockMs !== null &&
        ptB.detectedGameClockMs !== null
      ) {
        // Statistical subsecond transition splitting for mixed interval
        const { transitionVideoTime, transitionGameClockMs } = calculateSubsecondStoppageTransition(
          ptA.videoTimeSeconds,
          ptB.videoTimeSeconds,
          ptA.detectedGameClockMs,
          ptB.detectedGameClockMs,
          prevInferredState
        );

        if (prevInferredState === "STOPPED") {
          // STOPPED first, then RUNNING
          segments.push({
            id: `${segmentId}-part1`,
            quarter: qMarker.quarter,
            videoStartSeconds: ptA.videoTimeSeconds,
            videoEndSeconds: transitionVideoTime,
            gameClockStartMs: ptA.detectedGameClockMs,
            gameClockEndMs: ptA.detectedGameClockMs,
            clockState: "STOPPED",
            confidence: inf.confidence,
            source: segmentSource,
            slope: 0,
            intercept: ptA.detectedGameClockMs,
          });
          
          let slope2 = -1000;
          if (ptB.videoTimeSeconds > transitionVideoTime) {
            slope2 = (ptB.detectedGameClockMs - ptA.detectedGameClockMs) / (ptB.videoTimeSeconds - transitionVideoTime);
          }
          const intercept2 = ptA.detectedGameClockMs - slope2 * transitionVideoTime;
          
          segments.push({
            id: `${segmentId}-part2`,
            quarter: qMarker.quarter,
            videoStartSeconds: transitionVideoTime,
            videoEndSeconds: ptB.videoTimeSeconds,
            gameClockStartMs: ptA.detectedGameClockMs,
            gameClockEndMs: ptB.detectedGameClockMs,
            clockState: "RUNNING",
            confidence: inf.confidence,
            source: segmentSource,
            slope: slope2,
            intercept: intercept2,
          });

          markers.push({
            id: `marker-start-${segmentId}-p2`,
            quarter: qMarker.quarter,
            videoTimeSeconds: transitionVideoTime,
            gameClockMs: ptA.detectedGameClockMs,
            action: "START_CLOCK",
            source: "AUTO",
            confidence: inf.confidence,
          });
        } else {
          // RUNNING first, then STOPPED
          let slope1 = -1000;
          if (transitionVideoTime > ptA.videoTimeSeconds) {
            slope1 = (transitionGameClockMs - ptA.detectedGameClockMs) / (transitionVideoTime - ptA.videoTimeSeconds);
          }
          const intercept1 = ptA.detectedGameClockMs - slope1 * ptA.videoTimeSeconds;

          segments.push({
            id: `${segmentId}-part1`,
            quarter: qMarker.quarter,
            videoStartSeconds: ptA.videoTimeSeconds,
            videoEndSeconds: transitionVideoTime,
            gameClockStartMs: ptA.detectedGameClockMs,
            gameClockEndMs: transitionGameClockMs,
            clockState: "RUNNING",
            confidence: inf.confidence,
            source: segmentSource,
            slope: slope1,
            intercept: intercept1,
          });
          segments.push({
            id: `${segmentId}-part2`,
            quarter: qMarker.quarter,
            videoStartSeconds: transitionVideoTime,
            videoEndSeconds: ptB.videoTimeSeconds,
            gameClockStartMs: transitionGameClockMs,
            gameClockEndMs: transitionGameClockMs,
            clockState: "STOPPED",
            confidence: inf.confidence,
            source: segmentSource,
            slope: 0,
            intercept: transitionGameClockMs,
          });

          markers.push({
            id: `marker-stop-${segmentId}-p2`,
            quarter: qMarker.quarter,
            videoTimeSeconds: transitionVideoTime,
            gameClockMs: transitionGameClockMs,
            action: "STOP_CLOCK",
            source: "AUTO",
            confidence: inf.confidence,
          });
        }
        prevInferredState = "STOPPED";
      } else {
        // UNRESOLVED segment
        segments.push({
          id: segmentId,
          quarter: qMarker.quarter,
          videoStartSeconds: ptA.videoTimeSeconds,
          videoEndSeconds: ptB.videoTimeSeconds,
          gameClockStartMs: ptA.detectedGameClockMs || 0,
          gameClockEndMs: ptB.detectedGameClockMs || 0,
          clockState: "UNRESOLVED",
          confidence: inf.confidence,
          source: segmentSource,
        });

        issues.push({
          id: `issue-unresolved-${segmentId}`,
          type: "UNRESOLVED_TRANSITION",
          quarter: qMarker.quarter,
          videoTimeSeconds: ptA.videoTimeSeconds,
          message: `Unresolved clock transition between ${Math.round(ptA.videoTimeSeconds)}s and ${Math.round(ptB.videoTimeSeconds)}s`,
          relatedPointIds: [ptA.id, ptB.id],
          relatedSegmentIds: [segmentId],
          resolved: false,
        });
      }
    }
  }

  return { segments, issues, markers };
}


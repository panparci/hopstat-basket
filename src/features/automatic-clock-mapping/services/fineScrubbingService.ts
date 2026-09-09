import { YouTubePlayer } from "react-youtube";
import { RawClockScanPoint, QuarterMarker, ScanConfig, NormalizedClockRegion } from "../types";
import { OcrWorkerService } from "./ocrWorkerService";
import { captureAndCropFrame } from "../../visual-clock-sync/utils/imageUtils";
import { seekAndAwaitFrame } from "./youtubeSeekService";
import { generateId } from "../../../core/utils/idUtils";

export class FineScrubbingService {
  public static findAnomalousIntervals(
    points: RawClockScanPoint[],
    coarseIntervalSec: number = 30
  ): Array<{ tStart: number; tEnd: number; quarterMarker: QuarterMarker; reason: string }> {
    const intervals: Array<{ tStart: number; tEnd: number; quarterMarker: QuarterMarker; reason: string }> = [];

    // Group by quarter
    const pointsByQuarter = new Map<number, RawClockScanPoint[]>();
    for (const pt of points) {
      const list = pointsByQuarter.get(pt.quarter) || [];
      list.push(pt);
      pointsByQuarter.set(pt.quarter, list);
    }

    for (const [q, qPoints] of pointsByQuarter.entries()) {
      const sorted = [...qPoints].sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);

      for (let i = 0; i < sorted.length - 1; i++) {
        const ptA = sorted[i];
        const ptB = sorted[i + 1];

        const deltaYT = ptB.videoTimeSeconds - ptA.videoTimeSeconds;
        if (deltaYT <= 0 || deltaYT > coarseIntervalSec + 5) continue;

        // If either point is invalid or game clock is missing
        if (ptA.status !== "VALID" || ptB.status !== "VALID" || ptA.detectedGameClockMs === null || ptB.detectedGameClockMs === null) {
          intervals.push({
            tStart: ptA.videoTimeSeconds,
            tEnd: ptB.videoTimeSeconds,
            quarterMarker: {
              quarter: q,
              videoStartSeconds: 0,
              videoEndSeconds: 3600,
              initialGameClockMs: 600000,
            },
            reason: "MISSING_OR_INVALID_OCR",
          });
          continue;
        }

        const gcChangeSec = (ptA.detectedGameClockMs - ptB.detectedGameClockMs) / 1000;

        // Check if clock was stopped or started inside this interval
        const isSteadyRunning = Math.abs(gcChangeSec - deltaYT) <= 1.5;
        const isSteadyStopped = Math.abs(gcChangeSec) <= 1.0;

        if (!isSteadyRunning && !isSteadyStopped) {
          // Clock transition occurred in this 30s block!
          intervals.push({
            tStart: ptA.videoTimeSeconds,
            tEnd: ptB.videoTimeSeconds,
            quarterMarker: {
              quarter: q,
              videoStartSeconds: 0,
              videoEndSeconds: 3600,
              initialGameClockMs: 600000,
            },
            reason: `CLOCK_TRANSITION_DETECTED (GC delta: ${gcChangeSec.toFixed(1)}s vs Video delta: ${deltaYT.toFixed(1)}s)`,
          });
        }
      }
    }

    return intervals;
  }

  public static async executeTargetedFineScrubbing(
    player: YouTubePlayer,
    videoEl: HTMLVideoElement,
    region: NormalizedClockRegion,
    altRegion: NormalizedClockRegion | null | undefined,
    ytTimerRegion: NormalizedClockRegion | null | undefined,
    existingPoints: RawClockScanPoint[],
    config: ScanConfig,
    isCancelledCheck: () => boolean,
    isPausedCheck: () => Promise<void>,
    onProgressUpdate?: (currentVideoTime: number, totalFinePoints: number) => void
  ): Promise<RawClockScanPoint[]> {
    const ocrWorker = new OcrWorkerService();
    const intervals = FineScrubbingService.findAnomalousIntervals(existingPoints, config.coarseIntervalSeconds);

    if (intervals.length === 0) {
      return existingPoints;
    }

    const pointsMap = new Map<string, RawClockScanPoint>();
    for (const pt of existingPoints) {
      pointsMap.set(`${pt.quarter}_${Math.round(pt.videoTimeSeconds)}`, pt);
    }

    const delay = Math.max(100, Math.min(config.stabilizationDelayMs, 300));

    for (const interval of intervals) {
      if (isCancelledCheck()) break;

      // Fine sub-scan in 5-second steps within anomalous window [tStart, tEnd]
      let curr = interval.tStart + config.mediumIntervalSeconds;
      while (curr < interval.tEnd && !isCancelledCheck()) {
        await isPausedCheck();
        if (isCancelledCheck()) break;

        const key = `${interval.quarterMarker.quarter}_${Math.round(curr)}`;
        if (!pointsMap.has(key)) {
          const seekOk = await seekAndAwaitFrame(player, videoEl, curr, delay);
          if (seekOk) {
            let actualVideoTime = curr;
            if (typeof player?.getCurrentTime === "function") {
              const pTime = player.getCurrentTime();
              if (typeof pTime === "number" && !isNaN(pTime) && Math.abs(pTime - curr) <= 5) {
                actualVideoTime = Math.round(pTime * 10) / 10;
              }
            } else if (videoEl && !isNaN(videoEl.currentTime) && Math.abs(videoEl.currentTime - curr) <= 5) {
              actualVideoTime = Math.round(videoEl.currentTime * 10) / 10;
            }

            let primaryCrop = null;
            let altCrop = null;
            let ytTimerCrop = null;
            if (region) primaryCrop = captureAndCropFrame(videoEl, region);
            if (altRegion) altCrop = captureAndCropFrame(videoEl, altRegion);
            if (ytTimerRegion) ytTimerCrop = captureAndCropFrame(videoEl, ytTimerRegion);

            const capturedItem = {
              id: generateId(),
              quarter: interval.quarterMarker.quarter,
              videoTimeSeconds: actualVideoTime,
              scanIntervalSeconds: 5 as const,
              quarterMarker: interval.quarterMarker,
              primaryCrop,
              altCrop,
              ytTimerCrop,
              parseContext: {
                quarterMarker: interval.quarterMarker,
                currentVideoTimeSeconds: actualVideoTime,
              },
              capturedAt: Date.now(),
            };

            const processedPoint = await ocrWorker.processCapturedItem(capturedItem, config);
            pointsMap.set(key, processedPoint);

            if (onProgressUpdate) {
              onProgressUpdate(curr, pointsMap.size);
            }
          }
        }

        curr += config.mediumIntervalSeconds;
      }
    }

    return Array.from(pointsMap.values()).sort(
      (a, b) => a.quarter - b.quarter || a.videoTimeSeconds - b.videoTimeSeconds
    );
  }
}

import { YouTubePlayer } from "react-youtube";
import { NormalizedClockRegion, QuarterMarker, ScanConfig, ClockFormatState, RawClockScanPoint } from "../types";
import { seekAndAwaitFrame } from "./youtubeSeekService";
import { captureAndCropFrame } from "../../visual-clock-sync/utils/imageUtils";
import { generateId } from "../../../core/utils/idUtils";
import { ParseClockContext } from "../utils/clockParser";

export interface CapturedFrameItem {
  id: string;
  quarter: number;
  videoTimeSeconds: number;
  scanIntervalSeconds: 30 | 5 | 1;
  quarterMarker: QuarterMarker;
  primaryCrop?: { rawUrl: string; processedUrl: string; variantUrls: string[] } | null;
  altCrop?: { rawUrl: string; processedUrl: string; variantUrls: string[] } | null;
  ytTimerCrop?: { rawUrl: string; processedUrl: string; variantUrls: string[] } | null;
  parseContext: ParseClockContext;
  capturedAt: number;
}

/**
  * Tahap 1: Fast Capture Pipeline (I/O Bound)
  * Sweeps the video to take screenshot crops as fast as possible.
  * Player seeks every 30s, waits a short stabilization delay (100-200ms),
  * captures canvas crops, and immediately pushes to the queue without waiting for OCR.
  */
export class CaptureQueueService {
  private queue: CapturedFrameItem[] = [];
  private listeners: Array<(item: CapturedFrameItem) => void> = [];

  public clearQueue() {
    this.queue = [];
  }

  public onEnqueue(listener: (item: CapturedFrameItem) => void) {
    this.listeners.push(listener);
  }

  public enqueue(item: CapturedFrameItem) {
    this.queue.push(item);
    for (const listener of this.listeners) {
      listener(item);
    }
  }

  public dequeue(): CapturedFrameItem | undefined {
    return this.queue.shift();
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public async executeCoarseCapture(
    player: YouTubePlayer,
    videoEl: HTMLVideoElement,
    region: NormalizedClockRegion,
    altRegion: NormalizedClockRegion | null | undefined,
    ytTimerRegion: NormalizedClockRegion | null | undefined,
    quarterMarkers: QuarterMarker[],
    config: ScanConfig,
    isCancelledCheck: () => boolean,
    isPausedCheck: () => Promise<void>,
    onFrameCaptured: (item: CapturedFrameItem, totalEstimated: number) => void
  ): Promise<CapturedFrameItem[]> {
    const items: CapturedFrameItem[] = [];
    const delay = Math.max(100, Math.min(config.stabilizationDelayMs, 300)); // Ultra-fast stabilization delay (100-300ms)

    let totalEstimated = 0;
    for (const qm of quarterMarkers) {
      const dur = Math.max(0, qm.videoEndSeconds - qm.videoStartSeconds);
      totalEstimated += Math.ceil(dur / config.coarseIntervalSeconds) + 1;
    }

    for (const qm of quarterMarkers) {
      if (isCancelledCheck()) break;
      let currTime = qm.videoStartSeconds;

      while (currTime <= qm.videoEndSeconds && !isCancelledCheck()) {
        await isPausedCheck();
        if (isCancelledCheck()) break;

        // 1. Seek player to timestamp and await frame stabilization
        const maxWaitMs = Math.max(300, Math.min(config.stabilizationDelayMs || 600, 1000));
        const seekOk = await seekAndAwaitFrame(player, videoEl, currTime, maxWaitMs);
        if (!seekOk && isCancelledCheck()) break;

        // Determine actual recorded video timestamp (use player/video time only if close to target currTime, otherwise stick to currTime)
        let actualVideoTime = currTime;
        if (typeof player?.getCurrentTime === "function") {
          const pTime = player.getCurrentTime();
          if (typeof pTime === "number" && !isNaN(pTime) && Math.abs(pTime - currTime) <= 5) {
            actualVideoTime = Math.round(pTime * 10) / 10;
          }
        } else if (videoEl && !isNaN(videoEl.currentTime) && Math.abs(videoEl.currentTime - currTime) <= 5) {
          actualVideoTime = Math.round(videoEl.currentTime * 10) / 10;
        }

        // 2. Capture screenshot canvas crops immediately
        let primaryCrop = null;
        let altCrop = null;
        let ytTimerCrop = null;

        try {
          if (region) {
            primaryCrop = captureAndCropFrame(videoEl, region);
          }
        } catch (err) {
          console.warn("Primary crop error at", actualVideoTime, err);
        }

        try {
          if (altRegion) {
            altCrop = captureAndCropFrame(videoEl, altRegion);
          }
        } catch (err) {
          console.warn("Alt crop error at", actualVideoTime, err);
        }

        try {
          if (ytTimerRegion) {
            ytTimerCrop = captureAndCropFrame(videoEl, ytTimerRegion);
          }
        } catch (err) {
          console.warn("YT Timer crop error at", actualVideoTime, err);
        }

        const parseContext: ParseClockContext = {
          quarterMarker: qm,
          currentVideoTimeSeconds: actualVideoTime,
          isUnderOneMinuteContext: qm.videoEndSeconds - actualVideoTime <= 90,
        };

        const item: CapturedFrameItem = {
          id: generateId(),
          quarter: qm.quarter,
          videoTimeSeconds: actualVideoTime,
          scanIntervalSeconds: 30,
          quarterMarker: qm,
          primaryCrop,
          altCrop,
          ytTimerCrop,
          parseContext,
          capturedAt: Date.now(),
        };

        // 3. Immediately enqueue & fire callback
        this.enqueue(item);
        items.push(item);
        onFrameCaptured(item, totalEstimated);

        // 4. Advance 30 seconds immediately WITHOUT waiting for OCR!
        currTime += config.coarseIntervalSeconds;
      }
    }

    return items;
  }
}

import { YouTubePlayer } from "react-youtube";
import { RawClockScanPoint, QuarterMarker, ScanConfig, NormalizedClockRegion, ScanProgressState } from "../types";
import { CaptureQueueService, CapturedFrameItem } from "./captureQueueService";
import { OcrWorkerService } from "./ocrWorkerService";
import { RegionValidationService } from "./regionValidationService";
import { AIFallbackService } from "./aiFallbackService";
import { FineScrubbingService } from "./fineScrubbingService";

export type PipelineCallbacks = {
  onProgress: (state: ScanProgressState) => void;
  onPointCaptured: (pt: RawClockScanPoint) => void;
  onComplete: (points: RawClockScanPoint[]) => void;
  onError: (err: string) => void;
  onAbortInvalidRegion: (message: string, validRatioPercent: number) => void;
};

export class AdaptivePipelineService {
  private isPaused = false;
  private isCancelled = false;

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    this.isPaused = false;
  }

  public cancel() {
    this.isCancelled = true;
  }

  public getIsPaused() {
    return this.isPaused;
  }

  public getIsCancelled() {
    return this.isCancelled;
  }

  private async checkPaused() {
    while (this.isPaused && !this.isCancelled) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  public async runPipeline(
    player: YouTubePlayer,
    videoEl: HTMLVideoElement,
    region: NormalizedClockRegion,
    altRegion: NormalizedClockRegion | null | undefined,
    ytTimerRegion: NormalizedClockRegion | null | undefined,
    quarterMarkers: QuarterMarker[],
    config: ScanConfig,
    callbacks: PipelineCallbacks
  ): Promise<RawClockScanPoint[]> {
    this.isPaused = false;
    this.isCancelled = false;

    if (!quarterMarkers || quarterMarkers.length === 0) {
      throw new Error("Quarter markers boundaries not configured. Please set Q1-Q4 boundaries first.");
    }

    const captureQueueService = new CaptureQueueService();
    const ocrWorkerService = new OcrWorkerService();

    const coarseScanPointsMap = new Map<string, RawClockScanPoint>();
    let totalEstimatedCount = 120;
    let totalCapturedCount = 0;
    let totalProcessedOcrCount = 0;
    let isCaptureFinished = false;
    let lastValidPoint: RawClockScanPoint | undefined;

    // ==========================================
    // TAHAP 1 & 2 CONCURRENT STREAMING PIPELINE
    // Stage 1 (Fast Capture) and Stage 2 (Parallel OCR) run simultaneously!
    // ==========================================
    callbacks.onProgress({
      status: "FAST_CAPTURE",
      stage: 1,
      currentQuarter: quarterMarkers[0].quarter,
      totalQuarters: quarterMarkers.length,
      completedScanPointsCount: 0,
      totalEstimatedPointsCount: 120,
      suspiciousIntervalsCount: 0,
      currentVideoTime: quarterMarkers[0].videoStartSeconds,
      capturedCount: 0,
      processedOcrCount: 0,
    });

    // Start Async OCR Consumer Worker (runs concurrently alongside video frame capture)
    const ocrConsumerPromise = (async () => {
      while (!this.isCancelled) {
        await this.checkPaused();
        const item = captureQueueService.dequeue();

        if (!item) {
          if (isCaptureFinished) {
            // All frames captured and queue is empty -> Consumer complete
            break;
          }
          // Wait briefly for next frame
          await new Promise((r) => setTimeout(r, 40));
          continue;
        }

        // Process local OCR on captured frame concurrently
        const processedPoint = await ocrWorkerService.processCapturedItem(item, config, lastValidPoint);

        if (processedPoint.status === "VALID" && processedPoint.detectedGameClockMs !== null) {
          lastValidPoint = processedPoint;
        }

        const key = `${item.quarter}_${Math.round(item.videoTimeSeconds)}`;
        coarseScanPointsMap.set(key, processedPoint);
        callbacks.onPointCaptured(processedPoint);

        totalProcessedOcrCount++;
        const currentPoints = Array.from(coarseScanPointsMap.values());
        const validCount = currentPoints.filter((p) => p.status === "VALID").length;
        const invalidCount = currentPoints.length - validCount;

        callbacks.onProgress({
          status: "PARALLEL_OCR",
          stage: 2,
          currentQuarter: item.quarter,
          totalQuarters: quarterMarkers.length,
          completedScanPointsCount: currentPoints.length,
          totalEstimatedPointsCount: totalEstimatedCount,
          suspiciousIntervalsCount: 0,
          currentVideoTime: item.videoTimeSeconds,
          capturedCount: totalCapturedCount,
          processedOcrCount: totalProcessedOcrCount,
          validOcrCount: validCount,
          invalidCount: invalidCount,
          validRatioPercent: currentPoints.length > 0 ? Math.round((validCount / currentPoints.length) * 100) : 0,
        });
      }
    })();

    try {
      // Execute Stage 1 Fast Capture (Producer) while Stage 2 OCR Consumer runs in background
      await captureQueueService.executeCoarseCapture(
        player,
        videoEl,
        region,
        altRegion,
        ytTimerRegion,
        quarterMarkers,
        config,
        () => this.isCancelled,
        () => this.checkPaused(),
        (item, totalEst) => {
          totalEstimatedCount = totalEst;
          totalCapturedCount++;
          callbacks.onProgress({
            status: "FAST_CAPTURE",
            stage: 1,
            currentQuarter: item.quarter,
            totalQuarters: quarterMarkers.length,
            completedScanPointsCount: totalProcessedOcrCount,
            totalEstimatedPointsCount: totalEst,
            suspiciousIntervalsCount: 0,
            currentVideoTime: item.videoTimeSeconds,
            capturedCount: totalCapturedCount,
            processedOcrCount: totalProcessedOcrCount,
          });
        }
      );

      // Signal capture stage complete
      isCaptureFinished = true;

      // Wait for OCR Consumer worker to drain remaining items
      await ocrConsumerPromise;

      if (this.isCancelled) {
        callbacks.onProgress({ status: "CANCELLED", currentQuarter: 1, totalQuarters: 4, completedScanPointsCount: 0, totalEstimatedPointsCount: 0, suspiciousIntervalsCount: 0, currentVideoTime: 0 });
        return [];
      }

      const coarsePointsArray = Array.from(coarseScanPointsMap.values());

      // ==========================================
      // TAHAP 3: Region Validation & Early Abort (Fail-Fast Mechanism)
      // ==========================================
      callbacks.onProgress({
        status: "REGION_VALIDATION",
        stage: 3,
        currentQuarter: quarterMarkers[0].quarter,
        totalQuarters: quarterMarkers.length,
        completedScanPointsCount: coarsePointsArray.length,
        totalEstimatedPointsCount: coarsePointsArray.length,
        suspiciousIntervalsCount: 0,
        currentVideoTime: coarsePointsArray[0]?.videoTimeSeconds || 0,
      });

      const validation = RegionValidationService.evaluateCoarseScanRatio(coarsePointsArray, 0.10); // < 10% threshold

      if (validation.shouldAbort) {
        const abortMsg = validation.message || "Proses dihentikan. Tingkat keberhasilan deteksi < 10%. Silakan atur ulang region jam.";
        callbacks.onProgress({
          status: "ABORTED_INVALID_REGION",
          stage: 3,
          currentQuarter: quarterMarkers[0].quarter,
          totalQuarters: quarterMarkers.length,
          completedScanPointsCount: coarsePointsArray.length,
          totalEstimatedPointsCount: coarsePointsArray.length,
          suspiciousIntervalsCount: 0,
          currentVideoTime: 0,
          validRatioPercent: validation.validRatioPercent,
          abortMessage: abortMsg,
          errorMessage: abortMsg,
        });

        callbacks.onAbortInvalidRegion(abortMsg, validation.validRatioPercent);
        return coarsePointsArray;
      }

      // ==========================================
      // TAHAP 4: AI Fallback & Recovery (Network Bound)
      // ==========================================
      callbacks.onProgress({
        status: "AI_FALLBACK",
        stage: 4,
        currentQuarter: quarterMarkers[0].quarter,
        totalQuarters: quarterMarkers.length,
        completedScanPointsCount: coarsePointsArray.length,
        totalEstimatedPointsCount: coarsePointsArray.length,
        suspiciousIntervalsCount: 0,
        currentVideoTime: coarsePointsArray[0]?.videoTimeSeconds || 0,
        validOcrCount: validation.validCount,
        invalidCount: coarsePointsArray.length - validation.validCount,
      });

      const aiRecovery = await AIFallbackService.executeBatchAIRecovery(
        coarsePointsArray,
        8, // Batch size
        (recoveredCount, totalFailed) => {
          callbacks.onProgress({
            status: "AI_FALLBACK",
            stage: 4,
            currentQuarter: quarterMarkers[0].quarter,
            totalQuarters: quarterMarkers.length,
            completedScanPointsCount: coarsePointsArray.length,
            totalEstimatedPointsCount: coarsePointsArray.length,
            suspiciousIntervalsCount: 0,
            currentVideoTime: coarsePointsArray[0]?.videoTimeSeconds || 0,
            aiRecoveredCount: recoveredCount,
            invalidCount: totalFailed,
          });
        }
      );

      const postAiPoints = aiRecovery.updatedPoints;

      // ==========================================
      // TAHAP 5: Adaptive Fine-Scrubbing (Targeted Search)
      // ==========================================
      callbacks.onProgress({
        status: "FINE_SCRUBBING",
        stage: 5,
        currentQuarter: quarterMarkers[0].quarter,
        totalQuarters: quarterMarkers.length,
        completedScanPointsCount: postAiPoints.length,
        totalEstimatedPointsCount: postAiPoints.length,
        suspiciousIntervalsCount: 1,
        currentVideoTime: postAiPoints[0]?.videoTimeSeconds || 0,
      });

      const finalFinePoints = await FineScrubbingService.executeTargetedFineScrubbing(
        player,
        videoEl,
        region,
        altRegion,
        ytTimerRegion,
        postAiPoints,
        config,
        () => this.isCancelled,
        () => this.checkPaused(),
        (currTime, totalPts) => {
          callbacks.onProgress({
            status: "FINE_SCRUBBING",
            stage: 5,
            currentQuarter: quarterMarkers[0].quarter,
            totalQuarters: quarterMarkers.length,
            completedScanPointsCount: totalPts,
            totalEstimatedPointsCount: totalPts,
            suspiciousIntervalsCount: 1,
            currentVideoTime: currTime,
          });
        }
      );

      callbacks.onProgress({
        status: "COMPLETED",
        currentQuarter: quarterMarkers[quarterMarkers.length - 1]?.quarter || 1,
        totalQuarters: quarterMarkers.length,
        completedScanPointsCount: finalFinePoints.length,
        totalEstimatedPointsCount: finalFinePoints.length,
        suspiciousIntervalsCount: 0,
        currentVideoTime: quarterMarkers[quarterMarkers.length - 1]?.videoEndSeconds || 0,
      });

      callbacks.onComplete(finalFinePoints);
      return finalFinePoints;
    } catch (err: any) {
      console.error("Adaptive Pipeline Execution Error:", err);
      callbacks.onError(err?.message || "Terjadi kesalahan saat memproses pipeline.");
      throw err;
    }
  }
}

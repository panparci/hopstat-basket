import { YouTubePlayer } from "react-youtube";
import { NormalizedClockRegion, QuarterMarker, RawClockScanPoint, ClockStateMarker } from "../types";
import { seekAndAwaitFrame } from "./youtubeSeekService";
import { captureCroppedCanvasBase64 } from "./frameCaptureService";
import { parseClockWithContext } from "../utils/clockParser";
import { TokenLogger } from "../../../core/services/ai/tokenLogger";

export interface AiScanProgressCallback {
  (progress: {
    status: string;
    currentQuarter: string;
    processedFrames: number;
    totalFrames: number;
    currentVideoTime: number;
    message: string;
    tokensUsed: number;
    costIDR: number;
  }): void;
}

export class AiBatchScanService {
  /**
   * Run a token-efficient AI Vision scan using Gemini Batch OCR.
   * Processes frames in batches per quarter and derives full YT-GameClock time pairings,
   * including clock start/end boundaries and running/stopped state transitions.
   */
  public static async executeAiBatchScan(params: {
    quarterMarkers: QuarterMarker[];
    player: YouTubePlayer | null;
    videoEl: HTMLVideoElement | null;
    clockRegion: NormalizedClockRegion | null;
    altClockRegion: NormalizedClockRegion | null;
    ytTimerRegion?: NormalizedClockRegion | null;
    onProgress?: AiScanProgressCallback;
  }): Promise<{
    points: RawClockScanPoint[];
    clockStateMarkers: ClockStateMarker[];
    totalTokensUsed: number;
    totalCostIDR: number;
  }> {
    const { quarterMarkers, player, videoEl, clockRegion, altClockRegion, ytTimerRegion, onProgress } = params;

    if (!clockRegion) {
      throw new Error("Area crop jam pertandingan utama belum dikalibrasi.");
    }

    const scanPoints: RawClockScanPoint[] = [];
    const stateMarkers: ClockStateMarker[] = [];
    let cumulativeTokens = 0;
    let cumulativeCostIDR = 0;

    // Filter quarter markers with valid duration
    const activeQuarters = quarterMarkers.filter((q) => q.videoEndSeconds > q.videoStartSeconds);
    if (activeQuarters.length === 0) {
      throw new Error("Tidak ada kuarter yang diatur batas waktunya.");
    }

    // Step 1: Calculate total frame sampling plan across quarters
    // To be token-efficient: sample keyframes every 20s
    const SAMPLE_INTERVAL_SEC = 20;
    const batchPlan: Array<{
      id: string;
      quarterNum: number;
      quarterName: string;
      videoTimeSeconds: number;
      expectedClockMs: number;
      isBoundary: boolean;
      boundaryType?: "START" | "END";
    }> = [];

    for (const q of activeQuarters) {
      const duration = q.videoEndSeconds - q.videoStartSeconds;
      if (duration <= 0) continue;

      const qName = q.quarter > 4 ? `OT${q.quarter - 4}` : `Q${q.quarter}`;

      // Start Boundary
      batchPlan.push({
        id: `ai-sample-q${q.quarter}-start-${Math.round(q.videoStartSeconds)}`,
        quarterNum: q.quarter,
        quarterName: qName,
        videoTimeSeconds: q.videoStartSeconds,
        expectedClockMs: q.initialGameClockMs,
        isBoundary: true,
        boundaryType: "START",
      });

      // Sample intermediate keyframes
      let currentTime = q.videoStartSeconds + SAMPLE_INTERVAL_SEC;
      let stepCount = 0;
      while (currentTime < q.videoEndSeconds - 5) {
        // Approximate expected game clock assuming constant countdown
        const elapsedSec = currentTime - q.videoStartSeconds;
        const approxClockMs = Math.max(0, q.initialGameClockMs - elapsedSec * 1000);

        batchPlan.push({
          id: `ai-sample-q${q.quarter}-mid-${stepCount}-${Math.round(currentTime)}`,
          quarterNum: q.quarter,
          quarterName: qName,
          videoTimeSeconds: currentTime,
          expectedClockMs: approxClockMs,
          isBoundary: false,
        });

        currentTime += SAMPLE_INTERVAL_SEC;
        stepCount++;
      }

      // End Boundary
      batchPlan.push({
        id: `ai-sample-q${q.quarter}-end-${Math.round(q.videoEndSeconds)}`,
        quarterNum: q.quarter,
        quarterName: qName,
        videoTimeSeconds: q.videoEndSeconds,
        expectedClockMs: 0,
        isBoundary: true,
        boundaryType: "END",
      });
    }

    const totalPlannedFrames = batchPlan.length;
    let processedFrameCount = 0;

    // Step 2: Capture and process images in batches of 10 max per Gemini call
    const BATCH_SIZE = 10;
    for (let i = 0; i < batchPlan.length; i += BATCH_SIZE) {
      const currentBatchPlan = batchPlan.slice(i, i + BATCH_SIZE);

      if (onProgress) {
        onProgress({
          status: "CAPTURING_FRAMES",
          currentQuarter: currentBatchPlan[0].quarterName,
          processedFrames: processedFrameCount,
          totalFrames: totalPlannedFrames,
          currentVideoTime: currentBatchPlan[0].videoTimeSeconds,
          message: `Mengambil frame video ${processedFrameCount + 1}-${Math.min(
            processedFrameCount + BATCH_SIZE,
            totalPlannedFrames
          )} dari ${totalPlannedFrames}...`,
          tokensUsed: cumulativeTokens,
          costIDR: cumulativeCostIDR,
        });
      }

      // Capture images for the current batch
      const capturedItems: Array<{
        id: string;
        videoTimeSeconds: number;
        base64Image: string;
        expectedClockMs: number;
        quarterId: string;
        boundaryType?: "START" | "END";
      }> = [];

      for (const item of currentBatchPlan) {
        const seekOk = await seekAndAwaitFrame(player, videoEl, item.videoTimeSeconds, 1000);
        if (!seekOk) console.warn(`Frame seek warning at ${item.videoTimeSeconds}s`);

        if (!videoEl) continue;

        // Capture base64 cropped image of primary clock region
        const base64Primary = captureCroppedCanvasBase64(videoEl, clockRegion);

        if (base64Primary) {
          capturedItems.push({
            id: item.id,
            videoTimeSeconds: item.videoTimeSeconds,
            base64Image: base64Primary,
            expectedClockMs: item.expectedClockMs,
            quarterId: String(item.quarterNum),
            boundaryType: item.boundaryType,
          });
        }

        processedFrameCount++;
      }

      if (capturedItems.length === 0) continue;

      if (onProgress) {
        onProgress({
          status: "GEMINI_VISION_API",
          currentQuarter: currentBatchPlan[0].quarterName,
          processedFrames: processedFrameCount,
          totalFrames: totalPlannedFrames,
          currentVideoTime: currentBatchPlan[currentBatchPlan.length - 1].videoTimeSeconds,
          message: `Mengirim ${capturedItems.length} frame ke Gemini Vision AI...`,
          tokensUsed: cumulativeTokens,
          costIDR: cumulativeCostIDR,
        });
      }

      // Step 3: Call Gemini Batch OCR API
      try {
        const response = await fetch("/api/gemini/batch-ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: capturedItems.map((c) => ({
              id: c.id,
              videoTimeSeconds: c.videoTimeSeconds,
              base64Image: c.base64Image,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error(`API Gemini Batch OCR Error ${response.status}`);
        }

        const data = await response.json();
        const apiResults: Array<{
          id: string;
          gameClockText: string | null;
          isBlocked: boolean;
          clockState?: string;
          confidence: number;
        }> = data.results || [];

        // Log tokens used
        if (data.usage) {
          const logEntry = await TokenLogger.log({
            model: "gemini-3.6-flash",
            action: `AI Scan Vision Batch (${capturedItems.length} frames)`,
            promptTokenCount: data.usage.promptTokenCount || 0,
            candidatesTokenCount: data.usage.candidatesTokenCount || 0,
            itemCount: capturedItems.length,
          });

          cumulativeTokens += logEntry.totalTokenCount;
          cumulativeCostIDR += logEntry.costIDR;
        }

        // Map API results back to captured items
        const resultMap = new Map(apiResults.map((r) => [r.id, r]));

        let prevValidMs: number | null = null;

        for (const captured of capturedItems) {
          const apiMatch = resultMap.get(captured.id);

          if (apiMatch && !apiMatch.isBlocked && apiMatch.gameClockText) {
            const parsed = parseClockWithContext(apiMatch.gameClockText, {
              currentVideoTimeSeconds: captured.videoTimeSeconds,
            });

            const detectedMs = parsed.gameClockMs;
            if (detectedMs !== null) {
              prevValidMs = detectedMs;
            }

            const scanPoint: RawClockScanPoint = {
              id: captured.id,
              quarter: Number(captured.quarterId) || 1,
              videoTimeSeconds: captured.videoTimeSeconds,
              detectedGameClockMs: detectedMs,
              confidence: apiMatch.confidence || 95,
              rawOCRText: apiMatch.gameClockText,
              normalizedOCRText: parsed.normalizedText || apiMatch.gameClockText,
              source: "AUTO",
              scanIntervalSeconds: 30,
              status: detectedMs !== null ? "VALID" : "INVALID",
              rawCropUrl: captured.base64Image,
              primaryCropUrl: captured.base64Image,
            };

            scanPoints.push(scanPoint);
          } else {
            // Blocked or unreadable frame
            scanPoints.push({
              id: captured.id,
              quarter: Number(captured.quarterId) || 1,
              videoTimeSeconds: captured.videoTimeSeconds,
              detectedGameClockMs: null,
              confidence: 0,
              rawOCRText: apiMatch?.gameClockText || "BLOCKED",
              normalizedOCRText: "BLOCKED",
              source: "AUTO",
              scanIntervalSeconds: 30,
              status: "INVALID",
              rawCropUrl: captured.base64Image,
              primaryCropUrl: captured.base64Image,
            });
          }
        }
      } catch (err: any) {
        console.error("AI Batch Scan Error:", err);
      }
    }

    // Step 4: Post-Process pairings & detect Start/End boundaries + Clock State Transitions
    // Sort scan points chronologically
    scanPoints.sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);

    for (let idx = 0; idx < scanPoints.length; idx++) {
      const curr = scanPoints[idx];
      const prev = idx > 0 ? scanPoints[idx - 1] : null;

      if (curr.status !== "VALID" || curr.detectedGameClockMs === null) continue;

      // Detect state transition by comparing consecutive valid points
      if (prev && prev.status === "VALID" && prev.detectedGameClockMs !== null) {
        const dtSec = curr.videoTimeSeconds - prev.videoTimeSeconds;
        const dClockMs = prev.detectedGameClockMs - curr.detectedGameClockMs; // expected positive decrease

        // Find quarter for point
        const qObj = quarterMarkers.find(
          (q) => prev.videoTimeSeconds >= q.videoStartSeconds && prev.videoTimeSeconds <= q.videoEndSeconds
        ) || quarterMarkers[0];

        // If video moved forward > 5s but clock decreased < 1s => Clock was STOPPED
        if (dtSec >= 5 && dClockMs < 1000) {
          stateMarkers.push({
            id: `state-stop-${Math.round(prev.videoTimeSeconds)}`,
            quarter: qObj?.quarter || 1,
            videoTimeSeconds: prev.videoTimeSeconds,
            action: "STOP_CLOCK",
            gameClockMs: prev.detectedGameClockMs,
            source: "AUTO",
            confidence: 90,
          });
        } else if (dtSec >= 5 && dClockMs >= 2000) {
          // Clock was RUNNING
          stateMarkers.push({
            id: `state-run-${Math.round(curr.videoTimeSeconds)}`,
            quarter: qObj?.quarter || 1,
            videoTimeSeconds: curr.videoTimeSeconds,
            action: "START_CLOCK",
            gameClockMs: curr.detectedGameClockMs,
            source: "AUTO",
            confidence: 90,
          });
        }
      }
    }

    if (onProgress) {
      onProgress({
        status: "COMPLETED",
        currentQuarter: "FINISH",
        processedFrames: totalPlannedFrames,
        totalFrames: totalPlannedFrames,
        currentVideoTime: batchPlan[batchPlan.length - 1]?.videoTimeSeconds || 0,
        message: `AI Vision Scan selesai! Menghasilkan ${scanPoints.filter((p) => p.status === "VALID").length} valid time pairings. Total biaya: Rp ${cumulativeCostIDR.toFixed(2)}`,
        tokensUsed: cumulativeTokens,
        costIDR: cumulativeCostIDR,
      });
    }

    return {
      points: scanPoints,
      clockStateMarkers: stateMarkers,
      totalTokensUsed: cumulativeTokens,
      totalCostIDR: cumulativeCostIDR,
    };
  }
}

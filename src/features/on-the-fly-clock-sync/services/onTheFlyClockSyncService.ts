import { captureAndCropFrame } from "../../visual-clock-sync/utils/imageUtils";
import { performOCR } from "../../visual-clock-sync/services/ocrService";
import { formatMsToClockString, formatSecondsToMMSS } from "../../automatic-clock-mapping/utils/clockParser";
import { validateScanPoint } from "../../automatic-clock-mapping/utils/scanPointValidator";
import { OnTheFlySyncParams, OnTheFlySyncResult } from "../types";
import { ParseClockContext } from "../../automatic-clock-mapping/utils/clockParser";
import { ScanConfig, QuarterMarker } from "../../automatic-clock-mapping/types";

const DEFAULT_SCAN_CONFIG: ScanConfig = {
  coarseIntervalSeconds: 30,
  mediumIntervalSeconds: 5,
  fineIntervalSeconds: 1,
  minOCRConfidence: 70,
  stabilizationDelayMs: 500,
  maxRefinementAttempts: 3,
  allowedClockDeltaToleranceSec: 2,
};

/**
 * Service to execute 100% Local OCR on the fly when a user records a stat event.
 * Operates strictly in the background without blocking the UI thread.
 */
export async function executeOnTheFlyClockSync(
  params: OnTheFlySyncParams
): Promise<OnTheFlySyncResult> {
  const {
    event,
    videoTimeSeconds,
    recordedAtMs,
    videoEl: providedVideoEl,
    quarterMarker: providedQuarterMarker,
    currentGameState,
    clockRegion,
    altClockRegion,
    minConfidence = 70,
  } = params;

  const originalClockStr = event.gameClock || formatSecondsToMMSS(event.timestamp || 0);

  // 1. Locate video element
  let videoEl = providedVideoEl;
  if (!videoEl) {
    const videoTags = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
    videoEl = videoTags.find((v) => v.readyState >= 2) || videoTags[0] || null;
  }

  if (!videoEl || !clockRegion) {
    return {
      eventId: event.id,
      eventType: event.type,
      originalTimestamp: originalClockStr,
      adjustedTimestamp: originalClockStr,
      detectedGameClockMs: 0,
      confidence: 0,
      status: "SKIPPED",
      message: "Video element atau area crop jam belum disiapkan.",
      timeDeltaMs: 0,
    };
  }

  // 2. Build default QuarterMarker if not provided
  const currentQuarterNum = event.quarter || currentGameState?.currentQuarter || 1;
  const quarterMarker: QuarterMarker = providedQuarterMarker || {
    quarter: currentQuarterNum,
    videoStartSeconds: 0,
    videoEndSeconds: 3600,
    initialGameClockMs: 10 * 60 * 1000,
  };

  const parseContext: ParseClockContext = {
    quarterMarker,
    currentVideoTimeSeconds: videoTimeSeconds,
    isUnderOneMinuteContext:
      quarterMarker.videoEndSeconds - videoTimeSeconds <= 90 ||
      (currentGameState?.timeRemaining !== undefined && currentGameState.timeRemaining <= 60),
  };

  try {
    // 3. Capture cropped frame for Primary clock region
    const primaryCrop = captureAndCropFrame(videoEl, clockRegion);
    let ocrRes = await performOCR(primaryCrop.variantUrls, parseContext);

    // If primary OCR failed or low confidence, try Alt region if provided
    let winningCropUrl = primaryCrop.rawUrl;
    if ((!ocrRes.isValid || ocrRes.confidence < minConfidence) && altClockRegion) {
      const altCrop = captureAndCropFrame(videoEl, altClockRegion);
      const altOcrRes = await performOCR(altCrop.variantUrls, parseContext);
      if (altOcrRes.isValid && altOcrRes.confidence > ocrRes.confidence) {
        ocrRes = altOcrRes;
        winningCropUrl = altCrop.rawUrl;
      }
    }

    // 4. Validate OCR outcome
    const validation = validateScanPoint(
      ocrRes.milliseconds,
      ocrRes.confidence,
      quarterMarker,
      DEFAULT_SCAN_CONFIG,
      undefined,
      videoTimeSeconds
    );

    if (!ocrRes.isValid || ocrRes.milliseconds === null || !validation.isValid || ocrRes.confidence < minConfidence) {
      return {
        eventId: event.id,
        eventType: event.type,
        originalTimestamp: originalClockStr,
        adjustedTimestamp: originalClockStr,
        detectedGameClockMs: ocrRes.milliseconds || 0,
        confidence: ocrRes.confidence || 0,
        status: "LOW_CONFIDENCE",
        message: `OCR lokal menghasilkan akurasi rendah (${ocrRes.confidence}%) atau format jam tidak konsisten.`,
        timeDeltaMs: 0,
        cropUrl: winningCropUrl,
      };
    }

    const detectedGameClockMs = ocrRes.milliseconds;
    const adjustedTimestamp = formatMsToClockString(detectedGameClockMs);
    const originalClockMs = (event.timestamp || 0) * 1000;
    const timeDeltaMs = detectedGameClockMs - originalClockMs;

    // 5. Calculate live game clock adjustment if timer is currently running
    let adjustedLiveTimerSeconds: number | undefined = undefined;
    const isStoppageEvent = [
      "foul",
      "offensive_foul",
      "defensive_foul",
      "foul_drawn",
      "to",
      "timeout",
      "sub",
      "jumpball",
    ].includes(event.type);

    if (currentGameState?.isRunning && !isStoppageEvent) {
      const elapsedSinceRecordMs = Date.now() - recordedAtMs;
      const currentCalculatedLiveClockMs = Math.max(0, detectedGameClockMs - elapsedSinceRecordMs);
      adjustedLiveTimerSeconds = Math.max(0, Math.round(currentCalculatedLiveClockMs / 1000));
    }

    return {
      eventId: event.id,
      eventType: event.type,
      originalTimestamp: originalClockStr,
      adjustedTimestamp,
      detectedGameClockMs,
      adjustedLiveTimerSeconds,
      confidence: ocrRes.confidence,
      status: "SUCCESS",
      message: `Jam berhasil dikoreksi lokal dari ${originalClockStr} ke ${adjustedTimestamp} (Akurasi: ${ocrRes.confidence}%).`,
      timeDeltaMs,
      cropUrl: winningCropUrl,
    };
  } catch (err: any) {
    console.error("[OnTheFlyClockSync] Local OCR error:", err);
    return {
      eventId: event.id,
      eventType: event.type,
      originalTimestamp: originalClockStr,
      adjustedTimestamp: originalClockStr,
      detectedGameClockMs: 0,
      confidence: 0,
      status: "FAILED",
      message: err?.message || "Gagal melakukan OCR lokal pada frame jam.",
      timeDeltaMs: 0,
    };
  }
}

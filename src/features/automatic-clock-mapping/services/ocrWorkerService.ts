import { CapturedFrameItem } from "./captureQueueService";
import { performOCR } from "../../visual-clock-sync/services/ocrService";
import { validateScanPoint } from "../utils/scanPointValidator";
import { RawClockScanPoint, ScanConfig } from "../types";
import { parseYtTimeSeconds } from "../utils/clockParser";

/**
 * Tahap 2: Parallel Local OCR (CPU Bound)
 * Processes items from the capture queue in real-time while Tahap 1 is capturing.
 * Performs local Tesseract.js OCR, parses time text, and tags each point as
 * VALID, INVALID, or LOW_CONFIDENCE.
 */
export class OcrWorkerService {
  public async processCapturedItem(
    item: CapturedFrameItem,
    config: ScanConfig,
    previousValidPoint?: RawClockScanPoint
  ): Promise<RawClockScanPoint> {
    const parseContext = {
      ...item.parseContext,
      previousValidGameClockMs: previousValidPoint?.detectedGameClockMs,
    };

    const scanYtTimerTask = async () => {
      if (!item.ytTimerCrop) return null;
      try {
        const res = await performOCR(item.ytTimerCrop.variantUrls, parseContext);
        const parsedSeconds = parseYtTimeSeconds(res.rawText);
        return {
          crop: item.ytTimerCrop,
          rawText: res.rawText,
          parsedSeconds,
        };
      } catch (e) {
        return null;
      }
    };

    try {
      const ytTimer = await scanYtTimerTask();
      const ytTimerOcrSec = ytTimer?.parsedSeconds ?? null;

      const scanPrimaryTask = async () => {
        if (!item.primaryCrop) return null;
        try {
          const res = await performOCR(item.primaryCrop.variantUrls, parseContext);
          const val = validateScanPoint(
            res.milliseconds,
            res.confidence,
            item.quarterMarker,
            config,
            previousValidPoint,
            item.videoTimeSeconds,
            ytTimerOcrSec
          );
          return { crop: item.primaryCrop, res, val };
        } catch (e) {
          return null;
        }
      };

      const scanAltTask = async () => {
        if (!item.altCrop) return null;
        try {
          const res = await performOCR(item.altCrop.variantUrls, parseContext);
          const val = validateScanPoint(
            res.milliseconds,
            res.confidence,
            item.quarterMarker,
            config,
            previousValidPoint,
            item.videoTimeSeconds,
            ytTimerOcrSec
          );
          return { crop: item.altCrop, res, val };
        } catch (e) {
          return null;
        }
      };

      const [primary, alt] = await Promise.all([
        scanPrimaryTask(),
        scanAltTask(),
      ]);

      const primaryOcrValid = Boolean(primary && primary.res.milliseconds !== null);
      const altOcrValid = Boolean(alt && alt.res.milliseconds !== null);

      const primaryValValid = Boolean(primary && primary.val.isValid);
      const altValValid = Boolean(alt && alt.val.isValid);

      const primaryValid = primaryOcrValid && primaryValValid;
      const altValid = altOcrValid && altValValid;

      // Selection logic: prioritize the crop that yields a VALID game clock
      let winner = primary || alt;
      let winningRegion: "PRIMARY" | "ALT" = "PRIMARY";

      if (primaryValid && !altValid) {
        winner = primary!;
        winningRegion = "PRIMARY";
      } else if (altValid && !primaryValid) {
        winner = alt!;
        winningRegion = "ALT";
      } else if (primaryValid && altValid && primary && alt) {
        // Both are valid -> compare confidence & probability
        const primaryProb = primary.res.selectedCandidate?.probability || 0.5;
        const altProb = alt.res.selectedCandidate?.probability || 0.5;
        if (alt.res.confidence + altProb * 30 > primary.res.confidence + primaryProb * 30) {
          winner = alt;
          winningRegion = "ALT";
        } else {
          winner = primary;
          winningRegion = "PRIMARY";
        }
      } else if (primaryOcrValid && !altOcrValid && primary) {
        winner = primary;
        winningRegion = "PRIMARY";
      } else if (altOcrValid && !primaryOcrValid && alt) {
        winner = alt;
        winningRegion = "ALT";
      } else if (primaryOcrValid && altOcrValid && primary && alt) {
        const primaryProb = primary.res.selectedCandidate?.probability || 0.5;
        const altProb = alt.res.selectedCandidate?.probability || 0.5;
        if (alt.res.confidence + altProb * 30 > primary.res.confidence + primaryProb * 30) {
          winner = alt;
          winningRegion = "ALT";
        } else {
          winner = primary;
          winningRegion = "PRIMARY";
        }
      } else {
        // Neither region yielded a parsed clock -> default to PRIMARY crop
        winner = primary || alt;
        winningRegion = "PRIMARY";
      }

      if (!winner) {
        return {
          id: item.id,
          quarter: item.quarter,
          videoTimeSeconds: item.videoTimeSeconds,
          detectedGameClockMs: null,
          confidence: 0,
          rawOCRText: "",
          normalizedOCRText: null,
          scanIntervalSeconds: item.scanIntervalSeconds,
          status: "INVALID",
          rejectionReason: "No readable clock area or OCR output empty",
          rawCropUrl: item.primaryCrop?.rawUrl || item.altCrop?.rawUrl,
          processedCropUrl: item.primaryCrop?.processedUrl || item.altCrop?.processedUrl,
          primaryCropUrl: item.primaryCrop?.rawUrl,
          primaryProcessedUrl: item.primaryCrop?.processedUrl,
          altCropUrl: item.altCrop?.rawUrl,
          altProcessedUrl: item.altCrop?.processedUrl,
          ytTimerCropUrl: item.ytTimerCrop?.rawUrl,
          ytTimerProcessedUrl: item.ytTimerCrop?.processedUrl,
          ytTimerRawOCRText: ytTimer?.rawText || "",
          ytTimerOcrSeconds: ytTimer?.parsedSeconds ?? null,
          selectedRegionType: "PRIMARY",
          primaryRawOCRText: "",
          altRawOCRText: "",
          primaryGameClockMs: null,
          altGameClockMs: null,
        };
      }

      // Determine confidence status classification
      let finalStatus = winner.val.status;
      if (winner.res.confidence > 0 && winner.res.confidence < config.minOCRConfidence && finalStatus === "VALID") {
        finalStatus = "LOW_CONFIDENCE";
      }

      return {
        id: item.id,
        quarter: item.quarter,
        videoTimeSeconds: item.videoTimeSeconds,
        detectedGameClockMs: winner.res.milliseconds,
        confidence: winner.res.confidence,
        rawOCRText: winner.res.rawText,
        normalizedOCRText: winner.res.normalizedText,
        scanIntervalSeconds: item.scanIntervalSeconds,
        status: finalStatus,
        rejectionReason: winner.val.rejectionReason,
        rawCropUrl: winner.crop.rawUrl,
        processedCropUrl: winner.crop.processedUrl,
        primaryCropUrl: item.primaryCrop?.rawUrl,
        primaryProcessedUrl: item.primaryCrop?.processedUrl,
        altCropUrl: item.altCrop?.rawUrl,
        altProcessedUrl: item.altCrop?.processedUrl,
        ytTimerCropUrl: item.ytTimerCrop?.rawUrl,
        ytTimerProcessedUrl: item.ytTimerCrop?.processedUrl,
        ytTimerRawOCRText: ytTimer?.rawText || "",
        ytTimerOcrSeconds: ytTimer?.parsedSeconds ?? null,
        selectedRegionType: winningRegion,
        primaryRawOCRText: primary?.res?.rawText || "",
        altRawOCRText: alt?.res?.rawText || "",
        primaryGameClockMs: primary?.res?.milliseconds ?? null,
        altGameClockMs: alt?.res?.milliseconds ?? null,
        selectedCandidate: winner.res.selectedCandidate || null,
        formatState: winner.res.milliseconds != null && winner.res.milliseconds < 60000 ? "UNDER_ONE_MINUTE_DECIMAL" : "STANDARD_MINUTES_SECONDS",
      };
    } catch (err: any) {
      return {
        id: item.id,
        quarter: item.quarter,
        videoTimeSeconds: item.videoTimeSeconds,
        detectedGameClockMs: null,
        confidence: 0,
        rawOCRText: "",
        normalizedOCRText: null,
        scanIntervalSeconds: item.scanIntervalSeconds,
        status: "INVALID",
        rejectionReason: err?.message || "Local OCR processing failed",
        rawCropUrl: item.primaryCrop?.rawUrl || item.altCrop?.rawUrl,
        processedCropUrl: item.primaryCrop?.processedUrl || item.altCrop?.processedUrl,
        primaryCropUrl: item.primaryCrop?.rawUrl,
        primaryProcessedUrl: item.primaryCrop?.processedUrl,
        altCropUrl: item.altCrop?.rawUrl,
        altProcessedUrl: item.altCrop?.processedUrl,
        ytTimerCropUrl: item.ytTimerCrop?.rawUrl,
        ytTimerProcessedUrl: item.ytTimerCrop?.processedUrl,
        ytTimerRawOCRText: "",
        ytTimerOcrSeconds: null,
        selectedRegionType: "PRIMARY",
      };
    }
  }
}

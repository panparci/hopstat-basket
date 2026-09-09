import { captureAndCropFrame } from "../../visual-clock-sync/utils/imageUtils";
import { performOCR } from "../../visual-clock-sync/services/ocrService";
import { ClockOCRResult } from "../../visual-clock-sync/types";
import { NormalizedClockRegion, RawClockScanPoint, QuarterMarker, ScanConfig, ClockFormatState } from "../types";
import { validateScanPoint } from "../utils/scanPointValidator";
import { generateId } from "../../../core/utils/idUtils";
import { ParseClockContext } from "../utils/clockParser";

/**
 * Utility to capture video frame cropped by region and return Base64 image URL
 */
export function captureCroppedCanvasBase64(
  videoEl: HTMLVideoElement,
  region: NormalizedClockRegion
): string {
  const crop = captureAndCropFrame(videoEl, region);
  return crop.rawUrl;
}

/**
 * Service to capture a video frame, perform OCR on the clock region, and validate the result.
 */
export async function captureAndScanPoint(
  videoEl: HTMLVideoElement,
  region: NormalizedClockRegion,
  altRegion: NormalizedClockRegion | null | undefined,
  quarterMarker: QuarterMarker,
  videoTimeSeconds: number,
  scanIntervalSeconds: 30 | 5 | 1,
  config: ScanConfig,
  previousValidPoint?: RawClockScanPoint,
  formatState?: ClockFormatState
): Promise<RawClockScanPoint> {
  const pointId = generateId();

  const parseContext: ParseClockContext = {
    previousValidGameClockMs: previousValidPoint?.detectedGameClockMs,
    quarterMarker,
    currentVideoTimeSeconds: videoTimeSeconds,
    formatState,
    isUnderOneMinuteContext:
      (previousValidPoint?.detectedGameClockMs != null && previousValidPoint.detectedGameClockMs <= 120000) ||
      formatState === "UNDER_ONE_MINUTE_DECIMAL" ||
      quarterMarker.videoEndSeconds - videoTimeSeconds <= 90,
  };

  // Helper task for Primary scan
  const scanPrimaryTask = async () => {
    if (!region) return null;
    try {
      const crop = captureAndCropFrame(videoEl, region);
      const res = await performOCR(crop.variantUrls, parseContext);
      const val = validateScanPoint(
        res.milliseconds,
        res.confidence,
        quarterMarker,
        config,
        previousValidPoint,
        videoTimeSeconds
      );
      return { crop, res, val };
    } catch (e) {
      return null;
    }
  };

  // Helper task for Alt scan
  const scanAltTask = async () => {
    if (!altRegion) return null;
    try {
      const crop = captureAndCropFrame(videoEl, altRegion);
      const res = await performOCR(crop.variantUrls, parseContext);
      const val = validateScanPoint(
        res.milliseconds,
        res.confidence,
        quarterMarker,
        config,
        previousValidPoint,
        videoTimeSeconds
      );
      return { crop, res, val };
    } catch (e) {
      return null;
    }
  };

  try {
    // Run BOTH Primary and Alt OCR scans IN PARALLEL!
    const [primary, alt] = await Promise.all([scanPrimaryTask(), scanAltTask()]);

    const primaryOcrValid = Boolean(primary && primary.res.isValid && primary.res.milliseconds !== null);
    const altOcrValid = Boolean(alt && alt.res.isValid && alt.res.milliseconds !== null);

    const primaryValValid = Boolean(primary && primary.val.isValid);
    const altValValid = Boolean(alt && alt.val.isValid);

    const primaryValid = primaryOcrValid && primaryValValid;
    const altValid = altOcrValid && altValValid;

    // 1. Both fully valid -> Pick Alt if Alt confidence is close to or higher than Primary
    if (altValid && primaryValid && alt && primary) {
      const useAlt = alt.res.confidence >= primary.res.confidence - 5;
      const winner = useAlt ? alt : primary;
      return {
        id: pointId,
        quarter: quarterMarker.quarter,
        videoTimeSeconds,
        detectedGameClockMs: winner.res.milliseconds,
        confidence: winner.res.confidence,
        rawOCRText: winner.res.rawText,
        normalizedOCRText: winner.res.normalizedText,
        scanIntervalSeconds,
        status: winner.val.status,
        rejectionReason: winner.val.rejectionReason,
        rawCropUrl: winner.crop.rawUrl,
        processedCropUrl: winner.crop.processedUrl,
        formatState: winner.res.milliseconds! < 60000 ? "UNDER_ONE_MINUTE_DECIMAL" : formatState,
      };
    }

    // 2. Only Alt is fully valid -> Pick Alt
    if (altValid && alt) {
      return {
        id: pointId,
        quarter: quarterMarker.quarter,
        videoTimeSeconds,
        detectedGameClockMs: alt.res.milliseconds,
        confidence: alt.res.confidence,
        rawOCRText: alt.res.rawText,
        normalizedOCRText: alt.res.normalizedText,
        scanIntervalSeconds,
        status: alt.val.status,
        rejectionReason: alt.val.rejectionReason,
        rawCropUrl: alt.crop.rawUrl,
        processedCropUrl: alt.crop.processedUrl,
        formatState: alt.res.milliseconds! < 60000 ? "UNDER_ONE_MINUTE_DECIMAL" : formatState,
      };
    }

    // 3. Only Primary is fully valid -> Pick Primary
    if (primaryValid && primary) {
      return {
        id: pointId,
        quarter: quarterMarker.quarter,
        videoTimeSeconds,
        detectedGameClockMs: primary.res.milliseconds,
        confidence: primary.res.confidence,
        rawOCRText: primary.res.rawText,
        normalizedOCRText: primary.res.normalizedText,
        scanIntervalSeconds,
        status: primary.val.status,
        rejectionReason: primary.val.rejectionReason,
        rawCropUrl: primary.crop.rawUrl,
        processedCropUrl: primary.crop.processedUrl,
        formatState: primary.res.milliseconds! < 60000 ? "UNDER_ONE_MINUTE_DECIMAL" : formatState,
      };
    }

    // 4. One has OCR valid result while the other does not -> Pick the one with OCR valid result
    if (altOcrValid && !primaryOcrValid && alt) {
      return {
        id: pointId,
        quarter: quarterMarker.quarter,
        videoTimeSeconds,
        detectedGameClockMs: alt.res.milliseconds,
        confidence: alt.res.confidence,
        rawOCRText: alt.res.rawText,
        normalizedOCRText: alt.res.normalizedText,
        scanIntervalSeconds,
        status: alt.val.status,
        rejectionReason: alt.val.rejectionReason,
        rawCropUrl: alt.crop.rawUrl,
        processedCropUrl: alt.crop.processedUrl,
        formatState: alt.res.milliseconds! < 60000 ? "UNDER_ONE_MINUTE_DECIMAL" : formatState,
      };
    }

    if (primaryOcrValid && !altOcrValid && primary) {
      return {
        id: pointId,
        quarter: quarterMarker.quarter,
        videoTimeSeconds,
        detectedGameClockMs: primary.res.milliseconds,
        confidence: primary.res.confidence,
        rawOCRText: primary.res.rawText,
        normalizedOCRText: primary.res.normalizedText,
        scanIntervalSeconds,
        status: primary.val.status,
        rejectionReason: primary.val.rejectionReason,
        rawCropUrl: primary.crop.rawUrl,
        processedCropUrl: primary.crop.processedUrl,
        formatState: primary.res.milliseconds! < 60000 ? "UNDER_ONE_MINUTE_DECIMAL" : formatState,
      };
    }

    // 5. Fallback when BOTH are INVALID or unreadable:
    if (
      alt &&
      (!primary || alt.res.confidence > primary.res.confidence || (!primary.res.rawText && Boolean(alt.res.rawText)))
    ) {
      return {
        id: pointId,
        quarter: quarterMarker.quarter,
        videoTimeSeconds,
        detectedGameClockMs: alt.res.milliseconds,
        confidence: alt.res.confidence,
        rawOCRText: alt.res.rawText,
        normalizedOCRText: alt.res.normalizedText,
        scanIntervalSeconds,
        status: alt.val.status,
        rejectionReason: alt.val.rejectionReason,
        rawCropUrl: alt.crop.rawUrl,
        processedCropUrl: alt.crop.processedUrl,
        formatState: alt.res.milliseconds != null && alt.res.milliseconds < 60000 ? "UNDER_ONE_MINUTE_DECIMAL" : formatState,
      };
    }

    if (primary) {
      return {
        id: pointId,
        quarter: quarterMarker.quarter,
        videoTimeSeconds,
        detectedGameClockMs: primary.res.milliseconds,
        confidence: primary.res.confidence,
        rawOCRText: primary.res.rawText,
        normalizedOCRText: primary.res.normalizedText,
        scanIntervalSeconds,
        status: primary.val.status,
        rejectionReason: primary.val.rejectionReason,
        rawCropUrl: primary.crop.rawUrl,
        processedCropUrl: primary.crop.processedUrl,
        formatState: primary.res.milliseconds != null && primary.res.milliseconds < 60000 ? "UNDER_ONE_MINUTE_DECIMAL" : formatState,
      };
    }

    throw new Error("No readable clock region available");
  } catch (err: any) {
    return {
      id: pointId,
      quarter: quarterMarker.quarter,
      videoTimeSeconds,
      detectedGameClockMs: null,
      confidence: 0,
      rawOCRText: "",
      normalizedOCRText: null,
      scanIntervalSeconds,
      status: "INVALID",
      rejectionReason: err?.message || "Frame capture error",
      formatState,
    };
  }
}

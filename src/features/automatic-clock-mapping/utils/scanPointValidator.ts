import { RawClockScanPoint, QuarterMarker, ScanConfig, ScanPointStatus } from "../types";
import { formatSecondsToMMSS } from "./clockParser";

export type ValidationResult = {
  isValid: boolean;
  status: ScanPointStatus;
  rejectionReason?: string;
};

/**
 * Validates a single raw scan point against basketball clock limits and expected values.
 */
export function validateScanPoint(
  detectedMs: number | null,
  confidence: number,
  quarterMarker: QuarterMarker,
  config: ScanConfig,
  previousValidPoint?: RawClockScanPoint,
  currentVideoTimeSeconds?: number,
  ytTimerOcrSeconds?: number | null
): ValidationResult {
  if (detectedMs === null) {
    return {
      isValid: false,
      status: "INVALID",
      rejectionReason: "No readable clock digits detected (ad, timeout, or missing clock overlay)",
    };
  }

  // YT Timer Cross-Check Rule: If the YouTube player timer OCR is detected, verify it matches currentVideoTimeSeconds
  if (ytTimerOcrSeconds !== null && ytTimerOcrSeconds !== undefined && currentVideoTimeSeconds !== undefined) {
    const ytTimerDelta = Math.abs(ytTimerOcrSeconds - currentVideoTimeSeconds);
    if (ytTimerDelta > 30) {
      return {
        isValid: false,
        status: "INVALID",
        rejectionReason: `Frame video belum siap/lagging: OCR Timer YT (${formatSecondsToMMSS(ytTimerOcrSeconds)}) terpaut jauh dari target video (${formatSecondsToMMSS(currentVideoTimeSeconds)})`,
      };
    }
  }

  // Rule 1: Confidence threshold
  if (confidence < config.minOCRConfidence) {
    return {
      isValid: false,
      status: "LOW_CONFIDENCE",
      rejectionReason: `OCR confidence (${Math.round(confidence)}%) is below threshold (${config.minOCRConfidence}%)`,
    };
  }

  // Rule 2: Cannot exceed initial quarter duration
  if (detectedMs > quarterMarker.initialGameClockMs + 2000) {
    return {
      isValid: false,
      status: "INVALID",
      rejectionReason: "Detected clock exceeds quarter duration limit",
    };
  }

  // Rule 3: Cannot be negative
  if (detectedMs < 0) {
    return {
      isValid: false,
      status: "INVALID",
      rejectionReason: "Negative clock value detected",
    };
  }

  // Check against previous valid point if available
  if (previousValidPoint && previousValidPoint.detectedGameClockMs !== null) {
    const prevMs = previousValidPoint.detectedGameClockMs;
    const videoDeltaSec = currentVideoTimeSeconds !== undefined 
      ? Math.max(0, currentVideoTimeSeconds - previousValidPoint.videoTimeSeconds)
      : 0;

    // Clock increase within same quarter (unexpected countdown reversal)
    if (detectedMs > prevMs + 5000) {
      return {
        isValid: false,
        status: "POSSIBLE_REPLAY",
        rejectionReason: "Game clock increased unexpectedly (possible replay footage or ad overlay)",
      };
    }

    // Clock decreased faster than elapsed video time + tolerance
    const clockDecreaseSec = (prevMs - detectedMs) / 1000;
    const maxAllowedDecrease = videoDeltaSec + config.allowedClockDeltaToleranceSec + 5;
    if (clockDecreaseSec > maxAllowedDecrease && videoDeltaSec > 0) {
      return {
        isValid: false,
        status: "INVALID",
        rejectionReason: "Game clock decreased faster than elapsed video time",
      };
    }
  }

  return {
    isValid: true,
    status: "VALID",
  };
}

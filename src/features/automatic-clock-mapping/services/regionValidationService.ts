import { RawClockScanPoint } from "../types";

export interface RegionValidationResult {
  shouldAbort: boolean;
  validCount: number;
  totalSamples: number;
  validRatioPercent: number;
  message?: string;
}

/**
 * Tahap 3: Region Validation & Early Abort (Fail-Fast Mechanism)
 * Prevents wasting time and AI quota if user selected an incorrect clock crop region.
 *
 * Rule: As soon as Coarse Scan (30s) finishes local OCR, calculate valid ratio.
 * If total VALID points < 10% of total samples (e.g. out of 120 samples, < 12 valid),
 * immediately ABORT the scan process with a clear warning message.
 */
export class RegionValidationService {
  public static evaluateCoarseScanRatio(
    points: RawClockScanPoint[],
    minSuccessThresholdRatio: number = 0.10 // 10% threshold
  ): RegionValidationResult {
    const totalSamples = points.length;
    if (totalSamples === 0) {
      return {
        shouldAbort: true,
        validCount: 0,
        totalSamples: 0,
        validRatioPercent: 0,
        message: "Proses dihentikan. Tidak ada sampel gambar jam yang dapat diambil.",
      };
    }

    const validCount = points.filter(
      (p) => p.status === "VALID" && p.detectedGameClockMs !== null
    ).length;

    const validRatio = validCount / totalSamples;
    const validRatioPercent = Math.round(validRatio * 100);

    if (validRatio < minSuccessThresholdRatio) {
      const msg = `Proses dihentikan. Hampir semua deteksi gagal (Tingkat keberhasilan < 10%, hanya ${validCount} dari ${totalSamples} sampel terbaca sebagai jam). Sepertinya region yang Anda pilih salah atau jam tidak terlihat di area tersebut. Silakan atur ulang region jam.`;
      return {
        shouldAbort: true,
        validCount,
        totalSamples,
        validRatioPercent,
        message: msg,
      };
    }

    return {
      shouldAbort: false,
      validCount,
      totalSamples,
      validRatioPercent,
    };
  }
}

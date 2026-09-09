import { RawClockScanPoint } from "../types";
import { parseClockWithContext } from "../utils/clockParser";

export interface AIBatchOCRResultItem {
  id: string;
  gameClockText: string | null;
  isBlocked: boolean;
  confidence: number;
}

/**
 * Tahap 4: AI Fallback & Recovery (Network Bound)
 * Uses AI (Gemini Vision) smartly and cost-effectively to fix blurry/failed data.
 * Collects points with status INVALID or LOW_CONFIDENCE, batches them (5-10 images),
 * and calls the server API route /api/gemini/batch-ocr.
 */
export class AIFallbackService {
  public static async executeBatchAIRecovery(
    points: RawClockScanPoint[],
    batchSize: number = 8,
    onProgressUpdate?: (recoveredCount: number, totalFailed: number) => void
  ): Promise<{ updatedPoints: RawClockScanPoint[]; recoveredCount: number }> {
    // 1. Filter INVALID or LOW_CONFIDENCE points that have image crop URLs
    const failedPoints = points.filter(
      (p) => (p.status === "INVALID" || p.status === "LOW_CONFIDENCE") && Boolean(p.rawCropUrl || p.processedCropUrl)
    );

    if (failedPoints.length === 0) {
      return { updatedPoints: points, recoveredCount: 0 };
    }

    const pointsMap = new Map<string, RawClockScanPoint>(points.map((p) => [p.id, p]));
    let totalRecovered = 0;

    // 2. Process in batches
    for (let i = 0; i < failedPoints.length; i += batchSize) {
      const batch = failedPoints.slice(i, i + batchSize);

      const itemsPayload = batch.map((p) => ({
        id: p.id,
        videoTimeSeconds: p.videoTimeSeconds,
        base64Image: p.processedCropUrl || p.rawCropUrl || "",
      }));

      try {
        const response = await fetch("/api/gemini/batch-ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: itemsPayload }),
        });

        if (!response.ok) {
          throw new Error(`Batch OCR API returned status ${response.status}`);
        }

        const data = await response.json();
        const results: AIBatchOCRResultItem[] = data.results || [];

        for (const resItem of results) {
          const originalPt = pointsMap.get(resItem.id);
          if (!originalPt) continue;

          if (!resItem.isBlocked && resItem.gameClockText && resItem.gameClockText !== "BLOCKED") {
            const parsed = parseClockWithContext(resItem.gameClockText, {
              quarterMarker: {
                quarter: originalPt.quarter,
                videoStartSeconds: 0,
                videoEndSeconds: 3600,
                initialGameClockMs: 600000,
              },
              currentVideoTimeSeconds: originalPt.videoTimeSeconds,
            });

            if (parsed.gameClockMs !== null) {
              const updatedPt: RawClockScanPoint = {
                ...originalPt,
                detectedGameClockMs: parsed.gameClockMs,
                normalizedOCRText: parsed.normalizedText,
                rawOCRText: `[AI Gemini] ${resItem.gameClockText}`,
                confidence: Math.max(originalPt.confidence, 88),
                status: "VALID",
                rejectionReason: undefined,
              };
              pointsMap.set(originalPt.id, updatedPt);
              totalRecovered++;
            }
          }
        }
      } catch (err) {
        console.warn("AI Fallback batch recovery attempt error:", err);
      }

      if (onProgressUpdate) {
        onProgressUpdate(totalRecovered, failedPoints.length);
      }
    }

    const updatedPoints = Array.from(pointsMap.values()).sort(
      (a, b) => a.quarter - b.quarter || a.videoTimeSeconds - b.videoTimeSeconds
    );

    return { updatedPoints, recoveredCount: totalRecovered };
  }
}

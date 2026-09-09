import { RawClockScanPoint } from "../types";

export type LinearFitResult = {
  slope: number;       // d(GameClockSeconds) / d(VideoTimeSeconds)
  intercept: number;   // GameClockSeconds at t_video = 0
  rSquared: number;
  standardError: number;
};

/**
  Fits a linear model y = slope * x + intercept using Ordinary Least Squares (OLS)
  where x = videoTimeSeconds, y = gameClockSeconds.
 */
export function fitLinearRegression(
  points: { x: number; y: number }[]
): LinearFitResult | null {
  if (points.length < 2) return null;

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-9) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared and Standard Error
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;

  for (const p of points) {
    const yHat = slope * p.x + intercept;
    ssTot += Math.pow(p.y - meanY, 2);
    ssRes += Math.pow(p.y - yHat, 2);
  }

  const rSquared = ssTot > 1e-9 ? Math.max(0, 1 - ssRes / ssTot) : 1;
  const standardError = Math.sqrt(ssRes / Math.max(1, n - 2));

  return { slope, intercept, rSquared, standardError };
}

/**
 * Filter statistical outliers using a moving window linear regression model.
 * Rejects points where local residual error exceeds 3*sigma or slope is physically impossible.
 */
export function detectAndFilterOutliers(
  points: RawClockScanPoint[],
  maxResidualSec: number = 3.5
): RawClockScanPoint[] {
  if (points.length < 3) return points;

  const sorted = [...points].sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);
  const validPoints = sorted.filter(
    (p) => p.status === "VALID" && p.detectedGameClockMs !== null
  );

  if (validPoints.length < 3) return points;

  const outlierIds = new Set<string>();

  // Moving window of size 5
  const windowSize = 5;
  for (let i = 0; i <= validPoints.length - windowSize; i++) {
    const window = validPoints.slice(i, i + windowSize);
    const xyData = window.map((p) => ({
      x: p.videoTimeSeconds,
      y: p.detectedGameClockMs! / 1000,
    }));

    const fit = fitLinearRegression(xyData);
    if (!fit) continue;

    // Check each point in window for extreme residual deviation
    for (let j = 0; j < window.length; j++) {
      const p = window[j];
      const yHat = fit.slope * p.videoTimeSeconds + fit.intercept;
      const residual = Math.abs(p.detectedGameClockMs! / 1000 - yHat);

      // In basketball, slope should be between -1.1 (running clock) and 0.05 (stopped clock)
      const slopeViolation = fit.slope < -1.25 || fit.slope > 0.15;

      if (residual > maxResidualSec && (slopeViolation || fit.standardError > 2.0)) {
        outlierIds.add(p.id);
      }
    }
  }

  return sorted.map((p) => {
    if (outlierIds.has(p.id)) {
      return {
        ...p,
        status: "LOW_CONFIDENCE" as const,
        rejectionReason: `Statistical outlier detected by linear regression model (residual deviation)`,
        confidence: Math.min(p.confidence, 40),
      };
    }
    return p;
  });
}

/**
 * Predicts sub-second stop/resume transition video timestamp for a mixed interval
 * using dual piecewise slope estimation.
 * 
 * Game clock rate = 1s per 1s video when running, 0s per 1s video when stopped.
 */
export function calculateSubsecondStoppageTransition(
  startVideoTime: number,
  endVideoTime: number,
  startGameClockMs: number,
  endGameClockMs: number,
  previousClockState: "RUNNING" | "STOPPED" | "UNKNOWN" = "RUNNING"
): { transitionVideoTime: number; transitionGameClockMs: number } {
  const videoDelta = endVideoTime - startVideoTime;
  const clockDecreaseSec = (startGameClockMs - endGameClockMs) / 1000;

  // Clamp run seconds to bounds
  const runSeconds = Math.max(0, Math.min(videoDelta, clockDecreaseSec));

  if (previousClockState === "STOPPED") {
    // Clock was stopped initially, then resumed
    const transitionVideoTime = endVideoTime - runSeconds;
    const transitionGameClockMs = startGameClockMs; // stayed constant until transition
    return { transitionVideoTime, transitionGameClockMs };
  } else {
    // Clock ran initially, then stopped
    const transitionVideoTime = startVideoTime + runSeconds;
    const transitionGameClockMs = startGameClockMs - runSeconds * 1000;
    return { transitionVideoTime, transitionGameClockMs };
  }
}

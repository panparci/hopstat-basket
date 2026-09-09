import { NormalizedClockRegion } from "../types";

/**
 * Validates a normalized region.
 */
export function validateNormalizedRegion(region: NormalizedClockRegion | null): boolean {
  if (!region) return false;
  return (
    region.xRatio >= 0 &&
    region.yRatio >= 0 &&
    region.widthRatio > 0 &&
    region.heightRatio > 0 &&
    region.xRatio + region.widthRatio <= 1.05 &&
    region.yRatio + region.heightRatio <= 1.05
  );
}

/**
 * Converts screen/pixel coordinates into normalized ratios based on total width/height.
 */
export function pixelsToNormalized(
  x: number,
  y: number,
  w: number,
  h: number,
  totalW: number,
  totalH: number
): NormalizedClockRegion {
  return {
    xRatio: Math.max(0, x / totalW),
    yRatio: Math.max(0, y / totalH),
    widthRatio: Math.min(1, w / totalW),
    heightRatio: Math.min(1, h / totalH),
  };
}

/**
 * Utility functions for basketball court coordinate mapping and area detection.
 * Court dimensions assumed: 15m (width) x 14m (half-court length)
 */

export const getShotAreaName = (x: number, y: number): string => {
  // Convert 0-100 percentages to meters
  // x: 0 (left) to 100 (right) -> 0 to 15m
  // y: 0 (top/backcourt) to 100 (bottom/baseline) -> 0 to 14m
  // Note: In our BasketballCourt.tsx, y=100 is baseline, y=0 is half-court line
  const x_m = (x / 100) * 15;
  const y_m = ((100 - y) / 100) * 14; // Distance from baseline

  const hx = 7.5; // Hoop X center
  const hy = 1.575; // Hoop Y distance from baseline

  // 1. Check for 3PT vs 2PT
  let isThreePoint = false;
  if (x_m < 0.9 || x_m > 14.1) {
    // Corner 3 area
    if (y_m <= 2.99) {
      isThreePoint = true;
    }
  }
  
  const distanceToHoop = Math.sqrt(Math.pow(x_m - hx, 2) + Math.pow(y_m - hy, 2));
  if (distanceToHoop > 6.75) {
    isThreePoint = true;
  }

  // 2. Determine Specific Area
  if (isThreePoint) {
    if (y_m <= 2.99) {
      if (x_m < 7.5) return "Left Corner 3";
      return "Right Corner 3";
    }
    
    // Angle from hoop center
    const angle = Math.atan2(y_m - hy, x_m - hx) * (180 / Math.PI);
    
    if (angle > 150 || angle < -150) return "Left Wing 3";
    if (angle < 30 && angle > -30) return "Right Wing 3";
    return "Top of Key 3";
  } else {
    // 2PT Areas
    if (distanceToHoop < 2.5) {
      if (Math.abs(x_m - 7.5) < 2.5 && y_m < 5.8) return "Restricted Area / Rim";
      return "Paint / Low Post";
    }
    
    if (Math.abs(x_m - 7.5) < 2.5 && y_m < 5.8) return "Paint / Key";
    
    if (x_m < 7.5) {
      if (y_m < 5) return "Left Short Corner";
      return "Left Mid-Range";
    } else {
      if (y_m < 5) return "Right Short Corner";
      return "Right Mid-Range";
    }
  }
};

export const getShotGranularity = (x: number, y: number): string => {
  return `(${x.toFixed(2)}%, ${y.toFixed(2)}%)`;
};

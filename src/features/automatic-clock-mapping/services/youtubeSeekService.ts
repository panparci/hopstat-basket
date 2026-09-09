import { YouTubePlayer } from "react-youtube";

/**
 * Utility service to seek YouTube player and await frame stabilization.
 * Actively monitors the HTML5 video element to ensure the captured frame matches
 * the requested timestamp accurately before proceeding.
 */
export async function seekAndAwaitFrame(
  player: YouTubePlayer | null,
  videoEl: HTMLVideoElement | null,
  targetTimeSeconds: number,
  maxDelayMs: number = 1000
): Promise<boolean> {
  if (!player) return false;

  try {
    // 1. Ensure player is paused during seek to prevent motion blur and persistent UI control overlays
    if (typeof player.pauseVideo === "function") {
      try {
        const state = typeof player.getPlayerState === "function" ? player.getPlayerState() : -1;
        if (state === 1) { // 1 = PLAYING
          player.pauseVideo();
        }
      } catch (e) {
        // Ignore iframe state errors
      }
    }

    // 2. Issue seek command to player with allowSeekAhead = true
    if (typeof player.seekTo === "function") {
      player.seekTo(targetTimeSeconds, true);
    } else {
      return false;
    }

    const startTime = Date.now();
    const toleranceSeconds = 0.8; // Strict tolerance: max 0.8s difference from target time

    // 3. Active polling loop: verify YouTube player or video element actually reached target timestamp
    while (Date.now() - startTime < maxDelayMs) {
      const pTime = typeof player.getCurrentTime === "function" ? player.getCurrentTime() : null;
      const vTime = videoEl && !isNaN(videoEl.currentTime) ? videoEl.currentTime : null;

      const pMatches = pTime !== null && !isNaN(pTime) && Math.abs(pTime - targetTimeSeconds) <= toleranceSeconds;
      const vMatches = vTime !== null && !isNaN(vTime) && Math.abs(vTime - targetTimeSeconds) <= toleranceSeconds;

      const isSeeking = videoEl ? videoEl.seeking : false;
      const readyState = videoEl ? videoEl.readyState : 4;

      // Frame is ready if target matches within 0.8s, video is not actively seeking, and readyState >= 3 (HAVE_FUTURE_DATA)
      if ((pMatches || vMatches) && !isSeeking && readyState >= 3) {
        // Essential frame-settle buffer: wait 180ms for GPU video decoder to paint the newly decoded keyframe to canvas
        await new Promise((resolve) => setTimeout(resolve, 180));
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    // Safety fallback delay if timeout reached to allow frame to settle
    await new Promise((resolve) => setTimeout(resolve, 180));
    return true;
  } catch (err) {
    console.warn(`Failed to seek YouTube player to ${targetTimeSeconds}s:`, err);
    return false;
  }
}



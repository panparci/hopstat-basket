import type { VisualClockSyncStatus } from "../types";

/** Screen-capture stream is live enough to calibrate / OCR. ERROR is offline — reconnect first. */
export function isCaptureActive(status: VisualClockSyncStatus): boolean {
  return status !== "IDLE" && status !== "CAPTURE_ENDED" && status !== "ERROR";
}

/** User-facing badge for setup modal — not a WebSocket; this is getDisplayMedia. */
export function captureStatusLabel(status: VisualClockSyncStatus): string {
  switch (status) {
    case "READY":
      return "Ready to Sync";
    case "SCANNING":
      return "Scanning...";
    case "CAPTURE_ACTIVE":
      return "Needs Calibration";
    case "REQUESTING_CAPTURE":
      return "Connecting...";
    case "CAPTURE_ENDED":
      return "Capture Stopped";
    case "ERROR":
      return "Capture Failed";
    case "CALIBRATING":
      return "Calibrating...";
    case "REVIEWING_RESULT":
      return "Review Result";
    default:
      return "Not Connected";
  }
}

/** True inside HoopStat WebView / app shell where getDisplayMedia is blocked. */
export function isEmbeddedAppShell(
  ua = typeof navigator !== "undefined" ? navigator.userAgent : "",
  hasRNWebView = typeof window !== "undefined" && !!(window as { ReactNativeWebView?: unknown }).ReactNativeWebView,
  shellFlag = typeof localStorage !== "undefined" ? localStorage.getItem("hoopstat_app_shell") === "1" : false,
): boolean {
  return hasRNWebView || ua.includes("HoopStatApp") || shellFlag;
}

/** Prefer opening system browser for clock sync when in-app capture cannot work. */
export function shouldOpenExternalForCapture(embedded: boolean, displayMediaOk: boolean): boolean {
  return embedded || !displayMediaOk;
}

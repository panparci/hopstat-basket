import React from "react";
import { 
  X, Camera, Crop, Sliders, CheckCircle2, ShieldAlert, ExternalLink, 
  Play, Zap, History, Trash2, Layers
} from "lucide-react";
import { NormalizedClockRegion, ClockSyncPoint, VisualClockSyncStatus } from "../types";
import { captureStatusLabel, isCaptureActive } from "../lib/captureStatus";

interface ClockSyncSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: VisualClockSyncStatus;
  permissionBlocked: boolean;
  region: NormalizedClockRegion | null;
  altRegion: NormalizedClockRegion | null;
  lastSyncPoint: ClockSyncPoint | null;
  enableCapture: () => void;
  startCalibration: (type: "primary" | "alternative") => void;
  onClearAltRegion: () => void;
  scanClockAndReview: () => void;
  expressMode: boolean;
  onToggleExpressMode: (val: boolean) => void;
  onTheFlyEnabled?: boolean;
  onToggleOnTheFly?: (val?: boolean) => void;
  formatTime: (seconds: number) => string;
}

export const ClockSyncSetupModal: React.FC<ClockSyncSetupModalProps> = ({
  isOpen,
  onClose,
  status,
  permissionBlocked,
  region,
  altRegion,
  lastSyncPoint,
  enableCapture,
  startCalibration,
  onClearAltRegion,
  scanClockAndReview,
  expressMode,
  onToggleExpressMode,
  onTheFlyEnabled = false,
  onToggleOnTheFly,
  formatTime,
}) => {
  if (!isOpen) return null;

  const isCaptureOn = isCaptureActive(status);
  const hasPrimaryRegion = Boolean(region);
  const isOnTheFlyEligible = isCaptureOn && hasPrimaryRegion;

  const badgeBg =
    status === "READY"
      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
      : status === "SCANNING" || status === "REQUESTING_CAPTURE"
        ? "bg-amber-500/20 text-amber-500 border-amber-500/30 animate-pulse"
        : status === "CAPTURE_ACTIVE"
          ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
          : status === "CAPTURE_ENDED" || status === "ERROR"
            ? "bg-red-500/10 text-red-400 border-red-500/30"
            : "bg-zinc-800 text-zinc-400 border-zinc-700";
  const badge = { label: captureStatusLabel(status), bg: badgeBg };

  const handleCalibrateClick = (type: "primary" | "alternative") => {
    onClose(); // Close setup modal so calibration modal can be seen cleanly!
    startCalibration(type);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="text-lg font-display font-black italic uppercase leading-none text-zinc-900 dark:text-white">
                VISUAL CLOCK SYNC SETUP
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">
                Configure screen capture stream & primary/alternative clock regions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 dark:text-zinc-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[75vh]">
          
          {/* Permission Block Warning */}
          {(permissionBlocked || status === "ERROR") && (
            <div className="p-4 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 rounded-2xl flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5 text-amber-600 dark:text-amber-400">
                <ShieldAlert className="shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="font-extrabold uppercase text-xs">
                    {permissionBlocked ? "Screen Capture Blocked Here" : "Capture Failed — Reconnect"}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                    {permissionBlocked
                      ? "Ini bukan WebSocket. Clock Sync pakai screen capture browser — di app/WebView biasanya diblokir. Buka tracking di browser, lalu Enable Screen Capture."
                      : "Izinkan share tab/jendela saat diminta, atau buka di browser jika kamu di dalam app."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const rn = (window as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView;
                  if (rn?.postMessage) {
                    rn.postMessage(JSON.stringify({ type: "open-external", url: window.location.href }));
                    return;
                  }
                  window.open(window.location.href, "_blank", "noopener,noreferrer");
                }}
                className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <ExternalLink size={14} />
                Buka di Browser
              </button>
            </div>
          )}

          {/* Section 1: Capture Stream Connection */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <Camera size={16} className="text-amber-500" />
                1. Screen Capture Stream
              </span>
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                {badge.label}
              </span>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select the browser tab or window where your video player or live scoreboard stream is playing.
            </p>

            <button
              onClick={enableCapture}
              className={`w-full py-2.5 px-4 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 ${
                isCaptureOn 
                  ? "bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-100" 
                  : "bg-amber-500 hover:bg-amber-600 text-white"
              }`}
            >
              <Camera size={16} />
              {isCaptureOn ? "Re-connect Screen Capture" : "Enable Screen Capture"}
            </button>
          </div>

          {/* Section 2: Primary Calibration Region */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <Crop size={16} className="text-amber-500" />
                2. Primary Scoreboard Region
              </span>
              <span className={`text-[10px] font-bold ${region ? "text-emerald-500" : "text-zinc-400"}`}>
                {region ? "Configured ✓" : "Not Calibrated"}
              </span>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Main position of the game clock on the main broadcast scoreboard overlay.
            </p>

            <button
              type="button"
              onClick={() => {
                if (!isCaptureOn) {
                  enableCapture();
                  return;
                }
                handleCalibrateClick("primary");
              }}
              className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Crop size={16} className="text-amber-400" />
              {!isCaptureOn
                ? "Reconnect Capture dulu"
                : region
                  ? "Calibrate / Edit Primary Region"
                  : "Calibrate Primary Region"}
            </button>
          </div>

          {/* Section 3: Alternative Calibration Region (Fallback/Broadcast Shift) */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <Layers size={16} className="text-amber-500" />
                3. Alternative Clock Region (Optional)
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold ${altRegion ? "text-emerald-500" : "text-zinc-400"}`}>
                  {altRegion ? "Active ✓" : "None"}
                </span>
                {altRegion && (
                  <button
                    onClick={onClearAltRegion}
                    className="text-[10px] text-rose-500 hover:text-rose-600 font-bold flex items-center gap-0.5"
                    title="Remove alternative region"
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Secondary clock location if the broadcast changes clock positions during late-game or zoomed views. OCR will check both and auto-select the highest accuracy match!
            </p>

            <button
              type="button"
              onClick={() => {
                if (!isCaptureOn) {
                  enableCapture();
                  return;
                }
                handleCalibrateClick("alternative");
              }}
              className="w-full py-2.5 px-4 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Layers size={16} className="text-amber-500" />
              {!isCaptureOn
                ? "Reconnect Capture dulu"
                : altRegion
                  ? "Calibrate / Edit Alternative Region"
                  : "+ Add Alternative Clock Region"}
            </button>
          </div>

          {/* Section 4: Express Sync Settings */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                <Zap size={15} className="text-amber-500" />
                Express One-Click Sync
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                Automatically sync game clock without confirmation popup when OCR detects valid digits.
              </p>
            </div>

            <button
              onClick={() => onToggleExpressMode(!expressMode)}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                expressMode ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-700"
              }`}
            >
              <div 
                className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                  expressMode ? "translate-x-6" : "translate-x-0"
                }`} 
              />
            </button>
          </div>

          {/* Section 5: On-The-Fly OCR Mode (Requires Screen Capture + Primary Region) */}
          {onToggleOnTheFly && (
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                    <Zap size={15} className="text-amber-500 fill-amber-500 animate-pulse" />
                    On-The-Fly OCR Auto Sync
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                    Secara otomatis mencocokkan jam event saat statistik dicatat menggunakan OCR lokal di latar belakang.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!isOnTheFlyEligible}
                  onClick={() => {
                    if (isOnTheFlyEligible) {
                      onToggleOnTheFly(!onTheFlyEnabled);
                    }
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                    !isOnTheFlyEligible
                      ? "bg-zinc-200 dark:bg-zinc-800 opacity-50 cursor-not-allowed"
                      : onTheFlyEnabled
                      ? "bg-amber-500"
                      : "bg-zinc-300 dark:bg-zinc-700 cursor-pointer"
                  }`}
                  title={
                    !isOnTheFlyEligible
                      ? "Membutuhkan Screen Capture aktif & Primary Region terkalibrasi"
                      : onTheFlyEnabled
                      ? "Matikan On-The-Fly OCR"
                      : "Nyalakan On-The-Fly OCR"
                  }
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                      onTheFlyEnabled && isOnTheFlyEligible ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Requirement Validation Status */}
              <div className="p-2.5 bg-zinc-100 dark:bg-zinc-900/60 rounded-xl flex flex-col gap-1.5 text-[11px]">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Syarat On-The-Fly OCR:</div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                    <span className={isCaptureOn ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                      {isCaptureOn ? "✓" : "✗"}
                    </span>
                    1. Screen Capture Stream Active
                  </span>
                  <span className={`font-mono text-[10px] ${isCaptureOn ? "text-emerald-500 font-bold" : "text-rose-400"}`}>
                    {isCaptureOn ? "CONNECTED" : "NOT CONNECTED"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                    <span className={hasPrimaryRegion ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                      {hasPrimaryRegion ? "✓" : "✗"}
                    </span>
                    2. Primary Scoreboard Region
                  </span>
                  <span className={`font-mono text-[10px] ${hasPrimaryRegion ? "text-emerald-500 font-bold" : "text-rose-400"}`}>
                    {hasPrimaryRegion ? "CALIBRATED" : "NOT CALIBRATED"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Manual Test & Review Option */}
          {(region || altRegion) && isCaptureOn && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Test OCR & Review</span>
                <span className="text-[10px] text-zinc-500">Run test scan and open manual verification modal</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  scanClockAndReview();
                }}
                className="py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Play size={13} className="fill-current" />
                Test Scan
              </button>
            </div>
          )}

          {/* Section 6: Last Sync History */}
          {lastSyncPoint && (
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800/30 rounded-xl flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <History size={14} className="text-zinc-400" />
                <span>Last Synced: <strong className="font-mono text-zinc-800 dark:text-zinc-200">{formatTime(lastSyncPoint.syncedGameClockMs / 1000)}</strong></span>
              </div>
              <span className="text-[10px] text-zinc-400">
                Q{lastSyncPoint.period} @ {formatTime(lastSyncPoint.videoTimeSeconds)}
              </span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

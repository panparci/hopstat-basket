import React from "react";
import { Loader2, Pause, Play, XCircle, RefreshCw, CheckCircle2, AlertTriangle, RotateCcw, Cpu, Sparkles, AlertOctagon, FastForward } from "lucide-react";
import { ScanProgressState } from "../types";
import { formatSecondsToTimecode } from "../utils/clockParser";

interface ScanProgressProps {
  progress: ScanProgressState;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onResetAndRescan?: () => void;
  onRecalibrateRegion?: () => void;
}

export const ScanProgress: React.FC<ScanProgressProps> = ({
  progress,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onResetAndRescan,
  onRecalibrateRegion,
}) => {
  const percent = progress.totalEstimatedPointsCount > 0
    ? Math.min(100, Math.round((progress.completedScanPointsCount / progress.totalEstimatedPointsCount) * 100))
    : 0;

  const isScanning =
    progress.status === "FAST_CAPTURE" ||
    progress.status === "PARALLEL_OCR" ||
    progress.status === "REGION_VALIDATION" ||
    progress.status === "AI_FALLBACK" ||
    progress.status === "FINE_SCRUBBING" ||
    progress.status === "SCANNING_COARSE" ||
    progress.status === "REFINING_MEDIUM" ||
    progress.status === "REFINING_FINE";

  const stageNumber = progress.stage || (
    progress.status === "FAST_CAPTURE" ? 1 :
    progress.status === "PARALLEL_OCR" ? 2 :
    progress.status === "REGION_VALIDATION" ? 3 :
    progress.status === "AI_FALLBACK" ? 4 :
    progress.status === "FINE_SCRUBBING" ? 5 : 1
  );

  return (
    <div className="p-4 bg-zinc-900 text-zinc-100 rounded-2xl border border-zinc-800 shadow-xl flex flex-col gap-4">
      {/* 5-Stage Stepper Header */}
      <div className="grid grid-cols-5 gap-1.5 p-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[10px] font-extrabold uppercase font-mono">
        <div className={`flex items-center justify-center py-1.5 px-1 rounded-lg gap-1 text-center transition-all ${
          stageNumber === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 ring-1 ring-amber-500/20' : stageNumber > 1 ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-600'
        }`}>
          <FastForward size={11} /> <span>1. Capture</span>
        </div>

        <div className={`flex items-center justify-center py-1.5 px-1 rounded-lg gap-1 text-center transition-all ${
          stageNumber === 2 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 ring-1 ring-amber-500/20' : stageNumber > 2 ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-600'
        }`}>
          <Cpu size={11} /> <span>2. OCR</span>
        </div>

        <div className={`flex items-center justify-center py-1.5 px-1 rounded-lg gap-1 text-center transition-all ${
          stageNumber === 3 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 ring-1 ring-amber-500/20' : stageNumber > 3 ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-600'
        }`}>
          <AlertOctagon size={11} /> <span>3. Check</span>
        </div>

        <div className={`flex items-center justify-center py-1.5 px-1 rounded-lg gap-1 text-center transition-all ${
          stageNumber === 4 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 ring-1 ring-amber-500/20' : stageNumber > 4 ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-600'
        }`}>
          <Sparkles size={11} /> <span>4. AI Sync</span>
        </div>

        <div className={`flex items-center justify-center py-1.5 px-1 rounded-lg gap-1 text-center transition-all ${
          stageNumber === 5 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 ring-1 ring-amber-500/20' : progress.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-600'
        }`}>
          <RefreshCw size={11} /> <span>5. Fine Scrub</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isScanning ? (
            <Loader2 className="animate-spin text-amber-500 shrink-0" size={22} />
          ) : progress.status === "PAUSED" ? (
            <Pause className="text-amber-400 shrink-0" size={22} />
          ) : progress.status === "COMPLETED" ? (
            <CheckCircle2 className="text-emerald-500 shrink-0" size={22} />
          ) : progress.status === "ABORTED_INVALID_REGION" || progress.status === "ERROR" ? (
            <AlertTriangle className="text-red-500 shrink-0" size={22} />
          ) : (
            <RefreshCw className="text-zinc-400 shrink-0" size={22} />
          )}

          <div>
            <h4 className="font-black text-sm text-white flex items-center gap-2">
              {progress.status === "FAST_CAPTURE" && "Stage 1: Fast Frame Capture"}
              {progress.status === "PARALLEL_OCR" && "Stage 2: Parallel Local OCR Processing"}
              {progress.status === "REGION_VALIDATION" && "Stage 3: Region Validation & Fail-Fast Check"}
              {progress.status === "AI_FALLBACK" && "Stage 4: AI Gemini Vision Fallback & Recovery"}
              {progress.status === "FINE_SCRUBBING" && "Stage 5: Adaptive Fine-Scrubbing"}
              {progress.status === "SCANNING_COARSE" && "Coarse Scan"}
              {progress.status === "PAUSED" && "Pemindaian Dihentikan Sementara"}
              {progress.status === "COMPLETED" && "Adaptive AI-Sync Timeline Complete!"}
              {progress.status === "ABORTED_INVALID_REGION" && "Gagal: Region Jam Tidak Valid"}
              {progress.status === "CANCELLED" && "Scan Dibatalkan"}
              {progress.status === "ERROR" && "Scan Error"}
              {progress.status === "IDLE" && "Siap Memulai Pipeline"}
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
              Quarter {progress.currentQuarter} of {progress.totalQuarters} &bull; Time:{" "}
              <span className="font-bold text-amber-400">{formatSecondsToTimecode(progress.currentVideoTime)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isScanning && (
            <button
              onClick={onPause}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Pause size={14} /> Pause
            </button>
          )}

          {progress.status === "PAUSED" && (
            <button
              onClick={onResume}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Play size={14} /> Resume
            </button>
          )}

          {(isScanning || progress.status === "PAUSED") && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <XCircle size={14} /> Cancel
            </button>
          )}

          {(progress.status === "ERROR" || progress.status === "CANCELLED" || progress.status === "COMPLETED" || progress.status === "ABORTED_INVALID_REGION") && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={14} /> {progress.status === "COMPLETED" ? "Rescan / Refine" : "Coba Lagi"}
            </button>
          )}

          {progress.status === "ABORTED_INVALID_REGION" && onRecalibrateRegion && (
            <button
              onClick={onRecalibrateRegion}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs flex items-center gap-1.5 transition-colors shadow-lg"
            >
              <RotateCcw size={14} /> Atur Ulang Region
            </button>
          )}

          {onResetAndRescan && (
            <button
              onClick={() => onResetAndRescan()}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs flex items-center gap-1.5 transition-colors"
              title="Mulai Ulang Scan OCR dari Awal"
            >
              <RotateCcw size={14} /> Reset Fresh
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar & Live Metrics */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-[11px] font-bold text-zinc-400 font-mono">
          <span>
            {progress.completedScanPointsCount} / {progress.totalEstimatedPointsCount} frame diproses
          </span>
          <span className="text-amber-400">{percent}%</span>
        </div>
        <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-500 transition-all duration-300 rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-zinc-800/80 text-[11px] font-mono">
          <div className="flex flex-col bg-zinc-950 p-2 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 text-[9px] uppercase">Terbaca Valid</span>
            <span className="font-bold text-emerald-400">{progress.validOcrCount ?? 0}</span>
          </div>
          <div className="flex flex-col bg-zinc-950 p-2 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 text-[9px] uppercase">Rasio Akurasi</span>
            <span className={`font-bold ${(progress.validRatioPercent ?? 0) >= 10 ? 'text-emerald-400' : 'text-red-400'}`}>
              {progress.validRatioPercent ?? 0}%
            </span>
          </div>
          <div className="flex flex-col bg-zinc-950 p-2 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 text-[9px] uppercase">AI Recovered</span>
            <span className="font-bold text-sky-400">{progress.aiRecoveredCount ?? 0}</span>
          </div>
          <div className="flex flex-col bg-zinc-950 p-2 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 text-[9px] uppercase">Gagal / Incomplete</span>
            <span className="font-bold text-amber-400">{progress.invalidCount ?? 0}</span>
          </div>
        </div>
      </div>

      {(progress.abortMessage || progress.errorMessage) && (
        <div className="text-xs text-red-200 bg-red-950/40 border border-red-800/50 p-3 rounded-xl flex flex-col gap-1">
          <span className="font-black text-red-400 uppercase text-[10px] tracking-wider">Perhatian</span>
          <p>{progress.abortMessage || progress.errorMessage}</p>
        </div>
      )}
    </div>
  );
};


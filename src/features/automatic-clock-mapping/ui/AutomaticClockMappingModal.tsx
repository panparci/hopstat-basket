import React, { useState } from "react";
import {
  X,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Coins,
  Cpu,
  Zap,
} from "lucide-react";
import { YouTubePlayer } from "react-youtube";
import { NormalizedClockRegion } from "../types";
import { useTimelineMapping } from "../model/useTimelineMapping";
import { QuarterMarkerSetup } from "./QuarterMarkerSetup";
import { ScanProgress } from "./ScanProgress";
import { TimelineIssuePanel } from "./TimelineIssuePanel";
import { TimelineReview } from "./TimelineReview";
import { TimelineStatusBadge } from "./TimelineStatusBadge";
import { FailFastAbortModal } from "./FailFastAbortModal";
import { TokenMeterModal } from "../../../core/ui/TokenMeterModal";

import { useToast } from "../../../core/contexts/ToastContext";

interface AutomaticClockMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  videoId?: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  ytPlayer: YouTubePlayer | null;
  currentYoutubeTime: number;
  clockRegion: NormalizedClockRegion | null;
  altClockRegion: NormalizedClockRegion | null;
  ytTimerRegion?: NormalizedClockRegion | null;
  onOpenCalibration: () => void;
  onSeekToVideoTime: (seconds: number) => void;
  onTimelinePublished?: () => void;
  onEnableCapture?: () => Promise<void>;
  sidePanel?: boolean;
}

export const AutomaticClockMappingModal: React.FC<AutomaticClockMappingModalProps> = ({
  isOpen,
  onClose,
  matchId,
  videoId,
  videoRef,
  ytPlayer,
  currentYoutubeTime,
  clockRegion: propClockRegion,
  altClockRegion: propAltClockRegion,
  ytTimerRegion: propYtTimerRegion,
  onOpenCalibration,
  onSeekToVideoTime,
  onTimelinePublished,
  onEnableCapture,
  sidePanel = true,
}) => {
  const [activeTab, setActiveTab] = useState<"SETUP" | "SCAN" | "REVIEW">("SETUP");
  const [isTokenMeterOpen, setIsTokenMeterOpen] = useState<boolean>(false);

  const {
    timeline,
    quarterMarkers,
    setQuarterMarkers,
    clockRegion,
    setClockRegion,
    setAltClockRegion,
    rawPoints,
    clockStateMarkers,
    addClockStateMarker,
    updateClockStateMarker,
    deleteClockStateMarker,
    issues,
    activeSegments,
    scanProgress,
    scanConfig,
    setScanConfig,
    startScan,
    pauseScan,
    resumeScan,
    cancelScan,
    updateScanPoint,
    deleteScanPoint,
    resetTimeline,
    publishTimeline,
  } = useTimelineMapping({
    matchId,
    videoId,
    videoRef,
    ytPlayer,
    currentYoutubeTime,
    clockRegion: propClockRegion,
    altClockRegion: propAltClockRegion,
    ytTimerRegion: propYtTimerRegion,
    onEnableCapture,
  });

  const { showToast } = useToast();

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handleResetTimeline = (mode: 'clear' | 'fresh') => {
    resetTimeline(mode);
    if (mode === 'clear') {
      showToast("Semua scan points & marker dihapus. Timeline direset.", "success");
      setActiveTab("SETUP");
    }
  };

  // Sync prop clock regions to hook state
  React.useEffect(() => {
    if (propClockRegion) setClockRegion(propClockRegion);
    if (propAltClockRegion) setAltClockRegion(propAltClockRegion);
  }, [propClockRegion, propAltClockRegion, setClockRegion, setAltClockRegion]);

  const [resetTarget, setResetTarget] = useState<'all' | 'auto' | 'manual'>('all');

  if (!isOpen) return null;

  const handleStartScanClick = async (fresh: boolean = false, target: 'all' | 'auto' | 'manual' = 'all') => {
    setActiveTab("SCAN");
    try {
      await startScan({ fresh, resetTarget: target });
      setActiveTab("REVIEW");
    } catch (err: any) {
      console.error("Scan launch error:", err);
      showToast(err?.message || "Gagal memulai scan. Silakan periksa koneksi player/video.", "error");
      setActiveTab("SETUP");
    }
  };

  const handlePublishClick = () => {
    publishTimeline();
    if (onTimelinePublished) onTimelinePublished();
    onClose();
  };

  const isScanning =
    scanProgress.status === "SCANNING_COARSE" ||
    scanProgress.status === "REFINING_MEDIUM" ||
    scanProgress.status === "REFINING_FINE" ||
    scanProgress.status === "PAUSED";

  return (
    <div
      className={
        sidePanel
          ? "absolute inset-0 z-50 flex flex-col bg-transparent pointer-events-none animate-fade-in"
          : "fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-500 animate-fade-in bg-black/70 backdrop-blur-sm"
      }
    >
      <div
        className={
          sidePanel
            ? "bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl transition-all duration-500 pointer-events-auto w-full h-full flex flex-col overflow-hidden"
            : "bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl transition-all duration-500 pointer-events-auto w-full max-w-5xl max-h-[92vh] rounded-3xl flex flex-col overflow-hidden"
        }
      >
        {/* Modal Header */}
        <div className="p-3.5 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-900/80 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="font-black text-xs md:text-sm text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                    Auto Clock Timeline Mapping
                  </h2>
                  {timeline && <TimelineStatusBadge status={timeline.status} version={timeline.version} />}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                  Sync YouTube video timestamps to game clock automatically
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsTokenMeterOpen(true)}
                className="px-2.5 py-1.5 rounded-xl font-extrabold text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                title="Buka Token Meter & Log Biaya AI"
              >
                <Coins size={14} />
                <span>Token Meter</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors shrink-0"
                title="Tutup Modal"
              >
                <X size={18} />
              </button>
            </div>
          </div>

        {/* Tab Navigation Header */}
        
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/40 text-[11px] font-bold overflow-x-auto shrink-0 scrollbar-none">
          <button
            onClick={() => setActiveTab("SETUP")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === "SETUP"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            <Clock size={13} /> 1. Boundaries
          </button>

          <button
            onClick={() => setActiveTab("SCAN")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === "SCAN"
                ? "bg-amber-500 text-white shadow-md"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            <Sparkles size={13} /> 2. Auto Scan
          </button>

          <button
            onClick={() => setActiveTab("REVIEW")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === "REVIEW"
                ? "bg-amber-500 text-white shadow-md"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            <Layers size={13} /> 3. Review ({rawPoints.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 md:p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {activeTab === "SETUP" && (
            <div className="flex flex-col gap-6">
              {/* Clock Region Readiness Alert */}
              <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div>
                  <h4 className="font-extrabold text-zinc-900 dark:text-zinc-100">
                    Clock Crop Area Calibration Status
                  </h4>
                  <p className="text-zinc-500 mt-0.5">
                    {propClockRegion
                      ? "Primary clock area region is calibrated and ready."
                      : "No clock crop area selected yet. Calibration required before starting scan."}
                  </p>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    onOpenCalibration();
                  }}
                  className="px-4 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shrink-0 text-xs transition-colors"
                >
                  {propClockRegion ? "Re-Calibrate Clock Area" : "Calibrate / Select Clock Area"}
                </button>
              </div>

              {/* Quarter Markers Setup */}
              <QuarterMarkerSetup
                quarterMarkers={quarterMarkers}
                onChangeMarkers={setQuarterMarkers}
                currentYoutubeTime={currentYoutubeTime}
                onSeekToVideoTime={onSeekToVideoTime}
              />

              {/* Mode Scan Selection (AI Vision vs Offline OCR) */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Zap size={14} className="text-amber-500" /> Engine Pemindaian Jam (Scanning Engine)
                  </h4>

                  <button
                    onClick={() => setIsTokenMeterOpen(true)}
                    className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <Coins size={13} /> Token Meter Log
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    onClick={() => setScanConfig({ ...scanConfig, engine: "AI_VISION" })}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                      scanConfig.engine === "AI_VISION"
                        ? "bg-amber-500/10 border-amber-500/50 ring-2 ring-amber-500/20 text-zinc-900 dark:text-zinc-100"
                        : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between font-extrabold text-xs">
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Sparkles size={15} /> Mode Scan AI Vision (Gemini)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold">
                        Rekomendasi
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                      Memproses batch beberapa gambar per kuarter via Gemini AI Vision. Sangat cepat, akurat, hemat token, dan mendeteksi kondisi clock start/stop otomatis.
                    </p>
                  </div>

                  <div
                    onClick={() => setScanConfig({ ...scanConfig, engine: "OFFLINE_OCR" })}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                      scanConfig.engine === "OFFLINE_OCR" || !scanConfig.engine
                        ? "bg-amber-500/10 border-amber-500/50 ring-2 ring-amber-500/20 text-zinc-900 dark:text-zinc-100"
                        : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between font-extrabold text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                        <Cpu size={15} /> Mode Offline OCR (Tesseract)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold">
                        100% Gratis
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                      Pemindaian lokal di browser tanpa koneksi AI/token. Sangat fleksibel tanpa biaya, menggunakan pekerja OCR lokal.
                    </p>
                  </div>
                </div>
              </div>

              {/* Scan Configuration */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3">
                <h4 className="font-extrabold text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider">Settings & Delays</h4>
                <div className="flex flex-col gap-1.5 text-xs">
                  <label className="text-zinc-500 font-medium">Capture Stabilization Delay (ms)</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      value={scanConfig.stabilizationDelayMs} 
                      onChange={e => setScanConfig({...scanConfig, stabilizationDelayMs: Number(e.target.value)})}
                      className="w-24 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500 text-zinc-900 dark:text-zinc-100 font-mono text-center"
                      min="100" step="100"
                    />
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight max-w-sm">
                      Tingkatkan nilai ini (misal: 2500ms) jika kontrol bar YouTube sering menutupi area clock setelah video digeser secara otomatis.
                    </p>
                  </div>
                </div>
              </div>

              {/* Start Scan Launch Bar */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2">
                {rawPoints.length > 0 && (
                  <div className="flex items-center gap-0">
                    <select
                      value={resetTarget}
                      onChange={(e) => setResetTarget(e.target.value as any)}
                      className="px-2 py-2.5 rounded-l-xl font-medium text-xs bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 outline-none cursor-pointer transition-colors"
                    >
                      <option value="all">All Points</option>
                      <option value="auto">Auto Scan Only</option>
                      <option value="manual">Manual Sync Only</option>
                    </select>
                    <button
                      onClick={() => {
                        setConfirmModal({
                          isOpen: true,
                          title: "Reset & Start Fresh",
                          message: `Reset/Clear ${resetTarget === 'all' ? 'ALL' : resetTarget === 'auto' ? 'Auto-Scanned' : 'Manual'} existing scan points and start a clean fresh scan? Your quarter boundaries will stay intact.`,
                          onConfirm: () => {
                            handleStartScanClick(true, resetTarget);
                            setConfirmModal(null);
                          }
                        });
                      }}
                      disabled={!propClockRegion && !clockRegion}
                      className="px-3 py-2.5 rounded-r-xl font-bold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-l-0 border-red-500/30 disabled:opacity-50 flex items-center gap-2 text-xs transition-colors"
                    >
                      <RotateCcw size={14} /> Reset
                    </button>
                  </div>
                )}

                <button
                  onClick={() => handleStartScanClick(false)}
                  disabled={!propClockRegion && !clockRegion}
                  className="px-6 py-3 rounded-2xl font-black bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white shadow-xl flex items-center gap-2 text-xs uppercase tracking-wider transition-colors ml-auto"
                >
                  <Sparkles size={16} /> {rawPoints.length > 0 ? "Continue / Refine Timeline Scan" : "Start Automatic Timeline Scan"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "SCAN" && (
            <div className="flex flex-col gap-4">
              <ScanProgress
                progress={scanProgress}
                onPause={pauseScan}
                onResume={resumeScan}
                onCancel={cancelScan}
                onRetry={() => handleStartScanClick(false)}
                onRecalibrateRegion={onOpenCalibration}
                onResetAndRescan={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: "Reset & Scan Ulang",
                    message: "Metode ini akan MENGHAPUS SEMUA scan point OCR & marker otomatis, dan MENGULANG SCAN DARI AWAL. Marker Quarter manual Anda akan tetap aman. Lanjutkan?",
                    onConfirm: () => {
                      handleStartScanClick(true);
                      setConfirmModal(null);
                    }
                  });
                }}
              />

              {rawPoints.length > 0 && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
                  <span className="font-bold text-amber-500">{rawPoints.length} scan points</span> captured so far. You can view the live progress or jump to review at any time.
                </div>
              )}
            </div>
          )}

          {activeTab === "REVIEW" && (
            <div className="flex flex-col gap-6">
              {/* Mandatory Review Issues Panel */}
              <TimelineIssuePanel
                issues={issues}
                rawPoints={rawPoints}
                onSeekToVideoTime={onSeekToVideoTime}
                onUpdatePoint={updateScanPoint}
                onDeletePoint={deleteScanPoint}
              />

              {/* Full Timeline Review & Segment List */}
              <TimelineReview
                timeline={timeline}
                rawPoints={rawPoints}
                quarterMarkers={quarterMarkers}
                activeSegments={activeSegments}
                clockStateMarkers={clockStateMarkers}
                currentYoutubeTime={currentYoutubeTime}
                onSeekToVideoTime={onSeekToVideoTime}
                onUpdatePoint={updateScanPoint}
                onDeletePoint={deleteScanPoint}
                onResetTimeline={(mode) => {
                  setConfirmModal({
                    isOpen: true,
                    title: "Reset Timeline",
                    message: "Anda yakin ingin menghapus semua scan points dan mereset timeline? Aksi ini tidak dapat dibatalkan.",
                    onConfirm: () => {
                      handleResetTimeline(mode);
                      setConfirmModal(null);
                    }
                  });
                }}
                onAddClockStateMarker={addClockStateMarker}
                onUpdateClockStateMarker={updateClockStateMarker}
                onDeleteClockStateMarker={deleteClockStateMarker}
                onPublish={handlePublishClick}
              />
            </div>
          )}
        </div>
      </div>

      {scanProgress.status === "ABORTED_INVALID_REGION" && (
        <FailFastAbortModal
          isOpen={true}
          message={scanProgress.abortMessage || scanProgress.errorMessage || "Tingkat keberhasilan deteksi < 10%. Sepertinya region yang Anda pilih salah atau jam tidak terlihat."}
          validRatioPercent={scanProgress.validRatioPercent || 0}
          onRecalibrate={() => {
            onOpenCalibration();
          }}
          onClose={() => {
            resetTimeline("clear");
          }}
        />
      )}

      {confirmModal && confirmModal.isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-black text-lg text-white">{confirmModal.title}</h3>
            <p className="text-sm text-zinc-300">{confirmModal.message}</p>
            <div className="flex justify-end gap-2 mt-2">
              <button
                onPointerDown={(e) => { e.stopPropagation(); }}
                onMouseDown={(e) => { e.stopPropagation(); }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmModal(null);
                }}
                className="px-4 py-2 rounded-xl text-zinc-300 hover:bg-zinc-800 font-bold transition-colors"
              >
                Batal
              </button>
              <button
                onPointerDown={(e) => { e.stopPropagation(); }}
                onMouseDown={(e) => { e.stopPropagation(); }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  confirmModal.onConfirm();
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      <TokenMeterModal
        isOpen={isTokenMeterOpen}
        onClose={() => setIsTokenMeterOpen(false)}
      />
    </div>
  );
};

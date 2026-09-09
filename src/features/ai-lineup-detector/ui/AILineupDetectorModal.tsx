import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Sparkles,
  Users,
  Check,
  AlertCircle,
  Coins,
  Play,
  CheckCircle2,
  Cpu,
  Zap,
  Camera,
  Video,
  Loader2,
} from "lucide-react";
import { YouTubePlayer } from "react-youtube";
import { QuarterMarker } from "../../automatic-clock-mapping/types";
import {
  calculateSampleTimestamps,
  captureFrameBase64,
  detectPlayerJerseysWithGemini,
  applyDetectedJerseysToMatchRoster,
  LineupDetectionResult,
} from "../services/aiLineupService";
import { formatSecondsToMMSS } from "../../automatic-clock-mapping/utils/clockParser";
import { TokenMeterModal } from "../../../core/ui/TokenMeterModal";
import { useToast } from "../../../core/contexts/ToastContext";

interface AILineupDetectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  teamId: string;
  opponentTeamId: string;
  ourTeamName?: string;
  theirTeamName?: string;
  quarterMarkers?: QuarterMarker[];
  ytPlayer?: YouTubePlayer | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  currentYoutubeTime?: number;
  onRosterUpdated?: () => void;
}

export const AILineupDetectorModal: React.FC<AILineupDetectorModalProps> = ({
  isOpen,
  onClose,
  matchId,
  teamId,
  opponentTeamId,
  ourTeamName = "Tim Kami",
  theirTeamName = "Tim Lawan",
  quarterMarkers = [],
  ytPlayer,
  videoRef,
  currentYoutubeTime = 0,
  onRosterUpdated,
}) => {
  const { showToast } = useToast();

  const [status, setStatus] = useState<"IDLE" | "SAMPLING" | "ANALYZING" | "COMPLETED" | "ERROR">("IDLE");
  const [progressMsg, setProgressMsg] = useState("");
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);

  const [result, setResult] = useState<LineupDetectionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isTokenMeterOpen, setIsTokenMeterOpen] = useState(false);

  const [appliedHome, setAppliedHome] = useState(false);
  const [appliedAway, setAppliedAway] = useState(false);

  // Local Screen Capture stream state if parent videoRef is not provided or inactive
  const [isLocalCaptureActive, setIsLocalCaptureActive] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Clean up local media stream on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  // Calculate sampling plan (timestamps)
  const durationSec = ytPlayer?.getDuration?.() || 2400;
  const sampleTimestamps = calculateSampleTimestamps(quarterMarkers, durationSec);

  const validQuartersCount = quarterMarkers.filter(
    (q) => q.videoEndSeconds > q.videoStartSeconds + 10
  ).length;

  const enableLocalCapture = async (): Promise<HTMLVideoElement | null> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen capture tidak didukung di browser ini.");
      }
      showToast("Pilih tab atau jendela video untuk mengizinkan capture frame...", "info");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" } as any,
        audio: false,
      });

      localStreamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      await new Promise<void>((res) => {
        video.onloadedmetadata = () => {
          video.play().then(() => res());
        };
      });

      localVideoRef.current = video;
      setIsLocalCaptureActive(true);

      const track = stream.getVideoTracks()[0];
      if (track) {
        track.addEventListener("ended", () => {
          setIsLocalCaptureActive(false);
          localStreamRef.current = null;
          localVideoRef.current = null;
        });
      }

      showToast("Capture video stream berhasil diaktifkan!", "success");
      return video;
    } catch (err: any) {
      console.error("[AILineupDetectorModal] Screen capture error:", err);
      showToast(err?.message || "Izin capture video ditolak.", "error");
      return null;
    }
  };

  const handleStartDetection = async () => {
    try {
      setStatus("SAMPLING");
      setErrorMessage("");
      setAppliedHome(false);
      setAppliedAway(false);
      setTotalFrames(sampleTimestamps.length);

      // Check active video element
      let activeVideoEl = videoRef?.current || localVideoRef.current;

      // If no active capture video stream exists, attempt to enable screen capture
      if (!activeVideoEl || activeVideoEl.readyState < 2) {
        activeVideoEl = await enableLocalCapture();
      }

      if (!activeVideoEl || activeVideoEl.readyState < 2) {
        throw new Error(
          "Gagal mengambil frame video. YouTube player berada di dalam iframe sandbox. Silakan klik tombol 'Aktifkan Screen Capture' terlebih dahulu agar browser dapat mengambil screenshot frame."
        );
      }

      const capturedFrames: string[] = [];

      // 1. Loop through sample timestamps and grab frames
      for (let i = 0; i < sampleTimestamps.length; i++) {
        const timestamp = sampleTimestamps[i];
        setCurrentFrameIdx(i + 1);
        setProgressMsg(
          `Mengambil screenshot frame video ke-${i + 1} dari ${sampleTimestamps.length} (${formatSecondsToMMSS(timestamp)})...`
        );

        // Seek youtube player if available
        if (ytPlayer && typeof ytPlayer.seekTo === "function") {
          ytPlayer.seekTo(timestamp, true);
          // Wait 900ms for video frame buffer to render cleanly
          await new Promise((res) => setTimeout(res, 900));
        }

        const targetIframe = ytPlayer && typeof ytPlayer.getIframe === "function" ? ytPlayer.getIframe() : null;
        const base64 = captureFrameBase64(activeVideoEl, targetIframe);

        if (base64) {
          capturedFrames.push(base64);
        }
      }

      if (capturedFrames.length === 0) {
        throw new Error("Gagal mengambil frame video. Pastikan capture video stream aktif.");
      }

      // 2. Call Gemini API
      setStatus("ANALYZING");
      setProgressMsg(`Menganalisis ${capturedFrames.length} frame dengan Gemini 2.5 Flash AI Vision...`);

      const res = await detectPlayerJerseysWithGemini(capturedFrames, ourTeamName, theirTeamName);
      setResult(res);
      setStatus("COMPLETED");
      showToast("Deteksi roster & nomor punggung pemain AI selesai!", "success");
    } catch (err: any) {
      console.error("[AIRosterDetector] Error:", err);
      setStatus("ERROR");
      setErrorMessage(err?.message || "Terjadi kesalahan saat mendeteksi roster AI.");
    }
  };

  const handleApplyHomeRoster = async () => {
    if (!result || !teamId) return;
    try {
      const { added, matched } = await applyDetectedJerseysToMatchRoster(
        matchId,
        teamId,
        result.homeTeam.jerseys,
        ourTeamName
      );
      setAppliedHome(true);
      const msg = added > 0
        ? `Berhasil mendaftarkan ${added} pemain (${matched} cocok dari DB) ke roster bench ${ourTeamName}!`
        : `Semua ${matched} pemain sudah terdaftar di roster ${ourTeamName}!`;
      showToast(msg, "success");
      if (onRosterUpdated) onRosterUpdated();
    } catch (e: any) {
      showToast("Gagal menerapkan roster: " + e.message, "error");
    }
  };

  const handleApplyAwayRoster = async () => {
    if (!result || !opponentTeamId) return;
    try {
      const { added, matched } = await applyDetectedJerseysToMatchRoster(
        matchId,
        opponentTeamId,
        result.awayTeam.jerseys,
        theirTeamName
      );
      setAppliedAway(true);
      const msg = added > 0
        ? `Berhasil mendaftarkan ${added} pemain (${matched} cocok dari DB) ke roster bench ${theirTeamName}!`
        : `Semua ${matched} pemain sudah terdaftar di roster ${theirTeamName}!`;
      showToast(msg, "success");
      if (onRosterUpdated) onRosterUpdated();
    } catch (e: any) {
      showToast("Gagal menerapkan roster: " + e.message, "error");
    }
  };

  if (status === "SAMPLING") {
    return (
      <div className="fixed bottom-6 right-6 z-[9999] bg-zinc-950/95 border border-amber-500/60 rounded-2xl p-4 shadow-2xl backdrop-blur-md max-w-sm w-full text-white font-sans select-none animate-fadeIn">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span className="text-amber-400 uppercase tracking-wider text-[10px]">
                Sampling Frame ({currentFrameIdx}/{totalFrames})
              </span>
              <span className="text-zinc-400 font-mono text-[10px]">
                {Math.round((currentFrameIdx / totalFrames) * 100)}%
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 truncate">{progressMsg}</p>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all duration-300"
                style={{ width: `${(currentFrameIdx / totalFrames) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn font-sans">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl relative text-left flex flex-col max-h-[90vh] overflow-hidden text-zinc-100">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-black text-lg text-white flex items-center gap-2">
                  Deteksi Roster AI
                  <span className="text-[10px] bg-amber-500 text-zinc-950 font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Gemini 2.5 Flash
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Ekstrak nomor punggung dari video untuk didaftarkan ke roster bench pertandingan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsTokenMeterOpen(true)}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-amber-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Buka Token Meter Log"
              >
                <Coins className="w-4 h-4" />
                <span className="hidden sm:inline">Token Meter</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="py-4 space-y-4 overflow-y-auto flex-1">
            
            {/* Sampling Plan overview */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Rencana Sampling Frame Video
                </span>
                <span className="text-[11px] text-amber-400 font-mono font-bold">
                  {sampleTimestamps.length} Frame Sample
                </span>
              </div>
              
              <div className="flex flex-wrap gap-1.5 pt-1">
                {sampleTimestamps.map((ts, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700/80 text-zinc-300 font-mono text-[11px] font-bold"
                  >
                    #{idx + 1}: {formatSecondsToMMSS(ts)}
                  </span>
                ))}
              </div>

              {/* Quarter Filter Status */}
              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${validQuartersCount > 0 ? "text-emerald-400" : "text-amber-400"}`} />
                  {validQuartersCount > 0
                    ? `Hanya mengambil frame di dalam ${validQuartersCount} Quarter (Q1-Q4) aktif. (Iklan & jeda dilewati)`
                    : "Belum ada Quarter Marker. Disarankan atur Quarter (Q1-Q4) agar terhindar dari iklan/halftime."}
                </span>
              </div>
            </div>

            {/* Screen Capture Stream Status & Toggle */}
            <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
              (videoRef?.current && videoRef.current.readyState >= 2) || isLocalCaptureActive
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-amber-500/10 border-amber-500/30 text-amber-300"
            }`}>
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-bold">
                    {(videoRef?.current && videoRef.current.readyState >= 2) || isLocalCaptureActive
                      ? "Capture Video Stream Aktif"
                      : "Izin Capture Video Stream Diperlukan"}
                  </span>
                  <span className="text-[11px] opacity-80">
                    {(videoRef?.current && videoRef.current.readyState >= 2) || isLocalCaptureActive
                      ? "Siap mengambil screenshot frame HD dari video YouTube."
                      : "YouTube iframe terisolasi. Izinkan screen capture agar browser dapat mengambil screenshot frame."}
                  </span>
                </div>
              </div>

              {!((videoRef?.current && videoRef.current.readyState >= 2) || isLocalCaptureActive) && (
                <button
                  type="button"
                  onClick={enableLocalCapture}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-[11px] uppercase tracking-wider shrink-0 transition-colors shadow"
                >
                  Aktifkan Stream
                </button>
              )}
            </div>

            {/* Action State: Idle */}
            {status === "IDLE" && (
              <div className="text-center py-6 px-4 border border-dashed border-zinc-800 rounded-2xl space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Siap Memulai Deteksi Pemain</h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                    Klik tombol di bawah untuk mengambil screenshot otomatis dan mengekstrak nomor punggung kedua tim dengan AI.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartDetection}
                  className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 mx-auto active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  Mulai Deteksi AI Sekarang
                </button>
              </div>
            )}

            {/* Action State: Analyzing Progress */}
            {status === "ANALYZING" && (
              <div className="text-center py-8 px-4 border border-amber-500/20 bg-amber-500/5 rounded-2xl space-y-4">
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
                  <Sparkles className="w-6 h-6 text-amber-400 absolute" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-white text-sm">
                    Menganalisis dengan Gemini AI
                  </h4>
                  <p className="text-xs text-amber-300 font-mono">{progressMsg}</p>
                </div>
              </div>
            )}

            {/* Action State: Error */}
            {status === "ERROR" && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>Gagal Mendeteksi Lineup</span>
                </div>
                <p>{errorMessage}</p>
                <button
                  type="button"
                  onClick={handleStartDetection}
                  className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-colors"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* Action State: Completed Results */}
            {status === "COMPLETED" && result && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{result.summary}</span>
                  </div>
                  <div className="text-right shrink-0 font-mono text-[11px] text-zinc-400">
                    <div>Tokens: {result.tokenUsage.totalTokens.toLocaleString()}</div>
                    <div className="text-amber-400 font-bold">Rp {result.tokenUsage.costIDR.toFixed(2)}</div>
                  </div>
                </div>

                {/* Team Results */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  
                  {/* Home Team Card */}
                  <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-black text-sm text-white">{ourTeamName}</h5>
                        <p className="text-[11px] text-zinc-400">{result.homeTeam.color}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold text-xs">
                        {result.homeTeam.jerseys.length} Pemain
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 min-h-[50px] p-2 rounded-xl bg-zinc-950 border border-zinc-800/80 items-center">
                      {result.homeTeam.jerseys.length > 0 ? (
                        result.homeTeam.jerseys.map((jersey, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 text-zinc-950 font-black text-xs font-mono shadow-sm"
                          >
                            #{jersey}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-500 italic">Tidak ada nomor jersey terdeteksi</span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={appliedHome || result.homeTeam.jerseys.length === 0}
                      onClick={handleApplyHomeRoster}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                        appliedHome
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default"
                          : "bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md active:scale-95"
                      }`}
                    >
                      {appliedHome ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          Terpasang di Roster {ourTeamName}
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4" />
                          Terapkan ke Roster {ourTeamName}
                        </>
                      )}
                    </button>
                  </div>

                  {/* Away Team Card */}
                  <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-black text-sm text-white">{theirTeamName}</h5>
                        <p className="text-[11px] text-zinc-400">{result.awayTeam.color}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono font-bold text-xs">
                        {result.awayTeam.jerseys.length} Pemain
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 min-h-[50px] p-2 rounded-xl bg-zinc-950 border border-zinc-800/80 items-center">
                      {result.awayTeam.jerseys.length > 0 ? (
                        result.awayTeam.jerseys.map((jersey, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 font-black text-xs font-mono shadow-sm"
                          >
                            #{jersey}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-500 italic">Tidak ada nomor jersey terdeteksi</span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={appliedAway || result.awayTeam.jerseys.length === 0}
                      onClick={handleApplyAwayRoster}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                        appliedAway
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default"
                          : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 shadow-md active:scale-95"
                      }`}
                    >
                      {appliedAway ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          Terpasang di Roster {theirTeamName}
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4" />
                          Terapkan ke Roster {theirTeamName}
                        </>
                      )}
                    </button>
                  </div>

                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-xs shrink-0">
            <span className="text-zinc-500">
              Penggunaan token AI otomatis dicatat di Token Meter
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold transition-colors"
            >
              Tutup
            </button>
          </div>

        </div>
      </div>

      {/* Token Meter Modal */}
      <TokenMeterModal
        isOpen={isTokenMeterOpen}
        onClose={() => setIsTokenMeterOpen(false)}
      />
    </>
  );
};

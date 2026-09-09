import React, { useState, useEffect, useRef } from "react";
import { Camera, RefreshCw, Sliders, Maximize2, Sparkles, Zap } from "lucide-react";
import { YouTubePlayer } from "react-youtube";
import { useToast } from "../../../core/contexts/ToastContext";
import { NormalizedClockRegion, ClockSyncPoint, VisualClockSyncStatus, ClockOCRResult } from "../types";
import { CalibrationModal } from "./CalibrationModal";
import { ConfirmationModal, SingleScanDetail } from "./ConfirmationModal";
import { ClockSyncSetupModal } from "./ClockSyncSetupModal";
import { captureAndCropFrame } from "../utils/imageUtils";
import { performOCR } from "../services/ocrService";
import { AutomaticClockMappingModal } from "../../automatic-clock-mapping/ui/AutomaticClockMappingModal";
import { TimelineSyncPanelButton } from "../../automatic-clock-mapping/ui/TimelineSyncPanelButton";
import { TimelineStorageService } from "../../automatic-clock-mapping/services/timelineStorageService";
import { ClockTimeline, RawClockScanPoint, ClockStateMarker } from "../../automatic-clock-mapping/types";
import { generateClockTimeline } from "../../automatic-clock-mapping/services/timelineGenerationService";
import { OnTheFlySyncToggle } from "../../on-the-fly-clock-sync/ui/OnTheFlySyncToggle";

interface ClockSyncPanelProps {
  matchId: string;
  videoId?: string;
  currentQuarter: number;
  timeRemaining: number; // in seconds
  currentYoutubeTime: number; // in seconds
  ytPlayer?: YouTubePlayer | null;
  onSyncConfirm: (confirmedSeconds: number, previousSeconds: number, syncPoint: ClockSyncPoint) => void;
  onTheFlyEnabled?: boolean;
  onToggleOnTheFly?: (enabled?: boolean) => void;
  onOpenAILineupModal?: () => void;
}

export const ClockSyncPanel: React.FC<ClockSyncPanelProps> = ({
  matchId,
  videoId,
  currentQuarter,
  timeRemaining,
  currentYoutubeTime,
  ytPlayer,
  onSyncConfirm,
  onTheFlyEnabled,
  onToggleOnTheFly,
  onOpenAILineupModal,
}) => {
  const { showToast } = useToast();
  const activeVideoId = videoId || ytPlayer?.getVideoData?.()?.video_id || "";

  const [status, setStatus] = useState<VisualClockSyncStatus>("IDLE");
  const [region, setRegion] = useState<NormalizedClockRegion | null>(null);
  const [altRegion, setAltRegion] = useState<NormalizedClockRegion | null>(null);
  const [ytTimerRegion, setYtTimerRegion] = useState<NormalizedClockRegion | null>(null);
  const [calibratingType, setCalibratingType] = useState<"primary" | "alternative" | "ytTimer">("primary");

  const [lastSyncPoint, setLastSyncPoint] = useState<ClockSyncPoint | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState<boolean>(false);
  const [timeline, setTimeline] = useState<ClockTimeline | null>(null);

  // Settings
  const [expressMode, setExpressMode] = useState<boolean>(() => {
    return localStorage.getItem("clock_sync_express_mode") !== "false";
  });

  // Modals visibility
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showAutoMappingModal, setShowAutoMappingModal] = useState(false);

  // Screenshot and crop states for verification
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");
  const [rawCropUrl, setRawCropUrl] = useState<string>("");
  const [processedCropUrl, setProcessedCropUrl] = useState<string>("");
  const [activeRegionUsed, setActiveRegionUsed] = useState<NormalizedClockRegion | null>(null);
  const [primaryScanDetail, setPrimaryScanDetail] = useState<SingleScanDetail | null>(null);
  const [altScanDetail, setAltScanDetail] = useState<SingleScanDetail | null>(null);
  const [usedAltRegion, setUsedAltRegion] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<ClockOCRResult>({
    rawText: "",
    normalizedText: null,
    milliseconds: null,
    confidence: 0,
    isValid: false,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const syncPointsKey = `clock_sync_points_${matchId}`;
  const regionKey = `clock_sync_region_${matchId}`;
  const altRegionKey = `clock_sync_alt_region_${matchId}`;
  const ytTimerRegionKey = `clock_sync_yt_timer_region_${matchId}`;

  // Load saved calibration regions, last sync point, and published timeline
  useEffect(() => {
    const loadData = async () => {
      try {
        let savedRegion = localStorage.getItem(regionKey);
      if (!savedRegion && activeVideoId) {
        savedRegion = localStorage.getItem(`clock_sync_region_yt_${activeVideoId}`);
      }
      if (savedRegion) {
        setRegion(JSON.parse(savedRegion));
      }

      let savedAltRegion = localStorage.getItem(altRegionKey);
      if (!savedAltRegion && activeVideoId) {
        savedAltRegion = localStorage.getItem(`clock_sync_alt_region_yt_${activeVideoId}`);
      }
      if (savedAltRegion) {
        setAltRegion(JSON.parse(savedAltRegion));
      }

      let savedYtTimerRegion = localStorage.getItem(ytTimerRegionKey);
      if (!savedYtTimerRegion && activeVideoId) {
        savedYtTimerRegion = localStorage.getItem(`clock_sync_yt_timer_region_yt_${activeVideoId}`);
      }
      if (savedYtTimerRegion) {
        setYtTimerRegion(JSON.parse(savedYtTimerRegion));
      }

      const savedPoints = JSON.parse(localStorage.getItem(syncPointsKey) || "[]");
      if (savedPoints.length > 0) {
        setLastSyncPoint(savedPoints[savedPoints.length - 1]);
      }

      const loadedTimeline = await TimelineStorageService.loadTimeline(matchId, activeVideoId);
      setTimeline(loadedTimeline);
      if (loadedTimeline?.clockRegion && !savedRegion) {
        setRegion(loadedTimeline.clockRegion);
      }
      if (loadedTimeline?.altClockRegion && !savedAltRegion) {
        setAltRegion(loadedTimeline.altClockRegion);
      }
      if (loadedTimeline?.ytTimerRegion && !savedYtTimerRegion) {
        setYtTimerRegion(loadedTimeline.ytTimerRegion);
      }
      } catch (e) {
        console.error("Failed to load local storage configurations:", e);
      }
    };
    loadData();

    const handleTimelinePublished = async (e: Event) => {
      const customEvt = e as CustomEvent;
      if (!customEvt.detail?.matchId || customEvt.detail.matchId === matchId) {
        const t = await TimelineStorageService.loadTimeline(matchId);
        setTimeline(t);
      }
    };

    window.addEventListener("timeline-published", handleTimelinePublished);
    return () => {
      window.removeEventListener("timeline-published", handleTimelinePublished);
    };
  }, [matchId, regionKey, altRegionKey, ytTimerRegionKey, syncPointsKey]);

  // Clean up media streams when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const toggleExpressMode = (val: boolean) => {
    setExpressMode(val);
    localStorage.setItem("clock_sync_express_mode", val ? "true" : "false");
  };

  const handleCaptureEnded = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    setStatus("CAPTURE_ENDED");
    showToast("Screen capture stream stopped.", "info");
  };

  const enableCapture = async () => {
    try {
      setPermissionBlocked(false);
      setStatus("REQUESTING_CAPTURE");
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen capture is not supported in this browser context.");
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" } as any,
        audio: false,
      });

      streamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.onloadedmetadata = () => {
        video.play();
      };

      videoRef.current = video;

      const track = stream.getVideoTracks()[0];
      if (track) {
        track.addEventListener("ended", handleCaptureEnded);
      }

      setStatus(region || altRegion ? "READY" : "CAPTURE_ACTIVE");
      showToast("Screen capture active. Select clock region to finish setup.", "success");
    } catch (err: any) {
      console.error("Failed to enable screen capture:", err);
      setStatus("ERROR");
      
      const errStr = String(err?.message || err).toLowerCase();
      if (errStr.includes("permissions policy") || errStr.includes("disallowed") || errStr.includes("notallowederror")) {
        setPermissionBlocked(true);
        showToast("Screen capture restricted in preview iframe. Open in a new tab.", "error");
      } else {
        showToast(err?.message || "Screen capture permission was not granted.", "error");
      }
    }
  };

  const captureCleanFrame = (onCaptureDone: (url: string) => void) => {
    if (!videoRef.current) {
      showToast("Video reference lost", "error");
      return;
    }

    const video = videoRef.current;

    const performDraw = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas context");

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL("image/png");
        onCaptureDone(url);
      } catch (err) {
        console.error("Calibration capture error:", err);
        showToast("Could not capture frame from player.", "error");
        setShowSetupModal(true);
      }
    };

    // 1. Hide setup modal first so it disappears from screen capture stream
    setShowSetupModal(false);

    // 2. Double rAF + requestVideoFrameCallback ensures React unmounts modal and browser presents fresh video frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if ('requestVideoFrameCallback' in video) {
          (video as any).requestVideoFrameCallback(() => {
            (video as any).requestVideoFrameCallback(() => {
              performDraw();
            });
          });
        } else {
          setTimeout(performDraw, 200);
        }
      });
    });
  };

  const startCalibration = (type: "primary" | "alternative") => {
    if (!videoRef.current || status === "CAPTURE_ENDED" || status === "IDLE") {
      showToast("Capture is inactive. Enable capture first.", "error");
      return;
    }

    setCalibratingType(type);

    captureCleanFrame((url) => {
      setScreenshotUrl(url);
      setShowCalibration(true);
    });
  };

  const handleCalibrationConfirm = (
    newPrimaryRegion: NormalizedClockRegion,
    newAltRegion?: NormalizedClockRegion | null,
    newYtTimerRegion?: NormalizedClockRegion | null
  ) => {
    setRegion(newPrimaryRegion);
    localStorage.setItem(regionKey, JSON.stringify(newPrimaryRegion));
    if (activeVideoId) {
      localStorage.setItem(`clock_sync_region_yt_${activeVideoId}`, JSON.stringify(newPrimaryRegion));
    }

    if (newAltRegion !== undefined) {
      if (newAltRegion) {
        setAltRegion(newAltRegion);
        localStorage.setItem(altRegionKey, JSON.stringify(newAltRegion));
        if (activeVideoId) {
          localStorage.setItem(`clock_sync_alt_region_yt_${activeVideoId}`, JSON.stringify(newAltRegion));
        }
      } else {
        setAltRegion(null);
        localStorage.removeItem(altRegionKey);
        if (activeVideoId) {
          localStorage.removeItem(`clock_sync_alt_region_yt_${activeVideoId}`);
        }
      }
    }

    if (newYtTimerRegion !== undefined) {
      if (newYtTimerRegion) {
        setYtTimerRegion(newYtTimerRegion);
        localStorage.setItem(ytTimerRegionKey, JSON.stringify(newYtTimerRegion));
        if (activeVideoId) {
          localStorage.setItem(`clock_sync_yt_timer_region_yt_${activeVideoId}`, JSON.stringify(newYtTimerRegion));
        }
      } else {
        setYtTimerRegion(null);
        localStorage.removeItem(ytTimerRegionKey);
        if (activeVideoId) {
          localStorage.removeItem(`clock_sync_yt_timer_region_yt_${activeVideoId}`);
        }
      }
    }

    showToast("Referensi area OCR berhasil disimpan!", "success");
    setStatus("READY");
    setShowCalibration(false);
    setShowSetupModal(true);

    window.dispatchEvent(new CustomEvent("timeline-updated", { detail: { matchId } }));
  };

  const handleClearAltRegion = () => {
    setAltRegion(null);
    localStorage.removeItem(altRegionKey);
    if (activeVideoId) {
      localStorage.removeItem(`clock_sync_alt_region_yt_${activeVideoId}`);
    }
    showToast("Alternative clock region removed.", "info");
  };

  // Helper function to scan primary and/or alternative regions concurrently in parallel
  const executeScan = async () => {
    if (!videoRef.current) throw new Error("No active video capture");
    const video = videoRef.current;

    const scanPrimaryTask = async (): Promise<SingleScanDetail | null> => {
      if (!region) return null;
      try {
        const crop = captureAndCropFrame(video, region);
        const res = await performOCR(crop.variantUrls);
        return {
          rawCropUrl: crop.rawUrl,
          processedCropUrl: crop.processedUrl,
          ocrResult: res,
          region,
        };
      } catch (e) {
        return null;
      }
    };

    const scanAltTask = async (): Promise<SingleScanDetail | null> => {
      if (!altRegion) return null;
      try {
        const crop = captureAndCropFrame(video, altRegion);
        const res = await performOCR(crop.variantUrls);
        return {
          rawCropUrl: crop.rawUrl,
          processedCropUrl: crop.processedUrl,
          ocrResult: res,
          region: altRegion,
        };
      } catch (e) {
        return null;
      }
    };

    // Run both Primary and Alt OCR scans in parallel!
    const [primary, alt] = await Promise.all([scanPrimaryTask(), scanAltTask()]);

    const primaryOcrValid = Boolean(primary && primary.ocrResult.isValid && primary.ocrResult.milliseconds !== null);
    const altOcrValid = Boolean(alt && alt.ocrResult.isValid && alt.ocrResult.milliseconds !== null);

    // 1. Both OCR valid
    if (altOcrValid && primaryOcrValid && alt && primary) {
      const useAlt = alt.ocrResult.confidence >= primary.ocrResult.confidence - 5;
      const winner = useAlt ? alt : primary;
      return {
        ocrResult: winner.ocrResult,
        rawCropUrl: winner.rawCropUrl,
        processedCropUrl: winner.processedCropUrl,
        usedRegion: winner.region,
        usedAlt: useAlt,
        primaryScan: primary,
        altScan: alt,
      };
    }

    // 2. Only Alt is OCR valid -> Pick Alt!
    if (altOcrValid && alt) {
      return {
        ocrResult: alt.ocrResult,
        rawCropUrl: alt.rawCropUrl,
        processedCropUrl: alt.processedCropUrl,
        usedRegion: alt.region,
        usedAlt: true,
        primaryScan: primary,
        altScan: alt,
      };
    }

    // 3. Only Primary is OCR valid -> Pick Primary!
    if (primaryOcrValid && primary) {
      return {
        ocrResult: primary.ocrResult,
        rawCropUrl: primary.rawCropUrl,
        processedCropUrl: primary.processedCropUrl,
        usedRegion: primary.region,
        usedAlt: false,
        primaryScan: primary,
        altScan: alt,
      };
    }

    // 4. Neither is OCR valid. Fallback to whichever produced non-empty text or higher confidence
    if (
      alt &&
      (!primary || alt.ocrResult.confidence > primary.ocrResult.confidence || (!primary.ocrResult.rawText && Boolean(alt.ocrResult.rawText)))
    ) {
      return {
        ocrResult: alt.ocrResult,
        rawCropUrl: alt.rawCropUrl,
        processedCropUrl: alt.processedCropUrl,
        usedRegion: alt.region,
        usedAlt: true,
        primaryScan: primary,
        altScan: alt,
      };
    }

    if (primary) {
      return {
        ocrResult: primary.ocrResult,
        rawCropUrl: primary.rawCropUrl,
        processedCropUrl: primary.processedCropUrl,
        usedRegion: primary.region,
        usedAlt: false,
        primaryScan: primary,
        altScan: alt,
      };
    }

    throw new Error("No clock region configured.");
  };

  // Express One-Click Sync Handler
  const handleExpressSyncClick = async () => {
    if (!videoRef.current || status === "IDLE" || status === "CAPTURE_ENDED" || status === "ERROR") {
      setShowSetupModal(true);
      return;
    }

    if (!region && !altRegion) {
      setShowSetupModal(true);
      showToast("Please calibrate a clock region in Setup first.", "info");
      return;
    }

    try {
      setStatus("SCANNING");

      const scanData = await executeScan();

      setRawCropUrl(scanData.rawCropUrl);
      setProcessedCropUrl(scanData.processedCropUrl);
      setActiveRegionUsed(scanData.usedRegion);
      setOcrResult(scanData.ocrResult);
      setPrimaryScanDetail(scanData.primaryScan);
      setAltScanDetail(scanData.altScan);
      setUsedAltRegion(scanData.usedAlt);

      const res = scanData.ocrResult;

      if (expressMode && res.isValid && res.milliseconds !== null && res.normalizedText) {
        // Express mode: directly confirm time without opening popup modal!
        handleSyncConfirm(res.milliseconds, res.normalizedText, "OCR_CONFIRMED", scanData.usedRegion, scanData.usedAlt);
      } else {
        // Express mode fallback (invalid/uncertain result or express disabled) -> open manual confirmation modal
        setStatus("REVIEWING_RESULT");
        setShowConfirmation(true);
        if (!res.isValid) {
          showToast("OCR clock value unreadable. Review and confirm manually.", "info");
        }
      }
    } catch (err) {
      console.error("Error during scanning:", err);
      setStatus(region || altRegion ? "READY" : "CAPTURE_ACTIVE");
      showToast("Scan failed. Ensure player tab is active and visible.", "error");
    }
  };

  // Manual Scan trigger (from Setup modal)
  const scanClockAndReview = async () => {
    if (!videoRef.current || (!region && !altRegion)) {
      showToast("Please calibrate a clock region first.", "error");
      return;
    }

    // Hide setup modal first so it disappears from screen capture stream
    setShowSetupModal(false);

    const performScan = async () => {
      try {
        setStatus("SCANNING");

        const scanData = await executeScan();

        setRawCropUrl(scanData.rawCropUrl);
        setProcessedCropUrl(scanData.processedCropUrl);
        setActiveRegionUsed(scanData.usedRegion);
        setOcrResult(scanData.ocrResult);
        setPrimaryScanDetail(scanData.primaryScan);
        setAltScanDetail(scanData.altScan);
        setUsedAltRegion(scanData.usedAlt);

        setStatus("REVIEWING_RESULT");
        setShowConfirmation(true);
      } catch (err) {
        console.error("Error during scanning:", err);
        setStatus("READY");
        showToast("Scan failed. Ensure player tab is active.", "error");
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (videoRef.current && 'requestVideoFrameCallback' in videoRef.current) {
          (videoRef.current as any).requestVideoFrameCallback(() => {
            (videoRef.current as any).requestVideoFrameCallback(() => {
              performScan();
            });
          });
        } else {
          setTimeout(performScan, 200);
        }
      });
    });
  };

  const handleSyncConfirm = async (
    finalMs: number, 
    finalStr: string, 
    source: "OCR_CONFIRMED" | "MANUAL_CORRECTION",
    customRegion?: NormalizedClockRegion | null,
    usedAltRegion?: boolean
  ) => {
    const targetRegion = customRegion || activeRegionUsed || region || altRegion;
    if (!targetRegion) return;

    const finalSeconds = finalMs / 1000;
    const previousSeconds = timeRemaining;

    const syncPoint: ClockSyncPoint = {
      id: `sync_${Date.now()}`,
      gameId: matchId,
      period: currentQuarter,
      videoTimeSeconds: currentYoutubeTime,
      previousGameClockMs: previousSeconds * 1000,
      syncedGameClockMs: finalMs,
      capturedAt: new Date().toISOString(),
      confidence: source === "OCR_CONFIRMED" ? ocrResult.confidence : null,
      source,
      captureRegion: targetRegion,
      rawOCRText: ocrResult.rawText,
    };

    const currentPoints = JSON.parse(localStorage.getItem(syncPointsKey) || "[]");
    currentPoints.push(syncPoint);
    localStorage.setItem(syncPointsKey, JSON.stringify(currentPoints));
    setLastSyncPoint(syncPoint);

    // Complement the Auto Clock Mapping timeline by inserting this manual sync marker
    try {
      const newScanPoint: RawClockScanPoint = {
        id: syncPoint.id,
        quarter: currentQuarter,
        videoTimeSeconds: currentYoutubeTime,
        detectedGameClockMs: finalMs,
        confidence: 100,
        rawOCRText: finalStr,
        normalizedOCRText: finalStr,
        scanIntervalSeconds: 1,
        status: "VALID",
      };

      const manualMarker: ClockStateMarker = {
        id: `marker_${syncPoint.id}`,
        quarter: currentQuarter,
        videoTimeSeconds: currentYoutubeTime,
        gameClockMs: finalMs,
        action: "START_CLOCK",
        source: "MANUAL",
        confidence: 100,
      };

      const existingTimeline = await TimelineStorageService.loadTimeline(matchId);
      let updatedTimeline: ClockTimeline;

      if (existingTimeline) {
        const mergedScanPoints = [...(existingTimeline.rawScanPoints || []), newScanPoint];
        const mergedMarkers = [...(existingTimeline.clockStateMarkers || []), manualMarker].sort(
          (a, b) => a.videoTimeSeconds - b.videoTimeSeconds
        );

        updatedTimeline = generateClockTimeline(
          matchId,
          existingTimeline.videoId,
          existingTimeline.quarterMarkers,
          existingTimeline.clockRegion,
          existingTimeline.altClockRegion,
          mergedScanPoints,
          "AUTO_WITH_REVIEW",
          existingTimeline
        );
        updatedTimeline.clockStateMarkers = mergedMarkers;
      } else {
        const defaultQuarterMarkers = [
          { quarter: 1, initialGameClockMs: 600000, videoStartSeconds: 0, videoEndSeconds: 600 },
          { quarter: 2, initialGameClockMs: 600000, videoStartSeconds: 600, videoEndSeconds: 1200 },
          { quarter: 3, initialGameClockMs: 600000, videoStartSeconds: 1200, videoEndSeconds: 1800 },
          { quarter: 4, initialGameClockMs: 600000, videoStartSeconds: 1800, videoEndSeconds: 2400 },
        ];
        const defaultRegion = targetRegion || { xRatio: 0.1, yRatio: 0.1, widthRatio: 0.2, heightRatio: 0.1 };
        updatedTimeline = generateClockTimeline(
          matchId,
          undefined,
          defaultQuarterMarkers,
          defaultRegion,
          altRegion,
          [newScanPoint],
          "AUTO_WITH_REVIEW"
        );
        updatedTimeline.clockStateMarkers = [manualMarker];
      }

      await TimelineStorageService.publishTimeline(matchId, updatedTimeline);
      setTimeline(updatedTimeline);
      window.dispatchEvent(new CustomEvent("timeline-published", { detail: { matchId } }));
    } catch (err) {
      console.error("Failed to merge sync point into timeline:", err);
    }

    onSyncConfirm(finalSeconds, previousSeconds, syncPoint);

    setStatus("READY");
    setShowConfirmation(false);

    if (usedAltRegion) {
      showToast(`⚡ Clock synchronized to ${finalStr} (using Alt Region)!`, "success");
    } else {
      showToast(`⚡ Clock synchronized to ${finalStr}!`, "success");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isCaptureOn = status !== "IDLE" && status !== "CAPTURE_ENDED" && status !== "ERROR";
  const isConfigured = Boolean(region || altRegion);

  return (
    <>
      {/* Sleek Integrated 1-Row OCR Control Toolbar */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-2.5 mb-3 shadow-xl flex items-center justify-between gap-2 font-sans select-none flex-wrap">
        
        {/* On-The-Fly OCR Status Badge (Read-only status in panel, opens Setup Modal on click) */}
        <button
          type="button"
          onClick={() => setShowSetupModal(true)}
          className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer shrink-0 ${
            onTheFlyEnabled && isCaptureOn && Boolean(region)
              ? "bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
          }`}
          title="Status On-The-Fly OCR. Klik untuk atur di Visual Clock Sync Setup."
        >
          <Zap size={13} className={onTheFlyEnabled && isCaptureOn && Boolean(region) ? "text-amber-400 fill-amber-400 animate-pulse" : "text-zinc-500"} />
          <span className="whitespace-nowrap text-[11px]">On-The-Fly OCR</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${
              onTheFlyEnabled && isCaptureOn && Boolean(region)
                ? "bg-amber-500 text-zinc-950"
                : "bg-zinc-800 text-zinc-400 border border-zinc-700/60"
            }`}
          >
            {onTheFlyEnabled && isCaptureOn && Boolean(region) ? "ON" : "OFF"}
          </span>
        </button>

        {/* Express Sync Clock Button */}
        <button
          onClick={handleExpressSyncClick}
          disabled={status === "SCANNING"}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm min-w-[120px] ${
            status === "SCANNING"
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-wait"
              : isCaptureOn && isConfigured
              ? "bg-amber-500 hover:bg-amber-400 text-zinc-950 active:scale-95 shadow-amber-500/20"
              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60"
          }`}
          title={isCaptureOn && isConfigured ? "Express Sync Clock (One-Click)" : "Click to Setup Clock Sync"}
        >
          {status === "SCANNING" ? (
            <>
              <RefreshCw size={14} className="animate-spin text-amber-400" />
              <span>Scanning...</span>
            </>
          ) : (
            <>
              <div className="relative flex items-center justify-center">
                <Camera size={15} />
                <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                  isCaptureOn && isConfigured ? "bg-emerald-400 animate-pulse" : isCaptureOn ? "bg-amber-400" : "bg-zinc-500"
                }`} />
              </div>
              <span>Sync Clock</span>
              {lastSyncPoint && (
                <span className="text-[10px] bg-black/40 text-amber-200 px-1.5 py-0.5 rounded font-mono font-bold ml-0.5">
                  {formatTime(lastSyncPoint.syncedGameClockMs / 1000)}
                </span>
              )}
            </>
          )}
        </button>

        {/* Automatic YouTube-to-Game-Clock Timeline Mapping Button */}
        <TimelineSyncPanelButton
          timeline={timeline}
          onClick={() => setShowAutoMappingModal(true)}
        />

        {/* Deteksi Roster AI Button */}
        {onOpenAILineupModal && (
          <button
            onClick={onOpenAILineupModal}
            className="py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/30 transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider shrink-0 cursor-pointer shadow-sm"
            title="Deteksi Roster Bench & No Punggung Pemain AI"
          >
            <Sparkles size={14} className="text-amber-400 animate-pulse" />
            <span className="hidden sm:inline">Roster AI</span>
          </button>
        )}

        {/* Define Area of OCR Button */}
        <button
          onClick={() => {
            if (!isCaptureOn) {
              enableCapture().then(() => {
                setTimeout(() => startCalibration("primary"), 400);
              });
            } else {
              startCalibration("primary");
            }
          }}
          className="py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/30 transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider shrink-0"
          title="Define Area of OCR (Atur Area Scan Langsung)"
        >
          <Maximize2 size={14} className="text-amber-400" />
          <span className="hidden sm:inline">Area OCR</span>
        </button>

        {/* Setup Button */}
        <button
          onClick={() => setShowSetupModal(true)}
          className="py-2 px-3 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl border border-zinc-700/60 transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider shrink-0"
          title="Configure Visual Clock Sync Setup"
        >
          <Sliders size={14} className="text-amber-400" />
          <span className="hidden sm:inline">Setup</span>
        </button>
      </div>

      {/* Automatic YouTube-to-Game-Clock Timeline Mapping Modal */}
      <AutomaticClockMappingModal
        isOpen={showAutoMappingModal}
        onClose={() => setShowAutoMappingModal(false)}
        matchId={matchId}
        videoId={activeVideoId}
        videoRef={videoRef}
        ytPlayer={ytPlayer}
        currentYoutubeTime={currentYoutubeTime}
        clockRegion={region}
        altClockRegion={altRegion}
        ytTimerRegion={ytTimerRegion}
        onEnableCapture={enableCapture}
        onOpenCalibration={() => {
          setShowAutoMappingModal(false);
          startCalibration("primary");
        }}
        onSeekToVideoTime={(sec) => {
          if (ytPlayer && typeof ytPlayer.seekTo === "function") {
            ytPlayer.seekTo(sec, true);
          }
        }}
        onTimelinePublished={async () => {
          const loaded = await TimelineStorageService.loadTimeline(matchId);
          setTimeline(loaded);
          showToast("Game Clock Timeline published and active!", "success");
        }}
      />

      {/* Setup Modal */}
      <ClockSyncSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        status={status}
        permissionBlocked={permissionBlocked}
        region={region}
        altRegion={altRegion}
        lastSyncPoint={lastSyncPoint}
        enableCapture={enableCapture}
        startCalibration={startCalibration}
        onClearAltRegion={handleClearAltRegion}
        scanClockAndReview={scanClockAndReview}
        expressMode={expressMode}
        onToggleExpressMode={toggleExpressMode}
        onTheFlyEnabled={onTheFlyEnabled}
        onToggleOnTheFly={onToggleOnTheFly}
        formatTime={formatTime}
      />

      {/* Calibration Modal / Full Screen Overlay */}
      <CalibrationModal
        isOpen={showCalibration}
        onClose={() => {
          setShowCalibration(false);
          setShowSetupModal(true); // Return to setup modal if closed/cancelled
        }}
        screenshotUrl={screenshotUrl}
        initialRegion={region}
        initialAltRegion={altRegion}
        initialYtTimerRegion={ytTimerRegion}
        calibratingType={calibratingType}
        onConfirm={handleCalibrationConfirm}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => {
          setShowConfirmation(false);
          setStatus(isConfigured && isCaptureOn ? "READY" : "IDLE");
        }}
        primaryScan={primaryScanDetail}
        altScan={altScanDetail}
        defaultUsedAlt={usedAltRegion}
        currentAppClockStr={formatTime(timeRemaining)}
        currentQuarter={currentQuarter}
        currentYoutubeTimeSec={currentYoutubeTime}
        onConfirm={handleSyncConfirm}
        onScanAgain={() => {
          setShowConfirmation(false);
          scanClockAndReview();
        }}
      />
    </>
  );
};

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { YouTubePlayer } from "react-youtube";
import {
  ClockTimeline,
  QuarterMarker,
  NormalizedClockRegion,
  RawClockScanPoint,
  ClockTimelineSegment,
  MandatoryReviewIssue,
  ScanConfig,
  EventTimelineMetadata,
  ClockStateMarker,
} from "../types";
import {
  DEFAULT_SCAN_CONFIG,
  generateClockTimeline,
  calculateGameClockFromTimeline,
} from "../services/timelineGenerationService";
import { TimelineStorageService } from "../services/timelineStorageService";
import { AdaptiveScanController, ScanProgressState } from "../services/adaptiveScanService";
import { AiBatchScanService } from "../services/aiBatchScanService";
import { buildTimelineSegments } from "../utils/segmentBuilder";

interface UseTimelineMappingProps {
  matchId: string;
  videoId?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  ytPlayer?: YouTubePlayer | null;
  currentYoutubeTime?: number;
  clockRegion?: NormalizedClockRegion | null;
  altClockRegion?: NormalizedClockRegion | null;
  ytTimerRegion?: NormalizedClockRegion | null;
  onEnableCapture?: () => Promise<void>;
}

export function useTimelineMapping({
  matchId,
  videoId,
  videoRef,
  ytPlayer,
  currentYoutubeTime = 0,
  clockRegion: propClockRegion,
  altClockRegion: propAltClockRegion,
  ytTimerRegion: propYtTimerRegion,
  onEnableCapture,
}: UseTimelineMappingProps) {
  const [timeline, setTimeline] = useState<ClockTimeline | null>(null);
  const [quarterMarkers, setQuarterMarkers] = useState<QuarterMarker[]>([
    { quarter: 1, videoStartSeconds: 0, videoEndSeconds: 600, initialGameClockMs: 600000 },
    { quarter: 2, videoStartSeconds: 700, videoEndSeconds: 1300, initialGameClockMs: 600000 },
    { quarter: 3, videoStartSeconds: 1500, videoEndSeconds: 2100, initialGameClockMs: 600000 },
    { quarter: 4, videoStartSeconds: 2300, videoEndSeconds: 2900, initialGameClockMs: 600000 },
  ]);

  const [clockRegion, setClockRegion] = useState<NormalizedClockRegion | null>(null);
  const [altClockRegion, setAltClockRegion] = useState<NormalizedClockRegion | null>(null);
  const [ytTimerRegion, setYtTimerRegion] = useState<NormalizedClockRegion | null>(null);
  const [rawPoints, setRawPoints] = useState<RawClockScanPoint[]>([]);
  const [clockStateMarkers, setClockStateMarkers] = useState<ClockStateMarker[]>([]);
  const [issues, setIssues] = useState<MandatoryReviewIssue[]>([]);
  const [scanConfig, setScanConfig] = useState<ScanConfig>(DEFAULT_SCAN_CONFIG);

  const [scanProgress, setScanProgress] = useState<ScanProgressState>({
    status: "IDLE",
    currentQuarter: 1,
    totalQuarters: 4,
    completedScanPointsCount: 0,
    totalEstimatedPointsCount: 0,
    suspiciousIntervalsCount: 0,
    currentVideoTime: 0,
  });

  const scanControllerRef = useRef<AdaptiveScanController | null>(null);

  // Load existing timeline or stored markers on mount or matchId change
  const reloadTimeline = useCallback(async () => {
    if (!matchId) return;

    const loadedMarkers = await TimelineStorageService.loadQuarterMarkers(matchId, videoId);
    if (loadedMarkers && loadedMarkers.length > 0) {
      setQuarterMarkers(loadedMarkers);
    }

    const loaded = await TimelineStorageService.loadTimeline(matchId, videoId);
    if (loaded) {
      setTimeline(loaded);
      if (loaded.quarterMarkers?.length > 0) setQuarterMarkers(loaded.quarterMarkers);
      if (propClockRegion) {
        setClockRegion(propClockRegion);
      } else if (loaded.clockRegion) {
        setClockRegion(loaded.clockRegion);
      }
      if (propAltClockRegion !== undefined) {
        setAltClockRegion(propAltClockRegion);
      } else if (loaded.altClockRegion) {
        setAltClockRegion(loaded.altClockRegion);
      }
      if (propYtTimerRegion !== undefined) {
        setYtTimerRegion(propYtTimerRegion);
      } else if (loaded.ytTimerRegion) {
        setYtTimerRegion(loaded.ytTimerRegion);
      }
      if (loaded.rawScanPoints) setRawPoints(loaded.rawScanPoints);
      if (loaded.clockStateMarkers) setClockStateMarkers(loaded.clockStateMarkers);
      if (loaded.scanConfig) setScanConfig(loaded.scanConfig);

      const { issues: loadedIssues, markers: derivedMarkers } = buildTimelineSegments(
        loaded.rawScanPoints || [],
        loaded.quarterMarkers || [],
        loaded.scanConfig || DEFAULT_SCAN_CONFIG
      );
      setIssues(loadedIssues);
      if (!loaded.clockStateMarkers || loaded.clockStateMarkers.length === 0) {
        setClockStateMarkers(derivedMarkers);
      }
    } else {
      setTimeline(null);
      setRawPoints([]);
      setClockStateMarkers([]);
      setIssues([]);
    }

    // Fallback load regions paired with matchId / videoId from localStorage if not present in timeline
    if (!loaded?.clockRegion) {
      const savedReg = localStorage.getItem(`clock_sync_region_${matchId}`) || (videoId ? localStorage.getItem(`clock_sync_region_yt_${videoId}`) : null);
      if (savedReg) {
        try { setClockRegion(JSON.parse(savedReg)); } catch (e) {}
      }
    }
    if (!loaded?.altClockRegion) {
      const savedAltReg = localStorage.getItem(`clock_sync_alt_region_${matchId}`) || (videoId ? localStorage.getItem(`clock_sync_alt_region_yt_${videoId}`) : null);
      if (savedAltReg) {
        try { setAltClockRegion(JSON.parse(savedAltReg)); } catch (e) {}
      }
    }
    if (!loaded?.ytTimerRegion) {
      const savedYtTimerReg = localStorage.getItem(`clock_sync_yt_timer_region_${matchId}`) || (videoId ? localStorage.getItem(`clock_sync_yt_timer_region_yt_${videoId}`) : null);
      if (savedYtTimerReg) {
        try { setYtTimerRegion(JSON.parse(savedYtTimerReg)); } catch (e) {}
      }
    }
  }, [matchId, videoId, propClockRegion, propAltClockRegion, propYtTimerRegion]);

  useEffect(() => {
    reloadTimeline();

    const handleUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (!customEvt.detail?.matchId || customEvt.detail.matchId === matchId) {
        reloadTimeline();
      }
    };

    window.addEventListener("timeline-updated", handleUpdate);
    window.addEventListener("timeline-published", handleUpdate);
    return () => {
      window.removeEventListener("timeline-updated", handleUpdate);
      window.removeEventListener("timeline-published", handleUpdate);
    };
  }, [matchId, reloadTimeline]);

  // Keep internal state strictly synchronized with props passed from ClockSyncPanel / Calibration
  useEffect(() => {
    if (propClockRegion) {
      setClockRegion(propClockRegion);
    }
  }, [propClockRegion]);

  useEffect(() => {
    if (propAltClockRegion !== undefined) {
      setAltClockRegion(propAltClockRegion);
    }
  }, [propAltClockRegion]);

  useEffect(() => {
    if (propYtTimerRegion !== undefined) {
      setYtTimerRegion(propYtTimerRegion);
    }
  }, [propYtTimerRegion]);

  // Save changes to localStorage as active draft/published timeline
  const persistDraft = useCallback(
    (
      newPoints: RawClockScanPoint[],
      newMarkers: QuarterMarker[],
      reg: NormalizedClockRegion | null,
      altReg: NormalizedClockRegion | null,
      customClockStateMarkers?: ClockStateMarker[],
      ytTimerReg?: NormalizedClockRegion | null
    ) => {
      TimelineStorageService.saveQuarterMarkers(matchId, newMarkers, videoId);
      if (!reg) return;

      const activeStateMarkers = customClockStateMarkers ?? clockStateMarkers;
      const effectiveYtTimerRegion = ytTimerReg !== undefined ? ytTimerReg : ytTimerRegion;

      const t = generateClockTimeline(
        matchId,
        videoId,
        newMarkers,
        reg,
        altReg,
        newPoints,
        "AUTO_WITH_REVIEW",
        timeline || undefined,
        effectiveYtTimerRegion
      );

      t.clockStateMarkers = activeStateMarkers;

      // Preserve PUBLISHED status when user edits the active timeline directly
      if (timeline?.status === "PUBLISHED") {
        t.status = "PUBLISHED";
      }

      const { issues: newIssues } = buildTimelineSegments(newPoints, newMarkers, t.scanConfig);

      setTimeline(t);
      setIssues(newIssues);
      TimelineStorageService.saveDraftTimeline(matchId, t);
    },
    [matchId, videoId, timeline, clockStateMarkers]
  );

  // Persistent setter for quarter markers
  const updateQuarterMarkers = useCallback(
    (markersOrFn: QuarterMarker[] | ((prev: QuarterMarker[]) => QuarterMarker[])) => {
      setQuarterMarkers((prev) => {
        const next = typeof markersOrFn === "function" ? markersOrFn(prev) : markersOrFn;
        TimelineStorageService.saveQuarterMarkers(matchId, next, videoId);
        persistDraft(rawPoints, next, clockRegion, altClockRegion);
        return next;
      });
    },
    [matchId, videoId, persistDraft, rawPoints, clockRegion, altClockRegion]
  );

  // Reset timeline data based on mode: 'clear' (wipe everything) or 'fresh' (wipe scan points/segments but keep regions/markers)
  const resetTimeline = useCallback((mode: 'clear' | 'fresh', target: 'all' | 'auto' | 'manual' = 'all') => {
    scanControllerRef.current?.cancel();

    if (mode === 'clear') {
      // 1. Clear LocalStorage based on mode
      TimelineStorageService.clearAllTimelineData(matchId, videoId, false);

      // 2. Clear state
      setRawPoints([]);
      setClockStateMarkers([]);
      setIssues([]);
      setScanProgress({
        status: "IDLE",
        currentQuarter: 1,
        totalQuarters: 4,
        completedScanPointsCount: 0,
        totalEstimatedPointsCount: 0,
        suspiciousIntervalsCount: 0,
        currentVideoTime: 0,
      });

      // 3. Build new timeline or clear it
      setTimeline(null);
      setClockRegion(null);
      setAltClockRegion(null);
      setQuarterMarkers([
        { quarter: 1, videoStartSeconds: 0, videoEndSeconds: 600, initialGameClockMs: 600000 },
        { quarter: 2, videoStartSeconds: 700, videoEndSeconds: 1300, initialGameClockMs: 600000 },
        { quarter: 3, videoStartSeconds: 1500, videoEndSeconds: 2100, initialGameClockMs: 600000 },
        { quarter: 4, videoStartSeconds: 2300, videoEndSeconds: 2900, initialGameClockMs: 600000 },
      ]);
      // Dispatch an event to notify other listeners (e.g. video player) to clear
      window.dispatchEvent(
        new CustomEvent("timeline-updated", {
          detail: { matchId, videoId, timeline: null },
        })
      );
    } else {
      // mode === 'fresh'
      if (target === 'all') {
        TimelineStorageService.clearAllTimelineData(matchId, videoId, true);
        
        setRawPoints([]);
        setClockStateMarkers([]);
        setIssues([]);
        setScanProgress({
          status: "IDLE",
          currentQuarter: 1,
          totalQuarters: 4,
          completedScanPointsCount: 0,
          totalEstimatedPointsCount: 0,
          suspiciousIntervalsCount: 0,
          currentVideoTime: 0,
        });

        const activeRegion = clockRegion || {
          xRatio: 0.1,
          yRatio: 0.1,
          widthRatio: 0.2,
          heightRatio: 0.1,
        };

        const emptyTimeline: ClockTimeline = {
          id: `timeline-${matchId}-${Date.now()}`,
          matchId,
          videoId,
          quarterMarkers,
          clockRegion: activeRegion,
          altClockRegion,
          rawScanPoints: [],
          derivedSegments: [],
          clockStateMarkers: [],
          scanConfig,
          status: "DRAFT",
          mode: "AUTO_WITH_REVIEW",
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setTimeline(emptyTimeline);
        TimelineStorageService.saveDraftTimeline(matchId, emptyTimeline);
      } else {
        // Selective clear
        setRawPoints((prevRaw) => {
          setClockStateMarkers((prevMarkers) => {
            let nextRaw = prevRaw;
            let nextMarkers = prevMarkers;
            
            if (target === 'auto') {
              // keep manual
              nextRaw = nextRaw.filter(p => p.source === "MANUAL");
              nextMarkers = nextMarkers.filter(m => m.source === "MANUAL");
            } else if (target === 'manual') {
              // keep auto
              nextRaw = nextRaw.filter(p => p.source !== "MANUAL");
              nextMarkers = nextMarkers.filter(m => m.source !== "MANUAL");
            }
            
            persistDraft(nextRaw, quarterMarkers, clockRegion, altClockRegion, nextMarkers);
            return nextMarkers;
          });
          
          return prevRaw.filter(p => target === 'auto' ? p.source === "MANUAL" : p.source !== "MANUAL");
        });
        
        setScanProgress({
          status: "IDLE",
          currentQuarter: 1,
          totalQuarters: 4,
          completedScanPointsCount: 0,
          totalEstimatedPointsCount: 0,
          suspiciousIntervalsCount: 0,
          currentVideoTime: 0,
        });
      }
    }
  }, [matchId, videoId, clockRegion, altClockRegion, quarterMarkers, scanConfig, persistDraft]);

  // Start automatic scan
  const startScan = useCallback(async (options: { fresh?: boolean, resetTarget?: 'all' | 'auto' | 'manual' } = {}) => {
    // 0. Cancel any active running scan first
    scanControllerRef.current?.cancel();

    let videoEl = videoRef?.current || (document.querySelector("video") as HTMLVideoElement | null);

    let currentRawPoints = rawPoints;
    if (options.fresh) {
      if (options.resetTarget === 'auto') {
        currentRawPoints = rawPoints.filter(p => p.source === "MANUAL");
      } else if (options.resetTarget === 'manual') {
        currentRawPoints = rawPoints.filter(p => p.source !== "MANUAL");
      } else {
        currentRawPoints = [];
      }
      resetTimeline('fresh', options.resetTarget || 'all');
    }

    if (!ytPlayer) {
      const msg = "YouTube Player belum terhubung. Silakan putar/aktifkan video YouTube terlebih dahulu.";
      setScanProgress((prev) => ({ ...prev, status: "ERROR", errorMessage: msg }));
      throw new Error(msg);
    }

    // Always prioritize live prop region passed from ClockSyncPanel / Calibration
    let effectiveRegion = propClockRegion || clockRegion;
    if (!effectiveRegion) {
      const savedReg = localStorage.getItem(`clock_sync_region_${matchId}`) || (videoId ? localStorage.getItem(`clock_sync_region_yt_${videoId}`) : null);
      if (savedReg) {
        try {
          effectiveRegion = JSON.parse(savedReg);
          setClockRegion(effectiveRegion);
        } catch (e) {}
      }
    }

    let effectiveAltRegion = propAltClockRegion !== undefined ? propAltClockRegion : altClockRegion;
    if (!effectiveAltRegion && effectiveAltRegion !== null) {
      const savedAltReg = localStorage.getItem(`clock_sync_alt_region_${matchId}`) || (videoId ? localStorage.getItem(`clock_sync_alt_region_yt_${videoId}`) : null);
      if (savedAltReg) {
        try {
          effectiveAltRegion = JSON.parse(savedAltReg);
          setAltClockRegion(effectiveAltRegion);
        } catch (e) {}
      }
    }

    let effectiveYtTimerRegion = propYtTimerRegion !== undefined ? propYtTimerRegion : ytTimerRegion;
    if (!effectiveYtTimerRegion && effectiveYtTimerRegion !== null) {
      const savedYtTimerReg = localStorage.getItem(`clock_sync_yt_timer_region_${matchId}`) || (videoId ? localStorage.getItem(`clock_sync_yt_timer_region_yt_${videoId}`) : null);
      if (savedYtTimerReg) {
        try {
          effectiveYtTimerRegion = JSON.parse(savedYtTimerReg);
          setYtTimerRegion(effectiveYtTimerRegion);
        } catch (e) {}
      }
    }

    if (!effectiveRegion) {
      const msg = "Area Game Clock (Primary) belum dikalibrasi. Silakan kalibrasi area clock (Calibrate / Select Clock Area).";
      setScanProgress((prev) => ({ ...prev, status: "ERROR", errorMessage: msg }));
      throw new Error(msg);
    }

    if (!videoEl && onEnableCapture) {
      try {
        await onEnableCapture();
        videoEl = videoRef?.current || (document.querySelector("video") as HTMLVideoElement | null);
      } catch (e: any) {
        const msg = e?.message || "Izin akses Screen Capture ditolak atau dibatalkan.";
        setScanProgress((prev) => ({ ...prev, status: "ERROR", errorMessage: msg }));
        throw new Error(msg);
      }
    }

    if (!videoEl) {
      const msg = "Tangkapan video belum aktif. Silakan izinkan Screen Capture saat diminta.";
      setScanProgress((prev) => ({ ...prev, status: "ERROR", errorMessage: msg }));
      throw new Error(msg);
    }

    if (scanConfig.engine === "AI_VISION") {
      setScanProgress((prev) => ({
        ...prev,
        status: "SCANNING_COARSE",
        errorMessage: undefined,
      }));

      try {
        const result = await AiBatchScanService.executeAiBatchScan({
          quarterMarkers,
          player: ytPlayer,
          videoEl,
          clockRegion: effectiveRegion,
          altClockRegion: effectiveAltRegion,
          ytTimerRegion: effectiveYtTimerRegion,
          onProgress: (prog) => {
            setScanProgress((prev) => ({
              ...prev,
              status: prog.status === "COMPLETED" ? "COMPLETED" : "SCANNING_COARSE",
              currentQuarter: Number(prog.currentQuarter.replace(/[^0-9]/g, "")) || 1,
              currentVideoTime: prog.currentVideoTime,
              completedScanPointsCount: prog.processedFrames,
              totalEstimatedPointsCount: prog.totalFrames,
            }));
          },
        });

        const mergedPoints = [...currentRawPoints.filter((p) => p.source === "MANUAL"), ...result.points].sort(
          (a, b) => a.quarter - b.quarter || a.videoTimeSeconds - b.videoTimeSeconds
        );

        setRawPoints(mergedPoints);

        if (result.clockStateMarkers.length > 0) {
          const convertedMarkers: ClockStateMarker[] = result.clockStateMarkers.map((m) => {
            return {
              id: m.id,
              quarter: m.quarter,
              videoTimeSeconds: m.videoTimeSeconds,
              gameClockMs: m.gameClockMs,
              action: m.action,
              source: "AUTO",
              confidence: m.confidence || 95,
            };
          });

          setClockStateMarkers((prev) => [...prev, ...convertedMarkers]);
        }

        persistDraft(mergedPoints, quarterMarkers, effectiveRegion!, effectiveAltRegion);

        setScanProgress((prev) => ({
          ...prev,
          status: "COMPLETED",
          completedScanPointsCount: result.points.length,
          totalEstimatedPointsCount: result.points.length,
        }));
        return;
      } catch (aiErr: any) {
        setScanProgress((prev) => ({
          ...prev,
          status: "ERROR",
          errorMessage: aiErr?.message || "AI Vision Scan gagal dijalankan.",
        }));
        throw aiErr;
      }
    }

    const controller = new AdaptiveScanController();
    scanControllerRef.current = controller;
    controller.setExistingPoints(currentRawPoints);

    setScanProgress((prev) => ({ ...prev, status: "SCANNING_COARSE" }));

    try {
      await controller.runFullAdaptiveScan(
        ytPlayer,
        videoEl,
        effectiveRegion!,
        effectiveAltRegion,
        effectiveYtTimerRegion,
        quarterMarkers,
        scanConfig,
        {
          onProgress: (prog) => {
            setScanProgress(prog);
          },
          onPointCaptured: (pt) => {
            setRawPoints((prev) => {
              const filtered = prev.filter(
                (p) => !(p.quarter === pt.quarter && Math.round(p.videoTimeSeconds) === Math.round(pt.videoTimeSeconds))
              );
              return [...filtered, pt].sort(
                (a, b) => a.quarter - b.quarter || a.videoTimeSeconds - b.videoTimeSeconds
              );
            });
          },
          onComplete: (completedPoints) => {
            setRawPoints(completedPoints);
            persistDraft(completedPoints, quarterMarkers, effectiveRegion!, effectiveAltRegion);
          },
          onError: (errMsg) => {
            setScanProgress((prev) => ({ ...prev, status: "ERROR", errorMessage: errMsg }));
          },
        }
      );
    } catch (scanErr: any) {
      setScanProgress((prev) => ({
        ...prev,
        status: "ERROR",
        errorMessage: scanErr?.message || "Pemindaian terhenti karena kendala koneksi atau player.",
      }));
      throw scanErr;
    }
  }, [
    ytPlayer,
    videoRef,
    clockRegion,
    altClockRegion,
    quarterMarkers,
    scanConfig,
    rawPoints,
    persistDraft,
    onEnableCapture,
    matchId,
    videoId,
    timeline,
    resetTimeline,
  ]);

  const pauseScan = useCallback(() => {
    scanControllerRef.current?.pause();
  }, []);

  const resumeScan = useCallback(() => {
    scanControllerRef.current?.resume();
  }, []);

  const cancelScan = useCallback(() => {
    scanControllerRef.current?.cancel();
    setScanProgress((prev) => ({ ...prev, status: "CANCELLED" }));
  }, []);

  // Update a single raw scan point (manual override / correction)
  const updateScanPoint = useCallback(
    (pointId: string, updates: Partial<RawClockScanPoint>) => {
      setRawPoints((prev) => {
        const next = prev.map((p) => (p.id === pointId ? { ...p, ...updates } : p));
        persistDraft(next, quarterMarkers, clockRegion, altClockRegion);
        return next;
      });
    },
    [persistDraft, quarterMarkers, clockRegion, altClockRegion]
  );

  // Delete a raw scan point
  const deleteScanPoint = useCallback(
    (pointId: string) => {
      setRawPoints((prev) => {
        const next = prev.filter((p) => p.id !== pointId);
        persistDraft(next, quarterMarkers, clockRegion, altClockRegion);
        return next;
      });
    },
    [persistDraft, quarterMarkers, clockRegion, altClockRegion]
  );

  // Add a manual Start/Stop Clock Marker
  const addClockStateMarker = useCallback(
    (marker: Omit<ClockStateMarker, "id">) => {
      const newMarker: ClockStateMarker = {
        ...marker,
        id: `m-marker-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      };
      setClockStateMarkers((prev) => {
        const next = [...prev, newMarker].sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);
        persistDraft(rawPoints, quarterMarkers, clockRegion, altClockRegion, next);
        return next;
      });
    },
    [persistDraft, rawPoints, quarterMarkers, clockRegion, altClockRegion]
  );

  // Update a Clock State Marker
  const updateClockStateMarker = useCallback(
    (markerId: string, updates: Partial<ClockStateMarker>) => {
      setClockStateMarkers((prev) => {
        const next = prev.map((m) => (m.id === markerId ? { ...m, ...updates } : m));
        persistDraft(rawPoints, quarterMarkers, clockRegion, altClockRegion, next);
        return next;
      });
    },
    [persistDraft, rawPoints, quarterMarkers, clockRegion, altClockRegion]
  );

  // Delete a Clock State Marker
  const deleteClockStateMarker = useCallback(
    (markerId: string) => {
      setClockStateMarkers((prev) => {
        const next = prev.filter((m) => m.id !== markerId);
        persistDraft(rawPoints, quarterMarkers, clockRegion, altClockRegion, next);
        return next;
      });
    },
    [persistDraft, rawPoints, quarterMarkers, clockRegion, altClockRegion]
  );

  // Publish active timeline
  const publishTimeline = useCallback(async () => {
    if (!timeline) return null;
    const pub = await TimelineStorageService.publishTimeline(matchId, timeline);
    setTimeline(pub);
    return pub;
  }, [matchId, timeline]);

  // Active playback mapped metadata
  const currentMappedMetadata: EventTimelineMetadata | null = timeline?.status === "PUBLISHED"
    ? calculateGameClockFromTimeline(timeline, currentYoutubeTime)
    : null;

  // Derived active segments for UI based purely on state, ensuring synchronization
  const activeSegments = useMemo(() => {
    return buildTimelineSegments(rawPoints, quarterMarkers, scanConfig).segments;
  }, [rawPoints, quarterMarkers, scanConfig]);

  return {
    timeline,
    quarterMarkers,
    setQuarterMarkers: updateQuarterMarkers,
    clockRegion,
    setClockRegion,
    altClockRegion,
    setAltClockRegion,
    rawPoints,
    clockStateMarkers,
    addClockStateMarker,
    updateClockStateMarker,
    deleteClockStateMarker,
    issues,
    activeSegments,
    scanConfig,
    setScanConfig,
    scanProgress,
    startScan,
    pauseScan,
    resumeScan,
    cancelScan,
    updateScanPoint,
    deleteScanPoint,
    resetTimeline,
    publishTimeline,
    currentMappedMetadata,
  };
}

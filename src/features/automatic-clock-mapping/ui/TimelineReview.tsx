import React, { useState } from "react";
import {
  Play,
  Edit2,
  Trash2,
  Check,
  AlertTriangle,
  RotateCcw,
  Eye,
  CheckCircle,
  Plus,
  PlayCircle,
  PauseCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Scan,
} from "lucide-react";
import {
  ClockTimeline,
  RawClockScanPoint,
  ClockTimelineSegment,
  QuarterMarker,
  ClockStateMarker,
} from "../types";
import { formatSecondsToTimecode, formatMsToClockString, parseClockStringToMs, formatSecondsToMMSS } from "../utils/clockParser";

import { useToast } from "../../../core/contexts/ToastContext";

interface TimelineReviewProps {
  timeline: ClockTimeline | null;
  rawPoints: RawClockScanPoint[];
  quarterMarkers: QuarterMarker[];
  activeSegments: ClockTimelineSegment[];
  clockStateMarkers?: ClockStateMarker[];
  currentYoutubeTime?: number;
  onSeekToVideoTime: (seconds: number) => void;
  onUpdatePoint: (pointId: string, updates: Partial<RawClockScanPoint>) => void;
  onDeletePoint: (pointId: string) => void;
  onResetTimeline?: (mode: 'clear' | 'fresh') => void;
  onAddClockStateMarker?: (marker: Omit<ClockStateMarker, "id">) => void;
  onUpdateClockStateMarker?: (markerId: string, updates: Partial<ClockStateMarker>) => void;
  onDeleteClockStateMarker?: (markerId: string) => void;
  onPublish: () => void;
}

function getPointClockStateInfo(
  pt: RawClockScanPoint,
  prevPt: RawClockScanPoint | null
): {
  label: string;
  badgeColor: string;
  description: string;
  gapText: string;
} {
  if (!prevPt) {
    return {
      label: "▶ START / INITIAL",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
      description: "Point Awal Kuarter",
      gapText: "Start Q",
    };
  }

  const videoDelta = Math.max(0, pt.videoTimeSeconds - prevPt.videoTimeSeconds);
  const gapLabel = pt.scanIntervalSeconds
    ? `Δ ${pt.scanIntervalSeconds}s`
    : `Δ ${Math.round(videoDelta)}s`;

  if (
    pt.status === "INVALID" ||
    prevPt.status === "INVALID" ||
    pt.detectedGameClockMs === null ||
    prevPt.detectedGameClockMs === null
  ) {
    return {
      label: "❓ UNKNOWN",
      badgeColor: "bg-zinc-500/10 text-zinc-500 border-zinc-500/30",
      description: "OCR Invalid / Incomplete Data",
      gapText: gapLabel,
    };
  }

  const clockDecreaseSec = (prevPt.detectedGameClockMs - pt.detectedGameClockMs) / 1000;

  // Case 1: Replay or unexpected clock increase
  if (clockDecreaseSec < -1.0) {
    return {
      label: "↺ REPLAY / JUMP",
      badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
      description: `Clock bertambah (+${Math.abs(clockDecreaseSec).toFixed(1)}s)`,
      gapText: gapLabel,
    };
  }

  // Case 2: Clock Stopped (STOP) -> Clock change <= 0.5s while video time progressed
  if (Math.abs(clockDecreaseSec) <= 0.5) {
    return {
      label: "⏹ STOP CLOCK",
      badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
      description: `Clock mati/stagnan (${Math.round(videoDelta)}s video)`,
      gapText: gapLabel,
    };
  }

  // Case 3: Clock Running normally (START / RUNNING)
  const diffFromVideoDelta = Math.abs(videoDelta - clockDecreaseSec);
  if (diffFromVideoDelta <= 2.5 || (clockDecreaseSec > 0.5 && diffFromVideoDelta <= videoDelta * 0.25)) {
    return {
      label: "▶ START / RUNNING",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      description: `Clock jalan (-${clockDecreaseSec.toFixed(1)}s / ${Math.round(videoDelta)}s video)`,
      gapText: gapLabel,
    };
  }

  // Case 4: Partial / Mixed (e.g. 30s scrubbed, but clock only ran for 10s and stopped for 20s)
  const stopSec = Math.max(0, videoDelta - clockDecreaseSec);
  return {
    label: "⏯ STOP-START MIXED",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    description: `Jalan ${clockDecreaseSec.toFixed(1)}s, Stop ${stopSec.toFixed(1)}s`,
    gapText: gapLabel,
  };
}

export const TimelineReview: React.FC<TimelineReviewProps> = ({
  timeline,
  rawPoints,
  quarterMarkers,
  activeSegments,
  clockStateMarkers = [],
  currentYoutubeTime = 0,
  onSeekToVideoTime,
  onUpdatePoint,
  onDeletePoint,
  onResetTimeline,
  onAddClockStateMarker,
  onUpdateClockStateMarker,
  onDeleteClockStateMarker,
  onPublish,
}) => {
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [editingClockStr, setEditingClockStr] = useState<string>("");
  const [pointFilter, setPointFilter] = useState<"ALL" | "INVALID" | "VALID">("ALL");

  // Zoom lightbox for crop image inspection
  const [selectedZoomPoint, setSelectedZoomPoint] = useState<RawClockScanPoint | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(3); // Default 3x zoom for small OCR crops

  const { showToast } = useToast();

  const [newMarkerClockStr, setNewMarkerClockStr] = useState<string>("10:00");
  const [newMarkerAction, setNewMarkerAction] = useState<"START_CLOCK" | "STOP_CLOCK">("START_CLOCK");

  const activeQuarterPointsAll = rawPoints
    .filter((p) => p.quarter === selectedQuarter)
    .sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);

  const activeQuarterPoints = activeQuarterPointsAll.filter((p) => {
    if (pointFilter === "INVALID") {
      return p.status !== "VALID";
    }
    if (pointFilter === "VALID") {
      return p.status === "VALID";
    }
    return true;
  });

  const activeQuarterSegments = activeSegments
    .filter((s) => s.quarter === selectedQuarter)
    .sort((a, b) => a.videoStartSeconds - b.videoStartSeconds);

  const activeQuarterMarkers = clockStateMarkers
    .filter((m) => m.quarter === selectedQuarter)
    .sort((a, b) => a.videoTimeSeconds - b.videoTimeSeconds);

  const handleStartEdit = (pt: RawClockScanPoint) => {
    setEditingPointId(pt.id);
    setEditingClockStr(formatMsToClockString(pt.detectedGameClockMs));
  };

  const handleSaveEdit = (ptId: string) => {
    const parsedMs = parseClockStringToMs(editingClockStr);
    if (parsedMs !== null) {
      onUpdatePoint(ptId, {
        detectedGameClockMs: parsedMs,
        normalizedOCRText: editingClockStr,
        status: "VALID",
      });
    }
    setEditingPointId(null);
  };

  const handleAddMarker = () => {
    if (!onAddClockStateMarker) return;
    const parsedMs = parseClockStringToMs(newMarkerClockStr) ?? 600000;
    onAddClockStateMarker({
      quarter: selectedQuarter,
      videoTimeSeconds: currentYoutubeTime,
      gameClockMs: parsedMs,
      action: newMarkerAction,
      source: "MANUAL",
      confidence: 100,
    });
  };

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* Quarter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-zinc-200 dark:border-zinc-800">
        {quarterMarkers.map((qm) => {
          const isActive = qm.quarter === selectedQuarter;
          const qPointsCount = rawPoints.filter((p) => p.quarter === qm.quarter).length;

          return (
            <button
              key={`q-tab-${qm.quarter}`}
              onClick={() => setSelectedQuarter(qm.quarter)}
              className={`px-3 py-2 rounded-xl font-extrabold flex items-center gap-2 transition-all ${
                isActive
                  ? "bg-amber-500 text-white shadow-md"
                  : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              Quarter {qm.quarter}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  isActive ? "bg-white/20 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {qPointsCount} pts
              </span>
            </button>
          );
        })}
      </div>

      {/* Clock State Transitions (START_CLOCK / STOP_CLOCK Markers) */}
      <div className="p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800 text-zinc-100 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <PlayCircle size={14} /> Explicit Start / Stop Clock Markers (Q{selectedQuarter})
          </h4>

          <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <select
              value={newMarkerAction}
              onChange={(e) => setNewMarkerAction(e.target.value as "START_CLOCK" | "STOP_CLOCK")}
              className="bg-zinc-800 text-zinc-100 text-[10px] font-bold px-2 py-1 rounded border border-zinc-700"
            >
              <option value="START_CLOCK">START CLOCK</option>
              <option value="STOP_CLOCK">STOP CLOCK</option>
            </select>
            <input
              type="text"
              value={newMarkerClockStr}
              onChange={(e) => setNewMarkerClockStr(e.target.value)}
              placeholder="10:00"
              className="w-16 bg-zinc-800 text-zinc-100 font-mono text-[10px] px-2 py-1 rounded border border-zinc-700 text-center"
            />
            <button
              onClick={handleAddMarker}
              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded text-[10px] flex items-center gap-1 transition-colors"
            >
              <Plus size={12} /> Add Marker @ {formatSecondsToTimecode(currentYoutubeTime)}
            </button>
          </div>
        </div>

        {activeQuarterMarkers.length === 0 ? (
          <p className="text-zinc-500 italic py-1 text-center text-[11px]">
            No clock state markers for Quarter {selectedQuarter}. Add manual markers or scan video.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {activeQuarterMarkers.map((m) => {
              const isStart = m.action === "START_CLOCK";
              return (
                <div
                  key={m.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 font-mono ${
                    isStart
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSeekToVideoTime(m.videoTimeSeconds)}
                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 transition-colors"
                      title="Jump to video timestamp"
                    >
                      <Play size={12} />
                    </button>
                    <span className="font-bold">{formatSecondsToTimecode(m.videoTimeSeconds)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-black bg-zinc-900 px-2 py-0.5 rounded text-white">
                      {formatMsToClockString(m.gameClockMs)}
                    </span>
                    <button
                      onClick={() =>
                        onUpdateClockStateMarker?.(m.id, {
                          action: isStart ? "STOP_CLOCK" : "START_CLOCK",
                          source: "MANUAL",
                        })
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide cursor-pointer ${
                        isStart ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                      }`}
                    >
                      {m.action === "START_CLOCK" ? "START" : "STOP"}
                    </button>

                    {onDeleteClockStateMarker && (
                      <button
                        onClick={() => onDeleteClockStateMarker(m.id)}
                        className="p-1 text-red-400 hover:text-red-300"
                        title="Delete marker"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Segment Visualization Bar */}
      <div className="p-3.5 bg-zinc-900 rounded-2xl border border-zinc-800 text-zinc-100 flex flex-col gap-2">
        <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-zinc-400">
          Derived Timeline Segments (Q{selectedQuarter})
        </h4>

        {activeQuarterSegments.length === 0 ? (
          <p className="text-zinc-500 italic py-2 text-center">No segments generated yet for Quarter {selectedQuarter}.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {activeQuarterSegments.map((seg) => {
              const isRunning = seg.clockState === "RUNNING";
              const isStopped = seg.clockState === "STOPPED";

              return (
                <div
                  key={seg.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                    isRunning
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : isStopped
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-red-500/10 border-red-500/30 text-red-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono font-bold">
                    <button
                      onClick={() => onSeekToVideoTime(seg.videoStartSeconds)}
                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 transition-colors"
                      title="Jump to segment start"
                    >
                      <Play size={12} />
                    </button>
                    <span>
                      {formatSecondsToTimecode(seg.videoStartSeconds)} &rarr; {formatSecondsToTimecode(seg.videoEndSeconds)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-extrabold text-white bg-zinc-800 px-2 py-0.5 rounded">
                      {formatMsToClockString(seg.gameClockStartMs)}
                      {isRunning && ` → ${formatMsToClockString(seg.gameClockEndMs)}`}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        isRunning
                          ? "bg-emerald-500/20 text-emerald-400"
                          : isStopped
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {seg.clockState}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Raw Scan Points Table */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="font-extrabold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            OCR Scan Points Log (Q{selectedQuarter})
          </h4>

          <div className="flex items-center gap-2">
            {/* Filter Toggle Buttons */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-[10px] font-bold">
              <button
                onClick={() => setPointFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  pointFilter === "ALL"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                All ({activeQuarterPointsAll.length})
              </button>
              <button
                onClick={() => setPointFilter("INVALID")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  pointFilter === "INVALID"
                    ? "bg-red-500 text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                Invalid / Review ({activeQuarterPointsAll.filter((p) => p.status !== "VALID").length})
              </button>
              <button
                onClick={() => setPointFilter("VALID")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  pointFilter === "VALID"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                Valid ({activeQuarterPointsAll.filter((p) => p.status === "VALID").length})
              </button>
            </div>

            {/* Reset All Points Button */}
            {onResetTimeline && (
              <button
                onClick={() => onResetTimeline('clear')}
                className="px-3 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors"
                title="Hapus semua OCR scan points dan reset hasil scan"
              >
                <RotateCcw size={12} /> Reset Scan Markers
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[40vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-zinc-100 dark:bg-zinc-800/90 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold sticky top-0 z-10">
              <tr>
                <th className="p-2.5">YT Time</th>
                <th className="p-2.5">Crop</th>
                <th className="p-2.5">OCR Raw</th>
                <th className="p-2.5">Parsed Clock</th>
                <th className="p-2.5">Clock State / Info</th>
                <th className="p-2.5">Confidence</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900/60 font-mono">
              {activeQuarterPoints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-zinc-500 italic">
                    No scan points captured for Quarter {selectedQuarter} yet.
                  </td>
                </tr>
              ) : (
                activeQuarterPoints.map((pt) => {
                  const isEditing = editingPointId === pt.id;

                  const ptIdx = activeQuarterPointsAll.findIndex((p) => p.id === pt.id);
                  const prevPt = ptIdx > 0 ? activeQuarterPointsAll[ptIdx - 1] : null;
                  const clockInfo = getPointClockStateInfo(pt, prevPt);

                  return (
                    <tr key={pt.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="p-2.5 font-bold">
                        <button
                          onClick={() => onSeekToVideoTime(pt.videoTimeSeconds)}
                          className="hover:text-amber-500 flex items-center gap-1"
                        >
                          <Play size={12} className="text-amber-500 shrink-0" />
                          {formatSecondsToTimecode(pt.videoTimeSeconds)}
                        </button>
                      </td>

                      <td className="p-2.5">
                        <button
                          onClick={() => {
                            setSelectedZoomPoint(pt);
                            setZoomScale(3);
                          }}
                          className="group relative inline-flex items-center gap-1.5 p-1 rounded bg-zinc-900 border border-zinc-700 hover:border-amber-400 hover:bg-zinc-800 transition-all cursor-pointer shadow-sm"
                          title="Klik untuk Inspeksi Bandingkan Primary vs Alt Crop"
                        >
                          <div className="flex items-center gap-1">
                            {/* Primary Thumbnail */}
                            <div className="relative">
                              <img
                                src={pt.primaryProcessedUrl || pt.primaryCropUrl || pt.processedCropUrl || pt.rawCropUrl}
                                alt="Primary Crop"
                                className={`h-6 object-contain rounded bg-black/90 px-1 ${
                                  pt.selectedRegionType !== "ALT" ? "border border-amber-400" : "opacity-60"
                                }`}
                              />
                              <span className="absolute -top-1 -left-1 px-1 bg-amber-500 text-black text-[8px] font-black rounded-full">
                                P
                              </span>
                            </div>

                            {/* Alt Thumbnail (if available) */}
                            {(pt.altCropUrl || pt.altProcessedUrl) && (
                              <div className="relative">
                                <img
                                  src={pt.altProcessedUrl || pt.altCropUrl}
                                  alt="Alt Crop"
                                  className={`h-6 object-contain rounded bg-black/90 px-1 ${
                                    pt.selectedRegionType === "ALT" ? "border border-emerald-400" : "opacity-60"
                                  }`}
                                />
                                <span className="absolute -top-1 -left-1 px-1 bg-emerald-500 text-black text-[8px] font-black rounded-full">
                                  A
                                </span>
                              </div>
                            )}

                            {/* YT Timer Thumbnail (if available) */}
                            {(pt.ytTimerCropUrl || pt.ytTimerProcessedUrl) && (
                              <div
                                className="relative"
                                title={`YT Timer OCR: ${pt.ytTimerRawOCRText || "--"} (${pt.ytTimerOcrSeconds !== null && pt.ytTimerOcrSeconds !== undefined ? formatSecondsToMMSS(pt.ytTimerOcrSeconds) : "--"})`}
                              >
                                <img
                                  src={pt.ytTimerProcessedUrl || pt.ytTimerCropUrl}
                                  alt="YT Timer Crop"
                                  className="h-6 object-contain rounded bg-black/90 px-1 border border-purple-400/80"
                                />
                                <span className="absolute -top-1 -left-1 px-1 bg-purple-500 text-white text-[8px] font-black rounded-full">
                                  YT
                                </span>
                              </div>
                            )}
                          </div>

                          <ZoomIn size={12} className="text-amber-400 opacity-60 group-hover:opacity-100 shrink-0 ml-1" />
                        </button>
                      </td>

                      <td className="p-2.5 text-zinc-500 dark:text-zinc-400 text-[11px]">
                        {pt.rawOCRText || "--"}
                      </td>

                      <td className="p-2.5 font-extrabold text-amber-500">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingClockStr}
                              onChange={(e) => setEditingClockStr(e.target.value)}
                              className="w-16 px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-amber-500 font-mono text-xs text-zinc-900 dark:text-zinc-100"
                            />
                            <button
                              onClick={() => handleSaveEdit(pt.id)}
                              className="p-1 rounded bg-amber-500 text-white"
                            >
                              <Check size={12} />
                            </button>
                          </div>
                        ) : (
                          <span>{formatMsToClockString(pt.detectedGameClockMs)}</span>
                        )}
                      </td>

                      {/* Clock State / Info Column */}
                      <td className="p-2.5 font-sans">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold inline-flex items-center gap-1 ${clockInfo.badgeColor}`}>
                              {clockInfo.label}
                            </span>
                            <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                              {clockInfo.gapText}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[150px]" title={clockInfo.description}>
                            {clockInfo.description}
                          </span>
                        </div>
                      </td>

                      <td className="p-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            pt.confidence >= 80
                              ? "bg-emerald-500/10 text-emerald-500"
                              : pt.confidence >= 60
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {Math.round(pt.confidence)}%
                        </span>
                      </td>

                      <td className="p-2.5 font-bold text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded uppercase ${
                            pt.status === "VALID"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : pt.status === "LOW_CONFIDENCE"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {pt.status}
                        </span>
                      </td>

                      <td className="p-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleStartEdit(pt)}
                            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                            title="Edit Clock"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => onDeletePoint(pt.id)}
                            className="p-1 rounded hover:bg-red-500/10 text-red-500"
                            title="Delete Scan Point"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Publish Button */}
      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
        <button
          onClick={onPublish}
          className="px-6 py-2.5 rounded-xl font-extrabold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg flex items-center gap-2 text-xs uppercase tracking-wider transition-colors"
        >
          <CheckCircle size={16} /> Publish Game Clock Timeline
        </button>
      </div>

      {/* OCR Crop Zoom Lightbox Modal */}
      {selectedZoomPoint && (
        <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col text-white">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Maximize2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-display font-black italic uppercase text-white flex items-center gap-2">
                    INSPEKSI CROP OCR LOG
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Video Time: <strong className="text-amber-400 font-mono">{formatSecondsToTimecode(selectedZoomPoint.videoTimeSeconds)}</strong> | Status: <strong className={selectedZoomPoint.status === "VALID" ? "text-emerald-400" : "text-rose-400"}>{selectedZoomPoint.status}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 p-1 bg-zinc-800 rounded-xl border border-zinc-700 mr-2">
                  <button
                    onClick={() => setZoomScale((prev) => Math.max(1, prev - 1))}
                    disabled={zoomScale <= 1}
                    className="p-1.5 hover:bg-zinc-700 text-zinc-300 rounded-lg disabled:opacity-30 transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="text-xs font-mono font-bold text-amber-400 px-2 min-w-[45px] text-center">
                    {zoomScale * 100}%
                  </span>
                  <button
                    onClick={() => setZoomScale((prev) => Math.min(10, prev + 1))}
                    disabled={zoomScale >= 10}
                    className="p-1.5 hover:bg-zinc-700 text-zinc-300 rounded-lg disabled:opacity-30 transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    onClick={() => setZoomScale(3)}
                    className="px-2 py-1 text-[10px] font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg transition-colors"
                  >
                    Reset (3x)
                  </button>
                </div>

                <button
                  onClick={() => setSelectedZoomPoint(null)}
                  className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body: Side-by-side Primary vs Alternative vs YT Timer Crop Inspection */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-black/40">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Primary Region Card */}
                <div className={`flex flex-col gap-2 p-4 rounded-2xl border shadow-inner ${
                  selectedZoomPoint.selectedRegionType !== "ALT" 
                    ? "bg-amber-950/20 border-amber-500/50" 
                    : "bg-zinc-950/80 border-zinc-800 opacity-80"
                }`}>
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Scan size={14} /> PRIMARY REGION CROP
                    </span>
                    {selectedZoomPoint.selectedRegionType !== "ALT" ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-extrabold uppercase">
                        ★ WINNING
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-500">Secondary</span>
                    )}
                  </div>

                  <div className="w-full h-36 overflow-auto bg-black/90 rounded-xl border border-zinc-800 flex items-center justify-center p-3">
                    {selectedZoomPoint.primaryProcessedUrl || selectedZoomPoint.primaryCropUrl || selectedZoomPoint.processedCropUrl ? (
                      <img
                        src={selectedZoomPoint.primaryProcessedUrl || selectedZoomPoint.primaryCropUrl || selectedZoomPoint.processedCropUrl}
                        alt="Primary Crop"
                        style={{
                          transform: `scale(${zoomScale})`,
                          transformOrigin: "center center",
                          imageRendering: "pixelated",
                        }}
                        className="max-h-20 object-contain transition-transform duration-150"
                      />
                    ) : (
                      <span className="text-xs text-zinc-500 italic">No primary crop available</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mt-1 pt-2 border-t border-zinc-800">
                    <div>
                      <span className="text-zinc-500 text-[9px] uppercase font-bold block">Raw OCR Text</span>
                      <span className="text-zinc-200 font-bold">
                        "{selectedZoomPoint.primaryRawOCRText || selectedZoomPoint.rawOCRText || "--"}"
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[9px] uppercase font-bold block">Parsed Value</span>
                      <span className="text-amber-400 font-black">
                        {formatMsToClockString(selectedZoomPoint.primaryGameClockMs ?? selectedZoomPoint.detectedGameClockMs)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Alternative Region Card */}
                <div className={`flex flex-col gap-2 p-4 rounded-2xl border shadow-inner ${
                  selectedZoomPoint.selectedRegionType === "ALT" 
                    ? "bg-emerald-950/20 border-emerald-500/50" 
                    : "bg-zinc-950/80 border-zinc-800 opacity-80"
                }`}>
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Scan size={14} /> ALT REGION CROP
                    </span>
                    {selectedZoomPoint.selectedRegionType === "ALT" ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-extrabold uppercase">
                        ★ WINNING
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-500">Secondary</span>
                    )}
                  </div>

                  <div className="w-full h-36 overflow-auto bg-black/90 rounded-xl border border-zinc-800 flex items-center justify-center p-3">
                    {selectedZoomPoint.altProcessedUrl || selectedZoomPoint.altCropUrl ? (
                      <img
                        src={selectedZoomPoint.altProcessedUrl || selectedZoomPoint.altCropUrl}
                        alt="Alt Crop"
                        style={{
                          transform: `scale(${zoomScale})`,
                          transformOrigin: "center center",
                          imageRendering: "pixelated",
                        }}
                        className="max-h-20 object-contain transition-transform duration-150"
                      />
                    ) : (
                      <span className="text-xs text-zinc-500 italic">No alternative region configured</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mt-1 pt-2 border-t border-zinc-800">
                    <div>
                      <span className="text-zinc-500 text-[9px] uppercase font-bold block">Raw OCR Text</span>
                      <span className="text-zinc-200 font-bold">
                        "{selectedZoomPoint.altRawOCRText || "--"}"
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[9px] uppercase font-bold block">Parsed Value</span>
                      <span className="text-emerald-400 font-black">
                        {formatMsToClockString(selectedZoomPoint.altGameClockMs ?? null)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* YT Timer Region Card (Purple) */}
                <div className="flex flex-col gap-2 p-4 rounded-2xl border shadow-inner bg-purple-950/20 border-purple-500/50">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Scan size={14} /> YT TIMER CROSS-CHECK
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-extrabold uppercase">
                      REFERENCE
                    </span>
                  </div>

                  <div className="w-full h-36 overflow-auto bg-black/90 rounded-xl border border-zinc-800 flex items-center justify-center p-3">
                    {selectedZoomPoint.ytTimerProcessedUrl || selectedZoomPoint.ytTimerCropUrl ? (
                      <img
                        src={selectedZoomPoint.ytTimerProcessedUrl || selectedZoomPoint.ytTimerCropUrl}
                        alt="YT Timer Crop"
                        style={{
                          transform: `scale(${zoomScale})`,
                          transformOrigin: "center center",
                          imageRendering: "pixelated",
                        }}
                        className="max-h-20 object-contain transition-transform duration-150"
                      />
                    ) : (
                      <span className="text-xs text-zinc-500 italic">No YT timer region configured</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mt-1 pt-2 border-t border-zinc-800">
                    <div>
                      <span className="text-zinc-500 text-[9px] uppercase font-bold block">Raw OCR Text</span>
                      <span className="text-zinc-200 font-bold">
                        "{selectedZoomPoint.ytTimerRawOCRText || "--"}"
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[9px] uppercase font-bold block">Parsed YT Time</span>
                      <span className="text-purple-400 font-black">
                        {selectedZoomPoint.ytTimerOcrSeconds !== null && selectedZoomPoint.ytTimerOcrSeconds !== undefined
                          ? formatSecondsToMMSS(selectedZoomPoint.ytTimerOcrSeconds)
                          : "--:--"}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Point Meta Details Panel */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-zinc-900/90 rounded-2xl border border-zinc-800 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block mb-0.5">Final Game Clock</span>
                  <span className="font-mono font-black text-amber-400 text-base">
                    {formatMsToClockString(selectedZoomPoint.detectedGameClockMs)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block mb-0.5">Winning Region</span>
                  <span className="font-mono font-bold text-white text-sm uppercase">
                    {selectedZoomPoint.selectedRegionType || "PRIMARY"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block mb-0.5">Confidence</span>
                  <span className={`font-mono font-extrabold ${selectedZoomPoint.confidence > 70 ? "text-emerald-400" : "text-amber-400"}`}>
                    {Math.round(selectedZoomPoint.confidence)}%
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block mb-0.5">Scan Status / Note</span>
                  <span className="font-mono font-extrabold text-zinc-300 uppercase">
                    {selectedZoomPoint.rejectionReason || "Valid Clock Sample"}
                  </span>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  onSeekToVideoTime(selectedZoomPoint.videoTimeSeconds);
                  setSelectedZoomPoint(null);
                }}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold uppercase rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Play size={14} /> Jump to Video Frame ({formatSecondsToTimecode(selectedZoomPoint.videoTimeSeconds)})
              </button>

              <button
                onClick={() => setSelectedZoomPoint(null)}
                className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold uppercase rounded-xl transition-colors"
              >
                Tutup Inspection
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

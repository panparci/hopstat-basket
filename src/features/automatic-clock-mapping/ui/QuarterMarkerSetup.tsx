import React from "react";
import { Plus, Trash2, Play, Flag, CheckCircle2, Video, Sparkles, Clock } from "lucide-react";
import { QuarterMarker } from "../types";
import { formatSecondsToTimecode, parseClockStringToMs, formatMsToClockString } from "../utils/clockParser";

interface QuarterMarkerSetupProps {
  quarterMarkers: QuarterMarker[];
  onChangeMarkers: (markers: QuarterMarker[]) => void;
  currentYoutubeTime: number;
  onSeekToVideoTime?: (seconds: number) => void;
}

export const QuarterMarkerSetup: React.FC<QuarterMarkerSetupProps> = ({
  quarterMarkers,
  onChangeMarkers,
  currentYoutubeTime,
  onSeekToVideoTime,
}) => {
  const handleUpdate = (index: number, updates: Partial<QuarterMarker>) => {
    const updated = quarterMarkers.map((m, i) => (i === index ? { ...m, ...updates } : m));
    onChangeMarkers(updated);
  };

  const handleMarkStart = (index: number) => {
    const time = Math.max(0, Math.round(currentYoutubeTime));
    handleUpdate(index, { videoStartSeconds: time });
  };

  const handleMarkEnd = (index: number) => {
    const time = Math.max(0, Math.round(currentYoutubeTime));
    handleUpdate(index, { videoEndSeconds: time });
  };

  const handleApplyPresetAll = (ms: number) => {
    const updated = quarterMarkers.map((m) => ({ ...m, initialGameClockMs: ms }));
    onChangeMarkers(updated);
  };

  const handleAddOvertime = () => {
    const otNum = quarterMarkers.length + 1;
    const lastMarker = quarterMarkers[quarterMarkers.length - 1];
    const newStart = lastMarker ? lastMarker.videoEndSeconds + 60 : Math.round(currentYoutubeTime);
    const newEnd = newStart + 300; // 5 minute default OT

    onChangeMarkers([
      ...quarterMarkers,
      {
        quarter: otNum,
        videoStartSeconds: newStart,
        videoEndSeconds: newEnd,
        initialGameClockMs: 300000, // 5:00
      },
    ]);
  };

  const handleRemove = (index: number) => {
    if (quarterMarkers.length <= 1) return;
    onChangeMarkers(quarterMarkers.filter((_, i) => i !== index));
  };

  const formattedCurrentTime = formatSecondsToTimecode(Math.round(currentYoutubeTime));

  return (
    <div className="flex flex-col gap-3 text-xs">
      {/* Sleek Live Video Bar & Global Action Toolbar */}
      <div className="p-3 bg-zinc-900 text-white rounded-2xl border border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0 font-mono font-bold">
            <Video size={16} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-black tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Live Video Position
            </span>
            <span className="font-mono text-sm font-black text-amber-400">
              {formattedCurrentTime}
            </span>
            <span className="text-zinc-400 text-[11px] font-mono">
              ({Math.round(currentYoutubeTime)}s)
            </span>
          </div>
        </div>

        {/* Preset & Add OT Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <span className="text-[10px] text-zinc-400 font-bold mr-1 hidden sm:inline">
            Preset Duration:
          </span>
          <button
            onClick={() => handleApplyPresetAll(600000)}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] font-bold transition-colors"
            title="Set semua kuarter ke 10:00 (FIBA / College)"
          >
            10:00 FIBA
          </button>
          <button
            onClick={() => handleApplyPresetAll(720000)}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] font-bold transition-colors"
            title="Set semua kuarter ke 12:00 (NBA)"
          >
            12:00 NBA
          </button>
          <button
            onClick={handleAddOvertime}
            className="px-2.5 py-1 rounded-lg font-extrabold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition-colors text-[11px]"
          >
            <Plus size={13} />
            + Overtime
          </button>
        </div>
      </div>

      {/* Compact High-Density Quarter Rows Container */}
      <div className="flex flex-col gap-2 max-h-[58vh] overflow-y-auto pr-0.5">
        {quarterMarkers.map((m, idx) => {
          const isOt = m.quarter > 4;
          const label = isOt ? `OT${m.quarter - 4}` : `Q${m.quarter}`;
          const elapsedSec = m.videoEndSeconds - m.videoStartSeconds;
          const isValidDuration = elapsedSec > 0;
          const elapsedMinStr = `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;

          return (
            <div
              key={`qm-${m.quarter}`}
              className="p-2.5 px-3 bg-zinc-50 dark:bg-zinc-900/90 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs hover:border-amber-500/30 transition-all"
            >
              {/* Column 1: Quarter Identifier & Clock Input */}
              <div className="flex items-center gap-2.5 shrink-0 min-w-[170px]">
                <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                  {label}
                </span>

                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                    Game Clock
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      defaultValue={formatMsToClockString(m.initialGameClockMs)}
                      onBlur={(e) => {
                        const parsed = parseClockStringToMs(e.target.value);
                        if (parsed !== null) handleUpdate(idx, { initialGameClockMs: parsed });
                      }}
                      className="w-16 px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono font-black text-xs text-center focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Column 2: Start Timestamp Controls */}
              <div className="flex items-center gap-2 flex-1 justify-start md:justify-center bg-white dark:bg-zinc-800/50 p-1.5 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex flex-col shrink-0 min-w-[70px]">
                  <span className="text-[9px] uppercase font-bold text-amber-500 flex items-center gap-0.5">
                    <Flag size={10} /> Start
                  </span>
                  <span className="font-mono font-extrabold text-zinc-800 dark:text-zinc-200 text-xs">
                    {formatSecondsToTimecode(m.videoStartSeconds)}
                  </span>
                </div>

                <button
                  onClick={() => handleMarkStart(idx)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-xs flex items-center gap-1 transition-all"
                  title={`Set start to current time (${formattedCurrentTime})`}
                >
                  <Flag size={11} /> Mark ({formattedCurrentTime})
                </button>

                {onSeekToVideoTime && (
                  <button
                    onClick={() => onSeekToVideoTime(m.videoStartSeconds)}
                    className="p-1 px-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 font-bold text-[10px] flex items-center gap-0.5 transition-colors"
                    title="Jump video to Start"
                  >
                    <Play size={10} /> Cek
                  </button>
                )}
              </div>

              {/* Column 3: End Timestamp Controls */}
              <div className="flex items-center gap-2 flex-1 justify-start md:justify-center bg-white dark:bg-zinc-800/50 p-1.5 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
                <div className="flex flex-col shrink-0 min-w-[70px]">
                  <span className="text-[9px] uppercase font-bold text-emerald-500 flex items-center gap-0.5">
                    <Flag size={10} /> End
                  </span>
                  <span className="font-mono font-extrabold text-zinc-800 dark:text-zinc-200 text-xs">
                    {formatSecondsToTimecode(m.videoEndSeconds)}
                  </span>
                </div>

                <button
                  onClick={() => handleMarkEnd(idx)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs flex items-center gap-1 transition-all"
                  title={`Set end to current time (${formattedCurrentTime})`}
                >
                  <Flag size={11} /> Mark ({formattedCurrentTime})
                </button>

                {onSeekToVideoTime && (
                  <button
                    onClick={() => onSeekToVideoTime(m.videoEndSeconds)}
                    className="p-1 px-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 font-bold text-[10px] flex items-center gap-0.5 transition-colors"
                    title="Jump video to End"
                  >
                    <Play size={10} /> Cek
                  </button>
                )}
              </div>

              {/* Column 4: Duration Badge & Remove Action */}
              <div className="flex items-center gap-2 shrink-0 justify-end">
                <div
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 border ${
                    isValidDuration
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-red-500/10 text-red-500 border-red-500/20"
                  }`}
                  title="Total elapsed video duration"
                >
                  <CheckCircle2 size={11} />
                  {isValidDuration ? elapsedMinStr : "Invalid"}
                </div>

                {quarterMarkers.length > 1 && (
                  <button
                    onClick={() => handleRemove(idx)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Hapus Kuarter"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};



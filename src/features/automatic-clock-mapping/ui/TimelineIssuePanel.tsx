import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle, Play, Eye, Trash2 } from "lucide-react";
import { MandatoryReviewIssue, RawClockScanPoint } from "../types";
import { formatSecondsToTimecode, formatMsToClockString } from "../utils/clockParser";

interface TimelineIssuePanelProps {
  issues: MandatoryReviewIssue[];
  rawPoints: RawClockScanPoint[];
  onSeekToVideoTime: (seconds: number) => void;
  onUpdatePoint: (pointId: string, updates: Partial<RawClockScanPoint>) => void;
  onDeletePoint: (pointId: string) => void;
}

export const TimelineIssuePanel: React.FC<TimelineIssuePanelProps> = ({
  issues,
  rawPoints,
  onSeekToVideoTime,
  onUpdatePoint,
  onDeletePoint,
}) => {
  if (issues.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 text-xs font-bold">
        <CheckCircle size={16} />
        No mandatory review issues found! High-confidence timeline is ready to publish.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-800">
        <h4 className="font-extrabold text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
          <AlertTriangle size={14} />
          Mandatory Review Issues ({issues.length})
        </h4>
        <span className="text-[10px] text-zinc-500">
          Mode 2: Auto Mapping requires resolving these before publication
        </span>
      </div>

      <div className="flex flex-col gap-2 max-h-[35vh] overflow-y-auto pr-1">
        {issues.map((issue) => {
          const point = issue.relatedPointIds?.[0]
            ? rawPoints.find((p) => p.id === issue.relatedPointIds![0])
            : undefined;

          return (
            <div
              key={issue.id}
              className="p-3 bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      Q{issue.quarter} &bull; {formatSecondsToTimecode(issue.videoTimeSeconds)}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 uppercase">
                      {issue.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 text-[11px]">
                    {issue.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                <button
                  onClick={() => onSeekToVideoTime(issue.videoTimeSeconds)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-amber-500 hover:text-white font-bold text-[11px] flex items-center gap-1 transition-colors"
                >
                  <Play size={12} /> Jump & Review
                </button>

                {point && (
                  <button
                    onClick={() => onUpdatePoint(point.id, { status: "VALID" })}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] transition-colors"
                  >
                    Accept
                  </button>
                )}

                {point && (
                  <button
                    onClick={() => onDeletePoint(point.id)}
                    className="p-1 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Delete Scan Point"
                  >
                    <Trash2 size={13} />
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

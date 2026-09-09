import React from "react";
import { ClockTimelineStatus } from "../types";
import { CheckCircle2, Clock, AlertTriangle, Loader2 } from "lucide-react";

interface TimelineStatusBadgeProps {
  status: ClockTimelineStatus;
  version?: number;
}

export const TimelineStatusBadge: React.FC<TimelineStatusBadgeProps> = ({ status, version = 1 }) => {
  switch (status) {
    case "PUBLISHED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] uppercase tracking-wider">
          <CheckCircle2 size={13} /> Active Published Timeline
        </span>
      );
    case "READY_TO_PUBLISH":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-extrabold text-[11px] uppercase tracking-wider">
          <CheckCircle2 size={13} /> Ready to Publish
        </span>
      );
    case "REVIEW_REQUIRED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-extrabold text-[11px] uppercase tracking-wider">
          <AlertTriangle size={13} /> Review Required
        </span>
      );
    case "SCANNING":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-extrabold text-[11px] uppercase tracking-wider">
          <Loader2 size={13} className="animate-spin" /> Auto Scanning...
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 font-extrabold text-[11px] uppercase tracking-wider">
          <Clock size={13} /> Draft
        </span>
      );
  }
};

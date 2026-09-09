import React from "react";
import { Sparkles, Layers, CheckCircle2 } from "lucide-react";
import { ClockTimeline } from "../types";

interface TimelineSyncPanelButtonProps {
  timeline: ClockTimeline | null;
  onClick: () => void;
}

export const TimelineSyncPanelButton: React.FC<TimelineSyncPanelButtonProps> = ({
  timeline,
  onClick,
}) => {
  const isPublished = timeline?.status === "PUBLISHED";

  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-xl font-extrabold text-xs flex items-center gap-2 border transition-all shadow-sm ${
        isPublished
          ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
          : "bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-amber-500/20"
      }`}
    >
      <Sparkles size={15} />
      <span>
        {isPublished ? "Atur Quarter (Q1-Q4)" : "Atur Quarter Marker (Q1-Q4)"}
      </span>
      {isPublished && <CheckCircle2 size={14} className="text-emerald-500" />}
    </button>
  );
};

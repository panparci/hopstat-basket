import React, { useState, useEffect, useRef } from "react";
import { Trash2, Youtube, Clock, Edit2, RefreshCcw, Info, AlertTriangle, Layers } from "lucide-react";
import { GameEvent } from "../../core/types/stats";

interface EventLogItemProps {
  event: GameEvent;
  playerName: string;
  onDelete: (id: string) => void;
  onTimeAdjust: (id: string, deltaSeconds: number) => void;
  onYoutubeTimeAdjust: (id: string, newTime: number) => void;
  onEnrich?: (event: GameEvent) => void;
  onEditSet?: (event: GameEvent) => void;
  teamColor?: string;
  teamTheme?: "gelap" | "terang";
  ourHomeAway?: "home" | "away";
  hasSyncWarning?: boolean;
  isActive?: boolean;
  flowGroupPosition?: "top" | "middle" | "bottom" | "none";
}

export const EventLogItem: React.FC<EventLogItemProps> = ({
  event,
  playerName,
  onDelete,
  onTimeAdjust,
  onYoutubeTimeAdjust,
  onEnrich,
  onEditSet,
  teamColor,
  teamTheme = "gelap",
  ourHomeAway = "home",
  hasSyncWarning,
  isActive = false,
  flowGroupPosition = "none",
}) => {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeOffset, setTimeOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && containerRef.current) {
      containerRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [isActive]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeOffset(parseInt(e.target.value, 10));
  };

  const handleYoutubeClick = () => {
    if (event.youtubeTimestamp !== undefined) {
      window.dispatchEvent(
        new CustomEvent("seek-youtube", { detail: event.youtubeTimestamp }),
      );
    }
  };

  const handleSyncFromPlayer = () => {
    const handler = (e: any) => {
      window.removeEventListener("youtube-time-report", handler);
      onYoutubeTimeAdjust(event.id, e.detail);
    };
    window.addEventListener("youtube-time-report", handler);
    window.dispatchEvent(new CustomEvent("get-youtube-time"));
    // Timeout to cleanup if no response
    setTimeout(
      () => window.removeEventListener("youtube-time-report", handler),
      1000,
    );
  };

  const handleSliderMouseUp = () => {
    if (timeOffset !== 0) {
      onTimeAdjust(event.id, timeOffset);
    }
    setIsEditingTime(false);
    setTimeOffset(0);
  };

  const displayTime = event.timestamp + timeOffset;
  const getActionText = (type: string) => {
    let baseText = type.replace("_", " ").replace("1pt", "FT").toUpperCase();
    if (type === "oreb") baseText = "OFFENSIVE REBOUND";
    if (type === "dreb") baseText = "DEFENSIVE REBOUND";
    
    if (event.isShootingFoul && (type === '2pt_miss' || type === '3pt_miss')) {
      return `${baseText} (SHOOTING FOUL)`;
    }
    return baseText;
  };
  const actionText = getActionText(event.type);
  const isMainEvent = !["sub_in", "sub_out", "timeout"].includes(event.type);
  const isMissingContext = isMainEvent && !event.gameContext;

  const getSubtleBg = (hex?: string) => {
    if (!hex) return undefined;
    try {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, 0.04)`;
    } catch (e) {
      return undefined;
    }
  };

  let groupClass = "rounded-xl border hover:shadow-md border-zinc-200 dark:border-zinc-800 mb-1.5";
  if (flowGroupPosition === "top") groupClass = "rounded-t-xl rounded-b-none border-t border-x hover:shadow-md border-zinc-200 dark:border-zinc-800 border-b-zinc-100 dark:border-b-zinc-800/50";
  if (flowGroupPosition === "middle") groupClass = "rounded-none border-x hover:shadow-md border-zinc-200 dark:border-zinc-800 border-y-zinc-100 dark:border-y-zinc-800/50";
  if (flowGroupPosition === "bottom") groupClass = "rounded-b-xl rounded-t-none border-b border-x hover:shadow-md border-zinc-200 dark:border-zinc-800 border-t-zinc-100 dark:border-t-zinc-800/50 mb-1.5";
  
  if (isActive) {
    groupClass = "rounded-xl scale-[1.02] ring-2 ring-amber-500 dark:ring-amber-400 border-amber-500/50 dark:border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.45)] z-10";
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col p-2 bg-white dark:bg-zinc-900 shadow-sm relative overflow-hidden pl-4 shrink-0 transition-all duration-300 ${groupClass}`}
      style={{ backgroundColor: getSubtleBg(teamColor) }}
    >
      {/* Team Color Strip */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: teamColor || "#71717a" }}
      />

      <div className="flex items-center justify-between">
        <div className="flex-1 flex items-center gap-2">
          <div className="flex flex-col gap-1 shrink-0">
            {/* Game Timer Button */}
            <button
              onClick={() => setIsEditingTime(!isEditingTime)}
              className="px-2 h-6 rounded-full flex items-center gap-1 text-xs font-bold shadow-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-amber-500 dark:hover:border-amber-400 transition-colors"
              title="Klik untuk ubah waktu game"
            >
              <Clock size={10} />Q{event.quarter} {formatTime(displayTime)}
            </button>

            {/* YouTube Timestamp Button */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleYoutubeClick}
                className="px-2 h-6 rounded-full flex items-center gap-1 text-xs font-bold shadow-sm border border-red-500/20 dark:border-red-500/30 bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 hover:border-red-500 transition-colors"
                title="Klik untuk putar video"
              >
                <Youtube size={10} />
                {event.youtubeTimestamp !== undefined
                  ? formatTime(event.youtubeTimestamp)
                  : "--:--"}
              </button>
              {hasSyncWarning && (
                <div title="Potential Sync Issue: YouTube time order differs from Game time order" className="text-amber-500 dark:text-amber-400">
                  <AlertTriangle size={12} />
                </div>
              )}
              <button
                onClick={handleSyncFromPlayer}
                className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Sinkronkan dari posisi player YouTube saat ini"
              >
                <RefreshCcw size={10} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold truncate text-[#1A1A1A] dark:text-white">
              {playerName}
            </div>
            <div className="text-xs font-medium flex items-center flex-wrap gap-1 text-zinc-600 dark:text-zinc-400">
              <span className="truncate">{actionText}</span>
              {event.possession && (
                <span
                  className={`text-xs font-black px-1 rounded flex items-center gap-1 ${
                    event.possession === "home"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  <span>
                    {event.possession === "home" ? "KITA POSS" : "LAWAN POSS"}
                  </span>
                  {event.possessionId && (
                    <span className="opacity-70">
                      #{event.possessionId.slice(-4).toUpperCase()}
                    </span>
                  )}
                </span>
              )}
              {event.subType && (
                <span className="text-zinc-400 dark:text-zinc-500 text-xs lowercase shrink-0">
                  ({event.subType})
                </span>
              )}
              {event.shotDifficulty && (
                <span className="text-amber-500 dark:text-amber-400 text-xs font-bold shrink-0">
                  [{event.shotDifficulty}]
                </span>
              )}
              {event.assistType && (
                <span className="text-blue-500 dark:text-blue-400 text-xs font-bold shrink-0">
                  [{event.assistType}]
                </span>
              )}
              {event.gameContext && (
                <span className="text-zinc-400 dark:text-zinc-500 text-xs italic shrink-0">
                  @{event.gameContext}
                </span>
              )}
              {event.pressureLevel && (
                <span className="text-red-500 dark:text-red-400 text-xs font-bold shrink-0">
                  [{event.pressureLevel}]
                </span>
              )}
              {event.reboundType && (
                <span className="text-green-500 dark:text-green-400 text-xs font-bold shrink-0">
                  [{event.reboundType}]
                </span>
              )}
              {event.metadata?.areaName && (
                <span className="text-indigo-500 dark:text-indigo-400 text-xs font-bold shrink-0">
                  [{event.metadata.areaName}]
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onEnrich && (
            <button
              onClick={() => onEnrich(event)}
              className={`p-1.5 rounded-lg transition-all ${
                isMissingContext
                  ? "text-amber-500 bg-amber-50 dark:bg-amber-900/20 animate-pulse"
                  : "text-brand-navy dark:text-brand-orange hover:bg-blue-50 dark:hover:bg-blue-900/20"
              }`}
              title={
                isMissingContext
                  ? "Lengkapi detail event (PENTING)"
                  : "Lengkapi detail event (RAG/Context)"
              }
            >
              <Info size={14} />
            </button>
          )}
          {onEditSet && (
            <button
              onClick={() => onEditSet(event)}
              className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              title="Edit Data & Waktu Video"
            >
              <Edit2 size={14} />
            </button>
          )}
          <button
            onClick={() => onDelete(event.id)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isEditingTime && (
        <div className="mt-2 px-2 pb-1 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400">-30s</span>
            <input
              type="range"
              min="-30"
              max="30"
              value={timeOffset}
              onChange={handleSliderChange}
              onMouseUp={handleSliderMouseUp}
              onTouchEnd={handleSliderMouseUp}
              className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <span className="text-xs font-bold text-zinc-400">+30s</span>
          </div>
          <div className="text-center text-xs text-amber-500 font-medium mt-1">
            Geser untuk ubah waktu game (semua log setelahnya akan ikut berubah)
          </div>
        </div>
      )}
    </div>
  );
};

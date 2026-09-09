import React, { useState, useMemo } from "react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ReferenceLine 
} from "recharts";
import YouTube from "react-youtube";
import { Play, Video, HelpCircle } from "lucide-react";
import { GameEvent, MatchRoster, Match, Possession } from "../../../core/types/stats";
import { buildMomentum, MomentumPoint } from "../model/momentum";
import { BaseModal } from "../../../shared/ui/BaseModal";
import { useToast } from "../../../core/contexts/ToastContext";
import { getPossessionPlayString } from "../../../shared/lib/possessionUtils";

interface MomentumChartProps {
  events: GameEvent[];
  matchRosters: MatchRoster[];
  match: Match | null;
  possessions: Possession[];
}

export const MomentumChart: React.FC<MomentumChartProps> = ({
  events,
  matchRosters,
  match,
  possessions
}) => {
  const { showToast } = useToast();
  const [activeVideo, setActiveVideo] = useState<{
    youtubeTimestamp: number;
    title: string;
  } | null>(null);

  // Extract YouTube ID from URL
  const extractVideoId = (url?: string) => {
    if (!url) return null;
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const matchArr = url.match(regExp);
    return matchArr ? matchArr[1] : null;
  };

  const videoId = match?.videoUrl ? extractVideoId(match.videoUrl) : null;

  // 1. Calculate momentum points
  const momentumPoints = useMemo(() => {
    return buildMomentum(events, matchRosters, match);
  }, [events, matchRosters, match]);

  // Determine split offset for gradient in recharts
  const { maxMargin, minMargin, off } = useMemo(() => {
    const margins = momentumPoints.map((d) => d.margin);
    const max = Math.max(...margins, 1);
    const min = Math.min(...margins, -1);
    const absMin = Math.abs(min);
    const splitOffset = max + absMin === 0 ? 0.5 : max / (max - min);
    return { maxMargin: max, minMargin: min, off: splitOffset };
  }, [momentumPoints]);

  const handlePointClick = (point: MomentumPoint | any) => {
    if (point.youtubeTimestamp !== undefined && point.youtubeTimestamp !== null) {
      if (!match?.videoUrl || !videoId) {
        showToast("Video belum tersedia untuk pertandingan ini.", "error");
        return;
      }
      setActiveVideo({
        youtubeTimestamp: point.youtubeTimestamp,
        title: point.label || "Momen Pertandingan"
      });
    } else {
      showToast("Video tidak tersedia untuk momen ini.", "info");
    }
  };

  // Helper to find video timestamp for possession highlights
  const getPossessionYtTimestamp = (pos: Possession) => {
    const closingEvent = events.find(e => e.id === pos.closingEventId);
    if (closingEvent?.youtubeTimestamp !== undefined) {
      return closingEvent.youtubeTimestamp;
    }
    const scoringEvent = events.find(e => e.possessionId === pos.id && e.points && e.points > 0);
    if (scoringEvent?.youtubeTimestamp !== undefined) {
      return scoringEvent.youtubeTimestamp;
    }
    const openingEvent = events.find(e => e.id === pos.openingEventId);
    if (openingEvent?.youtubeTimestamp !== undefined) {
      return openingEvent.youtubeTimestamp;
    }
    const anyEventWithYt = events.find(e => e.possessionId === pos.id && e.youtubeTimestamp !== undefined);
    if (anyEventWithYt) {
      return anyEventWithYt.youtubeTimestamp;
    }
    return undefined;
  };

  // Calculate scoring possessions
  const scoringPossessions = useMemo(() => {
    return possessions
      .filter((p) => p.pointsScored > 0)
      .sort((a, b) => {
        if (a.period !== b.period) return a.period - b.period;
        // Ascending clock start (since clock counts down, larger start is earlier)
        const startA = a.clockStart ?? 0;
        const startB = b.clockStart ?? 0;
        return startB - startA;
      });
  }, [possessions]);

  const isHomeOurTeam = match?.ourHomeAway === "home" || !match?.ourHomeAway;
  const homeTeamName = match?.ourHomeAway === "home" ? (match?.ourTeamName || "Kita") : (match?.theirTeamName || "Lawan");
  const awayTeamName = match?.ourHomeAway === "away" ? (match?.ourTeamName || "Kita") : (match?.theirTeamName || "Lawan");

  // Format second to mm:ss
  const formatTime = (seconds?: number) => {
    if (seconds === undefined) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Recharts Custom Tooltip Component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const hasVideo = d.youtubeTimestamp !== undefined && d.youtubeTimestamp !== null && videoId;
      return (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-2xl shadow-xl max-w-xs font-sans text-xs">
          <p className="font-bold text-[#1A1A1A] dark:text-white mb-1 leading-snug">{d.label}</p>
          <p className="text-zinc-500 dark:text-zinc-400 mb-1">
            Q{d.quarter} | Sisa Waktu: {d.clockLabel}
          </p>
          <p className="text-zinc-500 dark:text-zinc-400 mb-3">
            Selisih:{" "}
            <span
              className={`font-black ${
                d.margin > 0
                  ? "text-blue-600 dark:text-blue-400"
                  : d.margin < 0
                  ? "text-red-500"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {d.margin > 0 ? `+${d.margin} (${homeTeamName})` : d.margin < 0 ? `${d.margin} (${awayTeamName})` : "Imbang"}
            </span>
          </p>
          {hasVideo ? (
            <button
              onClick={() => handlePointClick(d)}
              className="w-full flex items-center justify-center gap-1.5 bg-brand-orange text-white dark:text-zinc-950 font-black uppercase tracking-wider text-[10px] px-3 py-2 rounded-xl hover:bg-opacity-90 transition-all cursor-pointer shadow-sm"
            >
              <Play size={10} fill="currentColor" /> Tonton Momen
            </button>
          ) : (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic block border-t border-zinc-100 dark:border-zinc-800 pt-1.5">
              Video tontonan tidak tersedia
            </span>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* MOMENTUM CHART CARD */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-black italic uppercase tracking-tight text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              Grafik Momentum Pertandingan
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Grafik naik-turun selisih skor pertandingan. Area atas ({homeTeamName}) unggul, area bawah ({awayTeamName}) unggul. Klik titik untuk menonton video cuplikan skor.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-900 dark:bg-blue-600"></span>
              <span className="text-zinc-600 dark:text-zinc-300">{homeTeamName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-600"></span>
              <span className="text-zinc-600 dark:text-zinc-300">{awayTeamName}</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={momentumPoints}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={off} stopColor="#1e3b8b" stopOpacity={0.6} />
                  <stop offset={off} stopColor="#ef4444" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="clockLabel"
                stroke="#888888"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
                tickFormatter={(val) => (val > 0 ? `+${val}` : val)}
              />
              <Tooltip
                content={<CustomTooltip />}
                wrapperStyle={{ pointerEvents: "auto" }}
              />
              <ReferenceLine y={0} stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="margin"
                stroke="#52525b"
                strokeWidth={2}
                fill="url(#splitColor)"
                activeDot={{
                  r: 6,
                  className: "cursor-pointer",
                  onClick: (props: any) => {
                    if (props && props.payload) {
                      handlePointClick(props.payload);
                    }
                  }
                }}
                dot={{
                  r: 3,
                  className: "cursor-pointer",
                  onClick: (props: any) => {
                    if (props && props.payload) {
                      handlePointClick(props.payload);
                    }
                  }
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* POSSESSION HIGHLIGHTS LIST */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-base font-black italic uppercase tracking-tight text-zinc-800 dark:text-zinc-100">
            Sorotan Possession (Scoring)
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Daftar penguasaan bola yang berhasil menghasilkan poin. Tekan tombol tonton untuk langsung menuju video cuplikan penyelesaian posesi.
          </p>
        </div>

        {scoringPossessions.length === 0 ? (
          <div className="py-8 text-center text-zinc-400 dark:text-zinc-500 text-sm">
            Tidak ada data possession yang mencetak poin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Tim</th>
                  <th className="py-3 px-4">Poin</th>
                  <th className="py-3 px-4">Alur Bermain</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {scoringPossessions.map((pos) => {
                  const isOurPos = pos.teamInPossession === (match?.ourHomeAway || "home");
                  const posTeamName = pos.teamInPossession === "home" ? homeTeamName : awayTeamName;
                  const posYoutubeTime = getPossessionYtTimestamp(pos);
                  const hasVideo = posYoutubeTime !== undefined && videoId;

                  return (
                    <tr
                      key={pos.id}
                      className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold">
                        Q{pos.period} | {formatTime(pos.clockStart)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            isOurPos
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                        >
                          {posTeamName}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black text-sm text-[#1A1A1A] dark:text-white">
                        +{pos.pointsScored}
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 font-medium">
                        {getPossessionPlayString(pos, events)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasVideo ? (
                          <button
                            onClick={() => {
                              setActiveVideo({
                                youtubeTimestamp: posYoutubeTime!,
                                title: `Possession Q${pos.period} Sisa ${formatTime(pos.clockStart)} (+${pos.pointsScored} pts)`
                              });
                            }}
                            className="inline-flex items-center gap-1 bg-brand-orange hover:bg-opacity-90 text-white dark:text-zinc-950 font-black uppercase tracking-wider text-[10px] px-2.5 py-1.5 rounded-xl cursor-pointer shadow-sm transition-all"
                          >
                            <Play size={10} fill="currentColor" /> Tonton
                          </button>
                        ) : (
                          <button
                            disabled
                            title="Video tidak tersedia"
                            className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-wider text-[10px] px-2.5 py-1.5 rounded-xl cursor-not-allowed opacity-50"
                          >
                            <Play size={10} /> Tonton
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* YOUTUBE MODAL PLAYER */}
      <BaseModal
        isOpen={activeVideo !== null}
        onClose={() => setActiveVideo(null)}
        title={activeVideo?.title || "Video Momen Pertandingan"}
        icon={<Video size={18} className="text-brand-orange" />}
        maxWidth="max-w-2xl"
      >
        {activeVideo && videoId ? (
          <div className="space-y-4">
            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-inner w-full">
              <YouTube
                key={`${activeVideo.youtubeTimestamp}`}
                videoId={videoId}
                opts={{
                  height: "100%",
                  width: "100%",
                  playerVars: {
                    autoplay: 1,
                    controls: 1,
                    start: activeVideo.youtubeTimestamp,
                    rel: 0,
                    modestbranding: 1
                  }
                }}
                className="absolute inset-0 w-full h-full"
              />
            </div>
            <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl p-3 text-xs">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                Cuplikan diputar mulai dari detik:{" "}
                <strong className="text-brand-orange font-bold">
                  {formatTime(activeVideo.youtubeTimestamp)} ({activeVideo.youtubeTimestamp} detik)
                </strong>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                YouTube Player
              </span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-zinc-400 dark:text-zinc-500">
            Gagal memuat video player.
          </div>
        )}
      </BaseModal>
    </div>
  );
};

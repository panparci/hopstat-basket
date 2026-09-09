import React, { useState, useEffect } from "react";
import {
  Target,
  XCircle,
  ArrowUpCircle,
  Shield,
  Handshake,
  Hand,
  Ban,
  RefreshCcw,
  Flag,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Play,
  Pause,
} from "lucide-react";
import { EventType, Match, MatchRoster, Player } from "../../core/types/stats";

interface ActionContentProps {
  onLogEvent: (
    type: EventType,
    points?: number,
    playerId?: string,
    x?: number,
    y?: number,
    skipSmartPrompt?: boolean,
    subType?: string,
    customTimestamp?: number,
    customQuarter?: number,
    customYoutubeTimestamp?: number,
    metadata?: any,
  ) => void;
  isOpen?: boolean;
  match?: Match | null;
  matchRosters?: MatchRoster[];
  player?: Player | null;
  gameState?: any;
  currentYoutubeTime?: number;
}

export const ActionContent: React.FC<ActionContentProps> = ({
  onLogEvent,
  isOpen = true,
  match,
  matchRosters,
  player,
  gameState,
  currentYoutubeTime,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);

  // FT sequence configuration flow state
  const [ftState, setFtState] = useState<{
    numFTs: "1FT" | "2FT" | "3FT";
    attempts: {
      result: "success" | "miss" | "violation" | null;
      timestamp?: number;
      youtubeTimestamp?: number;
    }[];
    lastBallOutcome: string | null;
    reboundTimestamp?: number;
    reboundYoutubeTimestamp?: number;
    assistedByPlayerId?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShowAdvanced(false);
      setFtState(null);
      setVideoPlaying(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleState = (e: any) => {
      if (e.detail && typeof e.detail.playing === 'boolean') {
        setVideoPlaying(e.detail.playing);
      }
    };
    window.addEventListener('youtube-playing-state', handleState);
    
    // Request initial state on mount/open
    window.dispatchEvent(new CustomEvent('get-youtube-playing-state'));
    
    return () => {
      window.removeEventListener('youtube-playing-state', handleState);
    };
  }, []);

  const getActualYoutubeTime = (): number => {
    return currentYoutubeTime ?? 0;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const togglePlayPause = () => {
    if (videoPlaying) {
      window.dispatchEvent(new CustomEvent("pause-youtube"));
      setVideoPlaying(false);
    } else {
      window.dispatchEvent(new CustomEvent("play-youtube"));
      setVideoPlaying(true);
    }
  };

  const startFTFlow = (make: boolean) => {
    const ytTime = getActualYoutubeTime();
    setFtState({
      numFTs: "1FT",
      attempts: [
        {
          result: make ? "success" : "miss",
          timestamp: gameState?.timeRemaining,
          youtubeTimestamp: ytTime,
        },
        { result: null },
        { result: null },
      ],
      lastBallOutcome: null,
    });
  };

  const handleSelectAttemptResult = (index: number, result: "success" | "miss" | "violation") => {
    if (!ftState) return;

    const ytTime = getActualYoutubeTime();
    const updatedAttempts = [...ftState.attempts];
    updatedAttempts[index] = {
      result,
      timestamp: gameState?.timeRemaining,
      youtubeTimestamp: ytTime,
    };

    // Determine the last ball outcome based on the updated last FT result
    const numAttempts = ftState.numFTs === "1FT" ? 1 : ftState.numFTs === "2FT" ? 2 : 3;
    const lastAttemptIndex = numAttempts - 1;
    
    let nextLastBallOutcome = ftState.lastBallOutcome;
    if (index === lastAttemptIndex) {
      nextLastBallOutcome = null;
    } else {
      // If we are editing a non-last attempt, check if the last attempt already has a result
      const lastAttempt = updatedAttempts[lastAttemptIndex];
      if (lastAttempt && lastAttempt.result !== null) {
        nextLastBallOutcome = lastAttempt.result === "success" ? null : ftState.lastBallOutcome;
      }
    }

    setFtState({
      ...ftState,
      attempts: updatedAttempts,
      lastBallOutcome: nextLastBallOutcome,
    });
  };

  const selectRebound = (outcome: string) => {
    if (!ftState) return;
    const ytTime = getActualYoutubeTime();
    setFtState({
      ...ftState,
      lastBallOutcome: outcome,
      reboundTimestamp: gameState?.timeRemaining,
      reboundYoutubeTimestamp: ytTime,
    });
  };

  const handleSaveFT = () => {
    if (!ftState) return;

    const numAttempts = ftState.numFTs === "1FT" ? 1 : ftState.numFTs === "2FT" ? 2 : 3;

    // 1. Log FT 1
    const att1 = ftState.attempts[0];
    const isMake1 = att1?.result === "success";
    const subType1 = att1?.result === "violation" ? "Line Violation" : undefined;
    onLogEvent(
      isMake1 ? "1pt_make" : "1pt_miss",
      isMake1 ? 1 : 0,
      undefined, // playerId
      undefined, // x
      undefined, // y
      true,      // skipSmartPrompt
      subType1,  // subType
      att1?.timestamp,
      undefined, // customQuarter
      att1?.youtubeTimestamp,
      { isFinalFT: numAttempts === 1 }
    );

    // 2. Log FT 2 (if selected 2FT or 3FT)
    if (numAttempts >= 2) {
      const att2 = ftState.attempts[1];
      const isMake2 = att2?.result === "success";
      const subType2 = att2?.result === "violation" ? "Line Violation" : undefined;
      onLogEvent(
        isMake2 ? "1pt_make" : "1pt_miss",
        isMake2 ? 1 : 0,
        undefined, // playerId
        undefined, // x
        undefined, // y
        true,      // skipSmartPrompt
        subType2,  // subType
        att2?.timestamp,
        undefined, // customQuarter
        att2?.youtubeTimestamp,
        { isFinalFT: numAttempts === 2 }
      );
    }

    // 3. Log FT 3 (if selected 3FT)
    if (numAttempts === 3) {
      const att3 = ftState.attempts[2];
      const isMake3 = att3?.result === "success";
      const subType3 = att3?.result === "violation" ? "Line Violation" : undefined;
      onLogEvent(
        isMake3 ? "1pt_make" : "1pt_miss",
        isMake3 ? 1 : 0,
        undefined, // playerId
        undefined, // x
        undefined, // y
        true,      // skipSmartPrompt
        subType3,  // subType
        att3?.timestamp,
        undefined, // customQuarter
        att3?.youtubeTimestamp,
        { isFinalFT: true }
      );
    }

    // 4. Log last ball outcome (rebounded player or sequence)
    const lastFtIndex = numAttempts - 1;
    const lastFtMake = ftState.attempts[lastFtIndex]?.result === "success";

    if (!lastFtMake) {
      if (ftState.lastBallOutcome === "keep_possession") {
        onLogEvent(
          "possession_marker",
          0,
          undefined,
          undefined,
          undefined,
          true,
          undefined,
          ftState.reboundTimestamp,
          undefined,
          ftState.reboundYoutubeTimestamp
        );
      } else if (ftState.lastBallOutcome === "out_of_bounds") {
        onLogEvent(
          "dead_ball",
          0,
          undefined,
          undefined,
          undefined,
          true,
          undefined,
          ftState.reboundTimestamp,
          undefined,
          ftState.reboundYoutubeTimestamp
        );
      } else if (
        ftState.lastBallOutcome === "short" ||
        ftState.lastBallOutcome === "airball"
      ) {
        onLogEvent(
          "dead_ball",
          0,
          undefined,
          undefined,
          undefined,
          true,
          undefined,
          ftState.reboundTimestamp,
          undefined,
          ftState.reboundYoutubeTimestamp
        );
      } else if (ftState.lastBallOutcome) {
        const isShooterHome =
          player?.id === "home_team" ||
          matchRosters?.some(
            (r) => r.teamId === match?.teamId && r.profileId === player?.id,
          );
        const isRebounderHome =
          ftState.lastBallOutcome === "home_team" ||
          matchRosters?.some(
            (r) =>
              r.teamId === match?.teamId &&
              r.profileId === ftState.lastBallOutcome,
          );

        let rebType: EventType = "dreb";
        if (isShooterHome) {
          rebType = isRebounderHome ? "oreb" : "dreb";
        } else {
          rebType = isRebounderHome ? "dreb" : "oreb";
        }

        onLogEvent(
          rebType,
          0,
          ftState.lastBallOutcome,
          undefined,
          undefined,
          true,
          undefined,
          ftState.reboundTimestamp,
          undefined,
          ftState.reboundYoutubeTimestamp
        );
      }
    }

    // 5. Log assist if set and at least one FT is successful
    const hasAnySuccess = ftState.attempts.slice(0, numAttempts).some(att => att.result === "success");
    if (ftState.assistedByPlayerId && hasAnySuccess) {
      const firstSuccess = ftState.attempts.slice(0, numAttempts).find(att => att.result === "success");
      onLogEvent(
        "ast",
        0,
        ftState.assistedByPlayerId,
        undefined, // x
        undefined, // y
        true,      // skipSmartPrompt
        undefined, // subType
        firstSuccess?.timestamp,
        undefined, // customQuarter
        firstSuccess?.youtubeTimestamp
      );
    }

    setFtState(null);
  };

  const peekVideo = () => {
    window.dispatchEvent(
      new CustomEvent("get-youtube-time", {
        detail: {
          callback: (originalTime: number) => {
            if (originalTime !== undefined) {
              window.dispatchEvent(
                new CustomEvent("start-loop-youtube", {
                  detail: { start: originalTime, end: originalTime + 5 },
                }),
              );
              window.dispatchEvent(new CustomEvent("unmute-youtube"));

              setTimeout(() => {
                window.dispatchEvent(new CustomEvent("stop-loop-youtube"));
                window.dispatchEvent(
                  new CustomEvent("seek-youtube", {
                    detail: { time: originalTime },
                  }),
                );
                window.dispatchEvent(new CustomEvent("pause-youtube"));
              }, 5000);
            }
          },
        },
      }),
    );
  };

  if (ftState) {
    const numAttempts = ftState.numFTs === "1FT" ? 1 : ftState.numFTs === "2FT" ? 2 : 3;
    const lastFtIndex = numAttempts - 1;
    const lastFtMake = ftState.attempts[lastFtIndex]?.result === "success";
    const lastFtMiss = ftState.attempts[lastFtIndex]?.result === "miss";

    const getRosters = () => {
      if (!match || !matchRosters) return { homeRoster: [], awayRoster: [] };
      const homeTeamId = match.teamId || "home_team";
      const awayTeamId = match.opponentTeamId || "away_team";
      const homeRoster = matchRosters
        .filter((r) => r.teamId === homeTeamId && r.isActive)
        .map(
          (r) =>
            ({
              id: r.profileId,
              name: r.name,
              jersey: r.jerseyNumber || "-",
            }) as Player,
        );
      let awayRoster = matchRosters
        .filter((r) => r.teamId === awayTeamId && r.isActive)
        .map(
          (r) =>
            ({
              id: r.profileId,
              name: r.name,
              jersey: r.jerseyNumber || "-",
            }) as Player,
        );

      if (match.recordingType !== "full") {
        awayRoster = [
          {
            id: "opp",
            name: "Opponent Rebound",
            displayName: "Opponent Rebound",
            jersey: "REB",
          } as any,
        ];
      }
      return { homeRoster, awayRoster };
    };

    const { homeRoster, awayRoster } = getRosters();

    // Determine if we can save
    const canSave = ftState.attempts.slice(0, numAttempts).every(att => att.result !== null) && 
                    (lastFtMake || !!ftState.lastBallOutcome);

    return (
      <div className="space-y-4 p-1 bg-zinc-50 dark:bg-zinc-800/10 rounded-2xl">
        <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Target size={14} className="text-amber-500" />
            Pengaturan Free Throw
          </h3>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={togglePlayPause}
              className={`text-xs font-black px-2 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 border transition-all ${
                videoPlaying
                  ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                  : "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600"
              }`}
            >
              {videoPlaying ? <Pause size={10} /> : <Play size={10} />}
              <span>{videoPlaying ? "Pause" : "Play"}</span>
            </button>
            <button
              type="button"
              onClick={peekVideo}
              className="text-xs font-black bg-blue-500 text-white px-2 py-1 rounded-full hover:bg-blue-600 uppercase tracking-widest flex items-center gap-1"
            >
              Intip Video +5s
            </button>
            <button
              type="button"
              onClick={() => setFtState(null)}
              className="text-xs font-bold text-zinc-400 hover:text-red-500 dark:hover:text-red-400 uppercase tracking-widest animate-pulse"
            >
              Batal
            </button>
          </div>
        </div>

        {/* 1. SELECTION QUANTITY OF FTs */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
            PILIH JUMLAH FREE THROW
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["1FT", "2FT", "3FT"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const targetNumAttempts = opt === "1FT" ? 1 : opt === "2FT" ? 2 : 3;
                  const targetLastIndex = targetNumAttempts - 1;
                  const lastAttemptResult = ftState.attempts[targetLastIndex]?.result;
                  const isMake = lastAttemptResult === "success";
                  const isMiss = lastAttemptResult === "miss";

                  setFtState({
                    ...ftState,
                    numFTs: opt,
                    lastBallOutcome: isMake
                      ? null
                      : isMiss
                        ? ftState.lastBallOutcome === "keep_possession" ? null : ftState.lastBallOutcome
                        : null,
                  });
                }}
                className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                  ftState.numFTs === opt
                    ? "bg-brand-navy text-white border-brand-navy dark:bg-brand-orange dark:text-brand-navy dark:border-brand-orange"
                    : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                }`}
              >
                {opt === "1FT" ? "[Only FT]" : opt}
              </button>
            ))}
          </div>
        </div>

        {/* 2. SPECIFY RESULTS FOR OTHER SLOT FTs */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
            HASIL DAN DETAIL FT
          </label>
          <div className="space-y-2 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl p-3">
            {/* Slot 1: Explicit Success / Miss / Violation buttons */}
            <div className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 py-1.5 border-b border-zinc-100 dark:border-zinc-800">
              <span className="font-semibold">FT 1</span>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectAttemptResult(0, "success")}
                    className={`px-2.5 py-1 rounded-lg text-xs uppercase font-black tracking-wider border transition-all ${
                      ftState.attempts[0]?.result === "success"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-emerald-50 hover:text-emerald-600"
                    }`}
                  >
                    Success
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAttemptResult(0, "miss")}
                    className={`px-2.5 py-1 rounded-lg text-xs uppercase font-black tracking-wider border transition-all ${
                      ftState.attempts[0]?.result === "miss"
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-red-50 hover:text-red-600"
                    }`}
                  >
                    Miss
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAttemptResult(0, "violation")}
                    className={`px-2.5 py-1 rounded-lg text-xs uppercase font-black tracking-wider border transition-all ${
                      ftState.attempts[0]?.result === "violation"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-amber-50 hover:text-amber-600"
                    }`}
                    title="Kaki Melewati Garis (Line Violation)"
                  >
                    Kaki Garis
                  </button>
                </div>
                {ftState.attempts[0]?.youtubeTimestamp !== undefined && (
                  <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                    Snapped: {formatTime(ftState.attempts[0].youtubeTimestamp)}
                  </span>
                )}
              </div>
            </div>

            {/* Slot 2 Optional */}
            {(ftState.numFTs === "2FT" || ftState.numFTs === "3FT") && (
              <div className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="font-semibold">FT 2</span>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectAttemptResult(1, "success")}
                      className={`px-2.5 py-1 rounded-lg text-xs uppercase font-black tracking-wider border transition-all ${
                        ftState.attempts[1]?.result === "success"
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-emerald-50 hover:text-emerald-600"
                      }`}
                    >
                      Success
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAttemptResult(1, "miss")}
                      className={`px-2.5 py-1 rounded-lg text-xs uppercase font-black tracking-wider border transition-all ${
                        ftState.attempts[1]?.result === "miss"
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-red-50 hover:text-red-600"
                      }`}
                    >
                      Miss
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAttemptResult(1, "violation")}
                      className={`px-2.5 py-1 rounded-lg text-xs uppercase font-black tracking-wider border transition-all ${
                        ftState.attempts[1]?.result === "violation"
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-amber-50 hover:text-amber-600"
                      }`}
                      title="Kaki Melewati Garis (Line Violation)"
                    >
                      Kaki Garis
                    </button>
                  </div>
                  {ftState.attempts[1]?.youtubeTimestamp !== undefined && (
                    <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                      Snapped: {formatTime(ftState.attempts[1].youtubeTimestamp)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Slot 3 Optional */}
            {ftState.numFTs === "3FT" && (
              <div className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 py-1.5">
                <span className="font-semibold">FT 3</span>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectAttemptResult(2, "success")}
                      className={`px-2.5 py-1 rounded-lg text-xs uppercase font-black tracking-wider border transition-all ${
                        ftState.attempts[2]?.result === "success"
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-emerald-50 hover:text-emerald-600"
                      }`}
                    >
                      Success
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAttemptResult(2, "miss")}
                      className={`px-2.5 py-1 rounded-lg text-xs uppercase font-black tracking-wider border transition-all ${
                        ftState.attempts[2]?.result === "miss"
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-red-50 hover:text-red-600"
                      }`}
                    >
                      Miss
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAttemptResult(2, "violation")}
                      className={`px-2.5 py-1 rounded-lg text-xs uppercase font-black tracking-wider border transition-all ${
                        ftState.attempts[2]?.result === "violation"
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-amber-50 hover:text-amber-600"
                      }`}
                      title="Kaki Melewati Garis (Line Violation)"
                    >
                      Kaki Garis
                    </button>
                  </div>
                  {ftState.attempts[2]?.youtubeTimestamp !== undefined && (
                    <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                      Snapped: {formatTime(ftState.attempts[2].youtubeTimestamp)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ASSIST SELECTION (Optional) */}
        <div className="space-y-1.5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl p-3">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">
            ASSIST OLEH (OPSIONAL)
          </label>
          <select
            value={ftState.assistedByPlayerId || ""}
            onChange={(e) => {
              setFtState({
                ...ftState,
                assistedByPlayerId: e.target.value || undefined,
              });
            }}
            className="w-full text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-orange text-zinc-700 dark:text-zinc-300"
          >
            <option value="">-- Tanpa Assist --</option>
            {matchRosters
              ?.filter((r) => r.teamId === matchRosters?.find((sr) => sr.profileId === player?.id)?.teamId && r.profileId !== player?.id && r.isActive)
              .map((t) => (
                <option key={t.profileId} value={t.profileId}>
                  {t.jerseyNumber ? `#${t.jerseyNumber} ` : ""}{t.name}
                </option>
              ))}
          </select>
        </div>

        {/* 3. IMPACT OF THE LAST FT */}
        {lastFtMiss && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
              HASIL REBOUND (JIKA MELeset)
            </label>
            <div className="space-y-1">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl p-1.5 flex flex-wrap items-center gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 w-full mb-0.5">
                  Tim Kita
                </span>
                {homeRoster.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!lastFtMiss}
                    onClick={() => selectRebound(p.id)}
                    className={`h-6 min-w-6 px-1.5 rounded text-xs font-bold font-display uppercase tracking-wider border transition-all ${
                      !lastFtMiss
                        ? "opacity-30 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 border-zinc-200"
                        : ftState.lastBallOutcome === p.id
                          ? "bg-brand-navy border-brand-navy text-white dark:bg-brand-orange dark:border-brand-orange dark:text-brand-navy"
                          : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 shadow-sm"
                    }`}
                  >
                    {p.jersey || p.id.substring(0, 2)}
                  </button>
                ))}
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl p-1.5 flex flex-wrap items-center gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 w-full mb-0.5">
                  Lawan & Lainnya
                </span>
                {awayRoster.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!lastFtMiss}
                    onClick={() => selectRebound(p.id)}
                    className={`h-6 px-2 rounded text-xs font-bold font-display uppercase tracking-wider border transition-all ${
                      !lastFtMiss
                        ? "opacity-30 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 border-zinc-200"
                        : ftState.lastBallOutcome === p.id
                          ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-900/50 dark:border-red-700 dark:text-red-400"
                          : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 shadow-sm"
                    }`}
                  >
                    {p.jersey === "OPP" || p.jersey === "REB" || p.jersey === "-"
                      ? p.displayName
                      : p.jersey}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={!lastFtMiss}
                  onClick={() => selectRebound("out_of_bounds")}
                  className={`h-6 px-1.5 rounded text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1 ${
                    !lastFtMiss
                      ? "opacity-30 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 border-zinc-200"
                      : ftState.lastBallOutcome === "out_of_bounds"
                        ? "bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-900/50"
                        : "bg-white dark:bg-zinc-900 text-zinc-600 border-zinc-200 dark:border-zinc-700 shadow-sm"
                  }`}
                >
                  <XCircle size={10} /> OOB
                </button>

                <button
                  type="button"
                  disabled={!lastFtMiss}
                  onClick={() => selectRebound("short")}
                  className={`h-6 px-1.5 rounded text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1 ${
                    !lastFtMiss
                      ? "opacity-30 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 border-zinc-200"
                      : ftState.lastBallOutcome === "short"
                        ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-900/50"
                        : "bg-white dark:bg-zinc-900 text-zinc-600 border-zinc-200 dark:border-zinc-700 shadow-sm"
                  }`}
                >
                  <Ban size={10} /> Short
                </button>
              </div>

              <button
                type="button"
                disabled={!lastFtMiss}
                onClick={() => selectRebound("keep_possession")}
                className={`w-full py-1.5 px-1 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1 ${
                  !lastFtMiss
                    ? "opacity-30 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 border-zinc-200"
                    : ftState.lastBallOutcome === "keep_possession"
                      ? "bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-200 dark:text-zinc-900"
                      : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <Users size={12} />
                <span>Keep Existing Possession</span>
              </button>
            </div>
            {ftState.reboundYoutubeTimestamp !== undefined && ftState.lastBallOutcome && (
              <div className="text-xs text-zinc-400 dark:text-zinc-500 font-mono text-center mt-1">
                Rebound Snapped: {formatTime(ftState.reboundYoutubeTimestamp)}
              </div>
            )}
          </div>
        )}

        {lastFtMake && (
          <div className="text-xs text-brand-navy dark:text-brand-orange font-semibold text-center mt-1 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl p-3">
            FT Terakhir MASUK: Penguasaan Bola Otomatis Beralih
          </div>
        )}

        {/* 4. ACTIONS FOR SUBMISSION / CANCEL */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setFtState(null)}
            className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSaveFT}
            disabled={!canSave}
            className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition ${
              canSave
                ? "bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer"
                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
            }`}
          >
            Simpan & Log
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* SCORING */}
      <div>
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1">
          <Target size={12} /> Scoring
        </h3>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <button
            onClick={() => startFTFlow(true)}
            className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 p-3 rounded-xl font-black text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
          >
            <span>+1 FT</span>
          </button>
          <button
            onClick={() => onLogEvent("2pt_make", 2)}
            className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 p-3 rounded-xl font-black text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
          >
            <span>+2 PT</span>
          </button>
          <button
            onClick={() => onLogEvent("3pt_make", 3)}
            className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 p-3 rounded-xl font-black text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
          >
            <span>+3 PT</span>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => startFTFlow(false)}
            className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 p-3 rounded-xl font-bold text-xs hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
          >
            <span>Miss FT</span>
          </button>
          <button
            onClick={() => onLogEvent("2pt_miss")}
            className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 p-3 rounded-xl font-bold text-xs hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
          >
            <span>Miss 2</span>
          </button>
          <button
            onClick={() => onLogEvent("3pt_miss")}
            className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 p-3 rounded-xl font-bold text-xs hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
          >
            <span>Miss 3</span>
          </button>
        </div>
      </div>

      {/* POSSESSION LOSS */}
      <div>
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1">
          <RefreshCcw size={12} /> Possession Loss
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onLogEvent("to")}
            className="bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 p-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            Turnover
          </button>
          <button
            onClick={() => onLogEvent("offensive_foul")}
            className="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 p-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            Offensive Foul
          </button>
        </div>
      </div>

      {/* FOUL / CONTACT */}
      <div>
        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1">
          <Flag size={12} /> Foul / Contact
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onLogEvent("defensive_foul")}
            className="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 p-3 rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
          >
            Defensive Foul
          </button>
          <button
            onClick={() => onLogEvent("foul_drawn")}
            className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 p-3 rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
          >
            Foul Drawn
          </button>
        </div>
      </div>

      {/* ADVANCED STATS TOGGLE */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-xs font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 uppercase tracking-widest py-2 active:scale-95 transition-all"
        >
          <span>Manual / Advanced Actions</span>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-3 p-3 bg-zinc-50 dark:bg-zinc-800/20 rounded-xl border border-zinc-100 dark:border-zinc-800 animate-in slide-in-from-top-3 duration-200">
            <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800/50 p-2 rounded-lg mb-2">
              <AlertCircle size={14} className="shrink-0 text-amber-500" />
              <span>
                These are usually derived automatically from primary events. Use
                only for manual corrections.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onLogEvent("oreb")}
                className="bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 p-3 rounded-xl font-bold text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <ArrowUpCircle size={14} /> O-REB
              </button>
              <button
                onClick={() => onLogEvent("dreb")}
                className="bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 p-3 rounded-xl font-bold text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Shield size={14} /> D-REB
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onLogEvent("ast")}
                className="bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 p-3 rounded-xl font-bold text-xs active:scale-95 transition-all shadow-sm"
              >
                AST
              </button>
              <button
                onClick={() => onLogEvent("stl")}
                className="bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 p-3 rounded-xl font-bold text-xs active:scale-95 transition-all shadow-sm"
              >
                STL
              </button>
              <button
                onClick={() => onLogEvent("blk")}
                className="bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 p-3 rounded-xl font-bold text-xs active:scale-95 transition-all shadow-sm"
              >
                BLK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

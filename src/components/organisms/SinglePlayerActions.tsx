import React, { useState } from "react";
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
  Users,
  Play,
} from "lucide-react";
import { EventType, Match, MatchRoster } from "../../core/types/stats";

interface SinglePlayerActionsProps {
  match: Match;
  matchRosters: MatchRoster[];
  playerName: string;
  playerId: string;
  isActive: boolean;
  onSubToggle: () => void;
  onLogEvent: (
    type: EventType,
    points: number,
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
}

export const SinglePlayerActions: React.FC<SinglePlayerActionsProps> = ({
  match,
  matchRosters,
  playerName,
  playerId,
  isActive,
  onSubToggle,
  onLogEvent,
}) => {
  // FT sequence configuration flow state
  const [ftState, setFtState] = useState<{
    initialResult: "success" | "miss" | "violation";
    numFTs: "1FT" | "2FT" | "3FT";
    ftOthersLogged: (boolean | "violation" | null)[];
    lastBallOutcomeLogged: boolean;
    assistedByPlayerId?: string;
    assistLogged?: boolean;
  } | null>(null);

  const homeRoster =
    matchRosters
      ?.filter((r) => r.teamId === match?.teamId && r.isActive)
      .map((r) => ({ ...r, id: r.profileId })) || [];
  const awayRoster = matchRosters
    ?.filter((r) => r.teamId === match?.opponentTeamId && r.isActive)
    .map((r) => ({ ...r, id: r.profileId })) || [
    {
      id: "opp",
      name: "Opponent Rebound",
      displayName: "Opponent Rebound",
      jerseyNumber: "REB",
    } as any,
  ];

  const startFTFlow = (result: "success" | "miss" | "violation") => {
    const isMake = result === "success";
    const subType = result === "violation" ? "Line Violation" : undefined;
    onLogEvent(
      isMake ? "1pt_make" : "1pt_miss",
      isMake ? 1 : 0,
      playerId,
      undefined,
      undefined,
      true,
      subType,
      undefined,
      undefined,
      undefined,
      { isFinalFT: true }
    );
    setFtState({
      initialResult: result,
      numFTs: "1FT",
      ftOthersLogged: [null, null],
      lastBallOutcomeLogged: false,
    });
  };

  const handlePlayNext5s = () => {
    window.dispatchEvent(new CustomEvent("youtube-play-duration", { detail: 5 }));
  };

  const handleSelectAssist = (assistantId: string) => {
    if (!ftState) return;
    
    const alreadyLogged = ftState.assistLogged;
    const hasMake = ftState.initialResult === "success" || ftState.ftOthersLogged.some(x => x === true);
    
    let shouldLogNow = false;
    if (assistantId && !alreadyLogged && hasMake) {
      shouldLogNow = true;
    }

    if (shouldLogNow) {
      onLogEvent("ast", 0, assistantId, undefined, undefined, true);
    }

    setFtState({
      ...ftState,
      assistedByPlayerId: assistantId || undefined,
      assistLogged: alreadyLogged || shouldLogNow,
    });
  };

  const logFt2 = (result: "success" | "miss" | "violation") => {
    if (!ftState) return;
    const isMake = result === "success";
    const subType = result === "violation" ? "Line Violation" : undefined;
    onLogEvent(
      isMake ? "1pt_make" : "1pt_miss",
      isMake ? 1 : 0,
      playerId,
      undefined,
      undefined,
      true,
      subType,
      undefined,
      undefined,
      undefined,
      { isFinalFT: ftState.numFTs === "2FT" }
    );
    const newOthers = [...ftState.ftOthersLogged];
    newOthers[0] = result === "success" ? true : result === "violation" ? "violation" : false;

    let assistLogged = ftState.assistLogged;
    if (isMake && ftState.assistedByPlayerId && !assistLogged) {
      onLogEvent("ast", 0, ftState.assistedByPlayerId, undefined, undefined, true);
      assistLogged = true;
    }

    setFtState({ ...ftState, ftOthersLogged: newOthers, assistLogged });
  };

  const logFt3 = (result: "success" | "miss" | "violation") => {
    if (!ftState) return;
    const isMake = result === "success";
    const subType = result === "violation" ? "Line Violation" : undefined;
    onLogEvent(
      isMake ? "1pt_make" : "1pt_miss",
      isMake ? 1 : 0,
      playerId,
      undefined,
      undefined,
      true,
      subType,
      undefined,
      undefined,
      undefined,
      { isFinalFT: true }
    );
    const newOthers = [...ftState.ftOthersLogged];
    newOthers[1] = result === "success" ? true : result === "violation" ? "violation" : false;

    let assistLogged = ftState.assistLogged;
    if (isMake && ftState.assistedByPlayerId && !assistLogged) {
      onLogEvent("ast", 0, ftState.assistedByPlayerId, undefined, undefined, true);
      assistLogged = true;
    }

    setFtState({ ...ftState, ftOthersLogged: newOthers, assistLogged });
  };

  const logRebound = (type: string, targetId: string) => {
    if (!ftState) return;
    onLogEvent(type as EventType, 0, targetId, undefined, undefined, true);
    setFtState({ ...ftState, lastBallOutcomeLogged: true });
    
    // Automatically close the FT panel once rebound/deadball is logged
    setTimeout(() => {
      setFtState(null);
    }, 500);
  };

  if (ftState) {
    const isLastFtMake =
      ftState.numFTs === "1FT"
        ? ftState.initialResult === "success"
        : ftState.numFTs === "2FT"
          ? ftState.ftOthersLogged[0] === true
          : ftState.ftOthersLogged[1] === true;

    const isReadyForRebound = isLastFtMake === false;

    return (
      <div className="p-3 bg-zinc-50 dark:bg-zinc-800/20 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl space-y-3 animate-in fade-in duration-200">
        <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
            <Target size={12} className="text-amber-500" />
            FT Setup ({playerName})
          </h3>
          <button
            type="button"
            onClick={() => setFtState(null)}
            className="text-xs font-bold text-zinc-400 hover:text-red-500 dark:hover:text-red-400 uppercase tracking-widest"
          >
            Batal
          </button>
        </div>

        {/* 1. SELECTION QUANTITY OF FTs */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
            JUMLAH FREE THROW
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {(["1FT", "2FT", "3FT"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setFtState({
                    ...ftState,
                    numFTs: opt,
                  });
                }}
                className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider border transition-all ${
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

        {/* VIDEO REVIEW */}
        <div className="flex justify-center mb-1">
          <button
            type="button"
            onClick={handlePlayNext5s}
            className="w-full py-2.5 flex items-center justify-center gap-2.5 text-xs font-black tracking-wider text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all"
          >
            <Play size={10} /> PLAY +5 DETIK VIDEO
          </button>
        </div>

        {/* 2. SPECIFY RESULTS FOR OTHER SLOT FTs */}
        <div className="space-y-1.5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg p-3 text-xs">
          <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300 py-0.5 border-b border-zinc-100 dark:border-zinc-800">
            <span className="font-semibold text-xs">FT 1</span>
            <span
              className={`px-1.5 py-0.2 rounded font-black text-[10px] ${
                ftState.initialResult === "success"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30"
                  : ftState.initialResult === "violation"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30"
                    : "bg-red-50 text-red-700 dark:bg-red-900/30"
              }`}
            >
              {ftState.initialResult === "success"
                ? "MASUK ✅"
                : ftState.initialResult === "violation"
                  ? "KAKI GARIS ⚠️"
                  : "MISSED ❌"}
            </span>
          </div>

          {(ftState.numFTs === "2FT" || ftState.numFTs === "3FT") && (
            <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300 py-0.5 border-b border-zinc-100 dark:border-zinc-800">
              <span className="font-semibold text-xs">FT 2</span>
              {ftState.ftOthersLogged[0] !== null ? (
                <span className={`px-1.5 py-0.2 rounded font-black text-[10px] ${
                  ftState.ftOthersLogged[0] === true
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30"
                    : ftState.ftOthersLogged[0] === "violation"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30"
                      : "bg-red-50 text-red-700 dark:bg-red-900/30"
                }`}>
                  {ftState.ftOthersLogged[0] === true
                    ? "MASUK ✅"
                    : ftState.ftOthersLogged[0] === "violation"
                      ? "KAKI GARIS ⚠️"
                      : "MISSED ❌"}
                </span>
              ) : (
                <div className="flex gap-1 flex-wrap justify-end">
                  <button type="button" onClick={() => logFt2("success")} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 rounded font-bold text-[10px]">MASUK</button>
                  <button type="button" onClick={() => logFt2("miss")} className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 rounded font-bold text-[10px]">MISSED</button>
                  <button type="button" onClick={() => logFt2("violation")} className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 rounded font-bold text-[10px]" title="Kaki Melewati Garis">KAKI GARIS</button>
                </div>
              )}
            </div>
          )}

          {ftState.numFTs === "3FT" && (
            <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300 py-0.5">
              <span className="font-semibold text-xs">FT 3</span>
              {ftState.ftOthersLogged[1] !== null ? (
                <span className={`px-1.5 py-0.2 rounded font-black text-[10px] ${
                  ftState.ftOthersLogged[1] === true
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30"
                    : ftState.ftOthersLogged[1] === "violation"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30"
                      : "bg-red-50 text-red-700 dark:bg-red-900/30"
                }`}>
                  {ftState.ftOthersLogged[1] === true
                    ? "MASUK ✅"
                    : ftState.ftOthersLogged[1] === "violation"
                      ? "KAKI GARIS ⚠️"
                      : "MISSED ❌"}
                </span>
              ) : (
                <div className="flex gap-1 flex-wrap justify-end">
                  <button type="button" onClick={() => logFt3("success")} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 rounded font-bold text-[10px]">MASUK</button>
                  <button type="button" onClick={() => logFt3("miss")} className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 rounded font-bold text-[10px]">MISSED</button>
                  <button type="button" onClick={() => logFt3("violation")} className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 rounded font-bold text-[10px]" title="Kaki Melewati Garis">KAKI GARIS</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ASSIST SELECTION (Optional) */}
        <div className="space-y-1 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg p-3 text-xs">
          <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
            ASSIST OLEH (OPSIONAL)
          </label>
          <select
            value={ftState.assistedByPlayerId || ""}
            onChange={(e) => handleSelectAssist(e.target.value)}
            className="w-full text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-brand-orange text-zinc-700 dark:text-zinc-300"
          >
            <option value="">-- Tanpa Assist --</option>
            {homeRoster.filter(r => r.id !== playerId).map((t) => (
              <option key={t.id} value={t.id}>
                {t.jerseyNumber ? `#${t.jerseyNumber} ` : ""}{t.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. IMPACT OF THE LAST FT */}
        {isReadyForRebound && !ftState.lastBallOutcomeLogged && (
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
              DAMPAK DARI BOLA TERAKHIR
            </label>
            <div className="space-y-1">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl p-2.5 flex flex-wrap items-center gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 w-full mb-0.5">
                  Tim Kita
                </span>
                {homeRoster.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => logRebound("oreb", p.id)}
                    className="h-6 min-w-6 px-1.5 rounded text-xs font-bold font-display uppercase tracking-wider border transition-all bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 shadow-sm"
                  >
                    {p.jerseyNumber || p.id.substring(0, 2)}{" "}
                    {p.id === playerId ? "(KITA)" : ""}
                  </button>
                ))}
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl p-2.5 flex flex-wrap items-center gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 w-full mb-0.5">
                  Lawan & Lainnya
                </span>
                {awayRoster.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => logRebound("dreb", p.id)}
                    className="h-6 px-2 rounded text-xs font-bold font-display uppercase tracking-wider border transition-all bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 shadow-sm"
                  >
                    {p.jerseyNumber === "OPP" || p.jerseyNumber === "REB" || p.jerseyNumber === "-"
                      ? p.displayName || p.name
                      : p.jerseyNumber}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => logRebound("dead_ball", playerId)}
                  className="h-6 px-1.5 rounded text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1 bg-white dark:bg-zinc-900 text-zinc-600 border-zinc-200 dark:border-zinc-700 shadow-sm"
                >
                  <XCircle size={10} /> OOB
                </button>

                <button
                  type="button"
                  onClick={() => logRebound("dead_ball", playerId)}
                  className="h-6 px-1.5 rounded text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1 bg-white dark:bg-zinc-900 text-zinc-600 border-zinc-200 dark:border-zinc-700 shadow-sm"
                >
                  <Ban size={10} /> Short
                </button>
              </div>
            </div>
          </div>
        )}

        {!isReadyForRebound && isLastFtMake === true && (
          <button
            type="button"
            onClick={() => setFtState(null)}
            className="w-full py-2 bg-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-emerald-600 transition-all"
          >
            SELESAI (MASUK)
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="transition-opacity duration-200 flex-1 flex flex-col justify-end opacity-100">
      <div className="flex justify-between items-center mb-1.5">
        <h2 className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-1">
          <Target size={12} /> Record Action{" "}
          {playerName ? `for ${playerName}` : ""}
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-2">
        <button
          onClick={() => startFTFlow("success")}
          className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 p-3 rounded-xl font-black text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
        >
          <Target size={16} className="opacity-80" />
          <span>+1 FT</span>
        </button>
        <button
          onClick={() => onLogEvent("2pt_make", 2, playerId)}
          className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 p-3 rounded-xl font-black text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
        >
          <Target size={16} className="opacity-80" />
          <span>+2 PT</span>
        </button>
        <button
          onClick={() => onLogEvent("3pt_make", 3, playerId)}
          className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 p-3 rounded-xl font-black text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
        >
          <Target size={16} className="opacity-80" />
          <span>+3 PT</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-2">
        <button
          onClick={() => startFTFlow("miss")}
          className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 p-2.5 rounded-xl font-bold text-xs hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
        >
          <XCircle size={14} className="opacity-80" />
          <span>Miss FT</span>
        </button>
        <button
          onClick={() => onLogEvent("2pt_miss", 0, playerId)}
          className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 p-2.5 rounded-xl font-bold text-xs hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
        >
          <XCircle size={14} className="opacity-80" />
          <span>Miss 2</span>
        </button>
        <button
          onClick={() => onLogEvent("3pt_miss", 0, playerId)}
          className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 p-2.5 rounded-xl font-bold text-xs hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
        >
          <XCircle size={14} className="opacity-80" />
          <span>Miss 3</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-2">
        <button
          onClick={() => onLogEvent("oreb", 0, playerId)}
          className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 p-3 rounded-xl font-bold text-xs hover:bg-blue-100 dark:hover:bg-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2.5"
        >
          <ArrowUpCircle size={14} /> O-REB
        </button>
        <button
          onClick={() => onLogEvent("dreb", 0, playerId)}
          className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 p-3 rounded-xl font-bold text-xs hover:bg-blue-100 dark:hover:bg-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2.5"
        >
          <Shield size={14} /> D-REB
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        <button
          onClick={() => onLogEvent("ast", 0, playerId)}
          className="bg-zinc-100 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 p-2.5 rounded-xl font-bold text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
        >
          <Handshake size={14} className="opacity-70" /> AST
        </button>
        <button
          onClick={() => onLogEvent("stl", 0, playerId)}
          className="bg-zinc-100 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 p-2.5 rounded-xl font-bold text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
        >
          <Hand size={14} className="opacity-70" /> STL
        </button>
        <button
          onClick={() => onLogEvent("blk", 0, playerId)}
          className="bg-zinc-100 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 p-2.5 rounded-xl font-bold text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
        >
          <Ban size={14} className="opacity-70" /> BLK
        </button>
        <button
          onClick={() => onLogEvent("to", 0, playerId)}
          className="bg-zinc-100 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 p-2.5 rounded-xl font-bold text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
        >
          <RefreshCcw size={14} className="opacity-70" /> TO
        </button>
      </div>

      <div className="flex gap-3 mt-1.5">
        <button
          onClick={() => onLogEvent("defensive_foul", 0, playerId)}
          className="flex-1 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 p-3 rounded-xl font-bold text-xs hover:bg-orange-100 dark:hover:bg-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2.5"
        >
          <Flag size={14} /> FOUL
        </button>
        <button
          onClick={() => onLogEvent("foul_drawn", 0, playerId)}
          className="flex-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 p-3 rounded-xl font-bold text-xs hover:bg-blue-100 dark:hover:bg-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2.5"
        >
          <Handshake size={14} /> FOUL DRAWN
        </button>
      </div>

      <div className="flex bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50 p-1 mt-1.5">
        <button
          onClick={() => onLogEvent("1pt_make", 1, "opp")}
          className="flex-1 py-2 text-xs font-black uppercase tracking-tight text-zinc-600 dark:text-zinc-400 hover:text-red-500 transition-colors"
        >
          OPP +1
        </button>
        <div className="w-px bg-zinc-200 dark:bg-zinc-700 mx-1 self-stretch"></div>
        <button
          onClick={() => onLogEvent("2pt_make", 2, "opp")}
          className="flex-1 py-2 text-xs font-black uppercase tracking-tight text-zinc-600 dark:text-zinc-400 hover:text-red-500 transition-colors"
        >
          OPP +2
        </button>
        <div className="w-px bg-zinc-200 dark:bg-zinc-700 mx-1 self-stretch"></div>
        <button
          onClick={() => onLogEvent("3pt_make", 3, "opp")}
          className="flex-1 py-2 text-xs font-black uppercase tracking-tight text-zinc-600 dark:text-zinc-400 hover:text-red-500 transition-colors"
        >
          OPP +3
        </button>
        <div className="w-px bg-zinc-200 dark:bg-zinc-700 mx-1 self-stretch"></div>
        <button
          onClick={() => onLogEvent("defensive_foul", 0, "opp")}
          className="flex-1 py-2 text-xs font-black uppercase tracking-tight text-zinc-600 dark:text-zinc-400 hover:text-red-500 transition-colors"
        >
          OPP FOUL
        </button>
      </div>
    </div>
  );
};

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  GameEvent,
  Match,
  GameState,
  TurnoverType,
  FoulType,
  ShotDifficulty,
  AssistType,
  GameContext,
  Possession,
  Player,
  EventType,
  PossessionOutcome,
  PossessionClosingAction,
  PossessionOpeningSource,
  MatchRoster,
} from "../../../core/types/stats";
import { statsService } from "../../../core/services/statsService";
import { generateId } from "../../../core/utils/idUtils";
import { getShotAreaName } from "../../../core/utils/courtUtils";
import { checkPossessionAnomaly } from "../utils/anomalyDetection";
import { INITIAL_PROMPT_FLOWS } from "../../../core/config/initialFlowData";
import { PromptFlow } from "../../../core/types/promptFlow";

export type PendingAction =
  | {
      type: "rebound";
      playerId: string;
      team: "home" | "away";
      eventId?: string;
    }
  | { type: "steal"; playerId: string; team: "home" | "away"; eventId?: string }
  | {
      type: "turnover";
      playerId: string;
      team: "home" | "away";
      eventId?: string;
    }
  | { type: "block"; playerId: string; team: "home" | "away"; eventId?: string }
  | {
      type: "freethrow";
      playerId: string;
      team: "home" | "away";
      isMake: boolean;
      eventId?: string;
    }
  | {
      type: "assist";
      playerId: string;
      team: "home" | "away";
      eventId?: string;
    }
  | {
      type: "foul_drawn";
      playerId: string;
      team: "home" | "away";
      eventId?: string;
    }
  | { type: "jumpball"; playerId?: string; team?: "home" | "away" }
  | {
      type: "missing_event";
      playerId: string;
      team: "home" | "away";
      eventId?: string;
      pendingEventParams?: any;
    };

export type InteractionType =
  | "smartPrompt"
  | "turnover"
  | "foul"
  | "shotDifficulty"
  | "assistType"
  | "gameContext"
  | "pressureLevel"
  | "reboundType"
  | "configurablePrompt"
  | "confirmation";

export interface ActiveInteraction {
  type: InteractionType;
  data: any;
}

interface UseTrackingLogicProps {
  match: Match | null;
  matchRosters: MatchRoster[];
  gameState: GameState | null;
  setGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
  events: GameEvent[];
  setEvents: React.Dispatch<React.SetStateAction<GameEvent[]>>;
  activePlayerId: string | null;
  setActivePlayerId: React.Dispatch<React.SetStateAction<string | null>>;
  activeTeam: "home" | "away";
  setActiveTeam: React.Dispatch<React.SetStateAction<"home" | "away">>;
  pendingShot: { type: string; points: number; playerId?: string; youtubeTimestamp?: number } | null;
  setPendingShot: React.Dispatch<
    React.SetStateAction<{
      type: string;
      points: number;
      playerId?: string;
      youtubeTimestamp?: number;
    } | null>
  >;
  updateMatchStatusToOngoing: () => Promise<void>;
  allPlayers: Player[];
  onToggleTimer: () => void;
  setMatchRosters: React.Dispatch<React.SetStateAction<MatchRoster[]>>;
  onEventRecorded?: (event: GameEvent, videoTimeSeconds: number) => void;
}

export const useTrackingLogic = ({
  match,
  matchRosters,
  gameState,
  setGameState,
  events,
  setEvents,
  activePlayerId,
  setActivePlayerId,
  activeTeam,
  setActiveTeam,
  pendingShot,
  setPendingShot,
  updateMatchStatusToOngoing,
  allPlayers,
  onToggleTimer,
  setMatchRosters,
  onEventRecorded,
}: UseTrackingLogicProps) => {
  const [activeInteraction, setActiveInteraction] =
    useState<ActiveInteraction | null>(null);
  const [currentPossession, setCurrentPossession] = useState<string | null>(
    null,
  );
  const [activePossession, setActivePossession] = useState<Possession | null>(
    null,
  );
  const [isInitializingPossession, setIsInitializingPossession] =
    useState(true);

  // Auto-sync activeTeam with possession
  useEffect(() => {
    if (activePossession?.teamInPossession) {
      setActiveTeam(activePossession.teamInPossession);
    }
  }, [activePossession?.id, activePossession?.teamInPossession]);

  const inFlowRef = useRef(false);

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Helper to set active interaction
  const setInteraction = (type: InteractionType | null, data: any = null) => {
    if (type === null) {
      setActiveInteraction(null);
    } else {
      setActiveInteraction({ type, data });
    }
  };

  // Load active possession on mount or match change
  useEffect(() => {
    const loadActivePossession = async () => {
      if (!match) return;
      try {
        const possessions = await statsService.getPossessions(match.id);
        // Find the most recent open possession
        const active = possessions.find((p) => !p.clockEnd);
        if (active) {
          setActivePossession(active);
          setActiveTeam(active.teamInPossession);
        } else {
          setActivePossession(null);
        }
      } catch (err) {
        console.error("Failed to load active possession:", err);
      } finally {
        setIsInitializingPossession(false);
      }
    };
    loadActivePossession();
  }, [match?.id]);

  useEffect(() => {
    const handleTriggerJumpball = () => {
      if (match?.recordingType !== "single") {
        setInteraction("smartPrompt", { type: "jumpball" });
      }
    };
    window.addEventListener("trigger-jumpball", handleTriggerJumpball);
    return () =>
      window.removeEventListener("trigger-jumpball", handleTriggerJumpball);
  }, [match?.recordingType]);

  const checkResumeTimer = () => {
    if (match?.clockMode === "stop") {
      // In stop clock mode, we do NOT auto-resume the clock when prompts finish.
      // The play is dead until a legal restart event (e.g. inbound) is logged.
      return;
    }
    if (!gameStateRef.current?.isRunning) {
      // Only resume if no more prompts are pending
      if (!activeInteraction) {
        onToggleTimer();
      }
    }
  };

  useEffect(() => {
    // Check for resume whenever any pending state changes to null
    checkResumeTimer();
  }, [activeInteraction]);

  const logEvent = async (
    type: string,
    points: number = 0,
    overridePlayerId?: string,
    x?: number,
    y?: number,
    skipSmartPrompt: boolean = false,
    subType?: string,
    customTimestamp?: number,
    customQuarter?: number,
    customYoutubeTimestamp?: number,
    metadata?: any,
    skipOnCourtCheck: boolean = false,
  ): Promise<GameEvent | undefined> => {
    const targetPlayerId = overridePlayerId || activePlayerId;
    if (!gameStateRef.current || !match || !targetPlayerId) return undefined;

    const isTeamEvent = [
      "home_team", "away_team", "our_team", "opponent_team", "opp", "team"
    ].includes(targetPlayerId);

    const isPlayerEvent = !isTeamEvent && (
      matchRosters.some(r => r.profileId === targetPlayerId) || 
      allPlayers.some(p => p.id === targetPlayerId)
    );

    if (isPlayerEvent && !skipOnCourtCheck) {
      const homeTeamId = match.teamId || "home_team";
      const isHome =
        matchRosters.some(
          (r) => r.teamId === homeTeamId && r.profileId === targetPlayerId,
        ) ||
        targetPlayerId === "home_team" ||
        targetPlayerId === homeTeamId ||
        targetPlayerId === "our_team";

      const teamId = isHome
        ? match.teamId || "home_team"
        : match.opponentTeamId || "away_team";

      const activeStint = await statsService.getActiveMatchStint(match.id, teamId);
      const isOnCourt = activeStint ? activeStint.playerIds.includes(targetPlayerId) : false;

      if (!isOnCourt) {
        const player = allPlayers.find((p) => p.id === targetPlayerId);
        const playerName = player?.name || targetPlayerId;

        if (window.innerWidth >= 1024) {
          window.dispatchEvent(new CustomEvent("pause-youtube"));
        }

        setInteraction("confirmation", {
          title: "Pemain Tidak di Lapangan",
          description: `Pemain ${playerName} tidak tercatat di lapangan. Tetap catat? (Ini akan ditandai untuk audit)`,
          onConfirm: async () => {
            setInteraction(null);
            const updatedMetadata = { ...(metadata || {}), attributionWarning: true };
            await logEvent(
              type,
              points,
              overridePlayerId,
              x,
              y,
              skipSmartPrompt,
              subType,
              customTimestamp,
              customQuarter,
              customYoutubeTimestamp,
              updatedMetadata,
              true // skipOnCourtCheck = true
            );
          },
          confirmText: "Tetap Catat",
          cancelText: "Batal"
        });
        return undefined;
      }
    }

    // Pause YouTube immediately when starting a log
    if (window.innerWidth >= 1024) {
      window.dispatchEvent(new CustomEvent("pause-youtube"));
      inFlowRef.current = true;
    }

    const isShot = ["2pt_make", "3pt_make", "2pt_miss", "3pt_miss"].includes(
      type,
    );
    if (
      (isShot || (type === "blocked_shot" && match.recordingMode !== "lite")) &&
      x === undefined &&
      y === undefined
    ) {
      let youtubeTimestamp = 0;
      try {
        youtubeTimestamp = await new Promise<number>((resolve) => {
          const handler = (e: any) => {
            window.removeEventListener("youtube-time-report", handler);
            resolve(e.detail);
          };
          window.addEventListener("youtube-time-report", handler);
          window.dispatchEvent(new CustomEvent("get-youtube-time"));
          setTimeout(() => {
            window.removeEventListener("youtube-time-report", handler);
            resolve(0);
          }, 200);
        });
        youtubeTimestamp = Math.max(0, youtubeTimestamp - 1);
      } catch (err) {
        console.error("Failed to get YouTube timestamp for pending shot:", err);
      }

      setPendingShot({ type, points, playerId: targetPlayerId, youtubeTimestamp });
      setActivePlayerId(null);
      return undefined;
    }

    await updateMatchStatusToOngoing();

    let playerAgeAtMatch: number | string | undefined = match.ageGroup;
    const player = allPlayers.find((p) => p.id === targetPlayerId);
    if (player && player.birthDate) {
      const matchDate = new Date(match.date);
      const birthDate = new Date(player.birthDate);
      let age = matchDate.getFullYear() - birthDate.getFullYear();
      const m = matchDate.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && matchDate.getDate() < birthDate.getDate())) {
        age--;
      }
      playerAgeAtMatch = age;
    }

    const homeTeamId = match.teamId || "home_team";
    const isHome =
      matchRosters.some(
        (r) => r.teamId === homeTeamId && r.profileId === targetPlayerId,
      ) ||
      targetPlayerId === "home_team" ||
      targetPlayerId === homeTeamId ||
      targetPlayerId === "our_team";
    const eventTeam = isHome ? "home" : "away";

    const teamId = isHome
      ? match.teamId || "home_team"
      : match.opponentTeamId || "away_team";

    const newEventId = generateId("evt");

    // Get YouTube timestamp
    let youtubeTimestamp = 0;
    if (customYoutubeTimestamp !== undefined) {
      youtubeTimestamp = customYoutubeTimestamp;
    } else {
      try {
        youtubeTimestamp = await new Promise<number>((resolve) => {
          const handler = (e: any) => {
            window.removeEventListener("youtube-time-report", handler);
            resolve(e.detail);
          };
          window.addEventListener("youtube-time-report", handler);
          window.dispatchEvent(new CustomEvent("get-youtube-time"));
          setTimeout(() => {
            window.removeEventListener("youtube-time-report", handler);
            resolve(0);
          }, 200);
        });
        // Subtract 1 second as requested
        youtubeTimestamp = Math.max(0, youtubeTimestamp - 1);
      } catch (err) {
        console.error("Failed to get YouTube timestamp:", err);
      }
    }

    const finalTimestamp =
      customTimestamp !== undefined ? customTimestamp : gameStateRef.current.timeRemaining;
    const finalQuarter =
      customQuarter !== undefined ? customQuarter : gameStateRef.current.currentQuarter;

    // Sync warning check
    if (youtubeTimestamp > 0 && events.length > 0) {
      const lastEvent = events[events.length - 1];
      if (lastEvent && lastEvent.youtubeTimestamp !== undefined && lastEvent.timestamp !== undefined) {
         // Only trigger sync warning if we are in the same quarter
         if (finalQuarter === lastEvent.quarter) {
            const gameTimeDelta = finalTimestamp - lastEvent.timestamp;
            const ytTimeDelta = youtubeTimestamp - lastEvent.youtubeTimestamp;
            
            // If game timer counts DOWN (delta < 0) but YT went BACKWARDS (delta < -2)
            if (gameTimeDelta < 0 && ytTimeDelta < -2) {
               window.dispatchEvent(new CustomEvent('sync-warning', { detail: { 
                 text: "Timestamp YouTube mundur, tetapi game timer maju. Apakah perlu kalibrasi?",
                 status: 'ambiguous',
                 parsed: "Potensi Masalah Sinkronisasi"
               }}));
            } 
            // If game timer counts UP (delta > 0) but YT went FORWARDS (delta > 2)
            else if (gameTimeDelta > 0 && ytTimeDelta > 2) {
               window.dispatchEvent(new CustomEvent('sync-warning', { detail: { 
                 text: "Game timer mundur, tetapi timestamp YouTube maju. Apakah perlu kalibrasi?",
                 status: 'ambiguous',
                 parsed: "Potensi Masalah Sinkronisasi"
               }}));
            }
         }
      }
    }

    // Smart Prompt Validation for Possession Anomalies
    if (
      !skipSmartPrompt &&
      checkPossessionAnomaly(
        type,
        eventTeam,
        events,
        matchRosters,
        homeTeamId,
        match.recordingType || "full",
      )
    ) {
      setInteraction("smartPrompt", {
        type: "missing_event" as any,
        playerId: targetPlayerId,
        eventId: generateId("prompt"),
        team: eventTeam,
        youtubeTimestamp,
        pendingEventParams: {
          type,
          points,
          overridePlayerId,
          x,
          y,
          skipSmartPrompt: true,
        },
      });
      return;
    }

    const scoreDiff = isHome
      ? gameState.homeScore - gameState.awayScore
      : gameState.awayScore - gameState.homeScore;

    const isClutch =
      gameState.currentQuarter >= 4 &&
      gameState.timeRemaining <= 300 &&
      Math.abs(scoreDiff) <= 5;

    // Single Mode Logic: Check if we should only record context
    const isContextOnly =
      match.recordingType === "single" && targetPlayerId !== match.childId;

    let nextTeamInPossession = eventTeam;

    // Determine which team has possession AFTER this event
    if (["dreb", "stl"].includes(type)) {
      nextTeamInPossession = eventTeam; // We just got the ball
    } else if (["1pt_make", "2pt_make", "3pt_make", "to"].includes(type)) {
      nextTeamInPossession = eventTeam === "home" ? "away" : "home"; // Possession changes after score or TO
    } else if (type === "offensive_foul") {
      nextTeamInPossession = eventTeam === "home" ? "away" : "home"; // Offensive foul possession changes
    } else if (type === "blk") {
      nextTeamInPossession = eventTeam === "home" ? "away" : "home"; // Blocker's opponent (shooter's team) keeps possession
    } else if (type === "defensive_foul" || type === "foul") {
      // If the team committing the foul had possession, it's an offensive foul -> possession changes
      const hadPossession = activePossession?.teamInPossession === eventTeam;
      if (hadPossession) {
        nextTeamInPossession = eventTeam === "home" ? "away" : "home";
      } else {
        nextTeamInPossession = eventTeam === "home" ? "away" : "home"; // Defensive foul: possession stays with the OTHER team
      }
    } else if (type === "foul_drawn") {
      nextTeamInPossession = eventTeam;
      // Trigger prompt to identify who fouled this player
      if (!skipSmartPrompt) {
        if (gameState?.isRunning) onToggleTimer();
        setInteraction("smartPrompt", {
          type: "foul_drawn",
          playerId: targetPlayerId,
          team: eventTeam === "home" ? "away" : "home",
          eventId: newEventId,
          youtubeTimestamp,
        } as any);
      }
    }

    let currentPossessionId = currentPossession;
    let activePossessionObj = activePossession;

    const isOpeningEvent = [
      "stl",
      "dreb",
      "oreb",
      "inbound",
      "jumpball",
      "foul_drawn",
    ].includes(type);
    const isClosingEvent = [
      "1pt_make",
      "2pt_make",
      "3pt_make",
      "to",
      "stl",
      "dreb",
      "blocked_shot",
      "foul",
      "offensive_foul",
      "defensive_foul",
    ].includes(type);



    // Use current active possession team for the event log record (before it is closed/opened)
    // If there is no active possession yet, assume it belongs to the team orchestrating this entry action
    const currentPossessionTeamForLog = activePossessionObj
      ? activePossessionObj.teamInPossession
      : eventTeam;

    const newEvent: GameEvent = {
      id: newEventId,
      matchId: match.id,
      playerId: targetPlayerId,
      type: type as EventType,
      subType,
      timestamp: finalTimestamp,
      quarter: finalQuarter,
      realTime: new Date().toISOString(),
      x,
      y,
      playerAgeAtMatch,
      scoreDifference: scoreDiff,
      isClutch,
      possessionId: currentPossessionId || undefined,
      possession: currentPossessionTeamForLog,
      youtubeTimestamp,
      points,
      team: isHome ? "home" : "away",
      isContextOnly,
      metadata: {
        ...metadata,
        areaName:
          x !== undefined && y !== undefined
            ? getShotAreaName(x, y)
            : undefined,
      },
    };

    // Anomaly Detection
    let isAnomaly = false;
    let anomalyReason = "";
    if (
      activePossessionObj &&
      activePossessionObj.teamInPossession === (isHome ? "home" : "away")
    ) {
      if (events.length > 0) {
        const lastEvent = events[events.length - 1];
        if (
          ["2pt_miss", "3pt_miss", "1pt_miss"].includes(lastEvent.type) &&
          type !== "oreb"
        ) {
          if (
            ![
              "foul",
              "offensive_foul",
              "defensive_foul",
              "timeout",
              "sub_in",
              "sub_out",
              "stl",
              "dreb",
            ].includes(type)
          ) {
            isAnomaly = true;
            anomalyReason = `Missed shot followed by ${type} without rebound.`;
          }
        }
      }
    }

    // Possession Lifecycle Management
    if (activePossessionObj && (isOpeningEvent || isClosingEvent)) {
      if (isClosingEvent) {
        const pScored =
          type === "1pt_make"
            ? 1
            : type === "2pt_make"
              ? 2
              : type === "3pt_make"
                ? 3
                : 0;
        const outcome: PossessionOutcome = type.includes("make")
          ? "score"
          : type === "to"
            ? "turnover"
            : "empty";
        const action: PossessionClosingAction = type.includes("make")
          ? "made_shot"
          : type === "to"
            ? "turnover"
            : "missed_shot";

        activePossessionObj = await statsService.closePossession(
          activePossessionObj,
          {
            clockEnd: finalTimestamp,
            closingEventId: newEvent.id,
            closingAction: action,
            closingPlayerId: targetPlayerId,
            outcome,
            pointsScored: activePossessionObj.pointsScored + pScored,
          },
        );
        activePossessionObj = null;
        currentPossessionId = null;
      } else if (isOpeningEvent) {
        activePossessionObj = await statsService.closePossession(
          activePossessionObj,
          {
            clockEnd: finalTimestamp,
            closingEventId: newEvent.id,
            closingAction: "deadball_end",
            outcome: "empty",
          },
        );
        activePossessionObj = null;
        currentPossessionId = null;
      }
    }

    if (!activePossessionObj && isOpeningEvent) {
      const source: PossessionOpeningSource =
        type === "stl"
          ? "steal"
          : type === "dreb"
            ? "dreb"
            : type === "oreb"
              ? "oreb"
              : type === "inbound"
                ? "inbound"
                : "jumpball";

      activePossessionObj = await statsService.openPossession({
        matchId: match.id,
        teamInPossession: isHome ? "home" : "away",
        period: finalQuarter,
        clockStart: finalTimestamp,
        openingEventId: newEvent.id,
        openingSource: source,
        openingPlayerId: targetPlayerId,
        teamId,
      });
      currentPossessionId = activePossessionObj.id;
      newEvent.possessionId = currentPossessionId;
      setActiveTeam(isHome ? "home" : "away");

      if (isAnomaly) {
        await statsService.markPossessionAnomaly(
          activePossessionObj.id,
          anomalyReason,
        );
      }
    } else if (points > 0 && activePossessionObj) {
      activePossessionObj.pointsScored += points;
      await statsService.updatePossession(activePossessionObj);
    }

    setCurrentPossession(currentPossessionId);
    setActivePossession(activePossessionObj);
    setActiveTeam(nextTeamInPossession as "home" | "away");

    setEvents((prev) => [...prev, newEvent]);
    setActivePlayerId(null);

    await statsService.addEvent(newEvent);

    if (onEventRecorded) {
      onEventRecorded(newEvent, youtubeTimestamp);
    }

    let newState = { ...gameStateRef.current };
    let stateChanged = false;

    if (points > 0) {
      if (isHome) {
        newState.homeScore += points;
      } else {
        newState.awayScore += points;
      }
      stateChanged = true;
    }

    if (type === "foul" || type === "defensive_foul" || type === "offensive_foul" || type === "foul_drawn") {
      if (isHome) {
        newState.homeFouls += 1;
      } else {
        newState.awayFouls += 1;
      }
      stateChanged = true;
    }

    if (match.clockMode === 'stop') {
      // Rule 1: Events that stop the Game Clock (Referee whistles / Dead balls)
      // Including fouls, turnovers, timeouts, jumpballs, and other stoppage conditions.
      const isStoppageEvent = [
        'foul',
        'offensive_foul',
        'defensive_foul',
        'foul_drawn',
        'to', // All turnovers (including travel, out of bounds, double dribble, carrying, various violations)
        'timeout',
        'jumpball',
        'dead_ball'
      ].includes(type);

      // Rule 2: Successful field goals (2pt_make, 3pt_make)
      const isMadeFieldGoal = ['2pt_make', '3pt_make'].includes(type);

      let shouldStopClock = isStoppageEvent;

      if (isMadeFieldGoal) {
        const rule = match.stopClockOnMadeBasket || 'fiba';
        if (rule === 'always') {
          shouldStopClock = true;
        } else if (rule === 'never') {
          shouldStopClock = false;
        } else {
          // FIBA Standard: 2:00 minutes or less (<= 120 seconds) in the 4th quarter or overtime
          const isLastTwoMinutesOfFourthOrOT = newState.currentQuarter >= 4 && newState.timeRemaining <= 120;
          shouldStopClock = isLastTwoMinutesOfFourthOrOT;
        }
      }

      // Rule 3: Events that restart the Game Clock (Moment live play legally resumes)
      // Clock restarts when the ball touches a player on court:
      // - After a throw-in / inbound: 'inbound'
      // - After a missed live free throw or jump ball: rebound ('oreb', 'dreb'), steal ('stl'), block ('blk')
      const isRestartEvent = [
        'inbound',
        'oreb',
        'dreb',
        'stl',
        'blk'
      ].includes(type) || (isMadeFieldGoal && !shouldStopClock);

      // Rule 4: Missed free throws (1pt_miss) or made free throws (1pt_make) should NOT repeatedly trigger a clock stop
      // nor start the clock because the free throw is attempted while the clock is already stopped.
      // They are ignored for starting/stopping the clock, preserving the stopped state.
      const isFreeThrow = ['1pt_make', '1pt_miss'].includes(type);

      if (shouldStopClock) {
        window.dispatchEvent(new CustomEvent('stoppage-event-logged'));
        if (newState.isRunning) {
          newState.isRunning = false;
          stateChanged = true;
        }
      } else if (isRestartEvent && !isFreeThrow) {
        if (!newState.isRunning) {
          newState.isRunning = true;
          stateChanged = true;
        }
      }
    } else {
      // Continuous / Running clock format: keep existing behavior
      if (
        [
          "1pt_make",
          "2pt_make",
          "3pt_make",
          "to",
          "foul",
          "offensive_foul",
          "defensive_foul",
          "timeout",
        ].includes(type)
      ) {
        if (newState.isRunning) {
          newState.isRunning = false;
          stateChanged = true;
        }
      }

      if (["stl", "oreb", "dreb", "blk"].includes(type)) {
        if (!newState.isRunning) {
          newState.isRunning = true;
          stateChanged = true;
        }
      }
    }

    if (stateChanged) {
      setGameState(newState);
      await statsService.saveGameState(newState);
    }

    if (!skipSmartPrompt) {
      const team = isHome ? "home" : "away";

      const isTeamMode = match.recordingType === "team";
      const isSingleMode = match.recordingType === "single";

      if (type === "stl") {
        // If we steal, it's a turnover for opponent.
        if ((isTeamMode || isSingleMode) && isHome) {
          // We stole it. Opponent turned it over.
          // In Team/Single Mode, we don't need to ask "Who turned it over?" if it's our team stealing.
          logEvent("to", 0, "away_team", undefined, undefined, true, "Stealed");
        } else {
          if (gameState?.isRunning) onToggleTimer();
          setInteraction("smartPrompt", {
            type: "turnover",
            playerId: targetPlayerId,
            team,
            eventId: newEvent.id,
            subType: "Stealed",
            youtubeTimestamp,
          });
        }
      } else {
        let shouldTriggerPrompt = false;

        if (isSingleMode && team === "away") {
          // Single Player Mode: Do NOT trigger prompts for opponent actions (e.g. shot location, foul details)
          shouldTriggerPrompt = false;
        } else if (match.recordingType === "full") {
          shouldTriggerPrompt = true;
        } else {
          // Team Mode / Default logic
          const isMissedShot = type.includes("miss");
          const isScoringOrFoulOrMissOrBlk = [
            "1pt_make",
            "1pt_miss",
            "2pt_make",
            "3pt_make",
            "2pt_miss",
            "3pt_miss",
            "blk",
            "to",
            "stl",
            "foul",
            "offensive_foul",
            "defensive_foul",
          ].includes(type);
          shouldTriggerPrompt =
            team === "home" ||
            isMissedShot ||
            ["foul", "offensive_foul", "defensive_foul"].includes(type) ||
            isScoringOrFoulOrMissOrBlk;
        }

        if (shouldTriggerPrompt) {
          if (gameState?.isRunning) onToggleTimer();
          if (type === "1pt_miss") {
            triggerConfigurableFlow("missed_free_throw", newEvent);
          } else if (type === "2pt_make") {
            triggerConfigurableFlow("plus_2pt", newEvent);
          } else if (type === "3pt_make") {
            triggerConfigurableFlow("plus_3pt", newEvent);
          } else if (type.includes("miss")) {
            triggerConfigurableFlow("missed_shot", newEvent);
          } else if (type === "blk") {
            triggerConfigurableFlow("blocked_shot", newEvent);
          } else if (
            ["foul", "offensive_foul", "defensive_foul"].includes(type)
          ) {
            triggerConfigurableFlow(type, newEvent);
          } else if (type === "to") {
            triggerConfigurableFlow("turnover", newEvent);
          } else if (type === "stl") {
            triggerConfigurableFlow("steal", newEvent); // maps to standalone_steal
          }
        }
      }
    }
    return newEvent;
  };

  const triggerConfigurableFlow = (
    flowId: string,
    triggerEvent: GameEvent,
    initialStepId?: string,
    overrideDescription?: string,
  ) => {
    setInteraction("configurablePrompt", {
      flowId,
      triggerEvent,
      youtubeTimestamp: triggerEvent.youtubeTimestamp,
      onComplete: (logs: any[]) => {
        handleConfigurableAction(logs, triggerEvent);
      },
    });
  };

  const handleConfigurableAction = async (
    logs: any[],
    triggerEvent: GameEvent,
  ) => {
    if (!match || !gameState) return;
    if (!logs || logs.length === 0) {
      setInteraction(null);
      return;
    }

    // Process compiled logs from the logic flow
    for (const log of logs) {
      if (log.type) {
        if (!log.isSecondary) {
          // Update the primary trigger event with the details from the flow
          const updatedEvent = {
            ...triggerEvent,
            type: log.type,
            subType: log.subType,
            x: log.x !== undefined ? log.x : triggerEvent.x,
            y: log.y !== undefined ? log.y : triggerEvent.y,
            isShootingFoul: log.foul_during === 'Shooting Foul' || log.foul_during === 'And-One' ? true : triggerEvent.isShootingFoul,
            gameContext: log.game_context || triggerEvent.gameContext,
            pressureLevel: log.pressure_level || triggerEvent.pressureLevel,
            shotDifficulty: log.shot_quality || triggerEvent.shotDifficulty,
            isAndOne: log.isAndOne !== undefined ? log.isAndOne : (triggerEvent as any).isAndOne,
            metadata: {
              ...(triggerEvent.metadata || {}),
              ...(log.metadata || {}),
            },
          };
          await statsService.updateEvent(updatedEvent);
        } else {
          // Create secondary/related events
          const targetId = log.actorId || triggerEvent.playerId;

          if (targetId === "ball_out") {
            const homeTeamId = match.teamId || "home_team";
            const shooterIsHome =
              matchRosters.some(
                (r) =>
                  r.teamId === homeTeamId &&
                  r.profileId === triggerEvent.playerId,
              ) || triggerEvent.playerId === "home_team";
            const oppTeam = shooterIsHome ? "away" : "home";
            const oppTeamId =
              oppTeam === "home"
                ? match.teamId || "home_team"
                : match.opponentTeamId || "away_team";

            const event = await logEvent(
              "inbound",
              0,
              oppTeamId,
              undefined,
              undefined,
              true,
              undefined,
              log.timestamp || triggerEvent.timestamp,
              log.quarter || triggerEvent.quarter,
            );

            if (event && triggerEvent.id) {
              await statsService.createEventLink(
                match.id,
                event.id,
                triggerEvent.id,
                "SECONDARY",
              );
            }

            setActiveTeam(oppTeam);
            continue;
          }

          // Adjust offensive/defensive rebound type dynamically depending on who rebounded it in relation to the shooter
          let finalType = log.type;
          if (log.type === "oreb") {
            const homeTeamId = match.teamId || "home_team";
            const shooterIsHome =
              matchRosters.some(
                (r) =>
                  r.teamId === homeTeamId &&
                  r.profileId === triggerEvent.playerId,
              ) || triggerEvent.playerId === "home_team";
            const rebounderIsHome =
              matchRosters.some(
                (r) => r.teamId === homeTeamId && r.profileId === targetId,
              ) || targetId === "home_team";
            if (shooterIsHome !== rebounderIsHome) {
              finalType = "dreb";
            }
          }

          const event = await logEvent(
            finalType as any,
            0,
            targetId,
            undefined,
            undefined,
            true,
            log.subType,
            log.timestamp || triggerEvent.timestamp,
            log.quarter || triggerEvent.quarter,
          );

          if (event && log.relatesTo && triggerEvent.id) {
            await statsService.createEventLink(
              match.id,
              event.id,
              triggerEvent.id,
              log.linkType || "SECONDARY",
            );
          }
        }
      }
    }

    // Rebuild possessions and sync state to resolve any React state race conditions and keep tracking correct
    await statsService.rebuildPossessionsForMatch(match.id, match);
    await syncPossessionStateAfterRebuild();

    // USER DIRECTIVE: Never use the automatic Free Throw Status Modal ("Ada Lagi" or "FT Terakhir").
    // Always let the user enter free throws manually using +1 FT button.
    setInteraction(null);
  };

  const syncPossessionStateAfterRebuild = async () => {
    if (!match) return;
    try {
      // 1. Refresh events from DB to synchronize updated possessionId values
      const freshEvents = await statsService.getEvents(match.id);
      setEvents(freshEvents);

      // 2. Refresh possessions and active possession state
      const possessions = await statsService.getPossessions(match.id);
      const active = possessions.find((p) => !p.clockEnd);

      if (active) {
        setActivePossession(active);
        setCurrentPossession(active.id);
        setActiveTeam(active.teamInPossession);
      } else {
        setActivePossession(null);
        setCurrentPossession(null);

        if (freshEvents.length > 0) {
          // Sort events chronologically to find the final one
          const sortedEvents = [...freshEvents].sort((a, b) => {
            if (a.quarter !== b.quarter) return a.quarter - b.quarter;
            if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp; // Basketball countdown clock
            return (
              new Date(a.realTime).getTime() - new Date(b.realTime).getTime()
            );
          });

          const lastEvent = sortedEvents[sortedEvents.length - 1];
          if (lastEvent) {
            const homeTeamId = match.teamId || "home_team";
            const lastEventIsHome =
              matchRosters.some(
                (r) =>
                  r.teamId === homeTeamId && r.profileId === lastEvent.playerId,
              ) || lastEvent.playerId === "home_team";
            const lastEventTeam: "home" | "away" = lastEventIsHome
              ? "home"
              : "away";

            let nextPossessionTeam: "home" | "away" = "home";
            if (
              ["2pt_make", "3pt_make", "to", "offensive_foul"].includes(
                lastEvent.type,
              )
            ) {
              nextPossessionTeam = lastEventTeam === "home" ? "away" : "home";
            } else if (["1pt_make"].includes(lastEvent.type)) {
              const isFinalFT = lastEvent.metadata?.isFinalFT !== false;
              if (isFinalFT) {
                nextPossessionTeam = lastEventTeam === "home" ? "away" : "home";
              } else {
                nextPossessionTeam = lastEventTeam;
              }
            } else if (["stl", "dreb", "oreb"].includes(lastEvent.type)) {
              nextPossessionTeam = lastEventTeam;
            } else if (
              ["2pt_miss", "3pt_miss", "1pt_miss"].includes(lastEvent.type)
            ) {
              nextPossessionTeam = lastEventTeam === "home" ? "away" : "home";
            } else {
              nextPossessionTeam = lastEventTeam === "home" ? "away" : "home";
            }
            setActiveTeam(nextPossessionTeam);
          }
        }
      }

      // Re-sync gameState score, fouls, timeouts based on freshEvents to ensure bulletproof accuracy
      const homeTeamId = match.teamId || "home_team";
      let computedHomeScore = 0;
      let computedAwayScore = 0;
      let fouledHome = 0;
      let fouledAway = 0;
      let timeoutsHome = 0;
      let timeoutsAway = 0;

      freshEvents.forEach((e) => {
        const isHomePlayer =
          matchRosters.some(
            (r) => r.teamId === homeTeamId && r.profileId === e.playerId,
          ) ||
          e.playerId === "home_team" ||
          e.playerId === "our_team" ||
          e.playerId === homeTeamId;
        
        if (e.type.includes("make")) {
          const pts = e.points || parseInt(e.type[0]) || 0;
          if (isHomePlayer) computedHomeScore += pts;
          else computedAwayScore += pts;
        } else if (e.type === "foul") {
          if (isHomePlayer) fouledHome += 1;
          else fouledAway += 1;
        } else if (e.type === "timeout") {
          if (isHomePlayer) timeoutsHome += 1;
          else timeoutsAway += 1;
        }
      });

      const newState = {
        ...gameState,
        homeScore: computedHomeScore,
        awayScore: computedAwayScore,
        homeFouls: fouledHome,
        awayFouls: fouledAway,
        homeTimeouts: timeoutsHome,
        awayTimeouts: timeoutsAway,
      };

      setGameState(newState);
      await statsService.saveGameState(newState);

    } catch (err) {
      console.error("Failed to sync possession state after rebuild:", err);
    }
  };

  const undoLastEvent = async () => {
    if (events.length === 0 || !gameState || !match) return;

    const lastEvent = events[events.length - 1];
    const newEvents = events.slice(0, -1);
    setEvents(newEvents);

    await statsService.removeEvent(match.id, lastEvent.id);

    // Recalculate complete statistics from the remaining events list
    const homeTeamId = match.teamId || "home_team";
    let computedHomeScore = 0;
    let computedAwayScore = 0;
    let fouledHome = 0;
    let fouledAway = 0;
    let timeoutsHome = 0;
    let timeoutsAway = 0;

    newEvents.forEach((e) => {
      const isHomePlayer =
        matchRosters.some(
          (r) => r.teamId === homeTeamId && r.profileId === e.playerId,
        ) ||
        e.playerId === "home_team" ||
        e.playerId === "our_team" ||
        e.playerId === homeTeamId;
      if (e.type.includes("make")) {
        const pts = e.points || parseInt(e.type[0]) || 0;
        if (isHomePlayer) computedHomeScore += pts;
        else computedAwayScore += pts;
      } else if (e.type === "foul") {
        if (isHomePlayer) fouledHome += 1;
        else fouledAway += 1;
      } else if (e.type === "timeout") {
        if (isHomePlayer) timeoutsHome += 1;
        else timeoutsAway += 1;
      }
    });

    const newState = {
      ...gameState,
      homeScore: computedHomeScore,
      awayScore: computedAwayScore,
      homeFouls: fouledHome,
      awayFouls: fouledAway,
      homeTimeouts: timeoutsHome,
      awayTimeouts: timeoutsAway,
    };

    setGameState(newState);
    await statsService.saveGameState(newState);

    await statsService.rebuildPossessions(match.id, match);
    await syncPossessionStateAfterRebuild();
  };

  const handleSmartPromptSelect = async (selectedPlayerId: string) => {
    if (!match) return;
    const smartPrompt =
      activeInteraction?.type === "smartPrompt" ? activeInteraction.data : null;
    if (!smartPrompt) return;

    const { type, team, pendingEventParams } = smartPrompt as any;
    const isOffensive = type === "rebound" && team === activeTeam;
    const homeTeamId = match?.teamId || "home_team";
    const selectedPlayerTeam = matchRosters.some(
      (r) => r.teamId === homeTeamId && r.profileId === selectedPlayerId,
    )
      ? "home"
      : "away";

    const parentEvent =
      ((smartPrompt as any).eventId &&
        events.find((e) => e.id === (smartPrompt as any).eventId)) ||
      null;
    const parentTimestamp = parentEvent ? parentEvent.timestamp : undefined;
    const parentQuarter = parentEvent ? parentEvent.quarter : undefined;

    if (type === "missing_event") {
      const oppTeamId = team === "home" ? "away_team" : "home_team";

      let action = selectedPlayerId;
      let actorId = oppTeamId;

      if (selectedPlayerId.includes("_")) {
        const parts = selectedPlayerId.split("_");
        action = parts[0];
        actorId = parts.slice(1).join("_");
        if (actorId === "team") {
          actorId = oppTeamId;
        }
      }

      if (action !== "skip") {
        // Log the missing event to close the previous possession
        if (action === "to") {
          logEvent("to", 0, actorId, undefined, undefined, false);
        } else if (action === "2pt_miss") {
          logEvent("2pt_miss", 0, actorId, undefined, undefined, false);
        } else if (action === "3pt_miss") {
          logEvent("3pt_miss", 0, actorId, undefined, undefined, false);
        } else if (action === "foul") {
          logEvent("foul", 0, actorId, undefined, undefined, false);
        } else if (action === "ball_out") {
          // Just close the current possession if it exists
          if (currentPossession) {
            setCurrentPossession(null);
            setActivePossession(null);
          }
        }
      }

      // Then log the original pending event
      if (pendingEventParams) {
        setTimeout(() => {
          logEvent(
            pendingEventParams.type,
            pendingEventParams.points,
            pendingEventParams.overridePlayerId,
            pendingEventParams.x,
            pendingEventParams.y,
            true,
          );
        }, 100);
      }
      setInteraction(null);
      return;
    }

    if (type === "miss_outcome") {
      if (selectedPlayerId === "foul_during_shot") {
        const shooterTeam = team;
        const foulerTeam = shooterTeam === "home" ? "away" : "home";
        const youtubeTimestamp = (smartPrompt as any).youtubeTimestamp;
        const shotEventId = (smartPrompt as any).eventId;

        // Delete the missed shot event because a shooting foul on a miss doesn't count as FGA
        if (shotEventId) {
          await statsService.removeEvent(match!.id, shotEventId);
          setEvents(prev => prev.filter(e => e.id !== shotEventId));
        }

        if (match?.recordingType === "full") {
          // Ask who committed the foul
          setInteraction("smartPrompt", {
            type: "fouler" as any,
            playerId: (smartPrompt as any).playerId, // The shooter
            team: foulerTeam,
            eventId: undefined, // The shot event is deleted
            isShootingFoul: true,
            youtubeTimestamp,
          } as any);
        } else {
          // Log team foul for opponent
          const oppTeamId = shooterTeam === "home" ? "away_team" : "home_team";
          const foulEvent = await logEvent(
            "foul",
            0,
            oppTeamId,
            undefined,
            undefined,
            true,
            "Shooting Foul",
            parentTimestamp,
            parentQuarter,
          );
          if (foulEvent) {
            await statsService.updateEvent({
              ...foulEvent,
              subType: "Shooting Foul",
            });
          }

          // Log foul_drawn for the shooter automatically
          const shooterId = (smartPrompt as any).playerId;
          const foulDrawnEvent = await logEvent(
            "foul_drawn",
            0,
            shooterId,
            undefined,
            undefined,
            true,
            "Shooting Foul",
            parentTimestamp,
            parentQuarter,
          );
          if (foulDrawnEvent) {
            await statsService.updateEvent({
              ...foulDrawnEvent,
              subType: "Shooting Foul",
            });
          }

          setInteraction(null);
        }
        return;
      }

      // selectedPlayerId could be a block actor or a rebounder
      // We need to distinguish them. In TrackingPage, we'll prefix them.
      if (selectedPlayerId.startsWith("blk_")) {
        const blkPlayerId = selectedPlayerId.replace("blk_", "");
        const targetId =
          blkPlayerId === "opp"
            ? team === "home"
              ? "away_team"
              : "home_team"
            : blkPlayerId;
        const blkEvent = await logEvent(
          "blk",
          0,
          targetId,
          undefined,
          undefined,
          true,
        );
        if (blkEvent && (smartPrompt as any).eventId) {
          await statsService.createBlockShotLink(
            match!.id,
            blkEvent.id,
            (smartPrompt as any).eventId,
          );
        }
        // Stay in the same prompt but maybe we should update it to show block is done?
        // Actually, the user wants "bersamaan". If they click block, we still need rebound.
        // Let's keep the modal open by NOT setting smartPrompt to null yet.
        setInteraction("smartPrompt", {
          ...smartPrompt,
          blockedBy: blkPlayerId,
        } as any);
        return;
      } else {
        // It's a rebound (could be 'ball_out' or a playerId)
        if (selectedPlayerId === "ball_out") {
          // Dead ball / Ball out - possession changes
          const oppTeam = team === "home" ? "away" : "home";
          const oppTeamId = oppTeam === "home" ? "home_team" : "away_team";

          await logEvent(
            "inbound",
            0,
            oppTeamId,
            undefined,
            undefined,
            true,
            undefined,
            parentTimestamp,
            parentQuarter,
          );

          await statsService.rebuildPossessions(match.id, match);
          await syncPossessionStateAfterRebuild();

          setInteraction(null);
          setActiveTeam(oppTeam);
          return;
        }

        const rebounderTeam =
          matchRosters.find((r) => r.profileId === selectedPlayerId)?.teamId ===
          homeTeamId
            ? "home"
            : "away";
        const isOffensive = rebounderTeam === team;

        const reboundEvent = await logEvent(
          isOffensive ? "oreb" : "dreb",
          0,
          selectedPlayerId,
          undefined,
          undefined,
          true,
          undefined,
          parentTimestamp,
          parentQuarter,
        );
        if (reboundEvent && (smartPrompt as any).eventId) {
          await statsService.createReboundShotLink(
            match!.id,
            reboundEvent.id,
            (smartPrompt as any).eventId,
          );
        }

        if (!isOffensive) {
          setActiveTeam(rebounderTeam);
        }
        setInteraction(null);
        return;
      }
    }

    if (type === "rebound") {
      const reboundEvent = await logEvent(
        isOffensive ? "oreb" : "dreb",
        0,
        selectedPlayerId,
        undefined,
        undefined,
        true,
        undefined,
        parentTimestamp,
        parentQuarter,
      );
      if (reboundEvent && (smartPrompt as any).eventId) {
        await statsService.createReboundShotLink(
          match!.id,
          reboundEvent.id,
          (smartPrompt as any).eventId,
        );
      }
      if (!isOffensive) {
        setActiveTeam(selectedPlayerTeam);
      }
      setInteraction(null);
    } else if (type === "steal") {
      const stealEvent = await logEvent(
        "stl",
        0,
        selectedPlayerId,
        undefined,
        undefined,
        true,
      );
      if (stealEvent && (smartPrompt as any).eventId) {
        await statsService.createStealTurnoverLink(
          match!.id,
          stealEvent.id,
          (smartPrompt as any).eventId,
        );
      }
      setActiveTeam(selectedPlayerTeam);
      setInteraction(null);
    } else if (type === "turnover") {
      await logEvent("to", 0, selectedPlayerId, undefined, undefined, true);
      setActiveTeam(team === "home" ? "away" : "home");
      setInteraction(null);
    } else if (type === "block") {
      // If it was a blocked_shot, we link the blk event to it
      const blkEvent = await logEvent(
        "blk",
        0,
        selectedPlayerId,
        undefined,
        undefined,
        true,
        undefined,
        parentTimestamp,
        parentQuarter,
      );
      if (blkEvent && (smartPrompt as any).eventId) {
        // We need a way to link blk to shot
        await statsService.createBlockShotLink(
          match!.id,
          blkEvent.id,
          (smartPrompt as any).eventId,
        );
      }
      // After a block, it's usually a rebound situation
      setInteraction("smartPrompt", {
        type: "rebound",
        playerId: selectedPlayerId,
        team,
        eventId: (smartPrompt as any).eventId,
      });
      return;
    } else if (type === "next_freethrow") {
      const isMake = selectedPlayerId === "1pt_make";
      // Log the event
      await logEvent(
        isMake ? "1pt_make" : "1pt_miss",
        isMake ? 1 : 0,
        smartPrompt.playerId,
        undefined,
        undefined,
        true,
        undefined,
        parentTimestamp,
        parentQuarter,
        undefined,
        { isFinalFT: false }
      );
      // Wait for logEvent to complete. The handleEventLogging inside logEvent will trigger 'freethrow' again automatically!
      return;
    } else if (type === "freethrow") {
      if (selectedPlayerId === "more") {
        setInteraction("smartPrompt", {
          type: "next_freethrow",
          playerId: smartPrompt.playerId,
          team: smartPrompt.team,
        });
        return;
      } else if (selectedPlayerId === "last") {
        if (smartPrompt.isMake) {
          // After a made last free throw, possession goes to the team that committed the foul (the 'team' in smartPrompt)
          setActiveTeam(team);
          setInteraction(null);
        } else {
          // If missed last free throw, it's a live ball rebound situation
          setInteraction("smartPrompt", {
            type: "miss_outcome",
            playerId: smartPrompt.playerId,
            team,
            eventId: (smartPrompt as any).eventId,
            youtubeTimestamp: (smartPrompt as any).youtubeTimestamp,
          });
          return;
        }
      } else if (selectedPlayerId === "ball_out") {
        const oppTeam = team === "home" ? "away" : "home";
        const oppTeamId = oppTeam === "home" ? "home_team" : "away_team";

        await logEvent(
          "inbound",
          0,
          oppTeamId,
          undefined,
          undefined,
          true,
          undefined,
          parentTimestamp,
          parentQuarter,
        );

        await statsService.rebuildPossessions(match.id, match);
        await syncPossessionStateAfterRebuild();

        setInteraction(null);
        setActiveTeam(oppTeam);
        return;
      } else if (selectedPlayerId === "airball") {
        // Handle specific miss outcomes for free throws
        setInteraction(null);
        return;
      } else {
        const ftEvent = await logEvent(
          smartPrompt.isMake ? "1pt_make" : "1pt_miss",
          smartPrompt.isMake ? 1 : 0,
          selectedPlayerId,
          undefined,
          undefined,
          true,
          undefined,
          parentTimestamp,
          parentQuarter,
          undefined,
          { isFinalFT: true }
        );
        if (ftEvent && (smartPrompt as any).eventId) {
          await statsService.createFoulFreeThrowLink(
            match!.id,
            (smartPrompt as any).eventId,
            ftEvent.id,
          );
        }
      }
    } else if (type === "assist") {
      if (selectedPlayerId === "foul_and_one") {
        const shooterTeam = team;
        const foulerTeam = shooterTeam === "home" ? "away" : "home";

        if (match?.recordingType === "full") {
          // Ask who committed the foul
          setInteraction("smartPrompt", {
            type: "fouler" as any,
            playerId: (smartPrompt as any).playerId, // The shooter
            team: foulerTeam,
            eventId: (smartPrompt as any).eventId, // The shot event
            isAndOne: true,
          } as any);
        } else {
          // Log team foul for opponent
          const oppTeamId = shooterTeam === "home" ? "away_team" : "home_team";
          const foulEvent = await logEvent(
            "foul",
            0,
            oppTeamId,
            undefined,
            undefined,
            true,
            "and_one",
            parentTimestamp,
            parentQuarter,
          );
          if (foulEvent) {
            await statsService.updateEvent({
              ...foulEvent,
              subType: "and_one",
            });
          }

          // Log foul_drawn for the shooter automatically
          const shooterId = (smartPrompt as any).playerId;
          const foulDrawnEvent = await logEvent(
            "foul_drawn",
            0,
            shooterId,
            undefined,
            undefined,
            true,
            "and_one",
            parentTimestamp,
            parentQuarter,
          );
          if (foulDrawnEvent) {
            await statsService.updateEvent({
              ...foulDrawnEvent,
              subType: "and_one",
            });
          }

          setInteraction("smartPrompt", {
            type: "foul_drawn",
            playerId: shooterId,
            team: foulerTeam,
            eventId: foulEvent?.id,
            isAndOne: true,
          } as any);
        }
        return;
      }
      if (selectedPlayerId !== "unassisted") {
        const assistEvent = await logEvent(
          "ast",
          0,
          selectedPlayerId,
          undefined,
          undefined,
          true,
          undefined,
          parentTimestamp,
          parentQuarter,
        );
        if (assistEvent && (smartPrompt as any).eventId) {
          await statsService.createAssistShotLink(
            match!.id,
            assistEvent.id,
            (smartPrompt as any).eventId,
          );
        }
      }
      setActiveTeam(team === "home" ? "away" : "home");
      setInteraction(null);
    } else if (type === "jumpball") {
      if (selectedPlayerId !== "home" && selectedPlayerId !== "away") {
        // User selected a player involved in the held ball
        setInteraction("smartPrompt", {
          ...smartPrompt,
          tiedPlayerId: selectedPlayerId,
        });
        return;
      }

      const winningTeam = selectedPlayerId as "home" | "away";
      const isHeldBall = (smartPrompt as any).isHeldBall;
      const tiedPlayerId = (smartPrompt as any).tiedPlayerId;

      if (isHeldBall && winningTeam !== activeTeam) {
        // If it was a held ball and possession changed, it's a turnover for the tied player
        const turnoverPlayerId =
          tiedPlayerId || (activeTeam === "home" ? "home_team" : "away_team");
        await logEvent(
          "to",
          0,
          turnoverPlayerId,
          undefined,
          undefined,
          true,
          "Held Ball",
        );
      }

      // Log the jumpball event explicitly for the event log - this will also open the possession
      const winnerId =
        winningTeam === "home"
          ? match.teamId || "home_team"
          : match.opponentTeamId || "away_team";

      await logEvent(
        "jumpball",
        0,
        winnerId,
        undefined,
        undefined,
        true,
        isHeldBall ? "Held Ball" : "Opening Tip",
      );

      setActiveTeam(winningTeam);
      setInteraction(null);
    } else if (type === "fouler") {
      // Log the foul for the selected player
      const foulEvent = await logEvent(
        "foul",
        0,
        selectedPlayerId,
        undefined,
        undefined,
        true,
        undefined,
        parentTimestamp,
        parentQuarter,
      );

      const isShootingFoul = (smartPrompt as any).isShootingFoul;
      const isAndOne = (smartPrompt as any).isAndOne;

      if (isShootingFoul || isAndOne) {
        // Update foul event subType
        if (foulEvent) {
          const updatedFoul = {
            ...foulEvent,
            subType: isShootingFoul ? "Shooting Foul" : "And-One",
          };
          await statsService.updateEvent(updatedFoul);
          setEvents((prev) =>
            prev.map((e) => (e.id === foulEvent.id ? updatedFoul : e)),
          );
        }

        // Log foul_drawn for the shooter automatically
        const shooterId = (smartPrompt as any).playerId;
        const foulDrawnEvent = await logEvent(
          "foul_drawn",
          0,
          shooterId,
          undefined,
          undefined,
          true,
          undefined,
          parentTimestamp,
          parentQuarter,
        );
        if (foulDrawnEvent) {
          const updatedFoulDrawn = {
            ...foulDrawnEvent,
            subType: isShootingFoul ? "Shooting Foul" : "And-One",
          };
          await statsService.updateEvent(updatedFoulDrawn);
          setEvents((prev) =>
            prev.map((e) =>
              e.id === foulDrawnEvent.id ? updatedFoulDrawn : e,
            ),
          );
        }

        setInteraction(null);
        return;
      }

      // Default: Then trigger foul drawn flow for the shooter
      setInteraction("smartPrompt", {
        type: "foul_drawn",
        playerId: (smartPrompt as any).playerId, // The shooter
        team: team, // The team that COMMITTED the foul
        eventId: foulEvent?.id,
        isShootingFoul: isShootingFoul,
        isAndOne: isAndOne,
      } as any);
      return;
    } else if (type === "foul_drawn") {
      let foulerId = "";
      let foulType = "";

      if (selectedPlayerId.includes("__")) {
        const parts = selectedPlayerId.split("__");
        foulerId = parts[0];
        foulType = parts[1].replace("foul_", "");
      } else if (selectedPlayerId.startsWith("foul_")) {
        foulType = selectedPlayerId.replace("foul_", "");
      } else {
        foulerId = selectedPlayerId;
      }

      const foulTypeMap: Record<string, string> = {
        'personal': 'Personal Foul',
        'shooting': 'Shooting Foul',
        'reach_in': 'Reach-In',
        'blocking': 'Blocking',
        'holding': 'Holding',
        'loose_ball': 'Loose Ball',
        'technical': 'Technical',
        'unsportsmanlike': 'Unsportsmanlike',
        'offensive': 'Offensive Foul',
        'double_team': 'Double Team'
      };
      if (foulType && foulTypeMap[foulType]) {
        foulType = foulTypeMap[foulType];
      }

      const victimFoulDrawnEventId = (smartPrompt as any).eventId;

      // In Team Mode, if we are picking a foul type and the victim is the opponent,
      // we should auto-log the foul_drawn for 'away_team' if it's not already logged.
      if (foulType && match?.recordingType === "team" && team === "home") {
        await logEvent(
          "foul_drawn",
          0,
          "away_team",
          undefined,
          undefined,
          true,
          foulType,
          parentTimestamp,
          parentQuarter,
        );
      }

      // Update the victim's foul_drawn event to record the selected foul type
      if (victimFoulDrawnEventId && foulType) {
        setEvents((prev) => {
          const event = prev.find((e) => e.id === victimFoulDrawnEventId);
          if (event) {
            const updated = { ...event, subType: foulType };
            statsService.updateEvent(updated);
            return prev.map((e) => (e.id === victimFoulDrawnEventId ? updated : e));
          }
          return prev;
        });
      }

      // Log a FOUL event for the player who committed the foul (fouler) instead of foul_drawn!
      let loggedFoulEvent: GameEvent | undefined = undefined;
      if (foulerId) {
        loggedFoulEvent = await logEvent(
          "foul",
          0,
          foulerId,
          undefined,
          undefined,
          true,
          foulType || undefined,
          parentTimestamp,
          parentQuarter,
        );
      }

      setInteraction(null);
    }
  };

  const deleteEvent = async (
    eventId: string,
    forceSubsequentDelete: boolean = false,
  ) => {
    if (!match || !gameState) return;

    const eventToDelete = events.find((e) => e.id === eventId);
    if (!eventToDelete) return;

    const homeTeamId = match.teamId || "home_team";
    const isHome =
      matchRosters.some(
        (r) =>
          r.teamId === homeTeamId && r.profileId === eventToDelete.playerId,
      ) || eventToDelete.playerId === "home_team";

    // Check for subsequent events if it's a sub/starter
    if (
      !forceSubsequentDelete &&
      (eventToDelete.type === "sub_in" ||
        eventToDelete.type === "sub_out" ||
        eventToDelete.type === "starter")
    ) {
      const subsequentEvents = events.filter(
        (e) => e.matchId === match.id && e.realTime > eventToDelete.realTime,
      );
      if (subsequentEvents.length > 0) {
        setInteraction("confirmation", {
          title: "Hapus Event Substitusi?",
          description: `Menghapus event ini akan menghapus ${subsequentEvents.length} event setelahnya untuk menjaga integritas data. Apakah Anda yakin?`,
          onConfirm: () => deleteEvent(eventId, true),
          confirmText: "Ya, Hapus Semua",
          cancelText: "Batal",
        });
        return;
      }
    }

    // Determine the list of remaining events
    let remainingEvents = events.filter((e) => e.id !== eventId);
    await statsService.removeEvent(match.id, eventId);

    if (forceSubsequentDelete) {
      const subsequentEvents = events.filter(
        (e) => e.matchId === match.id && e.realTime > eventToDelete.realTime,
      );
      for (const subEv of subsequentEvents) {
        await statsService.deleteEvent(subEv.id);
      }
      remainingEvents = remainingEvents.filter(
        (e) => e.matchId !== match.id || e.realTime <= eventToDelete.realTime,
      );
    }

    setEvents(remainingEvents);

    // Recalculate complete statistics from the final remaining events log
    let computedHomeScore = 0;
    let computedAwayScore = 0;
    let fouledHome = 0;
    let fouledAway = 0;
    let timeoutsHome = 0;
    let timeoutsAway = 0;

    remainingEvents.forEach((e) => {
      const isHomePlayer =
        matchRosters.some(
          (r) => r.teamId === homeTeamId && r.profileId === e.playerId,
        ) ||
        e.playerId === "home_team" ||
        e.playerId === "our_team" ||
        e.playerId === homeTeamId;
      if (e.type.includes("make")) {
        const pts = e.points || parseInt(e.type[0]) || 0;
        if (isHomePlayer) computedHomeScore += pts;
        else computedAwayScore += pts;
      } else if (e.type === "foul") {
        if (isHomePlayer) fouledHome += 1;
        else fouledAway += 1;
      } else if (e.type === "timeout") {
        if (isHomePlayer) timeoutsHome += 1;
        else timeoutsAway += 1;
      }
    });

    const newState = {
      ...gameState,
      homeScore: computedHomeScore,
      awayScore: computedAwayScore,
      homeFouls: fouledHome,
      awayFouls: fouledAway,
      homeTimeouts: timeoutsHome,
      awayTimeouts: timeoutsAway,
    };

    setGameState(newState);
    await statsService.saveGameState(newState);

    // Substitution Reconciliation
    if (
      eventToDelete.type === "sub_in" ||
      eventToDelete.type === "sub_out" ||
      eventToDelete.type === "starter"
    ) {
      const teamId = isHome
        ? match.teamId || "home_team"
        : match.opponentTeamId || "away_team";

      // 1. Recalculate lineup at current game time
      const newLineup = await statsService.getLineupAtTime(
        match.id,
        teamId,
        gameState.currentQuarter,
        gameState.timeRemaining,
      );

      // 2. Update MatchRoster state and DB
      const updatedRosters = matchRosters.map((r) => {
        if (r.teamId === teamId) {
          return { ...r, isActive: newLineup.includes(r.profileId) };
        }
        return r;
      });

      setMatchRosters(updatedRosters);
      for (const r of updatedRosters) {
        if (r.teamId === teamId) {
          await statsService.updateMatchRoster(r);
        }
      }

      // 3. Reconcile MatchStints
      await statsService.reconcileMatchStints(match.id, teamId);

      // 5. Lineup Integrity Check
      if (newLineup.length !== 5) {
        if (gameState.isRunning) onToggleTimer();

        let initialStep = "correction_type";
        if (newLineup.length < 5) initialStep = "add_player_selection";
        else if (newLineup.length > 5) initialStep = "remove_player_selection";

        triggerConfigurableFlow("lineup_check", eventToDelete, initialStep);
        await statsService.rebuildPossessions(match.id, match);
        await syncPossessionStateAfterRebuild();
        return; // Exit early to keep the lineup check prompt open
      }
    }

    await statsService.rebuildPossessions(match.id, match);
    await syncPossessionStateAfterRebuild();
    setInteraction(null);
  };

  const handleAdjustEventTime = async (
    eventId: string,
    deltaSeconds: number,
  ) => {
    if (!events || deltaSeconds === 0 || !match) return;

    const eventIndex = events.findIndex((e) => e.id === eventId);
    if (eventIndex === -1) return;

    const updatedEvents = [...events];
    for (let i = eventIndex; i < updatedEvents.length; i++) {
      updatedEvents[i] = {
        ...updatedEvents[i],
        timestamp: Math.max(0, updatedEvents[i].timestamp + deltaSeconds),
      };
      await statsService.updateEvent(updatedEvents[i]);
    }

    setEvents(updatedEvents);
    await statsService.rebuildPossessions(match.id, match);
    await syncPossessionStateAfterRebuild();
  };

  const handleAdjustYoutubeTime = async (eventId: string, newTime: number) => {
    if (!events || !match) return;

    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    const updatedEvent = { ...event, youtubeTimestamp: newTime };
    setEvents((prev) => prev.map((e) => (e.id === eventId ? updatedEvent : e)));
    await statsService.updateEvent(updatedEvent);
  };

  const startManualSub = () => {
    setInteraction("configurablePrompt", {
      flowId: "manual_sub",
      youtubeTimestamp: undefined, // User will input time
      onComplete: (logs: any[]) => {
        handleConfigurableAction(logs, {
          id: "manual",
          matchId: match?.id || "",
          playerId: "",
          type: "sub_in",
          timestamp: 0,
          quarter: gameState.currentQuarter,
          realTime: new Date().toISOString(),
        } as GameEvent);
      },
    });
  };

  const checkLineupIntegrity = async () => {
    if (!match || !gameState) return;
    const homeTeamId = match.teamId || "home_team";
    const awayTeamId = match.opponentTeamId || "away_team";

    const homeLineupIds = await statsService.getLineupAtTime(
      match.id,
      homeTeamId,
      gameState.currentQuarter,
      gameState.timeRemaining,
    );
    const awayLineupIds = await statsService.getLineupAtTime(
      match.id,
      awayTeamId,
      gameState.currentQuarter,
      gameState.timeRemaining,
    );

    const getPlayerNames = (ids: string[]) => {
      if (!allPlayers) return ids.join(", ");
      return ids
        .map((id) => {
          const p = allPlayers.find((ap) => ap.id === id);
          return p ? p.name : id;
        })
        .join(", ");
    };

    const homeNames = getPlayerNames(homeLineupIds);
    const awayNames = getPlayerNames(awayLineupIds);

    const description = `Tim Kami (${homeLineupIds.length}): ${homeNames}\nLawan (${awayLineupIds.length}): ${awayNames}`;

    const maxPlayers =
      match.recordingType === "single" ? 1 : match.gameType === "3x3" ? 3 : 5;

    if (
      homeLineupIds.length !== maxPlayers ||
      awayLineupIds.length !== maxPlayers
    ) {
      if (gameState.isRunning) onToggleTimer();

      const isHomeImbalance = homeLineupIds.length !== maxPlayers;
      const teamId = isHomeImbalance ? homeTeamId : awayTeamId;
      const team = isHomeImbalance ? "home" : "away";
      const count = isHomeImbalance
        ? homeLineupIds.length
        : awayLineupIds.length;

      let initialStep = "correction_type";
      if (count < maxPlayers) initialStep = "add_player_selection";
      else if (count > maxPlayers) initialStep = "remove_player_selection";

      triggerConfigurableFlow(
        "lineup_check",
        {
          id: "integrity_check",
          matchId: match.id,
          playerId: teamId,
          team,
          type: "sub_in",
          timestamp: gameState.timeRemaining,
          quarter: gameState.currentQuarter,
          realTime: new Date().toISOString(),
        } as GameEvent,
        initialStep,
        description,
      );
    } else {
      // Lineup is correct, but user might still want to verify
      triggerConfigurableFlow(
        "lineup_check",
        {
          id: "integrity_check",
          matchId: match.id,
          playerId: homeTeamId,
          team: "home",
          type: "sub_in",
          timestamp: gameState.timeRemaining,
          quarter: gameState.currentQuarter,
          realTime: new Date().toISOString(),
        } as GameEvent,
        "verify_lineup",
        description,
      );
    }
  };

  return {
    activeInteraction,
    setInteraction,
    activePossession,
    togglePossession: () => {
      if (gameState.isRunning) onToggleTimer();
      setInteraction("smartPrompt", {
        type: "jumpball",
        description:
          "Pilih tim yang menguasai bola (Jumpball / Possession Toggle)",
      });
    },
    logEvent,
    undoLastEvent,
    handleSmartPromptSelect,
    deleteEvent,
    handleAdjustEventTime,
    handleAdjustYoutubeTime,
    handleConfigurableAction,
    handleToggleRecordingMode: async () => {
      if (!match) return;
      const newMode = match.recordingMode === "lite" ? "detailed" : "lite";
      const updatedMatch: Match = {
        ...match,
        recordingMode: newMode,
      };
      await statsService.updateMatch(updatedMatch);
      window.location.reload();
    },
    checkLineupIntegrity,
    startManualSub,
    resetTrackingState: () => {
      setActiveInteraction(null);
      setCurrentPossession(null);
      setActivePossession(null);
      setActivePlayerId(null);
      setPendingShot(null);
    },
    triggerHeldBall: () => {
      if (gameState.isRunning) onToggleTimer();
      setInteraction("smartPrompt", {
        type: "jumpball",
        isHeldBall: true,
        description:
          "Situasi Berebut Bola (Held Ball). Siapa yang memenangkan penguasaan bola?",
      });
    },
    syncPossessionStateAfterRebuild,
  };
};

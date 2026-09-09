import { GameEvent, Possession, MatchRoster } from "../types/stats";
import { generateId } from "../utils/idUtils";

export const sortEventsChronologically = (events: GameEvent[]) => {
  return [...events].sort((a, b) => {
    // 1. Sort by Quarter
    if (a.quarter !== b.quarter) return a.quarter - b.quarter;
    // 2. Sort by Game Clock (Descending, since basketball counts down from 600 to 0)
    if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;

    // 3. Fallback: Registration real time (Oldest to newest)
    const timeA = a.realTime ? new Date(a.realTime).getTime() : 0;
    const timeB = b.realTime ? new Date(b.realTime).getTime() : 0;
    if (timeA !== timeB) return timeA - timeB;

    // 4. Final fallback: YouTube timestamp
    const ytA = a.youtubeTimestamp !== undefined ? a.youtubeTimestamp : 0;
    const ytB = b.youtubeTimestamp !== undefined ? b.youtubeTimestamp : 0;
    return ytA - ytB;
  });
};

export const rebuildPossessionsEngine = (
  matchId: string,
  events: GameEvent[],
  matchRosters: MatchRoster[],
  match: { teamId?: string; opponentTeamId?: string },
) => {
  const sortedEvents = sortEventsChronologically(events);

  const homeTeamId = match.teamId || "home_team";
  const possessions: Possession[] = [];
  let activePossession: Possession | null = null;
  let lastEvent: GameEvent | null = null;

  for (let i = 0; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
    // If the event is in a new quarter, cleanly close the previous active possession
    if (activePossession && event.quarter && event.quarter !== activePossession.period) {
      activePossession.clockEnd = 0; // End of the period
      activePossession.closingEventId = `quarter_end_rebuild_${activePossession.period}_${event.id}`;
      activePossession.closingAction = "end_of_period";
      activePossession.outcome = "empty";
      possessions.push(activePossession);
      activePossession = null;
    }

    const isHome = event.team === "home" || (
      event.team !== "away" && (
        matchRosters.some(
          (r) => r.teamId === homeTeamId && r.profileId === event.playerId,
        ) || 
        event.playerId === "home_team" ||
        event.playerId === homeTeamId ||
        event.playerId === "our_team"
      )
    );
    const eventTeam: "home" | "away" = isHome ? "home" : "away";

    // Determine if this is the final free throw in the series
    let isFinalFT = true;
    if (event.type === "1pt_make" || event.type === "1pt_miss") {
      if (event.metadata?.isFinalFT !== undefined) {
        isFinalFT = event.metadata.isFinalFT === true;
      } else {
        isFinalFT = true;
        for (let j = i + 1; j < sortedEvents.length; j++) {
          const nextEv = sortedEvents[j];
          if (["sub_in", "sub_out", "timeout", "foul", "defensive_foul", "offensive_foul"].includes(nextEv.type)) {
            continue;
          }
          if (nextEv.type === "1pt_make" || nextEv.type === "1pt_miss") {
            const nextIsHome = nextEv.team === "home" || (
              nextEv.team !== "away" && (
                matchRosters.some(r => r.teamId === homeTeamId && r.profileId === nextEv.playerId) ||
                nextEv.playerId === "home_team" ||
                nextEv.playerId === homeTeamId ||
                nextEv.playerId === "our_team"
              )
            );
            const nextEventTeam = nextIsHome ? "home" : "away";
            if (nextEventTeam === eventTeam) {
              isFinalFT = false;
            }
          }
          break;
        }
      }
    }

    // Anomaly Detection Logic
    let isAnomaly = false;
    let anomalyReason = "";

    if (activePossession && activePossession.teamInPossession === eventTeam) {
      if (
        lastEvent &&
        ["2pt_miss", "3pt_miss", "1pt_miss"].includes(lastEvent.type) &&
        event.type !== "oreb"
      ) {
        if (lastEvent.type === "1pt_miss" && (event.type === "1pt_make" || event.type === "1pt_miss")) {
          isAnomaly = false;
        } else if (event.type === "to") {
          isAnomaly = false;
        } else if (
          ["foul", "offensive_foul", "defensive_foul"].includes(event.type)
        ) {
          isAnomaly = false;
        } else if (["sub_in", "sub_out"].includes(event.type)) {
          isAnomaly = false;
        } else {
          isAnomaly = true;
          anomalyReason =
            "Aksi offense (bukan rebound offense) setelah missed shot. Indikasi missing OREB.";
        }
      }
    } else if (
      activePossession &&
      activePossession.teamInPossession !== eventTeam
    ) {
      if (
        lastEvent &&
        ["2pt_miss", "3pt_miss", "1pt_miss"].includes(lastEvent.type) &&
        event.type !== "dreb"
      ) {
        if (event.type === "to") {
          isAnomaly = false;
        } else if (
          ["foul", "offensive_foul", "defensive_foul", "blk"].includes(
            event.type,
          )
        ) {
          isAnomaly = false;
        } else if (["sub_in", "sub_out"].includes(event.type)) {
          isAnomaly = false;
        } else {
          isAnomaly = true;
          anomalyReason = `Aksi transisi lawan (${event.type}) setelah missed shot. Indikasi missing DREB.`;
        }
      }
    }

    if (isAnomaly && activePossession && !activePossession.isAnomaly) {
      activePossession.isAnomaly = true;
      activePossession.anomalyReason = anomalyReason;
    }

    // Possession handling per event type
    let previousPossessionTeam = activePossession?.teamInPossession || null;

    if (activePossession === null) {
      if (!["sub_in", "sub_out", "foul", "timeout", "jumpball"].includes(event.type)) {
        activePossession = {
          id: generateId(),
          matchId,
          teamInPossession: eventTeam,
          clockStart: event.timestamp || 0,
          period: event.quarter || 1,
          isAnomaly: false,
          pointsScored: 0,
        };
        previousPossessionTeam = eventTeam;
      }
    }

    if (activePossession || event.type === "jumpball") {
      if (activePossession) {
        event.possessionId = activePossession.id;
        // Before we close it/transition, the current event belongs to the active possession.
        event.possession = activePossession.teamInPossession;
      }

      if (event.type === "jumpball") {
        if (activePossession) {
          activePossession.clockEnd = event.timestamp;
          activePossession.closingEventId = event.id;
          activePossession.closingAction = "deadball_end";
          activePossession.outcome = "interrupted";
          possessions.push(activePossession);
        }

        activePossession = {
          id: generateId(),
          matchId,
          teamInPossession: eventTeam,
          clockStart: event.timestamp || 0,
          period: event.quarter || 1,
          isAnomaly: false,
          pointsScored: 0,
        };
        event.possessionId = activePossession.id;
        event.possession = activePossession.teamInPossession;
      } else if (activePossession) {
        if (["to", "offensive_foul"].includes(event.type)) {
          activePossession.clockEnd = event.timestamp;
          activePossession.closingEventId = event.id;
          activePossession.closingAction = "turnover";
          activePossession.outcome = "empty";
          possessions.push(activePossession);

          activePossession = {
            id: generateId(),
            matchId,
            teamInPossession: eventTeam === "home" ? "away" : "home",
            clockStart: event.timestamp || 0,
            period: event.quarter || 1,
            isAnomaly: false,
            pointsScored: 0,
          };
        } else if (["stl"].includes(event.type)) {
          if (activePossession.teamInPossession !== eventTeam) {
            // Steal ends opponent's possession
            activePossession.clockEnd = event.timestamp;
            activePossession.closingEventId = event.id;
            activePossession.closingAction = "turnover";
            activePossession.outcome = "empty";
            possessions.push(activePossession);

            activePossession = {
              id: generateId(),
              matchId,
              teamInPossession: eventTeam, // Stealer gets the ball!
              clockStart: event.timestamp || 0,
              period: event.quarter || 1,
              isAnomaly: false,
              pointsScored: 0,
            };
          }
        } else if (["inbound", "foul_drawn"].includes(event.type)) {
          // These events explicitly start a new possession for the eventTeam, if they didn't already have it
          if (activePossession.teamInPossession !== eventTeam) {
            activePossession.clockEnd = event.timestamp;
            activePossession.closingEventId = event.id;
            activePossession.closingAction = "deadball_end";
            activePossession.outcome = "empty";
            possessions.push(activePossession);

            activePossession = {
              id: generateId(),
              matchId,
              teamInPossession: eventTeam,
              clockStart: event.timestamp || 0,
              period: event.quarter || 1,
              isAnomaly: false,
              pointsScored: 0,
            };
          }
        } else if (["2pt_make", "3pt_make"].includes(event.type)) {
          activePossession.clockEnd = event.timestamp;
          activePossession.closingEventId = event.id;
          activePossession.closingAction = "made_shot";
          activePossession.outcome = "score";
          activePossession.pointsScored =
            (activePossession.pointsScored || 0) + (parseInt(event.type[0]) || 0);
          possessions.push(activePossession);

          activePossession = {
            id: generateId(),
            matchId,
            teamInPossession: eventTeam === "home" ? "away" : "home",
            clockStart: event.timestamp || 0,
            period: event.quarter || 1,
            isAnomaly: false,
            pointsScored: 0,
          };
        } else if (event.type === "1pt_make") {
          activePossession.pointsScored = (activePossession.pointsScored || 0) + 1;
          if (isFinalFT) {
            activePossession.clockEnd = event.timestamp;
            activePossession.closingEventId = event.id;
            activePossession.closingAction = "made_shot";
            activePossession.outcome = "score";
            possessions.push(activePossession);

            activePossession = {
              id: generateId(),
              matchId,
              teamInPossession: eventTeam === "home" ? "away" : "home",
              clockStart: event.timestamp || 0,
              period: event.quarter || 1,
              isAnomaly: false,
              pointsScored: 0,
            };
          }
        } else if (["dreb"].includes(event.type)) {
          activePossession.clockEnd = event.timestamp;
          activePossession.closingEventId = event.id;
          activePossession.closingAction = "missed_shot";
          activePossession.outcome = "empty";
          possessions.push(activePossession);

          activePossession = {
            id: generateId(),
            matchId,
            teamInPossession: eventTeam, // Rebounder gets possession
            clockStart: event.timestamp || 0,
            period: event.quarter || 1,
            isAnomaly: false,
            pointsScored: 0,
          };
        }
      }
      // oreb extends possession, do nothing
      // misses wait for rebound, do nothing
    }

    if (!["sub_in", "sub_out", "timeout"].includes(event.type)) {
      lastEvent = event;
    }
  }

  if (activePossession) {
    activePossession.clockEnd = activePossession.clockEnd ?? 0;
    activePossession.closingAction = activePossession.closingAction ?? "end_of_period";
    activePossession.outcome = activePossession.outcome ?? "empty";
    possessions.push(activePossession);
  }

  return { sortedEvents, possessions, activePossession };
};

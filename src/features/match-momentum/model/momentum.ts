import { GameEvent, MatchRoster, Match } from "../../../core/types/stats";
import { sortEventsChronologically } from "../../../core/services/possessionEngine";

export interface MomentumPoint {
  idx: number;
  quarter: number;
  clockLabel: string;
  homeScore: number;
  awayScore: number;
  margin: number; // home - away
  eventId: string;
  youtubeTimestamp?: number;
  label: string;
}

export function buildMomentum(
  events: GameEvent[],
  matchRosters: MatchRoster[] = [],
  match?: Match | null
): MomentumPoint[] {
  // Always start with 0-0 point at start of game
  const points: MomentumPoint[] = [
    {
      idx: 0,
      quarter: 1,
      clockLabel: "10:00",
      homeScore: 0,
      awayScore: 0,
      margin: 0,
      eventId: "start",
      youtubeTimestamp: undefined,
      label: "Mulai Pertandingan (0-0)",
    }
  ];

  const sortedEvents = sortEventsChronologically(events);
  const homeTeamId = match?.teamId || "home_team";

  let homeScore = 0;
  let awayScore = 0;
  let idx = 1;

  for (const event of sortedEvents) {
    let pointsAdded = 0;
    if (event.type === "1pt_make") {
      pointsAdded = 1;
    } else if (event.type === "2pt_make") {
      pointsAdded = 2;
    } else if (event.type === "3pt_make") {
      pointsAdded = 3;
    }

    if (pointsAdded > 0) {
      // Determine if the event belongs to home or away
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

      const teamKey: "home" | "away" = isHome ? "home" : "away";
      if (teamKey === "home") {
        homeScore += pointsAdded;
      } else {
        awayScore += pointsAdded;
      }

      // Look up player name and jersey number
      let playerName = "Pemain";
      let jerseyNumber = "";
      const rosterItem = matchRosters.find(r => r.profileId === event.playerId);
      if (rosterItem) {
        playerName = rosterItem.name;
        jerseyNumber = rosterItem.jerseyNumber ? `#${rosterItem.jerseyNumber} ` : "";
      } else if (event.playerId === "home_team" || event.playerId === "away_team" || event.playerId === "our_team") {
        playerName = event.playerId === "away_team" ? "Lawan" : "Kita";
      } else {
        playerName = teamKey === "home" ? "Pemain Kita" : "Lawan";
      }

      const label = `${jerseyNumber}${playerName} +${pointsAdded} (${homeScore}-${awayScore})`;
      const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      };
      
      points.push({
        idx: idx++,
        quarter: event.quarter || 1,
        clockLabel: event.gameClock || formatTime(event.timestamp || 0),
        homeScore,
        awayScore,
        margin: homeScore - awayScore,
        eventId: event.id,
        youtubeTimestamp: event.youtubeTimestamp,
        label,
      });
    }
  }

  return points;
}

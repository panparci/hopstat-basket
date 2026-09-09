import { Match, ChildProfile, Team, GameEvent, Player, Possession } from "../../types/stats";
import { PlayerStats } from "../../../hooks/useStats";

export type AgentRole = 'team_analyst' | 'skill_coach' | 'shot_analyst' | 'strategist' | 'scout' | 'progress_analyst';

export interface AgentInsight {
  role: AgentRole;
  title: string;
  content: string;
  actionableAdvice: string[];
}

export interface AiContextData {
  player?: ChildProfile;
  playerStats?: PlayerStats;
  team?: Team;
  teamStats?: PlayerStats;
  opponentStats?: PlayerStats;
  matches?: Match[];
  events?: GameEvent[];
  possessions?: Possession[];
  teamMembersStats?: { player: Player, stats: PlayerStats }[];
  previousInsights?: AgentInsight[];
  teamMembersSummary?: string;
}

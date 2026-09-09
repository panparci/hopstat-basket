import { CompetitionGrade } from '../config/competition';
import { TransferHistory, AthleteLink, ChildProfile } from '../../entities/athlete/model/types';

export type { TransferHistory, AthleteLink, ChildProfile };


export type MatchType = 'single' | 'series';
export type RecordingType = 'single' | 'team' | 'full';
export type RecordingMode = 'lite' | 'detailed';
export type MatchStatus = 'planned' | 'ongoing' | 'completed';

export interface MatchContext {
  format: 'single' | 'tournament' | 'league' | 'playoff';
  stage: 'friendly' | 'group' | 'quarterfinal' | 'semifinal' | 'final';
  importance: 'low' | 'medium' | 'high' | 'elimination';
  purpose: 'development' | 'evaluation' | 'competitive' | 'experimental';
  opponentLevel: 'weaker' | 'same' | 'stronger' | 'unknown';
}

export interface Player {
  id: string;
  name: string;
  displayName?: string; // Name on jersey
  voiceAliases?: string[]; // Voice recognition mapping
  jersey: string;
  position?: string;
  isActive: boolean; // currently on court
  isPlaceholder?: boolean;
  birthDate?: string; // YYYY-MM-DD
  isGuest?: boolean;
  guestForTeamId?: string;
}

export interface Jersey {
  color: string;
  theme: 'gelap' | 'terang';
  name: string; // e.g., "Kuning", "Putih", "Emas"
}

export interface Club {
  id: string;
  name: string;
  logo?: string;
  logoUrl?: string;
  location?: string;
  city?: string;
  description?: string;
  establishedYear?: number;
}

export interface Team {
  id: string;
  clubId?: string; // Parent club
  organizationId?: string; // FK Organization
  divisionCode?: string; // Division Code (from P1A)
  name: string;
  logoUrl?: string; // Logo for the team
  ageGroup?: string; // Default age group for this team
  roster: Player[];
  lightJersey?: Jersey;
  darkJersey?: Jersey;
  defaultColor?: string;
  defaultTheme?: 'gelap' | 'terang';
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  mergedIntoId?: string;
}

export interface Series {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  teamId?: string;
  logoUrl?: string;
}

export interface MatchRoster {
  id: string; // e.g., `${matchId}_${profileId}`
  matchId: string;
  teamId: string;
  profileId: string; // FK to ChildProfile or Player ID
  name: string; // Denormalized for quick access
  jerseyNumber: string;
  isStarter: boolean;
  isActive: boolean; // currently on court
  isGuest?: boolean;
  guestForTeamId?: string;
}

export interface MatchStint {
  id: string;
  matchId: string;
  teamId: string;
  playerIds: string[]; // Array of profileIds currently on the court
  startQuarter: number;
  startClock: number; // Time remaining in seconds
  endQuarter?: number;
  endClock?: number; // Time remaining in seconds
  isGhostStint?: boolean; // Flag for zero-duration stints
  isValid?: boolean; // Flag for audit/validation
}

export interface Match {
  id: string;
  matchId?: string; // User-defined ID (e.g., M20260406-01)
  seriesId?: string;
  eventName?: string; // e.g., Spring Cup 2026
  date: string; // match_date
  venue?: string;
  teamId: string;
  opponentTeamId: string;
  ageGroup: string; // Match age group (e.g., U10)
  matchKU?: number; // Match KU (Kategori Umur) as number
  ageCategory?: number; // Match KU (Kategori Umur) as structured number
  divisionCode?: string; // Standard division code (e.g. KU18-F)
  competitionGrade?: CompetitionGrade; // Level/Grade of competition
  gameType: '5v5' | '3x3' | 'other';
  periodCount: number;
  clockMode: 'running' | 'stop';
  competitionLevel?: 'friendly' | 'tournament' | 'league';
  matchLevel?: 'club' | 'academy' | 'school' | 'mixed';
  isOfficiated?: boolean;
  durationPerPeriod: number;
  matchContext?: MatchContext;
  
  // UI state and basic info
  name: string; // Display name
  type: MatchType;
  recordingType: RecordingType;
  recordingMode?: RecordingMode; // "lite" | "detailed"
  status?: MatchStatus | 'aborted';
  excludeFromStats?: boolean;
  childId: string;
  ourColor?: string;
  theirColor?: string;
  ourTheme?: 'gelap' | 'terang';
  theirTheme?: 'gelap' | 'terang';
  ourColorName?: string;
  theirColorName?: string;
  ourTeamName?: string;
  theirTeamName?: string;
  videoUrl?: string;
  isPrivate?: boolean;
  ourHomeAway?: 'home' | 'away';

  // New configuration state
  activePromptFlowId?: string;
  activePromptStepId?: string;

  // Production Stage (Handoff & Review Pipeline)
  productionStage?: 'tracking' | 'qa_review' | 'coach_analysis' | 'published';
  stageHistory?: {
    stage: 'tracking' | 'qa_review' | 'coach_analysis' | 'published';
    byUserId: string;
    byName: string;
    at: string;
    action: 'advanced' | 'returned';
    note?: string;
  }[];
  healthScore?: number;
  trustClassification?: 'TRUSTED' | 'CAUTION' | 'UNRELIABLE';
  stopClockOnMadeBasket?: 'fiba' | 'always' | 'never';
}

export type EventType = 
  | '1pt_make' | '1pt_miss' 
  | '2pt_make' | '2pt_miss' 
  | '3pt_make' | '3pt_miss'
  | 'oreb' | 'dreb'
  | 'ast' | 'stl' | 'blk' | 'to' | 'foul' | 'foul_drawn' | 'offensive_foul' | 'defensive_foul' | 'blocked_shot'
  | 'sub_in' | 'sub_out'
  | 'timeout' | 'inbound' | 'jumpball' | 'starter'
  | 'free_throw' | 'shot' | 'rebound' | 'turnover' | 'substitution' | 'dead_ball' | 'possession_marker';

export type ShotDifficulty = 'Open' | 'Lightly Contested' | 'Contested' | 'Heavily Contested';
export type AssistType = 'Direct' | 'Short Creation' | 'Weak Assist';
export type GameContext = 
  | 'Bring up ball' | 'Half court set' | 'Drive / attack' | 'Transition offense' 
  | 'Inbound' | 'After rebound' | 'Fast break';

export type FoulType = 
  | 'Reach-In' | 'Blocking' | 'Shooting Foul' | 'Holding' | 'Hand Check' 
  | 'Loose Ball' | 'Charging' | 'Illegal Screen' | 'Push-Off' | 'Technical' 
  | 'Unsportsmanlike' | 'Double Team' | 'Other'
  | 'shooting' | 'non_shooting' | 'offensive' | 'technical' | 'unsportsmanlike' | 'loose_ball';

export type TurnoverType = 
  | 'Bad Pass' | 'Bad Handle' | 'Travel' | 'Double Dribble' | 'Out of Bounds' 
  | 'Offensive Foul' | 'Time Violation' | 'Double Team' | 'Miscommunication' | 'Stealed'
  | 'Backcourt Violation' | 'Shot Clock Violation' | 'Carrying' | 'Kicked Ball' | 'Goaltending'
  | 'bad_pass' | 'bad_handle' | 'travel' | 'offensive_foul' | 'out_of_bounds' | 'shot_clock' | 'steal';

export type PressureLevel = 'No Pressure' | 'Light' | 'Heavy / Trap';
export type ReboundType = 'Long' | 'Under Ring' | 'offensive' | 'defensive';

export type EventActorType = 'our_player' | 'opponent_player' | 'our_team' | 'opponent_team' | 'unknown';
export type EventSourceType = 'manual_button' | 'smart_prompt' | 'voice_capture' | 'smart_suggestion' | 'correction' | 'batch_fix';
export type PhaseOfPlay = 'set_offense' | 'fast_break' | 'transition' | 'inbound' | 'deadball';

export interface GameEvent {
  id: string;
  matchId: string;
  quarter: number;
  timestamp: number; // game time in seconds (Time Remaining)
  gameClock?: string; // MM:SS string representation
  youtubeTimestamp?: number;
  sequenceNumber?: number; // Sorting order within same timestamp
  
  team?: 'home' | 'away'; // Legacy support
  teamId?: string; // "home" or "away" or actual team UUID
  actorType?: EventActorType;
  turnoverType?: 'live_ball' | 'dead_ball'; // Restore for compatibility
  playerId: string;
  opponentPlayerId?: string;
  
  type: EventType;
  subType?: string;
  result?: 'make' | 'miss' | 'success' | 'fail' | 'empty';
  
  points?: number; // pointsValue
  shotZone?: string;
  
  // Linking & Relationships
  linkedEntityType?: string;
  linkedEntityId?: string;
  relatedEventIds?: string[];
  possessionId?: string;
  matchStintContext?: string; // Links to a lineup/stint
  
  // Contextual metadata
  phaseOfPlay?: PhaseOfPlay;
  confidenceScore?: number;
  sourceType?: EventSourceType;
  sourceText?: string;
  promptFlowId?: string;
  promptStepId?: string;
  
  mode?: RecordingType; // FULL_MATCH, TEAM_ONLY, SINGLE
  detailLevel?: RecordingMode; // DETAIL, LITE

  // Location
  x?: number;
  y?: number;
  
  // Legacy/Extra Context
  isShootingFoul?: boolean; // Marks a missed shot that was fouled, so it doesn't count as FGA
  shotDifficulty?: ShotDifficulty;
  assistType?: AssistType;
  gameContext?: GameContext;
  pressureLevel?: PressureLevel;
  reboundType?: ReboundType;
  playerAgeAtMatch?: number | string;
  scoreDifference?: number;
  isClutch?: boolean;
  isContextOnly?: boolean;
  possession?: 'home' | 'away';
  realTime: string; // ISO string
  createdAt?: string; // ISO string
  updatedAt?: string; // ISO string

  metadata?: {
    areaName?: string;
    [key: string]: any;
  };
}

export type PossessionOpeningSource = 'steal' | 'dreb' | 'oreb' | 'inbound' | 'jumpball' | 'deadball_restart';
export type PossessionClosingAction = 'made_shot' | 'missed_shot' | 'turnover' | 'foul_drawn' | 'end_of_period' | 'deadball_end';
export type PossessionOutcome = 'score' | 'empty' | 'turnover' | 'interrupted';

export interface Possession {
  id: string;
  matchId: string;
  teamInPossession: 'home' | 'away';
  period: number;
  clockStart?: number; // game time in seconds
  clockEnd?: number; // game time in seconds
  
  // Structured flow fields
  teamId?: string; 
  openingEventId?: string;
  openingSource?: PossessionOpeningSource;
  openingPlayerId?: string;
  closingEventId?: string;
  closingAction?: PossessionClosingAction;
  closingPlayerId?: string;
  outcome?: PossessionOutcome;
  pointsScored: number;
  
  // Anomaly detection
  isAnomaly?: boolean;
  anomalyReason?: string;
}

export interface GameState {
  matchId: string;
  homeScore: number;
  awayScore: number;
  homeFouls: number;
  awayFouls: number;
  homeTimeouts: number;
  awayTimeouts: number;
  currentQuarter: number;
  timeRemaining: number; // in seconds
  isRunning: boolean;
}

export type EventRelationType = 'ASSISTS' | 'STEALS_FROM' | 'REBOUNDS' | 'RESULTS_IN_FT';

export interface EventLink {
  id: string;
  matchId: string;
  primaryEventId: string;
  secondaryEventId: string;
  relationType: EventRelationType;
  metadata?: Record<string, any>;
}

export interface AiInsight {
  id: string;
  role: string;
  targetId: string; // profileId or teamId
  insightData: any;
  createdAt: string; // ISO string
}

export type AuditIssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AuditIssueType = 'stint' | 'possession' | 'event' | 'relationship' | 'general' | 'STINT_TIMELINE_GAP' | 'PLAYER_NOT_ON_COURT' | 'EVENT_ATTRIBUTION_MISMATCH' | 'POSSIBLE_MISSING_SUBSTITUTION';
export type AuditIssueStatus = 'open' | 'reviewed' | 'resolved' | 'dismissed' | 'failed';

export type DataTrustClassification = 'TRUSTED' | 'CAUTION' | 'UNRELIABLE';

export type SuggestionActionType = 'LINK_ASSIST' | 'INSERT_REBOUND' | 'LINK_STEAL' | 'CLOSE_POSSESSION' | 'REASSIGN_PLAYER' | 'ADJUST_STINT_TIME';

export interface AuditIssue {
  id: string;
  type: AuditIssueType;
  severity: AuditIssueSeverity;
  status: AuditIssueStatus;
  message: string;
  groupingId?: string; // Cluster related issues
  recommendedAction?: string; // Simple text hint
  relatedIds?: {
    eventId?: string;
    possessionId?: string;
    stintId?: string;
    playerId?: string;
  };
  suggestion?: {
    type: SuggestionActionType;
    targetIds: {
      eventId?: string;
      possessionId?: string;
      stintId?: string;
      playerId?: string;
    };
    confidence: number;
    label: string;
  };
}

export interface AuditIssueResolution {
  id: string; // matchId_issueId
  matchId: string;
  issueId: string;
  status: AuditIssueStatus;
  updatedAt: string;
  fixMetadata?: {
    appliedSuggestionType?: SuggestionActionType;
    confidence?: number;
    appliedAutomatically?: boolean;
  };
}

export interface MatchAuditResult {
  matchId: string;
  timestamp: string;
  summary: {
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  issues: AuditIssue[];
  healthScore: number; // 0-100
  trustClassification: DataTrustClassification;
}

export interface MergeLog {
  id: string;
  timestamp: string;
  primaryId: string;
  secondaryId: string;
  primaryName: string;
  secondaryName: string;
  previousPrimaryState: ChildProfile;
  previousSecondaryState: ChildProfile;
  reassignedCounts: {
    matchRosters: number;
    events: number;
    matchStints: number;
    transferHistory: number;
  };
  details: {
    updatedRosterIds: string[];
    deletedRosters: any[];
    reassignedEventIds: string[];
    eventOriginalFields?: { eventId: string; originalPlayerId: string; originalOpponentPlayerId?: string; originalLinkedEntityId?: string }[];
    stintOriginalPlayerIds: { stintId: string; originalPlayerIds: string[] }[];
    reassignedClaimRequestIds: string[];
    reassignedAiInsightIds: string[];
  };
}


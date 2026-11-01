export type DrillCategory = 
  | 'ball_handling'
  | 'shooting'
  | 'footwork'
  | 'defense'
  | 'passing'
  | 'post_moves';

export type SkillLevel = 'pemula' | 'menengah' | 'pro';

export type PlayingPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export type FacilityAccess = 'full_court' | 'half_court' | 'tanpa_ring';

export interface FundamentalDrill {
  id: string;
  name: string;
  category: DrillCategory;
  difficulty: SkillLevel;
  description: string;
  mechanics: string[]; // e.g., ["Posisi Kaki Tekuk Lutut", "Point of Release Tinggi"]
  youtubeUrl: string; // legacy 16:9 demo — prefer videoUrl (upload 9:16). Match film stays YouTube.
  youtubeVideoId: string;
  /** Uploaded demo (Bunny / media) — 9:16; stored in DB. */
  videoUrl?: string;
  loopStartTimeSec: number;
  loopEndTimeSec?: number;
  recommendedSets: number;
  recommendedReps: string; // e.g., "10 Reps per Sisi" or "60 Detik"
  targetMuscles: string[]; // e.g., ["Quadriceps", "Core", "Shoulders"]
  equipment: string[]; // e.g., ["Full Court", "Cone", "2 Bola Basketball"]
  thumbnailUrl?: string;
  createdAt?: string;
  /** official = company catalog; coach = Skills Coach technique video on the same skillKey/category */
  ownerType?: 'official' | 'coach';
  ownerId?: string;
  skillKey?: string; // shared taxonomy; defaults to category
  visibility?: 'public' | 'connected' | 'private';
  moderationStatus?: 'draft' | 'in_review' | 'published' | 'rejected';
}

export interface ScheduledDrillItem {
  drillId: string;
  sets: number;
  reps: string;
  notes?: string;
  completed?: boolean;
}

export interface WorkoutScheduleDay {
  id: string;
  athleteId: string;
  dayIndex: number; // 1 to 7
  dayTitle: string; // e.g., "Hari 1: Ball Handling & Footwork Burst"
  focusArea: string; // e.g., "Ball Handling & Footwork"
  estimatedMinutes: number;
  drills: ScheduledDrillItem[];
  completedAt?: string;
  isRestDay?: boolean;
}

export interface AthleteProfile {
  id: string;
  name: string;
  position: PlayingPosition;
  skillLevel: SkillLevel;
  facilityAccess: FacilityAccess;
  weeklyGoalDays: number;
  avatarUrl?: string;
  createdAt: string;
}

export interface CoachFeedback {
  coachName: string;
  rating: number; // 1 to 5
  comments: string;
  timestampNotes?: { time: string; note: string }[];
  reviewedAt: string;
}

export interface DrillSubmission {
  id: string;
  athleteId: string;
  athleteName: string;
  drillId: string;
  drillName: string;
  workoutDayId?: string;
  videoUrl: string; // athlete training clip: Bunny/upload 9:16 (DB). Match film ≠ this — YouTube only.
  mediaFile?: string;
  mediaType?: 'video' | 'image' | 'link';
  source?: 'link' | 'upload' | 'drive' | 'bunny';
  driveFileId?: string;
  bunnyVideoId?: string;
  athleteNotes: string;
  status: 'submitted' | 'reviewed' | 'needs_revision';
  submittedAt: string;
  submittedBy?: string;
  coachFeedback?: CoachFeedback;
}

export interface QAReply {
  id: string;
  authorName: string;
  authorRole: 'coach' | 'athlete';
  message: string;
  createdAt: string;
}

export interface ClassroomQAThread {
  id: string;
  athleteId: string;
  athleteName: string;
  drillId?: string;
  drillName?: string;
  question: string;
  category: string;
  createdAt: string;
  replies: QAReply[];
}

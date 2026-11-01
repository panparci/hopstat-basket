export type CoachLinkStatus = 'pending' | 'active' | 'declined' | 'ended';

/** One Skills Coach ↔ one player profile. Independent of club affiliation. */
export interface CoachPlayerLink {
  id: string;
  coachAccountId: string;
  coachName: string;
  profileId: string;
  profileName: string;
  specialties: string[]; // skill keys from taxonomy / drill categories
  status: CoachLinkStatus;
  requestedByAccountId: string;
  guardianApprovedAt?: number;
  coachAcceptedAt?: number;
  endedAt?: number;
  shareFeedbackWithOtherCoaches?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type TrainingContentOwner = 'official' | 'coach';
export type TrainingContentVisibility = 'public' | 'connected' | 'private';

/** Extends catalog drills without duplicating the skill master. */
export interface CoachTrainingContentMeta {
  ownerType: TrainingContentOwner;
  ownerId?: string; // coach account id when ownerType=coach
  skillKey: string; // shared taxonomy key e.g. ball_handling / crossover
  visibility: TrainingContentVisibility;
  moderationStatus?: 'draft' | 'in_review' | 'published' | 'rejected';
}

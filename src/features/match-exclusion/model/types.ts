export type MatchExclusionStatus = 'pending' | 'approved' | 'rejected';

/** Parent asks admin to detach a match from their child's golden record (wrong merge / same name). */
export interface MatchExclusionRequest {
  id: string;
  profileId: string;
  profileName: string;
  matchId: string;
  matchLabel: string;
  reason: string;
  requestedByAccountId: string;
  requestedByName: string;
  status: MatchExclusionStatus;
  adminNote?: string;
  reviewedByAccountId?: string;
  createdAt: number;
  updatedAt: number;
}

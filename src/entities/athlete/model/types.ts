export interface TransferHistory {
  fromTeamId?: string;
  toTeamId: string;
  date: string;
}

export interface AthleteLink {
  accountId: string;
  relationship: 'guardian' | 'manager' | 'agent';
  verified: boolean;
  verifiedAt?: number;
}

export interface ChildProfile {
  id: string;
  name: string;
  displayName?: string; // Name on jersey
  voiceAliases?: string[]; // Voice recognition mapping
  age?: number;
  birthDate?: string; // YYYY-MM-DD
  teamId?: string; // Default team ID
  mainTeamId?: string;
  schoolTeamId?: string;
  academyTeamId?: string;
  loanTeamId?: string;
  jerseyNumber?: string;
  avatar?: string;
  photoUrl?: string;
  transferHistory?: TransferHistory[];
  isDiscoverable?: boolean;
  links?: AthleteLink[];
  claimStatus?: 'unclaimed' | 'claim_pending' | 'verified';
  producedFromRequestId?: string;
  archived?: boolean;
  mergedIntoId?: string;
  aliases?: string[];
  guardianAccountIds?: string[];
  gender?: string;
  internalId?: string;
  clubId?: string;
}

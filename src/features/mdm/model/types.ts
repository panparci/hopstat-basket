export type MasterEntityType = 
  | 'club'              // 1. Nama klub
  | 'training_squad'     // 2. Nama tim latihan di dalam klub
  | 'competition_team'   // 3. Nama tim tanding di klub x pertandingan
  | 'athlete'           // 4. Nama atlet
  | 'school'            // 5. Nama sekolah
  | 'academy'           // 6. Nama academy
  | 'tournament';       // 7. Nama event turnamen (Golden Record)

export type MasterRecordStatus = 'canonical' | 'pending' | 'merged';

export interface MasterAlias {
  id: string; // als_xxx
  entityType: MasterEntityType;
  canonicalId: string; // Mengarah ke Golden Record ID
  aliasText: string; // cth: "Sahabat Arena SMG", "SMP 1 Smg", "Kejurkot Jakpus 26"
  normalizedText: string; // teks yang sudah dibersihkan untuk matching
  source: 'user_input' | 'admin_merged' | 'system_import';
  createdAt: string;
}

export interface MasterProposal {
  id: string; // prop_xxx
  entityType: MasterEntityType;
  proposedName: string;
  contextData?: {
    city?: string;
    province?: string;
    ageGroup?: string;
    parentOrgId?: string;
    tournamentId?: string;
    schoolLevel?: 'SD' | 'SMP' | 'SMA' | 'Universitas';
    [key: string]: any;
  };
  suggestedMatches?: Array<{
    canonicalId: string;
    name: string;
    similarity: number;
    reason: string;
  }>;
  status: 'pending' | 'approved_canonical' | 'merged_to_canonical' | 'rejected';
  resolvedCanonicalId?: string;
  submittedBy?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MasterEntityItem {
  id: string;
  entityType: MasterEntityType;
  name: string;
  displayName?: string;
  city?: string;
  province?: string;
  ageGroup?: string;
  parentOrgId?: string;
  parentOrgName?: string;
  tournamentId?: string;
  tournamentName?: string;
  status: MasterRecordStatus;
  canonicalId?: string; // jika status = 'merged'
  aliases: string[];
  transactionCount: number; // Jumlah match/roster/event yang mengacu ke ID ini
  rosterCount?: number;
  confidenceScore?: number;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface DuplicateCandidatePair {
  id: string;
  entityType: MasterEntityType;
  sourceItem: MasterEntityItem;
  canonicalTarget: MasterEntityItem;
  similarityScore: number; // 0 - 100
  matchReasons: string[];
  detectedAt: string;
}

export interface MergeActionPayload {
  entityType: MasterEntityType;
  sourceId: string;
  canonicalTargetId: string;
  retainSourceAsAlias: boolean;
  notes?: string;
}

export interface EntityTypeConfig {
  type: MasterEntityType;
  label: string;
  pluralLabel: string;
  iconName: string;
  description: string;
  placeholder: string;
  contextFieldLabel?: string;
  hasCity: boolean;
  hasAgeGroup: boolean;
  hasParentOrg: boolean;
}

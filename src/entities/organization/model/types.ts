export interface Organization {
  id: string;
  name: string;
  type: 'club' | 'academy' | 'school';
  city: string;
  province?: string;
  logoUrl?: string;
  ownerAccountId?: string;
  status: 'pending' | 'verified' | 'merged';
  mergedIntoId?: string;
  createdAt: string; // ISO string or epoch
  updatedAt: string; // ISO string or epoch
}

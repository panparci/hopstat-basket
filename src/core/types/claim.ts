export interface ClaimRequest {
  id: string;
  profileId: string;
  claimantAccountId: string;
  relationship: 'ayah' | 'ibu' | 'wali' | string;
  claimantName: string;
  claimantPhone: string;
  claimantNik?: string;
  childData: {
    name: string;
    dob: string;
    gender: string;
    club: string;
    jerseyNumber?: string;
    events?: string[];
  };
  documents: {
    type: 'kk' | 'akta' | 'kartu_pelajar' | string;
    fileName: string;
    dataUrl: string;
  }[];
  matchScore: number;
  status: 'pending' | 'approved' | 'rejected';
  paymentId?: string;
  paymentStatus?: 'paid' | 'refund_pending' | 'refunded' | 'refund_rejected';
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: number;
  updatedAt: number;
}

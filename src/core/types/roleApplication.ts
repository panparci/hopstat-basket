export interface RoleApplication {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  requestedRole: 'statistician' | 'scout' | 'coach';
  motivation: string;
  experience?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: number;
  updatedAt: number;
}

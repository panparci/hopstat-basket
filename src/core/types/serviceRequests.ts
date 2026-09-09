import { CompetitionGrade } from '../config/competition';

export type RequestStatus = 'pending' | 'awaiting_payment' | 'paid' | 'assigned' | 'in_progress' | 'completed' | 'reviewed';

export interface StatServiceRequest {
  id: string;
  customerId: string;
  youtubeUrl: string;
  homeTeamName: string;
  awayTeamName: string;
  homeRoster: { name: string; jersey: string }[];
  awayRoster: { name: string; jersey: string }[];
  status: RequestStatus;
  assignedTo?: string; // Statistician ID
  matchId?: string;    // Resulting match ID
  price: number;
  createdAt: number;
  paymentId?: string;
  eventName?: string;
  matchDate?: string;
  venue?: string;
  ageCategory?: number;
  divisionCode?: string;
  competitionGrade?: CompetitionGrade;
  recordingType?: 'single' | 'team' | 'full';
}

export type UserRole = 'admin' | 'statistician' | 'customer' | 'scout' | 'coach';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  passwordHash?: string;
  passwordSalt?: string;
  createdAt?: number;
  status?: 'active' | 'suspended';
}

export interface PaymentRecord {
  id: string;
  requestId: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  method: 'card' | 'transfer' | 'e-wallet';
  createdAt: number;
}

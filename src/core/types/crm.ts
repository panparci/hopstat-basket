export interface LeadNote {
  id: string;
  text: string;
  createdAt: number;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  childAge?: string;
  source: 'landing_hero' | 'landing_pricing' | 'landing_footer' | 'manual';
  interest: 'free' | 'pro' | 'verified' | 'unknown';
  stage: 'new' | 'contacted' | 'trial' | 'customer' | 'lost';
  notes: LeadNote[];
  createdAt: number;
  updatedAt: number;
}

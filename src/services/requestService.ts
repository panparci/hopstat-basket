import { initDB } from '../lib/db';
import { StatServiceRequest, PaymentRecord } from '../core/types/serviceRequests';
import { statsService } from '../core/services/statsService';
import { generateId } from '../core/utils/idUtils';
import { CompetitionGrade } from '../core/config/competition';
import { getDivision } from '../entities/division/model/divisions';

export const requestService = {
  async createMatchFromRequest(request: StatServiceRequest): Promise<string> {
    const db = await initDB();
    if (request.matchId) {
      // Check if match already exists
      const existingMatch = await db.get('matches', request.matchId);
      if (existingMatch) {
        return request.matchId;
      }
    }

    const matchId = generateId('m');
    const newMatch = {
      id: matchId,
      name: `${request.homeTeamName} vs ${request.awayTeamName}`,
      eventName: request.eventName || 'Stat Service Request',
      date: request.matchDate || new Date().toISOString(),
      venue: request.venue || 'YouTube Request',
      type: 'single' as const,
      recordingType: request.recordingType || 'full',
      durationPerPeriod: 10,
      gameType: '5v5' as const,
      videoUrl: request.youtubeUrl,
      ourHomeAway: 'home' as const,
      ourTeamName: request.homeTeamName,
      theirTeamName: request.awayTeamName,
      ourColor: 'var(--color-brand-navy)',
      theirColor: '#DC2626',
      status: 'planned' as const,
      teamId: generateId('t'),
      opponentTeamId: generateId('t'),
      ageGroup: request.divisionCode ? (getDivision(request.divisionCode)?.label || 'U18') : (request.ageCategory ? `KU-${request.ageCategory}` : 'U18'),
      matchKU: request.divisionCode ? (getDivision(request.divisionCode)?.ageCategory) : request.ageCategory,
      ageCategory: request.divisionCode ? (getDivision(request.divisionCode)?.ageCategory) : request.ageCategory,
      divisionCode: request.divisionCode,
      competitionGrade: request.competitionGrade || CompetitionGrade.LOCAL_FRIENDLY,
      periodCount: 4,
      clockMode: 'stop' as const,
      childId: ''
    };

    // Use statsService to save the match
    await statsService.addMatch(newMatch as any);

    // Add rosters
    if (request.homeRoster && Array.isArray(request.homeRoster)) {
      for (const p of request.homeRoster) {
        await statsService.addMatchRoster({
          id: generateId('mr'),
          matchId: matchId,
          teamId: newMatch.teamId,
          profileId: generateId('p'),
          name: p.name,
          jerseyNumber: p.jersey,
          isStarter: false,
          isActive: true
        });
      }
    }

    if (request.awayRoster && Array.isArray(request.awayRoster)) {
      for (const p of request.awayRoster) {
        await statsService.addMatchRoster({
          id: generateId('mr'),
          matchId: matchId,
          teamId: newMatch.opponentTeamId,
          profileId: generateId('p'),
          name: p.name,
          jerseyNumber: p.jersey,
          isStarter: false,
          isActive: true
        });
      }
    }

    // Save mapping and update request with matchId
    await this.updateRequestStatus(request.id, request.status, { matchId });
    return matchId;
  },

  async getRequestByMatchId(matchId: string): Promise<StatServiceRequest | undefined> {
    const db = await initDB();
    const requests = await db.getAll('stat_requests');
    return requests.find(r => r.matchId === matchId);
  },

  async createBackOfficeRequest(match: any, rosters: any[]): Promise<StatServiceRequest> {
    const db = await initDB();
    const id = crypto.randomUUID();

    const homeTeamRoster = rosters
      .filter(r => r.teamId === match.teamId)
      .map(r => ({ name: r.name, jersey: r.jerseyNumber || '?' }));

    const awayTeamRoster = rosters
      .filter(r => r.teamId === match.opponentTeamId)
      .map(r => ({ name: r.name, jersey: r.jerseyNumber || '?' }));

    const newRequest: StatServiceRequest = {
      id,
      customerId: 'back-office',
      youtubeUrl: match.videoUrl || '',
      homeTeamName: match.ourTeamName || 'Kita',
      awayTeamName: match.theirTeamName || 'Lawan',
      homeRoster: homeTeamRoster,
      awayRoster: awayTeamRoster,
      status: 'paid', // langsung paid/antrean kerja, bypass payment flow
      price: 0,
      createdAt: Date.now(),
      matchId: match.id,
      eventName: match.eventName,
      matchDate: match.date,
      venue: match.venue,
      ageCategory: match.matchKU,
      competitionGrade: match.competitionGrade,
      recordingType: match.recordingType || 'full'
    };

    await db.put('stat_requests', newRequest);
    return newRequest;
  },

  async createRequest(data: Omit<StatServiceRequest, 'id' | 'status' | 'createdAt' | 'price' | 'matchId'>): Promise<StatServiceRequest> {
    const db = await initDB();
    const id = crypto.randomUUID();
    const newRequest: StatServiceRequest = {
      ...data,
      id,
      status: 'pending',
      price: 50000,
      createdAt: Date.now()
    };
    await db.put('stat_requests', newRequest);
    return newRequest;
  },

  async getCustomerRequests(customerId: string): Promise<StatServiceRequest[]> {
    const db = await initDB();
    return db.getAllFromIndex('stat_requests', 'by-customer', customerId);
  },

  async getAllRequests(): Promise<StatServiceRequest[]> {
    const db = await initDB();
    return db.getAll('stat_requests');
  },

  async updateRequestStatus(id: string, status: StatServiceRequest['status'], extraData: Partial<StatServiceRequest> = {}): Promise<void> {
    const db = await initDB();
    const request = await db.get('stat_requests', id);
    if (!request) throw new Error('Request not found');
    
    await db.put('stat_requests', { ...request, status, ...extraData });
  },

  async processPayment(requestId: string): Promise<PaymentRecord> {
    const db = await initDB();
    const request = await db.get('stat_requests', requestId);
    if (!request) throw new Error('Request not found');

    const paymentId = crypto.randomUUID();
    const payment: PaymentRecord = {
      id: paymentId,
      requestId,
      amount: request.price,
      status: 'pending',
      method: 'card',
      createdAt: Date.now()
    };

    await db.put('payments', payment);
    await this.updateRequestStatus(requestId, 'awaiting_payment', { paymentId });
    return payment;
  },

  async confirmPayment(requestId: string): Promise<void> {
    const db = await initDB();
    const request = await db.get('stat_requests', requestId);
    if (!request) throw new Error('Request not found');
    if (request.paymentId) {
      const pay = await db.get('payments', request.paymentId);
      if (pay) {
        pay.status = 'success';
        await db.put('payments', pay);
      }
    }
    await this.updateRequestStatus(requestId, 'paid');
  },

  async assignStatistician(requestId: string, statisticianId: string): Promise<void> {
    await this.updateRequestStatus(requestId, 'assigned', { assignedTo: statisticianId });
  },

  async getAssignedTasks(statisticianId: string): Promise<StatServiceRequest[]> {
    const db = await initDB();
    return db.getAllFromIndex('stat_requests', 'by-assignee', statisticianId);
  },

  async getRequestById(id: string): Promise<StatServiceRequest | undefined> {
    const db = await initDB();
    return db.get('stat_requests', id);
  },

  async getAllPayments(): Promise<PaymentRecord[]> {
    const db = await initDB();
    return db.getAll('payments');
  }
};

import { initDB } from '../../../lib/db';
import { generateId } from '../../../core/utils/idUtils';
import { syncService } from '../../../core/services/syncService';
import type { CoachPlayerLink, CoachLinkStatus } from './types';

const STORE = 'coach_player_links';

export const relationshipService = {
  list: async (): Promise<CoachPlayerLink[]> => {
    const db = await initDB();
    return ((await db.getAll(STORE).catch(() => [])) as CoachPlayerLink[]).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  forCoach: async (coachAccountId: string, status?: CoachLinkStatus) => {
    const all = await relationshipService.list();
    return all.filter((l) => l.coachAccountId === coachAccountId && (!status || l.status === status));
  },

  forProfile: async (profileId: string) => {
    const all = await relationshipService.list();
    return all.filter((l) => l.profileId === profileId && l.status === 'active');
  },

  request: async (input: {
    coachAccountId: string;
    coachName: string;
    profileId: string;
    profileName: string;
    specialties: string[];
    requestedByAccountId: string;
    needsGuardianApproval: boolean;
  }): Promise<CoachPlayerLink> => {
    const all = await relationshipService.list();
    if (all.some((l) => l.coachAccountId === input.coachAccountId && l.profileId === input.profileId && (l.status === 'active' || l.status === 'pending'))) {
      throw new Error('Hubungan dengan coach ini sudah ada atau menunggu persetujuan.');
    }
    const now = Date.now();
    const row: CoachPlayerLink = {
      id: generateId('cpl'),
      coachAccountId: input.coachAccountId,
      coachName: input.coachName,
      profileId: input.profileId,
      profileName: input.profileName,
      specialties: input.specialties,
      status: input.needsGuardianApproval ? 'pending' : 'active',
      requestedByAccountId: input.requestedByAccountId,
      guardianApprovedAt: input.needsGuardianApproval ? undefined : now,
      coachAcceptedAt: input.needsGuardianApproval ? undefined : now,
      createdAt: now,
      updatedAt: now,
    };
    const db = await initDB();
    await db.put(STORE, row);
    await syncService.enqueue(STORE, 'UPDATE', row).catch(() => {});
    return row;
  },

  guardianApprove: async (id: string) => {
    const db = await initDB();
    const row = (await db.get(STORE, id)) as CoachPlayerLink | undefined;
    if (!row || row.status !== 'pending') throw new Error('Permintaan tidak ditemukan.');
    const next = { ...row, status: 'active' as const, guardianApprovedAt: Date.now(), coachAcceptedAt: row.coachAcceptedAt || Date.now(), updatedAt: Date.now() };
    await db.put(STORE, next);
    await syncService.enqueue(STORE, 'UPDATE', next).catch(() => {});
    return next;
  },

  declineOrEnd: async (id: string, to: 'declined' | 'ended') => {
    const db = await initDB();
    const row = (await db.get(STORE, id)) as CoachPlayerLink | undefined;
    if (!row) throw new Error('Hubungan tidak ditemukan.');
    const next: CoachPlayerLink = {
      ...row,
      status: to,
      endedAt: to === 'ended' ? Date.now() : row.endedAt,
      updatedAt: Date.now(),
    };
    await db.put(STORE, next);
    await syncService.enqueue(STORE, 'UPDATE', next).catch(() => {});
    return next;
  },

  /** Profile IDs this coach may review. Empty list = no relationship filter yet (legacy open queue). */
  reviewableProfileIds: async (coachAccountId: string): Promise<string[] | null> => {
    const active = await relationshipService.forCoach(coachAccountId, 'active');
    if (!active.length) return null; // ponytail: until coaches build links, keep current queue behavior
    return active.map((l) => l.profileId);
  },
};

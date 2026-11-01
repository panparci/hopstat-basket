import { initDB } from '../../../lib/db';
import { generateId } from '../../../core/utils/idUtils';
import { syncService } from '../../../core/services/syncService';
import type { MatchExclusionRequest } from './types';

const STORE = 'match_exclusion_requests';

export const exclusionService = {
  list: async (): Promise<MatchExclusionRequest[]> => {
    const db = await initDB();
    return (await db.getAll(STORE).catch(() => [])) as MatchExclusionRequest[];
  },

  listForProfile: async (profileId: string) => {
    const all = await exclusionService.list();
    return all.filter((r) => r.profileId === profileId).sort((a, b) => b.createdAt - a.createdAt);
  },

  listPending: async () => {
    const all = await exclusionService.list();
    return all.filter((r) => r.status === 'pending').sort((a, b) => a.createdAt - b.createdAt);
  },

  request: async (input: {
    profileId: string;
    profileName: string;
    matchId: string;
    matchLabel: string;
    reason: string;
    accountId: string;
    accountName: string;
  }): Promise<MatchExclusionRequest> => {
    const db = await initDB();
    const existing = (await db.getAll(STORE).catch(() => [])) as MatchExclusionRequest[];
    if (existing.some((r) => r.profileId === input.profileId && r.matchId === input.matchId && r.status === 'pending')) {
      throw new Error('Pengajuan untuk pertandingan ini sudah menunggu review admin.');
    }
    const now = Date.now();
    const row: MatchExclusionRequest = {
      id: generateId('mex'),
      profileId: input.profileId,
      profileName: input.profileName,
      matchId: input.matchId,
      matchLabel: input.matchLabel,
      reason: input.reason.trim(),
      requestedByAccountId: input.accountId,
      requestedByName: input.accountName,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    await db.put(STORE, row);
    await syncService.enqueue(STORE, 'UPDATE', row).catch(() => {});
    return row;
  },

  /** Approve: unlink match from profile (roster/events → orphan profile stub), do not delete stats. */
  approve: async (id: string, adminId: string, adminNote?: string): Promise<MatchExclusionRequest> => {
    const db = await initDB();
    const row = (await db.get(STORE, id)) as MatchExclusionRequest | undefined;
    if (!row || row.status !== 'pending') throw new Error('Pengajuan tidak ditemukan atau sudah diproses.');

    // Move this match's rosters/events for profileId onto a provisional unclaimed twin so stats are not erased.
    const profiles = await db.getAll('profiles');
    const primary = profiles.find((p: any) => p.id === row.profileId);
    if (!primary) throw new Error('Profil atlet tidak ditemukan.');

    const twinId = generateId('profile');
    const twin = {
      ...primary,
      id: twinId,
      name: `${primary.name} (dipisah ${row.matchLabel.slice(0, 24)})`,
      claimStatus: 'unclaimed',
      links: [],
      guardianAccountIds: [],
      aliases: [primary.name, ...(primary.aliases || [])],
      producedFromRequestId: row.id,
    };
    await db.put('profiles', twin);
    await syncService.enqueue('profiles', 'UPDATE', twin).catch(() => {});

    const rosters = await db.getAll('match_rosters');
    for (const r of rosters.filter((x: any) => x.profileId === row.profileId && x.matchId === row.matchId)) {
      const updated = { ...r, profileId: twinId };
      await db.put('match_rosters', updated);
      await syncService.enqueue('match_rosters', 'UPDATE', updated).catch(() => {});
    }

    const events = await db.getAll('events');
    for (const ev of events) {
      if (ev.matchId !== row.matchId) continue;
      let changed = false;
      const updated = { ...ev };
      if (ev.playerId === row.profileId) {
        updated.playerId = twinId;
        changed = true;
      }
      if (ev.opponentPlayerId === row.profileId) {
        updated.opponentPlayerId = twinId;
        changed = true;
      }
      if (changed) {
        await db.put('events', updated);
        await syncService.enqueue('events', 'UPDATE', updated).catch(() => {});
      }
    }

    const matches = await db.getAll('matches');
    for (const m of matches.filter((x: any) => x.id === row.matchId && x.childId === row.profileId)) {
      const updated = { ...m, childId: twinId };
      await db.put('matches', updated);
      await syncService.enqueue('matches', 'UPDATE', updated).catch(() => {});
    }

    const next: MatchExclusionRequest = {
      ...row,
      status: 'approved',
      adminNote: adminNote?.trim() || undefined,
      reviewedByAccountId: adminId,
      updatedAt: Date.now(),
    };
    await db.put(STORE, next);
    await syncService.enqueue(STORE, 'UPDATE', next).catch(() => {});
    return next;
  },

  reject: async (id: string, adminId: string, adminNote: string): Promise<MatchExclusionRequest> => {
    const db = await initDB();
    const row = (await db.get(STORE, id)) as MatchExclusionRequest | undefined;
    if (!row || row.status !== 'pending') throw new Error('Pengajuan tidak ditemukan atau sudah diproses.');
    if (!adminNote.trim()) throw new Error('Alasan penolakan wajib diisi.');
    const next: MatchExclusionRequest = {
      ...row,
      status: 'rejected',
      adminNote: adminNote.trim(),
      reviewedByAccountId: adminId,
      updatedAt: Date.now(),
    };
    await db.put(STORE, next);
    await syncService.enqueue(STORE, 'UPDATE', next).catch(() => {});
    return next;
  },
};

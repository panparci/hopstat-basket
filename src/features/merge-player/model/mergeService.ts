import { initDB } from '../../../lib/db';
import { ChildProfile, MergeLog } from '../../../core/types/stats';
import { syncService } from '../../../core/services/syncService';
import { generateId } from '../../../core/utils/idUtils';

// Normalisasi & kemiripan nama
export function areNamesSimilar(n1: string, n2: string): boolean {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const s1 = clean(n1);
  const s2 = clean(n2);
  if (s1 === s2) return true;

  const words1 = s1.split(/\s+/).filter(Boolean);
  const words2 = s2.split(/\s+/).filter(Boolean);

  if (words1.length === 0 || words2.length === 0) return false;

  let matchCount = 0;
  const used2 = new Set<number>();

  for (const w1 of words1) {
    for (let i = 0; i < words2.length; i++) {
      if (used2.has(i)) continue;
      const w2 = words2[i];

      // Perfect match
      if (w1 === w2) {
        matchCount++;
        used2.add(i);
        break;
      }

      // Prefix abbreviation match (e.g., "p" matches "panjaitan" or vice versa)
      if ((w1.length === 1 && w2.startsWith(w1)) || (w2.length === 1 && w1.startsWith(w2))) {
        matchCount++;
        used2.add(i);
        break;
      }

      // Name part abbreviation match (e.g. "jon" matches "jonathan")
      if (w1.length >= 3 && w2.length >= 3 && (w1.startsWith(w2) || w2.startsWith(w1))) {
        matchCount++;
        used2.add(i);
        break;
      }
    }
  }

  const minWords = Math.min(words1.length, words2.length);
  if (minWords === 1) {
    return matchCount === 1;
  }
  return matchCount >= minWords;
}

export function areDatesClose(d1?: string, d2?: string): boolean {
  if (!d1 || !d2) return false;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
  
  const diffTime = Math.abs(date1.getTime() - date2.getTime());
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays <= 2; // Same or within 2 days
}

export const mergeService = {
  getPotentialDuplicates: async (): Promise<Array<{ primary: ChildProfile; secondary: ChildProfile; score: number }>> => {
    const db = await initDB();
    const profiles: ChildProfile[] = await db.getAll('profiles');
    const activeProfiles = profiles.filter(p => !p.archived);

    const suggestions: Array<{ primary: ChildProfile; secondary: ChildProfile; score: number }> = [];

    for (let i = 0; i < activeProfiles.length; i++) {
      for (let j = i + 1; j < activeProfiles.length; j++) {
        const p1 = activeProfiles[i];
        const p2 = activeProfiles[j];

        // 1. Must have similar names
        if (!areNamesSimilar(p1.name, p2.name)) continue;

        // 2. Must have close birth dates
        if (!areDatesClose(p1.birthDate, p2.birthDate)) continue;

        // Determine who's primary/secondary based on completeness or alphabetical ID
        const score1 = (p1.avatar ? 2 : 0) + (p1.displayName ? 1 : 0) + (p1.jerseyNumber ? 1 : 0);
        const score2 = (p2.avatar ? 2 : 0) + (p2.displayName ? 1 : 0) + (p2.jerseyNumber ? 1 : 0);

        let primary = p1;
        let secondary = p2;
        if (score2 > score1) {
          primary = p2;
          secondary = p1;
        }

        suggestions.push({
          primary,
          secondary,
          score: 100 // High match score
        });
      }
    }

    return suggestions;
  },

  previewMerge: async (primaryId: string, secondaryId: string) => {
    const db = await initDB();
    const primary = await db.get('profiles', primaryId);
    const secondary = await db.get('profiles', secondaryId);

    if (!primary || !secondary) {
      throw new Error("Profil tidak ditemukan.");
    }

    // Calculate combined statistics preview
    const rosters = await db.getAll('match_rosters');
    const primaryRosters = rosters.filter(r => r.profileId === primaryId);
    const secondaryRosters = rosters.filter(r => r.profileId === secondaryId);

    const primaryMatchIds = new Set(primaryRosters.map(r => r.matchId));
    const secondaryMatchIds = new Set(secondaryRosters.map(r => r.matchId));

    const allMatchIds = new Set([...primaryMatchIds, ...secondaryMatchIds]);

    // Sum total events
    const events = await db.getAll('events');
    const primaryEventsCount = events.filter(e => e.playerId === primaryId).length;
    const secondaryEventsCount = events.filter(e => e.playerId === secondaryId).length;

    return {
      primary,
      secondary,
      stats: {
        primaryMatches: primaryMatchIds.size,
        secondaryMatches: secondaryMatchIds.size,
        combinedMatches: allMatchIds.size,
        primaryEvents: primaryEventsCount,
        secondaryEvents: secondaryEventsCount,
        combinedEvents: primaryEventsCount + secondaryEventsCount,
      }
    };
  },

  executeMerge: async (primaryId: string, secondaryId: string, finalFields: Partial<ChildProfile>): Promise<MergeLog> => {
    const db = await initDB();

    const primary = await db.get('profiles', primaryId);
    const secondary = await db.get('profiles', secondaryId);

    if (!primary || !secondary) {
      throw new Error("Profil tidak ditemukan.");
    }

    // Capture original states for undo
    const previousPrimaryState = JSON.parse(JSON.stringify(primary));
    const previousSecondaryState = JSON.parse(JSON.stringify(secondary));

    // Prepare detailed audit trail for exact undo
    const updatedRosterIds: string[] = [];
    const deletedRosters: any[] = [];
    const reassignedEventIds: string[] = [];
    const eventOriginalFields: { eventId: string; originalPlayerId: string; originalOpponentPlayerId?: string; originalLinkedEntityId?: string }[] = [];
    const stintOriginalPlayerIds: { stintId: string; originalPlayerIds: string[] }[] = [];
    const reassignedClaimRequestIds: string[] = [];
    const reassignedAiInsightIds: string[] = [];

    // 1. Merge and reassign match_rosters
    const rosters = await db.getAll('match_rosters');
    const primaryRosters = rosters.filter(r => r.profileId === primaryId);
    const secondaryRosters = rosters.filter(r => r.profileId === secondaryId);

    let matchRostersReassigned = 0;
    for (const secRoster of secondaryRosters) {
      const matchingPrimaryRoster = primaryRosters.find(r => r.matchId === secRoster.matchId);
      if (matchingPrimaryRoster) {
        deletedRosters.push(JSON.parse(JSON.stringify(secRoster)));
        await db.delete('match_rosters', secRoster.id);
        await syncService.enqueue('match_rosters', 'DELETE', { id: secRoster.id });
      } else {
        const updated = { ...secRoster, profileId: primaryId };
        await db.put('match_rosters', updated);
        await syncService.enqueue('match_rosters', 'UPDATE', updated);
        updatedRosterIds.push(secRoster.id);
        matchRostersReassigned++;
      }
    }

    // 2. Reassign events
    const events = await db.getAll('events');
    let eventsReassigned = 0;

    for (const ev of events) {
      let isChanged = false;
      const originalPlayerId = ev.playerId;
      const originalOpponentPlayerId = ev.opponentPlayerId;
      const originalLinkedEntityId = ev.linkedEntityId;

      const updated = { ...ev };

      if (ev.playerId === secondaryId) {
        updated.playerId = primaryId;
        isChanged = true;
      }
      if (ev.opponentPlayerId === secondaryId) {
        updated.opponentPlayerId = primaryId;
        isChanged = true;
      }
      if (ev.linkedEntityId === secondaryId) {
        updated.linkedEntityId = primaryId;
        isChanged = true;
      }

      if (isChanged) {
        await db.put('events', updated);
        await syncService.enqueue('events', 'UPDATE', updated);
        reassignedEventIds.push(ev.id);
        eventOriginalFields.push({
          eventId: ev.id,
          originalPlayerId,
          originalOpponentPlayerId,
          originalLinkedEntityId
        });
        eventsReassigned++;
      }
    }

    // 3. Reassign match_stints.playerIds[]
    const stints = await db.getAll('match_stints');
    let stintsReassigned = 0;

    for (const stint of stints) {
      if (stint.playerIds && stint.playerIds.includes(secondaryId)) {
        stintOriginalPlayerIds.push({
          stintId: stint.id,
          originalPlayerIds: [...stint.playerIds]
        });

        const newPlayerIds = stint.playerIds.map(id => id === secondaryId ? primaryId : id);
        stint.playerIds = Array.from(new Set(newPlayerIds));

        await db.put('match_stints', stint);
        await syncService.enqueue('match_stints', 'UPDATE', stint);
        stintsReassigned++;
      }
    }

    // 4. Reassign claim_requests.profileId
    const claimRequests = await db.getAll('claim_requests');
    const secClaims = claimRequests.filter(cr => cr.profileId === secondaryId);
    for (const cr of secClaims) {
      const updated = { ...cr, profileId: primaryId };
      await db.put('claim_requests', updated);
      await syncService.enqueue('claim_requests', 'UPDATE', updated);
      reassignedClaimRequestIds.push(cr.id);
    }

    // 5. Reassign ai_insights.targetId
    const insights = await db.getAll('ai_insights');
    const secInsights = insights.filter(i => i.targetId === secondaryId);
    for (const ins of secInsights) {
      const updated = { ...ins, targetId: primaryId };
      await db.put('ai_insights', updated);
      await syncService.enqueue('ai_insights', 'UPDATE', updated);
      reassignedAiInsightIds.push(ins.id);
    }

    // 6. Merge transferHistory
    const combinedTransferHistory = [
      ...(primary.transferHistory || []),
      ...(secondary.transferHistory || [])
    ];
    const uniqueTransferIds = new Set<string>();
    const uniqueTransferHistory = combinedTransferHistory.filter(th => {
      const key = `${th.date}_${th.fromTeamId || ''}_${th.toTeamId}`;
      if (uniqueTransferIds.has(key)) return false;
      uniqueTransferIds.add(key);
      return true;
    });

    // 7. Combine aliases & voiceAliases
    const aliasesUnion = Array.from(new Set([
      ...(primary.aliases || []),
      secondary.name,
      ...(secondary.aliases || [])
    ]));
    const voiceAliasesUnion = Array.from(new Set([
      ...(primary.voiceAliases || []),
      ...(secondary.voiceAliases || [])
    ]));

    // 8. Combine links/guardians
    const mergedLinks = [...(primary.links || [])];
    (secondary.links || []).forEach(secLink => {
      const existing = mergedLinks.find(l => l.accountId === secLink.accountId && l.relationship === secLink.relationship);
      if (!existing) {
        mergedLinks.push(secLink);
      } else if (!existing.verified && secLink.verified) {
        existing.verified = true;
        existing.verifiedAt = secLink.verifiedAt;
      }
    });

    // 9. Combine guardianAccountIds
    const guardianAccountIdsUnion = Array.from(new Set([
      ...(primary.guardianAccountIds || []),
      ...(secondary.guardianAccountIds || [])
    ]));

    // Calculate most verified claimStatus
    const pStatus = primary.claimStatus || 'unclaimed';
    const sStatus = secondary.claimStatus || 'unclaimed';
    let mergedClaimStatus: 'verified' | 'claim_pending' | 'unclaimed' = 'unclaimed';
    if (pStatus === 'verified' || sStatus === 'verified') {
      mergedClaimStatus = 'verified';
    } else if (pStatus === 'claim_pending' || sStatus === 'claim_pending') {
      mergedClaimStatus = 'claim_pending';
    }

    // Update primary profile
    const updatedPrimary: ChildProfile = {
      ...primary,
      ...finalFields,
      claimStatus: mergedClaimStatus,
      transferHistory: uniqueTransferHistory,
      aliases: aliasesUnion,
      voiceAliases: voiceAliasesUnion,
      links: mergedLinks,
      guardianAccountIds: guardianAccountIdsUnion
    };

    // Archive secondary profile
    const updatedSecondary: ChildProfile = {
      ...secondary,
      archived: true,
      mergedIntoId: primaryId
    };

    await db.put('profiles', updatedPrimary);
    await syncService.enqueue('profiles', 'UPDATE', updatedPrimary);

    await db.put('profiles', updatedSecondary);
    await syncService.enqueue('profiles', 'UPDATE', updatedSecondary);

    // Create MergeLog entry
    const logId = generateId('mergelog');
    const log: MergeLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      primaryId,
      secondaryId,
      primaryName: primary.name,
      secondaryName: secondary.name,
      previousPrimaryState,
      previousSecondaryState,
      reassignedCounts: {
        matchRosters: matchRostersReassigned,
        events: eventsReassigned,
        matchStints: stintsReassigned,
        transferHistory: uniqueTransferHistory.length - (primary.transferHistory || []).length
      },
      details: {
        updatedRosterIds,
        deletedRosters,
        reassignedEventIds,
        eventOriginalFields,
        stintOriginalPlayerIds,
        reassignedClaimRequestIds,
        reassignedAiInsightIds
      }
    };

    await db.put('merge_logs', log);
    return log;
  },

  undoMerge: async (logId: string): Promise<void> => {
    const db = await initDB();
    const log = await db.get('merge_logs', logId);
    if (!log) {
      throw new Error("Log merge tidak ditemukan.");
    }

    const { primaryId, secondaryId, previousPrimaryState, previousSecondaryState, details } = log;

    // 1. Revert profiles to previous states
    await db.put('profiles', previousPrimaryState);
    await syncService.enqueue('profiles', 'UPDATE', previousPrimaryState);

    await db.put('profiles', previousSecondaryState);
    await syncService.enqueue('profiles', 'UPDATE', previousSecondaryState);

    // 2. Revert match_rosters updates
    for (const rId of details.updatedRosterIds) {
      const roster = await db.get('match_rosters', rId);
      if (roster) {
        roster.profileId = secondaryId;
        await db.put('match_rosters', roster);
        await syncService.enqueue('match_rosters', 'UPDATE', roster);
      }
    }

    // 3. Restore deleted match_rosters
    for (const r of details.deletedRosters) {
      await db.put('match_rosters', r);
      await syncService.enqueue('match_rosters', 'INSERT', r);
    }

    // 4. Revert events updates
    if (details.eventOriginalFields) {
      for (const item of details.eventOriginalFields) {
        const ev = await db.get('events', item.eventId);
        if (ev) {
          ev.playerId = item.originalPlayerId;
          ev.opponentPlayerId = item.originalOpponentPlayerId;
          ev.linkedEntityId = item.originalLinkedEntityId;
          await db.put('events', ev);
          await syncService.enqueue('events', 'UPDATE', ev);
        }
      }
    } else {
      for (const eId of details.reassignedEventIds) {
        const ev = await db.get('events', eId);
        if (ev) {
          ev.playerId = secondaryId;
          await db.put('events', ev);
          await syncService.enqueue('events', 'UPDATE', ev);
        }
      }
    }

    // 5. Revert match_stints updates
    for (const sChange of details.stintOriginalPlayerIds) {
      const stint = await db.get('match_stints', sChange.stintId);
      if (stint) {
        stint.playerIds = sChange.originalPlayerIds;
        await db.put('match_stints', stint);
        await syncService.enqueue('match_stints', 'UPDATE', stint);
      }
    }

    // 6. Revert claim_requests updates
    for (const crId of details.reassignedClaimRequestIds) {
      const cr = await db.get('claim_requests', crId);
      if (cr) {
        cr.profileId = secondaryId;
        await db.put('claim_requests', cr);
        await syncService.enqueue('claim_requests', 'UPDATE', cr);
      }
    }

    // 7. Revert ai_insights updates
    for (const insId of details.reassignedAiInsightIds) {
      const ins = await db.get('ai_insights', insId);
      if (ins) {
        ins.targetId = secondaryId;
        await db.put('ai_insights', ins);
        await syncService.enqueue('ai_insights', 'UPDATE', ins);
      }
    }

    // Delete the merge log
    await db.delete('merge_logs', logId);
  },

  getMergeLogs: async (): Promise<MergeLog[]> => {
    const db = await initDB();
    const logs = await db.getAll('merge_logs');
    return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
};

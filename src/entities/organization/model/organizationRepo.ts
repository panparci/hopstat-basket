import { createStoreRepo } from '../../../shared/api/storeRepo';
import { Organization } from './types';
import { teamRepo } from '../../team/model/teamRepo';
import { statsService } from '../../../core/services/statsService';
import { formatDivision } from '../../division/model/divisions';
import { Match } from '../../../core/types/stats';

const baseRepo = createStoreRepo<Organization>('organizations');

function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export const organizationRepo = {
  ...baseRepo,

  async create(data: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Organization, 'id'>>): Promise<Organization> {
    // baseRepo.create sets status = 'active'. But Organization status is 'pending' | 'verified' | 'merged'.
    // So we call baseRepo.create, then force the actual status.
    const created = await baseRepo.create(data as any);
    const targetStatus = data.status || 'pending';
    if ((targetStatus as string) !== 'active') {
      return this.update(created.id, { status: targetStatus });
    }
    return created;
  },

  async findSimilar(name: string, city: string): Promise<Organization[]> {
    const all = await this.list();
    const normTargetName = normalizeString(name);
    const normTargetCity = normalizeString(city);

    if (!normTargetName || !normTargetCity) return [];

    return all.filter(org => {
      if (org.status === 'merged') return false;
      
      const normCity = normalizeString(org.city);
      if (normCity !== normTargetCity) return false;

      const normName = normalizeString(org.name);
      return (
        normName === normTargetName ||
        normName.includes(normTargetName) ||
        normTargetName.includes(normName)
      );
    });
  },

  async executeMerge(sourceOrgId: string, targetOrgId: string): Promise<void> {
    const sourceOrg = await this.getById(sourceOrgId);
    const targetOrg = await this.getById(targetOrgId);
    if (!sourceOrg || !targetOrg) {
      throw new Error('Organisasi sumber atau target tidak ditemukan');
    }

    // 1. Mark source organization as merged
    await this.update(sourceOrgId, {
      status: 'merged',
      mergedIntoId: targetOrgId
    });

    // 2. Fetch all teams
    const allTeams = await teamRepo.list();
    const sourceTeams = allTeams.filter(t => t.organizationId === sourceOrgId && t.status !== 'deleted');

    for (const sTeam of sourceTeams) {
      const existingCanonical = await teamRepo.findCanonical(targetOrgId, sTeam.divisionCode || '');

      if (existingCanonical && existingCanonical.id !== sTeam.id) {
        // Automatic team merge
        const mergedRoster = [...(existingCanonical.roster || [])];
        if (sTeam.roster) {
          sTeam.roster.forEach(p => {
            if (!mergedRoster.some(ep => ep.id === p.id || ep.name.toLowerCase() === p.name.toLowerCase())) {
              mergedRoster.push(p);
            }
          });
        }

        await teamRepo.update(existingCanonical.id, {
          roster: mergedRoster
        });

        await teamRepo.update(sTeam.id, {
          status: 'merged' as any,
          mergedIntoId: existingCanonical.id,
          organizationId: targetOrgId
        });

        const matches = await statsService.getMatches();
        const affectedMatches = matches.filter(m => m.teamId === sTeam.id || m.opponentTeamId === sTeam.id);
        for (const match of affectedMatches) {
          const updates: Partial<Match> = {};
          if (match.teamId === sTeam.id) {
            updates.teamId = existingCanonical.id;
            updates.ourTeamName = existingCanonical.name;
          }
          if (match.opponentTeamId === sTeam.id) {
            updates.opponentTeamId = existingCanonical.id;
            updates.theirTeamName = existingCanonical.name;
          }
          await statsService.updateMatch({
            ...match,
            ...updates
          });
        }
      } else {
        // No conflict, just update organizationId
        const divisionCode = sTeam.divisionCode || '';
        const name = `${targetOrg.name} — ${formatDivision(divisionCode)}`;
        await teamRepo.update(sTeam.id, {
          organizationId: targetOrgId,
          clubId: targetOrgId,
          name
        });
      }
    }
  }
};

import { createStoreRepo } from '../../../shared/api/storeRepo';
import { Team, Match } from '../../../core/types/stats';
import { formatDivision } from '../../division/model/divisions';
import { organizationRepo } from '../../organization/model/organizationRepo';
import { statsService } from '../../../core/services/statsService';

const baseRepo = createStoreRepo<Team>('teams');

export const teamRepo = {
  ...baseRepo,

  async findCanonical(organizationId: string, divisionCode: string): Promise<Team | undefined> {
    const all = await this.list();
    return all.find(team => 
      team.organizationId === organizationId && 
      team.divisionCode === divisionCode &&
      team.status !== 'deleted' &&
      !team.mergedIntoId
    );
  },

  async create(data: Omit<Team, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Team, 'id'>>): Promise<Team> {
    let name = data.name;
    if (data.organizationId && data.divisionCode) {
      const org = await organizationRepo.getById(data.organizationId);
      if (org) {
        name = `${org.name} — ${formatDivision(data.divisionCode)}`;
      }
    }
    
    const recordData = {
      ...data,
      name,
      clubId: data.clubId || data.organizationId // support legacy clubId
    };

    return baseRepo.create(recordData as any);
  },

  async executeTeamMerge(sourceTeamId: string, targetTeamId: string): Promise<void> {
    const sTeam = await this.getById(sourceTeamId);
    const tTeam = await this.getById(targetTeamId);
    if (!sTeam || !tTeam) {
      throw new Error('Tim sumber atau target tidak ditemukan');
    }

    const mergedRoster = [...(tTeam.roster || [])];
    if (sTeam.roster) {
      sTeam.roster.forEach(p => {
        if (!mergedRoster.some(ep => ep.id === p.id || ep.name.toLowerCase() === p.name.toLowerCase())) {
          mergedRoster.push(p);
        }
      });
    }

    await this.update(targetTeamId, {
      roster: mergedRoster
    });

    await this.update(sourceTeamId, {
      status: 'merged' as any,
      mergedIntoId: targetTeamId
    });

    const matches = await statsService.getMatches();
    const affectedMatches = matches.filter(m => m.teamId === sourceTeamId || m.opponentTeamId === sourceTeamId);
    for (const match of affectedMatches) {
      const updates: Partial<Match> = {};
      if (match.teamId === sourceTeamId) {
        updates.teamId = targetTeamId;
        updates.ourTeamName = tTeam.name;
      }
      if (match.opponentTeamId === sourceTeamId) {
        updates.opponentTeamId = targetTeamId;
        updates.theirTeamName = tTeam.name;
      }
      await statsService.updateMatch({
        ...match,
        ...updates
      });
    }
  }
};

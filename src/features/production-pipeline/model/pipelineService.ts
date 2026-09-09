import { statsService } from '../../../core/services/statsService';
import { rbacService } from '../../../services/rbacService';
import { Permission } from '../../../core/config/permissions';
import { UserAccount } from '../../../core/types/serviceRequests';
import { Match } from '../../../core/types/stats';

async function checkPermission(user: UserAccount, permission: Permission): Promise<boolean> {
  if (user.role === 'admin') return true;
  const rolePermissionsMap = await rbacService.getRolePermissions();
  const permissions = rolePermissionsMap[user.role] || [];
  return permissions.includes(permission);
}

export const pipelineService = {
  /**
   * Advance match to the next production stage.
   * Rules:
   * - tracking -> qa_review (needs track_match or do_stat_tasks permission)
   * - qa_review -> coach_analysis (needs do_qa_review permission)
   * - coach_analysis -> published (needs do_coach_analysis permission)
   */
  async advanceStage(matchId: string, byUser: UserAccount): Promise<Match> {
    const match = await statsService.getMatch(matchId);
    if (!match) {
      throw new Error('Pertandingan tidak ditemukan.');
    }

    const currentStage = match.productionStage || 'tracking';
    let targetStage: 'tracking' | 'qa_review' | 'coach_analysis' | 'published';
    let requiredPermission: Permission;

    if (currentStage === 'tracking') {
      targetStage = 'qa_review';
      // statistician must have track_match or do_stat_tasks
      const hasTrack = await checkPermission(byUser, 'track_match');
      const hasStat = await checkPermission(byUser, 'do_stat_tasks');
      if (!hasTrack && !hasStat) {
        throw new Error('Anda tidak memiliki hak akses untuk mengirimkan statistik untuk diperiksa QA.');
      }
    } else if (currentStage === 'qa_review') {
      targetStage = 'coach_analysis';
      requiredPermission = 'do_qa_review';
      const hasPerm = await checkPermission(byUser, requiredPermission);
      if (!hasPerm) {
        throw new Error('Anda tidak memiliki hak akses (QA) untuk menyetujui statistik ini.');
      }
    } else if (currentStage === 'coach_analysis') {
      targetStage = 'published';
      requiredPermission = 'do_coach_analysis';
      const hasPerm = await checkPermission(byUser, requiredPermission);
      if (!hasPerm) {
        throw new Error('Anda tidak memiliki hak akses (Coach) untuk mempublikasikan statistik ini.');
      }
      const audit = await statsService.auditMatchIntegrity(matchId);
      match.trustClassification = audit.trustClassification;
      match.healthScore = audit.healthScore;
      if (audit.trustClassification === 'UNRELIABLE' && byUser.role !== 'admin') {
        throw new Error('Data UNRELIABLE tidak dapat dipublikasikan. Perbaiki audit atau minta override admin.');
      }
    } else {
      throw new Error('Pertandingan sudah berada di tahap akhir (Published).');
    }

    // Update match stage and history
    match.productionStage = targetStage;
    if (!match.stageHistory) {
      match.stageHistory = [];
    }

    match.stageHistory.push({
      stage: targetStage,
      byUserId: byUser.id,
      byName: byUser.name,
      at: new Date().toISOString(),
      action: 'advanced',
      note: targetStage === 'published' && match.trustClassification === 'UNRELIABLE' ? 'admin override UNRELIABLE' : undefined,
    });

    await statsService.updateMatch(match);
    return match;
  },

  /**
   * Return match to the previous production stage.
   * Rules:
   * - qa_review -> tracking (needs do_qa_review permission)
   * - coach_analysis -> qa_review (needs do_coach_analysis permission)
   */
  async returnStage(matchId: string, byUser: UserAccount, note?: string): Promise<Match> {
    const match = await statsService.getMatch(matchId);
    if (!match) {
      throw new Error('Pertandingan tidak ditemukan.');
    }

    const currentStage = match.productionStage || 'tracking';
    let targetStage: 'tracking' | 'qa_review' | 'coach_analysis' | 'published';
    let requiredPermission: Permission;

    if (currentStage === 'qa_review') {
      targetStage = 'tracking';
      requiredPermission = 'do_qa_review';
      const hasPerm = await checkPermission(byUser, requiredPermission);
      if (!hasPerm) {
        throw new Error('Anda tidak memiliki hak akses (QA) untuk mengembalikan statistik ke tahap pencatatan.');
      }
    } else if (currentStage === 'coach_analysis') {
      targetStage = 'qa_review';
      requiredPermission = 'do_coach_analysis';
      const hasPerm = await checkPermission(byUser, requiredPermission);
      if (!hasPerm) {
        throw new Error('Anda tidak memiliki hak akses (Coach) untuk mengembalikan statistik ke tahap QA.');
      }
    } else {
      throw new Error('Tahap pertandingan ini tidak dapat dikembalikan.');
    }

    // Update match stage and history
    match.productionStage = targetStage;
    if (!match.stageHistory) {
      match.stageHistory = [];
    }

    match.stageHistory.push({
      stage: targetStage,
      byUserId: byUser.id,
      byName: byUser.name,
      at: new Date().toISOString(),
      action: 'returned',
      note,
    });

    await statsService.updateMatch(match);
    return match;
  },
};

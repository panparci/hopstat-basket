import { AgentRole, AiContextData, AgentInsight } from './types';
import { SkillCoach } from './agents/SkillCoach';
import { ShotAnalyst } from './agents/ShotAnalyst';
import { ProgressAnalyst } from './agents/ProgressAnalyst';
import { TeamAnalyst } from './agents/TeamAnalyst';
import { Strategist } from './agents/Strategist';
import { Scout } from './agents/Scout';
import { DataSummarizer } from './agents/DataSummarizer';

export const aiCoachService = {
  async generateInsight(role: AgentRole, contextData: AiContextData): Promise<AgentInsight | null> {
    switch (role) {
      case 'skill_coach':
        return SkillCoach.generate(contextData);
      case 'shot_analyst':
        return ShotAnalyst.generate(contextData);
      case 'progress_analyst':
        return ProgressAnalyst.generate(contextData);
      case 'team_analyst':
        // Generate summary for team members first to save tokens
        if (contextData.teamMembersStats && contextData.teamMembersStats.length > 0) {
          contextData.teamMembersSummary = await DataSummarizer.summarizeTeamMembers(contextData);
        }
        return TeamAnalyst.generate(contextData);
      case 'strategist':
        return Strategist.generate(contextData);
      case 'scout':
        return Scout.generate(contextData);
      default:
        throw new Error(`Role ${role} tidak dikenali.`);
    }
  }
};

export * from './types';

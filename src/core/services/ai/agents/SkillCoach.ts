import { AiContextData, AgentInsight } from '../types';
import { callGemini } from '../utils';

export const SkillCoach = {
  role: 'skill_coach' as const,
  systemPrompt: "Anda adalah Skill Development Coach tingkat elit NBA. Fokus pada metrik individu pemain (shooting percentages, turnovers, assists). Identifikasi skill spesifik yang perlu dilatih pemain dan sarankan 1-2 drills konkret. Tulis dalam Bahasa Indonesia, pertahankan istilah basket dalam Bahasa Inggris.",
  
  async generate(context: AiContextData): Promise<AgentInsight> {
    let data = `--- Pemain: ${context.player?.name} ---\n`;
    const stats = context.playerStats;
    if (stats) {
      data += `Pertandingan Dimainkan: ${stats.gamesPlayed}\n`;
      data += `Rata-rata: ${(stats.pts / Math.max(1, stats.gamesPlayed)).toFixed(1)} PTS, ${(stats.reb / Math.max(1, stats.gamesPlayed)).toFixed(1)} REB, ${(stats.ast / Math.max(1, stats.gamesPlayed)).toFixed(1)} AST\n`;
      data += `Shooting: FG: ${stats.fgm}/${stats.fga}, 3PT: ${stats.tpm}/${stats.tpa}, FT: ${stats.ftm}/${stats.fta}\n`;
      data += `Lainnya: ${stats.stl} STL, ${stats.blk} BLK, ${stats.to} TO\n`;
      if (stats.turnoverDetails && Object.keys(stats.turnoverDetails).length > 0) {
        data += `Detail Turnover: ${Object.entries(stats.turnoverDetails).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      }
    }

    if (context.events && context.events.length > 0) {
      const playerEvents = context.events.filter(e => e.playerId === context.player?.id);
      const clutchEvents = playerEvents.filter(e => e.isClutch);
      if (clutchEvents.length > 0) {
        let clutchPts = 0;
        let clutchTo = 0;
        clutchEvents.forEach(e => {
          if (e.type === '1pt_make') clutchPts += 1;
          if (e.type === '2pt_make') clutchPts += 2;
          if (e.type === '3pt_make') clutchPts += 3;
          if (e.type === 'to') clutchTo += 1;
        });
        data += `--- Performa Individu di Momen Clutch (Q4, < 5 menit, selisih <= 5 poin) ---\n`;
        data += `Poin: ${clutchPts}\n`;
        data += `Turnover: ${clutchTo}\n\n`;
      }
    }
    
    if (context.previousInsights && context.previousInsights.length > 0) {
      data += `\n--- Wawasan dari AI Agent Lainnya ---\n`;
      context.previousInsights.forEach(insight => {
        data += `[Dari ${insight.role}]: ${insight.title}\n${insight.content}\n\n`;
      });
    }

    return callGemini(this.systemPrompt, data, this.role);
  }
};

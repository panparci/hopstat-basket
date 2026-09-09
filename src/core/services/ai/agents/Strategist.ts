import { AiContextData, AgentInsight } from '../types';
import { callGemini } from '../utils';
import { COMPETITION_GRADE_LABELS, COMPETITION_GRADE_WEIGHTS, CompetitionGrade } from '../../../config/competition';

export const Strategist = {
  role: 'strategist' as const,
  systemPrompt: "Anda adalah In-Game Strategist tingkat elit NBA. Fokus pada game flow, lineup effectiveness, dan tactical adjustments. Sarankan strategi untuk game berikutnya berdasarkan performa terbaru. Tulis dalam Bahasa Indonesia, pertahankan istilah basket dalam Bahasa Inggris.",
  
  async generate(context: AiContextData): Promise<AgentInsight> {
    let data = "";
    if (context.matches && context.matches.length > 0) {
      data += `--- Data Pertandingan ---\n`;
      context.matches.forEach(match => {
        data += `Pertandingan: ${match.name} vs ${match.theirTeamName || 'Lawan'}\n`;
        data += `Tanggal: ${new Date(match.date).toLocaleDateString()}\n`;
        
        const activeKU = match.matchKU !== undefined ? match.matchKU : match.ageCategory;
        if (activeKU !== undefined) {
          data += `Kelompok Umur / KU: KU-${activeKU}\n`;
        }
        if (match.competitionGrade) {
          const compGradeLabel = COMPETITION_GRADE_LABELS[match.competitionGrade as CompetitionGrade] || match.competitionGrade;
          const compGradeWeight = COMPETITION_GRADE_WEIGHTS[match.competitionGrade as CompetitionGrade] || 0;
          data += `Level Kompetisi: ${compGradeLabel} (Bobot Kesulitan: ${compGradeWeight}/6)\n`;
        }
      });
      data += `\n`;
    }
    if (context.teamStats) {
      data += `--- Statistik Tim Kita ---\n`;
      data += `Total: ${context.teamStats.pts} PTS, ${context.teamStats.reb} REB, ${context.teamStats.ast} AST\n`;
      data += `Shooting: FG: ${context.teamStats.fgm}/${context.teamStats.fga}, 3PT: ${context.teamStats.tpm}/${context.teamStats.tpa}\n`;
      data += `Turnovers: ${context.teamStats.to}\n\n`;
    }
    if (context.opponentStats) {
      data += `--- Statistik Lawan ---\n`;
      data += `Total: ${context.opponentStats.pts} PTS, ${context.opponentStats.reb} REB, ${context.opponentStats.ast} AST\n`;
      data += `Shooting: FG: ${context.opponentStats.fgm}/${context.opponentStats.fga}, 3PT: ${context.opponentStats.tpm}/${context.opponentStats.tpa}\n`;
      data += `Turnovers: ${context.opponentStats.to}\n\n`;
    }

    if (context.events && context.events.length > 0) {
      const clutchEvents = context.events.filter(e => e.isClutch);
      if (clutchEvents.length > 0) {
        let clutchPts = 0;
        let clutchTo = 0;
        clutchEvents.forEach(e => {
          if (e.type === '1pt_make') clutchPts += 1;
          if (e.type === '2pt_make') clutchPts += 2;
          if (e.type === '3pt_make') clutchPts += 3;
          if (e.type === 'to') clutchTo += 1;
        });
        data += `--- Performa Clutch (Q4, < 5 menit, selisih <= 5 poin) ---\n`;
        data += `Poin Clutch: ${clutchPts}\n`;
        data += `Turnover Clutch: ${clutchTo}\n\n`;
      }
    }

    if (context.possessions && context.possessions.length > 0) {
      const homePossessions = context.possessions.filter(p => p.teamInPossession === 'home');
      const awayPossessions = context.possessions.filter(p => p.teamInPossession === 'away');
      
      const homePoints = homePossessions.reduce((sum, p) => sum + (p.pointsScored || 0), 0);
      const awayPoints = awayPossessions.reduce((sum, p) => sum + (p.pointsScored || 0), 0);
      
      const homePPP = homePossessions.length > 0 ? (homePoints / homePossessions.length).toFixed(2) : 0;
      const awayPPP = awayPossessions.length > 0 ? (awayPoints / awayPossessions.length).toFixed(2) : 0;
      
      data += `--- Analisa Possession (Pace & Efficiency) ---\n`;
      data += `Tim Kita: ${homePossessions.length} Possessions, ${homePPP} Points Per Possession (PPP)\n`;
      data += `Lawan: ${awayPossessions.length} Possessions, ${awayPPP} Points Per Possession (PPP)\n\n`;
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

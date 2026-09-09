import { AiContextData, AgentInsight } from '../types';
import { callGemini } from '../utils';

export const TeamAnalyst = {
  role: 'team_analyst' as const,
  systemPrompt: "Anda adalah Team Analyst tingkat elit NBA. Fokus pada performa tim secara keseluruhan, offensive/defensive ratings, ball movement, dan team rebounding. Sangat penting untuk menganalisa efisiensi berdasarkan Game Context (Fast break, Transition offense, Half court set, Drive / attack, dll). Identifikasi pola seperti: 'Sering melakukan foul saat Fast break' atau 'Turnover tinggi saat Transition offense'. Tulis dalam Bahasa Indonesia, pertahankan istilah basket dalam Bahasa Inggris.",
  
  async generate(context: AiContextData): Promise<AgentInsight> {
    let data = `--- Tim: ${context.team?.name} ---\n`;
    
    if (context.teamStats) {
      data += `--- Statistik Tim Keseluruhan ---\n`;
      data += `Pertandingan Dimainkan: ${context.teamStats.gamesPlayed}\n`;
      data += `Total: ${context.teamStats.pts} PTS, ${context.teamStats.reb} REB, ${context.teamStats.ast} AST\n`;
      data += `Shooting: FG: ${context.teamStats.fgm}/${context.teamStats.fga}, 3PT: ${context.teamStats.tpm}/${context.teamStats.tpa}, FT: ${context.teamStats.ftm}/${context.teamStats.fta}\n`;
      data += `Turnovers: ${context.teamStats.to}\n`;
      if (context.teamStats.turnoverDetails && Object.keys(context.teamStats.turnoverDetails).length > 0) {
        data += `Detail Turnover: ${Object.entries(context.teamStats.turnoverDetails).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      }
      data += `\n`;
    }
    
    if (context.teamMembersSummary) {
      data += `--- Ringkasan Performa Anggota Tim ---\n`;
      data += `${context.teamMembersSummary}\n\n`;
    }

    if (context.events && context.events.length > 0) {
      const shotEvents = context.events.filter(e => {
        if (['2pt_make', '3pt_make'].includes(e.type)) return true;
        if (['2pt_miss', '3pt_miss'].includes(e.type)) return !e.isShootingFoul;
        return false;
      });
      if (shotEvents.length > 0) {
        data += `--- Team Shot Chart Summary ---\n`;
        shotEvents.forEach(e => {
          const area = e.metadata?.areaName || 'Unknown Area';
          const coords = (e.x !== undefined && e.y !== undefined) ? `(${e.x.toFixed(1)}%, ${e.y.toFixed(1)}%)` : 'N/A';
          data += `- ${e.team === 'home' ? 'Home' : 'Away'} ${e.type.replace('_', ' ').toUpperCase()}: ${area} ${coords}\n`;
        });
        data += `\n`;
      }

      const clutchEvents = context.events.filter(e => e.isClutch);
      if (clutchEvents.length > 0) {
        let clutchPts = 0;
        let clutchTo = 0;
        clutchEvents.forEach(e => {
          if (e.type === '1pt_make') clutchPts += 1;
          if (e.type === '2pt_make') clutchPts += 2;
          if (e.type === '3pt_make') clutchPts += 3;
          if (e.type === 'to') clutchTo += 1;
          
          if (e.assistType) {
            data += `Assist: ${e.assistType} @${e.gameContext || 'N/A'} (Poss: ${e.possession || '?'} | Press: ${e.pressureLevel || '?'} | Reb: ${e.reboundType || '?'})\n`;
          }
          if (e.gameContext && !e.assistType) {
            data += `Event: ${e.type} @${e.gameContext} (Poss: ${e.possession || '?'} | Press: ${e.pressureLevel || '?'} | Reb: ${e.reboundType || '?'})\n`;
          }
        });
        data += `--- Performa Tim di Momen Clutch (Q4, < 5 menit, selisih <= 5 poin) ---\n`;
        data += `Poin: ${clutchPts}\n`;
        data += `Turnover: ${clutchTo}\n\n`;
      }
    }

    if (context.previousInsights && context.previousInsights.length > 0) {
      data += `--- Wawasan dari AI Agent Lainnya ---\n`;
      context.previousInsights.forEach(insight => {
        data += `[Dari ${insight.role}]: ${insight.title}\n${insight.content}\n\n`;
      });
    }

    const prompt = `Berikan analisa mendalam tentang performa tim. Perhatikan efisiensi berdasarkan Game Context, Possession, Pressure Level, dan Rebound Type (bedakan antara offensive foul saat Fast Break sendiri vs defensive foul saat Fast Break lawan, perhatikan juga level pressure saat turnover, dan tipe rebound):\n\n${data}`;
    return callGemini(this.systemPrompt, prompt, this.role);
  }
};

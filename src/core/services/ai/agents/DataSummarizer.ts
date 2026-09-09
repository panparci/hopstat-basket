import { AiContextData } from '../types';
import { callGeminiRaw } from '../utils';

export const DataSummarizer = {
  systemPrompt: "Anda adalah asisten analis data bola basket. Tugas Anda adalah merangkum statistik mentah dari beberapa pemain menjadi ringkasan singkat, padat, dan kaya angka (bullet points) mengenai kekuatan dan kelemahan tiap pemain. Jangan gunakan kalimat panjang. Fokus pada efisiensi shooting, turnover, dan kontribusi utama.",
  
  async summarizeTeamMembers(context: AiContextData): Promise<string> {
    if (!context.teamMembersStats || context.teamMembersStats.length === 0) return "";
    
    let rawData = "Data Pemain:\n";
    context.teamMembersStats.forEach(member => {
      const stats = member.stats;
      rawData += `- ${member.player.name}: ${stats.pts} PTS, ${stats.reb} REB, ${stats.ast} AST, FG: ${stats.fgm}/${stats.fga}, 3PT: ${stats.tpm}/${stats.tpa}, TO: ${stats.to}\n`;
      if (stats.turnoverDetails && Object.keys(stats.turnoverDetails).length > 0) {
        rawData += `  TO Details: ${Object.entries(stats.turnoverDetails).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      }
      // Include context, possession, pressure, and rebound summary if available in events
      const playerEvents = context.events?.filter(e => e.playerId === member.player.id) || [];
      const contexts = playerEvents.reduce((acc: Record<string, number>, e) => {
        const key = `${e.gameContext || 'Unknown'} (${e.possession || '?'})`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      if (Object.keys(contexts).length > 0) {
        rawData += `  Contexts (Possession): ${Object.entries(contexts).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      }
      
      const pressure = playerEvents.filter(e => e.pressureLevel).reduce((acc: Record<string, number>, e) => {
        acc[e.pressureLevel!] = (acc[e.pressureLevel!] || 0) + 1;
        return acc;
      }, {});
      if (Object.keys(pressure).length > 0) {
        rawData += `  Pressure Levels: ${Object.entries(pressure).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      }

      const rebounds = playerEvents.filter(e => e.reboundType).reduce((acc: Record<string, number>, e) => {
        acc[e.reboundType!] = (acc[e.reboundType!] || 0) + 1;
        return acc;
      }, {});
      if (Object.keys(rebounds).length > 0) {
        rawData += `  Rebound Types: ${Object.entries(rebounds).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      }

      const shotAreas = playerEvents.filter(e => e.metadata?.areaName).reduce((acc: Record<string, number>, e) => {
        const area = e.metadata!.areaName!;
        acc[area] = (acc[area] || 0) + 1;
        return acc;
      }, {});
      if (Object.keys(shotAreas).length > 0) {
        rawData += `  Shot Areas: ${Object.entries(shotAreas).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
      }
    });

    const prompt = `Buat ringkasan profil singkat (1-2 kalimat per pemain) berdasarkan data berikut. Perhatikan pola Game Context, Possession, Pressure Level, dan Rebound Type:\n\n${rawData}`;
    return callGeminiRaw(this.systemPrompt, prompt);
  }
};

import { AiContextData, AgentInsight } from '../types';
import { callGemini } from '../utils';

export const ShotAnalyst = {
  role: 'shot_analyst' as const,
  systemPrompt: "Anda adalah Gameplay & Shot Chart Analyst tingkat elit NBA. Fokus pada shooting efficiency, shot selection (misal: terlalu banyak mid-range vs layups/3s), dan scoring trends. Tulis dalam Bahasa Indonesia, pertahankan istilah basket dalam Bahasa Inggris.",
  
  async generate(context: AiContextData): Promise<AgentInsight> {
    let data = `--- Pemain: ${context.player?.name} ---\n`;
    const stats = context.playerStats;
    if (stats) {
      data += `Pertandingan Dimainkan: ${stats.gamesPlayed}\n`;
      data += `Rata-rata: ${(stats.pts / Math.max(1, stats.gamesPlayed)).toFixed(1)} PTS\n`;
      data += `Shooting: FG: ${stats.fgm}/${stats.fga}, 3PT: ${stats.tpm}/${stats.tpa}, FT: ${stats.ftm}/${stats.fta}\n`;
    }

    if (context.events && context.events.length > 0) {
      const playerEvents = context.events.filter(e => e.playerId === context.player?.id);
      const shotEvents = playerEvents.filter(e => {
        if (['2pt_make', '3pt_make'].includes(e.type)) return true;
        if (['2pt_miss', '3pt_miss'].includes(e.type)) return !e.isShootingFoul;
        return false;
      });
      
      if (shotEvents.length > 0) {
        data += `--- Shot Chart Data (Granularity: 0-100%) ---\n`;
        shotEvents.forEach(e => {
          const area = e.metadata?.areaName || 'Unknown Area';
          const coords = (e.x !== undefined && e.y !== undefined) ? `(${e.x.toFixed(1)}%, ${e.y.toFixed(1)}%)` : 'N/A';
          data += `- ${e.type.replace('_', ' ').toUpperCase()}: ${area} ${coords}\n`;
        });
        data += `\n`;
      }

      const clutchEvents = playerEvents.filter(e => e.isClutch);
      if (clutchEvents.length > 0) {
        let clutchFgm = 0, clutchFga = 0, clutch3pm = 0, clutch3pa = 0;
        clutchEvents.forEach(e => {
          let detail = "";
          if (e.shotDifficulty) detail += ` [${e.shotDifficulty}]`;
          if (e.gameContext) detail += ` @${e.gameContext}`;
          
          if (e.type === '2pt_make') { clutchFgm++; clutchFga++; }
          if (e.type === '2pt_miss' && !e.isShootingFoul) { clutchFga++; }
          if (e.type === '3pt_make') { clutchFgm++; clutchFga++; clutch3pm++; clutch3pa++; }
          if (e.type === '3pt_miss' && !e.isShootingFoul) { clutchFga++; clutch3pa++; }
        });
        data += `--- Shooting di Momen Clutch (Q4, < 5 menit, selisih <= 5 poin) ---\n`;
        data += `FG: ${clutchFgm}/${clutchFga}, 3PT: ${clutch3pm}/${clutch3pa}\n\n`;
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

import { AiContextData, AgentInsight } from '../types';
import { callGemini } from '../utils';
import { COMPETITION_GRADE_LABELS, COMPETITION_GRADE_WEIGHTS, CompetitionGrade } from '../../../config/competition';
import { isPlayingUp } from '../../../utils/ageCalculator';

export const ProgressAnalyst = {
  role: 'progress_analyst' as const,
  systemPrompt: "Anda adalah Progress Analyst tingkat elit NBA. Fokus pada perkembangan pemain dari waktu ke waktu (antar pertandingan atau kelompok umur/KU). Analisa tren statistik, identifikasi area yang mengalami peningkatan signifikan, dan area yang stagnan atau menurun. Berikan laporan progress yang komprehensif untuk pemain tersebut. Tulis dalam Bahasa Indonesia, pertahankan istilah basket dalam Bahasa Inggris.",
  
  async generate(context: AiContextData): Promise<AgentInsight> {
    let data = `--- Pemain: ${context.player?.name} ---\n`;
    if (context.player?.birthDate) {
      data += `Tanggal Lahir: ${context.player.birthDate}\n`;
    }
    
    if (context.events && context.events.length > 0) {
      data += `--- Riwayat Pertandingan & Umur ---\n`;
      const matchIds = [...new Set(context.events.map(e => e.matchId))];
      matchIds.forEach(matchId => {
        const matchEvents = context.events!.filter(e => e.matchId === matchId);
        const match = context.matches?.find(m => m.id === matchId);
        if (match && matchEvents.length > 0) {
          const activeKU = match.matchKU !== undefined ? match.matchKU : match.ageCategory;
          const playingStatus = context.player?.birthDate && activeKU !== undefined 
            ? isPlayingUp(context.player.birthDate, match.date, activeKU) 
            : null;
            
          const compGrade = match.competitionGrade;
          const compGradeLabel = compGrade ? COMPETITION_GRADE_LABELS[compGrade as CompetitionGrade] : 'Tidak diketahui';
          const compGradeWeight = compGrade ? COMPETITION_GRADE_WEIGHTS[compGrade as CompetitionGrade] : 0;

          const ageAtMatch = matchEvents[0].playerAgeAtMatch || (activeKU ? `KU-${activeKU}` : null) || match.ageGroup || 'Tidak diketahui';
          data += `Pertandingan: ${match.name} (${new Date(match.date).toLocaleDateString()})\n`;
          data += `Umur/KU saat bertanding: ${ageAtMatch}\n`;
          if (playingStatus) {
            data += `Status Keikutsertaan: ${playingStatus === 'up' ? 'Playing UP (Bermain di atas kelompok usia asli)' : playingStatus === 'down' ? 'Playing DOWN (Bermain di bawah kelompok usia asli)' : 'Sesuai kelompok usia asli'}\n`;
          }
          if (compGrade) {
            data += `Level Kompetisi: ${compGradeLabel} (Bobot Kesulitan: ${compGradeWeight}/6)\n`;
          }
          
          let pts = 0, reb = 0, ast = 0, to = 0;
          matchEvents.forEach(e => {
            if (e.type === '1pt_make') pts += 1;
            if (e.type === '2pt_make') pts += 2;
            if (e.type === '3pt_make') pts += 3;
            if (e.type === 'oreb' || e.type === 'dreb') reb += 1;
            if (e.type === 'ast') ast += 1;
            if (e.type === 'to') to += 1;
          });
          data += `Statistik: ${pts} PTS, ${reb} REB, ${ast} AST, ${to} TO\n\n`;
        }
      });
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

import { initDB } from '../../../lib/db';
import { statsService } from '../../../core/services/statsService';
import { authService } from '../../../services/authService';
import { buildMomentum, MomentumPoint } from '../../../features/match-momentum/model/momentum';
import { filterViewableMatches } from '../../access-control/model/matchAccess';

export interface Highlight {
  matchId: string;
  matchTitle: string;
  coachName: string;
  snippet?: string;
  videoTimestamp?: number;
  momentumPoints: MomentumPoint[];
}

export async function getHighlights(limit = 6): Promise<Highlight[]> {
  try {
    const db = await initDB();
    const user = await authService.getCurrentUser();
    const matches = await statsService.getMatches();
    const profiles = await statsService.getProfiles();
    const rosters = await statsService.getAllMatchRosters();
    const payments = await db.getAll('payments');
    const publishedMatches = filterViewableMatches(
      user,
      matches.filter((m) => m.productionStage === 'published'),
      profiles,
      rosters,
      payments
    );

    if (publishedMatches.length === 0) {
      return [];
    }

    const users = await authService.getAllUsers();
    const highlightsList: Highlight[] = [];

    for (const match of publishedMatches) {
      // Fetch annotations for this match
      const annotations = await db.getAllFromIndex('coach_annotations', 'by-match', match.id);
      const validAnnotations = annotations.filter(a => a.note && a.videoTimestamp !== undefined);

      const events = await statsService.getEvents(match.id);
      const rosters = await statsService.getMatchRosters(match.id);
      const momentumPoints = buildMomentum(events, rosters, match);

      for (const ann of validAnnotations) {
        const coachUser = users.find(u => u.id === ann.coachId);
        const coachName = coachUser ? coachUser.name : 'Coach HoopStats';
        
        highlightsList.push({
          matchId: match.id,
          matchTitle: match.name || 'Pertandingan',
          coachName,
          snippet: ann.note,
          videoTimestamp: ann.videoTimestamp,
          momentumPoints,
        });
      }
    }

    // If no annotations exist across published matches, run fallback
    if (highlightsList.length === 0) {
      // Sort published matches by date descending
      const sortedMatches = [...publishedMatches].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      for (const match of sortedMatches) {
        const events = await statsService.getEvents(match.id);
        const rosters = await statsService.getMatchRosters(match.id);
        const momentumPoints = buildMomentum(events, rosters, match);

        highlightsList.push({
          matchId: match.id,
          matchTitle: match.name || 'Pertandingan',
          coachName: 'Analisis Coach Bersertifikat',
          momentumPoints,
        });
      }
    }

    // Shuffle highlights
    const shuffled = [...highlightsList].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  } catch (error) {
    console.error('Error in getHighlights:', error);
    return [];
  }
}

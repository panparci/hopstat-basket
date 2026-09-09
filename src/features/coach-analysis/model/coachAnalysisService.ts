import { initDB } from '../../../lib/db';
import { CoachAnnotation } from '../../../entities/coach-annotation/model/types';
import { syncService } from '../../../core/services/syncService';

export const coachAnalysisService = {
  getAnnotationsByMatch: async (matchId: string): Promise<CoachAnnotation[]> => {
    const db = await initDB();
    return db.getAllFromIndex('coach_annotations', 'by-match', matchId);
  },

  getAnnotationsByTarget: async (targetId: string): Promise<CoachAnnotation[]> => {
    const db = await initDB();
    return db.getAllFromIndex('coach_annotations', 'by-target', targetId);
  },

  createAnnotation: async (annotation: CoachAnnotation): Promise<void> => {
    const db = await initDB();
    await db.put('coach_annotations', annotation);
    try {
      await syncService.enqueue('coach_annotations', 'INSERT', annotation);
    } catch (e) {
      console.warn('Sync queue failed for coach_annotation insertion:', e);
    }
  },

  updateAnnotation: async (annotation: CoachAnnotation): Promise<void> => {
    const db = await initDB();
    await db.put('coach_annotations', annotation);
    try {
      await syncService.enqueue('coach_annotations', 'UPDATE', annotation);
    } catch (e) {
      console.warn('Sync queue failed for coach_annotation update:', e);
    }
  },

  deleteAnnotation: async (id: string): Promise<void> => {
    const db = await initDB();
    await db.delete('coach_annotations', id);
    try {
      await syncService.enqueue('coach_annotations', 'DELETE', { id });
    } catch (e) {
      console.warn('Sync queue failed for coach_annotation deletion:', e);
    }
  }
};

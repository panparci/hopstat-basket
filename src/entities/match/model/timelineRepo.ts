import { createStoreRepo, BaseEntity } from '../../../shared/api/storeRepo';
import { ClockTimeline } from '../../../features/automatic-clock-mapping/types';
import { initDB } from '../../../lib/db';

export interface TimelineEntity extends Omit<ClockTimeline, 'createdAt' | 'updatedAt' | 'id' | 'status'>, BaseEntity {
  createdAt?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'active' | 'deleted' | string;
}

export const timelineRepo = {
  ...createStoreRepo<TimelineEntity>('timelines'),
  
  async findByMatchId(matchId: string): Promise<TimelineEntity | undefined> {
    const db = await initDB();
    const timelines = await db.getAllFromIndex('timelines', 'by-match', matchId);
    return timelines.filter(t => t.status !== 'deleted').sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())[0];
  },

  async findByVideoId(videoId: string): Promise<TimelineEntity | undefined> {
    const db = await initDB();
    const timelines = await db.getAllFromIndex('timelines', 'by-video', videoId);
    return timelines.filter(t => t.status !== 'deleted').sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())[0];
  }
};

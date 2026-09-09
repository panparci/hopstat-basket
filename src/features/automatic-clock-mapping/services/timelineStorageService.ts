import { ClockTimeline, QuarterMarker } from "../types";
import { timelineRepo } from "../../../entities/match/model/timelineRepo";

export class TimelineStorageService {
  public static async saveQuarterMarkers(matchId: string, markers: QuarterMarker[], _videoId?: string): Promise<void> {
    try {
      const existing = await timelineRepo.findByMatchId(matchId);
      if (existing) {
        await timelineRepo.update(existing.id, { quarterMarkers: markers });
      }
    } catch (err) {
      console.error("Failed to save quarter markers:", err);
    }
  }

  public static async loadQuarterMarkers(matchId: string, videoId?: string): Promise<QuarterMarker[] | null> {
    try {
      const existing = videoId ? await timelineRepo.findByVideoId(videoId) : await timelineRepo.findByMatchId(matchId);
      return existing?.quarterMarkers ?? null;
    } catch (err) {
      console.error("Failed to load quarter markers:", err);
      return null;
    }
  }

  public static async saveDraftTimeline(matchId: string, timeline: ClockTimeline): Promise<void> {
    try {
      const updatedTimeline: ClockTimeline = {
        ...timeline,
        matchId,
        updatedAt: new Date().toISOString(),
      };

      const existing = timeline.videoId
        ? await timelineRepo.findByVideoId(timeline.videoId)
        : await timelineRepo.findByMatchId(matchId);

      if (existing) {
        await timelineRepo.update(existing.id, updatedTimeline);
      } else {
        await timelineRepo.create({
          ...updatedTimeline,
          id: updatedTimeline.id || `timeline-${matchId}-${Date.now()}`,
        });
      }

      window.dispatchEvent(
        new CustomEvent("timeline-updated", {
          detail: { matchId, videoId: timeline.videoId, timeline: updatedTimeline },
        })
      );
    } catch (err) {
      console.error("Failed to save draft timeline:", err);
    }
  }

  public static async loadTimeline(matchId: string, videoId?: string): Promise<ClockTimeline | null> {
    try {
      const parsed = videoId
        ? await timelineRepo.findByVideoId(videoId)
        : await timelineRepo.findByMatchId(matchId);
      if (!parsed) return null;
      if (parsed.matchId !== matchId) {
        parsed.matchId = matchId;
      }
      return parsed as ClockTimeline;
    } catch (err) {
      console.error("Failed to load timeline:", err);
      return null;
    }
  }

  public static async publishTimeline(matchId: string, timeline: ClockTimeline): Promise<ClockTimeline> {
    const now = new Date().toISOString();
    const published: ClockTimeline = {
      ...timeline,
      matchId,
      status: "PUBLISHED",
      version: 1,
      updatedAt: now,
      publishedAt: now,
    };
    try {
      const existing = timeline.videoId
        ? await timelineRepo.findByVideoId(timeline.videoId)
        : await timelineRepo.findByMatchId(matchId);
      if (existing) {
        await timelineRepo.update(existing.id, published);
      } else {
        await timelineRepo.create({
          ...published,
          id: published.id || `timeline-${matchId}-${Date.now()}`,
        });
      }

      window.dispatchEvent(
        new CustomEvent("timeline-published", {
          detail: { matchId, videoId: timeline.videoId, timeline: published },
        })
      );
      window.dispatchEvent(
        new CustomEvent("timeline-updated", {
          detail: { matchId, videoId: timeline.videoId, timeline: published },
        })
      );
    } catch (err) {
      console.error("Failed to publish timeline:", err);
    }
    return published;
  }

  public static async deleteTimeline(matchId: string, videoId?: string): Promise<void> {
    try {
      const existing = videoId
        ? await timelineRepo.findByVideoId(videoId)
        : await timelineRepo.findByMatchId(matchId);
      if (existing) {
        await timelineRepo.softDelete(existing.id);
      }
    } catch (err) {
      console.error("Failed to delete timeline:", err);
    }
  }

  public static async clearAllTimelineData(
    matchId: string,
    videoId?: string,
    keepQuarterAndRegion: boolean = false
  ): Promise<void> {
    try {
      const existing = videoId
        ? await timelineRepo.findByVideoId(videoId)
        : await timelineRepo.findByMatchId(matchId);
      if (existing) {
        if (!keepQuarterAndRegion) {
          await timelineRepo.softDelete(existing.id);
        } else {
          await timelineRepo.update(existing.id, {
            rawScanPoints: [],
            derivedSegments: [],
            clockStateMarkers: [],
            status: "DRAFT",
          });
        }
      }
    } catch (err) {
      console.error("Failed to clear timeline data:", err);
    }
  }
}

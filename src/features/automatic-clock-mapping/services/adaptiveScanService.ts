import { YouTubePlayer } from "react-youtube";
import {
  RawClockScanPoint,
  QuarterMarker,
  NormalizedClockRegion,
  ScanConfig,
  ScanProgressState,
} from "../types";
import { AdaptivePipelineService } from "./adaptivePipelineService";

export type { ScanProgressState };

export type ScanCallbacks = {
  onProgress: (progress: ScanProgressState) => void;
  onPointCaptured: (point: RawClockScanPoint) => void;
  onComplete: (points: RawClockScanPoint[]) => void;
  onError: (err: string) => void;
  onAbortInvalidRegion?: (message: string, validRatioPercent: number) => void;
};

export class AdaptiveScanController {
  private pipelineService: AdaptivePipelineService = new AdaptivePipelineService();
  private pointsMap = new Map<string, RawClockScanPoint>();

  public pause() {
    this.pipelineService.pause();
  }

  public resume() {
    this.pipelineService.resume();
  }

  public cancel() {
    this.pipelineService.cancel();
  }

  public getIsPaused() {
    return this.pipelineService.getIsPaused();
  }

  public getIsCancelled() {
    return this.pipelineService.getIsCancelled();
  }

  public setExistingPoints(points: RawClockScanPoint[]) {
    this.pointsMap.clear();
    for (const pt of points) {
      const key = `${pt.quarter}_${Math.round(pt.videoTimeSeconds)}`;
      this.pointsMap.set(key, pt);
    }
  }

  public getCapturedPoints(): RawClockScanPoint[] {
    return Array.from(this.pointsMap.values()).sort(
      (a, b) => a.quarter - b.quarter || a.videoTimeSeconds - b.videoTimeSeconds
    );
  }

  public async runFullAdaptiveScan(
    player: YouTubePlayer,
    videoEl: HTMLVideoElement,
    region: NormalizedClockRegion,
    altRegion: NormalizedClockRegion | null | undefined,
    ytTimerRegion: NormalizedClockRegion | null | undefined,
    quarterMarkers: QuarterMarker[],
    config: ScanConfig,
    callbacks: ScanCallbacks
  ): Promise<RawClockScanPoint[]> {
    return this.pipelineService.runPipeline(
      player,
      videoEl,
      region,
      altRegion,
      ytTimerRegion,
      quarterMarkers,
      config,
      {
        onProgress: callbacks.onProgress,
        onPointCaptured: (pt) => {
          const key = `${pt.quarter}_${Math.round(pt.videoTimeSeconds)}`;
          this.pointsMap.set(key, pt);
          callbacks.onPointCaptured(pt);
        },
        onComplete: callbacks.onComplete,
        onError: callbacks.onError,
        onAbortInvalidRegion: (msg, validRatioPercent) => {
          if (callbacks.onAbortInvalidRegion) {
            callbacks.onAbortInvalidRegion(msg, validRatioPercent);
          }
        },
      }
    );
  }
}

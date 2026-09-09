import { ParsedClockCandidate } from '../../automatic-clock-mapping/types';

export type NormalizedClockRegion = {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
};

export type ClockOCRResult = {
  rawText: string;
  normalizedText: string | null;
  milliseconds: number | null;
  confidence: number;
  isValid: boolean;
  selectedCandidate?: ParsedClockCandidate | null;
};

export type ClockSyncPoint = {
  id: string;
  gameId: string;
  period: number;
  videoTimeSeconds: number;
  previousGameClockMs: number;
  syncedGameClockMs: number;
  capturedAt: string;
  confidence: number | null;
  source: "OCR_CONFIRMED" | "MANUAL_CORRECTION";
  captureRegion: NormalizedClockRegion;
  rawOCRText?: string;
  createdBy?: string;
};

export type VisualClockSyncStatus =
  | "IDLE"
  | "REQUESTING_CAPTURE"
  | "CAPTURE_ACTIVE"
  | "CALIBRATING"
  | "READY"
  | "SCANNING"
  | "REVIEWING_RESULT"
  | "CAPTURE_ENDED"
  | "ERROR";

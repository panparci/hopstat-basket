export type NormalizedClockRegion = {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
};

export type QuarterMarker = {
  quarter: number; // 1, 2, 3, 4, 5 (OT1), 6 (OT2)...
  videoStartSeconds: number;
  videoEndSeconds: number;
  initialGameClockMs: number; // e.g. 10:00 = 600,000ms
};

export type ScanInterval = 30 | 5 | 1;

export type ScanPointStatus =
  | "VALID"
  | "LOW_CONFIDENCE"
  | "INVALID"
  | "POSSIBLE_REPLAY"
  | "UNRESOLVED";

export type ClockFormatState =
  | "STANDARD_MINUTES_SECONDS"
  | "UNDER_ONE_MINUTE_DECIMAL"
  | "UNKNOWN";

export type ClockFormatCandidateType = "MM_SS" | "SS_T" | "SS" | "UNKNOWN";

export type ParsedClockCandidate = {
  gameClockMs: number;
  format: ClockFormatCandidateType;
  probability: number;
  reasoningFlags: string[];
};

export type RawClockScanPoint = {
  id: string;
  quarter: number;
  videoTimeSeconds: number;
  detectedGameClockMs: number | null;
  confidence: number;
  source?: "AUTO" | "MANUAL";
  rawOCRText: string;
  normalizedOCRText: string | null;
  scanIntervalSeconds: ScanInterval;
  status: ScanPointStatus;
  rawCropUrl?: string;
  processedCropUrl?: string;
  primaryCropUrl?: string;
  primaryProcessedUrl?: string;
  altCropUrl?: string;
  altProcessedUrl?: string;
  selectedRegionType?: "PRIMARY" | "ALT";
  primaryRawOCRText?: string;
  altRawOCRText?: string;
  primaryGameClockMs?: number | null;
  altGameClockMs?: number | null;
  ytTimerCropUrl?: string;
  ytTimerProcessedUrl?: string;
  ytTimerRawOCRText?: string;
  ytTimerOcrSeconds?: number | null;
  rejectionReason?: string;
  selectedCandidate?: ParsedClockCandidate | null;
  formatState?: ClockFormatState;
};

export type ClockState = "RUNNING" | "STOPPED" | "UNRESOLVED";

export type TimelineSegmentSource =
  | "AUTO"
  | "AUTO_REFINED"
  | "MANUAL"
  | "MANUAL_CORRECTION";

export type ClockTimelineSegment = {
  id: string;
  quarter: number;
  videoStartSeconds: number;
  videoEndSeconds: number;
  gameClockStartMs: number;
  gameClockEndMs: number;
  clockState: ClockState;
  confidence: number;
  source: TimelineSegmentSource;
  slope?: number;
  intercept?: number;
};

export type ClockTimelineStatus =
  | "DRAFT"
  | "SCANNING"
  | "REVIEW_REQUIRED"
  | "READY_TO_PUBLISH"
  | "PUBLISHED"
  | "FAILED";

export type MappingMode = "ASSISTED" | "AUTO_WITH_REVIEW";

export type ScanConfig = {
  engine?: "OFFLINE_OCR" | "AI_VISION"; // default "OFFLINE_OCR"
  coarseIntervalSeconds: number; // default 30
  mediumIntervalSeconds: number; // default 5
  fineIntervalSeconds: number; // default 1
  minOCRConfidence: number; // default 60
  stabilizationDelayMs: number; // default 500
  maxRefinementAttempts: number; // default 3
  allowedClockDeltaToleranceSec: number; // default 2
};

export type IssueType =
  | "INVALID_OCR"
  | "LOW_CONFIDENCE"
  | "MISSING_SCAN"
  | "POSSIBLE_REPLAY"
  | "UNEXPECTED_CLOCK_INCREASE"
  | "INCONSISTENT_COUNTDOWN"
  | "UNRESOLVED_TRANSITION"
  | "SEGMENT_GAP"
  | "QUARTER_BOUNDARY_INCONSISTENCY";

export type MandatoryReviewIssue = {
  id: string;
  type: IssueType;
  quarter: number;
  videoTimeSeconds: number;
  message: string;
  relatedPointIds?: string[];
  relatedSegmentIds?: string[];
  resolved: boolean;
};

export type ClockStateMarker = {
  id: string;
  quarter: number;
  videoTimeSeconds: number;
  gameClockMs: number;
  action: "START_CLOCK" | "STOP_CLOCK";
  source: TimelineSegmentSource;
  confidence: number;
};

export type ClockTimeline = {
  id: string;
  matchId: string;
  videoId?: string;
  quarterMarkers: QuarterMarker[];
  clockRegion: NormalizedClockRegion;
  altClockRegion?: NormalizedClockRegion | null;
  ytTimerRegion?: NormalizedClockRegion | null;
  rawScanPoints: RawClockScanPoint[];
  derivedSegments: ClockTimelineSegment[];
  clockStateMarkers?: ClockStateMarker[];
  scanConfig: ScanConfig;
  status: ClockTimelineStatus;
  mode: MappingMode;
  version: number;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  publishedAt?: string;
  publishedBy?: string;
};

export type PipelineStageStatus =
  | "IDLE"
  | "SCANNING_COARSE"
  | "FAST_CAPTURE"
  | "PARALLEL_OCR"
  | "REGION_VALIDATION"
  | "AI_FALLBACK"
  | "FINE_SCRUBBING"
  | "REFINING_MEDIUM"
  | "REFINING_FINE"
  | "ABORTED_INVALID_REGION"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"
  | "ERROR";

export type ScanProgressState = {
  status: PipelineStageStatus;
  stage?: 1 | 2 | 3 | 4 | 5;
  currentQuarter: number;
  totalQuarters: number;
  completedScanPointsCount: number;
  totalEstimatedPointsCount: number;
  suspiciousIntervalsCount: number;
  currentVideoTime: number;
  errorMessage?: string;
  capturedCount?: number;
  processedOcrCount?: number;
  validOcrCount?: number;
  invalidCount?: number;
  aiRecoveredCount?: number;
  validRatioPercent?: number;
  abortMessage?: string;
};

export type EventTimelineMetadata = {
  mappedGameClockMs: number;
  mappedGameClockString: string;
  quarter: number;
  timelineSegmentId: string;
  timelineVersion: number;
  clockConfidence: number;
  mappingSource: TimelineSegmentSource;
  isUnresolvedEstimate?: boolean;
  youtubeTimeSeconds?: number;
  clockState?: ClockState;
  prevTrustedPointMs?: number | null;
  nextTrustedPointMs?: number | null;
  isInterpolated?: boolean;
  isManuallyCorrected?: boolean;
};

import type { OverdueQueryResult } from './session-schedule';

/**
 * Lane classification: distinguishes primary progressive overload training
 * ('main') from supplementary/feeder/cardio/mobility sessions ('accessory').
 */
export type LaneType = 'main' | 'accessory';

/**
 * Confidence level of lane classification.
 */
export type LaneClassificationConfidence = 'explicit' | 'inferred';

/**
 * Metadata result of classifying a routine or session into a training lane.
 */
export interface LaneClassification {
  lane: LaneType;
  confidence: LaneClassificationConfidence;
  reason: string;
  routineId?: number | null;
  tag?: string | null;
}

/**
 * Input for lane classification evaluation.
 */
export interface ClassifyLaneInput {
  sessionId?: number | null;
  routineId?: number | null;
  routineName?: string | null;
  folder?: string | null;
  tags?: string[] | null;
  isProgramSession?: boolean | null;
  explicitLane?: LaneType | null;
}

/**
 * High-level drift status code.
 */
export type DriftStatusCode = 'on_track' | 'drifting' | 'lapsed';

/**
 * Contract status for main-lane training cadence.
 * Consumes planned-vs-performed gap semantics from Issue #95.
 */
export interface DriftStatus {
  status: DriftStatusCode;
  daysSinceLastMain: number;
  thresholdDays: number;
  lapsedThresholdDays?: number;
  overdueSessionsCount?: number;
  lastMainSessionAt?: number | null;
  evaluatedAt?: number;
}

/**
 * Default threshold in days without a main-lane session before entering 'drifting' state.
 * Owner-tunable constant.
 */
export const DEFAULT_DRIFT_THRESHOLD_DAYS = 4;

/**
 * Default threshold in days without a main-lane session before entering 'lapsed' state.
 * Owner-tunable constant.
 */
export const DEFAULT_LAPSED_THRESHOLD_DAYS = 14;

/**
 * Tunable threshold configuration for drift detection.
 */
export interface DriftThresholdConfig {
  driftThresholdDays?: number;
  lapsedThresholdDays?: number;
}

/**
 * Summary of a performed session relevant for drift analysis.
 */
export interface PerformedSessionSummary {
  sessionId: number;
  startTime: number;
  endTime?: number | null;
  lane: LaneType;
}

/**
 * Input to compute drift status for main-lane training.
 */
export interface ComputeDriftStatusInput {
  now?: number;
  lastMainSessionAt?: number | null;
  performedSessions?: PerformedSessionSummary[];
  overdueSessions?: OverdueQueryResult[];
  thresholds?: DriftThresholdConfig;
}

/**
 * Recommended course of action for resuming training.
 * Strictly non-clinical, training-trend advisory only.
 */
export type ReentryAction =
  | 'maintain_cadence'
  | 'resume_normal'
  | 'reduce_volume'
  | 'ramp_up';

/**
 * Pure function advisory plan for re-entering main-lane training.
 * Hard invariant: advisoryOnly = true, NEVER blocks logging.
 */
export interface ReentryGuidance {
  action: ReentryAction;
  volumeScaleFactor: number; // e.g. 1.0 (normal) to 0.65 (ramp-up)
  intensityScaleFactor: number; // e.g. 1.0 (normal) to 0.85 (ramp-up load)
  recommendedWorkingSetsMultiplier?: number;
  daysSinceLastMain: number;
  status: DriftStatusCode;
  advisoryOnly: true; // Hard architectural guarantee: never prevents user from logging
  summary: string; // Informational trend language only, zero clinical/injury wording
  notes?: string[];
}

/**
 * Input to build advisory re-entry guidance.
 */
export interface BuildReentryGuidanceInput {
  driftStatus: DriftStatus;
  thresholds?: DriftThresholdConfig;
}

/**
 * Classifies a session or routine into main vs accessory lane.
 * THROWING STUB: throws per project convention for Issue #67 contract.
 */
export function classifyLane(_input: ClassifyLaneInput): LaneClassification {
  throw new Error('lane drift not implemented yet (issue #67 core slice)');
}

/**
 * Computes drift status for main-lane sessions based on schedule and performance history.
 * THROWING STUB: throws per project convention for Issue #67 contract.
 */
export function computeDriftStatus(_input: ComputeDriftStatusInput): DriftStatus {
  throw new Error('lane drift not implemented yet (issue #67 core slice)');
}

/**
 * Builds advisory re-entry guidance based on current drift status.
 * Pure function output; advisory only; never blocks workout logging.
 * THROWING STUB: throws per project convention for Issue #67 contract.
 */
export function buildReentryGuidance(_input: BuildReentryGuidanceInput): ReentryGuidance {
  throw new Error('lane drift not implemented yet (issue #67 core slice)');
}

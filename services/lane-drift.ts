import type { OverdueQueryResult } from './session-schedule';
import { routines } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

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
 * Reference to routine configuration for lane classification.
 */
export interface RoutineLaneRef {
  id?: number | null;
  name?: string | null;
  isMainLane?: boolean | null;
}

/**
 * Input for lane classification evaluation.
 * Owner decision (2026-10-06): lane classification is a boolean flag on the routine (`isMainLane`).
 * Sessions inherit from their routine. No per-session choice, no heuristic.
 * Freestyle sessions (no routine) are accessory by definition.
 */
export interface ClassifyLaneInput {
  sessionId?: number | null;
  routineId?: number | null;
  routineName?: string | null;
  isMainLane?: boolean | null;
  routine?: RoutineLaneRef | null;
  folder?: string | null;
  tags?: string[] | null;
  isProgramSession?: boolean | null;
  explicitLane?: LaneType | null;
}

/**
 * High-level drift status code.
 * Includes 'insufficient-data' when no main-lane sessions exist in history.
 */
export type DriftStatusCode =
  | 'on_track'
  | 'drifting'
  | 'lapsed'
  | 'insufficient-data'
  | 'insufficient_data';

/**
 * Contract status for main-lane training cadence.
 * Consumes planned-vs-performed gap semantics from Issue #95.
 */
export interface DriftStatus {
  status: DriftStatusCode;
  daysSinceLastMain: number | null;
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
 * Default multiplier applied to driftThresholdDays to calculate lapsedThresholdDays
 * when lapsedThresholdDays is not explicitly configured and a custom threshold is used.
 * Owner decision: pick 2x and document as tunable.
 */
export const DEFAULT_LAPSED_MULTIPLIER = 2;

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
  lane?: LaneType;
  isMainLane?: boolean;
  routine?: RoutineLaneRef | null;
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
  thresholdDays?: number;
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
  volumeScaleFactor: number; // e.g. 1.0 (normal) to 0.50 (floor for extended hiatus)
  intensityScaleFactor: number; // e.g. 1.0 (normal) to 0.85 (ramp-up load)
  recommendedWorkingSetsMultiplier?: number;
  daysSinceLastMain: number | null;
  status: DriftStatusCode;
  advisoryOnly: true; // Hard architectural guarantee: never prevents user from logging
  summary: string; // Informational trend language only, zero clinical/injury wording
  notes?: string[];
}

/**
 * Input to build advisory re-entry guidance.
 */
export interface BuildReentryGuidanceInput {
  driftStatus?: DriftStatus;
  gapDays?: number | null;
  thresholds?: DriftThresholdConfig;
}

/**
 * Classifies a session or routine into main vs accessory lane.
 *
 * Owner decision (2026-10-06):
 * - Lane classification is solely determined by the `isMainLane` flag on the routine (default false).
 * - Sessions inherit from their routine (no per-session choice, no folder/tag heuristics).
 * - Freestyle sessions (no routine associated) are NOT main-lane; classified as accessory.
 */
export function classifyLane(input?: ClassifyLaneInput | null): LaneClassification {
  if (!input) {
    return {
      lane: 'accessory',
      confidence: 'explicit',
      reason: 'Freestyle session (no routine) defaults to accessory lane',
      routineId: null,
    };
  }

  // A session is freestyle if it has neither routineId nor routine object
  const hasRoutine = input.routineId != null || Boolean(input.routine);
  if (!hasRoutine) {
    return {
      lane: 'accessory',
      confidence: 'explicit',
      reason: 'Freestyle session (no routine) defaults to accessory lane',
      routineId: null,
    };
  }

  const routineId = input.routineId ?? input.routine?.id ?? null;
  const isMain = input.isMainLane === true || input.routine?.isMainLane === true;

  if (isMain) {
    return {
      lane: 'main',
      confidence: 'explicit',
      reason: 'Routine configured with isMainLane=true',
      routineId,
    };
  }

  return {
    lane: 'accessory',
    confidence: 'explicit',
    reason: 'Routine configured with isMainLane=false (default: accessory)',
    routineId,
  };
}

/**
 * Computes drift status for main-lane sessions based on schedule and performance history.
 * Supports both object input (ComputeDriftStatusInput) and positional arguments (history, thresholdDays).
 */
export function computeDriftStatus(
  input: ComputeDriftStatusInput
): DriftStatus;
export function computeDriftStatus(
  history:
    | PerformedSessionSummary[]
    | Array<{
        startTime: number;
        lane?: LaneType;
        isMainLane?: boolean;
        routine?: RoutineLaneRef | null;
      }>,
  thresholdDays?: number | DriftThresholdConfig,
  options?: {
    now?: number;
    overdueSessions?: OverdueQueryResult[];
    lapsedThresholdDays?: number;
  }
): DriftStatus;
export function computeDriftStatus(
  inputOrHistory:
    | ComputeDriftStatusInput
    | PerformedSessionSummary[]
    | Array<{
        startTime: number;
        lane?: LaneType;
        isMainLane?: boolean;
        routine?: RoutineLaneRef | null;
      }>,
  thresholdDaysArg?: number | DriftThresholdConfig,
  options?: {
    now?: number;
    overdueSessions?: OverdueQueryResult[];
    lapsedThresholdDays?: number;
  }
): DriftStatus {
  let now: number;
  let driftThreshold: number;
  let lapsedThreshold: number;
  let overdueCount = 0;
  let lastMainSessionAt: number | null = null;
  let historySessions: Array<{
    startTime: number;
    lane?: LaneType;
    isMainLane?: boolean;
    routine?: RoutineLaneRef | null;
  }> = [];

  if (Array.isArray(inputOrHistory)) {
    historySessions = inputOrHistory;
    if (typeof thresholdDaysArg === 'number') {
      driftThreshold = thresholdDaysArg;
      lapsedThreshold =
        options?.lapsedThresholdDays ?? driftThreshold * DEFAULT_LAPSED_MULTIPLIER;
    } else if (typeof thresholdDaysArg === 'object' && thresholdDaysArg !== null) {
      driftThreshold =
        thresholdDaysArg.driftThresholdDays ?? DEFAULT_DRIFT_THRESHOLD_DAYS;
      lapsedThreshold =
        thresholdDaysArg.lapsedThresholdDays ??
        (driftThreshold === DEFAULT_DRIFT_THRESHOLD_DAYS
          ? DEFAULT_LAPSED_THRESHOLD_DAYS
          : driftThreshold * DEFAULT_LAPSED_MULTIPLIER);
    } else {
      driftThreshold = DEFAULT_DRIFT_THRESHOLD_DAYS;
      lapsedThreshold =
        options?.lapsedThresholdDays ?? DEFAULT_LAPSED_THRESHOLD_DAYS;
    }
    now = options?.now ?? Date.now();
    overdueCount = options?.overdueSessions?.length ?? 0;
  } else {
    const input = inputOrHistory ?? {};
    historySessions = input.performedSessions ?? [];
    if (input.thresholds?.driftThresholdDays != null) {
      driftThreshold = input.thresholds.driftThresholdDays;
    } else if (typeof input.thresholdDays === 'number') {
      driftThreshold = input.thresholdDays;
    } else {
      driftThreshold = DEFAULT_DRIFT_THRESHOLD_DAYS;
    }

    if (input.thresholds?.lapsedThresholdDays != null) {
      lapsedThreshold = input.thresholds.lapsedThresholdDays;
    } else if (driftThreshold === DEFAULT_DRIFT_THRESHOLD_DAYS) {
      lapsedThreshold = DEFAULT_LAPSED_THRESHOLD_DAYS;
    } else {
      lapsedThreshold = driftThreshold * DEFAULT_LAPSED_MULTIPLIER;
    }

    now = input.now ?? Date.now();
    overdueCount = input.overdueSessions?.length ?? 0;
    lastMainSessionAt = input.lastMainSessionAt ?? null;
  }

  // Filter main-lane sessions from history
  const mainTimestamps: number[] = [];
  for (const session of historySessions) {
    const isMain =
      session.lane === 'main' ||
      session.isMainLane === true ||
      session.routine?.isMainLane === true;
    if (isMain && typeof session.startTime === 'number') {
      mainTimestamps.push(session.startTime);
    }
  }

  let effectiveLastMainAt: number | null = null;
  if (mainTimestamps.length > 0) {
    const maxFromHistory = Math.max(...mainTimestamps);
    effectiveLastMainAt =
      lastMainSessionAt != null
        ? Math.max(lastMainSessionAt, maxFromHistory)
        : maxFromHistory;
  } else {
    effectiveLastMainAt = lastMainSessionAt;
  }

  // Insufficient data when no main-lane sessions exist at all
  if (effectiveLastMainAt == null) {
    return {
      status: 'insufficient-data',
      daysSinceLastMain: null,
      thresholdDays: driftThreshold,
      lapsedThresholdDays: lapsedThreshold,
      overdueSessionsCount: overdueCount,
      lastMainSessionAt: null,
      evaluatedAt: now,
    };
  }

  const nowMs = now < 1e11 ? now * 1000 : now;
  const lastMainMs =
    effectiveLastMainAt < 1e11
      ? effectiveLastMainAt * 1000
      : effectiveLastMainAt;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const diffMs = nowMs - lastMainMs;
  const daysSinceLastMain = Math.max(0, Math.floor(diffMs / MS_PER_DAY));

  let status: DriftStatusCode;
  if (daysSinceLastMain <= driftThreshold) {
    status = 'on_track';
  } else if (daysSinceLastMain >= lapsedThreshold) {
    status = 'lapsed';
  } else {
    status = 'drifting';
  }

  return {
    status,
    daysSinceLastMain,
    thresholdDays: driftThreshold,
    lapsedThresholdDays: lapsedThreshold,
    overdueSessionsCount: overdueCount,
    lastMainSessionAt: effectiveLastMainAt,
    evaluatedAt: now,
  };
}

/**
 * Builds advisory re-entry guidance based on current drift status or gap in days.
 * Pure function output; advisory only; never blocks workout logging.
 */
export function buildReentryGuidance(
  input: BuildReentryGuidanceInput
): ReentryGuidance;
export function buildReentryGuidance(
  gapDays: number | null,
  options?: { thresholds?: DriftThresholdConfig; status?: DriftStatusCode }
): ReentryGuidance;
export function buildReentryGuidance(
  inputOrGapDays: BuildReentryGuidanceInput | number | null,
  options?: { thresholds?: DriftThresholdConfig; status?: DriftStatusCode }
): ReentryGuidance {
  let gap: number | null;
  let driftThreshold = DEFAULT_DRIFT_THRESHOLD_DAYS;
  let lapsedThreshold = DEFAULT_LAPSED_THRESHOLD_DAYS;
  let statusHint: DriftStatusCode | undefined;

  if (typeof inputOrGapDays === 'number' || inputOrGapDays === null) {
    gap = inputOrGapDays;
    driftThreshold =
      options?.thresholds?.driftThresholdDays ?? DEFAULT_DRIFT_THRESHOLD_DAYS;
    lapsedThreshold =
      options?.thresholds?.lapsedThresholdDays ??
      (driftThreshold === DEFAULT_DRIFT_THRESHOLD_DAYS
        ? DEFAULT_LAPSED_THRESHOLD_DAYS
        : driftThreshold * DEFAULT_LAPSED_MULTIPLIER);
    statusHint = options?.status;
  } else {
    const input = inputOrGapDays ?? {};
    gap =
      input.driftStatus?.daysSinceLastMain !== undefined
        ? input.driftStatus.daysSinceLastMain
        : (input.gapDays ?? null);
    driftThreshold =
      input.thresholds?.driftThresholdDays ??
      input.driftStatus?.thresholdDays ??
      DEFAULT_DRIFT_THRESHOLD_DAYS;
    lapsedThreshold =
      input.thresholds?.lapsedThresholdDays ??
      input.driftStatus?.lapsedThresholdDays ??
      (driftThreshold === DEFAULT_DRIFT_THRESHOLD_DAYS
        ? DEFAULT_LAPSED_THRESHOLD_DAYS
        : driftThreshold * DEFAULT_LAPSED_MULTIPLIER);
    statusHint = input.driftStatus?.status;
  }

  if (
    gap == null ||
    statusHint === 'insufficient-data' ||
    statusHint === 'insufficient_data'
  ) {
    return {
      action: 'resume_normal',
      volumeScaleFactor: 1.0,
      intensityScaleFactor: 1.0,
      daysSinceLastMain: null,
      status: 'insufficient-data',
      advisoryOnly: true,
      summary:
        'No previous main-lane sessions recorded; proceed with baseline schedule.',
      notes: [
        'Log your first main-lane session to establish training cadence.',
      ],
    };
  }

  if (gap <= driftThreshold) {
    return {
      action: 'resume_normal',
      volumeScaleFactor: 1.0,
      intensityScaleFactor: 1.0,
      daysSinceLastMain: gap,
      status: 'on_track',
      advisoryOnly: true,
      summary: 'Training cadence on track. Resume scheduled session volume.',
      notes: ['Maintain scheduled working sets and load progression.'],
    };
  }

  if (gap < lapsedThreshold) {
    if (gap <= 7) {
      return {
        action: 'reduce_volume',
        volumeScaleFactor: 0.85,
        intensityScaleFactor: 1.0,
        recommendedWorkingSetsMultiplier: 0.85,
        daysSinceLastMain: gap,
        status: 'drifting',
        advisoryOnly: true,
        summary:
          '5-7 day cadence gap. Consider dropping 1 working set per exercise to manage acute fatigue while maintaining target loads.',
        notes: [
          'Moderate volume reduction advised for the first session back.',
        ],
      };
    }
    return {
      action: 'reduce_volume',
      volumeScaleFactor: 0.75,
      intensityScaleFactor: 0.9,
      recommendedWorkingSetsMultiplier: 0.75,
      daysSinceLastMain: gap,
      status: 'drifting',
      advisoryOnly: true,
      summary:
        '8-13 day training gap. Reduce total working volume by ~25% and leave 2-3 reps in reserve (RIR) to rebuild work capacity.',
      notes: [
        'Reduce working sets by ~25% and focus on movement quality.',
      ],
    };
  }

  // gap >= lapsedThreshold
  // Scaled down after long gaps, respecting hard floor of >= 0.50
  const weeksBeyondLapsed = Math.floor((gap - lapsedThreshold) / 7);
  const rawVolumeScale = 0.65 - weeksBeyondLapsed * 0.05;
  const volumeScaleFactor = Math.max(0.5, Number(rawVolumeScale.toFixed(2)));

  return {
    action: 'ramp_up',
    volumeScaleFactor,
    intensityScaleFactor: 0.85,
    recommendedWorkingSetsMultiplier: volumeScaleFactor,
    daysSinceLastMain: gap,
    status: 'lapsed',
    advisoryOnly: true,
    summary: `Extended hiatus (${lapsedThreshold}+ days). Progressive ramp-up advised: start at ~${Math.round(
      volumeScaleFactor * 100
    )}% volume and acclimation loads for session 1.`,
    notes: [
      'Progressive ramp-up advised: start at reduced volume and acclimation loads to reacclimate work capacity.',
    ],
  };
}

/**
 * Updates the isMainLane flag for a routine in the database.
 * Sets routines.isMainLane = flag for the specified routineId.
 */
export async function setRoutineMainLane(
  routineId: number,
  flag: boolean,
  database?: any
): Promise<void> {
  const targetDb = database ?? (await import('@/src/db/client')).db;
  await targetDb
    .update(routines)
    .set({ isMainLane: flag })
    .where(eq(routines.id, routineId));
}

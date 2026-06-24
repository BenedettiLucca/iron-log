/**
 * Iron Log — Central Type Definitions
 * Derived from src/db/schema.ts
 */

// ---------------------------------------------------------------------------
// Enums / Unions
// ---------------------------------------------------------------------------

export type ExerciseType = 'strength' | 'duration';
export type BioMetricType = 'daily' | 'monthly';
export type MeasurementGoalType = 'weight' | 'waist' | 'armRight' | 'thighRight' | 'chest' | 'calf';
export type RecordType = 'weight' | 'reps' | 'volume' | 'duration';
export type Sex = 'M' | 'F' | 'O';
export type ProgramGoal = 'hypertrophy' | 'strength' | 'endurance' | 'deload';
export type ProgramPhase = 'accumulation' | 'intensification' | 'deload';
export type SupplementFrequency = 'daily' | 'training_days' | 'rest_days';

// ---------------------------------------------------------------------------
// Inferred DB Types (Drizzle)
// ---------------------------------------------------------------------------

import type { sessions, sets, exercises, routines, routineExercises, bodyMetrics, userSettings, notificationSettings, measurementGoals, personalRecords, supplements, supplementLogs, programs, programWeeks, programExerciseTargets } from '@/src/db/schema';

export type Session = typeof sessions.$inferSelect;
export type Set = typeof sets.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type BodyMetric = typeof bodyMetrics.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type NotificationConfig = typeof notificationSettings.$inferSelect;
export type MeasurementGoal = typeof measurementGoals.$inferSelect;
export type PersonalRecord = typeof personalRecords.$inferSelect;
export type Supplement = Omit<typeof supplements.$inferSelect, 'frequency'> & {
  frequency: SupplementFrequency;
};
export type SupplementLog = typeof supplementLogs.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type ProgramWeek = typeof programWeeks.$inferSelect;
export type ProgramExerciseTarget = Omit<typeof programExerciseTargets.$inferSelect, 'exerciseName'> & {
  exerciseName?: string;
};

// ---------------------------------------------------------------------------
// UI / Domain Types
// ---------------------------------------------------------------------------

export interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface DialogState {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type?: 'default' | 'destructive';
}

export interface SessionContext {
  sessionId: number;
  routineId: number | null;
  routineName: string;
  exerciseId?: number;
  exerciseName?: string;
  target?: string | null;
  notes?: string | null;
  restSeconds?: number | null;
  startTime?: number;
}

export interface ExerciseSummary {
  name: string;
  sets: Set[];
  exId: number;
  target?: string;
}

export interface SessionStats {
  totalSets: number;
  totalVolume: number;
  bestSet: { weight: number; reps: number; exercise: string } | null;
  averageIntensity: number;
}

export interface NoteTemplate {
  label: string;
  emoji: string;
  text: string;
}

// Double Progression status for an exercise
export interface DoubleProgressionStatus {
  exerciseId: number;
  exerciseName: string;
  targetRepsMin: number;
  targetRepsMax: number;
  targetSets: number;
  lastPerformance: {
    weight: number;
    reps: number;
    sets: number;
  } | null;
  isAtTop: boolean; // All sets hit targetRepsMax → suggest load increase
  trend: 'up' | 'flat' | 'down';
}

export interface KeyLift {
  exerciseId: number;
  name: string;
  trend: 'up' | 'flat' | 'down';
  currentWeight: number;
  history: { week: number; maxWeight: number }[];
}

export type WeekCompletionStatus = 'done' | 'missed' | 'deload' | 'future';

export interface ProgramDashboardData {
  weeklyVolume: number;
  avgWeeklyVolume: number;
  avgSRPE: number | null;
  keyLifts: KeyLift[];
  weekCompletionMap: Map<number, WeekCompletionStatus>;
}

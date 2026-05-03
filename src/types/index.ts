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
// Core Entities
// ---------------------------------------------------------------------------

export interface Routine {
  id: number;
  name: string;
  description: string | null;
  folder: string | null;
  isTemplate: boolean;
}

export interface Exercise {
  id: number;
  name: string;
  type: ExerciseType;
  defaultRestSeconds: number | null;
}

export interface RoutineExercise {
  routineId: number | null;
  exerciseId: number | null;
  orderIndex: number | null;
  target: string | null;      // e.g. "3x8-12"
  notes: string | null;
  restSeconds: number | null;
}

export interface Session {
  id: number;
  routineId: number | null;
  routineName: string | null;
  startTime: number;
  endTime: number | null;
  bodyWeight: number | null;
  sRpe: number | null;
  notes: string | null;
  durationMinutes: number | null;
  deletedAt: number | null;
}

export interface Set {
  id: number;
  sessionId: number;
  exerciseId: number;
  exerciseName: string | null;
  setNumber: number;
  weightKg: number;
  reps: number;
  durationSeconds: number | null;
  rir: number | null;
  isWarmup: boolean;
  isEdited: boolean;
  createdAt: number | null;
  deletedAt: number | null;
}

export interface BodyMetric {
  id: number;
  date: number;
  type: BioMetricType | null;
  weight: number | null;
  waist: number | null;
  armRight: number | null;
  thighRight: number | null;
  chest: number | null;
  calf: number | null;
  photoFront: string | null;
  photoBack: string | null;
  photoSide: string | null;
  photoNotes: string | null;
}

export interface UserSettings {
  id: number;
  defaultWeight: number | null;
  height: number | null;
  sex: Sex | null;
}

export interface NotificationConfig {
  id: number;
  checkinDay: number;
  checkinHour: number;
  enabled: boolean;
  lastNotificationDate: number | null;
}

export interface MeasurementGoal {
  id: number;
  type: MeasurementGoalType;
  targetValue: number;
  startDate: number;
  targetDate: number;
  achieved: boolean;
  achievedDate: number | null;
}

export interface PersonalRecord {
  id: number;
  exerciseId: number;
  sessionId: number | null;
  recordType: RecordType;
  value: number;
  date: number;
  setDetails: string | null; // JSON string
}

export interface Supplement {
  id: number;
  name: string;
  dosage: string;
  timing: string;
  frequency: SupplementFrequency;
  reminderTime: string | null;
  isNighttime: boolean;
  emoji: string | null;
  orderIndex: number;
  isActive: boolean;
}

export interface SupplementLog {
  id: number;
  supplementId: number;
  date: number;
  takenAt: number;
}

// ---------------------------------------------------------------------------
// Program / Periodization Types
// ---------------------------------------------------------------------------

export interface Program {
  id: number;
  name: string;
  description: string | null;
  startDate: number;
  endDate: number;
  weeksDuration: number;
  deloadWeek: number | null;
  goal: ProgramGoal;
  isActive: boolean;
  createdAt: number | null;
}

export interface ProgramWeek {
  id: number;
  programId: number;
  weekNumber: number;
  routineId: number | null;
  phase: ProgramPhase;
  rirTarget: number | null;
  intensityMod: number | null;
}

export interface ProgramExerciseTarget {
  id: number;
  programId: number;
  exerciseId: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetSets: number;
}

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

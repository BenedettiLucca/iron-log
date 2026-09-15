export type TrackerType = 'strong' | 'hevy' | 'fitnotes';

export interface ImportResult {
  success: boolean;
  tracker?: TrackerType;
  sessionsCreated: number;
  setsImported: number;
  customExercisesCreated: number;
  skippedSessions: number;
  collisionsDetected?: number;
  error?: string;
}

export interface ParsedSetRow {
  exerciseName: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  durationSeconds?: number | null;
  rir?: number | null;
  isWarmup?: boolean;
  notes?: string | null;
}

export interface ParsedSessionGroup {
  routineName?: string | null;
  startTime: number;
  endTime?: number | null;
  durationMinutes?: number | null;
  notes?: string | null;
  bodyWeight?: number | null;
  sRpe?: number | null;
  sets: ParsedSetRow[];
}

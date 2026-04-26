// Tests for AlexandriaExportService pure functions
// Re-implemented locally to avoid importing the service (which depends on expo/DB)
// Same pattern as csv-export.test.ts and analytics.test.ts

// ---------------------------------------------------------------------------
// Re-implement pure functions from services/AlexandriaExportService.ts
// ---------------------------------------------------------------------------

function formatEpochISO(epoch: number | null): string | null {
  if (!epoch) return null;
  return new Date(epoch).toISOString();
}

function formatEpochDate(epoch: number | null): string | null {
  if (!epoch) return null;
  const d = new Date(epoch);
  return d.toISOString().split('T')[0];
}

function computeWorkoutType(exerciseTypes: string[]): string {
  const hasCardio = exerciseTypes.includes('duration');
  const hasStrength = exerciseTypes.includes('strength');
  if (hasCardio && hasStrength) return 'other';
  if (hasCardio) return 'cardio';
  return 'strength';
}

function computeVolume(
  sessionSets: { weightKg: number; reps: number; isWarmup: boolean }[]
): number {
  return sessionSets
    .filter(s => !s.isWarmup)
    .reduce((sum, s) => sum + (s.weightKg || 0) * (s.reps || 0), 0);
}

function computeDurationSeconds(
  startTime: number | null,
  endTime: number | null,
  durationMinutes: number | null
): number | null {
  if (startTime && endTime && endTime > startTime) {
    return Math.round((endTime - startTime) / 1000);
  }
  if (durationMinutes) {
    return durationMinutes * 60;
  }
  return null;
}

interface AlexandriaSession {
  external_id: string;
  workout_date: string;
  workout_type: string;
  name: string;
  exercises: {
    name: string;
    sets: {
      set_number: number;
      weight_kg: number | null;
      reps: number | null;
      duration_s: number | null;
      rir: number | null;
      is_warmup: boolean;
    }[];
  }[];
  duration_s: number | null;
  volume_kg: number | null;
  rpe: number | null;
  notes: string | null;
  tags: string[];
  metadata: {
    routine_id: number | null;
    routine_name: string | null;
    body_weight: number | null;
    set_count: number;
  };
}

function buildSessionRecord(
  session: {
    id: number;
    routineId: number | null;
    routineName: string | null;
    startTime: number;
    endTime: number | null;
    durationMinutes: number | null;
    bodyWeight: number | null;
    sRpe: number | null;
    notes: string | null;
  },
  sessionSets: {
    exerciseName: string | null;
    exerciseId: number;
    setNumber: number;
    weightKg: number;
    reps: number;
    durationSeconds: number | null;
    rir: number | null;
    isWarmup: boolean;
  }[],
  exerciseTypes: Map<number, string>,
  routineName: string | null
): AlexandriaSession {
  const byExercise = new Map<string, {
    name: string;
    sets: AlexandriaSession['exercises'][0]['sets'];
  }>();

  for (const s of sessionSets) {
    const name = s.exerciseName || 'Unknown';
    if (!byExercise.has(name)) {
      byExercise.set(name, { name, sets: [] });
    }
    byExercise.get(name)!.sets.push({
      set_number: s.setNumber,
      weight_kg: s.weightKg,
      reps: s.reps,
      duration_s: s.durationSeconds,
      rir: s.rir,
      is_warmup: s.isWarmup,
    });
  }

  const uniqueExerciseTypes = [...new Set(
    sessionSets.map(s => exerciseTypes.get(s.exerciseId) || 'strength')
  )];
  const workoutType = computeWorkoutType(uniqueExerciseTypes);
  const volume = computeVolume(sessionSets);
  const duration = computeDurationSeconds(
    session.startTime, session.endTime, session.durationMinutes
  );

  return {
    external_id: `session-${session.id}`,
    workout_date: formatEpochDate(session.startTime) || '',
    workout_type: workoutType,
    name: routineName || session.notes || 'Workout',
    exercises: [...byExercise.values()],
    duration_s: duration,
    volume_kg: Math.round(volume * 100) / 100 || null,
    rpe: session.sRpe ?? null,
    notes: session.notes,
    tags: ['iron-log', workoutType],
    metadata: {
      routine_id: session.routineId ?? null,
      routine_name: routineName ?? null,
      body_weight: session.bodyWeight ?? null,
      set_count: sessionSets.length,
    },
  };
}

function buildMetricRecord(
  metric: {
    id: number;
    date: number;
    weight: number | null;
    waist: number | null;
    armRight: number | null;
    thighRight: number | null;
    chest: number | null;
    calf: number | null;
    type: string | null;
  }
): { weight?: any; body_composition?: any } {
  const result: { weight?: any; body_composition?: any } = {};
  const ts = formatEpochISO(metric.date);
  const extId = `metric-${metric.date}`;

  if (metric.weight) {
    result.weight = {
      external_id: extId,
      entry_type: 'weight',
      timestamp: ts || '',
      numeric_value: metric.weight,
      value: { weight_kg: metric.weight },
      source: 'iron-log',
      tags: ['iron-log'],
    };
  }

  if (metric.waist || metric.armRight || metric.thighRight || metric.chest || metric.calf) {
    const measurements: Record<string, number> = {};
    if (metric.waist) measurements.waist = metric.waist;
    if (metric.armRight) measurements.arm_right = metric.armRight;
    if (metric.thighRight) measurements.thigh_right = metric.thighRight;
    if (metric.chest) measurements.chest = metric.chest;
    if (metric.calf) measurements.calf = metric.calf;

    result.body_composition = {
      external_id: `${extId}-measurements`,
      entry_type: 'body_composition',
      timestamp: ts || '',
      numeric_value: metric.weight ?? null,
      value: measurements,
      source: 'iron-log',
      tags: ['iron-log', 'body-measurements'],
    };
  }

  return result;
}

function buildPRRecord(
  pr: {
    id: number;
    exerciseId: number;
    exerciseName: string;
    recordType: string;
    value: number;
    weightKg: number | null;
    reps: number | null;
    estimated1RM: number | null;
    date: number;
  }
) {
  return {
    external_id: `pr-${pr.recordType}-${pr.id}`,
    exercise_name: pr.exerciseName,
    record_type: pr.recordType,
    value: pr.value,
    weight_kg: pr.weightKg,
    reps: pr.reps,
    estimated_1rm: pr.estimated1RM,
    date: formatEpochISO(pr.date) || '',
  };
}

function buildGoalRecord(
  goal: {
    id: number;
    type: string;
    targetValue: number;
    startDate: number;
    targetDate: number;
    achieved: boolean;
  }
) {
  return {
    external_id: `goal-${goal.type}-${goal.id}`,
    type: goal.type,
    target_value: goal.targetValue,
    start_date: formatEpochISO(goal.startDate) || '',
    target_date: formatEpochISO(goal.targetDate) || '',
    achieved: goal.achieved,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AlexandriaExportService \u2014 pure functions', () => {

  // =========================================================================
  describe('formatEpochISO', () => {
    it('returns null for null', () => {
      expect(formatEpochISO(null)).toBeNull();
    });

    it('returns null for 0 (falsy)', () => {
      expect(formatEpochISO(0)).toBeNull();
    });

    it('formats a known epoch to ISO string', () => {
      const result = formatEpochISO(1700000000000);
      expect(result).toBe('2023-11-14T22:13:20.000Z');
    });

    it('includes timezone Z suffix', () => {
      const result = formatEpochISO(1714000000000);
      expect(result).toMatch(/Z$/);
    });
  });

  // =========================================================================
  describe('formatEpochDate', () => {
    it('returns null for null', () => {
      expect(formatEpochDate(null)).toBeNull();
    });

    it('returns YYYY-MM-DD format', () => {
      const result = formatEpochDate(1700000000000);
      expect(result).toBe('2023-11-14');
    });

    it('pads single-digit months and days', () => {
      const epoch = new Date(2025, 0, 5).getTime();
      const result = formatEpochDate(epoch);
      expect(result).toBe('2025-01-05');
    });
  });

  // =========================================================================
  describe('computeWorkoutType', () => {
    it('returns "strength" for strength only', () => {
      expect(computeWorkoutType(['strength', 'strength'])).toBe('strength');
    });

    it('returns "cardio" for duration only', () => {
      expect(computeWorkoutType(['duration'])).toBe('cardio');
    });

    it('returns "other" for mixed', () => {
      expect(computeWorkoutType(['strength', 'duration'])).toBe('other');
    });

    it('returns "strength" for empty array', () => {
      expect(computeWorkoutType([])).toBe('strength');
    });

    it('returns "other" regardless of order', () => {
      expect(computeWorkoutType(['duration', 'strength'])).toBe('other');
    });
  });

  // =========================================================================
  describe('computeVolume', () => {
    it('returns 0 for empty array', () => {
      expect(computeVolume([])).toBe(0);
    });

    it('calculates total volume excluding warmup sets', () => {
      const sets = [
        { weightKg: 60, reps: 10, isWarmup: true },
        { weightKg: 80, reps: 5, isWarmup: false },
        { weightKg: 80, reps: 5, isWarmup: false },
        { weightKg: 40, reps: 8, isWarmup: false },
      ];
      expect(computeVolume(sets)).toBe(1120);
    });

    it('returns 0 if all sets are warmup', () => {
      const sets = [
        { weightKg: 40, reps: 10, isWarmup: true },
        { weightKg: 60, reps: 5, isWarmup: true },
      ];
      expect(computeVolume(sets)).toBe(0);
    });

    it('handles zero weight/reps gracefully', () => {
      const sets = [
        { weightKg: 0, reps: 10, isWarmup: false },
        { weightKg: 100, reps: 0, isWarmup: false },
      ];
      expect(computeVolume(sets)).toBe(0);
    });
  });

  // =========================================================================
  describe('computeDurationSeconds', () => {
    it('calculates from start and end timestamps', () => {
      const result = computeDurationSeconds(1700000000000, 1700003600000, null);
      expect(result).toBe(3600);
    });

    it('falls back to durationMinutes * 60', () => {
      const result = computeDurationSeconds(null, null, 45);
      expect(result).toBe(2700);
    });

    it('prefers timestamps over durationMinutes', () => {
      const result = computeDurationSeconds(1700000000000, 1700003600000, 45);
      expect(result).toBe(3600);
    });

    it('returns null when all inputs are null', () => {
      expect(computeDurationSeconds(null, null, null)).toBeNull();
    });

    it('returns null when endTime <= startTime', () => {
      expect(computeDurationSeconds(1700003600000, 1700000000000, null)).toBeNull();
      expect(computeDurationSeconds(1700000000000, 1700000000000, null)).toBeNull();
    });
  });

  // =========================================================================
  describe('buildSessionRecord', () => {
    const mockSession = {
      id: 42,
      routineId: 1,
      routineName: 'Push Day',
      startTime: 1700000000000,
      endTime: 1700003600000,
      durationMinutes: null as number | null,
      bodyWeight: 80.5,
      sRpe: 8 as number | null,
      notes: 'Bom treino' as string | null,
    };

    const mockSets = [
      { exerciseName: 'Supino Reto', exerciseId: 1, setNumber: 1, weightKg: 80, reps: 5, durationSeconds: null as number | null, rir: 1 as number | null, isWarmup: false },
      { exerciseName: 'Supino Reto', exerciseId: 1, setNumber: 2, weightKg: 80, reps: 5, durationSeconds: null as number | null, rir: 0 as number | null, isWarmup: false },
      { exerciseName: 'OHP', exerciseId: 2, setNumber: 1, weightKg: 40, reps: 8, durationSeconds: null as number | null, rir: 2 as number | null, isWarmup: false },
    ];

    const exerciseTypes = new Map([
      [1, 'strength'],
      [2, 'strength'],
    ]);

    it('builds correct external_id', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.external_id).toBe('session-42');
    });

    it('formats workout_date as YYYY-MM-DD', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.workout_date).toBe('2023-11-14');
    });

    it('computes workout_type from exercise types', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.workout_type).toBe('strength');
    });

    it('uses routine name as session name', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.name).toBe('Push Day');
    });

    it('groups sets by exercise name', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.exercises).toHaveLength(2);
      const bench = result.exercises.find(e => e.name === 'Supino Reto');
      expect(bench?.sets).toHaveLength(2);
    });

    it('computes volume excluding warmups', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.volume_kg).toBe(1120);
    });

    it('includes metadata with routine info', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.metadata.routine_id).toBe(1);
      expect(result.metadata.routine_name).toBe('Push Day');
      expect(result.metadata.body_weight).toBe(80.5);
      expect(result.metadata.set_count).toBe(3);
    });

    it('handles empty sets', () => {
      const result = buildSessionRecord(mockSession, [], exerciseTypes, 'Push Day');
      expect(result.exercises).toHaveLength(0);
      expect(result.volume_kg).toBeNull();
      expect(result.metadata.set_count).toBe(0);
    });

    it('handles mixed strength + cardio exercises', () => {
      const mixedTypes = new Map([[1, 'strength'], [2, 'duration']]);
      const result = buildSessionRecord(mockSession, mockSets, mixedTypes, 'Full Body');
      expect(result.workout_type).toBe('other');
    });

    it('tags include iron-log and workout type', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.tags).toContain('iron-log');
      expect(result.tags).toContain('strength');
    });

    it('falls back to notes when no routine name', () => {
      const noName = { ...mockSession, routineName: null };
      const result = buildSessionRecord(noName, mockSets, exerciseTypes, null);
      expect(result.name).toBe('Bom treino');
    });
  });

  // =========================================================================
  describe('buildMetricRecord', () => {
    it('builds weight entry when weight is present', () => {
      const result = buildMetricRecord({
        id: 1, date: 1700000000000, weight: 80.5,
        waist: null, armRight: null, thighRight: null, chest: null, calf: null, type: 'daily',
      });
      expect(result.weight).toBeDefined();
      expect(result.weight!.entry_type).toBe('weight');
      expect(result.weight!.numeric_value).toBe(80.5);
      expect(result.weight!.external_id).toBe('metric-1700000000000');
      expect(result.body_composition).toBeUndefined();
    });

    it('builds body_composition when measurements present', () => {
      const result = buildMetricRecord({
        id: 1, date: 1700000000000, weight: 80,
        waist: 85, armRight: 33, thighRight: 58, chest: 100, calf: 38, type: 'monthly',
      });
      expect(result.body_composition).toBeDefined();
      expect(result.body_composition!.entry_type).toBe('body_composition');
      expect(result.body_composition!.value).toEqual({
        waist: 85, arm_right: 33, thigh_right: 58, chest: 100, calf: 38,
      });
      expect(result.body_composition!.external_id).toBe('metric-1700000000000-measurements');
    });

    it('builds both weight and body_composition', () => {
      const result = buildMetricRecord({
        id: 1, date: 1700000000000, weight: 80.5,
        waist: 85, armRight: null, thighRight: null, chest: null, calf: null, type: 'monthly',
      });
      expect(result.weight).toBeDefined();
      expect(result.body_composition).toBeDefined();
    });

    it('returns empty object when no weight and no measurements', () => {
      const result = buildMetricRecord({
        id: 1, date: 1700000000000, weight: null,
        waist: null, armRight: null, thighRight: null, chest: null, calf: null, type: null,
      });
      expect(result.weight).toBeUndefined();
      expect(result.body_composition).toBeUndefined();
    });

    it('body_composition numeric_value is weight when available', () => {
      const result = buildMetricRecord({
        id: 1, date: 1700000000000, weight: 80.5,
        waist: 85, armRight: null, thighRight: null, chest: null, calf: null, type: 'monthly',
      });
      expect(result.body_composition!.numeric_value).toBe(80.5);
    });
  });

  // =========================================================================
  describe('buildPRRecord', () => {
    it('builds correct weight PR record', () => {
      const result = buildPRRecord({
        id: 1, exerciseId: 5, exerciseName: 'Supino Reto (Barra)',
        recordType: 'weight', value: 100, weightKg: 100, reps: null, estimated1RM: null,
        date: 1714000000000,
      });
      expect(result.external_id).toBe('pr-weight-1');
      expect(result.exercise_name).toBe('Supino Reto (Barra)');
      expect(result.record_type).toBe('weight');
      expect(result.value).toBe(100);
      expect(result.date).toBe('2024-04-24T23:06:40.000Z');
    });

    it('builds reps PR with null weight', () => {
      const result = buildPRRecord({
        id: 2, exerciseId: 5, exerciseName: 'Supino Reto (Barra)',
        recordType: 'reps', value: 12, weightKg: null, reps: 12, estimated1RM: null,
        date: 1714000000000,
      });
      expect(result.record_type).toBe('reps');
      expect(result.weight_kg).toBeNull();
      expect(result.reps).toBe(12);
    });
  });

  // =========================================================================
  describe('buildGoalRecord', () => {
    it('builds correct goal record', () => {
      const result = buildGoalRecord({
        id: 1, type: 'waist', targetValue: 80,
        startDate: new Date(2026, 0, 1).getTime(),
        targetDate: new Date(2026, 5, 30).getTime(),
        achieved: false,
      });
      expect(result.external_id).toBe('goal-waist-1');
      expect(result.type).toBe('waist');
      expect(result.target_value).toBe(80);
      expect(result.achieved).toBe(false);
      expect(result.start_date).toMatch(/2026-01-01/);
      expect(result.target_date).toMatch(/2026-06-30/);
    });

    it('marks achieved goals', () => {
      const result = buildGoalRecord({
        id: 2, type: 'weight', targetValue: 75,
        startDate: 1700000000000, targetDate: 1714000000000, achieved: true,
      });
      expect(result.achieved).toBe(true);
    });
  });
});

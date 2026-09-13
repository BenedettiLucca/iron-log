import { parseCsv, parseDateToTimestamp, parseDurationToSeconds, rpeToRir } from './csv';
import { executeImport } from './db-executor';
import type { ImportResult, ParsedSessionGroup, ParsedSetRow } from './types';

function getField(row: Record<string, string>, ...keys: string[]): string {
  const rowKeys = Object.keys(row);
  for (const key of keys) {
    const matched = rowKeys.find((k) => k.toLowerCase().trim() === key.toLowerCase().trim());
    if (matched && row[matched] !== undefined) {
      return row[matched];
    }
  }
  return '';
}

/**
 * Parses Hevy CSV exports into normalized Iron Log sessions and sets.
 * Automatically creates custom exercises for unrecognized names without dropping rows.
 */
export function parseHevyCsv(csvContent: string): ParsedSessionGroup[] {
  const { rows } = parseCsv(csvContent);
  const sessionMap = new Map<string, ParsedSessionGroup>();

  for (const row of rows) {
    const rawStartTime = getField(row, 'start_time', 'start time', 'date');
    const workoutTitle = getField(row, 'title', 'workout_title') || 'Hevy Workout';
    const exerciseTitle = getField(row, 'exercise_title', 'exercise');

    if (!rawStartTime) continue;

    const startTime = parseDateToTimestamp(rawStartTime);
    const sessionKey = `${startTime}_${workoutTitle}`;

    let session = sessionMap.get(sessionKey);
    if (!session) {
      const rawEndTime = getField(row, 'end_time', 'end time');
      const endTime = rawEndTime && rawEndTime.trim() ? parseDateToTimestamp(rawEndTime) : null;
      const durationMinutes =
        endTime && endTime > startTime
          ? Math.round((endTime - startTime) / 60000)
          : null;
      const description = getField(row, 'description') || null;

      session = {
        routineName: workoutTitle,
        startTime,
        endTime,
        durationMinutes,
        notes: description,
        sets: [],
      };
      sessionMap.set(sessionKey, session);
    }

    if (!exerciseTitle) continue;

    const unitField = getField(row, 'weight_unit', 'unit').toLowerCase().trim();
    const hasLbsHeader = Object.keys(row).some((k) => {
      const lower = k.toLowerCase().trim();
      return lower === 'weight_lbs' || lower === 'weight (lbs)' || (lower.includes('weight') && lower.includes('lbs'));
    });
    const isLbs = hasLbsHeader || unitField === 'lbs' || unitField === 'lb';
    const rawWeight = isLbs
      ? getField(row, 'weight_lbs', 'weight', 'weight_kg')
      : getField(row, 'weight_kg', 'weight', 'weight_lbs');
    let weight = parseFloat(rawWeight) || 0;
    if (isLbs && weight > 0) {
      weight = Math.round(weight * 0.45359237 * 100) / 100;
    }

    const reps = parseInt(getField(row, 'reps'), 10) || 0;
    const rawDuration = getField(row, 'duration_seconds', 'duration');
    const durationSeconds = parseDurationToSeconds(rawDuration);
    const setType = getField(row, 'set_type', 'type').toLowerCase();
    const isWarmup = setType === 'warmup' || setType === 'w';
    const exerciseNotes = getField(row, 'exercise_notes', 'notes');
    const rawRpe = getField(row, 'rpe');
    const rir = rpeToRir(rawRpe);

    const rawSetIndex = getField(row, 'set_index', 'set');
    const existingExerciseSets = session.sets.filter(
      (s) => s.exerciseName.trim().toLowerCase() === exerciseTitle.trim().toLowerCase()
    );
    const parsedSetIndex = parseInt(rawSetIndex, 10);
    const setNumber = !isNaN(parsedSetIndex)
      ? parsedSetIndex >= 0 && parsedSetIndex < 100
        ? parsedSetIndex + 1
        : parsedSetIndex
      : existingExerciseSets.length + 1;

    const setRow: ParsedSetRow = {
      exerciseName: exerciseTitle.trim(),
      setNumber: existingExerciseSets.length + 1 || setNumber,
      weightKg: weight,
      reps,
      durationSeconds: durationSeconds && durationSeconds > 0 ? durationSeconds : null,
      rir,
      isWarmup,
      notes: exerciseNotes || null,
    };

    session.sets.push(setRow);
  }

  return Array.from(sessionMap.values());
}

export const HevyImporter = {
  importCsv(csvContent: string, database?: any): ImportResult {
    const sessions = parseHevyCsv(csvContent);
    return executeImport(sessions, database, 'hevy');
  },
};

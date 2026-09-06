import { parseCsv, parseDateToTimestamp, parseDurationToMinutes, parseDurationToSeconds, rpeToRir } from './csv';
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
 * Parses Strong CSV exports into normalized Iron Log sessions and sets.
 * Automatically creates custom exercises for unrecognized names without dropping rows.
 */
export function parseStrongCsv(csvContent: string): ParsedSessionGroup[] {
  const { rows } = parseCsv(csvContent);
  const sessionMap = new Map<string, ParsedSessionGroup>();

  for (const row of rows) {
    const rawDate = getField(row, 'Date', 'Date/Time');
    const workoutName = getField(row, 'Workout Name', 'Workout') || 'Strong Workout';
    const exerciseName = getField(row, 'Exercise Name', 'Exercise');

    if (!rawDate && !exerciseName) continue;

    const startTime = parseDateToTimestamp(rawDate);
    const sessionKey = `${startTime}_${workoutName}`;

    let session = sessionMap.get(sessionKey);
    if (!session) {
      const rawDuration = getField(row, 'Duration');
      const durationMinutes = parseDurationToMinutes(rawDuration);
      const endTime = durationMinutes ? startTime + durationMinutes * 60000 : null;
      const workoutNotes = getField(row, 'Workout Notes') || null;

      session = {
        routineName: workoutName,
        startTime,
        endTime,
        durationMinutes,
        notes: workoutNotes,
        sets: [],
      };
      sessionMap.set(sessionKey, session);
    }

    if (!exerciseName) continue;

    const rawWeight = getField(row, 'Weight', 'Weight (kg)', 'Weight (lbs)');
    const weight = parseFloat(rawWeight) || 0;
    const reps = parseInt(getField(row, 'Reps'), 10) || 0;
    const rawSeconds = getField(row, 'Seconds', 'Duration');
    const durationSeconds = parseDurationToSeconds(rawSeconds);
    const rawSetOrder = getField(row, 'Set Order', 'Set');
    const setNotes = getField(row, 'Notes');
    const rawRpe = getField(row, 'RPE', 'Rpe');
    const rir = rpeToRir(rawRpe);

    const isWarmup =
      rawSetOrder.toLowerCase() === 'w' ||
      rawSetOrder.toLowerCase() === 'warmup' ||
      /warmup|aquecimento/i.test(setNotes);

    // Calculate sequential set number for this exercise within the session
    const existingExerciseSets = session.sets.filter(
      (s) => s.exerciseName.trim().toLowerCase() === exerciseName.trim().toLowerCase()
    );
    const parsedSetNumber = parseInt(rawSetOrder, 10);
    const setNumber = !isNaN(parsedSetNumber) && parsedSetNumber > 0
      ? parsedSetNumber
      : existingExerciseSets.length + 1;

    const setRow: ParsedSetRow = {
      exerciseName: exerciseName.trim(),
      setNumber,
      weightKg: weight,
      reps,
      durationSeconds: durationSeconds && durationSeconds > 0 ? durationSeconds : null,
      rir,
      isWarmup,
      notes: setNotes || null,
    };

    session.sets.push(setRow);
  }

  return Array.from(sessionMap.values());
}

export const StrongImporter = {
  importCsv(csvContent: string, database?: any): ImportResult {
    const sessions = parseStrongCsv(csvContent);
    return executeImport(sessions, database, 'strong');
  },
};

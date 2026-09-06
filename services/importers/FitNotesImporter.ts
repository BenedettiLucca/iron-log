import { parseCsv, parseDateToTimestamp, parseDurationToSeconds } from './csv';
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
 * Parses FitNotes CSV exports into normalized Iron Log sessions and sets.
 * Automatically creates custom exercises for unrecognized names without dropping rows.
 */
export function parseFitNotesCsv(csvContent: string): ParsedSessionGroup[] {
  const { rows } = parseCsv(csvContent);
  const sessionMap = new Map<string, ParsedSessionGroup>();

  for (const row of rows) {
    const rawDate = getField(row, 'Date', 'Date/Time');
    const exerciseName = getField(row, 'Exercise', 'Exercise Name');
    const category = getField(row, 'Category') || 'Treino FitNotes';

    if (!rawDate && !exerciseName) continue;

    const startTime = parseDateToTimestamp(rawDate);
    const sessionKey = `${startTime}`;

    let session = sessionMap.get(sessionKey);
    if (!session) {
      session = {
        routineName: category || 'FitNotes Workout',
        startTime,
        endTime: null,
        durationMinutes: null,
        notes: null,
        sets: [],
      };
      sessionMap.set(sessionKey, session);
    }

    if (!exerciseName) continue;

    // Detect if weight is in lbs or kgs
    let isLbs = false;
    let rawWeight = '';
    for (const key of Object.keys(row)) {
      const lower = key.toLowerCase();
      if (lower.includes('weight (lbs)') || lower.includes('lbs')) {
        isLbs = true;
        rawWeight = row[key];
        break;
      } else if (lower.includes('weight (kgs)') || lower.includes('weight') || lower.includes('kgs')) {
        rawWeight = row[key];
        break;
      }
    }

    let weight = parseFloat(rawWeight) || 0;
    if (isLbs) {
      weight = Math.round(weight * 0.45359237 * 100) / 100;
    }

    const reps = parseInt(getField(row, 'Reps'), 10) || 0;
    const rawTime = getField(row, 'Time', 'Duration');
    const durationSeconds = parseDurationToSeconds(rawTime);
    const comment = getField(row, 'Comment', 'Notes');

    const existingExerciseSets = session.sets.filter(
      (s) => s.exerciseName.trim().toLowerCase() === exerciseName.trim().toLowerCase()
    );
    const setNumber = existingExerciseSets.length + 1;

    const setRow: ParsedSetRow = {
      exerciseName: exerciseName.trim(),
      setNumber,
      weightKg: weight,
      reps,
      durationSeconds: durationSeconds && durationSeconds > 0 ? durationSeconds : null,
      rir: null,
      isWarmup: /warmup|aquecimento/i.test(comment),
      notes: comment || null,
    };

    session.sets.push(setRow);
  }

  return Array.from(sessionMap.values());
}

export const FitNotesImporter = {
  importCsv(csvContent: string, database?: any): ImportResult {
    const sessions = parseFitNotesCsv(csvContent);
    return executeImport(sessions, database, 'fitnotes');
  },
};

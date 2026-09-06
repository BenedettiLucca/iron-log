import { db as defaultDb } from '@/src/db/client';
import { exercises, sessions, sets } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import { ImportResult, ParsedSessionGroup, TrackerType } from './types';

/**
 * Executes an import transaction in SQLite.
 *
 * Requirements:
 * 1. Synchronous SQLite transaction: db.transaction((tx) => { ... })
 *    (Expo SQLite synchronous transaction - no async/await inside tx callback).
 * 2. Idempotency: Checks existing sessions by startTime to avoid duplicate imports on retry/re-import.
 * 3. Never drops a row: Unrecognized exercises are dynamically created as custom exercises in the `exercises` table.
 * 4. Atomic: Batched in one transaction per file; rollbacks on any thrown error.
 */
export function executeImport(
  sessionGroups: ParsedSessionGroup[],
  database: any = defaultDb,
  tracker?: TrackerType
): ImportResult {
  const db = database || defaultDb;

  let sessionsCreated = 0;
  let setsImported = 0;
  let customExercisesCreated = 0;
  let skippedSessions = 0;

  db.transaction((tx: any) => {
    // 1. Build an in-memory lookup cache of existing exercises
    const existingExercises = tx
      .select({ id: exercises.id, name: exercises.name, type: exercises.type })
      .from(exercises)
      .all();

    const exerciseMap = new Map<string, { id: number; name: string; type: string }>();
    for (const ex of existingExercises) {
      exerciseMap.set(ex.name.trim().toLowerCase(), ex);
    }

    // 2. Iterate through each parsed session
    for (const sessionData of sessionGroups) {
      // Check idempotency: does a session with this exact startTime already exist?
      const existingSession = tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.startTime, sessionData.startTime))
        .get();

      if (existingSession) {
        skippedSessions++;
        continue;
      }

      // Create new session
      const createdSession = tx
        .insert(sessions)
        .values({
          routineName: sessionData.routineName ?? null,
          startTime: sessionData.startTime,
          endTime: sessionData.endTime ?? null,
          durationMinutes: sessionData.durationMinutes ?? null,
          notes: sessionData.notes ?? null,
          bodyWeight: sessionData.bodyWeight ?? null,
          sRpe: sessionData.sRpe ?? null,
        })
        .returning({ id: sessions.id })
        .get();

      if (!createdSession) {
        throw new Error('Failed to create imported session');
      }

      const sessionId = createdSession.id;
      sessionsCreated++;

      // 3. Insert sets for this session
      for (const setData of sessionData.sets) {
        const rawName = (setData.exerciseName || 'Custom Exercise').trim();
        const normalizedKey = rawName.toLowerCase();
        const exerciseInfo = exerciseMap.get(normalizedKey);

        let exerciseId: number;

        if (!exerciseInfo) {
          // Unrecognized exercise name -> CREATE a custom exercise (never drop row)
          const isDuration =
            (setData.durationSeconds ?? 0) > 0 && (!setData.reps || setData.reps === 0);

          const createdCustom = tx
            .insert(exercises)
            .values({
              name: rawName,
              type: isDuration ? 'duration' : 'strength',
              defaultRestSeconds: 90,
            })
            .returning({ id: exercises.id, name: exercises.name, type: exercises.type })
            .get();

          if (!createdCustom) {
            throw new Error(`Failed to create custom exercise: ${rawName}`);
          }

          const savedInfo = {
            id: createdCustom.id,
            name: createdCustom.name,
            type: createdCustom.type,
          };
          exerciseMap.set(normalizedKey, savedInfo);
          exerciseId = savedInfo.id;
          customExercisesCreated++;
        } else {
          exerciseId = exerciseInfo.id;
        }

        tx.insert(sets)
          .values({
            sessionId,
            exerciseId,
            exerciseName: rawName,
            setNumber: setData.setNumber,
            weightKg: setData.weightKg,
            reps: setData.reps,
            durationSeconds: setData.durationSeconds ?? null,
            rir: setData.rir ?? null,
            isWarmup: setData.isWarmup ?? false,
            isEdited: false,
            createdAt: sessionData.startTime,
          })
          .run();

        setsImported++;
      }
    }
  });

  return {
    success: true,
    tracker,
    sessionsCreated,
    setsImported,
    customExercisesCreated,
    skippedSessions,
  };
}

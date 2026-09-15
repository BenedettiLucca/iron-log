import { db as defaultDb } from '@/src/db/client';
import { exercises, sessions, sets } from '@/src/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { ImportResult, ParsedSessionGroup, TrackerType } from './types';

/**
 * Executes an import transaction in SQLite.
 *
 * Requirements:
 * 1. Synchronous SQLite transaction: db.transaction((tx) => { ... })
 *    (Expo SQLite synchronous transaction - no async/await inside tx callback).
 * 2. Idempotency: Checks existing active sessions by startTime & routineName to avoid duplicate imports on retry/re-import.
 * 3. Never drops a row: Unrecognized exercises are dynamically created as custom exercises in the `exercises` table.
 * 4. Collision reporting: Detects timestamp collisions with distinct sessions, reporting them instead of silently dropping valid workouts.
 * 5. Atomic: Batched in one transaction per file; rollbacks on any thrown error.
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
  let collisionsDetected = 0;

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
      // Find all active sessions sharing this exact startTime (ignoring soft-deleted sessions)
      const activeSessionsAtStartTime = tx
        .select({ id: sessions.id, routineName: sessions.routineName })
        .from(sessions)
        .where(
          and(
            eq(sessions.startTime, sessionData.startTime),
            isNull(sessions.deletedAt)
          )
        )
        .all();

      if (activeSessionsAtStartTime.length > 0) {
        // Check if an exact matching session already exists (same startTime and same routineName)
        const targetRoutine = (sessionData.routineName || '').trim().toLowerCase();
        const exactMatch = activeSessionsAtStartTime.some(
          (s: { id: number; routineName: string | null }) =>
            (s.routineName || '').trim().toLowerCase() === targetRoutine
        );

        if (exactMatch) {
          skippedSessions++;
          continue;
        }

        // Semantic collision: another session exists at this exact startTime with a different routine name.
        // Report the collision instead of silently dropping the workout.
        collisionsDetected++;
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
    collisionsDetected,
  };
}

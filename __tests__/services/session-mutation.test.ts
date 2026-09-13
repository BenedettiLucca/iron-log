import fs from 'fs';
import path from 'path';
import { renderHook, act } from '@testing-library/react-native';
import { eq, and, isNull, desc, sql, ne } from 'drizzle-orm';
import { db, sqlite } from '../fixtures/database';
import { exercises, sessions, sets, routines, routineExercises } from '@/src/db/schema';
import {
  saveSetMutation,
  getNextSetNumber,
  findSetByOperationId,
  useExerciseSets,
} from '@/hooks/use-exercise-sets';
import { parseLocalizedDecimal } from '@/src/utils/localized-decimal';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: jest.fn(() => ({ data: [] })),
}));
jest.mock('@/services/NotificationService', () => ({
  scheduleRestNotification: jest.fn(),
  cancelRestNotification: jest.fn(),
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

describe('T05: Session Mutation & Set Idempotency', () => {
  beforeEach(() => {
    sqlite.exec(`
      DELETE FROM personal_records;
      DELETE FROM sets;
      DELETE FROM routine_exercises;
      DELETE FROM routines;
      DELETE FROM sessions;
      DELETE FROM exercises;
      DELETE FROM sqlite_sequence;
    `);

    // Base seed
    db.insert(exercises).values({ id: 1, name: 'Supino Reto', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(exercises).values({ id: 2, name: 'Remada Curvada', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(sessions).values({ id: 10, routineName: 'Treino A', startTime: 1000000 }).run();
  });

  describe('Issue #115: Set numbering per occurrence and tombstones', () => {
    it('does not duplicate set numbers when intermediate set is deleted and another is added (#1, #2, #3 -> delete #2 -> add -> #4)', async () => {
      // 1. Add #1, #2, #3
      const s1 = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        weightKg: 80,
        reps: 10,
        operationId: 'op-1',
      });
      const s2 = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        weightKg: 85,
        reps: 8,
        operationId: 'op-2',
      });
      const s3 = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        weightKg: 90,
        reps: 6,
        operationId: 'op-3',
      });

      expect(s1.set.setNumber).toBe(1);
      expect(s2.set.setNumber).toBe(2);
      expect(s3.set.setNumber).toBe(3);

      // 2. Soft-delete set #2
      db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, s2.set.id)).run();

      // 3. Add a new set -> must be #4 (MAX of existing sets including tombstones is 3 -> 3 + 1 = 4)
      const s4 = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        weightKg: 95,
        reps: 4,
        operationId: 'op-4',
      });

      expect(s4.set.setNumber).toBe(4);

      // 4. Restore deleted set #2 (undo)
      db.update(sets).set({ deletedAt: null }).where(eq(sets.id, s2.set.id)).run();

      // Verify all sets in session: #1, #2, #3, #4 - all distinct
      const allSets = db.select()
        .from(sets)
        .where(and(eq(sets.sessionId, 10), isNull(sets.deletedAt)))
        .orderBy(sets.setNumber)
        .all();

      expect(allSets.map(s => s.setNumber)).toEqual([1, 2, 3, 4]);
    });

    it('handles delete #3 of #1, #2, #3 then add -> gets #4 without collision on undo', async () => {
      await saveSetMutation({ sessionId: 10, exerciseId: 1, weightKg: 80, reps: 10, operationId: 'set-1' });
      await saveSetMutation({ sessionId: 10, exerciseId: 1, weightKg: 80, reps: 10, operationId: 'set-2' });
      const s3 = await saveSetMutation({ sessionId: 10, exerciseId: 1, weightKg: 80, reps: 10, operationId: 'set-3' });

      // Soft delete #3
      db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, s3.set.id)).run();

      // Add new set -> should be #4
      const s4 = await saveSetMutation({ sessionId: 10, exerciseId: 1, weightKg: 85, reps: 8, operationId: 'set-4' });
      expect(s4.set.setNumber).toBe(4);

      // Undo restore #3
      db.update(sets).set({ deletedAt: null }).where(eq(sets.id, s3.set.id)).run();

      const allLive = db.select().from(sets).where(and(eq(sets.sessionId, 10), isNull(sets.deletedAt))).orderBy(sets.setNumber).all();
      expect(allLive.map(s => s.setNumber)).toEqual([1, 2, 3, 4]);
    });

    it('scopes set numbering by occurrence identity in A/B/A routines without misattributing legacy nulls', async () => {
      // Setup routine with A/B/A:
      // Routine 1: Exercise 1 at orderIndex 1 (re 101), Exercise 2 at orderIndex 2 (re 102), Exercise 1 at orderIndex 3 (re 103)
      db.insert(routines).values({ id: 1, name: 'Treino A/B/A' }).run();
      db.insert(routineExercises).values({ id: 101, routineId: 1, exerciseId: 1, orderIndex: 1 }).run();
      db.insert(routineExercises).values({ id: 102, routineId: 1, exerciseId: 2, orderIndex: 2 }).run();
      db.insert(routineExercises).values({ id: 103, routineId: 1, exerciseId: 1, orderIndex: 3 }).run();

      // Insert legacy set with routineExerciseId NULL for exercise 1
      db.insert(sets).values({
        sessionId: 10,
        exerciseId: 1,
        routineExerciseId: null,
        setNumber: 1,
        weightKg: 70,
        reps: 10,
        operationId: 'legacy-null-set',
      }).run();

      // Occurrence 1 (re 101): Add sets
      const occ1Set1 = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        routineExerciseId: 101,
        routineId: 1,
        weightKg: 80,
        reps: 8,
        operationId: 'occ1-set-1',
      });
      const occ1Set2 = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        routineExerciseId: 101,
        routineId: 1,
        weightKg: 80,
        reps: 8,
        operationId: 'occ1-set-2',
      });

      // Occurrence 2 (re 103): Add sets
      const occ2Set1 = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        routineExerciseId: 103,
        routineId: 1,
        weightKg: 85,
        reps: 6,
        operationId: 'occ2-set-1',
      });

      // In A/B/A routine (occurrences > 1), legacy set with routineExerciseId NULL is NOT misattributed
      // Occurrence 1 starts at 1, 2
      expect(occ1Set1.set.setNumber).toBe(1);
      expect(occ1Set2.set.setNumber).toBe(2);

      // Occurrence 2 starts at 1
      expect(occ2Set1.set.setNumber).toBe(1);
    });

    it('recognizes legacy null routineExerciseId when routine has only 1 occurrence', async () => {
      db.insert(routines).values({ id: 2, name: 'Treino Single' }).run();
      db.insert(routineExercises).values({ id: 201, routineId: 2, exerciseId: 1, orderIndex: 1 }).run();

      // Legacy set without routineExerciseId
      db.insert(sets).values({
        sessionId: 10,
        exerciseId: 1,
        routineExerciseId: null,
        setNumber: 1,
        weightKg: 70,
        reps: 10,
        operationId: 'legacy-single-set',
      }).run();

      const nextNum = await getNextSetNumber({
        sessionId: 10,
        exerciseId: 1,
        routineExerciseId: 201,
        routineId: 2,
      });

      expect(nextNum).toBe(2);
    });
  });

  describe('Contract C3: Idempotent set save and retry', () => {
    it('retrying the same operationId returns existing set without inserting a second set', async () => {
      const first = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        weightKg: 100,
        reps: 5,
        operationId: 'stable-op-123',
      });

      expect(first.isDuplicate).toBe(false);
      expect(first.set.operationId).toBe('stable-op-123');

      // Retry with same operation ID
      const retry = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        weightKg: 100,
        reps: 5,
        operationId: 'stable-op-123',
      });

      expect(retry.isDuplicate).toBe(true);
      expect(retry.set.id).toBe(first.set.id);

      // Only one set exists in DB
      const count = db.select().from(sets).where(eq(sets.sessionId, 10)).all();
      expect(count).toHaveLength(1);
    });

    it('simulates crash between DB commit and AsyncStorage clear (repeated operation ID is idempotent)', async () => {
      // Step 1: Client prepares operation ID before save
      const operationId = 'crash-test-op-789';

      // Step 2: Set committed to DB
      const result1 = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        weightKg: 80,
        reps: 10,
        operationId,
      });
      expect(result1.isDuplicate).toBe(false);

      // Step 3: Crash occurs before AsyncStorage clear (operationId stays in draft)
      // Step 4: Recovery retries save with same operationId
      const recovered = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        weightKg: 80,
        reps: 10,
        operationId,
      });

      expect(recovered.isDuplicate).toBe(true);
      expect(recovered.set.id).toBe(result1.set.id);

      const allSets = db.select().from(sets).where(eq(sets.sessionId, 10)).all();
      expect(allSets).toHaveLength(1);
    });

    it('allows identical values when operation IDs are different', async () => {
      const set1 = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        weightKg: 80,
        reps: 10,
        operationId: 'distinct-op-1',
      });

      const set2 = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        weightKg: 80,
        reps: 10,
        operationId: 'distinct-op-2',
      });

      expect(set1.isDuplicate).toBe(false);
      expect(set2.isDuplicate).toBe(false);
      expect(set1.set.id).not.toBe(set2.set.id);
      expect(set1.set.setNumber).toBe(1);
      expect(set2.set.setNumber).toBe(2);

      const all = db.select().from(sets).where(eq(sets.sessionId, 10)).all();
      expect(all).toHaveLength(2);
    });

    it('handles legacy call without operation ID without deduping by weight/reps', async () => {
      const set1 = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        weightKg: 80,
        reps: 10,
        operationId: null,
      });

      const set2 = await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        weightKg: 80,
        reps: 10,
        operationId: null,
      });

      expect(set1.isDuplicate).toBe(false);
      expect(set2.isDuplicate).toBe(false);
      expect(set1.set.setNumber).toBe(1);
      expect(set2.set.setNumber).toBe(2);

      const all = db.select().from(sets).where(eq(sets.sessionId, 10)).all();
      expect(all).toHaveLength(2);
    });

    it('enforces UNIQUE constraint on operation_id in database', () => {
      db.insert(sets).values({
        sessionId: 10,
        exerciseId: 1,
        setNumber: 1,
        weightKg: 50,
        reps: 10,
        operationId: 'unique-constraint-op',
      }).run();

      expect(() => {
        db.insert(sets).values({
          sessionId: 10,
          exerciseId: 1,
          setNumber: 2,
          weightKg: 50,
          reps: 10,
          operationId: 'unique-constraint-op',
        }).run();
      }).toThrow();
    });

    it('allows multiple rows with NULL operation_id in database', () => {
      expect(() => {
        db.insert(sets).values({
          sessionId: 10,
          exerciseId: 1,
          setNumber: 1,
          weightKg: 50,
          reps: 10,
          operationId: null,
        }).run();

        db.insert(sets).values({
          sessionId: 10,
          exerciseId: 1,
          setNumber: 2,
          weightKg: 50,
          reps: 10,
          operationId: null,
        }).run();
      }).not.toThrow();
    });

    it('findSetByOperationId returns matching set or null', async () => {
      await saveSetMutation({
        sessionId: 10,
        exerciseId: 1,
        weightKg: 75,
        reps: 12,
        operationId: 'find-me',
      });

      const found = await findSetByOperationId('find-me');
      expect(found).not.toBeNull();
      expect(found?.weightKg).toBe(75);

      const notFound = await findSetByOperationId('nonexistent');
      expect(notFound).toBeNull();
    });
  });

  describe('Issue #119: SQL ORDER BY before LIMIT in history', () => {
    it('returns the 20 most recent sets in deterministic order with 25 shuffled records', async () => {
      // Create 25 sessions with timestamps from 1000 to 25000 (step 1000)
      const shuffledSessionIds = Array.from({ length: 25 }, (_, i) => i + 1)
        .sort(() => Math.random() - 0.5);

      for (const idx of shuffledSessionIds) {
        db.insert(sessions).values({
          id: 100 + idx,
          routineName: `Session ${idx}`,
          startTime: idx * 1000,
        }).run();

        db.insert(sets).values({
          sessionId: 100 + idx,
          exerciseId: 1,
          setNumber: 1,
          weightKg: idx * 2,
          reps: 10,
          createdAt: idx * 1000 + 50,
        }).run();
      }

      // Query with SQL ORDER BY before LIMIT 20
      const query = db.select({
        sessionId: sets.sessionId,
        date: sessions.startTime,
        weight: sets.weightKg,
        reps: sets.reps,
        duration: sets.durationSeconds,
        rir: sets.rir,
      })
        .from(sets)
        .innerJoin(sessions, eq(sets.sessionId, sessions.id))
        .where(and(
          eq(sets.exerciseId, 1),
          ne(sets.sessionId, 10), // not current session
          isNull(sets.deletedAt),
          isNull(sessions.deletedAt),
        ))
        .orderBy(
          desc(sessions.startTime),
          desc(sql`coalesce(${sets.createdAt}, ${sessions.startTime})`),
          desc(sets.setNumber),
          desc(sets.id),
        )
        .limit(20);

      const results = query.all();

      expect(results).toHaveLength(20);

      // Most recent should be session 25 (startTime: 25000), down to session 6 (startTime: 6000)
      expect(results[0].date).toBe(25000);
      expect(results[0].weight).toBe(50);
      expect(results[19].date).toBe(6000);
      expect(results[19].weight).toBe(12);

      // Verify strict descending order
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].date).toBeGreaterThan(results[i + 1].date);
      }
    });

    it('falls back to sessions.startTime when sets.createdAt is null without breaking order', () => {
      db.insert(sessions).values({ id: 201, startTime: 5000 }).run();
      db.insert(sessions).values({ id: 202, startTime: 10000 }).run();

      // set 1 has null createdAt
      db.insert(sets).values({
        sessionId: 201,
        exerciseId: 1,
        setNumber: 1,
        weightKg: 60,
        reps: 10,
        createdAt: null,
      }).run();

      // set 2 has createdAt
      db.insert(sets).values({
        sessionId: 202,
        exerciseId: 1,
        setNumber: 1,
        weightKg: 80,
        reps: 8,
        createdAt: 10050,
      }).run();

      const query = db.select({
        sessionId: sets.sessionId,
        date: sessions.startTime,
        weight: sets.weightKg,
      })
        .from(sets)
        .innerJoin(sessions, eq(sets.sessionId, sessions.id))
        .where(and(
          eq(sets.exerciseId, 1),
          ne(sets.sessionId, 10),
          isNull(sets.deletedAt),
          isNull(sessions.deletedAt),
        ))
        .orderBy(
          desc(sessions.startTime),
          desc(sql`coalesce(${sets.createdAt}, ${sessions.startTime})`),
          desc(sets.setNumber),
          desc(sets.id),
        )
        .limit(20);

      const results = query.all();
      expect(results).toHaveLength(2);
      expect(results[0].date).toBe(10000);
      expect(results[1].date).toBe(5000);
    });
  });

  describe('Contract C1: Session prefill and validity rules', () => {
    it('does not prefill from a soft-deleted session', async () => {
      // Deleted session with a set
      db.insert(sessions).values({
        id: 301,
        routineName: 'Deleted Session',
        startTime: 5000,
        deletedAt: 6000,
      }).run();

      db.insert(sets).values({
        sessionId: 301,
        exerciseId: 1,
        setNumber: 1,
        weightKg: 120,
        reps: 5,
      }).run();

      // Live older session with a set
      db.insert(sessions).values({
        id: 302,
        routineName: 'Live Older Session',
        startTime: 3000,
        deletedAt: null,
      }).run();

      db.insert(sets).values({
        sessionId: 302,
        exerciseId: 1,
        setNumber: 1,
        weightKg: 90,
        reps: 8,
      }).run();

      // Query prefill (excluding current session 10 and deleted sessions)
      const lastSet = db.select({ weight: sets.weightKg })
        .from(sets)
        .innerJoin(sessions, eq(sets.sessionId, sessions.id))
        .where(and(
          eq(sets.exerciseId, 1),
          ne(sets.sessionId, 10),
          isNull(sets.deletedAt),
          isNull(sessions.deletedAt),
        ))
        .orderBy(
          desc(sessions.startTime),
          desc(sql`coalesce(${sets.createdAt}, ${sessions.startTime})`),
          desc(sets.setNumber),
          desc(sets.id),
        )
        .limit(1)
        .all();

      expect(lastSet).toHaveLength(1);
      // Must NOT be the 120kg from deleted session 301; must be 90kg from live session 302
      expect(lastSet[0].weight).toBe(90);
    });

    it('prefills from legacy session without endTime (C1 assumption: live without endTime is valid)', async () => {
      db.insert(sessions).values({
        id: 303,
        routineName: 'Legacy Open Session',
        startTime: 8000,
        endTime: null, // no endTime
        deletedAt: null,
      }).run();

      db.insert(sets).values({
        sessionId: 303,
        exerciseId: 1,
        setNumber: 1,
        weightKg: 105,
        reps: 6,
      }).run();

      const lastSet = db.select({ weight: sets.weightKg })
        .from(sets)
        .innerJoin(sessions, eq(sets.sessionId, sessions.id))
        .where(and(
          eq(sets.exerciseId, 1),
          ne(sets.sessionId, 10),
          isNull(sets.deletedAt),
          isNull(sessions.deletedAt),
        ))
        .orderBy(
          desc(sessions.startTime),
          desc(sql`coalesce(${sets.createdAt}, ${sessions.startTime})`),
          desc(sets.setNumber),
          desc(sets.id),
        )
        .limit(1)
        .all();

      expect(lastSet).toHaveLength(1);
      expect(lastSet[0].weight).toBe(105);
    });
  });

  describe('Contract C2: Localized decimal parsing integration', () => {
    it('parses comma and dot decimals uniformly without NaN or truncation', () => {
      const comma = parseLocalizedDecimal('72,5', { allowNegative: false });
      const dot = parseLocalizedDecimal('72.5', { allowNegative: false });

      expect(comma.status).toBe('valid');
      expect(dot.status).toBe('valid');
      if (comma.status === 'valid' && dot.status === 'valid') {
        expect(comma.value).toBe(72.5);
        expect(dot.value).toBe(72.5);
      }
    });

    it('rejects junk and mixed separators instead of truncating via parseFloat', () => {
      expect(parseLocalizedDecimal('72.5kg').status).toBe('invalid');
      expect(parseLocalizedDecimal('1,234.56').status).toBe('invalid');
      expect(parseLocalizedDecimal('72,5,5').status).toBe('invalid');
      expect(parseLocalizedDecimal('abc').status).toBe('invalid');
    });
  });

  describe('Migration: 0024 operation_id and unique index', () => {
    it('migration file exists and contains ALTER TABLE ADD operation_id and unique index', () => {
      const drizzleDir = path.resolve(__dirname, '../../drizzle');
      const migrationFiles = fs.readdirSync(drizzleDir)
        .filter((file) => /^0024_.*\.sql$/.test(file));

      expect(migrationFiles.length).toBeGreaterThanOrEqual(1);

      const migrationContent = fs.readFileSync(path.join(drizzleDir, migrationFiles[0]), 'utf8');
      expect(migrationContent).toContain('operation_id');
      expect(migrationContent).toContain('sets_operation_id_unique');
    });

    it('migrates an existing database preserving pre-existing rows and enforcing unique index afterwards', () => {
      const Database = jest.requireActual('better-sqlite3');
      const testDb = new Database(':memory:');
      testDb.pragma('foreign_keys = ON');

      // Create pre-0024 sets table (without operation_id)
      testDb.exec(`
        CREATE TABLE sessions (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, start_time integer NOT NULL);
        CREATE TABLE exercises (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, name text NOT NULL);
        CREATE TABLE sets (
          id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          session_id integer NOT NULL,
          exercise_id integer NOT NULL,
          exercise_name text,
          set_number integer NOT NULL,
          weight_kg real NOT NULL,
          reps integer NOT NULL,
          duration_seconds integer,
          rir integer,
          is_warmup integer DEFAULT 0 NOT NULL,
          is_edited integer DEFAULT 0 NOT NULL,
          created_at integer,
          deleted_at integer,
          routine_exercise_id integer
        );
        INSERT INTO sessions (id, start_time) VALUES (1, 1000);
        INSERT INTO exercises (id, name) VALUES (1, 'Supino');
        INSERT INTO sets (id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps)
          VALUES (1, 1, 1, 'Supino', 1, 100, 5), (2, 1, 1, 'Supino', 2, 105, 5);
      `);

      // Apply 0024 migration
      const drizzleDir = path.resolve(__dirname, '../../drizzle');
      const migrationFiles = fs.readdirSync(drizzleDir)
        .filter((file) => /^0024_.*\.sql$/.test(file));
      const migrationSql = fs.readFileSync(path.join(drizzleDir, migrationFiles[0]), 'utf8')
        .replace(/--> statement-breakpoint/g, ';');

      testDb.exec(migrationSql);

      // Verify columns: operation_id exists
      const columns = testDb.pragma("table_info('sets')") as { name: string }[];
      expect(columns.some(c => c.name === 'operation_id')).toBe(true);

      // Verify existing rows are preserved with operation_id = null
      const rows = testDb.prepare('SELECT id, weight_kg, operation_id FROM sets ORDER BY id').all() as {
        id: number;
        weight_kg: number;
        operation_id: string | null;
      }[];
      expect(rows).toHaveLength(2);
      expect(rows[0].weight_kg).toBe(100);
      expect(rows[0].operation_id).toBeNull();
      expect(rows[1].weight_kg).toBe(105);
      expect(rows[1].operation_id).toBeNull();

      // Verify unique index enforcement on new rows
      testDb.prepare(`
        INSERT INTO sets (session_id, exercise_id, set_number, weight_kg, reps, operation_id)
        VALUES (1, 1, 3, 110, 3, 'new-op-1')
      `).run();

      expect(() => {
        testDb.prepare(`
          INSERT INTO sets (session_id, exercise_id, set_number, weight_kg, reps, operation_id)
          VALUES (1, 1, 4, 115, 3, 'new-op-1')
        `).run();
      }).toThrow(/UNIQUE constraint failed/);

      testDb.close();
    });
  });

  describe('useExerciseSets hook integration', () => {
    beforeEach(() => {
      db.insert(routineExercises).values({ id: 1, routineId: null, exerciseId: 1 }).run();
    });

    it('handleSaveSet parses localized comma weight correctly (72,5 -> 72.5)', async () => {
      const { result } = renderHook(() => useExerciseSets({
        sessionId: 10,
        exerciseId: 1,
        routineExerciseId: 1,
        routineId: null,
        exerciseName: 'Supino Reto',
        routineRest: null,
      }));

      await act(async () => {
        result.current.setWeight('72,5');
        result.current.setReps('10');
      });

      let saveSuccess = false;
      await act(async () => {
        saveSuccess = await result.current.handleSaveSet(undefined, 'op-comma-test');
      });

      if (!saveSuccess) {
        console.error('Save failed toast:', result.current.toast);
      }

      expect(saveSuccess).toBe(true);
      expect(result.current.toast.type).toBe('success');

      // Verify row in DB
      const inserted = db.select()
        .from(sets)
        .where(eq(sets.operationId, 'op-comma-test'))
        .all();

      expect(inserted).toHaveLength(1);
      expect(inserted[0].weightKg).toBe(72.5);
      expect(inserted[0].reps).toBe(10);
    });

    it('handleSaveSet rejects invalid decimal (72.5kg) and does not persist', async () => {
      const { result } = renderHook(() => useExerciseSets({
        sessionId: 10,
        exerciseId: 1,
        routineExerciseId: 1,
        routineId: null,
        exerciseName: 'Supino Reto',
        routineRest: null,
      }));

      await act(async () => {
        result.current.setWeight('72.5kg');
        result.current.setReps('10');
      });

      let saveSuccess = true;
      await act(async () => {
        saveSuccess = await result.current.handleSaveSet();
      });

      expect(saveSuccess).toBe(false);
      expect(result.current.toast.visible).toBe(true);
      expect(result.current.toast.type).toBe('error');

      const count = db.select().from(sets).where(eq(sets.sessionId, 10)).all();
      expect(count).toHaveLength(0);
    });

    it('handleSaveSet rejects non-integer reps (10.5 or text) for strength', async () => {
      const { result } = renderHook(() => useExerciseSets({
        sessionId: 10,
        exerciseId: 1,
        routineExerciseId: 1,
        routineId: null,
        exerciseName: 'Supino Reto',
        routineRest: null,
      }));

      await act(async () => {
        result.current.setWeight('80');
        result.current.setReps('10.5');
      });

      let saveSuccess = true;
      await act(async () => {
        saveSuccess = await result.current.handleSaveSet();
      });

      expect(saveSuccess).toBe(false);
      expect(result.current.toast.visible).toBe(true);
      expect(result.current.toast.type).toBe('error');
    });

    it('prefills weight from previous session in loadData', async () => {
      // Past session with set of 92.5kg
      db.insert(sessions).values({ id: 5, routineName: 'Past Session', startTime: 500000 }).run();
      db.insert(sets).values({
        sessionId: 5,
        exerciseId: 1,
        setNumber: 1,
        weightKg: 92.5,
        reps: 8,
        createdAt: 500100,
      }).run();

      const { result } = renderHook(() => useExerciseSets({
        sessionId: 10, // Current session is 10
        exerciseId: 1,
        routineExerciseId: 1,
        routineId: null,
        exerciseName: 'Supino Reto',
        routineRest: null,
      }));

      await act(async () => {
        await result.current.loadData();
      });

      expect(result.current.weight).toBe('92.5');
      // Pre-fill from history does not mark dirty
      expect(result.current.isDirty).toBe(false);
    });
  });
});

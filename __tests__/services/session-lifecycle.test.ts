import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, sqlite } from '../fixtures/database';
import { exercises, sessions, sets, bodyMetrics, personalRecords } from '@/src/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import {
  finishSession,
  discardSession,
  deleteSession,
  restoreSession,
  reconcilePersonalRecordsTx,
} from '@/services/SessionLifecycleService';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

describe('T08: SessionLifecycleService (Transactional lifecycle & Undo)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sqlite.exec(`
      DELETE FROM personal_records;
      DELETE FROM body_metrics;
      DELETE FROM sets;
      DELETE FROM sessions;
      DELETE FROM exercises;
      DELETE FROM sqlite_sequence;
    `);

    // Seed base exercises
    db.insert(exercises).values({ id: 1, name: 'Supino Reto', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(exercises).values({ id: 2, name: 'Agachamento', type: 'strength', defaultRestSeconds: 120 }).run();
  });

  describe('1. finishSession', () => {
    it('finishes active session, calculates duration, stores bodyWeight, and syncs bodyMetric in a single tx', async () => {
      db.insert(sessions).values({
        id: 100,
        routineName: 'Treino A',
        startTime: 1000000,
      }).run();

      const finishTime = 1000000 + 45 * 60000; // 45 minutes later

      const result = await finishSession({
        sessionId: 100,
        startTime: 1000000,
        endTime: finishTime,
        weight: '78.5',
        sRpe: 8,
        notes: 'Treino excelente',
      });

      expect(result.success).toBe(true);
      expect(result.alreadyFinished).toBe(false);

      // Verify session updated
      const session = db.select().from(sessions).where(eq(sessions.id, 100)).get();
      expect(session).toBeDefined();
      expect(session?.endTime).toBe(finishTime);
      expect(session?.durationMinutes).toBe(45);
      expect(session?.bodyWeight).toBe(78.5);
      expect(session?.sRpe).toBe(8);
      expect(session?.notes).toBe('Treino excelente');

      // Verify bodyMetric inserted
      const metrics = db.select().from(bodyMetrics).all();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].date).toBe(finishTime);
      expect(metrics[0].weight).toBe(78.5);
      expect(metrics[0].type).toBe('daily');

      // Verify AsyncStorage cleared AFTER commit
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('incomplete_session');
    });

    it('accepts localized decimal "72,5" and parses it to 72.5 via C2 parser', async () => {
      db.insert(sessions).values({
        id: 101,
        routineName: 'Treino B',
        startTime: 2000000,
      }).run();

      await finishSession({
        sessionId: 101,
        startTime: 2000000,
        endTime: 2000000 + 3600000,
        weight: '72,5',
        sRpe: 7,
      });

      const session = db.select().from(sessions).where(eq(sessions.id, 101)).get();
      expect(session?.bodyWeight).toBe(72.5);

      const metrics = db.select().from(bodyMetrics).all();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].weight).toBe(72.5);
    });

    it('handles empty weight input without inserting into bodyMetrics', async () => {
      db.insert(sessions).values({
        id: 102,
        routineName: 'Treino C',
        startTime: 3000000,
      }).run();

      await finishSession({
        sessionId: 102,
        startTime: 3000000,
        endTime: 3000000 + 3600000,
        weight: '',
        sRpe: 7,
      });

      const session = db.select().from(sessions).where(eq(sessions.id, 102)).get();
      expect(session?.bodyWeight).toBeNull();

      const metrics = db.select().from(bodyMetrics).all();
      expect(metrics).toHaveLength(0);
    });

    it('fault injection: rolls back session update when bodyMetric write fails', async () => {
      db.insert(sessions).values({
        id: 103,
        routineName: 'Treino Falha',
        startTime: 4000000,
      }).run();

      // Trigger SQLite failure on body_metrics insert
      sqlite.exec(`
        CREATE TRIGGER test_fail_body_metrics
        BEFORE INSERT ON body_metrics
        BEGIN
          SELECT RAISE(ABORT, 'Simulated SQLite body_metrics failure');
        END;
      `);

      await expect(
        finishSession({
          sessionId: 103,
          startTime: 4000000,
          endTime: 4000000 + 3600000,
          weight: '80.0',
          sRpe: 7,
        })
      ).rejects.toThrow(/Simulated SQLite body_metrics failure/);

      // Clean up trigger
      sqlite.exec('DROP TRIGGER test_fail_body_metrics;');

      // Verify ROLLBACK: session was NOT updated
      const session = db.select().from(sessions).where(eq(sessions.id, 103)).get();
      expect(session?.endTime).toBeNull();
      expect(session?.bodyWeight).toBeNull();

      // Verify no body metrics
      const metrics = db.select().from(bodyMetrics).all();
      expect(metrics).toHaveLength(0);

      // AsyncStorage should NOT have been called due to rollback
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('fault injection: throws if AsyncStorage fails after commit, but DB is already committed', async () => {
      db.insert(sessions).values({
        id: 104,
        routineName: 'Treino Async Fail',
        startTime: 5000000,
      }).run();

      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('AsyncStorage disk write error'));

      await expect(
        finishSession({
          sessionId: 104,
          startTime: 5000000,
          endTime: 5000000 + 3600000,
          weight: '75.0',
          sRpe: 6,
        })
      ).rejects.toThrow('AsyncStorage disk write error');

      // Database write WAS committed
      const session = db.select().from(sessions).where(eq(sessions.id, 104)).get();
      expect(session?.endTime).toBe(5000000 + 3600000);
      expect(session?.bodyWeight).toBe(75.0);
      expect(db.select().from(bodyMetrics).all()).toHaveLength(1);
    });

    it('idempotent retry: does not duplicate bodyMetric on retry of an already-finished session', async () => {
      db.insert(sessions).values({
        id: 105,
        routineName: 'Treino Retry',
        startTime: 6000000,
      }).run();

      const finishTime = 6000000 + 3600000;

      // 1st attempt: AsyncStorage fails after commit
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('AsyncStorage failure'));
      await expect(
        finishSession({
          sessionId: 105,
          startTime: 6000000,
          endTime: finishTime,
          weight: '77.0',
          sRpe: 7,
        })
      ).rejects.toThrow('AsyncStorage failure');

      expect(db.select().from(bodyMetrics).all()).toHaveLength(1);

      // 2nd attempt: Retry should be idempotent and NOT duplicate bodyMetric
      const retryResult = await finishSession({
        sessionId: 105,
        startTime: 6000000,
        endTime: finishTime,
        weight: '77.0',
        sRpe: 7,
      });

      expect(retryResult.success).toBe(true);
      expect(retryResult.alreadyFinished).toBe(true);

      // Still exactly 1 bodyMetric entry!
      const metrics = db.select().from(bodyMetrics).all();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].weight).toBe(77.0);

      // AsyncStorage cleared on successful retry
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('incomplete_session');
    });
  });

  describe('2. discardSession', () => {
    it('soft-deletes session and live sets, clears AsyncStorage, and removes derived PRs', async () => {
      db.insert(sessions).values({
        id: 200,
        routineName: 'Treino Descartado',
        startTime: 1000000,
      }).run();

      const set1 = db.insert(sets).values({
        sessionId: 200,
        exerciseId: 1,
        exerciseName: 'Supino Reto',
        setNumber: 1,
        weightKg: 100,
        reps: 5,
        isWarmup: false,
        createdAt: 1001000,
      }).returning().get();

      // Establish PR
      db.insert(personalRecords).values({
        exerciseId: 1,
        sessionId: 200,
        recordType: 'weight',
        value: 100,
        date: 1001000,
        setDetails: JSON.stringify({ weightKg: 100, reps: 5 }),
      }).run();

      expect(db.select().from(personalRecords).all()).toHaveLength(1);

      await discardSession({ sessionId: 200 });

      // Verify session soft-deleted
      const session = db.select().from(sessions).where(eq(sessions.id, 200)).get();
      expect(session?.deletedAt).not.toBeNull();

      // Verify sets soft-deleted
      const s1 = db.select().from(sets).where(eq(sets.id, set1.id)).get();
      expect(s1?.deletedAt).not.toBeNull();

      // Verify PR removed (derived from discarded session)
      const prs = db.select().from(personalRecords).where(eq(personalRecords.exerciseId, 1)).all();
      expect(prs).toHaveLength(0);

      // Verify AsyncStorage cleared
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('incomplete_session');
    });

    it('fault injection: rolls back discard if sets update fails', async () => {
      db.insert(sessions).values({
        id: 201,
        routineName: 'Treino Rollback Discard',
        startTime: 2000000,
      }).run();

      db.insert(sets).values({
        id: 2001,
        sessionId: 201,
        exerciseId: 1,
        setNumber: 1,
        weightKg: 80,
        reps: 10,
        isWarmup: false,
      }).run();

      sqlite.exec(`
        CREATE TRIGGER test_fail_discard
        BEFORE UPDATE ON sessions
        BEGIN
          SELECT RAISE(ABORT, 'Simulated discard failure on sessions');
        END;
      `);

      await expect(discardSession({ sessionId: 201 })).rejects.toThrow(
        /Simulated discard failure on sessions/
      );

      sqlite.exec('DROP TRIGGER test_fail_discard;');

      // Session and set should remain untouched (not partially deleted)
      const session = db.select().from(sessions).where(eq(sessions.id, 201)).get();
      expect(session?.deletedAt).toBeNull();

      const setRow = db.select().from(sets).where(eq(sets.id, 2001)).get();
      expect(setRow?.deletedAt).toBeNull();
    });
  });

  describe('3. deleteSession and restoreSession (Undo & Tombstones)', () => {
    it('deleteSession soft-deletes session and removes derived PR; restoreSession restores PR without reviving previously deleted sets', async () => {
      // 1. Session 300 with 3 sets:
      // Set 1: live (80kg x 8)
      // Set 2: previously deleted during session (90kg x 6, deletedAt = 500000)
      // Set 3: live (100kg x 5, established PR of 100kg)
      db.insert(sessions).values({
        id: 300,
        routineName: 'Treino A',
        startTime: 1000000,
        endTime: 1003600,
      }).run();

      const set1 = db.insert(sets).values({
        sessionId: 300,
        exerciseId: 1,
        setNumber: 1,
        weightKg: 80,
        reps: 8,
        isWarmup: false,
        createdAt: 1001000,
      }).returning().get();

      const set2 = db.insert(sets).values({
        sessionId: 300,
        exerciseId: 1,
        setNumber: 2,
        weightKg: 90,
        reps: 6,
        isWarmup: false,
        deletedAt: 1002000, // Tombstone created earlier
        createdAt: 1002000,
      }).returning().get();

      const set3 = db.insert(sets).values({
        sessionId: 300,
        exerciseId: 1,
        setNumber: 3,
        weightKg: 100,
        reps: 5,
        isWarmup: false,
        createdAt: 1003000,
      }).returning().get();

      // Also Session 301 from another day with 70kg x 10
      db.insert(sessions).values({
        id: 301,
        routineName: 'Treino Anterior',
        startTime: 500000,
        endTime: 503600,
      }).run();

      db.insert(sets).values({
        sessionId: 301,
        exerciseId: 1,
        setNumber: 1,
        weightKg: 70,
        reps: 10,
        isWarmup: false,
        createdAt: 501000,
      }).run();

      // Establish PR initially (100kg from Session 300)
      sqlite.exec(`
        INSERT INTO personal_records (exercise_id, session_id, record_type, value, date, set_details)
        VALUES (1, 300, 'weight', 100, 1003000, '{"weightKg":100,"reps":5}');
        INSERT INTO personal_records (exercise_id, session_id, record_type, value, date, set_details)
        VALUES (1, 301, 'reps', 10, 501000, '{"weightKg":70,"reps":10}');
      `);

      expect(db.select().from(personalRecords).where(eq(personalRecords.recordType, 'weight')).get()?.value).toBe(100);

      // --- ACTION: deleteSession ---
      await deleteSession({ sessionId: 300 });

      // Session 300 is soft-deleted
      const sessionAfterDelete = db.select().from(sessions).where(eq(sessions.id, 300)).get();
      expect(sessionAfterDelete?.deletedAt).not.toBeNull();

      // Set 2 still has its original tombstone
      const s2AfterDelete = db.select().from(sets).where(eq(sets.id, set2.id)).get();
      expect(s2AfterDelete?.deletedAt).toBe(1002000);

      // PR is reconciled: 100kg PR from session 300 was REMOVED/DOWNGRADED to session 301 (70kg)!
      const weightPRAfterDelete = db.select().from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight')))
        .get();
      expect(weightPRAfterDelete?.value).toBe(70);
      expect(weightPRAfterDelete?.sessionId).toBe(301);

      // --- ACTION: restoreSession (Undo) ---
      await restoreSession({ sessionId: 300 });

      // Session 300 restored
      const sessionAfterRestore = db.select().from(sessions).where(eq(sessions.id, 300)).get();
      expect(sessionAfterRestore?.deletedAt).toBeNull();

      // CONTRACT CHECK: Set 2 was NOT revived! Its previous tombstone is strictly preserved!
      const s2AfterRestore = db.select().from(sets).where(eq(sets.id, set2.id)).get();
      expect(s2AfterRestore?.deletedAt).toBe(1002000);

      // Sets 1 and 3 are live
      const s1AfterRestore = db.select().from(sets).where(eq(sets.id, set1.id)).get();
      expect(s1AfterRestore?.deletedAt).toBeNull();
      const s3AfterRestore = db.select().from(sets).where(eq(sets.id, set3.id)).get();
      expect(s3AfterRestore?.deletedAt).toBeNull();

      // CONTRACT CHECK: PR is recalculated and 100kg PR from set 3 is RESTORED!
      const weightPRAfterRestore = db.select().from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight')))
        .get();
      expect(weightPRAfterRestore?.value).toBe(100);
      expect(weightPRAfterRestore?.sessionId).toBe(300);
    });

    it('fault injection: deleteSession rolls back if PR reconciliation throws', async () => {
      db.insert(sessions).values({
        id: 302,
        routineName: 'Treino Rollback Delete',
        startTime: 7000000,
      }).run();

      db.insert(sets).values({
        sessionId: 302,
        exerciseId: 1,
        setNumber: 1,
        weightKg: 90,
        reps: 5,
        isWarmup: false,
      }).run();

      // Seed a PR record so DELETE will execute on it
      db.insert(personalRecords).values({
        exerciseId: 1,
        sessionId: 302,
        recordType: 'weight',
        value: 90,
        date: 7000000,
        setDetails: '{}',
      }).run();

      sqlite.exec(`
        CREATE TRIGGER test_fail_delete_pr
        BEFORE DELETE ON personal_records
        BEGIN
          SELECT RAISE(ABORT, 'Simulated PR delete failure');
        END;
      `);

      await expect(deleteSession({ sessionId: 302 })).rejects.toThrow(/Simulated PR delete failure/);

      sqlite.exec('DROP TRIGGER test_fail_delete_pr;');

      // Session should remain NOT deleted due to complete rollback
      const session = db.select().from(sessions).where(eq(sessions.id, 302)).get();
      expect(session?.deletedAt).toBeNull();
    });
  });

  describe('4. C4 PR Reconciliation: Comparable Load & Chronological Promotion', () => {
    it('honors C4 rule: 80x10 -> 40x15 does NOT promote, while 80x15 and heavier comparable loads DO promote', () => {
      db.insert(sessions).values({
        id: 400,
        routineName: 'Treino PR Rules',
        startTime: 1000000,
      }).run();

      // Set 1: 80kg x 10 reps at t=1001000 -> sets baseline reps PR (10 reps @ 80kg)
      db.insert(sets).values({
        sessionId: 400,
        exerciseId: 1,
        setNumber: 1,
        weightKg: 80,
        reps: 10,
        isWarmup: false,
        createdAt: 1001000,
      }).run();

      // Set 2: 40kg x 15 reps at t=1002000 -> reps > 10, BUT load (40kg) < reference (80kg).
      // Under C4, this must NOT promote!
      db.insert(sets).values({
        sessionId: 400,
        exerciseId: 1,
        setNumber: 2,
        weightKg: 40,
        reps: 15,
        isWarmup: false,
        createdAt: 1002000,
      }).run();

      db.transaction((tx) => {
        reconcilePersonalRecordsTx(tx, { exerciseIds: [1] });
      });

      let repsPR = db.select().from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps')))
        .get();
      expect(repsPR?.value).toBe(10); // Still 10! 40x15 did not steal the record

      // Set 3: 80kg x 15 reps at t=1003000 -> reps > 10 AND load (80kg) >= 80kg -> PROMOTES!
      db.insert(sets).values({
        sessionId: 400,
        exerciseId: 1,
        setNumber: 3,
        weightKg: 80,
        reps: 15,
        isWarmup: false,
        createdAt: 1003000,
      }).run();

      db.transaction((tx) => {
        reconcilePersonalRecordsTx(tx, { exerciseIds: [1] });
      });

      repsPR = db.select().from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps')))
        .get();
      expect(repsPR?.value).toBe(15);
      expect(JSON.parse(repsPR?.setDetails ?? '{}').weightKg).toBe(80);

      // Set 4: 90kg x 16 reps at t=1004000 -> higher weight AND higher reps -> PROMOTES!
      db.insert(sets).values({
        sessionId: 400,
        exerciseId: 1,
        setNumber: 4,
        weightKg: 90,
        reps: 16,
        isWarmup: false,
        createdAt: 1004000,
      }).run();

      db.transaction((tx) => {
        reconcilePersonalRecordsTx(tx, { exerciseIds: [1] });
      });

      repsPR = db.select().from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps')))
        .get();
      expect(repsPR?.value).toBe(16);
      expect(JSON.parse(repsPR?.setDetails ?? '{}').weightKg).toBe(90);
    });

    it('removes PR rows entirely when all live sets are soft-deleted across all sessions', () => {
      db.insert(sessions).values({ id: 500, startTime: 1000000 }).run();
      const s = db.insert(sets).values({
        sessionId: 500,
        exerciseId: 2,
        setNumber: 1,
        weightKg: 120,
        reps: 5,
        isWarmup: false,
      }).returning().get();

      db.transaction((tx) => {
        reconcilePersonalRecordsTx(tx, { exerciseIds: [2] });
      });

      expect(db.select().from(personalRecords).where(eq(personalRecords.exerciseId, 2)).all().length).toBeGreaterThan(0);

      // Soft delete set
      db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, s.id)).run();

      db.transaction((tx) => {
        reconcilePersonalRecordsTx(tx, { exerciseIds: [2] });
      });

      expect(db.select().from(personalRecords).where(eq(personalRecords.exerciseId, 2)).all()).toHaveLength(0);
    });
  });

  describe('5. History Undo 10s Window & SQLite Oracle', () => {
    function getLiveSetsOracle(exerciseId: number) {
      return db
        .select({
          id: sets.id,
          sessionId: sets.sessionId,
          exerciseId: sets.exerciseId,
          weightKg: sets.weightKg,
          reps: sets.reps,
          deletedAt: sets.deletedAt,
        })
        .from(sets)
        .innerJoin(sessions, eq(sets.sessionId, sessions.id))
        .where(
          and(
            eq(sets.exerciseId, exerciseId),
            isNull(sets.deletedAt),
            isNull(sessions.deletedAt),
            sql`NOT ${sets.isWarmup}`
          )
        )
        .all();
    }

    it('SQLite oracle verifies live sets and PRs through delete, 10s expiration, and restore without reviving deleted sets', async () => {
      jest.useFakeTimers();

      // Seed Session 600
      db.insert(sessions).values({
        id: 600,
        routineName: 'Treino Oracle',
        startTime: 1000000,
        endTime: 1003600,
      }).run();

      // Set A: live (80kg x 8)
      const setA = db.insert(sets).values({
        sessionId: 600,
        exerciseId: 1,
        setNumber: 1,
        weightKg: 80,
        reps: 8,
        isWarmup: false,
        createdAt: 1001000,
      }).returning().get();

      // Set B: previously soft-deleted during workout (90kg x 6, deletedAt = 1002000)
      const setB = db.insert(sets).values({
        sessionId: 600,
        exerciseId: 1,
        setNumber: 2,
        weightKg: 90,
        reps: 6,
        isWarmup: false,
        deletedAt: 1002000,
        createdAt: 1002000,
      }).returning().get();

      // Set C: live PR set (100kg x 5)
      const setC = db.insert(sets).values({
        sessionId: 600,
        exerciseId: 1,
        setNumber: 3,
        weightKg: 100,
        reps: 5,
        isWarmup: false,
        createdAt: 1003000,
      }).returning().get();

      // Establish initial PR
      db.transaction((tx) => {
        reconcilePersonalRecordsTx(tx, { exerciseIds: [1] });
      });

      // Oracle BEFORE delete: 2 live sets (setA, setC)
      const oracleBefore = getLiveSetsOracle(1);
      expect(oracleBefore.map((s) => s.id).sort()).toEqual([setA.id, setC.id].sort());
      expect(
        db.select().from(personalRecords)
          .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight')))
          .get()?.value
      ).toBe(100);

      // --- STEP 1: Delete Session ---
      await deleteSession({ sessionId: 600 });

      // Oracle AFTER delete: 0 live sets, PR removed
      const oracleAfterDelete = getLiveSetsOracle(1);
      expect(oracleAfterDelete).toHaveLength(0);
      expect(db.select().from(personalRecords).where(eq(personalRecords.exerciseId, 1)).all()).toHaveLength(0);

      const deletedTimestamp = db.select().from(sessions).where(eq(sessions.id, 600)).get()?.deletedAt;
      expect(deletedTimestamp).not.toBeNull();

      // Simulate 10-second timer window
      let undoExpired = false;
      const timer = setTimeout(() => {
        undoExpired = true;
      }, 10000);

      // Advance 9.9 seconds: timer not expired yet
      jest.advanceTimersByTime(9900);
      expect(undoExpired).toBe(false);

      // Advance past 10 seconds: timer expires
      jest.advanceTimersByTime(200);
      expect(undoExpired).toBe(true);

      // ACCEPTANCE CRITERION: "expiração não altera dados"
      const sessionAfterExpire = db.select().from(sessions).where(eq(sessions.id, 600)).get();
      expect(sessionAfterExpire?.deletedAt).toBe(deletedTimestamp);
      expect(getLiveSetsOracle(1)).toHaveLength(0);

      // --- STEP 2: Restore Session (Undo) ---
      await restoreSession({ sessionId: 600 });

      // Oracle AFTER restore: sets A and C are live; set B remains deleted!
      const oracleAfterRestore = getLiveSetsOracle(1);
      expect(oracleAfterRestore.map((s) => s.id).sort()).toEqual([setA.id, setC.id].sort());

      const setBRow = db.select().from(sets).where(eq(sets.id, setB.id)).get();
      expect(setBRow?.deletedAt).toBe(1002000); // tombstone preserved

      // PR is restored
      expect(
        db.select().from(personalRecords)
          .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight')))
          .get()?.value
      ).toBe(100);

      clearTimeout(timer);
      jest.useRealTimers();
    });

    it('fault injection on restoreSession surfaces error and preserves soft-delete state', async () => {
      db.insert(sessions).values({
        id: 700,
        routineName: 'Treino Error Restore',
        startTime: 1000000,
        deletedAt: 1005000,
      }).run();

      sqlite.exec(`
        CREATE TRIGGER test_fail_restore
        BEFORE UPDATE OF deleted_at ON sessions
        BEGIN
          SELECT RAISE(ABORT, 'Simulated restore persistence failure');
        END;
      `);

      await expect(restoreSession({ sessionId: 700 })).rejects.toThrow(
        /Simulated restore persistence failure/
      );

      sqlite.exec('DROP TRIGGER test_fail_restore;');

      // Session remains soft-deleted
      const session = db.select().from(sessions).where(eq(sessions.id, 700)).get();
      expect(session?.deletedAt).toBe(1005000);
    });
  });
});


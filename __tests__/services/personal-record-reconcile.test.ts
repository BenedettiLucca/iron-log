import { db, sqlite } from '../fixtures/database';
import { exercises, sessions, sets, personalRecords } from '@/src/db/schema';
import {
  checkPersonalRecords,
  checkPersonalRecordsSync,
  reconcilePersonalRecords,
  reconcilePersonalRecordsSync,
  reconcileSessionPRs,
} from '@/hooks/use-personal-records';
import { eq, and, isNull } from 'drizzle-orm';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

describe('reconcilePersonalRecords (PR reconciliation from live sets)', () => {
  beforeEach(() => {
    sqlite.exec('DELETE FROM personal_records; DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises; DELETE FROM sqlite_sequence;');
    db.insert(exercises).values({ id: 1, name: 'Bench Press', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(sessions).values({ id: 1, routineName: 'Chest Day', startTime: 1000000, endTime: 1003600 }).run();
  });

  it('downgrades PR to next-best live set when the top PR set is soft-deleted', async () => {
    // 1. Log set 1: 80kg x 8 reps -> sets initial PRs (80kg, 8 reps)
    const set1 = db.insert(sets).values({
      sessionId: 1,
      exerciseId: 1,
      exerciseName: 'Bench Press',
      setNumber: 1,
      weightKg: 80,
      reps: 8,
      rir: 2,
      isWarmup: false,
      createdAt: 1001000,
    }).returning().get();

    await checkPersonalRecords({
      exerciseId: 1,
      sessionId: 1,
      savedSet: set1,
      isWarmup: false,
    });

    // 2. Log set 2: 100kg x 5 reps -> new weight PR (100kg)
    const set2 = db.insert(sets).values({
      sessionId: 1,
      exerciseId: 1,
      exerciseName: 'Bench Press',
      setNumber: 2,
      weightKg: 100,
      reps: 5,
      rir: 1,
      isWarmup: false,
      createdAt: 1002000,
    }).returning().get();

    await checkPersonalRecords({
      exerciseId: 1,
      sessionId: 1,
      savedSet: set2,
      isWarmup: false,
    });

    // Verify weight PR is 100kg
    const weightPRBefore = db.select()
      .from(personalRecords)
      .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight')))
      .get();
    expect(weightPRBefore).toBeDefined();
    expect(weightPRBefore?.value).toBe(100);

    // 3. Soft-delete set 2 (100kg set)
    db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, set2.id)).run();

    // 4. Reconcile PRs
    await reconcilePersonalRecords({ exerciseId: 1 });

    // 5. Verify weight PR was downgraded to 80kg (from set 1)
    const weightPRAfter = db.select()
      .from(personalRecords)
      .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight')))
      .get();
    expect(weightPRAfter).toBeDefined();
    expect(weightPRAfter?.value).toBe(80);
    expect(weightPRAfter?.sessionId).toBe(1);

    // Reps PR should still be 8 (from set 1)
    const repsPR = db.select()
      .from(personalRecords)
      .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps')))
      .get();
    expect(repsPR?.value).toBe(8);
  });

  it('removes PR rows entirely when all live sets for the exercise are soft-deleted', async () => {
    // 1. Log a set and establish PR
    const set1 = db.insert(sets).values({
      sessionId: 1,
      exerciseId: 1,
      exerciseName: 'Bench Press',
      setNumber: 1,
      weightKg: 100,
      reps: 5,
      isWarmup: false,
      createdAt: 1001000,
    }).returning().get();

    await checkPersonalRecords({
      exerciseId: 1,
      sessionId: 1,
      savedSet: set1,
      isWarmup: false,
    });

    // Confirm PR exists
    const prsBefore = db.select().from(personalRecords).where(eq(personalRecords.exerciseId, 1)).all();
    expect(prsBefore.length).toBeGreaterThan(0);

    // 2. Soft-delete set 1
    db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, set1.id)).run();

    // 3. Reconcile
    await reconcilePersonalRecords({ exerciseId: 1 });

    // 4. Confirm all PR rows for exercise 1 are gone
    const prsAfter = db.select().from(personalRecords).where(eq(personalRecords.exerciseId, 1)).all();
    expect(prsAfter).toHaveLength(0);
  });

  it('reconciles PRs correctly when sessionId is passed', async () => {
    // Create exercise 2
    db.insert(exercises).values({ id: 2, name: 'Incline Bench', type: 'strength', defaultRestSeconds: 90 }).run();

    const setEx1 = db.insert(sets).values({
      sessionId: 1,
      exerciseId: 1,
      exerciseName: 'Bench Press',
      setNumber: 1,
      weightKg: 100,
      reps: 5,
      isWarmup: false,
      createdAt: 1001000,
    }).returning().get();

    const setEx2 = db.insert(sets).values({
      sessionId: 1,
      exerciseId: 2,
      exerciseName: 'Incline Bench',
      setNumber: 1,
      weightKg: 60,
      reps: 10,
      isWarmup: false,
      createdAt: 1002000,
    }).returning().get();

    await checkPersonalRecords({ exerciseId: 1, sessionId: 1, savedSet: setEx1, isWarmup: false });
    await checkPersonalRecords({ exerciseId: 2, sessionId: 1, savedSet: setEx2, isWarmup: false });

    // Soft-delete set for exercise 1 only
    db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, setEx1.id)).run();

    // Reconcile passing only sessionId
    await reconcilePersonalRecords({ sessionId: 1 });

    const ex1PRs = db.select().from(personalRecords).where(eq(personalRecords.exerciseId, 1)).all();
    const ex2PRs = db.select().from(personalRecords).where(eq(personalRecords.exerciseId, 2)).all();

    expect(ex1PRs).toHaveLength(0);
    expect(ex2PRs.length).toBeGreaterThan(0);
    expect(ex2PRs.find(p => p.recordType === 'weight')?.value).toBe(60);
  });

  it('ignores warmup sets and non-positive weight/reps during reconciliation', async () => {
    // Warmup set with 120kg (heavier, but warmup)
    db.insert(sets).values({
      sessionId: 1,
      exerciseId: 1,
      exerciseName: 'Bench Press',
      setNumber: 1,
      weightKg: 120,
      reps: 5,
      isWarmup: true,
      createdAt: 1001000,
    }).run();

    // Working set with 80kg
    db.insert(sets).values({
      sessionId: 1,
      exerciseId: 1,
      exerciseName: 'Bench Press',
      setNumber: 2,
      weightKg: 80,
      reps: 8,
      isWarmup: false,
      createdAt: 1002000,
    }).run();

    await reconcilePersonalRecords({ exerciseId: 1 });

    const weightPR = db.select()
      .from(personalRecords)
      .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight')))
      .get();

    expect(weightPR?.value).toBe(80);
  });

  it('restores PR when a soft-deleted set is undeleted and reconciled', async () => {
    const set1 = db.insert(sets).values({
      sessionId: 1,
      exerciseId: 1,
      exerciseName: 'Bench Press',
      setNumber: 1,
      weightKg: 100,
      reps: 5,
      isWarmup: false,
      createdAt: 1001000,
    }).returning().get();

    // Delete set 1
    db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, set1.id)).run();
    await reconcilePersonalRecords({ exerciseId: 1 });
    expect(db.select().from(personalRecords).where(eq(personalRecords.exerciseId, 1)).all()).toHaveLength(0);

    // Undelete set 1 (restore)
    db.update(sets).set({ deletedAt: null }).where(eq(sets.id, set1.id)).run();
    await reconcilePersonalRecords({ exerciseId: 1 });

    const restoredPR = db.select()
      .from(personalRecords)
      .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight')))
      .get();
    expect(restoredPR?.value).toBe(100);
  });

  describe('Contract C4: Reps PR requires same or higher reference load (Issue #120)', () => {
    it('does not promote reps PR when reps are higher but weight is lower (80x10 -> 40x15)', async () => {
      // 1. Initial set: 80kg x 10 reps
      const set1 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        weightKg: 80,
        reps: 10,
        isWarmup: false,
        createdAt: 1001000,
      }).returning().get();

      const pr1 = await checkPersonalRecords({
        exerciseId: 1,
        sessionId: 1,
        savedSet: set1,
        isWarmup: false,
      });
      expect(pr1.isRepsPR).toBe(true);
      expect(pr1.isWeightPR).toBe(true);

      // 2. Second set: 40kg x 15 reps (higher reps, lower weight)
      const set2 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 2,
        weightKg: 40,
        reps: 15,
        isWarmup: false,
        createdAt: 1002000,
      }).returning().get();

      const pr2 = await checkPersonalRecords({
        exerciseId: 1,
        sessionId: 1,
        savedSet: set2,
        isWarmup: false,
      });

      // Contract C4: 80x10 -> 40x15 MUST NOT promote reps PR
      expect(pr2.isRepsPR).toBe(false);

      const repsPRInDb = db.select()
        .from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps')))
        .get();
      expect(repsPRInDb?.value).toBe(10);
      const details = JSON.parse(repsPRInDb?.setDetails || '{}');
      expect(details.weightKg).toBe(80);

      // Reconcile must also keep 80x10 and not select 40x15
      await reconcilePersonalRecords({ exerciseId: 1 });
      const reconciledRepsPR = db.select()
        .from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps')))
        .get();
      expect(reconciledRepsPR?.value).toBe(10);
      const reconciledDetails = JSON.parse(reconciledRepsPR?.setDetails || '{}');
      expect(reconciledDetails.weightKg).toBe(80);
    });

    it('promotes reps PR when reps are higher and weight is equal (80x10 -> 80x15)', async () => {
      const set1 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        weightKg: 80,
        reps: 10,
        isWarmup: false,
        createdAt: 1001000,
      }).returning().get();

      await checkPersonalRecords({
        exerciseId: 1,
        sessionId: 1,
        savedSet: set1,
        isWarmup: false,
      });

      const set2 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 2,
        weightKg: 80,
        reps: 15,
        isWarmup: false,
        createdAt: 1002000,
      }).returning().get();

      const pr2 = await checkPersonalRecords({
        exerciseId: 1,
        sessionId: 1,
        savedSet: set2,
        isWarmup: false,
      });

      expect(pr2.isRepsPR).toBe(true);

      const repsPRInDb = db.select()
        .from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps')))
        .get();
      expect(repsPRInDb?.value).toBe(15);
      const details = JSON.parse(repsPRInDb?.setDetails || '{}');
      expect(details.weightKg).toBe(80);
    });

    it('promotes reps PR when reps are higher and weight is higher (80x10 -> 85x12)', async () => {
      const set1 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        weightKg: 80,
        reps: 10,
        isWarmup: false,
        createdAt: 1001000,
      }).returning().get();

      await checkPersonalRecords({
        exerciseId: 1,
        sessionId: 1,
        savedSet: set1,
        isWarmup: false,
      });

      const set2 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 2,
        weightKg: 85,
        reps: 12,
        isWarmup: false,
        createdAt: 1002000,
      }).returning().get();

      const pr2 = await checkPersonalRecords({
        exerciseId: 1,
        sessionId: 1,
        savedSet: set2,
        isWarmup: false,
      });

      expect(pr2.isRepsPR).toBe(true);
      expect(pr2.isWeightPR).toBe(true);

      const repsPRInDb = db.select()
        .from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps')))
        .get();
      expect(repsPRInDb?.value).toBe(12);
      const details = JSON.parse(repsPRInDb?.setDetails || '{}');
      expect(details.weightKg).toBe(85);
    });

    it('does not promote reps PR when reps are equal even with higher weight (80x10 -> 90x10)', async () => {
      const set1 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        weightKg: 80,
        reps: 10,
        isWarmup: false,
        createdAt: 1001000,
      }).returning().get();

      await checkPersonalRecords({
        exerciseId: 1,
        sessionId: 1,
        savedSet: set1,
        isWarmup: false,
      });

      const set2 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 2,
        weightKg: 90,
        reps: 10,
        isWarmup: false,
        createdAt: 1002000,
      }).returning().get();

      const pr2 = await checkPersonalRecords({
        exerciseId: 1,
        sessionId: 1,
        savedSet: set2,
        isWarmup: false,
      });

      expect(pr2.isRepsPR).toBe(false);
      expect(pr2.isWeightPR).toBe(true);

      const repsPRInDb = db.select()
        .from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps')))
        .get();
      expect(repsPRInDb?.value).toBe(10);
      const details = JSON.parse(repsPRInDb?.setDetails || '{}');
      expect(details.weightKg).toBe(80);
    });

    it('ensures PR cache from checkPersonalRecords matches full recomputation exactly', async () => {
      // Sequence of sets:
      // 1. 60kg x 8 reps
      // 2. 80kg x 10 reps
      // 3. 40kg x 15 reps (rejected for reps PR due to lower weight)
      // 4. 80kg x 12 reps (promotes reps PR)
      // 5. 90kg x 14 reps (promotes weight PR and reps PR)
      const testSets = [
        { weightKg: 60, reps: 8, createdAt: 1001000, setNumber: 1 },
        { weightKg: 80, reps: 10, createdAt: 1002000, setNumber: 2 },
        { weightKg: 40, reps: 15, createdAt: 1003000, setNumber: 3 },
        { weightKg: 80, reps: 12, createdAt: 1004000, setNumber: 4 },
        { weightKg: 90, reps: 14, createdAt: 1005000, setNumber: 5 },
      ];

      for (const s of testSets) {
        const saved = db.insert(sets).values({
          sessionId: 1,
          exerciseId: 1,
          exerciseName: 'Bench Press',
          setNumber: s.setNumber,
          weightKg: s.weightKg,
          reps: s.reps,
          isWarmup: false,
          createdAt: s.createdAt,
        }).returning().get();

        await checkPersonalRecords({
          exerciseId: 1,
          sessionId: 1,
          savedSet: saved,
          isWarmup: false,
        });
      }

      const cacheWeightPR = db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight'))).get();
      const cacheRepsPR = db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps'))).get();

      // Wipe personal_records table completely and recompute from scratch
      sqlite.exec('DELETE FROM personal_records;');
      await reconcilePersonalRecords({ exerciseId: 1 });

      const recomputedWeightPR = db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight'))).get();
      const recomputedRepsPR = db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps'))).get();

      expect(recomputedWeightPR?.value).toBe(cacheWeightPR?.value);
      expect(recomputedWeightPR?.value).toBe(90);
      expect(recomputedRepsPR?.value).toBe(cacheRepsPR?.value);
      expect(recomputedRepsPR?.value).toBe(14);

      const recomputedRepsDetails = JSON.parse(recomputedRepsPR?.setDetails || '{}');
      const cacheRepsDetails = JSON.parse(cacheRepsPR?.setDetails || '{}');
      expect(recomputedRepsDetails.weightKg).toBe(cacheRepsDetails.weightKg);
      expect(recomputedRepsDetails.weightKg).toBe(90);
    });
  });

  describe('Contract C1: Session & Set validity (Issue #104)', () => {
    it('preserves provisional PR during an active workout session (endTime is null)', async () => {
      // Create an active session (endTime null)
      db.insert(sessions).values({ id: 2, routineName: 'Active Workout', startTime: 2000000, endTime: null }).run();

      const activeSet = db.insert(sets).values({
        sessionId: 2,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        weightKg: 120,
        reps: 6,
        isWarmup: false,
        createdAt: 2001000,
      }).returning().get();

      const check = await checkPersonalRecords({
        exerciseId: 1,
        sessionId: 2,
        savedSet: activeSet,
        isWarmup: false,
      });
      expect(check.isWeightPR).toBe(true);

      // Reconcile must recognize provisional PR from active live session
      await reconcilePersonalRecords({ exerciseId: 1 });
      const weightPR = db.select()
        .from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight')))
        .get();
      expect(weightPR?.value).toBe(120);
      expect(weightPR?.sessionId).toBe(2);
    });

    it('downgrades/removes PR when an entire session is soft-deleted (session discard / history delete)', async () => {
      // Session 1 finished with 80kg x 8
      db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        weightKg: 80,
        reps: 8,
        isWarmup: false,
        createdAt: 1001000,
      }).run();

      // Session 2 finished with 110kg x 5
      db.insert(sessions).values({ id: 2, routineName: 'Chest Heavy', startTime: 2000000, endTime: 2003600 }).run();
      db.insert(sets).values({
        sessionId: 2,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        weightKg: 110,
        reps: 5,
        isWarmup: false,
        createdAt: 2001000,
      }).run();

      await reconcilePersonalRecords({ exerciseId: 1 });
      const beforeDelete = db.select()
        .from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight')))
        .get();
      expect(beforeDelete?.value).toBe(110);
      expect(beforeDelete?.sessionId).toBe(2);

      // Soft-delete Session 2 (discarded or deleted from history)
      db.update(sessions).set({ deletedAt: 2004000 }).where(eq(sessions.id, 2)).run();

      // Reconcile by sessionId: 2 or exerciseId: 1
      await reconcilePersonalRecords({ sessionId: 2 });

      const afterDelete = db.select()
        .from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight')))
        .get();
      // Should downgrade to Session 1's 80kg
      expect(afterDelete?.value).toBe(80);
      expect(afterDelete?.sessionId).toBe(1);

      // Undelete / restore Session 2
      db.update(sessions).set({ deletedAt: null }).where(eq(sessions.id, 2)).run();
      await reconcilePersonalRecords({ sessionId: 2 });

      const afterRestore = db.select()
        .from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight')))
        .get();
      expect(afterRestore?.value).toBe(110);
      expect(afterRestore?.sessionId).toBe(2);
    });
  });

  describe('Legacy fallback & non-regression', () => {
    it('handles legacy PR with missing setDetails using DB set fallback', async () => {
      // Insert a set in DB
      db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        weightKg: 75,
        reps: 10,
        isWarmup: false,
        createdAt: 1001000,
      }).run();

      // Insert a legacy PR row with NULL setDetails
      db.insert(personalRecords).values({
        exerciseId: 1,
        sessionId: 1,
        recordType: 'reps',
        value: 10,
        date: 1001000,
        setDetails: null,
      }).run();

      // New set: 40kg x 12 reps (lower than DB set's 75kg)
      const newSet = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 2,
        weightKg: 40,
        reps: 12,
        isWarmup: false,
        createdAt: 1002000,
      }).returning().get();

      const pr = await checkPersonalRecords({
        exerciseId: 1,
        sessionId: 1,
        savedSet: newSet,
        isWarmup: false,
      });

      // Contract C4 fallback: recovered reference weight 75kg from DB set, so 40kg does NOT promote
      expect(pr.isRepsPR).toBe(false);
      const prInDb = db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps'))).get();
      expect(prInDb?.value).toBe(10);
    });

    it('handles duration PR reconciliation without regressing or wiping strength PRs', async () => {
      db.insert(exercises).values({ id: 3, name: 'Plank', type: 'duration', defaultRestSeconds: 60 }).run();

      const plankSet1 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 3,
        exerciseName: 'Plank',
        setNumber: 1,
        weightKg: 0,
        reps: 0,
        durationSeconds: 60,
        isWarmup: false,
        createdAt: 1001000,
      }).returning().get();

      const check1 = await checkPersonalRecords({
        exerciseId: 3,
        sessionId: 1,
        savedSet: plankSet1,
        isWarmup: false,
      });
      expect(check1.isDurationPR).toBe(true);

      const durationPR = db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 3), eq(personalRecords.recordType, 'duration'))).get();
      expect(durationPR?.value).toBe(60);

      // Reconcile plank
      await reconcilePersonalRecords({ exerciseId: 3 });
      const reconciledDurationPR = db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 3), eq(personalRecords.recordType, 'duration'))).get();
      expect(reconciledDurationPR?.value).toBe(60);
    });
  });

  describe('Transaction-awareness (Contract C4 tx-aware API for T08)', () => {
    it('executes reconciliation within a transaction and rolls back on failure leaving no half-state', () => {
      const set1 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        weightKg: 100,
        reps: 5,
        isWarmup: false,
        createdAt: 1001000,
      }).returning().get();

      checkPersonalRecordsSync({ exerciseId: 1, sessionId: 1, savedSet: set1, isWarmup: false });
      expect(db.select().from(personalRecords).where(eq(personalRecords.exerciseId, 1)).all().length).toBe(2);

      // Attempt transaction that soft-deletes set1 and reconciles, but throws
      expect(() => {
        db.transaction((tx) => {
          tx.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, set1.id)).run();
          reconcilePersonalRecordsSync({ exerciseId: 1, tx });
          throw new Error('Simulated transaction failure');
        });
      }).toThrow('Simulated transaction failure');

      // Assert rollback: set is NOT deleted and PR is still 100kg (no half-state)
      const liveSet = db.select().from(sets).where(and(eq(sets.id, set1.id), isNull(sets.deletedAt))).all();
      expect(liveSet).toHaveLength(1);
      const weightPR = db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight'))).get();
      expect(weightPR?.value).toBe(100);
    });

    it('provides reconcileSessionPRs command for lifecycle/history integration', async () => {
      const set1 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        weightKg: 95,
        reps: 6,
        isWarmup: false,
        createdAt: 1001000,
      }).returning().get();

      await checkPersonalRecords({ exerciseId: 1, sessionId: 1, savedSet: set1, isWarmup: false });
      const prRow = db.select()
        .from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight')))
        .get();
      expect(prRow?.value).toBe(95);

      // Soft delete set and call reconcileSessionPRs
      db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, set1.id)).run();
      await reconcileSessionPRs(1);

      expect(db.select().from(personalRecords).where(eq(personalRecords.exerciseId, 1)).all()).toHaveLength(0);
    });
  });

  describe('Set lifecycle mutations: edit, delete, undo, restore', () => {
    it('downgrades PR when a record-holding set is edited to a lower weight/reps', async () => {
      // Set 1: 80kg x 8 reps
      db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        weightKg: 80,
        reps: 8,
        isWarmup: false,
        createdAt: 1001000,
      }).run();

      // Set 2: 100kg x 5 reps -> establishes 100kg weight PR
      const set2 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 2,
        weightKg: 100,
        reps: 5,
        isWarmup: false,
        createdAt: 1002000,
      }).returning().get();

      await reconcilePersonalRecords({ exerciseId: 1 });
      expect(db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight'))).get()?.value).toBe(100);

      // Edit set 2 down to 70kg x 5 reps
      db.transaction((tx) => {
        tx.update(sets).set({ weightKg: 70, isEdited: true }).where(eq(sets.id, set2.id)).run();
        reconcilePersonalRecordsSync({ exerciseId: 1, sessionId: 1, tx });
      });

      // Weight PR must downgrade to 80kg (from set 1)
      const prAfterEdit = db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight'))).get();
      expect(prAfterEdit?.value).toBe(80);
      expect(JSON.parse(prAfterEdit?.setDetails || '{}').weightKg).toBe(80);
    });

    it('handles multiple interleaved creates, edits, deletes, and restores deterministically', async () => {
      // 1. Log set 1: 60kg x 10
      db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 1,
        weightKg: 60,
        reps: 10,
        isWarmup: false,
        createdAt: 1001000,
      }).run();
      await reconcilePersonalRecords({ exerciseId: 1 });

      // 2. Log set 2: 80kg x 12
      const set2 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 2,
        weightKg: 80,
        reps: 12,
        isWarmup: false,
        createdAt: 1002000,
      }).returning().get();
      await reconcilePersonalRecords({ exerciseId: 1 });

      // 3. Log set 3: 100kg x 6
      const set3 = db.insert(sets).values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: 'Bench Press',
        setNumber: 3,
        weightKg: 100,
        reps: 6,
        isWarmup: false,
        createdAt: 1003000,
      }).returning().get();
      await reconcilePersonalRecords({ exerciseId: 1 });

      expect(db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight'))).get()?.value).toBe(100);
      expect(db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps'))).get()?.value).toBe(12);

      // 4. Soft-delete set 3
      db.transaction((tx) => {
        tx.update(sets).set({ deletedAt: 1004000 }).where(eq(sets.id, set3.id)).run();
        reconcilePersonalRecordsSync({ exerciseId: 1, tx });
      });
      // Weight PR downgrades to 80kg
      expect(db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight'))).get()?.value).toBe(80);

      // 5. Soft-delete set 2
      db.transaction((tx) => {
        tx.update(sets).set({ deletedAt: 1005000 }).where(eq(sets.id, set2.id)).run();
        reconcilePersonalRecordsSync({ exerciseId: 1, tx });
      });
      // Reps PR downgrades to 10 reps (60kg), Weight PR downgrades to 60kg
      expect(db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight'))).get()?.value).toBe(60);
      expect(db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps'))).get()?.value).toBe(10);

      // 6. Restore set 2
      db.transaction((tx) => {
        tx.update(sets).set({ deletedAt: null }).where(eq(sets.id, set2.id)).run();
        reconcilePersonalRecordsSync({ exerciseId: 1, tx });
      });
      expect(db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight'))).get()?.value).toBe(80);
      expect(db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps'))).get()?.value).toBe(12);

      // 7. Restore set 3
      db.transaction((tx) => {
        tx.update(sets).set({ deletedAt: null }).where(eq(sets.id, set3.id)).run();
        reconcilePersonalRecordsSync({ exerciseId: 1, tx });
      });
      expect(db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'weight'))).get()?.value).toBe(100);
      expect(db.select().from(personalRecords).where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'reps'))).get()?.value).toBe(12);
    });
  });
});

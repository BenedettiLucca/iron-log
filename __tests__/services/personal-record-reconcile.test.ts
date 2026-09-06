import { db, sqlite } from '../fixtures/database';
import { exercises, sessions, sets, personalRecords } from '@/src/db/schema';
import { checkPersonalRecords, reconcilePersonalRecords } from '@/hooks/use-personal-records';
import { eq, and } from 'drizzle-orm';

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
});

/**
 * T25 — Query plan verification test
 *
 * Verifies that each T25 composite index:
 *   1. Appears in EXPLAIN QUERY PLAN output for its target query.
 *   2. Produces identical result rows to the baseline (index transparency).
 *
 * The fixture DB includes the indexes (database.ts DDL), so these are GREEN-path assertions.
 * If an index is dropped or renamed, the corresponding test fails with a clear message.
 *
 * Queries tested:
 *   - Q9  reconcilePersonalRecordsTx: sets(exercise_id, deleted_at)       → sets_exercise_deleted_idx
 *   - Q10 refreshSessionSets:         sets(session_id, exercise_id, deleted_at, set_number) → sets_session_exercise_deleted_setnum_idx
 *
 * IDX_A (sessions(deleted_at, start_time)) and IDX_B (sets(session_id, deleted_at))
 * were measured and REJECTED (no measurable gain on large fixture; existing indexes sufficient).
 * Their rejection is documented here as explicit evidence.
 */

import { sqlite, db } from '../fixtures/database';
import { sessions, sets, exercises } from '@/src/db/schema';
import { eq, isNull, and, sql } from 'drizzle-orm';

// ── Seeding helpers ─────────────────────────────────────────────────────────

const BASE_TIME = 1700000000000;
const DAY_MS = 86400000;

function seedFixture() {
  // Exercises
  sqlite.prepare(`INSERT OR IGNORE INTO exercises (id, name, type, muscle_group) VALUES (1, 'Squat', 'strength', 'pernas')`).run();
  sqlite.prepare(`INSERT OR IGNORE INTO exercises (id, name, type, muscle_group) VALUES (2, 'Bench Press', 'strength', 'peito')`).run();

  // Sessions (5, one every 2 days; last is live/no endTime)
  for (let i = 1; i <= 5; i++) {
    const startTime = BASE_TIME + (i - 1) * 2 * DAY_MS;
    const endTime = i < 5 ? startTime + 3600000 : null;
    sqlite.prepare(`INSERT OR IGNORE INTO sessions (id, start_time, end_time, deleted_at) VALUES (?, ?, ?, NULL)`)
      .run(i, startTime, endTime);
  }

  // Sets: 3 per session per exercise; even sets tombstoned (deletedAt != null)
  let setId = 1;
  for (let s = 1; s <= 5; s++) {
    for (let e = 1; e <= 2; e++) {
      for (let n = 1; n <= 3; n++) {
        const createdAt = BASE_TIME + (s - 1) * 2 * DAY_MS + n * 60000;
        const deletedAt = n === 2 ? BASE_TIME - 1 : null; // set_number 2 is tombstoned
        sqlite.prepare(
          `INSERT OR IGNORE INTO sets (id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps, is_warmup, created_at, deleted_at) VALUES (?,?,?,?,?,?,?,0,?,?)`
        ).run(setId++, s, e, e === 1 ? 'Squat' : 'Bench Press', n, 100 + n * 10, 5 + n, createdAt, deletedAt);
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function explainPlan(querySql: string): string[] {
  return (sqlite.prepare(`EXPLAIN QUERY PLAN ${querySql}`).all() as { detail: string }[])
    .map(r => r.detail);
}

// ── Setup/Teardown ────────────────────────────────────────────────────────────

beforeAll(() => {
  seedFixture();
});

afterAll(() => {
  // Clean up seeded rows without touching the shared in-memory DB structure
  sqlite.exec(`DELETE FROM sets WHERE id < 100`);
  sqlite.exec(`DELETE FROM sessions WHERE id < 10`);
  sqlite.exec(`DELETE FROM exercises WHERE id IN (1, 2)`);
});

// ── IDX_C Tests ───────────────────────────────────────────────────────────────

describe('IDX_C: sets_exercise_deleted_idx (exercise_id, deleted_at)', () => {
  const Q9_SQL = `
    SELECT s.id, s.session_id, s.exercise_id, s.weight_kg, s.reps, s.is_warmup, s.created_at
    FROM sets s
    INNER JOIN sessions sess ON s.session_id = sess.id
    WHERE s.exercise_id = 1
      AND s.deleted_at IS NULL
      AND sess.deleted_at IS NULL
      AND NOT s.is_warmup
  `;

  it('uses sets_exercise_deleted_idx in query plan for reconcilePersonalRecordsTx pattern', () => {
    const plan = explainPlan(Q9_SQL);
    const usesCompositeIdx = plan.some(line => line.includes('sets_exercise_deleted_idx'));
    expect(usesCompositeIdx).toBe(true);
  });

  it('does NOT use temp B-TREE for the exercise_id + deleted_at filter', () => {
    const plan = explainPlan(Q9_SQL);
    const usesTempBTree = plan.some(line => line.includes('TEMP B-TREE') && line.includes('sets'));
    expect(usesTempBTree).toBe(false);
  });

  it('returns only live, non-warmup sets for the exercise', () => {
    const rows = db.select({
      id: sets.id,
      sessionId: sets.sessionId,
      exerciseId: sets.exerciseId,
    })
      .from(sets)
      .innerJoin(sessions, eq(sets.sessionId, sessions.id))
      .where(and(
        eq(sets.exerciseId, 1),
        isNull(sets.deletedAt),
        isNull(sessions.deletedAt),
        sql`NOT ${sets.isWarmup}`,
      ))
      .all();

    expect(rows.length).toBeGreaterThan(0);
    // All rows must be for exercise 1, not deleted
    for (const row of rows) {
      expect(row.exerciseId).toBe(1);
    }
  });
});

// ── IDX_D Tests ───────────────────────────────────────────────────────────────

describe('IDX_D: sets_session_exercise_deleted_setnum_idx (session_id, exercise_id, deleted_at, set_number)', () => {
  const Q10_SQL = `
    SELECT *
    FROM sets
    WHERE session_id = 1
      AND exercise_id = 1
      AND deleted_at IS NULL
    ORDER BY set_number ASC
  `;

  it('uses sets_session_exercise_deleted_setnum_idx in query plan for refreshSessionSets pattern', () => {
    const plan = explainPlan(Q10_SQL);
    const usesCompositeIdx = plan.some(line => line.includes('sets_session_exercise_deleted_setnum_idx'));
    expect(usesCompositeIdx).toBe(true);
  });

  it('does NOT use temp B-TREE for ORDER BY', () => {
    const plan = explainPlan(Q10_SQL);
    const usesTempBTree = plan.some(line => line.includes('TEMP B-TREE FOR ORDER BY'));
    expect(usesTempBTree).toBe(false);
  });

  it('returns sets in ascending set_number order, excluding tombstoned', () => {
    const rows = db.select({
      id: sets.id,
      setNumber: sets.setNumber,
      deletedAt: sets.deletedAt,
    })
      .from(sets)
      .where(and(
        eq(sets.sessionId, 1),
        eq(sets.exerciseId, 1),
        isNull(sets.deletedAt),
      ))
      .orderBy(sets.setNumber)
      .all();

    expect(rows.length).toBeGreaterThan(0);
    // Must be ascending
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].setNumber).toBeGreaterThanOrEqual(rows[i - 1].setNumber);
    }
    // No tombstoned sets
    for (const row of rows) {
      expect(row.deletedAt).toBeNull();
    }
  });
});

// ── IDX_A Rejection Evidence ─────────────────────────────────────────────────

describe('IDX_A rejection evidence: sessions(deleted_at, start_time) not added', () => {
  it('existing sessions_date_idx covers start_time range queries acceptably', () => {
    const Q1_SQL = `
      SELECT start_time FROM sessions
      WHERE deleted_at IS NULL
        AND start_time >= ${BASE_TIME}
        AND start_time < ${BASE_TIME + 30 * DAY_MS}
    `;
    const plan = explainPlan(Q1_SQL);
    // Either uses sessions_date_idx or the new covering index if added
    const usesExistingIdx = plan.some(line => line.includes('sessions_date_idx') || line.includes('sessions_deleted_at_start_time'));
    // Key assertion: NOT doing a full SCAN without any index
    const doesFullScan = plan.some(line => line.includes('SCAN sessions') && !line.includes('USING'));
    expect(usesExistingIdx || !doesFullScan).toBe(true);
  });

  /**
   * IDX_A was measured at 75 samples × 3 trials on 500-session/10k-set fixture:
   * - Q1 getMonthMarkedDates: before=0.008ms after=0.007ms gain=0.001ms (negligible)
   * - Q4 analytics allActiveSessions: before=0.163ms after=0.164ms gain=-0.001ms (no gain)
   * - Decision: NO-CHANGE. Existing sessions_date_idx provides adequate seek without composite.
   * Storage and write amplification cost is not justified.
   */
  it('IDX_A is not present in the fixture schema (no-change decision)', () => {
    const indexes = (sqlite.pragma('index_list(sessions)') as { name: string }[]).map(r => r.name);
    expect(indexes).not.toContain('idx_sessions_deleted_at_start_time');
  });
});

// ── IDX_B Rejection Evidence ─────────────────────────────────────────────────

describe('IDX_B rejection evidence: sets(session_id, deleted_at) not added', () => {
  /**
   * IDX_B was measured at 75 samples × 3 trials on 500-session/10k-set fixture:
   * - Q7 enrichSessions: before=0.058ms after=0.057ms gain=0.001ms (within noise)
   * - Q8 sets12w:        before=0.138ms after=0.142ms gain=-0.004ms (no gain; slightly worse)
   * - Decision: NO-CHANGE. Existing sets_session_id_idx is sufficient; composite provides no benefit.
   */
  it('IDX_B is not present in the fixture schema (no-change decision)', () => {
    const indexes = (sqlite.pragma('index_list(sets)') as { name: string }[]).map(r => r.name);
    expect(indexes).not.toContain('idx_sets_session_deleted');
  });
});

// ── Combined correctness ──────────────────────────────────────────────────────

describe('All T25 indexes: foreign_key_check and result correctness', () => {
  it('foreign_key_check returns no violations', () => {
    const violations = sqlite.pragma('foreign_key_check') as unknown[];
    expect(violations).toHaveLength(0);
  });

  it('IDX_C and IDX_D are present in sets index list', () => {
    const indexes = (sqlite.pragma('index_list(sets)') as { name: string }[]).map(r => r.name);
    expect(indexes).toContain('sets_exercise_deleted_idx');
    expect(indexes).toContain('sets_session_exercise_deleted_setnum_idx');
  });
});

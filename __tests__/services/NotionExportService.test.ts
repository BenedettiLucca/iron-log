import * as Clipboard from 'expo-clipboard';
import { db, sqlite } from '../fixtures/database';
import { NotionExportService } from '@/services/NotionExportService';
import { exercises, routines, routineExercises, sessions, sets } from '@/src/db/schema';
import { buildSessionVerdictsMarkdown } from '@/src/utils/session-verdict-markdown';
import type { ExerciseVerdict } from '@/src/utils/session-verdicts';

// Real NotionExportService against the real in-memory SQLite fixture. Only true externals are
// mocked: native clipboard/sharing modules (AlexandriaExportService imports expo-sharing) and the
// DB client (redirected to the fixture DB).
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));

const translations: Record<string, string> = {
  'summary.verdicts.title': 'Coaching Verdicts',
  'summary.verdicts.result': 'Result',
  'summary.verdicts.verdict': 'Verdict',
  'summary.verdicts.nextLoad': 'Next Load',
  'summary.verdicts.flags': 'Flags',
  'summary.verdicts.resultTop': 'Top of range',
  'summary.verdicts.resultWithin': 'Within range',
  'summary.verdicts.resultBelow': 'Below range',
  'summary.verdicts.resultNoTarget': 'No target',
  'summary.verdicts.verdictIncrease': 'Increase load',
  'summary.verdicts.verdictHold': 'Hold load',
  'summary.verdicts.verdictReviewFatigue': 'Review fatigue',
  'summary.verdicts.verdictCheckLogging': 'Check logging',
  'summary.verdicts.flagRirInversion': 'Suspicious RIR inconsistency',
  'summary.verdicts.flagAbruptRepDrop': 'Abrupt rep drop between sets',
  'summary.verdicts.flagExtraSets': 'Extra sets beyond target',
  'summary.verdicts.flagRepeatedBelowRange': 'Repeated below-range sets',
};

const t = (key: string) => translations[key] ?? key;

describe('buildSessionVerdictsMarkdown', () => {
  it('includes verdict details and flags for rep-range exercises', () => {
    const verdicts: ExerciseVerdict[] = [
      {
        exerciseId: 1,
        routineExerciseId: null,
        exerciseName: 'Bench Press',
        targetRange: { sets: 3, minReps: 8, maxReps: 12 },
        workingSets: [],
        result: 'top',
        verdict: 'increase',
        nextLoadSuggestion: 'Next time try 102.5kg',
        flags: ['extra_sets'],
        confidence: 'high',
      },
    ];

    const md = buildSessionVerdictsMarkdown(verdicts, t);

    expect(md).toContain('## Coaching Verdicts');
    expect(md).toContain('- **Bench Press** — Result: Top of range | Verdict: Increase load | Next Load: Next time try 102.5kg | Flags: Extra sets beyond target');
  });

  it('shows no_target result without verdict guidance', () => {
    const verdicts: ExerciseVerdict[] = [
      {
        exerciseId: 2,
        routineExerciseId: null,
        exerciseName: 'Plank',
        targetRange: null,
        workingSets: [],
        result: 'no_target',
        verdict: 'hold',
        nextLoadSuggestion: null,
        flags: [],
        confidence: 'low',
      },
    ];

    const md = buildSessionVerdictsMarkdown(verdicts, t);

    expect(md).toContain('- **Plank** — Result: No target');
    expect(md).not.toContain('Verdict:');
    expect(md).not.toContain('Next Load:');
  });
});

// Identity translator: output shows the i18n key, so assertions pin structure, not copy.
const tk = (key: string) => key;

const BENCH = 1;
const PLANK = 2;
const CARRY = 3;
const SQUAT = 4;

// Local-time constructors: the service uses local getters/setters, so these are TZ-independent.
const local = (y: number, m: number, d: number, h = 0, mi = 0, s = 0, ms = 0) =>
  new Date(y, m - 1, d, h, mi, s, ms).getTime();

function resetDb() {
  sqlite.exec(
    'DELETE FROM sets; DELETE FROM routine_exercises; DELETE FROM sessions; DELETE FROM routines; DELETE FROM exercises; DELETE FROM sqlite_sequence;',
  );
  db.insert(exercises).values([
    { id: BENCH, name: 'Bench Press' },
    { id: PLANK, name: 'Plank', type: 'duration' },
    { id: CARRY, name: 'Farmer Carry', type: 'duration' },
    { id: SQUAT, name: 'Squat' },
  ]).run();
}

type SetSeed = Partial<typeof sets.$inferInsert> & { sessionId: number; exerciseId: number; setNumber: number };
function addSet(seed: SetSeed) {
  db.insert(sets).values({ weightKg: 0, reps: 0, isWarmup: false, ...seed }).run();
}

beforeEach(() => {
  jest.clearAllMocks();
  resetDb();
});

describe('NotionExportService.exportSessionMarkdown', () => {
  function seedPushSession() {
    db.insert(routines).values({ id: 1, name: 'Push Day' }).run();
    db.insert(routineExercises).values({ id: 10, routineId: 1, exerciseId: BENCH, target: '3x8-12' }).run();
    const { id } = db.insert(sessions).values({
      routineId: 1,
      routineName: 'Push Day',
      startTime: local(2026, 1, 14, 10, 30),
      durationMinutes: 62,
      sRpe: 8,
      bodyWeight: 82.5,
      notes: 'Felt strong',
    }).returning({ id: sessions.id }).get();
    addSet({ sessionId: id, exerciseId: BENCH, exerciseName: 'Bench Press', routineExerciseId: 10, setNumber: 1, weightKg: 20, reps: 10, isWarmup: true });
    addSet({ sessionId: id, exerciseId: BENCH, exerciseName: 'Bench Press', routineExerciseId: 10, setNumber: 2, weightKg: 80, reps: 8, rir: 2 });
    addSet({ sessionId: id, exerciseId: BENCH, exerciseName: 'Bench Press', routineExerciseId: 10, setNumber: 3, weightKg: 80, reps: 6, rir: 0 });
    // Soft-deleted set must not appear in table, totals or verdicts.
    addSet({ sessionId: id, exerciseId: BENCH, exerciseName: 'Bench Press', routineExerciseId: 10, setNumber: 4, weightKg: 500, reps: 50, deletedAt: 1 });
    return id;
  }

  it('emits exact YAML frontmatter, title, exercise table, verdicts and notes', async () => {
    const id = seedPushSession();

    const md = await NotionExportService.exportSessionMarkdown(id, tk);

    const expectedHead = [
      '---',
      'date: 2026-01-14',
      'routine: "Push Day"',
      'duration: 62',
      'srpe: 8',
      'body_weight: 82.5',
      'total_sets: 2',
      'total_volume: 1120',
      '---',
      '',
      '## Push Day',
      '',
      '### Bench Press',
      '',
      '| reports.md.set | reports.md.weightKg | reports.md.reps | RIR | reports.md.warmup |',
      '|-----|-------------|------|-----|--------|',
      '| 1 | 20 | 10 | - | ✓ |',
      '| 2 | 80 | 8 | 2 | - |',
      '| 3 | 80 | 6 | 0 | - |',
      '',
      '',
    ].join('\n');
    expect(md.slice(0, expectedHead.length)).toBe(expectedHead);
    expect(md).not.toContain('500');
    expect(md).toContain('## summary.verdicts.title\n');
    expect(md).toContain('- **Bench Press** — summary.verdicts.result:');
    expect(md.endsWith('> Felt strong\n')).toBe(true);
  });

  it('falls back for null routine name, duration, sRPE and body weight', async () => {
    const { id } = db.insert(sessions).values({ startTime: local(2026, 3, 5, 8) }).returning({ id: sessions.id }).get();
    addSet({ sessionId: id, exerciseId: SQUAT, exerciseName: null, setNumber: 1, weightKg: 100, reps: 5 });

    const md = await NotionExportService.exportSessionMarkdown(id, tk);

    const expected = [
      '---',
      'date: 2026-03-05',
      'routine: "reports.md.workout"',
      'duration: 0',
      'srpe: -',
      'body_weight: -',
      'total_sets: 1',
      'total_volume: 500',
      '---',
      '',
      '## reports.md.workout',
      '',
      '### reports.md.unknown',
      '',
    ].join('\n');
    expect(md.slice(0, expected.length)).toBe(expected);
    expect(md).toContain('| 1 | 100 | 5 | - | - |');
    expect(md).not.toContain('>');
  });

  it('returns empty string for a missing session id', async () => {
    await expect(NotionExportService.exportSessionMarkdown(9999, tk)).resolves.toBe('');
  });

  it('returns empty string for a soft-deleted session', async () => {
    const { id } = db.insert(sessions).values({ startTime: local(2026, 1, 14), deletedAt: 1 }).returning({ id: sessions.id }).get();
    await expect(NotionExportService.exportSessionMarkdown(id, tk)).resolves.toBe('');
  });

  it('keeps repeated exercises separate per routine occurrence (A/B/A)', async () => {
    db.insert(routines).values({ id: 1, name: 'Push Day' }).run();
    db.insert(routineExercises).values([
      { id: 10, routineId: 1, exerciseId: BENCH },
      { id: 11, routineId: 1, exerciseId: BENCH },
    ]).run();
    const { id } = db.insert(sessions).values({ routineId: 1, routineName: 'Push Day', startTime: local(2026, 1, 14, 9) }).returning({ id: sessions.id }).get();
    addSet({ sessionId: id, exerciseId: BENCH, exerciseName: 'Bench Press', routineExerciseId: 10, setNumber: 1, weightKg: 60, reps: 10 });
    addSet({ sessionId: id, exerciseId: BENCH, exerciseName: 'Bench Press', routineExerciseId: 11, setNumber: 2, weightKg: 70, reps: 8 });
    addSet({ sessionId: id, exerciseId: BENCH, exerciseName: 'Bench Press', routineExerciseId: 10, setNumber: 3, weightKg: 60, reps: 9 });

    const md = await NotionExportService.exportSessionMarkdown(id, tk);

    expect(md.match(/### Bench Press\n/g)).toHaveLength(2);
    const [first, second] = md.split('### Bench Press\n').slice(1);
    expect(first).toContain('| 1 | 60 | 10 | - | - |\n| 3 | 60 | 9 | - | - |\n');
    expect(first).not.toContain('| 2 | 70');
    expect(second).toContain('| 2 | 70 | 8 | - | - |\n');
    expect(md).toContain('total_sets: 3\n');
    expect(md).toContain('total_volume: 1700\n');
  });
});

describe('NotionExportService.exportWeeklyReport', () => {
  // Week under test: Mon 2026-01-12 00:00 .. Sun 2026-01-18 23:59:59.999 (ISO week 3).
  function seedWeek() {
    const insert = (values: typeof sessions.$inferInsert) =>
      db.insert(sessions).values(values).returning({ id: sessions.id }).get().id;

    // Boundaries: 1ms before Monday and exactly next Monday are excluded.
    const before = insert({ startTime: local(2026, 1, 11, 23, 59, 59, 999), sRpe: 10, routineName: 'Before' });
    const mon = insert({ routineName: 'Push', startTime: local(2026, 1, 12, 0, 0, 0, 0), durationMinutes: 60, sRpe: 7, notes: 'Heavy day' });
    insert({ routineName: 'Rest', startTime: local(2026, 1, 14, 12) }); // no sRPE/duration/sets
    const deleted = insert({ routineName: 'Deleted', startTime: local(2026, 1, 15, 12), sRpe: 10, deletedAt: 1 });
    const sun = insert({ startTime: local(2026, 1, 18, 23, 59, 59, 999), sRpe: 8, durationMinutes: 45 });
    const next = insert({ startTime: local(2026, 1, 19, 0, 0, 0, 0), sRpe: 10, routineName: 'Next' });

    addSet({ sessionId: before, exerciseId: BENCH, exerciseName: 'Bench Press', setNumber: 1, weightKg: 1000, reps: 10 });
    addSet({ sessionId: next, exerciseId: BENCH, exerciseName: 'Bench Press', setNumber: 1, weightKg: 1000, reps: 10 });
    addSet({ sessionId: deleted, exerciseId: BENCH, exerciseName: 'Bench Press', setNumber: 1, weightKg: 1000, reps: 10 });

    // Mon: warmup listed but excluded from volume; 80*8 + 80*6 = 1120; carry 20*1 = 20 => 1140.
    addSet({ sessionId: mon, exerciseId: BENCH, exerciseName: 'Bench Press', setNumber: 1, weightKg: 20, reps: 10, isWarmup: true });
    addSet({ sessionId: mon, exerciseId: BENCH, exerciseName: 'Bench Press', setNumber: 2, weightKg: 80, reps: 8 });
    addSet({ sessionId: mon, exerciseId: BENCH, exerciseName: 'Bench Press', setNumber: 3, weightKg: 80, reps: 6 });
    addSet({ sessionId: mon, exerciseId: PLANK, exerciseName: 'Plank', setNumber: 4, weightKg: 0, reps: 0, durationSeconds: 60 });
    addSet({ sessionId: mon, exerciseId: CARRY, exerciseName: 'Farmer Carry', setNumber: 5, weightKg: 20, reps: 1, durationSeconds: 30 });

    // Sun: 100*5 + unnamed 50*2 = 600; soft-deleted set ignored.
    addSet({ sessionId: sun, exerciseId: SQUAT, exerciseName: 'Squat', setNumber: 1, weightKg: 100, reps: 5 });
    addSet({ sessionId: sun, exerciseId: SQUAT, exerciseName: null, setNumber: 2, weightKg: 50, reps: 2 });
    addSet({ sessionId: sun, exerciseId: SQUAT, exerciseName: 'Squat', setNumber: 3, weightKg: 100, reps: 100, deletedAt: 1 });
  }

  it('aggregates in-window sessions with exact frontmatter, summary and per-session sections', async () => {
    seedWeek();

    const r = await NotionExportService.exportWeeklyReport(tk, new Date(2026, 0, 14, 15));

    // Window: Mon 00:00:00.000 inclusive, next Mon 00:00:00.000 exclusive; deleted excluded.
    expect(r.sessionCount).toBe(3);
    expect(r.totalVolume).toBe(1740);
    expect(r.avgSRPE).toBe(7.5); // (7 + 8) / 2; null sRPE session not counted
    const expected = [
      '---',
      'week: 3',
      'date_range: "12/01 - 18/01"',
      'sessions: 3',
      'total_volume: 1740',
      'avg_srpe: 7.5',
      '---',
      '',
      '# reports.md.week 3 — 12/01 - 18/01',
      '',
      '## reports.md.summary',
      '',
      '- **reports.sessions:** 3',
      '- **reports.md.totalVolume:** 1.7k kg',
      '- **reports.avgSrpe:** 7.5',
      '',
      '## reports.md.sessions',
      '',
      '',
    ].join('\n');
    expect(r.markdown.slice(0, expected.length)).toBe(expected);

    // pins hardcoded pt-BR weekday (ignores t()); update if the service is localized
    const body = r.markdown.split('## reports.md.sessions\n\n')[1];
    expect(body).toBe([
      '### Seg. — Push (2026-01-12)',
      '',
      '**reports.md.duration:** 60 reports.md.min | **reports.md.volume:** 1.1k kg | **sRPE:** 7',
      '',
      '**Bench Press:** 10×20kg | 8×80kg | 6×80kg',
      '**Plank:** 60s',
      '**Farmer Carry:** 30s×20kg',
      '',
      '> Heavy day',
      '',
      '### Qua. — Rest (2026-01-14)',
      '',
      '**reports.md.duration:** 0 reports.md.min | **reports.md.volume:** 0 kg | **sRPE:** -',
      '',
      '',
      '### Dom. — reports.md.workout (2026-01-18)',
      '',
      '**reports.md.duration:** 45 reports.md.min | **reports.md.volume:** 600 kg | **sRPE:** 8',
      '',
      '**Squat:** 5×100kg',
      '**reports.md.unknown:** 2×50kg',
      '',
      '',
    ].join('\n'));
    expect(r.markdown).not.toContain('Before');
    expect(r.markdown).not.toContain('Next');
    expect(r.markdown).not.toContain('Deleted');
  });

  it('treats a Sunday reference date as the end of the same Mon-Sun week', async () => {
    seedWeek();
    const r = await NotionExportService.exportWeeklyReport(tk, new Date(2026, 0, 18, 23, 0));
    expect(r.sessionCount).toBe(3);
    expect(r.markdown).toContain('date_range: "12/01 - 18/01"');
    expect(r.markdown).toContain('week: 3\n');
  });

  it('treats Monday 00:00 reference as the start of its own week, not the previous one', async () => {
    seedWeek();
    const r = await NotionExportService.exportWeeklyReport(tk, new Date(2026, 0, 19, 0, 0, 0, 0));
    // Week of Mon 19/01..Sun 25/01 only contains the 'Next' session (sRPE 10, no volume).
    expect(r.sessionCount).toBe(1);
    expect(r.avgSRPE).toBe(10);
    expect(r.totalVolume).toBe(1000 * 10);
    expect(r.markdown).toContain('date_range: "19/01 - 25/01"');
    expect(r.markdown).toContain('week: 4\n');
    expect(r.markdown).toContain('- **reports.md.totalVolume:** 10.0k kg');
  });

  it('returns the empty-week result with ISO week label across a year boundary', async () => {
    // Thu 2026-01-01 -> Monday 2025-12-29, ISO week 1. DB is empty.
    // Empty-week result has no frontmatter; this pins current behavior.
    const r = await NotionExportService.exportWeeklyReport(tk, new Date(2026, 0, 1, 12));
    expect(r).toEqual({
      markdown: '# reports.md.week 1 — 29/12 - 04/01\n\nreports.noSessions',
      sessionCount: 0,
      totalVolume: 0,
      avgSRPE: 0,
    });
  });

  it('returns empty result when only out-of-window or soft-deleted sessions exist', async () => {
    db.insert(sessions).values([
      { startTime: local(2026, 1, 11, 23, 59, 59, 999), sRpe: 9 },
      { startTime: local(2026, 1, 13, 10), sRpe: 9, deletedAt: 5 },
    ]).run();
    const r = await NotionExportService.exportWeeklyReport(tk, new Date(2026, 0, 14));
    expect(r.sessionCount).toBe(0);
    expect(r.totalVolume).toBe(0);
    expect(r.avgSRPE).toBe(0);
    // Empty-week result has no frontmatter; pins current behavior.
    expect(r.markdown).toBe('# reports.md.week 3 — 12/01 - 18/01\n\nreports.noSessions');
  });

  it('rounds average sRPE to one decimal and shows "-" when no session has sRPE', async () => {
    db.insert(sessions).values([
      { startTime: local(2026, 1, 26, 9), sRpe: 7 },
      { startTime: local(2026, 1, 27, 9), sRpe: 8 },
      { startTime: local(2026, 1, 28, 9), sRpe: 8 },
    ]).run();
    const rounded = await NotionExportService.exportWeeklyReport(tk, new Date(2026, 0, 28));
    expect(rounded.avgSRPE).toBe(7.7); // 23 / 3 = 7.666...
    expect(rounded.markdown).toContain('avg_srpe: 7.7\n');

    const none = await NotionExportService.exportWeeklyReport(tk, new Date(2026, 1, 3));
    expect(none.sessionCount).toBe(0);

    db.insert(sessions).values({ startTime: local(2026, 2, 3, 9) }).run();
    const noSrpe = await NotionExportService.exportWeeklyReport(tk, new Date(2026, 1, 3));
    expect(noSrpe.sessionCount).toBe(1);
    expect(noSrpe.avgSRPE).toBe(0);
    expect(noSrpe.markdown).toContain('avg_srpe: 0\n');
    expect(noSrpe.markdown).toContain('- **reports.avgSrpe:** -\n');
  });
});

describe('NotionExportService.copyToClipboard', () => {
  it('writes the markdown to the clipboard', async () => {
    await NotionExportService.copyToClipboard('# hello');
    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('# hello');
  });

  it('propagates clipboard failures to the caller', async () => {
    (Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(new Error('clipboard denied'));
    await expect(NotionExportService.copyToClipboard('x')).rejects.toThrow('clipboard denied');
  });
});

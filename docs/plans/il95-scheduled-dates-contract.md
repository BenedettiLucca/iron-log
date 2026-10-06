# IL-95: Scheduled Session Dates + Reschedule Semantics

**Status:** PROPOSAL ONLY — no schema migration, no production change.
**Base:** `9c0b808`
**Related Issues:** #65 (schedule manifest), #67 (main-lane drift)
**Worktree:** local cwd

---

## 1. How Routines/Programs Attach to Calendar Today

### Current Model

The app currently has **no explicit per-session scheduled date**. Calendar attachment is derived structurally and indirectly:

### 1.1 Programs (Periodization)

From `src/db/schema.ts:142-154`:

```typescript
export const programs = sqliteTable('programs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  startDate: integer('start_date').notNull(), // Epoch
  endDate: integer('end_date').notNull(),     // Epoch
  weeksDuration: integer('weeks_duration').notNull().default(6),
  deloadWeek: integer('deload_week'),
  goal: text('goal').notNull().default('hypertrophy'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
});
```

### 1.2 Program Weeks (Routine → Week Link)

From `src/db/schema.ts:156-167`:

```typescript
export const programWeeks = sqliteTable('program_weeks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  programId: integer('program_id').notNull().references(() => programs.id),
  weekNumber: integer('week_number').notNull(),
  routineId: integer('routine_id').references(() => routines.id),
  phase: text('phase').notNull().default('accumulation'),
  rirTarget: integer('rir_target').default(0),
  intensityMod: real('intensity_mod').default(1.0),
}, (t) => [
  uniqueIndex("program_week_unique").on(t.programId, t.weekNumber),
]);
```

### 1.3 Sessions (Performed Workout)

From `src/db/schema.ts:43-54`:

```typescript
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id').references(() => routines.id),
  routineName: text('routine_name'), // Snapshot
  startTime: integer('start_time').notNull(), // Epoch timestamp
  endTime: integer('end_time'),
  bodyWeight: real('body_weight'),
  sRpe: integer('s_rpe'),
  notes: text('notes'),
  durationMinutes: integer('duration_minutes'),
  deletedAt: integer('deleted_at'), // Epoch, null = active
});
```

### 1.4 How Calendar Attachment Works Today

Today's calendar attachment is **implicit and derived**:

1. **Program scheduling:** `programs.startDate` / `programs.endDate` define the program window in epoch time. There is no per-week date — only `weekNumber`.

2. **Routine assignment:** `programWeeks.weekNumber` assigns a routine to week N of a program. The actual calendar day is computed at runtime.

3. **Today's workout resolution:** `services/TodayWorkoutService.ts:20-65` computes the "today workout" by:
   - Finding the active program (`programs.isActive === true`)
   - Computing `currentWeek = floor((now - startDate) / msPerWeek) + 1`
   - Looking up `programWeeks` for that `weekNumber` and `programId`
   - Returning the routine assigned to that week
   - There is **no per-session date tracking** — the same routine for a week is expected to be performed once, but there's no record of *which day* it was planned for vs actually done.

4. **Session recording:** `sessions.startTime` records when the session was **actually performed**, not when it was planned. There is no field for a planned/scheduled date.

5. **Volume/variance tracking:** `services/TrainingVarianceService.ts:62-134` and `services/program/dashboard.ts` group sessions by ISO week using `sessions.startTime`, treating all sessions within a week's boundaries as "the week's workout."

### Key Gap

| Concept | Current State |
|---|---|
| Planned date per session | **Not tracked** — only derived from program week number |
| Performed date | `sessions.startTime` (immutable epoch) |
| Reschedule semantics | **None** — sessions are recorded at performance time |
| Overdue detection | **None** — no way to know a session was planned but not performed |
| Occurrence identity | **None** — `getRoutineOccurrenceKey` in `src/utils/session-occurrence.ts:1-7` identifies exercise occurrences within a routine, not session instances |

---

## 2. Proposed Schema Delta (PROPOSAL ONLY)

### 2.1 New Columns on `sessions`

```typescript
// PROPOSAL — NOT IMPLEMENTED
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id').references(() => routines.id),
  routineName: text('routine_name'),
  startTime: integer('start_time').notNull(),       // PERFORMED — immutable
  endTime: integer('end_time'),                    // PERFORMED — immutable
  scheduledFor: integer('scheduled_for'),           // NEW: planned date (epoch, nullable)
  occurrenceId: text('occurrence_id'),              // NEW: deterministic occurrence key (nullable)
  bodyWeight: real('body_weight'),
  sRpe: integer('s_rpe'),
  notes: text('notes'),
  durationMinutes: integer('duration_minutes'),
  deletedAt: integer('deleted_at'),
});
```

### 2.2 Rationale for Minimal Delta

- **`scheduled_for`**: A nullable epoch timestamp representing the day the session was planned. Using epoch-at-midnight keeps day-boundary comparisons simple. Null means "not planned against a calendar date" (e.g., ad-hoc/standalone workouts not tied to a program schedule).

- **`occurrence_id`**: A deterministic, opaque identifier (e.g., `"program:12:week:3:day:2"` or UUID) that uniquely identifies a planned occurrence of a routine within a program. This allows rescheduling to reference the same logical plan without ambiguity. Nullable for sessions not tied to a scheduled occurrence.

- **`startTime`** and **`endTime`** remain **immutable performed timestamps**. They are never modified by rescheduling.

### 2.3 Indexing (PROPOSAL)

```sql
-- PROPOSAL: supports overdue query (planned but not yet performed)
CREATE INDEX idx_sessions_scheduled_for ON sessions(scheduled_for) WHERE scheduled_for IS NOT NULL AND endTime IS NULL;
```

---

## 3. Semantics

### 3.1 Actual Timestamps Are Immutable

`sessions.startTime` and `sessions.endTime` record **when the session was actually performed**. These are **write-once** values:

- A reschedule operation **does NOT modify** `startTime` or `endTime`.
- A reschedule only **moves** `scheduledFor` to a new planned date.
- Once a session is performed (has `startTime`), its performed timestamp is historical fact. It cannot be rewritten to make adherence look better.

### 3.2 Planned-vs-Done Distinction

- A session with `scheduledFor` set but `startTime` IS NULL = **planned, not yet performed** (an upcoming or overdue item on the calendar).
- A session with `scheduledFor` set AND `startTime` set = **planned + performed**. The gap between `scheduledFor` and `startTime` (in days) is a trust signal.
- A session with `scheduledFor` IS NULL and `startTime` set = **ad-hoc/standalone workout**, not tied to a scheduled calendar date.

### 3.3 Reschedule Moves Only the Planned Date

```
BEFORE reschedule:                     AFTER reschedule:
sessions {                             sessions {
  scheduled_for: 2026-10-07             scheduled_for: 2026-10-09  ← moved
  start_time:    2026-10-06              start_time:    2026-10-06  ← UNCHANGED
  end_time:      2026-10-06              end_time:      2026-10-06  ← UNCHANGED
}                                    }
```

The performed date stays true to what actually happened. Only the **plan** moves.

### 3.4 Overdue Detection

A session is **overdue** when:
- `scheduledFor` is set (was planned)
- `startTime` IS NULL (not yet performed)
- `scheduledFor` < device-local midnight of the current day

```
is_overdue = scheduled_for IS NOT NULL
             AND started_at IS NULL
             AND scheduled_for < (today_midnight_epoch)
```

Once the session is performed or the plan is moved to a future date, it is no longer overdue.

### 3.5 No Rewriting History to Look Adherent

The system **MUST NOT** retroactively set `startTime` to match a planned/completed session pair to artificially improve adherence metrics. `startTime` reflects reality. Trust is computed from the gap between plan and reality, not from collapsing them.

### 3.6 Timezone: Device-Local Day Boundaries

- Day boundaries are defined by the **device-local calendar**.
- `scheduledFor` stores epoch-at-midnight of the planned day **in device-local time** at the time of scheduling.
- Overdue/comparison queries compare `scheduledFor` against the device-local midnight of "today."
- If the user travels across timezones, the local day boundary moves with them. This is **intentional** — the schedule follows local time, not UTC.
- Sessions recorded in history preserve the original device-local day they were performed on (via `startTime`).

### 3.7 Occurrence Identity

`occurrenceId` provides a stable, resumable handle for a planned session slot:

- When a program schedules a routine for "Week 3, Tuesday," the occurrence key identifies that specific plan slot.
- If rescheduled, the same `occurrenceId` persists — only `scheduledFor` changes.
- This enables: re-entry after app restart, drift detection (planned vs. performed), and unambiguous history reconciliation.

---

## 4. RED Strategy Note

**Status:** RED phase — production code not yet implemented. Tests are written against a throwing stub (`services/session-schedule.ts`) that exports type interfaces and three functions (`scheduleSession`, `rescheduleSession`, `queryOverdueSessions`) each throwing `not implemented yet (issue #95 core slice)`. Every test case imports the stub, invokes a function, and asserts the DESIRED semantic outcome — these assertions legitimately FAIL because the stub throws, not because of vacuous `expect(true)` placeholders.

### Test semantics coverage:
- **scheduleSession:** Asserts planned date stored, performed timestamps untouched (performed flag false).
- **rescheduleSession:** Asserts only planned date moves; performed date/log immutable (startTime/endTime preserved as historical fact).
- **queryOverdueSessions:** Asserts scheduled-but-not-performed sessions returned until completed/rescheduled.
- **Day boundary:** Documented device-local midnight comparison requirement in test comments; timezone-aware overdue calculation is the implementation contract.

### RED verification:
`npm run typecheck` must yield 0 errors. ESLint on `services/session-schedule.ts` and `__tests__/services/session-schedule.test.ts` must yield 0 warnings. The Jest RED run must fail every case with the not-implemented throw (sample failure texts captured in the PR review body).

---

## 5. How Issue #67 (Main-Lane Drift) Will Consume This

Issue #67 ("main-lane drift: scheduled date + reschedule semantics") is currently listed as **DEFERRED** in `docs/qa/2026-09-15-sprint-trust-closure-disposition.md:31` with the note "depends of schedule truth." The `docs/qa/2026-08-26-ponyail-audit.md:112-114` dependency graph confirms: `#65 schedule manifest → #67 main-lane drift → #71 sleep-adjusted variance`.

The proposed `scheduledFor` + `occurrenceId` columns provide exactly the "schedule truth" that #67 needs. A drift status/analysis engine would: (1) compute the planned date from the program's start date + week assignment + weekday offset, storing it in `sessions.scheduledFor` and a deterministic `occurrenceId`; (2) compare `scheduledFor` against `startTime` to compute per-session drift (days late/early); (3) aggregate drift signals into a weekly/monthly adherence score; (4) when a session is rescheduled, only update `scheduledFor` while preserving `startTime` as the ground-truth performed timestamp. The overdue query defined in §3.4 gives #67 the raw "planned but not performed" signal to alert users on skipped days. The manifest (Issue #65) would expose `scheduledFor` in its export so that downstream consumers (Obsidian, Hermes) can render planned-vs-performed calendars. Because the proposal keeps performed timestamps immutable, historical drift analysis never gets corrupted by reschedule adjustments.

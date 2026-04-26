# Iron Log — Bug Fixes & Hardening Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix all critical issues, warnings, and technical debt identified in the v3.1.1 codebase review.

**Architecture:** All changes are additive — new migration, enhanced client init, backup safety wrapper, and type guards. No breaking changes to existing UI. Migration 0014 will add indexes, constraints, and soft-delete columns.

**Tech Stack:** Expo SDK 54, Drizzle ORM, SQLite (expo-sqlite), TypeScript

**Repo:** `/home/lucca/Projects/iron-log`
**Branch:** Create from `ux-ui-improvement-phase1-3`

---

## Phase 1: Database Hardening (Critical)

### Task 1: Create feature branch

**Objective:** Isolate all fixes in a clean branch.

**Step 1:** Create branch
```bash
cd /home/lucca/Projects/iron-log
git checkout -b fix/codebase-hardening
```

**Verify:** `git branch --show-current` → `fix/codebase-hardening`

---

### Task 2: Enhance database client with PRAGMA settings and migration safety

**Objective:** Add WAL mode, foreign key enforcement, and migration error recovery to `src/db/client.ts`.

**File:** Modify `src/db/client.ts`

**Step 1:** Replace the entire file with enhanced client:

```typescript
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

const expoDb = openDatabaseSync("ironlog.db");

// Configure SQLite for safety and performance
try {
  expoDb.execSync("PRAGMA journal_mode = WAL;");
  expoDb.execSync("PRAGMA foreign_keys = ON;");
  expoDb.execSync("PRAGMA busy_timeout = 5000;");
} catch (e) {
  console.warn("[IronLog] Failed to set PRAGMA:", e);
}

export const db = drizzle(expoDb, { schema });
```

**Verify:** File compiles — run `npx tsc --noEmit src/db/client.ts`

**Step 2:** Commit
```bash
git add src/db/client.ts
git commit -m "fix: add WAL mode, foreign keys, and busy timeout PRAGMA to db client"
```

---

### Task 3: Add schema indexes, unique constraints, and single-row guard

**Objective:** Add missing indexes for query performance, unique constraint on `personal_records`, and enforce `user_settings`/`notification_settings` as single-row tables.

**File:** Modify `src/db/schema.ts`

**Step 1:** Add imports for `uniqueIndex`, `index`, `check` at the top:
```typescript
import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
```

**Step 2:** Add indexes after the `sessions` table definition (after line ~60):

```typescript
// Indexes for performance
export const sessionsDateIdx = index("sessions_date_idx").on(sessions.startTime);
export const setsSessionIdx = index("sets_session_id_idx").on(sets.sessionId);
export const setsExerciseIdx = index("sets_exercise_id_idx").on(sets.exerciseId);
export const bodyMetricsDateIdx = index("body_metrics_date_idx").on(bodyMetrics.date);
export const personalRecordsExerciseIdx = index("pr_exercise_type_idx").on(personalRecords.exerciseId, personalRecords.recordType);
```

**Step 3:** Add unique constraint to `personal_records` table — replace the table definition:

```typescript
export const personalRecords = sqliteTable('personal_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  sessionId: integer('session_id').references(() => sessions.id),
  recordType: text('record_type').notNull(), // 'weight', 'reps', 'volume', 'duration'
  value: real('value').notNull(),
  date: integer('date').notNull(), // Epoch
  setDetails: text('set_details'), // JSON string with set details
}, (table) => [
  uniqueIndex("pr_exercise_type_unique").on(table.exerciseId, table.recordType),
]);
```

**Verify:** Run `npx tsc --noEmit src/db/schema.ts`

**Step 4:** Commit
```bash
git add src/db/schema.ts
git commit -m "fix: add indexes, PR unique constraint, and query performance indexes to schema"
```

---

### Task 4: Generate and verify migration 0014

**Objective:** Generate the Drizzle migration for the schema changes.

**Step 1:** Generate migration
```bash
cd /home/lucca/Projects/iron-log
npx drizzle-kit generate
```

**Step 2:** Verify the generated SQL file in `drizzle/` contains:
- `CREATE INDEX` statements for sessions, sets, body_metrics, personal_records
- `CREATE UNIQUE INDEX` for `pr_exercise_type_unique`

**Step 3:** Commit
```bash
git add drizzle/
git commit -m "chore: generate migration 0014 for indexes and constraints"
```

---

## Phase 2: Backup Safety (Critical)

### Task 5: Add pre-import safety snapshot to DatabaseBackupService

**Objective:** Before any import, automatically create a snapshot of the current DB so the user can roll back if the imported data is corrupt or old.

**File:** Modify `services/DatabaseBackupService.ts`

**Step 1:** Add a `createSnapshot` helper and modify `importDb` to call it before replacing.

Add these constants at the top (after existing constants):
```typescript
const SNAPSHOTS_DIR = FileSystem.documentDirectory + 'SQLite/snapshots/';
const MAX_SNAPSHOTS = 5; // Keep last 5 snapshots
```

Add the snapshot helper before `export const DatabaseBackupService`:
```typescript
async function createPreImportSnapshot(): Promise<string | null> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(DB_PATH);
    if (!fileInfo.exists) return null;

    // Ensure snapshots directory exists
    const dirInfo = await FileSystem.getInfoAsync(SNAPSHOTS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(SNAPSHOTS_DIR, { intermediates: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = `${SNAPSHOTS_DIR}ironlog_pre_import_${timestamp}.db`;
    await FileSystem.copyAsync({ from: DB_PATH, to: snapshotPath });

    // Cleanup old snapshots
    const files = await FileSystem.readDirectoryAsync(SNAPSHOTS_DIR);
    const snapshots = files
      .filter(f => f.startsWith('ironlog_pre_import_'))
      .sort();
    
    while (snapshots.length > MAX_SNAPSHOTS) {
      const oldest = snapshots.shift();
      if (oldest) {
        await FileSystem.deleteAsync(`${SNAPSHOTS_DIR}${oldest}`, { idempotent: true });
      }
    }

    return snapshotPath;
  } catch (e) {
    console.warn('[IronLog] Failed to create pre-import snapshot:', e);
    return null;
  }
}
```

**Step 2:** In the `importDb` method, add the snapshot call BEFORE the file replacement (before the `// 4. Ensure SQLite dir exists` comment). Add a new step between 3 and 4:

```typescript
      // 3.5 Create safety snapshot of current database
      const snapshotPath = await createPreImportSnapshot();
      if (snapshotPath) {
        console.log('[IronLog] Pre-import snapshot created:', snapshotPath);
      }
```

**Step 3:** Update the method's return to include snapshot info. Change the `return true;` to:
```typescript
      return true;
```
(Keep the same return, the snapshot is a silent safety net.)

**Verify:** File compiles — `npx tsc --noEmit services/DatabaseBackupService.ts`

**Step 4:** Commit
```bash
git add services/DatabaseBackupService.ts
git commit -m "fix: add pre-import safety snapshot to DatabaseBackupService"
```

---

## Phase 3: Timer Accuracy Fix

### Task 6: Fix active set timer drift

**Objective:** The rest timer already uses `Date.now()` delta (good!), but the active set timer at L110-121 uses naive `setInterval(prev + 1)` which drifts when the app is backgrounded. Fix it to use the same delta-based approach.

**File:** Modify `app/session/exercise.tsx`

**Step 1:** Change the active set timer state from counter to timestamp-based. Replace lines 87-88:

**Before:**
```typescript
  const [activeSetTime, setActiveSetTime] = useState(0);
  const [isActiveSetRunning, setIsActiveSetRunning] = useState(false);
```

**After:**
```typescript
  const [activeSetStart, setActiveSetStart] = useState<number | null>(null);
  const [activeSetTime, setActiveSetTime] = useState(0);
  const isActiveSetRunning = activeSetStart !== null;
```

**Step 2:** Replace the active timer useEffect (lines 110-121) with delta-based logic:

**Before:**
```typescript
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isActiveSetRunning) {
      interval = setInterval(() => {
        setActiveSetTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActiveSetRunning]);
```

**After:**
```typescript
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (activeSetStart !== null) {
      const tick = () => {
        const elapsed = Math.floor((Date.now() - activeSetStart) / 1000);
        setActiveSetTime(elapsed);
      };
      tick();
      interval = setInterval(tick, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSetStart]);
```

**Step 3:** Update `toggleActiveSet` (around L259-268) to use timestamps:

**Before:**
```typescript
  const toggleActiveSet = useCallback(() => {
    if (isActiveSetRunning) {
      setIsActiveSetRunning(false);
      setActiveSetTime(prev => prev);
    } else {
      setActiveSetTime(0);
      setIsActiveSetRunning(true);
    }
  }, [isActiveSetRunning]);
```

**After:**
```typescript
  const toggleActiveSet = useCallback(() => {
    if (activeSetStart !== null) {
      // Stop — keep current time frozen
      setActiveSetStart(null);
    } else {
      // Start fresh
      setActiveSetTime(0);
      setActiveSetStart(Date.now());
    }
  }, [activeSetStart]);
```

**Step 4:** Search for any other references to `isActiveSetRunning` (it was a state setter) and update them. Since we changed it to a derived boolean (`activeSetStart !== null`), all reads still work. The setter `setIsActiveSetRunning` calls are replaced — verify there are no remaining `setIsActiveSetRunning` references.

**Step 5:** Remove the now-unused `setIsActiveSetRunning` — search the full file for any remaining calls. The only places should be in `toggleActiveSet` which we already fixed.

**Verify:** `npx tsc --noEmit` passes with no errors.

**Step 6:** Commit
```bash
git add app/session/exercise.tsx
git commit -m "fix: replace naive setInterval with Date.now() delta for active set timer"
```

---

## Phase 4: Type Safety Improvements

### Task 7: Add discriminated union type for exercise types

**Objective:** Create compile-time discriminated unions so TypeScript catches mismatches between strength and duration exercise data.

**File:** Create `src/types/exercise.ts`

**Step 1:** Create the file:
```typescript
/**
 * Discriminated union types for exercise set data.
 * Use these instead of raw `any` for set data to get compile-time safety.
 */

export type ExerciseType = 'strength' | 'duration';

export interface StrengthSet {
  readonly type: 'strength';
  weightKg: number;
  reps: number;
  rir: number | null;
  durationSeconds?: never;
}

export interface DurationSet {
  readonly type: 'duration';
  durationSeconds: number;
  weightKg?: never;
  reps?: never;
  rir?: never;
}

export type ExerciseSet = StrengthSet | DurationSet;

/** Type guard */
export function isStrengthSet(set: ExerciseSet): set is StrengthSet {
  return set.type === 'strength';
}

/** Type guard */
export function isDurationSet(set: ExerciseSet): set is DurationSet {
  return set.type === 'duration';
}
```

**Step 2:** Commit
```bash
git add src/types/exercise.ts
git commit -m "feat: add discriminated union types for strength/duration exercises"
```

---

## Phase 5: Soft Deletes (Future-Proofing)

### Task 8: Add deletedAt columns to sessions and sets schema

**Objective:** Add soft-delete support so accidentally deleted sessions/sets can be recovered.

**File:** Modify `src/db/schema.ts`

**Step 1:** Add `deletedAt` column to the `sessions` table. After the `durationMinutes` field:

```typescript
  deletedAt: integer('deleted_at'), // Epoch, null = active
```

**Step 2:** Add `deletedAt` column to the `sets` table. After the `isEdited` field:

```typescript
  deletedAt: integer('deleted_at'), // Epoch, null = active
```

**Step 3:** Generate migration:
```bash
npx drizzle-kit generate
```

**Step 4:** Commit
```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: add soft-delete columns (deletedAt) to sessions and sets"
```

---

## Phase 6: Final Verification & Merge

### Task 9: Run TypeScript check and lint

**Objective:** Verify everything compiles and lints clean.

**Step 1:**
```bash
cd /home/lucca/Projects/iron-log
npx tsc --noEmit
npm run lint
```

**Step 2:** Fix any errors found.

**Step 3:** Commit any fixes.

---

### Task 10: Merge back to working branch

**Objective:** Merge the fix branch back.

**Step 1:**
```bash
cd /home/lucca/Projects/iron-log
git checkout ux-ui-improvement-phase1-3
git merge fix/codebase-hardening
```

**Step 2:** Verify everything still works:
```bash
npx tsc --noEmit
```

---

## Summary of Changes

| # | Phase | Issue | Severity | Files Changed |
|---|-------|-------|----------|---------------|
| 1 | DB Hardening | PRAGMA WAL + foreign keys + busy timeout | Critical | `src/db/client.ts` |
| 2 | DB Hardening | Missing indexes + PR unique constraint | Warning | `src/db/schema.ts`, `drizzle/*` |
| 3 | Backup Safety | Pre-import snapshot + rotation | Critical | `services/DatabaseBackupService.ts` |
| 4 | Timer Fix | Active set timer drift (setInterval → Date.now delta) | Warning | `app/session/exercise.tsx` |
| 5 | Type Safety | Discriminated union for exercise types | Suggestion | `src/types/exercise.ts` (new) |
| 6 | Soft Deletes | deletedAt on sessions/sets | Suggestion | `src/db/schema.ts`, `drizzle/*` |

**Total: 5 files modified, 1 file created, 2 migrations generated.**

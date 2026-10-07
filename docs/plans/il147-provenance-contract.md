# Issue #147: Body-Weight Provenance Contract & Architecture Specification

## 1. Executive Summary & Problem Diagnosis

### The Defect Today
When an athlete completes a workout session in Iron Log, the finish screen (`app/session/finish.tsx`) pre-populates the body weight field using the athlete's most recent entry from `body_metrics` (`type = 'daily'`). If the user does not weigh themselves and simply reviews and confirms the session, this **borrowed/carried weight is recorded as if it were measured during the session**:

1. **`sessions.body_weight` Pollution**: In `services/SessionLifecycleService.ts` (`finishSession`), `params.weight` is parsed and directly written into `sessions.body_weight`. Even though no physical scale measurement occurred today, the session is stamped as having measured that weight.
2. **`body_metrics` Pollution**: In `finishSession`, whenever `parsedWeight !== null`, an `INSERT INTO body_metrics (date, type, weight)` is unconditionally executed. As a result, finishing a workout without weighing in creates a **synthetic duplicate weigh-in row** in the athlete's bio-tracking timeline at `endTimestamp`. If a user trains 4 times in a week without measuring weight, 4 synthetic data points are injected into their body-composition analytics (`services/AnalyticsService.ts`, `app/bio/analytics.tsx`), distorting trends and falsely certifying weigh-in frequency.
3. **Summary & Export Misrepresentation**: `buildSessionSummary` (`src/utils/session-summary.ts`) and summary views (`app/session/summary.tsx`, `app/session/finish.tsx`) present this borrowed weight as an unannotated, authoritative measurement. If the field is left empty/null, summaries fail to display the user's latest real measurement with clear context.

---
## 2. Real Symbols & Codebase References

| Layer / Feature | File Path | Relevant Symbols & Lines | Current Behavior |
|---|---|---|---|
| **Finish Screen UI** | `app/session/finish.tsx` | Lines 101–114 (`loadData`), Lines 230–236 (`confirmFinish`), Lines 335–355 (`TextInput`) | Reads latest `bodyMetrics` row, sets `setWeight(lastMetrics[0].weight.toString())`, and passes `weight` to `SessionLifecycleService.finishSession`. |
| **Session Lifecycle** | `services/SessionLifecycleService.ts` | Lines 10–17 (`FinishSessionParams`), Lines 201–259 (`finishSession`) | Parses `params.weight`, executes `tx.update(sessions).set({ bodyWeight: parsedWeight })`, and unconditionally executes `tx.insert(bodyMetrics).values({ date: endTimestamp, type: 'daily', weight: parsedWeight })`. |
| **Routine Start UI** | `app/session/[routineId].tsx` | Lines 203–215 (`initSession`), Lines 232–251 (`dismissBodyWeightDialog`) | Pre-fills `lastWeight` from `bodyMetrics` into `bodyWeightInput`; if confirmed, saves to `sessions.bodyWeight` and inserts duplicate into `bodyMetrics`. |
| **Database Schema** | `src/db/schema.ts` | Lines 43–54 (`sessions.bodyWeight`), Lines 85–99 (`bodyMetrics`) | `sessions.bodyWeight` is a nullable `real('body_weight')`. `bodyMetrics` stores physical measurements (`weight`, `date`, `type`). |
| **Workout Summary** | `src/utils/session-summary.ts` | Lines 32–40 (`SummarySession`), Lines 129–131 (`buildSessionSummary`) | Outputs `⚖️ ${t('summary.reportWeight')}: ${session.bodyWeight \|\| 'N/A'} kg`. Lacks provenance indicator or carried-weight resolution. |
| **CSV Exporter** | `services/CsvExportService.ts` | Lines 71–86, 275–315 (`exportSessionCsv`, `exportSessionsCsv`) | Outputs `# Peso: ${session.bodyWeight \|\| '-'} kg` in markdown header comments and raw `session.bodyWeight` in CSV rows without provenance markers. |
| **Notion Exporter** | `services/NotionExportService.ts` | Lines 63–72 (`exportSessionMarkdown`) | Frontmatter outputs `body_weight: ${session.bodyWeight \|\| '-'}` with no provenance key or annotation. |
| **Alexandria Exporter** | `services/AlexandriaExportService.ts` | Lines 131–204 (`buildSessionRecord`) | Output metadata contains `metadata: { body_weight: session.bodyWeight ?? null }` without provenance differentiation. |
| **Database Restore** | `services/DatabaseBackupService.ts` | Lines 19–27, 57–95 (`REQUIRED_SCHEMA_TABLES`, backup validation) | Direct SQLite file backup and restore. Schema compatibility must remain intact across versions. |
| **CSV Importers** | `services/importers/db-executor.ts` | Lines 75–87 (`executeImport`) | Maps imported session `bodyWeight: sessionData.bodyWeight ?? null`. Never fabricates synthetic `body_metrics` rows. |

---
## 3. The 5 Contract Invariants

### Invariant (a): `sessions.body_weight` stays NULL when not measured this session
- **Rule**: `sessions.body_weight` represents a measurement taken during or specifically for that workout session.
- **Contract**: If the user finishes a workout without measuring their weight during the session, `sessions.body_weight` MUST remain `NULL`.
- **UI Contract**: In `app/session/finish.tsx`, displaying the athlete's previously measured weight is for informational context only. The form state must differentiate between:
  - An explicitly measured weight entered/modified by the user (`isWeightMeasured = true`, `weightProvenance = 'measured'`).
  - A pre-filled carried weight that the athlete did not measure today (`isWeightMeasured = false`, `weightProvenance = 'borrowed'`).
- **Service Contract**: `SessionLifecycleService.finishSession` must receive this provenance indicator. When `weightProvenance === 'borrowed'` (or `isWeightMeasured === false`), `tx.update(sessions)` must set `bodyWeight: null`.

### Invariant (b): Reports display most recent MEASURED weight with explicit provenance
- **Rule**: Athlete reports and session summaries must never conceal relevant biological context, but must be honest about data provenance.
- **Contract**: When `session.body_weight` is `NULL`, `buildSessionSummary` (`src/utils/session-summary.ts`) and summary views (`app/session/summary.tsx`, `app/session/finish.tsx`) must resolve the most recent measured weight from `body_metrics` (or prior session) and display it with explicit provenance:
  - E.g.: `⚖️ Peso: 78.5 kg (anterior, 12/03/2026)` or `⚖️ Weight: 78.5 kg (carried from 2026-03-12)`.
  - When weight was measured during the session, it displays the standard measured indicator: `⚖️ Weight: 79.2 kg (measured)`.
  - If no prior measurement exists, it displays `⚖️ Weight: N/A kg`.
- **Integrity**: Athletes always see their weight context for volume-load calculations, but are never misled into thinking a measurement took place on session day.

### Invariant (c): NEVER insert a synthetic `body_metrics` row for borrowed weight
- **Rule**: `body_metrics` is the athlete's ground-truth biological record. Synthetic or borrowed values must never contaminate this table.
- **Contract**: In `services/SessionLifecycleService.ts`, the block:
  ```ts
  if (parsedWeight !== null && isWeightMeasured) {
    tx.insert(bodyMetrics).values({ date: endTimestamp, type: 'daily', weight: parsedWeight }).run();
  }
  ```
  must **strictly require** that the weight was measured during the session. If `weightProvenance === 'borrowed'`, `tx.insert(bodyMetrics)` must **NEVER** be called.

### Invariant (d): Provenance markers live in REPORTS, not in per-session export rows (Option 1)
Under the RECOMMENDED **Option 1 (zero-migration, strict invariant)** architecture, per-session
export labels are **REMOVED**. A borrowed session stores `sessions.body_weight = NULL`; there is no
stored borrowed value in the session row to label, so no per-session exporter may fabricate a
`(borrowed)` label on the session's own export row. The provenance marker instead lives in the
**REPORT layer**, which reads `body_metrics` history and resolves the most recent MEASURED value:

- **REPORT layer (where the marker lives)**: Report builders that read `body_metrics` history
  resolve the most recent measured value (where `date <= session.startTime`) and display it with an
  explicit carried/borrowed marker, e.g. `⚖️ Weight: 78.5 kg (carried from 2026-03-12)`.
- **Per-session export rows (NO synthetic label under Option 1)**:
  - **Alexandria (`services/AlexandriaExportService.ts`)**: `buildSessionRecord` metadata
    `body_weight: session.bodyWeight ?? null` — when the session did not measure, this is `null`.
    No synthetic `body_weight_provenance` key is added to the per-session record (there is no stored
    borrowed value to label).
  - **CSV Exporter (`services/CsvExportService.ts`)**: `exportSessionCsv` outputs `# Peso: - kg`
    (placeholder) when the session's `body_weight` is NULL. No `(borrowed)` marker on the session row.
  - **Notion Exporter (`services/NotionExportService.ts`)**: `exportSessionMarkdown` frontmatter
    outputs `body_weight: -` when the session's `body_weight` is NULL. No `body_weight_provenance`
    synthetic key.
- **DECIDED (owner, 2026-10-06): per-session `(borrowed)` export labels are declined.** Option 1
  (zero-migration, strict invariant) is confirmed as the permanent design for weight provenance:
  provenance lives exclusively in reports built from `body_metrics` history; per-session export rows
  carry no borrowed label of any kind. Any future requirement for per-session labels must arrive as a
  new issue proposing its own design (e.g. an Option 2 schema with `body_weight_provenance`), with
  its own owner approval and migration gate.

### Invariant (e): Restore & import compatibility rule
- **Database Restores (`services/DatabaseBackupService.ts`)**:
  - Older Iron Log backups contain existing historical sessions where `sessions.body_weight` is already populated. Restoring these databases must succeed without DDL errors or data loss.
  - The application must treat historical `sessions.body_weight` gracefully: legacy rows with non-null `body_weight` are accepted as valid historic records.
- **External Importers (`services/importers/db-executor.ts`, `TrackerImportService.ts`)**:
  - Importers from Strong, Hevy, FitNotes, etc., map external workout weights directly to `sessions.body_weight`.
  - When external imports lack body weight, `sessions.body_weight` is set to `NULL`.
  - Importers must **never** synthesize entries in `body_metrics` for imported sessions unless the user explicitly triggers a bio-metric synchronization.

---
## 4. RED Test Verification & Observed Failures

The test suite in `__tests__/services/session-finish-provenance.test.ts` executes against current production code.

### Test Execution Summary
Command: `npm test -- --runTestsByPath __tests__/services/session-finish-provenance.test.ts --watchAll=false --maxWorkers=2`
Result: **6 failed, 3 passed, 9 total**

### Detailed Test Failures (Current Production Defects)

1. **Contract Rule (a) — `sessions.body_weight` stays NULL for borrowed weight**:
   - **Assertion**: `expect(session?.bodyWeight).toBeNull();`
   - **Captured Failure**:
     ```
     expect(received).toBeNull()
     Received: 78.5
     at Object.<anonymous> (__tests__/services/session-finish-provenance.test.ts:134:35)
     ```
   - **Root Cause**: `finishSession` in `services/SessionLifecycleService.ts` unconditionally updates `sessions.bodyWeight` with `parsedWeight`.

2. **Contract Rule (c) — NEVER insert synthetic `body_metrics` row for borrowed weight**:
   - **Assertion**: `expect(allMetrics).toHaveLength(1);` (only the initial seed measurement should exist)
   - **Captured Failure**:
     ```
     expect(received).toHaveLength(expected)
     Expected length: 1
     Received length: 2
     Received array: [
       {"date": 1000000, "id": 1, "type": "daily", "weight": 78.5},
       {"date": 4700000, "id": 2, "type": "daily", "weight": 78.5}
     ]
     at Object.<anonymous> (__tests__/services/session-finish-provenance.test.ts:212:26)
     ```
   - **Root Cause**: `finishSession` unconditionally runs `tx.insert(bodyMetrics)` whenever `parsedWeight !== null`.

3. **Contract Rule (b) — Reports display most recent measured weight with explicit provenance**:
   - **Assertion**: `expect(summary.report).toMatch(/78\.5\s*kg\s*(\(borrowed\)|\(carried\)|\(anterior\)|\(medido em)/i);`
   - **Captured Failure**:
     ```
     expect(received).toMatch(expected)
     Expected pattern: /78\.5\s*kg\s*(\(borrowed\)|\(carried\)|\(anterior\)|\(medido em)/i
     Received string:
     "💪 WORKOUT Treino A - [24/04/2024]
     ⚖️ Weight: N/A kg | ⏱️ Duration: 45 min | 🔥 sRPE: 8
     [Supino Reto]: S1: 8x80kgxRIR2..."
     at Object.<anonymous> (__tests__/services/session-finish-provenance.test.ts:289:30)
     ```
   - **Root Cause**: `buildSessionSummary` in `src/utils/session-summary.ts` checks `session.bodyWeight || 'N/A'`. When null, it falls back to `'N/A'` without querying or formatting the latest measured weight with provenance.

4. **Contract Rule (d) — Alexandria export marks borrowed values in metadata**:
   - **Assertion**: `expect(record.metadata).toHaveProperty('body_weight_provenance', 'borrowed');`
   - **Captured Failure**:
     ```
     expect(received).toHaveProperty(path, value)
     Expected path: "body_weight_provenance"
     Received path: []
     Expected value: "borrowed"
     Received value: {"body_weight": 78.5, "routine_id": 1, "routine_name": "Treino A", "set_count": 1}
     at Object.<anonymous> (__tests__/services/session-finish-provenance.test.ts:330:31)
     ```
   - **Root Cause**: `buildSessionRecord` in `services/AlexandriaExportService.ts` only sets `{ body_weight: session.bodyWeight }`.

5. **Contract Rule (d) — CSV export (borrowed session, bodyWeight NULL + prior bodyMetrics)**:
   - **Rewritten Test 7 (coherent under Option 1)**: Session has `bodyWeight = NULL`; previous `bodyMetrics` measurement (78.5 at 1713500000000) exists; CSV header outputs `# Peso: - kg`; no `(borrowed)` marker (per-session labels removed); `buildSessionSummary` must resolve carried weight with provenance — **FAILS** (`N/A` output, missing capability).
   - **Captured Failure**: 
     ```
     Expected pattern: /78\.5\s*kg\s*(\(borrowed\)|\(carried\)|\(anterior\)|\(medido em\))/i
     Received string: "💪 WORKOUT Treino A - [24/04/2024]·
     ⚖️ Weight: N/A kg | ⏱️ Duration: 60 min | 🔥 sRPE: 8·
     [Supino Reto]: S1: 8x80kgxRIR2··
     ## summary.verdicts.title
     - [Supino Reto] summary.verdicts.result: summary.verdicts.resultNoTarget"
     at Object.<anonymous> (__tests__/services/session-finish-provenance.test.ts:410:30)
     ```
   - **Root Cause**: `buildSessionSummary` lacks `bodyMetrics` lookup; per-session export correctly shows placeholder (no contradiction).

6. **Contract Rule (d) — Notion export (borrowed session, bodyWeight NULL + prior bodyMetrics)**:
   - **Rewritten Test 8 (coherent under Option 1)**: Session has `bodyWeight = NULL`; previous `bodyMetrics` measurement exists; Notion frontmatter outputs `body_weight: -`; no `body_weight_provenance` synthetic key (per-session labels REMOVED); `buildSessionSummary` resolution fails (`N/A` output, legitimate RED).
   - **Captured Failure**:
     ```
     Expected pattern: /78\.5\s*kg\s*(\(borrowed\)|\(carried\)|\(anterior\)|\(medido em\))/i
     Received string: "💪 WORKOUT Treino A - [24/04/2024]·
     ⚖️ Weight: N/A kg | ⏱️ Duration: 60 min | 🔥 sRPE: 8·
     [Supino Reto]: S1: 8x80kgxRIR2··
     ## summary.verdicts.title
     - [Supino Reto] summary.verdicts.result: summary.verdicts.resultNoTarget"
     at Object.<anonymous> (__tests__/services/session-finish-provenance.test.ts:490:30)
     ```
   - **Root Cause**: `buildSessionSummary` lacks `bodyMetrics` lookup; session export shows no synthetic label (coherent with Option 1).

### Passing Tests (Baseline Integrity)
- `preserves measured weight behavior: persists session.body_weight when explicitly measured`: **PASS** (Verifies that real measured entries are recorded).
- `writes body_metrics row when weight was explicitly measured during session`: **PASS** (Verifies that real measurements update `body_metrics`).
- `preserves NULL body_weight on import and does not fabricate synthetic body_metrics rows`: **PASS** (Verifies that external CSV importers already preserve null weights without generating fake metrics).

---
## 5. PROPOSAL: Database Schema Migration Options

*Note: As per Issue #147 instructions, NO schema migration is applied in this slice. Below are the architectural options for subsequent implementation.*

### Option 1: Strict Invariant Architecture (Zero Migration) — **RECOMMENDED**
- **Mechanism**:
  - `sessions.body_weight` strictly retains its semantic definition: **The body weight measured during this workout session**.
  - When not measured this session, `sessions.body_weight` is stored as `NULL`.
  - In `FinishSessionParams`:
    ```ts
    export interface FinishSessionParams {
      sessionId: number;
      startTime?: number;
      endTime?: number;
      weight?: string | number | null;
      isWeightMeasured?: boolean; // Default false if merely borrowed
      sRpe?: number | null;
      notes?: string | null;
    }
    ```
  - When `isWeightMeasured === false`:
    - `sessions.body_weight` is set to `NULL`.
    - No insert into `body_metrics` is performed.
  - When generating **reports** (not per-session exports):
    - If `session.bodyWeight` is `NULL`, the report/query layer fetches the most recent `body_metrics` record where `date <= session.startTime`.
    - If found, the **report** displays this weight with `(carried from YYYY-MM-DD)` or `(borrowed)` provenance (e.g., in weekly summaries, session reports, analytics).
    - Per-session export rows under Option 1 contain the session's actual measured value (or placeholder `-` when NULL) — no synthetic provenance label is fabricated on the export row.
- **Pros**:
  - Zero database schema changes; 100% backward compatible with existing SQLite databases and backups.
  - Pure, normalized data model: `sessions.body_weight` is never ambiguous.
  - No database migration risks across active installs.
- **Cons**:
  - Report and summary builders must query the latest `body_metrics` row when `session.bodyWeight` is `NULL` to display carried weight. Per-session exporters (CSV, Notion, Alexandria) do **not** fabricate provenance labels; they show the session's own `bodyWeight` value or placeholder.

### Option 2: Additive Column Migration (`body_weight_provenance`)
- **Mechanism**:
  - Alter `sessions` table to add `body_weight_provenance TEXT DEFAULT NULL`:
    ```sql
    ALTER TABLE sessions ADD COLUMN body_weight_provenance text;
    ```
  - Update `src/db/schema.ts`:
    ```ts
    export const sessions = sqliteTable('sessions', {
      // ... existing columns
      bodyWeight: real('body_weight'),
      bodyWeightProvenance: text('body_weight_provenance'), // 'measured' | 'borrowed' | null
    });
    ```
  - If a user finishes a workout and chooses to snapshot the borrowed weight on the session record itself:
    - `sessions.body_weight = 78.5`
    - `sessions.body_weight_provenance = 'borrowed'`
    - `body_metrics` insert is **skipped**.
- **Pros**:
  - Session table self-contains the displayed weight without needing a second join/query against `body_metrics`.
- **Cons**:
  - Requires running `drizzle-kit generate` to create migration `0015_add_body_weight_provenance.sql`.
  - Drizzle table recreations on mobile SQLite can trigger PRAGMA foreign_key constraints or DQS incompatibilities on legacy devices.
  - Violates the principle that `sessions` should only record what occurred during the session.

### Recommendation
Proceed with **Option 1 (Strict Invariant)** for the implementation phase:
1. It maintains complete database integrity without risk of migration failure on user devices.
2. It ensures `body_metrics` remains the single source of truth for physical body weight history.
3. It guarantees that `sessions.body_weight` is never contaminated with synthetic or carried data.
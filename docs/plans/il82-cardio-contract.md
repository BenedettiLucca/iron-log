# Contract IL82 — Cardio as exercise type (DECIDED 2026-10-07)

> Status: **DECIDED** (owner decision 2026-10-06) — no production edit, no `drizzle-kit generate`, no `app/` change.  
> Worktree: `epic/il-82-cardio` (cwd) · Base: `9c0b808` · Auth: LOCAL EDITS YES / COMMIT NO / PUSH NO.  
> Owner decision: distance is an editable input per session — there is NO fixed list of standard distances. PR = fastest time for the EXACT distance_meters value recorded; longest-distance-per-duration stays unchanged. `STANDARD_CARDIO_DISTANCES_METERS` removed from policy and tests.

---

## 1. Evidence — how exercise types are modeled TODAY

Source of truth: `src/db/schema.ts` (READ-ONLY verified; lines cited).

### 1.1 Exercise definition (`exercises` table, lines 19–26)

```ts
export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull().default('strength'), // 'strength' | 'duration'
  muscleGroup: text('muscle_group'),
  equipment: text('equipment'),
  defaultRestSeconds: integer('default_rest_seconds').default(90),
});
```

- `type` is a free `text` with no enum constraint at DB level; production uses `'strength'` (default) and `'duration'` (plank, hang, cardio sessions).
- `duration` is the ONLY existing non-strength exercise type (line 22 comment; confirmed by `__tests__/services/personal-record-reconcile.test.ts` line 645: `type: 'duration'` for Plank; `services/AlexandriaExportService.ts` line 102: `hasCardio = exerciseTypes.includes('duration')`).
- No `cardio` literal type exists today; the app already maps `duration` exercises to `workout_type: 'cardio'` in export (`AlexandriaExportService.ts` 99–107).

### 1.2 Set recording (`sets` table, lines 57–82)

```ts
export const sets = sqliteTable('sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => sessions.id),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  exerciseName: text('exercise_name'), // Snapshot
  setNumber: integer('set_number').notNull(),
  weightKg: real('weight_kg').notNull(),     // always required (default 0 for cardio)
  reps: integer('reps').notNull(),            // always required (default 0 for cardio)
  durationSeconds: integer('duration_seconds'), // time-based (plank / hang / run duration)
  rir: integer('rir'),
  isWarmup: integer('is_warmup', { mode: 'boolean' }).notNull().default(false),
  ...
});
```

- `durationSeconds` already exists (line 65); it is the canonical time field for `duration`-type exercises.
- **`distance_meters` does NOT exist** (verified by schema + fixture DDL `__tests__/fixtures/database.ts` line 97: only `duration_seconds` declared between `reps` and `rir`).
- `weightKg` and `reps` are `.notNull()`; for pure cardio (run, bike) they are stored as `0` (confirmed by `services/AlexandriaExportService.ts` 171: `duration_s` exported, `weight_kg`/`reps` kept as `0` when null in DB).
- Index `sets_exercise_deleted_idx` (line 78) and compound index (line 81) both use `(exerciseId, deletedAt)` — distance would need its own index if added later.

### 1.3 Personal Records (`personalRecords` table, lines 130–140)

```ts
export const personalRecords = sqliteTable('personal_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  sessionId: integer('session_id').references(() => sessions.id),
  recordType: text('record_type').notNull(), // 'weight' | 'reps' | 'volume' | 'duration'
  value: real('value').notNull(),
  date: integer('date').notNull(), // Epoch
  setDetails: text('set_details'), // JSON string with set details
}, ...);
```

- `recordType` values observed in production: `'weight'`, `'reps'`, `'duration'` (`hooks/use-personal-records.ts` 10, 94, 245; `personal-record-reconcile.test.ts` throughout).
- `duration` PR = **maximum** duration (plank hold, hang) — confirmed by `use-personal-records.ts` 249: `if (!existingDurationPR || duration > existingDurationPR.value)`.
- There is **no** `distance` or `pace` or `timePerDistance` `recordType`; the unique index `pr_exercise_type_unique` (line 139) is on `(exerciseId, recordType)`.

### 1.4 Analytics / volume aggregates (`services/AnalyticsService.ts`)

- `computeStrengthScoreFromData` (line 208–210): `allSets.filter(s => !s.isWarmup && s.reps > 0 && s.weightKg > 0)` — sets with `reps=0` or `weightKg=0` are excluded from volume.
- `computeVolumeTrendsFromData` (line 354): `entry.volume += (set.weightKg * set.reps)` — cardio sets contribute `0`.
- `volumeByMuscleGroup` (line 753): `SUM(weightKg * reps)` joins `sets → exercises → sessions`; `duration` exercises with `muscleGroup = null` go to `'outros'` but contribute `0` volume because `reps=0` or `weightKg=0`.
- `calculateEstimated1RMs` (line 703+) requires `reps > 0 && weightKg > 0`; duration exercises never appear.
- Weekly report (`app/reports/weekly.tsx` line 98: `volumeDisplay` uses `totalVolume` from analytics — cardiac sessions are invisible to volume, visible to session count via `sessions` table only).

### 1.5 Exercise type classification (`services/AlexandriaExportService.ts` 99–107)

```ts
export function computeWorkoutType(exerciseTypes: string[]): string {
  const hasCardio = exerciseTypes.includes('duration');
  const hasStrength = exerciseTypes.includes('strength');
  if (hasCardio && hasStrength) return 'other';
  if (hasCardio) return 'cardio';
  return 'strength';
}
```

- `duration` is already the contract for cardio in export; `workout_type` is `'cardio'`.
- No separate `cardio` string exists; proposal should NOT invent a new type literal unless owner decides.

---

## 2. PROPOSAL — minimal delta for cardio type (NO SCHEMA CHANGE IN THIS LANE)

This is a **contract/proposal** only. Implementation requires a separate authorization (issue or PR) and `drizzle-kit generate`.

### 2.1 Canonical fields (if added later — proposal)

| Field | Table | Canonical | Notes |
|---|---|---|---|
| `distance_meters` | `sets` | `real` nullable | Distance covered (run: 5000, bike: 20000). **NOT** in schema today. |
| `duration_seconds` | `sets` | `integer` nullable | Already exists; time covered (20 min = 1200s). |
| `reps` | `sets` | `integer` notNull | Stored as `0` for pure cardio; preserved for mixed sets (e.g., interval work with weight). |
| `weightKg` | `sets` | `real` notNull | Stored as `0` for pure cardio. |

**Proposal:** keep `durationSeconds` canonical for time; add `distanceMeters` (nullable `real`) only when owner approves. Do NOT invent `pace_seconds_per_km` as stored — display-only.

### 2.2 Derived display-only (no DB storage)

| Derived | Source | Display format (#136 conventions — see §2.4) |
|---|---|---|
| Pace (min/km) | `duration_seconds / 60 / (distance_meters / 1000)` | `min/km` primary; `min/mi` only if user locale is `en-US` / imperial setting |
| Speed (km/h) | `distance_meters / 1000 / (duration_seconds / 3600)` | `km/h` metric; `mph` imperial display only |
| Distance format | `distance_meters` | metric `m / km` stored; imperial `mi / ft` display only |

### 2.3 PR semantics (distance-based — proposal, NOT current)

Current PR logic (`use-personal-records.ts`) handles `duration` as **maximum time** (plank). For cardio, PR needs different semantics per distance:

- **Fastest time per standard distance** (e.g., 5k): PR = lowest `duration_seconds` for `distance_meters = 5000`. `recordType` proposal: `'time_per_distance'` or keep `'duration'` with new `setDetails` carrying `distanceMeters`.
- **Longest distance per fixed duration** (e.g., 30-min run): PR = highest `distance_meters` for `duration_seconds = 1800`.
- **NO tonnage / e1RM invented for cardio** — `estimateE1RM` (line 103) must never be called on cardio sets (`reps=0` or `weightKg=0` yields `0` already, but contract should explicitly exclude).
- No `recordType` `volume` for cardio (volume = `kg × reps`; meaningless for distance-only).

### 2.4 Unit display via #136 conventions (referenced; verified from `src/i18n/translations/en.ts` and `docs/i18n/README.en.md`)

- **Metric is canonical** (stored): `kg` (weight), `cm` (measurements), `km` (distance), `min/km` (pace), `km/h` (speed).
- **Imperial is display-only** (conversion at render, never stored): `lbs`, `in`, `mi`, `min/mi`, `mph`.
- Evidence: `bioEvolution.weightLabel` = `'Weight'` with `kg` unit; `bioGoals.weight` = `'Weight (kg)'`; body-metrics uses `cm`; `reports.volume` = volume in `kg`; `reports.duration` = minutes (no imperial conversion in analytics).
- Cardio proposal must follow same rule: store `distance_meters`, `duration_seconds`; display `km` / `m` for metric users, `mi` for imperial users; never dual-store.

---

## 3. How history / reports treat cardio sets (documented current + desired)

### 3.1 Strength volume (current — correct by design for strength)

- `AnalyticsService.calculateStrengthScore` (line 208–210) requires `reps > 0 && weightKg > 0`; cardio sets contribute `0`.
- `volumeByMuscleGroup` (line 753) sums `weightKg * reps`; cardio with `0` contributes `0`; if `muscleGroup = null`, falls to `'outros'` but still `0`.
- **Proposed behavior (desired):** keep strength volume excluding cardio (cardio is not strength tonnage); add a separate `cardioMetrics` line or note that weekly report shows session count for cardio but volume line is strength-only.

### 3.2 Weekly report (`app/reports/weekly.tsx` / `src/i18n/translations/en.ts` line 1167–1194)

Report fields verified from translations:
- `reports.sessions`: session count (includes cardio — session table has no exercise-type filter).
- `reports.volume`: total volume (excludes cardio — derived from analytics `totalVolume`).
- `reports.avgSrpe`: average RPE (session-level, includes cardio).
- `md.duration`: session duration (includes cardio via `duration_minutes`).
- No `cardioDistance` or `cardioPace` report field exists; proposal could add to Markdown template if owner wants.

### 3.3 Session finish / activity classification (`app/session/finish.tsx` line 63; `src/i18n/translations/en.ts` 502)

- `finish.cardio` and `finish.cardioText` already exist in i18n; user can tag a session as cardio manually.
- `workout_type: 'cardio'` is computed from `exercise.type = 'duration'` (export service), not from user tag.
- Proposal: if `distance_meters` is added, `finish` could auto-compute `workout_type = 'cardio'` when any set in session has `distance_meters > 0`.

---

## 4. RED evidence — what the tests capture (see `__tests__/services/cardio-policy.test.ts`)

Because this is a **proposal**, no RED test asserts an implemented feature; it asserts **missing contract** and documents the gap.

| Test | Real import | Failure reason (RED) | What it captures |
|---|---|---|---|
| `record cardio set -> canonical fields` | `db.insert(sets)` + `@/src/db/schema` | `sets.distanceMeters` is `undefined`; schema has only `durationSeconds` | Schema gap: no distance field for 5k/10k/half-maratona |
| `PR detection for standard distance` | `@/hooks/use-personal-records` `checkPersonalRecordsSync` + `personalRecords` | Current `recordType='duration'` takes `max(duration)` (plank semantics); faster 5k (1080s < 1200s) does NOT update PR | PR semantics wrong for distance-based sport: lower time = better |
| `cardio excluded from strength aggregates` | `@/services/AnalyticsService` `calculateVolumeTrends` | Strength volume is `0` for cardio (correct); property `cardioDistanceOrPace` missing; no separate cardio aggregate | Reports don't distinguish cardio from rest; no pace/distance metric exists |

All three import real production functions/policies (not mocked formulas). All fail for the correct reason: the contract (distance storage + distance-based PR + cardio reporting) does not exist yet.

---

## 5. Owner decisions required (not agent decisions)

### 5.1 Which distances are "standard" for PRs?

**DECIDED:** There is NO fixed list of standard distances. Distance is an editable input per session (canonical meters). PR semantics: for a new cardio set (distance_meters, duration_seconds), find prior sets with the **same distance_meters value** and flag PR if strictly faster. Longest-distance-per-duration stays as is. The `STANDARD_CARDIO_DISTANCES_METERS` concept has been removed from the policy and its associated tests.

Options that were considered:
- `[500, 1000, 1500, 3000, 5000, 10000, 21097, 42195]` meters (500m / 1k / 1.5k / 3k / 5k / 10k / half / marathon)
- Or only 5k (`5000`) and 10k (`10000`) for MVP?
- Should PR table allow arbitrary distance (store `distanceMeters` per PR row) or only a fixed list?

Evidence reference: `personalRecords` unique index is `(exerciseId, recordType)` — if we want "fastest 5k" and "fastest 10k" as separate PRs for same exercise, we need either (a) new `recordType` per distance or (b) `recordType='time_per_distance'` + `setDetails` storing distance. Both need schema/index review. Owner chose: exact-distance matching without a fixed standard list.

### 5.2 Pace format default?

- **Primary:** `min/km` (metric; standard in Brazil/Portugal/Spain/China — all app locales `pt/en/es/zh` use metric weight `kg` / measurements `cm`).
- **Imperial display only:** `min/mi` when user settings indicate imperial (no such setting exists in `userSettings` today — `userSettings` has `defaultWeight`, `height`, `sex`; no `units` field).
- **Speed alternative:** `km/h` vs `mph`.
- **Proposal recommendation:** default `min/km` display; imperial conversion at render layer only (follow `#136` — metric canonical, imperial display).

---

## 6. Constraint check (contract compliance)

| Constraint | Status | Evidence |
|---|---|---|
| Read-only `src/db/schema.ts` | ✅ | Only cited; no edit |
| New doc allowed (`docs/plans/il82-cardio-contract.md`) | ✅ | Created |
| RED-only test (`__tests__/services/cardio-policy.test.ts`) | ✅ | Created; imports real services/hooks; no production source edited |
| No schema migration | ✅ | Zero `npx drizzle-kit generate`; no `drizzle/` edit |
| No production change | ✅ | No `app/`, `services/`, `hooks/`, `src/db/` edit except read verification |
| Uncommitted | ✅ | `git status` shows untracked only |
| Gates to run | ⏳ | `npm run typecheck` + `npx eslint ... --max-warnings=0` + RED `npm test ...` (next section) |

---

## 7. References (read-only, cited by file/line)

- `src/db/schema.ts`: 19 (exercises), 57 (sets), 130 (personalRecords)
- `services/AlexandriaExportService.ts`: 99 (`computeWorkoutType`), 102 (`duration` as cardio), 171 (`duration_s`)
- `hooks/use-personal-records.ts`: 10 (`CheckPRResult`), 249 (`duration > existing` — max semantics)
- `services/AnalyticsService.ts`: 103 (`estimateE1RM` — never for cardio), 208–210 (volume filter), 753 (`SUM` volume)
- `__tests__/services/personal-record-reconcile.test.ts`: 645 (`duration` PR, Plank)
- `__tests__/fixtures/database.ts`: 27–34 (DDL — no `distance_meters`)
- `src/i18n/translations/en.ts`: 502 (`cardio`), 864 (`kg`), 1173 (`reports.duration`)
- `docs/i18n/README.en.md`: 23 (time-based exercises), 176 (import format `type: 'duration'`)

---

*Document authored under Contract Lane — Issue #82. No commit; no push; Hermes review required before any schema or service modification.*

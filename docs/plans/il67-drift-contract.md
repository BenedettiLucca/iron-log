# IL-67: Main-Lane Drift Status + Re-entry Guidance Contract

**Status:** PROPOSAL & CONTRACT ONLY — No schema migration, no production runtime changes.  
**Related Issues:** #95 (scheduled dates anchor), #65 (schedule manifest), #71 (sleep-adjusted variance)  
**Worktree:** `/home/lucca/Projects/iron-log-wt/il67`  
**Branch:** `epic/il-67-drift`  
**Base:** `d53fd02` (contains reviewed #95 anchor `services/session-schedule.ts` and contract doc)

---

## 1. Executive Summary & Architectural Context

Issue #67 defines the contract for detecting **main-lane training drift** and generating **advisory re-entry guidance** when an athlete's training cadence deviates from their scheduled program.

In `docs/qa/2026-08-26-ponytail-audit.md:112-114` and `docs/plans/il95-scheduled-dates-contract.md:222-227`, the dependency order for schedule and adherence truth is established as:
```text
#65 schedule manifest ──> #95 scheduled dates anchor ──> #67 main-lane drift ──> #71 sleep-adjusted variance
```

Issue #95 introduced the schedule truth anchor (`services/session-schedule.ts`):
- `scheduledFor` (planned device-local midnight epoch);
- `occurrenceId` (stable occurrence identity);
- `OverdueQueryResult` (`{ scheduledFor, occurrenceId, sessionId }`).

Issue #67 directly consumes these schedule semantics to compute whether the athlete is:
1. **`on_track`**: Maintaining the expected main-lane cadence within configured thresholds;
2. **`drifting`**: Has planned-but-not-performed main-lane sessions beyond the drift threshold;
3. **`lapsed`**: Has experienced an extended hiatus (>= lapsed threshold) from main-lane stimulus.

---

## 2. Lane Classification Metadata Proposal

### 2.1 Why Training Lanes?
In progressive overload resistance training, sessions fall into fundamentally different functional categories:
- **Main Lane**: Compound movements, periodized primary lifts, and program-assigned progression blocks (e.g., Squat/Bench/Deadlift days, primary Push/Pull/Legs mesocycle sessions). Progression in the main lane drives structural adaptation and systemic fatigue.
- **Accessory Lane**: Isolated arm work, direct calf work, mobility/prehab, conditioning, feeder workouts, or ad-hoc pump sessions.

If every workout were treated equally:
- An athlete who skips 3 weeks of squatting/benching but logs 5 bicep/cardio sessions would falsely appear "on track" in naive streak systems.
- Conversely, legitimate recovery/feeder work would trigger false alarms if not categorized.

**Default Rule:** Accessory-only training periods **do NOT count as main-lane activity** and **do NOT reset the main-lane drift timer**.

### 2.2 Storage / Metadata Options

We evaluate three design options for persisting lane classification:

| Option | Schema Delta | Pros | Cons |
|---|---|---|---|
| **Option A: Routine-Level Tag/Column** | Add `lane` or `tags` to `routines` table (`routines.lane TEXT DEFAULT 'main'`) | Templates carry lane identity permanently; zero per-session overhead. | Cannot dynamically reclassify an ad-hoc session that used a main template as accessory work. |
| **Option B: Session-Level Column** | Add `lane` to `sessions` table (`sessions.lane TEXT DEFAULT 'main'`) | Granular per-session override; snapshot of performance intent. | Requires user or app to assign lane on every logged session if no routine template exists. |
| **Option C: Hybrid (Inferred from Program Attachment + Routine Tag)** | Read `programWeeks.routineId` link; fallback to routine `folder` / `tags` | Zero schema migration required immediately; backward-compatible. | Derivation logic required in query layer; requires conventions on folders/tags. |

### 2.3 Proposed Lane Classification Contract

```typescript
export type LaneType = 'main' | 'accessory';

export interface LaneClassification {
  lane: LaneType;
  confidence: 'explicit' | 'inferred';
  reason: string;
  routineId?: number | null;
  tag?: string | null;
}
```

The classifier function `classifyLane(input)` resolves:
1. **Explicit lane:** If a session or routine specifies `explicitLane: 'main' | 'accessory'`, that classification is returned with confidence `'explicit'`.
2. **Program-linked session:** If `isProgramSession === true` (session attached to an active `programWeeks` entry), classified as `'main'` with confidence `'inferred'`.
3. **Routine tags / Folder:** If routine has tag `'accessory'` or folder matches accessory keywords (`'Accessory'`, `'Cardio'`, `'Mobilidade'`), classified as `'accessory'`. Otherwise, templates in active folders default to `'main'`.
4. **Ad-hoc / Unlinked:** Standalone sessions not linked to a routine or program default to `'accessory'` unless explicitly tagged.

### 2.4 Owner Decision Flags (Flagged for Review)
- **[FLAG-1: Storage location]** Should lane classification be stored as an explicit column on `routines` (`routines.lane: 'main' | 'accessory'`), a general tags array (`routines.tags: text JSON`), or a column on `sessions` (`sessions.lane`)?
  *Recommendation:* Add `lane` column to `routines` (defaulting to `'main'`), and allow `sessions.lane` to override if needed in a future migration.
- **[FLAG-2: Accessory decay attenuation]** Does logging high-volume accessory work provide *any* attenuation to the drift counter, or is it strictly 0% attenuation?
  *Default:* Strictly zero attenuation. A 10-day squat hiatus is a 10-day squat hiatus regardless of bicep curls.

---

## 3. Drift Semantics & Detection Engine

### 3.1 Consuming Issue #95 Semantics

Issue #95 introduces overdue query results from planned sessions:
```typescript
import type { OverdueQueryResult } from '@/services/session-schedule';
// OverdueQueryResult: { scheduledFor: number, occurrenceId: string | null, sessionId: number }
```

In accordance with #95 principles:
- **Performed timestamps are immutable**: `sessions.startTime` is historical reality. Rescheduling moves `scheduledFor`, but historical performance timestamps are never rewritten.
- **Day boundaries are device-local**: Comparisons use device-local midnight epoch timestamps.

### 3.2 Formal Drift Definition

Main-lane drift is defined as **the gap between the device-local current day and the most recent performed main-lane session, corroborated by planned-but-not-performed main-lane sessions beyond the drift threshold**:

```text
daysSinceLastMain = floor((todayMidnightEpoch - lastMainSessionMidnightEpoch) / msPerDay)

if daysSinceLastMain <= driftThresholdDays:
    status = 'on_track'
elif daysSinceLastMain < lapsedThresholdDays:
    status = 'drifting'
else:
    status = 'lapsed'
```

If overdue main-lane sessions exist from #95 (`overdueSessions.length > 0`) and `daysSinceLastMain > driftThresholdDays`, the system transitions from `on_track` to `drifting`.

### 3.3 Owner-Tunable Threshold Constants

Thresholds are defined as exported constants with explicit owner configurability:

```typescript
/**
 * Default threshold in days without a main-lane session before entering 'drifting' status.
 * Standard training cadence accommodates 2-3 rest days between same-lane stimuli.
 * 4 days allows a normal 3-day weekend or scheduled deload split without triggering drift.
 */
export const DEFAULT_DRIFT_THRESHOLD_DAYS = 4;

/**
 * Default threshold in days without a main-lane session before entering 'lapsed' status.
 * At 14+ days (2 full weeks), neuromuscular acclimation and work capacity decay
 * necessitate a progressive re-entry ramp-up.
 */
export const DEFAULT_LAPSED_THRESHOLD_DAYS = 14;
```

These values can be overridden per user or per program via `DriftThresholdConfig`:
```typescript
export interface DriftThresholdConfig {
  driftThresholdDays?: number;
  lapsedThresholdDays?: number;
}
```

---

## 4. Re-Entry Guidance (Advisory Engine)

### 4.1 Strict Product Invariants

1. **ADVISORY-ONLY — Never Blocks Logging**:
   Re-entry guidance is purely consultative. The athlete remains 100% in control. The application **MUST NEVER**:
   - Prevent the athlete from starting a session;
   - Force a deload or lock out exercise weights;
   - Intercept session start with mandatory confirmation dialogs.
   The `ReentryGuidance` interface enforces this structurally via `advisoryOnly: true`.

2. **INFORMATIONAL TREND LANGUAGE ONLY — Zero Clinical / Injury Wording**:
   The app provides fitness trend tracking, not medical advice. Language must focus strictly on **work capacity, training cadence, volume acclimation, and freshness**.
   - **FORBIDDEN WORDS**: `injury`, `injured`, `risk of injury`, `clinical`, `pathology`, `atrophy`, `rehab`, `rehabilitation`, `prescription`, `medical clearance`, `muscle damage`.
   - **PERMITTED / ENCOURAGED PHRASES**: "training hiatus", "cadence gap", "reacclimate work capacity", "volume adjustment", "re-entry ramp-up", "working sets adjustment".

### 4.2 Guidance Output Structure

```typescript
export interface ReentryGuidance {
  action: 'maintain_cadence' | 'resume_normal' | 'reduce_volume' | 'ramp_up';
  volumeScaleFactor: number;       // Range: 0.50 to 1.00
  intensityScaleFactor: number;    // Range: 0.80 to 1.00
  recommendedWorkingSetsMultiplier?: number;
  daysSinceLastMain: number;
  status: DriftStatusCode;
  advisoryOnly: true;              // Enforces advisory guarantee
  summary: string;                 // Trend summary string
  notes?: string[];                // Non-clinical actionable suggestions
}
```

### 4.3 Volume & Intensity Scaling Model

The pure function `buildReentryGuidance(input)` calculates adjustments based on `daysSinceLastMain`:

| Gap (Days) | Status | Recommended Action | Volume Scale | Intensity Scale | Advisory Rationale |
|---|---|---|---|---|---|
| **0 – 4** | `on_track` | `resume_normal` | **1.00** (100%) | **1.00** (100%) | Training cadence on track. Resume scheduled session volume. |
| **5 – 7** | `drifting` | `reduce_volume` | **0.85** (85%) | **1.00** (100%) | 5-7 day cadence gap. Consider dropping 1 working set per exercise to manage acute soreness while maintaining target loads. |
| **8 – 13** | `drifting` | `reduce_volume` | **0.75** (75%) | **0.90** (90%) | 8-13 day training gap. Reduce total working volume by ~25% and leave 2-3 reps in reserve (RIR) to rebuild work capacity. |
| **14+** | `lapsed` | `ramp_up` | **0.65** (65%) | **0.85** (85%) | Extended hiatus (14+ days). Progressive ramp-up advised: start at ~65% volume and acclimation loads for session 1. |

---

## 5. TypeScript Contract & Throwing Stub

The module `services/lane-drift.ts` defines all types and functions as a throwing stub:

```typescript
export function classifyLane(_input: ClassifyLaneInput): LaneClassification {
  throw new Error('lane drift not implemented yet (issue #67 core slice)');
}

export function computeDriftStatus(_input: ComputeDriftStatusInput): DriftStatus {
  throw new Error('lane drift not implemented yet (issue #67 core slice)');
}

export function buildReentryGuidance(_input: BuildReentryGuidanceInput): ReentryGuidance {
  throw new Error('lane drift not implemented yet (issue #67 core slice)');
}
```

---

## 6. RED Test Verification Strategy

The test suite in `__tests__/services/lane-drift.test.ts` imports the real stub and asserts the desired functional contract across 5 core scenarios:

1. **Recent Main Session -> `on_track`**: Verifies that a main session performed 2 days ago yields `status: 'on_track'` and `daysSinceLastMain: 2`.
2. **Planned-Not-Performed Past Threshold -> `drifting`**: Consumes an overdue scheduled session from #95 with a 6-day gap, verifying `status: 'drifting'`.
3. **Way Past Threshold -> `lapsed`**: Verifies that a 20-day hiatus triggers `status: 'lapsed'`.
4. **Volume Reduction & Non-Clinical Language**: Verifies that re-entry guidance scales down volume (< 1.0), sets `action: 'ramp_up'`, enforces `advisoryOnly: true`, and contains no clinical/injury wording.
5. **Accessory Sessions Do Not Reset Drift**: Verifies that performing an accessory session yesterday does not reset the 8-day gap from the last main session.

Every test fails via the throwing stub with:
`Error: lane drift not implemented yet (issue #67 core slice)`

---

## 7. Owner Decisions & Questions List

1. **Routine Schema Metadata vs Tag Array**:
   - *Question:* Should we add a dedicated column `lane TEXT DEFAULT 'main' CHECK(lane IN ('main', 'accessory'))` to `routines`, or introduce a JSON `tags` column?
   - *Trade-off:* Dedicated column is strictly typed, query-indexable, and simple. JSON tags allow arbitrary user categorization.
   - *Recommendation:* Dedicated column `lane` on `routines`.

2. **Program Session Presumption**:
   - *Question:* Should all sessions linked to `program_weeks` unconditionally be classified as `main` unless explicitly marked accessory?
   - *Recommendation:* Yes. Program mesocycles structure core progressive overload; ad-hoc unscheduled workouts default to accessory.

3. **Drift Notification / UI Placement**:
   - *Question:* Where should drift status be displayed to the user?
   - *Options:*
     - A subtle status chip in the Home / Today header ("Main lane: On track" vs "Main lane: 5d gap").
     - An informational accordion above the "Start Workout" button offering a "One-tap volume adjustment" toggle.
   - *Recommendation:* Informational chip on Home, plus an optional one-tap "Acclimation mode" button inside the active session sheet.

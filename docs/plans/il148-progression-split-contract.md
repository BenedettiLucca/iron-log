# Contract: Separate Progression Evaluation from Session Logging (IL-148)

## Current State: Where Evaluation Lives

Progression evaluation (verdict + suggested next load) is currently entangled with session logging in the finish flow:

- **Evaluation logic**: `src/utils/session-verdicts.ts`
  - `generateExerciseVerdict(exerciseId, exerciseName, targetStr, sets, t)` → returns `ExerciseVerdict` containing `verdict`, `nextLoadSuggestion`, `result`, `confidence`, `flags`.
  - `generateSessionVerdicts(setsData, targetsMap, t)` → groups sets by routine occurrence and calls `generateExerciseVerdict` per exercise.

- **Call site at finish time**: `src/utils/session-summary.ts`
  - `buildSessionSummary({ session, setsData, targetsMap, t, locale })` → calls `generateSessionVerdicts` to populate `verdicts` in the result (line ~155).
  - The verdicts are then used to render the textual summary (lines ~155-182) and passed to markdown renderer.

- **Report formats that consume verdicts** (epic/il-151-notion-tests):
  - **Notion export**: `services/NotionExportService.ts` imports `generateSessionVerdicts` and `buildSessionVerdictsMarkdown` to produce verdict sections in Notion pages.
  - **Session summary screen**: The summary displayed at the end of a workout (via `buildSessionSummary`) shows verdicts and suggested loads.
  - **Markdown export**: `src/utils/session-verdict-markdown.ts` converts `ExerciseVerdict[]` to markdown via `buildSessionVerdictsMarkdown`.

All of the above mix evaluation (pure function of exercise history + performed set) with I/O (fetching targets, formatting for persistence/display).

## Desired Pure Policy Interface

Create a new module: `services/progression-policy.ts` that exports pure domain types and a pure function:

```typescript
export interface ExerciseHistoryEntry {
  weightKg: number;
  reps: number;
  rir?: number | null;
}

export interface PerformedSet {
  weightKg: number;
  reps: number;
  rir?: number | null;
}

export type ProgressionVerdict = 'hold' | 'increase' | 'review_fatigue' | 'check_logging';

export type SuggestedLoad = string | null;

export type ProgressionResult = 'below' | 'within' | 'top' | 'no_target';

export type ProgressionConfidence = 'low' | 'medium' | 'high';

export interface ExerciseTarget {
  sets: number;
  minReps: number;
  maxReps: number;
}

export interface ProgressionPolicyInput {
  /** Historical sets for this exercise (ordered chronologically, oldest first). */
  history: ExerciseHistoryEntry[];
  /** The performed sets in the just‑finished session (ordered by setNumber). */
  performed: PerformedSet[];
  /** Target prescription for this exercise (if any). */
  target: ExerciseTarget | null;
}

export interface ProgressionPolicyOutput {
  /** Verdict: 'hold' | 'increase' | 'review_fatigue' | 'check_logging'. */
  verdict: ProgressionVerdict;
  /** Suggested next load as a human‑readable string (null if no suggestion). */
  nextLoadSuggestion: SuggestedLoad;
  /** Classification result ('below' | 'within' | 'top' | 'no_target'). */
  result: ProgressionResult;
  /** Confidence level. */
  confidence: ProgressionConfidence;
  /** Anomaly flags. */
  flags: string[];
}

export function evaluateProgression(input: ProgressionPolicyInput): ProgressionPolicyOutput;
```

The function **must not** perform any I/O, database access, or async operations. It depends only on its inputs.

## Wiring Seam: Where to Call the Pure Policy

At session finish time (in `app/session/finish.tsx` or the session lifecycle service), the flow should be:

1. Gather inputs:
   - `history`: query the last N sessions for this exercise (excluding the current session) – this is the logging/persistence concern.
   - `performed`: extract from the just‑finished session's sets (excluding warm-ups).
   - `target`: load from `programExerciseTargets` for the current program/exercise (still a DB read, but isolated).
2. Call the pure policy: `const output = evaluateProgression({ history, performed, target });`
3. Use `output` to:
   - Update the session record with any derived fields (if needed).
   - Produce the verdicts for the summary and for export services (by mapping `output` to the existing `ExerciseVerdict` shape, adding `exerciseId`, `exerciseName`, `workingSets`, etc.).
4. Existing rendering code (summary, markdown, Notion) remains unchanged because it consumes the `ExerciseVerdict` shape; we only replace the internal call to `generateSessionVerdicts` with a wrapper that prepares inputs and calls the pure policy, then maps the output back.

Thus, the split is achieved by extracting the pure function and keeping the data-gathering and mapping steps separate.

## No Schema Change

This contract does not require any database schema modification; it only refactors where the evaluation logic resides.

## Related Files (Read-Only per Allowlist)

- `services/progression.ts` (current double-progression logic – unchanged)
- `services/` (verdict/progression/analytics modules – read-only)
- `app/session/` finish flow (read-only)
- Existing session tests (read-only)
- Fixtures (read-only)

## RED Strategy (Throwing Stub Convention)

To maintain a valid RED test suite that satisfies compiler, typechecker, and linter gates without prematurely implementing product logic:

1. **Minimal Throwing Stub**: `services/progression-policy.ts` is initially introduced with real exported domain types (`ExerciseHistoryEntry`, `PerformedSet`, `ProgressionVerdict`, `SuggestedLoad`, `ProgressionPolicyInput`, `ProgressionPolicyOutput`) and an `evaluateProgression()` function that unconditionally throws:
   `throw new Error('progression policy not implemented yet (issue #148 core slice)')`.
2. **Valid RED Execution**: Tests import the real module and call `evaluateProgression()`. The test files compile cleanly (`tsc --noEmit` exits 0, `eslint` exits 0) and fail deterministically at runtime solely due to the missing-capability throw.
3. **Core Slice Replacement**: In the subsequent core slice (`148-core`), the throwing stub body is replaced with the pure evaluation logic to turn all tests GREEN.

## RED Test Requirements

Test file: `__tests__/services/progression-policy.test.ts`

The RED tests must cover:
1. **Load increase**: When all performed sets hit top of rep range (e.g. 10 reps in 6-10 range at 80kg, compared to history baseline 8 reps at 80kg), verdict is `increase` with next load suggestion `82.5kg`.
2. **Same-load-more-reps**: When reps improve (e.g. 6 -> 8 reps at 80kg in 6-10 range) but not at top of range (8 < 10), verdict is `hold` with `within` result.
3. **Regression**: When performed reps drop below target min reps from history baseline (e.g. 8 reps down to 5 reps with minReps 6), verdict is `hold` with `below` result.
4. **Insufficient history**: When history is empty or fewer entries than required baseline (<min history), verdict is `hold`; and when fewer sets are performed than target sets (incomplete session), verdict is `hold` with `below` result.
5. **Heavier load performance**: When stepping up load (e.g. 82.5kg vs history 80kg baseline), evaluated against history baseline.

Each test imports from the desired pure API location `@/services/progression-policy` and asserts on `verdict`, `result`, and `nextLoadSuggestion`.
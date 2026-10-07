# IL-66: Micro-Session Mode Contract

**Epic:** il-66-micro  
**Branch:** contract/ep/il-66-micro-session-contract  
**Worktree:** your cwd (`9c0b808`)  

---

## Overview

Micro-session = fast logged session for accessory/home protocols. Few taps to complete a quick workout: pick routine/exercises, perform single set per exercise with quick load/reps steppers, explicit finish.

---

## Flow Design (UX)

### 1. Entry Point
- User selects **Micro Mode** → picks a pre-defined routine OR exercises directly.
- Entry options:
  - **Quick Pick:** Reuse last micro session routine (frequently used)
  - **Routine List:** Tap a saved routine (same as normal entry, but filters to "micro-compatible" routines)
  - **Exercise Search:** Pick 1–N exercises from library (for home/gadget protocols)

### 2. Per-Exercise Single Set
- For each selected exercise:
  - **Load Stepper:** +/- buttons or numeric keypad (supports localized decimal: "72,5" → 72.5)
  - **Reps Stepper:** +/- or numeric
  - **Rest:** **Suppressed by default** (see Owner Questions)
  - **Side:** **DEFERRED from v1** (see PROPOSAL below — no schema change; L/R is an owner question, not a shipped feature)

### 3. Explicit Finish
- Finish button always visible, never auto-finalizes
- Computes same summary shape as normal session:
  - `sessionId`, `routineName`, `startTime`, `endTime`, `durationMinutes`, `bodyWeight`, `sRpe`, `notes`
- Persists to EXISTING tables only (no new schema)

---

## Persistence Mapping

| Micro Session Concept | DB Table | Fields | Normal Session Equivalent |
|----------------------|----------|--------|---------------------------|
| Session | `sessions` | `id`, `routineId?`, `routineName`, `startTime`, `endTime`, `durationMinutes`, `bodyWeight`, `sRpe`, `notes` | Same table |
| Exercise Set | `sets` | `id`, `sessionId`, `exerciseId`, `exerciseName`, `setNumber`, `weightKg`, `reps`, `isWarmup=false`, `createdAt` | Same table |
| Rest Timer | *suppressed* | — | `NotificationService.scheduleRestNotification()` |

**Key Points:**
- `sessions.routineId` may be NULL (freestyle) or set (routine-based)
- `sets.routineExerciseId` is NULL for micro (no occurrence identity needed)
- `sets.restSeconds` does not exist (rest timer lives in `NotificationService` only for normal sessions)
- `sets.setNumber` always 1 per exercise (single set contract)
- Soft delete `sessions.deletedAt`, `sets.deletedAt` behave identically

---

## PROPOSAL: Side Support Resolution

**Status:** **DECIDED (owner, 2026-10-06): side support is deferred indefinitely.** v1 ships micro-session WITHOUT side; no `side` column on `sets`; no toggle. If it ever returns, it arrives as a new issue proposing the nullable `side` column + UI as a separate owner-approved migration gate.

**Contradiction resolved:** The draft flow originally claimed "L/R side support with NO schema change" but `sets` table (`src/db/schema.ts:57-82`) has no `side` column. Minimal side support requires either:
1. **Schema delta:** Add nullable `side` column on `sets` (e.g., `text('side')` with values `'L' | 'R' | NULL`). Requires owner-approved migration window and backfill strategy for existing data.
2. **Defer from v1 (DEFAULT):** Ship micro-session without side; owner explicitly asked whether v1 should include it. If YES, schema delta + migration is a separate gate before v1 merge.

**Default position:** Defer side from v1. If owner requests side in v1, the schema delta + migration is a separate pre-merge gate. i18n keys for side (`microSession.set.side`, `left`, `right`) are reserved in namespace but NOT implemented in v1.

---

## i18n Key Namespace Proposal

**Pattern:** `microSession.<feature>.<localeKey>`

```
microSession: {
  entry: {
    title: 'Micro Treino',
    pickRoutine: 'Escolha o treino',
    pickExercise: 'Escolha os exercícios',
    quickPick: 'Último usado',
  },
  set: {
    label: 'Série Única',
    weight: 'Carga',
    reps: 'Repetições',
    restOff: 'Descanso: OFF',
  },
  finish: {
    button: 'Finalizar',
    confirm: 'Salvar sessão?',
    summary: {
      title: 'Resumo',
      exercises: 'Exercícios',
      sets: 'Séries',
      duration: 'Duração',
    },
  },
}
```

**All 4 locales** (pt, en, es, zh) will implement full keys. Namespace isolated to avoid collision with existing `session`, `exercise`, `set` keys.

---

## Interaction with #81 Occurrence Removal

**Actual removal semantics (read from `services/SessionOccurrenceService.ts`, branch `epic/il-81-contract`):**
- #81 does NOT remove `routineExercises.id` (occurrence identity remains the key). It introduces a per-session overlay (`session_exercises` proposal) so removal is session-scoped and does NOT mutate the shared routine template.
- `sets.routine_exercise_id` stays linked to `routineExercises.id`; no schema change removes that identity.
- Removal semantics (contract): `getPendingQueue` shrinks the session's pending queue; `removeSessionExercise` marks the occurrence as removed (`status='removed'`) with original `position` preserved for undo; `restoreSessionExercise` reverts to `pending`. Idempotent. Rejected for finished/deleted sessions or occurrences not in the session's routine.
- **Sets already logged are KEPT** by default (history preserved). No `sets.deletedAt` is touched by removal; PR reconciliation is not triggered by removal. The `RemoveResult` reports `keptSetCount`.
- **Crash-recovery:** `resolveRecoveryContext` reads the session-specific queue; removed occurrences are excluded. If the snapshot's occurrence was removed, the recovery either advances to the next pending occurrence (`action='advance'`, draft discarded) or finishes (`action='finish'`) when the queue is empty.

**Micro Session Impact (honest correction):**
- The original claim that "removal of occurrence identity makes micro sessions align perfectly" is **incorrect**. Micro sessions use `routineExerciseId = NULL` (no occurrence link), which is independent of #81's overlay mechanism.
- There is no contradiction: micro's `sets.routineExerciseId = NULL` continues to mean "freestyle / no routine occurrence linked"; #81's per-session removal applies to normal sessions that DO use `routineExerciseId`. Micro does not interact with #81's removal flow because it never links to `routineExercises`.
- If micro is extended in the future to link to routine occurrences (e.g., routine-based micro entry), it would use `session_exercises` (if implemented) the same way normal sessions do.

**Epic/Branch:** `contract/ep/il-81-contract` documents the removal overlay; `docs/plans/il81-session-occurrence-contract.md` defines `session_exercises` proposal and `resolveRecoveryContext` contract.

---

## Interaction with #80 Freestyle Prefill

**Context:** Issue #80 adds freestyle prefill (load/reps from last session, not from routine template).

**Micro Session Impact:**
- **Alignment:** Micro sessions OWN their own prefill source
- **Prefill Target:** Last set from same `exerciseId` (ignoring `routineId`) for same-day or recent access
- **Rest:** **Suppressed** (default OFF, owner-tunable via `microSession.defaultRest: boolean`)
- **Side:** Prefill does NOT include side; user must explicitly set for L/R variants

---

## Owner Questions (Explicit)

1. **Side Support v1? (DECIDED — owner, 2026-10-06)**
   - Question: Should micro mode support L/R side selection from day one?
   - **Decision: DEFERRED indefinitely.** No schema change (no `side` column on `sets`; verified `src/db/schema.ts:57-82`), no toggle, i18n keys stay reserved but unimplemented.
   - If side support is ever needed, it must arrive as a NEW issue proposing the nullable `side` column on `sets` + migration + UI as a separate owner-approved pre-merge gate.
   - **Contradiction resolved:** Earlier claim of "L/R with NO schema change" was false (verified against `sets`). Documented honestly here.

2. **Default Rest Timer OFF Confim?**  
   - Question: Should rest timer be OFF by default for micro sessions (owner-tunable), or follow routine’s `rest_seconds`?  
   - Current Proposal: **OFF by default** (owner-tunable flag `microSession.defaultRest`). Rest notifications suppressed unless `restSeconds > 0` explicitly set in micro mode.

3. **Micro Session Routine Creation?**  
   - Question: Should micro allow saving the session as a quick routine?  
   - Current Proposal: **No, out of scope v1.** Only consuming existing routines/exercises.

4. **Auto-Restart Same Routine?**  
   - Question: After finish, can micro restart with same selection?  
   - Current Proposal: **Yes, Quick Pick reuses last session’s routineId.**

---

## Contract Summary

| Property | Micro Session | Normal Session |
|----------|---------------|----------------|
| Tables | `sessions`, `sets` | `sessions`, `sets`, `routineExercises`, `routineExercises` (for order) |
| Sets per Exercise | Exactly 1 | Variable |
| Rest Timer | Suppressed (OFF default) | Enabled via `scheduleRestNotification` |
| Auto-Finish | **Never** | Same |
| Routine Exercise Identity | Not used (`routineExerciseId = NULL`) | Used for occurrence ordering |
| Prefill Source | Last set from same `exerciseId` | Last set from same routine/exercise position |

---

## RED Tests

See `__tests__/services/micro-session.test.ts` for RED tests that import the real `MicroSessionService` stub and assert the desired semantics via its stub calls (persistence shape, single-set-per-exercise rejection, explicit-finish-only, summary shape equals normal session). All assertions fail at runtime with the `micro-session not implemented yet (issue #66 core slice)` throw — legitimate RED until `services/MicroSessionService.ts` is implemented.
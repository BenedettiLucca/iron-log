# Iron Log open-issue epic: code-grounded decomposition and lock graph

**Analysis date:** 2026-10-05  
**Repository:** `/home/lucca/Projects/iron-log`  
**Read-only baseline:** `origin/master` = local `HEAD` = `9c0b808d1c1e24ea9f3fbba611031cc5cfd5794b` (`2026-09-25`, `fix(types): pay down the 'any' debt the no-explicit-any gate exposed`).  
**Issue evidence:** `/home/lucca/.hermes/cache/scratch/iron-log-epic-2026-10-05/issues-full.md` and `issues-snapshot.json`; parsed count is **20 open issues, 14 comments**. No open PRs per the verified preflight.

This is an execution plan, not implementation. No GitHub/Git state was changed; no branch, PR, issue status, code, build, test, or paid-model call was made. Findings below distinguish current-source facts from recommendations and owner decisions.

## 1. Baseline and material findings

### Repository and verification constraints

- `AGENTS.md` requires migrations when `src/db/schema.ts` changes, regression coverage for session behavior, and AVD/device QA for visible changes under `app/`, `components/`, `hooks/`, or `services/`. Host tests and device QA are separate gates.
- The working tree was already dirty: `android/app/build.gradle` is deleted; `.omh/` and existing plan/QA documents are untracked. These were preserved. Do **not** repair or clean them as part of this epic.
- Preflight reports global Node `26.7.0` / npm `11.19.0`, outside the repo's `package.json` requirements (Node `>=22.22.2 <23`, npm `>=10.9.7 <11`). `/dev/kvm` is available and user-writable. No tests/builds were attempted. Future gates need the pinned toolchain and a clean remote-base working copy; the dirty deleted Gradle file makes this checkout unsuitable for reliable Android build evidence.
- Current migration state ends at `drizzle/0025_sturdy_tigra.sql`; `drizzle/migrations.js` manually imports/registers migrations through `m0025`. Migration work must coordinate the SQL file, journal, snapshots, manual loader, and SQLite test fixture. The next numeric slot is 0026; its generated slug must not be guessed.
- A comment on #64 says code landed in `9bd505f` with migration `0026_talented_vector.sql`. That commit is not in the current local commit graph, and the actual `origin/master` source has no `routines.is_archived`, archive hook, or migration 0026. Treat #64 as **implementation plus QA pending on this baseline**, not QA-only. Its old host-gate claims are not evidence for this baseline.
- The #64 comment requests `scripts/qa.sh receipt`, but the checked-in `scripts/qa.sh` has no `receipt` case. Do not assume that command exists; define/attach a real evidence receipt using the QA process available at execution time.

### Current-source facts that change or constrain the issue designs

1. **Routine/session identity:** `routine_exercises` has its own `id`; `sets.routine_exercise_id` references it, and existing A/B/A tests demonstrate that the same exercise can already appear more than once in a routine. #79's stated composite `(routine_id, exercise_id)` primary-key limitation is stale for this base. Do not add a second identity workaround. What is still missing is a *session-local* composition snapshot for add/remove/freestyle and runtime superset grouping.
2. **Freestyle:** `sessions.routine_id` and `routine_exercises.routine_id` are nullable in `src/db/schema.ts`, but `src/validators/routes.ts` requires `sessionParamsSchema.routineId`, the start route is routine-based, and the exercise route requires a positive `routineExerciseId`. Nullable DB columns alone do not implement freestyle.
3. **Schedule truth:** `program_weeks` associates a routine with a program week, not with a day. `TodayWorkoutService` looks up the active program's current-week routine and computes today's weekday independently; it does not resolve a planned weekday. `ScheduleManifestService` exports a program/routine/settings snapshot; it is not a day-level runtime schedule. #95 cannot honestly prefill a program's planned date until the product defines where planned days live.
4. **Cardio:** `exercises.type` is a text column with current application convention/comment `strength | duration`; there is no database enum/check constraint. `sets` has required `weight_kg` and `reps`, optional `duration_seconds`, and no distance/speed field. `duration` also describes non-cardio holds, so do not bulk-relabel it as cardio by guesswork.
5. **Body-weight provenance:** `app/session/finish.tsx` preloads the latest daily `body_metrics` value into the editable input. `finishSession()` then writes the parsed value to `sessions.body_weight` and inserts a new daily `body_metrics` row. The screen query does not filter out invalid/null weight rows before choosing the latest record. This is the concrete false-measurement path behind #147/#149.
6. **Notion export tests:** `__tests__/services/NotionExportService.test.ts` tests only `buildSessionVerdictsMarkdown`; it does not import `NotionExportService`. The issue's coverage gap is confirmed.
7. **Undo query budget:** the current query-budget suite measures `useExerciseSets` save/edit/delete only. `hooks/use-session-undo.ts` independently queries `exercises` on every undo and can query `routine_exercises` on the empty-set restore fallback.
8. **Notifications:** the app already has warm and cold response handlers (`addNotificationResponseReceivedListener` and `getLastNotificationResponseAsync`), routes `rest_complete` to recovery, checks the incomplete session in SQLite, and has host-level response tests. #114's remaining proof is native app-dead/device behavior, not an absent routing implementation. The recovery path depends on `incomplete_session` and currently only pushes the parent session route when `routineId` exists; that must be covered when #80 adds null-routine sessions.
9. **Health/integration:** current `TrainingVarianceService` computes local workout volume/session deltas from Iron Log sessions and sets; it does not fetch Alexandria sleep/HRV. `AlexandriaExportService` is an outbound export, not an inbound health client. No nutrition/readiness/plateau/cut-risk service is present in current `src/`/`services/` code.
10. **Units:** the current database is metric-canonical in practice, but `user_settings` has no unit preference and Settings has a language selector, not a unit selector. The four locale files are `src/i18n/translations/{pt,en,es,zh}.ts`. UI/export code hardcodes kg/cm at multiple boundaries.

## 2. Owner decisions to freeze before implementation

These are product/data decisions, not matters an implementation lane should infer from existing names or comments.

| ID | Owner decision required | Recommended default for the epic |
|---|---|---|
| D1 | **Schedule semantics (#95/#67):** whether programs have actual weekday assignments or #95 is only an ad-hoc planned date. | Add/define day-level program assignments before calling dates “planned”, “due”, or “overdue”. Store `scheduled_date` as a local calendar date (`YYYY-MM-DD`), keep `start_time` as actual time, and let reschedule change only the planned date. Until weekday assignments exist, label inactivity “stale” rather than “overdue”. |
| D2 | **Lane classification and gap (#67):** where main/accessory/recovery belongs and the trigger threshold. | Model the role at program assignment level (not by routine name); require a confirmed threshold. A 14-day advisory is a candidate, not an approved constant. Warn/re-entry note only; never auto-change loads or progression. |
| D3 | **Body-weight provenance (#147/#149):** how the latest real reading is snapshotted so reports survive restore/import. | Keep `sessions.body_weight` for a weight explicitly entered that day. Add an explicit provenance plus borrowed-value/date snapshot on the session for report-only use; never write a borrowed value to `body_metrics`. Legacy sessions have unknown provenance; do not backfill certainty from numeric equality. One schema owner implements the agreed fields. |
| D4 | **Session composition (#79/#80/#81):** persistence/identity and removal semantics. | Use one additive `session_exercises` snapshot per session plus nullable `sets.session_exercise_id`; preserve `sets.routine_exercise_id` for legacy history. Never edit the routine template when editing an active session. Removing an exercise hides it from active composition but preserves already logged sets/history/PRs; undo restores the same occurrence. |
| D5 | **Supersets (#79):** group identity and shared-rest semantics. | Optional opaque group ID on routine occurrences, copied to session occurrences; a group round completes after each member has performed its turn, then starts one rest. Unpairing/removing down to one member dissolves the group. |
| D6 | **Micro mode (#66):** metadata owner, unilateral capture, and completion. | Opt-in `sessionMode` on routine, snapshotted on session for recovery; standard is default. If side-aware logging is included in v1, persist nullable `left/right/both` per set. No automatic finish/custom completion heuristic in v1; use an explicit one-tap finish. |
| D7 | **Cardio (#82):** supported metrics and PR meaning. | Store canonical `duration_seconds` plus `distance_meters` when known; derive speed/pace instead of storing a duplicate. Define comparable PRs (e.g. distance and pace only for comparable targets) before UI/PR work. Do not call every duration exercise cardio or auto-migrate user exercises. |
| D8 | **Units (#136):** canonical storage, display rounding, and locale independence. | Persist `unitSystem: metric | imperial` in `user_settings`; default metric for existing/new users; store all canonical weight/length data in kg/cm. Convert only at input/display/export edges, and round only for display/input policy—not on every preference toggle. |
| D9 | **Readiness/risk (#72/#75):** language, score, overrides, thresholds, and provenance. | Informational training signals only. Do not say medically validated, diagnose injury, block a session, or automatically deload. Prefer transparent measurements/freshness and a manual override over red/green “train as prescribed”. #75 should not claim causal tendon injury prediction. Require owner-approved threshold/copy. |
| D10 | **Alexandria (#70/#72):** real endpoint, auth, units/timezone, freshness, cache, and error contract. | Verify a working documented contract before coding; issue URLs are candidates, not proof. Read-only, bounded timeout, explicit stale/unavailable state, no guessed endpoint or new state library solely for cache. Nutrition is not a hard dependency of sleep/readiness unless owner explicitly couples them. |
| D11 | **Native workflow (#112):** Expo SDK 57 upgrade vs development build. | Prefer an SDK-54 development build over a three-major upgrade now: `eas.json` already has a `developmentClient: true` profile, but `expo-dev-client` is not a direct dependency in `package.json`. Confirm local/EAS build path and notification behavior first; handle SDK upgrade separately. |
| D12 | **Weekly evaluation (#148):** whether Notion weekly output includes per-session verdicts. | Keep workout log and evaluation as separately addressable sections. If the weekly export includes evaluations, emit them under a dedicated “Progression assessment” section keyed by session; never concatenate them into raw workout-log text. |

## 3. Issue-by-issue atomic packages

Paths below are repo-relative to `/home/lucca/Projects/iron-log`. Paths called “new” are proposed, not existing files. `drizzle/0026_<generated-name>.sql` is deliberately a placeholder: only `drizzle-kit` on the agreed schema should determine the slug.

### #64 — Archive routines

- **Current state/comment reconciliation:** no archive field or implementation exists on `origin/master`, despite the two September comments describing a delivered commit. The comments correctly keep AVD QA as a separate required gate. Implement code and QA against this base.
- **Atomic package:** additive `routines.is_archived` default false; reversible `archiveRoutine`/`unarchiveRoutine`; active/archive partition; hide archived from default home/quick-pick but keep reachable through explicit archived search/link; preserve routine, routine-exercise rows, and session history.
- **Paths:** `src/db/schema.ts`; generated `drizzle/0026_<generated-name>.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0026_snapshot.json`, `drizzle/migrations.js`; `__tests__/fixtures/database.ts`; `hooks/use-routines.ts`; `app/(tabs)/index.tsx`; `app/(tabs)/routines.tsx`; `src/i18n/translations/{pt,en,es,zh}.ts`; existing `__tests__/hooks/use-routines.test.tsx`, `__tests__/screens/routine-preview.test.ts`, `__tests__/screens/routine-preview-routes.test.ts`; new `__tests__/quality/routine-archive-migration.test.ts` and `.maestro/routine-archive.yaml`.
- **Acceptance:** migrate an existing DB and prove old routines default active; archive/unarchive round-trip; all = active + archived; no linked history/exercises deleted; default lists exclude archive; explicit archived selection still opens preview and starts the same routine; four locales; AVD + Maestro archive/show/unarchive/start-session flow. This adopts the conservative behavior in the historical comment, subject to D1-style explicit owner confirmation of selection semantics.

### #66 — Micro-session mode

- **Current state/comment reconciliation:** no mode field or compact branch exists. The two comments give product context and later defer the feature; usage anecdotes are not a general health/efficacy claim.
- **Atomic package:** freeze D6; opt-in routine mode with session snapshot; compact logging branch inside the existing flow; optional per-set side capture; suppress/lighten rest without changing standard mode; explicit finish. Keep shared history/persistence/recovery path.
- **Paths:** `src/db/schema.ts` and migration loader/journal/snapshot; `src/types/index.ts`; `app/routines/editor.tsx`; `hooks/use-routines.ts`; `app/session/[routineId].tsx`; `app/session/exercise.tsx`; `components/SetEditor.tsx`; `components/session/SetList.tsx`; `hooks/use-exercise-sets.ts`; `services/SessionLifecycleService.ts`; `src/validators/routes.ts`; `src/i18n/translations/{pt,en,es,zh}.ts`; `__tests__/screens/session-draft-recovery.test.tsx`, `__tests__/services/session-mutation.test.ts`, `__tests__/utils/session-contract.test.ts` plus a new focused micro-mode test/flow.
- **Acceptance:** at least one representative short protocol completes with fewer taps/navigation than standard; side value survives save/edit/undo/recovery/export if included; timer suppression works only for micro mode; app-kill recovery retains mode; standard flow regression is unchanged; AVD/Maestro and four-locale coverage. Do not implement custom auto-completion absent D6 approval.

### #67 — Main-lane drift and re-entry

- **Current state/comment reconciliation:** no lane classification/drift analyzer exists. The comment defers as meta-infrastructure. The current program schema cannot tell which weekday a routine is due; the manifest service is export-only.
- **Atomic package:** after D1/D2, add a deterministic local analyzer returning lane state, age/gap, source session and re-entry flag. Persist any summary needed by completed-session export (e.g. explicit re-entry marker/gap snapshot); show dashboard/program and start-session re-entry context. Do not modify progression helpers automatically.
- **Paths:** `src/db/schema.ts`/migration set if a snapshot is persisted; `services/TodayWorkoutService.ts`; `services/ScheduleManifestService.ts`; new `services/AdherenceDriftService.ts`; `services/program/dashboard.ts`; `app/(tabs)/index.tsx`; `app/programs/detail.tsx`; `app/session/[routineId].tsx`; `app/session/summary.tsx`; `services/HistoryQueryService.ts`; `src/i18n/translations/{pt,en,es,zh}.ts`; new `__tests__/services/adherence-drift.test.ts` and screen tests.
- **Acceptance:** correctly separate main, accessory, and recovery; active accessory sessions do not erase a stale main signal; deterministic thresholds and boundary-day tests; empty/no-active-program state is “unknown”, not overdue; re-entry summary/export is stable across restart. **Dependency:** #95's schedule contract if product uses “due/overdue”; otherwise owner may deliberately narrow copy to “inactive/stale” and compute from last completed program-assigned routine. Owner must choose lane location/threshold and warn-only policy before coding.

### #70 — Nutrition context from Alexandria

- **Current state/comment reconciliation:** the comment confirms external pipeline dependency. Iron Log has outbound `AlexandriaExportService`, not an inbound health client. Neither the proposed nutrition endpoint nor the external dedup milestone was validated by this source review. `package.json` does not include Zustand, so the issue's cache sketch is not an existing pattern.
- **Atomic package:** first obtain/authenticate the nutrition daily-summary API contract and verified sample/error responses. Then add a read-only typed client and a small “today’s macros” card; use a bounded existing service/state pattern, not a new global store without justification. Optional 7-day averages require a specified target/source.
- **Paths:** new `services/AlexandriaHealthClient.ts` (shared client owner), new `services/NutritionSummaryService.ts`, new `components/NutritionContextCard.tsx`, `app/(tabs)/index.tsx` or another owner-approved training surface, `src/i18n/translations/{pt,en,es,zh}.ts`; new SQLite-free client/service tests and screen tests.
- **Acceptance/blocker:** verified auth, endpoint schema, local-day timezone, units, freshness/cache lifetime, timeout/error behavior; current-day fields display accurately; no write to training history; missing/stale/offline responses fail visibly and safely. **Hard blocker:** external nutrition dedup + usable daily endpoint/credentials; do not guess or close as shipped before those exist.

### #72 — Readiness-to-train signal

- **Current state/comment reconciliation:** comment defers on Alexandria. The issue's assumption that #71 already pulls sleep is not true in current code: `services/TrainingVarianceService.ts` aggregates local completed sessions/sets and has no sleep/HRV/RHR adapter.
- **Atomic package:** verify external sleep/HRV/resting-HR/weight API and choose D9; implement source/freshness adapters plus a transparent advisory card and manual continuation. Treat missing/stale input as unavailable, never as a red result. Keep readiness calculation local or external only after owner selects one source of truth.
- **Paths:** shared new `services/AlexandriaHealthClient.ts` (same single writer as #70); new `services/ReadinessService.ts`; `app/(tabs)/index.tsx`; `app/session/[routineId].tsx`; `src/i18n/translations/{pt,en,es,zh}.ts`; new tests for missing/stale/partial/normal inputs, overrides, offline behavior, and device UX.
- **Acceptance/blocker:** documented APIs and units, source timestamps, stale/unavailable handling, reproducible test vectors, no session block or automatic 10% deload, no “train as prescribed” medical-sounding composite. This is independently blocked on sleep/health data access; #70 nutrition is not a prerequisite unless D10 explicitly couples it. Integrate #75 only after safe signal contracts exist.

### #74 — Plateau detection

- **Current state/comment reconciliation:** comment defers as future detection. No plateau service is present. Existing analytics and local training variance are not plateau classification.
- **Atomic package:** pure longitudinal detector + query adapter + optional summary card. Use completed, non-deleted sessions and live, non-warm-up working sets; require comparable exercise/target and exclude cardio/duration from strength plateau logic. Use the issue's default of three consecutive comparable sessions only after owner ratifies exact comparisons; missing RIR must not invent RIR=0.
- **Paths:** new `src/utils/plateau-analysis.ts` and `services/PlateauDetector.ts`; `services/AnalyticsService.ts` only if it is the correct read boundary; `app/session/summary.tsx` or owner-selected program surface; `src/i18n/translations/{pt,en,es,zh}.ts`; new `__tests__/services/plateau-detector.test.ts` and screen tests.
- **Acceptance:** tests for progressing, load-stalled, RIR-increasing, regressing reps, deleted/warm-up sets, missed sessions, target change, sparse/missing RIR, duplicate exercise occurrences, and non-strength records. Suggestions remain “consider” language, not automatic prescription. No new schema required if computed on demand.

### #75 — Cut-velocity/training-risk signal

- **Current state/comment reconciliation:** comment defers. `body_metrics.weight` exists, but no analyzer. This is a health-adjacent inference and the issue's title/causal tendon-risk narrative is not clinically validated.
- **Atomic package:** freeze D9 and threshold. Build a pure weight-trend analyzer over valid dated entries plus #74's structured result; show only a cautious informational training-trend signal. Proposed conservative input floor: at least three valid readings spanning at least seven days; stale/sparse data means “not enough data.” Nutrition is excluded from v1 to avoid blocking on #70.
- **Paths:** new `src/utils/cut-velocity-analysis.ts`; new `services/CutVelocityAnalyzer.ts`; `services/AnalyticsService.ts` or body-metrics read service; `app/session/summary.tsx` and/or #72 card only after owner chooses; translations; new `__tests__/services/cut-velocity.test.ts` and screen tests.
- **Acceptance/blocker:** tests for weight loss without plateau, plateau without weight loss, rapid apparent change caused by sparse/outlier data, missing/stale weight, and confirmed combined input. No injury diagnosis, prevention claim, clinical validation claim, blocking, or automatic deload. Owner must approve threshold/copy and whether to rename the feature before UI work. #74 is a hard data dependency; #72 is an integration target, not a reason to overstate the score.

### #79 — Supersets

- **Current state/comment reconciliation:** comment defers due to feature size. The issue's composite-key note is stale: `routine_exercises.id` and `sets.routine_exercise_id` already represent repeated occurrences. The missing piece is session-local grouping/composition, not duplicate-exercise identity.
- **Atomic package:** with #81's contract, add optional group ID to routine occurrences and their per-session snapshots; editor can group/unpair; runtime advances through all group members and starts one shared rest after the round. Editing an active group changes only the session snapshot. A group with one remaining member dissolves.
- **Paths:** `src/db/schema.ts`/migration lock; `services/SessionCompositionService.ts` (new); `app/routines/editor.tsx`; `components/RoutinePreview.tsx`; `app/session/[routineId].tsx`; `app/session/exercise.tsx`; `hooks/use-exercise-sets.ts`; `services/NotificationService.ts`; `src/utils/session-occurrence.ts`; `src/utils/session-summary.ts`; translations; new composition/runtime tests and `.maestro/superset-round.yaml`.
- **Acceptance:** planned and mid-session pair/unpair; A/B round gets one rest after both, no rest after each member; app background/resume timer remains correct; removing one group member dissolves the group; repeated same exercise positions remain distinct; standard non-superset flow unchanged. **Hard dependency:** #81's persisted session composition model. No duplicate-ID schema redesign.

### #80 — Freestyle session

- **Current state/comment reconciliation:** comment defers. The issue accurately describes the routine-only start entry point; current route validation requires routine/occurrence identity despite nullable DB foreign keys. History prefill exists in `hooks/use-exercise-sets.ts` and should be reused, not reimplemented from arbitrary “latest set” SQL.
- **Atomic package:** after #81, add an explicit “Freestyle” entry and create a session with `routineId=null`; allow adding library exercises as session occurrences; prefill each occurrence from that exercise's previous execution by set position; reuse finish, history, summary, persistence, and exports.
- **Paths:** new `app/session/freestyle.tsx` or a discriminated route (choose once; do not use a numeric-ID sentinel); shared runner component if needed; `src/utils/session-start.ts`; `src/validators/routes.ts`; `src/db/schema.ts`; `services/SessionCompositionService.ts`; `app/(tabs)/routines.tsx`; `app/session/exercise.tsx`; `hooks/use-exercise-sets.ts`; `src/utils/session-occurrence.ts`; `app/(tabs)/history.tsx`; relevant exporters; translations; existing session-start/recovery tests plus new freestyle SQLite/screens tests.
- **Acceptance:** no routine required; session survives restart; add multiple occurrences including same exercise without conflation; prefill matches the previous execution per set position but is not treated as a saved set; finish/history/export show a normal session; rest-notification cold recovery works with null `routineId`. **Hard dependency:** #81.

### #81 — Add/remove exercises mid-session

- **Current state/comment reconciliation:** comment defers. Current active session route is one-way and no session-exercise collection persists independently of template routines.
- **Atomic package/foundation for #79/#80:** add one additive `session_exercises` table (session ID, exercise ID, order, source routine occurrence, target/rest snapshot, removal tombstone, and approved superset group) and nullable `sets.session_exercise_id`. Keep `sets.routine_exercise_id` intact for historic/legacy rows; readers resolve new ID first, legacy ID second. Use transactional `SessionCompositionService`; never mutate the routine definition from active-session controls.
- **Paths:** `src/db/schema.ts`; generated migration/journal/loader/snapshot; `__tests__/fixtures/database.ts`; `src/types/index.ts`; new `services/SessionCompositionService.ts` and `hooks/use-session-composition.ts`; `app/session/[routineId].tsx`; `app/session/exercise.tsx`; `components/session/*`; `src/utils/session-occurrence.ts`; `hooks/use-exercise-sets.ts`; summary/history/export readers; translations; new migration, service, recovery, and AVD tests.
- **Acceptance:** add/remove during an active session; persists over app recovery and routine edits; stable order and occurrence identity; remove one superset member follows D5; removing preserves logged sets and historical PR contribution; undo restores active occurrence; completed session reads old rows unchanged. **Hard dependency:** schema/identity contract must be reviewed before other lanes scaffold against it.

### #82 — Cardio exercise type

- **Current state/comment reconciliation:** comment defers. There is no cardio-type workflow or distance column. `exercises.type` is text (so not a SQL-enum migration), but TypeScript/UI/validators/analytics/PR code still use strength/duration semantics. Existing duration records cannot be safely auto-classified.
- **Atomic package:** freeze D7; add explicit cardio exercise validation/UI and distance in canonical meters (duration already exists); derive speed/pace; exclude cardio from strength volume/e1RM and strength PR rules; add well-defined cardio PR kinds with comparable targets. Only map existing exercises with explicit user-reviewed evidence.
- **Paths:** `src/db/schema.ts`/migration for distance only if contract needs it; `src/types/index.ts`; `src/validators/*`; `components/SetEditor.tsx`; `components/SetCard.tsx`; `components/session/ExerciseHistoryModal.tsx`; `app/session/exercise.tsx`; `hooks/use-exercise-sets.ts`; `hooks/use-personal-records.ts`; `services/progression.ts`; `services/AnalyticsService.ts`; `services/TrainingVarianceService.ts`; `services/CsvExportService.ts`; `services/AlexandriaExportService.ts`; `services/NotionExportService.ts`; `src/utils/session-summary.ts`; translations and corresponding service/screen tests.
- **Acceptance/blocker:** duration/distance input, units and precision, history/prefill, stable PR reconciliation after edit/delete/undo, strength volume/e1RM unchanged, mixed workout reporting correct, migrations do not rename existing duration exercises. Owner must decide exact time/distance/pace PR comparisons; “best time” is undefined without a target distance.

### #95 — Scheduled date and reschedule

- **Current state/comment reconciliation:** comment defers. No `sessions.scheduled_date`; program structure has week-level routine, not a planned weekday. This makes the issue's “prefill planned program day” requirement impossible as written without a program schedule contract.
- **Atomic package:** implement D1 first. Prefer local date string (not epoch midnight) for the planned calendar day; preserve `start_time` as actual performance timestamp. If program-start prefill is required, add a day-level program assignment model rather than overloading `program_weeks`' single routine/week row. Add history reschedule that changes only the session's planned date.
- **Paths:** `src/db/schema.ts`/migration lock; `services/TodayWorkoutService.ts`; `services/ScheduleManifestService.ts`; `services/program/*`; `app/programs/week-detail.tsx`; `app/programs/detail.tsx`; `app/session/[routineId].tsx`; `app/(tabs)/history.tsx`; `services/HistoryQueryService.ts`; `app/reports/weekly.tsx`; `src/utils/date-utils.ts`; translations; new schedule/date tests and AVD/Maestro calendar flow.
- **Acceptance:** program day maps to expected local date; reschedule changes only `scheduled_date`; actual start/end, PR dates, and training facts remain actual; history calendar uses planned date when present and start-date fallback for legacy sessions; timezone/DST, week boundary, and cross-midnight tests; migration leaves existing rows null. If owner rejects adding day-level assignments, explicitly narrow and amend the prefill acceptance before implementation.

### #112 — Expo development build or SDK upgrade

- **Current state/comment reconciliation:** SDK is `~54.0.37`; EAS already declares a development profile with `developmentClient: true`; `expo-dev-client` is not a direct dependency. The issue's problem is real for Expo Go, but no Expo SDK upgrade/build was attempted.
- **Atomic package:** choose D11. Complete the SDK-54 dev-client path first: compatible `expo-dev-client`, lockfile, native config/build profile, QA instructions. Upgrade to SDK 57 only as a separate migration if dev client fails the actual requirement.
- **Paths:** `package.json`; `package-lock.json`; `app.json`; `eas.json`; `app/_layout.tsx` only if removing an Expo Go compatibility branch is required; `scripts/qa.sh`/Android QA docs only if local build path changes; relevant `.github/workflows/*` only if CI must build it.
- **Acceptance:** pinned Node/npm; Expo dependency alignment/doctor; build and install actual dev client; Metro connection; native notifications/permission tests; clean Android build and app launch. **Local blocker:** current checkout has a pre-existing deleted `android/app/build.gradle`; preserve it and build from a clean base worktree. Do not claim SDK 57 compatibility without a separate full migration/QA.

### #114 — Dead-app local notification E2E

- **Current state/comment reconciliation:** warm/cold handlers and route resolution already exist; host tests cover the payload and session-recovery contract. This issue is specifically missing device evidence after process death.
- **Atomic package:** after #112, build the reviewed native dev client, schedule rest notification in an active session, swipe-kill from recents, wait for OS delivery, tap, and verify cold recovery resumes that exact unfinished session without inserting another. Repeat warm/background path and stale/deleted/finished session safeguards. Distinguish swipe-kill from Android force-stop because OS notification behavior may differ.
- **Paths:** `services/NotificationService.ts`; `src/utils/notification-routing.ts`; `app/_layout.tsx`; existing `__tests__/screens/notification-response.test.tsx`; new `.maestro/rest-notification-recovery.yaml` plus QA evidence/screens/logs. Change code only if native observation proves a defect.
- **Acceptance/blocker:** evidence from supported dev build/device, correct session/exercise route, no duplicate session, no stale-session navigation, notification cancel/expiry behavior; cold and warm tests. **Hard dependency:** #112. Also fix/extend null-routine recovery with #80 rather than letting freestyle sessions silently fail to reopen.

### #136 — Metric/imperial preference

- **Current state/comment reconciliation:** no `unitSystem` in `user_settings`; Settings currently changes language but not units. Existing body values and workout loads are stored in canonical metric units.
- **Atomic package:** add `unitSystem` default metric; central conversion/parser/formatter utilities; use them at UI and export boundaries only. Keep preference independent from `language`. Audit every confirmed weight/length surface and export; do not convert old DB rows.
- **Paths:** `src/db/schema.ts`/migration; `src/types/index.ts`; `__tests__/fixtures/database.ts`; new `src/utils/units.ts`; `app/(tabs)/settings.tsx`; `components/SetEditor.tsx`; `components/SetCard.tsx`; `components/session/ExerciseHistoryModal.tsx`; `app/session/exercise.tsx`; `app/session/finish.tsx`; `app/(tabs)/bio.tsx`; `app/bio/analytics.tsx`; `app/bio/goals.tsx`; `app/bio/evolution.tsx`; `app/bio/checkin.tsx`; `components/MonthlyCheckinComparison.tsx`; `components/PhotoOverlay.tsx`; `app/reports/weekly.tsx`; `services/CsvExportService.ts`; `services/AlexandriaExportService.ts`; `services/NotionExportService.ts`; `src/utils/session-summary.ts`; `services/ScheduleManifestService.ts`; translations and directly affected tests.
- **Acceptance:** metric default/imperial persisted across restart and backup/restore; English + metric and Portuguese + imperial both possible; kg↔lb and cm↔in round-trip within the explicitly approved display/input tolerance; toggling preference never changes stored physical values, PRs, analytics, or historical rows; all exports label unit unequivocally. Serialize behind #147-#149 exporter work to avoid touching the same files concurrently.

### #147 — “I did not weigh today” and report-only borrowed value

- **Current state/comment reconciliation:** the false-row behavior is present exactly as described. Finish also picks the latest `daily` row without filtering to a valid non-null positive weight. No issue comments.
- **Atomic package:** implement D3 with one schema owner. On unchecked/manual weight: persist measured value to `sessions.body_weight` and one `body_metrics` row. On checked: persist no measured body weight and no new body-metric row; if a valid prior weight exists, snapshot its value and real measurement date/provenance on the session solely for report display; if none, report “not measured/no prior value”. Make finish idempotent and transactional. Never infer historical provenance or backfill body metrics.
- **Paths:** `src/db/schema.ts` and migration loader/journal/snapshot; `__tests__/fixtures/database.ts`; `app/session/finish.tsx`; `services/SessionLifecycleService.ts`; `hooks/use-body-metrics.ts` or a dedicated latest-valid-reading query; `services/NotionExportService.ts`; `src/i18n/translations/{pt,en,es,zh}.ts`; `__tests__/services/session-lifecycle.test.ts`; `__tests__/screens/session-recovery-navigation.test.tsx`; `__tests__/services/NotionExportService.test.ts` after #151.
- **Acceptance:** checked path leaves `sessions.body_weight` null, creates zero new `body_metrics`, persists a stable borrowed snapshot/date and identifies it in Notion; unchecked path keeps existing parse/idempotent behavior; invalid latest row falls back to latest valid row; no prior weight; migration/restore retains provenance; AVD/Maestro covers both choices. #149 owns other output consumers, not `finishSession`.

### #148 — Separate workout log from progression assessment

- **Current state/comment reconciliation:** `src/utils/session-summary.ts` currently appends verdict Markdown to `report`; `NotionExportService` appends a verdict block. The Summary screen already has separate verdict cards, so the gap is principally the data/output contract, completeness (including confidence and i18n), and export separation—not inventing a new evaluator.
- **Atomic package:** preserve `generateSessionVerdicts` logic. Return a structured log plus structured `progressionAssessment` (typed exercise verdicts, including result/target/execution/flags/confidence); render/export each separately. Follow D12 for weekly Notion: if per-session verdicts are included, give them a distinct weekly section, not raw log text.
- **Paths:** `src/utils/session-summary.ts`; `src/utils/session-verdicts.ts` (types only unless contract gaps); `src/utils/session-verdict-markdown.ts`; `app/session/summary.tsx`; `services/NotionExportService.ts`; `__tests__/utils/session-summary.test.ts`; `__tests__/utils/session-verdicts.test.ts`; `__tests__/services/NotionExportService.test.ts`; translations.
- **Acceptance:** workout log contains only session facts; UI/clipboard/Notion expose a separate structured assessment; all five verdict/result cases plus no-target, flags, confidence, meta vs execution, and i18n are covered; weekly/session outputs stay separated; no `generateExerciseVerdict` behavior changes or automatic prescription; AVD visual QA.

### #149 — Propagate body-weight provenance to all outputs

- **Current state/comment reconciliation:** `src/utils/session-summary.ts`, CSV, Alexandria JSON, and Notion session frontmatter emit only a numeric body weight/unit; none distinguishes a carried value. The issue correctly notes `exportWeeklyReport` does not currently export body weight (so it is not a #149 weight consumer). Its statement about Notion test coverage is confirmed.
- **Atomic package:** consume #147's stable session provenance; update copied/shared report, CSV session rows, Alexandria metadata, and Notion frontmatter consistently. Keep the body-metric CSV limited to actual `body_metrics` rows; never append borrowed snapshots as measurements. Use explicit unit/source/date fields for machine-readable exports.
- **Paths:** `src/utils/session-summary.ts`; `services/CsvExportService.ts`; `services/AlexandriaExportService.ts`; `services/NotionExportService.ts`; corresponding `__tests__/services/csv-export.test.ts`, `alexandria-export.test.ts`, new Notion integration tests, and `__tests__/utils/session-summary.test.ts`.
- **Acceptance:** measured, borrowed, no-prior, and legacy-unknown cases are honest/consistent; borrowed date is actual source date; units are explicit; existing raw measurements untouched. **Dependencies/lock:** #147 data contract and #151 service test harness; sequence after #148 on shared summary/Notion files, then #136 unit formatting.

### #150 — Undo/restore query budget

- **Current state/comment reconciliation:** `useSessionUndo.handleUndo` reads `exercises` before restoring `currentName`; `handleRestoreDeleted` can query `routine_exercises` if occurrence-scoped sets are empty. Current budget test omits both paths. Whether the name query is truly redundant still needs a behavior test.
- **Atomic package:** extend query instrumentation around normal undo and restore. Compare current-name behavior against route/hydration, exercise rename, repeated occurrence, deleted-set and zero-set fallback. Remove the query only if the contract remains identical; otherwise document and budget the justified cold fallback separately.
- **Paths:** `hooks/use-session-undo.ts`; `hooks/use-exercise-sets.ts`; `app/session/exercise.tsx`; `__tests__/hooks/exercise-sets-query-budget.test.ts`; `__tests__/screens/session-recovery-navigation.test.tsx`.
- **Acceptance:** exact structural-query counts for undo/restore, no regression in `currentName`, `routineExerciseId`, set state, PR reconciliation, and existing 10-second undo semantics. This is independent of schema; can run in a separate code lane once its test-file lock is available.

### #151 — Real NotionExportService coverage

- **Current state/comment reconciliation:** confirmed: the 71-line test imports only the Markdown verdict helper and exercises neither service method.
- **Atomic package:** SQLite-real integration tests using `__tests__/fixtures/database`; mock only file/share boundaries. Cover happy path, empty/missing data, order, dates, localized strings/escaping, complete frontmatter/session sets, weekly volume/sRPE/listing, and the new #147/#148 behavior as those contracts land.
- **Paths:** `__tests__/services/NotionExportService.test.ts`; `services/NotionExportService.ts`; shared `__tests__/fixtures/database.ts`; helper test `__tests__/utils/session-verdicts.test.ts` remains separate.
- **Acceptance:** suite imports and calls `NotionExportService.exportSessionMarkdown` and `.exportWeeklyReport`; deliberate implementation changes to their output fail assertions. Do this first as a test-only baseline package, then extend sequentially under the #147/#148/#149 file lock.

## 4. Dependency graph and critical path

Solid arrows are product/data dependencies; `[LOCK]` means the work may be technically independent but must not write shared files concurrently.

```text
OWNER CONTRACTS: D1 schedule · D3 body-weight · D4 composition · D7 cardio
                 D9 health safety · D10 Alexandria API · D11 native build

#151 Notion integration-test foundation ──> #147 provenance/data contract
                                              └──> #148 structured log/assessment
                                                     └──> #149 all export consumers
                                                            └──> #136 unit presentation on exporters

#81 session-composition foundation ──> #80 freestyle
                                  └──> #79 planned + runtime supersets

#95 program-day schedule + scheduled_date ──> #67 true due/overdue and re-entry
       (If D1 narrows #67 to “stale”, this dependency can be removed but copy must change.)

#74 plateau detector ──> #75 cut-velocity/training-trend composite ──> optional #72 signal surface
#70 nutrition client/contract ──┐
#72 sleep/health client/contract ├── share one Alexandria client owner; neither depends on the other by default
                                ┘

#112 SDK-54 development build ──> #114 app-dead notification device proof
```

**Shared-file/physical-resource locks (one writer at a time):**

- **Schema/migration lock (single schema owner/integrator):** `src/db/schema.ts`, `src/types/index.ts`, `drizzle/*.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/*_snapshot.json`, `drizzle/migrations.js`, `__tests__/fixtures/database.ts`. Applies to #64, #66, #67/#95, #79/#81, #82, #136, #147. Feature lanes may scaffold against an approved contract, but must not generate/renumber migrations in parallel. This avoids multiple `0026` branches and the silent loader omission already described in the #64 comment.
- **Session-flow lock:** `app/session/[routineId].tsx`, `app/session/exercise.tsx`, `hooks/use-exercise-sets.ts`, `components/SetEditor.tsx`, `src/validators/routes.ts`, `src/utils/session-occurrence.ts`, recovery and `components/session/*`. Serialize #66, #79, #80, #81, #82 on these files. #80/#79 also have a real #81 dependency; #66/#82 are lock-constrained, not intrinsically dependent.
- **Schedule lock:** `services/TodayWorkoutService.ts`, `services/ScheduleManifestService.ts`, `services/program/*`, `app/programs/*`, `app/(tabs)/index.tsx`, `app/(tabs)/history.tsx`. Complete #95 schedule contract before #67 if retaining “overdue” semantics.
- **Report/export lock:** `src/utils/session-summary.ts`, `services/NotionExportService.ts`, `services/CsvExportService.ts`, `services/AlexandriaExportService.ts`, and their shared test files. Sequence #151 → #147 → #148 → #149 → #136; #82/#66 must wait before changing the same export/report surfaces.
- **Locale lock:** `src/i18n/translations/{pt,en,es,zh}.ts` are shared by nearly every visible feature. Freeze key names/text per feature first, then have one locale integrator apply changes; do not let six lanes edit all four dictionaries concurrently.
- **Alexandria client lock:** one owner for the new typed client, auth, error/freshness/cache rules. #70 and #72 can parallelize pure DTO/UI work after that contract, not edits to the client.
- **Android QA/build lock:** one device/AVD owner at a time for build/install/reset/smoke/evidence; use reviewed branch source and do not reuse a stale APK. All visible UI packages need targeted AVD/Maestro checks per `AGENTS.md`; #114 additionally needs app-dead notification proof.

## Execution authority and maximum parallelism

PLAN.md and execution-ledger.json govern scheduling. The preceding lock table lists shared surfaces, not permission to hold an entire exporter/session tree for a whole issue. Freeze each package's smallest exact file/invariant allowlist; release at each reviewed coherent slice. No global wave barrier and no requirement to settle every product decision before independent useful tasks. #66/#82 pure modules and #136 conversion policy can proceed before #81 or the exporter series closes; only shared wiring needs the reviewed anchor. Same rule for health discovery versus blocked live integration.

Each package follows: freeze the contract → write one focused production-importing failing test → execute RED → smallest GREEN change → focused edge/fault probe → commit coherent change if authorized → independent review of real SHA → publish branch if authorized → consume its reviewed anchor. UI/schema/native evidence is required before final issue readiness, not guessed from a contract review.

**Migration filenames:** `0026_<generated-name>` above indicates the next slot at the frozen base, not every feature's assigned migration. Generate serially on the current schema-owner anchor, so subsequent packages naturally receive later journal indices. Do not preallocate or collide.

**Health and scope:** advisory-only thresholds, rest/micro side behavior, cardio PR definitions and program weekday assignments are recommendations pending owner approval. Where these alter an original acceptance criterion, record explicit issue-scope approval; do not silently implement the narrower version and close the original.

**Per-issue routing and atomic package DAG:** see the table in WORK-PACKAGES.md and full machine ledger. Every original acceptance/body/comment is in evidence/issues-snapshot.json. No tests/builds/inference were run during planning; runtime receipts remain empty.

# Iron Log — Ponytail Audit Sprint Plan

> **Source:** Ponytail-audit executed 2026-06-24 (48 findings, ~1,150 lines cuttable, -3 deps)
> **Philosophy:** Deletes first (zero risk), then YAGNI (low risk), then shrink (medium risk)

---

## Sprint 1: Dead Code Purge (zero risk)

**Goal:** Remove files and functions that are provably never called.
**Estimated cut:** ~400 lines, 4 files deleted
**Verification:** `npm test -- --runInBand` + `npx eslint src/ services/ hooks/ app/ --quiet`

| Task | Tag | What | File(s) | Lines | Issue |
|------|-----|------|---------|-------|-------|
| 1.1 | delete | Delete `session-verdict-markdown.ts` (0 imports) | `src/utils/session-verdict-markdown.ts` | 50 | — |
| 1.2 | delete | Delete `useSessionExercise` hook (0 imports from .tsx) | `hooks/use-session-exercise.ts` + export in `hooks/index.ts` | 157 | — |
| 1.3 | delete | Delete `calculations.ts` (wraps `weight * reps`, inline the multiplication) | `src/utils/calculations.ts` | 16 | — |
| 1.4 | delete | Delete `parseTargetSets()` — use `parseTargetString()` from session-verdicts.ts instead | `src/utils/exercise.ts` | 15 | — |
| 1.5 | delete | Delete `getStreak()` (never called, `getAllStreaks()` is used) | `hooks/use-supplements.ts:111-146` | 36 | — |
| 1.6 | delete | Delete `sendTestNotification()` (dev-only in production code) | `services/NotificationService.ts:239-258` | 20 | — |
| 1.7 | delete | Delete empty `setupResponseListener` handler (listener with no logic) | `services/NotificationService.ts:68-79` | 12 | — |
| 1.8 | delete | Delete dead `dataPoints` field (always `[]`) | `services/AnalyticsService.ts:46,384` | 3 | — |
| 1.9 | delete | Delete orphaned metrics CSV write in CsvExport (never shared) | `services/CsvExportService.ts:164-166` | 3 | — |
| 1.10 | delete | Fix `labelKey` dead branch (`>= 15` and `else` both return 'beginner') | `services/AnalyticsService.ts:185-189` | 1 | — |
| 1.11 | delete | Delete `RestTimerBar` (37-line passthrough, inline `<RestTimer>` in exercise.tsx) | `components/session/RestTimerBar.tsx` | 37 | — |
| 1.12 | delete | Deduplicate `getPhaseLabel` + `getGoalBadge` (identical copies in 2 files) | `programs/detail.tsx`, `programs/index.tsx` | 26 | — |

**Commit after all tasks:** `refactor: purge dead code (ponytail audit)`

---

## Sprint 2: Bug Fixes + Type Safety

**Goal:** Fix the 3 bugs found during audit + replace hand-maintained types with Drizzle inference.
**Estimated cut:** ~200 lines
**Verification:** `npm test -- --runInBand` + `npx tsc --noEmit`

| Task | Tag | What | File(s) | Issue |
|------|-----|------|---------|-------|
| 2.1 | bug | Fix `getWeeklyAdherence` to respect `frequency` | `hooks/use-supplements.ts:224-249` | #60 |
| 2.2 | bug | Remove buggy `monthlyCheckinSchema`, use `strictMonthlyCheckinSchema` | `src/validators/forms.ts:19-31` | #61 |
| 2.3 | bug | Remove `Input` `success` prop (0 callers) or i18n the string | `components/Input.tsx` | #62 |
| 2.4 | yagni | Replace `types/index.ts` (~266 lines) with `typeof table.$inferSelect` for all DB types. Keep only UI-specific types (ToastState, DialogState, etc.) | `src/types/index.ts` | — |
| 2.5 | delete | Deduplicate `NotificationConfig` (defined in NotificationService.ts AND types/index.ts with incompatible shapes) | `services/NotificationService.ts:18-22` | — |

**Commit after all tasks:** `fix: adherence bug, zod schema, i18n + replace manual types with Drizzle inference`

---

## Sprint 3: YAGNI Removal (low risk)

**Goal:** Remove speculative abstractions, unused props, and thin wrappers.
**Estimated cut:** ~300 lines
**Verification:** `npm test -- --runInBand` + `npx tsc --noEmit` + manual smoke test

| Task | Tag | What | File(s) | Lines |
|------|-----|------|---------|-------|
| 3.1 | yagni | Delete `program-detail-state.ts` (state machine that is 4 if/else + 1:1 mapper). Inline ternaries in component | `src/utils/program-detail-state.ts` | 50 |
| 3.2 | yagni | Delete `useColorScheme` (1-line re-export). Update 2 callers to import from react-native directly | `hooks/use-color-scheme.ts` | 1 |
| 3.3 | yagni | Collapse `useProgression` (instantiates entire `usePrograms()` for 1 getter). Call `ProgramService.getDoubleProgressionStatus` directly | `hooks/use-progression.ts` | 22 |
| 3.4 | yagni | Remove unused props from `StrengthCurve` (`goalWeight`, `goalDate`) | `components/StrengthCurve.tsx:84-109` | 25 |
| 3.5 | yagni | Remove unused props from `Stopwatch` (`editable`, `paused`, `onTogglePause`) | `components/Stopwatch.tsx` | 20 |
| 3.6 | yagni | Remove unused `Card` variants (`elevated`, `flat`) | `components/Card.tsx` | 8 |
| 3.7 | yagni | Remove unused `EmptyState` prop `actionRoute` | `components/EmptyState.tsx` | 5 |
| 3.8 | yagni | Remove unused `ProgressBar` prop `animated` (always true) | `components/ProgressBar.tsx` | 8 |
| 3.9 | yagni | Remove `AnalyticsService` `dataPoints` from interface + consumers (covered in Sprint 1.8 if not done) | `services/AnalyticsService.ts` | 5 |
| 3.10 | yagni | De-duplicate `monthlyCheckinSchema` photo fields (`photoFront`, `photoBack`, etc. never used by this schema) | `src/validators/forms.ts:25-28` | 4 |
| 3.11 | yagni | Remove `buildWorkoutA11y` wasted allocation (7 of 8 fields never used) | `app/session/[routineId].tsx:322-331` | 15 |
| 3.12 | yagni | Simplify `showTemplateOptions` floating menu → two inline buttons | `app/(drawer)/routines/editor.tsx:261-291` | 20 |
| 3.13 | yagni | Audit + remove `@react-navigation/bottom-tabs`, `react-native-web`, `react-dom` deps if unused | `package.json` | -3 deps |

**Commit after all tasks:** `refactor: remove YAGNI abstractions and unused props (ponytail audit)`

---

## Sprint 4: Shrink & Consolidate (medium risk)

**Goal:** Extract shared utilities, consolidate duplicated patterns, inline helpers.
**Estimated cut:** ~250 lines
**Verification:** `npm test -- --runInBand` + `npx tsc --noEmit` + manual QA on affected screens

| Task | Tag | What | File(s) | Lines |
|------|-----|------|---------|-------|
| 4.1 | stdlib | Create `src/utils/date-utils.ts` with `getISOWeek`, `getWeekStart`, `formatDate`, `groupBy`. Replace 3 duplicate implementations | AnalyticsService + NotionExport + CsvExport + AlexandriaExport | 50 |
| 4.2 | shrink | Extract `mapVerdictToLabels(v, t)` helper. Replace 3 copies of verdict→i18n mapping | `summary.tsx`, `session-summary.ts`, (verdict-markdown.ts deleted in S1) | 30 |
| 4.3 | shrink | Create `useToast()` hook. Replace `useState({visible, message, type})` across 12+ screens | All screen files | 36 |
| 4.4 | shrink | Create `useConfirmDialog()` hook. Replace dialog state across 8+ screens | 8 screen files | 32 |
| 4.5 | shrink | Create `<ScreenContainer isLoading hasError>` wrapper. Replace 10+ loading/error early-return blocks | 10+ screen files | 80 |
| 4.6 | shrink | Inline `AlexandriaExportService` pure helpers (4 functions, ~170 lines, 0 tests) | `services/AlexandriaExportService.ts:88-307` | 80 |
| 4.7 | shrink | `finish.tsx`: call `buildSessionSummary` instead of re-implementing stats logic | `app/session/finish.tsx:104-131` | 25 |
| 4.8 | shrink | Extract shared `getRirColor()` util from exercise.tsx + SetCard.tsx | 2 files | 10 |
| 4.9 | shrink | Convert `useHaptics` switch to lookup table | `hooks/use-haptics.ts` | 20 |
| 4.10 | shrink | Replace `new RegExp('{key}', 'g')` with `replaceAll` in i18n | `src/i18n/index.tsx:95-97` | 3 |
| 4.11 | shrink | Simplify `useExerciseSets` god hook — let components import `useSessionTimer`/`useSessionUndo` directly | `hooks/use-exercise-sets.ts:340-392` | 52 |
| 4.12 | shrink | Inline `logger.ts` factory as plain object | `services/logger.ts` | 10 |
| 4.13 | shrink | Remove redundant `typeof ex.x === 'string'` guards in templates.tsx (8 occurrences, schema already types) | `app/(drawer)/routines/templates.tsx` | 15 |
| 4.14 | shrink | Merge duplicate photo thumbnail grids in bio/index.tsx | `app/(drawer)/bio/index.tsx:303-352` | 25 |

**Commit after all tasks:** `refactor: consolidate shared utils and extract hooks (ponytail audit)`

---

## Execution Strategy

### Recommended tooling
- **Sprint 1 (deletes):** Direct Hermes patches. Zero risk, no agent needed.
- **Sprint 2 (bugs + types):** Hermes for bug fixes, Antigravity for the `types/index.ts` migration (bulk find-replace across many files).
- **Sprint 3 (YAGNI):** Antigravity for prop removal (touches many component callers), Hermes reviews.
- **Sprint 4 (shrink):** Antigravity for hook extraction (touches many screens), Hermes reviews.

### Risk escalation
- Sprint 1 → commit freely, just run tests
- Sprint 2 → test + typecheck, careful with `types/index.ts` migration (may break many imports)
- Sprint 3 → test + typecheck + smoke test the affected screens
- Sprint 4 → full QA, each task should be a separate commit for easy rollback

### Ponytail audit debt tracking
Mark deliberate simplifications with `// ponytail:` comments during refactors. Run `ponytail-debt` skill periodically to verify no shortcut is rotting.

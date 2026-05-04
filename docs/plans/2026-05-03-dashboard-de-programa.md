# Dashboard de Programa — Implementation Plan

> **Issue:** #18 — [Feature] Dashboard de Programa — Visão Macro do Ciclo
> **For Hermes:** Use Gemini CLI to implement this plan task-by-task.

**Goal:** Enhance the dashboard with a rich "Programa Ativo" card showing volume, sRPE, key lifts with trends, and create a week-grid detail screen with drill-down to sessions.

**Architecture:** Extend existing ProgramService with new query methods (volume averaging, key lifts, week completion), update the usePrograms hook to expose dashboard data, enhance the dashboard card in index.tsx, and create a new week-detail screen.

**Tech Stack:** Expo SDK 54, React Native, Drizzle ORM (SQLite), NativeWind, expo-router, i18n (4 languages)

---

## What Already Exists
- `ProgramService.getCurrentWeek()`, `getWeeksUntilDeload()`, `getCurrentPhase()`, `getWeeklyVolume()`
- Active Program Banner on dashboard (basic: name, week, phase, deload countdown)
- `programs`, `programWeeks`, `programExerciseTargets` DB tables
- `DoubleProgressionStatus` with trend detection

## What Needs to Be Built

### Task 1: Service Layer — New ProgramService Methods
Add to `services/ProgramService.ts`:
- `getAverageWeeklyVolume(program, weeks=4)` — avg volume over last N weeks
- `getAverageSRPE(program)` — mean sRPE across program sessions
- `getWeekCompletionMap(program)` — Map<weekNumber, 'done'|'missed'|'deload'|'future'>
- `getSessionsForWeek(program, weekNumber)` — sessions in a specific week
- `getKeyLifts(program, limit=5)` — top exercises by volume with weekly progression + trend

### Task 2: Hook Layer — Update usePrograms
Add state and methods to `hooks/use-programs.ts`:
- `weeklyVolume`, `avgWeeklyVolume`, `avgSRPE`, `keyLifts`, `weekCompletionMap`
- `fetchDashboardData()` — parallel fetch of all dashboard data
- `getSessionsForWeek(weekNumber)` — wrapper for service method

### Task 3: Dashboard Card Enhancement
Enhance the Active Program Banner in `app/(drawer)/index.tsx`:
- Volume bar: "📊 Volume: 42.1k kg" with ProgressBar vs 4-week avg
- sRPE: "🔥 sRPE médio: 8.3"
- Key Lifts (max 3): exercise name + weight + trend emoji
- Overreaching warning if volume > 120% of avg

### Task 4: Week Detail Screen
Create `app/(drawer)/programs/week-detail.tsx`:
- Header: "Semana 3 — Intensificação"
- Week grid: small squares with week number + status emoji
- Session list for selected week
- Each session card: routine name, date, duration, sRPE

### Task 5: Program Detail Integration
Update `app/(drawer)/programs/detail.tsx`:
- Add "Grade Semanal" section with week grid
- Each cell tappable → navigates to week-detail

### Task 6: i18n Keys (all 4 languages)
Add `programs.dashboard.*` keys to pt, en, es, zh translations.

### Task 7: Types
Add `KeyLift`, `WeekCompletionStatus`, `ProgramDashboardData` to `src/types/index.ts`.

---

## Constraints
- All strings via t() — zero hardcoded strings
- DB queries with WHERE clauses — no load-all-then-filter
- Use existing Card, ProgressBar, EmptyState components
- NativeWind className styling
- Commit each task separately
- Run tests after all changes

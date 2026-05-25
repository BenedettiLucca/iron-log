# Changelog

All notable changes to Iron Log are documented here.

## [3.12.0] - 2026-05-25

### Changed
- **ProgramService decomposed** — 680-line monolith split into 6 focused modules: `program/crud.ts`, `program/weeks.ts`, `program/targets.ts`, `progression.ts`, `program/dashboard.ts`. Original file now a thin re-export facade (#53)
- **Session exercise screen decomposed** — 1025-line screen reduced to 917 lines by extracting 4 hooks: `use-session-timer`, `use-session-undo`, `use-session-persistence`, `use-personal-records` (#53)
- **Sentry crash reporting** — Optional Sentry integration for error tracking

### Fixed
- **Set label truncation** — Set cards no longer clip text on narrow screens
- **Workout progress accuracy** — Warmup sets excluded from exercise completion tracking and session stats
- **Date formatting** — Remaining hardcoded date formatters localized properly

### Tests
- 372 passing (27 suites), 0 failures

---

## [3.11.0] - 2026-05-10

### Fixed
- **Accessibility: SetCard labels** — Hardcoded Portuguese strings (`Série`, `sem carga`, `Recorde pessoal`, `Aquecimento`) replaced with `t()` keys for full i18n coverage (#46)
- **Accessibility: touch targets** — `Button.size="sm"` now enforces `min-h-[44px]` for WCAG compliance (#41)
- **Accessibility: workout sliders** — RIR/sRPE sliders now have proper labels (#40)
- **Accessibility: supplement checklist** — Exposed checklist actions with explicit buttons and 44px targets (#39)
- **Accessibility: check-in gallery** — Gallery is now selectable with proper state and accessible labels (#38)
- **Accessibility: swipe-only actions** — SetCard, Routines, Templates, and Editor now have `accessibilityActions` as discoverable alternatives to swipe gestures (#46)
- **Haptics standardization** — Card, Dialog, SetEditor, PhotoComparison, ErrorBoundary, Bio quick-actions, Supplements toggle, and Session end now use consistent haptic feedback via `Pressable` (#47)
- **Themed colors** — Hardcoded hex colors replaced with `getThemeColors()` tokens; `DatePicker` overlay uses inline style to avoid hook-in-StyleSheet issue (#43)
- **i18n: session/progress copy** — Hardcoded strings in session finish, exercise, summary, and StrengthCurve localized (#44)
- **i18n: date formatting** — All `toLocaleDateString()` calls now use `getLocaleForLanguage(language)` for proper locale-aware dates (#44, audit)
- **i18n: SetCard accessibility** — Accessibility label, weight/duration/RIR/PR/warmup descriptions fully localized in all 4 languages (audit)
- **Safe areas** — Fixed layouts in `programs/create` and `session/exercise` now respect `useSafeAreaInsets` bottom inset (#45)
- **Secondary flow inconsistencies** — History empty state, exercise history session exclusion, evolution measures null filtering, evolution photo pose matching, finish "Last:" display, save-as-template NaN guard, clipboard import empty toast, JSON hint overflow, drawer hierarchy (#48)
- **TypeScript: Jest types** — Added `@types/jest` for clean type checking of test files (#49)
- **TypeScript: Pressable events** — `e: any` replaced with `GestureResponderEvent` in `Pressable.tsx` (audit)
- **Typography scale** — Aligned `typographyTokens` with `TypographySize` type; replaced arbitrary sizes with named tokens (#42)
- **Error messages** — `screen-state.ts` fallback `'Unknown error'` replaced with `t('states.errorBody')` pattern across screens
- **Supplements hook** — `use-supplements.ts` error state now properly propagates i18n error messages

### Added
- **CI Quality Gate** — GitHub Actions workflow (`.github/workflows/quality.yml`) running typecheck, lint, and tests on every push/PR to master (#50)
- **Pressable component** — Reusable wrapper around TouchableOpacity with haptics + default `accessibilityRole="button"` (#47)
- **ScreenState components** — Standardized `LoadingState` and `ErrorState` with i18n support across all screens (#48)
- **resolveScreenState utility** — Pure helper for consistent screen state resolution (loading > error > empty > content) (#48)
- **workout-a11y utility** — Centralized accessibility label builders for workout controls (#46)
- **setCard i18n keys** — Full translation coverage for SetCard accessibility labels in PT/EN/ES/ZH

---

## [3.10.0] - 2026-05-10

---

## [3.9.0] - 2026-05-03

### Added
- **Program Dashboard** — Enhanced active program card on home screen with weekly volume bar, average sRPE, and key lifts with trend indicators (`#18`)
- **Week Grid** — Visual week-by-week completion grid (✅ done / ❌ missed / 💚 deload) on program detail screen
- **Week Detail Screen** — Tap any week to see sessions for that period with horizontal scrollable week selector
- **Key Lifts** — Top 5 exercises by volume with weekly max weight progression and trend detection (↗️/➡️/↘️)
- **Volume Tracking** — Weekly volume vs 4-week average with progress bar
- **New Service Methods** — `getAverageWeeklyVolume`, `getAverageSRPE`, `getWeekCompletionMap`, `getSessionsForWeek`, `getKeyLifts`
- i18n support for dashboard strings in all 4 languages (PT, EN, ES, ZH)

### Changed
- Program detail week grid now uses real completion data from `weekCompletionMap` instead of static date math
- Week grid cells are now tappable and navigate to week detail screen

## [3.8.0] - 2026-05-03

### Added
- **Notion Markdown Export** — Export individual sessions with YAML frontmatter + exercise tables (`#17`)
- **Weekly Report Screen** — New drawer item "Relatório Semanal" aggregates current week sessions with stats cards and Markdown preview
- i18n support for Notion export strings in all 4 languages (PT, EN, ES, ZH)

### Fixed
- Weekly report sets query uses SQL `IN` clause instead of loading entire database into memory
- Toast messages now correctly differentiate between clipboard copy and Notion MD export

## [3.7.0] - 2026-05-03

### 💊 Supplement Checklist — closes #19

**Added:**
- **Supplement tracking** — Daily checklist with toggle, streak counter, and weekly adherence
- **Default stack** — One-tap seed of Creatine, Caffeine+L-Theanine, D3, Omega 3, Mg Bisglycinate, Ashwagandha
- **Supplement management** — Add/edit/delete custom supplements with dosage, timing, frequency, emoji
- **Supplements screen** — Drawer-accessible checklist with progress bar, FAB add, bottom sheet modal
- **Batch streak query** — Single DB query for all streaks instead of N+1

**Fixed:**
- **41 TypeScript errors** across ProgramService (goal/phase cast, deletedAt IS NULL, Map type), router routes, settings TokenResponse
- **setAllWeeks** parameter type (single object → array)
- **Missing i18n keys** — Added `common.saveSuccess`/`deleteSuccess` and supplement placeholders in PT/EN/ES/ZH
- **Seed function** — Removed `as any` cast, explicit `isActive: true` on all seed data
- **Adherence cap** — `getWeeklyAdherence` now capped at 100%
- **DB indexes** — Added `supplement_logs.supplement_id` and `(supplement_id, date)` compound index

**Database:**
- 2 new tables: `supplements`, `supplement_logs`
- Migration 0018 (schema) + 0019 (performance indexes)

**i18n:**
- Full translation coverage for supplements feature in PT/EN/ES/ZH

---

## [3.6.0] - 2026-05-01

### 🏋️ Structured Periodization (Mesocycles) — closes #16

**Added:**
- **Programs system** — Create and manage training programs with configurable mesocycle length (1-16 weeks)
- **Program weeks** — Each week tracks its own set/reps/weight targets per exercise
- **Double progression tracker** — Automatic weight/reps progression when targets are met (shown in exercise screen)
- **Deload countdown** — Dashboard banner showing weeks until deload week
- **3 new screens** — Program list, program creation wizard, program detail view (accessible via drawer)
- **ProgramService** — Full CRUD + double progression logic with pure-function test coverage
- **usePrograms hook** — React integration layer with active program state management

**Database:**
- 3 new tables: `programs`, `programWeeks`, `programExerciseTargets`
- Migration 0017 with performance indexes

**i18n:**
- Full translation coverage for programs feature in PT/EN/ES/ZH

**Tests:** 300 passing (up from 281), 0 failures

---

## [3.5.0] - 2026-04-30

### 🔒 QA Bug Review — 14 fixes

**Critical:**
- **Hard DELETE → Soft delete** — Sessions now use `deletedAt` timestamp instead of physical deletion, preserving relational integrity for associated sets (`finish.tsx`, `[routineId].tsx`)
- **Import DB validation** — Backup import now validates SQLite header and minimum schema (sessions, sets, exercises tables) before replacing active DB (`DatabaseBackupService.ts`)
- **OAuth dummy ID removed** — No more `DUMMY_ID_FOR_DEV` fallback in Google OAuth; empty clientId blocks OAuth silently instead of connecting to wrong account (`settings.tsx`)

**Bug Fixes:**
- **Warmup volume inflation** — Warmup sets excluded from total volume and set count calculations on finish screen (`finish.tsx`)
- **Duplicate routine exercises** — Composite unique key `(routineId, exerciseId)` added to `routineExercises` table with migration 0016 (`schema.ts`)
- **Personal Records insertion** — PRs now automatically tracked (weight + reps) after each set save (`exercise.tsx`)
- **N+1 queries** — History screen and AnalyticsService batch queries with `inArray()` instead of per-item loops (`history/index.tsx`, `AnalyticsService.ts`)
- **Photo file leak** — Deleting a bio photo now removes the physical file from filesystem (`bio/index.tsx`)
- **Square crop forced** — Photo resize changed to width-only; no longer forces 800×800 square crop (`bio/index.tsx`)
- **Token expiry** — Google Drive upload now checks token expiration (5-min buffer) and prompts re-auth when needed (`settings.tsx`)
- **Raw SQL** — Replaced `IN` clause raw SQL with Drizzle `inArray()` for type safety (`AnalyticsService.ts`)

**Code Quality:**
- Hardcoded hex colors (`#fff`, `#000`) replaced with `Colors.white`, `Colors.black` across 4 layout files
- `as any` photo key access replaced with typed `as const` pattern (`bio/index.tsx`)

**Docs:**
- README (PT/EN/ES/ZH), CLAUDE.md, GEMINI.md — version and test counts updated
- QA review document: `docs/plans/2026-04-30-qa-bug-review.md`

**Tests:** 281 passing (16 suites), 0 failures

---

## [3.4.0] - 2025-04-29

### 🌐 i18n — Full Coverage
- Added `useI18n` hook to 10 components: SetEditor, RoutinePreview, MonthlyCheckinComparison, ErrorBoundary, RestTimer, SetCard, Dialog, EmptyState, _layout screens
- ~150 new translation keys added across pt/en/es/zh
- Replaced all pinyin with proper Chinese characters in zh.ts
- Error/loading screens now use translations even before I18nProvider initializes

### 🐛 Bug Fixes
- **Calendar crash**: Added missing `LocaleConfig` import in history screen
- **AppStack infinite loop**: Fixed recursive component call in `_layout.tsx`
- **Zod v4 compat**: Changed `.errors` → `.issues` in goals and check-in validation

### 🔧 TypeScript
- Resolved all 50 schema/type errors across 12 files
- Fixed Drizzle JOIN result type mismatches (exercise, routine, session queries)
- Fixed unknown catch variable types in settings.tsx
- Zero `tsc --noEmit` errors, zero lint errors

---

## [3.3.6] - 2025-04-28

### ✅ Corrigido
- history/index.tsx: LocaleConfig agora suporta pt/en/es/zh
- routines/editor.tsx: 6 strings de UI traduzidas
- _layout.tsx: Títulos do Stack e Modal de Recuperação traduzidos
- session/exercise.tsx: REPS, RIR labels traduzidos
- session/finish.tsx: NOTE_TEMPLATES movido para dentro do componente
- SetCard.tsx: SET, EDIT labels traduzidos
- Stopwatch.tsx: PAUSED label traduzido
- 50+ novas keys de tradução adicionadas
- Todos os 281 testes passando

---

## [3.3.5] - 2025-04-28

### ✅ Corrigido
- Add `useI18n()` hook a `templates.tsx` e `settings.tsx`
- Substitui 20+ strings hardcoded PT restantes com `t()`
- Adiciona descrições RIR (rirModerateDesc, rirLightDesc) em todos idiomas
- Adiciona keys de ação comuns: cancel, confirm, close, view, exit, stay, back
- Fix declaração duplicada de `t` em `settings.tsx`
- Todos os 281 testes passando

### 🌐 Telas 100% traduzíveis
- Rotinas / Templates / Histórico
- About / Settings / Bio
- Routine Detail / Exercise Session / Finish Session
- Active Workout / Discard Dialog / RIR Explainer

---

## [3.3.4] - 2025-04-28

### ✅ Corrigido
- 150+ strings hardcoded em português convertidas para i18n (`t()`)
- 10 telas agora usam `useI18n()` para tradução completa
- 184 novas keys de tradução adicionadas (pt/en/es/zh)
- Pinyin no `zh.ts` convertido para caracteres chineses reais
- `ProgressBar` agora usa keys de tradução válidas
- Todos os 281 testes passando

### 🌐 Telas corrigidas
- Rotinas / Templates / Histórico
- About / Settings / Bio
- Routine Detail / Exercise Session / Finish Session
- Active Workout / Discard Dialog

---

## [3.3.3] - 2025-04-28

### 🚁 Hotfix
- Corrigido freeze na inicialização causado por hooks `useI18n()` fora do escopo de componentes
- Corrigido `t()` sendo chamado em constantes de módulo (antes do `export function`)
- Corrigido componentes internos sem hook (`ExercisePickerModal`, `ExerciseCard`, `SessionProgress`)
- Adicionado timeout de segurança (500ms) no `I18nProvider` para nunca bloquear inicialização
- Adicionado suporte a interpolação em `t()` (ex: `t("about.version", { version: "3.3.3" })`)
- Corrigida key de tradução `routines.addExercisesHint` em PT/EN/ES/ZH

---

## [3.2.0] - 2026-04-28

### Added
- **Multi-language support (i18n)** — Full translation system with React Context + AsyncStorage persistence
  - Portuguese (default) — complete UI translation
  - English — complete UI translation
  - Spanish — complete UI translation
  - Simplified Chinese (简体中文) — complete UI translation
- **Language selector** in Settings screen — switch languages at runtime
- **Translation tests** — 27 tests covering provider initialization, language switching, fallback behavior, and key parity across all 4 languages
- **Translated documentation** — README available in Portuguese, English, Spanish, and Chinese

### Changed
- Drawer labels now use translations instead of hardcoded Portuguese
- Settings drawer label changed from "Backup & Dados" to "Configurações"
- Test suite expanded from 233 to 260 tests

### Fixed
- `getNestedValue` exported for testability
- `I18nProvider` accepts optional `initialLanguage` prop for deterministic testing

---

## [3.1.4] - 2026-04-28

### Fixed
- **Routine duration estimate** now includes rest periods between sets (not just exercise count)
- **Analytics screen** title changed from "Analytics" to "Dados" (Portuguese)
- **Progress bar alignment** in analytics — text no longer wraps to second line
- **History "Ver" button** truncation fixed with minimum width

## [3.1.3] - 2026-04-28

### Added
- **Delete Sessions** — Soft-delete sessions from history with confirmation dialog
- **Auto-cleanup** — Empty sessions (no sets) are automatically deleted on exit or discard
- **Discard on Finish** — Finishing a workout with zero sets prompts to discard instead of saving

### Changed
- **Bio screen buttons** — METAS/EVOLUÇÃO/DADOS now styled as coral primary buttons (were gray cards)
- **Settings screen** — Compact layout: smaller cards, buttons, gaps, and bottom padding
- **About screen** — Proper bullet formatting and compact layout

### Fixed
- **RestTimer** — Button taps now work (+30s/-10s/Pular), text color visible in dark mode, "Continuar" when finished
- **Session header** — Reduced text size, compact series tags ("2/3 séries"), no truncation
- **Ghost sessions** — Prevent empty/error sessions from being logged in DB

## [3.1.2] - 2026-04-27

### Added
- **History Screen Enhancement** — Cards now show exercise names and set counts per session
- **UI Polish** — Improved layout on home screen last-session card, routine detail stats grid, bio photo section

### Changed
- Calendar theme on History screen switched to dark mode (matches app theme)
- "Analytics" button relabeled to "Dados" to prevent text wrapping
- Photo notes input switched from `Input` component to plain `TextInput`

### Fixed
- **Missing imports** — Added `isNull` and `and` to history screen query (prevents crash on history load)
- **Summary screen sets/volume** — Fixed missing `and`/`isNull` imports causing 0 sets/0 volume display
- **Summary screen query** — Simplified sets query to avoid `isNull` incompatibility with migrated DB columns
- **Drawer navigation** — Hidden internal routes (bio/analytics, routines/templates) from drawer menu
- **Routine detail layout** — Stats reorganized to 2×2 grid, exercise card headers with `numberOfLines=2`
- **Bio screen** — Restructured photo section layout, added Portuguese labels (Frente/Costas/Lateral)

---
## [3.1.1] - 2026-04-26

### Added
- **Analytics Service** — Strength Score (0-100) com breakdown Volume/Intensidade/Consistência
- **Analytics Screen** — Gráfico de volume semanal, streaks, PRs, 1RM estimado, top exercícios
- **CSV Export Service** — Export de sessões e métricas corporais como CSV com share nativo
- **CSV por Sessão** — Export individual pelo Resumo de cada treino
- **Zod Validation** — Schemas para route params e form inputs em todas as telas críticas
- **Domain Hooks** — `useRoutines`, `useSessions`, `useSessionExercise`, `useBodyMetrics`
- **TypeScript Types** — Interfaces tipadas em `src/types/index.ts` (Routine, Session, Set, etc.)
- **Error Boundary** — Componente com fallback visual + stack trace em dev mode
- **Barrel Exports** — `services/index.ts`, `hooks/index.ts`, `src/utils/index.ts`
- **Logger Service** — Logging estruturado substituindo `console.log`
- **134 testes unitários** em 9 suites (utils, services, validators)

### Changed
- Eliminado todo `useState<any>` (10 ocorrências em 7 arquivos)
- Eliminado `as any` do Drawer layout
- PR count no finish agora consulta `personalRecords` ao invés de hardcoded `0`
- Consolidado `utils/` → `src/utils/` (calculations.ts)
- Skeleton loading substitui ActivityIndicator na tela de Analytics
- Telas refatoradas para usar hooks de domínio ao invés de DB direto

### Fixed
- `validateField` fallback para coercion errors sem `errors[0]`
- Hooks order violation no `exercise.tsx` ao integrar Zod (validação movida para depois dos hooks)

---

## [3.1.0] - 2026-04-16

### Added
- Photo Comparison — Galeria de fotos com comparação lado a lado
- Template Library — Biblioteca de rotinas pré-definidas com importação
- Enhanced Bio Check-in — Check-in mensal com mais medidas

### Changed
- UI refinements no fluxo de sessão

---

## [3.0.0] - 2026-03-XX

### Added
- Design System "Warm & Earthy" — Cartões arredondados, tipografia hierárquica
- Feedback tátil com Haptics
- Motion design com Reanimated
- Streak tracking de consistência
- Metas com data-alvo

### Changed
- Redesign completo da interface

---

## [2.0.0] - 2026-02-XX

### Added
- Drizzle ORM com SQLite
- Timer de descanso inteligente
- Stopwatch para exercícios de tempo
- Bio-tracking (peso, medidas, fotos)
- Backup local e Google Drive
- Importação JSON de rotinas
- Notificações de lembrete mensal

---

## [1.0.0] - 2026-01-XX

### Added
- MVP: Registro de treinos com séries e cargas
- Gestão de rotinas
- Histórico de sessões


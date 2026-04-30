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

# Changelog

All notable changes to Iron Log are documented here.

## [Unreleased]

### Added
- Issue #20: Automated Monthly Check-in Comparison
  - New `/bio/checkin` screen with side-by-side photo comparison (front/back/side)
  - Measurement overlays on photos showing weight and waist
  - Chronological gallery with horizontal scroll of all monthly check-ins
  - "Before/After" slider per pose via enhanced PhotoComparison
  - Pure utility functions with full test coverage (processCheckinData, formatMonthYear, calculateChange)
  - Enhanced monthly notification with deep link to `/bio/checkin`
  - i18n translations for check-in flow in PT/EN/ES/ZH

### Fixed
- `Input.tsx` event handler types (`onFocus`/`onBlur`)
- `use-body-metrics.ts` Drizzle result type casting

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

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Iron Log** is a local-first workout tracking application built with React Native and Expo. It tracks workouts, body metrics (weight, measurements, photos), and provides a complete bio-tracking solution with visualization. The app features a "Warm & Earthy" (Terracota/Creme) theme that adapts to system light/dark mode.

**Current Version:** v3.11.0

## Tech Stack

- **Core:** React Native (Expo SDK 54) + TypeScript
- **Routing:** Expo Router (file-based routing)
- **Database:** SQLite (local-first) + Drizzle ORM
- **UI:** NativeWind v4 (Tailwind for React Native), React Native Reanimated (Animations)
- **Media:** Expo Image Picker, Expo File System
- **Charts:** react-native-gifted-charts for bio tracking visualization
- **Notifications:** expo-notifications for monthly check-in reminders
- **Haptics:** expo-haptics for tactile feedback
- **Date Picker:** @react-native-community/datetimepicker for date selection
- **i18n:** React Context + AsyncStorage — Portuguese (default), English, Spanish, Simplified Chinese

## Common Commands

### Development
```bash
npm start              # Start development server
npm run android        # Run on Android device/emulator
npm run ios            # Run on iOS simulator
npm run web            # Run in web browser
npm run lint           # Run ESLint
```

### Database Management
```bash
npx drizzle-kit generate    # Generate new migration from schema changes
npx drizzle-kit push        # Apply migrations to database (not listed but standard)
```

### Project Maintenance
```bash
node scripts/reset-project.js    # Reset project (used for template resets)
npm install                       # Install dependencies
```

## Architecture

### Navigation Structure

The app uses two distinct navigation contexts:

1. **Drawer Layout** (`app/(drawer)/`) - Main app navigation
   - `index.tsx` - Dashboard/Home
   - `bio/index.tsx` - Bio metrics entry (daily weight) + Goals/Evolution buttons
   - `bio/evolution.tsx` - Visualization of progress (charts, photos, analytics)
   - `bio/goals.tsx` - Goal setting for measurements (hidden from drawer)
   - `bio/analytics.tsx` - Strength Score, Volume Trends, PRs, 1RM
   - `bio/checkin.tsx` - Monthly check-in with side-by-side photo comparison
   - `programs/index.tsx` - Program list and management
   - `programs/create.tsx` - Program creation wizard
   - `programs/detail.tsx` - Program detail with week grid and key lifts
   - `programs/week-detail.tsx` - Sessions for a specific program week
   - `supplements/index.tsx` - Daily supplement checklist and management
   - `reports/weekly.tsx` - Weekly report with Markdown export
   - `routines/index.tsx` - Routine list and management
   - `routines/editor.tsx` - Create/edit routines
   - `history/index.tsx` - Calendar view of past sessions
   - `settings.tsx` - App settings, backup, and notification preferences

2. **Session Flow** (`app/session/`) - Isolated stack for active workouts
   - `[routineId].tsx` - Exercise selection with progress bar and session stats
   - `exercise.tsx` - Active exercise tracking with bottom sheet rest timer, undo capability, and swipe-to-delete
   - `finish.tsx` - Session finalization with statistics, weight comparison, note templates, and confirmation dialog
   - `summary.tsx` - Visual dashboard with stats grid, best performance card, native sharing, and celebration

### Database Schema (src/db/schema.ts)

The app uses 15 main tables:

- **routines** - Workout templates (e.g., "Workout A", "Workout B")
- **exercises** - Exercise library
- **routine_exercises** - Join table with order, targets, notes
- **sessions** - Individual workout sessions (links to routine)
- **sets** - Individual sets recorded during sessions
- **body_metrics** - Body weight, measurements, photos
- **user_settings** - User preferences (single row table)
- **notification_settings** - Monthly check-in notification preferences (day, hour, enabled)
- **measurement_goals** - User goals for body metrics with target dates
- **personal_records** - Personal records tracking (weight, reps, volume PRs)
- **programs** - Training programs with configurable mesocycle length
- **programWeeks** - Weekly targets per exercise within a program
- **programExerciseTargets** - Set/reps/weight targets per exercise per week
- **supplements** - Supplement definitions (name, dosage, timing, frequency)
- **supplementLogs** - Daily supplement check-in records

### Key Implementation Details

**Session Flow** (`app/_layout.tsx`):
- Session flow is a pure Stack navigator separate from the Drawer
- Wrapped in `GestureHandlerRootView` for swipe actions
- Migrations run on app startup with loading/error states
- Deep linking from outside app opens directly to workout session
- Features consistent save behavior, progress indicators, and undo capability

**Design System Components** (`components/` — 20 total):
- **Button** - Animated pressable button with variants (primary, secondary, danger, ghost, success) and tactile feedback.
- **Card** - Standardized `rounded-2xl` container with consistent shadows and borders.
- **CheckinGallery** - Horizontal scroll gallery for monthly check-in photos.
- **Input** - Styled text input with focus animations, success state, and haptic feedback.
- **DatePicker** - Native date picker component with theme support for iOS and Android.
- **EmptyState** - Consistent empty state component with icons, titles, descriptions, and CTAs.
- **MonthlyCheckinComparison** - Side-by-side photo comparison with measurement overlays.
- **PhotoComparison** - Before/after slider for comparing photos.
- **PhotoOverlay** - Measurement data overlay on check-in photos.
- **ProgressBar** - Visual progress indicator with animated fill.
- **RoutinePreview** - Preview card for routine details.
- **SetCard** - Swipeable card for saved sets with entry animations and color-coded RIR.
- **SetEditor** - Inline set editor with weight/reps/RPE inputs.
- **Skeleton** - Animated placeholder components for loading states.
- **RestTimer** - Bottom sheet rest timer with quick actions.
- **Stopwatch** - Enhanced timer with pause/resume capability.
- **StrengthCurve** - Strength progression visualization component.
- **Toast** - Animated toast notification component.
- **Dialog** - Confirmation dialog for destructive actions.
- **ErrorBoundary** - React error boundary with visual fallback + dev stack trace.

**Color Scheme** (`hooks/use-color-scheme.ts`):
- Dark mode: `#1D1917` (background)
- Light mode: `#F4F1DE` (background)
- Primary: `#E07A5F` (Terracotta)
- Follows system theme automatically
- RIR color coding: Red (0-1), Green (2-3), Blue (4-5)

**Typography** (`constants/typography.ts`):
- Standardized type scale: xs (10px), sm (12px), base (14px), lg (16px), xl (18px), 2xl (20px), 3xl (24px), 4xl (30px)
- Used consistently across all components

**Domain Hooks** (`hooks/`):
- **use-routines.ts** - CRUD de rotinas (fetch, delete, duplicate, filter)
- **use-sessions.ts** - Histórico de sessões e home data
- **use-session-exercise.ts** - Lógica de séries na tela de exercício (load, add, update, delete)
- **use-body-metrics.ts** - Métricas corporais (peso, medidas, histórico)
- **use-haptics.ts** - Unified haptic feedback (light, medium, heavy, success, warning, error, selection)
- **use-notifications.ts** - Notification settings state and actions
- **use-programs.ts** - Program CRUD, active program state, dashboard data
- **use-supplements.ts** - Supplement checklist, streaks, adherence tracking

All hooks export barrel via `hooks/index.ts`.

**Services** (`services/`):
- **AnalyticsService.ts** - Strength Score (0-100), Consistency metrics, Volume Trends, 1RM Epley, PR tracking
- **CsvExportService.ts** - Export sessions/body metrics/exercises as CSV with native share
- **AlexandriaExportService.ts** - Structured JSON export for Alexandria MCP server integration
- **DatabaseBackupService.ts** - Database export/import and Google Drive backup
- **NotionExportService.ts** - Notion Markdown export with YAML frontmatter for sessions and weekly reports
- **ProgramService.ts** - Program CRUD, double progression logic, dashboard data (volume, sRPE, key lifts)
- **NotificationService.ts** - Monthly check-in notification scheduling with permission handling
- **logger.ts** - Structured logging replacing console.log

All services export barrel via `services/index.ts`.

**Validation** (`src/validators/`):
- **routes.ts** - Zod schemas for route params (exerciseParams, sessionParams, summaryParams, etc.) + `safeParseParams()` helper
- **forms.ts** - Zod schemas for form inputs (weight, sets, goals, RPE) + `validateField()` helper
- All screens validate inputs before submission; invalid params fall back to safe defaults.

**Testing** (`__tests__/`):
- 17 test suites, 300 tests passing
- Utils: exercise, timer, warmup, calculations
- Services: analytics (Epley formula, scoring logic), csv-export (escapeCsvField, formatDateBR)
- Validators: routes (15 tests), forms (32 tests)
- i18n, screens, hooks, components
- Run: `npx jest`

### Configuration Files

- **app.json** - Expo configuration
- **drizzle.config.ts** - Drizzle ORM configuration
- **babel.config.js** - Babel with NativeWind and Reanimated plugin
- **tailwind.config.js** - NativeWind v4 configuration with custom color variables
- **eslint.config.js** - Expo ESLint configuration

## Development Notes

### Importing Routines via JSON

The app supports importing workout routines via JSON. Structure:
```json
{
  "name": "Treino A - Peito",
  "description": "Foco em carga",
  "exercises": [
    {
      "name": "Supino Reto",
      "target": "4x8",
      "rest": 180,
      "notes": "Barra Olímpica",
      "type": "strength"
    }
  ]
}
```

### Exercise Types

- **strength** - Weight/reps based exercises (requires explicit save)
- **duration** - Time-based exercises (e.g., plank) with explicit save button (no auto-save)

**Recent Updates (v3.6.0–v3.11.0)**

**v3.11.0 — UI/UX Audit Fixes (13 issues):**
- Full accessibility pass: SetCard labels, touch targets, sliders, gallery, swipe alternatives
- Haptics standardization via reusable Pressable component
- Themed color tokens replacing hardcoded hex values
- Complete i18n coverage for session/progress copy and date formatting
- Safe area fixes for fixed layouts
- Secondary flow fixes (history, evolution, finish, templates)
- CI quality gate (GitHub Actions: typecheck + lint + test)

**v3.10.0 — CI & Infrastructure:**
- (Merged into v3.11.0 release batch)

**v3.9.0 — Program Dashboard:**
- Enhanced active program card on home with weekly volume, sRPE, and key lifts
- Tappable week grid with completion tracking (done/missed/deload)
- Week detail screen with horizontal scroll week selector
- Key lifts: top 5 exercises by volume with trend detection

**v3.8.0 — Notion Export:**
- Notion Markdown export with YAML frontmatter for individual sessions
- Weekly report screen with aggregated stats and Markdown preview

**v3.7.0 — Supplement Checklist:**
- Daily supplement tracking with streak counter and weekly adherence
- Default stack seed (creatine, caffeine, D3, omega 3, etc.)
- Custom supplement management with dosage/timing/frequency

**v3.6.0 — Structured Periodization:**
- Programs system with configurable mesocycles (1-16 weeks)
- Program weeks with per-exercise set/reps/weight targets
- Double progression tracker and deload countdown

**v3.5.0 — QA Bug Review (14 fixes):**
- Soft delete for sessions, DB import validation, OAuth security
- Warmup volume inflation fix, duplicate routine exercises prevention
- N+1 query optimization, photo file leak fix

**v3.2.0 — Full i18n:**
- 4 languages (PT/EN/ES/ZH) with React Context + AsyncStorage
- 27 translation tests covering provider, switching, fallback, key parity

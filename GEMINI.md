# GEMINI.md

This file provides context and instructions for the Gemini AI agent working on the **Iron Log** project.

## 1. Project Overview

*   **Name:** Iron Log
*   **Description:** A local-first, friction-free workout and bio-tracking application. Focuses on speed of entry, offline capability, and visual progress tracking.
*   **Platform:** React Native (Expo SDK 54) targeting Android and iOS.
*   **Current State:** v3.12.0.
*   **Primary Language:** TypeScript.

## 2. Technology Stack

*   **Framework:** React Native + Expo (Managed Workflow).
*   **Navigation:** Expo Router (File-based routing).
*   **Database:** Local SQLite via `expo-sqlite`, managed by **Drizzle ORM**.
*   **Styling:** **NativeWind v4** (Tailwind CSS for React Native).
*   **i18n:** React Context + AsyncStorage persistence — Portuguese (default), English, Spanish, Simplified Chinese.
*   **Animations:** **React Native Reanimated** (Tactile feedback, transitions).
*   **UI Components:** Custom polished components in `components/` (`Button`, `Card`, `Input`, `SetCard`).

## 3. Key Architecture & Structure

### Directory Map
*   **`app/`**: Application screens and routes (Expo Router).
    *   `app/(drawer)/`: Main navigation (Home, Bio, Routines, History).
        *   `programs/`: Program list, creation, detail, week detail.
        *   `supplements/`: Daily supplement checklist and management.
        *   `reports/`: Weekly report with Markdown export.
        *   `bio/checkin.tsx`: Monthly check-in photo comparison.
        *   `bio/analytics.tsx`: Strength Score, Volume, PRs, 1RM.
    *   `app/session/`: **Isolated Stack** for active workout sessions. *Critical logic here.*
*   **`src/db/`**: Database layer.
    *   `schema.ts`: **Source of Truth** for the data model.
    *   `client.ts`: DB connection and migration runner.
*   **`src/validators/`**: Zod schemas for route params (`routes.ts`) and form inputs (`forms.ts`).
*   **`src/i18n/`**: Translation system with React Context, `useI18n()` hook, and 4 language files.
*   **`src/utils/`**: Pure utility functions (exercise, timer, warmup, calculations). Export via `src/utils/index.ts`.
*   **`drizzle/`**: SQL Migration files.
*   **`components/`**: Reusable polished UI components.
*   **`hooks/`**: Domain hooks (routines, sessions, session-exercise, body-metrics) + utility hooks (haptics, notifications, color-scheme). All export via `hooks/index.ts`.
    *   `use-programs.ts`: Program CRUD, active program state, dashboard data.
    *   `use-supplements.ts`: Supplement checklist, streaks, adherence tracking.
*   **`services/`**: Business logic services (AnalyticsService, CsvExportService, AlexandriaExportService, DatabaseBackupService, NotificationService, logger). All export via `services/index.ts`.
    *   `NotionExportService.ts`: Notion Markdown export for sessions and weekly reports.
    *   `ProgramService.ts`: Program CRUD, double progression, dashboard data.
*   **`assets/`**: Images and static resources.

### Data Model (Drizzle)
The app relies on a strictly typed SQLite schema. Key tables include:
*   `routines`: Workout templates.
*   `exercises`: Definition of exercises.
*   `routine_exercises`: Join table linking routines to exercises with order/targets.
*   `sessions`: Records of completed workouts.
*   `sets`: Individual performance records (weight, reps, RPE).
*   `body_metrics`: Bio-tracking data (weight, photos, measurements).
*   `notification_settings`: Monthly check-in notification preferences.
*   `measurement_goals`: User goals for body metrics with target dates.
*   `personal_records`: PR tracking (weight, reps, volume, duration).
*   `user_settings`: App preferences (single-row table).
*   `programs`: Training programs with configurable mesocycle length.
*   `program_weeks`: Weekly targets per exercise within a program.
*   `program_exercise_targets`: Set/reps/weight targets per exercise per week.
*   `supplements`: Supplement definitions (name, dosage, timing, frequency).
*   `supplement_logs`: Daily supplement check-in records.

## 4. Development Workflow & Commands

### Building & Running
*   **Start Dev Server:** `npm start` (or `npx expo start`)
*   **Run on Android:** `npm run android`
*   **Run on iOS:** `npm run ios`
*   **Run on Web:** `npm run web`

### Database Management (CRITICAL)
When modifying `src/db/schema.ts`, you **MUST** generate a migration file:
1.  Modify `src/db/schema.ts`.
2.  Run: `npx drizzle-kit generate`
3.  (Optional) Verify the generated SQL in `drizzle/`.
*Note: Migrations are automatically applied when the app starts.*

### Linting & Testing
*   **Lint:** `npm run lint`
*   **Tests:** `npx jest` (17 suites, 300 tests)

## 5. Coding Conventions & Guidelines

### Styling (NativeWind & Design System)
*   **Theme:** Use the "Warm & Earthy" palette (`bg-background`, `text-text`, `bg-primary`, `bg-card`).
*   **Components:** **ALWAYS** use the polished components from `components/` instead of raw React Native elements:
    *   `Button` instead of `TouchableOpacity` + `Text`.
    *   `Card` instead of `View` with borders/shadows.
    *   `Input` instead of `TextInput`.
    *   `DatePicker` instead of raw DateTimePicker.
    *   `EmptyState` for empty data states.
*   **Motion:** Use `Animated` from `react-native-reanimated` for all animations. Prefer `FadeInDown` for lists.
*   **Haptics:** Use `useHaptics()` hook for tactile feedback on all interactions.

### Session Flow Logic
*   The "Session Flow" (`app/session/`) is complex. It involves:
    *   Timers (Stopwatch, Rest Timer).
    *   State persistence (preventing data loss during workout).
    *   complex navigation (Finishing, Summary).
*   **Caution:** Be extremely careful when refactoring files in `app/session/`. Ensure state is preserved.

### Routine Import
*   The app supports JSON import for routines. When generating routine data, strictly follow the JSON structure defined in `README.md` or `CLAUDE.md`.

### Data & Backup
*   **Export/Import:** Located in `app/(drawer)/settings.tsx`. Uses `services/DatabaseBackupService.ts`.
*   **Google Drive Backup:** Requires `EXPO_PUBLIC_GOOGLE_CLIENT_ID` in `.env`. Uses `expo-auth-session` and Google Drive API (v3).

## 6. Important Files to Reference
*   `package.json`: Dependencies.
*   `src/db/schema.ts`: Database definitions.
*   `app/_layout.tsx`: Root layout and navigation setup.
*   `nativewind-env.d.ts`: Type definitions for NativeWind.

---
**Agent Note:** Always check `src/db/schema.ts` before writing queries. If you change the schema, remember to generate migrations.


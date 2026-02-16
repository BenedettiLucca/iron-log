# GEMINI.md

This file provides context and instructions for the Gemini AI agent working on the **Iron Log** project.

## 1. Project Overview

*   **Name:** Iron Log
*   **Description:** A local-first, friction-free workout and bio-tracking application. Focuses on speed of entry, offline capability, and visual progress tracking.
*   **Platform:** React Native (Expo SDK 54) targeting Android and iOS.
*   **Current State:** v3.1.1 (Optimized Edition).
*   **Primary Language:** TypeScript.

## 2. Technology Stack

*   **Framework:** React Native + Expo (Managed Workflow).
*   **Navigation:** Expo Router (File-based routing).
*   **Database:** Local SQLite via `expo-sqlite`, managed by **Drizzle ORM**.
*   **Styling:** **NativeWind v4** (Tailwind CSS for React Native).
*   **Animations:** **React Native Reanimated** (Tactile feedback, transitions).
*   **UI Components:** Custom polished components in `components/` (`Button`, `Card`, `Input`, `SetCard`).

## 3. Key Architecture & Structure

### Directory Map
*   **`app/`**: Application screens and routes (Expo Router).
    *   `app/(drawer)/`: Main navigation (Home, Bio, Routines, History).
    *   `app/session/`: **Isolated Stack** for active workout sessions. *Critical logic here.*
*   **`src/db/`**: Database layer.
    *   `schema.ts`: **Source of Truth** for the data model.
    *   `client.ts`: DB connection and migration runner.
*   **`drizzle/`**: SQL Migration files.
*   **`components/`**: Reusable polished UI components.
*   **`hooks/`**: Custom React hooks (notifications, haptics, bio streaks, PRs, volume).
*   **`services/`**: Business logic services (NotificationService, DatabaseBackupService).
*   **`assets/`**: Images and static resources.

### Data Model (Drizzle)
The app relies on a strictly typed SQLite schema. Key tables include:
*   `routines`: Workout templates.
*   `exercises`: Definition of exercises.
*   `sessions`: Records of completed workouts.
*   `sets`: Individual performance records (weight, reps, RPE).
*   `body_metrics`: Bio-tracking data (weight, photos, measurements).
*   `notification_settings`: Monthly check-in notification preferences.
*   `measurement_goals`: User goals for body metrics.
*   `personal_records`: PR tracking (weight, reps, volume).

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

### Linting
*   **Lint:** `npm run lint`

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

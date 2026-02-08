# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Iron Log** is a local-first workout tracking application built with React Native and Expo. It tracks workouts, body metrics (weight, measurements, photos), and provides a complete bio-tracking solution with visualization. The app features a "Warm & Earthy" (Terracota/Creme) theme that adapts to system light/dark mode.

**Current Version:** v3.0 (Polished Edition)

## Tech Stack

- **Core:** React Native (Expo SDK 54) + TypeScript
- **Routing:** Expo Router (file-based routing)
- **Database:** SQLite (local-first) + Drizzle ORM
- **UI:** NativeWind v4 (Tailwind for React Native), React Native Reanimated (Animations)
- **Media:** Expo Image Picker, Expo File System
- **Charts:** react-native-gifted-charts for bio tracking visualization

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
   - `bio/index.tsx` - Bio metrics entry (daily weight)
   - `bio/evolution.tsx` - Visualization of progress (charts, photos)
   - `routines/index.tsx` - Routine list and management
   - `routines/editor.tsx` - Create/edit routines
   - `history/index.tsx` - Calendar view of past sessions

2. **Session Flow** (`app/session/`) - Isolated stack for active workouts
   - `[routineId].tsx` - Exercise selection with progress bar and session stats
   - `exercise.tsx` - Active exercise tracking with bottom sheet rest timer, undo capability, and swipe-to-delete
   - `finish.tsx` - Session finalization with statistics, weight comparison, note templates, and confirmation dialog
   - `summary.tsx` - Visual dashboard with stats grid, best performance card, native sharing, and celebration

### Database Schema (src/db/schema.ts)

The app uses 8 main tables:

- **routines** - Workout templates (e.g., "Workout A", "Workout B")
- **exercises** - Exercise library
- **routine_exercises** - Join table with order, targets, notes
- **sessions** - Individual workout sessions (links to routine)
- **sets** - Individual sets recorded during sessions
- **body_metrics** - Body weight, measurements, photos
- **user_settings** - User preferences (single row table)

### Key Implementation Details

**Session Flow** (`app/_layout.tsx`):
- Session flow is a pure Stack navigator separate from the Drawer
- Wrapped in `GestureHandlerRootView` for swipe actions
- Migrations run on app startup with loading/error states
- Deep linking from outside app opens directly to workout session
- Features consistent save behavior, progress indicators, and undo capability

**Design System Components** (`components/`):
- **Button** - Animated pressable button with variants (primary, secondary, danger, ghost, success) and tactile feedback.
- **Card** - Standardized `rounded-2xl` container with consistent shadows and borders.
- **Input** - Styled text input with optional label and error state.
- **ProgressBar** - Visual progress indicator with animated fill.
- **SetCard** - Swipeable card for saved sets with entry animations and color-coded RIR.
- **RestTimer** - Bottom sheet rest timer with quick actions.
- **Stopwatch** - Enhanced timer with pause/resume capability.

**Color Scheme** (`hooks/use-color-scheme.ts`):
- Dark mode: `#1D1917` (background)
- Light mode: `#F4F1DE` (background)
- Primary: `#E07A5F` (Terracotta)
- Follows system theme automatically
- RIR color coding: Red (0-1), Green (2-3), Blue (4-5)

**Typography** (`constants/typography.ts`):
- Standardized type scale: xs (10px), sm (12px), base (14px), lg (16px), xl (18px), 2xl (20px), 3xl (24px), 4xl (30px)
- Used consistently across all components

### Configuration Files

- **app.json** - Expo configuration (version 3.0.0)
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

**Recent Updates (v3.0)**

**Database Portability:**
- **Service:** `services/DatabaseBackupService.ts` handles all file operations and API calls.
- **Features:** Local export/import (Share/DocumentPicker) and Google Drive upload.
- **Dependencies:** `expo-sharing`, `expo-document-picker`, `expo-auth-session`, `expo-file-system`.
- **Config:** Requires `EXPO_PUBLIC_GOOGLE_CLIENT_ID` for cloud features.

**Frontend Polish:**
- Integrated `react-native-reanimated` for tactile button feedback and staggered entry animations.
- Unified UI with polished `Card`, `Input`, and `Button` components.
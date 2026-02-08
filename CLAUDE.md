# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Iron Log** is a local-first workout tracking application built with React Native and Expo. It tracks workouts, body metrics (weight, measurements, photos), and provides a complete bio-tracking solution with visualization. The app features a "Warm & Earthy" (Terracota/Creme) theme that adapts to system light/dark mode.

**Current Version:** v2.4.1 (Session Flow UX Overhaul)

## Tech Stack

- **Core:** React Native (Expo SDK 54) + TypeScript
- **Routing:** Expo Router (file-based routing)
- **Database:** SQLite (local-first) + Drizzle ORM
- **UI:** NativeWind v4 (Tailwind for React Native), React Native Calendars, Gifted Charts
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

**Session Flow** (`app/_layout.tsx:31-46`):
- Session flow is a pure Stack navigator separate from the Drawer
- Wrapped in `GestureHandlerRootView` for swipe actions
- Migrations run on app startup with loading/error states
- Deep linking from outside app opens directly to workout session
- Features consistent save behavior, progress indicators, and undo capability

**Database Client** (`src/db/client.ts`):
- Uses Expo SQLite with Drizzle ORM
- Migrations auto-apply on app start
- Schema defined in `src/db/schema.ts` (79 lines)

**Target Parser** (`src/utils/target-parser.ts`):
- Parses workout targets like "3x8-12" or "60s"
- Handles both strength and duration-based exercises

**Design System Components** (`components/`):
- **Button** - Reusable button with variants (primary, secondary, danger, ghost, success), sizes, loading states
- **Card** - Standardized card container with variants (default, bordered, elevated, flat)
- **Input** - Form input with label and error state support
- **ProgressBar** - Visual progress indicator with animated fill (header, modal, compact variants)
- **SetCard** - Swipeable card for saved sets with edit/delete actions and color-coded RIR
- **RestTimer** - Bottom sheet rest timer with quick actions (+30s, -10s, Skip)
- **Stopwatch** - Enhanced timer with pause/resume capability and hours display

**Color Scheme** (`hooks/use-color-scheme.ts`):
- Dark mode: `#1D1917` (background)
- Light mode: `#F4F1DE` (background)
- Primary: `#E07A5F` (Terracotta)
- Follows system theme automatically
- RIR color coding: Red (0-1), Green (2-3), Blue (4-5)

**Typography** (`constants/typography.ts`):
- Standardized type scale: xs (10px), sm (12px), base (14px), lg (16px), xl (18px), 2xl (20px)
- Used consistently across all components

### Configuration Files

- **app.json** - Expo configuration (version 2.4.0, package: com.lucca.ironlog)
- **drizzle.config.ts** - Drizzle ORM configuration
- **babel.config.js** - Babel with NativeWind and inline-import SQL plugin
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

### Session Flow Features

**Consistent Interactions:**
- All exercise types require explicit "SALVAR SÉRIE" button press
- 10-second undo window after saving sets (dismissible banner)
- Loading states prevent double-tap during operations
- Swipe-to-delete on saved sets with confirmation

**Progress Indication:**
- Progress bar showing "X de Y exercises completed"
- Current set number with target comparison (e.g., "Série 2 de 4")
- Session statistics cards (sets, volume, exercises)
- Visual stat grid on summary screen

**Rest Timer:**
- Bottom sheet overlay (not full-screen modal)
- Quick actions: +30s, -10s, Skip Rest
- Next exercise preview
- Visual status indicator (resting vs. ready)

**Enhanced Feedback:**
- Color-coded RIR values based on intensity
- Note templates with emojis (🍽️ Jejum, 😴 Ruim, 🏆 PR!, ❤️ Cardio)
- Motivational messages based on sRPE level
- Celebration animation on session complete
- Best performance card highlighting PR sets

### Build Process

**Android Release:**
```bash
cd android && ./gradlew assembleRelease
```

### Testing

A test script exists at `scripts/test-db-logic.ts` for database logic testing.

## Theme System

The app uses CSS custom properties (defined in global.css) for theming:
- `--background` - Main background color
- `--text` / `--subtext` - Text colors
- `--primary` / `--secondary` / `--accent` - UI accent colors
- `--success` / `--danger` - Status colors

Colors adapt based on `useColorScheme()` hook, supporting automatic dark/light mode.

## File Locations

- **Database Schema:** `src/db/schema.ts`
- **Database Client:** `src/db/client.ts`
- **Target Parser:** `src/utils/target-parser.ts`
- **Typography Scale:** `constants/typography.ts`
- **Global Styles:** `global.css`
- **Migrations:** `drizzle/` directory (SQL files)
- **Design Components:** `components/Button.tsx`, `components/Card.tsx`, `components/Input.tsx`, `components/ProgressBar.tsx`, `components/SetCard.tsx`, `components/RestTimer.tsx`, `components/Stopwatch.tsx`
- **Session Screens:** `app/session/[routineId].tsx`, `app/session/exercise.tsx`, `app/session/finish.tsx`, `app/session/summary.tsx`

## Recent Updates (v2.4.1)

### Session Flow UX Overhaul
Complete redesign of the workout tracking experience:

**New Features:**
- Visual progress indicators throughout session
- Bottom sheet rest timer with quick actions
- 10-second undo window for saved sets
- Swipe-to-delete on saved sets
- Session statistics dashboard
- Weight comparison with previous entries
- Note templates for quick logging
- Native share integration
- Best performance highlighting
- Motivational messages and celebrations

**Accessibility Improvements:**
- All touch targets ≥44pt (WCAG compliance)
- Consistent color contrast ratios
- Proper active states on all interactive elements
- Screen reader compatible components

**Design System:**
- Reusable component library with consistent styling
- Standardized typography scale
- Color-coded RIR values (red/green/blue)
- Card-based UI with elevation and borders
- Button variants (primary, secondary, danger, ghost, success)

**Bug Fixes:**
- Duration exercises no longer auto-save (now consistent with strength exercises)
- Improved validation with inline error messages
- Confirmation dialogs for destructive actions
- Prevented double-tap on save buttons
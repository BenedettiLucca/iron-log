# Changelog

All notable changes to Iron Log will be documented in this file.

## [2.4.1] - 2025-02-08

### Session Flow UX Overhaul

Complete redesign of the workout tracking experience with improved consistency, feedback, and visual polish.

### 🎨 New Design System Components

- **Button** - Reusable button component with variants (primary, secondary, danger, ghost, success)
- **Card** - Standardized card container with multiple variants
- **Input** - Form input with label and error state support
- **ProgressBar** - Visual progress indicator with animations
- **SetCard** - Swipeable card for saved sets with edit/delete actions
- **RestTimer** - Bottom sheet rest timer with quick actions
- **Typography** - Standardized type scale (xs to 7xl)

### ✨ Exercise Selection Screen (`app/session/[routineId].tsx`)

- Added session progress bar showing completed/total exercises
- Enhanced exercise cards with completion badges and visual feedback
- Added confirmation dialog before finishing early
- Improved real-time set counting with live queries
- Better tap feedback and active states

### 🏋️ Exercise Tracking Screen (`app/session/exercise.tsx`)

- **Standardized save behavior** - Duration exercises now require explicit "SALVAR" button (no auto-save)
- **Bottom sheet rest timer** - Replaced full-screen modal with overlay
- **10-second undo window** - Dismissible banner to undo last saved set
- **Progress indicators** - Shows "Exercise X of Y" and current set number
- **Swipe-to-delete** - Remove saved sets with swipe gesture
- **Color-coded RIR** - Red (0-1), Green (2-3), Blue (4-5)
- **Loading states** - Prevents double-tap during save operations
- Enhanced Stopwatch component with pause/resume support

### 📊 Session Finish Screen (`app/session/finish.tsx`)

- Session statistics card (total sets, volume, exercises)
- Enhanced weight input with previous weight comparison (+/- indicator)
- Quick increment/decrement buttons (+/- 0.5kg)
- Visual sRPE scale with descriptions and recovery recommendations
- Quick note templates with emojis (🍽️ Jejum, 😴 Ruim, 🏆 PR!, ❤️ Cardio)
- Character count for notes
- Confirmation dialog showing full summary before finalizing

### 📈 Summary Screen (`app/session/summary.tsx`)

- Visual statistics dashboard (sets, volume, sRPE, minutes)
- Best performance card highlighting highest volume set
- Native share integration using React Native Share API
- Celebration elements (🎉 emoji, motivational messages based on sRPE)
- Enhanced markdown report with emojis
- Improved navigation options

### ♿ Accessibility Improvements

- All touch targets meet 44pt minimum (WCAG compliance)
- Consistent color contrast ratios throughout
- Proper active states on all interactive elements
- Screen reader compatible components
- Gesture handler support for swipe actions

### 🐛 Bug Fixes

- Duration exercises no longer auto-save (now consistent with strength exercises)
- Improved input validation with inline error messages
- Added confirmation dialogs for destructive actions
- Prevented double-tap on save buttons
- Fixed navigation issues with proper confirmation flows

### 🔧 Technical Changes

- Added `GestureHandlerRootView` wrapper to app layout
- Enhanced `Stopwatch` component with pause/resume and hours display
- Improved error handling throughout session flow
- Better state management with proper cleanup

### 📝 Documentation

- Updated CLAUDE.md with new components and features
- Added IMPLEMENTATION_SUMMARY.md with detailed changes
- Updated app.json version to 2.4.1

---

## [2.4.0] - Previous Release

- Warm & Earthy theme with system dark/light mode adaptation
- Local-first SQLite database with Drizzle ORM
- Routine management and exercise library
- Bio tracking (weight, measurements, photos)
- Calendar view of workout history
- Markdown session reports

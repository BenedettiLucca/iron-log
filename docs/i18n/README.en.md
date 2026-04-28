# Iron Log 🏋️‍♂️

> **Zero-Friction Workout Log, Bio-Tracking, Analytics & Export**

**Iron Log** is a complete local-first fitness monitoring platform. Built for people who take training seriously — fast load logging, body tracking, performance analytics, and data export.

**Version:** 3.2.0 · **Expo SDK:** 54 · **Tests:** 260 passing

---

## 🌍 Supported Languages

- 🇧🇷 **Português** (default)
- 🇺🇸 **English**
- 🇪🇸 **Español**
- 🇨🇳 **简体中文**

The language can be changed anytime in **Settings**.

---

## 📱 Features

### 💪 Workout & Performance
- **Session Management** — Persistent stopwatch, real duration control, continuous flow between exercises
- **Active Stopwatch** — Dedicated timer for time-based exercises (Plank, Dead Hang)
- **Pro Timer** — Smart rest timer that works in the background
- **Instant History** — Check previous loads without leaving the exercise screen
- **Warmup Progression** — Automatic warmup set calculation (40/60/80%)

### 🧬 Bio & Evolution
- **Complete Bio-Tracking** — Weight, body measurements, and comparative photos
- **Evolution Charts** — 7-day moving average, photo gallery by date
- **Goals** — Weight and measurement goals with target dates
- **Monthly Reminders** — Configurable notifications for check-ins

### 📊 Analytics
- **Strength Score (0-100)** — Composite score of Volume + Intensity + Consistency
- **Levels:** Novice → Beginner → Intermediate → Advanced → Elite
- **Consistency** — Week streaks, weekly/monthly frequency, total sessions
- **Volume Trends** — Weekly volume chart (last 12 weeks)
- **Top Exercises** — Load progression on exercises that improved the most
- **Estimated 1RM** — Epley formula for the 10 heaviest exercises
- **Personal Records** — Automatic PR tracking per exercise

### 📤 Data Export
- **CSV Export** — Full export of workouts and body metrics
- **Per-Session CSV** — Individual export from each workout Summary
- **Native Share** — System sharing (WhatsApp, Email, etc.)
- **Local Backup** — Export/import of complete SQLite database (.db)
- **Cloud Backup** — Google Drive (optional)

### 🛡️ Validation & Robustness
- **Zod Schemas** — Route params and form input validation on all screens
- **Error Boundary** — Visual fallback for unexpected crashes
- **Type Safety** — Zero `as any` or `useState<any>` in the codebase
- **DB Hardening** — WAL mode, foreign keys, indexes, soft deletes

### 🎨 UX
- **"Warm & Earthy" Design System** — Rounded cards, hierarchical typography
- **Dynamic Theme** — Automatic light/dark adaptation
- **Skeleton Loading** — Animated placeholders during loading
- **Haptics** — Tactile feedback on interactions
- **JSON Import** — Paste structured workouts and the app creates the routine

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Core** | React Native (Expo SDK 54) + TypeScript |
| **ORM** | Drizzle ORM + SQLite (expo-sqlite) |
| **UI** | NativeWind v4 (Tailwind), Reanimated |
| **Charts** | React Native Gifted Charts |
| **Validation** | Zod |
| **Tests** | Jest + ts-jest |
| **Lint** | ESLint (expo config) |

---

## 🚀 How to Run

```bash
# Install dependencies
npm install

# Generate database migrations
npx drizzle-kit generate

# Run tests
npx jest

# Lint
npx expo lint

# Development
npx expo start
```

### Production Build (Android)

Since the `android/` directory is in `.gitignore` (we don't version native code), use the Expo workflow:

```bash
# Generate native code locally (for debug)
npx expo prebuild --platform android

# Build via EAS (recommended)
npx eas build --platform android --profile production
```

For Google Drive Backup to work in release, set `EXPO_PUBLIC_GOOGLE_CLIENT_ID` in `.env` and add the keystore SHA-1 to the Google Cloud Console.

---

## 📂 Project Structure

```
iron-log/
├── app/
│   ├── (drawer)/           # Side drawer menu
│   │   ├── index.tsx       # Home
│   │   ├── bio/            # Bio-Tracking + Analytics
│   │   ├── routines/       # Routine CRUD + editor + templates
│   │   ├── history/        # Calendar + session history
│   │   ├── settings.tsx    # Config, backup, CSV export, language
│   │   └── about.tsx       # About the app
│   └── session/            # Workout flow (isolated Stack)
├── components/             # 17+ reusable UI components
├── hooks/                  # Domain hooks
├── services/               # Business services
├── src/
│   ├── db/                 # Drizzle ORM
│   ├── types/              # TypeScript interfaces
│   ├── utils/              # Pure functions
│   ├── validators/         # Zod schemas
│   └── i18n/               # Translation system (pt/en/es/zh)
├── __tests__/              # 13 suites, 260 tests
├── constants/              # Colors and typography
└── drizzle/                # SQL migrations
```

---

## 📋 Routine Import (JSON)

```json
{
  "name": "Upper A - Push Focus",
  "description": "Focus on load",
  "exercises": [
    {
      "name": "Bench Press",
      "target": "4x8",
      "rest": 180,
      "notes": "Olympic Bar",
      "type": "strength"
    },
    {
      "name": "Plank",
      "target": "3x60s",
      "rest": 60,
      "type": "duration"
    }
  ]
}
```

---

## ⚙️ Optional Configuration

### Google Drive Backup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Google Drive API**
3. Create OAuth 2.0 credentials
4. Add to `.env`:
   ```env
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

---

## 📄 Documentation

- [Português](../README.md)
- [Español](README.es.md)
- [简体中文](README.zh.md)

---

**License:** MIT · **Author:** Lucca Benedetti

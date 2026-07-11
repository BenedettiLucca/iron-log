# Ponytail Audit Report — Iron Log

**Date:** 2026-07-11
**Target:** `/home/lucca/Projects/iron-log` (~26K lines TypeScript/TSX)
**Context:** Previous ponytail audit executed 2026-06-24 (4 sprints, `-1,150 lines`). This audit covers NEW findings post-redesign and items that were re-added or never deleted.

---

## Sprint 1 — Dead Code (zero risk, cuttable now)

✅ **delete** `constants/typography.ts` — 103 lines, 0 imports anywhere in the app. All 5 exported functions (`getSizeClass`, `getWeightClass`, `getLeadingClass`, `getTrackingClass`, and the `typography` const) return Tailwind/NativeWind class strings that the app already uses via className props. Completely unused. [constants/typography.ts]

✅ **delete** `services/index.ts` — 13-line barrel re-exporting all services. 0 consumers import from `@/services` or `../services` — every file imports the specific module directly. [services/index.ts]

✅ **delete** `hooks/index.ts` — 13-line barrel re-exporting all hooks. 0 consumer imports from `@/hooks` or `../hooks`. [hooks/index.ts]

✅ **delete** `validators/index.ts` — 2-line barrel. 0 consumers import from `@/validators` or `../validators`. [src/validators/index.ts]

✅ **delete** `src/utils/index.ts` — 5-line barrel. 0 consumers import from `@/src/utils`. [src/utils/index.ts]

✅ **delete** `services/program/index.ts` — 4-line barrel. 0 consumers import from `services/program`. [services/program/index.ts]

## Sprint 2 — YAGNI (previously flagged, still present)

✅ **yagni** `src/utils/program-detail-state.ts` — 61 lines. Pure function state machine mapping 4 boolean inputs → 4 string states. Previously flagged for deletion in Sprint 3 of the June audit, re-added in `bbe447d`. The 1:1 `switch` in `getDetailScreenView` maps name→name with no transformation. Inline ternaries in `detail.tsx` would be shorter. [src/utils/program-detail-state.ts]

✅ **yagni** `hooks/use-progression.ts` — 22 lines. Wraps `usePrograms()` (heavy hook) just to call `getDoubleProgressionStatus`. Single caller in `exercise.tsx`. Call `ProgramService.getDoubleProgressionStatus` directly instead. [hooks/use-progression.ts]

✅ **stdlib** `src/utils/calculations.ts` — 16 lines. Function `calculateVolume(weight, reps)` that returns `weight * reps`. Native math — inline the multiplication at 3 call sites (AnalyticsService, exercise.tsx, SetCard). [src/utils/calculations.ts]

✅ **shrink** `src/utils/session-verdict-markdown.ts` — 50 lines. Converts verdict objects to markdown for Notion export. 3 cascading if/else chains mapping `result`/`verdict`/`flag` strings to i18n keys. Replace with lookup tables. [src/utils/session-verdict-markdown.ts]

## Sprint 3 — Dependency cleanup (low risk)

✅ **yagni** `@react-navigation/bottom-tabs` in `package.json` — Listed as direct dependency but also comes transitively via `expo-router`. CHANGELOG claims it was removed in Sprint 3 but it's still in package.json. Save it only as transitive (remove direct entry). No file imports it directly — `expo-router/Tabs` uses it internally. [package.json]

---

## Sprint 4 — Previously deleted files that were re-added

The June audit successfully deleted these files in Sprint 1/3, but subsequent redesign and hardening commits re-created them. They were re-assessed above and remain ponytail candidates:
- `src/utils/session-verdict-markdown.ts` — 50 lines (deleted → re-added in verdict feature)
- `src/utils/program-detail-state.ts` — 61 lines (deleted → re-added in hardening)
- `src/utils/calculations.ts` — 16 lines (deleted → re-added in hardening)

## Items from previous audit that were NOT found (already cleaned ✅)

- `hooks/use-session-exercise.ts` — deleted ✅
- `hooks/use-color-scheme.ts` — deleted ✅
- `components/session/RestTimerBar.tsx` — deleted ✅
- `sendTestNotification()` — deleted ✅
- `useColorScheme` wrapper — deleted ✅
- Manual 266-line types → Drizzle inferSelect — migrated ✅
- `react-dom` / `react-native-web` direct deps — removed ✅

---

**net: −140 lines, −1 direct dep possible.**

Ranked by impact:
1. `constants/typography.ts` — −103 lines (dead, zero risk)
2. `src/utils/program-detail-state.ts` — −61 lines → −30 shrinkable
3. `src/utils/session-verdict-markdown.ts` — −50 lines → −20 shrinkable
4. `hooks/use-progression.ts` — −22 lines
5. `src/utils/calculations.ts` — −16 lines
6. `*` barrel files (×5) — −37 lines
7. `@react-navigation/bottom-tabs` — −1 stale direct dep
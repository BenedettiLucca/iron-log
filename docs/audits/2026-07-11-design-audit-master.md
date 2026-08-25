# Iron Log — Master Design, UX & Motion Audit

**Date:** 2026-07-11
**Branch:** `feat/open-design-redesign`
**Scope:** 25 screens, 30 shared components, light/dark themes, PT/EN/ES/ZH, motion, accessibility and responsive behavior.

## Executive verdict

The redesign established a strong visual direction, but it is **not yet release-polished**. The current build has a recognizable identity and much better hierarchy than the pre-redesign app, yet several systemic gaps make it feel like a translated design mock rather than a fully resolved native product:

1. semantic colors are reused as surfaces, text and foregrounds without contrast-safe pairs;
2. invalid NativeWind utilities silently remove intended tints and motion;
3. the visual grammar overuses cards, shadows, uppercase labels, heavy weights and pills;
4. motion exists as isolated effects, not as a coherent interaction system;
5. forms and fixed actions are not consistently keyboard/safe-area aware;
6. responsive behavior has only partial real-device validation; light mode, alternate widths, large font scale and language expansion remain open;
7. accessibility coverage and translation quality are incomplete.

The codebase remains functionally healthy: typecheck, lint and all 390 tests pass. This audit is about turning a technically working redesign into a product that feels deliberate, calm and trustworthy.

## Evidence boundary

### Verified

- Static source review of all redesigned screens/components.
- NativeWind token and utility review.
- WCAG contrast calculations from actual color tokens.
- Typecheck, lint and 390 Jest tests.
- Translation key parity across four languages.
- Existing Open Design HTML references.

### Physical-device evidence added 2026-07-13

Android physical-device captures now cover Home, Sobre, Ajustes and the critical session → exercise → saved set → rest timer flow in dark mode. This validation exposed and closed the lowercase SVG crash, the Expo Go notification-module overlay and the Sentry initialization-order warning. The tested flow has no blocking clipping or safe-area overlap.

### Still not verified

Expo Web remains unusable as a baseline because bundling stalls before producing an artifact. The following device-validation items remain mandatory:

- pixel-level layout and clipping;
- keyboard behavior;
- native rendering outside the verified workout icons;
- transition timing and gesture feel;
- Android font metrics;
- TalkBack focus order;
- 320/360/390/430dp layouts and tablet;
- font scale 1.0/1.3/1.5;
- light/dark screenshots for every critical flow.

No release should be called visually complete before the device matrix in this document passes.

---

## Product-level design principles

1. **Hierarchy before decoration.** A user should identify context, primary information and next action in two seconds.
2. **One surface, one purpose.** Use a card for meaningful grouping or affordance, not as automatic framing.
3. **Color carries semantics, not legibility debt.** Every semantic color needs a surface, readable foreground and `on-*` counterpart.
4. **Motion explains change.** Animate continuity, hierarchy and state; never animate because the mock looked lively.
5. **Workout mode optimizes for fatigue.** Large targets, one-hand reach, high contrast, minimal cognitive load.
6. **Text is content, not chrome.** Sentence case by default; uppercase only for short eyebrows and compact badges.
7. **Native behavior wins.** Keyboard, safe areas, reduced motion, screen-reader state and platform conventions are part of design.
8. **HTML mocks are direction, not law.** Preserve real data and behavior; translate the visual intent into native patterns.

---

## Release prerequisites and high-risk native findings

The initial static review found no proven P0 functional defect, but later Android validation confirmed the workout-critical lowercase SVG crash described below. It is now resolved with regression coverage. Remaining findings still require device evidence rather than static assumptions.

### Native SVG child elements use lowercase intrinsic tags — resolved

**Evidence:**

- `components/SetCard.tsx:186` — `<polyline>`
- `app/session/[routineId].tsx:220-221` — `<line>`
- `app/session/[routineId].tsx:435` — `<polyline>`

`react-native-svg` expects imported `Line`/`Polyline` components. Lowercase JSX may compile through broad intrinsic typings while failing to render correctly on native. These icons sit in workout-critical controls.

**Resolution:** replaced with imported `Line`/`Polyline`, protected by `native-compatibility.test.ts` and verified through the workout flow on Android. Commit `cf532b6`. Light-mode visual confirmation remains part of the screenshot matrix, but the runtime crash is closed.

### Real-device visual baseline is incomplete

An initial Android dark-mode baseline now exists, but it is not the full screenshot matrix. Tablet is explicitly out of scope and disabled. Light mode, alternate phone widths, language expansion, keyboard cases and font scaling still block any honest claim of complete visual polish.

**Acceptance:** deterministic seeded build captured on 320/360/390/430dp, light/dark, PT/EN/ES/ZH pairwise matrix, font scale 1.0 and 1.3; critical workout flow also at 1.5. Tablet is excluded.

---

## P1 — Systemic design correctness

### P1.1 Contrast system fails WCAG AA in common combinations

Calculated contrast ratios:

| Combination | Ratio | Result |
|---|---:|---|
| Light text on light background | 8.87:1 | Pass |
| Light subtext on light background | 3.41:1 | Fail for normal text |
| Light subtext on white card | 3.87:1 | Fail for normal text |
| Dark text on dark background | 15.36:1 | Pass |
| Dark subtext on dark card | 6.02:1 | Pass |
| White on primary | 2.95:1 | Fail |
| White on success | 2.40:1 | Fail |
| White on danger | 4.17:1 | Marginal/fail for normal text |
| Primary text on light background | 2.60:1 | Fail |
| Secondary text on dark card | 2.16:1 | Fail |
| Success text on white card | 2.40:1 | Fail |
| Warning text on white card | 1.52:1 | Fail |

The same raw brand colors are used for fills and text in both themes. `Button`, chips, status text, tabs, timers and badges inherit these failures.

**System fix:** define theme-specific `primaryForeground`, `successForeground`, `dangerForeground`, `mutedForeground`, plus contrast-safe text variants for semantic colors. Do not globally darken the brand color without visual review.

**Acceptance:** all normal text/control labels ≥4.5:1, large text/non-text controls ≥3:1, status never encoded by color alone.

### P1.2 Invalid NativeWind utilities silently remove intended styling

**Undefined typography utilities:**

- `text-3xs` in dashboard, programs and check-in.
- `font-display` in StatTile and bio screens; no custom font is loaded anywhere.
- `text-[10px]` bypasses the type scale.

Unknown classes are ignored; `text-3xs` does **not** make text invisible, correcting the earlier audit's overstatement. It does make the runtime differ from design intent.

**Invalid opacity modifiers:** 10 instances use values absent from Tailwind's default opacity scale:

- `/3`: 1
- `/8`: 3
- `/15`: 6

Examples include `bg-primary/3`, `bg-primary/8`, `bg-success/15`, `bg-accent/15`, `border-success/15`.

**Malformed/default-palette classes:**

- `app/routine/[routineId].tsx:357` uses `border purple-500/20` instead of a valid semantic border class.
- product screens still use default Tailwind colors such as `text-gray-400`/purple rather than the semantic theme palette.

**Web-only/no-op transition utilities:**

- `app/session/exercise.tsx:254,258` — `transition-colors`, `transition-all`
- `app/session/[routineId].tsx:379` — `transition-all`

These do not produce native motion. The warm-up toggle visually snaps.

**Acceptance:** zero undefined utilities; add a static validation test for project-specific classes; use actual Reanimated transitions where motion has UX value.

### P1.3 Typography lacks a deliberate native hierarchy

Evidence:

- 130 occurrences of uppercase.
- frequent `font-black`/`font-extrabold` across stats and labels.
- fake `font-display` token with no loaded font.
- 8–10px intended labels and many 12px all-caps actions.
- user-generated names constrained to one line in several screens.

This creates visual shouting and weakens hierarchy: when everything is bold, uppercase, pill-shaped and accented, nothing is primary.

**Direction:** keep system font for performance and native feel unless a real font decision is made. Define named roles: display, title, body, body-emphasis, label, caption, numeric. Sentence case by default. Reserve uppercase for `SectionHeader` and very short status badges.

**Acceptance:** body ≥14px, action labels generally ≥14px, micro-label ≥10px and non-essential, 1.3× font scale without clipped CTAs, user-created names allow two lines where appropriate.

### P1.4 Surface and elevation grammar creates card soup

Evidence:

- 73 `<Card>` usages across 25 screens.
- `Card` applies `shadow-sm` by default to every instance.
- 28 explicit shadow utilities beyond the default.
- 141 occurrences of `rounded-xl`, `rounded-2xl` or `rounded-full`.

Analytics/evolution/settings and detail screens frequently place tiles, tinted insets and badges inside cards. The result risks looking like a component gallery rather than one coherent information surface.

**Direction:**

- Level 0: page background.
- Level 1: flat section surface with border; no shadow by default.
- Level 2: elevated only for floating, pressable or overlay content.
- Tinted inset: semantic callout only, never another generic card.
- Radius grammar: control, card, modal, pill — four intentional roles.

**Acceptance:** `Card` default is flat; shadows appear only where elevation communicates interaction/layering; no generic card inside generic card; each screen has one obvious visual anchor.

### P1.5 Motion is fragmented and ignores Reduce Motion

Current motion mixes core `Animated`, Reanimated springs, modal `animationType`, `FadeIn*`, swipe gestures and no-op Tailwind transitions. No `useReducedMotion`, `AccessibilityInfo` or equivalent exists.

Specific issues:

- `Skeleton.tsx:14-20` starts an infinite animation during render rather than in an effect.
- `Skeleton.tsx:33-35` discards string widths even though callers pass `"40%"`, `"60%"`, `"80%"` and `"100%"`; placeholders can collapse or diverge from final geometry.
- `SetCard.tsx:104` staggers every set entrance with spring regardless of user preference.
- `Button` and `Card` trigger medium haptics for routine interactions.
- modal transitions are generic `fade`/`slide` without shared timing or continuity rules.
- warm-up toggle uses web transition classes and snaps.

**Motion grammar:**

| Event | Motion | Haptic |
|---|---|---|
| ordinary press | 0.98 scale, 120–160ms or subtle opacity | light/selection only when useful |
| primary commit | brief press + state transition | medium |
| success | 180–240ms confirmation | success |
| destructive | no playful spring | warning |
| modal/bottom sheet | 240–320ms, gesture-continuous | none |
| list insertion | only new item, not entire screen replay | light optional |
| loading skeleton | subtle pulse; static under Reduce Motion | none |

**Acceptance:** all continuous/entrance animations respect Reduce Motion; no animation restarts on ordinary re-render; no web-only transitions; haptic semantics consistent.

### P1.6 Forms are not consistently keyboard- and safe-area-aware

Only the session exercise screen uses `KeyboardAvoidingView`. Form-heavy screens include routine editor, program create, goal modal and supplement modal.

Examples:

- `app/routines/editor.tsx:262` fixed absolute two-button footer without safe-area inset.
- `app/routine/[routineId].tsx:423` hardcodes `paddingBottom: 24`.
- supplement and goal page-sheet forms rely on plain `ScrollView` with no documented keyboard handling.
- routine editor shrinks touch/input heights to 32–36px (`:223,233,241,252`), below the 44dp target.

**Acceptance:** focused field remains visible above keyboard; fixed CTAs use actual insets; all controls ≥44dp; scroll-to-error works; destructive close with dirty data confirms loss.

### P1.7 Theme behavior needs semantic, not raw, parity

Light mode has weaker subtext and accent contrast than dark mode. `secondary` is readable on light surfaces but fails on dark. Manual theme objects are necessary for calendar/charts, but should consume the same semantic foreground pairs.

Header behavior also differs: light uses primary fill with white title (2.95:1), dark uses dark background with white title. This changes hierarchy and fails contrast in light.

**Acceptance:** screenshot comparison confirms equivalent hierarchy in both modes; headers, tabs, charts, sliders, SVG strokes, disabled states and system modals use semantic theme tokens.

### P1.8 Product-trust and flow correctness defects

The interaction audit found several cases where the UI can report success, lose unsaved work or present an error as empty data. These are UX defects, not optional backend cleanup:

| Flow | Evidence | Risk |
|---|---|---|
| Save routine as template | `app/routines/editor.tsx:142-155` | marks `isTemplate` without persisting current name, description or exercises |
| Template exercise names | `app/routines/templates.tsx:35-56` | query reads `routineExercises` without joining exercise names; chips may be blank |
| Set editor validation | `components/SetEditor.tsx:47-69` | fires success haptic before validation and silently rejects invalid values/RIR |
| Next exercise | `app/session/exercise.tsx:401-419` | can navigate while current inputs are dirty and unsaved |
| Finish loading | `app/session/finish.tsx:81-180` | finish is actionable before stats load and may classify a valid session as empty |
| Bio goals | `app/bio/goals.tsx:93-139` | validation/persistence failures are logged without user feedback; no saving state |
| Supplements | `app/supplements/index.tsx:148-178`, `hooks/use-supplements.ts:53-109` | UI can show success although hook swallowed persistence failure |
| Empty check-in | `app/(tabs)/bio.tsx:156-209` | fully optional form may create a meaningless monthly record with fallback zeroes |
| Deleted session summary | `app/session/summary.tsx:50-67` | route can render a soft-deleted session |
| Set deletion | `components/SetCard.tsx:77-89` | destructive swipe has neither confirmation nor dedicated undo |

Read-heavy screens also conflate failures with empty states in History, weekly report, program week detail, routine detail and analytics. Invalid routine/week route params can produce indefinite loading or partially empty screens.

**Acceptance:** operations expose explicit pending/success/error outcomes; success appears only after durable persistence; dirty input cannot be lost silently; loading/error/not-found/empty are distinct; destructive actions are confirmable or reversible; tests reproduce every case above.

---

## P1 — Translation and responsive content

### Translation parity

All four languages have **937/937 keys** and the parity tests pass.

### Translation quality defects

- ZH: one incorrect translation (`summary.duration = 市场`, “market”) and roughly 25 pinyin placeholders instead of Chinese characters.
- ES: missing accents in several entries (`últimas`, `análisis`, `Móvil`, `Días`, `inválido`, `vacío`, `está`).
- 15+ runtime hardcoded strings/manual language branches remain in analytics, program detail/week detail, supplements, evolution, session summary and routine detail.
- `ProgressBar.tsx:46` hardcodes Portuguese `de` inside a shared component.
- fallbacks such as `t(...) || 'Editar'` hide missing translation problems.

### Layout risk from translations

- Three equal-width goal chips in program create can squeeze Spanish labels.
- Three equal-width supplement frequency segments include `Días de Entrenamiento`, likely to wrap or clip on narrow devices.
- several user-created names and action labels use `numberOfLines={1}`.
- no font-scale-specific handling exists; RN scaling is enabled by default, but untested.

**Acceptance:** no user-facing manual language branches; ZH and ES corrected; every critical screen passes PT/EN/ES/ZH at 320dp and font scale 1.3; segmented controls adapt via wrap, scroll or alternate layout rather than shrinking text.

---

## P2 — Interaction, accessibility and flow polish

### Accessibility coverage

Static probe over 74 files:

- 172 touchable/pressable occurrences.
- 35 `accessibilityRole` occurrences.
- 42 `accessibilityLabel` occurrences.
- 6 `accessibilityState` occurrences.
- 39 locally validated touchable windows without role/label/state.

The raw percentages overcount imports/closing tags, so the earlier “80%” claim is directional rather than exact. The 39 concrete windows remain actionable.

Critical gaps include card navigation, back buttons, modal backdrops, timer backdrop, expandable routine exercises, filter chips and inline actions.

**Acceptance:** every actionable element has role/name/state where relevant; decorative SVGs are hidden; modals trap focus and restore it; TalkBack traversal follows visual order; custom progress and sliders expose values.

### Workout flow

Good foundations: large numeric hierarchy, rest timer sheet, swipe set actions, accessibility actions, recovery logic and explicit finish flow.

Polish risks:

- set cards carry set number, PR badge, warm-up badge, edited badge, RIR badge and completion circle simultaneously;
- animated entrance on every set may feel busy during repeated logging;
- 12px/uppercase secondary labels reduce glanceability under fatigue;
- swipe actions need a visible alternative and consistent iconography;
- `SetCard` is announced as a button even when no `onPress` exists; edit/delete are hidden behind swipe for TalkBack users;
- set deletion has no confirmation or dedicated undo;
- primary/success fills currently fail text contrast;
- rest timer bottom inset is hardcoded;
- rest timer lacks modal semantics/explicit dismiss and can subtract below zero after finishing;
- RIR slider triggers haptic on every value-change event, producing excessive vibration;
- critical check SVGs use lowercase native SVG children.

**Acceptance:** core set logging works one-handed; primary metrics readable at arm's length; editing/deleting discoverable without swipe; timer can be dismissed/extended with TalkBack; no accidental session loss.

### Feedback states

Buttons support loading/disabled and core screens have loading/error/empty states. Remaining polish work:

- ensure skeleton geometry mirrors final content;
- use inline validation near fields and focus first error;
- success toasts need accessible announcements and safe-area placement;
- toast `top: 60` is hardcoded;
- disabled contrast and pressed state need theme validation;
- avoid success-color confirmation without icon/text.

---

## P2 — Iconography and affordance

- Stroke icons generally share 24px viewBox and 2px stroke.
- duplicate chevrons/plus/arrows exist across files.
- emoji and custom SVG are mixed in status/action contexts.
- `X`, ellipsis text and emoji fire are used where semantic icons would be clearer.
- long-press edit exists for supplements, but discovery depends on a separate ellipsis action.

**Direction:** one stroke grammar (20/24px, 2px default, rounded caps), semantic icons for actions, emoji only as content/personality. Extract only icons repeated enough to produce a net code/readability win; do not build an oversized icon framework.

---

## P3 — Code/design hygiene (Ponytail)

Validated dead code:

- `constants/typography.ts` — 103 lines, zero imports.
- dead barrels: `services/index.ts`, `hooks/index.ts`, `src/validators/index.ts`, `src/utils/index.ts`, `services/program/index.ts`.

Validated simplification candidates requiring tests:

- `src/utils/program-detail-state.ts`
- `hooks/use-progression.ts`
- `src/utils/calculations.ts`
- `src/utils/session-verdict-markdown.ts`
- direct `@react-navigation/bottom-tabs` dependency is duplicated under `expo-router`; removal must pass Expo doctor/build, not merely unit tests.

Ponytail work should happen after visual foundations stabilize so simplification does not fight concurrent component refactors.

---

## Screen-by-screen review matrix

| Area | Primary risks | Device checks |
|---|---|---|
| Home | card density, 3-column lift grid, invalid tiny labels, low-contrast primary text | long routine/program names, empty/active/incomplete session |
| Routines | chip overload, fixed bottom CTA, nested actions, filter discoverability, five competing actions per routine | 320dp, many folders, long ES labels, final item above footer |
| History | calendar theme, destructive action density, text truncation, load error presented as empty | months with many sessions, query failure/retry, dark mode |
| Bio tab | five quick actions, 1-line labels, photo modal keyboard | 320dp + 1.3 font, missing photos/data |
| Settings | repetitive cards, raw semantic text colors, long labels against chevron, one global loading state | all languages, per-action loading, disconnected/error |
| Programs | 3-up goal selector, badge overload, week status colors, custom/native header duplication, error-as-empty states | 320dp, 12+ weeks, invalid route, final item above footer |
| Routine detail/editor | fixed footer, 36dp inputs, dense exercise cards, invalid route can spin forever | keyboard, safe area, 15 exercises, error/not-found |
| Analytics/evolution | card soup, dense grids, chart labels, manual PT/EN branches, four metrics/tabs squeezed in one row | 320dp, no data vs error, outliers, dark mode, ES/ZH |
| Check-in/goals | 3-up photo grid, tiny labels, page-sheet keyboard | missing photos, long measurement labels |
| Supplements | long segmented labels, FAB safe area, page-sheet keyboard | ES 320dp, reminder picker, empty list |
| Active session | glanceability, contrast, no-op transitions, SVG rendering | sweaty one-hand use, 20 sets, interruption |
| Finish/summary | dense stats, slider semantics, flag chips, long report | 1.3 font, errors, share/export states |
| Dialogs/toasts/timers | hardcoded insets, focus restoration, reduced motion | cutout/status bar, TalkBack, dark mode |

---

## Device QA matrix

### Critical-flow full matrix

Run Home → Routine → Active Session → Exercise → Finish → Summary on:

- widths: 320, 360, 390, 430dp;
- themes: light and dark;
- languages: PT, EN, ES, ZH;
- font scale: 1.0 and 1.3; session at 1.5;
- Reduce Motion: off/on;
- states: normal, empty, loading, error, long content.

Use pairwise coverage for non-critical screens, but every screen must be seen in both themes and at least one non-PT language.

### Tablet decision — resolved

Tablet support is out of scope. `ios.supportsTablet` must remain disabled until a deliberate tablet experience is designed.

### Web support decision — QA-only for now

Web dependencies were installed as a QA prerequisite, but both `expo start --web` and `expo export --platform web` currently fail to produce a usable artifact. Web is therefore **not a baseline** and does not become a supported product target. Native behavior must continue to be validated on the connected Android device; the dark-mode workout flow now has initial evidence, while the rest of the matrix remains open.

---

## Release gates

- [x] Zero lowercase `react-native-svg` child tags; static guard and Android verification added in `cf532b6`.
- [ ] Zero undefined NativeWind utilities/opacities.
- [ ] Contrast gates pass for all text/control states.
- [ ] Product-trust defects have regression tests and no false-success/silent-loss path remains.
- [ ] Zero hardcoded runtime language branches in redesigned screens.
- [ ] ZH pinyin and ES accents corrected.
- [ ] All critical touch targets ≥44dp.
- [ ] All critical forms pass keyboard + safe-area checks.
- [ ] Reduce Motion supported for continuous/entrance animations.
- [ ] TalkBack pass on tabs, forms, active workout, timer and dialogs.
- [ ] 320dp + font scale 1.3 has no clipped actions/text.
- [ ] Light/dark screenshots approved for every redesigned screen.
- [ ] Typecheck, lint, tests, Expo doctor and Android build pass.
- [ ] Ponytail cleanup produces no behavioral regression.

## Current score

The earlier static audit scored 7.5/10. After correcting its false P0 claim and adding contrast, invalid utility, motion, keyboard and device-evidence findings, the honest status is:

- **Visual direction:** 8/10
- **System coherence:** 6/10
- **Native interaction polish:** 5.5/10
- **Accessibility:** 5/10
- **Release confidence:** 4/10 until device validation

This is a good redesign foundation, not a finished polished release yet.

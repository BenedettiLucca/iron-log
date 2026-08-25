# Iron Log design-system contract

This is the implementation contract for product UI. It describes the system that exists today and evolves with each completed component sprint.

## Sources of truth

- Runtime colors: `constants/colors.ts`
- NativeWind aliases: `tailwind.config.js`
- CSS variables: `global.css`
- Contrast and pairing guards: `__tests__/quality/design-tokens.test.ts`
- Native utility guard: `__tests__/quality/native-utilities.test.ts`
- Button interaction contract: `__tests__/components/Button.test.tsx`
- Card interaction contract: `__tests__/components/Card.test.tsx`
- Form-control contracts: `__tests__/components/Input.test.tsx` and `__tests__/components/DatePicker.test.tsx`
- Segmented-control contract: `__tests__/components/SegmentedControl.test.tsx`
- Progress-indicator contracts: `__tests__/components/ProgressBar.test.tsx` and `__tests__/quality/progress-bar-call-sites.test.ts`
- Loading-placeholder contract: `__tests__/components/Skeleton.test.tsx`
- Overlay contracts: `__tests__/components/Dialog.test.tsx`, `__tests__/components/Toast.test.tsx` and `__tests__/components/RestTimer.test.tsx`
- Accessibility-focus helper: `__tests__/utils/accessibility.test.ts`

Do not introduce screen-local hex colors or default Tailwind palette colors. Add or change a semantic role in all three token sources and extend the contrast test first.

## Color roles

| Usage | Foreground | Background |
|---|---|---|
| Page content | `text-text` | `bg-background` |
| Muted/supporting content | `text-subtext` | `bg-background` or `bg-card` |
| Brand action | `text-onPrimary` | `bg-primary` |
| Semantic filled action | `text-on{Role}` | `bg-{role}` |
| Semantic inline text/icon | `text-{role}Text` / `theme.{role}Text` | neutral page/card |
| Semantic badge/tint | `text-{role}Text` | `bg-{role}Surface` |

Roles: primary, secondary, accent, success, warning and danger. Never use a fill token as inline text. Never pair semantic text with an ad-hoc alpha fill when a tested `*Surface` exists.

## Typography

- Font family: native system font only. No `font-display` alias.
- Supported scale: `text-2xs` 10px, `xs` 12px, `sm` 14px, `base` 16px, `lg` 18px, `xl` 20px, `2xl` 24px, `3xl` 30px and `4xl` 36px.
- `text-2xs` is the product floor for visible labels. Do not use `text-3xs` or `text-[10px]`.
- Body copy defaults to `text-sm` or `text-base`; compact metadata uses `text-xs`; `text-2xs` is reserved for short badges, chart labels and dense metadata.
- Hierarchy comes from size and weight, not a second font family.

## Spacing and touch targets

- NativeWind's 4px spacing scale is the base rhythm.
- Screen gutters: 16px (`p-4`) by default; 20px (`p-5`) only for intentionally spacious report/detail screens.
- Card padding: 16px (`p-4`) default; 12–14px for compact cards.
- Common content gaps: 8px, 12px and 16px (`gap-2`, `gap-3`, `gap-4`).
- Interactive controls must be at least 44dp high. Shared `Button` sizes currently enforce 44/50/60dp minimum heights.

## Radius

| Role | Utility |
|---|---|
| Input and compact control | `rounded-xl` |
| Card, button, dialog and sheet | `rounded-2xl` |
| Badge, chip, avatar and switch track | `rounded-full` |
| Small internal status block | `rounded-lg` |

Avoid new arbitrary radius values. Use component defaults before adding screen-level radius classes.

## Elevation

- Static cards are flat: semantic background plus border, with no built-in shadow.
- Interactive or floating cards may opt into `shadow-sm`/`shadow-md` explicitly at the call site when elevation communicates affordance or layering.
- Floating feedback, modal or active overlay: `shadow-lg` or `shadow-xl` only when it must sit above content.
- Do not use shadow to compensate for weak color or border hierarchy.
- Shadows remain enabled by product decision, but every elevation now requires a deliberate role.

## Motion roles and haptic mapping

The table below is the canonical motion matrix for the shared components covered by Sprint 2. Component tests lock each explicit timing/spring value; hook tests lock runtime Reduce Motion subscription, async initialization and cleanup. Do not introduce a new duration or spring ad hoc at a call site.

### Motion matrix

| Component behavior | Value / curve | Reduce Motion |
|---|---|---|
| Button press-in | 80ms timing to `scale: 0.98` | Keep `scale: 1` |
| Button release/cancel | 120ms timing to `scale: 1` | Restore `scale: 1` immediately |
| SegmentedControl selection | 160ms timing, opacity plus `0.96 → 1` scale | Apply final state immediately |
| ProgressBar value change | 300ms timing, left-origin `scaleX` | Apply final value immediately |
| RestTimer accepted swipe dismissal | 200ms timing | Dismiss immediately |
| Toast entrance | spring `tension: 50`, `friction: 7` | Show in place immediately |
| Toast exit | 300ms timing after dwell | Hide immediately after the same dwell period |
| RestTimer entrance/rejected drag | spring `tension: 65`, `friction: 11` | Show/restore immediately |
| Skeleton pulse | reversible 800ms timing, opacity `0.6 ↔ 0.3` | Static opacity `0.5`; no loop |
| Native modal entrance | platform-controlled `fade` for Dialog and `slide` for iOS DatePicker | `animationType="none"` |

Toast dwell defaults to 2000ms and is lifecycle, not animation. Card, DatePicker trigger and ordinary Pressable feedback use immediate `active:` opacity states; do not add JavaScript timing solely to animate opacity. Native modal durations are deliberately not guessed or duplicated in JavaScript.

### Motion grammar

- Motion explains press, selection, progress or layering. It is not decoration and must not delay persistence or navigation.
- Use timing for deterministic state changes and the two documented springs only for transient overlay arrival/restoration.
- A single interaction gets one primary motion response. Do not stack scale, translation and decorative bounce on the same action.
- Within the Sprint 2 shared-component scope, continuous, entrance and exit motion reacts to the OS Reduce Motion setting while the app is mounted. Dwell time, countdown state and accessibility announcements remain functional.
- Repeating/native animation must stop on replacement, setting changes and unmount. Completion callbacks must ignore canceled animations.
- Feature-specific legacy modals outside this shared-component scope are audited in their owning screen sprints; this matrix does not claim they already comply.

### Haptic mapping

`useHaptics()` is the single adapter over Expo Haptics, and the names below are its actual `HapticFeedbackType` values:

| Type | Native feedback | Use |
|---|---|---|
| `light` | light impact | Low-consequence adjustment, secondary/ghost Button |
| `medium` | medium impact | Primary/success Button press and explicit edit action |
| `heavy` | heavy impact | Reserved for rare high-salience physical actions; no shared default |
| `selection` | selection feedback | Reserved for deliberate discrete selection controls; SegmentedControl remains silent |
| `success` | success notification | Only after confirmed persistence or a real outcome such as a PR |
| `warning` | warning notification | Destructive intent such as danger Button or set deletion |
| `error` | error notification | Only after a confirmed failed outcome, never on ordinary validation focus |

Shared Button variants map `primary → medium`, `success → medium`, `secondary → light`, `ghost → light` and `danger → warning`. Disabled/loading Buttons, Card, Input, DatePicker and SegmentedControl are silent. A success-colored Button still emits outcome-neutral `medium`; the owning flow may emit `success` only after durable success. The generic haptic `Pressable` defaults to `medium`, so use it only when tactile feedback is intentional rather than as a drop-in replacement for every pressable surface.

## Cards

- `default` and compatibility `bordered` variants are flat. Explicit caller classes remain the elevation escape hatch.
- A Card becomes interactive only when both `pressable` and `onPress` are provided; otherwise it renders a static `View`.
- Pressed feedback is a restrained opacity change to `0.92`, without scale animation.
- Cards do not emit automatic haptics. Navigation cards stay quiet; specialized flows own any semantic haptic.
- Interactive cards default to button semantics and may opt into link semantics with an explicit accessibility label.

## Form controls

- `Input` and `DatePicker` enforce a real minimum target height of 44dp. Caller styles may increase height but cannot reduce it below the floor.
- Border state precedence is error → focus/open → default. A selected date is a value, not a focus signal.
- Focus/open borders use `primaryText`; error borders use `dangerText`; default and disabled controls use `border`.
- Disabled controls are non-interactive, visually muted with `opacity-60`, and expose their disabled accessibility state. Disabling an open DatePicker closes it and ignores stale native change events.
- Input focus is silent: ordinary text entry does not emit haptics. External focus/blur callbacks run without bypassing internal state.
- Validation errors remain programmatically associated through the control hint, stay visible while focused, and are announced with a polite live region.
- DatePicker exposes its formatted value through `accessibilityValue`; its iOS Done action keeps a minimum 44×44dp target.
- Form `ScrollView`/`FlatList` containers use automatic keyboard insets, handled taps and drag-to-dismiss; do not introduce fixed keyboard offsets.

## Segmented controls

- Segmented controls keep all options visible at equal width; they do not hide tabs behind horizontal scrolling.
- Every tab has a minimum 44dp target. Labels use constrained shrinkable width, wrap freely at narrow widths without an ellipsis cap, and receive invisible break opportunities inside long words while preserving the original accessible copy.
- The container exposes `tablist` semantics and each option exposes `tab` plus its selected state.
- The selected pill follows the SegmentedControl selection row in the canonical motion matrix; Reduce Motion applies the state instantly.
- Pressing the selected tab is a no-op, ordinary tab changes do not emit haptics, and pressed feedback uses NativeWind `active:` classes rather than Pressable style callbacks.

## Progress indicators

- `ProgressBar` is a generic primitive: it never assumes the value represents exercises. Use a localized custom `label` when the unit or context matters.
- The visual label is sentence case and `showLabel` is honored by every variant. Hidden labels remain available through the progress element's accessibility value.
- Invalid, negative and overflowing values are clamped before display, accessibility output and animation. The exposed range is always 0–100 with localized text for the clamped count context.
- The outer element exposes `progressbar`, label and value semantics by default. Use `isAccessible={false}` only when the bar is decorative and the surrounding accessible UI already communicates the value; when a visible summary duplicates the bar, keep the bar as the sole semantic value and hide the duplicate text from accessibility.
- Fill motion uses a full-width layer with left-origin `scaleX`; never animate width or trigger layout on each frame. Required fill geometry and color live in native `style` rather than relying on NativeWind interop through a custom animated wrapper. Timing and Reduce Motion behavior follow the canonical motion matrix.
- Exercise progress copy selects explicit singular/plural locale keys. Never produce `1 de 1 exercícios` or its EN/ES equivalent.

## Loading placeholders

- `Skeleton` dimensions live on a core React Native wrapper and accept numeric or percentage widths. Percentage widths such as `60%`, `80%`, `100%` and `40%` must never be discarded.
- Caller `className` is forwarded to the core wrapper. The animated fill carries required dimensions, semantic `border` color and radius in native style rather than depending on NativeWind interop through an animated component.
- Pulse timing, opacity range and the static Reduce Motion state follow the canonical motion matrix. Start the loop in an effect, never during render, and cancel it on cleanup or when the OS setting changes.
- Skeletons are decorative and remain hidden from accessibility. Loading context belongs to the owning screen, not to each placeholder rectangle.

## Overlays, alerts and transient UI

- `Dialog` uses a native modal, real safe-area padding and dismisses the keyboard before focusing its accessible heading. Backdrop, Android back and VoiceOver escape from any focused dialog element share the same cancel path without collapsing the dialog into one accessibility node. Native modal restoration remains the default; callers that need deterministic restoration may pass `returnFocusRef`.
- `Toast` positions from `safeArea.top + 12`. Errors use an assertive alert; success and info use polite live regions. Replacing a visible message restarts its dwell period, and every timer/native animation stops during cleanup.
- `RestTimer` is a native modal bottom sheet with real bottom inset. Opening dismisses the keyboard and focuses the heading. Its countdown has the `timer` role but no live region, so it stays queryable without being announced every second; the finished state is announced once per rest period.
- Button, SegmentedControl, ProgressBar, Skeleton, Dialog, DatePicker, Toast and RestTimer share reactive Reduce Motion state. Infinite/repeating work must stop when the setting changes or the component unmounts; gesture callbacks read the current setting rather than a mount-time closure.
- Required sheet geometry and safe-area spacing belong to core/native styles. Do not rely on NativeWind interoperability through `Animated.View` for an overlay's existence or placement.

## Buttons and action feedback

- CTA labels use sentence case and preserve the translated title exactly. All-caps remains reserved for compact metadata, badges and short labels; the shared `Button` never transforms copy.
- Press motion, Reduce Motion behavior and per-variant haptics follow the canonical matrices above. Disabled and loading states neither animate nor emit feedback.
- A success-colored action is not proof of durable success. Notification-style `success` feedback must fire only in the owning flow after validation and persistence complete.
- Foregrounds remain semantic per variant: `onPrimary`, `secondaryText`, `onDanger`, `subtext` and `onSuccess`.

## Utility policy

- No default Tailwind palette colors (`gray-*`, `green-*`, `purple-*`, etc.) in product UI; use semantic roles.
- No web-only native no-ops such as `transition-colors` or `select-text`.
- Opacity modifiers must exist in the resolved Tailwind scale. In the installed Tailwind 3.4 config `/5`, `/10`, `/15` and `/20` are valid; `/3` and `/8` are not.
- Alpha fills are allowed for decorative tracks, scrims and icon wells. Text-bearing semantic surfaces use tested `*Surface` roles.

## Platform and verification

- Phone-first only; tablet support is disabled in `app.json`.
- Validate representative screens at narrow (~320dp) and standard (~390dp) phone widths, in light and dark mode.
- Before commit:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git diff --check
```

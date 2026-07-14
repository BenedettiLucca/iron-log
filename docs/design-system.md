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

## Cards

- `default` and compatibility `bordered` variants are flat. Explicit caller classes remain the elevation escape hatch.
- A Card becomes interactive only when both `pressable` and `onPress` are provided; otherwise it renders a static `View`.
- Pressed feedback is a restrained opacity change to `0.92`, without scale animation.
- Cards do not emit automatic haptics. Navigation cards stay quiet; specialized flows own any semantic haptic.
- Interactive cards default to button semantics and may opt into link semantics with an explicit accessibility label.

## Buttons and action feedback

- CTA labels use sentence case and preserve the translated title exactly. All-caps remains reserved for compact metadata, badges and short labels; the shared `Button` never transforms copy.
- Press motion uses scale `0.98` over 80ms and returns to `1` over 120ms. Reduce Motion, disabled and loading states do not animate.
- Press haptics are outcome-neutral: primary and success variants use medium impact; secondary and ghost use light impact; danger uses warning feedback.
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

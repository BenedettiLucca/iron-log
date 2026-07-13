# Iron Log design-system contract

This is the implementation contract for product UI. It describes the system that exists today; component redesign and motion work belong to later sprints.

## Sources of truth

- Runtime colors: `constants/colors.ts`
- NativeWind aliases: `tailwind.config.js`
- CSS variables: `global.css`
- Contrast and pairing guards: `__tests__/quality/design-tokens.test.ts`
- Native utility guard: `__tests__/quality/native-utilities.test.ts`

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

- Flat/bordered surfaces: border only, no shadow.
- Standard card or button: `shadow-sm`.
- Floating feedback, modal or active overlay: `shadow-lg` or `shadow-xl` only when it must sit above content.
- Do not use shadow to compensate for weak color or border hierarchy.
- Shadows remain enabled by product decision; later component work may reduce where the shared defaults overuse them.

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

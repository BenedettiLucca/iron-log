# Iron Log — Polish, i18n & Ponytail Execution Plan

**Date:** 2026-07-11
**Source audit:** `docs/audits/2026-07-11-design-audit-master.md`
**Branch base:** `feat/open-design-redesign`

## Operating model

- **Antigravity:** bulk implementation within a tightly scoped sprint spec.
- **Hermes:** prepares specs, reviews every diff, rejects slop/overengineering, fixes focused issues and runs verification.
- **Lucca:** approves product-level decisions (palette foreground strategy, tablet support and any meaningful visual departure).
- Every sprint ends with a real Android verification when device access is required.
- Do not combine broad visual refactors with business-logic changes.

## Progress — 2026-07-13

- **Sprint 0:** baseline físico parcial capturado em dark mode para Home, Sobre, Ajustes e fluxo sessão → exercício → série → descanso. Light mode, larguras adicionais, idiomas e font scale continuam pendentes.
- **Sprint 0A:** concluída; trust hardening integrado e enviado para `feat/open-design-redesign`.
- **Sprint 1:** native correctness iniciado. SVGs inválidos, compatibilidade do Expo Go e ordem de inicialização do Sentry corrigidos e validados no Android em `cf532b6`.
- **Expo Doctor:** 16/18. Pendências conhecidas: duplicidade de `react-native-safe-area-context` e alinhamento coordenado de 15 dependências; não usar upgrade blanket no meio do polish visual.

## Quality gates shared by every sprint

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo-doctor
```

Also required:

- `git diff --check` clean;
- no new hardcoded user-facing strings;
- no new undefined NativeWind utility;
- visual before/after evidence for touched screens;
- light/dark and at least one non-PT language;
- no hook/service behavior changes unless explicitly scoped.

---

## Sprint 0 — Visual QA harness and baseline

**Goal:** make visual quality measurable before changing more UI.

### Scope

1. Connect Android device or boot emulator.
2. Create deterministic seed scenarios:
   - fresh/empty;
   - normal training history;
   - active program;
   - incomplete session;
   - long names/descriptions;
   - dense analytics/check-in history.
3. Define screenshot routes and capture naming convention.
4. Capture baseline at 360 and 390dp, light/dark, PT/EN.
5. Add targeted captures for 320/430dp, ES/ZH, font scale 1.3/1.5.
6. Record short videos for:
   - bottom tabs;
   - start/resume session;
   - log set + rest timer;
   - finish + summary;
   - modal/form keyboard behavior.
7. Decide tablet support: design it or disable the promise.
8. Decide Web support: QA-only for now. Dependencies are installed, but Metro currently aborts at 0% with no artifact; diagnose separately without blocking UX hardening.
9. Resolve Expo Doctor baseline deliberately: duplicate `react-native-safe-area-context`, Sentry/Jest major mismatches and Expo SDK patch drift. Do not use a blanket force-upgrade.

### Acceptance

- Every redesigned screen has baseline screenshots.
- Critical flow has motion recordings.
- Each later sprint can compare before/after with identical data.
- No “looks fine on my phone” sign-off.

### Dependency

Requires a connected device/emulator. No broad visual refactor should precede the baseline; only targeted native-rendering fixes may be applied if they block capture.

---

## Sprint 0A — UX trust hardening

**Goal:** eliminate silent data loss, false success and error-as-empty behavior before visual polish makes broken flows look trustworthy.

### Scope

1. Persist the complete current routine state before marking it as a template.
2. Join exercise names when loading routine templates.
3. Make SetEditor validation explicit; validate RIR, focus the first invalid field and never fire success haptic before success.
4. Protect dirty set input when moving to the next exercise or finishing.
5. Block finish/discard decisions until session stats finish loading.
6. Give goals explicit validation, saving and persistence-error states.
7. Make supplement hooks return/throw explicit outcomes; show success only after durable persistence and roll back failed toggles.
8. Reject empty monthly check-ins unless at least one meaningful datum exists.
9. Reject soft-deleted sessions in summary routes.
10. Add confirmation or dedicated undo for set deletion.
11. Separate loading/error/not-found/empty in History, Reports, Programs week detail, Routine detail, Analytics and Templates.
12. Validate route params so missing routine/week IDs cannot spin forever or render partial emptiness.

### Acceptance

- A regression test reproduces and closes each defect.
- No operation can show success after swallowed failure.
- No dirty input can disappear without save or explicit discard.
- Empty states only render after successful zero-result queries.
- Loading blocks destructive/finalizing decisions that depend on loaded data.
- Typecheck, lint and 390+ tests pass.

### Execution

Antigravity handles the bulk in small flow-specific commits. Hermes reviews persistence semantics, test quality and any hook/service changes before merge.

---

## Sprint 1 — Design-system correctness

**Goal:** repair the foundation so screens stop fighting invalid tokens and contrast.

**Status (2026-07-14): concluída.** Blockers nativos, tokens semânticos, utility contract e documentação central finalizados; piloto visual de Sobre e Relatório Semanal aprovado em Android físico, light/dark. O risco de viewport estreito foi revisado pela estrutura flexível e ausência de larguras fixas; não foi usado AVD de 320dp.

### Scope

1. Fix lowercase SVG primitives (`Line`, `Polyline`). **Concluído em `cf532b6`; guard estático adicionado e Android validado.**
2. Define contrast-safe semantic pairs per theme:
   - `primary` / `onPrimary` / `primaryText` / `primarySurface`;
   - same for success, danger, warning, secondary;
   - stronger light-mode muted foreground. **Concluído em `b9e9f30`; 434 testes e Android light/dark validados.**
3. Decide header treatment in light mode. **Concluído: header terracota com foreground/status bar claros.**
4. Remove/replace invalid classes:
   - `text-3xs`, `text-[10px]` and undefined `font-display`;
   - unsupported opacity modifiers `/3` and `/8` (`/15` is valid in the installed Tailwind 3.4 scale);
   - malformed utilities such as `border purple-500/20`;
   - default Tailwind palette colors inside product screens;
   - web-only transition/selection classes. **Concluído; guarded by `native-utilities.test.ts`.**
5. Add static tests/check script for project utility conventions. **Concluído.**
6. Define typography, radius, elevation and spacing roles in one short design-system document. **Concluído em `docs/design-system.md`.**

### Locked product decisions

- Fonte nativa do sistema; remover `font-display`, não embarcar DM Sans.
- Primary `#9E422E`; on-primary creme `#F4F1DE` (5.65:1).
- Background/surface light `#F4F1DE`; branco puro não é superfície padrão.
- Manter shadows, mas somente numa hierarquia deliberada de elevação.
- Headers nativos do Stack permanecem; mudança para headers customizados exige nova decisão.
- O relatório semanal é um snapshot informativo e não exibe badge de lifecycle “concluído”; esse status pertence apenas ao fluxo pós-treino.
- Tablet fora do escopo e `supportsTablet: false`.

### Acceptance

- All measured text/control combinations pass WCAG gates.
- Zero invalid utility occurrences.
- Light/dark headers and tabs have equivalent hierarchy.
- No business logic touched.

---

## Sprint 2 — Core components and motion grammar

**Goal:** make polish systemic instead of handcrafted per screen.

**Status (2026-07-14): concluído.** Itens 1 (`Button`) e 2 (`Card`) concluídos com Antigravity, testes, Android físico e re-review independente. Item 3 (`Input` / `DatePicker`) concluído com Antigravity, 20 testes, Android físico light/dark e re-review independente. Item 4 (`SegmentedControl`) concluído com Antigravity, 6 testes, Android físico light/dark com labels ES e re-review independente. Item 5 (`ProgressBar`) concluído com Antigravity, 12 testes de contrato e call sites, suite completa verde, blockers de implementação resolvidos no re-review independente e spot check Android pós-hardening aprovado. Item 6 (`Skeleton`) concluído com 7 testes RED→GREEN, validação Android light/dark, lifecycle e Reduce Motion aprovada e re-review independente sem blockers. Item 7 (`Dialog`, `Toast`, `RestTimer`) concluído com 29 testes RED→GREEN, spot check Android light/dark aprovado e re-review independente sem blockers. A validação revelou também um loop preexistente no detalhe do programa (`useFocusEffect` → `setActiveProgram` → mudança de identidade de `fetchDashboardData`); os efeitos foram separados e a correção foi validada no Android e coberta por regressão comportamental e estrutural. O spot check do item 7 revelou ainda que a exclusão de rotinas mantinha FKs em `sessions` e `program_weeks`; a deleção agora é transacional, preserva histórico/programas por desvinculação nullable, tem 2 testes de regressão e foi validada no Android físico. O reteste expôs também callbacks `async` incompatíveis com a transação síncrona do Expo SQLite nos fluxos de create/edit/template; todos agora usam `.get()`/`.run()` síncronos, nomes duplicados têm preflight e fallback sem RedBox, double-submit é bloqueado no mesmo frame e 10 testes novos cobrem helpers, flash one-shot no destino e proíbem `transaction(async` no código de produção. Fluxos físicos create→delete→recreate→duplicate e detail→save-template→copy→refocus aprovados.

### Scope

1. `Button`
   - sentence-case default;
   - contrast-safe foregrounds;
   - restrained press motion;
   - haptic semantics by action;
   - reduced-motion path. **Implementado; `Button.test.tsx` cobre 24 cenários de casing, foreground/loading, haptics, acessibilidade, indisponibilidade, transição pressed→loading e Reduce Motion.**
2. `Card`
   - flat default;
   - elevation only for interactive/floating variants;
   - consistent pressed state;
   - remove medium haptic from ordinary navigation cards. **Implementado; `Card.test.tsx` cobre flat default/bordered, elevação explícita, token `active`, forwarding de style, ausência de haptic e semântica acessível. O pressed state real foi validado no NativeWind instalado e no Android físico.**
3. `Input` / `DatePicker`
   - ≥44dp targets;
   - consistent focus/error/disabled states. **Implementado; 20 testes cobrem floor real (incluindo multiline/height/style arrays), precedence visual, transição open→disabled e evento nativo tardio, callbacks, disabled/error associados e acessíveis, valor do DatePicker, submit nativo, fluxo Android, lifecycle/target iOS e 6 containers keyboard-safe com associação estrutural.**
   - accessible error association;
   - keyboard-safe behavior.
4. `SegmentedControl`
   - long-label strategy: scroll/wrap/adaptive layout;
   - selected indicator motion;
   - tab semantics. **Concluído; 6 testes cobrem tablist/tab/selected, targets ≥44dp, wrap adaptativo para labels ES e `MEASUREMENTS` em 4 tabs, soft breaks com copy acessível intacta, no-op da tab ativa, timing de 160ms e Reduce Motion instantâneo. Validado no Android físico em light/dark e aprovado no re-review independente.**
5. `ProgressBar`
   - remove hardcoded Portuguese;
   - expose accessibility value;
   - animate without layout thrash. **Concluído; 12 testes cobrem i18n genérico e call sites, singular/plural, labels compact/custom/hidden, semântica progressbar e modo decorativo, clamp de finitos/não finitos, geometria/cor nativas do fill, `scaleX` de 300ms sem width animation e Reduce Motion instantâneo. Validado no Android físico após o hardening do fill nativo.**
6. `Skeleton`
   - move animation lifecycle into effect;
   - honor numeric and percentage widths used by callers;
   - stop/unmount cleanly;
   - static under Reduce Motion. **Concluído; 7 testes cobrem dimensões numéricas e percentuais reais, wrapper NativeWind-safe, pulse reverso sem restart em rerender, cleanup individual e em lista, mount estático e transição dinâmica para Reduce Motion. Validado no Android físico em light/dark, pulse normal, Reduce Motion estático e troca rápida de telas sem erro; re-review independente aprovado sem blockers.**
7. `Dialog`, `Toast`, `RestTimer`
   - real safe areas;
   - focus/focus restoration;
   - accessible announcements;
   - shared modal/sheet motion timings;
   - keyboard scenarios and consistent countdown semantics. **Implementado; 29 testes cobrem foco nativo e restauração explícita, escape do VoiceOver em cada elemento focável sem colapsar a árvore acessível, safe areas reais, back/escape/backdrop, alertas assertivos/polidos, restart e cleanup de toast inclusive durante saída nativa cancelada, modal/teclado/countdown silencioso/anúncio único do descanso, gestos com Reduce Motion reativo e helper de foco. Spot check Android light/dark e re-review independente aprovados sem blockers.**
8. Document motion tokens and haptic mapping. **Concluído tecnicamente; `docs/design-system.md` agora mantém uma única matriz canônica de timings/springs, gramática de motion limitada ao escopo da Sprint 2, comportamento reativo sob Reduce Motion, adapter semântico de haptics e mapping por variante do Button. A auditoria corrigiu `Dialog` e o modal iOS do `DatePicker` para trocar `fade`/`slide` por `none`, e migrou `Button`, `SegmentedControl` e `ProgressBar` do snapshot de startup para o hook reativo sem multiplicar subscriptions por segmento. 14 blocos Jest (18 casos expandidos) cobrem props nativas, mudança pós-mount, lifecycle/cleanup do hook, valores documentados e todas as sete rotas do adapter Expo Haptics. O Dialog e a troca pós-mount de `Button`, `SegmentedControl` e `ProgressBar` foram validados no Android físico com a preferência ligada e desligada, sem reiniciar o app; o ramo iOS permanece coberto por teste.**

### Acceptance

- Component gallery/sample states reviewed in light/dark.
- Reduce Motion disables continuous/entrance motion.
- No hardcoded status-bar/bottom inset in shared overlays.
- Components pass TalkBack smoke tests.

---

## Sprint 3 — Information hierarchy and surface cleanup

**Goal:** remove card soup and visual shouting from reading-heavy screens.

### Screens

- Home
- Programs list/detail/week detail
- Routine detail
- History
- Settings
- About/report

### Scope

1. Identify one visual anchor per screen.
2. Flatten non-interactive nested cards into sections/dividers.
3. Reduce badges to meaningful status only.
4. Restrict uppercase to section eyebrows/status.
5. Normalize title/body/caption hierarchy.
6. Make user-created names two-line where needed.
7. Simplify icon and chevron treatment.
8. Ensure primary CTA wins without competing accents.
9. Choose exactly one header strategy per route; remove native/custom header duplication and manual `pt-16` compensation.

### Acceptance

- At 2-second glance, context/primary information/CTA are obvious.
- No generic card nested inside generic card.
- Shadows indicate elevation, not decoration.
- 320dp + 1.3 font scale passes PT/ES.

**Concluído.** Home, History, Settings, About, Weekly Report, Programs list/detail/week detail e Routine Detail foram reorganizados com um único anchor visual por tela, headers nativos sem duplicação, superfícies flat, badges restritos a status, nomes longos com wrap e CTA primário dominante. Guards nativos agora rejeitam `divide-*` e `last:` não suportados pelo NativeWind; separadores usam posição explícita. A suíte final cobre 58 suites / 610 testes, com typecheck, ESLint e `git diff --check` limpos. Validado no Android físico via Expo Go em 320dp e font scale 1.3, PT/ES e light/dark; os ajustes finais de key lifts e tab `Entrenos` foram aprovados no aparelho, e o re-review independente terminou sem blockers.

---

## Sprint 4 — Analytics, biometrics and dense-data polish

**Goal:** make data screens useful rather than dashboard-like decoration.

### Screens

- Bio tab
- Analytics
- Evolution
- Check-in
- Goals

### Scope

1. Reduce tile/card density and competing accent colors.
2. Standardize chart axes, labels, legends and empty states.
3. Ensure graph color contrast in both themes.
4. Separate headline metric, trend and supporting detail.
5. Use icons/text in addition to positive/negative color.
6. Fix three-column photo/metric layouts at narrow widths.
7. Preserve null/insufficient-data honesty; no fake progress.
8. Validate large/outlier values and long history.

### Acceptance

- Charts readable at 320dp without horizontal mystery scrolling unless intentionally signposted.
- Every metric has clear unit/time window.
- Positive/negative meaning survives grayscale/color-blind interpretation.
- Empty and partial data states look intentional.

---

## Sprint 5 — Forms, keyboard and workout-critical UX

**Goal:** optimize input and active workout flows for native, one-handed use.

### Screens/components

- Routine editor/templates
- Program create
- Supplements modal
- Goals modal
- Active session
- Exercise logger
- SetCard/SetEditor/SetList
- Rest timer
- Finish/summary

### Scope

1. Keyboard avoidance and scroll-to-focused/error across all forms.
2. Replace absolute/hardcoded footers with inset-aware containers.
3. Restore ≥44dp inputs/actions in routine editor.
4. Prevent accidental dismissal with dirty state.
5. Make swipe actions discoverable via visible alternative.
6. Reduce SetCard badge overload.
7. Animate only newly inserted/changed set, not replayed lists.
8. Implement real animated warm-up toggle.
9. Tune rest timer for arm's-length readability and one-hand reach.
10. Validate interruption/recovery and session-loss dialogs visually.
11. Expose slider/progress values to TalkBack.

### Acceptance

- Full workout completed one-handed without clipped controls.
- Keyboard never obscures focused field or submit CTA.
- 20-set session remains smooth.
- Reduce Motion and TalkBack passes critical flow.
- No session behavior/hook regression.

---

## Sprint 6 — i18n, content fit and accessibility completion

**Goal:** all four languages are real product experiences, not key parity theater.

### i18n scope

1. Replace ZH pinyin placeholders with Chinese characters.
2. Fix `summary.duration` (`市场` → `时长`).
3. Fix ES accents and terminology consistency.
4. Remove hardcoded PT/manual language branches.
5. Remove `t(...) || 'Portuguese fallback'` where keys are guaranteed.
6. Add translation-quality regression tests for known placeholder patterns.
7. Test dynamic labels, pluralization, dates and units.

### Accessibility scope

1. Resolve 39 validated unlabeled/untyped touchable windows.
2. Decorative SVGs hidden from accessibility tree.
3. Correct roles/states for chips, toggles, expandable rows and progress.
4. Modal focus trap/restoration and backdrop labels.
5. TalkBack traversal order on tabs, forms and workout.
6. Font scale 1.3 full pass; 1.5 critical flow.

### Acceptance

- 937/937 parity remains.
- No pinyin placeholders or hardcoded runtime language switches.
- Critical screens pass all four languages at 320dp.
- All interactive controls have accessible name/role/state as applicable.

---

## Sprint 7 — Open-issue triage and release-scope lock

**Goal:** decide which live GitHub issues still matter against the post-redesign repository before adding feature work or cleanup scope.

This sprint is discovery and decision, not implementation. An open issue is a hypothesis: its paths, counts, dependencies and proposed architecture may already be stale.

### Live starting set

Snapshot on 2026-07-14: issues `#63`–`#71` are open. Re-fetch the live backlog when the sprint starts; do not assume this snapshot remains complete.

Current clusters to investigate:

- routine organization: `#63` folders and `#64` archive;
- schedule/adherence truth: `#65` manifest, `#67` lane drift and `#71` sleep-adjusted variance;
- session model: `#66` micro-session mode;
- mutation reliability: `#68` async error feedback;
- confidence/coverage: `#69` untested routes and modules;
- external health context: `#70` nutrition pipeline.

### Scope

1. Re-fetch every open issue with body, labels, dependencies and update date.
2. Verify each issue against the current branch and current external dependencies:
   - paths and components still exist;
   - the reported gap still reproduces;
   - redesign work has not already resolved or changed it;
   - proposed abstractions remain necessary;
   - issue counts and test-coverage claims are recalculated, never copied.
3. Map dependencies and overlap before prioritizing. In particular, validate the `#65 → #67/#71` relationship, the Alexandria dependency in `#70`, the `#63/#64` product overlap, and whether Sprint 0A plus routine hardening superseded parts of `#68/#69`.
4. Score each issue on:
   - user value and observed real-world pain;
   - correctness/trust or release risk;
   - dependency readiness;
   - fit with the current product direction;
   - implementation/QA cost and uncertainty;
   - whether it destabilizes screens already approved;
   - YAGNI risk and smallest useful v1.
5. Classify every issue as exactly one of:
   - **pre-release** — worth implementing before final QA;
   - **fold into existing sprint** — same ownership and verification surface;
   - **post-release** — valuable, but not worth destabilizing this release;
   - **close/supersede** — stale, duplicate or already resolved.
6. For each pre-release candidate, define a strict v1, anti-scope, dependencies, test plan, physical-device checks and rollback boundary.
7. Produce `docs/plans/YYYY-MM-DD-open-issue-triage.md` with a lightweight evidence table, dependency graph, ranking and recommendation proportional to the live backlog; do not build process bureaucracy around a small issue set.
8. Hold an explicit Lucca decision checkpoint. No issue enters Sprint 8 and no GitHub issue is closed/relabelled solely by agent judgment.

### Acceptance

- Every live open issue is checked against current code and dependencies.
- Each recommendation cites repository evidence, not only the issue body.
- Pre-release scope is intentionally small; default is defer unless value/risk justifies release disruption.
- Lucca approves the selected/deferred/closed set.
- Approved GitHub comments/labels reflect the decision without rewriting issue history.

---

## Sprint 8 — Selected issue implementation (conditional)

**Goal:** implement only the pre-release issues explicitly approved in Sprint 7, before the final complexity audit.

Skip this sprint when Sprint 7 selects no pre-release issues.

### Scope

1. Write a focused implementation plan for each selected issue from the verified current codebase.
2. Preserve the Sprint 7 v1 and anti-scope; do not implement the issue body's speculative follow-ups by default.
3. Resolve dependency order before parallelizing. Issues touching the same schema, session flow or shared primitive remain sequential.
4. Use TDD for behavior and data changes, plus source-level contract tests where regression risk is architectural.
5. Commit each issue or independently reversible slice separately and reference the issue when appropriate.
6. Run typecheck, lint, full Jest, diff-check and required Android physical validation after each issue.
7. Re-review the resulting diff independently; update issue status only after verified execution.

### Acceptance

- Every selected issue meets its Sprint 7 acceptance criteria and physical-device checks.
- No deferred issue leaks into implementation through opportunistic refactoring.
- Full baseline remains green after all selected work.
- Remaining open issues have an explicit post-release or dependency rationale.

---

## Sprint 9 — Fresh Ponytail audit

**Goal:** produce a new evidence-based whole-repo complexity audit after redesign, i18n/a11y and any selected issue work have stabilized.

The previous Ponytail candidate list is historical context, not an execution checklist. Files previously named for deletion or simplification must be rediscovered and revalidated from zero.

### Scope

1. Capture a clean baseline before scanning: branch status, source/dependency inventory, typecheck, lint, full Jest, Expo Doctor and Android build status. If device/build tooling is unavailable in the audit environment, record the limitation and last verified evidence explicitly rather than treating environment absence as a product failure.
2. Audit the whole current repository, including app routes, components, hooks, services, utils, validators, tests, barrel exports, dependencies, scripts and CI workflows.
3. Hunt for validated `delete`, `native`, `stdlib`, `yagni` and `shrink` findings, plus:
   - transitive deadness and test-only exports;
   - stale barrels and unused hook return values;
   - duplicated constants/helpers;
   - test-runner or CI glob drift;
   - dependencies that can be removed without hidden Expo/native fragility.
4. Independently verify every candidate across production, tests, dynamic/string references, barrels, docs and workflows. Subagent output is a hypothesis, never proof.
5. Measure expected net line/dependency reduction and assign risk, behavior surface and verification plan.
6. Write a dated audit report under `docs/audits/` with:
   - confirmed findings ranked by cut size and risk;
   - rejected false positives;
   - recommended execution batches;
   - explicit deferrals and rationale.
7. Hold a Lucca checkpoint to approve which findings proceed. The audit itself applies no production cleanup.

### Acceptance

- Audit reflects the repository at the actual post-Sprint-8 commit.
- Every proposed deletion has verified zero required callers.
- Every dependency finding includes clean-install/native verification requirements.
- False positives are recorded rather than silently discarded.
- No cleanup code is mixed into the audit commit.

---

## Sprint 10 — Ponytail findings execution

**Goal:** execute only the confirmed and approved findings from Sprint 9, maximizing net reduction without weakening behavior or native reliability.

### Execution order

1. **Dead-code purge:** verified zero-caller files, exports and stale barrels.
2. **Correctness/type findings:** only when exposed by the audit and covered by a failing regression first.
3. **YAGNI removal:** unused props, wrappers, config and direct dependencies.
4. **Shrink/consolidate:** only genuine 3+ duplication where extraction produces a net reduction; no abstraction for aesthetics.

The old candidates (`constants/typography.ts`, barrel indexes, program-detail helpers, progression/calculation helpers, verdict Markdown and direct `@react-navigation/bottom-tabs`) may be re-evaluated, but receive no presumption of validity. The dependency experiment runs only if Sprint 9 reconfirms it.

### Verification

- Commit by reversible risk batch, not as one cleanup dump.
- Search tests, docs, workflows and dynamic references before every deletion.
- Run typecheck, lint, full Jest and diff-check after every batch.
- Run clean install, Expo Doctor, native Android build and runtime smoke for dependency/native-boundary changes.
- Independently review every batch and report actual net lines/dependencies removed.

### Acceptance

- Net code reduction from approved findings.
- No abstraction introduced solely to appear “clean”.
- No stale workflow, test or documentation references to removed symbols/files.
- Full behavior and native-build verification remain green.
- Audit report records executed, rejected and deferred findings separately.

---

## Sprint 11 — Final visual QA and release hardening

**Goal:** prove the polish rather than assert it.

### Scope

1. Re-run full screenshot and motion matrix.
2. Compare against Sprint 0 baseline.
3. Review every screen in light/dark.
4. Critical flow in PT/EN/ES/ZH.
5. 320/360/390/430dp + tablet decision.
6. Font scale and Reduce Motion.
7. TalkBack critical flow.
8. Performance smoke: long lists, charts, 20-set workout.
9. Fix only validated final polish defects; no new redesign ideas.
10. Run a final Ponytail delta review only on Sprint 10 cleanup and Sprint 11 QA changes; do not repeat the whole-repository Sprint 9 audit.

### Release acceptance

- All master-audit gates checked.
- No P0/P1 open.
- P2 deferrals documented with owner/reason.
- Typecheck, lint, tests and Android build green.
- Expo Doctor is either green or every remaining exception has an explicit owner/rationale. Current baseline: 16/18 due to duplicate `react-native-safe-area-context` and Expo SDK version drift.
- Lucca approves screenshot board and critical-flow recordings.

---

## Sprint 12 — Documentation reconciliation and project handoff

**Goal:** reconcile every authoritative document with the shipped product after implementation and final device QA are stable.

This sprint is intentionally last. Updating architecture, setup and component guidance while the product is still moving creates documentation churn and stale claims.

### Authoritative documentation

1. `README.md`
   - current product scope and supported platforms;
   - setup, environment variables and verified commands;
   - development, test, build and release workflow;
   - concise architecture and directory map;
   - links to deeper authoritative docs.
2. `CHANGELOG.md`
   - release-facing summary of user-visible changes;
   - migration or compatibility notes where applicable;
   - known limitations and intentional deferrals.
3. `docs/design-system.md`
   - final semantic tokens and contrast rules;
   - component, elevation, motion and haptic contracts;
   - accessibility, Reduce Motion and content-fit rules;
   - links to executable contract tests.
4. `docs/i18n/README.{en,es,zh}.md`
   - supported locales, key-parity workflow and content conventions;
   - accurate commands and ownership for future translation work.
5. `CLAUDE.md` and `GEMINI.md`
   - current project commands, conventions and architecture only;
   - remove instructions tied to deleted files, old flows or superseded tooling.

### Release version and build metadata

1. Choose the final semantic release version from the actual shipped scope; do not assume patch/minor/major before reviewing the release diff.
2. Synchronize the public version across:
   - `package.json`;
   - the root package entries in `package-lock.json`;
   - `app.json` → `expo.version`;
   - any release/version constants introduced before Sprint 12.
3. Reconcile native build identifiers:
   - Android `versionCode` must be greater than the last distributed build;
   - iOS `buildNumber` must be greater than the last distributed build;
   - confirm whether EAS uses local or remote app-version source and how production `autoIncrement` is configured before editing either field;
   - never increment locally and remotely by accident.
4. Verify the resolved Expo configuration, not only the JSON source, and confirm the About screen displays the target public version through `Constants.expoConfig.version`.
5. Align the same release version in `CHANGELOG.md`, release notes, Git tag/GitHub release and monitoring release metadata when applicable.
6. Add or run an executable version-parity check so `package.json`, lockfile and resolved Expo config cannot silently drift.

### Historical plans and audits

- Keep audits and implementation plans as historical evidence; do not rewrite their original findings to pretend the repository was always correct.
- Add a clear status header where missing: completed, superseded, partially implemented or intentionally deferred.
- Link each historical document to the final source of truth or outcome when useful.
- Consolidate or delete duplicate guidance only after checking incoming links and preserving unique decisions.

### Reconciliation checks

1. Inventory every Markdown document and classify it as authoritative, historical or obsolete.
2. Verify every documented command by running it in the final repository.
3. Verify versions, environment variables, package names, routes, file paths and supported platforms against source/configuration.
4. Check internal links and anchors.
5. Search for stale palette values, removed components, old architecture names, unsupported Web/tablet claims and obsolete QA exceptions.
6. Confirm i18n locale/key claims against executable parity tests.
7. Confirm design-system claims against component and quality tests.
8. Record final known issues and accepted Expo Doctor exceptions with owner/reason.
9. Run a final documentation diff review for contradictions and duplicated sources of truth.

### Anti-scope

- No new product features, redesigns or opportunistic refactors.
- Do not hide a product defect by documenting it as intended behavior. Route newly discovered defects back to the owning component/flow and verify the fix separately.
- Do not create a new document when an existing authoritative document can own the information.
- Do not copy the same setup or design contract across multiple files; link to the canonical source.

### Acceptance

- A clean-clone setup succeeds by following `README.md` exactly.
- Every documented command is executed successfully or explicitly marked platform/environment-specific.
- No broken internal documentation links.
- No authoritative document references removed files, obsolete tokens, unsupported targets or stale test counts.
- `package.json`, `package-lock.json`, resolved Expo config, About screen and release notes agree on one public version.
- Resolved Android `versionCode` and iOS `buildNumber` are monotonic against the latest distributed builds, with EAS/local ownership documented.
- Historical docs have an explicit status without losing their original context.
- `CHANGELOG.md` accurately represents the final release and its known limitations.
- Lucca approves the final documentation map and handoff summary.

---

## Recommended execution order

```text
Sprint 0   visual baseline
   ↓
Sprint 0A  UX trust hardening
   ↓
Sprint 1   tokens/contrast/native correctness
   ↓
Sprint 2   components/motion
   ↓
Sprint 3   reading screens ─┐
Sprint 4   data screens    ├─ sequential preferred to keep review focused
Sprint 5   forms/session   ┘
   ↓
Sprint 6   i18n/a11y/content fit
   ↓
Sprint 7   live-issue triage + Lucca scope lock
   ↓
Sprint 8   approved pre-release issues (conditional; skip when none)
   ↓
Sprint 9   fresh whole-repo Ponytail audit
   ↓
           Lucca findings checkpoint
   ↓
Sprint 10  approved Ponytail findings execution
   ↓
Sprint 11  final device QA
   ↓
Sprint 12  documentation reconciliation and handoff
```

Do not parallelize sprints that touch the same primitives. Antigravity can handle the bulk inside each sprint, but each sprint remains small enough for a human-quality diff review.

## Suggested commit boundaries

1. `fix(ux): prevent silent data loss and false-success states`
2. `fix(ui): repair semantic contrast and invalid native styles`
3. `refactor(ui): establish component and motion grammar`
4. `style(ui): simplify primary screen hierarchy`
5. `style(ui): polish analytics and biometrics`
6. `style(ui): polish forms and workout flow`
7. `fix(i18n): complete translations and responsive content`
8. `refactor(a11y): complete accessible interaction semantics`
9. `docs: triage open issues and lock release scope`
10. Per approved issue: `fix|feat(<scope>): implement verified issue slice`
11. `docs: refresh Ponytail audit against stabilized repository`
12. Per approved cleanup batch: `refactor: remove validated dead and redundant code`
13. `fix(ui): close final device QA findings`
14. `docs: reconcile final product documentation`

## First decision checkpoint — locked

Lucca locked the product direction on 2026-07-11:

1. use the native system font; remove fake `font-display` usage rather than adding a custom typeface;
2. replace pure-white light surfaces/foregrounds with cream `#F4F1DE`;
3. use terracotta `#9E422E`; it reaches 5.65:1 against cream and is the approved rollout value;
4. retain shadows, but apply them through an intentional elevation hierarchy rather than making every surface equally elevated;
5. tablet is out of scope; `supportsTablet` should be disabled;
6. Web may be installed and used as a secondary QA baseline, but does not become a supported product target without a separate decision.

These are implementation constraints for Antigravity. They are no longer candidates; any departure requires a new decision with Lucca.

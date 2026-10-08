# 64: Feature: Archive routines — soft-archive to declutter the home screen
https://github.com/BenedettiLucca/iron-log/issues/64

## Problem

There's no way to hide routines the user no longer actively uses without deleting them. Old routines (e.g. "Offseason Bulk 2025") pile up on the home screen alongside active ones. Deleting loses the history and associated session data.

## Proposed Solution

Add **routine archiving**:

- [ ] Add `is_archived` boolean column to `routines` table (default `false`)
- [ ] Drizzle migration (idempotent `ALTER TABLE`)
- [ ] Home screen: archived routines hidden by default
- [ ] Toggle: "Show archived" (filter chip or settings switch)
- [ ] Archive/unarchive action in routine detail or swipe action
- [ ] Archived routines still selectable when creating a session (if user searches explicitly)
- [ ] Archived routines excluded from "Start session" quick-pick but not from full list
- [ ] i18n keys for archive UI (pt/en/es/zh)

## Technical Context

- Routines schema: `src/db/schema.ts` → `routines` table
- Home screen: `app/(drawer)/index.tsx` — filter query needs `where(eq(routines.isArchived, false))`
- Routines hook: `hooks/use-routines.ts` — add `archiveRoutine(id)` / `unarchiveRoutine(id)`
- Existing pattern: `sets` and `sessions` already use soft-delete (`deletedAt`), but archive is a separate concept (reversible visibility, not deletion)
- Types: `src/types/index.ts` — `$inferSelect` will pick up the new column automatically

## Design Decision

**Archive ≠ delete.** Archived routines:
- Keep all associated session history intact
- Can be unarchived at any time
- Are excluded from the default home screen list
- Can still be used to start a session (explicitly, not by default)

## Relationship with #64 (Folders)

Folders organize active routines. Archive hides inactive ones. Both reduce clutter but serve different needs. A routine can be both archived AND in a folder.

## Comment 5846865444 2026-09-26T14:00:40Z
Fechada em `9bd505f`.

## O que foi entregue

- `routines.is_archived` (boolean, `default false`) + migration `0026_talented_vector.sql`
- `useRoutines`: `archiveRoutine` / `unarchiveRoutine` + `activeRoutines` / `archivedRoutines`
- Home (`app/(tabs)/index.tsx`) passa a listar `activeRoutines`
- `app/(tabs)/routines.tsx`: toggle "Mostrar arquivadas" (com contador), badge de arquivada no card, e o botão de ação alterna entre Arquivar / Desarquivar
- i18n pt/en/es/zh

## Archive ≠ delete — e ≠ soft-delete

A rotina arquivada **continua no banco**: a linha, os `routine_exercises` e as `sessions` que a referenciam seguem intactas. É por isso que ela continua utilizável para iniciar sessão e para o histórico resolver contra ela. O teste `keeps the routine row, its exercises and its sessions intact` fixa isso, e o `round-trips archive -> unarchive -> archive` fixa que o ciclo não perde dado.

`activeRoutines`/`archivedRoutines` são uma **partição** de `allRoutines`, não um filtro — testado com `active + archived == all`. Assim a rotina arquivada continua alcançável por busca explícita e por link direto, que é o requisito "still selectable when creating a session (if user searches explicitly)".

## Detalhe que vale registrar: o loader de migration

A migration exige **três** edições coordenadas: o `.sql`, o `meta/_journal.json` e o import + mapa de export **manuais** em `drizzle/migrations.js`. Perder a terceira falha em silêncio: a entrada existe no journal mas o loader do Expo nunca a aplica, então o schema simplesmente não migra no device — sem erro, sem crash, só coluna faltando depois.

`__tests__/quality/routine-archive-migration.test.ts` verifica o wiring do loader explicitamente por causa disso, e lê o `.sql` do disco em vez de redeclarar a DDL (um teste com cópia própria da migration não pega uma migration ruim).

`default false` significa: rotinas existentes continuam ativas, sem backfill e sem risco de ler NULL em linhas anteriores à migration — coberto por `defaults new and existing rows to not-archived`.

## Gates

- **155 suites / 1427 passed / 1 skipped** + session-lifecycle isolado **14 passed** (era 152/1383)
- typecheck limpo · `lint --max-warnings=0` limpo · `audit:high` passa
- Export Android Hermes verificado

Suítes novas: 11 (hook, SQLite real) + 7 (migration).

**Mutation-check dos testes:** archive como no-op derruba 7 · `activeRoutines` ignorando a flag derruba 4 · archive implementado como delete derruba 8. Com a implementação correta, 11/11.

## QA Android — pendente

Este clone não tem Android SDK, AVD, Maestro nem JDK 17, então `boot → install → app → smoke` **não roda aqui**. Os gates de host estão verdes e a lógica está coberta, mas pelo `AGENTS.md` esta mudança toca `app/` e `hooks/` com comportamento visível: o gate de AVD precisa rodar na máquina de QA antes de considerar pronto, incluindo um flow Maestro de arquivar/desarquivar.

Também falta decidir, como a issue deixava em aberto, se "archived ainda selecionável ao criar sessão" e "excluído do quick-pick mas não da lista completa" são a mesma regra. Implementei o mais conservador (some do padrão, alcançável por busca/link), mas se a intenção for outra, é ajuste de uma linha no filtro.

## Comment 5846916932 2026-09-26T14:08:04Z
Reaberta: QA Android não foi executada.

O código está entregue em `9bd505f` e os gates de host estão verdes (156 suites / 1441 passed, session-lifecycle isolado 14, typecheck, `lint --max-warnings=0`, `audit:high`, export Hermes verificado), mas **isso não fecha a issue**.

A mudança toca `app/(tabs)/routines.tsx`, `app/(tabs)/index.tsx` e `hooks/use-routines.ts` com comportamento visível. Pelo `AGENTS.md`, mudanca em `app/`/`hooks/` só é considered pronta depois do gate no AVD — typecheck/lint/Jest verdes são **necessários mas não suficientes**, e o device QA é um nível de validação separado que não se substitui. Fechar a issue com o gate de device pendente invertia o critério de pronto.

## O que falta

1. `scripts/qa.sh boot → install → app` na máquina de QA (o doctor vai avisar que o `kvm_amd` está carregado mas **não persistido** em `/etc/modules-load.d/` — vale persistir antes, senão o boot fica em TCG)
2. `scripts/qa.sh smoke` verde
3. Exploratório via `device-mcp`: arquivar, conferir que some do home e da lista padrão, ligar o toggle "Mostrar arquivadas", desarquivar, e confirmar que o botão de ação alterna entre Arquivar/Desarquivar
4. **Confirmar que uma rotina arquivada ainda inicia sessão** — é o requisito "still selectable when creating a session". Foi coberto em teste de host, mas o caminho real (preview modal → `buildSessionStartRoute`) é exatamente o que a #144 quebrou antes
5. `scripts/qa.sh receipt` com `--expected`/`--observed`/`--verdict` explícitos
6. Flow Maestro novo em `.maestro/` para arquivar/desarquivar (regra 4 do `AGENTS.md`: cenário descoberto em QA exploratório vira regressão determinística)

## Reavaliar após o QA

- A decisão em aberto sobre "archived selecionável ao criar sessão" vs "excluído do quick-pick mas não da lista completa" — implementei o mais conservador (some do padrão, alcançável por busca/link), mas o comportamento na tela pode revelar que a intenção era outra
- `NotionExportService.test.ts` não importa o serviço (#151): se o archive afetar algum export, não há rede de testes hoje

**Nota de ambiente:** este clone não tem Android SDK, AVD `ironlog-qa`, Maestro nem JDK 17, então o gate de device não pôde rodar aqui. Evidência completa em `docs/qa/2026-09-26-w1-closure.md`.

# 66: [Feature] Add micro-session mode for short accessory / home protocols
https://github.com/BenedettiLucca/iron-log/issues/66

## Summary

The current active-workout flow is optimized for full gym sessions, but recent real usage shows a different lane is sticking hard: **short accessory / home protocols** like `Punho de Ferro`.

That matters because these sessions are not just "smaller workouts". They have a different job:
- near-zero setup friction
- tiny duration
- often unilateral / alternating execution
- low need for countdown-heavy rest flow
- higher value from fast repeat logging than from rich session chrome

Right now Iron Log treats them like compressed versions of a normal workout. The next useful step is to give these protocols a dedicated **micro-session mode** instead of forcing them through the full-sized session shell.

## Why now

Two recent signals converged:

1. **Workout adherence pattern**
   - Recent history shows the short `Punho de Ferro v1.0` lane being logged repeatedly (`2026-06-23`, `2026-06-26`, `2026-06-27`, `2026-06-30`) while full gym sessions were sparser in the same window.
   - That suggests the lowest-friction lane is currently the most reliable execution wedge.

2. **Active-workout UI redesign session**
   - The recent Open Design pass on the active-workout screen improved layout stability, spacing, and screenshot quality.
   - Good moment to ask the deeper product question: should all session types keep sharing the same interaction shell?

## Proposed feature

**Name:** Micro-Session Mode

Add an optional session mode for routines/protocols that are intentionally short, repetitive, and low-friction.

Examples:
- handgrip / extensor work
- band work
- rehab / prehab circuits
- mobility finishers
- tiny home accessories

## UX goals

When a routine is marked as `micro`, the session flow should bias for speed:

- smaller header / less chrome
- one-screen logging when possible
- inline side toggle for unilateral work (`left` / `right` / `both`)
- faster set entry with minimal navigation
- optional rest-timer suppression or lightweight rest mode
- progress target visible without opening a heavier history surface
- fast finish / auto-complete flow once the tiny protocol is done

This is not a visual theme. It is a different interaction model optimized for repetition density.

## Suggested implementation

### 1. Add routine/session mode metadata
Extend routine model with something like:

```ts
sessionMode: 'standard' | 'micro'
```

Optional future flags:

```ts
microConfig: {
  hideRestTimer?: boolean
  compactHeader?: boolean
  defaultUnilateralMode?: boolean
  autoAdvance?: boolean
}
```

### 2. Branch the active-workout shell
Touchpoints likely include:
- `app/session/[routineId].tsx`
- `app/session/exercise.tsx`
- `components/session/*`
- routine/program editor surfaces

V1 does **not** need a whole new architecture. It can be a thin UI/behavior fork inside the existing session flow.

### 3. Add unilateral logging support where it helps
For protocols like handgrip/extensor work, the useful primitive is often not just set/reps/weight, but also **side context**.

Possible shape:

```ts
side?: 'left' | 'right' | 'both'
```

This can start as optional metadata instead of a full schema redesign.

### 4. Keep summary behavior lightweight
Micro sessions should still generate useful history, but the completion moment should feel instant.

Think:
- fewer taps
- less dead space
- less ceremony
- stronger bias toward "log and move"

## Acceptance criteria

- A routine can be marked as `micro`
- Starting a micro routine opens a compact session flow
- Logging a micro session requires fewer taps / less navigation than the standard flow
- Optional rest timer suppression works without affecting standard routines
- Session history still persists normally
- At least one real protocol (e.g. `Punho de Ferro`) feels materially faster to log

## Scope

**Effort:** M

## Open questions

- Should `sessionMode` live on the routine, program exercise, or both?
- Is unilateral side metadata worth adding in v1, or can the first slice ship with pure compact-flow wins?
- Should micro mode also allow custom completion heuristics (e.g. "done after N logged sets")?
- Does this belong only to the active session flow, or should home-screen routine cards also surface micro routines differently?

## Why this matters

This feature would let Iron Log learn from actual adherence instead of only from generic workout UX assumptions.

If the shortest, lowest-friction protocol is the one being repeated most consistently, the app should treat that as product signal — not as an edge case.


## Comment 4900863032 2026-07-07T06:34:24Z
Fresh evidence from the 2026-07-07 Synapse Diff pass reinforces this issue.

Why this moved from "nice UX idea" to real product signal:

- `wiki/concepts/punho-de-ferro.md` now formalizes **Punho de Ferro** as a distinct protocol with structure, progression history, and next-step logic — not a one-off workaround.
- Alexandria workout history shows **4 Punho de Ferro sessions in 8 days** (`2026-06-23`, `2026-06-26`, `2026-06-27`, `2026-06-30`) versus only **1 full Martelo de Forja session** in the same recent window (`2026-06-24`).
- The latest imported session is only **12 min** long with clear measurable progression (`30kg` crush, `45kg` negatives, body weight `115.2kg`).

That combination matters: the shortest, least cinematic lane is currently the one generating the cleanest adherence + measurable progress.

Product implication: micro sessions should not be treated as shrunken standard workouts. They are a first-class protocol type with different UX priorities:
- faster open/log/finish loop
- side-aware entry for unilateral work
- compact progress target visibility
- less ceremony than full-gym sessions

So the bar for this issue is now stronger than "better UX". It's about teaching Iron Log to model the lane that is actually compounding in real usage.


## Comment 5684763653 2026-09-15T17:18:56Z
Sprint Trust Closure (2026-09-15): **DEFERRED** — escopo grande (micro-session), fora da trust closure. Matriz completa: docs/qa/2026-09-15-sprint-trust-closure-disposition.md

# 67: [Feature] Add main-lane drift status and re-entry guidance
https://github.com/BenedettiLucca/iron-log/issues/67

## Summary

Iron Log is getting better at **schedule truth** (#65) and **low-friction accessory execution** (#66), but it still lacks the surface that matters when a real training lane quietly goes stale.

Recent live usage exposed the gap:
- `Punho de Ferro` kept logging in late June
- full gym sessions stopped for ~14 days
- the broader stack only noticed the lapse after cross-reading cron output, tasks, and wiki notes

That means the app can already record execution, but it does **not** yet express the difference between:
- accessory lane still active
- main lifting lane drifting
- athlete returning after a gap that should change today's load decision

## Proposed feature

**Name:** Main-Lane Drift Status + Re-Entry Guidance

Add a program-level status layer that detects when the core lane (e.g. Treino A/B/C) has gone stale even if smaller accessory lanes are still active, then uses that status to shape the next session start.

### What it should do

1. **Detect drift by lane**
   - compute `daysSinceLastMainSession`
   - compute `daysSinceLastAccessorySession`
   - classify state such as:
     - `on_track`
     - `main_lane_due`
     - `main_lane_overdue`
     - `re_entry_needed`

2. **Show it on the dashboard / active program card**
   - not just streak theater
   - explicit surface like:
     - `Treino B overdue by 5 days`
     - `Accessory lane active, main lane stale`

3. **Change session-start behavior after a gap**
   - if the athlete returns after X days off the main lane, show a compact re-entry card before logging:
     - last valid session date
     - last working loads
     - conservative guidance like `resume / consolidate before progressing`
   - v1 can be heuristic-driven, not AI-driven

4. **Export status through the schedule-manifest lane later**
   - this should plug naturally into #65 instead of reinventing a separate truth model

## Why now

Because the current blind spot is no longer data capture — it is **regime change detection**.

The app already knows enough to say "you trained". It still struggles to say the higher-value thing: **which lane is drifting, for how long, and should the next session be treated as a re-entry instead of a normal progression step?**

That is a real product gap, not a generic analytics wish:
- late-June logs show accessory adherence can stay alive while the main lifting lane decays
- coaching quality gets worse if the next session is analyzed like a normal continuation
- Hermes/Obsidian surfaces will get better with #65, but the app itself should own the first-class drift truth

## Suggested implementation

### 1. Add lane-aware status computation
Create a small analyzer/service that groups sessions by lane category:
- `main`
- `accessory`
- `recovery`

Possible touchpoints:
- `services/program-service.ts`
- `services/analytics.ts`
- new module: `services/adherence-drift.ts`

### 2. Define simple thresholds
For v1, keep the rules explicit:
- if a scheduled main session is missed beyond N days → `main_lane_overdue`
- if accessory sessions exist recently but no main session does → `accessory_alive_main_stale`
- if next main session starts after threshold gap → `re_entry_needed`

### 3. Add a compact re-entry surface
On session start or summary handoff:
- badge / card with gap length
- last completed main session
- note to consolidate prior load before load increase
- optional "returning after gap" tag in session summary/export

### 4. Keep V1 local and deterministic
No cloud logic, no coaching essay, no extra architecture circus.
Just enough state so the app stops pretending a comeback session is business as usual.

## Acceptance criteria

- The app can distinguish main-lane drift from accessory activity
- Dashboard/program card surfaces overdue main-lane state clearly
- Starting a main session after a gap shows re-entry guidance
- Export/summary can mark a session as a re-entry session
- Logic is covered by tests for gap thresholds and lane classification

## Effort

**M**

## Open questions

- Should lane type live on the routine, the scheduled program exercise, or the schedule-manifest model from #65?
- What gap threshold is honest enough for `re_entry_needed` without over-triggering?
- Should V1 only warn, or should it also adjust auto-suggestions in existing progression helpers?
- Is the best UI surface the home dashboard, the program detail screen, the session-start screen, or all three?

## Related
- #65 schedule manifest
- #66 micro-session mode


## Comment 5684763941 2026-09-15T17:18:57Z
Sprint Trust Closure (2026-09-15): **DEFERRED** — meta-infra, sem prioridade atual. Matriz completa: docs/qa/2026-09-15-sprint-trust-closure-disposition.md

# 70: Feature: Nutrition Context Pipeline — sync daily intake alongside training data
https://github.com/BenedettiLucca/iron-log/issues/70

## Summary

Connect Alexandria's nutrition import pipeline to iron-log so daily calorie/macro intake displays alongside workout data.

## Why Now

Three things converged this week:
1. **Alexandria ponytail sprint2** is deduplicating `import_nutrition` — the pipeline is getting production-ready
2. **Bodyweight is flat at 115.2kg** despite real gym progress (Punho de Ferro PRs, Hack Squat 90kg PR) — the missing variable is visible calorie/macro tracking
3. **The error-localization principle** just got formalized in the wiki — putting nutrition next to training lets you see *which* variable is failing (calories vs volume vs sleep), not just that progress stalled

## What It Looks Like

- In the training screen, show "Today's macros" row alongside the workout summary
- Pull from Alexandria `/api/v1/health/nutrition` (or however the dedup'd pipeline surfaces daily data)
- Display: calories, protein, carbs, fat for the current day
- Optional: 7-day rolling average vs target

## Implementation Notes

- Read-only from iron-log's perspective — data lives in Alexandria
- Simplest path: a daily query at app boot, cached in Zustand
- Alexandria sprint2 is already cleaning up the `import_nutrition` dedup, so the source data should be good soon

## Effort

**S-M** — mostly integration work (~1 day). No new UI patterns needed. No new API endpoints if Alexandria already surfaces daily aggregates.

## Dependencies

- Alexandria `import_nutrition` dedup (sprint2, in progress)
- Alexandria exposes a daily nutrition summary endpoint or view

## Related

- `{{site_url}}/{{repo}}/issues/68` — useAsyncAction hook (error localization) — the other half of the "make failure visible" equation


## Comment 5684764203 2026-09-15T17:18:58Z
Sprint Trust Closure (2026-09-15): **DEFERRED** — depende pipeline Alexandria externo. Matriz completa: docs/qa/2026-09-15-sprint-trust-closure-disposition.md

# 72: Feature: Readiness-to-Train Gate — pre-session composite signal from Alexandria health data
https://github.com/BenedettiLucca/iron-log/issues/72

## Summary

Iron Log already detects when a **main lane drifts** (#67) and can show **sleep-adjusted training variance** (#71). The natural next layer is a **readiness-to-train gate**: a single composite signal that says "your body is *ready* for the prescribed session today" before the athlete even starts the warmup.

Today the decision to lift, deload, or skip lives entirely in Lucca's head. The data to make that call objectively lives in Alexandria (sleep HRV, sleep duration, resting HR, bodyweight trend) — but Iron Log never consults it before the session starts. The feedback loop only fires *after* a missed session (#71 explains why it was missed) instead of *before* it.

## Why Now

Three threads converge this week:

1. **The Harness Thesis just got formalized in the wiki** (`concepts/model-switching-reliability.md`, updated 2026-07-18). The principle: reliability lives in the *system around the brain*, not the brain itself. Applied to training: the readiness signal is the **harness** around the session — it decides whether today's prescribed load gets executed, modified, or deferred.

2. **Issue #71 (Training Variance Attribution)** already pulls sleep data from Alexandria *after* a miss. Issue #70 (Nutrition Context) pulls calorie/macro data *alongside* training. Both pipelines exist or are being built. The **readiness gate** is the predictive upstream of both: use the same Alexandria signals *before* the session, not just after.

3. **The wiki just formalized Error Localization Principle** (`concepts/error-localization-principle.md`). The fitness instantiation there is `Punho de Ferro`'s left/right asymmetry tracking. But a readiness gate is a *higher-order* instantiation: it localizes the failure boundary between **programmed load** and **biological capacity** — the boundary where most training stalls actually live but nobody visualizes.

## What It Looks Like

On the **active program card / today's session screen**, above the prescribed workout, show a readiness row:

```
Readiness — Today, Treino B

  Sleep: 6.8h (7d avg 7.1h) ✓
  HRV: 52ms (7d avg 55ms) ✓
  Resting HR: 58 bpm (7d avg 56 bpm) △ +2
  Bodyweight: 115.2kg (flat 14d)

  Composite: TRAIN AS PRESCRIBED
  (1 yellow flag — monitor RPE on compound lifts)

If any two flags red → suggestion: deload 10% or defer to accessory-only.
```

## Implementation Notes

- **Read-only from iron-log's perspective** — same pattern as #70/#71. Data lives in Alexandria.
- Query Alexandria `/api/v1/health/sleep`, `/api/v1/health/heart_rate`, `/api/v1/health/weight` at app boot or session-open.
- Compute deltas vs 7-day rolling baseline (already a useful primitive for #71).
- **Composite logic is intentionally simple at first** — red/yellow/green per signal, two reds = suggest deload. Resist building a fancy ML model; Lucca is the arbiter.
- The gate is **advisory, not blocking** — Lucca can override. The value is making the override explicit, not automatic enforcement (same philosophy as #67's re-entry guidance).

## Why This Compounds

This closes the loop the existing open issues started:

- #67 detects drift *after* it happens.
- #70 shows nutrition *alongside* training.
- #71 explains variance *after* a miss.
- **This issue (#72) predicts the miss *before* it happens.**

Together they turn Iron Log from a training logger into a **closed feedback system**: prescribe → readiness-gate → execute → attribute variance → adjust next prescription. That's the Martelo de Forja v9.2 protocol expressed as software, not just recorded by it.

## Open Questions

- Should the readiness gate pull from Health Connect directly (meetcap-style bridge) or always go through Alexandria? Alexandria-first keeps one source of truth.
- Does the composite logic stay in iron-log or move to Alexandria as a derived health summary? (Alexandria already has `refresh_summary` for daily aggregations — could host the readiness score there.)
- Should historical readiness be stored for retro analysis, or kept ephemeral?

## Effort

M — the Alexandria query layer is partially built (#70, #71 share it). The new work is the composite scoring, the UI surface, and the override flow. ~2-3 days.


## Comment 5684764423 2026-09-15T17:18:59Z
Sprint Trust Closure (2026-09-15): **DEFERRED** — depende pipeline Alexandria externo. Matriz completa: docs/qa/2026-09-15-sprint-trust-closure-disposition.md

# 74: Feature: Plateau Detection Alert — flag stale loads across consecutive sessions
https://github.com/BenedettiLucca/iron-log/issues/74

## Summary

Add a longitudinal plateau detector that flags when an exercise has not progressed in load or reps for N consecutive sessions, surfacing it as an actionable alert (deload, rep-scheme change, or load increase).

## Why

On 2026-07-23, the Synapse Diff identified **four simultaneous plateaus** across different domains — one of them was fitness: supino flat bench stuck at 55kg for 4 consecutive sessions (RIR 0, no load progression), RDL at 60kg for 4 sessions (lost reps on the last), and handgrip at 30kg with RIR *increasing* (load too light but invisible to the protocol). None of these plateaus were surfaced by the app — they were only discovered through manual cross-referencing of Progress.md data.

The plateau is a **failure boundary that's invisible** — the user keeps hitting RIR 0 and thinking "I'm working hard" when the real signal is "the variable is exhausted, change it." This maps to the Error Localization Principle (7th instantiation, wiki).

## Proposed Behavior

1. **Track consecutive-session stagnation** per exercise:
   - Same load × same rep target for N sessions (default: 3)
   - RIR increasing across sessions (getting easier = load too light)
   - RIR 0 but no load increase for N sessions (true plateau)
2. **Surface as actionable alert** in the session summary or a dedicated "Plateau Watch" section:
   - Exercise name + number of sessions stalled
   - Suggested action: "Consider deload (reduce 10%)", "Increase load", "Change rep scheme"
   - Link to variance attribution (#71) if sleep/recovery data explains the stall
3. **Distinguish plateau types:**
   - **Load plateau** — same weight, RIR 0, no progression → deload or rep-scheme change
   - **Regression plateau** — same weight, RIR *increasing* (getting easier) → load is too light, increase it
   - **Rep plateau** — losing reps at same weight → recovery issue or load too heavy

## Relationship to existing issues

- **#72 (Readiness-to-Train Gate)** — pre-session composite score. This is *before* the session. Plateau detection is *across* sessions (longitudinal).
- **#71 (Training Variance Attribution)** — sleep-adjusted workload. This explains *why* variance exists. Plateau detection identifies *that* a plateau exists and triggers the variance investigation.
- Complementary, not overlapping. Plateau detection is the trigger; #71 and #72 are the diagnostic tools.

## Technical approach

- New service: `PlateauDetector` (mirrors existing `ProgramService` / `SessionService` patterns)
- Query: group sessions by exercise, compute consecutive-session deltas on load + reps + RIR
- Threshold config: `PLATEAU_SESSION_THRESHOLD` (default 3), `RIR_REGRESSION_FLAG` (RIR increasing = load too light)
- Alert surface: session summary card or dedicated section in the program view
- No new data model needed — works on existing session/exercise/sets data

## Effort

**M** — ~300-400 lines. Query logic is straightforward (window function or in-memory consecutive-session scan). The UI surface is the bigger piece — could start with a console/log alert and graduate to a UI card.

## Source

Synapse Diff cron — 2026-07-24 (cross-domain plateau analysis connecting fitness, code, and content stagnation)

## Comment 5684764690 2026-09-15T17:19:00Z
Sprint Trust Closure (2026-09-15): **DEFERRED** — proposta futura de detection. Matriz completa: docs/qa/2026-09-15-sprint-trust-closure-disposition.md

# 75: Feature: Cut Velocity Injury-Risk Flag — surface connective-tissue risk during aggressive cuts (tendon-strength-gap framework)
https://github.com/BenedettiLucca/iron-log/issues/75

## Context

The wiki just absorbed a new concept page — `tendon-strength-gap` (from the Jeremy Ethier video, batch import 2026-07-24). The core thesis: **muscle strength and connective tissue do not adapt at the same rate.** Rapid increases in training load, volume, or intensity can exceed the rate at which tendons adapt — the classic injury-risk scenario is a lifter who gets stronger faster than their tendons can tolerate the new loads.

This connects directly to a live situation: a user in an aggressive caloric deficit (body weight dropping ~2.4kg in 10 days, historic low) while simultaneously pushing for PRs. That is the textbook high-risk profile the tendon-strength-gap framework warns about — strength may hold or even increase due to neural adaptation, but tendon capacity lags, especially under caloric restriction (collagen synthesis is energy-dependent).

## The Gap

The `body_metrics` table already has a `weight` field (`real('weight')`), and body-weight entries are being logged. But this data is **not used for any risk analysis.** The schema supports it; the UI/analytics layer doesn't surface it.

Meanwhile:
- #74 (Plateau Detection) will flag stale loads
- #71 (Training Variance Attribution) explains *why* variance exists
- #72 (Readiness-to-Train Gate) is a pre-session composite
- #70 (Nutrition Context Pipeline) syncs intake

What's missing is the **cut-velocity injury-risk layer** that ties body-weight trend → training load → connective-tissue risk.

## Proposed Feature

**Cut Velocity Injury-Risk Flag**

Compute the rate of body-weight change from `bodyMetrics.weight` over a rolling window (default 7-14 days). When:

1. **Cut velocity exceeds threshold** (configurable, default >1% body-weight/week), AND
2. **A load plateau OR regression is detected** (leverages #74's `PlateauDetector`),

→ surface a **connective-tissue injury-risk warning** on the session summary, grounded in the tendon-strength-gap framework: rapid weight loss + stalled/declining strength = elevated tendon/ligament risk because tendon adaptation lags behind both muscle and fat loss.

### Why this matters now

- The `bodyWeight` field exists but is analytics-dead weight.
- Plateau detection (#74) gives the trigger; this feature gives the *interpretation* — a plateau during a cut is a different signal than a plateau during a bulk.
- Connective-tissue injuries (tendinopathy, strains) are the failure mode that derails a cut more than anything else — and they're preventable if surfaced early.

### Implementation sketch

1. New service: `CutVelocityAnalyzer` (mirrors `PlateauDetector` pattern from #74).
2. Query: linear regression or simple delta over `bodyMetrics.weight` for the last N entries, normalized to %/week.
3. Composite risk signal: `cut_velocity_high AND plateau_detected` → `injury_risk_elevated`.
4. Surface: badge/alert on session summary card. Future: dedicated "Recovery & Risk" card.
5. Config: `CUT_VELOCITY_THRESHOLD_PCT_WEEK` (default 1.0), `CUT_VELOCITY_WINDOW_DAYS` (default 14).
6. Integration points: feeds into #72 (Readiness Gate) as one input; consumes #74 (Plateau Detector) output.

### Effort

**M** — ~250-350 lines. The weight data already exists. The plateau detector (if #74 ships first) provides half the signal. The composite logic + UI surface is the bulk.

### Open questions

- Should this also factor in training volume/intensity trend (not just load plateau)? A volume spike during a cut is also a tendon-risk signal.
- Collagen synthesis is energy-dependent — should a very low intake flag add weight here? Depends on #70 (Nutrition Pipeline) landing first.
- Is 1%/week the right default, or should it scale with absolute body weight?

## Provenance

Source: Synapse Diff cron 2026-07-25. Connection discovered between the fresh wiki page `tendon-strength-gap` (Jeremy Ethier video, batch import 2026-07-24), the `body_metrics.weight` schema field, and the existing plateau-detection feature track (#70-#74).


## Comment 5684765134 2026-09-15T17:19:01Z
Sprint Trust Closure (2026-09-15): **DEFERRED** — proposta futura de flag. Matriz completa: docs/qa/2026-09-15-sprint-trust-closure-disposition.md

# 79: Feature: Superset \u2014 agrupar exerc\u00edcios back-to-back com descanso \u00fanico (planejado + parear mid-session)
https://github.com/BenedettiLucca/iron-log/issues/79

## Origem
Benchmark openGym (gitea.com/DuarteSantos/openGym v1.2.9) — auditoria de feature gap.

## Problema
Iron Log não suporta supersets. `routine_exercises` é uma lista linear (PK `(routine_id, exercise_id)`, coluna `order_index`); não há conceito de agrupamento. Na execução, cada exercício roda suas séries + descanso próprio, em série — não em paralelo.

## Proposta (parity com openGym)
- Planejar superset na rotina: agrupar 2+ exercícios; executar o grupo back-to-back com **um único descanso** no fim de cada rodada
- Parear mid-session: ação "superset com anterior/próximo" durante o treino
- Unpair a qualquer momento; grupo que fica com 1 membro se dissolve sozinho
- Timer de descanso do grupo compartilhado

## Notas de schema
- Precisa de coluna `group_id`/`superset_group` em `routine_exercises` (e equivalente em runtime de sessão)
- Cuidado: PK atual `(routine_id, exercise_id)` já bloqueia duplicar exercício na mesma rotina — ver issue estrutural irmã

## Prioridade
P0 do audit — mecânica central de execução que o benchmark tem e nós não.

## Comment 5684765479 2026-09-15T17:19:03Z
Sprint Trust Closure (2026-09-15): **DEFERRED** — feature grande (superset), sprint futura. Matriz completa: docs/qa/2026-09-15-sprint-trust-closure-disposition.md

# 80: Feature: Treino livre (freestyle) \u2014 sess\u00e3o sem rotina com prefill da \u00faltima execu\u00e7\u00e3o
https://github.com/BenedettiLucca/iron-log/issues/80

## Origem
Benchmark openGym v1.2.9 — auditoria de feature gap.

## Problema
Todo início de sessão exige uma rotina: `handleQuickStart(routineId, ...)` em `app/(tabs)/routines.tsx:126` é o único entry point. Não dá para treinar sem plano (escolher exercícios na hora).

## Proposta (parity)
- "Treino livre": iniciar sessão sem rotina e adicionar exercícios durante a sessão
- Cada exercício chega **prefill da última execução** (mesmas séries, mesmas reps/carga por posição) — sessão improvisada não começa pedindo redigitar
- Sessão freestyle aparece no histórico/relatórios como qualquer sessão

## Dependência
- Requer o fluxo de add/remove exercício mid-session (issue "Add/remove exercício mid-session sem encerrar o treino")
- Reaproveita o prefill do "histórico instantâneo" que já existe

## Prioridade
P0 do audit.

## Comment 5684765838 2026-09-15T17:19:04Z
Sprint Trust Closure (2026-09-15): **DEFERRED** — feature grande (freestyle), sprint futura. Matriz completa: docs/qa/2026-09-15-sprint-trust-closure-disposition.md

# 81: Feature: Add/remove exerc\u00edcio mid-session sem encerrar o treino
https://github.com/BenedettiLucca/iron-log/issues/81

## Origem
Benchmark openGym v1.2.9 — auditoria de feature gap.

## Problema
O fluxo de sessão é uma via de mão única: `[routineId].tsx → exercise.tsx → finish.tsx`. Depois de iniciar, não há caminho de volta ao seletor de exercícios — impossível adicionar um exercício decidido na hora ou remover um que não vai rolar, sem encerrar o treino.

## Proposta (parity)
- Ação "adicionar exercício" disponível durante a sessão (abre o picker da biblioteca sem sair da sessão)
- Ação "remover exercício" da sessão corrente (com undo; sets já logados do exercício são removidos ou mantidos conforme decisão — definir no design)
- Se o exercício removido é membro de superset: perguntar qual remover (parity openGym)

## Prioridade
P0 do audit; pré-requisito do treino livre (issue "Treino livre (freestyle)").

## Comment 5684766142 2026-09-15T17:19:05Z
Sprint Trust Closure (2026-09-15): **DEFERRED** — feature grande (mid-session edit), sprint futura. Matriz completa: docs/qa/2026-09-15-sprint-trust-closure-disposition.md

# 82: Feature: Cardio como tipo de exerc\u00edcio \u2014 log tempo + velocidade/dist\u00e2ncia com PR
https://github.com/BenedettiLucca/iron-log/issues/82

## Origem
Benchmark openGym v1.2.9 — auditoria de feature gap.

## Problema
"Cardio" hoje é só um checkbox pós-sessão ("Incluí cardio extra" — `cardioText` no i18n). Não existe tipo de exercício cardio: `exercises.type` aceita só `'strength' | 'duration'`. Não dá para logar tempo + velocidade/distância como exercício de verdade, com histórico e PR.

## Proposta (parity)
- Novo tipo `cardio` em `exercises.type`
- Log: tempo + velocidade (ou distância) em vez de peso × reps; stepper/timer coerente na tela de exercício
- PRs por cardio (melhor tempo/velocidade/distância); volumes nos relatórios tratam cardio sem quebrar métricas de força
- Migração: mapear exercícios de duração existentes que sejam cardio (esteira, bike...) se houver

## Prioridade
P1 do audit.

## Comment 5684766451 2026-09-15T17:19:06Z
Sprint Trust Closure (2026-09-15): **DEFERRED** — feature grande (cardio type), sprint futura. Matriz completa: docs/qa/2026-09-15-sprint-trust-closure-disposition.md

# 95: Feature: Data agendada em sessions + reschedule de treino para outro dia
https://github.com/BenedettiLucca/iron-log/issues/95

## Origem
Audit estrutural — bug latente de modelagem (paridade com openGym: "reschedule any day").

## Problema
`sessions` não tem data agendada — herda o timestamp real de início. "Adoeceu terça e treinou quinta" fica registrado como se o treino de quinta fosse o do plano; a grade semanal marca a semana certa mas não o dia certo. O openGym trata mover treino para outro dia como feature central sem tocar o plano semanal.

## Proposta
- Coluna `scheduled_date` (nullable) em `sessions` + migration
- Ao iniciar sessão de um programa, pré-preencher com o dia planejado; UI de histórico/grade usa data agendada quando presente, data real como fallback
- Ação de reschedule no histórico (mover sessão para outro dia sem tocar no plano)

## Prioridade
P1 — corrige a semântica do histórico para quem segue programa.

## Comment 5684766742 2026-09-15T17:19:07Z
Sprint Trust Closure (2026-09-15): **DEFERRED** — feature grande (scheduled date), sprint futura. Matriz completa: docs/qa/2026-09-15-sprint-trust-closure-disposition.md

# 112: [Infra] Upgrade Expo SDK 54 -> 57 (ou migrar pra development build) — Expo Go treadmill bloqueia QA físico
https://github.com/BenedettiLucca/iron-log/issues/112

## Origem
QA físico da Sprint 12+13 (2026-09-05): Expo Go da loja só abre SDK 57 — projeto na 54 ficou incompatível. Trava o ciclo de QA no device a cada major release do Expo.

## Problema
Expo Go suporta apenas a SDK mais recente da Play Store. Enquanto o app for QA'd via Go, cada major do Expo obriga upgrade imediato ou perde o canal de teste.

## Caminhos (decidir na sprint dedicada)
1. **Upgrade 54→57** — 3 majors de uma vez (55/56/57), RN bump, new architecture, breaking changes prováveis em expo-notifications (usada pela #89). Sprint dedicada com QA completo.
2. **Development build (expo-dev-client)** — imune ao treadmill, permite libs nativas custom; custo: pipeline de build próprio (EAS ou local).

## Contexto
- 13.0 alinhou os 15 pacotes DENTRO do 54 (feito em 2026-09-05, commit c227e57)
- QA de hoje resolvido com Expo Go 54.0.8 sideload (APK oficial do repo expo/expo-go-releases)
- #76 (audit debt) permanece separada e é subtree deste tema



# 114: [QA][E2E] Cenário app morto para notificações locais — impossível em Expo Go, validar em dev build
https://github.com/BenedettiLucca/iron-log/issues/114

## Origem
QA físico 2026-09-05: o Teste 5 do #89 foi validado com app em BACKGROUND (JS vivo). O requisito original da #89 é sobreviver ao app MORTO (process kill), que é o cenário real de treino pesado.

## Problema
Expo Go não permite validar o processo morto de forma confiável (dev bundle + kill do host). O schedule é do SO (expo-notifications local), então a expectativa é passar — mas sem prova em build nativa, é inferência.

## Proposta
- No dev build (após #112 ou via EAS dev client): schedule → swipe kill do app → notificação chega? → tap na notificação reabre o app na sessão certa?
- Cobrir também deep-link/data da notificação (type: rest_complete → navegação)

## Prioridade
baixa-média — risco baixo (schedule é SO), mas é o critério de aceitação original da #89



# 136: [UX][P2] Adicionar preferência de unidades métricas/imperiais mantendo storage canônico
https://github.com/BenedettiLucca/iron-log/issues/136

## Oportunidade

A interface e os exports assumem `kg`/`cm` em praticamente todos os fluxos. Ao mesmo tempo, o app já suporta múltiplos idiomas, incluindo inglês, mas `userSettings` não possui preferência de unidades.

Isso limita adoção fora de mercados métricos e acopla apresentação ao formato de persistência.

## Proposta

Adicionar uma preferência explícita de unidades, por exemplo:

```ts
unitSystem: 'metric' | 'imperial'
```

Manter o banco em uma unidade canônica (`kg`/`cm`) para não multiplicar complexidade analítica. Conversão deve acontecer nas bordas:

- input/display de peso corporal e carga;
- medidas corporais;
- histórico, analytics, PRs e e1RM;
- exports, sempre com unidade explicitamente identificada.

A escolha deve ficar em Settings e ser independente do idioma do app.

## UX

- usuário escolhe Métrico (`kg`, `cm`) ou Imperial (`lb`, `in`);
- valores existentes mudam de apresentação sem migração/destruição de dados;
- edição em imperial converte de volta para o formato canônico ao salvar;
- formatação/arredondamento é consistente e previsvisível.

## Critérios de aceite

- setting de unidade persistente e independente do locale;
- storage existente permanece canônico, sem converter linhas antigas;
- todos os fluxos principais de peso/carga/medidas respeitam a preferência;
- exports deixam inequívoca a unidade utilizada;
- testes de round-trip evitam drift significativo (`kg -> lb -> kg`, `cm -> in -> cm`);
- trocar a preferência não altera os valores físicos registrados.



# 147: feat: check "não me pesei hoje" no finish — usar último peso só no relatório, sem gravar pesagem falsa
https://github.com/BenedettiLucca/iron-log/issues/147

## Contexto

Hoje a tela de finish (`app/session/finish.tsx`) pré-carrega o último peso corporal do banco no campo de input (última linha em `bodyMetrics` com `type='daily'`) e mostra a data dessa pesagem. Ao finalizar, `SessionLifecycleService.finishSession()` **sempre** grava o valor do campo como pesagem nova: atualiza `sessions.bodyWeight` **e** insere uma linha nova em `bodyMetrics` com a data de agora.

Consequência: se a pessoa não se pesou no dia, o app fabrica uma pesagem "falsa" com data do treino — poluindo a série histórica de `bodyMetrics` e mentindo no relatório semanal (`NotionExportService`), que exporta `body_weight` por sessão como se fosse medição do dia.

## Comportamento desejado

No fim do treino (tela finish), o usuário deve poder marcar um check **"Não me pesei hoje"**:

1. **Check marcado:**
   - NÃO gravar `bodyWeight` novo na sessão;
   - NÃO inserir linha nova em `bodyMetrics`;
   - O último peso disponível do banco é usado **apenas para gerar o relatório final** (export Notion para os professores);
   - O relatório final **discrimina** que aquele peso é o último disponível — emprestado — e mostra a **data real da última pesagem** (não a data do treino).
2. **Check desmarcado:** comportamento atual permanece (peso digitado é gravado como pesagem do dia).

## Pontos do código afetados (estado de 2026-09-22)

- `app/session/finish.tsx`
  - ~L72-114: estado `weight` / `previousWeight` / `lastWeightDate` e pré-carga do último peso.
  - Novo: estado do check + UI (checkbox/toggle no card "Peso Corporal"), desabilitando o input quando marcado.
- `services/SessionLifecycleService.ts`
  - `finishSession()` (~L201-269): hoje `parsedWeight !== null` → grava `sessions.bodyWeight` + insere em `bodyMetrics`. Novo parâmetro (ex.: `weightNotMeasured: boolean`) ou convenção para pular ambas as escritas quando o check vier marcado.
- `services/NotionExportService.ts`
  - Export por sessão (~L69, `body_weight:`) e relatório semanal: discriminar peso emprestado com a data da última pesagem real (ex.: `body_weight: 82.5 (última pesagem: 18/09)`). A proveniência (peso do dia vs. emprestado) precisa estar consultável na sessão/`bodyMetrics` no momento do export.

## Decisão de desenho em aberto (resolver antes de implementar)

Como representar a proveniência no dado: flag na linha da sessão (ex.: `bodyWeightSource: 'measured' | 'carried'`), coluna em `bodyMetrics`, ou derivação no export comparando `sessions.bodyWeight` com a última linha de `bodyMetrics`. Preferir a opção que mantenha o relatório correto mesmo após restore/import — dados locais são fonte de verdade.

## Aceite

- [ ] Check "Não me pesei hoje" na tela finish (i18n pt/en/es/zh, sem string hardcoded).
- [ ] Check marcado → nenhuma escrita nova em `sessions.bodyWeight` nem `bodyMetrics` (teste de regressão em `finishSession`).
- [ ] Relatório semanal/single-session discrimina peso emprestado + data da última pesagem real.
- [ ] Check desmarcado → comportamento atual intacto.
- [ ] Migration Drizzle se a decisão de desenho exigir nova coluna; `npx drizzle-kit generate` + teste.
- [ ] QA Android (AVD + Maestro) cobrindo os dois caminhos do check — obrigatório para mudança em `app/`.

## Contexto adicional

- Relatório final é enviado a professores — a discriminação precisa ser honesta e legível por terceiros.
- Origem do pedido: áudio do Lucca (2026-09-22); escopo verificado no código antes de abrir esta issue.




# 148: refactor: separar avaliação de progressão do log do treino
https://github.com/BenedettiLucca/iron-log/issues/148

## Problema

O Iron Log já calcula uma avaliação por exercício depois do treino (`generateSessionVerdicts`): resultado em relação à meta, veredito (`increase`, `hold`, `review_fatigue`, `check_logging`), sugestão de próxima carga, flags e confiança.

Hoje essa avaliação aparece em dois lugares misturados com o relatório do treino:

- `app/session/summary.tsx` renderiza cards de "Coaching Verdicts", o que é a direção correta, mas ainda dentro do fluxo genérico do resumo;
- `src/utils/session-summary.ts` concatena os vereditos dentro de `report`, junto do log textual de exercícios, séries, observações e metadados;
- `services/NotionExportService.ts` também inclui `buildSessionVerdictsMarkdown(verdicts, t)` no mesmo Markdown do treino.

O log do treino deve responder **o que foi feito**. A avaliação de progressão deve ser um campo/bloco separado, legível e acionável — não uma linha adicional perdida no log.

## Comportamento desejado

Criar uma seção/campo explícito de **Avaliação de progressão** separado do log do treino, com indicadores claros por exercício:

- **Aumentar carga** — indicador positivo, próxima carga sugerida quando calculável;
- **Manter carga** — indicador neutro;
- **Revisar fadiga / reduzir carga ou descansar** — indicador de atenção;
- **Revisar registro** — indicador de inconsistência;
- resultado contra a meta: abaixo / dentro / topo da faixa;
- meta vs. execução real;
- flags de anomalia separadas e legíveis;
- confiança da avaliação visível ou disponível no dado/export.

A semântica deve ser consistente entre tela, relatório copiado e export para Notion.

## Contrato de separação

1. O **log do treino** contém sessão, exercícios, séries, cargas, repetições, RIR, duração, sRPE e observações.
2. A **avaliação de progressão** é um campo/bloco estruturado separado, tanto no modelo de relatório quanto no Markdown/export.
3. O resumo visual pode manter cards, mas eles devem ser tratados como a representação da avaliação — não como texto contaminando o log.
4. Consumidores que querem apenas o treino bruto devem conseguir ignorar a avaliação sem precisar parsear ou remover texto misturado.

## Pontos do código verificados

- `src/utils/session-verdicts.ts`: fonte da avaliação por exercício (`result`, `verdict`, `nextLoadSuggestion`, `flags`, `confidence`).
- `src/utils/session-summary.ts:155-196`: hoje concatena `## verdicts` dentro de `report`; separar o retorno em algo como `workoutLog` + `progressionAssessment` (nomes finais a decidir).
- `app/session/summary.tsx:255-331`: já possui cards visuais de veredito, mas precisa ser alinhado ao contrato separado e aos indicadores/i18n.
- `services/NotionExportService.ts:97-100`: hoje adiciona os vereditos ao Markdown principal; exportar em seção/campo explícito de avaliação, sem misturar com o log.
- `src/utils/session-verdict-markdown.ts`: revisar junto para garantir que o Markdown de avaliação seja um bloco independente.

## Aceite

- [ ] O log bruto não contém o bloco de avaliação de progressão.
- [ ] O resumo apresenta um campo/seção de avaliação claramente separado, com indicadores visuais distintos para aumentar/manter/revisar.
- [ ] Cada exercício mostra resultado, meta, execução, próxima ação e flags relevantes sem depender de interpretação do texto.
- [ ] O export de sessão e o relatório semanal para Notion preservam a separação entre log e avaliação.
- [ ] A avaliação continua disponível em formato estruturado para futuros agentes/relatórios, sem parsear Markdown.
- [ ] i18n completo em pt/en/es/zh; nada de labels hardcoded.
- [ ] Testes cobrem pelo menos: increase, hold, review_fatigue, check_logging, no_target e flags.
- [ ] Testes de export garantem que o log não recebe veredito misturado e que o bloco separado é emitido.
- [ ] QA Android valida a leitura visual dos indicadores no resumo.

## Fora de escopo

- Reescrever a lógica de `generateExerciseVerdict`.
- Alterar a prescrição de treino ou automatizar a aplicação da próxima carga.
- Criar recomendações clínicas ou substituir a decisão dos professores.




# 149: [Data][P2] Peso corporal emprestado sai sem discriminação em 3 exportadores + NotionExportService sem cobertura própria
https://github.com/BenedettiLucca/iron-log/issues/149

## Contexto

Durante a análise da #147 (check "não me pesei hoje" no finish) verificou-se que o mesmo
defeito de proveniência de peso corporal aparece em outros três exportadores, que a #147
não cita (ela nomeia apenas o Notion).

`SessionLifecycleService.finishSession` grava `sessions.bodyWeight` e insere uma linha em
`body_metrics` com a data do treino sempre que o campo de input tem número — e o input é
pré-carregado com o último peso do banco (`app/session/finish.tsx:108-114`). Se a pessoa não
se pesou, o app fabrica uma medição.

## Superfície afetada

| Local | O que emite |
|---|---|
| `src/utils/session-summary.ts:130` | `⚖️ reportWeight: ${session.bodyWeight} kg` — relatório copiado/Compartilhado |
| `services/CsvExportService.ts:85, 96, 311` | coluna `body_weight` por sessão no CSV |
| `services/AlexandriaExportService.ts:200` | `metadata.body_weight` no export Alexandria |
| `services/NotionExportService.ts:69` | `body_weight:` no frontmatter — **este é o escopo da #147** |

O relatório semanal do Notion (`exportWeeklyReport`) não exporta peso corporal, então não é
afetado.

## Lacuna de teste relacionada

`__tests__/services/NotionExportService.test.ts` **não importa `NotionExportService`**. A suíte
testa apenas `buildSessionVerdictsMarkdown` (de `src/utils/session-verdict-markdown.ts`). Isso
significa que `exportSessionMarkdown` e `exportWeeklyReport` não têm cobertura própria — a linha
`body_weight:` nunca foi exercitada por teste.

## Critérios de aceite

- [ ] A #147 entrega a proveniência em `sessions` e discrimina peso medido vs. emprestado.
- [ ] `session-summary.ts`, `CsvExportService` e `AlexandriaExportService` discriminam o peso
      emprestado com a data real da última pesagem, de forma consistente com o Notion.
- [ ] `__tests__/services/NotionExportService.test.ts` passa a importar e exercitar
      `exportSessionMarkdown` / `exportWeeklyReport` (greenfield — hoje não há cobertura).
- [ ] Exports deixam a unidade e a proveniência inequívocas para um terceiro (os relatórios vão
      para professores).

## Fora de escopo

Nenhuma mudança em `finishSession` — isso é escopo da #147. Esta issue cobre apenas os
consumidores do valor.




# 150: [Perf][P3] Caminho de undo ainda lê exercises a cada undo — fora do budget test da #130
https://github.com/BenedettiLucca/iron-log/issues/150

## Contexto

A #130 foi fechada como `FECHADA-EM-CODIGO`: `hooks/use-exercise-sets.ts` foi separado em
`loadStructure()` (`:291-336`, as duas queries estruturais) e `refreshSessionSets()`
(`:338-425`, só sets), e save/edit/delete pararam de reconsultar `exercises` /
`routine_exercises`. O budget test `__tests__/hooks/exercise-sets-query-budget.test.ts`
garante 0 queries estruturais por mutação.

Ressalva: a verificação cobriu os caminhos de save/edit/delete, **não o caminho de undo**.

## Residual

`hooks/use-session-undo.ts` tem o seu próprio `refreshSessionSets` local (`:50`):

- `handleUndo` (`:105`) lê `exercises` **a cada undo**, para reescrever `currentName`.
- `handleRestoreDeleted` (`:62`) pode ler `routine_exercises` quando a lista de sets do escopo
  volta vazia.

Nenhum dos dois é coberto pelo budget test da #130, que só exercita
`handleSaveSet` / `handleDeleteSet` / `handleSaveEditedSet`.

## Pergunta a responder antes de codar

Undo/restore são hot path o suficiente para justificar remover essa leitura? O nome do
exercício normalmente já está em `currentName`, então a leitura pode ser redundante — mas isso
precisa ser provado, não assumido.

## Critérios de aceite

- [ ] O budget test passa a cobrir undo e restore, com contagem de queries estruturais.
- [ ] Ou a leitura em `use-session-undo.ts:105` é removida por ser redundante, ou existe
      justificativa explícita para ela continuar.
- [ ] Comportamento de `currentName` e de `routineExerciseId` na recuperação permanece idêntico
      (há cobertura existente em `__tests__/screens/session-recovery-navigation.test.tsx`).

## Nota de processo

A #130 foi fechada assumindo o budget test como cobertura suficiente. Esta issue existe para
registrar o que aquele teste **não** cobre, em vez de deixar um gap silencioso.






# 151: [Tests][P2] NotionExportService.test.ts não importa NotionExportService — frontmatter e relatório semanal sem cobertura
https://github.com/BenedettiLucca/iron-log/issues/151

## Problema

`__tests__/services/NotionExportService.test.ts` tem 71 linhas e **não importa
`NotionExportService`**. A suíte importa e testa apenas `buildSessionVerdictsMarkdown`, que vem
de `src/utils/session-verdict-markdown.ts`.

Consequência: nenhum teste exercita `exportSessionMarkdown` nem `exportWeeklyReport`. O
frontmatter emitido por `services/NotionExportService.ts:63-72` — incluindo a linha
`body_weight:` em `:69` — nunca foi validado por suíte. O mesmo vale para o relatório semanal
(`:114-260`), cujo agregado de volume/sRPE (`:180-192`) e a listagem por sessão (`:225`) também
não têm cobertura.

Isso é a mesma classe de dívida que a #123 cobriu (suítes que não exercitam o código de
produção), pelo lado oposto: aqui a suíte existe e é verde, mas não cobre o módulo que o nome
do arquivo sugere.

## Impacto

- Falsos positivos: o arquivo de teste passa sem testar o serviço.
- Regressões em `NotionExportService` não quebram nada.
- A #147 vai alterar a linha `body_weight:` justamente no código sem cobertura.
- A #148 vai mover o bloco de vereditos para fora do Markdown principal — também sem rede.

## Sugestão

Nova suíte de integração com SQLite real (`__tests__/fixtures/database`, como
`__tests__/services/csv-export.test.ts` e `alexandria-export.test.ts` fazem), mockando apenas
`expo-sharing` / `expo-file-system` como boundaries:

- `exportSessionMarkdown`: frontmatter completo, presença/ausência de vereditos,escape de CSV/
  Markdown em `routineName` e `notes`, linhas de série.
- `exportWeeklyReport`: agregar de volume e sRPE, `sRPE` ausente, sessão sem sets, ordenação
  dentro da janela, formatação de data local (`formatDateBR`).

## Critérios de aceite

- [ ] A suíte importa `NotionExportService` e exercita `exportSessionMarkdown` e
      `exportWeeklyReport` contra SQLite real.
- [ ] Alterar a implementação do frontmatter ou do relatório semanal **quebra** a suíte.
- [ ] Se #147 e #148 forem entregues antes ou junto, a nova suíte precisa cobrir a discriminação
      de peso emprestado e a separação log/avaliação.

## Fora de escopo

Não é preciso cobrir 100% do serviço de uma vez. O mínimo é o caminho feliz do frontmatter mais
a discriminação que a #147/#148 introduzirem.



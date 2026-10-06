# IL-70/72 — Alexandria Inbound Contract (Read-Only)

> **Status:** research + typed adapter. NO UI, NO settings, NO live calls with real
> personal data in this slice.
>
> **Audience:** Issue #70 (nutrition) and #72 (readiness/sleep) owners. All claims
> are marked **VERIFIED** (from the Alexandria repo at
> `/home/lucca/Projects/alexandria`, pinned at `1c43cad`) or **UNVERIFIED**
> (design assumption requiring owner review; the issue's `/api/v1/health/nutrition`
> guess does not exist server-side today).

---

## 0. Summary

Alexandria is **not** a plain REST server: it is an MCP server (Deno + Hono +
`@hono/mcp`, Streamable HTTP) deployed as a Supabase Edge Function
(VERIFIED: `supabase/functions/alexandria/index.ts`). It exposes food/sleep
data as **rows in PostgreSQL** (`health_entries`, `health_summaries`), not as a
nutrition REST API. This slice therefore:

1. verifies the real row schemas (nutrition + sleep) from Alexandria source;
2. ships a typed fetch adapter (`services/alexandria-inbound.ts`) against an
   explicitly **UNVERIFIED** proposed REST surface, with zod-schemas that also
   validate the **VERIFIED** raw row shapes;
3. documents the gap (no server-side daily nutrition aggregate) for owner review.

---

## 1. What exists today (VERIFIED)

### 1.1 Transport & auth

| Concern | Fact | Source |
|---|---|---|
| Protocol | MCP over Streamable HTTP (`Deno.serve(app.fetch)`) | `alexandria/supabase/functions/alexandria/index.ts` (~L321–329) |
| Auth | Bearer token; `timingSafeEqual(keyProvided, MCP_ACCESS_KEY)` | `index.ts`; `.env.example` (`MCP_ACCESS_KEY=generate-a-random-secret-here`) |
| Client identity | `x-alexandria-client` header (falls back to UA, `'unknown'`) | `index.ts` |
| Owner gate | `ALEXANDRIA_OWNER_USER_ID` required; requests without an owner are rejected (fail-closed) | `index.ts` |
| OAuth discovery | `/.well-known/oauth-protected-resource`, `/-authorization-server`, `openid-configuration` | `index.ts` |

### 1.2 `health_entries` table (the raw signal source)

VERIFIED: `supabase/migrations/20260429160331_alexandria_schema.sql` (L88–108).

- `id UUID`, `user_id UUID`
- `entry_type TEXT` CHECK IN: `'sleep','exercise','heart_rate','steps','weight','water','nutrition','blood_pressure','stress','cycle','body_composition','personal_record','measurement_goal'`
- `timestamp TIMESTAMPTZ NOT NULL`, `duration_s INTEGER`
- `value JSONB DEFAULT '{}'`, `numeric_value NUMERIC`
- `tags TEXT[] '{}'`, `source TEXT DEFAULT 'health-connect'`, `external_id TEXT`, `created_at`

### 1.3 Nutrition row shape (VERIFIED)

VERIFIED: `alexandria/importers/health-connect/import_health_connect.py`
(NUTRITION_CONFIG / WATER_CONFIG, sprint-2 dedup, commit `31d87ed`).

| Field | Meaning |
|---|---|
| `entry_type` | `'nutrition'` |
| `tags` | `['nutrition']` |
| `value` (JSONB) | `{ energy_kcal: float, protein?, fat_total?, carbs_total?, fiber?, sugar?, sodium?, caffeine? }` — each macro/extra key present only when non-null |
| `numeric_value` | energy kcal (`extract_numeric` from `energy|calories|energy_total`) |
| `external_id` | `sha256("hc-nutrition-{start_time|time}")` |
| `get_timestamp` | `start_time|time` |

Water handled similarly (`entry_type='water'`, `value.volume_ml`).

### 1.4 Sleep row shape (VERIFIED)

- `entry_type='sleep'`; raw `duration_s` is **seconds** (INTEGER).
- Daily aggregation in `compute_daily_summary`
  (VERIFIED: schema.sql L391–509) folds sleep as
  `SUM(COALESCE(duration_s, value->>'duration_s', 0))`, stores
  `ROUND(total/3600, 2)` into `health_summaries.sleep_total_hours` and
  session count into `health_summaries.sleep_sessions`.
- So: raw seconds in `health_entries`, hours in `health_summaries`.

### 1.5 `health_summaries` table (VERIFIED)

VERIFIED: schema.sql L132–149. Columns: `date DATE`, `sleep_total_hours NUMERIC`,
`sleep_sessions INT DEFAULT 0`, `steps_total INT`, `steps_active_minutes NUMERIC`,
`hr_avg/min/max NUMERIC`, `hr_samples INT`, `weight_kg NUMERIC`,
`exercise_count INT`, `exercise_total_minutes NUMERIC`, `exercise_types TEXT[]`,
`workout_count INT`, `training_volume_kg NUMERIC`, `training_types TEXT[]`,
`sources TEXT[]`, `computed_at`.

**No kcal/macros columns → there is no server-side daily nutrition aggregate.**
Confirmed by `HealthSummaryRow` (types.ts L99–119) and
`formatDailyHealthSummary` (lib.ts L798–837), which formats sleep/steps/HR/
weight/exercise/training but **no nutrition**.

### 1.6 MCP tools surface (VERIFIED)

VERIFIED: `supabase/functions/alexandria/tools/health.ts`.

- `query_health` — `entry_type?`, `days?`, `limit` default 20 cap 100, ISO
  `event_from`/`event_to`. Returns **free text** lines:
  `[timestamp] type  [numeric_value]\n {value JSON}` (not JSON).
- `health_summary` — `days` default 7, `from`/`to` `YYYY-MM-DD` validated by
  `/^\d{4}-\d{2}-\d{2}$/`, `limit` cap 100 max 365. Reads `health_summaries`.
- `refresh_summary` — calls `alexandria_priv.compute_daily_summary` RPC.
- `source_coverage_report`, `coverage_transition_report` — coverage lanes:
  `workouts, sleep, steps, heart_rate, weight` (**no nutrition lane yet**;
  VERIFIED `20260702010000_add_compute_source_coverage.sql`). Statuses:
  `current / late / summary_stale / missing / never_seen`.

---

## 2. The gap (VERIFIED facts → owner decision)

1. Issue #70's guess `GET /api/v1/health/nutrition` **does not exist** in the
   Alexandria repo (no matching route anywhere — VERIFIED by grep).
2. Nutrition exists only as raw `health_entries` rows; the MCP `query_health`
   tool returns free text, and iron-log cannot run the MCP Streamable HTTP
   protocol without an MCP client — hence a small HTTP adapter is the right
   iron-log-side shape.
3. **Recommended options for the owner:**
   - **A (adopted by this slice):** Alexandria exposes a thin REST façade
     (Edge Function) returning daily nutrition/sleep per date. iron-log calls it.
     Endpoints below are **UNVERIFIED** until Alexandria implements them.
   - **B:** Direct Supabase PostgREST on `health_entries` (needs `service_role`
     key — high privilege, not preferred).
   - **C:** iron-log aggregates raw rows fetched per day — N+1 and no server
     aggregate; only sensible if Alexandria never adds an endpoint.

---

## 3. Proposed REST surface (UNVERIFIED — owner review)

Auth for all: `Authorization: Bearer <MCP_ACCESS_KEY>`; optional
`x-alexandria-client: iron-log`. Dates are `YYYY-MM-DD` (matches Alexandria's
`health_summary` dateRegex).

| Endpoint | Method | Query | Success 200 body | Notes |
|---|---|---|---|---|
| `/api/v1/health/nutrition` | GET | `date=YYYY-MM-DD` | `{ "date": "2026-10-05", "value": { "energy_kcal": 2456.5, "protein": 182.3, ... } }` | `value: null` (or 404) ⇒ no data that day |
| `/api/v1/health/sleep` | GET | `date=YYYY-MM-DD` | `{ "date": "2026-10-05", "value": { "duration_s": 28800, "sessions": 1 } }` | duration in **seconds**; 404 ⇒ no data |

Error taxonomy (adapter, VERIFIED in code/tests):

- HTTP `404` / `410` ⇒ `{ status: 'unavailable', reason: 'no-data' }`
- HTTP `401`/`403`/`5xx` ⇒ `{ status: 'error', error: <HTTP code> }`
- Invalid JSON / zod parse failure ⇒ `{ status: 'error', error: '... malformed ...' }`
- Timeout (AbortController, default `8000ms`) ⇒ `{ status: 'error', error: '... timed out ...' }`
- **Never** silently-green: no-data is `unavailable`, not `ok`.

### 3.1 Adapter normalization (camelCase)

- `nutritionValueSchema`: `energy_kcal` (required, non-negative finite);
  `protein`, `fat_total`, `carbs_total`, `fiber`, `sugar`, `sodium`, `caffeine`
  (optional, non-negative finite).
- `DailyNutrition`: `{ date, energyKcal, protein?, carbs?, fat?, fiber?, sugar?, sodium?, caffeine? }`
  (`carbs_total → carbs`, `fat_total → fat`).
- `sleepValueSchema`: `{ duration_s (required), sessions? }`.
- `SleepSignal`: `{ date, durationSeconds, sessions? }`.

---

## 4. Freshness SLA (proposal — owner review)

| Signal | Source | Freshness expectation | Confidence |
|---|---|---|---|
| Nutrition (today) | Alexandria `import_nutrition` dedup (sprint 2) | Health-Connect sync cadence; recommend **T+1 day** best-effort vs same-day. | Medium — pipeline in flight |
| Sleep (today) | `health_summaries.sleep_total_hours` (via compute RPC) | **Daily** after `refresh_summary`. Recommend T+1, with `source_coverage_report` `current` status as the canary. | High |
| No-data | — | Never defaults to green; surfaced as `unavailable` so the training screen can show "no data yet" instead of a fake 0. | — |

Proposed iron-log fetch policy (future UI slice, OUT OF SCOPE here): daily query
at app boot, cached in Zustand, cache keyed by `date`; refetch on foreground.
Re-uses the issue #68 `useAsyncAction` error-localization pattern.

---

## 5. UNVERIFIED list — needs Alexandria owner sign-off

- **U01** — No REST façade exists today; `/api/v1/health/nutrition` and
  `/api/v1/health/sleep` are **proposed**, not confirmed.
- **U02** — Exact success envelope `{ date, value }` and `value: null`
  convention are assumptions; alternative is HTTP `204` for no-data.
- **U03** — Whether nutrition should be aggregated server-side
  (health_summaries columns / a daily RPC) or served as client-aggregated raw
  rows is an open architecture question.
- **U04** — Base URL / routing for the façade (same Edge Function, path-prefix
  routing?) and whether the MCP transport and the REST façade can share one
  access key.
- **U05** — Timezone for "the current day" when computing `date=` (Alexandria
  side vs iron-log side). Adapter treats the date as opaque `YYYY-MM-DD`.
- **U06** — `sessions` field not currently produced for nutrition; sleep
  `sessions` from `health_summaries.sleep_sessions` is per-day. Confirm source.
- **U07** — Fake/OAuth discovery endpoints imply a gateway may terminate auth;
  verify whether the Bearer key is valid at the façade directly.

---

## 6. This slice’s deliverables

- `services/alexandria-inbound.ts` — typed fetch adapter (zod v4), no `any`,
  no RN imports (runs in jest node env); union result states.
- `__tests__/services/alexandria-inbound.test.ts` — 27 tests, mocked `global.fetch`,
  embedded fixtures, zero network.
- This doc.

Gates run (worktree `/home/lucca/Projects/iron-log-wt/il70-72`, branch
`epic/il-70-72-health`, base `9c0b808`): typecheck, lint (max-warnings 0),
focused jest — see completion report.
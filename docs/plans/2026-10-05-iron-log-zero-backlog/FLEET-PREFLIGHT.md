# Fleet preflight — reconciled operational appendix

**Authority:** PLAN.md section2.1 and this reconciliation supersede stale claims in the child snapshot reproduced below. Help/catalog checks are not model inference or verified quota availability.

- Parent `agy models` readback after delegation lists `claude-sonnet-5-5-low`, `claude-sonnet-5-5-medium`, `claude-sonnet-5-5-high`. Sonnet5.5 is selectable; earlier4.6-only conclusion is stale. No max selector or working inference was verified. Gemini selector remains `gemini-3.8-flash-high`.
- Parent `opencode models` again exited0 with empty stdout; MiMoV2.6Flash identity remains unresolved. Do not use configured combo default as MiMo or count it as independent capacity.
- Parent `omp models --json` confirms `omniroute/oc-executor-free` and separately `xai-oauth/grok-4.6`; child combo DB audit has no Grok leg. Current14-leg alias contains opaque/free/unapproved checkpoints, so it is not yet a strict-cap roster-compliant route. Per-lane authorized restriction/pinning or complete identity-aware admission is required; never rewrite global provider settings silently.
- GLM5.3Flash is the requested **conductor model**, not an instruction to use ZCode. Verify that exact checkpoint in whichever tool-capable runtime Lucca chooses. A missing ZCode headless CLI does not forbid GLM execution elsewhere.
- The new local plan directory mentioned below was created by the parent in this planning task; it is not an unexplained external mutation. All pre-existing dirty files were preserved.
- Runtime approval modes below are plan-only examples. An unattended *implementation* lane needs an explicitly authorized bounded permission/sandbox policy; `always-ask` with no responding controller can stall. Implementers need scoped edit/test permissions; reviewers read production source and execute probes only in an isolated review checkout. No blanket unsafe approval merely to improve utilization.
- Research/pilot/implementation/review calls all consume actual-model capacity. Scope-dependent identity, quotas, model/route/account locks and process death must be verified before replacement dispatch.

### Updated selectable Sonnet syntax (planning only; not run)

```bash
agy --print --mode plan --output-format json --model claude-sonnet-5-5-high "<plan-only brief>"
```

For all authorized coding runs: inspect the current help once, set explicit worktree/cwd and permissions, pass the exact English package brief, and capture events/stderr/exit. Any flag/model mismatch makes that route unavailable and triggers the next competent preference; it does not freeze the whole fleet.

---

## Historical child read-only snapshot (retain provenance; see corrections above)

# Iron Log coding-harness and route-identity audit

**Snapshot:** 2026-10-05, 18:09 -03 (system clock)  
**Mode:** read-only. No model inference, code-lane dispatch, config change, repo write, or secret value was used in this audit.

## Decision summary

- **The policy ceiling is 12 primary sessions**, not 12 verified live lanes: six requested primary entries (AGY Gemini, AGY Claude, OMP, OpenCode, Cline, Cursor) × two concurrent sessions each, with implementation and review sharing those slots. AGY's two model families are separate counters. This is the canonical nominal cap; actual available concurrency cannot be asserted from current provider data.
- **The requested GLM 5.3 Flash orchestrator is not verified as a headless route.** `/usr/bin/zcode` is an Electron GUI wrapper (`zcode-bin 3.14.4-1`); its `--help` and `--version` both timed out after 12 seconds. Do not treat it as a CLI executor/orchestrator until a supported headless entry point and exact model ID are verified.
- **Live identity differs from the desired roster in several places:** AGY lists Claude Sonnet 4.6, not Sonnet 5.5; OpenCode's configured default is the same `omniroute/oc-executor-free` alias as OMP, not MiMo V2.6 Flash; and OMP's current chain has no Grok 4.6 candidate. Do not silently substitute a similarly named model.
- **Ready identity evidence:** AGY `gemini-3.8-flash-high`; Cline `cline-free/deepseek-v4.1-flash`; Cursor `auto` (but effective model is dynamic); Codex config `gpt-5.6-luna` with `model_reasoning_effort=max` (fallback only). OMP's alias is present, but it can fail over across 14 candidates and has no explicit per-provider concurrency cap in the connection metadata.
- **Do not count OMP and OpenCode as four independent slots in the current configuration:** OpenCode's configured default points at the same OmniRoute combo. OpenCode's own `models` listing returned no output in both normal and standalone modes, so its runtime model availability remains unverified.

The user's newer roster in the request is treated as the desired policy and overrides historical Sonnet 4.6 / Space Bunny labels in local notes. The live evidence below is kept separate from that intent.

## Scope and repository safety

Read-only checks included installed CLI versions/help, model catalog commands, a redacted OMP usage snapshot, allowlisted model/provider config metadata, a read-only/immutable SQLite query of OmniRoute metadata and call-log model fields, and host resource queries. No prompt was sent to a model.

Iron Log was left untouched. At audit start it was on `master` at `9c0b808d1c1e24ea9f3fbba611031cc5cfd5794b` (`origin/master`), with pre-existing dirty state: deleted `android/app/build.gradle` and untracked `.omh/` plus existing docs under `docs/plans/` and `docs/qa/`. Final status additionally showed untracked `docs/plans/2026-10-05-iron-log-zero-backlog/`, which was absent from the initial status snapshot; its origin is unknown and it was left untouched. No worktree, branch, or repo file was created or modified by this audit.

## Installed harnesses and identity evidence

| Harness | Installed version / state | Live identity evidence | Status against requested roster |
|---|---|---|---|
| AGY (`/usr/bin/agy`) | `1.2.16` | `agy models` lists `gemini-3.8-flash-high`, `gemini-3.8-flash-medium`, `gemini-3.8-flash-low`; settings label the default “Gemini 3.8 Flash (High)”. It lists `claude-sonnet-4-6`, not Sonnet 5.5. | Gemini route is selectable. Requested Claude Sonnet 5.5 is **not** present in this live list; do not substitute 4.6. No quota/capacity command was exposed by help/model listing. |
| OMP (`/usr/bin/omp`) | `18.6.2` (local skill still says 18.4.5) | `omp models --json` lists `omniroute/oc-executor-free`, context 128,000 / max output 32,000; `pricingStatus=unknown`. Also lists separate `xai-oauth/grok-4.6`. | The combo selector is valid, but it is a route alias, not a fixed backend model. Current backend chain differs from “mainly Agnes + Grok”. |
| OpenCode (`/usr/bin/opencode`) | `v2.0.23` | `~/.config/opencode/opencode.json` has default `model=omniroute/oc-executor-free`; an explicit model entry exists for `openrouter/stealth/space-bunny-alpha`. `opencode models` returned exit 0 with empty stdout, including `--standalone`. | MiMo V2.6 Flash is **not verified** by the current model listing/config. The configured default overlaps OMP's alias. Hold independent OpenCode capacity until its model list works and the requested model is selected/verified. |
| Cline (`/usr/bin/cline`) | `3.0.68` | Local settings (read through an allowlist; secret fields omitted) say provider `cline`, model `cline-free/deepseek-v4.1-flash`, reasoning enabled at `xhigh`. | Matches the requested DeepSeek V4.1 Flash identity. `cline --help` says auto-approve defaults to `true`; explicitly turn it off for a read-only/approval-gated dispatch. `cline config --json` itself failed headless with “interactive mode requires a TTY”; do not use that output as a quota source. |
| Cursor (`/usr/bin/cursor-agent`) | `2026.10.01-e373342`; authenticated | `--list-models` lists `auto - Auto (current, default)`, plus pinned IDs including `claude-sonnet-5-5-max` and `gpt-5.6-luna-max`. `status --format json` says authenticated. | `auto` is available but does not identify the serving model before/after a run. Require per-run effective-model evidence before counting it against a model-specific cap. No quota was exposed. |
| Codex (`/usr/bin/codex`) | `codex-cli 0.160.0` | Local `~/.codex/config.toml` selects `model=gpt-5.6-luna`, `model_reasoning_effort=max`. CLI help supports `codex exec --sandbox read-only` and `--model`; no model catalogue was exposed. | Consistent with the requested Luna Max *effort* label, but the service-side model identity was not independently listed. Keep fallback-only; do not rewrite the exact configured selector to `gpt-5.6-luna-max` based on Cursor's separate catalogue. |
| ZCode (`/usr/bin/zcode`) | Package `zcode-bin 3.14.4-1` | Executable is a shell wrapper that launches Electron. `zcode --help` and `zcode --version` each timed out after 12 seconds rather than returning CLI help/version. | Not a verified headless CLI; no exact GLM 5.3 Flash selector or safe dispatch command can be validated here. |

### Desired roster versus current route state

- **AGY Claude:** desired `Claude Sonnet 5.5`; current AGY catalog only returned `claude-sonnet-4-6`. The Sonnet 5.5 IDs visible in Cursor are Cursor IDs and must not be reused for AGY.
- **OMP:** `omniroute/oc-executor-free` exists, but it does not route mainly to Agnes + Grok in the current DB. A separate OMP `xai-oauth/grok-4.6` model exists; the combo itself contains no Grok 4.6 leg.
- **OpenCode:** desired MiMo V2.6 Flash is not currently confirmed. The default points to the shared `oc-executor-free` combo. Do not count it as an independent MiMo slot or as an OpenCode Zen fingerprinted MiMo route until `opencode models` returns a usable catalog and runtime identity is observed.
- **Cline:** current local selector exactly matches `cline-free/deepseek-v4.1-flash`.
- **Cursor:** `auto` exists and the CLI is authenticated, but `auto` is an alias. Its effective model must be captured per run.
- **Codex:** exact local selector is `gpt-5.6-luna` with max reasoning effort; Codex is fallback-only under the roster.
- **GLM:** the current OmniRoute combo has a `trouter/z-ai/glm-5.3-free` candidate (not Flash), and a recent call returned 503. That is not proof of the requested ZCode/GLM 5.3 Flash orchestration route.

## Current OMP / OmniRoute route details

The current local SQLite combo record for `oc-executor-free` was updated `2026-10-02T02:37:39.114Z`. It says `strategy=priority`, has 14 configured candidates, `maxRetries=0`, `targetTimeoutMs=300000`, `disableSessionStickiness=true`, `trackMetrics=true`, and `hedging=false`. The candidate set is known, but the served model can change between requests; use per-request rather than per-session identity accounting.

Current ordered configured `model` field values (opaque connection/provider IDs omitted):

1. `agnes/agnes-3.0-flash`
2. `tharbor/deepseek-v4-flash:free`
3. `trouter/z-ai/glm-5.3-free`
4. `orcarouter/orcarouter/free`
5. `openrouter/openrouter/free`
6. `nvidia/deepseek-ai/deepseek-v4-flash-0731`
7. `nvidia/meta/muse-glimmer-30b`
8. `opencode-zen/nemotron-3.5-lightning-free`
9. `nvidia/stepfun-ai/step-3.7-flash`
10. `opencode-zen/mimo-v2.5-free`
11. `nvidia/nvidia/nemotron-3.5-lightning-30b-a3b`
12. `bazaarlink/qwen/qwen3.7-flash:free`
13. `tharbor/mimo-v2.5:free`
14. `llama-cpp/lfm2-agentic` (local router; RTX 3060 Ti)

No candidate is `grok-4.6`. OMP's catalog labels the combo “OC Executor free (agnes chain)” but has unknown pricing status; a zero-cost catalog field is not a free-capacity guarantee.

The 20 most recent matching OmniRoute call-log rows included 8 Agnes 200s and one Agnes 429; two Token Harbor DeepSeek V4 Flash 429s; one TokenRouter GLM 5.3 Free 503; one OrcaRouter 402; and OpenRouter Free 6 200s plus one 502. The newest recorded request was `agnes-3.0-flash` 200 at `2026-10-04T03:13:18.355Z`. These are historical observations, not a health or quota guarantee for the next request. The current provider-connection metadata had no configured `max_concurrent` value for these candidate connections; `bazaarlink` was inactive with `credits_exhausted` / 402.

`omp usage --redact` exposed only an XAI OAuth usage snapshot: its SuperGrok weekly credits and Grok Build weekly quota were both 100% used, with reset reported in 3d20h. This is a separate account snapshot, not a proven `oc-executor-free` leg; the active combo has no XAI candidate. OmniRoute's stored GLM/Codex quota snapshots were dated August 2026 and are stale, so they are not usable as current capacity numbers.

## Safe command patterns (syntax validated; none executed against a model)

Use a unique isolated worktree per coding lane. These examples are plan-only/read-only unless noted. Do not add broad auto-approval flags to make parallel runs easier.

### AGY Gemini (exact live model ID)

```bash
agy --print --mode plan --output-format json \
  --model gemini-3.8-flash-high "<plan-only brief>"
```

The `--print`, `--mode plan`, `--output-format`, and `--model` flags were present in `agy --help`; the model ID was in `agy models`. There is no verified equivalent for AGY Sonnet 5.5 in the current listing.

### OMP route (plan/research without tools)

```bash
omp --no-session --mode json --no-tools \
  --provider omniroute --model oc-executor-free -p "<plan-only brief>"
```

For an authorized code lane, the help-validated approval-gated form is:

```bash
omp --no-session --mode json --approval-mode always-ask \
  --cwd <ISOLATED_WORKTREE> --provider omniroute --model oc-executor-free \
  -p "<one atomic issue brief>"
```

Do not use `--auto-approve`/`yolo` by default. Capture the actual upstream model for every request from OmniRoute call logs; do not assume the combo alias is the serving model.

### Cline (exact current configured route; plan-only)

```bash
env SHELL=/bin/bash cline --plan --auto-approve false \
  --cwd <ISOLATED_WORKTREE> --provider cline \
  --model cline-free/deepseek-v4.1-flash --json "<plan-only brief>"
```

`--plan`, `--auto-approve`, `--cwd`, `--provider`, `--model`, and `--json` were in `cline --help`; model/provider were confirmed in local settings. `SHELL=/bin/bash` follows the fleet skill's headless Cline workaround. The CLI's normal default is auto-approve enabled, so retain the explicit `false`.

### Cursor Auto (read-only; identity remains dynamic)

```bash
cursor-agent --print --mode plan --model auto \
  --workspace <ISOLATED_WORKTREE> "<plan-only brief>"
```

The exact `auto` selector and `--mode plan` were in `--list-models`/`--help`. Do not add `--force`/`--yolo` to a plan run. If an implementation run later needs shell approval, treat that as a separate authorization and preserve the worktree boundary.

### Codex fallback (read-only; configured model and max effort)

```bash
codex exec --sandbox read-only --model gpt-5.6-luna \
  --cd <ISOLATED_WORKTREE> "<plan-only brief>"
```

`exec`, `--sandbox read-only`, and `--model` were in `codex exec --help`; `gpt-5.6-luna` and max effort are local config metadata. Keep this fallback-only. Do not pass a guessed `-max` suffix to Codex.

### OpenCode and ZCode

- OpenCode help validates `opencode run --model <provider/model#variant> --format json`, but its model listing was empty and its config default is the shared `omniroute/oc-executor-free` alias. **No model-specific OpenCode command is dispatch-ready** until its catalog and requested MiMo route are verified. The current alias is configuration evidence only.
- ZCode returned no CLI help/model list and launches Electron. **No safe headless ZCode/GLM command can be supplied from the installed interface.**

## Capacity, quota, and resource limits

1. **Roster policy:** at most two concurrent sessions per primary entry, counting implementers and reviewers. Six entries imply 12 nominal agent sessions, with AGY split as two independent family counters (Gemini 0–2, Claude 0–2). Codex and ZCode are fallback-only; GLM orchestration is not a coding lane.
2. **Not a verified live maximum:** AGY Sonnet 5.5 is absent; OpenCode and OMP currently share an alias; Cursor Auto is dynamic; OMP can change upstream per request; several providers expose no `max_concurrent`; and current quota endpoints do not reveal enough to prove a larger safe bound. The actual maximum dispatchable lane count is therefore **unknown and may be below 12**.
3. **Do not oversubscribe shared identity:** count actual model/provider use across aliases and harnesses. Until OpenCode is pinned away from OMP's combo, treat the shared combo as one two-session bucket, not four. If a route's effective candidate set cannot be observed, do not count it as an independently capped model slot.
4. **Provider capacity is volatile:** live OMP usage only showed XAI at its weekly limits; local OmniRoute connection concurrency fields were null; several recent combo legs returned 402/429/503/502. No live usage/quota command was found for AGY, Cursor, Cline, or Codex. Model-list availability and 0-cost labels do not establish rate-limit capacity.
5. **Historical benchmark is not transferable:** the 2026-09-28–30 benchmark reported OMP + old `oc-executor-free` at 81% / 346K tokens / 99s, and OpenCode + MiMo V2.6 Flash Free at 69% / 207K / 126s. The current OMP combo changed, OpenCode route identity is unverified, and harness versions changed; keep these as historical reference only, not current model rankings or concurrency guarantees.
6. **Host snapshot:** 16 logical CPUs (AMD Ryzen 7 5800X3D), 31 GiB RAM with 22 GiB available; swap 3.4 GiB in use. NVIDIA GeForce RTX 3060 Ti: 8 GiB VRAM total, 925 MiB used, about 7.1 GiB free at query time. The OMP combo's last candidate is local `llama-cpp/lfm2-agentic`, so local fallback sessions may contend for this VRAM. No multi-session load test was run; hardware numbers do not establish safe local concurrency.

## Recommended GLM-led scheduler plan (for a separately authorized execution phase)

1. **Gate the orchestrator first.** Do not launch planning through ZCode until its supported non-interactive interface, exact `GLM 5.3 Flash` selector, effective-model receipt, and quota source are verified. The current `trouter/z-ai/glm-5.3-free` OmniRoute candidate is a different model label and has a recorded 503; it is not a substitute.
2. **Build a route registry from live evidence before dispatch:** harness/version, requested selector, effective-model evidence source, provider/account quota bucket (identifier redacted), session cap, current quota timestamp, safe sandbox/approval mode, and whether the route is pinned or dynamic. Mark AGY Sonnet 5.5 and OpenCode MiMo V2.6 as blocked until their exact IDs appear in their own model catalogs. Mark Cursor Auto as dynamic until it reports the effective model per run.
3. **Use work-conserving admission control.** Track the six primary counters with 0–2 sessions each, including reviews; separately cap every actual provider/model across aliasing harnesses. Assign only ready, independent issue scopes, and have a single writer for each shared file/seam. Do not wait globally for a preferred route or quota reset when another eligible slot is free.
4. **Issue one atomic task per isolated worktree/branch.** Before execution, the authorized planner must inventory issue bodies/comments, current remote SHA, overlaps/dependencies, exact paths, acceptance gates, and shared seams. A planning request does not authorize implementation. Branch-only delivery; no PR/merge/deploy/issue closure without separate authorization.
5. **Plan review capacity with the same counters.** Every implementation requires an adversarial review by a different coding agent/model where possible. A reviewer consumes a normal session slot. Maximize throughput by pairing workers and reviewers across independent identities and keeping ready work queued; never let a reviewer exceed the model's two-session cap.
6. **Treat each failover as a route change.** A 402/429/5xx, timeout, or changed provider/model should emit an attempt record. Recompute actual-model counters before more work is admitted. Do not let an `auto` or combo route silently consume a new model's capacity. If actual identity is absent, mark the lane `identity=unknown`, stop counting it as compliant, and hold further dispatch on that route.
7. **Final lane acceptance:** gates must be exercised, an independent reviewer must report `PASS` with `findings: []`, and the approved remote SHA must equal the reviewed local SHA. Fixes invalidate prior review of changed bytes; integrated branches need union gates and another independent review.

## Failover and completion receipt requirements

Record one receipt per lane plus one attempt record per actual model request/fallback. At minimum:

- `run_id`, issue/scope, branch/worktree, base SHA, harness and exact CLI version;
- requested selector, requested effort/profile, route kind (`pinned`, `auto`, or `combo`), and model identity evidence source;
- for every attempt: timestamp, attempt number, provider ID, **effective model ID**, combo name/step ID if applicable, HTTP/status or exit code, duration, usage tokens, error class/status, and fallback reason;
- quota/capacity snapshot timestamp and source, redacted account bucket, active slot count before/after, configured cap, and whether the model/provider bucket is shared with another harness;
- changed paths, diff/commit IDs, gate commands with exit codes and skips, and remote branch SHA;
- reviewer harness/model, reviewed SHA, adversarial findings, fixes/rereview, and final `PASS` / `findings: []`.

For OMP, use its JSON events for usage and OmniRoute `call_logs` fields such as `timestamp`, `requested_model`, `model`, `provider`, `status`, `duration`, token counters, `combo_name`, and `combo_step_id` to identify the actual upstream. For Cline, preserve the final `run_result` usage; for Cursor and Codex, preserve structured result/event metadata; for AGY/OpenCode, preserve their structured output and separately resolve the effective provider/model. Never include API keys, auth tokens, raw credential payloads, or unredacted account IDs in receipts. A combo/Auto receipt that cannot resolve actual model identity is incomplete and cannot prove cap compliance.

## Verification commands and sources

- Read-only CLI evidence: `agy --version`, `agy --help`, `agy models`; `omp --version`, `omp --help`, `omp models --json`, `omp usage --redact`; `opencode --version`, `opencode run --help`, `opencode models` and `opencode models --standalone`; `cline --version`, `cline --help`; `cursor-agent --version`, `cursor-agent --help`, `cursor-agent --list-models`, redacted `cursor-agent status --format json`; `codex --version`, `codex --help`, `codex exec --help`; ZCode `--help`/`--version` timeouts.
- Config metadata was extracted through allowlisted fields only from OMP models, OpenCode, Cline, AGY, Cursor, and Codex config files; credential-bearing fields were omitted. OmniRoute SQLite was opened read-only/immutable and queries excluded credential, account, raw request/response, and token fields.
- Canonical policy source: `/home/lucca/.hermes/OPERATIONS.md` and `coding-agent-fleet/references/canonical-development.md`; historical performance source: `/home/lucca/Experiments/harness-eval-2026-09-23/RESULTADO-FINAL.md`.

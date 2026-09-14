# Iron Log — Agent & Developer Quality Assurance Workflow

This document establishes the official testing, verification, benchmarking, and QA runbook protocol for agents and developers working on Iron Log.

---

## 1. Toolchain & Environment Specifications

- **Node.js**: `v22.22.2` (pinned via `.node-version`; engine requirement `>=22.22.2 <23.0.0`)
- **npm**: `10.9.7` (enforce with `npx --yes npm@10.9.7 <command>`)
- **Framework**: Expo SDK 54 / React Native 0.76+ (New Architecture enabled)
- **Database**: SQLite via Drizzle ORM (host test environment uses `better-sqlite3`; device uses `expo-sqlite`)
- **Worktree Isolation**: Always operate in an isolated git worktree with dedicated `node_modules`. Never share mutable state or work in main checkout without branch review.

---

## 2. Testing Layers & Verification Hierarchy

Understanding the boundary of each test tier avoids false confidence and brittle test mocks:

1. **Host Unit Tests (`__tests__/**/*.{test,spec}.{ts,tsx}`)**:
   - Run in Node/Jest with jsdom / react-native mock environment.
   - Test pure business logic, formatters, state reducers, and isolated components.
   - Automated coverage thresholds (`npm run test:coverage`) enforce utility coverage (`src/utils/**/*.{js,jsx,ts,tsx}`) rather than total codebase coverage; other areas rely on targeted contract, service, and screen suites.
2. **Host Database Integration (`__tests__/services/*-database.test.ts`)**:
   - Uses in-memory SQLite (`better-sqlite3`) initialized via synthetic DDL identical to `src/db/schema.ts`.
   - Foreign key constraints enabled (`PRAGMA foreign_keys = ON`).
   - Validates multi-table queries, transactions, soft-deletion semantics, and aggregation loops.
   - Note: Host SQLite compiles with `-DSQLITE_DQS=0` (double-quoted strings as identifiers only).
3. **Hermes Bundle Export (`npm run export:android && npm run verify:android-export`)**:
   - Generates production Android bytecode bundle via Metro and Hermes (`.hbc`).
   - Validates that no Node-only imports, unresolvable platform dependencies, or asset path syntax errors reach native runtime.
4. **Device / Emulator E2E (Agentic QA on AVD)**:
   - Actual native Android execution on the dedicated AVD via `scripts/qa.sh` (see §7).
   - Exercises real Android SQLite (`expo-sqlite`), Android notification channels, Haptics, and background task resumption.
   - Interactive/exploratory layer runs through the `device-mcp` MCP server (structured UI tree, semantic taps, screenshots, logcat, Hermes CDP); deterministic regression runs through Maestro flows in `.maestro/`.

---

## 3. Fast & Full Verification Gates

### Focused / Iterative Development Loop
```bash
# Typecheck TypeScript
npx --yes npm@10.9.7 run typecheck

# Lint (displays warnings without hiding output)
npm run lint

# Note: Strict zero-warning enforcement (npx expo lint --max-warnings=0) is tracked until pre-existing root warnings are cleared in T04.
# Run a single focused test file
npx --yes npm@10.9.7 run test -- __tests__/services/analytics-database.test.ts --watchAll=false
```

### Complete Verification Pipeline (`npm run verify`)
The unified `npm run verify` script chains all mandatory quality gates:
```bash
npm run verify
```
This executes sequentially:
1. `npm run typecheck` (`tsc --noEmit`)
2. `npm run lint` (`expo lint`)
3. `npm run test:coverage` (`jest --coverage` — enforces utility coverage on `src/utils/**/*.{js,jsx,ts,tsx}`; this is utility coverage, not total codebase coverage; `--runInBand` is not passed here and remains reserved for benchmarks)
4. `npm run export:android` (`expo export --platform android --max-workers 1 --output-dir dist`)
5. `npm run verify:android-export` (`node scripts/verify-android-export.js`)

### Security Gate (`npm run audit:high`)
```bash
npm run audit:high
```
- Validates that zero non-allowlisted high/critical vulnerabilities exist.
- Fails closed on npm error responses, registry unreachable, malformed envelopes, or unhandled advisories (#108).

---

## 4. Performance Benchmarks Protocol

Always measure real performance before and after algorithm or query changes. Never estimate or rely on unverified assumptions.

### Execution Command
```bash
IRON_LOG_BENCH=1 npx --yes npm@10.9.7 run test -- __tests__/services/analytics-database.test.ts --runInBand --watchAll=false
```

### Rules of Engagement:
- 3 independent trials required before modifying code (Baseline) and 3 independent trials after (Optimized).
- Minimum 25 samples per trial with warmups.
- Output metrics: median (ms), p95 (ms), dataset size (e.g. 50×20 and 500×20), and SHA-256 digest of serialized result.
- **Retention Criteria**: Retain optimization only if measurable latency gain exists in at least 2 of 3 trials, zero regression on smaller datasets, and 100% identical SHA-256 hash output.

---

## 5. Android Launcher & Device QA (`scripts/run-android.sh`)

### Environment Resolution
`scripts/run-android.sh` dynamically resolves the Android SDK:
1. Respects existing `$ANDROID_HOME` or `$ANDROID_SDK_ROOT` if exported.
2. Checks `$HOME/Android/Sdk`, `/opt/android-sdk`, and `$PWD/android-sdk`.
3. Verifies existence of `platform-tools/adb`. Fails closed if missing.
4. Supports `--dry-run` to test SDK and adb discovery without starting the emulator or app.

### Smoke Check:
```bash
./scripts/run-android.sh --dry-run
```

---

## 6. Manual QA Runbook & Privacy Protocol

When testing manually or on real devices/emulators:

1. **Synthetic Data Only**:
   - Never import, extract, or log real user personal health or training data.
   - Use synthetic routines, exercises, and timestamps.
2. **Safe Log Inspection**:
   - Inspect logcat filtering strictly by the application PID/tag:
     ```bash
     adb logcat -s IronLog:V Expo:V ReactNativeJS:V
     ```
   - Never run raw, unfiltered `adb logcat` dumps into files committed or shared externally.
3. **Standard Manual Test Sequence**:
   - **Start**: Create / select routine, start workout session.
   - **Log**: Complete 3 sets, verify timer and auto-rest trigger.
   - **Undo**: Delete / edit set 2, confirm re-indexing and UI consistency.
   - **Background & Resume**: Switch app to background for 30s, reopen, verify timer and state persistence.
   - **Finish & Save**: Finish workout, verify insertion into database and summary display.
   - **Export**: Export CSV/JSON, verify output structure.
4. **Device Confirmation**:
   - Prior to any destructive device command (`adb uninstall`, `pm clear`), verify connected target with `adb devices` to prevent touching user hardware.

---

## 7. Agentic Android QA (canonical issue → AVD → PR loop)

The full protocol lives in `docs/agentic-android-qa.md` (architecture, tool matrix, troubleshooting).
This section is the binding contract for agents.

### Canonical loop for any change touching `app/`, `components/`, `hooks/`, `services/`

```bash
scripts/qa.sh boot        # AVD up, waits on real boot condition (~25s with quick boot)
scripts/qa.sh build       # assembleDebug (skippable when APK is fresh)
scripts/qa.sh install     # install APK on AVD
scripts/qa.sh app         # ensure Metro (debug builds) + launch
scripts/qa.sh smoke       # Maestro suite — MUST pass before PR
scripts/qa.sh logs        # logcat (RN/crash) when investigating
scripts/qa.sh snap        # screenshot evidence into .qa-artifacts/
scripts/qa.sh reset       # pm clear between independent scenarios
scripts/qa.sh stop        # tear down
```

### Hard rules

1. **Static gates are necessary, not sufficient.** Green typecheck/lint/Jest does not close a UI/flow
   change; the AVD gate does. Device QA is a different validation level than host suites — report
   them separately, never as one.
2. **Snapshot before tap.** Drive interaction through accessibility labels (`device_tap_element`),
   coordinates only as last resort for unlabeled elements (e.g. the RN dev snackbar ✕).
3. **Evidence discipline.** A bug report without `qa.sh snap` + `qa.sh logs` + expected/actual is
   incomplete. Keep artifacts in `.qa-artifacts/` (gitignored); reference paths in the PR.
4. **uiautomator caveat.** Empty EditTexts report their **placeholder** as `value` — confirm field
   state by typing into it and re-snapshotting before claiming prefilled-value bugs.
5. **Explore, then canonize.** Valuable exploratory scenarios become Maestro flows. Never loosen an
   existing flow's assertion to make it pass — behavioral changes require explicit justification in
   the diff.
6. **device-mcp hygiene.** Snapshot helper trust is per-server-process (TOFU): never reinstall
   `io.metamask.devicemcp.snapshothelper` while MCP servers are live; recovery in
   `docs/agentic-android-qa.md` (Troubleshooting).

### Acceptance checklist (paste into task briefs)

- [ ] Host gates: `npm run typecheck && npm run lint && npm run test:coverage` (+ `audit:high` when deps change)
- [ ] `scripts/qa.sh boot && install && app` — feature exercised on AVD
- [ ] Happy path walked via `device-mcp` (semantic taps, snapshot-verified state transitions)
- [ ] ≥2 edge cases explored (empty input, invalid separator, interruption/backgrounding — as applicable)
- [ ] `scripts/qa.sh logs` reviewed for new warnings/crashes
- [ ] `scripts/qa.sh smoke` green (new scenario captured as flow when valuable)
- [ ] `git diff --check` clean; evidence referenced; validations that still depend on physical device/release build explicitly listed as open items


# Expo Doctor dependency triage — 2026-07-20

## Status

Initial triage was read-only. No dependency, lockfile or runtime code was changed during discovery.

Implementation approved afterward:

- Batch 0 — toolchain pin: `d6148ef`
- Batch 1 — Jest 29 alignment: `99d2b61`
- coverage collection fix: `f06e4ee`
- direct Drizzle security fix: `4c4acc1`
- non-breaking transitive security refresh: `dcfbc97`
- Tailwind/NativeWind build fix: `96b31a4`
- adjacent locale dependency fix: `a5ef1c8`

Security and CI remediation checkpoint evidence under Node `22.22.2` / npm `10.9.7`:

- clean `npm ci` succeeded;
- Jest dependency graph is valid and fully deduplicated on `29.7.0`;
- 61 suites / 651 tests pass;
- typecheck and lint pass with zero warnings;
- Expo compatibility check no longer reports Jest or `@types/jest`;
- coverage now collects the real `src/utils/**` production tree: 83.47% statements, 80% branches, 81.98% functions and 87.65% lines;
- the direct `drizzle-orm` identifier-injection advisory was fixed by updating `0.45.1` to `0.45.2`;
- all critical, high and low advisories with non-breaking fixes were removed. The general audit moved from 48 findings (including 2 critical and 14 high) to 23 moderate findings;
- every remaining audit finding requires a breaking Expo 57 migration or destructive `drizzle-kit` downgrade, so none was force-applied;
- production Android export succeeded across 2,743 modules and emitted an 8.59 MB Hermes bytecode bundle;
- the export exposed and verified a separate root cause: React Native shadow objects in `tailwind.config.js` were invalid Tailwind values, causing Metro to stop at 0/1 while falsely exiting zero. The shadow tokens now use Tailwind-compatible CSS strings and have a regression contract.

Baseline:

- branch: `feat/open-design-redesign`
- Sprint 4 code: `a1ade9f`
- Sprint 4 documentation/hygiene: `e7ad1ca`
- Jest: 59 suites / 642 tests passing before this audit
- Expo Doctor: 16/18 checks passing
- project toolchain observed by Hermes shell: Node `20.20.2` + npm `12.0.1` (unsupported combination)
- no `.node-version`, `.nvmrc` or `mise.toml` in the repository

## Executive recommendation

Do not run `npx expo install --fix` as a single batch. It would mix:

- eleven low-risk Expo patch updates;
- one native-module downgrade;
- a Sentry major migration with behavioral changes;
- a Jest major downgrade;
- an unrelated upstream duplicate-native-module fix.

That bundle would be hard to review and hard to roll back.

Do not change native dependencies before the pending Sprint 4 physical-device QA. The only batch that can safely proceed without changing the app under device QA is the Jest 29 alignment, after the Node/npm toolchain is corrected.

## Findings

### 0. Toolchain drift — blocker before any install

The automated shell currently resolves:

- Node `20.20.2`
- npm `12.0.1`

npm 12 declares support for Node `^22.22.2 || ^24.15.0 || >=26.0.0`; it warns on every npm command in the current shell. `fnm` is not available on the non-interactive shell PATH, although the workstation has fnm-managed Node versions outside this shell.

Risk: a dependency batch could rewrite `package-lock.json` under a toolchain combination that npm itself does not support.

Recommendation before implementation:

1. select an installed supported Node 22/24 release;
2. expose fnm in the Hermes/non-interactive shell or invoke the selected Node/npm with absolute paths;
3. pin the repository toolchain (`.node-version` or equivalent) in a separate commit;
4. verify `node --version`, `npm --version`, clean install behavior and unchanged tests before dependency edits.

### 1. Expo SDK 54 patch matrix — low semantic risk, native verification required

| Package | Current | Expo expected | Classification |
|---|---:|---:|---|
| `expo` | 54.0.33 | ~54.0.36 | patch |
| `expo-auth-session` | 7.0.10 | ~7.0.11 | patch |
| `expo-crypto` | 15.0.8 | ~15.0.9 | patch |
| `expo-file-system` | 19.0.21 | ~19.0.23 | patch |
| `expo-font` | 14.0.11 | ~14.0.12 | patch |
| `expo-image-picker` | 17.0.10 | ~17.0.11 | patch |
| `expo-linking` | 8.0.11 | ~8.0.12 | patch |
| `expo-notifications` | 0.32.16 | ~0.32.17 | patch |
| `expo-router` | 6.0.23 | ~6.0.24 | patch |
| `expo-updates` | 29.0.16 | ~29.0.19 | patch |
| `expo-web-browser` | 15.0.10 | ~15.0.11 | patch |

These are the versions returned by both `expo-doctor` and `npx expo install --check` for the installed Expo SDK.

Recommendation: one explicit Expo-patch commit after Sprint 4 device QA. Do not include Sentry, Jest, Calendar or DateTimePicker in this commit.

Required gates:

- `npm test -- --runInBand`
- typecheck, lint and diff-check
- `npx expo-doctor`
- Android JS export/bundle
- Expo Go smoke test of auth, image picker, notifications, routing, updates context and web browser
- release Android build before shipping

### 2. DateTimePicker — compatible downgrade, separate native batch

| Package | Current | Expo expected |
|---|---:|---:|
| `@react-native-community/datetimepicker` | 8.6.0 | 8.4.4 |

The project only uses basic supported props (`value`, `mode="time"`, `onChange`) in the supplements flow and the shared DatePicker tests mock the module. Version 8.4.4 declares Expo `>=52`, React `*` and React Native `*` peer compatibility.

Risk is moderate because this is a native-module downgrade, even though the used JS API is simple.

Recommendation: separate commit after the Expo patch batch. Device-check Supplements reminder time and every shared DatePicker call site on Android.

### 3. Jest 30 → Jest 29 — ecosystem alignment, runtime-neutral

| Package | Current | Expo expected / coordinated target |
|---|---:|---:|
| `jest` | 30.2.0 | ~29.7.0 |
| `@types/jest` | 30.0.0 | 29.5.14 |
| `babel-jest` | 30.2.0 | ~29.7.0 |
| `ts-jest` | 29.4.6 | keep |
| `jest-expo` | 54.0.17 | keep |

`npm ls` reports the current graph as invalid because `jest-watch-typeahead@2.2.1`, pulled by `jest-expo`, supports Jest 27–29 only. Expo's Jest 30 support remains in active upstream work; Expo SDK 54 is built against Jest 29.

Repository search found no test usage of Jest-30-only APIs. The current custom config uses `ts-jest` 29 and standard Jest APIs.

Recommendation: this is the only dependency batch that can proceed before physical Sprint 4 QA because it does not change runtime/native code. Downgrade `jest`, `@types/jest` and `babel-jest` together. Never downgrade only `jest`.

Required gates:

- `npm ls jest jest-expo jest-watch-typeahead ts-jest babel-jest @types/jest`
- 59/59 suites and 642/642 tests or higher
- coverage run
- typecheck and lint
- no runtime app/device QA required

### 4. Sentry 6 → 7 — defer as an explicit migration

| Package | Current | Expo expected |
|---|---:|---:|
| `@sentry/react-native` | 6.22.0 | ~7.2.0 |

The app uses:

- `Sentry.init`
- `Sentry.wrap`
- `Sentry.captureException`
- `Sentry.captureMessage`
- `tracesSampleRate`
- experimental `profilesSampleRate`

The simple capture APIs appear compatible, but Sentry's official migration guide explicitly warns that v7 includes JS SDK v9/v10 and Android SDK behavioral changes that typecheck, lint and unit tests will not catch. Removed/changed APIs include feedback, session-tracking options and tracing behavior; profiling configuration requires explicit verification.

Recommendation: do not hide this mismatch via `expo.install.exclude`. Keep it as a separate pre-release migration after Sprint 4 QA and after the Expo patch batch.

Required gates:

- read the complete Sentry 6→7 migration guide against `services/crash-reporting.ts` and native config
- update tests for initialization options
- Android release build with Sentry config
- verify one captured message and one handled exception in the intended Sentry project
- inspect release/source-map upload
- verify behavior with no DSN and in Expo Go

Source: https://docs.sentry.io/platforms/react-native/migration/v6-to-v7/

### 5. Duplicate `react-native-safe-area-context` — upstream fix available

Current graph:

- root `react-native-safe-area-context@5.6.2`
- nested `react-native-calendars@1.1313.0/node_modules/react-native-safe-area-context@4.5.0`

`react-native-calendars@1.1313.0` pins 4.5.0 as a direct dependency. Upstream confirmed it was unused and removed it in release `1.1314.0`. The project uses `Calendar` only in `app/(tabs)/history.tsx`; no Safe Area API from the calendar package is consumed directly.

Recommendation: upgrade Calendar `1.1313.0 → 1.1314.0` instead of adding an npm override. The release is the narrow upstream fix and also prevents a FlatList empty-data render. Avoid an override because it masks the package's incorrect native dependency declaration and carries unnecessary compatibility uncertainty.

Required gates:

- `npm ls react-native-safe-area-context react-native-calendars --all` shows one Safe Area version
- Expo Doctor duplicate-native-module check passes
- History calendar renders, date selection works and empty history remains correct on Android

Sources:

- https://github.com/wix/react-native-calendars/releases/tag/1.1314.0
- https://github.com/wix/react-native-calendars/pull/2755

## Proposed reversible sequence

### Batch 0 — toolchain pin

Repository-only toolchain declaration and verified supported Node/npm shell. No package updates.

### Batch 1 — Jest 29 alignment

Runtime-neutral. Can happen before Sprint 4 physical QA after Batch 0.

### Batch 2 — Calendar 1.1314.0

Fix duplicate native module. Wait for or combine with a dedicated device-QA window.

### Batch 3 — Expo SDK 54 patch matrix

Eleven explicit patch updates, one commit, no unrelated packages.

### Batch 4 — DateTimePicker 8.4.4

Separate native downgrade and focused Supplements/DatePicker QA.

### Batch 5 — Sentry 7.2 migration

Separate implementation plan, production-style Android build and real event verification.

## Decision — implemented

Batches 0–1 and the approved non-breaking remediation were completed in focused, independently reversible commits. The repository now has a reproducible toolchain, an Expo-compatible Jest graph, real coverage enforcement, no critical/high/low npm advisories, and a verified Android production export.

Batches 2–5 remain deferred until the Sprint 4 physical-device QA window because they change native or runtime dependencies:

- Calendar 1.1314.0;
- Expo SDK 54 patch matrix;
- DateTimePicker 8.4.4;
- Sentry 7.2 migration.

Do not use `npm audit fix --force`: the 23 remaining moderate findings require an Expo 57 migration or a destructive `drizzle-kit` downgrade and must be handled as explicit future migrations.

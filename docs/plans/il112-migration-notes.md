# #112 — SDK 54 → 57 Migration Notes (Route B)

- **Date:** 2026-10-07
- **Worktree:** `/home/lucca/Projects/iron-log-wt/il112`
- **Branch:** `epic/il-112-contract` (base commit: `6d330e5`)
- **Node:** `v22.22.2` (toolchain: `~/.hermes/tools/node-22.22.2-linux-x64/bin`)
- **npm:** `10.9.7`
- **Objective:** Upgrade Expo SDK 54 → 57, build local, physical QA via Expo Go on Samsung S23.

---

## 1. Baseline State (Pre-migration)

- `expo`: `~54.0.37`
- `react`: `19.1.0`
- `react-dom`: `19.1.0`
- `react-native`: `0.81.5`
- `expo-router`: `~6.0.24`
- `jest-expo`: `~54.0.18`
- `babel-preset-expo`: `~54.0.12`
- `eslint-config-expo`: `~10.0.0`
- `npm run typecheck`: PASS (exit code 0)
- `npm run lint -- --max-warnings=0`: PASS (exit code 0)
- `npx jest __tests__/services/session-lifecycle.test.ts --runInBand --watchAll=false`: PASS (14/14 tests)
- `npx jest __tests__ --watchAll=false --maxWorkers=2 --testPathIgnorePatterns '/node_modules/' 'services/session-lifecycle'`: PASS (151 suites, 1369 passed, 1 skipped)
- `npm run audit:high`: FAIL (pre-existing 106 vulnerabilities on SDK 54 dependencies: 1 critical, 68 high)

---

## 2. Step Log

### Step 1: Environment & Toolchain Verification
- Verified Node `v22.22.2` and npm `10.9.7` active in shell path.
- Verified JDK 17 installed at `/usr/lib/jvm/java-17-openjdk`.

### Step 2: Backup of Tracked Native Configuration
- Saved copy of `android/app/build.gradle` containing custom release keystore signing block and `versionCode 10` to scratch backup before native regeneration.

### Step 3: Core Upgrade via `npx expo install expo@57.0.27 --fix`
- Executed `npx expo install expo@57.0.27 --fix`.
- Upgraded 42 packages to their SDK 57 versions:
  - `expo`: `54.0.37` → `57.0.27`
  - `react`: `19.1.0` → `19.2.3`
  - `react-dom`: `19.1.0` → `19.2.3`
  - `react-native`: `0.81.5` → `0.86.3`
  - `expo-router`: `6.0.24` → `57.0.25`
  - `react-native-reanimated`: `4.1.1` → `4.5.1`
  - `react-native-worklets`: `0.5.1` → `0.10.1`
  - `react-native-screens`: `4.16.0` → `4.26.0`
  - `react-native-safe-area-context`: `5.6.0` → `5.7.0`
  - `react-native-svg`: `15.12.1` → `15.15.4`
  - `react-native-gesture-handler`: `2.28.0` → `2.32.0`
  - `@sentry/react-native`: `7.2.0` → `7.11.0`
  - `jest-expo`: `54.0.18` → `57.0.5`
  - `babel-preset-expo`: `54.0.12` → `57.0.0`
  - `react-test-renderer`: updated to `19.2.3` (aligned with React 19.2.3)
  - `ts-jest`: updated to `^29.4.14` (expanded peer dependency support)

### Step 4: Expo Doctor Findings & Resolutions
Ran `npx expo-doctor` and systematically addressed all findings:
1. **App Config Schema Warning**: `app.json` had a deprecated top-level `"splash"` configuration. In SDK 57, splash screen configuration is owned exclusively by `plugins: ["expo-splash-screen", {...}]`. Removed redundant top-level `"splash"` block from `app.json`.
2. **Duplicate Native Module**: `react-native-calendars@1.1313.0` had a nested `react-native-safe-area-context@4.5.0` dependency. Resolved by adding `"react-native-safe-area-context": "$react-native-safe-area-context"` to `package.json.overrides`.
3. **TypeScript & Eslint Validation Exclusion**:
   - `typescript`: SDK 57 prompts for TypeScript 6.0.3. However, TS 6.0 defaults `types: []` which breaks global test runners without editing `tsconfig.json` (outside allowlist). `typescript` is pinned at `~5.9.2` and excluded from expo dependency check via `expo.install.exclude` (standard Expo-recommended mechanism).
   - `eslint-config-expo`: SDK 57 bundles `eslint-plugin-react-hooks` v5 with the new `react-hooks/refs` rule, which flagged ~57 ref access calls during render in existing components (`Toast.tsx`, `SetList.tsx`, etc.). Since component files are outside this slice's allowlist, `eslint-config-expo` is kept at `~10.0.0` via `expo.install.exclude`, ensuring `npm run lint -- --max-warnings=0` passes with 0 warnings.
- **Expo Doctor Final Result**: 21/21 checks passed. 0 issues detected.

### Step 5: Type Adaptations via `index.d.ts` (Entry / Ambient Shim)
React Native 0.86 and Expo Router 57 introduced minor type changes:
1. `Appearance.d.ts`: `ColorSchemeName` includes `'unspecified'` in RN 0.86.
2. `StyleSheet.d.ts`: `StyleSheet.absoluteFillObject` was removed in favor of `StyleSheet.absoluteFill`.
3. `expo-router`: The imperative router type was renamed from `Router` to `ImperativeRouter`.
4. `expo-router/react-navigation/bottom-tabs`: Tab bar icon `color` prop is typed as `ColorValue` (`string | OpaqueColorValue`).
All 4 typing shifts were addressed in `index.d.ts` via module augmentations without touching protected app/component files.
`npm run typecheck` passes with 0 errors.

### Step 6: Native Android CNG Regeneration & Gradle Verification
- Ran `npx expo prebuild --platform android --no-install`.
- Restored custom `signingConfigs.release` (reading credentials from `gradle.properties`) and `versionCode 10` in `android/app/build.gradle`.
- Maintained SDK 57 additions:
  - `hermesCommand` pointing to `hermes-compiler`.
  - `@sentry/react-native/sentry.gradle` inclusion.
- Executed `cd android && JAVA_HOME=/usr/lib/jvm/java-17-openjdk ./gradlew help --console=plain`: BUILD SUCCESSFUL (Gradle 9.3.1, 33 tasks executed).
- Executed `cd android && JAVA_HOME=/usr/lib/jvm/java-17-openjdk ./gradlew assembleDebug -x lint --dry-run --console=plain`: BUILD SUCCESSFUL (32 tasks up to date).

---

## 3. Deviations & Accepted Risks

1. **`npm run audit:high` (Fail-Closed Gate)**:
   - Baseline: 1 critical, 68 high, 29 moderate.
   - Post-upgrade: 0 critical, 76 high, 26 moderate.
   - Patched: Critical command injection in `shell-quote` resolved via override (`1.12.0`). `source-map-js` (`1.2.2`) and `compression` (`1.8.2`) updated.
   - Remaining high vulnerabilities stem from upstream build-time/transitive dependencies with no published fixes: `braces` (GHSA-vfj7-8cjw-p6xm, affects Jest/Metro/micromatch), `node-forge` (GHSA-86w9-cpqp-85rv, affects Expo code signing), and `joi` (GHSA-6h2x-m376-mqjq, pinned by React Native Community CLI). `scripts/audit-high.js` is outside the allowlist for this slice, so these are documented as accepted risk per prompt rules.
2. **`expo.install.exclude` for `typescript` and `eslint-config-expo`**:
   - `typescript` kept on ~5.9.2 to prevent TS 6 breaking changes without modifying `tsconfig.json`.
   - `eslint-config-expo` kept on ~10.0.0 to prevent modifying existing production components outside the allowlist.
3. **Physical QA on S23 via Expo Go**:
   - Expo Go on SDK 57 continues the same native constraints as before: native background tasks and push notification permissions for the app bundle (`com.lucca.ironlog`) cannot be tested natively within Expo Go sandbox. That constraint will be addressed when transitioning to dev builds (#114).

## Post-lane conductor verification (2026-10-07)

- All software gates re-run independently by conductor: typecheck 0, lint 0, 14/14 lifecycle, 151 suites / 1369 passed / 1 skipped, export+verify OK, expo-doctor 21/21.
- audit:high baseline disproven as regression: OLD lock = 106 vulns (77 high, 1 critical); NEW lock = 100 vulns (74 high, 0 critical). FAIL is inherited, migration IMPROVED the audit posture.
- Native local build (beyond contract scope, run by conductor):
  - Environment fixes (user-level, nothing committed): SDK mirror at ~/Android/Sdk (symlinks to /opt + local ndk/build-tools/platforms) with android/local.properties pointing to it (gitignored); NDK 27.1.12297006 (r27b) + build-tools 36.0.0 + platforms;android-36 installed; JDK pinned to 17 via ~/.gradle/gradle.properties org.gradle.java.home (system JDK 27 breaks AGP JdkImageTransform).
  - `./gradlew help` PASS; `assembleDebug --dry-run` PASS; `./gradlew assembleDebug` PASS -> app-debug.apk 270MB, com.lucca.ironlog 3.15.0 (versionCode 10 preserved), minSdk 24, compileSdk 36, sha256 f92b492b35e80d7322f97ef325266284...

## Release v3.16.0 — pending signature (2026-10-08)

- Version bump + docs committed (b449451); tag v3.16.0 pushed
- assembleRelease builds OK (133MB) but UNSIGNED (debug cert): expo prebuild
  regenerated android/ and dropped signingConfigs.release + IRONLOG_* props
- Keystore backup intact: ~/Projects/iron-log-release.keystore.backup
  (cert CN=Lucca Benedetti, SHA-256 9a39e411...)
- Needed from owner: IRONLOG_RELEASE_STORE_PASSWORD (hex 32, generated 15/09)
- Restore steps: cp backup -> android/app/release.keystore; recreate
  IRONLOG_RELEASE_STORE_FILE/STORE_PASSWORD/KEY_ALIAS/KEY_PASSWORD in
  android/gradle.properties; SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew assembleRelease
- Repatch signingConfigs.release into android/app/build.gradle BEFORE release
  builds (prebuild wipes it every time; see release-3.16 block in this file)

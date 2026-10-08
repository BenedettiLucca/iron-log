# Atomic work packages and issue routing

All states are PLANNED. This is a decomposition, not runtime evidence. Every package completes after its gates and independent actual-SHA review; owner/external blockers stay open. No global wave barrier.

| Issue | Class / preferred route | Ordered fallback | Package chain | Owner decisions |
|---|---|---|---|---|
| #64 | C / AGY-G | AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX | 64-contract → 64-schema → 64-core → 64-wiring → 64-native | archive_selection |
| #66 | U / AGY-G | CLINE → OC-M → OMP → AGY-S → CURSOR → CODEX | 66-contract → 66-schema → 66-core → 66-wiring → 66-native | D6 |
| #67 | T / OMP | OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX | 67-contract → 67-schema → 67-core → 67-wiring → 67-native | D1, D2 |
| #70 | U / AGY-G | CLINE → OC-M → OMP → AGY-S → CURSOR → CODEX | 70-contract → 70-core → 70-wiring → 70-native | D10 |
| #72 | R / AGY-S | AGY-G → CLINE → OMP → OC-M → CURSOR → CODEX | 72-contract → 72-core → 72-wiring → 72-native | D9, D10 |
| #74 | T / OMP | OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX | 74-contract → 74-core → 74-wiring → 74-native | plateau_comparison |
| #75 | R / AGY-S | AGY-G → CLINE → OMP → OC-M → CURSOR → CODEX | 75-contract → 75-core → 75-wiring → 75-native | D9 |
| #79 | C / AGY-G | AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX | 79-contract → 79-schema → 79-core → 79-wiring → 79-native | D4, D5 |
| #80 | C / AGY-G | AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX | 80-contract → 80-core → 80-wiring → 80-native | D4 |
| #81 | C / AGY-G | AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX | 81-contract → 81-schema → 81-core → 81-wiring → 81-native | D4, D5 |
| #82 | C / AGY-G | AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX | 82-contract → 82-schema → 82-core → 82-wiring → 82-native | D7 |
| #95 | C / AGY-G | AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX | 95-contract → 95-schema → 95-core → 95-wiring → 95-native | D1 |
| #112 | N / AGY-G | CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX | 112-contract → 112-core → 112-wiring → 112-native | D11 |
| #114 | N / AGY-G | CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX | 114-contract → 114-core → 114-wiring → 114-native | execution authorization only |
| #136 | T / OMP | OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX | 136-contract → 136-schema → 136-core → 136-wiring → 136-native | D8 |
| #147 | C / AGY-G | AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX | 147-contract → 147-schema → 147-core → 147-wiring → 147-native | D3 |
| #148 | T / OMP | OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX | 148-contract → 148-core → 148-wiring → 148-native | D12 |
| #149 | T / OMP | OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX | 149-contract → 149-core → 149-wiring → 149-native | execution authorization only |
| #150 | T / OMP | OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX | 150-contract → 150-core → 150-wiring → 150-native | execution authorization only |
| #151 | T / OMP | OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX | 151-contract → 151-core → 151-wiring | execution authorization only |

Routes: AGY-G Gemini3.8Flash/high; AGY-S Sonnet5.5/high (max score not transferable); OMP qualified authorized Agnes/Grok checkpoint; OC-M MiMo2.6Flash (unverified); CLINE DeepSeek4.1Flash; CURSOR auto with complete identity guard; CODEX Luna5.6/max fallback only. Skip every unavailable/unqualified/cap-or-lock-blocked candidate.

## Per-package dependencies and acceptance actions

### 64-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 64-schema
**Goal:** Serialize additive SQL, actual migration journal/snapshot/Expo loader and fixture; fresh/previous-DB migration and fault probes; independent review.
**Reviewed anchor dependencies:** 64-contract
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** SCHEMA
**Pending prerequisites:** owner:archive_selection

### 64-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 64-schema
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:archive_selection

### 64-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 64-core
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** HOME_HISTORY, I18N
**Pending prerequisites:** owner:archive_selection

### 64-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 64-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:archive_selection

### 66-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** AGY-G → CLINE → OC-M → OMP → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 66-schema
**Goal:** Serialize additive SQL, actual migration journal/snapshot/Expo loader and fixture; fresh/previous-DB migration and fault probes; independent review.
**Reviewed anchor dependencies:** 66-contract
**Preference:** AGY-G → CLINE → OC-M → OMP → AGY-S → CURSOR → CODEX
**Locks:** SCHEMA
**Pending prerequisites:** owner:D6

### 66-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 66-schema
**Preference:** AGY-G → CLINE → OC-M → OMP → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D6

### 66-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 66-core, 81-core
**Preference:** AGY-G → CLINE → OC-M → OMP → AGY-S → CURSOR → CODEX
**Locks:** EXPORT, I18N, SESSION
**Pending prerequisites:** owner:D6

### 66-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 66-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D6

### 67-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 67-schema
**Goal:** Serialize additive SQL, actual migration journal/snapshot/Expo loader and fixture; fresh/previous-DB migration and fault probes; independent review.
**Reviewed anchor dependencies:** 67-contract
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** SCHEMA
**Pending prerequisites:** owner:D1, owner:D2

### 67-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 67-schema, 95-core
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D1, owner:D2

### 67-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 67-core
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** HOME_HISTORY, I18N, SCHEDULE
**Pending prerequisites:** owner:D1, owner:D2

### 67-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 67-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D1, owner:D2

### 70-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** AGY-G → CLINE → OC-M → OMP → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 70-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 70-contract
**Preference:** AGY-G → CLINE → OC-M → OMP → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D10

### 70-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 70-core
**Preference:** AGY-G → CLINE → OC-M → OMP → AGY-S → CURSOR → CODEX
**Locks:** HEALTH_CLIENT, HOME_HISTORY, I18N
**Pending prerequisites:** owner:D10, external:verified_authorized_Alexandria_contract_and_live_data

### 70-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 70-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D10, external:verified_authorized_Alexandria_contract_and_live_data

### 72-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** AGY-S → AGY-G → CLINE → OMP → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 72-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 72-contract
**Preference:** AGY-S → AGY-G → CLINE → OMP → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D9, owner:D10

### 72-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 72-core
**Preference:** AGY-S → AGY-G → CLINE → OMP → OC-M → CURSOR → CODEX
**Locks:** HEALTH_CLIENT, HOME_HISTORY, I18N
**Pending prerequisites:** owner:D9, owner:D10, external:verified_authorized_Alexandria_contract_and_live_data

### 72-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 72-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D9, owner:D10, external:verified_authorized_Alexandria_contract_and_live_data

### 74-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 74-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 74-contract
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:plateau_comparison

### 74-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 74-core
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** I18N
**Pending prerequisites:** owner:plateau_comparison

### 74-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 74-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:plateau_comparison

### 75-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** AGY-S → AGY-G → CLINE → OMP → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 75-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 147-core, 74-core, 75-contract
**Preference:** AGY-S → AGY-G → CLINE → OMP → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D9

### 75-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 75-core
**Preference:** AGY-S → AGY-G → CLINE → OMP → OC-M → CURSOR → CODEX
**Locks:** I18N
**Pending prerequisites:** owner:D9

### 75-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 75-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D9

### 79-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 79-schema
**Goal:** Serialize additive SQL, actual migration journal/snapshot/Expo loader and fixture; fresh/previous-DB migration and fault probes; independent review.
**Reviewed anchor dependencies:** 79-contract, 81-schema
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** SCHEMA
**Pending prerequisites:** owner:D4, owner:D5

### 79-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 79-schema, 81-core
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D4, owner:D5

### 79-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 79-core
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** I18N, SESSION
**Pending prerequisites:** owner:D4, owner:D5

### 79-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 79-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D4, owner:D5

### 80-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 80-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 80-contract, 81-core
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D4

### 80-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 80-core
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** HOME_HISTORY, I18N, SESSION
**Pending prerequisites:** owner:D4

### 80-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 80-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D4

### 81-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 81-schema
**Goal:** Serialize additive SQL, actual migration journal/snapshot/Expo loader and fixture; fresh/previous-DB migration and fault probes; independent review.
**Reviewed anchor dependencies:** 81-contract
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** SCHEMA
**Pending prerequisites:** owner:D4, owner:D5

### 81-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 81-schema
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D4, owner:D5

### 81-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 81-core
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** I18N, SESSION
**Pending prerequisites:** owner:D4, owner:D5

### 81-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 81-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D4, owner:D5

### 82-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 82-schema
**Goal:** Serialize additive SQL, actual migration journal/snapshot/Expo loader and fixture; fresh/previous-DB migration and fault probes; independent review.
**Reviewed anchor dependencies:** 82-contract
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** SCHEMA
**Pending prerequisites:** owner:D7

### 82-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 82-schema
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D7

### 82-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 81-core, 82-core
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** EXPORT, I18N, SESSION
**Pending prerequisites:** owner:D7

### 82-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 82-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D7

### 95-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 95-schema
**Goal:** Serialize additive SQL, actual migration journal/snapshot/Expo loader and fixture; fresh/previous-DB migration and fault probes; independent review.
**Reviewed anchor dependencies:** 95-contract
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** SCHEMA
**Pending prerequisites:** owner:D1

### 95-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 95-schema
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D1

### 95-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 95-core
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** HOME_HISTORY, I18N, SCHEDULE
**Pending prerequisites:** owner:D1

### 95-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 95-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D1

### 112-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 112-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 112-contract
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D11

### 112-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 112-core
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** I18N, PLATFORM
**Pending prerequisites:** owner:D11

### 112-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 112-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D11

### 114-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 114-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 112-native, 114-contract
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 114-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 114-core
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** I18N
**Pending prerequisites:** A1 + qualified route/toolchain

### 114-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 114-wiring, 80-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** A1 + qualified route/toolchain

### 136-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 136-schema
**Goal:** Serialize additive SQL, actual migration journal/snapshot/Expo loader and fixture; fresh/previous-DB migration and fault probes; independent review.
**Reviewed anchor dependencies:** 136-contract
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** SCHEMA
**Pending prerequisites:** owner:D8

### 136-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 136-schema
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D8

### 136-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 136-core, 149-wiring, 82-wiring
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** EXPORT, I18N
**Pending prerequisites:** owner:D8

### 136-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 136-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D8

### 147-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** AGY-S → AGY-G → CLINE → OMP → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 147-schema
**Goal:** Serialize additive SQL, actual migration journal/snapshot/Expo loader and fixture; fresh/previous-DB migration and fault probes; independent review.
**Reviewed anchor dependencies:** 147-contract
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** SCHEMA
**Pending prerequisites:** owner:D3

### 147-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 147-schema, 151-core
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D3

### 147-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 147-core
**Preference:** AGY-G → AGY-S → OMP → CLINE → OC-M → CURSOR → CODEX
**Locks:** EXPORT, I18N
**Pending prerequisites:** owner:D3

### 147-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 147-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D3

### 148-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 148-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 148-contract
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** owner:D12

### 148-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 147-contract, 148-core, 151-core
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** EXPORT, I18N
**Pending prerequisites:** owner:D12

### 148-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 148-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** owner:D12

### 149-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 149-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 147-core, 148-wiring, 149-contract, 151-core
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 149-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 149-core
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** EXPORT, I18N
**Pending prerequisites:** A1 + qualified route/toolchain

### 149-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 149-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** A1 + qualified route/toolchain

### 150-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 150-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 150-contract
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 150-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 150-core
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** SESSION
**Pending prerequisites:** A1 + qualified route/toolchain

### 150-native
**Goal:** Build reviewed SHA; dedicated synthetic AVD/feature Maestro plus required physical/live evidence; save APK/source/device/receipt, not launch-smoke alone.
**Reviewed anchor dependencies:** 150-wiring
**Preference:** AGY-G → CLINE → AGY-S → OMP → CURSOR → OC-M → CODEX
**Locks:** ANDROID_QA
**Pending prerequisites:** A1 + qualified route/toolchain

### 151-contract
**Goal:** Draft smallest typed/data/UI contract, failing-test vectors and exact per-slice allowlist; independently review it; owner choices stay explicitly pending.
**Reviewed anchor dependencies:** none
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 151-core
**Goal:** Production-importing focused RED test; minimal service/policy/transaction GREEN; edge/fault/mutation probes; independently reviewed immutable anchor.
**Reviewed anchor dependencies:** 151-contract
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** exact isolated files; no global writer lock
**Pending prerequisites:** A1 + qualified route/toolchain

### 151-wiring
**Goal:** Wire only approved contract into actual consumers; smallest file/invariant writer leases; focused/full gates; independent review after union/rebase.
**Reviewed anchor dependencies:** 151-core
**Preference:** OMP → OC-M → CLINE → AGY-G → AGY-S → CURSOR → CODEX
**Locks:** I18N
**Pending prerequisites:** A1 + qualified route/toolchain

## Focused commands and elementary actions

Freeze the exact existing/new test files from each issue candidate_paths. Under pinned Node22/npm10.9.7 run `npm test -- --runTestsByPath <files> --watchAll=false --maxWorkers=2 --cacheDirectory=<private-cache>`. Fill placeholders in the brief; never execute them literally. New tests import production, not copied helper/DDL. #151 calls both real service methods. Invoke each exact feature Maestro YAML explicitly; qa.sh smoke covers launch only. PLAN.md contains the authoritative CI-split final gate.

Every code slice: (1) read AC/source and freeze one small behavior + exact files, (2) write one failing assertion, (3) run/save RED exit, (4) smallest GREEN, (5) edge/fault probe, (6) coherent commit if authorized, (7) another agent reviews/probes actual SHA, (8) fix every finding and rereview, (9) authorized branch publication and remote SHA readback. Elementary actions should be2–5min-sized where practical; large features split into reviewed30–60min packages.

Each native/live phase can remain blocked without blocking unrelated policy/tests. Discover external health schema/auth immediately in the contract package. #114 first validates the existing routine path after #112, then repeats null-routine recovery after #80 wiring; only its final native acceptance needs #80. #136 conversion policy starts before exporter stabilization; only wiring waits.

Path statuses distinguish existing source from proposed files/generated patterns. Freeze a smaller per-package allowlist before dispatch. An issue-wide path inventory is NOT permission to edit all of it. Same-path production/test writers serialize even if no named global lock is listed.

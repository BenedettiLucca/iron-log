# Night Digest — Trust Closure Sprint (2026-09-12 → 2026-09-15)

**Branch:** `supersprint/s12-trust-before-breadth` → **mergeada em `master`** via PR #146 (`6bda0d3`)
**Release:** `v3.15.0` (versionCode 10)

## Números

| Gate final (T28/T28-fix) | Resultado |
|---|---|
| Test suites | **162 passed** (era 141) |
| Tests passed | **1490** (era 1083) |
| tsc / strict lint / audit / export Hermes | **todos verdes** |
| Issues fechadas | **48** |
| Commits na sprint | 14 (e82330f → fb25880) |

## Infra de execução

- Lanes AGY headless (gemini-3.8-flash-high; claude-sonnet-4-6 testado) + OC via `opencode run` CLI (ACP quebrado — #48766 reportada no upstream)
- 8 waves paralelas, worktrees por lane, gates independentes por Hermes
- Quota AGY individual queima em ~9 lanes/dia (ver skill iron-log-sprint-ops)

## Confiança de dados (o coração da sprint)

- **#102**: export/backup com WAL checkpoint central fail-closed (`DatabaseSnapshotService`), restore fecha o handle antes de substituir
- **#103/#115/#141**: identidade de ocorrência A/B/A preservada; mutação idempotente via `sets.operation_id` (migration 0024)
- **#104/#120**: PR reconciliation determinística dentro de transação (C4: carga comparável, promoção cronológica)
- **#116/#139**: finish/discard transacionais; Undo de 10s no histórico
- **#105/#118/#126/#128**: C1 (sessão live+concluída) em todo analytics; streak vazio=0

## Performance

- **#135**: índices compostos em `sets` (migration 0025) — **2.7x mais rápido** em 10k sets (54.9→21.5ms), result hash idêntico
- **#137/#131/#132/#119**: queries limitadas/ordenadas; `HistoryQueryService` com cursor pagination (budget provado em 5k sessões)

## Features entregues

- **#129**: parser decimal locale-aware (72,5 pt-BR ✓) em todos os inputs
- **#85/#86**: filtro por equipamento corrigido + muscle groups
- **#93**: importers Strong/Hevy/FitNotes com lbs→kg e erro de formato mapeado na UI
- **#134/#124**: import JSON e clone de rotina atômicos
- **#121/#122**: exports com data local e cobertura completa
- **#92/#65**: share de rotinas com merge não-destrutivo
- **#113/#89/#107**: permissão de notificação, reminders por suplemento com resync imediato, deep-link de resposta
- **#100/#99/#98**: UI da sessão keyboard-safe, painel e badge consistentes
- **#144**: P0 novo (modal preview não navegava e criava sessão fantasma) — fixado e **validado por Lucca no S23 via Expo Go**

## Infra QA (sessão 20260913_002540_59c2f8)

- `scripts/qa.sh` (boot/install/app/smoke/logs/snap/reset/stop) + Maestro smoke flows
- `docs/agentic-android-qa.md`: protocolo completo agent-native
- **#143 (flaky session-lifecycle)**: causa raiz achada — estado no jest transform cache (`/tmp/jest_rs`); CI agora limpa cache antes do coverage run
- **#145 (aberta)**: evidence receipt determinístico ligando build↔flow↔evidência

## Pendências honestas

1. **#112**: SDK 57 vs development build (Expo Go treadmill volta a morder no próximo major)
2. **#114**: notificação com app morto exige build release + device real
3. **T27B**: cloud backup E2E (OAuth real) — sem credenciais não há prova
4. **#142/#145**: qa.sh doctor + evidence receipt (follow-ups de infra)
5. Flaky #143 fechado com mitigação (clear cache); a race de scheduling de fundo ainda existe no jest + RTL + better-sqlite3

## Estado do repo

- `master` @ `6bda0d3`, working tree limpa
- Branch da sprint deletada (local + remota); `audit/lean-performance-workflow` remota mantida (PR #111 merged, branch aguardando janela de 10 dias)
- Worktrees: apenas o principal

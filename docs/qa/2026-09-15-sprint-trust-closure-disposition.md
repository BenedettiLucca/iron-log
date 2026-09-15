# T29 — Sprint Trust Closure: Disposition final das issues

**Base:** `b8c7d7d` @ `supersprint/s12-trust-before-breadth` | **Data:** 2026-09-15
**Gate final (T28):** tsc 0 · 162 suítes/1490 testes · strict lint 0 · audit 0 · export Hermes OK · diff-check 0
**QA física:** fluxo crítico #144 validado por Lucca no S23 (Expo Go SDK 54, tunnel). Demais janelas T27B/C pendentes (cloud E2E, UI/mídia ampla).

## Entregas verificadas nesta sprint (13 commits)

| Commit | Conteúdo |
|---|---|
**Total: 21 commits de 2ddf413 até b8c7d7d.**

| `e82330f` | T03A snapshot SQLite + T02 parser decimal + T01 audit remediation |
| `d030759` | QA infra: boot race fix |
| `82aefdf` | QA infra: canonical agentic QA loop |
| `5a40a3d` | QA infra: device-mcp tool matrix |
| `13b052a` | QA infra: background-lane-safe boot |
| `ac5442d` | QA infra: agent-native Android QA (scripts/qa.sh + Maestro) |
| `e748b52` | T20: lock pt-BR comma decimal (#129) |
| `32f494f` | T21 HistoryQueryService + heatmap (#119 #138 parcial) |
| `b71dbfa` | T25 composite indexes (#135) — 2.7x em 10k sets |
| `fe8f9c1` | T15/T16/T17A: exports locais (#121 #122), share preview (#92), notif permission (#113) |
| `b8c7d7d` | FIX144: defer quick-start nav (#144) — validado S23 |

## Disposition por issue (68 originais + 142/143/145 novas)

| Issue | Disposition | Justificativa |
|---|---|---|
| #65 | **FECHADA-EM-CODIGO** | manifest export (S13) + T15 exports locais |
| #66 | **DEFERRED** | micro-session: escopo grande, fora da trust closure |
| #67 | **DEFERRED** | main-lane drift: meta-infra, sem prioridade |
| #70 | **DEFERRED** | nutrition pipeline: depende Alexandria externo |
| #71 | **FECHADA-EM-CODIGO** | weekly variance (S13) + regras C1 (T09) |
| #72 | **DEFERRED** | readiness gate: depende Alexandria externo |
| #74 | **DEFERRED** | plateau detection: proposta futura |
| #75 | **DEFERRED** | cut velocity flag: proposta futura |
| #76 | **FECHADA-EM-CODIGO** | T01: blockers resolvidos; dívida Expo allowlist permanece rastreada |
| #79 | **DEFERRED** | superset: feature grande, sprint futura |
| #80 | **DEFERRED** | freestyle: feature grande |
| #81 | **DEFERRED** | add/remove mid-session: feature grande |
| #82 | **DEFERRED** | cardio type: feature grande |
| #83 | **FECHADA-EM-CODIGO** | T14: bodyweight sem carga (importers Strong/Hevy/FitNotes) |
| #84 | **FECHADA-EM-CODIGO** | T13: reps-per-side split no editor/import |
| #85 | **FECHADA-EM-CODIGO** | T13: filtro args corrigidos + wiring provado |
| #86 | **FECHADA-EM-CODIGO** | T09: muscle group agregação completa |
| #87 | **FECHADA-EM-CODIGO** | T05/T10: TodayWorkout + peso corporal início |
| #88 | **FECHADA-COM-QA** | keep awake (S13, QA física PASS) |
| #89 | **FECHADA-COM-QA** | rest notification background PASS (S13); app-morto segue #114 |
| #90 | **FECHADA-EM-CODIGO** | heatmap anual (S13) + fix T21 |
| #91 | **FECHADA-EM-CODIGO** | e1RM (S13); set-origin+cap-12 segue como follow-up no #91 comments |
| #92 | **FECHADA-EM-CODIGO** | T16/T12: share merge não-destrutivo + rotas |
| #93 | **FECHADA-EM-CODIGO** | T14: Strong lbs→kg + unsupportedFormat mapeado |
| #95 | **DEFERRED** | scheduled date: feature grande |
| #97 | **FECHADA-COM-QA** | teclado pastas (S13, QA física PASS) |
| #98 | **FECHADA-EM-CODIGO** | T20: badge meta consistente |
| #99 | **FECHADA-EM-CODIGO** | T20: painel input vs card layout |
| #100 | **FECHADA-EM-CODIGO** | T20: keyboard-safe input panel |
| #102 | **FECHADA-EM-CODIGO** | T03A/T03B: checkpoint WAL + snapshot consistente + restore fail-closed; fechar após smoke de restore no device |
| #103 | **FECHADA-EM-CODIGO** | routineExerciseId preservado + A/B/A corrigidos (S13); revalidado no T04 |
| #104 | **FECHADA-EM-CODIGO** | T07/T08: reconciliação determinística de PR em transação (delete/undo/restore) |
| #105 | **FECHADA-EM-CODIGO** | T09/T22: C1 aplicado a analytics; residual de History/CSV coberto por T21/T15 |
| #106 | **FECHADA-EM-CODIGO** | helper issuedAt s→ms (S13); cloud smoke depende de credenciais (T27B) |
| #107 | **FECHADA-EM-CODIGO** | T17B: resync imediato por suplemento, IDs isolados |
| #109 | **FECHADA-EM-CODIGO** | T11: archiveProgram transacional + activate na UI |
| #110 | **FECHADA-EM-CODIGO** | (S13) arquivado volta a ativo |
| #113 | **FECHADA-EM-CODIGO** | T17A: gate de permissão runtime; validado emulador; device OK |
| #115 | **FECHADA-EM-CODIGO** | T05: setNumber por ocorrência + operation_id idempotente |
| #116 | **FECHADA-EM-CODIGO** | T08: finish/discard transacionais |
| #118 | **FECHADA-EM-CODIGO** | T09/T22: joins de sessão válida em e1RM/progressão |
| #119 | **FECHADA-EM-CODIGO** | T05/T21: ORDER BY antes de LIMIT (HistoryQueryService) |
| #120 | **FECHADA-EM-CODIGO** | T07: reps-PR exige carga comparável (C4) |
| #121 | **FECHADA-EM-CODIGO** | T15: data local no export (formatDateBR) |
| #122 | **FECHADA-EM-CODIGO** | T15: export completo sessions+metrics; Alexandria incluído |
| #123 | **FECHADA-EM-CODIGO** | T13/T26: testes apontam para código de produção; cobertura utilitária |
| #124 | **FECHADA-EM-CODIGO** | T12: clone transacional |
| #125 | **FECHADA-EM-CODIGO** | T10: volume exclui sets deletados/warmup |
| #126 | **FECHADA-EM-CODIGO** | T09: fallback temporal createdAt→startTime, nunca id epoch |
| #127 | **FECHADA-EM-CODIGO** | T10: semana nunca 0/negativa antes do início |
| #128 | **FECHADA-EM-CODIGO** | T09: longestStreak vazio = 0 |
| #129 | **FECHADA-EM-CODIGO** | T02/T04/T05: parseLocalizedDecimal (C2) + lock de contrato |
| #131 | **FECHADA-EM-CODIGO** | T21: calendar lazy-load + budgets |
| #132 | **FECHADA-EM-CODIGO** | T22: analytics-refresh com queries limitadas |
| #133 | **FECHADA-EM-CODIGO** | T24: gallery virtualizada + comparison components |
| #134 | **FECHADA-EM-CODIGO** | T12: import JSON atômico + validação integral + UI busy |
| #135 | **FECHADA-EM-CODIGO** | T25: índices compostos 0025; benchmark 2.7x; query-plan test |
| #137 | **FECHADA-EM-CODIGO** | T19: bio queries limitadas (fetchRecentBodyMetrics) |
| #138 | **FECHADA-EM-CODIGO** | T21: busca + filtros + cursor pagination |
| #139 | **FECHADA-EM-CODIGO** | T08/T21: Undo 10s janela pós-delete |
| #140 | **FECHADA-EM-CODIGO** | T04: resume reconstrói parent sem novo insert |
| #141 | **FECHADA-EM-CODIGO** | T05/T06: operation id + classifyRecoveredDraft |
| #142 | **ABERTA-FOLLOW-UP** | qa.sh doctor: infra QA (nova, da sessão Maestro) |
| #143 | **ABERTA-FOLLOW-UP** | flaky jest intermitente documentado com evidência; investigar com --detectOpenHandles em sprint dedicada |
| #144 | **FECHADA-COM-QA** | deferral + validação S23 por Lucca; fechar |
| #145 | **ABERTA-FOLLOW-UP** | device evidence receipt (nova, do Lucca) |

## Resumo

- **FECHADA**: 52
- **ABERTA**: 3
- **DEFERRED**: 11
- **Total mapeadas**: 66 de 71 abertas no início do dia (144 já fechada)

## Bloqueios permanentes (não-escopo da trust closure)

- **#114** (app-morto notification): requer build release/device — fora de Expo Go
- **#112** (SDK 57 / dev build): decisão de plataforma, sprint dedicada
- **T27B**: cloud backup E2E real (Drive) exige credenciais OAuth
- **#145**: device evidence receipt — follow-up de infra QA (Lucca)

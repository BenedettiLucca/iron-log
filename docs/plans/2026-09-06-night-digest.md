# Night Digest — 2026-09-05 → 2026-09-06

Branch: `supersprint/s12-trust-before-breadth` @ `b46ffe1` (rebased em origin/master c442b8f)

## Números

| Gate | Início da noite | Agora |
|---|---|---|
| Test suites | 115 | **141** |
| Tests passed | 948 | **1083** |
| tsc / lint / audit | verdes | **verdes** |
| Issues resolvidas | — | **16** |
| Lanes ACP executadas | — | 13 (10 AGY, 3 OC) + 1 fix direto |

## Issues resolvidas (todas integradas com contract test locked + gates independentes)

**Trust II (data integrity):**
- #102 (P0) backup WAL checkpoint + close-before-restore + integrity gate + orphan cleanup
- #104 PR fantasma reconciliado em delete/undo/restore
- #105 scores ignoram sessão não finalizada
- #106 token Google: issuedAt segundos→ms (util novo + testes)
- #107 lembretes de suplemento reais (schedule no app start, i18n 4 línguas)
- #109 createProgram ativo em transação

**QA batch (device findings):**
- #97 teclado x pastas — CTA pinned fora do scroll (device-verified pendente re-test)
- Key dup na preview + expand A/B/A independente + PR dedupe

**Features:**
- #86 muscle groups (migration 0022 + backfill) — #85 equipment (migration 0023 + filtro no editor)
- #93 importers CSV Strong/Hevy/FitNotes (fallback custom, nada descartado)
- #65 manifest export pra Hermes/Obsidian — #71 weekly variance (regras Trust II)
- #92 routine share com merge não-destrutivo (zod + transação + sufixo)
- #87 treino de hoje na home + peso no início da sessão — #90 heatmap anual

## Pendências pra Lucca

1. **QA físico** (device, ~20min): re-testar #97 (criar/rename pasta com teclado), key dup na preview (SN13 ABA → abrir rotina), #100/#99/#98 na tela de sessão, heatmap, treino de hoje, #92 share. Runbook: `docs/qa/2026-09-05-sprint-13-qa-runbook.md` (seção Testes 1-2) + os novos cards são autoexplicativos
2. **#112** decisão SDK 57 vs dev build (sprint dedicada)
3. **#113/#114** criadas como follow-up (permissão de notificação em build nativa; cenário app morto)
4. **Hygiene batch GitHub** — continua gated, sua call

## Incidente registrado (transparência)

Na integração da lane #85, o `src/utils/exercise-filter.ts` novo ficou fora do `git add` seletivo e foi apagado com o worktree. **O tsc gate pegou** (foi o único gate que viu — jest não toca imports de UI). Recriei o util do zero alinhado com a migration 0023 e as convenções do repo (`b46ffe1`). Lição na skill `iron-log-sprint-ops`: nunca stage seletivo sem `git status` final no worktree.

## Estado do repo

- Branch de sprint: 25 commits à frente do master, todas as lanes mergeadas com gates
- Worktrees ativos: só `lean-performance-workflow` (da sua sessão master, não toquei)
- Metro dev server: foi derrubado no fim (reiniciar com `npx expo start` pro QA)
- Metro logs / AGY: `agy_acp_server.par` desbloqueado e operacional (token renovado)

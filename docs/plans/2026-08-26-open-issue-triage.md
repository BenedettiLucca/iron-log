# Sprint 7 — Open-issue triage

**Data:** 2026-08-26 12:39 -03
**Base verificada:** `master` @ `85bd28e` = `origin/master`
**Escopo inicial:** triagem read-only do backlog GitHub vivo; nenhuma issue foi fechada, relabelled ou implementada naquela etapa. O follow-up aprovado do checkpoint executa apenas slices bounded de qualidade, sem alterar o backlog automaticamente.

## Baseline e método

- Backlog re-fetchado via `gh issue list --state open --json ...`: **14 issues abertas**, #63–#76.
- Baseline de produto herdado do fechamento da Sprint 6: **93 suites / 837 testes**, typecheck e Expo lint verdes; QA física Android PASS.
- Cada issue foi comparada com schema, hooks, rotas, serviços e testes atuais. Claims de contagem do corpo da issue foram tratados como históricos, não como evidência.
- Limitação deliberada: integrações externas Alexandria/Hermes não foram inferidas a partir do texto da issue quando não há cliente/contrato correspondente neste repo.

## Recomendação executiva

### Candidato pré-release (recomendação inicial; reavaliado no follow-up)

1. **#76 — segurança/dependências, slice não-breaking בלבד**
   - Fazer apenas `npm audit fix`/atualizações isoladas que não troquem o Expo SDK sem revisão.
   - **Anti-scope:** não rodar `npm audit fix --force`; isso propõe `expo@57.0.16` sobre o atual `expo ~54.0.33`, uma migração de SDK fora desta triagem.
   - Verificação obrigatória: lockfile diff, `npm audit`, testes, typecheck, lint, export Android e QA física se o runtime mudar.

### Incorporar em uma frente de qualidade, sem virar feature sprint

2. **#69 — coverage inventory refresh + gaps realmente críticos**
   - O claim de “16 rotas / 9 módulos sem teste” está desatualizado: a Sprint 6 já adicionou contratos para finish, tabs, programas, rotina/editor e suplementos (`__tests__/quality/sprint-6-*.test.*`).
   - Recalcular a matriz atual e cobrir somente comportamento de maior risco; não perseguir 100% de render coverage por vaidade.

3. **#73 — type-safety cleanup bounded [DONE]**
   - O slice removeu os casts `as any` em navegação e tipou handlers/props com contratos concretos das bibliotecas e das queries locais.
   - Contrato RED→GREEN em `__tests__/quality/sprint-7-type-safety.test.ts`; typecheck, lint e suíte completa fecham o slice.

### Close/supersede recomendado — não executar automaticamente

4. **#63 — superseded by current folder slice.** O schema já tem `routines.folder` (`src/db/schema.ts:8`), o hook deriva filtros (`hooks/use-routines.ts:98-105`) e a tela mostra tabs por folder (`app/(tabs)/routines.tsx:174-193`). A proposta original de tabela, drag-and-drop e CRUD completo é uma expansão nova, não um bug pendente. Se ainda houver dor, abrir issue nova e menor.
5. **#68 — superseded in the mutation path.** `useSupplements` já retorna `Promise<boolean>` e a tela mostra erro em toggle/save/delete (`hooks/use-supplements.ts:53-117`; `app/supplements/index.tsx:136-140,260-293`). `useRoutines` também retorna boolean e a tela consome sucesso/erro (`hooks/use-routines.ts:24-72`; `app/(tabs)/routines.tsx:55-76`). O hook genérico `useAsyncAction` não existe, mas a necessidade arquitetural proposta não se provou; se fetch failures ainda forem invisíveis, abrir uma issue específica por fluxo.

### Post-release — valor real, mas dependência/scope incompatível com esta entrega

- **#64 Archive routines:** `routines` não tem `isArchived`; hoje há delete real (`hooks/use-routines.ts:24-38`). Requer migration + UX + dataset QA.
- **#65 Schedule manifest:** não há manifest/schedule exporter no código atual; depende do contrato de consumo Hermes/Obsidian.
- **#66 Micro-session mode:** não há `sessionMode`/micro contract no schema ou fluxo; altera modelo e interação do treino.
- **#67 Main-lane drift:** não há analyzer/estado de lane atual; depende da definição de agenda de #65.
- **#70 Nutrition context:** não há cliente/contrato de nutrition Alexandria neste repo; integração externa ainda não está pronta.
- **#71 Sleep-adjusted variance:** `app/reports/weekly.tsx:31-46` gera relatório via `NotionExportService` e métricas locais; não consulta sleep/Alexandria.
- **#72 Readiness gate:** não há readiness/health composite local; depende de #70/#71 ou contrato Alexandria estável.
- **#74 Plateau detection:** não há `PlateauDetector`; requer definição longitudinal de progresso e nova superfície de alerta.
- **#75 Cut-velocity injury risk:** `bodyMetrics.weight` existe (`src/db/schema.ts:64-78`), mas não há analyzer; depende de #74 e de sinais de nutrição/readiness. É alerta de saúde, então precisa de thresholds e copy conservadores antes de entrar no produto.

## Tabela de decisão

| Issue | Veredito proposto | Motivo curto | Ordem |
|---:|---|---|---:|
| #76 | **blocked / deferred** | não há fix não-breaking seguro; remediação restante exige decisão de SDK | 1 |
| #69 | **fold into existing sprint** | claim stale; refresh de coverage, sem caça a porcentagem | 2 |
| #73 | **DONE** | slice pequeno, bounded e verificado | 3 |
| #63 | **close/supersede** | folder/filter já existe; proposta original ficou maior que a dor atual | — |
| #68 | **close/supersede** | mutation errors já têm retorno e toast nos fluxos auditados | — |
| #64 | **post-release** | migration + UX de archive | — |
| #65 | **post-release** | contrato externo de manifest ausente | — |
| #66 | **post-release** | novo modo de sessão/modelo | — |
| #67 | **post-release** | depende de schedule truth | — |
| #70 | **post-release** | depende de Alexandria nutrition | — |
| #71 | **post-release** | depende de sleep + schedule | — |
| #72 | **post-release** | readiness depende dos pipelines externos | — |
| #74 | **post-release** | feature longitudinal M, sem analyzer atual | — |
| #75 | **post-release** | risco de saúde; depende de #74/#70/#72 | — |

## Follow-up de execução (2026-08-26)

### #73 — [DONE]

- Removidos os escapes de navegação `as any` e os `any` de produção auditados em `app/`, `components/` e `src/`.
- Adicionados tipos concretos para `DateData`, `DateTimePickerEvent`, `LayoutChangeEvent`, rows de exercício e props dos helpers da sessão.
- `getNestedValue` agora percorre `unknown` com guarda de objeto e retorno string-safe.
- Evidência: contrato direcionado GREEN; suíte completa **94 suites / 839 testes**; lint sem issues; typecheck `ok`; `git diff --check` verde.

### #76 — [BLOCKED]

- `npm audit --omit=dev` no baseline reportou **23 vulnerabilidades** (15 moderate, 8 high).
- O experimento isolado com Expo 54 reduziu apenas o total de produção para **22** (14 moderate, 8 high), sem remover high; a alteração de lockfile foi revertida.
- O dry-run do npm contratado ainda propõe uma mudança ampla e a cadeia de Expo 57. Não foi executado `npm audit fix --force`.
- Veredito: não existe correção não-breaking honesta para fechar #76 nesta entrega. O próximo passo desse issue é uma decisão separada sobre upgrade de SDK.

### Próximo item aprovado

`#69` foi executado como slice bounded: recalcular a matriz de cobertura atual e adicionar somente contratos comportamentais para gaps críticos que realmente aparecessem.

### #69 — [REVIEWED]

- Artefato: `docs/plans/2026-08-26-sprint7-coverage-matrix.md`.
- Inventário atualizado: **25 rotas/layouts**, **94 arquivos de teste**, **94 suites / 839 testes**.
- O claim histórico de “16 rotas / 9 módulos sem teste” está stale contra o código atual; as rotas listadas têm contratos de fonte, testes comportamentais/utility ou evidência de QA distribuída nas Sprints 3–6.
- Cobertura automática continua deliberadamente em `src/utils`: 91.21% statements, 84.90% branches, 90.84% functions e 95.54% lines.
- `app/session/summary.tsx` não tem render test isolado, mas o domínio de summary/verdict, export e navegação estão cobertos. O residual é visual/composicional e fica para o QA final, sem blocker crítico identificado.
- Veredito: **[REVIEWED]**, sem feature nova, sem mudança de dependência e sem fechamento/relabel automático no GitHub.

### Decisão de release scope — [DONE]

Lucca decidiu **pular o Sprint 8**: #76 permanece deferred porque a remediação segura exige uma frente separada de upgrade do Expo SDK; não há candidato pré-release não-breaking neste ciclo. O Sprint 7 fecha com #73 [DONE], #69 [REVIEWED] e nenhuma alteração automática no GitHub. O Sprint 9 produziu o audit Ponytail read-only; o Sprint 10 executou somente os cortes aprovados.

### Sprint 9 — [DONE]

- Relatório: `docs/audits/2026-08-26-ponytail-audit.md`.
- Baseline: typecheck, lint, 94 suites / 839 testes, audit de high/critical e export Hermes Android verdes; Expo Doctor 16/18 com drift/duplicidade já conhecido em #76.
- Resultado: 6 findings de corte confirmados e 1 dependência direta candidata condicionada; falsos positivos e deferrals registrados.
- Execução posterior aprovada: `6c8e595` removeu −171 linhas e `dda6563` removeu a dependência direta, com gates finais verdes. Antigravity foi tentado, mas travou sem alterar arquivos; a lane allowlisted foi concluída manualmente no checkout principal.

## Dependency graph

```text
#65 schedule manifest
 ├──> #67 main-lane drift
 └──> #71 sleep-adjusted variance

#70 nutrition context ──> #72 readiness gate ──> #75 injury-risk interpretation
#74 plateau detection ────────────────────────┘

#63 folders <── UX overlap ──> #64 archive
#68 mutation feedback (mostly superseded)
#69 coverage + #73 type safety (quality lane)
#76 dependency security (independent)
```

## Decision checkpoint original do Lucca

Minha recomendação original era aprovar **#76 como único candidato pré-release**, com #69/#73 incorporados somente como slices de qualidade bounded. O checkpoint foi aprovado pelo Lucca; após a investigação de dependências, #76 foi marcado como bloqueado/deferred, #73 foi concluído e #69 foi revisado com matriz atualizada. Nenhuma issue foi fechada ou relabelled automaticamente; Sprint 8 foi pulado e a execução Ponytail aprovada foi concluída em lane separada.

# Inventário de issues abertas + Sprint 12 — Trust Before Breadth

**Data:** 2026-08-27  
**Base verificada:** `master` @ `e586f54` = `origin/master`  
**Backlog vivo:** 33 issues abertas; nenhum PR aberto  
**Baseline local:** 103 suites / 894 testes, typecheck e lint verdes  
**Security gate:** 0 critical; 8 high allowlisted da toolchain Expo, rastreadas em #76  
**Dependências Expo:** `npx expo install --check` encontra 15 pacotes fora da versão recomendada do SDK 54; tratar em manutenção separada, não misturar com feature sprint.

## Tese executiva

O backlog mistura quatro coisas diferentes: bugs confirmados, fundações estruturais, features atraentes e issues históricas já superadas. Tratar tudo como fila linear seria gestão de backlog por ansiedade.

A Sprint 12 deve proteger confiança antes de ampliar superfície:

1. **#97 — corrigir o formulário de pastas bloqueado pelo teclado Android**;
2. **#96 — criar identidade real de ocorrência de exercício**, não apenas trocar a PK;
3. **#91A — impedir estimativas de 1RM desonestas acima de 12 reps e mostrar a origem**.

Essas três lanes são independentes em ownership de arquivo e podem começar juntas. #88/#89 têm bom valor diário, mas conflitam com o fluxo de sessão que #96 precisa reestruturar; entram no próximo checkpoint, não no mesmo caldeirão.

---

## Inventário completo

| Issue | Evidência no código atual | Valor / risco | Veredito PM |
|---:|---|---|---|
| #63 Pastas de rotinas | A entrega v3.14 criou `folders`, migration `0020`, CRUD e `FolderManagerModal`; drag/reorder/emoji da proposta antiga não fazem parte do produto entregue | Resultado central já existe; manter aberta mistura residual com feature concluída | **Fechar como superseded após #97**; abrir issue pequena só se reorder continuar desejado |
| #64 Arquivar rotinas | `routines` não tem `isArchived`; `useRoutines.deleteRoutine` ainda apaga a rotina e desvincula histórico/programa | Dor real, reduz risco de exclusão acidental, mas folders já aliviaram clutter | **Next**, depois da Sprint 12 |
| #65 Schedule manifest | `program_weeks` representa semana→rotina, não agenda por dia; não há exporter de schedule | Estratégico para automação, mas o modelo fonte ainda não expressa a verdade prometida | **Blocked** por schedule truth (#95 reestruturada) |
| #66 Micro-session | Não há `sessionMode` nem shell alternativo | Wedge de aderência real, porém mexe em runtime antes da fundação de ocorrência/sessão | **Later**, após #96 e decisão sobre #81 |
| #67 Main-lane drift | Não há lane model/analyzer; depende de saber o que estava agendado | Boa camada de coaching, sem fonte de verdade hoje | **Blocked** por #65/#95 |
| #68 `useAsyncAction` | Hook genérico não existe, mas mutations críticas já retornam boolean/expõem feedback em fluxos auditados | A abstração deixou de ser requisito; implementar literalmente seria arquitetura por arquitetura | **Fechar/supersede**; abrir bugs por fluxo concreto |
| #69 Coverage | Issue histórica dizia 16 rotas/9 módulos; matriz já foi refeita e a suíte atual tem 103 suites/894 testes | Claim stale; perseguir render coverage total seria vanity metric | **Fechar como concluída/revisada** |
| #70 Nutrition context | Repo tem export para Alexandria, não cliente/contrato de ingestão diário | Dependência externa e ownership indefinido | **Blocked** até contrato Alexandria estável |
| #71 Variance por sono | Sem cliente sleep e sem agenda diária canônica | Útil depois que as duas fontes existirem | **Blocked** por #65/#70 |
| #72 Readiness gate | Premissa diz que pipelines #70/#71 existem; não existem neste repo | Alto risco de score pseudo-científico e partial data | **Later/blocked**; manter advisory quando houver dados confiáveis |
| #73 Remover `any` | Contrato `sprint-7-type-safety.test.ts` prova remoção nos caminhos auditados | Trabalho concluído | **Fechar** |
| #74 Plateau detection | Sets, reps, RIR e histórico existem; analyzer não existe | Feature local, determinística e de alto valor após corrigir semânticas básicas | **Next**, depois de #83/#96 |
| #75 Cut injury-risk | Depende de #74/#70 e faz claim de saúde com thresholds ainda abertos | Alto risco de alarme falso e aconselhamento médico disfarçado | **Later**; exige copy conservadora e evidência clínica |
| #76 Security/Expo | `audit:high`: 0 critical, 8 high allowlisted; remediação segura anterior já foi feita | Não é emergência runtime; há 15 drifts de patch no `expo install --check` | **Blocked maintenance epic**: alinhar SDK 54 primeiro, depois decidir upgrade major |
| #79 Superset | Não há group id; PK atual e runtime por `exerciseId` impedem ocorrências repetidas | Feature central, mas construída agora sobre identidade errada geraria retrabalho | **Blocked** por #96; provavelmente também por session snapshot de #81 |
| #80 Freestyle | `sessions.routineId` aceita null, mas route/session bootstrap exige rotina; não há session exercise list | Alto valor de flexibilidade, mas depende da fundação de edição mid-session | **Blocked** por #81 |
| #81 Add/remove mid-session | A sessão lê `routine_exercises` ao vivo; não existe `session_exercises`/snapshot | Problema real; implementar modificando a rotina corromperia a separação plano×execução | **Next architecture decision** após #96; provável nova tabela/snapshot |
| #82 Cardio type | `exercises.type` só strength/duration; `sets` exige peso/reps; export chama duration de cardio | Alto alcance e grande mudança semântica em schema, PR e analytics | **Later**, junto do load-mode model |
| #83 Bodyweight | `sets.weightKg` é not-null e analytics descarta peso 0; flexão/barra ficam semanticamente pobres | Dor comum e data-honesty real | **Top next** após Sprint 12; desenhar `loadMode`, não flag isolada |
| #84 Reps per side | Não há flag; histórico existente não revela se reps atuais são totais ou por lado | Valor médio; risco de reinterpretar histórico retroativamente | **Later**, dentro do load-mode/exercise metadata epic |
| #85 Biblioteca/equipment | Schema não possui equipment/body part/description | Bom para descoberta, dependente de taxonomia e dataset/licença | **Later**, após #86 e decisão de dataset |
| #86 Muscle group | Schema não possui grupo muscular, apesar de i18n já ter labels | Unlock estrutural real, mas backfill da seed precisa taxonomia aprovada | **Next foundation**, depois do trust sprint |
| #87 Treino de hoje | Issue afirma que “o dia já existe”; `program_weeks` só conhece week number e uma rotina por semana | Premissa técnica falsa; não dá para inferir “hoje” honestamente | **Blocked** por schedule truth |
| #88 Keep awake | `expo-keep-awake` existe apenas transitivamente; não é usado nem dependência direta | Barato e alto impacto diário | **Sprint 13 candidate**, após #96 para evitar conflito no session shell |
| #89 Rest notification app morto | `expo-notifications` já existe; NotificationService agenda check-in, mas usa `cancelAllScheduledNotificationsAsync`; rest timer é só JS/UI | Alto valor de confiabilidade; precisa IDs próprios, cancelamento específico e QA nativo | **Sprint 13 candidate**, paralelo a #88 com ownership separado |
| #90 Heatmap anual | `sessions.startTime/durationMinutes` já existem | Feature barata e legível, mas não corrige confiança nem desbloqueia outras | **Later/quick win** |
| #91 1RM/calculadora/origem/cap | `estimateE1RM` aceita 20 reps e o teste atual consagra isso; ranking escolhe maior peso, não melhor e1RM, sem origem | Métrica publicada pode mentir hoje | **Do now como #91A**: cap + origem; calculadora fica follow-up |
| #92 Compartilhar plano | Há backup/export geral, não formato mínimo merge-safe de plano | Requer schema versionado e merge/dedupe | **Later**, depois de schedule truth |
| #93 Import trackers | Só há import próprio/backup; mapping de exercícios e zero-loss import não existem | Grande valor para lançamento público, custo alto de parsers/fixtures | **Later / pre-public launch** |
| #94 Demos de exercício | Nenhuma fonte licenciada aprovada; própria issue reconhece disputa | Upside não compensa risco legal agora | **Close/wontfix until licensed source exists** |
| #95 `scheduled_date`/reschedule | `sessions` não tem data agendada e programas não têm dia planejado | Semântica importante, mas coluna isolada não cria agenda canônica | **Reframe** como schedule-truth epic; precede #65/#67/#87 |
| #96 PK impede exercício repetido | Confirmado em `schema.ts:27-36`; porém UI, route, set progress e next navigation também usam `exerciseId` como identidade | Bug estrutural e unblock de #79; simples troca de PK deixaria bugs/race/data conflation | **Do now**, com occurrence identity end-to-end |
| #97 Teclado cobre nova pasta | Confirmado: Android recebe `behavior=undefined`, sheet tem `maxHeight`, ScrollView não garante foco/CTA visível (`FolderManagerModal.tsx:144-170`) | Regressão bloqueia CRUD recém-lançado em dispositivo físico | **P0 do Sprint 12** |

---

## Dependency graph corrigido

```text
#96 occurrence identity
 ├──> #79 supersets
 ├──> reduz risco de #81 session editing
 └──> é pré-condição para distinguir duas ocorrências na mesma sessão

#81 session exercise snapshot/editing
 ├──> #80 freestyle
 ├──> #79 pairing mid-session
 └──> #66 micro-session mais flexível

#95 schedule truth (reframed: weekday + scheduled occurrence)
 ├──> #65 manifest
 ├──> #87 treino de hoje
 ├──> #67 drift/re-entry
 └──> #71 variance attribution
      └──> #72 readiness (também depende de Alexandria)

load-mode epic
 ├──> #83 bodyweight
 ├──> #82 cardio
 └──> #84 per-side semantics

#86 exercise taxonomy
 └──> #85 library/equipment filters

#74 plateau
 └──> #75 cut-risk interpretation (+ nutrition/readiness evidence)
```

---

# Sprint 12 — Trust Before Breadth

> **Gate estratégico:** este documento autoriza planejamento, não implementação. OpenCode e Antigravity só recebem task files após aprovação explícita do Lucca.

**Goal:** remover um bloqueio Android, corrigir uma métrica enganosa e criar a identidade estrutural necessária para ocorrências repetidas sem conflar sets.

**Architecture:** três worktrees isolados partem do mesmo `master`. AGY fica com lanes conhecidas e bounded de UI/analytics; OpenCode recebe a fundação de estado/schema dividida em tickets pequenos e sequenciais. Hermes escreve/valida contratos RED, controla allowlists, integra commits e roda todos os gates.

**Tech stack:** Expo 54, React Native 0.81, Expo Router 6, Drizzle/SQLite, Jest 29, TypeScript 5.9.

## Wave 0 — Hermes: contratos e isolamento

1. Criar branch de integração `sprint/12-trust-before-breadth` somente após aprovação.
2. Criar três worktrees sob `~/Projects/iron-log-wt/`:
   - `s12-folder-keyboard`;
   - `s12-occurrence-identity`;
   - `s12-e1rm-honesty`.
3. Um task file por lane, com allowlist de arquivos e skills `sprint-delivery-protocol` + `react-native-expo-delivery`.
4. Hermes cria e executa contratos RED que falhem pelo motivo certo; testes ficam locked para os devs.
5. Nenhum agente toca `.omh/`, `CLAUDE.md`, package files fora da sua lane ou GitHub state.

## Lane A — Antigravity: #97 Android folder keyboard

**Ownership exclusivo:**
- `components/FolderManagerModal.tsx`;
- teste novo dedicado em `__tests__/components/` ou `__tests__/quality/`;
- i18n somente se copy realmente mudar (não previsto).

**Contrato:**
1. Campo focado e CTA ficam alcançáveis com teclado Android aberto.
2. Create e rename usam a mesma solução, sem layout duplicado.
3. Taps no CTA funcionam com teclado aberto.
4. Sheet continua limitado por safe area e sem regressão iOS.
5. Nada de timeout/manual `Keyboard.dismiss()` como gambiarra para confirmar.

**Verification da lane:** teste direcionado, typecheck, lint do arquivo e `git diff --check`.

**Runtime gate:** Android físico, create + rename, teclado PT-BR, light/dark. Coletar todos os defeitos antes de corrigir; nenhuma alteração durante a coleta.

## Lane B — OpenCode: #96 occurrence identity end-to-end

A issue original está subespecificada. O target não é “aceitar duplicate insert”; é distinguir ocorrências em authoring, runtime e persistência.

### B1 — Schema/migration

**Ownership:** `src/db/schema.ts`, nova migration `drizzle/0021_*.sql`, `drizzle/meta/*`, testes de migration/schema.

- `routine_exercises` ganha `id` autoincrement como PK.
- `(routine_id, exercise_id)` deixa de ser unique.
- `order_index` representa ordem; definir invariant de unicidade por rotina se o SQLite/migration suportar sem risco.
- `sets` ganha `routine_exercise_id` nullable.
- Histórico existente permanece válido com null; não inventar backfill quando a ocorrência histórica não puder ser provada.
- Migration preserva todas as rows e FKs/índices.

### B2 — Authoring/query identity

**Ownership:** `app/routines/editor.tsx`, `app/routines/templates.tsx`, `hooks/use-routines.ts`, `components/RoutinePreview.tsx`, tipos/utils/testes diretamente relacionados.

- Toda row projetada inclui `routineExerciseId`.
- Duas ocorrências do mesmo `exerciseId` recebem identidades e keys distintas.
- Duplicar rotina/template preserva quantidade, ordem, target, notes e rest por ocorrência.
- Picker pode adicionar o mesmo exercício duas vezes sem conflar state local.

### B3 — Runtime + set attribution

**Ownership:** `app/session/[routineId].tsx`, `app/session/exercise.tsx`, `hooks/use-exercise-sets.ts`, `src/validators/routes.ts`, draft/persistence tests relacionados.

- Route inclui `routineExerciseId`.
- FlatList usa occurrence id, não exercise id.
- Progresso por card consulta `sets.routineExerciseId` com fallback histórico explícito.
- `findIndex`/next navigation distingue a primeira e a segunda ocorrência.
- Novos sets persistem occurrence id.
- Draft key inclui occurrence id para não restaurar dados da ocorrência errada.

### B4 — Finish/export compatibility

**Ownership:** `app/session/finish.tsx`, `app/session/summary.tsx`, `services/NotionExportService.ts` e testes correspondentes.

- Targets de duas ocorrências iguais não se sobrescrevem num `Map<exerciseId,...>`.
- Summary/export preserva as duas ocorrências e seus targets.
- Analytics/histórico continuam agregando por exercício quando essa é a semântica correta.
- Dados históricos com occurrence null continuam legíveis.

**Hard acceptance:** criar rotina A/B/A, iniciar, logar sets nas duas ocorrências de A, ver progresso separado, finalizar e exportar sem perder/conflar target.

**Sizing:** máximo de dois production files por dispatch OpenCode; B1→B4 são sequenciais dentro da lane. Se o executor morrer, Hermes salva o diff verificado e redespacha apenas o restante.

## Lane C — Antigravity: #91A e1RM honestidade + origem

**Ownership exclusivo:**
- `services/AnalyticsService.ts`;
- `app/bio/analytics.tsx`;
- `__tests__/services/analytics.test.ts` e teste de integração do serviço;
- traduções das quatro línguas se houver nova copy.

**Contrato:**
1. `estimateE1RM` não publica estimativa para reps > 12.
2. Sets >12 são excluídos do ranking, não convertidos em “0 kg”.
3. O melhor set é escolhido pela melhor estimativa válida, não simplesmente pelo maior peso.
4. Cada linha mostra origem mínima: peso × reps e data/sessão quando disponível.
5. O teste importa a função de produção; remove a reimplementação que hoje consagra 20 reps.
6. Calculadora avulsa fica fora da Sprint 12 e mantém #91 aberta como follow-up residual.

**Verification da lane:** testes direcionados, typecheck, lint e `git diff --check`.

## Paralelização real

```text
Tempo ─────────────────────────────────────────────────────────>

Lane A / AGY      RED → #97 implementation → static gate → espera QA
Lane B / OpenCode RED → B1 → B2 → B3 → B4 → migration/runtime gate
Lane C / AGY      RED → #91A implementation → static gate
Hermes            specs ─ review A/C ─ integrate A/C ─ review/integrate B ─ full gate
```

A e C podem integrar enquanto B continua porque não compartilham production files com a lane estrutural. Dentro de B não existe paralelismo honesto: schema, authoring, runtime e export dependem do passo anterior.

## Gates de integração

1. Diff allowlisted de cada worktree; incluir untracked files na inspeção.
2. Review correctness/data-integrity por leaf subagent, sem edição.
3. Review Ponytail/complexity independente, sem edição.
4. Após qualquer correção: teste afetado primeiro, depois gate completo.
5. Gate completo no checkout principal:
   - `npm run test -- --runInBand`;
   - `npm run typecheck`;
   - `npm run lint`;
   - `npm run audit:high`;
   - `git diff --check`.
6. Migration smoke em banco existente copiado e banco fresh; comparar counts antes/depois.
7. `npm run export:android` + `npm run verify:android-export` porque schema/runtime mudam.
8. QA Android físico final no checkout principal, nunca em worktree.

## Non-goals da Sprint 12

- Implementar superset (#79), freestyle (#80) ou add/remove mid-session (#81).
- Mudar load semantics de bodyweight/cardio/per-side (#82–#84).
- Adicionar keep-awake/rest notification (#88/#89) antes de integrar #96.
- Criar agenda diária, manifest ou readiness (#65/#67/#71/#72/#87/#95).
- Upgrade de Expo ou `npm audit fix --force` (#76).
- Fechar/relabelar issues automaticamente.

## Exit criteria

- #97 aprovado em Android físico para create e rename.
- A/B/A persiste e executa com progresso separado por ocorrência.
- Histórico antigo continua legível e migration não perde rows.
- e1RM nunca é publicado a partir de >12 reps e mostra origem verificável.
- 103 suites/894 testes é apenas baseline; o novo total precisa passar integralmente.
- Zero regression em typecheck/lint/audit gate/export Android.
- Só depois desses gates: propor fechamento de #96/#97 e atualização parcial de #91.

---

## Reconciliação com a supersprint

Este é o spec detalhado da primeira etapa do programa canônico
[`2026-08-27-zero-backlog-supersprint.md`](./2026-08-27-zero-backlog-supersprint.md).

As decisões de planejamento foram incorporadas ao programa:

1. #91A permanece na Sprint 12; a calculadora residual termina #91 na Sprint 14.
2. #96 inclui `sets.routine_exercise_id` nullable, aceitando histórico antigo sem backfill inventado.
3. #63/#68/#69/#73 entram no hygiene batch da Sprint 12; #94 entra como wontfix por ausência de licença redistribuível comprovada.
4. #88/#89 ficam na Sprint 13, depois do package baseline de #76, para reduzir conflito e repetir QA nativa uma única vez.

**Gate preservado:** essas decisões aprovam o desenho do programa, não autorizam dispatch, mudanças no GitHub ou implementação. A Sprint 12 só começa após autorização explícita do Lucca.

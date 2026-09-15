# T26 — Sprint Trust Closure Matrix

Status desta matriz: **PRELIMINAR / PARTIAL**. O objetivo é reconciliar os critérios de aceite (AC) com o código, os testes e as evidências históricas atuais. Esta entrega é de validação/documentação; não implementa correções nem fecha issues por inferência.

## 1. Identificação e regras de leitura

| Campo | Valor |
| --- | --- |
| Task | T26 — Revalidar entregas existentes e reconciliar docs |
| Worktree | `/home/lucca/Projects/iron-log-wt/trust-T26` |
| Branch | `sprint/trust-T26` |
| Base/HEAD auditado | `32f494fed063d1be692c8a4eb2fb6da5aab4946b` |
| Data do HEAD | 2026-09-14T18:36:39-03:00 |
| Escopo | Validação e documentação somente |
| Arquivo alterado | Este arquivo; único arquivo allowlisted |
| Issues | Nenhuma issue alterada |
| Locales | Nenhum dos quatro arquivos de locale foi alterado; fragmento externo para T28 na seção 8 |

Os rótulos usados abaixo significam:

- **PASS — escopo indicado:** a evidência sustenta somente o critério explicitamente delimitado; não implica fechamento de lacunas vizinhas.
- **PASS histórico:** o resultado existe em um registro anterior; não substitui o reteste atual.
- **PASS host:** teste de unidade/integração ou inspeção de código; não é prova de dispositivo nativo.
- **BLOCKED:** há uma lacuna contratual, decisão pendente ou falha que impede fechar o AC.
- **NOT RUN:** a validação não foi executada nesta tarefa.

Testes `quality` baseados em `readFileSync`, presença de strings ou regex são tratados como **evidência estática**. Conforme `docs/qa/agent-workflow.md:153-179`, eles não são descritos como device E2E. Mocks de backup, OAuth, share ou Drive também não provam integração remota real.

## 2. Índice de handoff e histórico preservado

Os documentos abaixo são referências históricas; esta matriz não sobrescreve nem reinterpreta seus resultados como reteste atual.

| Referência | Estado neste handoff | Evidência preservada |
| --- | --- | --- |
| `docs/qa/2026-09-05-sprint-13-qa-runbook.md` | **HISTÓRICO** | Baseline `supersprint/s12-trust-before-breadth @069d2f2`; 117 suites/957 testes; typecheck, lint, audit e export registrados como verdes; execução via Expo Go/QR. |
| `docs/qa/2026-09-05-sprint-13-qa-findings.md` | **HISTÓRICO** | #97 FAIL em criação e rename nos dois temas; #103 A/B/A e resume OK, mas duplicate key; #88 SUCCESS; reteste posterior de duplicate-key/preview pendente. |
| `docs/plans/2026-09-06-night-digest.md` | **HISTÓRICO** | Branch `@b46ffe1`; 141 suites/1083 testes; #105 e #106 descritos como corrigidos; #97 e duplicate-key/preview ainda dependiam de reteste físico. |
| `docs/qa/agent-workflow.md:153-179` | **CONTRATO DE QA** | Gates host/static não fecham UI/fluxo de dispositivo; o protocolo de AVD/Maestro deve ser reportado separadamente. |
| Esta matriz | **ATUAL / T26** | Faz o mapeamento do estado atual em `32f494f`; não promove claims históricos a evidência atual. |

### 2.1 Índice de commits históricos relevantes

SHAs, datas e subjects foram preservados para rastreabilidade; a presença de um commit não é, sozinha, prova de reteste atual.

| SHA completo | Data | Subject |
| --- | --- | --- |
| `a5e5c4adca4f9b1e8dad05ddccd8554be166719f` | 2026-09-05T23:38:54-03:00 | `feat(session): keep awake during active session with settings toggle (#88)` |
| `4832a9b706a765b0e2070195145b3542a55d5532` | 2026-09-05T22:55:49-03:00 | `fix(session): preserve occurrence identity on resume paths (#103)` |
| `d9f64d0f849e279b67b56745bc164452ea87ebb8` | 2026-09-06T01:18:13-03:00 | `fix(routine): occurrence-keyed preview list, expand state and PR dedupe (QA batch)` |
| `5eb20c2a63a7d39a547a8937e13ef3588a31f8c2` | 2026-09-05T17:42:18-03:00 | `fix(folders): keep manager actions above Android keyboard` |
| `129381cccbca8323f38ab7761ba4d85cf550909f` | 2026-09-06T01:29:53-03:00 | `fix(folders): pin create CTA at panel level, outside scroll — device-verified (#97)` |
| `69389ac2f72e3e68b6e641d23b250e5c146cf0c2` | 2026-09-06T01:34:24-03:00 | `fix(data): reconcile PRs on set delete/undo; scores ignore unfinished sessions (#104,#105)` |
| `4b473af4b24a856bcd8606f86d6b3e2c1df5892a` | 2026-09-06T01:39:43-03:00 | `fix(backup): WAL checkpoint, close-before-restore, integrity gate and orphan cleanup (#102); token seconds math (#106); program transaction (#109)` |
| `d519edceda9c7e759a618354714140f652e3dbcc` | 2026-09-12T21:32:31-03:00 | `fix(trust): fail-closed backup/restore, session recovery navigation, idempotent set mutation` |
| `043b02886c764f449fcde997c7c0faab83f924ff` | 2026-09-12T21:50:56-03:00 | `fix(trust): deterministic PR reconciliation across set delete/edit/undo/restore` |
| `e82330fa8e80b55ff6368f92625ba9e471243d15` | 2026-09-12T20:57:37-03:00 | `fix(trust): safe sqlite snapshot lifecycle, localized decimal parser, security audit remediation` |
| `50768a8ff65f00b7ec2a6c3dc48685192e3e71d1` | 2026-09-13T02:01:58-03:00 | `fix(trust): analytics session-joins, program week semantics, transactional program lifecycle` |
| `f3f26b01129ad69bfa694a69b831d373a35b7891` | 2026-09-14T13:50:07-03:00 | `fix(trust): analytics C1 residual in refresh paths, exercise-sets query budget` |
| `f62eefb1ee6754a28c7f1020686faf70471c1130` | 2026-09-13T02:24:58-03:00 | `fix(trust): atomic routine import/clone, picker filter args, importer unit conversion` |

## 3. Issue-to-evidence matrix

### #88 — keep awake

**Disposition: PASS histórico; reteste atual NOT RUN.**

- **AC/evidência atual:** `hooks/use-keep-awake-setting.ts:8-39` usa `settings.keepAwake`, default `true`, ativa `activateKeepAwakeAsync` quando habilitado e desativa no desligamento/unmount. `app/session/exercise.tsx:65` e `app/session/finish.tsx:46` usam o wrapper; Settings integra o hook em `app/(tabs)/settings.tsx:140`.
- **Teste atual:** `__tests__/quality/keep-awake-contract.test.ts:7-35` passou no foco executado, mas é source-presence/static contract, não device E2E.
- **Evidência anterior:** `a5e5c4adca4f9b1e8dad05ddccd8554be166719f` (2026-09-05); `docs/qa/2026-09-05-sprint-13-qa-findings.md:12-13` registra SUCCESS e o runbook registra S23 em tema escuro.
- **Bloqueio:** o QA legado foi via Expo Go/QR; não houve nesta task build/pacote nativo nem reteste atual de lifecycle. Não promover SUCCESS histórico a PASS de fechamento atual.

### #103 — ocorrência e resume A/B/A

**Disposition: BLOCKED para fechamento atual.**

- **AC/evidência atual:** `src/validators/routes.ts:13-23` exige `routineExerciseId` numérico positivo; `hooks/use-session-persistence.ts:27-48`, `app/_layout.tsx:385-416`, `app/(tabs)/index.tsx:165-193` e `src/utils/notification-routing.ts:145-163` preservam a identidade da ocorrência. O fluxo ativo consome o ID em `app/session/exercise.tsx:72` e adjacências.
- **Teste host atual:** `__tests__/screens/session-draft-recovery.test.tsx` e `__tests__/screens/session-recovery-navigation.test.tsx` passaram com IDs de ocorrência e cenário A/B/A.
- **Evidência anterior:** `4832a9b706a765b0e2070195145b3542a55d5532` (2026-09-05); o finding de 2026-09-05 confirmou separação/resume, mas registrou duplicate key `1` em `app/[routineId]/[routineId].tsx:371`. `d9f64d0f849e279b67b56745bc164452ea87ebb8` (2026-09-06) corrigiu caminhos de preview/list/expand/PR dedupe.
- **Bloqueio:** o findings e o digest marcam o reteste de device pós-fix como pendente. A fonte atual usa `routineExerciseId` no `app/session/[routineId].tsx:336`, mas isso não substitui o reteste do fluxo instalado/nativo.

### #97 — Folder Manager com teclado

**Disposition: BLOCKED para fechamento atual.**

- **AC/evidência atual:** `components/FolderManagerModal.tsx:72-82` faz scroll para o input; `:144-166` usa Modal/KeyboardAvoidingView com comportamento por plataforma, `maxHeight` e `flexShrink`; `:182-189` usa `automaticallyAdjustKeyboardInsets`/`keyboardShouldPersistTaps`; handlers de create/rename estão em `:197-210` e `:229-242`. Os CTAs ficam fora do ScrollView.
- **Teste atual:** `__tests__/quality/folder-keyboard-device-contract.test.ts:7-31` passou no foco executado, mas apenas verifica fonte/regex; não prova teclado, viewport ou CTA em AVD/iOS.
- **Evidência anterior:** o finding de 2026-09-05 foi FAIL para criação e rename nos dois temas. `5eb20c2a63a7d39a547a8937e13ef3588a31f8c2` (2026-09-05) e `129381cccbca8323f38ab7761ba4d85cf550909f` (2026-09-06) registram os fixes; o subject do segundo diz device-verified, porém o digest posterior ainda exige re-test.
- **Bloqueio:** não houve AVD/device atual nesta task. O claim de source/regex não será tratado como E2E.

### #105 — Analytics: ignorar sessão inacabada no escopo original

**Disposition: PASS no escopo original; residual C1/F04 BLOCKED separadamente.**

- **AC/evidência atual:** `services/AnalyticsService.ts:439-485` filtra `deletedAt IS NULL` e `endTime IS NOT NULL` em `getFullAnalytics`; o mesmo critério aparece em `:508-541` (strength), `:552-565` (consistency), `:575-604` (volume), `:619-635` (progressions) e `:705-724` (estimated 1RM).
- **Testes atuais:** `__tests__/services/analytics.test.ts:149-184` e `__tests__/services/analytics-refresh.test.ts:23-110` cobrem exclusão de sessões abertas e passaram no foco executado.
- **Histórico:** `69389ac2f72e3e68b6e641d23b250e5c146cf0c2` (2026-09-06), reforçado por `50768a8ff65f00b7ec2a6c3dc48685192e3e71d1` (2026-09-13) e `f3f26b01129ad69bfa694a69b831d373a35b7891` (2026-09-14).
- **Residual que não fecha F04/C1:** `services/HistoryQueryService.ts:155-217` mantém sessões sem `endTime`; `services/CsvExportService.ts:49-58` e `services/AlexandriaExportService.ts:306-317` filtram `deletedAt`, não `endTime`; `hooks/use-personal-records.ts:329-355` inclui atividade para PR provisional. A política para linhas legadas/importadas sem `endTime` ainda precisa de decisão explícita. Não auto-completar nem apagar essa população nesta task.

### #106 — expiração de token Google

**Disposition: PASS para matemática/helper local; BLOCKED para cloud E2E.**

- **AC/evidência atual:** `src/utils/google-token.ts:10-20` reconhece `issuedAt` em segundos (`< 10000000000`) e converte para milissegundos; usa `expiresIn` default de 3600. `isTokenExpired` em `:26-32` aplica buffer de cinco minutos. `app/(tabs)/settings.tsx:148-155` usa o helper e `:278-305` gateia backup cloud.
- **Teste atual:** `__tests__/utils/google-token.test.ts:3-65` cobre seconds, milliseconds, `issuedAt` ausente/default e janela fresh/expired/buffer; passou no foco executado.
- **Histórico:** `4b473af4b24a856bcd8606f86d6b3e2c1df5892a` (2026-09-06). O `backup-failure-matrix.test.ts:336-390` usa mocks de snapshot/upload.
- **Bloqueio/dependência:** não houve OAuth/Drive real nesta task; mock não prova token aceito, upload ou recebimento. Reteste cloud depende de T03B/T27.

## 4. Contratos C1–C8

### C1 — Sessões e sets válidos

**Status geral: BLOCKED.** Há partes host corretas, mas a política de incompletas/legadas não está fechada.

- **PASS — Analytics com sessão concluída:** `services/AnalyticsService.ts:439-604,619-635,705-724` exige `deletedAt IS NULL` e `endTime IS NOT NULL` nos caminhos atuais. `analytics.test.ts:149-184` e `analytics-refresh.test.ts:23-110` passaram.
- **PASS — PR provisional durante treino:** `hooks/use-personal-records.ts:329-355` preserva a atividade ativa; `__tests__/services/personal-record-reconcile.test.ts:501-533` passou. Não aplicar `endTime` cegamente a esse fluxo.
- **PASS — recovery continua expondo sessão ativa:** a reconstrução em `app/_layout.tsx:385-416` trata a sessão recuperável com sua ocorrência; isso não é uma autorização para contar a sessão como concluída.
- **BLOCKED — History/export policy:** `services/HistoryQueryService.ts:155-217`, `services/CsvExportService.ts:49-58` e `services/AlexandriaExportService.ts:306-317` ainda têm políticas diferentes para linhas sem `endTime`.
- **BLOCKED — legacy/imported rows:** não existe nesta task decisão aprovada para concluir ou apagar automaticamente linhas sem `endTime`. Corrigir somente soft-delete inequívoco exige decisão; F04 permanece aberto.

### C2 — Decimal localizado e inteiros

**Status geral: BLOCKED.** O parser e seus consumidores principais estão cobertos, mas há fallback de boundary que pode truncar entrada inválida.

- **PASS — parser:** `src/utils/localized-decimal.ts:58-138` aceita uma vírgula ou ponto simples, rejeita mistura/ambiguidade/lixo e distingue estados; `__tests__/utils/localized-decimal.test.ts:13-150` passou.
- **PASS — compartilhamento nos validators:** `src/validators/forms.ts:9-14,55-71` consome o parser compartilhado; `__tests__/quality/session-ui-device-contract.test.ts:54-112` passou no foco.
- **PASS — reps/RIR inteiros no contrato host:** os validators e testes de UI contratual verificam o caminho inteiro correspondente.
- **BLOCKED — boundary de edição:** `app/session/finish.tsx:191-194` usa fallback `(parseFloat(prev) || 0)` após o estado inválido do parser; isso pode truncar uma entrada inválida. Não há teste de boundary que feche esse caso.
- **BLOCKED/NOT VERIFIED — assinatura T02:** a publicação/aprovação da assinatura exata antes dos consumidores não foi revalidada nesta task; não inventar consumidor adicional.

### C3 — Mutação idempotente

**Status geral: BLOCKED.** O caminho normal e os testes de retry existem, mas a falha ao persistir o token e o legado sem token não têm política fail-closed fechada.

- **PASS — estrutura atual:** `src/db/schema.ts:57-76` contém `operationId` e índice único; o caminho de `app/session/exercise.tsx:438-493` gera/persiste antes do save normal; `hooks/use-exercise-sets.ts:129-200` consome a operação.
- **PASS — retry/valores:** `__tests__/services/session-mutation.test.ts:206-379` e o cenário de recovery em `__tests__/screens/session-draft-recovery.test.tsx:166-315` passaram; cobrem mesma operação retornando o set existente e operação diferente com mesmos valores permanecendo válida.
- **BLOCKED — persistência antes do save:** `app/session/exercise.tsx:451-460` captura falha ao persistir o `operationId` e continua o save. Não há fault test que prove comportamento seguro nesse caso.
- **BLOCKED — legado:** `saveSetMutation` aceita `operationId: null`; a decisão para dados antigos sem token ainda não foi aprovada. Não deduplicar por carga/reps.
- **NOT RUN — proposta de schema:** o brief trata coluna nullable/índice único como proposta aditiva para revisão; esta task não altera nem aprova schema.

### C4 — PR e rollback tx-aware

**Status geral: BLOCKED.** Existem implementações e testes relevantes, mas há duas APIs e divergência de ordenação/proveniência.

- **PASS parcial — reconciliação host:** `services/SessionLifecycleService.ts:51-194` e `hooks/use-personal-records.ts:285-440` têm caminhos de reconciliação; `__tests__/services/personal-record-reconcile.test.ts:234-296` passou.
- **BLOCKED — uma API tx-aware:** as duas implementações não são uma API comum única para mutação e lifecycle.
- **BLOCKED — ordem determinística:** `SessionLifecycleService.ts:144-149` ordena por `createdAt ?? id`, sem `session.startTime`; a ordenação em `use-personal-records.ts:358-377` é mais completa. Não está fechado o algoritmo cronológico `startTime/createdAt/id` nem provenance em `setDetails`.
- **BLOCKED — legacy/tie/no-reference:** a proposta de promoção de reps, casos sem referência e desempates precisam de decisão antes de implementação; não usar máximo lexicográfico.
- **RED inicial / GREEN no reteste — suíte de lifecycle:** a primeira execução do foco teve 11 falhas em `__tests__/services/session-lifecycle.test.ts`, incluindo triggers de fault injection/AsyncStorage que não lançaram como esperado e contaminação entre testes (`Simulated SQLite body_metrics failure`, `AsyncStorage disk write error`, `Simulated discard failure on sessions`, `Simulated PR delete failure`). O reteste final passou a suíte; C4 continua BLOCKED pelas duas APIs, ordenação/proveniência e decisões pendentes, não por uma afirmação de fechamento baseada somente no rerun. Como o escopo é documentação, a suíte não foi alterada.

### C5 — Pertencimento a programa

**Status: PASS host; device/E2E NOT RUN.** O núcleo de semana/janela está coberto, mas os caminhos de UI instalados não foram exercitados.

- **PASS — semana atual e não-negatividade:** `services/program/dashboard.ts:12-23` calcula/clampa a semana atual; `services/TodayWorkoutService.ts:20-65` rejeita pré-início e ausência de rotina planejada.
- **PASS — pertencimento:** `services/program/dashboard.ts:51-84,171-235` exige rotina planejada/janela e sessão concluída; outra rotina não completa a semana e `routineId` nulo não vira wildcard. Testes de dashboard passaram.
- **PASS — Home não oferece futuro como hoje:** a regra host de `TodayWorkoutService.ts:20-65` cobre o pré-início; não foi executado fluxo visual em dispositivo.
- **PASS — sem modelo diário novo:** não há alteração desta task para introduzir modelo diário.
- **BLOCKED residual C1:** `getKeyLifts` em `services/program/dashboard.ts:291-309` e `getDoubleProgressionStatus` em `services/progression.ts:30-50` não filtram `sessions.endTime`; não ampliar o PASS do pertencimento para esses caminhos analíticos.

### C6 — Rotina/import

**Status geral: BLOCKED.** O import/clone transacional host está coberto, mas identidade de conflito e double-tap não fecham o contrato completo.

- **PASS — validação antes da escrita e no-overwrite:** `services/RoutineImportService.ts:103-140,206-260` valida, procura conflito antes do write e usa transação; `__tests__/services/routine-import.test.ts:328-372` passou.
- **PASS — lookup de exercício e ocorrência:** `RoutineImportService.ts:142-250` usa lookup normalizado e preserva ocorrência; A/B/A e clone são exercitados em `__tests__/services/routine-import.test.ts:168-218` e `routine-share.test.ts:150-247`.
- **BLOCKED — nome da rotina:** `RoutineImportService.ts:127-131` usa `eq` case-sensitive para o conflito de nome; lookup normalizado de exercício não prova identidade normalizada de rotina.
- **BLOCKED — mesma operação/double-tap:** não há `operationId` explícito para bloquear duas submissões de UI da mesma operação; nenhum device/E2E de double-tap foi executado.
- **PASS parcial — não usar LIKE como identidade:** o caminho inspecionado usa `eq`/lookup exato e não apresenta LIKE como identidade, mas o conflito case-sensitive impede fechar o AC de normalized exact lookup.

### C7 — Tempo e data

**Status: PASS host; matriz real de timezone NOT RUN.**

- **PASS — calendário local e limites SQL:** `services/HistoryQueryService.ts:56-103,199-241` usa chave de calendário local e intervalos start-inclusive/end-exclusive.
- **PASS — instantes/fallback:** `services/AnalyticsService.ts:617-635,702-722` usa `createdAt` com fallback para `sessions.startTime`, nunca ID, nos caminhos atuais; helpers UTC intencionais não foram alterados.
- **PASS host — testes:** `__tests__/services/history-query.test.ts:438-472` e `__tests__/services/program-dashboard.test.ts:402-438` passaram e cobrem limites nomeados UTC-3/UTC+14.
- **NOT RUN — processo em TZ distintas:** o foco não executou uma matriz com configurações reais de timezone/processo; o nome do teste não será apresentado como prova de device ou de matriz operacional completa.

### C8 — Notificações e exports

**Status geral: BLOCKED.** Os contratos host de destino/allowlist/dedupe estão cobertos, mas faltam prova nativa e limites de integração remota.

- **PASS host — categorias/IDs:** `services/NotificationService.ts:24-34` define IDs/canais por categoria; `__tests__/services/notification-permission.test.ts:261-271` passou.
- **PASS host — allowlist e cold/warm dedupe:** `src/utils/notification-routing.ts:16-77,178-219` implementa destinos permitidos e dedupe; `__tests__/screens/notification-response.test.tsx:76-140,293-335` passou.
- **NOT RUN/BLOCKED — runtime nativo:** não houve prova atual em Android nativo de canal, permissão ou cold response após boot pronto. Testes de permissão/response não substituem esse gate.
- **PASS limitado — sharing:** `__tests__/services/csv-export.test.ts:317-386` e `alexandria-export.test.ts:499-528` cobrem arquivo oferecido/erro/cancelamento conhecido.
- **NOT PROVEN — recebimento remoto:** `shareAsync` não prova que um destino remoto recebeu o arquivo; Drive real permanece fora desta evidência e depende do fluxo T03B/T27.
- **OS boundary:** force-stop de Settings é limite do sistema operacional, não uma correção a fabricar nesta task.

## 5. Verificação executada nesta task

### 5.1 Foco de testes

Com Node `v22.22.2` e npm `10.9.7`, o mesmo foco foi executado duas vezes: a primeira execução registrou RED; o rerun final, após a edição documental, registrou GREEN. Comando:

```text
npm test -- --runInBand --watchAll=false __tests__/quality/keep-awake-contract.test.ts __tests__/quality/folder-keyboard-device-contract.test.ts __tests__/utils/google-token.test.ts __tests__/services/analytics.test.ts __tests__/services/analytics-refresh.test.ts __tests__/services/session-mutation.test.ts __tests__/screens/session-draft-recovery.test.tsx __tests__/screens/session-recovery-navigation.test.tsx __tests__/services/personal-record-reconcile.test.ts __tests__/services/session-lifecycle.test.ts __tests__/services/history-query.test.ts __tests__/services/routine-import.test.ts __tests__/services/routine-share.test.ts __tests__/services/program-dashboard.test.ts __tests__/services/notification-permission.test.ts __tests__/screens/notification-response.test.tsx __tests__/services/csv-export.test.ts __tests__/services/alexandria-export.test.ts __tests__/utils/localized-decimal.test.ts __tests__/quality/session-ui-device-contract.test.ts
```

- **Primeira execução — exit code 1 / RED parcial:** 20 suites, 19 passed e 1 failed; 338 testes, 327 passed e 11 failed; 0 snapshots; 9.64s. A suíte falha foi `__tests__/services/session-lifecycle.test.ts`, com fault injection/AsyncStorage e contaminação de triggers entre testes.
- **Rerun final — exit code 0 / GREEN do foco:** 20 suites passed, 338 testes passed, 0 snapshots, 4.142s. A suíte de lifecycle passou no rerun.
- **Suites cobertas no foco:** personal-record-reconcile, session-mutation, session-draft-recovery, session-recovery-navigation, history-query, routine-import, routine-share, program-dashboard, notification-permission, notification-response, csv-export, alexandria-export, localized-decimal, session-ui-device-contract, analytics, analytics-refresh, google-token, keep-awake-contract, folder-keyboard-device-contract e session-lifecycle.
- **Limite:** o GREEN é somente do foco Jest; não é GREEN de typecheck/lint/device/export/cloud e não remove os bloqueios contratuais descritos acima.

### 5.2 Gates não executados

Todos os itens abaixo são **NOT RUN**, por serem investigação/documentação e/ou exigirem ambiente não executado nesta task:

- `npm run typecheck` — NOT RUN.
- `npm run lint` — NOT RUN.
- `npm run test:coverage` — NOT RUN.
- `npm run audit:high` — NOT RUN.
- `npm run export`/export Android e verificação de export — NOT RUN.
- build/install Android, `scripts/qa.sh boot|install|app|smoke|logs|snap|reset|stop`, AVD/Maestro e device iOS — NOT RUN.
- OAuth/Google Drive real, recebimento remoto de compartilhamento e teste de force-stop via Settings — NOT RUN/fora da prova host.

Não foram executados `npm install`, migrações, builds destrutivos ou alterações em dados reais.

## 6. Lacunas, dependências e decisões necessárias

1. **C1/F04:** decidir e documentar a política de sessões legacy/imported sem `endTime`; não completar/apagar automaticamente. Corrigir somente soft-delete inequivocamente identificado após decisão.
2. **C2:** remover ou cobrir o fallback de `parseFloat` no boundary de edição; T02 precisa publicar/aprovar a assinatura exata antes de novos consumidores.
3. **C3:** decidir comportamento fail-closed quando a persistência do `operationId` falha e a política para linhas legacy sem token; não deduplicar por carga/reps.
4. **C4:** escolher uma API tx-aware comum, fixar ordenação `startTime/createdAt/id`, provenance, referência ausente e desempates; a suíte de lifecycle também precisa de diagnóstico separado da contaminação de fault injection.
5. **C5:** manter o PASS restrito ao host/program membership até haver QA de UI; reavaliar os caminhos analíticos sem `endTime` como residual C1.
6. **C6:** decidir identidade normalizada de nome de rotina e mecanismo de idempotência da submissão de UI antes de afirmar double-tap fechado.
7. **C7:** executar matriz de processo com timezones reais, sem alterar helpers UTC intencionais.
8. **C8/#106:** T03B/T27 precisam fornecer OAuth/Drive e runtime Android nativos; share oferecido não deve ser convertido em claim de recebimento remoto.
9. **#88/#97/#103:** repetir os fluxos no pacote nativo/AVD atual; o histórico via Expo Go e os testes estáticos não bastam.

## 7. Assumptions explicitamente não aprovadas

- A população legacy/imported sem `endTime` **não** foi tratada como concluída nem apagada.
- A proposta de promoção cronológica C4 é uma hipótese para revisão, não uma decisão implementada.
- A coluna/índice nullable de C3 é uma proposta aditiva do brief, não autorização para alterar schema.
- O título `device-verified` do commit `129381c...` não supera o finding/digest que deixou o reteste pendente.
- Nenhum teste mock, source-presence, regex ou teste host foi contado como device E2E, remote receipt ou OAuth/Drive real.

## 8. Fragmento externo de locale para T28

**Não aplicar neste branch. Não editar os quatro arquivos de locale.** Este fragmento apenas entrega ao integrador T28 as mensagens de status para tradução pt/en/es/zh; não há strings de produto introduzidas por T26.

```json
{
  "qa.trustClosure.historicalOnly": "Historical evidence only; current retest not run.",
  "qa.trustClosure.hostOnly": "Host validation passed; device validation not run.",
  "qa.trustClosure.blocked": "Blocked: contract, decision, or evidence is still missing.",
  "qa.trustClosure.remoteReceiptUnproven": "Sharing was offered or handled locally; remote receipt was not proven.",
  "qa.trustClosure.incompleteSessionPolicy": "Incomplete and legacy session policy requires an explicit decision."
}
```

## 9. Handoff final

- **task_id:** `T26`
- **base_sha:** `32f494fed063d1be692c8a4eb2fb6da5aab4946b`
- **arquivo novo:** `docs/qa/sprint-trust-closure-matrix.md`
- **arquivos modificados fora da allowlist:** nenhum
- **stage/commit/push:** não executados
- **resultado:** matriz preliminar entregue; #105 está fechado somente no escopo original, #88 tem evidência histórica sem reteste atual, #103/#97 estão bloqueados por reteste físico, #106 está fechado na matemática local mas bloqueado no cloud; C1/C2/C3/C4/C6/C8 permanecem bloqueados pelas lacunas acima.

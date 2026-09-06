# Iron Log — limpeza, performance, workflow e triagem: plano de execução

> Executor: **AGY via ACP oficial Google**. Hermes/Core é PM, reviewer e responsável por integração/publicação. Não usar `delegate_task` como substituto do executor. Subagentes Hermes continuam pinados em Luna; isso não muda a lane AGY solicitada pelo usuário.

**Objetivo:** reduzir código sem valor, reter otimizações mensuráveis, tornar a verificação reproduzível e classificar cada item aberto no GitHub sem fechar trabalho válido por idade.

**Arquitetura:** uma lane serial em worktree isolado da master remota, com mudanças pequenas por frente. Sem alteração de arquitetura do app, schema ou contratos de produto. Testes chamam funções reais; benchmark reutiliza o serviço real e fixtures sintéticas. Core executa as ações remotas somente depois de revisar o resultado.

**Stack:** Expo SDK 54 / React Native / TypeScript / SQLite + Drizzle / Jest 29 / Node 22 / npm 10.

## 0. Contrato, ownership e estado inicial

### Diretórios e branch

- Único worktree de escrita: `/home/lucca/Projects/iron-log-wt/lean-performance-workflow`.
- Branch: `audit/lean-performance-workflow`.
- Base inicial: `origin/master`, SHA `259d33beaadb74821ac06606fe17b149b8c6e6df`.
- Principal **somente leitura**: `/home/lucca/Projects/iron-log`, branch `supersprint/s12-trust-before-breadth`, HEAD `6013f61` na descoberta.
- Existem outros worktrees `s12-*`. Não editar, limpar, rebasear, remover nem reutilizar nenhum deles.
- Não commitar, stagear, dar push, merge, fechar issues ou alterar labels nesta passagem AGY. O usuário autorizou a entrega geral; Core retém o gate de publicação.
- Não ler `.env`, tokens, bancos/fotos reais, keystores, signing credentials nem `android/gradle.properties`. `EXPO_NO_DOTENV=1` para comandos Expo. Não instalar build de teste sobre app real, limpar dados de device ou criar serviços sem autorização adicional.

### O que já existe neste worktree

Nenhum arquivo tracked de produção foi modificado pelo Core. Existem dois arquivos **untracked de experimento**, não entregues nem aprovados:

1. `__tests__/fixtures/database.ts` — conexão better-sqlite3 em memória + aplicação de migrations.
2. `__tests__/services/analytics-database.test.ts` — esboço de teste/benchmark do serviço.

**Esses dois arquivos NÃO são testes RED bloqueados.** A suíte falha na inicialização do fixture, antes de qualquer assertion. AGY pode corrigir/reduzir/reescrever esses dois arquivos. Não assumir os expected values, seeds, IDs ou timezone corretos. As cópias pré-handoff estão arquivadas fora do repo.

### Evidência preexistente e suas limitações

Artefatos em `/home/lucca/.hermes/assignments/iron-log-focus-audit/`:

- `remote-inventory.json`: snapshot completo de bodies/comments/labels, **41 issues abertas, zero PRs abertas**. Refazer leitura live antes da triagem final.
- `install.log`: `npx --yes npm@10.9.7 ci` concluiu neste worktree, instalou dependências locais (não symlink).
- `baseline-benchmark.log`: FAIL `SqliteError: no such column: "duration_seconds" - should this be a string literal in single-quotes?` ao aplicar migrations no fixture. **Não existe baseline de performance válido ainda.**
- `seed-snapshot/`: cópia dos dois experimentos do Core, somente para comparar.

Outras observações confirmadas:

- Node encontrado: `v22.23.2`, dentro do contrato. npm no PATH: `12.0.2`, **fora** do contrato. Use npm `10.9.7` explicitamente; não altere toolchain global.
- `npm run audit:high` na base saiu **1**, reportando `browserslist` como blocker não allowlisted. Contagem de advisories muda; buscar relatório live, não usar o título antigo de #76 como contagem atual.
- `/opt/android-sdk/platform-tools/adb devices -l` retornou lista vazia. Sem teste físico disponível nessa descoberta. SDK também existe em `/home/lucca/android-sdk`; Java 17 em `/usr/lib/jvm/java-17-openjdk`.
- Os 950 testes e o export verde da revisão anterior eram da branch S12, **não** constituem baseline desta master. A primeira falha de lint anterior era de um wrapper que chamou ESLint de outro projeto; a rerun explícita do lint passou. Não repetir o relato final incorreto de que lint permaneceu quebrado.

## 1. Anti-scope e regras de parada

- Não integrar os quatro commits locais S12 (folder keyboard, e1RM, occurrence identity, honest finish) neste lote. #91/#96/#97 têm trabalho local, não necessariamente entregue na master.
- Não corrigir backup/restore, PR reconciliation, timers, ocorrência A/B/A, semântica de sessões concluídas, modelos de bodyweight/cardio, periodização ou novas features. Auditar e classificar; fixes de alto risco viram próxima lane.
- Não alterar `src/db/schema.ts`, SQL/migration journal/snapshots, nem reescrever migration histórica para fazer um fixture passar. Primeiro provar compatibilidade do driver. Problema real de migration é blocker separado para Core.
- Não remover todos os testes por padrão, nem remover source guards de crashes RN só por serem textuais. Não reduzir coverage thresholds, adicionar `.skip` para falhas reais, mockar o serviço sob teste ou duplicar sua implementação no teste.
- Nada de novo framework de benchmark, sistema genérico de fixtures, gerador de testes, cache global, memoização especulativa ou helpers de uma chamada sem ganho claro.
- Não rodar `npm audit fix --force`, upgrade Expo/React/RN, alterar allowlist de segurança para obter verde nem ampliar permissões.
- Não executar `reset-project.js`: esse script destrói/move a aplicação para um scaffold vazio.
- Permissão negada exige parar aquele caminho e reportar; não contornar por subprocess/API equivalente.
- Se travar numa tarefa após diagnóstico e uma alternativa fundamentada: salvar status BLOCKED/PARTIAL, continuar apenas tarefas independentes. Não gastar a sessão inteira em retries.
- Se faltar tempo: terminar a unidade atual, escrever checkpoint detalhado de feito/em andamento/não iniciado. Não declarar o conjunto concluído.

## 2. Allowlist de escrita da passagem AGY

### Produção e workflow

- `hooks/use-sessions.ts` — somente remoção de métodos comprovadamente sem caller.
- `services/AnalyticsService.ts` — somente loop de agregação em `calculateVolumeTrends`, se houver ganho medido.
- `scripts/reset-project.js` — remoção permitida após varredura de usos/docs.
- `scripts/audit-high.js` — fix fail-closed de #108, mantendo allowlist atual.
- `scripts/run-android.sh` — apenas respeitar SDK configurado e falhar claramente; sem instalar/buildar em device implicitamente.
- `package.json` — scripts de verificação/benchmark e remoção reset-project; sem novas dependências.
- `package-lock.json` — somente atualização compatível de `browserslist` necessária ao gate; documentar diff e versão, sem churn de outros pacotes.
- `.github/workflows/quality.yml` — apenas reaproveitamento do comando de verificação e preservação dos gates existentes, se isso reduzir duplicação de verdade.
- `AGENTS.md` — documentação de comandos/isolamento/limites, sem substituir regras existentes.

### Testes e documentação

- `__tests__/fixtures/database.ts` (experimento editável).
- `__tests__/services/analytics-database.test.ts` (experimento editável).
- `__tests__/services/analytics.test.ts` (retirar cópias locais após substituição por teste real).
- `__tests__/services/program.test.ts` (importar comportamento real em vez de cópias locais).
- `__tests__/scripts/audit-high.test.ts` (regressões de #108).
- Novo `__tests__/scripts/run-android.test.ts` somente se mudar o launcher e precisar de prova de resolução do SDK, com executáveis fake inofensivos.
- `docs/qa/agent-workflow.md` (runbook reproduzível).
- `docs/audits/2026-09-05-focused-review.md` (relatório final das quatro frentes, cobertura por diretório e tabela completa de triagem).
- Este plano: apenas status factual/checkpoints, não alterar os critérios.
- Evidências locais: `.hermes/audit-evidence/` dentro do worktree (gitignored); saída final também em `/home/lucca/.hermes/assignments/iron-log-focus-audit/AGY-RESULT.md`.

Demais diretórios: leitura para auditoria. Se uma mudança fora da lista for necessária, descrevê-la no relatório, não executá-la.

## 3. Ordem de execução (serial, sem writers concorrentes)

### A0 — Preflight e baseline honesto

**Ler primeiro:** `AGENTS.md`, manifesto/lock, `.node-version`, `.npm-version`, `jest.config.js`, `jest.setup.js`, `.github/workflows/quality.yml`, os dois experimentos e os logs acima.

1. Rodar `git status --short --branch`, `git worktree list`, `git rev-parse HEAD` neste worktree; confirmar paths e anti-scope.
2. Confirmar toolchain (`node --version`, `npx --yes npm@10.9.7 --version`). Dependências locais já instaladas, mas validar resolução local de Jest/ESLint/Drizzle.
3. Rodar baseline `typecheck`, `lint`, testes existentes e `audit:high` separadamente, guardando stdout/stderr e exit codes em `.hermes/audit-evidence/`.
4. Os testes existentes podem ser medidos inicialmente com `--testPathIgnorePatterns=analytics-database.test.ts`, **apenas para separar a falha do experimento da base**; registrar claramente a exclusão. Gate final não pode excluir esse arquivo se ele for entregue.
5. Não apresentar o teste atual quebrado como regressão causada pela mudança futura.

**Gate A0:** base e experimento separados no relatório; nenhum check suposto verde.

### A1 — Inspecionar cada diretório principal

Criar matriz com diretório, arquivos lidos, finding/candidato e decisão manter/remover/deferir. O inventário `git ls-files` é o ponto de partida, não a prova de leitura.

Cobrir obrigatoriamente: raiz/configs; `app` (tabs, session, bio, routines, programs, reports, supplements); `components`; `hooks`; `services` e `services/program`; `src/db`, `src/utils`, `src/validators`, `src/i18n`, `src/types`; `constants`; `scripts`; `__tests__` (quality, services, hooks, screens, utils, validators, components, i18n); `drizzle`; `docs`; `.github`; `assets`; `android` tracked (somente arquivos não sensíveis).

Para assets/binários, auditar referências/manifest/tamanho sem chamar arquivos de código morto por heurística de grep. Arquivos credenciais omitidos por privacidade devem constar como omitidos, não como revisados. Histórico em `docs/plans` não vira stale apenas por ser antigo.

**Gate A1:** toda entrada de primeiro nível tracked tem linha na matriz; cada subárvore crítica citada acima tem inspeção concreta.

### B1 — Destravar fixture sem alterar migrations de produção

**Arquivos:** `__tests__/fixtures/database.ts`, `__tests__/services/analytics-database.test.ts`.

1. Localizar exatamente em qual migration falha a execução; ler `0000` e `0001` e qualquer predecessor relevante. Examinar diferenças de double-quoted string compatibility (`DQS`) e configuração SQLite entre better-sqlite3/Expo, sem assumir que seja a causa.
2. Provar o comportamento com banco em memória e registrar driver/versão. Não ligar flags de compatibilidade indiscriminadamente, pular SQL ou fabricar colunas/tabelas para esconder migration ruim.
3. Se compatibilidade do driver explicar a falha, documentar e aplicar configuração mínima **no fixture**. Se não explicar, registrar blocker de migration e separar benchmark de agregação com fixture de queries que mantenha filtros/semântica explícitos, sem chamar isso de migration E2E.
4. Seed deve ser inteiramente sintético e criado pelo próprio teste: não depender de `exercises` vir populada das migrations, autoincrement IDs implícitos ou dados reais. Restaurar DB/mocks após cada teste; FK ativa e `foreign_key_check` quando aplicável.
5. Congelar relógio e timezone quando needed. O esboço usa semana UTC/local e IDs de sets fixos; verificar ambos. Confirmar saída esperada com cálculo independente pequeno, não copiando o algoritmo de produção para gerar expected.
6. Teste deve chamar o `AnalyticsService` real e o `CsvExportService.exportSessionsCsv` real. Apenas ponte nativa/cliente DB podem ser substituídos por SQLite de teste. Nada de `jest.mock(AnalyticsService)`.

**Gate B1:** teste comportamental passa antes de alterar performance; limite da integração (driver host vs Expo) documentado; fixture não altera produção.

### B2 — Benchmark BASELINE antes de otimizar

**Candidato único inicial:** `services/AnalyticsService.ts::calculateVolumeTrends` faz `allSets.filter(s => s.sessionId === session.id)` dentro do loop de sessões. Potencial O(S×T), mas ganho só conta após medir.

1. Usar o mesmo harness sobre o serviço real, com dois datasets: 50 sessões × 20 sets e 500 × 20 sets. Se medição se perder no custo SQL, registrar isso e não prometer ganho.
2. Warmup de 3 invocações, 25 amostras por dataset, 3 execuções independentes do comando. Reportar median/p95, contagem de queries/rows ou identificador da camada medida, versões e shape do fixture.
3. Guardar digest da saída ou comparação profunda completa da saída BASELINE. Entradas/banco/relógio idênticos no depois.
4. Verificar empty data, warmup-only, séries deletadas, sessões deletadas, sessão sem set, data fora do período e fronteira semanal. **Não** corrigir #105/semântica de conclusão no mesmo diff de performance; saída deve ser idêntica.
5. Benchmark opt-in não pode pular testes comportamentais; não colocar threshold ruidoso de wall clock no CI.

**Gate B2:** baseline numérico real arquivado. Sem baseline, não tocar loop de produção.

### B3 — Uma otimização pequena, conservar só se ganhar

1. Substituir filtros repetidos por indexação/agregação local por `sessionId` em passagem única, mantendo ordem de acumulação, critérios de inclusão, roundings, número/ordem de semanas e output shape.
2. Evitar caching global, memoizações, novo serviço/helper público ou SQL/migration sem necessidade. Preferir Map local e o restante do método intacto.
3. Reexecutar o comando idêntico e mesmos 3 trials. Comparar igualdade de resultado/digest por dataset e median/p95.
4. Retenção: melhora consistente acima do ruído em pelo menos dois dos três trials, nenhuma regressão estável no dataset menor. Documentar números, não inventar meta percentual.
5. Se neutro/pior: desfazer **apenas a própria alteração do loop**, preservar teste/diagnóstico útil e reportar candidato rejeitado. Não escolher métrica/dataset diferente só para fabricar ganho.

**Gate B3:** ganho real + outputs idênticos + testes/lint focados verdes, ou ausência de otimização explicitamente reportada.

### C1 — Remover código realmente sem consumidor

**Arquivos:** `hooks/use-sessions.ts`, `scripts/reset-project.js`, `package.json`.

1. Rastrear `getSessionsByDate` e `clearIncompleteSession` por definição, return do hook, destructuring/callers/tests e referências indiretas. Na descoberta só havia definições/return. Reconfirmar.
2. Se sem consumers, remover os callbacks e chaves do return. Não substituir `getSessionsByDate` por outro wrapper: `History` já usa `toLocalDateKey`. Isso encerra #110 por eliminação de código morto, não por corrigir bug ativo visível na tela.
3. Varredura de `reset-project` em scripts/docs/manifest. Se não há fluxo legítimo, remover script Expo-template que move/apaga app e a entrada `reset-project` do manifesto. Não executar o script para testá-lo.
4. Rodar typecheck e testes de History/home/hooks afetados; confirmar ausência de imports/referências pendentes.
5. Não remover outros callbacks, wrappers/barrels ou helpers apenas por serem pequenos. Todo corte adicional precisa de prova e cabe na allowlist.

**Gate C1:** nenhuma quebra de caller/rota/API em uso, lista exata do que foi removido e por quê.

### C2 — Substituir testes que testam cópias do algoritmo

**Arquivos:** `__tests__/services/analytics.test.ts`, `__tests__/services/program.test.ts`, teste DB.

1. Analytics: manter os testes reais de `estimateE1RM` da master. Remover `calcVolumeScore`, `calcIntensityScore`, `calcConsistencyScore`, `getLabel` definidos só no teste **após** verificar testes equivalentes sobre `calculateStrengthScore` real. As labels copiadas já divergem de produção; não ajustar produção para satisfazer cópia errada.
2. Programs: importar `getCurrentWeek`, `getWeeksUntilDeload`, `getCurrentPhase` reais de `services/program/dashboard.ts` com shape `Program` verdadeiro (ler `src/types/index.ts`). Congelar Date. Remover cópias locais.
3. As cópias locais de `isAtTopOfRange` e `calculateTrend` também não verificam produção. Substituir por casos sobre `getDoubleProgressionStatus` real com DB fixture/query mocks mínimos; não exportar helpers internos de produção só para os testes antigos continuarem existindo.
4. Provar pelo menos um teste real de analytics e um de programa falhando quando seu comportamento de produção é temporariamente sabotado; restaurar integralmente a própria sabotagem, rerun GREEN. Guardar logs RED/GREEN.
5. Não extrair fórmulas de produção para novos módulos sem motivo além do teste. Não remover teste real por redundância sem apontar o outro que cobre a mesma regressão.

**Gate C2:** cobertura de comportamento mantida/melhorada; nenhuma cópia local de fórmula vendida como teste de serviço; queda no número de testes não é por si só sucesso.

### D1 — Fix pequeno do gate de segurança (#108)

**Arquivos:** `scripts/audit-high.js`, `__tests__/scripts/audit-high.test.ts`.

1. Adicionar teste que chama `runAudit` real, mockando apenas `node:child_process.spawnSync`.
2. Casos: JSON com `error` e status 1; JSON `{}`/sem metadata/sem vulnerabilities; stdout inválido/vazio; spawn error; signal/null status; relatório válido sem blockers com status 0; relatório válido com advisories e status 1 (npm retorna 1 mesmo quando a policy local permite advisories); blocker não allowlisted.
3. Demonstrar RED de falha de registry virando zero antes do fix.
4. Validar envelope minimamente, erro do npm e terminação anormal antes de tratar campos ausentes como zero. Não fazer `if (status !== 0) fail` indiscriminado, pois advisories válidos retornam 1.
5. Manter allowlist/policy. Mensagem de falha não pode afirmar zero vulnerabilidades quando audit não ocorreu.

**Gate D1:** testes RED/GREEN registrados, gate falha fechado sem mudar semântica da allowlist.

### D2 — Separar blocker real de dependência (#76)

1. `npx --yes npm@10.9.7 audit --json`, `npx --yes npm@10.9.7 ls browserslist` e advisory live para root cause/cadeia/versão corrigida.
2. Atualização transitiva compatível de browserslist no lockfile é permitida, **somente** se não exigir manifest/override novo nem upgrade da stack. Conferir diff, `npm ci`, testes, Expo compatibility.
3. Se exigir mudança ampla ou permanecer blocker: manter gate vermelho honesto, registrar #76 como blocked; não ampliar allowlist. Isso impede merge, mas não impede concluir relatório/PR draft.

**Gate D2:** advisory resolvido com diff mínimo verificado OU blocker exato mantido aberto. Nada de `npm audit fix --force`.

### D3 — Menor loop de verificação confiável

**Arquivos:** manifesto, workflow (opcional), launcher Android (opcional), `AGENTS.md`, `docs/qa/agent-workflow.md`.

1. Documentar worktree com deps próprias, toolchain pin, comando focado, suíte, bundle e diferença entre host integration/Android build/device E2E.
2. Criar no máximo um script npm `verify` que encadeie os gates existentes (typecheck, lint com zero warnings, test:coverage serial, Android export, verify export), sem engolir exit code. `audit:high` pode permanecer separado no CI para diagnóstico claro.
3. Se CI passar a usar `verify`, manter Node do `.node-version`, npm compatível, npm ci, audit, permissões, timeout e todos os gates atuais. Se não reduzir duplicação de verdade, manter workflow atual e documentar comandos.
4. Benchmark deve ter comando direto documentado (`IRON_LOG_BENCH=1 ... --runTestsByPath ...`), sem instalar ferramenta nova.
5. `scripts/run-android.sh` hoje sobrescreve `ANDROID_HOME` com `$(pwd)/android-sdk`. Se ajustar, respeitar ANDROID_HOME/ANDROID_SDK_ROOT explicitamente configurados, validar `adb`, não dar fallback silencioso para SDK de outro repo e não depender do cwd. Cobrir resolução com teste/smoke de fake executables e `bash -n`. Sem device install real.
6. Runbook deve incluir seeds sintéticas, assert de FK/schema quando possível, como inspecionar `adb logcat` sem coletar dados pessoais, checklist treino → log → undo → background/resume → finish → export e requisito de confirmar package/device antes de qualquer operação destrutiva.

**Gate D3:** comandos realmente executáveis em fresh checkout/worktree, sem wrappers duplicados de utilidade trivial nem comandos que escondem erro.

### E1 — Prova fresca do loop

Depois da última edição:

```bash
cd /home/lucca/Projects/iron-log-wt/lean-performance-workflow
export EXPO_NO_DOTENV=1
export CI=1
node --version
npx --yes npm@10.9.7 --version
npx --yes npm@10.9.7 ci
npx --yes npm@10.9.7 run typecheck
npx --yes npm@10.9.7 run lint -- --max-warnings=0
npx --yes npm@10.9.7 run test:coverage -- --runInBand --watchAll=false
npx --yes npm@10.9.7 run audit:high
npx --yes npm@10.9.7 run export:android
npx --yes npm@10.9.7 run verify:android-export
git diff --check
```

- Executar separadamente ou por driver que registre **cada exit code**, para um gate vermelho não esconder resultados dos demais. Se criar `verify`, rodá-lo também para provar o wrapper, não só seus componentes.
- E2E headless exigido: fixture sintética → persistência SQLite → serviço real → export CSV/summary real e assert do conteúdo. Ser preciso sobre o que esse fluxo NÃO cobre (bridge nativa, UI, device).
- Device: consultar `adb devices -l`. Sem device autorizado, **BLOCKED / NOT RUN** para E2E Android, nunca "E2E passou" por causa do bundle. Não instalar em aparelho do usuário sem autorização.
- Registrar tempo/comando/exit/evidência; performance permanece limitada ao método medido no host, sem extrapolar para FPS ou consumo mobile.

### F1 — Auditar todas as issues e PRs, não só as fáceis

**Snapshot inicial esperado:** 41 issues, 0 PRs. IDs abaixo são checklist, não instrução para fechar. Atualizar conjunto se houver atividade nova e verificar paginação/contagem.

| Issue | Pista inicial — revalidar código/thread/branch antes de classificar |
|---|---|
| #110 | helper UTC sem caller; candidato remover e fechar após merge, não bug visível de History |
| #109 | createProgram não atômico; reativação é eixo de produto separado, não justificativa para ampliar fix |
| #108 | fix fail-closed nesta lane |
| #107 | reminderTime sem scheduler; separar de i18n/notificações mensais, não afirmar cancelAll como solução |
| #106 | issuedAt segundos/ms; easy fix candidato, mas fora desta allowlist de produção |
| #105 | semântica de sessão concluída; necessita contrato, não misturar à otimização |
| #104 | rastrear PR persistido vs e1RM derivado; não dizer que todos os rankings compartilham a tabela |
| #103 | regressão local S12, não presente na master sem routineExerciseId obrigatório; validator rejeita rota, não inferir gravação errada |
| #102 | WAL/export/import são riscos de dados; separar provas de host, mocks e reprodução Android pendente |
| #100 | teclado no treino — QA físico necessário |
| #99 | espaço card/input — critério de produto e QA físico |
| #98 | badge — reprodução visual necessária |
| #97 | fix local 51b6192, ainda não entregue na master deste lote |
| #96 | ocorrência: b99dafe local; não fechar sem merge/migration QA |
| #95 | agenda/reschedule: schema e produto |
| #93 | import trackers: escopo e segurança de dados |
| #92 | export/import plano com merge: conflito/idempotência/dados |
| #91 | e1RM local 0505dea, checar checklist restante e integração |
| #90 | heatmap: critério do que conta como sessão |
| #89 | notificação descanso com app morto: nativo/device |
| #88 | keep awake toggle: comportamento/bateria, novo dep não nesta lane |
| #87 | treino de hoje/peso no início: contrato home/session |
| #86 | muscle group: schema/migração/mapeamento |
| #85 | biblioteca/filtros: depende da taxonomia/metadados |
| #84 | reps por lado: contrato de input/export/analytics |
| #83 | bodyweight: modelo de carga/PR/progressão |
| #82 | cardio: modelo/inputs/unidades |
| #81 | edição mid-session: identidade/persistência |
| #80 | freestyle: ciclo de vida sem routineId |
| #79 | superset: agrupamento/timers/identidade |
| #76 | audit live: browserslist blocker; demais allowlisted não somem por título stale |
| #75 | risco por cut: semântica/coaching/dados; produto |
| #74 | plateau: período/critério/dados; produto |
| #72 | readiness: integração Alexandria/dados disponíveis |
| #71 | atribuição sono: integração e inferência causal |
| #70 | contexto nutricional: ingestão/integridade |
| #67 | main-lane drift/re-entry: contrato do produto |
| #66 | micro-session: alcance/critério de conclusão |
| #65 | schedule manifest: formato/versionamento/consumidor |
| #64 | archive routines: comportamento e links históricos |
| #63 | folders: provável já entregue Sprint 11; verificar todos critérios, UI/hook/FolderService/tests, só recomendar fechamento com prova |

Para cada issue:
1. Ler body E todos os comentários live, linked issues, PRs abertas/fechadas pertinentes, commits recentes e comportamento na **master** vs S12 quando distinto.
2. Classificar exatamente uma categoria primária: `ready to merge`, `easy to fix`, `duplicate`, `stale`, `blocked`, `requiring product input`. Pode listar dependências/estado secundário separadamente. Item já implementado e sem contexto pendente pode ser `stale (already delivered)` com prova, não por idade.
3. Escrever linha com número/URL, categoria, motivo curto, evidência path/commit/test, ação recomendada e dependência/pergunta objetiva se houver.
4. Duplicata exige ID canônico; tarefa antiga válida fica aberta. Usuário escolheu explicitamente **não fechar por inatividade**.
5. Para qualquer PR nova: ler diff completo, base/head, CI do SHA exato, reviews, linked issues e comportamento. Draft ou check ausente não é ready. Zero PRs é resultado válido, não criar uma só para preencher a categoria.
6. Preparar comentários/correções de body como rascunho no relatório; não postar nesta passagem. Evitar spam nas 41 threads: Core pode publicar matriz consolidada e comentar apenas ações/reclassificações importantes.

**Gate F1:** conjunto de IDs da tabela final igual ao conjunto remoto auditado, totais calculados por programa, sem item omitido. Lista de PRs completa ou zero confirmado.

## 4. Gate Core de entrega remota (não executar pelo AGY)

1. Core lê diff completo, untracked, evidências e relatório; verifica anti-scope e preservação do worktree principal.
2. Reexecuta testes focados, full gates e benchmark; nenhuma alegação do AGY vale como prova independente.
3. Revalida master mais recente antes da PR. Se base avançou, rebase somente branch de auditoria após preservar trabalho, resolver e rerodar gates; não tocar S12.
4. Commit por unidades coerentes com paths explícitos/Conventional Commits, sem plano operacional/.hermes/logs/dados sensíveis. Este plano pode ficar como doc pedido pelo usuário, mas logs/briefs não.
5. Abrir PR(s) pequenas e ligar #108/#110 só se critérios completos. Não fechar #96/#91 por trabalho local.
6. Inspecionar CI/checks/reviews/mergeability do **head SHA exato**. Audit blocker ou regressão impede merge; sem admin bypass.
7. Merge autorizado pelo pedido geral apenas para easy wins verificados; reler PR merged/base e issues após ação. Não apagar branches/worktrees como efeito colateral.
8. Corrigir achados da revisão anterior que superestimam impacto/prova (#103/#110 em especial). Fechar #63 somente se todos critérios provados. Outros itens exigindo produto permanecem abertos com pergunta concreta.

## 5. Known model pitfalls — evitar neste trabalho

- Não criar testes que copiam fórmula, retornam fixtures no lugar do serviço ou apenas conferem strings de implementação.
- Não aceitar assertions do esboço do Core como verdade: falha de setup não é teste RED contratual.
- Não presumir tabela semeada, IDs reiniciados, timezone UTC ou comportamento DQS idêntico entre drivers.
- Não fabricar benchmark: medir antes do edit, mesmo código de medição antes/depois e comparar saída.
- Não consertar semântica de analytics no diff de otimização: #105 continua separado.
- Não usar npm/ESLint de outro projeto; conferir resolução local e npm 10.9.7 explícito.
- Não reportar gate verde quando ele não executou; registry failure é diferente de advisory de segurança.
- Não usar snapshot da branch S12 como baseline da master nem fechar issue por commit não integrado.
- Não adicionar deps/helper/façade só para satisfazer teste; preferir imports reais e interface atual.
- `git diff --stat` não mostra untracked: usar também `git status --short`.

## 6. Entregáveis e status final obrigatório

- Diff pequeno e coerente, **uncommitted**, dentro da allowlist.
- `docs/audits/2026-09-05-focused-review.md`: matriz de inspeção, remoções com prova de uso/segurança, baseline/after reais, gargalos descartados, triagem completa, bloqueios e comandos/resultados.
- `docs/qa/agent-workflow.md`: comandos exatos e separação host/native/device.
- `.hermes/audit-evidence/`: logs RED/GREEN, benchmark trials, audit JSON sem secrets, preflight e full gates.
- `/home/lucca/.hermes/assignments/iron-log-focus-audit/AGY-RESULT.md`: checkpoint/final com:

```text
STATUS: DONE | PARTIAL | BLOCKED
PHASES: A0/A1/B1/B2/B3/C1/C2/D1/D2/D3/E1/F1 (status + motivo)
FILES CHANGED: tracked + untracked, paths exatos
CLEANUP: remoção -> evidência de segurança -> teste
PERFORMANCE: fixture/camadas/versões; before/after por trial; equivalência; retained/reverted
VERIFICATION: comando -> exit code -> trecho real -> arquivo de log
REMOTE TRIAGE: total issues/PRs, categorias/totais, ações apenas propostas
NATIVE QA: executado ou blocker explícito
DEVIATIONS: nenhuma ou justificativa
NEXT: tarefa exata restante, sem prometer execução já realizada
```

**Pronto não é terminar o plano escrito: é cumprir cada critério ou reportar precisamente o que bloqueou. A tarefa desta passagem é executar o plano, não reescrevê-lo nem responder com código em prosa.**

# Supersprint Zero Backlog — Sprints 12–20

**Data do plano:** 2026-08-27  
**Repositório:** `BenedettiLucca/iron-log`  
**Base verificada:** `master` @ `e586f54`, alinhada com `origin/master`  
**Entrada:** 33 issues abertas, nenhum PR aberto  
**Baseline local:** 103 suites / 894 testes; typecheck e lint verdes  
**Plano detalhado da primeira sprint:** [`2026-08-27-open-issues-sprint-12.md`](./2026-08-27-open-issues-sprint-12.md)

> **Status:** plano canônico aprovado para documentação, ainda não autorizado para execução. Nenhum agente deve ser disparado a partir deste arquivo sem autorização explícita do Lucca.

## Resultado esperado

Levar o backlog de **33 issues abertas para zero**, por uma combinação honesta de:

1. **entrega verificada** quando o problema ainda existe e tem solução útil;
2. **fechamento com evidência** quando a entrega já aconteceu ou a prescrição ficou obsoleta;
3. **wontfix/reframe explícito** quando licença, dependência externa ou risco de produto tornam a implementação original irresponsável.

Zero backlog não significa implementar literalmente toda proposta antiga. Significa resolver cada issue com uma decisão verificável — sem deixar zumbi aberto e sem construir feature teatral só para baixar contador.

## Tese → counter-thesis → truth

**Tese:** executar as issues por ordem numérica ou label de prioridade parece simples e maximiza throughput aparente.

**Counter-thesis:** o backlog contém premissas falsas, fundações compartilhadas, cinco issues já superadas ou inadequadas e várias features que conflitam nos mesmos arquivos de sessão/schema. Paralelizar tudo geraria migrations concorrentes, regressões e retrabalho.

**Truth:** executar nove sprints gateadas por dependência. Paralelizar agressivamente apenas onde há ownership de arquivo realmente separado. OpenCode e Antigravity são devs; Hermes faz inventário, especificação, contratos, priorização, integração e decisão de fechamento.

---

# Regras de operação

## Papéis

### Hermes — PM, tech lead e integrador

- confirma o estado da issue no código antes de especificar;
- escreve o sprint brief, os contratos RED e as allowlists;
- decide sequencing e protege os boundaries;
- revisa todo diff, migration e mudança de dependência;
- integra somente trabalho verificado;
- controla comentários, labels e fechamento no GitHub;
- roda os gates completos e conduz QA física.

### OpenCode — engenharia de domínio/estado

Usar para schema, migrations, persistência, state machines, import/export e mudanças cross-file que exigem raciocínio autônomo. Recebe tickets pequenos e sequenciais, com no máximo dois production files por dispatch quando possível.

### Antigravity — implementação bounded e mecânica

Usar para UI, i18n, wiring, componentes, fixtures e cobertura já especificada. Não recebe backlog aberto para “descobrir o que fazer”.

### Reviewers isolados

Subagents read-only fazem review de correctness/data integrity e de complexidade. Eles não implementam nem substituem o gate de Hermes.

## Limites de paralelização

1. **Um único owner de schema/migration por wave.** Nunca gerar duas migrations concorrentes a partir da mesma base.
2. **Um único owner por production file.** Arquivo compartilhado força sequência ou integração intermediária.
3. **Máximo de três lanes de implementação simultâneas.** Acima disso, review e QA viram gargalo e o throughput é falso.
4. **Package baseline é serial.** Mudança de Expo/dependências termina antes de features que adicionem ou usem pacotes nativos.
5. **Sessão Android tem fila única de QA.** Features podem ser codadas em paralelo, mas validação física acontece sobre um checkout integrado.
6. **Testes de contrato são locked.** Hermes escreve/valida o RED; devs corrigem produção e adicionam cobertura complementar sem enfraquecer o contrato.

## Branch/worktree padrão

- integração: `supersprint/sNN-<slug>`;
- worktrees: `~/Projects/iron-log-wt/sNN-<lane>`;
- cada worktree parte do mesmo commit de integração;
- task file local contém goal, non-goals, allowlist, acceptance e comandos de verificação;
- `.omh/`, `CLAUDE.md`, secrets e GitHub state ficam fora das lanes;
- Hermes inspeciona tracked + untracked antes de integrar.

## Definition of Done de qualquer issue

Uma issue só pode ser fechada quando:

- todos os critérios aprovados estão implementados ou a decisão de fechamento está documentada com evidência;
- testes direcionados passam;
- suíte completa, typecheck, lint, audit gate e `git diff --check` passam;
- migration tem smoke fresh + existing quando aplicável;
- fluxo nativo foi validado em dispositivo físico quando aplicável;
- documentação/i18n/export foram atualizados quando a semântica mudou;
- Hermes leu o estado final no GitHub após qualquer update/close.

Implementação parcial não fecha issue. Se o escopo for dividido, a issue original permanece aberta até a última fatia ou tem seu texto explicitamente reframed antes da execução.

---

# Mapa do programa

| Sprint | Tema | Issues encerradas ao sair | Natureza |
|---|---|---|---|
| 12 | Trust Before Breadth | #63, #68, #69, #73, #94, #96, #97 | bugs estruturais + hygiene |
| 13 | Platform & Device Reliability | #76, #88, #89 | toolchain + confiabilidade nativa |
| 14 | Honest Progress & Routine Control | #64, #74, #90, #91 | analytics + lifecycle |
| 15 | Session Composition | #79, #80, #81 | snapshot/editing/superset/freestyle |
| 16 | Exercise Truth | #83, #84, #85, #86 | carga, unilateralidade e taxonomia |
| 17 | Specialized Training Modes | #66, #82 | micro-session + cardio |
| 18 | Schedule Truth | #65, #67, #87, #95 | agenda canônica + hoje + drift |
| 19 | Portability | #92, #93 | share/import merge-safe |
| 20 | Context Without Pseudoscience | #70, #71, #72, #75 | integração externa + sinais conservadores |

**Total de encerramentos planejados:** 33/33.

## Caminho crítico

```text
#96 occurrence identity
  └─> #81 session snapshot/editing
       ├─> #80 freestyle
       ├─> #79 superset runtime
       └─> #66 micro-session

#83/#84 exercise measurement truth
  ├─> #82 cardio model
  └─> #66 unilateral micro flows

#86 taxonomy
  └─> #85 library/equipment filters

#95 schedule truth
  ├─> #65 manifest
  ├─> #87 treino de hoje
  ├─> #67 drift/re-entry
  └─> #92 plan sharing

#70 external health/nutrition contract
  ├─> #71 variance attribution
  └─> #72 readiness context

#74 plateau signals
  └─> #75 cut/load context
```

---

# Sprint 12 — Trust Before Breadth

**Goal:** corrigir o bloqueio Android, estabelecer identidade de ocorrência e parar de publicar e1RM sem fundamento. Limpar cinco issues zumbis sem fingir implementação.

O plano de execução detalhado de #96/#97/#91A está no documento da Sprint 12. Este programa altera apenas a política de fechamento: #91 permanece aberta até a calculadora residual da Sprint 14.

## Wave 12.0 — hygiene de backlog, Hermes only

- **#63:** fechar como superseded após confirmar que folders, CRUD e persistência estão entregues; citar #97 como bug residual separado. Drag/reorder não mantém a epic inteira aberta.
- **#68:** fechar como superseded pelo padrão concreto de `Promise<boolean>`/feedback de erro. Não criar abstração genérica sem necessidade.
- **#69:** fechar como concluída/revisada; substituir a fotografia antiga de 32 testes pela baseline de 103 suites/894 testes e pelos contratos por risco.
- **#73:** fechar como concluída após citar o contrato de type-safety existente.
- **#94:** fechar como wontfix enquanto não existir fonte visual com licença redistribuível comprovada. Nenhuma mídia cinzenta entra no produto.

Nenhuma dessas ações ocorre antes do checkpoint explícito do Lucca.

## Wave 12.1 — três lanes paralelas

- **Lane A / Antigravity — #97:** keyboard-safe `FolderManagerModal`, create + rename, Android físico.
- **Lane B / OpenCode — #96:** migration + occurrence identity end-to-end; `sets.routine_exercise_id` nullable e sem backfill inventado.
- **Lane C / Antigravity — #91A:** cap de 12 reps, melhor estimativa válida e provenance do set.

## Exit

- #96 e #97 fechadas somente após migration/runtime/Android gates.
- #91 atualizada com checklist residual explícito; não fechada.
- cinco decisões de hygiene lidas de volta no GitHub.

---

# Sprint 13 — Platform & Device Reliability

**Goal:** estabilizar o baseline de dependências antes de adicionar comportamento nativo e garantir que a sessão continue confiável com tela apagada ou app morto.

## Wave 13.0 — #76, serial e bloqueante

**Owner:** OpenCode, com Hermes controlando package changes.

1. Alinhar os 15 pacotes às versões recomendadas do Expo SDK 54.
2. Rodar `expo install --check`, testes, typecheck, lint, export Android e audit real.
3. Atualizar a allowlist do `audit:high` apenas com advisories transitivos comprovadamente de toolchain.
4. Não usar `npm audit fix --force`.
5. Se SDK 54 não consegue resolver o advisory sem major upgrade, decidir com Lucca entre upgrade isolado e fechamento por risco aceito documentado. Não misturar SDK 55 com feature work silenciosamente.

## Wave 13.1 — reliability lane

**Lane A / Antigravity — #88:** keep-awake somente durante sessão ativa, toggle persistente em Settings e cleanup garantido em finish/unmount.

**Lane B / OpenCode — #89:** notificação local de descanso com ID próprio por timer; cancelamento específico no skip/finish. Proibido usar `cancelAllScheduledNotificationsAsync`, pois apagaria check-ins não relacionados.

As lanes podem iniciar em paralelo após 13.0, mas qualquer arquivo compartilhado do session shell recebe owner único e integração em duas waves.

## Native acceptance

- Android físico com sessão longa, background, screen lock, skip e finish;
- notificação dispara com app morto e não apaga check-in mensal;
- keep-awake desliga em todos os exits, inclusive erro/unmount;
- bateria/permissão negada geram comportamento explícito, não silêncio.

---

# Sprint 14 — Honest Progress & Routine Control

**Goal:** transformar dados já existentes em feedback útil sem mentir e permitir esconder rotinas sem destruir histórico.

## Lanes

### Lane A / OpenCode — #64 archive routines

- migration `is_archived` reversível;
- archive ≠ delete;
- histórico/programas permanecem íntegros;
- default lists escondem arquivadas; busca/toggle permite recuperar;
- cobertura de archive/unarchive e de relações históricas.

### Lane B / Antigravity — #91B → #90, sequencial

- terminar **#91** com calculadora avulsa usando a mesma função de produção capped, sem segunda fórmula;
- depois entregar **#90** heatmap anual por duração, com navegação para sessões do dia;
- como ambos tocam Analytics, o mesmo owner executa em sequência.

### Lane C / OpenCode — #74 plateau detector

- serviço puro e determinístico com fixtures de sequência;
- distinguir estagnação, regressão de reps e carga potencialmente leve;
- UI usa linguagem de sinal, não prescrição clínica;
- sem depender de Alexandria nesta sprint.

## Exit

#64, #74, #90 e #91 fechadas. Analytics deve preservar provenance, datas locais e agregações históricas.

---

# Sprint 15 — Session Composition

**Goal:** separar plano de execução e permitir que a sessão tenha composição própria sem corromper a rotina original.

## Wave 15.0 — ADR e contratos, Hermes

Decisões obrigatórias antes do dispatch:

- criar `session_exercises` snapshot com occurrence id estável;
- definir política de remove com sets já gravados: recomendação é remover da fila, preservar sets e marcar a ocorrência como removed, com undo enquanto a sessão está ativa;
- definir superset como group id da ocorrência de sessão, não do exercício global;
- rotina continua sendo plano; sessão é execução versionada.

## Wave 15.1 — #81 foundation, OpenCode

- migration/schema do snapshot;
- bootstrap copia ocorrências da rotina para a sessão;
- add/remove/undo sem alterar `routine_exercises`;
- recovery/draft/finish/export leem o snapshot;
- histórico pré-migration continua legível por fallback explícito.

## Wave 15.2 — paralela após #81

### Lane A / OpenCode — #80 freestyle

- sessão com `routineId = null` e snapshot próprio;
- picker mid-session;
- prefill da última execução por ocorrência/posição;
- histórico e relatórios tratam freestyle sem fingir rotina.

### Lane B / Antigravity — #79 superset UX, com core especificado por Hermes

- agrupamento planejado e mid-session;
- rodadas back-to-back e um descanso ao fim do grupo;
- unpair e dissolução de grupo unitário;
- duas ocorrências do mesmo exercício permanecem distintas.

OpenCode implementa o domínio do group state antes de Antigravity ligar a UI se os arquivos de runtime coincidirem.

## Hard acceptance

Rotina A/B/A → snapshot → parear A/B → adicionar C → remover/restaurar B → logar duas ocorrências de A → finish/recovery/export sem conflar sets ou modificar a rotina.

---

# Sprint 16 — Exercise Truth

**Goal:** criar um modelo honesto para carga e metadados antes de especializar cardio ou aumentar a biblioteca.

## Wave 16.0 — contrato unificado de exercício, Hermes

Evitar três flags independentes que se contradizem. O ADR deve separar:

- `load_mode`: external, bodyweight, assisted, none;
- métrica primária: reps, duration ou distance;
- unilateralidade/per-side;
- muscle groups/equipment como taxonomia, não texto livre arbitrário.

Histórico não pode ser reinterpretado. Campos novos usam null/unknown quando a semântica antiga não é comprovável.

## Wave 16.1 — schema foundation, OpenCode serial

Uma única migration train cria a base de #83/#84/#86, com backfill apenas determinístico. Counts, FKs e export/import devem ser preservados.

## Wave 16.2 — duas lanes paralelas

### Lane A / OpenCode — #83 + #84

- bodyweight sem carga externa fictícia;
- carga adicional é delta, não peso total;
- progressão coerente por reps/séries;
- reps per-side têm storage e display sem dobrar histórico antigo;
- targets respeitam passos válidos.

### Lane B / Antigravity — #86 → #85

- backfill da seed para muscle group aprovado;
- custom exercise aceita unknown/outros sem sumir da análise;
- agregação semanal por grupo;
- equipment/body part/description e filtros que nunca levam a combinação vazia sem feedback;
- dataset maior fica fora se não houver licença clara.

## Exit

#83, #84, #85 e #86 fechadas com migration, analytics, editor, picker e quatro idiomas coerentes.

---

# Sprint 17 — Specialized Training Modes

**Goal:** suportar cardio e protocolos curtos sem forçar ambos ao shell de strength padrão.

## Wave 17.0 — #82 domain, OpenCode

- cardio como métrica tipada, não checkbox;
- storage para duration + distance/speed sem usar peso/reps falsos;
- PR e analytics por modalidade;
- migration de exercícios antigos somente quando o mapeamento for inequívoco;
- export/import versionados.

## Wave 17.1 — duas lanes com boundaries

### Lane A / Antigravity — #82 UI

Logger, histórico, PRs e summary de cardio.

### Lane B / Antigravity — #66 micro-session

Shell compacto, menos taps, rest opcional, fast finish e uso da semântica per-side já entregue na Sprint 16.

Como as duas lanes podem tocar session screens, Hermes separa componentes/adapters primeiro. Se o boundary não fechar, executar UI em sequência; paralelismo falso não vale conflito.

## Exit

#66 e #82 fechadas após QA física de strength, duration, cardio e micro; nenhum modo pode quebrar recovery/finish/export.

---

# Sprint 18 — Schedule Truth

**Goal:** fazer o produto saber o que estava planejado, o que aconteceu e o que está devido — sem inferir “hoje” a partir de uma semana sem weekday.

## Wave 18.0 — #95 foundation, OpenCode

Reframe aprovado da issue:

- modelo canônico de ocorrências agendadas com weekday/date e relação com programa/rotina;
- `sessions.scheduled_date` referencia intenção sem substituir `start_time` real;
- reschedule altera a ocorrência planejada, não falsifica execução;
- timezone/date-key têm contratos explícitos;
- migration de histórico usa unknown/null quando o dia planejado não pode ser provado.

## Wave 18.1 — três lanes paralelas

### Lane A / OpenCode — #65 manifest

JSON versionado e read-only com active program, agenda, due-state, freshness e last completion. Nada de write direto no Obsidian.

### Lane B / Antigravity — #87 treino de hoje

Home mostra a ocorrência agendada real; peso no início é opcional e não duplica/descarta o registro do finish. Sem schedule, mostra estado vazio honesto.

### Lane C / OpenCode — #67 drift/re-entry

Analyzer determinístico por lane e gap; advisory de retorno, sem mudar carga automaticamente. Exporta status no manifest.

Interfaces compartilhadas são definidas em 18.0; home UI de #67 integra depois da lane #87 se ambas tocarem o mesmo componente.

## Exit

#65, #67, #87 e #95 fechadas. Testes cobrem timezone, reschedule, missed day, rest day, accessory lane e re-entry.

---

# Sprint 19 — Portability

**Goal:** permitir mover planos e histórico sem overwrite, perda silenciosa ou dependência de nomes perfeitos.

## Wave 19.0 — codec/merge foundation, OpenCode

- envelope versionado;
- parser runtime validado;
- dry-run com contagens de create/match/custom/skip/error;
- merge transacional e idempotente;
- export nunca inclui dados corporais quando o escopo é plano;
- rollback integral em falha.

## Wave 19.1 — adapters paralelos

### Lane A / Antigravity — #92 share plan

Seleção de rotinas + agenda, share sheet, preview/dry-run e merge sem overwrite.

### Lane B / OpenCode — #93 tracker imports

Fixtures reais e anonimizadas de Strong/Hevy/FitNotes; normalização explícita; exercício desconhecido vira custom; nenhuma row some sem aparecer no relatório.

Cada formato recebe adapter isolado. A engine comum não é duplicada.

## Exit

#92 e #93 fechadas após round-trip, idempotência, malformed input, locale decimal/date e zero-loss accounting.

---

# Sprint 20 — Context Without Pseudoscience

**Goal:** conectar contexto de saúde apenas quando a fonte existe e entregar sinais conservadores, auditáveis e não médicos.

## Gate 20.0 — contrato Alexandria, Hermes

Antes de qualquer código, verificar no sistema real:

- endpoints, auth, schemas e freshness para nutrition/sleep/heart-rate/weight;
- ownership dos dados e comportamento offline;
- política de cache e erro;
- ausência de secrets no app/repo.

Se o contrato não existir, não construir mock como se fosse integração. Nesse caso, Lucca escolhe entre: (a) bloquear o programa até Alexandria entregar o contrato; ou (b) fechar #70/#71/#72 como not-planned com evidência. “Zero backlog” não autoriza fingir backend.

## Wave 20.1 — #70 adapter, OpenCode

- cliente read-only tipado;
- today + 7-day summary com freshness e estados unavailable/stale/error;
- nenhum dado externo vira source of truth local silenciosamente;
- UI distingue zero real de dado ausente.

## Wave 20.2 — duas lanes paralelas

### Lane A / OpenCode — #71 variance attribution

Compara agenda real da Sprint 18 com sono disponível. Heurísticas são rotuladas como associação/contexto, nunca causalidade.

### Lane B / Antigravity — #72 readiness UX

Sem score mágico. Sinais individuais com provenance/freshness, estado advisory e override explícito. Partial data não vira verde por default.

## Wave 20.3 — #75, reframe obrigatório

A claim “connective-tissue injury risk” excede o que peso, plateau e macros conseguem provar. Recomendação PM:

1. renomear/reformular a issue para **Cut Velocity & Training Load Context**;
2. calcular tendência de peso com janela/provenance;
3. combinar com sinais de #74 como contexto de recuperação, não diagnóstico de tendão;
4. copy: “considere reduzir progressão/revisar recuperação” — jamais “risco de lesão elevado” como fato;
5. nenhuma recomendação médica automática.

Esse reframe precisa de aprovação explícita do Lucca antes do dispatch. Se a claim médica original for requisito inegociável, a recomendação é fechar wontfix, não produzir pseudociência.

## Exit

#70, #71, #72 e #75 resolvidas por entrega verificada ou decisão explícita de produto. Estados offline/stale/partial e provenance são acceptance criteria, não polish.

---

# Matriz de cobertura das 33 issues

| Issue | Sprint de encerramento | Caminho | Dependências principais | Executor primário |
|---:|---:|---|---|---|
| #63 | 12 | close superseded | confirmação folders + #97 separada | Hermes |
| #64 | 14 | implementar archive | nenhuma estrutural | OpenCode |
| #65 | 18 | manifest versionado | #95 | OpenCode |
| #66 | 17 | micro-session | #81, #84 | Antigravity |
| #67 | 18 | drift/re-entry advisory | #95 | OpenCode |
| #68 | 12 | close superseded | evidência dos fluxos concretos | Hermes |
| #69 | 12 | close concluída/revisada | baseline de testes | Hermes |
| #70 | 20 | integração ou not-planned | contrato Alexandria real | OpenCode + gate Hermes |
| #71 | 20 | attribution conservadora | #65, #70, #95 | OpenCode |
| #72 | 20 | readiness advisory | #70 + dados parciais honestos | Antigravity |
| #73 | 12 | close concluída | contrato type-safety | Hermes |
| #74 | 14 | plateau detector | analytics existente | OpenCode |
| #75 | 20 | reframe seguro ou wontfix | #74, #70 | Hermes + OpenCode |
| #76 | 13 | alinhar/mitigar toolchain | decisão SDK | OpenCode |
| #79 | 15 | supersets | #96, #81 | OpenCode + Antigravity |
| #80 | 15 | freestyle | #81 | OpenCode |
| #81 | 15 | session snapshot/editing | #96 | OpenCode |
| #82 | 17 | cardio tipado | #83/#84 model | OpenCode + Antigravity |
| #83 | 16 | bodyweight/load mode | ADR de measurement | OpenCode |
| #84 | 16 | per-side sem reinterpretar histórico | ADR de measurement | OpenCode |
| #85 | 16 | library/equipment | #86 + licença de dataset | Antigravity |
| #86 | 16 | taxonomy + aggregation | migration foundation | OpenCode + Antigravity |
| #87 | 18 | treino de hoje | #95 | Antigravity |
| #88 | 13 | keep-awake | #76 package baseline | Antigravity |
| #89 | 13 | local rest notification | #76 package baseline | OpenCode |
| #90 | 14 | annual heatmap | nenhuma migration | Antigravity |
| #91 | 14 | cap/provenance + calculator | #91A na Sprint 12 | Antigravity |
| #92 | 19 | plan share merge-safe | #95 + codec | Antigravity |
| #93 | 19 | tracker adapters zero-loss | codec/merge engine | OpenCode |
| #94 | 12 | close wontfix | licença redistribuível ausente | Hermes |
| #95 | 18 | schedule truth/reschedule | ADR de calendário | OpenCode |
| #96 | 12 | occurrence identity | migration 0021 + runtime | OpenCode |
| #97 | 12 | keyboard-safe modal | QA Android físico | Antigravity |

---

# Gates por sprint

Toda sprint termina com:

```bash
npm run test -- --runInBand
npm run typecheck
npm run lint
npm run audit:high
git diff --check
```

Adicionar quando aplicável:

- `npx expo install --check` para package/toolchain;
- migration smoke em banco fresh e cópia de banco existente, com counts antes/depois;
- `npm run export:android` e `npm run verify:android-export` para schema/runtime/native;
- import/export round-trip e idempotência;
- Android físico para teclado, notifications, keep-awake e session flows;
- quatro idiomas para toda copy nova.

## Stop-the-line

Parar a sprint e não despachar a wave seguinte quando:

- baseline fica vermelho sem causa entendida;
- migration perde rows ou exige backfill especulativo;
- duas lanes precisam editar o mesmo production file sem boundary claro;
- agente toca arquivo fora da allowlist;
- feature depende de API/licença que não foi verificada;
- QA encontra bug de data integrity;
- o escopo exige claim médica ou causal que os dados não sustentam.

---

# Checkpoints estratégicos do Lucca

Não pedir aprovação para cada detalhe reversível. Pedir decisão somente nos gates que mudam produto/risco:

1. **Antes da Sprint 12:** autorizar dispatch e fechamento do hygiene batch.
2. **Sprint 13:** aceitar risco transitivo documentado ou autorizar upgrade major do Expo se necessário.
3. **Sprint 15:** aprovar semântica de remoção de exercício com sets já logados.
4. **Sprint 16:** aprovar modelo de carga/unilateralidade e taxonomia inicial.
5. **Sprint 18:** aprovar modelo canônico de schedule/reschedule.
6. **Sprint 20:** escolher integração vs not-planned se Alexandria não tiver contrato real; aprovar reframe seguro de #75.

Cada sprint é autorizada separadamente. Aprovar este roadmap não autoriza automaticamente mudanças de código, GitHub, dependências ou banco.

---

# Métricas do programa

- **Outcome principal:** 33 issues resolvidas com evidência; zero abertas ao fim.
- **Qualidade:** nenhum rollback de migration, nenhuma perda de rows, nenhum regression gate aceito.
- **Fluxo:** no máximo 3 lanes simultâneas; tempo bloqueado por conflito de arquivo deve tender a zero.
- **Produto:** toda feature nova precisa alterar um fluxo real ou desbloquear dependência explícita.
- **Honestidade:** zero backfill inventado, zero métrica sem provenance, zero claim médica apresentada como fato.

## Anti-métricas

Não otimizar por número de commits, linhas, agents ativos, suites adicionadas ou issues fechadas por dia. Se o batch fecha rápido e reabre bug estrutural, não foi throughput; foi dívida com maquiagem.

---

# Ordem de início

1. Lucca revisa este programa e aprova somente a Sprint 12.
2. Hermes reconcilia o plano detalhado da Sprint 12 com este documento.
3. Hermes revalida GitHub/base/baseline imediatamente antes do dispatch.
4. Só então cria branch/worktrees/task files e chama OpenCode/Antigravity.
5. Ao fim de cada sprint, Hermes atualiza este documento com baseline real, decisões e residual antes de pedir autorização para a seguinte.

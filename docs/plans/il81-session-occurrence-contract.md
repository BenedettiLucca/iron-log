# Issue #81 — Remover exercício mid-session: contrato de occurrence (design slice)

Status: **PROPOSAL + RED tests**. Nenhuma mudança de produção, schema ou migration neste slice.
Testes: `__tests__/services/session-occurrence.test.ts` (RED até a implementação existir).

Escopo deste slice: **remover** exercício da sessão ativa. "Adicionar exercício" (picker) e UI
ficam para slices seguintes; o desenho abaixo já deixa o gancho (ver "Proposta de schema").

## 1. Modelo real de persistência de sessão (fato, base `9c0b808`)

| Conceito | Onde vive | Observação |
|---|---|---|
| Sessão | `sessions` (`src/db/schema.ts`) | `endTime IS NULL` = ativa; `deletedAt` = tombstone. Só tem `routineId`/`routineName` (snapshot). |
| Fila de exercícios | **Não existe por sessão.** `app/session/[routineId].tsx` (`loadExercises`) e `hooks/use-exercise-sets.ts` (`loadStructure`) leem `routine_exercises WHERE routine_id = ? ORDER BY order_index` — o **template** da rotina, compartilhado entre sessões. | `nextExercise` = próximo item desse array após o `routineExerciseId` atual. |
| Identidade do exercício na sessão | `routine_exercises.id` (a "occurrence"), gravado em `sets.routine_exercise_id`. `exercise_id` sozinho é ambíguo em rotinas A/B/A. | Sets legados têm `routine_exercise_id NULL`; `getNextSetNumber`/`refreshSessionSets` só os atribuem a um exercício quando ele tem **uma única** occurrence. |
| Séries logadas | `sets` (`deletedAt` = tombstone, `operationId` idempotente) | Undo de set = `deletedAt`; `setNumber` calculado incluindo tombstones. |
| Snapshot de crash-recovery | `AsyncStorage['incomplete_session']`, escrito por `hooks/use-session-persistence.ts` (`SessionContext`) | É o contexto de **um** exercício (sessionId, exerciseId, routineExerciseId, draft weight/reps/duration/rir, timers). **Não** guarda a fila. Lido em `app/_layout.tsx` (diálogo de recuperação) e `src/utils/notification-routing.ts`. Limpo por `finishSession`/`discardSession`. |
| Undo existente | `hooks/use-session-undo.ts` — só sets (`lastSavedSet`, `lastDeletedSet`, janela de 10 s). | Nenhum undo de nível exercício. |
| Superset | **Não existe** no schema nem no fluxo (só menções em docs de auditoria). | Ver §6. |

Consequência de design (inferência): como a fila é o template, **remover um exercício da sessão
não pode apagar/alterar `routine_exercises`** (mudaria a rotina para sempre e para outras sessões).
O estado "removido" precisa ser por-sessão.

## 2. Semântica de remoção (contrato)

1. **Identidade = occurrence** (`routine_exercises.id`), nunca `exercise_id`. Remover uma ocorrência
   de A/B/A mantém a outra pendente.
2. **Sets já logados são MANTIDOS** (default do owner: histórico preservado). Nenhum `sets.deletedAt`
   é tocado; PRs não são reconciliados por causa da remoção; `sessions` continua ativa, sem
   `endTime`/`deletedAt`. Só a fila *pendente* encolhe. O retorno informa `keptSetCount`.
3. **Escopo por sessão**: outra sessão da mesma rotina continua vendo a fila completa; `routine_exercises` intacto.
4. **Idempotente**: remover o que já está removido não lança erro nem muda a fila.
5. **Rejeita**: sessão inexistente / finalizada (`endTime != null`) / deletada; occurrence que não pertence à rotina da sessão.
6. **Posição preservada**: a occurrence removida guarda sua posição original (a do template no
   momento da remoção); `restore` a recoloca exatamente nesse slot, inclusive restaurações fora de ordem.
7. Exercício removido **com** sets mantidos continua aparecendo no resumo/histórico da sessão
   (os sets existem); só não é mais navegável como "próximo" nem conta no total pendente.

## 3. Undo

`restoreSessionExercise` desfaz a remoção: volta `status` a `pending`, mesma posição relativa. Sets
nunca foram mexidos, então não há o que reconciliar. A UI (slice futuro) deve reutilizar o padrão
toast + janela de undo de `use-session-undo.ts`; o estado de undo de exercício é in-memory (como o de
set) — a *persistência* da remoção é que sobrevive a crash, não a janela de undo.

## 4. Snapshot de crash-recovery

Regra: **o restore nunca ressuscita uma occurrence removida**, mesmo havendo sets no histórico.

`resolveRecoveryContext(snapshot, db)` (puro sobre DB + snapshot) devolve:

| Situação do `snapshot.routineExerciseId` | `action` | `context` |
|---|---|---|
| occurrence pendente | `resume` | snapshot inalterado (draft preservado) |
| occurrence **removida** e há próxima pendente (primeira pendente com `position` maior; senão a primeira pendente) | `advance` | snapshot reapontado p/ a próxima occurrence, **draft descartado** (`weight/reps/duration = ''`, `isDirty=false`, timers zerados) |
| removida e fila pendente vazia | `finish` | `null` (leva ao fluxo de finalização) |

Como o snapshot não guarda a fila, ele **exclui** o removido por construção: a fila é lida do DB a
cada recovery. Ponto de integração futuro: `app/_layout.tsx` (`checkIncompleteSession`) e
`notification-routing.ts` chamam `resolveRecoveryContext` antes de navegar; hoje navegam direto
para o `routineExerciseId` do snapshot. Também: ao remover a occurrence **atual**, a UI deve
reescrever o snapshot via `saveSessionContext` apontando para a próxima (mesmo contrato).

## 5. Proposta de schema/API (PROPOSTA — nada gerado)

### Opção recomendada: tabela `session_exercises` (occurrence por sessão)

```ts
export const sessionExercises = sqliteTable('session_exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => sessions.id),
  routineExerciseId: integer('routine_exercise_id').references(() => routineExercises.id, { onDelete: 'set null' }), // NULL = adicionado ad-hoc (slice "add")
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  position: integer('position').notNull(),            // posição original; estável p/ undo
  status: text('status').notNull().default('pending'), // 'pending' | 'removed'
  removedAt: integer('removed_at'),
}, (t) => [
  uniqueIndex('se_session_routine_exercise_unique').on(t.sessionId, t.routineExerciseId),
  index('se_session_status_position_idx').on(t.sessionId, t.status, t.position),
]);
```

- Materialização **lazy**: sessões legadas/em andamento (sem linhas) são tratadas como "todas as
  occurrences do template pendentes"; a primeira remoção materializa as linhas da sessão em uma
  transação (`INSERT … SELECT` de `routine_exercises`), depois marca `status='removed'`.
  Evita backfill em migration e mantém compatibilidade com dados locais existentes.
- `sets.routine_exercise_id` continua sendo a chave de ligação (sem FK nova em `sets`).
- Soft semantics: `removed` ≠ delete → undo trivial, histórico consistente. `routineExerciseId NULL`
  + `exerciseId` já acomoda "adicionar exercício" e treino livre sem novo schema.

### Alternativa mínima descartada (e por quê)
Coluna `status` em `routine_exercises`: **rejeitada** — muta o template compartilhado (afeta
próximas sessões e o editor de rotina). Coluna JSON em `sessions` (`removed_occurrences`): barata,
mas não comporta ordem/adições ad-hoc e exige reescrever a coluna a cada undo; serve só como
fallback se a tabela for considerada pesada.

### API — `services/SessionOccurrenceService.ts` (mesmo estilo de `SessionLifecycleService`: `db` por último, transação síncrona)

```ts
getPendingQueue(sessionId, db?): Promise<{ routineExerciseId; exerciseId; position }[]>
removeSessionExercise({ sessionId, routineExerciseId }, db?): Promise<{ routineExerciseId; exerciseId; position; keptSetCount }>
restoreSessionExercise({ sessionId, routineExerciseId }, db?): Promise<void>
resolveRecoveryContext(snapshot, db?): Promise<{ action: 'resume'|'advance'|'finish'; context: SessionContext | null }>
```

Pontos de consumo (slices futuros, fora do allowlist agora): `loadExercises` em
`[routineId].tsx`, `loadStructure` em `use-exercise-sets.ts` (hoje leem o template; passam a ler
`getPendingQueue`), `countCompletedRoutineExercises` (total deve usar a fila pendente),
`app/_layout.tsx` e `notification-routing.ts` (recovery).

### Passos de GREEN (próximo slice, não feito aqui)
1. `schema.ts` + `drizzle-kit generate` + revisar migration + **atualizar o DDL de `__tests__/fixtures/database.ts`** (o fixture é DDL manual — sem isso os testes não conseguem criar a tabela).
2. Implementar o service até `session-occurrence.test.ts` ficar verde.
3. Ligar UI/hooks/recovery; flow Maestro para remover + undo (AGENTS.md exige QA Android p/ UI).

## 6. Questões em aberto

- **Superset**: a issue pede "perguntar qual remover" quando o removido é membro de superset. Não
  há conceito de superset no schema/fluxo hoje → a regra fica **fora deste contrato** até existir
  agrupamento (provável campo `groupId` em `session_exercises`/`routine_exercises`).
- Remover a occurrence que está na tela: navegar para a próxima pendente ou para `finish` quando vazia (coerente com `resolveRecoveryContext`).
- Resumo/PR de sets de exercício removido: mantidos por decisão do owner; se o produto quiser
  "remover + descartar sets", será ação distinta (usa `sets.deletedAt` + `reconcilePersonalRecordsTx`), não esta.

## 7. RED capturado

`npm test -- --runTestsByPath __tests__/services/session-occurrence.test.ts --watchAll=false --maxWorkers=2` → exit 1:
13/13 falham com `Could not locate module @/services/SessionOccurrenceService` (módulo ausente = RED
aceito). O módulo é carregado via `jest.requireActual` dentro de `loadService()` para que cada teste
reporte sua falha e o `typecheck` global continue verde.

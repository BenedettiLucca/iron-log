# Iron Log — Fresh Ponytail Audit

**Data:** 2026-08-26
**Commit de código auditado:** `2bceeb2` (`sprint/7-pre-release-scope`)
**Escopo:** Sprint 9 read-only, após Sprint 7 concluído e Sprint 8 pulado por decisão do Lucca.
**Regra:** achado é hipótese até caller, teste, barrel, string/dynamic reference, docs e workflow serem verificados. Este commit não remove produção.

## Baseline

| Gate | Resultado |
|---|---|
| `npm run typecheck` | PASS — `ok` |
| `npm run lint` | PASS — `ESLint: No issues found` |
| `npm test -- --runInBand` | PASS — 94 suites / 839 testes / 0 snapshots |
| `npm run audit:high` | PASS — 0 critical, 8 high e 20 moderate; high/critical não allowlisted = 0 |
| `npm run export:android` | PASS — bundle Hermes `entry-10d5995910e25a02834d983c438df04c.hbc`, 8.63 MB |
| `npm run verify:android-export` | PASS — 8,627,505 bytes verificados |
| `npx expo-doctor` | 16/18 — duplicidade de `react-native-safe-area-context` e drift de versões/Sentry, já deferred em #76 |
| `git diff --check` | PASS antes do audit |

O warning do Sentry durante export (“Missing config for organization, project”) não quebra o bundle; é configuração de ambiente, não um achado Ponytail.

## Método

- Scan por `app/`, `components/`, `hooks/`, `services/`, `src/`, `scripts/`, testes, manifests, workflow e documentação operacional.
- Diretórios de dependência/build/cache excluídos: `node_modules/`, `.git/`, `dist/`, `build/`, `coverage/`, `.omh/`.
- Cada finding confirmado foi procurado fora do arquivo definidor, incluindo `__tests__`, imports relativos, aliases, barrels e referências textuais.
- Relatórios Ponytail de 2026-06-24 e 2026-07-11 foram usados somente como hipóteses históricas. Nenhum item antigo recebeu presunção de validade.

## Findings confirmados — baseline da execução

### Sprint 1 — dead code / zero callers

1. `delete: constants/typography.ts:1-103` — 103 linhas com escala, tipos e quatro helpers NativeWind; nenhuma referência de import ou uso fora do próprio arquivo. **Replacement:** nada. **Net:** −103 linhas.
2. `delete: services/index.ts:1-14` — barrel que reexporta serviços, sem consumidor de `@/services` ou caminho relativo equivalente; os módulos são importados diretamente. **Replacement:** nada. **Net:** −14 linhas.
3. `delete: src/validators/index.ts:1-2` — barrel de `routes`/`forms`, sem consumidor; os dois módulos são importados diretamente. **Replacement:** nada. **Net:** −2 linhas.
4. `delete: src/utils/index.ts:1-5` — barrel de utils, sem consumidor; utilitários são importados por caminho direto. **Replacement:** nada. **Net:** −5 linhas.
5. `delete: services/program/index.ts:1-4` — barrel de `crud`/`weeks`/`targets`/`dashboard`, sem consumidor; os módulos são importados diretamente. **Replacement:** nada. **Net:** −4 linhas.
6. `delete: src/utils/calculations.ts:1-16` + `__tests__/utils/calculations.test.ts:1-27` — `calculateVolume` só aparece na própria implementação, no teste dedicado e na exportação morta do barrel; nenhum caller de produção existe. **Replacement:** nada enquanto não houver call site; se um vier no futuro, multiplicação direta no domínio chamador. **Net:** −43 linhas, além de remover a exportação do barrel já contada no item 3/4 conforme aplicável.

**Subtotal confirmado:** −171 linhas auditadas. A execução aprovada e o resultado verificável estão registrados no follow-up abaixo.

### Sprint 3 — dependência candidata, ainda requer verificação nativa

7. `yagni: package.json:31` — `@react-navigation/bottom-tabs` é dependência direta sem import direto no código do app; `npm ls` mostra a mesma versão também transitiva por `expo-router@6.0.23`. **Replacement:** deixar o Expo Router fornecer o pacote transitivo. **Net:** −1 dependência direta.

Não contei esse item no subtotal de linhas na fase read-only. A aprovação ficou condicionada a lockfile diff, resolução transitiva, typecheck, lint, auditoria e export Android; o follow-up confirma a execução dessa lane. #76 continua deferred porque a superfície ampla de dependências/SDK ainda não é um patch seguro de upgrade.

## Rejeitados / falsos positivos importantes

- `hooks/index.ts`: **não é dead barrel**. `app/session/exercise.tsx:19` importa `../../hooks`; o teste de navegação também mocka `@/hooks`. O scan ingênuo que só procurava aliases perdeu o consumidor relativo.
- `src/types/index.ts`: **não é dead barrel**. Tipos como `Session`, `BodyMetric`, `Program` e `SessionContext` têm consumidores em hooks, telas, services, utils e testes.
- `hooks/use-progression.ts`: **não é dead code**. É consumido por `session/exercise` via `hooks/index.ts` e encapsula dois efeitos (`fetchActiveProgram` + cálculo de status). Remover a camada exigiria redesenhar o comportamento, não apenas cortar linhas.
- `src/utils/program-detail-state.ts`: **não é dead code**. `app/programs/detail.tsx` usa os dois exports e o teste unitário preserva a máquina de estados loading/error/not-found/content.
- `src/utils/session-verdict-markdown.ts`: **não é dead code**. É importado por `services/NotionExportService.ts` e tem teste de integração do exportador. A cobertura menor sugere eventual trabalho de branch, não delete.
- Source-contract tests (`quality/sprint-3-information-hierarchy.test.ts`, `quality/sprint-4-dense-data.test.ts` e outros): são candidatos de complexidade em abstrato, mas hoje protegem contratos arquiteturais que não têm equivalentes render/behavior completos. Não há base para apagar 100% deles em nome de porcentagem; qualquer shrink precisa ser contrato a contrato.
- `.github/workflows/quality.yml`: **sem glob drift identificado**. O workflow chama scripts canônicos (`audit:high`, typecheck, lint, Jest coverage e export Android), e o Jest descobre a suíte por diretório.

## Priorização executada no Sprint 10

1. **Concluído — zero-risk deletes:** `constants/typography.ts` e os quatro barrels sem caller, com rechecagem do tree inteiro antes do patch.
2. **Concluído — test-only export cleanup:** `src/utils/calculations.ts` e seu teste, sem caller de produção ou referência dinâmica encontrada.
3. **Concluído — dependency lane separada:** remoção direta de `@react-navigation/bottom-tabs`, mantendo o pacote transitivo fornecido por `expo-router`.
4. **Adiado:** source-contract tests e helpers repetidos (`PlusIcon`, modal handlers, formatters). Não houve base para novo shrink com redução líquida comprovada.

## Deferrals

- Upgrade do Expo SDK, alinhamento de Sentry e deduplicação do safe-area: permanecem na frente separada de #76; não entram como cleanup Ponytail.
- `app/session/summary.tsx` sem render test isolado: residual visual/composicional, já registrado na matriz de coverage; fica para QA final, não é dead-code finding.
- Qualquer finding que dependa de comportamento nativo fica bloqueado até clean install/export/runtime.

## Verdict

**AUDIT PASS — 6 findings de corte confirmados, 1 dependência candidata condicionada, falsos positivos documentados.**

`net auditado: -171 linhas e -1 dependência direta; ambos executados no follow-up.`

## Execution follow-up — Sprint 10

- O checkpoint foi aprovado pelo Lucca.
- `6c8e595` (`refactor(ponytail): remove confirmed dead code`) removeu os seis findings de dead code/test-only export: −171 linhas.
- `dda6563` (`chore(deps): remove redundant bottom-tabs direct dependency`) removeu a dependência direta; `npm ls` confirmou `@react-navigation/bottom-tabs@7.18.8` transitivo por `expo-router@6.0.23`.
- A lane planejada para Antigravity foi tentada, mas o processo ficou indisponível e foi interrompido sem alterar arquivos. O mesmo allowlist mecânico foi executado diretamente no checkout principal, sem ampliar escopo.
- Gates finais após a integração: typecheck PASS, lint PASS, **93 suites / 833 testes PASS**, `audit:high` PASS sem high/critical fora da allowlist, export Hermes Android PASS, verificação do bundle PASS (`entry-10d5995910e25a02834d983c438df04c.hbc`, 8,627,506 bytes) e `git diff --check` PASS.

**Resultado:** −171 linhas e −1 dependência direta removidas com comportamento e export nativo verificados. Não há cleanup adicional deste relatório aprovado; novos shrinks ficam para uma auditoria/decisão separada.

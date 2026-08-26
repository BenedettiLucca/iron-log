# Sprint 7 — Coverage matrix

**Data:** 2026-08-26
**Issue:** #69 — coverage inventory refresh + gaps realmente críticos
**Branch:** `sprint/7-pre-release-scope`
**Escopo:** inventário e decisão de risco; nenhum aumento de feature scope.

## Veredito

**#69 — [REVIEWED].** O claim histórico de “16 rotas / 9 módulos sem teste” não fecha contra o código atual. As 16 rotas citadas na issue já têm contratos de fonte, testes comportamentais/utility ou evidência de QA distribuída pelas Sprints 3–6. O restante da superfície também tem cobertura proporcional ao risco.

Não foi criado um teste de renderização para cada rota. Isso seria cobertura cosmética: o Jest atual coleta cobertura automática apenas de `src/utils`, enquanto os contratos de rota usam testes direcionados de comportamento, fonte, hooks e serviços. A tela de resumo de sessão permanece sem um render test isolado, mas seu comportamento de maior risco está coberto pelos builders de summary/verdict, pelo exportador e pelos contratos de navegação; não há evidência de um gap crítico que justifique adicionar um harness de mocks agora.

**Decisão:** fechar o slice de inventário como revisado, manter o follow-up de render QA no Sprint 11 e não abrir escopo adicional para #69.

## Baseline executado

- **Rotas/layouts ativos:** 25 arquivos `app/**/*.tsx`.
- **Arquivos de teste:** 94 arquivos `__tests__/**/*.test.*`.
- **Suíte:** 94 suites / 839 testes passando, 0 snapshots.
- **Cobertura automática Jest (`src/utils/**/*.{js,jsx,ts,tsx}`):**
  - statements: **91.21%**;
  - branches: **84.90%**;
  - functions: **90.84%**;
  - lines: **95.54%**.
- **Módulos utilitários abaixo de 80% em algum eixo:**
  - `src/utils/session-verdict-markdown.ts`: 68.18% statements / 46.15% branches;
  - `src/utils/session-draft.ts`: 79.31% statements / 76.56% branches;
  - `src/utils/session-recovery-a11y.ts`: 80.00% statements / 50.00% branches;
  - `src/utils/session-summary.ts`: 88.04% statements / 71.15% branches.
- Os números acima não são um gate quebrado: os thresholds globais permanecem em 75% para statements/branches/functions e 80% para lines, e a suíte passou.
- **QA runtime:** o fluxo Sprint 6 foi aprovado por Lucca via Expo Go; não foi necessário plugar o S23. O runbook físico continua como evidência histórica, não como pré-requisito para este inventário.

Comandos de evidência:

```bash
npm run test -- --coverage --runInBand
npm run test -- --runInBand
npm run lint
npm run typecheck
git diff --check
```

## Legenda de evidência

- **B** — comportamento: teste de tela real, hook ou fluxo navegável;
- **C** — contrato estático/source: preserva composição, semântica, rota ou integração de uma tela;
- **U** — utility/service: lógica de domínio exercitada fora da tela;
- **Q** — smoke/QA runtime já executado em Expo Go ou QA de sprint anterior;
- **P** — lacuna parcial observada, sem evidência suficiente para classificá-la como blocker.

## Matriz de rotas

| Rota/layout | Evidência atual | Risco residual | Decisão #69 |
|---|---|---|---|
| `app/_layout.tsx` | C: `quality/native-compatibility.test.ts`, `quality/design-tokens.test.ts` | baixo | coberto |
| `app/(tabs)/_layout.tsx` | C: `quality/design-tokens.test.ts`, `quality/sprint-6-tabs-a11y.test.ts` | baixo | coberto |
| `app/(tabs)/index.tsx` | B/C/Q: `quality/sprint-3-information-hierarchy.test.ts`, `quality/sprint-6-tabs-a11y.test.ts`, `quality/progress-bar-call-sites.test.ts`, regressões de QA | baixo | coberto |
| `app/(tabs)/routines.tsx` | B/C/U: `hooks/use-routines.test.tsx`, `quality/sprint-6-tabs-a11y.test.ts`, `quality/expo-sqlite-transactions.test.ts` | baixo | coberto |
| `app/(tabs)/bio.tsx` | C/U: `quality/sprint-6-tabs-a11y.test.ts`, `quality/form-keyboard-safety.test.ts`, `quality/sprint-4-physical-qa-regressions.test.ts` | baixo | coberto |
| `app/(tabs)/history.tsx` | C: `quality/sprint-3-information-hierarchy.test.ts`, `quality/sprint-6-tabs-a11y.test.ts`; navegação para summary verificada | baixo | coberto |
| `app/(tabs)/settings.tsx` | C: `quality/sprint-3-information-hierarchy.test.ts` | baixo | coberto |
| `app/about.tsx` | C: `quality/sprint-3-information-hierarchy.test.ts` | baixo | coberto |
| `app/bio/checkin.tsx` | B/C/U: `utils/checkin-screen.test.ts`, `utils/checkin.test.ts`, `utils/monthly-checkin-regression.test.ts`, `quality/design-tokens.test.ts` | baixo | coberto |
| `app/bio/goals.tsx` | C/U: `quality/sprint-6-tabs-a11y.test.ts`, `quality/sprint-4-dense-data.test.ts`, `quality/form-keyboard-safety.test.ts`, `quality/sprint-5-form-actions.test.ts`, `quality/progress-bar-call-sites.test.ts` | baixo | coberto |
| `app/bio/analytics.tsx` | C/Q: `quality/sprint-4-dense-data.test.ts`, `quality/sprint-4-physical-qa-regressions.test.ts`, `quality/progress-bar-call-sites.test.ts` | baixo | coberto |
| `app/bio/evolution.tsx` | C/Q: `quality/sprint-4-physical-qa-regressions.test.ts`; contrato de type-safety no slice #73 | baixo | coberto |
| `app/programs/index.tsx` | C: `quality/sprint-3-information-hierarchy.test.ts`, `quality/sprint-6-screen-a11y.test.ts`; type-safety #73 | baixo | coberto |
| `app/programs/create.tsx` | B/C/U: `quality/sprint-5-form-state.test.ts`, `quality/sprint-5-form-actions.test.ts`, `quality/form-keyboard-safety.test.ts`, `quality/sprint-6-screen-a11y.test.ts`, `quality/sprint-6-programs-a11y.test.ts` | baixo | coberto |
| `app/programs/detail.tsx` | B/C: `screens/program-detail-effects.test.tsx`, `quality/sprint-3-information-hierarchy.test.ts`, `quality/sprint-6-screen-a11y.test.ts` | baixo | coberto |
| `app/programs/week-detail.tsx` | C: `quality/sprint-3-information-hierarchy.test.ts`, `quality/sprint-6-screen-a11y.test.ts`; navegação para summary verificada | baixo | coberto |
| `app/routines/editor.tsx` | B/C/U: `quality/sprint-5-form-state.test.ts`, `quality/sprint-5-form-actions.test.ts`, `quality/form-keyboard-safety.test.ts`, `quality/expo-sqlite-transactions.test.ts`, `quality/sprint-6-screen-a11y.test.ts` | baixo | coberto |
| `app/routines/templates.tsx` | C/U: `quality/sprint-6-programs-a11y.test.ts`, `quality/expo-sqlite-transactions.test.ts`, `utils/routine-template-integrity.test.ts` | baixo | coberto |
| `app/routine/[routineId].tsx` | B/C/U: `screens/routine-preview.test.ts`, `screens/routine-preview-routes.test.ts`, `quality/sprint-3-information-hierarchy.test.ts`, `quality/expo-sqlite-transactions.test.ts` | baixo | coberto |
| `app/session/exercise.tsx` | B/C/Q: `screens/exercise-navigation.test.tsx`, `quality/sprint-5-session-controls.test.ts`, `quality/sprint-5-set-actions.test.ts`, `quality/sprint-5-session-draft.test.ts`, `quality/sprint-6-workout-screen-a11y.test.ts` | baixo | coberto |
| `app/session/[routineId].tsx` | C/U: `quality/sprint-5-session-progress.test.ts`, `quality/sprint-5-session-draft.test.ts`, `quality/progress-bar-call-sites.test.ts`; type-safety #73 | baixo | coberto |
| `app/session/finish.tsx` | C/Q: `quality/sprint-6-workout-screen-a11y.test.ts`, `quality/sprint-5-session-controls.test.ts` | baixo | coberto |
| `app/session/summary.tsx` | U/C: `utils/session-summary.test.ts`, `utils/session-verdicts.test.ts`, `services/NotionExportService.test.ts`, navegação em `quality/sprint-3-information-hierarchy.test.ts` | P: sem render test isolado da tela | aceitar como risco não-crítico; reavaliar no Sprint 11 |
| `app/reports/weekly.tsx` | B/C: `screens/weekly-report.test.ts`, `quality/sprint-3-information-hierarchy.test.ts`; export coberto por serviço | baixo | coberto |
| `app/supplements/index.tsx` | C/U: `quality/sprint-5-form-state.test.ts`, `quality/sprint-5-form-actions.test.ts`, `quality/form-keyboard-safety.test.ts`, `quality/sprint-6-screen-a11y.test.ts`, `quality/sprint-6-programs-a11y.test.ts`, `quality/progress-bar-call-sites.test.ts` | baixo | coberto |

## Módulos fora da matriz de telas

| Módulo | Evidência | Decisão |
|---|---|---|
| `src/validators/forms.ts` | `validators/forms.test.ts`, `utils/monthly-checkin-regression.test.ts`, `utils/session-trust.test.ts` | coberto |
| `src/validators/routes.ts` | `validators/routes.test.ts`, `screens/routine-preview-routes.test.ts`, `screens/exercise-navigation.test.tsx` | coberto |
| `src/validators/index.ts` | barrel de export (`routes` + `forms`), sem lógica própria | não criar teste artificial |
| `src/db/schema.ts` | importado pelos hooks/testes; invariantes exercitadas por `hooks/use-routines.test.tsx` e `quality/expo-sqlite-transactions.test.ts` | sem seam unitário adicional |
| `src/db/client.ts` | inicialização de infraestrutura; `use-routines.test.tsx` fornece mock explícito ao consumidor | sem teste isolado; requer ambiente nativo real |
| `src/utils/session-*.ts` | testes unitários dedicados; coverage report identifica branches menores sem falha global | manter foco em contratos, não perseguir porcentagem |
| `src/i18n/index.tsx` | `i18n/i18n.test.tsx` e contrato de type-safety #73 | coberto |

## Gaps críticos encontrados

Nenhum gap crítico que justifique código novo neste slice.

- `session/summary` merece render QA no ciclo final porque é uma superfície de confiança pós-treino, mas suas decisões de domínio e rotas de saída já estão exercitadas. O risco residual é de composição visual/renderização, não de uma regressão comportamental descoberta no inventário.
- A cobertura automática não deve ser expandida para `app/**/*.tsx` sem um desenho de harness e um critério de risco; transformar cada tela em snapshot/render test aumentaria manutenção sem provar mais correção.
- `src/validators/index.ts` é apenas barrel e `src/db/client.ts` é bootstrap nativo. Criar testes unitários artificiais para eles não fecha nenhum risco de produto.

## Resultado operacional

- #69 fica **[REVIEWED] / concluído como slice de qualidade**.
- Nenhuma feature ou mudança de dependência foi adicionada.
- Nenhuma issue do GitHub foi fechada ou relabelled automaticamente.
- O próximo checkpoint é a decisão de release scope: manter #76 deferred por upgrade de Expo SDK e decidir se Sprint 8 será pulado quando não houver candidato pré-release seguro.

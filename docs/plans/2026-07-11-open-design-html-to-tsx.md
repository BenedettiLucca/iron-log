# Iron Log Open Design → TSX Implementation Plan

> **Para o Hermes:** executar cada fatia com **Antigravity para o trabalho volumoso** e revisão obrigatória do Hermes antes de integrar. Não fazer migração monolítica. Não copiar HTML literalmente.

**Objetivo:** traduzir a linguagem visual aprovada no projeto Open Design `iron-log-redesign` para as telas React Native/Expo existentes, preservando toda a lógica, dados, i18n, acessibilidade e navegação atuais.

**Arquitetura:** o HTML é somente referência visual. As rotas Expo Router, hooks, serviços, SQLite/Drizzle e componentes de domínio continuam sendo a fonte de verdade. A migração será feita por famílias de telas, começando por tokens e primitivas opt-in, seguindo para fluxos de menor risco e deixando o treino ativo por último.

**Stack:** Expo SDK 54, React Native 0.81, TypeScript, Expo Router, NativeWind v4, Reanimated, `react-native-svg`, `react-native-gifted-charts`, SQLite + Drizzle, Jest + Testing Library.

**Fontes auditadas:**
- Open Design: `/home/lucca/.local/share/open-design/projects/iron-log-redesign`
- App: `/home/lucca/Projects/iron-log`
- Preview: `http://127.0.0.1:7456/api/projects/iron-log-redesign/raw/index.html`

**Baseline verificado em 2026-07-11:**
- `npm run typecheck` — passou
- `npm run lint` — passou, zero issues
- `npm test -- --runInBand` — 30 suites / 390 testes passaram

**Estado verificado em Android físico em 2026-07-13:**
- Home, Sobre, Ajustes e fluxo crítico sessão → exercício → série → descanso capturados em dark mode;
- crash nativo por `<line>`/`<polyline>` e overlay de `expo-notifications` no Expo Go corrigidos em `cf532b6`;
- typecheck, lint e 424 testes passaram após os fixes;
- matriz completa de light mode, larguras, idiomas e font scale continua pendente.

---

## 1. Decisões de escopo

### Decisões padrão para esta migração

1. **Substituir o Drawer por bottom tabs.** Decisão aprovada pelo Lucca: a navegação principal seguirá a bottom row do Open Design, adaptada para Expo Router e safe area nativa.
2. **Manter os headers do Expo Router.** Traduzir primeiro o conteúdo das telas. Header customizado só entra se houver uma decisão separada.
3. **Usar fonte nativa do sistema.** Decisão final: remover usos fictícios de `font-display`; o `DM Sans` do HTML não entra no app.
4. **Não criar features novas só porque aparecem nos mocks.** Mock data e interações de demonstração não viram requisitos de produto automaticamente.
5. **Preservar arquitetura dividida do treino:** visão geral da sessão em `app/session/[routineId].tsx` e registro de exercício em `app/session/exercise.tsx`, mesmo que `active-workout.html` misture os dois.
6. **Usar componentes existentes antes de criar abstrações.** Só extrair uma nova primitiva quando o mesmo padrão aparecer em pelo menos três telas ou quando reduzir risco de inconsistência.
7. **Sem dependência nova por padrão.** `react-native-svg`, Reanimated, Gifted Charts, Expo Linear Gradient e os componentes existentes já cobrem o necessário.

### Arquitetura de navegação aprovada

| Tab | Rota principal | Ícone | Responsabilidade |
|---|---|---|---|
| Início | `/(tabs)` | home | Dashboard, sessão incompleta, programa atual e rotinas rápidas |
| Treinos | `/routines` | dumbbell/workout | Rotinas; ponto de entrada para programas e templates |
| Histórico | `/history` | trend/calendar | Calendário e sessões anteriores |
| Biometria | `/bio` | body/person | Peso, check-ins, evolução, analytics, metas; acesso a suplementos e relatórios |
| Ajustes | `/settings` | settings | Preferências, backup, idioma e acesso a Sobre |

A bottom row contém **somente cinco screens diretas** dentro de `app/(tabs)`: `index.tsx`, `routines.tsx`, `history.tsx`, `bio.tsx` e `settings.tsx`.

Rotas secundárias continuam existindo, mas ficam como telas do Stack raiz, fora de `(tabs)`:

- **Treinos:** `app/programs/*`, `app/routines/editor.tsx`, `app/routines/templates.tsx`;
- **Biometria:** `app/bio/evolution.tsx`, `goals.tsx`, `analytics.tsx`, `checkin.tsx`, `app/supplements/index.tsx`, `app/reports/weekly.tsx`;
- **Ajustes:** `app/about.tsx`;
- **Full-screen:** `app/routine/[routineId].tsx` e todo o fluxo `app/session/*`.

Essa separação é intencional: tabs permanecem selecionadas apenas nas cinco áreas principais; detalhes e formulários abrem full-screen, sem tab bar, com back nativo do Stack. Assim não existe “sexta tab invisível”, tab sem estado ativo nem gambiarra de `href: null`.

Acessos que hoje dependem do Drawer devem ganhar entradas claras nas telas-pai: Programas em Treinos, Suplementos/Relatórios em Biometria e Sobre em Ajustes.

O diretório `app/(drawer)` será desmontado no mesmo slice: as cinco telas principais vão para `app/(tabs)` e as secundárias para o Stack raiz. Route groups não entram na URL, então os paths públicos (`/routines`, `/bio`, `/programs/...`) permanecem iguais; imports relativos, `app/_layout.tsx`, docs e referências internas devem ser atualizados juntos.

### Gates que ainda exigem debate antes de mudar

- Headers nativos → headers customizados/frosted glass.
- Adição de novas métricas/features sugeridas apenas pelos mocks.
- Mudança da arquitetura do treino para uma tela única.

### Elementos do HTML que não devem ser copiados literalmente

- frame de iPhone, status bar Android/iOS e home indicator;
- theme toggle dentro de cada tela;
- markup/CSS/JavaScript da bottom navigation do protótipo; a arquitetura visual será recriada com `Tabs` do Expo Router;
- `localStorage`, DOM scripts e navegação entre `.html`;
- hover states, `backdrop-filter`, CSS Grid e `position: fixed`;
- dados hardcoded como “Olá, Lucca”, PRs, volume e consistência fictícios;
- Canvas/confetti pesado;
- drag-and-drop sem requisito funcional aprovado;
- botões ou fluxos que duplicam serviços nativos já existentes.

---

## 2. Mapa das referências HTML

| Referência Open Design | Destino TSX | Como usar |
|---|---|---|
| `index.html` | `app/(tabs)/index.tsx` | Hierarquia do dashboard, card de sessão ativa, cards compactos, ritmo vertical. Não implementar greeting personalizado, calendário de consistência ou sparklines sem dados reais aprovados. |
| `history.html` | `app/(tabs)/history.tsx` | Estilo do calendário, legenda e cards de sessões. Preservar `react-native-calendars`, filtros e navegação existentes. |
| `reports-2.html` | `app/reports/weekly.tsx` | Referência canônica do relatório semanal; é o artefato “primary” mais recente. |
| `reports.html` | `app/reports/weekly.tsx` | Duplicata anterior; ignorar quando divergir de `reports-2.html`. |
| `report-weekly.html` | `app/reports/weekly.tsx` | Variação compacta; usar apenas ideias úteis de toolbar/exportação. |
| `supplements.html` | `app/supplements/index.tsx` | Checklist, progresso, agrupamento e modal. Preservar CRUD, frequência, logs e lembretes reais. |
| `settings.html` | `app/(tabs)/settings.tsx` | Seções, rows, switches e estados destrutivos. Preservar backup/import/export, idioma e notificações. |
| `about.html` | `app/about.tsx` | Layout estático e cards informativos. |
| `bio.html` | `app/(tabs)/bio.tsx` | Hierarquia de peso diário, medidas, fotos e atalhos. Preservar validação, dirty state e manipulação de imagens. |
| `bio-evolution.html` | `app/bio/evolution.tsx` | Hierarquia das tabs, cards de gráfico e métricas. Manter Gifted Charts e scroll horizontal real. O seletor 30d/90d/Tudo é feature nova e não entra sem decisão de produto. |
| `bio-analytics.html` | `app/bio/analytics.tsx` | Score, consistência, volume e PRs usando apenas dados já calculados pelo app. |
| `bio-checkin.html` | `app/bio/checkin.tsx` | Comparação, abas Medidas/Fotos e modal de novo check-in. Reusar componentes de foto existentes. |
| `bio-goals.html` | `app/bio/goals.tsx` | Cards de metas e formulário. Preservar schema/CRUD atual; não mostrar barra de progresso ou ação Editar sem valor inicial/atual e update persistente confiáveis. |
| `routines.html` | `app/(tabs)/routines.tsx` | Cards, ações, busca/importação e empty state. Não criar categorias/pastas novas sem modelo de dados. |
| `routine-detail.html` | `app/routine/[routineId].tsx` | Hero/summary, estatísticas, exercícios expansíveis e CTA fixo seguro. Preservar queries e gráficos reais. |
| `routine-editor.html` | `app/routines/editor.tsx` | Formulário, lista selecionável e cards editáveis. Não adicionar drag-and-drop nesta migração. |
| `routine-templates.html` | `app/routines/templates.tsx` | Cards de templates, seleção e feedback. O HTML parece uma biblioteca de divisões/programas; o domínio RN atual é de rotinas `isTemplate` clonáveis e deve ser preservado. |
| `programs.html` | `app/programs/index.tsx` | Lista, programa ativo, programas anteriores/arquivados já existentes e CTA. Reorganizar a hierarquia sem alterar os estados reais. |
| `program-create.html` | `app/programs/create.tsx` | Layout do formulário/wizard e controle de semanas. Preservar campos e validações reais; emojis de objetivo são decorativos, não schema novo. |
| `program-week.html` | `app/programs/week-detail.tsx` | Seletor semanal, sessões e targets. |
| — sem HTML dedicado — | `app/programs/detail.tsx` | Aplicar apenas primitivas e linguagem visual compartilhadas de `programs.html`/`program-week.html`; não inventar composição nova. |
| `active-workout.html` | `app/session/[routineId].tsx` **e** `app/session/exercise.tsx` | Usar header/progresso/resumo na visão da sessão e log/input/timer na tela de exercício, sem colapsar as rotas. |
| `session-exercise.html` | `app/session/exercise.tsx` + `components/session/*` | Referência principal para rows de séries, histórico, resumo do exercício e timer. |
| `session-finish.html` | `app/session/finish.tsx` | Estatísticas, sRPE, peso, observações, CTA e estados de salvamento. |
| `workout-summary.html` | `app/session/summary.tsx` | Celebração, stats, destaques e ações de export/share. Preservar os formatos reais existentes. |

---

## 3. Regras de preservação funcional

A mudança é visual. Estes comportamentos não podem regredir:

- i18n em PT/EN/ES/ZH; nenhum texto novo hardcoded em português;
- loading, error, empty, refresh e retry states;
- safe area, teclado e scroll em telas pequenas;
- SQLite/Drizzle e soft delete;
- recuperação de sessão incompleta e proteção contra saída acidental;
- exercícios por carga/reps **e** por duração;
- warm-up fora do volume/progresso quando aplicável;
- undo, edição e exclusão de séries;
- rest timer, haptics e acessibilidade de RIR;
- controles atuais do timer (`+30s`, `-10s`, skip e gesto de dismiss), ainda que o HTML mostre `+15s`;
- metas de programa, double progression, deload e key lifts;
- fotos front/back/side, comparação, limpeza de arquivos e dirty state;
- backup/import/export, Notion, CSV e Alexandria;
- notificações e preferências persistidas;
- touch targets mínimos de 44×44 e labels/hints já existentes.

Mocks podem omitir essas funções; omissão visual não autoriza remoção.

Regras específicas de biometria:

- check-ins mensais continuam aceitando campos parciais;
- campo vazio significa “não informado”, nunca `0` por coerção;
- fotos/medidas omitidas numa atualização devem preservar os valores anteriores;
- criação continua no modal canônico de `bio/index.tsx`; `bio/checkin.tsx` permanece leitura, histórico e comparação;
- metas não ganham progresso determinístico até existir contrato claro de valor inicial, valor atual e direção da meta;
- Analytics preserva `AnalyticsService`, Strength Score, e1RM e PRs; não recebe distribuição muscular ou insights estáticos do HTML.

---

## 4. Sistema visual a transportar

### Tokens

Os tokens atuais do app e do Open Design **não** são o contrato final. Ambos ainda usam primary `#E07A5F` e superfícies brancas em pontos onde a direção aprovada já mudou. O rollout deve seguir este contrato:

- Primary `#9E422E`
- On-primary `#F4F1DE` — contraste 5.65:1
- Secondary `#3D5A80`
- Accent `#F2CC8F`
- Light background/surface `#F4F1DE`; branco puro não é superfície padrão
- Light text `#3D405B` — contraste 8.87:1 sobre o creme
- Dark background `#1D1917`
- Dark card `#2A2422`
- Success `#81B29A`
- Danger `#E63946`

Primary `#9E422E` sobre creme passa AA para texto normal (5.65:1). As demais cores brutas não devem ser reutilizadas como fill, texto e foreground: Sprint 1 define pares semânticos por tema (`on*`, `*Text`, `*Surface`).

**Correção necessária:** `constants/colors.ts` usa `darkBorder: #605050`, enquanto `global.css` usa `60 50 50` (`#3C3232`). Unificar o token NativeWind em `96 80 80` para eliminar diferença entre classes e inline styles.

### Padrões visuais prioritários

- superfícies quentes com borda leve e shadow curta;
- radius consistente de 16–20 px;
- section labels pequenas, uppercase e com tracking;
- números de destaque com label curta abaixo/acima;
- badges semânticos com fundo translúcido;
- cards ativos com accent border, não com blocos saturados;
- espaçamento 4/8/12/16/20/24/32;
- CTA principal claro, ação destrutiva separada;
- uma hierarquia por tela: título → resumo → ação/estado → detalhes.

### Primitivas candidatas

Criar apenas se a repetição real justificar durante a primeira fatia:

- `components/SectionHeader.tsx` — label + ação opcional;
- `components/StatTile.tsx` — valor, label, delta/semantic tone;
- `components/SegmentedControl.tsx` — tabs já existentes com estado selecionado acessível;
- extensão opt-in de `Card.tsx` para `accent`/`tone`, sem alterar defaults;
- extensão opt-in de `Button.tsx` somente se um variant realmente se repetir.

**Não criar agora:** design-system framework, icon library própria, generic grid, generic page builder, abstração de chart universal ou bottom-sheet novo. O app já tem `RestTimer`, `Dialog`, `SetEditor`, `PhotoComparison` e `MonthlyCheckinComparison`.

---

## 5. Estratégia Antigravity + Hermes

Cada fatia segue este ciclo:

1. Criar worktree a partir de `master` e linkar `node_modules` do repo principal.
2. Escrever `.antigravity-task.md` com:
   - arquivos permitidos;
   - referência HTML específica;
   - comportamentos que não podem mudar;
   - non-goals;
   - comandos de verificação.
3. Rodar Antigravity com Gemini 3.5 Flash High:

```bash
agy --model "Gemini 3.5 Flash (High)" \
  --dangerously-skip-permissions \
  -p "Follow .antigravity-task.md"
```

4. Se houver 429, trocar modelo conforme a rotação configurada; não ficar repetindo o mesmo run.
5. Hermes revisa **todos** os arquivos alterados e também os novos untracked.
6. Rodar ponytail review para remover abstrações e mudanças laterais.
7. Integrar somente arquivos aprovados no repo principal.
8. Rodar typecheck, lint, testes focados e suíte completa.
9. Abrir no Android, coletar todos os problemas visuais da fatia e esperar o **último screenshot** antes do commit.
10. Commitar somente a fatia verificada; apagar `.antigravity-task.md` e scaffolding temporário.

**Não paralelizar fatias que tocam `Card`, `Button`, traduções ou o mesmo screen family.** A migração é visual e conflita fácil; serialização vale mais que velocidade aqui.

---

## 6. Plano de implementação

### Fase 0 — Congelar escopo e baseline visual

**Objetivo:** impedir que a referência vire feature creep.

**Arquivos:**
- Referência: todos os `.html` e `style.css` do projeto Open Design
- Sem mudanças de produto

**Passos:**
1. Capturar screenshots em light/dark das referências canônicas.
2. Registrar viewport de comparação (Android principal + aparelho pequeno).
3. Fixar a navegação aprovada: cinco bottom tabs, telas secundárias no Stack raiz, header nativo, fonte do sistema e sem features inferidas dos mocks.
4. Usar o baseline técnico já verificado: 30 suites / 390 testes.

**Aceite:** lista de telas e referências fechada; duplicatas de relatório identificadas; nenhum requisito funcional inferido de mock data.

---

### Fase 1 — Bottom tabs + fundação visual

**Objetivo:** substituir o Drawer pela bottom row aprovada e criar a base visual sem redesenhar todas as telas de uma vez.

**Arquivos de navegação:**
- Move: `app/(drawer)/index.tsx` → `app/(tabs)/index.tsx`
- Move: `app/(drawer)/routines/index.tsx` → `app/(tabs)/routines.tsx`
- Move: `app/(drawer)/history/index.tsx` → `app/(tabs)/history.tsx`
- Move: `app/(drawer)/bio/index.tsx` → `app/(tabs)/bio.tsx`
- Move: `app/(drawer)/settings.tsx` → `app/(tabs)/settings.tsx`
- Move: demais telas de `app/(drawer)` para os paths equivalentes no Stack raiz (`app/bio`, `app/routines`, `app/programs`, `app/supplements`, `app/reports`, `app/about.tsx`)
- Replace: `app/(drawer)/_layout.tsx` por `app/(tabs)/_layout.tsx` usando `Tabs` de `expo-router`
- Modify: `app/_layout.tsx` para registrar `(tabs)` e as rotas secundárias no Stack
- Create: `components/navigation/TabIcon.tsx` com os cinco ícones via `react-native-svg` já instalado
- Modify: `src/i18n/translations/{pt,en,es,zh}.ts` com labels curtas específicas de tabs
- Modify: `package.json` e `package-lock.json`
- Update: `README.md`, `CLAUDE.md`, `GEMINI.md` e docs que descrevem `(drawer)`

**Arquivos de acessibilidade/reachability:**
- Modify: `app/(tabs)/routines.tsx` — entrada clara para Programas e Templates
- Modify: `app/(tabs)/bio.tsx` — entradas claras para Suplementos e Relatório Semanal
- Modify: `app/(tabs)/settings.tsx` — entrada clara para Sobre

**Arquivos visuais:**
- Modify: `global.css`
- Modify: `constants/colors.ts` somente se necessário para manter uma fonte de verdade
- Modify: `components/Card.tsx`
- Modify: `components/Button.tsx` somente se um novo variant for comprovadamente necessário
- Create, se usados em 3+ telas: `components/SectionHeader.tsx`, `components/StatTile.tsx`, `components/SegmentedControl.tsx`
- Test, se houver comportamento: `__tests__/components/design-primitives.test.tsx`

**Passos:**
1. Instalar `@react-navigation/bottom-tabs` como dependência direta compatível com Expo e remover `@react-navigation/drawer` após a migração:

```bash
npx expo install @react-navigation/bottom-tabs
npm uninstall @react-navigation/drawer
```

2. Mover as cinco telas principais para `(tabs)` e as secundárias para o Stack raiz, ajustando todos os imports relativos.
3. Configurar exatamente cinco `Tabs.Screen`: Início, Treinos, Histórico, Biometria e Ajustes.
4. Recriar a bottom row do mock com superfície `bg-card`, borda superior sutil, ícone + label, primary no ativo, subtext no inativo e safe area nativa. Nada de frame/status bar fake.
5. Manter o header nativo e esconder a tab bar automaticamente ao abrir qualquer rota do Stack raiz.
6. Garantir reachability de Programas, Templates, Suplementos, Relatório e Sobre antes de remover o Drawer.
7. Preservar URLs públicas e validar deep links/`router.push` existentes após os moves.
8. Unificar `darkBorder` para RGB `96 80 80` em `global.css`.
9. Adicionar variantes de `Card` como opt-in; manter o output default atual.
10. Implementar primitivas mínimas com accessibility role/state e touch target correto.
11. Não adicionar fonte, blur ou biblioteca externa de ícones.
12. Rodar i18n parity, typecheck, lint e suíte completa.

**QA obrigatório da navegação:**
- cada tab mantém estado/scroll ao alternar;
- re-tap da tab volta ao topo quando suportado pelo navigator;
- Android back não encerra o app a partir de uma rota secundária;
- `session/*` e `routine/[routineId]` nunca mostram a bottom row;
- tab bar não cobre FAB, último card, teclado ou home indicator;
- labels permanecem legíveis em PT/EN/ES/ZH e com fonte ampliada;
- todos os antigos destinos do Drawer continuam alcançáveis em no máximo dois toques a partir da tab responsável.

**Aceite:** Drawer removido; exatamente cinco tabs; nenhuma rota órfã; URLs/deep links intactos; light/dark consistentes; defaults de `Card`/`Button` preservados; todos os checks verdes.

---

### Fase 2 — Piloto de baixo risco: Sobre + Relatório

**Objetivo:** validar tokens, ritmo e componentes em telas simples antes de tocar fluxos críticos.

**Arquivos:**
- Modify: `app/about.tsx`
- Modify: `app/reports/weekly.tsx`
- Reference: `about.html`, `reports-2.html`

**Passos:**
1. Traduzir cards, section labels e espaçamento de `about.html` sem inventar conteúdo; preservar `assets/images/icon.png`, versão real do app e textos do i18n.
2. Aplicar a composição de `reports-2.html` sobre os dados reais do `NotionExportService`.
3. Preservar loading, geração Markdown, cópia via `NotionExportService` e Toast. Não criar o botão “Exportar” da referência sem serviço correspondente.
4. Trocar qualquer hex inline pelo token existente durante a edição do arquivo.
5. Validar texto longo nos quatro idiomas.

**Aceite:** duas telas aprovadas em light/dark; export/copy continuam funcionando; nenhum texto hardcoded novo.

---

### Fase 3 — Descoberta e catálogos: Home, Rotinas, Programas, Histórico

**Objetivo:** transportar a nova linguagem para navegação de conteúdo sem alterar domínio.

**Arquivos:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/routines.tsx`
- Modify: `app/programs/index.tsx`
- Modify: `app/(tabs)/history.tsx`
- Reference: `index.html`, `routines.html`, `programs.html`, `history.html`

**Passos:**
1. Reorganizar visualmente o dashboard usando dados que já existem: sessão incompleta, programa, volume, sRPE, key lifts, última sessão e rotinas.
2. Não implementar greeting, consistência semanal ou sparklines sem fonte de dados aprovada.
3. Aplicar cards e action hierarchy às listas de rotinas/programas, preservando a separação já existente entre programa ativo e anteriores/arquivados.
4. Não criar categorias de rotina nem novos estados de programa.
5. Tematizar o calendário com tokens existentes sem substituir a biblioteca.
6. Preservar refresh, seed, duplicate/delete/import, empty/error/loading e rotas.

**Aceite:** todos os CTAs levam às mesmas rotas; listas grandes scrollam; calendário mantém marcações; sessão incompleta continua recuperável.

---

### Fase 4 — Biometria de leitura: Evolução + Analytics

**Objetivo:** migrar as telas mais densas de visualização sem mexer nos cálculos.

**Arquivos:**
- Modify: `app/bio/evolution.tsx`
- Modify: `app/bio/analytics.tsx`
- Modify somente se necessário: `components/StrengthCurve.tsx`, `components/PhotoComparison.tsx`
- Preserve: `src/utils/chart-layout.ts`
- Test: `__tests__/utils/chart-layout.test.ts` e `__tests__/services/analytics.test.ts`
- Reference: `bio-evolution.html`, `bio-analytics.html`

**Passos:**
1. Usar `SegmentedControl` somente para tabs que já existem. Não adicionar 30d/90d/Tudo nesta migração; isso exige filtro real, regras para cada série e testes próprios.
2. Manter Gifted Charts; não converter SVG/DOM dos mocks.
3. Manter medidas agrupadas na arquitetura existente; tabs internas por medida só entram se reduzirem densidade sem esconder dados.
4. Aplicar stat tiles e cards de insight aos valores reais.
5. Preservar scroll horizontal calculado, empty states, moving average, fotos e analytics.
6. Validar datasets com 0, 1, poucos e muitos pontos.

**Aceite:** nenhum gráfico cortado; labels legíveis; scroll horizontal não disputa com scroll vertical; cálculos existentes inalterados.

---

### Fase 5 — Biometria de entrada: Principal + Check-in + Metas

**Objetivo:** migrar formulários/fotos preservando validação e arquivos locais.

**Arquivos:**
- Modify: `app/(tabs)/bio.tsx`
- Modify: `app/bio/checkin.tsx`
- Modify: `app/bio/goals.tsx`
- Modify somente se necessário: `components/CheckinGallery.tsx`, `components/MonthlyCheckinComparison.tsx`, `components/DatePicker.tsx`, `components/Input.tsx`
- Tests: `__tests__/utils/body-metrics.test.ts`, `checkin*.test.ts`, `monthly-checkin-regression.test.ts`, `validators/forms.test.ts`
- Reference: `bio.html`, `bio-checkin.html`, `bio-goals.html`

**Passos:**
1. Aplicar a hierarquia peso diário → ações → medidas → fotos.
2. Preservar pickers, paths das fotos, validação, dirty state e save semantics.
3. Traduzir tabs Medidas/Fotos sem duplicar componentes de comparação.
4. Reestilizar metas e formulário sem alterar schema. Não renderizar progresso falso nem botão Editar sem operação de update persistente.
5. Testar teclado, permissões negadas, cancelamento, imagem ausente e retorno da navegação.

**Aceite:** nenhum arquivo de foto órfão novo; cancelamento não salva; inputs continuam validados; edição/novo check-in não se confundem.

---

### Fase 6 — Formulários e preferências

**Objetivo:** padronizar telas de gestão sem misturar redesign com mudança de produto.

**Arquivos:**
- Modify: `app/routines/editor.tsx`
- Modify: `app/routines/templates.tsx`
- Modify: `app/programs/create.tsx`
- Modify: `app/supplements/index.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Reference: `routine-editor.html`, `routine-templates.html`, `program-create.html`, `supplements.html`, `settings.html`

**Passos:**
1. Aplicar section headers, field grouping, cards selecionáveis e CTA hierarchy.
2. Não adicionar drag-and-drop no editor.
3. Não adicionar novos campos de programa porque aparecem no mock; steppers só podem substituir inputs se preservarem os mesmos limites e validação.
4. Manter templates como rotinas `isTemplate` clonáveis, não convertê-los em divisões/programas multi-dia do HTML.
5. Não criar seletor kg/lbs, logs de desenvolvedor ou estado fictício de Google conectado a partir de `settings.html`.
6. Preservar CRUD, import, templates, frequência de suplementos, lembretes, backup, idioma e confirmações destrutivas.
7. Testar teclado, switches, modais, permissão, validação e estados loading/disabled.

**Aceite:** salvar/cancelar/excluir continuam idempotentes; nenhuma opção some; formulários cabem em tela pequena com teclado aberto.

---

### Fase 7 — Detalhes de rotina e programa

**Objetivo:** alinhar telas de detalhe ao novo sistema visual antes de entrar em sessão ativa.

**Arquivos:**
- Modify: `app/routine/[routineId].tsx`
- Modify: `app/programs/detail.tsx`
- Modify: `app/programs/week-detail.tsx`
- Modify somente se necessário: `components/RoutinePreview.tsx`, `components/ProgressBar.tsx`
- Tests: `__tests__/screens/routine-preview*.test.ts`, `program-detail-state.test.ts`, `services/program.test.ts`
- Reference: `routine-detail.html`, `programs.html`, `program-week.html`

**Passos:**
1. Aplicar summary card, stat tiles, exercícios expansíveis e CTA claro à rotina.
2. Preservar PRs, weight history, cálculos e start-session params.
3. No detail de programa, usar apenas linguagem compartilhada porque não existe mock específico.
4. Aplicar seletor semanal e estado semântico done/missed/deload.
5. Validar nomes longos, rotina sem exercícios, programa sem semana e programa completo.

**Aceite:** start workout passa params válidos; gráficos/PRs continuam corretos; semana e deload mantêm significado sem depender só de cor.

---

### Fase 8 — Sessão ativa: visão geral

**Objetivo:** migrar a tela de sessão com risco controlado, sem tocar ainda no editor de séries.

**Arquivos:**
- Modify: `app/session/[routineId].tsx`
- Modify somente se necessário: `components/Stopwatch.tsx`, `components/ProgressBar.tsx`, `components/Dialog.tsx`
- Tests: `session-start.test.ts`, `session-recovery-a11y.test.ts`, `workout-a11y.test.ts`
- Reference: shell/header/progresso de `active-workout.html`

**Passos:**
1. Traduzir header de sessão, rotina, progresso e cards de exercícios.
2. Manter Stack header, stopwatch, beforeRemove, double-back, soft-delete de sessão vazia e dialogs.
3. Não mover logging de sets para esta tela.
4. Preservar live queries e definição atual de exercício concluído.
5. Testar sair, voltar, retomar, finalizar cedo e rotina vazia.

**Aceite:** zero ghost session; proteção de saída intacta; progresso reage em tempo real; TalkBack anuncia status corretamente.

---

### Fase 9 — Sessão ativa: exercício e timer

**Objetivo:** aplicar o novo logger sem quebrar o fluxo mais crítico do app.

**Arquivos:**
- Modify: `app/session/exercise.tsx`
- Modify: `components/session/ExerciseHeader.tsx`
- Modify: `components/session/SetList.tsx`
- Modify: `components/SetCard.tsx`
- Modify: `components/RestTimer.tsx`
- Modify somente se necessário: `components/SetEditor.tsx`, `ExerciseHistoryModal.tsx`, `RirExplainerModal.tsx`
- Preserve: hooks `use-exercise-sets`, `use-session-persistence`, `use-session-timer`, `use-session-undo`, `use-progression`
- Tests: `exercise.test.ts`, `timer.test.ts`, `warmup.test.ts`, `workout-a11y.test.ts`
- Reference: `session-exercise.html` + área de log/input de `active-workout.html`

**Passos:**
1. Adaptar header, rows, inputs, RIR, history e action hierarchy.
2. Preservar as duas modalidades: strength e duration.
3. Preservar undo, edit/delete, warm-up, persistence, progression banner, haptics e rest timer.
4. Não substituir componentes testados por uma tela monolítica copiada do HTML.
5. Testar teclado numérico, decimal, set rápido, duração, timer em background/foreground, next e finish.

**Aceite:** set não duplica em double tap; dados persistem; warm-up não contamina volume; timer e undo continuam funcionais; layout não corta CTA.

---

### Fase 10 — Finalização + resumo

**Objetivo:** fechar o fluxo com a hierarquia visual do Open Design e sem alterar os contratos de exportação.

**Arquivos:**
- Modify: `app/session/finish.tsx`
- Modify: `app/session/summary.tsx`
- Modify somente se necessário: `components/Dialog.tsx`, `components/Toast.tsx`
- Preserve: `src/utils/session-summary.ts`, `session-verdicts.ts`, `session-verdict-markdown.ts`
- Tests: `session-summary.test.ts`, `session-verdicts.test.ts`, `csv-export.test.ts`, `NotionExportService.test.ts`
- Reference: `session-finish.html`, `workout-summary.html`

**Passos:**
1. Aplicar stat cards, sRPE emphasis, observações e CTA final.
2. Preservar validação, loading/disabled e bloqueio contra submit duplicado.
3. Aplicar celebração leve com Reanimated apenas se não atrapalhar reduced motion/performance; sem pacote de confetti.
4. Manter Markdown, CSV e Share nativos existentes; não prometer destinos sociais específicos.
5. Validar sessão curta, longa, sem PR, com PR, sem peso e erro de export.

**Aceite:** uma sessão só finaliza uma vez; summary abre com dados reais; todos os exports continuam íntegros; voltar ao início limpa o fluxo corretamente.

---

### Fase 11 — Consolidação visual e release gate

**Objetivo:** remover drift entre fatias e comprovar que o redesign funciona como app, não só como screenshot.

**Arquivos:**
- Todos os TSX migrados
- `src/i18n/translations/{pt,en,es,zh}.ts`
- Testes afetados

**Passos:**
1. Auditar textos novos e paridade de chaves i18n.
2. Buscar hex hardcoded novos e estilos que contradizem tokens.
3. Auditar touch targets, labels, hints, role/state e contraste.
4. Testar light/dark, aparelho pequeno, fonte ampliada e teclado.
5. Percorrer o fluxo real: criar/abrir rotina → iniciar → registrar strength + duration → timer/undo → finalizar → summary → histórico/report.
6. Percorrer biometria: peso → check-in/fotos → evolução → metas.
7. Percorrer backup/export/settings e suplementos.
8. Coletar todos os issues visuais antes de mexer; aguardar o último screenshot do Lucca; corrigir em um pass consolidado.
9. Rodar gates finais:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git status --short
git diff --check
```

10. Gerar build Android real conforme o workflow de release antes de chamar a migração de concluída.

**Aceite final:**
- 100% dos gates verdes;
- nenhuma lógica de domínio removida;
- zero texto novo fora do i18n;
- navegação e deep links intactos;
- light/dark aprovados;
- sem conteúdo coberto por header/nav/teclado;
- screenshots finais aprovados pelo Lucca.

---

## 7. Non-goals explícitos

Ficam fora desta migração, salvo decisão posterior:

- unificar telas da sessão;
- criar folders/categorias de rotina;
- criar novos estados de programa além dos já existentes;
- drag-and-drop de exercícios;
- greeting por nome/perfil;
- calendário de consistência e sparklines sem dados reais;
- novo sistema de ícones;
- novo pacote de fontes;
- blur/frosted glass cross-platform;
- pacote de confetti;
- mudanças de schema ou migrations;
- refatoração de hooks/serviços não necessária ao visual.

---

## 8. Ordem de commits sugerida

1. `refactor: replace drawer navigation with bottom tabs`
2. `style: add opt-in redesign primitives`
3. `style: redesign about and weekly report screens`
4. `style: redesign dashboard and catalog screens`
5. `style: redesign bio analytics screens`
6. `style: redesign bio input screens`
7. `style: redesign management forms`
8. `style: redesign routine and program details`
9. `style: redesign active session overview`
10. `style: redesign exercise logging flow`
11. `style: redesign session finish and summary`
12. `fix: polish redesigned screens after visual QA`

Cada commit só entra depois de review Hermes + checks + QA visual da fatia. Antigravity faz o grosso; Hermes é o gate de correção e escopo.

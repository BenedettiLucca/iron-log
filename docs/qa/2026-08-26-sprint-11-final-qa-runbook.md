# Sprint 11 — QA visual final e release hardening

- **Status:** HUMAN GATE PASS — F1–F11 confirmados; TalkBack permanece `SKIPPED` por decisão do operador (2026-08-27)
- **Runtime candidate:** `sprint/7-pre-release-scope` @ `d1f7f30`
- **Execução:** Expo Go via LAN; não é necessário plugar o Samsung S23 para este passe.
- **Baseline estático:** 93 suites / 833 testes; typecheck e lint verdes após o Sprint 10.
- **Escopo:** provar o polish final sem abrir redesign ou feature nova.
- **Referência:** [runbook da Sprint 6](2026-08-25-sprint-6-android-runbook.md) para o fluxo detalhado de i18n, content fit e TalkBack.

## Regra da coleta

Execute a coleta inteira antes de corrigir qualquer coisa. Registre todo FAIL com screenshot ou vídeo curto, passos, esperado e atual. Só depois faça correções validadas; não transforme preferência visual nova em escopo.

Formato:

- PASS: `[S11-QA-XX] PASS — estado/locale/largura/configuração`.
- FAIL: `[S11-QA-XX] esperado → atual — estado/locale/largura/configuração` + evidência.
- TalkBack: registre a frase efetivamente anunciada entre aspas.
- Performance: registre a condição testada, não use “pareceu rápido” sem contexto.

## Setup determinístico

Antes do primeiro passe, registrar:

- modelo Android disponível, versão do Android e versão do Expo Go;
- branch/SHA carregado e URL LAN do Metro;
- tema inicial e escala de fonte;
- valor original de **Menor largura**;
- estado inicial de **Reduce Motion** e TalkBack;
- se fixtures locais foram criados; o cleanup do banco local do Expo Go é dispensado, mas deve ser anotado.

Use tema claro, fonte `1,0` e largura normal no primeiro passe. O teste de 320 dp e fonte ampliada altera configurações temporariamente e deve restaurá-las ao final.

### Setup registrado — primeiro passe real

- aparelho: **Samsung S23**;
- Android: **16**;
- Expo Go: **54.0.8**;
- candidate: `sprint/7-pre-release-scope` @ `d1f7f30`;
- temas testados: claro e escuro;
- escala de fonte, Menor largura, Reduce Motion e TalkBack: **não registrados nesta rodada**; não contam como PASS.

## S11-QA-01 — Screenshot matrix e hierarquia visual

Para cada tela abaixo, capturar pelo menos um estado representativo em tema claro e escuro:

- Home;
- Rotinas: lista, template e editor;
- sessão: header, editor de série, RestTimer e resumo;
- Bio: evolução, metas e check-in;
- Suplementos: lista, progresso e modal;
- Configurações e Sobre.

Repetir o passe nos limites `320`, `360`, `390` e `430 dp` quando disponíveis. Tablet permanece fora de escopo.

PASS quando não houver clipping, sobreposição, CTA fora da viewport, quebra de hierarquia ou mudança de peso/tamanho sem justificativa no design system. Registrar qualquer diferença real contra o baseline da Sprint 6.

### Resultado da coleta inicial — 2026-08-26

`[S11-QA-01] FAIL — Samsung S23 / Android 16 / Expo Go 54.0.8 / claro e escuro`.

1. **Biblioteca de templates — voltar:** spacing e formato/design do botão destoam do header. Evidência de código em `app/routines/templates.tsx:271-278`: há um botão textual absoluto próprio enquanto `app/_layout.tsx:51` também deixa o header nativo da rota ativo; a duplicação explica a composição visual observada.
2. **Sessão de exercício — WarmupToggle:** a bolinha do slider de aquecimento desligado fica off-center. Evidência em `components/session/WarmupToggle.tsx:59-62`: o thumb é filho direto de um trilho com padding, sem alinhamento vertical explícito; confirmar a geometria no ajuste.
3. **Fechar sem affordance de botão:** em Check-in e Adicionar Suplemento, `Button` usa `variant="ghost"`/`size="sm"`, ficando visualmente textual. O mesmo padrão aparece em `app/(tabs)/bio.tsx:417-422`, `app/supplements/index.tsx:474-480`, `app/routines/editor.tsx:665-670` e `components/RoutinePreview.tsx:95`; History/RIR usam closers próprios e entram na checagem ampliada.
4. **Settings — spacing não uniforme:** o layout mistura `ScrollView gap={20}`, seções com `py-2`, divisores explícitos, `RowButton py-3.5` e o botão full-width de testar notificação com `mt-3`. Prioridade observada: Testar Notificação, Importar Dados e Exportar Alexandria JSON. Evidência em `app/(tabs)/settings.tsx:269-390`.
5. **Adicionar Suplemento — switch noturno azul:** `app/supplements/index.tsx:559-563` define `trackColor`, mas não `thumbColor`; no Android o polegar recebe o tint nativo azul. O switch de Settings já passa `thumbColor={theme.onPrimary}`, confirmando que o problema é uma configuração inconsistente e localizada.

As demais telas testadas passaram visualmente nos dois temas. Os itens acima permanecem como FAILs da coleta; nenhuma correção foi aplicada durante o passe.

## S11-QA-02 — Locales e content fit crítico

Executar o fluxo crítico em `pt`, `en`, `es` e `zh`:

1. iniciar uma sessão;
2. editar uma série;
3. salvar;
4. abrir e fechar o RestTimer;
5. concluir a sessão;
6. abrir o resumo;
7. visitar Bio e Suplementos.

PASS quando não houver chave de tradução, fallback, idioma residual, clipping ou CTA ilegível. Para os detalhes de copy e troca sem reinício, executar também S6-QA-01 a S6-QA-05.

### Resultado da coleta — 2026-08-26

`[S11-QA-02] FAIL — content-fit em espanhol; traduções e troca dinâmica passaram`.

- **Português:** PASS — sessão, RestTimer, resumo, Bio/Check-in e Suplementos sem chave exposta, idioma residual ou clipping novo.
- **English:** PASS — fluxo crítico e modal de suplemento legíveis.
- **Español:** FAIL — no resumo, o CTA `Nuevo Entrenamiento` quebra em duas linhas dentro de uma coluna estreita e fica visualmente awkward. Evidência de código em `app/session/summary.tsx:363-381`: dois `Button` com `style={{ flex: 1 }}` dividem igualmente a linha; a tradução espanhola não cabe confortavelmente nessa largura.
- **中文:** PASS — fluxo crítico e content-fit sem problema observado.
- **Troca sem reiniciar:** PASS — `pt → en → es → zh → pt` atualizou sem crash ou estado misto.

Findings adicionais coletados durante o fluxo, mas não relacionados à tradução:

1. **Popup de ações/edição da série fora do tema:** em tema escuro, o app permanece escuro e o `Alert.alert` nativo abre um painel branco. Causa estrutural observada em `components/SetCard.tsx:53-75`: o fluxo usa `Alert.alert`, que não consome os tokens de tema do app. Evidência: `composer_2026-08-26_17-15-06-887_139799.png`.
2. **Spacing extra após salvar série:** após o salvamento, aparece uma faixa vazia entre o último `SetCard` e o painel de entrada. Superfícies envolvidas: `components/session/SetList.tsx:56-90` (`FlatList` com `paddingBottom: 20`) e `components/SetCard.tsx:129-133` (`mb-2`); confirmar a contribuição exata no ajuste. Evidência: `composer_2026-08-26_17-15-31-572_6fc321.png`.

Os três itens acima ficam pendentes para a fase de correção, que só começa depois de completar Motion, TalkBack e performance.

## S11-QA-03 — Motion e Reduce Motion

Com Reduce Motion desligado, verificar uma interação real em cada componente:

- Button;
- SegmentedControl;
- ProgressBar;
- Skeleton;
- Dialog/DatePicker;
- Toast;
- RestTimer;
- entrada/saída de modais e teclado.

Repetir o fluxo crítico com Reduce Motion ligado.

PASS quando a resposta é única, previsível e cancelável: sem bounce decorativo empilhado, layout pulando, loop sobrevivendo ao unmount, callback atrasado após cancelamento ou perda de funcionalidade. Com Reduce Motion, o estado chega sem animação desnecessária e sem perder feedback/haptics válidos.

### Resultado da coleta — 2026-08-26

`[S11-QA-03] PASS — Samsung S23 / Android 16 / Expo Go 54.0.8`.

- Reduce Motion desligado: Button, SegmentedControl, ProgressBar, Skeleton, Dialog/DatePicker, Toast, RestTimer e entrada/saída de modais/teclado passaram.
- Reduce Motion ligado: fluxo crítico passou sem animação desnecessária, layout pulando, callback atrasado ou perda de funcionalidade/feedback.
- Findings novos: nenhum.

## S11-QA-04 — Acessibilidade crítica

Com TalkBack ligado, executar a sessão, edição de série, modais de histórico/RIR, resumo, programas, rotinas e suplementos.

PASS quando:

- heading, campos, botões, estados e valores têm nomes úteis;
- fundo de modal não recebe foco;
- emoji/SVG decorativo não vira parada;
- erro de validação foca o primeiro campo inválido e é anunciado uma vez;
- fechar modal devolve o foco à origem sem saltar para conteúdo oculto;
- tiles e progressos não duplicam anúncios.

Registrar as frases anunciadas; não inferir conformidade somente pelo screenshot.

### Resultado da coleta — 2026-08-26

`[S11-QA-04] SKIPPED — TalkBack não executado por decisão do operador`.

Esta etapa não é considerada PASS e não há evidência de conformidade em dispositivo real. Nenhum finding de TalkBack foi declarado; a lacuna fica explícita para eventual validação futura ou waiver de release.

## S11-QA-05 — Performance smoke

Com uma rotina contendo até 20 séries, verificar:

- scroll da lista de exercícios;
- abertura/fechamento do editor e RestTimer;
- renderização de charts e troca de período;
- conclusão/salvamento da sessão;
- navegação rápida entre tabs e retorno ao app.

PASS quando não houver crash, perda de dados, congelamento persistente, lista que deixa de responder ou regressão visível relevante. Anotar o volume de dados e o dispositivo usado.

### Resultado da coleta — 2026-08-26

`[S11-QA-05] PASS — Samsung S23 / Android 16 / Expo Go 54.0.8`.

- Scroll da sessão/lista, abertura e fechamento do editor/RestTimer, gráficos/Bio, conclusão e resumo, e navegação rápida passaram.
- Não houve crash, perda de dados, congelamento persistente ou lista sem resposta.
- Findings adicionais: um finding visual no fluxo de exercícios por duração.

1. **Controles de duração desalinhados e grandes demais:** `INICIAR SÉRIE` e `Salvar` têm larguras e alturas diferentes, e o `Salvar` não acompanha o alinhamento horizontal do botão de iniciar. As superfícies envolvidas são `app/session/exercise.tsx:567-601`: o iniciar usa `TouchableOpacity` customizado com `py-5 px-16`, enquanto salvar usa `Button size="lg" fullWidth` dentro de um wrapper sem largura explícita. Evidência: `composer_2026-08-26_17-31-32-441_2bb81b.png`.

A coleta física está encerrada. Os nove findings visuais/content-fit ficam congelados para a etapa de correção; TalkBack permanece explicitamente SKIPPED.

## Rodada de correções — 2026-08-26

Os nove findings receberam uma primeira rodada de correções em worktrees isolados por Antigravity e OpenCode, conforme a allowlist da coleta. A integração permanece sem commit neste checkpoint para permitir a rechecagem visual no mesmo Samsung S23.

- F1 — Biblioteca de templates: removido o botão de voltar textual duplicado; o header nativo da rota permanece como única origem de navegação.
- F2 — WarmupToggle: trilho e thumb passaram a compartilhar alinhamento vertical explícito.
- F3 — Fechar: headers de Check-in, Suplementos, Editor e Preview passaram a usar a variante temática `secondary`, sem alterar o componente global `Button`.
- F4 — Settings: Testar Notificação foi alinhado ao mesmo `RowButton` de Importar Dados e Exportar Alexandria.
- F5 — Suplementos: switch noturno passou a usar `theme.primary`/`theme.onPrimary` também no thumb.
- F6 — Ações da série: `Alert.alert` foi substituído por `SetActionsDialog` temático, com backdrop usando `theme.overlay`.
- F7 — Sessão: removido o `paddingBottom` extra da `FlatList` de séries.
- F8 — Resumo em espanhol: CTA reduzido para `Nuevo Entreno` para caber na coluna sem quebra awkward.
- F9 — Séries por duração: Iniciar e Salvar passaram a compartilhar largura total e escala `md`, com alinhamento horizontal comum.

### Evidência estática da rodada

- Suíte completa: **97 suites / 862 testes — PASS**.
- Typecheck: **PASS** (`npm run typecheck`).
- Lint: **PASS** (`npm run lint`).
- Diff check: **PASS** (`git diff --check`).
- Audit policy: **PASS** — 0 critical, 8 high allowlisted, 20 moderate, 0 low.
- Export Android/Hermes: **PASS** — bundle `entry-c2cc247d24f104dbf9796cf77de69561.hbc`, 8.628.845 bytes, verificado por `verify:android-export`.

### Estado pós-correção

Os testes automatizados cobrem os contratos dos nove findings, mas não substituem a rechecagem visual no dispositivo. S11-QA-01 e S11-QA-02 permanecem FAIL até Lucca confirmar os fluxos afetados no S23; S11-QA-04 permanece SKIPPED por decisão explícita do operador.

## Rechecagem visual pós-correção — 2026-08-26

`[S11-RECHECK] PARTIAL — Samsung S23 / Android 16 / Expo Go 54.0.8`.

Persistências e finding novo reportados pelo operador:

1. **F2 persiste — WarmupToggle:** quando ativado, o thumb fica visualmente off-center em comparação com o estado desligado. Evidências: `composer_2026-08-26_18-45-40-260_e63b59.png` (desligado) e `composer_2026-08-26_18-46-01-771_335f4f.png` (ativado).
2. **F7 persiste — spacing pós-save:** continua aparecendo uma faixa vazia no bottom da sessão após salvar uma série. Evidência: `composer_2026-08-26_18-47-00-407_748ac2.png`.
3. **F10 novo — tabs de Rotinas:** spacing vertical entre o header e as tabs está curto demais; `Programas` não segue o tratamento em caps das demais; `Todas` e `Geral` ficam sem distinção visual suficiente. Evidência: `composer_2026-08-26_18-47-31-682_264b9d.png`.

Os demais fluxos rechecados não receberam finding novo neste passe. F2, F7 e F10 ficam pendentes para uma segunda rodada de correção; nenhuma nova correção foi aplicada durante a coleta desta rechecagem.

## Registro de coleta

| ID | Estado/configuração | Resultado | Evidência/observação |
|---|---|---|---|
| S11-QA-01 | screenshots, claro/escuro, primeiro passe | FAIL — 5 findings | S23 / Android 16 / Expo Go 54.0.8; demais telas PASS |
| S11-QA-02 | pt/en/es/zh, fluxo crítico | FAIL — 1 content-fit | Idiomas/troca PASS; CTA `Nuevo Entrenamiento` quebra no resumo; 2 findings visuais adicionais registrados |
| S11-QA-03 | motion ON/OFF + Reduce Motion | PASS | S23 / Android 16 / Expo Go 54.0.8; ambos os modos passaram, sem findings novos |
| S11-QA-04 | TalkBack, fluxo crítico | SKIPPED | Não executado por decisão do operador; sem evidência de conformidade em dispositivo real |
| S11-QA-05 | rotina de até 20 séries | PASS | S23 / Android 16 / Expo Go 54.0.8; fluxo completo passou; 1 finding visual de controles de duração registrado |

## Exit criteria

- [ ] S11-QA-01 screenshot matrix PASS;
- [ ] S11-QA-02 locales/content fit PASS;
- [x] S11-QA-03 motion/Reduce Motion PASS;
- [ ] S11-QA-04 TalkBack crítico PASS;
- [x] S11-QA-05 performance smoke PASS;
- [ ] rechecagem visual pós-correção sem persistências ou findings novos;
- [x] todos os FAILs foram coletados antes de qualquer correção;
- [ ] configurações originais de largura, fonte, Reduce Motion e TalkBack restauradas;
- [x] correções finais limitadas a defeitos validados;
- [x] typecheck, lint, testes, audit e export Android verdes após eventuais correções;
- [ ] Lucca aprova a prancha/screenshots e os P2 deferred têm dono/motivo.

## Estado atual após a segunda rodada — 2026-08-26

`[S11-RECHECK-F1-F10] PASS — confirmação do operador no Samsung S23 / Android 16 / Expo Go 54.0.8`.

Lucca confirmou que os fluxos afetados pelos findings F1–F10 passaram na rechecagem visual. Essa confirmação foi feita na conversa; nenhum novo caminho de screenshot foi fornecido nesta rodada.

`[S11-F11] STATIC PASS — chips de pasta e fallback contra folder selecionada órfã`.

- Sem pastas customizadas, o hook exibe apenas `Todos`, evitando a duplicação visual `Todos`/`Geral`.
- Com pastas customizadas, `Todos` e as pastas existentes continuam disponíveis.
- Se a pasta selecionada deixar de existir, a tela volta para `Todos`.
- Suíte completa no checkpoint F11: **100 suites / 875 testes — PASS**.
- Typecheck: **PASS** (`npm run typecheck`).
- Lint: **PASS** (`npm run lint`).
- Diff check: **PASS** (`git diff --check HEAD`).
- Audit policy: **PASS** — 0 critical, 8 high allowlisted, 20 moderate, 0 low; nenhum high/critical fora da allowlist.

F11 e o escopo atual foram liberados no human gate. TalkBack continua explicitamente `SKIPPED`, com a lacuna mantida visível no registro.

**Decisão de release:** human gate aprovado por Lucca; o estado atual pode seguir para integração/release sem commit automático.

## Extensão de gerenciamento de pastas — validação estática (2026-08-27)

O escopo atual também inclui pastas persistentes para rotinas. Esta extensão ainda não foi rechecada no Expo Go nem em TalkBack.

- Migração `0020_low_microchip`: cria a tabela `folders`, preserva `Geral` e faz backfill das rotinas existentes.
- Dados legados com espaços, valores vazios/nulos ou variações de caixa são canonicalizados antes do backfill; variantes case-insensitive não geram chips duplicados.
- `FolderService` cobre criação, renomeação transacional (incluindo rotinas atribuídas) e exclusão transacional (movendo rotinas para `Geral`).
- O editor preserva a pasta ao salvar/editar e ao transformar template em rotina; a tela de Rotinas retorna para `Todos` quando a pasta selecionada deixa de existir.
- Suíte completa atual: **103 suites / 894 testes — PASS** (`npm run test -- --runInBand`).
- Typecheck: **PASS** (`npm run typecheck`).
- Lint: **PASS** (`npm run lint`).
- Diff check: **PASS** (`git diff --check HEAD`).
- Audit policy: **PASS** — 0 critical, 8 high allowlisted, 20 moderate, 0 low.
- Export Android/Hermes atual: **PASS** — bundle `entry-f913b38b1a99b1d151f5dbc6ef41d34f.hbc`, 8.655.088 bytes, verificado por `npm run verify:android-export`.

O teste de migração usa o `node:sqlite` do Node suportado pelo projeto e emite apenas o aviso experimental do runtime. A revisão correctness delegada desta extensão expirou por timeout; a revisão manual e os testes de migração/serviço não encontraram finding adicional. Isso não substitui validação visual no dispositivo.

## Human gate final — 2026-08-27

`[S11-HUMAN-GATE] PASS — Lucca confirmou passe completo no human gate.`

Nenhum finding novo foi reportado nessa confirmação. O passe libera o estado atual para a próxima etapa de integração/release. TalkBack continua registrado como `SKIPPED`; não há evidência de que tenha sido executado e ele não é promovido artificialmente a PASS.

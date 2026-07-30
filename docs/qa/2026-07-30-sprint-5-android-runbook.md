# Sprint 5 — Android Physical QA Runbook

- **Scope:** forms/keyboard, active workout, exercise logger, sets, rest timer, session recovery and finish flow
- **Runtime baseline:** `66aac5e` (`feat/open-design-redesign`)
- **Device record — preencher antes de começar:** fabricante/modelo `________`; Android release/build `________`; Expo Go version `________`
- **Goal:** approve Sprint 5 without mixing in Sprint 6, dependency upgrades or unrelated cleanup.

## Regra da coleta

**Colete todos os problemas antes de qualquer correção.** Envie cada defeito como uma linha + screenshot e continue o roteiro. Eu só começo a corrigir depois da mensagem **“último screenshot”**.

Não mude branch, não aplique hotfix e não reinicie o dataset no meio da coleta. Isso mantém todos os screenshots no mesmo baseline.

## Convenção de evidência

Capture apenas falhas e os screenshots obrigatórios de aprovação. Use:

```text
s5-{screen}-{theme}-{language}-{font}-{state}.png
```

Exemplos:

```text
s5-routine-editor-light-pt-1.0-dirty-dialog.png
s5-exercise-dark-es-1.3-20-sets.png
s5-rest-timer-light-pt-1.0-running.png
```

Reporte um defeito assim:

```text
[screen/state] esperado → atual
```

## Preflight

- [ ] Rode `feat/open-design-redesign` exatamente no commit `66aac5e`, sem mudanças locais de runtime.
- [ ] Preencha fabricante/modelo, Android release + build e versão do Expo Go no cabeçalho; se qualquer campo ficar vazio, o resultado é **BLOCKED**.
- [ ] Inicie o Expo a partir de `~/Projects/iron-log`, nunca de worktree com `node_modules` em symlink.
- [ ] Confirme que o app abre sem RedBox ou warning overlay persistente.
- [ ] TalkBack desligado durante Pass A e Pass B.
- [ ] Font scale 1.0 e display size normal na Pass A.
- [ ] Anote as contagens atuais de rotinas, programas, suplementos e metas antes de criar fixtures.
- [ ] Tablet, Web e upgrade de dependência ficam fora do escopo.

Se o Expo Go não conectar pela LAN, confira se `8081/tcp` está liberada no firewalld antes de investigar Metro.

## Fixtures determinísticos

Crie fixtures novos; **não edite entidades pessoais**. Use exatamente estes valores:

1. **Rotina:** nome `S5 QA — Full Body 20 Sets`; descrição `Keyboard, dirty state e texto longo — não editar`; `Agachamento Livre` com target `10x5`, descanso `90`, nota `S5-QA strength`; `Prancha` com target `10x30`, descanso `60`, nota `S5-QA duration`.
2. **Programa:** nome `S5 QA — Programa Keyboard e Conteúdo Longo`; descrição `Fixture determinístico da Sprint 5 — excluir após QA`; goal `hypertrophy`; duração `6` semanas; deload `4`; start date = dia da execução.
3. **Suplemento:** nome `S5 QA — Magnésio`; dose `200 mg`; frequência diária; use o primeiro horário disponível no formulário.
4. **Meta:** nome/descrição `S5 QA — Peso corporal`; target `80`; date = 30 dias após a execução; unidade de peso configurada no app.
5. **Sessão:** inicie pela rotina `S5 QA — Full Body 20 Sets`; registre exatamente 10 séries em cada exercício. A primeira série do Agachamento é warm-up (`20 kg`, `5 reps`, `RIR 5`); as outras nove são normais (`40 kg`, `5 reps`, `RIR 2`). Na Prancha, registre dez séries de duração e use uma delas para o cenário de interrupção em `0s`.

Após criar cada fixture, volte à listagem e confirme que existe **uma única entidade** com aquele nome. Se algum exercício padrão não existir, pare e marque **BLOCKED**; não substitua silenciosamente.

Não corrompa SQLite, não edite o banco manualmente e não reutilize IDs antigos para fabricar estado.

## Pass A — PT, light, font 1.0

### Editor de rotina

- [ ] Abra uma rotina existente, foque cada campo e confirme que teclado não cobre o input nem o CTA. => Teclado cobre campos de texto de exercicios principalmente os do fim da tela. (Meta, notas, desca)
- [ ] Tente salvar com nome inválido; o erro deve aparecer inline e o campo inválido deve receber foco/scroll. => Ok
- [ ] Corrija o nome e salve; toque rapidamente duas vezes e confirme uma única operação/navegação. => Ok
- [ ] Faça nova alteração e pressione Android Back; o diálogo de descarte deve abrir. => Ok
- [ ] Cancele o diálogo: valores permanecem. Abra novamente e descarte: tela fecha sem salvar a alteração. => Ok
- [ ] Confirme inputs e ações com pelo menos 44dp; nenhum footer entra sob a navigation bar. => footer dos cards nao fica abaixo da barra de navegacao mas nao ha spacing suficiente entre o ultimo card e a barra com os botoes de salvar e salvar como template

### Criar programa

- [ ] Percorra os campos com o teclado sem perder o submit CTA. => Ok
- [ ] Force erro de validação; mensagem e foco devem apontar o campo correto. => Ok
- [ ] Faça alteração e pressione Android Back; cancelar preserva e descartar fecha. => Ok
- [ ] Salve uma vez com dois taps rápidos; deve existir apenas um programa e uma navegação. => ok
- [ ] Confirme que nome/descrição longos não empurram ações para fora da tela. => ok

### Suplementos e Metas

- [ ] Abra criação/edição de suplemento; teclado, erro inline e CTA permanecem visíveis acima do inset inferior. => Ok
- [ ] Altere um valor e tente fechar pelo backdrop e Android Back; dirty dialog deve proteger a mudança. => Ok
- [ ] Cancele o descarte e confirme preservação; depois descarte e confirme reset ao reabrir. => ok
- [ ] Salve com taps rápidos e confirme uma única mutação. => ok
- [ ] Repita o fluxo no modal de meta, incluindo o date picker e um erro de valor/data. => ok
- [ ] O date picker deve anunciar/mostrar o valor selecionado e não sobrepor o CTA. => ok

### Sessão ativa e progresso

- [ ] Inicie uma sessão e confirme que o progresso começa em `0/N`. => ok
- [ ] Registre apenas uma série de aquecimento; o progresso de séries de trabalho não deve avançar. => ok
- [ ] Registre uma série normal; o progresso deve avançar exatamente uma vez. => ok
- [ ] Navegue entre exercícios e volte; contagem e estado permanecem estáveis. => ok
- [ ] Em exercício de duração, iniciar/parar/salvar funciona e avançar fica bloqueado enquanto o timer da série roda. => ok
- Obs: clicar duas vezes rapidamente em um exercicio abre a tela de registro de series duas vezes.

### Warm-up toggle

- [ ] O controle inteiro responde com target confortável; estado visual e TalkBack `checked` mudam juntos. => ok
- [ ] O thumb anima uma vez entre os lados, sem salto, overshoot ou animação de entrada ao abrir a tela. => ok
- [ ] Alterar o toggle marca a série seguinte como aquecimento; desligar marca a seguinte como normal. => ok

### Séries: 20-set session

- [ ] Registre até 20 séries sem travamento perceptível ou scroll quebrado.=> ok
- [ ] Só a série inserida/alterada anima; rerender comum não anima a lista inteira.=> ok
- [ ] Role uma série para fora da viewport e volte; ela não deve replayar a animação.=> ok
- [ ] O botão visível de ações abre opções nativas de editar/excluir.=> ok
- [ ] Swipe continua disponível e executa os mesmos caminhos.=> ok
- [ ] Edite peso/reps/duração/RIR e confirme persistência após sair e voltar.=> ok
- [ ] Exclua uma série e confirme; cancele outra exclusão e confirme que ela permanece.=> ok
- [ ] Status combinados usam texto único, por exemplo `Aquecimento · Editado`, sem badge morto de PR. => ok

### Timer de descanso

- [ ] Após salvar série, timer abre e o número é legível com o aparelho à distância do braço. => ok
- [ ] `+30s`, `-10s` e `Pular/Continuar` respondem com uma mão e ficam acima da navigation bar. => ok
- [ ] Swipe para baixo, backdrop e Android Back fecham sem prender foco ou teclado. => parcialmente ok, swipe para baixo nao fechou o timer na execução do teste.
- [ ] Nome longo do próximo exercício não corta nem empurra as ações. => ok
- [ ] Ao chegar em zero, estado final aparece e não dispara anúncios repetidos visualmente/sonoramente. => ok

### Interrupção e recuperação

- [ ] Digite carga/reps, altere RIR e warm-up, mas não salve a série. => ok
- [ ] Pressione Android Back; a saída só acontece depois de persistir o draft. => ok
- [ ] Reabra o mesmo exercício; todos os valores pendentes reaparecem e não são sobrescritos pelo histórico. => ok
- [ ] Repita deixando o app em background e removendo-o dos recentes; reabra a sessão e valide o draft. => ok
- [ ] Com série pendente, avance para o próximo exercício; a série salva uma vez antes da navegação ou a navegação não ocorre se salvar falhar. => ok
- [ ] Um draft de outro exercício/sessão nunca aparece na tela atual. => ok

### Finalizar e descartar sessão

- [ ] Abra finalizar sessão: estatísticas, sRPE e CTA permanecem visíveis e honestos. => ok
- [ ] Slider sRPE muda de 1 a 10 e o texto descritivo acompanha. => ok
- [ ] Confirmação de finalizar mostra resumo legível e ações claras. => ok
- [ ] Cancelar devolve ao formulário sem perder dados; confirmar finaliza uma única vez. => ok
- [ ] Diálogo de descarte usa ação destrutiva inequívoca; cancelar continua treino, confirmar remove a sessão correta. => ok

## Pass B — ES, dark, font 1.3 / maior display size

Passagem focada; não repita todo o CRUD:

- [ ] Routine editor e Create program: labels, erros e CTAs sem clipping ou overlap do teclado.
- [ ] Supplements e Goals: modal acima do inset inferior, data/valores legíveis e ações alcançáveis.
- [ ] Exercise logger: peso/reps, RIR, warm-up e próximo exercício visíveis sem scroll horizontal da tela.
- [ ] Lista de 20 séries permanece fluida; ação visível e Alert nativo cabem com textos em ES.
- [ ] Rest timer mantém número dominante, três ações tocáveis e nome longo do próximo exercício.
- [ ] Finish: stats, sRPE e dialogs não cortam texto nem ações.
- [ ] Contraste de texto muted, warning, success, danger e disabled permanece legível no dark theme.

Tudo igual ao light mode

## Pass C — Reduce Motion

- [ ] Ative Remove animations/Reduce Motion no Android e reabra o fluxo crítico. => ok
- [ ] Warm-up toggle muda imediatamente, sem timing residual. => ok
- [ ] Novas/alteradas séries aparecem sem animação local. => ok
- [ ] Rest timer e dialogs abrem/fecham sem spring/fade obrigatório. => ok
- [ ] Desative Reduce Motion sem mudar o toggle; ele não deve animar sozinho. => ok

## TalkBack

- [ ] ProgressBar anuncia contexto e progresso (`X de N`), não apenas “barra de progresso”. => ok
- [ ] Warm-up anuncia role switch e estado marcado/desmarcado. => ok
- [ ] RIR anuncia label, hint e valor/meaning de 0 a 5. => ok
- [ ] sRPE anuncia valor de 1 a 10 e descrição de esforço. => ok
- [ ] Ação visível da série anuncia botão/contexto; ações accessibility de editar/excluir continuam disponíveis. => ok
- [ ] Rest timer anuncia título, valor consultável e estado final apenas uma vez por descanso. => ok
- [ ] Dialogs recebem foco no título, permitem escape e devolvem foco sem trap. => ok
- [ ] Inputs com erro anunciam a mensagem e o foco retorna ao campo correto. => ok
- [ ] Ordem de foco segue a ordem visual em forms e exercício ativo. => ok

## Resultado da execução — 2026-07-30

**Status: BLOCKED — quatro findings abertos, sendo dois bloqueadores funcionais.**

A execução usou evidência textual no próprio runbook. Screenshots foram dispensados pelo executor; isso não impede a triagem funcional, mas o finding visual de spacing deverá ser revalidado no aparelho depois da correção.

| ID | Severidade | Categoria | Finding | Reprodução | Mapeamento inicial |
| --- | --- | --- | --- | --- | --- |
| `S5-QA-01` | Alta | Funcional / teclado | O teclado cobre campos `meta`, `notas` e `descanso` dos exercícios no fim do editor de rotina. | Adicionar exercícios suficientes para ocupar a tela e focar os inputs dos últimos cards. | `app/routines/editor.tsx`: o `ScrollView` depende apenas de `automaticallyAdjustKeyboardInsets`; os inputs internos não têm scroll-to-focus explícito. |
| `S5-QA-02` | Alta | Funcional / navegação | Double tap em um card de exercício abre a tela de registro duas vezes. | Na sessão ativa, tocar rapidamente duas vezes no mesmo exercício. | `app/session/[routineId].tsx`: o `onPress` chama `router.push` diretamente, sem lock síncrono de navegação. |
| `S5-QA-03` | Média | Funcional / UX | Swipe para baixo não fecha o timer de descanso; backdrop e Android Back funcionam. | Abrir o RestTimer e arrastar o bottom sheet para baixo. | `components/RestTimer.tsx`: o PanResponder está apenas no bubble phase e compete com os controles filhos; o dismissal exige `dy > 100`. |
| `S5-QA-04` | Baixa | Visual / spacing | Falta respiro entre o último card de exercício e o footer com `Salvar` / `Salvar como template`. Não há sobreposição com a navigation bar. | Rolar o editor até o último card. | `app/routines/editor.tsx`: conteúdo termina com padding inferior mínimo enquanto o footer é um sibling fixo. |

### Diagnósticos não bloqueantes observados no Metro

- warning de depreciação de `SafeAreaView`;
- warning de atualização lenta de `VirtualizedList` durante a sessão longa, sem travamento perceptível reportado no QA;
- avisos de versões recomendadas do Expo, mantidos fora do escopo desta Sprint.

### Reteste obrigatório após os fixes

- editor de rotina com vários cards e teclado aberto nos três inputs do último exercício;
- double tap repetido no card de exercício, confirmando uma única rota;
- swipe do RestTimer começando no handle, no conteúdo e próximo às ações;
- spacing do último card em PT/light e ES/dark com fonte 1.3.

## Screenshots obrigatórios

- [ ] Routine editor — light/PT, erro inline + teclado/CTA visíveis.
- [ ] Dirty discard dialog — light/PT, alteração preservada antes de confirmar.
- [ ] Goals ou Supplements — dark/ES, font 1.3, modal com inset inferior.
- [ ] Active exercise — light/PT, série warm-up + série normal e progresso correto.
- [ ] Set list — dark/ES, font 1.3, 20 séries e ação visível.
- [ ] Rest timer — light/PT, running com próximo exercício.
- [ ] Warm-up toggle — Reduce Motion ligado, estado on.
- [ ] Finish — dark/ES, sRPE e confirmação.

Sem necessidade de tirar screenshots tudo descrito no doc

## Reset e verificação do dataset

Faça o cleanup somente depois de capturar todas as evidências:

1. Pela UI normal, exclua a sessão de QA e depois programa, suplemento, meta e rotina cujo nome começa com `S5 QA —`.
2. Reabra cada listagem e confirme que a busca visual pelo prefixo `S5 QA —` retorna zero itens.
3. Compare as quatro contagens anotadas no preflight; todas devem voltar ao valor original.
4. Abra uma rotina e um registro pessoal que já existiam antes do teste; confirme que nomes, valores e histórico continuam iguais.
5. Se algum fixture não puder ser removido pela UI ou uma contagem divergir, não edite SQLite: marque **BLOCKED** e reporte o item remanescente.

## Critério de saída

Marque um resultado:

- **APPROVED:** todos os itens e screenshots passam.
- **BLOCKED:** existe crash, RedBox, perda/sessão duplicada, false success, controle crítico cortado, falha TalkBack ou screenshot obrigatório não revisado.

Para aprovação:

- [ ] treino completo foi executado com uma mão;
- [ ] teclado nunca cobriu campo focado ou CTA;
- [ ] 20 séries permaneceram fluidas;
- [ ] warm-ups não alteraram progresso de trabalho;
- [ ] nenhuma série/draft/sessão foi perdida ou duplicada;
- [ ] animações locais e Reduce Motion passaram;
- [ ] PT/light e ES/dark/font 1.3 passaram;
- [ ] TalkBack passou nos controles críticos;
- [ ] dataset original foi restaurado e verificado;
- [ ] todos os defeitos e screenshots foram enviados antes da mensagem **“último screenshot”** e antes de qualquer fix.

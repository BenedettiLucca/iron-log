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

- [ ] Abra uma rotina existente, foque cada campo e confirme que teclado não cobre o input nem o CTA.
- [ ] Tente salvar com nome inválido; o erro deve aparecer inline e o campo inválido deve receber foco/scroll.
- [ ] Corrija o nome e salve; toque rapidamente duas vezes e confirme uma única operação/navegação.
- [ ] Faça nova alteração e pressione Android Back; o diálogo de descarte deve abrir.
- [ ] Cancele o diálogo: valores permanecem. Abra novamente e descarte: tela fecha sem salvar a alteração.
- [ ] Confirme inputs e ações com pelo menos 44dp; nenhum footer entra sob a navigation bar.

### Criar programa

- [ ] Percorra os campos com o teclado sem perder o submit CTA.
- [ ] Force erro de validação; mensagem e foco devem apontar o campo correto.
- [ ] Faça alteração e pressione Android Back; cancelar preserva e descartar fecha.
- [ ] Salve uma vez com dois taps rápidos; deve existir apenas um programa e uma navegação.
- [ ] Confirme que nome/descrição longos não empurram ações para fora da tela.

### Suplementos e Metas

- [ ] Abra criação/edição de suplemento; teclado, erro inline e CTA permanecem visíveis acima do inset inferior.
- [ ] Altere um valor e tente fechar pelo backdrop e Android Back; dirty dialog deve proteger a mudança.
- [ ] Cancele o descarte e confirme preservação; depois descarte e confirme reset ao reabrir.
- [ ] Salve com taps rápidos e confirme uma única mutação.
- [ ] Repita o fluxo no modal de meta, incluindo o date picker e um erro de valor/data.
- [ ] O date picker deve anunciar/mostrar o valor selecionado e não sobrepor o CTA.

### Sessão ativa e progresso

- [ ] Inicie uma sessão e confirme que o progresso começa em `0/N`.
- [ ] Registre apenas uma série de aquecimento; o progresso de séries de trabalho não deve avançar.
- [ ] Registre uma série normal; o progresso deve avançar exatamente uma vez.
- [ ] Navegue entre exercícios e volte; contagem e estado permanecem estáveis.
- [ ] Em exercício de duração, iniciar/parar/salvar funciona e avançar fica bloqueado enquanto o timer da série roda.

### Warm-up toggle

- [ ] O controle inteiro responde com target confortável; estado visual e TalkBack `checked` mudam juntos.
- [ ] O thumb anima uma vez entre os lados, sem salto, overshoot ou animação de entrada ao abrir a tela.
- [ ] Alterar o toggle marca a série seguinte como aquecimento; desligar marca a seguinte como normal.

### Séries: 20-set session

- [ ] Registre até 20 séries sem travamento perceptível ou scroll quebrado.
- [ ] Só a série inserida/alterada anima; rerender comum não anima a lista inteira.
- [ ] Role uma série para fora da viewport e volte; ela não deve replayar a animação.
- [ ] O botão visível de ações abre opções nativas de editar/excluir.
- [ ] Swipe continua disponível e executa os mesmos caminhos.
- [ ] Edite peso/reps/duração/RIR e confirme persistência após sair e voltar.
- [ ] Exclua uma série e confirme; cancele outra exclusão e confirme que ela permanece.
- [ ] Status combinados usam texto único, por exemplo `Aquecimento · Editado`, sem badge morto de PR.

### Timer de descanso

- [ ] Após salvar série, timer abre e o número é legível com o aparelho à distância do braço.
- [ ] `+30s`, `-10s` e `Pular/Continuar` respondem com uma mão e ficam acima da navigation bar.
- [ ] Swipe para baixo, backdrop e Android Back fecham sem prender foco ou teclado.
- [ ] Nome longo do próximo exercício não corta nem empurra as ações.
- [ ] Ao chegar em zero, estado final aparece e não dispara anúncios repetidos visualmente/sonoramente.

### Interrupção e recuperação

- [ ] Digite carga/reps, altere RIR e warm-up, mas não salve a série.
- [ ] Pressione Android Back; a saída só acontece depois de persistir o draft.
- [ ] Reabra o mesmo exercício; todos os valores pendentes reaparecem e não são sobrescritos pelo histórico.
- [ ] Repita deixando o app em background e removendo-o dos recentes; reabra a sessão e valide o draft.
- [ ] Com série pendente, avance para o próximo exercício; a série salva uma vez antes da navegação ou a navegação não ocorre se salvar falhar.
- [ ] Um draft de outro exercício/sessão nunca aparece na tela atual.

### Finalizar e descartar sessão

- [ ] Abra finalizar sessão: estatísticas, sRPE e CTA permanecem visíveis e honestos.
- [ ] Slider sRPE muda de 1 a 10 e o texto descritivo acompanha.
- [ ] Confirmação de finalizar mostra resumo legível e ações claras.
- [ ] Cancelar devolve ao formulário sem perder dados; confirmar finaliza uma única vez.
- [ ] Diálogo de descarte usa ação destrutiva inequívoca; cancelar continua treino, confirmar remove a sessão correta.

## Pass B — ES, dark, font 1.3 / maior display size

Passagem focada; não repita todo o CRUD:

- [ ] Routine editor e Create program: labels, erros e CTAs sem clipping ou overlap do teclado.
- [ ] Supplements e Goals: modal acima do inset inferior, data/valores legíveis e ações alcançáveis.
- [ ] Exercise logger: peso/reps, RIR, warm-up e próximo exercício visíveis sem scroll horizontal da tela.
- [ ] Lista de 20 séries permanece fluida; ação visível e Alert nativo cabem com textos em ES.
- [ ] Rest timer mantém número dominante, três ações tocáveis e nome longo do próximo exercício.
- [ ] Finish: stats, sRPE e dialogs não cortam texto nem ações.
- [ ] Contraste de texto muted, warning, success, danger e disabled permanece legível no dark theme.

## Pass C — Reduce Motion

- [ ] Ative Remove animations/Reduce Motion no Android e reabra o fluxo crítico.
- [ ] Warm-up toggle muda imediatamente, sem timing residual.
- [ ] Novas/alteradas séries aparecem sem animação local.
- [ ] Rest timer e dialogs abrem/fecham sem spring/fade obrigatório.
- [ ] Desative Reduce Motion sem mudar o toggle; ele não deve animar sozinho.

## TalkBack

- [ ] ProgressBar anuncia contexto e progresso (`X de N`), não apenas “barra de progresso”.
- [ ] Warm-up anuncia role switch e estado marcado/desmarcado.
- [ ] RIR anuncia label, hint e valor/meaning de 0 a 5.
- [ ] sRPE anuncia valor de 1 a 10 e descrição de esforço.
- [ ] Ação visível da série anuncia botão/contexto; ações accessibility de editar/excluir continuam disponíveis.
- [ ] Rest timer anuncia título, valor consultável e estado final apenas uma vez por descanso.
- [ ] Dialogs recebem foco no título, permitem escape e devolvem foco sem trap.
- [ ] Inputs com erro anunciam a mensagem e o foco retorna ao campo correto.
- [ ] Ordem de foco segue a ordem visual em forms e exercício ativo.

## Screenshots obrigatórios

- [ ] Routine editor — light/PT, erro inline + teclado/CTA visíveis.
- [ ] Dirty discard dialog — light/PT, alteração preservada antes de confirmar.
- [ ] Goals ou Supplements — dark/ES, font 1.3, modal com inset inferior.
- [ ] Active exercise — light/PT, série warm-up + série normal e progresso correto.
- [ ] Set list — dark/ES, font 1.3, 20 séries e ação visível.
- [ ] Rest timer — light/PT, running com próximo exercício.
- [ ] Warm-up toggle — Reduce Motion ligado, estado on.
- [ ] Finish — dark/ES, sRPE e confirmação.

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

# Sprint 6 — QA física Android: i18n, content fit e acessibilidade

- **Status:** PENDING — executar todos os blocos antes de corrigir qualquer novo defeito.
- **Runtime candidate:** `feat/sprint-6-i18n-a11y` @ `c52999e086a19f1771bcf4f37174b82c8f6ff930`.
- **Baseline estático:** 93 suites / 837 testes; typecheck, Expo lint e audit policy verdes. Android Hermes export verificado no candidate.
- **Device alvo:** Samsung S23 físico via Expo Go.
- **Registrar antes de começar:** Android/build, versão do Expo Go, tema inicial, escala de fonte inicial e valor original de **Menor largura** nas Opções do desenvolvedor.

## Regra da coleta

Execute o runbook inteiro e registre **todos** os FAILs antes de qualquer correção. Não troque branch, não reinstale o app e não altere fixtures durante a coleta. Um defeito não interrompe os blocos seguintes, salvo crash ou perda de dados.

Formato de evidência:

- PASS: `[S6-QA-XX] PASS — estado/locale/escala`.
- FAIL: `[S6-QA-XX] esperado → atual — estado/locale/escala` + screenshot ou vídeo curto.
- TalkBack: registre a frase anunciada entre aspas; não inferir pelo visual.

## Setup determinístico

1. Abra o bundle do SHA acima no Expo Go e confirme que a tela inicial carrega sem red box.
2. Em **Configurações → Idioma**, confirme que existem `Português`, `English`, `Español` e `中文` e deixe `Português` selecionado.
3. Use tema claro e escala de fonte `1,0` para o primeiro passe.
4. Se não houver rotina adequada, crie `S6 QA — A11y/i18n` com:
   - `Agachamento Livre`: 2 séries × 5 repetições, descanso 60 s;
   - `Prancha`: 1 série × 30 s, descanso 30 s.
5. Um suplemento existente é suficiente. Se a lista estiver vazia, use a stack padrão ou crie `Creatina QA`, `5 g`, `Após o treino`, frequência diária.
6. Cleanup dos fixtures é dispensado: o banco local do Expo Go é ambiente de teste. Registre a dispensa no resultado final.

## S6-QA-01 — Catálogo e content fit em Português

Com tema claro e fonte `1,0`:

1. Abra **Rotinas → Templates**.
   - PASS: o CTA de cada template mostra **Usar**, sem literal em inglês, clipping ou sobreposição.
2. Abra **Bio → Check-in** e percorra todos os campos/estados visíveis.
   - PASS: não aparecem chaves (`bioCheckin.*`), fallback duplicado ou texto em outro idioma.
3. Abra um resumo de sessão que contenha análise/vereditos.
   - PASS: o título é **Análise por Exercício** e o conteúdo cabe sem truncar controles.
4. Abra **Suplementos** com pelo menos um item.
   - PASS: cabeçalho **Seus Suplementos**, progresso compartilhado visível, FAB e controles de item sem colisão.

## S6-QA-02 — Español: acentos, pontuação e consistência

Mude para **Español** em Configurações e reabra cada tela após a troca:

1. **Bio → Evolución/Análisis**.
   - PASS: aparecem `Variación de Peso`, `ANÁLISIS`, `métricas`, `Estás ganando...` ou `Estás perdiendo...` conforme o estado; nenhum `ganjar`, `metricas`, `analisis` ou inglês residual.
2. **Bio → Metas** em estado vazio.
   - PASS: descrição contém `métricas corporales`.
3. **Configurações → Backup/compartilhamento**: inspecione somente os textos disponíveis; não importe arquivo destrutivo.
   - PASS: mensagens usam `inválido`, `vacío` e `no está disponible` quando esses estados forem acionáveis com segurança.
4. **Suplementos**.
   - PASS: cabeçalho **Tus Suplementos** e todos os CTAs/modal em espanhol.
5. Percorra Home, Rotinas, Histórico e Bio.
   - PASS: perguntas/exclamações visíveis usam pontuação de abertura; nada em PT/ZH.

## S6-QA-03 — 中文: Han real e rótulo de duração

Mude para **中文**:

1. Percorra Home, Rotinas, Histórico, Bio, Suplementos, Configurações e Sobre.
   - PASS: copy de produto usa caracteres Han; `Iron Log` pode permanecer em alfabeto latino; não há pinyin/frases inglesas residuais.
2. Abra um resumo de sessão.
   - PASS: duração usa **时长**, nunca `市场`.
3. Abra **Suplementos**.
   - PASS: cabeçalho **您的补剂** e modal/controles permanecem legíveis.
4. Abra **Configurações → Backup/Sobre** e **Bio**.
   - PASS: textos longos quebram linha dentro dos cards, sem clipping horizontal.

## S6-QA-04 — English smoke e troca de idioma

1. Mude para **English** e percorra Home, Rotinas, uma sessão, Bio e Suplementos.
   - PASS: não há chaves, PT/ES/ZH residual ou layout quebrado.
2. Troque `English → Português → Español → 中文 → Português` sem reiniciar o app.
   - PASS: cada tela atualiza uma vez, seleção correta é anunciada/indicada e não ocorre crash ou estado misto.

## S6-QA-05 — Content fit a 320 dp e fonte ampliada

Antes de alterar o sistema, anote os valores originais.

1. Em **Opções do desenvolvedor → Menor largura**, ajuste temporariamente para `320 dp`.
2. Em **Acessibilidade → Melhorias de visibilidade → Tamanho e estilo da fonte**, use escala aproximada `1,3`.
3. Em cada locale (`pt`, `en`, `es`, `zh`), percorra:
   - Home;
   - lista e editor de Rotinas;
   - sessão com editor de série e RestTimer;
   - Bio/Check-in;
   - Suplementos e seu modal;
   - Configurações.
4. PASS: nenhum CTA/campo fica cortado, sobreposto ou inalcançável; texto pode quebrar linha sem empurrar ações para fora da viewport.
5. Aumente para `1,5` e repita o fluxo crítico em Português: iniciar sessão → editar série → salvar → abrir/fechar RestTimer → finalizar.
6. PASS: fluxo crítico concluído sem clipping, teclado cobrindo campo ou perda de ação.
7. Restaure **Menor largura** e escala de fonte aos valores originais antes do bloco TalkBack.

## S6-QA-06 — TalkBack: sessão e componentes centrais

Ative TalkBack. Use navegação por swipe e registre a frase efetivamente anunciada.

1. Inicie `S6 QA — A11y/i18n` e alcance o cronômetro.
   - PASS: cronômetro anuncia algo equivalente a **Tempo decorrido: 00:xx** quando focado, sem anúncio automático a cada segundo.
2. Complete uma série e abra **Editar série**.
   - PASS: modal é isolado da tela de fundo; título é heading; campos Peso, Repetições/Duração e RIR têm nomes distintos; Salvar e Cancelar são botões.
3. Limpe um campo obrigatório e tente salvar.
   - PASS: primeiro campo inválido recebe foco e o erro é anunciado uma vez, sem fechar o modal.
4. Navegue pelos tiles de estatística em resumo/relatório.
   - PASS: cada tile é uma única parada concisa com valor, rótulo e delta quando houver; filhos não duplicam anúncios.
5. Alcance um estado vazio com CTA.
   - PASS: emoji decorativo não recebe foco; título/descrição são lidos; CTA tem nome e papel de botão.

## S6-QA-07 — TalkBack: modais, programas, rotinas e suplementos

1. Na sessão, abra **Histórico do exercício** e o explicador de **RIR**.
   - PASS: cada modal isola o fundo, anuncia heading e oferece caminho de fechar nomeado; ao fechar, a navegação volta à tela de origem sem salto para conteúdo oculto.
2. Em **Programas**, percorra cards, ações de semana e criação.
   - PASS: controles interativos têm nome/papel; SVGs decorativos não viram paradas de foco.
3. Em **Editor de Rotina**, abra seletores/modais e percorra inputs e Cancelar/Salvar.
   - PASS: ordem coerente, nomes úteis e fundo do modal inacessível enquanto aberto.
4. Em **Suplementos**:
   - PASS: progresso tem valor compreensível; horário/FAB/editar/toggle têm nomes e estados; modal de adicionar/editar isola o fundo; ícones decorativos são ignorados.
5. Desative TalkBack ao terminar.

## Exit criteria

- [ ] S6-QA-01 PT PASS
- [ ] S6-QA-02 ES PASS
- [ ] S6-QA-03 ZH PASS
- [ ] S6-QA-04 EN + troca de idioma PASS
- [ ] S6-QA-05 320 dp + fonte 1,3; fluxo crítico 1,5 PASS
- [ ] S6-QA-06 TalkBack sessão/core PASS
- [ ] S6-QA-07 TalkBack modais/screens PASS
- [ ] Todos os FAILs foram coletados antes de qualquer correção
- [~] Cleanup dispensado por decisão do product owner para o banco do Expo Go
- [ ] Valores de Menor largura, fonte e TalkBack restaurados

A Sprint 6 só pode ser marcada `[DONE]` após gate estático final, revisão independente e todos os blocos físicos acima em PASS.
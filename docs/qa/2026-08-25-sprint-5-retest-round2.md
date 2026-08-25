# Sprint 5 — Reteste Físico Dirigido (resultado final)

- **Scope:** somente os dois FAILs do reteste de 2026-08-25 — S5-QA-01 (teclado no editor) e S5-QA-03 (swipe do RestTimer). S5-QA-02 e S5-QA-04 já haviam passado.
- **Runtime final:** `fix/sprint-5-device-retest` (commit final registrado após remoção dos logs de diagnóstico)
- **Device record:** Samsung S23; versão do Android e versão do Expo Go não registradas.
- **Execução:** Expo Go via LAN, Metro em `192.168.0.68:8081`.
- **Resultado:** S5-QA-01 PASS; S5-QA-03 PASS após instrumentação provar que o `Modal` Android entregava apenas o primeiro move (~0,4 px) quando o responder não era reivindicado no touch start.

## Regra da coleta

Colete os dois resultados antes de qualquer nova correção. Não mude branch nem reinicie o Metro.

## Fixtures determinísticos

Recrie apenas os fixtures necessários:

1. **Rotina:** nome `S5 QA — Full Body 20 Sets`; descrição idêntica ao runbook original; `Agachamento Livre` target `10x5`, descanso `90`, nota `S5-QA strength`; `Prancha` target `10x30`, descanso `60`, nota `S5-QA duration`.
2. **Sessão:** inicie pela rotina acima; 1 série no Agachamento é suficiente (o alvo é abrir o RestTimer, não completar o treino).

Após criar, confirme que existe **uma única** entidade com aquele nome. Ao final, delete a rotina e a sessão via UI e confirme zero itens `S5 QA` na busca.

## S5-QA-01 — Teclado no Editor de Rotina (fix: viewport resize)

1. Abra a rotina fixture no editor.
2. Toque em **Nota do Agachamento** (`S5-QA strength`). Espere o teclado abrir.
   - **PASS:** campo focado visível acima do teclado; input rolável até ficar claro; footer (Salvar) permanece acessível acima do teclado.
3. Toque em **Nota da Prancha** (`S5-QA duration`) sem fechar o teclado.
   - **PASS:** scroll automático traz o campo para cima do teclado; nada coberto.
4. Toque em **Descanso da Prancha** (`60`).
   - **PASS:** campo numérico visível.
5. Arraste a lista (dismiss on-drag) — teclado fecha, conteúdo não "pula".

Formato do defeito: `[editor/state] esperado → atual` + screenshot.

## S5-QA-03 — RestTimer swipe-to-dismiss (fix: capture gate)

1. Na sessão, registre uma série para abrir o RestTimer.
2. Arraste para baixo **pelo número da contagem** (gesto natural, pode ter leve diagonal).
   - **PASS:** o sheet acompanha o dedo desde o início do arrasto e fecha ao soltar.
3. Reabra o timer (ou registre outra série) e arraste **acima dos botões**.
   - **PASS:** tracking imediato; fecha ao soltar.
4. Botões: `+30s`, `-10s`, `Pular` com toques normais.
   - **PASS:** cada toque dispara exatamente uma ação; nenhum "swipe fantasma".

## Exit criteria

- [x] S5-QA-01 PASS em todos os três campos (nota Ag., nota Pr., descanso Pr.)
- [x] S5-QA-03 PASS nas duas áreas de swipe; botões já haviam passado antes do fix final
- [~] Cleanup dispensado pelo product owner: banco local do Expo Go é ambiente de teste; fixtures `S5 QA` podem permanecer e devem ser consideradas no baseline de uma QA futura
- [x] Nenhum novo defeito reportado

Aprovado no device → gate estático + reviews, merge FF para `feat/open-design-redesign`, push e PR único para `master`.

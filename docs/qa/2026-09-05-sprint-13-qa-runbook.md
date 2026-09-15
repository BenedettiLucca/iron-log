# QA Físico — Sprint 12+13 (Trust Before Breadth + Keep Awake + Rest Notification)

> **Para você executar no celular.** Colete TODOS os defeitos antes de reportar (regra collect-all-before-fix). Não corrija nada no meio — só anote e me mande no final, de preferência com "último screenshot" quando encerrar a coleta.

## Escopo

- **#97** — teclado Android no gerenciador de pastas
- **#96 + #103** — A/B/A: ocorrências separadas, agora inclusive no **resume** (banner/dialog de recuperação)
- **#91A** — Estimated 1RM honesto (cap 12 reps + origem do set)
- **#88** — keep awake durante sessão + toggle em Configurações
- **#89** — notificação de descanso garantida (agendamento local; cancela em skip/close/sair da tela)

**Baseline:** branch `supersprint/s12-trust-before-breadth` @ 069d2f2 (rebased na master c442b8f). Gates verdes: 117 suites / 957 testes, typecheck, lint, audit, export Hermes verificado (8.8MB).

## Dispositivo

| Campo | Valor |
|---|---|
| Fabricante/modelo | ______ |
| Android | ______ |
| Tema/idioma inicial | pt-BR, light, fonte 1.0 |

## Como conectar

1. No PC: `cd ~/Projects/iron-log && npx expo start` (já vou deixar rodando).
2. No celular: Expo Go → escanear o QR (mesma rede Wi-Fi). Bundle via dev server; o export estático já foi verificado.

## Fixtures (criar antes dos testes, prefixo `SN13`)

1. Rotina `SN13 ABA` com o **mesmo exercício 2x** (ex: Supino Reto), targets **diferentes** (1ª: 3x5; 2ª: 3x10) e um terceiro exercício qualquer.
2. Rotina `SN13 Flexao` com flexão 3x15 (só reps > 12) pro teste do e1RM.
3. Uma pasta extra em "Gerenciar pastas" no **final da lista** pro teste de rename.

## Teste 1 — #97 Teclado x pastas

1. Minhas Rotinas → **Gerenciar pastas**.
2. Focar campo **Nova pasta** com teclado aberto: campo visível? Botão **Criar** alcançável? Crie `SN13 Teclado`.
3. **Renomear** numa pasta no final da lista: campo sobe acima do teclado? Salvar tocável? Renomeie para `SN13 Renomeada`.
4. Repita no **tema escuro**.

**Pass:** campo focado + CTAs acessíveis nos dois temas, sem fechar o teclado.

## Teste 2 — #96 + #103 A/B/A com resume

1. Inicie `SN13 ABA`. Confira: **3 cards**, dois Supinos com targets distintos.
2. 1º Supino: logue `100kg x 5`. Volte: card 1 mostra progresso, **card 2 continua 0 sets**.
3. **Mate o app** (swipe no recents) com a sessão em andamento.
4. Reabra: dialog/banner **"continuar treino"** → retome. Você deve cair no exercício certo e o **card 2 deve continuar 0 sets** (identidade de ocorrência preservada no resume).
5. 2º Supino: prefill sugere carga recente, logue `70kg x 10`. Header: progresso avançando corretamente.
6. Finalize. Resumo: **dois blocos de Supino separados**, targets e sets corretos.

**Pass:** nenhuma confluência entre ocorrências, nem após o resume.

## Teste 3 — #91A e1RM

1. Bio → **Analytics** → **Estimated 1RM**.
2. Toda linha mostra origem `peso × reps` (+ data).
3. Exercício com só sets > 12 reps (`SN13 Flexao`) **não aparece** no ranking.
4. Nenhum exercício duplicado.

**Pass:** valores ≤ cap de 12 reps, origem sempre presente.

## Teste 4 — #88 Keep awake

1. Settings: confira o toggle **"Manter tela ligada durante o treino"** (default: ligado).
2. Com toggle **ligado**, inicie qualquer sessão e deixe a tela parada > timeout de screen timeout do aparelho: tela **não apaga**.
3. Desligue o toggle **durante** a sessão: tela deve poder apagar normalmente.
4. Finalize/descarte a sessão: tela volta ao comportamento normal (apaga).
5. Feche o app: nada de tela presa ligada.

**Pass:** tela ligada só durante sessão com toggle ativo; toggle responde na hora.

## Teste 5 — #89 Notificação de descanso

1. Em qualquer sessão, logue um set que dispara o descanso. Aguarde o tempo: **notificação chega** mesmo com app em background (tela inicial/outra tela) → título "Descanso concluído" e corpo com o próximo exercício.
2. Logue outro set e **pule o descanso** (Skip no timer): **nenhuma notificação** chega.
3. Logue set e feche o descanso pelo **X** (close): nenhuma notificação.
4. Logue set e **finalize a sessão** durante o descanso: nenhuma notificação órfã depois.
5. Bônus: logue set e **mate o app** durante o descanso — se a notificação chegar no tempo certo, o agendamento local está blindado contra Doze/JS morto.

**Pass:** notificação só existe quando o descanso está correndo; zero órfãs.

## Formato de reporte

Um defeito por linha: `[tela/estado] esperado → obtido` (+ screenshot).

No final: **APPROVED** se tudo passou, ou a lista completa + "último screenshot". Só depois disso eu preparo o lote de correções.

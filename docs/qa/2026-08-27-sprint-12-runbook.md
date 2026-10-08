# QA Físico — Sprint 12 (Trust Before Breadth)

> **Para você executar no celular.** Colete TODOS os defeitos antes de reportar (regra collect-all-before-fix). Não corrija nada no meio — só anote e me mande no final, de preferência com "último screenshot" quando encerrar a coleta.

## Escopo

- **#97** — teclado Android no gerenciador de pastas
- **#96** — mesmo exercício 2x na mesma rotina (A/B/A), com progresso e sets separados
- **#91A** — Estimated 1RM honesto (cap 12 reps + origem do set)

**Baseline:** branch `supersprint/s12-trust-before-breadth` @ e586f54 + 27 arquivos alterados. Gates estáticos todos verdes (110 suites / 920 testes, typecheck, lint, audit, export Android Hermes OK).

## Dispositivo

| Campo | Valor |
|---|---|
| Fabricante/modelo | ______ (ex: Samsung S23) |
| Android | ______ |
| Expo Go | ______ |
| Tema/idioma inicial | pt-BR, light, fonte 1.0 |

## Como conectar

1. No PC: `cd ~/Projects/iron-log && npx expo start` (na raiz do repo, não em worktree).
2. No celular: Expo Go → escanear o QR (mesma rede Wi-Fi). Se falhar o download do bundle, me avise — pode ser firewall (eu abro a porta 8081).

## Fixtures (criar antes dos testes)

Crie com prefixo `SN12` para não misturar com seus dados reais:

1. Rotina **`SN12 ABA`** com exercícios na ordem: **Supino Reto → Remada Curvada → Supino Reto** (o mesmo exercício 2x — este é o teste central da #96).
   - Na 1ª ocorrência do Supino: alvo `1x5`, descanso 120
   - Na Remada: alvo `1x8`
   - Na 2ª ocorrência do Supino: alvo `1x10`, descanso 60
2. Pelo menos **4 pastas** em Minhas Rotinas (para ter lista longa no gerenciador).

Se a rotina com Supino duplicado **não salvar**, PARE: é exatamente o bug #96 — me reporte como FALHA com screenshot e siga os outros testes.

## Teste 1 — #97 Teclado x pastas (Android)

1. Minhas Rotinas → **Gerenciar pastas**.
2. Toque no campo **Nova pasta**. Com o teclado aberto: o campo fica visível? O botão **Criar pasta** é alcançável (role se precisar, sem fechar o teclado)? Crie a pasta `SN12 Teclado`.
3. Toque em **Renomear** numa pasta que esteja **no final da lista**. O campo de rename sobe acima do teclado? O **Salvar** é tocável com o teclado aberto? Renomeie para `SN12 Renomeada`.
4. Repita no **tema escuro**.

**Pass:** campo focado + CTA acessíveis nos dois cenários, sem precisar fechar o teclado.

## Teste 2 — #96 A/B/A

1. Inicie a rotina `SN12 ABA`.
2. Confira a lista: **3 cards**, com os dois Supinos independentes (targets diferentes visíveis).
3. Abra o 1º Supino, logue 1 set: `100kg x 5`. Volte. O card do 1º Supino deve mostrar progresso; o **2º Supino deve continuar 0 sets**.
4. Abra o 2º Supino: prefill deve sugerir carga recente do Supino (histórico), logue `70kg x 10`. Volte.
5. Confira o header: progresso **2/3** concluídos.
6. Avance até finalizar. Na tela de resumo: os **dois Supinos aparecem separados**, cada um com a meta certa (1x5 e 1x10) e os sets certos.
7. Exporte/compartilhe o resumo (se usar o botão de copiar): os dois blocos de Supino devem estar separados com targets distintos.

**Pass:** nenhuma confluência de sets ou targets entre as duas ocorrências; histórico antigo intacto.

## Teste 3 — #91A e1RM

1. Bio → **Analytics** → card **Estimated 1RM**.
2. Cada linha deve mostrar algo como `Supino Reto` + abaixo `100kg × 5 · 27/08/2026` e à direita o valor `116.7kg`.
3. Se um exercício só tem sets com **mais de 12 reps** (ex: flexão 15 reps), ele **não deve aparecer** no ranking (antes aparecia com valor inflado).
4. O mesmo exercício **não pode aparecer duas vezes** com nomes iguais.

**Pass:** toda linha tem origem (peso × reps, data quando houver); nenhum valor absurdo de >12 reps.

## Formato de reporte

Um defeito por linha, neste formato:

`[tela/estado] esperado → obtido` (+ screenshot)

Ex: `[pastas/teclado] Criar pasta acessível → botão coberto pelo teclado`

No final: **APPROVED** se tudo passou, ou a lista completa + "último screenshot". Só depois disso eu preparo o lote de correções.

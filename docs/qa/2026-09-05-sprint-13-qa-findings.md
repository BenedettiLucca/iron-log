# Findings — QA Sprint 12+13 (2026-09-05, S23, tema escuro)

## Teste 1 — #97 Teclado x pastas: FAIL
- Falha na CRIAÇÃO de pasta (campo/botão cobertos pelo teclado)
- Falha no RENAME de pasta (ambos os temas, light e dark)
- Screenshots anexados pelo Lucca (1 recebido: overlay "Gerenciar pastas" com campo "Nova pasta" + teclado aberto)

## Teste 2 — #96+#103 A/B/A: PARTIAL FAIL
- Comportamento OK (separação de ocorrências, resume correto)
- BUG: React duplicate key `1` — app/[routineId]/[routineId].tsx:371 usa key={ex.id} em Card; colide em A/B/A (mesmo exercício 2x). Correto: routineExerciseId

## Teste 3 — #91A e1RM: SUCCESS
## Teste 4 — #88 keep awake: SUCCESS

## Teste 5 — #89 notificação descanso: FAIL
- Notificação NUNCA chega (set logado → sair pra outro app → nada)
- Suspeita a investigar: gate isSupported/schedule em dev (Expo Go) + permissão POST_NOTIFICATIONS

## Resoluções da noite (2026-09-05, pós-QA)
- #89: 3 fixes (gate storeClient removido do rest-timer 07f40ad, channel API 8df817d, LogBox push-warning 830be6e) — RE-TESTADO NO DEVICE: PASS com app em background (permissão POST_NOTIFICATIONS era o último elo)
- Key dup preview + expand A/B/A + PR badges dedupe: d9f64d0 (device re-test pendente)
- #97: lote delegado a lane OC (worktree s13-folder-keyboard-device)
- Issues novas: #112 (SDK 57/dev build), #113 (permissão), #114 (app morto)
- Trust II (#102/#104/#105/#106/#107/#109): 3 lanes AGY despachadas

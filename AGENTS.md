# AGENTS.md — Iron Log

Instruções para agentes trabalhando no app local-first de treino e bio-tracking. Este arquivo
substitui `CLAUDE.md` e `GEMINI.md` na raiz. Procure um `AGENTS.md` mais próximo antes de editar
uma subárvore; pedidos explícitos do usuário prevalecem.

## O que é o repo

React Native + Expo SDK 54, Expo Router, TypeScript, SQLite local com Drizzle, NativeWind/Reanimated
e i18n pt/en/es/zh. As áreas críticas são `app/session/` (treino ativo), `src/db/` (schema e
migrações), `hooks/`, `services/`, `components/`, `src/validators/` e `drizzle/`.

## Ambiente e comandos

O `package.json` fixa Node `>=22.22.2 <23.0.0` e npm `>=10.9.7 <11.0.0`.

```bash
npm install
npm run verify           # Pipeline completo: typecheck -> lint -> test:coverage -> export -> verify
npm run audit:high       # Gate de segurança (fail-closed contra vulnerabilidades não permitidas)
npm run typecheck
npm run lint
npm test
npm run test:coverage
npx drizzle-kit generate
npm run start
npm run android
npm run web
npm run export:android
npm run verify:android-export
# Benchmark de volume:
# IRON_LOG_BENCH=1 npm test -- __tests__/services/analytics-database.test.ts --runInBand --watchAll=false
```

Consulte `docs/qa/agent-workflow.md` para o protocolo detalhado de QA, hierarquia de testes e runbook.

`npx drizzle-kit generate` deve ser executado quando `src/db/schema.ts` mudar; revise a migration
gerada em `drizzle/` e adicione/atualize testes. Build Android/EAS e uso de dispositivo são
validações diferentes de typecheck, lint e Jest; não misture esses níveis no relatório.

## Contratos de produto e dados

- `src/db/schema.ts` é a fonte de verdade do modelo. Preserve foreign keys, migrations, soft
  deletes e compatibilidade com dados locais existentes.
- O fluxo `app/session/` precisa preservar timer, persistência, undo, navegação e finalização;
  qualquer refactor nessa área exige testes de regressão e, quando possível, smoke em Android.
- Use os componentes/tokens do design system, `useHaptics()`, validators Zod e o sistema de i18n;
  não introduza telas com strings ou cores hardcoded quando houver abstração existente.
- Export/backup, fotos, métricas e credenciais de integrações são dados sensíveis. Não commite
  banco, fotos, tokens, `.env` ou conteúdo real de usuário.

## Fluxo de trabalho

1. Comece por `git status --short --branch`; preserve mudanças locais, inclusive migrations e
   testes que outra sessão possa estar produzindo.
2. Não use `git reset --hard`, `git clean`, checkout destrutivo ou `git stash` para limpar o repo.
3. Faça a menor mudança coerente, rode primeiro o teste afetado e só depois o gate mais amplo.
4. Antes de implementar mudança não-trivial, valide a abordagem em si: questione se o desenho
   escolhido é o correto, não apenas se o código está correto dentro da solução proposta. Se a
   abordagem parecer errada, pare e reporte antes de codificar.
5. Review adversarial não expande escopo: run sem erro não recebe "melhoria" especulativa nem
   refactor fora do ticket; registre como issue separada.
6. Antes de concluir, rode `git diff --check`, revise o diff completo e registre qualquer skip,
   falha preexistente ou validação que depende de Android/credenciais.

## Git e definição de pronto

Stage apenas os arquivos pretendidos; use Conventional Commits, não bypass hooks e não adicione
créditos de agente/LLM. Push, merge, release ou alteração de dados externos exigem autorização
explícita e verificação posterior. A resposta final deve separar fato, inferência e opinião.

## QA Android agent-native (obrigatório para mudanças em UI/fluxo)

Qualquer mudança em `app/`, `components/`, `hooks/` ou `services/` que afete comportamento visível
deve ser validada no AVD antes de PR — automação e gates executáveis primeiro, julgamento depois.

```bash
scripts/qa.sh boot       # sobe AVD headless ironlog-qa (espera sys.boot_completed, sem sleep fixo)
scripts/qa.sh install    # builda assembleDebug (se necessário) e instala
scripts/qa.sh app        # lança o app
scripts/qa.sh smoke      # suíte Maestro (.maestro/*.yaml) — DEVE passar 100% antes de PR
scripts/qa.sh logs       # logcat filtrado (ReactNativeJS/ReactNative/crashes)
scripts/qa.sh snap       # screenshot em .qa-artifacts/
scripts/qa.sh reset      # pm clear — estado limpo para o próximo teste
scripts/qa.sh stop       # desliga o emulador
```

Protocolo para coding agents (agy/oc/Hermes):

1. `scripts/qa.sh boot` → `install` → `app`. Nunca presuma que o emulador está pronto: use os
   comandos, que esperam condições reais via ADB.
2. QA exploratório via MCP `device-mcp` (tools `device_*`, `hermes_*`) — prefira
   `device_snapshot`/labels de acessibilidade a coordenadas; screenshot só como fallback.
3. Fluxo quebrado = colete evidência (`qa.sh snap` + `qa.sh logs`), diagnostique, corrija, rebuild
   e re-teste. Sem gates Android passando, não há "pronto".
4. Cenário valioso descoberto em QA exploratório vira flow `.maestro/` (regressão determinística).
   Testes não são rubber stamp: nunca afrouxe uma assertion sem justificativa explícita no diff.
5. Requisito de ambiente: `/dev/kvm` é **obrigatório** (módulo `kvm_amd`; ver
   `docs/agentic-android-qa.md`). Emulador x86_64 **se recusa a bootar sem KVM** — não é apenas
   mais lento.

Detalhes de arquitetura e troubleshooting: `docs/agentic-android-qa.md`.

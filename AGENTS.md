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
```

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
4. Antes de concluir, rode `git diff --check`, revise o diff completo e registre qualquer skip,
   falha preexistente ou validação que depende de Android/credenciais.

## Git e definição de pronto

Stage apenas os arquivos pretendidos; use Conventional Commits, não bypass hooks e não adicione
créditos de agente/LLM. Push, merge, release ou alteração de dados externos exigem autorização
explícita e verificação posterior. A resposta final deve separar fato, inferência e opinião.
